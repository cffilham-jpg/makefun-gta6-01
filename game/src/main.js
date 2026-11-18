// Solmere Heat — bootstrap and game loop. One SolmereHeat instance owns
// the renderer, the scene and every subsystem (city, player, cars, police,
// missions, combat, weapons, HUD, audio, input). It also owns the menus:
// the start screen, pause, help, mission cards and the death screen.
// The loop runs at the browser's frame rate with a clamped delta; menus
// freeze the simulation but keep rendering the city behind them.
import * as THREE from 'three';
import { Input } from './input.js';
import { City } from './city.js';
import { Player } from './player.js';
import { Vehicles } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions, STORY } from './missions.js';
import { Combat } from './combat.js';
import { Collectibles } from './collectibles.js';
import { Races } from './races.js';
import { Properties } from './properties.js';
import { Taxi } from './taxi.js';
import { DayNight } from './daynight.js';
import { Weapons } from './weapons.js';
import { HUD } from './hud.js';
import { Audio } from './audio.js';
import { load, save, restore } from './save.js';
import { makeRng } from './utils.js';
import { setupShot } from './shots.js';

class SolmereHeat {
  constructor() {
    this.mode = 'menu';
    this.time = 0;
    this.shake = 0;
    this.particles = [];
    this.unlocked = [];
    this.rng = makeRng(Number(new URLSearchParams(location.search).get('seed')) || 42);

    // Renderer: golden-hour fog, soft shadows, filmic tone mapping.
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#e5bfa0', 120, 440);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1200);
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('world'),
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene.add((this.hemi = new THREE.HemisphereLight('#b7d9de', '#9a7459', 2)));
    const sun = new THREE.DirectionalLight('#ffe1af', 3);
    sun.position.set(-100, 150, -100);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 1, far: 500 });
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.sun = sun;

    // Subsystems, in dependency order.
    this.input = new Input(this.renderer.domElement);
    this.audio = new Audio();
    this.city = new City(this);
    this.daynight = new DayNight(this);
    this.player = new Player(this);
    this.vehicles = new Vehicles(this);
    this.traffic = new Traffic(this);
    this.pedestrians = new Pedestrians(this);
    this.collectibles = new Collectibles(this);
    this.races = new Races(this);
    this.properties = new Properties(this);
    this.taxi = new Taxi(this);
    this.police = new Police(this);
    this.missions = new Missions(this);
    this.weapons = new Weapons(this);
    this.combat = new Combat(this);
    this.hud = new HUD(this);

    this.last = performance.now();
    this.autosave = 0;
    this.player.camera(1, true);
    this.startMenu();
    setupShot(this);
    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });
    window.game = this;
    requestAnimationFrame((t) => this.frame(t));
  }

  // Show a full-screen menu card (start, pause, mission, death).
  showOverlay(eyebrow, title, text, buttons) {
    this.mode = 'menu';
    this.input.clear();
    document.exitPointerLock?.();
    document.getElementById('menuEyebrow').textContent = eyebrow;
    const titleEl = document.getElementById('menuTitle');
    titleEl.innerHTML = '';
    titleEl.textContent = title;
    document.getElementById('menuText').textContent = text;
    const buttonBox = document.getElementById('menuButtons');
    buttonBox.replaceChildren();
    for (const [name, action, disabled] of buttons) {
      const button = document.createElement('button');
      button.textContent = name;
      button.disabled = !!disabled;
      button.onclick = () => {
        this.audio.init();
        this.audio.tone(620, 0.06, 'triangle', 0.2);
        action();
      };
      buttonBox.append(button);
    }
    document.getElementById('overlay').classList.add('visible');
  }

  // The start screen: story, free roam, continue (when a save exists),
  // and the field guide.
  startMenu() {
    const stored = load();
    this.showOverlay(
      'AN ORIGINAL OPEN-WORLD CRIME STORY',
      'SOLMERE HEAT',
      'A city of golden promises. A driver with nothing to lose.\nExplore the coast. Build a reputation. Make your own escape.',
      [
        ['Start Story', () => this.newGame(true)],
        ['Free Roam', () => this.newGame(false)],
        [
          'Continue',
          () => {
            this.resetRun();
            restore(this, stored);
            this.resume();
            if (this.missions.index < STORY.length) this.hud.message('J • continue the next chapter');
          },
          !stored,
        ],
        ['How to Play', () => this.help()],
      ]
    );
    document.getElementById('menuTitle').innerHTML = 'SOLMERE<br><em>HEAT</em>';
  }

  // The controls card.
  help() {
    this.showOverlay(
      'FIELD GUIDE / SOLMERE',
      'YOUR CITY. YOUR RULES.',
      'WASD move / drive · Mouse look (click to lock)\nE enter / exit · Shift sprint · Space jump / handbrake\nLeft mouse fire · F punch · R reload · 1–8 / wheel switch\nHold RMB: scope (SV-9 sniper, Kestrel DMR, Whisper X9) · M mute · Esc pause\nFind the gold rifle crate by Reyes Auto, west of your first car.\nThe steel-blue crate at the marina holds the Kestrel DMR.\nThe black crate on North Avenue holds the Tempest LMG.\nThe grey crate at the lighthouse holds the Whisper X9 crossbow.\nGreen garage clears heat. J starts the next story chapter.\n12 Sun Coins hide around Solmere — all of them pay +$2,000.\n3 street races: drive into a checkered start ring to race the clock —\nbeat the target time for cash. Best times are saved.\nT picks up a taxi passenger (yellow cabs pay half again).\nB buys the property you stand by — businesses pay every minute.\nThe sun sets and rises: nights are quieter, lamps burn, heat cools faster.\nHealth and ammo crates are scattered through the city.',
      [['Back', () => this.startMenu()]]
    );
  }

  // Reset Danny alone (respawn): back on foot at the safehouse, healthy,
  // briefly invulnerable, heat cleared.
  resetPlayer() {
    if (this.player.car) this.player.car = null;
    this.player.mesh.visible = true;
    this.player.p.set(7, 0, 30);
    this.player.hp = 100;
    this.player.yaw = Math.PI;
    this.player.pitch = 0.05;
    this.player.invulnerable = 3;
    this.police.clear();
    this.races.reset();
    this.taxi.reset();
    this.shotCamera = null;
  }

  // Reset the whole run: player, missions, weapons, enemies, cars.
  resetRun() {
    this.resetPlayer();
    this.missions.active = false;
    this.missions.target = null;
    this.missions.marker.visible = false;
    this.missions.timer = 0;
    this.missions.foes = [];
    this.collectibles.reset();
    this.races.reset();
    this.properties.reset();
    this.taxi.reset();
    this.daynight.reset();
    this.weapons.index = 0;
    this.weapons.reloadLeft = 0;
    this.weapons.scoped = false;
    this.weapons.list.forEach((weapon, i) => {
      weapon.ammo = weapon.mag;
      weapon.reserve = [180, 240, 48, 25, 300, 40, 240, 30][i];
      weapon.unlocked = i !== 3 && i !== 5 && i !== 6 && i !== 7;
    });
    for (const enemy of this.combat.enemies) this.scene.remove(enemy.mesh);
    this.combat.enemies = [];
    this.unlocked = [];
    this.vehicles.all.forEach((car) => {
      car.hp = car.maxHp;
      car.speed = 0;
      car.stolen = false;
    });
  }

  // Start a fresh run: story mode opens the first briefing, free roam
  // drops Danny straight into the city.
  newGame(story) {
    this.resetRun();
    this.player.cash = 250;
    this.missions.index = 0;
    this.missions.active = false;
    this.missions.target = null;
    this.missions.marker.visible = false;
    this.missions.objective = 'Free roam • explore Solmere / J to start the story';
    this.resume();
    this.hud.message('Welcome home, Danny • E to take the coupe beside you');
    if (story) this.missions.start();
  }

  // Back to playing from any menu.
  resume() {
    this.mode = 'play';
    document.getElementById('overlay').classList.remove('visible');
    this.input.clear();
  }

  // The pause menu.
  pause() {
    this.showOverlay('TAKE A BREATHER', 'PAUSED', 'Solmere can wait.', [
      ['Resume', () => this.resume()],
      [
        'Save Game',
        () => {
          this.persist();
          this.resume();
        },
      ],
      ['Restart Job', () => this.missions.begin(), !this.missions.active],
      [
        'Main Menu',
        () => {
          this.persist();
          this.startMenu();
        },
      ],
    ]);
  }

  persist() {
    save(this);
  }

  // Danny is out (wasted or busted): offer a respawn at the hospital
  // (with a $150 fee) or the main menu.
  die(title, message) {
    const wasActive = this.missions.active;
    this.missions.active = false;
    this.missions.marker.visible = false;
    this.missions.target = null;
    this.showOverlay('SOLMERE MEDICAL / 24 HOURS', title, message, [
      [
        'Respawn',
        () => {
          this.resetPlayer();
          this.player.p.set(-13, 0, -28);
          this.player.cash = Math.max(0, this.player.cash - 150);
          this.resume();
          this.missions.objective = wasActive ? 'Job failed • J to retry' : 'Free roam • J for the story';
        },
      ],
      ['Main Menu', () => this.startMenu()],
    ]);
  }

  // One simulation step: the world first, then (only while playing) the
  // player's systems, autosave and particles.
  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2);
    this.city.update(dt);
    this.daynight.update(dt);
    this.player.update(dt);
    this.vehicles.update(dt);
    this.traffic.update(dt);
    this.pedestrians.update(dt);
    this.collectibles.update(dt);
    this.races.update(dt);
    this.properties.update(dt);
    this.taxi.update(dt);
    this.police.update(dt);
    if (this.mode !== 'play') return;
    this.weapons.update(dt);
    this.combat.update(dt);
    this.missions.update(dt);
    this.autosave += dt;
    if (this.autosave > 30) {
      this.autosave = 0;
      this.persist();
    }
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      if (particle.velocity.lengthSq() > 0) particle.velocity.y -= dt * 10;
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry?.dispose();
      }
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  // One rendered frame: global keys (pause, mute), the simulation step
  // (frozen for screenshot scenes), then camera, HUD and the render.
  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (this.input.tap('Escape')) {
      if (this.mode === 'play') this.pause();
      else if (document.getElementById('menuTitle').textContent === 'PAUSED') this.resume();
    }
    if (this.input.tap('KeyM')) {
      this.audio.toggle();
      this.hud.message(this.audio.muted ? 'Sound muted' : 'Sound on');
    }
    if (this.mode === 'play' && !this.shotFrozen) this.update(dt);
    this.player.camera(dt);
    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.end();
    requestAnimationFrame((next) => this.frame(next));
  }
}

new SolmereHeat();
