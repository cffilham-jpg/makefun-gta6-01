// Shared helpers for Solmere Heat: small math, a seeded RNG, cached materials
// and the tiny mesh builders every other module uses to assemble the city,
// its people and its cars. Nothing here knows about the game state except
// burst(), which drops particles into the running game.
import * as THREE from 'three';

// Clamp a value into [low, high].
export function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

// Distance on the ground plane (ignores height).
export function groundDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// A small deterministic generator (LCG) so a seed replays the same city.
export function makeRng(seed = 1) {
  let state = seed >>> 0;
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// One shared standard material per colour, so the city does not mint
// thousands of identical materials.
const materialCache = new Map();
export function sharedMaterial(color) {
  if (!materialCache.has(color)) {
    materialCache.set(
      color,
      new THREE.MeshStandardMaterial({ color, roughness: 0.72 })
    );
  }
  return materialCache.get(color);
}

// Add a shadow-casting box to a parent group. `finish` is either a colour
// (a cached standard material is used) or a material of its own.
export function addBox(parent, width, height, depth, finish, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    typeof finish === 'object' ? finish : sharedMaterial(finish)
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Add a shadow-casting cylinder to a parent group.
export function addCylinder(parent, radiusTop, radiusBottom, height, color, x = 0, y = 0, z = 0, segments = 8) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    sharedMaterial(color)
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// A flat sign with text painted on a canvas texture (shop fronts, districts).
export function addSign(parent, text, x, y, z, width = 5, color = '#f9e7bd') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#143d43';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = color;
  ctx.font = 'bold 50px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 82);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 4),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      side: THREE.DoubleSide,
    })
  );
  sign.position.set(x, y, z);
  parent.add(sign);
  return sign;
}

// A blocky humanoid: torso, head, cap, legs and arms. The limbs are kept
// in userData so animatePerson() can swing them.
export function makePerson(parent, shirt = '#e07a56', police = false) {
  const figure = new THREE.Group();
  const top = police ? '#203443' : shirt;
  const hat = police ? '#132632' : '#312d30';
  addBox(figure, 0.65, 0.88, 0.38, top, 0, 1.2, 0);
  addCylinder(figure, 0.23, 0.23, 0.4, '#c88c68', 0, 1.94, 0);
  addBox(figure, 0.51, 0.15, 0.45, hat, 0, 2.18, 0);
  const legs = [
    addBox(figure, 0.22, 0.72, 0.26, '#243b47', -0.18, 0.4, 0),
    addBox(figure, 0.22, 0.72, 0.26, '#243b47', 0.18, 0.4, 0),
  ];
  const arms = [
    addBox(figure, 0.19, 0.76, 0.22, top, -0.43, 1.15, 0),
    addBox(figure, 0.19, 0.76, 0.22, top, 0.43, 1.15, 0),
  ];
  figure.userData = { legs, arms };
  parent.add(figure);
  return figure;
}

// Swing a figure's legs in a walk cycle (or stand them still).
export function animatePerson(figure, time, moving) {
  const legs = figure.userData.legs;
  for (let i = 0; i < legs.length; i++) {
    legs[i].rotation.x = moving ? Math.sin(time * 9 + i * Math.PI) * 0.5 : 0;
  }
}

// Spray a burst of small cubes from a point; they fall and fade via the
// game's particle list.
export function burst(game, point, color = '#ffb955', count = 10) {
  for (let i = 0; i < count; i++) {
    const cube = addBox(game.scene, 0.11, 0.11, 0.11, color, point.x, point.y || 1, point.z);
    game.particles.push({
      mesh: cube,
      velocity: new THREE.Vector3(
        (game.rng() - 0.5) * 8,
        game.rng() * 7,
        (game.rng() - 0.5) * 8
      ),
      life: 0.6,
    });
  }
}
