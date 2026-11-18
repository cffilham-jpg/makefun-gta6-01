// Solmere real estate: three properties Danny can buy with earned cash,
// each paying passive income every minute of play. A gold beam and a FOR
// SALE sign mark each one; walk up and press B to buy. Owned properties
// turn their beam green, repaint their sign, show on the minimap, and
// persist in the save game — the motel, the café and the penthouse are
// Danny's empire after the story ends.
import * as THREE from 'three';
import { groundDistance, addSign, burst } from './utils.js';

export const PROPERTIES = [
  { id: 'motel', name: 'Sunset Motel', x: -128, z: 64, price: 8000, income: 120 },
  { id: 'cafe', name: 'Marina Café', x: 192, z: 128, price: 15000, income: 300 },
  { id: 'penthouse', name: 'Cielo Penthouse', x: 64, z: -128, price: 30000, income: 600 },
];

const INCOME_PERIOD = 60; // seconds of play between payouts

export class Properties {
  constructor(game) {
    this.game = game;
    this.incomeTimer = 0;
    this.list = PROPERTIES.map((spec) => ({ ...spec, owned: false }));
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: '#e8c33c',
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (const property of this.list) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 18, 16, 1, true), beamMaterial.clone());
      beam.position.set(property.x, 9, property.z);
      game.scene.add(beam);
      property.beam = beam;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3, 0.12, 8, 40),
        new THREE.MeshBasicMaterial({ color: '#e8c33c' })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(property.x, 0.25, property.z);
      game.scene.add(ring);
      property.ring = ring;
      property.sign = this.paintSign(property);
    }
  }

  // The sign over a property: FOR SALE with its price, or OWNED in green.
  paintSign(property) {
    if (property.sign) this.game.scene.remove(property.sign);
    const text = property.owned
      ? 'OWNED • ' + property.name.toUpperCase()
      : 'FOR SALE • ' + property.name.toUpperCase() + ' • $' + property.price.toLocaleString();
    return addSign(this.game.scene, text, property.x, 6, property.z + 5, 18, property.owned ? '#8fd8a0' : '#f9e7bd');
  }

  // The ids Danny owns, for the save game.
  get ownedIds() {
    return this.list.filter((property) => property.owned).map((property) => property.id);
  }

  // Passive income per minute from everything owned.
  get incomePerMinute() {
    return this.list.filter((property) => property.owned).reduce((sum, property) => sum + property.income, 0);
  }

  // The nearest property within buying range, if any.
  nearest() {
    let best = null;
    let bestDistance = 10;
    for (const property of this.list) {
      const distance = groundDistance(this.game.player.p, property);
      if (distance < bestDistance) {
        best = property;
        bestDistance = distance;
      }
    }
    return best;
  }

  // The HUD prompt when Danny stands by a property.
  prompt() {
    const property = this.nearest();
    if (!property) return '';
    if (property.owned) {
      return property.name + ' • yours • +$' + property.income.toLocaleString() + '/min';
    }
    return 'B — Buy ' + property.name + ' ($' + property.price.toLocaleString() + ')';
  }

  // Mark a property owned: green beam and ring, repainted sign.
  setOwned(property) {
    property.owned = true;
    property.beam.material.color.set('#7fd08a');
    property.ring.material.color.set('#7fd08a');
    property.sign = this.paintSign(property);
  }

  // Buy the property Danny stands by (B), when he can afford it.
  buy(property) {
    const game = this.game;
    if (property.owned) return false;
    if (game.player.cash < property.price) {
      game.hud.message(
        'Not enough cash • ' + property.name + ' costs $' + property.price.toLocaleString()
      );
      return false;
    }
    game.player.cash -= property.price;
    this.setOwned(property);
    burst(game, new THREE.Vector3(property.x, 2, property.z), '#7fd08a', 14);
    game.audio.tone(990, 0.3, 'triangle', 0.4);
    game.hud.message(
      property.name + ' is yours • +$' + property.income.toLocaleString() + ' every minute'
    );
    game.persist();
    return true;
  }

  // Pay out one minute of passive income (called by the timer; tests
  // call it directly).
  payIncome() {
    const amount = this.incomePerMinute;
    if (amount <= 0) return 0;
    this.game.player.cash += amount;
    this.game.hud.message('Business income +$' + amount.toLocaleString());
    this.game.audio.tone(880, 0.2, 'sine', 0.3);
    return amount;
  }

  // A fresh run: every property is for sale again.
  reset() {
    this.incomeTimer = 0;
    for (const property of this.list) {
      property.owned = false;
      property.beam.material.color.set('#e8c33c');
      property.ring.material.color.set('#e8c33c');
      property.sign = this.paintSign(property);
    }
  }

  update(dt) {
    const game = this.game;
    if (game.mode !== 'play') return;
    // Passive income accrues once a minute of play.
    if (this.incomePerMinute > 0) {
      this.incomeTimer += dt;
      if (this.incomeTimer >= INCOME_PERIOD) {
        this.incomeTimer -= INCOME_PERIOD;
        this.payIncome();
      }
    }
    if (game.input.tap('KeyB')) {
      const property = this.nearest();
      if (property && !property.owned) this.buy(property);
    }
  }
}
