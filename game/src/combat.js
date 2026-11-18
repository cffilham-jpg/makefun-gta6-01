// Close combat and the people who fight back: mission enemies (regular and
// armored), the punch, damage resolution with kill rewards, and the crates
// scattered around the city — weapon, health and ammo pickups that respawn.
// damage() is the one place anything in the game loses health, so kills,
// cash rewards and heat all flow through it.
import * as THREE from 'three';
import { addBox, makePerson, groundDistance, animatePerson, burst } from './utils.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.enemies = [];
    this.pickups = [];
    this.punchTimer = 0;
    // The gold weapon crate by the safehouse holds the SV-9 Deadeye; the
    // steel-blue crate at the marina holds the Kestrel DMR; the black
    // crate on North Avenue holds the Tempest LMG.
    this.crate(-12, 30, 'weapon');
    this.crate(208, 60, 'dmr');
    this.crate(-128, -192, 'lmg');
    for (const [x, z] of [[-12, -35], [77, 12], [178, -53], [-75, 138]]) {
      this.crate(x, z, 'ammo');
      this.crate(x + 4, z, 'health');
    }
  }

  // Place a pickup crate: gold for a weapon, steel blue for the DMR,
  // black for the LMG, green for health, grey for ammo.
  crate(x, z, type) {
    const color =
      type === 'weapon'
        ? '#e0af54'
        : type === 'dmr'
          ? '#8fb8d8'
          : type === 'lmg'
            ? '#2f343c'
            : type === 'health'
              ? '#70b9a0'
              : '#a3b1b0';
    const mesh = addBox(this.game.scene, 1.2, 0.8, 1, color, x, 0.6, z);
    addBox(mesh, 1.24, 0.12, 1.04, '#e6dab0', 0, 0.3, 0);
    this.pickups.push({ mesh, p: mesh.position, type, used: false, respawn: 0 });
    return mesh;
  }

  // Spawn a mission enemy: 100 HP normally, 250 HP with armor plating.
  spawn(x, z, heavy = false) {
    const mesh = makePerson(this.game.scene, heavy ? '#504e64' : '#b84c49');
    mesh.position.set(x, 0, z);
    const enemy = {
      mesh,
      p: mesh.position,
      hp: heavy ? 250 : 100,
      maxHp: heavy ? 250 : 100,
      kind: heavy ? 'armored enemy' : 'enemy',
      attack: 1.5,
      dead: 0,
    };
    if (heavy) addBox(mesh, 0.76, 0.75, 0.5, '#39434c', 0, 1.25, 0);
    addBox(mesh, 0.12, 0.15, 0.7, '#27343c', 0.45, 1.4, 0.3);
    this.enemies.push(enemy);
    return enemy;
  }

  // Everything a bullet can hit: enemies, cops and pedestrians.
  targets() {
    return [...this.enemies, ...this.game.police.cops, ...this.game.pedestrians.all];
  }

  // Deal damage to a target. Returns true when it kills. A kill drops an
  // ammo crate, pays $25 (except pedestrians, who cost heat instead), and
  // killing a cop adds two stars.
  damage(target, amount, head = false) {
    if (target.hp <= 0) return false;
    target.hp = Math.max(0, target.hp - amount);
    if (target.hp === 0) {
      target.mesh.rotation.z = Math.PI / 2;
      target.dead = 0;
      this.crate(target.p.x, target.p.z, 'ammo');
      if (target.kind !== 'pedestrian') this.game.player.cash += 25;
      else this.game.police.crime(1);
      if (target.kind === 'police') this.game.police.crime(2);
      return true;
    }
    if (target.kind === 'pedestrian') target.fear = 12;
    return false;
  }

  // A quick punch at whatever is in front of Danny.
  punch() {
    if (this.punchTimer > 0) return;
    this.punchTimer = 0.45;
    const game = this.game;
    game.audio.tone(100, 0.08, 'triangle', 0.3);
    game.player.mesh.userData.arms[1].rotation.x = -1.5;
    for (const target of this.targets()) {
      if (target.hp > 0 && groundDistance(target.p, game.player.p) < 2.8) {
        this.damage(target, 40);
        game.police.crime(0.7);
        burst(game, target.p, '#f1bb87', 5);
        break;
      }
    }
  }

  update(dt) {
    const game = this.game;
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    if (!this.punchTimer) game.player.mesh.userData.arms[1].rotation.x = 0;
    // Enemies close in and shoot when in range.
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      const d = groundDistance(enemy.p, game.player.p);
      if (d < 60) {
        enemy.mesh.lookAt(game.player.p.x, 0, game.player.p.z);
        if (d > 10) {
          const old = enemy.p.clone();
          enemy.p.addScaledVector(
            new THREE.Vector3(game.player.p.x - enemy.p.x, 0, game.player.p.z - enemy.p.z).normalize(),
            dt * 2
          );
          game.city.resolve(enemy.p, old, 0.5);
          animatePerson(enemy.mesh, game.time, true);
        }
        enemy.attack -= dt;
        if (enemy.attack <= 0 && d < 45) {
          enemy.attack = 1.8;
          game.player.hurt(7);
          game.audio.tone(130, 0.07, 'sawtooth', 0.15);
        }
      }
    }
    // Crates spin gently; walking into one collects it (they respawn).
    for (const pickup of this.pickups) {
      if (pickup.used) {
        pickup.respawn -= dt;
        if (pickup.respawn <= 0) {
          pickup.used = false;
          pickup.mesh.visible = true;
        }
        continue;
      }
      pickup.mesh.rotation.y += dt * 0.4;
      if (groundDistance(pickup.p, game.player.p) < 2.8) {
        if (pickup.type === 'weapon') {
          game.weapons.unlock();
          game.weapons.switch(3);
        } else if (pickup.type === 'dmr') {
          game.weapons.unlockById('dmr');
          game.weapons.switch(5);
        } else if (pickup.type === 'lmg') {
          game.weapons.unlockById('lmg');
          game.weapons.switch(6);
        } else if (pickup.type === 'health') {
          game.player.hp = Math.min(100, game.player.hp + 40);
          game.hud.message('Health +40');
        } else {
          for (const weapon of game.weapons.list) weapon.reserve += weapon.mag * 2;
          game.hud.message('Ammunition collected');
        }
        pickup.used = true;
        pickup.respawn = 45;
        pickup.mesh.visible = false;
        game.audio.tone(880, 0.18, 'sine', 0.4);
      }
    }
  }
}
