// Solmere itself: a procedural coastal city on a road grid, built once at
// startup from a seeded generator so the same seed replays the same city.
// Seven avenues cross seven streets; the blocks between them hold buildings
// with canvas-painted windows, a downtown cluster, palms, lamps, a beach,
// a boardwalk, a marina with sailboats, the Reyes Auto safehouse, and the
// striped Lighthouse Point tower with its rotating beacon.
// Every building registers a solid footprint the player and cars collide
// with. Static boxes are merged into instanced batches per material so the
// renderer stays fast.
import * as THREE from 'three';
import { addBox, addCylinder, addSign, makeRng, sharedMaterial } from './utils.js';

export class City {
  constructor(game) {
    this.game = game;
    this.solids = [];
    this.lampGlows = []; // every street lamp's glow material (day-night dims them)
    this.roads = [-192, -128, -64, 0, 64, 128, 192];
    this.garage = new THREE.Vector3(-21, 0, 30);
    this.hospital = new THREE.Vector3(-20, 0, -30);
    const scene = game.scene;
    const rng = makeRng(711);

    // Ground: a sandy base under a paved city slab.
    addBox(scene, 600, 0.6, 600, '#b5a883', 0, -0.4, 0);
    addBox(scene, 380, 0.12, 440, '#c7b69b', 0, -0.02, 0);
    this.buildRoads(scene);
    this.buildBlocks(scene, rng);
    this.buildPalmsAndLamps(scene, rng);
    this.buildCoast(scene, rng);
    this.buildLighthouse(scene);
    this.buildSafehouse(scene);
    addSign(scene, 'SOLMERE / MARINA', 209, 5, 63, 16);
    addSign(scene, 'PALM AVENUE', -1, 7, -70, 14);
    addSign(scene, 'CIELO HOTEL', -54, 15, 14, 16);
    addSign(scene, 'LIGHTHOUSE POINT', 232, 9, -192, 16);
    addSign(scene, 'NORTH COAST', 205, 6, -180, 14);
    this.buildSky(scene);
    this.mergeStaticBoxes();
  }

  // The road grid: asphalt strips, pale sidewalks, dashed centre lines
  // and zebra crossings at every junction.
  buildRoads(scene) {
    for (const road of this.roads) {
      addBox(scene, 20, 0.08, 440, '#434e56', road, 0.06, 0);
      addBox(scene, 404, 0.09, 20, '#434e56', 0, 0.07, road);
      for (const side of [-11, 11]) {
        addBox(scene, 1.2, 0.22, 440, '#e1cfac', road + side, 0.15, 0);
        addBox(scene, 404, 0.22, 1.2, '#e1cfac', 0, 0.15, road + side);
      }
      for (let along = -215; along < 215; along += 10) {
        if (this.roads.some((other) => Math.abs(other - along) < 13)) continue;
        addBox(scene, 0.16, 0.015, 5, '#f1c56c', road, 0.12, along);
        addBox(scene, 5, 0.015, 0.16, '#f1c56c', along, 0.13, road);
      }
      for (const cross of this.roads) {
        for (let i = -7; i <= 7; i += 2) {
          addBox(scene, 1, 0.02, 4, '#eddfbc', road + i, 0.14, cross + 8);
          addBox(scene, 4, 0.02, 1, '#eddfbc', road + 8, 0.14, cross + i);
        }
      }
    }
  }

  // Four buildings per block across a 6x6 grid, taller downtown. The
  // safehouse lot stays clear.
  buildBlocks(scene, rng) {
    const palette = ['#e7b49b', '#edd8ad', '#c8d3ca', '#98baba', '#d3917b', '#eee0c8'];
    for (let ix = 0; ix < 6; ix++) {
      for (let iz = 0; iz < 6; iz++) {
        const blockX = -160 + ix * 64;
        const blockZ = -160 + iz * 64;
        for (const dx of [-12, 12]) {
          for (const dz of [-12, 12]) {
            const x = blockX + dx;
            const z = blockZ + dz;
            if (Math.abs(x + 21) < 20 && Math.abs(z) < 58) continue;
            const downtown = x < 80 && x > -130 && z < 0;
            const height = downtown ? 17 + rng() * 57 : 6 + rng() * 14;
            this.building(
              x,
              z,
              17 + rng() * 3,
              height,
              17 + rng() * 3,
              palette[Math.floor(rng() * palette.length)],
              rng
            );
          }
        }
      }
    }
  }

