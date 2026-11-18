// Screenshot scenes: when the page loads with ?shot=<name>&seed=<n>, the
// game sets up a deterministic, good-looking scene for that shot with no
// input needed — camera, player state, cars, cops and traffic — then flags
// window.__shotReady once the scene is fully rendered. Four shots:
//   chase   — the cover: a police chase on Palm Avenue at three stars,
//             Danny on the motorcycle.
//   city    — a street race: the Palm Sprint start line, the clock running.
//   foot    — Danny on foot at the marina, Tempest LMG in hand.
//   mission — the Tempest LMG in action during The Vault Job.
// The cameras sit clear of palms and buildings so the frame stays open.
import * as THREE from 'three';
import { ROUTES } from './races.js';

export function setupShot(game) {
  const name = new URLSearchParams(location.search).get('shot');
  if (!name) return;
  game.resume();
  game.shotFrozen = true;
  game.player.cash = 12850;
  game.player.hp = 92;
  game.time = 5;
  game.missions.active = true;
  game.missions.index = 3;
  game.missions.timer = 68;
  game.missions.objective = 'HEAT WAVE • draw the patrols away from the crew';
  game.police.heat = 3;

  const placeCamera = (position, look) => {
    game.shotCamera = { p: new THREE.Vector3(...position), look: new THREE.Vector3(...look) };
  };

  if (name === 'chase') {
    const car = game.vehicles.spawn('motorcycle', 1, -41, Math.PI, '#e9a04f');
    game.vehicles.enter(car, true);
    car.speed = 30;
    game.police.spawn(-4, -23).angle = Math.PI;
    game.police.spawn(5, -10).angle = Math.PI;
    game.police.spawn(-3, 5).angle = Math.PI;
    game.vehicles.spawn('sedan', -5, -68, 0, '#63a29b');
    placeCamera([2, 6, -52], [-1, 1.5, -25]);
    game.hud.message('LENA / Keep them on Palm Avenue. We need one more minute.');
  } else if (name === 'city') {
    // A street race: the Palm Sprint start line, the clock already running.
    const car = game.vehicles.spawn('muscle', 0, 192, Math.PI, '#e9a04f');
    game.vehicles.enter(car, true);
    car.speed = 12;
    game.police.heat = 0;
    game.missions.active = false;
    game.races.active = true;
    game.races.route = ROUTES[0];
    game.races.gate = 1;
    game.races.elapsed = 8.4;
    game.races.savedObjective = 'Free roam • explore Solmere / J to start the story';
    game.missions.objective = game.races.raceObjective();
    game.races.moveMarker();
    game.vehicles.spawn('sedan', -4, 160, 0, '#a0c2b7');
    game.vehicles.spawn('SUV', 4, 140, Math.PI, '#e5d0ad');
    placeCamera([-5, 6, 178], [0, 1.5, 196]);
    game.hud.message('RACE START • Palm Sprint • beat 20s for +$1,500');
  } else if (name === 'foot') {
    game.player.p.set(218, 0, 48);
    game.player.yaw = -1.8;
    game.player.mesh.rotation.y = -1.8;
    game.police.heat = 0;
    game.missions.active = false;
    game.missions.objective = 'SOLMERE MARINA • find the contact at the north pier';
    game.missions.waypoint(195, 75, game.missions.objective);
    game.weapons.unlockById('lmg');
    game.weapons.index = 6;
    placeCamera([235, 6, 62], [200, 3, 32]);
    game.hud.message('The Tempest LMG hums. Solmere is not ready.');
  } else {
    // Mission: Danny clears the bank vault guards with the Tempest LMG.
    game.player.p.set(64, 0, -40);
    game.player.yaw = Math.PI;
    game.player.mesh.rotation.y = Math.PI;
    game.weapons.unlockById('lmg');
    game.weapons.index = 6;
    game.missions.index = 9;
    game.missions.timer = 0;
    game.missions.waypoint(64, -64, 'THE VAULT JOB • clear the vault guards');
    game.combat.spawn(60, -60);
    game.combat.spawn(68, -62, true);
    game.combat.spawn(64, -70);
    game.police.heat = 2;
    game.police.spawn(56, -45);
    placeCamera([64, 7, -38], [64, 2, -64]);
    game.hud.message('LENA / LMG ready. The vault is ours.');
  }

  // Settle one frame, then (for the mission shot) fire the LMG once so
  // the tracer and hit marker are in the frame.
  game.vehicles.update(0);
  game.weapons.update(0);
  game.player.camera(1, true);
  game.hud.update(0);
  game.renderer.render(game.scene, game.camera);
  if (name === 'mission') {
    game.weapons.cooldown = 0;
    game.weapons.fire();
    game.police.heat = 2;
    game.weapons.hitTime = 10;
  }
  requestAnimationFrame(() => {
    game.renderer.render(game.scene, game.camera);
    window.__shotReady = true;
  });
}
