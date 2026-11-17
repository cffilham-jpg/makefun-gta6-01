// The heads-up display: cash, wanted stars, health, the mission objective,
// the weapon readout, the message feed and the canvas minimap. update()
// runs every frame and pushes the live game state into the DOM elements
// index.html defines; minimap() redraws the little map around the player
// (roads, buildings, the coast, the garage, the mission marker, police).
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
    $('stars').textContent = '★'.repeat(game.police.stars) + '☆'.repeat(5 - game.police.stars);
    $('heatstate').textContent = game.police.stars
      ? game.police.unseen > 2
        ? 'SEARCHING / STAY HIDDEN'
        : 'POLICE PURSUIT'
      : 'KEEP A LOW PROFILE';
    $('healthFill').style.width = player.hp + '%';
    $('healthText').textContent = 'HEALTH ' + Math.ceil(player.hp);
    $('chapter').textContent = missions.active
      ? 'CHAPTER 0' + (missions.index + 1) + ' / ' + STORY[missions.index].name.toUpperCase()
      : 'DANNY REYES / FREE ROAM';
    $('objectiveText').textContent = missions.objective;
    $('timer').textContent = missions.active && missions.timer > 0 ? Math.ceil(missions.timer) + 's' : '';
    $('district').textContent =
      (player.p.x > 180 ? 'SOLMERE COAST' : player.p.z < 0 ? 'MERIDIAN / DOWNTOWN' : 'PALM AVENUE') +
      ' / 18:42';
    $('speed').style.display = player.car ? 'block' : 'none';
    if (player.car) {
      $('speed').querySelector('strong').textContent = Math.round(Math.abs(player.car.speed) * 3.6)
        .toString()
        .padStart(3, '0');
      $('carName').textContent = player.car.type.toUpperCase() + ' / ' + Math.round(player.car.hp) + '% CONDITION';
    }
    $('weaponName').textContent = weapon.name;
    $('weaponIcon').textContent = weapon.icon;
    $('ammo').textContent = weapon.ammo + ' / ' + weapon.reserve;
    $('reload').textContent =
      game.weapons.reloadLeft > 0
        ? 'RELOADING ' + game.weapons.reloadLeft.toFixed(1) + 's'
        : weapon.id === 'sniper'
          ? '4 / HOLD RMB TO SCOPE'
          : '1 PISTOL · 2 SMG · 3 SHOTGUN · 4 RIFLE';
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