  // Palm rows along the beach and Palm Avenue, plus street lamps.
  buildPalmsAndLamps(scene, rng) {
    for (let z = -208; z < 220; z += 24) {
      this.palm(204, z, 6 + rng() * 2);
      this.palm(-11.5, z, 6 + rng() * 2);
      this.palm(11.5, z + 5, 6 + rng() * 2);
      if (z % 48 === -16) this.palm(139, z, 7);
    }
    for (const x of [-128, -64, 64, 128, 192]) {
      for (let z = -210; z < 215; z += 44) this.lamp(x - 11, z);
    }
  }

  // The coast: sand, ocean, wave lines, the boardwalk, marina piers with
  // sailboats, and a line of coloured buoys.
  buildCoast(scene, rng) {
    addBox(scene, 46, 0.08, 470, '#efd6a2', 232, -0.01, 0);
    const water = new THREE.MeshStandardMaterial({
      color: '#438f99',
      metalness: 0.35,
      roughness: 0.28,
    });
    addBox(scene, 600, 0.1, 1000, water, 551, -0.17, 0);
    for (let i = 0; i < 20; i++) {
      addBox(scene, 0.18, 0.035, 350, '#abd1bd', 254 + i * 9, -0.08, Math.sin(i) * 15);
    }
    // Boardwalk and its railing.
    addBox(scene, 9, 0.35, 420, '#bb9270', 211, 0.24, 0);
    for (let z = -190; z < 200; z += 8) {
      addBox(scene, 0.2, 1, 0.2, '#f1d7b3', 215, 1, z);
      addBox(scene, 0.15, 0.15, 8, '#f1d7b3', 215, 1.4, z + 4);
    }
    // Marina piers with moored sailboats.
    for (let z = 75; z < 170; z += 28) {
      addBox(scene, 48, 0.8, 4, '#9d795a', 263, 0.4, z);
      for (let x = 244; x < 285; x += 14) {
        addCylinder(scene, 0.2, 0.24, 3, '#6a5748', x, 0.3, z);
        this.boat(x, z + 8);
      }
    }
    // Buoys off the south beach.
    const buoyColors = ['#e98267', '#f1d992', '#80b4b1'];
    for (let z = -110; z < -20; z += 16) {
      addCylinder(scene, 2.5, 2.5, 0.2, buoyColors[Math.abs(z) % 3], 232, 2, z);
      addCylinder(scene, 0.07, 0.07, 2, '#c9a276', 232, 1, z);
    }
  }

