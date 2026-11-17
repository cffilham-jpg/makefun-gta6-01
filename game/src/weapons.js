// The arsenal: four weapons with distinct feels, plus the aiming, firing
// and feedback around them. The flagship is the SV-9 Deadeye sniper —
// hold the right mouse button to look down its scope (the field of view
// narrows and a reticle overlay appears), one shot drops a regular enemy,
// and headshots pay a bonus. Every shot is a raycast from the camera with
// per-weapon spread; buildings stop bullets, tracers show the path, and a
// hit marker confirms each hit.
import * as THREE from 'three';
import { addBox, addCylinder, burst, clamp } from './utils.js';

export const DEFINITIONS = [
  { id: 'pistol', name: 'Marlow P12', icon: '▰━', damage: 34, rate: 0.27, mag: 12, reserve: 180, reload: 1.05, range: 100, spread: 0.004, pellets: 1, unlocked: true },
  { id: 'smg', name: 'Vela M8 SMG', icon: '▰╦━', damage: 16, rate: 0.075, mag: 30, reserve: 240, reload: 1.65, range: 65, spread: 0.026, pellets: 1, unlocked: true },
  { id: 'shotgun', name: 'Breaker S6', icon: '▰━━━━', damage: 24, rate: 0.9, mag: 6, reserve: 48, reload: 2.1, range: 28, spread: 0.075, pellets: 9, unlocked: true },
  { id: 'sniper', name: 'SV-9 DEADEYE', icon: '━▰━╋━━', damage: 150, rate: 1.25, mag: 5, reserve: 25, reload: 2.7, range: 600, spread: 0, pellets: 1, unlocked: false },
];

export class Weapons {
  constructor(game) {
    this.game = game;
    this.list = DEFINITIONS.map((weapon) => ({ ...weapon, ammo: weapon.mag }));
    this.index = 0;
    this.cooldown = 0;
    this.reloadLeft = 0;
    this.scoped = false;
    this.hitTime = 0;
    this.hitKind = '';
    this.feedback = '';
    this.lastHits = [];
    this.shotsFired = 0;
    // The visible gun model that rides beside Danny (rifle + scope).
    this.model = new THREE.Group();
    this.rifle = addBox(this.model, 0.13, 0.15, 1.3, '#263a41', 0, 0, 0.45);
    addBox(this.model, 0.18, 0.24, 0.42, '#af8053', 0, -0.05, -0.3);
    this.scope = addCylinder(this.model, 0.07, 0.07, 0.45, '#142c36', 0, 0.2, 0.25);
    this.scope.rotation.x = Math.PI / 2;
    addBox(this.model, 0.08, 0.1, 0.8, '#1a272d', 0, 0.02, 1.2);
    game.scene.add(this.model);
  }

  get current() {
    return this.list[this.index];
  }

  // Equip a weapon by index (wraps around). The sniper stays locked until
  // it is earned.
  switch(index) {
    if (index < 0) index = 3;
    if (index > 3) index = 0;
    if (!this.list[index].unlocked) {
      this.game.hud.message('SV-9 locked • collect the crate at Reyes Auto or complete The Pickup');
      return;
    }
    this.index = index;
    this.reloadLeft = 0;
    this.cooldown = 0.15;
    this.game.audio.tone(400, 0.05, 'triangle', 0.13);
  }

  // Earn the SV-9 Deadeye (mission 2 reward, or the gold crate).
  unlock() {
    this.list[3].unlocked = true;
    this.game.hud.message('SV-9 DEADEYE acquired • 4 equip / hold right mouse to scope');
  }

