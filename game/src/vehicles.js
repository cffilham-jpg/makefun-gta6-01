// Cars: building them from boxes, parking a fleet around the city, and
// driving the one Danny is in. Each car is a small record — mesh, heading,
// speed, health, wheels and (for police) light bars — shared by the
// traffic AI, the police chases and the player's driving. Stealing a car
// (E near one) is a crime; crashing one hard enough earns heat too.
import * as THREE from 'three';
import { addBox, addCylinder, clamp, groundDistance, burst } from './utils.js';

export const TYPES = ['sedan', 'coupe', 'SUV', 'pickup', 'police'];

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.all = [];
    const paints = ['#df775b', '#d6ad62', '#72a6a1', '#e6d8b4', '#4c697b'];
    for (let i = 0; i < 27; i++) {
      const x = [-7, 57, 121, 185, -71][i % 5];
      const z = -180 + Math.floor(i / 5) * 64 + (i % 3) * 7;
      this.spawn(TYPES[i % 4], x, z, Math.PI, paints[i % 5]);
    }
    // Danny's first ride, parked beside the safehouse.
    this.spawn('coupe', 4, 30, Math.PI, '#e39b52');
  }

  // Assemble a car from boxes: body, cabin, glass, wheels, lights. Police
  // cruisers get a roof bar with red and blue flashers.
  spawn(type, x, z, angle = 0, color = '#82aaa2') {
    const game = this.game;
    const group = new THREE.Group();
    const isSuv = type === 'SUV';
    const isPickup = type === 'pickup';
    const isCop = type === 'police';
    const length = type === 'coupe' ? 4.8 : 5.4;
    addBox(group, 2.4, 0.65, length, isCop ? '#e6e5d8' : color, 0, 0.9, 0);
    addBox(group, 2.25, 0.3, length - 0.2, isCop ? '#1b303c' : color, 0, 1.25, 0);
    addBox(group, 1.95, isSuv ? 1.1 : 0.85, isPickup ? 1.8 : 2.55, isCop ? '#e8e7dc' : color, 0, 1.75, isPickup ? 0.5 : 0);
    const glass = new THREE.MeshStandardMaterial({ color: '#254954', metalness: 0.6, roughness: 0.2 });
    addBox(group, 1.8, 0.65, 0.08, glass, 0, 1.78, 1.3);
    addBox(group, 1.8, 0.6, 0.08, glass, 0, 1.78, -1.3);
    for (const side of [-1, 1]) {
      addBox(group, 0.04, 0.6, 2.1, glass, side * 0.99, 1.78, 0);
      addBox(group, 0.05, 0.75, 0.1, color, side * 1.02, 1.75, 0);
      addBox(group, 0.15, 0.16, 0.5, '#c3c8b9', side * 1.25, 1.45, 0.85);
    }
    const wheels = [];
    for (const a of [-1.15, 1.15]) {
      for (const b of [-1.7, 1.7]) {
        const tire = addCylinder(group, 0.48, 0.48, 0.34, '#243139', a, 0.56, b, 12);
        tire.rotation.z = Math.PI / 2;
        wheels.push(tire);
        const hub = addCylinder(group, 0.24, 0.24, 0.36, '#a6b1b1', a, 0.56, b, 8);
        hub.rotation.z = Math.PI / 2;
      }
    }
    for (const a of [-0.78, 0.78]) {
      const headlight = new THREE.MeshStandardMaterial({
        color: '#ffedb4',
        emissive: '#eabd6d',
        emissiveIntensity: 0.5,
      });
      addBox(group, 0.55, 0.18, 0.08, headlight, a, 1, length / 2 + 0.02);
      addBox(group, 0.55, 0.18, 0.08, '#c84e42', a, 1, -length / 2 - 0.02);
    }
    addBox(group, 2, 0.18, 0.15, '#a7aca4', 0, 0.65, -length / 2);
    if (isPickup) addBox(group, 1.7, 0.12, 1.5, '#34474b', 0, 1.32, -1.55);
    let lights = [];
    if (isCop) {
      addBox(group, 1.6, 0.12, 0.42, '#1b2833', 0, 2.25, 0);
      lights = [
        addBox(group, 0.65, 0.2, 0.4, '#e65455', -0.43, 2.42, 0),
        addBox(group, 0.65, 0.2, 0.4, '#568ad7', 0.43, 2.42, 0),
      ];
    }
    group.position.set(x, 0, z);
    group.rotation.y = angle;
    game.scene.add(group);
    const car = {
      mesh: group,
      type,
      p: group.position,
      angle,
      speed: 0,
      hp: 100,
      wheels,
      lights,
      ai: false,
      police: isCop,
      stolen: false,
      collision: 0,
    };
    this.all.push(car);
    return car;
  }

  // Put Danny in a car. The first time he takes a car it counts as stolen
  // (a crime — worse for a police cruiser) and unlocks the vehicle type.
  enter(car, silent = false) {
    const game = this.game;
    if (game.player.car) return;
    game.player.car = car;
    game.player.mesh.visible = false;
    car.ai = false;
    game.input.aim = false;
    if (!silent && !car.stolen) {
      car.stolen = true;
      game.police.crime(car.police ? 2 : 1);
      game.hud.message('Vehicle acquired • ' + car.type.toUpperCase());
      if (!game.unlocked.includes(car.type)) game.unlocked.push(car.type);
    }
    game.player.p.copy(car.p);
  }

  // E: get out of the current car, or climb into the nearest one.
  interact() {
    const game = this.game;
    const player = game.player;
    if (player.car) {
      const car = player.car;
      if (Math.abs(car.speed) > 8) {
        game.hud.message('Slow down before getting out');
        return;
      }
      player.car = null;
      player.mesh.visible = true;
      player.p.copy(car.p).add(new THREE.Vector3(Math.cos(car.angle) * 2.8, 0, -Math.sin(car.angle) * 2.8));
      player.p.y = 0;
      game.weapons.scoped = false;
      return;
    }
    const nearest = this.all
      .filter((car) => !car.police || car.hp > 0)
      .sort((a, b) => groundDistance(a.p, player.p) - groundDistance(b.p, player.p))[0];
    if (nearest && groundDistance(nearest.p, player.p) < 5) this.enter(nearest);
    else game.hud.message('Get closer to a vehicle • E');
  }

  // Drive the player's car (throttle, steering, handbrake, collisions) and
  // spin every car's wheels; police light bars flash red and blue.
  update(dt) {
    const game = this.game;
    const car = game.player.car;
    if (car) {
      const input = game.input;
      const throttle = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
      car.speed += throttle * 21 * dt;
      car.speed *= Math.pow(input.down('Space') ? 0.08 : 0.965, dt * 10);
      car.speed = clamp(car.speed, -15, car.type === 'coupe' ? 52 : 43);
      const steer = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
      car.angle += steer * clamp(car.speed / 12, -1, 1) * dt * (input.down('Space') ? 2.2 : 1.1);
      const old = car.p.clone();
      car.p.x += Math.sin(car.angle) * car.speed * dt;
      car.p.z += Math.cos(car.angle) * car.speed * dt;
      if (game.city.resolve(car.p, old, 1.6)) {
        this.damage(car, Math.abs(car.speed) * 0.5);
        car.speed *= -0.28;
      }
      for (const other of this.all) {
        if (other === car || groundDistance(car.p, other.p) > 3.1) continue;
        if (car.collision <= 0 && Math.abs(car.speed) > 5) {
          this.damage(car, Math.abs(car.speed) * 0.25);
          other.hp -= 8;
          other.speed = car.speed * 0.4;
          car.speed *= -0.3;
          game.police.crime(1);
        }
      }
      car.collision -= dt;
      if (input.down('Space') && Math.abs(car.speed) > 9 && game.time % 0.12 < dt) {
        const skid = addBox(game.scene, 0.17, 0.015, 1.3, '#29353b', car.p.x, 0.16, car.p.z);
        skid.rotation.y = car.angle;
        game.particles.push({ mesh: skid, life: 8, velocity: new THREE.Vector3() });
      }
      game.player.p.copy(car.p);
      if (car.hp < 30 && game.time % 0.25 < dt) burst(game, car.p, '#657174', 2);
      if (car.hp <= 0) {
        car.speed = 0;
        game.player.hurt(dt * 15);
      }
      game.audio.engine(Math.abs(car.speed));
    } else {
      game.audio.engine(0);
    }
    for (const c of this.all) {
      c.mesh.rotation.y = c.angle;
      c.wheels.forEach((wheel) => (wheel.rotation.x += c.speed * dt * 2));
      if (c.police) {
        c.lights.forEach((light, i) =>
          light.material.color.set(Math.floor(game.time * 8 + i) % 2 ? '#428bff' : '#ff4c55')
        );
      }
    }
  }

  // Damage a car: sparks, a camera shake, a thud, and frightened
  // pedestrians nearby.
  damage(car, amount) {
    car.hp = Math.max(0, car.hp - amount);
    car.collision = 0.7;
    burst(this.game, car.p);
    this.game.shake = Math.min(0.7, amount * 0.03);
    this.game.audio.tone(75, 0.13, 'sawtooth', 0.15);
    this.game.pedestrians.scare(car.p, 25);
  }
}