  // Lighthouse Point: a striped tower with a rotating beacon at the
  // south end of the beach. The beam is a child of the beacon group, so
  // the static-box merge never touches it.
  buildLighthouse(scene) {
    const tower = new THREE.Group();
    tower.position.set(232, 0, -205);
    const bands = ['#f2ead8', '#d96a55', '#f2ead8', '#d96a55', '#f2ead8'];
    bands.forEach((color, i) => {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3 - i * 0.12, 2.4 - i * 0.12, 3.6, 12),
        sharedMaterial(color)
      );
      band.position.y = 1.8 + i * 3.6;
      band.castShadow = true;
      tower.add(band);
    });
    const lampRoom = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 2.2, 10),
      new THREE.MeshStandardMaterial({
        color: '#ffd98d',
        emissive: '#ffcf6e',
        emissiveIntensity: 0.9,
      })
    );
    lampRoom.position.y = 19;
    tower.add(lampRoom);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.6, 10), sharedMaterial('#31444d'));
    cap.position.y = 20.8;
    tower.add(cap);
    this.beacon = new THREE.Group();
    this.beacon.position.y = 19;
    this.beaconBeamMat = new THREE.MeshBasicMaterial({
      color: '#fff2a8',
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 55), this.beaconBeamMat);
    beam.position.z = 27.5;
    this.beacon.add(beam);
    tower.add(this.beacon);
    scene.add(tower);
    this.solids.push({ x: 232, z: -205, w: 3, d: 3, h: 20 });
  }

  // Sweep the lighthouse beam around the coast.
  update(dt) {
    if (this.beacon) this.beacon.rotation.y += dt * 0.45;
  }

  // The sky dome and its sun and moon discs. The dome's colours are
  // uniforms, so the day-night cycle repaints the sky every frame; the
  // sun and moon are stored so the cycle can swing them across the sky.
  buildSky(scene) {
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color('#45889a') },
        bottomColor: { value: new THREE.Color('#ffb27a') },
      },
      vertexShader:
        'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 v; void main(){float h=normalize(v).y; gl_FragColor=vec4(mix(bottomColor,topColor,smoothstep(0.,.8,h)),1.);}',
    });
    this.skyUniforms = skyMaterial.uniforms;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(850, 24, 16), skyMaterial);
    scene.add(sky);
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(16, 24, 16),
      new THREE.MeshBasicMaterial({ color: '#ffe0a0' })
    );
    this.sunMesh.position.set(-330, 110, -420);
    scene.add(this.sunMesh);
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(11, 24, 16),
      new THREE.MeshBasicMaterial({ color: '#d8e0ea' })
    );
    this.moonMesh.position.set(330, 320, 420);
    this.moonMesh.visible = false;
    scene.add(this.moonMesh);
  }

  // Merge every loose static box into one instanced mesh per material.
  // Buildings keep their canvas facades (their material is unique).
  mergeStaticBoxes() {
    const scene = this.game.scene;
    const groups = new Map();
    for (const mesh of [...scene.children]) {
      if (!mesh.isMesh || mesh.geometry.type !== 'BoxGeometry') continue;
      if (!groups.has(mesh.material)) groups.set(mesh.material, []);
      groups.get(mesh.material).push(mesh);
    }
    for (const [mat, meshes] of groups) {
      if (meshes.length < 3) continue;
      const batch = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, meshes.length);
      meshes.forEach((mesh, i) => {
        mesh.updateMatrix();
        const size = mesh.geometry.parameters;
        const transform = mesh.matrix
          .clone()
          .multiply(new THREE.Matrix4().makeScale(size.width, size.height, size.depth));
        batch.setMatrixAt(i, transform);
        scene.remove(mesh);
        mesh.geometry.dispose();
      });
      batch.castShadow = true;
      batch.receiveShadow = true;
      batch.computeBoundingSphere();
      scene.add(batch);
    }
  }

  // One building: a canvas texture of lit and dark windows wrapped around
  // a box, with a roof lip, a base trim and a rooftop unit. Short
  // buildings get an awning. Registers its solid footprint for collisions.
  building(x, z, width, height, depth, color, rng) {
    const scene = this.game.scene;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 252; y += 16) {
      for (let a = 7; a < 125; a += 21) {
        ctx.fillStyle = rng() > 0.72 ? '#f5dc9a' : '#46666c';
        ctx.fillRect(a, y, 11, 9);
        ctx.fillStyle = '#d7c2a3';
        ctx.fillRect(a, y + 9, 12, 2);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const facade = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
    addBox(scene, width, height, depth, facade, x, height / 2, z);
    addBox(scene, width + 0.6, 0.5, depth + 0.6, '#efe0bf', x, height, z);
    addBox(scene, width + 1, 1, depth + 1, '#c0a789', x, 0.5, z);
    addBox(scene, 3, 1.8, 4, '#9ca6a2', x + 3, height + 1, z);
    this.solids.push({ x, z, w: width / 2 + 0.5, d: depth / 2 + 0.5, h: height });
    if (height < 22) {
      addBox(scene, width, 0.4, 2, '#4b9290', x, 3, z + depth / 2 + 1);
    }
  }

  // A leaning palm: trunk plus seven drooping cone fronds.
  palm(x, z, height = 7) {
    const scene = this.game.scene;
    const trunk = addCylinder(scene, 0.18, 0.38, height, '#927051', x, height / 2, z, 7);
    trunk.rotation.z = 0.09;
    for (let i = 0; i < 7; i++) {
      const angle = (i * Math.PI * 2) / 7;
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.7, 5, 4),
        sharedMaterial(i % 2 ? '#4d7954' : '#689160')
      );
      leaf.position.set(x + Math.sin(angle) * 1.5, height - 0.1, z + Math.cos(angle) * 1.5);
      leaf.rotation.set(Math.cos(angle) * 1.15, 0, -Math.sin(angle) * 1.15);
      scene.add(leaf);
    }
  }

  // A street lamp with a warm glowing head. The glow material is kept
  // so the day-night cycle can brighten it after dark.
  lamp(x, z) {
    const scene = this.game.scene;
    addCylinder(scene, 0.07, 0.12, 6, '#4b5b5b', x, 3, z);
    addBox(scene, 2, 0.12, 0.15, '#4b5b5b', x + 0.8, 6, z);
    const glow = new THREE.MeshStandardMaterial({
      color: '#fff2bb',
      emissive: '#ffd48d',
      emissiveIntensity: 0.5,
    });
    this.lampGlows.push(glow);
    addBox(scene, 0.65, 0.12, 0.4, glow, x + 1.4, 5.9, z);
  }

  // A little sailboat: hull, cabin, mast and a triangular sail.
  boat(x, z) {
    const scene = this.game.scene;
    addBox(scene, 3, 0.8, 7, '#f0dec0', x, 0.4, z);
    addBox(scene, 2, 0.5, 3, '#477c86', x, 0.9, z);
    addCylinder(scene, 0.045, 0.045, 9, '#e5d6bc', x, 5, z);
    const sail = new THREE.Mesh(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 7, 0),
        new THREE.Vector3(0, 0, 3),
      ]),
      new THREE.MeshStandardMaterial({ color: '#f7e6c1', side: THREE.DoubleSide })
    );
    sail.geometry.setIndex([0, 1, 2]);
    sail.geometry.computeVertexNormals();
    sail.position.set(x, 2, z);
    scene.add(sail);
  }

  // Reyes Auto (the safehouse garage) and Solmere Medical (the hospital).
  buildSafehouse() {
    const scene = this.game.scene;
    addBox(scene, 16, 6, 17, '#528c86', -28, 3, 30);
    addBox(scene, 1, 6, 17, '#eee0bd', -19.5, 3, 30);
    addBox(scene, 1, 6, 17, '#eee0bd', -36.5, 3, 30);
    addBox(scene, 18, 1, 18, '#f1c7a0', -28, 6, 30);
    addBox(scene, 10, 4, 0.1, '#233a40', -28, 2, 38.6);
    addSign(scene, 'REYES / AUTO', -28, 5, 39, 15);
    addBox(scene, 13, 0.02, 10, '#539c88', -23, 0.18, 40);
    addSign(scene, 'SOLMERE MEDICAL', -25, 5, -27, 16);
    addBox(scene, 15, 6, 14, '#ece3c7', -28, 3, -34);
    addBox(scene, 3, 0.5, 0.2, '#db6e60', -28, 5, -26.8);
    addBox(scene, 0.5, 3, 0.2, '#db6e60', -28, 5, -26.7);
  }

  // Is a ground point inside any building footprint (with margin r)?
  blocked(x, z, r = 1) {
    return this.solids.some(
      (b) => Math.abs(x - b.x) < b.w + r && Math.abs(z - b.z) < b.d + r
    );
  }

  // Resolve a move: if the new position is inside a building, snap back
  // to the old one; otherwise clamp to the map bounds. Returns true on a
  // collision.
  resolve(position, old, r = 1) {
    if (this.blocked(position.x, position.z, r)) {
      position.copy(old);
      return true;
    }
    position.x = Math.max(-220, Math.min(245, position.x));
    position.z = Math.max(-225, Math.min(225, position.z));
    return false;
  }
}
