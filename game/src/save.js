// Save games live in localStorage under one versioned key: cash, the story
// chapter reached, the player's position, unlocked vehicle types, the
// weapons the player has earned, the Sun Coins already collected, the
// properties Danny owns, and the best street-race time per route.
// Everything is validated on load so a corrupt or foreign save can never
// break the game.
import { STORY } from './missions.js';

const SAVE_KEY = 'solmere-heat-v1';

// Read the saved game, or null when there is none (or it is not ours).
export function load() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    return data && data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

// Write the current run to localStorage and tell the player it landed.
export function save(game) {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        cash: game.player.cash,
        mission: game.missions.index,
        position: [game.player.p.x, 0, game.player.p.z],
        unlocked: game.unlocked,
        weapons: game.weapons.list
          .filter((weapon) => weapon.unlocked)
          .map((weapon) => weapon.id),
        coins: game.collectibles.coins
          .map((coin, i) => (coin.taken ? i : -1))
          .filter((i) => i >= 0),
        properties: game.properties.ownedIds,
        races: game.races.best,
      })
    );
    game.hud.message('Progress saved • Solmere remembers');
  } catch {
    game.hud.message('Save unavailable in this browser');
  }
}

// Apply a loaded save to a fresh run. The position is rejected when it
// lands inside a building (the player respawns at the safehouse instead).
export function restore(game, data) {
  game.player.cash = Number.isFinite(data.cash) ? data.cash : 250;
  game.missions.index = Math.min(STORY.length, Math.max(0, data.mission || 0));
  if (Array.isArray(data.position) && data.position.every(Number.isFinite)) {
    game.player.p.fromArray(data.position);
    if (game.city.blocked(game.player.p.x, game.player.p.z)) {
      game.player.p.set(7, 0, 30);
    }
  }
  game.unlocked = Array.isArray(data.unlocked) ? data.unlocked : [];
  for (const weapon of game.weapons.list) {
    if (data.weapons?.includes(weapon.id)) weapon.unlocked = true;
  }
  if (Array.isArray(data.coins)) {
    for (const i of data.coins) {
      const coin = game.collectibles.coins[i];
      if (coin) {
        coin.taken = true;
        coin.mesh.visible = false;
        coin.ring.visible = false;
      }
    }
  }
  if (Array.isArray(data.properties)) {
    for (const id of data.properties) {
      const property = game.properties.list.find((entry) => entry.id === id);
      if (property && !property.owned) game.properties.setOwned(property);
    }
  }
  if (data.races && typeof data.races === 'object') {
    for (const [route, time] of Object.entries(data.races)) {
      if (Number.isFinite(time) && time > 0) game.races.best[route] = time;
    }
  }
}
