// The Solmere police: a wanted level from 0 to 5 stars, patrol cars that
// spawn on the nearest avenue and chase the player (ramming the car, or
// dropping foot cops when the player is on foot), and foot cops who pursue
// and shoot. The heat only cools when no officer can see the player for
// a while; the safehouse garage clears it at once.
import * as THREE from 'three';
import { groundDistance, makePerson, animatePerson, clamp } from './utils.js';

export class Police {
  constructor(game) {
    this.game = game;
    this.heat = 0;
    this.cars = [];
    this.cops = [];
    this.spawnTimer = 0;
    this.unseen = 0;
    this.sirenTimer = 0;
  }

  get stars() {
    return Math.min(5, Math.ceil(this.heat));
  }

  // Commit a crime: raise the heat and reset the "unseen" timer.
  crime(amount) {
    this.heat = clamp(this.heat + amount, 0, 5);
    this.unseen = 0;
  }

  // Clear the heat entirely (safehouse, or the player vanished).
  clear() {
    this.heat = 0;
    this.unseen = 0;
    this.game.hud.message('Heat cleared • keep a low profile');
    for (const car of this.cars) car.active = false;
    for (const cop of this.cops) {
      cop.hp = 0;
      cop.mesh.visible = false;
    }
  }

  spawn(x, z) {
    const car = this.game.vehicles.spawn('police', x, z, 0);
    car.active = true;
    car.hp = 100;
    this.cars.push(car);
    return car;
  }

  spawnCop(x, z) {
    const mesh = makePerson(this.game.scene, '#233d4d', true);
    mesh.position.set(x, 0, z);
    const cop = { mesh, p: mesh.position, hp: 100, kind: 'police', attack: 2 };
    this.cops.push(cop);
    return cop;
  }

  // Line of sight between two ground points, blocked by any building.
  visible(a, b) {
    const ray = new THREE.Ray(
      new THREE.Vector3(a.x, 1.7, a.z),
      new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize()
    );
    const length = groundDistance(a, b);
    for (const solid of this.game.city.solids) {
      const hit = ray.intersectBox(
        new THREE.Box3(
          new THREE.Vector3(solid.x - solid.w, 0, solid.z - solid.d),
          new THREE.Vector3(solid.x + solid.w, solid.h, solid.z + solid.d)
        ),
        new THREE.Vector3()
      );
      if (hit && hit.distanceTo(ray.origin) < length) return false;
    }
    return true;
  }

  update(dt) {
    const game = this.game;
    this.spawnTimer -= dt;
    if (!this.stars) return;
    const active = this.cars.filter((car) => car.active && car.hp > 0);
    // Keep the pressure up: spawn another cruiser every few seconds.
    if (this.spawnTimer <= 0 && active.length < Math.min(6, this.stars + 1)) {
      // Four and five stars bring the next cruiser twice as fast.
      this.spawnTimer = this.stars >= 4 ? 3 : 5;
      const p = game.player.p;
      const road = game.city.roads.reduce((a, b) =>
        Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a
      );
      this.spawn(road + 4, clamp(p.z + (game.rng() > 0.5 ? 60 : -60), -210, 210));
    }

    let seen = false;
    for (const car of active) {
      const p = game.player.p;
      const d = groundDistance(car.p, p);
      if (d < 95 && this.visible(car.p, p)) seen = true;
      if (d > 160) {
        car.active = false;
        continue;
      }
      // Chase: steer toward the player, snapping to the road grid when far
      // off-axis so cruisers drive around blocks instead of through them.
      let target = p.clone();
      if (Math.abs(car.p.x - p.x) > 14 && Math.abs(car.p.z - p.z) > 14) {
        const near = game.city.roads.reduce((a, b) =>
          Math.abs(b - car.p.z) < Math.abs(a - car.p.z) ? b : a
        );
        target.set(car.p.x, p.y, near);
        if (Math.abs(car.p.z - near) < 6) target.set(p.x, 0, near);
      }
      const desired = Math.atan2(target.x - car.p.x, target.z - car.p.z);
      const delta = Math.atan2(Math.sin(desired - car.angle), Math.cos(desired - car.angle));
      car.angle += clamp(delta, -dt * 1.5, dt * 1.5);
      car.speed = Math.min(32, Math.max(4, d * 0.8));
      const old = car.p.clone();
      car.p.x += Math.sin(car.angle) * car.speed * dt;
      car.p.z += Math.cos(car.angle) * car.speed * dt;
      if (game.city.resolve(car.p, old, 1.5)) {
        car.angle += dt * 3;
        car.speed = 0;
      }
      // Ramming range: damage the player's car, or hurt Danny on foot.
      if (d < 3.4) {
        if (game.player.car) {
          if (game.player.car.collision <= 0) {
            game.vehicles.damage(game.player.car, 8);
            game.player.car.speed += 5;
          }
        } else {
          game.player.hurt(dt * 12);
        }
      }
      // Drop a foot cop when the player is on foot and close by.
      if (
        !game.player.car &&
        d < 24 &&
        this.cops.filter((cop) => cop.hp > 0).length < this.stars + 1
      ) {
        this.spawnCop(car.p.x + 3, car.p.z);
      }
    }

    for (const cop of this.cops) {
      if (cop.hp <= 0) continue;
      const d = groundDistance(cop.p, game.player.p);
      if (d < 65 && this.visible(cop.p, game.player.p)) seen = true;
      cop.mesh.lookAt(game.player.p.x, 0, game.player.p.z);
      if (d > 2 && d < 90) {
        const old = cop.p.clone();
        cop.p.addScaledVector(
          new THREE.Vector3(game.player.p.x - cop.p.x, 0, game.player.p.z - cop.p.z).normalize(),
          dt * 3.6
        );
        game.city.resolve(cop.p, old, 0.5);
        animatePerson(cop.mesh, game.time, true);
      }
      cop.attack -= dt;
      if (cop.attack <= 0 && d < 35 && this.visible(cop.p, game.player.p)) {
        cop.attack = 1.7;
        // Caught at point blank with almost no health: busted, not dead.
        if (d < 2.2 && !game.player.car && game.player.hp < 25) {
          game.die('BUSTED', 'Your ride ends here. Release fee: $150.');
          return;
        }
        game.player.hurt(game.player.car ? 2 : 6);
        game.audio.tone(160, 0.08, 'sawtooth', 0.1);
      }
    }

    // Heat decays only while nobody can see the player.
    this.unseen = seen ? 0 : this.unseen + dt;
    if (this.unseen > 12) {
      this.heat = Math.max(0, this.heat - dt * 0.13);
      if (this.heat === 0) this.clear();
    }
    this.sirenTimer -= dt;
    if (this.sirenTimer <= 0) {
      this.sirenTimer = 0.15;
      game.audio.siren(game.time);
    }
  }
}