  // Start a reload (fills the magazine from the reserve when it finishes).
  reload() {
    const weapon = this.current;
    if (this.reloadLeft || weapon.ammo === weapon.mag || weapon.reserve <= 0) return;
    this.reloadLeft = weapon.reload;
    this.game.audio.tone(210, 0.15, 'square', 0.12);
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    const weapon = this.current;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hitTime = Math.max(0, this.hitTime - dt);
    for (let n = 0; n < 4; n++) {
      if (input.tap('Digit' + (n + 1))) this.switch(n);
    }
    if (input.wheel) {
      let next = this.index;
      do {
        next = (next + input.wheel + 4) % 4;
      } while (!this.list[next].unlocked);
      this.switch(next);
    }
    // Scoped only on foot, aiming, sniper equipped, not reloading.
    this.scoped =
      !game.player.car && input.aim && this.current.id === 'sniper' && !this.reloadLeft;
    if (input.tap('KeyR')) this.reload();
    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        const taken = Math.min(this.current.mag - this.current.ammo, this.current.reserve);
        this.current.ammo += taken;
        this.current.reserve -= taken;
        game.audio.tone(520, 0.07, 'triangle', 0.2);
      }
    }
    if (!game.player.car) {
      if (input.tap('KeyQ')) game.combat.punch();
      if (input.mouse && this.cooldown <= 0 && !this.reloadLeft) this.fire();
      if (input.tap('KeyF')) game.combat.punch();
    }
    // An empty magazine reloads on its own; an empty weapon falls back to
    // the pistol (which never truly runs dry).
    if (!this.current.ammo && !this.reloadLeft) {
      if (this.current.reserve > 0) this.reload();
      else {
        this.game.hud.message('Out of ammunition • switching to pistol');
        this.switch(0);
      }
    }
    this.list[0].reserve = Math.max(120, this.list[0].reserve);
    // Keep the gun model beside Danny (hidden in a car or while scoped).
    const player = game.player;
    this.model.visible = !player.car && !this.scoped;
    const yaw = player.yaw;
    this.model.position.set(
      player.p.x + Math.cos(yaw) * 0.48,
      player.p.y + 1.35,
      player.p.z - Math.sin(yaw) * 0.48
    );
    this.model.rotation.y = yaw;
    this.model.rotation.x = this.current.id === 'sniper' ? -0.05 : -0.2;
    this.model.scale.setScalar(this.current.id === 'pistol' ? 0.45 : 1);
    this.scope.visible = this.current.id === 'sniper';
    document.getElementById('scope').classList.toggle('active', this.scoped);
  }

  // Fire the current weapon: one ray per pellet, spread around the camera
  // direction, blocked by buildings. Hits damage the target (headshots
  // double it), show a hit marker and a tracer, and scare pedestrians.
  fire() {
    const game = this.game;
    const weapon = this.current;
    if (!weapon.ammo || this.cooldown > 0 || this.reloadLeft) return false;
    weapon.ammo--;
    this.cooldown = weapon.rate;
    this.shotsFired++;
    game.audio.shot(weapon.id);
    game.police.crime(weapon.id === 'sniper' ? 1.3 : 0.35);
    game.pedestrians.scare(game.player.p, 70);
    game.shake = weapon.id === 'sniper' ? 0.23 : weapon.id === 'shotgun' ? 0.3 : 0.07;
    this.lastHits = [];

    const origin = game.camera.position.clone();
    const base = new THREE.Vector3();
    game.camera.getWorldDirection(base);
    const right = new THREE.Vector3().crossVectors(base, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, base).normalize();
    let kills = 0;

    for (let n = 0; n < weapon.pellets; n++) {
      const spreadX = (game.rng() - 0.5) * weapon.spread;
      const spreadY = (game.rng() - 0.5) * weapon.spread;
      const dir = base
        .clone()
        .addScaledVector(right, spreadX)
        .addScaledVector(up, spreadY)
        .normalize();
      const ray = new THREE.Raycaster(origin, dir, 0, weapon.range);
      const targets = game.combat.targets().filter((target) => target.hp > 0);
      const roots = targets.map((target) => target.mesh);
      game.scene.updateMatrixWorld(true);
      const hits = ray.intersectObjects(roots, true);
      const hit = hits[0];
      let end = origin.clone().addScaledVector(dir, weapon.range);
      let wallDistance = weapon.range;
      // Buildings stop bullets: find the nearest wall along the ray.
      for (const solid of game.city.solids) {
        const point = ray.ray.intersectBox(
          new THREE.Box3(
            new THREE.Vector3(solid.x - solid.w, 0, solid.z - solid.d),
            new THREE.Vector3(solid.x + solid.w, solid.h, solid.z + solid.d)
          ),
          new THREE.Vector3()
        );
        if (point) wallDistance = Math.min(wallDistance, origin.distanceTo(point));
      }
      if (hit && hit.distance < wallDistance) {
        let root = hit.object;
        while (root.parent && !roots.includes(root)) root = root.parent;
        const target = targets.find((t) => t.mesh === root);
        if (target) {
          const head = hit.point.y - target.p.y > 1.7;
          const damage = weapon.damage * (head ? 2 : 1);
          const kill = game.combat.damage(target, damage, head);
          if (kill) kills++;
          this.lastHits.push({ target: target.kind, damage, head, kill, spread: [spreadX, spreadY] });
          end.copy(hit.point);
          this.hitTime = 0.65;
          this.hitKind = kill ? 'kill' : 'hit';
          this.feedback = kill ? (head ? 'HEADSHOT +$75' : 'CONFIRMED +$25') : '−' + damage + ' HP';
          game.audio.tone(kill ? 1100 : 700, kill ? 0.16 : 0.055, 'triangle', 0.45);
          if (head && kill) game.player.cash += 50;
          burst(game, hit.point, kill ? '#ffd575' : '#ed9679', 5);
        }
      }
      if (wallDistance < origin.distanceTo(end)) {
        end = origin.clone().addScaledVector(dir, wallDistance);
      }
      // Tracer from the muzzle to the bullet's end.
      const muzzle = game.player.p
        .clone()
        .add(new THREE.Vector3(Math.sin(game.player.yaw) * 1.5, 1.4, Math.cos(game.player.yaw) * 1.5));
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([muzzle, end]),
        new THREE.LineBasicMaterial({
          color: weapon.id === 'sniper' ? '#ffe5a1' : '#ffc85a',
          transparent: true,
          opacity: 0.9,
        })
      );
      game.scene.add(line);
      game.particles.push({ mesh: line, life: 0.12, velocity: new THREE.Vector3() });
    }
    // Muzzle flash.
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(weapon.id === 'sniper' ? 0.22 : 0.15, 6, 6),
      new THREE.MeshBasicMaterial({ color: '#fff2a8' })
    );
    flash.position
      .copy(game.player.p)
      .add(new THREE.Vector3(Math.sin(game.player.yaw) * 1.7, 1.4, Math.cos(game.player.yaw) * 1.7));
    game.scene.add(flash);
    game.particles.push({ mesh: flash, life: 0.075, velocity: new THREE.Vector3() });
    return true;
  }
}
