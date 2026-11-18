// Screenshot scenes: when the page loads with ?shot=<name>&seed=<n>, the
// game sets up a deterministic, good-looking scene for that shot with no
// input needed — camera, player state, cars, cops and traffic — then flags
// window.__shotReady once the scene is fully rendered. Four shots:
//   chase   — the cover: a police chase on Palm Avenue at three stars.
//   city    — driving downtown in the muscle car, heat off.
//   foot    — Danny on foot at the marina, waypoint set.
//   mission — the Kestrel DMR in action during Harbor Lights.
// The cameras sit clear of palms and buildings so the frame stays open.
import * as THREE from 'three';

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
    const car = game.vehicles.spawn('coupe', 1, -41, Math.PI, '#e9a04f');
    game.vehicles.enter(car, true);
    car.speed = 30;
    game.police.spawn(-4, -23).angle = Math.PI;
    game.police.spawn(5, -10).angle = Math.PI;
    game.police.spawn(-3, 5).angle = Math.PI;
    game.vehicles.spawn('sedan', -5, -68, 0, '#63a29b');
    placeCamera([2, 8, -58], [-1, 1.7, -25]);
    game.hud.message('LENA / Keep them on Palm Avenue. We need one more minute.');
  } else if (name === 'city') {
    const car = game.vehicles.spawn('muscle', 4, -53, Math.PI, '#e9a04f');
    game.vehicles.enter(car, true);
    car.speed = 19;
    game.police.heat = 0;
    game.missions.active = false;
    game.missions.objective = 'Explore downtown • the coast is yours';
    game.vehicles.spawn('sedan', -4, -82, 0, '#a0c2b7');
    game.vehicles.spawn('SUV', 4, -103, Math.PI, '#e5d0ad');
    placeCamera([1, 6, -37], [0, 4, -100]);
  } else if (name === 'foot') {
    game.player.p.set(218, 0, 48);
    game.player.yaw = -1.8;
    game.player.mesh.rotation.y = -1.8;
    game.police.heat = 0;
    game.missions.active = false;
    game.missions.objective = 'SOLMERE MARINA • find the contact at the north pier';
    game.missions.waypoint(195, 75, game.missions.objective);
    placeCamera([235, 6, 62], [200, 3, 32]);
    game.hud.message('The sea brings everything back. Even Danny Reyes.');
  } else {
    // Mission: Danny clears the lighthouse guards with the Kestrel DMR.
    game.player.p.set(230, 0, -165);
    game.player.yaw = Math.PI;
    game.player.mesh.rotation.y = Math.PI;
    game.weapons.unlockById('dmr');
    game.weapons.index = 5;
    game.missions.index = 5;
    game.missions.timer = 0;
    game.missions.waypoint(228, -190, 'HARBOR LIGHTS • clear the guards at Lighthouse Point');
    game.combat.spawn(228, -185);
    game.combat.spawn(224, -195, true);
    game.police.heat = 2;
    game.police.spawn(220, -150);
    placeCamera([232, 6, -150], [230, 2, -195]);
    game.hud.message('LENA / DMR ready. Watch the armored guard.');
  }

  // Settle one frame, then (for the mission shot) fire the DMR once so
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
