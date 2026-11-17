// Danny Reyes on foot: WASD movement with sprint and jump, a mouse-driven
// third-person camera, and the health / damage state the HUD reads. When
// Danny is in a car, update() hands the driving to Vehicles and only keeps
// the camera following. The camera also handles the sniper scope: it snaps
// to first person, narrows the field of view and adds a breathing sway.
import * as THREE from 'three';
import { makePerson, animatePerson, clamp } from './utils.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.mesh = makePerson(game.scene, '#eee1bf');
    this.p = this.mesh.position;
    this.p.set(7, 0, 30);
    this.hp = 100;
    this.cash = 250;
    this.car = null;
    this.yaw = Math.PI;
    this.pitch = 0.15;
    this.vy = 0;
    this.damage = 0; // red vignette amount, decays over time
    this.invulnerable = 0;
  }

  // Take damage (unless briefly invulnerable after a respawn). At zero
  // health the run ends at the hospital.
  hurt(amount) {
    if (this.invulnerable > 0 || this.game.mode !== 'play') return;
    this.hp = Math.max(0, this.hp - amount);
    this.damage = 0.8;
    this.game.shake = 0.15;
    if (this.hp <= 0) {
      this.game.die('WASTED', 'Solmere Medical will patch you up. Hospital fee: $150.');
    }
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    this.damage = Math.max(0, this.damage - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.yaw -= input.dx * 0.002;
    this.pitch = clamp(this.pitch + input.dy * 0.0018, -0.65, 1.05);
    if (input.tap('KeyE')) game.vehicles.interact();
    if (this.car) return;

    const forward = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const strafe = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
    const magnitude = Math.hypot(forward, strafe) || 1;
    const speed = input.down('ShiftLeft') ? 10 : 5;
    const old = this.p.clone();
    this.p.x += ((Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) / magnitude) * speed * dt;
    this.p.z += ((Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) / magnitude) * speed * dt;
    game.city.resolve(this.p, old, 0.45);
    if (forward || strafe) {
      this.mesh.rotation.y = Math.atan2(this.p.x - old.x, this.p.z - old.z);
    }
    if (input.tap('Space') && this.p.y < 0.02) this.vy = 7;
    this.vy -= 19 * dt;
    this.p.y = Math.max(0, this.p.y + this.vy * dt);
    if (this.p.y === 0) this.vy = 0;
    animatePerson(this.mesh, game.time, !!(forward || strafe));
  }

  // Position the camera for this frame. A scripted shot camera (used by
  // the screenshot scenes) overrides everything. Otherwise the camera
  // trails behind Danny — further back and higher in a car — and swings
  // gently toward the car's heading while driving.
  camera(dt, instant = false) {
    const game = this.game;
    const camera = game.camera;
    if (game.shotCamera) {
      camera.position.copy(game.shotCamera.p);
      camera.lookAt(game.shotCamera.look);
      return;
    }
    const car = this.car;
    let yaw = this.yaw;
    if (car && !game.input.dx) {
      const delta = Math.atan2(Math.sin(car.angle - yaw), Math.cos(car.angle - yaw));
      this.yaw += delta * Math.min(1, dt * 2);
      yaw = this.yaw;
    }
    const scoped = game.weapons.scoped;
    const target = this.p.clone().add(new THREE.Vector3(0, car ? 1.5 : 1.8, 0));
    const back = car ? 10 : 5.5;
    const desired = target
      .clone()
      .add(new THREE.Vector3(-Math.sin(yaw) * back, car ? 4 : 2 + this.pitch * 4, -Math.cos(yaw) * back));
    if (scoped) {
      desired.copy(target);
      target.add(new THREE.Vector3(Math.sin(yaw) * 100, -Math.sin(this.pitch) * 100, Math.cos(yaw) * 100));
      this.mesh.visible = false;
    } else {
      this.mesh.visible = !car;
    }
    camera.position.lerp(desired, instant ? 1 : 1 - Math.exp(-dt * 8));
    if (!scoped) {
      target.add(new THREE.Vector3(Math.sin(yaw) * 3, -this.pitch * 2, Math.cos(yaw) * 3));
    }
    camera.lookAt(target);
    if (scoped) {
      // Breathing sway while scoped.
      camera.rotation.y += Math.sin(game.time * 1.7) * 0.0008;
      camera.rotation.x += Math.cos(game.time * 1.3) * 0.0006;
    }
    const fov = scoped ? 19 : car ? 66 : 60;
    camera.fov = THREE.MathUtils.lerp(camera.fov, fov, instant ? 1 : 1 - Math.exp(-dt * 12));
    camera.updateProjectionMatrix();
    if (game.shake > 0) {
      camera.position.x += Math.sin(game.time * 92) * game.shake;
      camera.position.y += Math.cos(game.time * 71) * game.shake;
    }
  }
}
