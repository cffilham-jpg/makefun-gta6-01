// The people of Solmere: sixty-six pedestrians strolling the sidewalks.
// They walk their block, turn at the map edge, and run when frightened by
// gunfire or a crash. Run one down with a car and the police take notice.
// A fallen pedestrian gets back up after a while — the city goes on.
import { makePerson, animatePerson, groundDistance } from './utils.js';

export class Pedestrians {
  constructor(game) {
    this.game = game;
    this.all = [];
    const shirts = ['#d07766', '#ccbd8c', '#5e9e9a', '#e2b05e', '#74849f'];
    for (let i = 0; i < 66; i++) {
      const x = game.city.roads[i % 7] + (i % 2 ? 13 : -13);
      const z = -205 + ((i * 37) % 410);
      const mesh = makePerson(game.scene, shirts[i % 5]);
      mesh.position.set(x, 0, z);
      this.all.push({
        mesh,
        p: mesh.position,
        hp: 100,
        fear: 0,
        dir: i % 2 ? 1 : -1,
        dead: 0,
        kind: 'pedestrian',
      });
    }
  }

  // Frighten everyone within radius of a point (gunfire, crashes).
  scare(point, radius = 40) {
    for (const person of this.all) {
      if (groundDistance(person.p, point) < radius) person.fear = 7;
    }
  }

  update(dt) {
    const game = this.game;
    for (const person of this.all) {
      // The fallen stay down for a while, then get back up.
      if (person.hp <= 0) {
        person.mesh.rotation.z = Math.PI / 2;
        person.dead += dt;
        if (person.dead > 25) {
          person.hp = 100;
          person.dead = 0;
          person.mesh.rotation.z = 0;
        }
        continue;
      }
      person.fear = Math.max(0, person.fear - dt);
      const speed = person.fear ? 4.8 : 1.1;
      person.p.z += person.dir * speed * dt;
      if (Math.abs(person.p.z) > 213) person.dir *= -1;
      person.mesh.rotation.y = person.dir > 0 ? 0 : Math.PI;
      animatePerson(person.mesh, game.time, true);
      // A speeding car that clips a pedestrian kills them — and earns heat.
      if (
        game.player.car &&
        Math.abs(game.player.car.speed) > 8 &&
        groundDistance(person.p, game.player.p) < 2
      ) {
        game.combat.damage(person, 100, false);
        game.police.crime(1);
        game.vehicles.damage(game.player.car, 4);
      }
    }
  }
}
