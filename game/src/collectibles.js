// Solmere Sun Coins: the side activity. Twelve golden tokens are hidden
// at landmarks across the city — the marina boardwalk, Lighthouse Point,
// the avenue crossings, the beach. Each coin pays $100 on the spot and
// finding all twelve pays a $2,000 bonus. The HUD counts them (top right)
// and the minimap marks the ones still out there as gold dots. Collected
// coins persist in the save game.
import * as THREE from 'three';
import { groundDistance, burst } from './utils.js';

export const COIN_SPOTS = [
  [212, 55, 'Marina boardwalk'],
  [232, -198, 'Lighthouse Point'],
  [0, -192, 'North Avenue'],
  [-192, 0, 'West Avenue'],
  [128, 192, 'South Avenue'],
  [-64, -64, 'Meridian crossing'],
  [64, 128, 'Palm crossing'],
  [192, 150, 'Marina road'],
  [-128, 192, 'Southwest corner'],
  [128, -128, 'Downtown crossing'],
  [-192, -128, 'Northwest corner'],
  [0, 192, 'Palm Avenue south'],
];

export class Collectibles {
  constructor(game) {
    this.game = game;
    this.coins = [];
    const gold = new THREE.MeshStandardMaterial({
      color: '#f2c14e',
      metalness: 0.85,
      roughness: 0.25,
      emissive: '#a86f1d',
      emissiveIntensity: 0.35,
    });
    for (const [x, z, label] of COIN_SPOTS) {
      // The coin itself: a gold disc standing upright, spinning slowly.
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.12, 20), gold);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, 1.1, z);
      mesh.castShadow = true;
      game.scene.add(mesh);
      // A soft glow ring on the ground beneath each coin.
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.1, 0.06, 8, 32),
        new THREE.MeshBasicMaterial({ color: '#ffd977' })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.15, z);
      game.scene.add(ring);
      this.coins.push({ mesh, ring, p: mesh.position, label, taken: false });
    }
  }

  get collected() {
    return this.coins.filter((coin) => coin.taken).length;
  }

  get total() {
    return this.coins.length;
  }

  // A fresh run hides nothing: every coin is back on the map.
  reset() {
    for (const coin of this.coins) {
      coin.taken = false;
      coin.mesh.visible = true;
      coin.ring.visible = true;
    }
  }

  update(dt) {
    const game = this.game;
    for (const coin of this.coins) {
      if (coin.taken) continue;
      coin.mesh.rotation.y += dt * 1.6;
      coin.mesh.position.y = 1.1 + Math.sin(game.time * 2 + coin.p.x) * 0.15;
      if (game.mode !== 'play') continue;
      if (groundDistance(coin.p, game.player.p) < 2.6) {
        coin.taken = true;
        coin.mesh.visible = false;
        coin.ring.visible = false;
        game.player.cash += 100;
        burst(game, coin.p, '#ffd977', 8);
        game.audio.tone(1320, 0.25, 'sine', 0.4);
        const found = this.collected;
        if (found === this.total) {
          game.player.cash += 2000;
          game.hud.message('ALL 12 SUN COINS • +$2,000 bonus!');
        } else {
          game.hud.message('Sun Coin ' + found + '/' + this.total + ' • ' + coin.label + ' • +$100');
        }
        game.persist();
      }
    }
  }
}
