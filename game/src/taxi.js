// Taxi fares: the third side activity. A passenger waits at one of four
// stands around Solmere — drive up in a car and press T to pick them up,
// then deliver them to their destination before the meter runs out. The
// fare pays for the distance, a taxi cab pays half again, and every
// completed fare in a row grows the streak bonus. Step out of the car or
// run out of time and the fare is lost (and the streak with it). Two
// yellow cabs are parked at the stands, ready to work.
import * as THREE from 'three';
import { groundDistance, makePerson, burst } from './utils.js';

export const STANDS = [
  { name: 'Cielo Hotel', x: -64, z: 192 },
  { name: 'Marina', x: 192, z: 64 },
  { name: 'North Avenue', x: 0, z: -192 },
  { name: 'West End', x: -192, z: -64 },
];

export class Taxi {
  constructor(game) {
    this.game = game;
    this.waiting = null; // the stand a passenger waits at, or null
    this.destination = null; // the stand the passenger wants
    this.onboard = false;
    this.timer = 0;
    this.streak = 0;
    this.cooldown = 0;
    this.savedObjective = '';
    // The waiting passenger: a person in a bright shirt under a cyan beam.
    this.passenger = makePerson(game.scene, '#e8c33c');
    this.passenger.visible = false;
    this.waitBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 16, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#7fe8e0',
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.waitBeam.position.y = 8;
    this.waitBeam.visible = false;
    game.scene.add(this.waitBeam);
    // The destination marker: a magenta beam, ring and bobbing arrow.
    this.marker = new THREE.Group();
    game.scene.add(this.marker);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 22, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#e07fc8',
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = 11;
    this.marker.add(beam);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.12, 8, 40),
      new THREE.MeshBasicMaterial({ color: '#e07fc8' })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    this.marker.add(ring);
    this.marker.visible = false;
    // Two yellow cabs parked at the stands, ready to work.
    game.vehicles.spawn('taxi', -60, 186, Math.PI, '#e8c33c');
    game.vehicles.spawn('taxi', 188, 58, 0, '#e8c33c');
    this.spawnPassenger();
  }

  // The fare for a trip, before the taxi-cab and streak multipliers.
  fareFor(from, to) {
    return Math.round(120 + groundDistance(from, to) * 2);
  }

  // The current fare with every multiplier applied.
  currentFare() {
    if (!this.onboard || !this.destination) return 0;
    const cab = this.game.player.car?.type === 'taxi' ? 1.5 : 1;
    return Math.round(this.fareFor(this.waiting, this.destination) * cab * (1 + 0.25 * this.streak));
  }

  // The HUD prompt when Danny can pick up the waiting passenger.
  prompt() {
    if (!this.waiting || this.onboard) return '';
    const game = this.game;
    if (!game.player.car || game.missions.active || game.races.active) return '';
    if (groundDistance(game.player.p, this.waiting) > 12) return '';
    return 'T — Pick up passenger • ' + this.waiting.name;
  }

  // Put a passenger at a random stand.
  spawnPassenger() {
    const game = this.game;
    const stand = STANDS[Math.floor(game.rng() * STANDS.length)];
    this.waiting = stand;
    this.passenger.position.set(stand.x, 0, stand.z);
    this.passenger.visible = true;
    this.waitBeam.position.set(stand.x, 8, stand.z);
    this.waitBeam.visible = true;
  }

  // Pick up the waiting passenger: choose a destination, start the meter.
  pickup() {
    const game = this.game;
    if (!this.waiting || this.onboard) return false;
    const options = STANDS.filter((stand) => stand !== this.waiting);
    this.destination = options[Math.floor(game.rng() * options.length)];
    const distance = groundDistance(this.waiting, this.destination);
    this.timer = 45 + distance / 10;
    this.onboard = true;
    this.passenger.visible = false;
    this.waitBeam.visible = false;
    this.marker.position.set(this.destination.x, 0, this.destination.z);
    this.marker.visible = true;
    this.savedObjective = game.missions.objective;
    game.missions.objective =
      'TAXI • ' + this.destination.name.toUpperCase() + ' • ' + Math.ceil(this.timer) + 's';
    game.hud.message(
      'Passenger aboard • ' + this.destination.name + ' • fare ~$' + this.currentFare().toLocaleString()
    );
    game.audio.tone(760, 0.15, 'triangle', 0.3);
    return true;
  }

  // Drop the passenger off: pay the fare, grow the streak, send the next.
  complete() {
    const game = this.game;
    const fare = this.currentFare();
    game.player.cash += fare;
    this.streak++;
    burst(game, game.player.p, '#e07fc8', 10);
    game.audio.tone(1180, 0.25, 'sine', 0.4);
    game.hud.message(
      'Fare complete • +$' + fare.toLocaleString() + ' • streak ' + this.streak + ' (next fare +25%)'
    );
    this.onboard = false;
    this.destination = null;
    this.marker.visible = false;
    game.missions.objective =
      this.savedObjective || 'Free roam • explore Solmere / J to start the story';
    this.cooldown = 5;
    this.waiting = null;
    game.persist();
  }

  // Abandon the fare (left the car, ran out of time, or a bigger job
  // took over). The streak resets.
  cancel(reason) {
    if (!this.onboard && !this.waiting) return;
    const game = this.game;
    this.onboard = false;
    this.destination = null;
    this.streak = 0;
    this.marker.visible = false;
    this.passenger.visible = false;
    this.waitBeam.visible = false;
    this.waiting = null;
    if (this.savedObjective) {
      game.missions.objective = this.savedObjective;
      this.savedObjective = '';
    }
    this.cooldown = 5;
    game.hud.message(reason);
  }

  // A fresh run or a respawn ends any fare (the streak goes with it).
  reset() {
    this.onboard = false;
    this.destination = null;
    this.streak = 0;
    this.timer = 0;
    this.cooldown = 3;
    this.waiting = null;
    this.marker.visible = false;
    this.passenger.visible = false;
    this.waitBeam.visible = false;
    this.savedObjective = '';
  }

  update(dt) {
    const game = this.game;
    if (game.mode !== 'play') return;
    // The cooldown counts down between fares; once it has elapsed (or
    // was cleared) a new passenger arrives at a stand.
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (this.cooldown > 0) return;
    }
    if (!this.waiting && !this.onboard) {
      this.spawnPassenger();
      return;
    }
    if (!this.onboard) {
      // T picks up the waiting passenger, in a car, between other jobs.
      if (
        this.waiting &&
        game.player.car &&
        !game.missions.active &&
        !game.races.active &&
        groundDistance(game.player.p, this.waiting) < 12 &&
        game.input.tap('KeyT')
      ) {
        this.pickup();
      }
      return;
    }
    // On a fare: the meter runs, and leaving the car loses it.
    this.timer -= dt;
    game.missions.objective =
      'TAXI • ' + this.destination.name.toUpperCase() + ' • ' + Math.max(0, Math.ceil(this.timer)) + 's';
    if (!game.player.car) {
      this.cancel('Fare lost • the passenger walked away');
      return;
    }
    if (this.timer <= 0) {
      this.cancel('Fare lost • the meter ran out');
      return;
    }
    if (groundDistance(game.player.p, this.destination) < 12) this.complete();
  }
}
