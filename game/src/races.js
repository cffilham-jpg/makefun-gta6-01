// Street races: the second side activity. Three time-trial routes across
// Solmere — drive into a checkered start ring in a car and the clock
// starts; hit every checkpoint in order to finish. Beat the target time
// for a cash prize, and the best time per route is kept in the save game.
// The HUD shows the live timer in the objective line, and the minimap
// marks the next checkpoint in cyan. A race stalls out (and is abandoned)
// after 90 seconds without a checkpoint, and starting a story chapter
// cancels it.
import * as THREE from 'three';
import { groundDistance, burst, addBox, addSign } from './utils.js';

export const ROUTES = [
  {
    id: 'palm',
    name: 'Palm Sprint',
    start: [0, 192],
    checkpoints: [
      [0, 128],
      [0, 64],
      [0, 0],
      [0, -64],
      [0, -128],
      [0, -192],
    ],
    target: 20,
    prize: 1500,
  },
  {
    id: 'harbor',
    name: 'Harbor Circuit',
    start: [192, 192],
    checkpoints: [
      [192, 64],
      [192, -64],
      [128, -64],
      [128, -192],
      [192, -192],
    ],
    target: 30,
    prize: 2000,
  },
  {
    id: 'downtown',
    name: 'Downtown Gauntlet',
    start: [-192, 192],
    checkpoints: [
      [-64, 192],
      [-64, 64],
      [64, 64],
      [64, -128],
      [192, -128],
      [192, -192],
    ],
    target: 45,
    prize: 3000,
  },
];

export class Races {
  constructor(game) {
    this.game = game;
    this.routes = ROUTES;
    this.best = {}; // route id -> best seconds
    this.active = false;
    this.route = null;
    this.gate = 0;
    this.elapsed = 0;
    this.stall = 0;
    this.savedObjective = '';
    this.marker = new THREE.Group();
    game.scene.add(this.marker);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: '#7fe8e0',
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 22, 24, 1, true), beamMaterial);
    beam.position.y = 11;
    this.marker.add(beam);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.12, 8, 40),
      new THREE.MeshBasicMaterial({ color: '#7fe8e0' })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    this.marker.add(ring);
    this.marker.visible = false;
    // A checkered start line, a cyan beam and a sign at every route start.
    for (const route of ROUTES) {
      const [x, z] = route.start;
      for (let i = 0; i < 8; i++) {
        addBox(
          game.scene,
          1.4,
          0.1,
          1.4,
          i % 2 ? '#f2ead8' : '#1c2428',
          x - 4.9 + i * 1.4,
          0.12,
          z
        );
      }
      const startBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 16, 16, 1, true),
        beamMaterial
      );
      startBeam.position.set(x, 8, z);
      game.scene.add(startBeam);
      // The sign reads from both sides: a second plane, back to back,
      // so drivers approaching from either direction see it right.
      const sign = addSign(game.scene, 'STREET RACE', x, 5.5, z + 6, 12, '#bdf5ef');
      const back = sign.clone();
      back.rotation.y = Math.PI;
      back.position.z -= 0.06;
      game.scene.add(back);
    }
  }

  // The next checkpoint (or null when no race is running).
  get nextGate() {
    if (!this.active || !this.route) return null;
    return this.route.checkpoints[this.gate] || null;
  }

  // The running time as m:ss.t for the HUD timer.
  timeText() {
    const total = this.elapsed;
    const minutes = Math.floor(total / 60);
    const seconds = total - minutes * 60;
    return minutes + ':' + seconds.toFixed(1).padStart(4, '0');
  }

  // The objective line while a race runs.
  raceObjective() {
    const route = this.route;
    const best = this.best[route.id];
    return (
      'RACE: ' +
      route.name.toUpperCase() +
      ' • checkpoint ' +
      (this.gate + 1) +
      '/' +
      route.checkpoints.length +
      ' • target ' +
      route.target +
      's' +
      (best ? ' • best ' + best.toFixed(1) + 's' : '')
    );
  }

  // Start a route: the clock runs from the start ring.
  start(route) {
    this.active = true;
    this.route = route;
    this.gate = 0;
    this.elapsed = 0;
    this.stall = 0;
    this.savedObjective = this.game.missions.objective;
    this.game.missions.objective = this.raceObjective();
    this.moveMarker();
    this.game.hud.message(
      'RACE START • ' + route.name + ' • beat ' + route.target + 's for +$' + route.prize.toLocaleString()
    );
    this.game.audio.tone(880, 0.2, 'square', 0.3);
  }

  // Point the cyan checkpoint marker at the next gate.
  moveMarker() {
    const next = this.nextGate;
    if (!next) {
      this.marker.visible = false;
      return;
    }
    this.marker.position.set(next[0], 0, next[1]);
    this.marker.visible = true;
  }

  // Finish the race: pay the prize when the target is beaten, record a
  // new best time, and restore the objective line.
  finish() {
    const route = this.route;
    const time = this.elapsed;
    const won = time <= route.target;
    const isBest = this.best[route.id] === undefined || time < this.best[route.id];
    if (isBest) this.best[route.id] = time;
    if (won) this.game.player.cash += route.prize;
    this.game.hud.message(
      route.name +
        ' finished ' +
        time.toFixed(1) +
        's' +
        (won ? ' • +$' + route.prize.toLocaleString() : ' • target ' + route.target + 's — no prize') +
        (isBest ? ' • NEW BEST' : '')
    );
    burst(this.game, this.game.player.p, '#7fe8e0', 12);
    this.game.audio.tone(1320, 0.3, 'sine', 0.4);
    this.active = false;
    this.route = null;
    this.marker.visible = false;
    this.game.missions.objective = this.savedObjective || 'Free roam • explore Solmere / J to start the story';
    this.game.persist();
  }

  // Abandon the race (stalled out, or a story chapter took over).
  cancel(reason) {
    if (!this.active) return;
    this.active = false;
    this.route = null;
    this.marker.visible = false;
    this.game.missions.objective = this.savedObjective || 'Free roam • explore Solmere / J to start the story';
    this.game.hud.message(reason);
  }

  // A fresh run or a respawn ends any race in progress (best times stay).
  reset() {
    if (this.active) {
      this.game.missions.objective =
        this.savedObjective || 'Free roam • explore Solmere / J to start the story';
    }
    this.active = false;
    this.route = null;
    this.gate = 0;
    this.elapsed = 0;
    this.stall = 0;
    this.marker.visible = false;
  }

  update(dt) {
    const game = this.game;
    if (game.mode !== 'play') return;
    if (!this.active) {
      // Drive into a start ring, in a car, between story chapters.
      if (!game.player.car || game.missions.active) return;
      for (const route of ROUTES) {
        if (groundDistance(game.player.p, { x: route.start[0], z: route.start[1] }) < 10) {
          this.start(route);
          return;
        }
      }
      return;
    }
    this.elapsed += dt;
    this.stall += dt;
    game.missions.objective = this.raceObjective();
    const next = this.nextGate;
    if (next && game.player.car && groundDistance(game.player.p, { x: next[0], z: next[1] }) < 12) {
      this.gate++;
      this.stall = 0;
      burst(game, new THREE.Vector3(next[0], 1, next[1]), '#7fe8e0', 8);
      game.audio.tone(990, 0.12, 'triangle', 0.35);
      if (this.gate >= this.route.checkpoints.length) {
        this.finish();
        return;
      }
      game.hud.message('Checkpoint ' + this.gate + '/' + this.route.checkpoints.length);
      this.moveMarker();
    } else if (this.stall > 90) {
      this.cancel('Race abandoned • too long between checkpoints');
    }
  }
}
