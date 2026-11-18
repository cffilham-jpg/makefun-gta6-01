// The heads-up display: cash, wanted stars, health, the Sun Coin count,
// the mission objective, the race timer, the weapon readout, the message
// feed, the context prompt (buy a property, pick up a taxi passenger)
// and the canvas minimap. update() runs every frame and pushes the live
// game state into the DOM elements index.html defines; minimap() redraws
// the little map around the player (roads, buildings, the coast, the
// garage, the mission marker, the race checkpoints, police, the Sun Coins
// still out there, the properties for sale or owned, and the taxi
// passenger and destination).
import { clamp } from './utils.js';
import { STORY } from './missions.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.messages = [];
    this.ctx = $('map').getContext('2d');
  }

  // Post a line to the message feed (newest first, three at most).
  message(text) {
    this.messages.unshift({ text, time: 6 });
    this.messages = this.messages.slice(0, 3);
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    const weapon = game.weapons.current;
    const missions = game.missions;
    this.messages.forEach((entry) => (entry.time -= dt));
    this.messages = this.messages.filter((entry) => entry.time > 0);
    $('feed').replaceChildren(
      ...this.messages.map((entry) => {
        const line = document.createElement('div');
        line.textContent = entry.text;
        return line;
      })
    );
    $('cash').textContent = '$' + Math.floor(player.cash).toLocaleString();
    $('coins').textContent = '☀ ' + game.collectibles.collected + '/' + game.collectibles.total;
    $('stars').textContent = '★'.repeat(game.police.stars) + '☆'.repeat(5 - game.police.stars);
    $('heatstate').textContent = game.police.stars
      ? game.police.unseen > 2
        ? 'SEARCHING / STAY HIDDEN'
        : 'POLICE PURSUIT'
      : 'KEEP A LOW PROFILE';
    $('healthFill').style.width = player.hp + '%';
    $('healthText').textContent = 'HEALTH ' + Math.ceil(player.hp);
    $('chapter').textContent = missions.active
      ? 'CHAPTER ' + String(missions.index + 1).padStart(2, '0') + ' / ' + STORY[missions.index].name.toUpperCase()
      : 'DANNY REYES / FREE ROAM';
    $('objectiveText').textContent = missions.objective;
    $('timer').textContent = game.races.active
      ? game.races.timeText()
      : missions.active && missions.timer > 0
        ? Math.ceil(missions.timer) + 's'
        : '';
    $('district').textContent =
      (player.p.x > 180
        ? player.p.z < -170
          ? 'LIGHTHOUSE POINT'
          : 'SOLMERE COAST'
        : player.p.z < 0
          ? 'MERIDIAN / DOWNTOWN'
          : 'PALM AVENUE') + ' / ' + game.daynight.timeText();
    // The context prompt: the nearest thing Danny can do right now.
    $('prompt').textContent = game.taxi.prompt() || game.properties.prompt();
    $('speed').style.display = player.car ? 'block' : 'none';
    if (player.car) {
      $('speed').querySelector('strong').textContent = Math.round(Math.abs(player.car.speed) * 3.6)
        .toString()
        .padStart(3, '0');
      $('carName').textContent =
        player.car.type.toUpperCase() +
        ' / ' +
        Math.round((player.car.hp / player.car.maxHp) * 100) +
        '% CONDITION';
    }
    $('weaponName').textContent = weapon.name;
    $('weaponIcon').textContent = weapon.icon;
    $('ammo').textContent = weapon.ammo + ' / ' + weapon.reserve;
    $('reload').textContent =
      game.weapons.reloadLeft > 0
        ? 'RELOADING ' + game.weapons.reloadLeft.toFixed(1) + 's'
        : weapon.id === 'sniper' || weapon.id === 'dmr' || weapon.id === 'crossbow'
          ? 'HOLD RMB TO SCOPE'
          : '1–8 SWITCH · WHEEL CYCLE';
    $('scopeData').innerHTML =
      weapon.id === 'dmr'
        ? 'KESTREL / DMR<br>4× MARKSMAN OPTIC'
        : weapon.id === 'crossbow'
          ? 'WHISPER X9<br>SILENT OPTIC'
          : 'SV-9 / DEADEYE<br>6× PRECISION OPTIC';
    $('hitmarker').textContent = game.weapons.hitTime > 0 ? '×' : '';
    $('hitmarker').className = game.weapons.hitKind;
    $('hitfeedback').textContent = game.weapons.hitTime > 0 ? game.weapons.feedback : '';
    $('damage').style.opacity = player.damage * 0.7;
    document.body.classList.toggle('scoped', game.weapons.scoped);
    $('crosshair').style.display = player.car ? 'none' : '';
    this.minimap();
  }

  // Draw the minimap: the player centred, roads and buildings around them,
  // the ocean and beach to the east, the garage, the mission marker and
  // every active police car.
  minimap() {
    const game = this.game;
    const p = game.player.p;
    const ctx = this.ctx;
    const scale = 0.46;
    const toX = (x) => 100 + (x - p.x) * scale;
    const toZ = (z) => 90 + (z - p.z) * scale;
    ctx.fillStyle = '#244f52';
    ctx.fillRect(0, 0, 200, 180);
    ctx.fillStyle = '#407c7e';
    ctx.fillRect(toX(224), 0, 200, 180);
    ctx.fillStyle = '#b69e74';
    ctx.fillRect(toX(213), 0, 5, 180);
    ctx.fillStyle = '#acb6a4';
    for (const road of game.city.roads) {
      ctx.fillRect(toX(road) - 4, 0, 8, 180);
      ctx.fillRect(0, toZ(road) - 4, 200, 8);
    }
    ctx.fillStyle = '#395f5e';
    for (const solid of game.city.solids) {
      ctx.fillRect(toX(solid.x - solid.w), toZ(solid.z - solid.d), solid.w * 2 * scale, solid.d * 2 * scale);
    }
    ctx.fillStyle = '#80c4a3';
    ctx.fillRect(toX(-21) - 4, toZ(40) - 4, 8, 8);
    ctx.fillStyle = '#edc17e';
    if (game.missions.target) {
      const x = clamp(toX(game.missions.target.x), 8, 192);
      const z = clamp(toZ(game.missions.target.z), 8, 172);
      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    ctx.fillStyle = '#e1736b';
    for (const car of game.police.cars.filter((c) => c.active)) {
      ctx.beginPath();
      ctx.arc(toX(car.p.x), toZ(car.p.z), 3, 0, 7);
      ctx.fill();
    }
    // Street races: the next checkpoint as a cyan diamond, the rest as
    // small cyan dots — and the start rings while no race is running.
    if (game.races.active && game.races.route) {
      const route = game.races.route;
      ctx.fillStyle = '#7fe8e0';
      route.checkpoints.forEach(([x, z], i) => {
        if (i < game.races.gate) return;
        const px = clamp(toX(x), 6, 194);
        const pz = clamp(toZ(z), 6, 174);
        if (i === game.races.gate) {
          ctx.save();
          ctx.translate(px, pz);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-4, -4, 8, 8);
          ctx.restore();
        } else {
          ctx.fillRect(px - 2, pz - 2, 4, 4);
        }
      });
    } else {
      ctx.fillStyle = '#bdf5ef';
      for (const route of game.races.routes || []) {
        const x = toX(route.start[0]);
        const z = toZ(route.start[1]);
        if (x < 0 || x > 200 || z < 0 || z > 180) continue;
        ctx.fillRect(x - 3, z - 3, 6, 6);
      }
    }
    // Sun Coins still out there, as gold dots.
    ctx.fillStyle = '#ffd977';
    for (const coin of game.collectibles.coins) {
      if (coin.taken) continue;
      const x = toX(coin.p.x);
      const z = toZ(coin.p.z);
      if (x < 0 || x > 200 || z < 0 || z > 180) continue;
      ctx.fillRect(x - 2, z - 2, 4, 4);
    }
    // Properties: gold squares for sale, green squares owned.
    for (const property of game.properties.list) {
      const x = toX(property.x);
      const z = toZ(property.z);
      if (x < 0 || x > 200 || z < 0 || z > 180) continue;
      ctx.fillStyle = property.owned ? '#7fd08a' : '#e8c33c';
      ctx.fillRect(x - 3, z - 3, 6, 6);
    }
    // Taxi: the waiting passenger as a cyan dot, the destination as a
    // magenta diamond.
    if (game.taxi.waiting && !game.taxi.onboard) {
      ctx.fillStyle = '#7fe8e0';
      const x = clamp(toX(game.taxi.waiting.x), 6, 194);
      const z = clamp(toZ(game.taxi.waiting.z), 6, 174);
      ctx.fillRect(x - 2, z - 2, 4, 4);
    }
    if (game.taxi.onboard && game.taxi.destination) {
      ctx.fillStyle = '#e07fc8';
      const x = clamp(toX(game.taxi.destination.x), 8, 192);
      const z = clamp(toZ(game.taxi.destination.z), 8, 172);
      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    // The player arrow, rotated to the heading.
    ctx.save();
    ctx.translate(100, 90);
    ctx.rotate(-(game.player.car?.angle ?? game.player.yaw));
    ctx.fillStyle = '#fff0c9';
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(-4, -5);
    ctx.lineTo(0, -2);
    ctx.lineTo(4, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
