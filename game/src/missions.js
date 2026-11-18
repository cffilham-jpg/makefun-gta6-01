// Danny Reyes' story: fifteen chapters, each with its own job, told through
// Lena's briefings. A glowing waypoint beam marks the objective in the
// world and on the minimap; finishing a chapter pays cash and (after
// chapter 2) unlocks the SV-9 Deadeye sniper, chapter 7 unlocks the
// Kestrel DMR, chapter 10 unlocks the Tempest LMG, and chapter 13 unlocks
// the Whisper X9 crossbow. J starts the next story chapter; the garage
// clears the heat between jobs. Chapters that hinge on a firefight track
// their own guards in this.foes, so only those guards gate the next stage.
import * as THREE from 'three';
import { groundDistance } from './utils.js';

export const STORY = [
  {
    name: 'First Wheels',
    voice: 'Lena: Danny Reyes. Back in Solmere? Borrow a ride. Bring it to our garage.',
    reward: 500,
  },
  {
    name: 'The Pickup',
    voice: 'Lena: The marina contact has our manifest. Pick it up, then lose the patrols.',
    reward: 1200,
  },
  {
    name: 'Beach Run',
    voice: 'Lena: Deliver the manifest along the coast. Ninety seconds. No detours.',
    reward: 1800,
  },
  {
    name: 'Heat Wave',
    voice: 'Lena: Draw them away from the crew. Keep breathing for ninety seconds.',
    reward: 2500,
  },
  {
    name: 'The Big Score',
    voice: 'Lena: Two drops. One final escape. Tonight, Solmere belongs to us.',
    reward: 5000,
  },
  {
    name: 'Harbor Lights',
    voice: 'Lena: The harbor crew is holding our cargo at Lighthouse Point. Clear the guards, take it back.',
    reward: 3000,
  },
  {
    name: 'Night Run',
    voice: 'Lena: The buyer wants the car by midnight. Ninety seconds, three stars, no excuses.',
    reward: 3500,
  },
  {
    name: 'The Informant',
    voice: 'Lena: Our informant is cornered downtown. Get him to the safehouse — alive.',
    reward: 4200,
  },
  {
    name: 'Solmere Sunrise',
    voice: 'Lena: One last job. The exchange, the case, the dawn. Then we are free.',
    reward: 8000,
  },
  {
    name: 'The Vault Job',
    voice: 'Lena: The Meridian Bank vault is unguarded at dusk. Crack it, take the loot, bring it home.',
    reward: 6000,
  },
  {
    name: 'Turf War',
    voice: 'Lena: The Vipers took the south exchange. Take it back — every last one of them.',
    reward: 7000,
  },
  {
    name: 'The Last Stand',
    voice: 'Lena: The Vipers’ final play is at the marina. End it, then run for the lighthouse.',
    reward: 12000,
  },
  {
    name: 'Empire of the Sun',
    voice: 'Lena: The Vipers are gone, but the Meridian Cartel moved into their downtown stronghold. Take it — then it is yours.',
    reward: 9000,
  },
  {
    name: 'Five-Star Run',
    voice: 'Lena: The cartel put a price on your head. Five stars, ninety seconds, one road to the coast. Drive, Danny. Drive.',
    reward: 10000,
  },
  {
    name: 'Solmere Heat',
    voice: 'Lena: One last war. The cartel’s kingpin is at the lighthouse with everything he has. End this — for Solmere.',
    reward: 15000,
  },
];

export class Missions {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.active = false;
    this.stage = 0;
    this.timer = 0;
    this.objective = 'Free roam • explore Solmere / J to start the story';
    this.target = null;
    this.foes = [];
    // The waypoint marker: a light beam, a ground ring and a bobbing arrow.
    this.marker = new THREE.Group();
    game.scene.add(this.marker);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: '#ffd477',
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 22, 24, 1, true), beamMaterial);
    beam.position.y = 11;
    this.marker.add(beam);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.12, 8, 40),
      new THREE.MeshBasicMaterial({ color: '#ffce66' })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    this.marker.add(ring);
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 1.6, 4),
      new THREE.MeshBasicMaterial({ color: '#ffda7e' })
    );
    arrow.rotation.z = Math.PI;
    arrow.position.y = 5;
    this.marker.add(arrow);
    this.marker.visible = false;
  }

  // Point the marker at a spot and set the objective line.
  waypoint(x, z, text) {
    this.target = new THREE.Vector3(x, 0, z);
    this.marker.position.copy(this.target);
    this.marker.visible = true;
    this.objective = text;
  }

  // Open the chapter briefing card (or congratulate a finished story).
  start() {
    if (this.index >= STORY.length) {
      this.game.hud.message('Story complete • the city is yours');
      return;
    }
    // A story chapter takes over from any race or taxi fare in progress.
    this.game.races.cancel('Race abandoned • a story chapter took over');
    this.game.taxi.cancel('Fare cancelled • a story chapter took over');
    this.active = true;
    this.stage = 0;
    this.timer = 0;
    const chapter = STORY[this.index];
    this.game.showOverlay('CHAPTER ' + String(this.index + 1).padStart(2, '0'), chapter.name, chapter.voice, [
      ['Let’s ride', () => this.begin()],
    ]);
  }

  // Begin the chapter's job: set its first waypoint and any guards.
  begin() {
    this.game.resume();
    this.active = true;
    this.stage = 0;
    this.timer = 0;
    this.foes = [];
    if (this.index === 0) {
      this.waypoint(-21, 40, 'Steal a car • E near a vehicle, then deliver it to Reyes Auto');
    } else if (this.index === 1) {
      this.waypoint(195, 75, 'Drive to the marina • collect Lena’s manifest');
      this.game.combat.spawn(180, 78);
      this.game.combat.spawn(184, 80, true);
    } else if (this.index === 2) {
      this.timer = 90;
      this.waypoint(195, -185, 'BEACH RUN • deliver the manifest to North Coast');
    } else if (this.index === 3) {
      this.timer = 90;
      this.game.police.heat = 3;
      this.target = null;
      this.marker.visible = false;
      this.objective = 'HEAT WAVE • survive the three-star diversion';
    } else if (this.index === 4) {
      this.waypoint(-64, -128, 'THE BIG SCORE • reach the exchange on Meridian Street');
      this.game.combat.spawn(-70, -115);
      this.game.combat.spawn(-68, -110, true);
    } else if (this.index === 5) {
      this.waypoint(228, -190, 'HARBOR LIGHTS • clear the guards at Lighthouse Point');
      this.foes = [
        this.game.combat.spawn(228, -185),
        this.game.combat.spawn(224, -195, true),
        this.game.combat.spawn(232, -180),
      ];
    } else if (this.index === 6) {
      this.timer = 90;
      this.game.police.heat = 3;
      this.waypoint(-192, -192, 'NIGHT RUN • deliver the car to the northwest corner in 90s');
    } else if (this.index === 7) {
      this.waypoint(-64, -128, 'THE INFORMANT • pick up the contact on Meridian Street');
    } else if (this.index === 8) {
      this.waypoint(64, -192, 'SOLMERE SUNRISE • reach the north exchange');
      this.foes = [
        this.game.combat.spawn(60, -188),
        this.game.combat.spawn(68, -186, true),
        this.game.combat.spawn(58, -196),
        this.game.combat.spawn(70, -198),
      ];
    } else if (this.index === 9) {
      this.waypoint(64, -64, 'THE VAULT JOB • reach the Meridian Bank vault');
      this.foes = [
        this.game.combat.spawn(60, -60),
        this.game.combat.spawn(68, -62, true),
        this.game.combat.spawn(64, -70),
      ];
    } else if (this.index === 10) {
      this.waypoint(128, 128, 'TURF WAR • take the south exchange from the Vipers');
      this.foes = [
        this.game.combat.spawn(124, 124),
        this.game.combat.spawn(132, 126, true),
        this.game.combat.spawn(128, 134),
        this.game.combat.spawn(120, 130),
        this.game.combat.spawn(136, 132),
      ];
    } else if (this.index === 11) {
      this.waypoint(195, 75, 'THE LAST STAND • the Vipers’ final play at the marina');
      this.foes = [
        this.game.combat.spawn(190, 70),
        this.game.combat.spawn(200, 72, true),
        this.game.combat.spawn(195, 82),
        this.game.combat.spawn(188, 80),
        this.game.combat.spawn(202, 78),
        this.game.combat.spawn(193, 68, true),
      ];
    } else if (this.index === 12) {
      this.waypoint(128, -128, 'EMPIRE OF THE SUN • take the cartel stronghold downtown');
      this.foes = [
        this.game.combat.spawn(124, -124),
        this.game.combat.spawn(132, -126, true),
        this.game.combat.spawn(128, -134),
        this.game.combat.spawn(120, -130),
        this.game.combat.spawn(136, -132),
      ];
    } else if (this.index === 13) {
      this.timer = 90;
      this.game.police.heat = 5;
      this.waypoint(195, 75, 'FIVE-STAR RUN • reach the marina in 90s at five stars');
    } else if (this.index === 14) {
      this.waypoint(228, -190, 'SOLMERE HEAT • the cartel kingpin at the lighthouse');
      this.foes = [
        this.game.combat.spawn(224, -186),
        this.game.combat.spawn(232, -188, true),
        this.game.combat.spawn(228, -196),
        this.game.combat.spawn(220, -192),
        this.game.combat.spawn(236, -194),
        this.game.combat.spawn(226, -182, true),
      ];
    }
  }

  // Pay out the chapter reward, advance the story and offer the next one.
  complete() {
    const chapter = STORY[this.index];
    this.game.player.cash += chapter.reward;
    if (this.index === 1) this.game.weapons.unlock();
    if (this.index === 6) this.game.weapons.unlockById('dmr');
    if (this.index === 9) this.game.weapons.unlockById('lmg');
    if (this.index === 12) this.game.weapons.unlockById('crossbow');
    this.index++;
    this.active = false;
    this.marker.visible = false;
    this.target = null;
    this.objective =
      this.index === STORY.length ? 'Story complete • enjoy Solmere' : 'Job complete • J for the next chapter';
    this.game.persist();
    this.game.audio.tone(1100, 0.4, 'triangle', 0.5);
    this.game.showOverlay(
      'JOB COMPLETE',
      chapter.name,
      '+' +
        chapter.reward.toLocaleString() +
        ' • ' +
        (this.index === 2
          ? 'SV-9 Deadeye unlocked'
          : this.index === 7
            ? 'Kestrel DMR unlocked'
            : this.index === 10
              ? 'Tempest LMG unlocked'
              : this.index === 13
                ? 'Whisper X9 unlocked'
                : this.index === STORY.length
                  ? 'Solmere is yours, Danny'
                  : 'Danny’s reputation grows'),
      [
        [
          'Continue',
          () => {
            this.game.resume();
            if (this.index < STORY.length) this.start();
          },
        ],
        ['Free roam', () => this.game.resume()],
      ]
    );
  }

  // The job failed: offer a retry or free roam.
  fail(reason) {
    if (!this.active) return;
    this.active = false;
    this.marker.visible = false;
    this.target = null;
    this.objective = 'Job failed • J to retry';
    this.game.showOverlay('JOB FAILED', STORY[this.index].name, reason, [
      ['Retry', () => this.begin()],
      ['Free roam', () => this.game.resume()],
    ]);
  }

  update(dt) {
    const game = this.game;
    const chapter = this.index;
    if (game.input.tap('KeyJ') && !this.active) this.start();
    // The waypoint arrow bobs and spins.
    this.marker.children[2].position.y = 5 + Math.sin(game.time * 2) * 0.5;
    this.marker.children[2].rotation.y += dt;
    // Rolling into the garage with a car clears the heat (except during
    // the Heat Wave diversion and the Night Run, which must be survived,
    // not dodged).
    if (
      groundDistance(game.player.p, game.city.garage) < 16 &&
      game.player.car &&
      this.index !== 3 &&
      this.index !== 6 &&
      game.police.stars
    ) {
      game.police.clear();
    }
    if (!this.active) return;

    if (chapter === 0) {
      // First Wheels: steal a car, then deliver it to the garage slowly.
      if (game.player.car) {
        this.objective = 'Deliver your ride to Reyes Auto • green garage / slow down';
        if (groundDistance(game.player.p, this.target) < 14 && Math.abs(game.player.car.speed) < 7) {
          this.complete();
        }
      }
    } else if (chapter === 1) {
      // The Pickup: reach the marina, then lose the two-star tail.
      if (this.stage === 0 && groundDistance(game.player.p, this.target) < 15) {
        this.stage = 1;
        game.police.heat = 2;
        this.marker.visible = false;
        this.target = null;
        this.objective = 'Lose the two-star tail • stay out of sight or use Reyes Auto';
        game.hud.message('Manifest secured • the patrols are onto you!');
      }
      if (this.stage === 1 && !game.police.stars) this.complete();
    } else if (chapter === 2) {
      // Beach Run: a 90-second coastal delivery in a car.
      this.timer -= dt;
      if (this.timer <= 0) this.fail('The coastal delivery window closed.');
      else if (game.player.car && groundDistance(game.player.p, this.target) < 15) this.complete();
    } else if (chapter === 3) {
      // Heat Wave: survive 90 seconds at three stars.
      this.timer -= dt;
      game.police.heat = Math.max(3, game.police.heat);
      if (this.timer <= 0) this.complete();
    } else if (chapter === 4 && this.target && groundDistance(game.player.p, this.target) < 16) {
      // The Big Score: three stops, heat rising at each one.
      this.stage++;
      if (this.stage === 1) {
        game.police.heat = 3;
        this.waypoint(128, 128, 'THE BIG SCORE • deliver the case to the south exchange');
      } else if (this.stage === 2) {
        game.police.heat = 4;
        this.waypoint(-21, 40, 'THE BIG SCORE • return to Reyes Auto and lose the heat');
      } else if (game.player.car) {
        game.police.clear();
        this.complete();
      }
    } else if (chapter === 5) {
      // Harbor Lights: clear the lighthouse guards, then collect the cargo.
      if (this.stage === 0 && this.foes.every((foe) => foe.hp <= 0)) {
        this.stage = 1;
        this.waypoint(232, -198, 'HARBOR LIGHTS • collect the cargo');
        game.hud.message('Guards down • grab the cargo');
      } else if (this.stage === 1 && this.target && groundDistance(game.player.p, this.target) < 12) {
        this.complete();
      }
    } else if (chapter === 6) {
      // Night Run: a 90-second delivery with three stars from the start.
      this.timer -= dt;
      game.police.heat = Math.max(3, game.police.heat);
      if (this.timer <= 0) this.fail('The buyer left. Midnight came and went.');
      else if (game.player.car && groundDistance(game.player.p, this.target) < 15) this.complete();
    } else if (chapter === 7) {
      // The Informant: pick up the contact, then escort him to the garage.
      if (this.stage === 0 && this.target && groundDistance(game.player.p, this.target) < 15) {
        this.stage = 1;
        game.police.heat = 3;
        this.waypoint(-21, 40, 'THE INFORMANT • get him to Reyes Auto');
        game.hud.message('Contact secured • three stars, drive clean');
      } else if (
        this.stage === 1 &&
        this.target &&
        game.player.car &&
        groundDistance(game.player.p, this.target) < 14
      ) {
        game.police.clear();
        this.complete();
      }
    } else if (chapter === 8) {
      // Solmere Sunrise: fight at the north exchange, deliver the case
      // west, then lose four stars at the garage.
      if (this.stage === 0 && this.target && groundDistance(game.player.p, this.target) < 16) {
        this.stage = 1;
        this.marker.visible = false;
        this.target = null;
        this.objective = 'SOLMERE SUNRISE • clear the exchange guards';
      } else if (this.stage === 1 && this.foes.every((foe) => foe.hp <= 0)) {
        this.stage = 2;
        game.police.heat = 3;
        this.waypoint(-128, 128, 'SOLMERE SUNRISE • deliver the case to the west exchange');
      } else if (this.stage === 2 && this.target && groundDistance(game.player.p, this.target) < 16) {
        this.stage = 3;
        game.police.heat = 4;
        this.waypoint(-21, 40, 'SOLMERE SUNRISE • return to Reyes Auto and lose the heat');
      } else if (
        this.stage === 3 &&
        this.target &&
        game.player.car &&
        groundDistance(game.player.p, this.target) < 14
      ) {
        game.police.clear();
        this.complete();
      }
    } else if (chapter === 9) {
      // The Vault Job: reach the bank, clear the vault guards, then
      // deliver the loot to the garage under three stars.
      if (this.stage === 0 && this.target && groundDistance(game.player.p, this.target) < 16) {
        this.stage = 1;
        this.marker.visible = false;
        this.target = null;
        this.objective = 'THE VAULT JOB • clear the vault guards';
      } else if (this.stage === 1 && this.foes.every((foe) => foe.hp <= 0)) {
        this.stage = 2;
        game.police.heat = 3;
        this.waypoint(-21, 40, 'THE VAULT JOB • deliver the loot to Reyes Auto');
        game.hud.message('Vault cracked • $6,000 in the bag');
      } else if (
        this.stage === 2 &&
        this.target &&
        game.player.car &&
        groundDistance(game.player.p, this.target) < 14
      ) {
        game.police.clear();
        this.complete();
      }
    } else if (chapter === 10) {
      // Turf War: take the south exchange, clear all five Vipers, then
      // lose four stars at the garage.
      if (this.stage === 0 && this.target && groundDistance(game.player.p, this.target) < 16) {
        this.stage = 1;
        this.marker.visible = false;
        this.target = null;
        this.objective = 'TURF WAR • clear the Vipers from the south exchange';
      } else if (this.stage === 1 && this.foes.every((foe) => foe.hp <= 0)) {
        this.stage = 2;
        game.police.heat = 4;
        this.waypoint(-21, 40, 'TURF WAR • lose the heat at Reyes Auto');
        game.hud.message('Exchange taken • four stars, run for the garage');
      } else if (
        this.stage === 2 &&
        this.target &&
        game.player.car &&
        groundDistance(game.player.p, this.target) < 14
      ) {
        game.police.clear();
        this.complete();
      }
    } else if (chapter === 11) {
      // The Last Stand: clear six Vipers at the marina, then a 90-second
      // escape to Lighthouse Point under four stars.
      if (this.stage === 0 && this.target && groundDistance(game.player.p, this.target) < 16) {
        this.stage = 1;
        this.marker.visible = false;
        this.target = null;
        this.objective = 'THE LAST STAND • clear the Vipers at the marina';
      } else if (this.stage === 1 && this.foes.every((foe) => foe.hp <= 0)) {
        this.stage = 2;
        this.timer = 90;
        game.police.heat = 4;
        this.waypoint(228, -190, 'THE LAST STAND • escape to Lighthouse Point in 90s');
        game.hud.message('It’s over • run for the lighthouse');
      } else if (this.stage === 2) {
        this.timer -= dt;
        game.police.heat = Math.max(4, game.police.heat);
        if (this.timer <= 0) this.fail('The Vipers caught up before the lighthouse.');
        else if (game.player.car && this.target && groundDistance(game.player.p, this.target) < 15) {
          this.complete();
        }
      }
    } else if (chapter === 12) {
      // Empire of the Sun: take the downtown stronghold, clear all five
      // cartel guards, then lose four stars at the garage.
      if (this.stage === 0 && this.target && groundDistance(game.player.p, this.target) < 16) {
        this.stage = 1;
        this.marker.visible = false;
        this.target = null;
        this.objective = 'EMPIRE OF THE SUN • clear the cartel from the stronghold';
      } else if (this.stage === 1 && this.foes.every((foe) => foe.hp <= 0)) {
        this.stage = 2;
        game.police.heat = 4;
        this.waypoint(-21, 40, 'EMPIRE OF THE SUN • lose the heat at Reyes Auto');
        game.hud.message('Stronghold taken • four stars, run for the garage');
      } else if (
        this.stage === 2 &&
        this.target &&
        game.player.car &&
        groundDistance(game.player.p, this.target) < 14
      ) {
        game.police.clear();
        this.complete();
      }
    } else if (chapter === 13) {
      // Five-Star Run: a 90-second dash to the marina at five stars.
      this.timer -= dt;
      game.police.heat = Math.max(5, game.police.heat);
      if (this.timer <= 0) this.fail('The cartel caught up before the coast.');
      else if (game.player.car && this.target && groundDistance(game.player.p, this.target) < 15) {
        this.complete();
      }
    } else if (chapter === 14) {
      // Solmere Heat: clear six cartel guards at the lighthouse, then
      // lose five stars at the garage — the final job.
      if (this.stage === 0 && this.target && groundDistance(game.player.p, this.target) < 16) {
        this.stage = 1;
        this.marker.visible = false;
        this.target = null;
        this.objective = 'SOLMERE HEAT • clear the kingpin’s guards';
      } else if (this.stage === 1 && this.foes.every((foe) => foe.hp <= 0)) {
        this.stage = 2;
        game.police.heat = 5;
        this.waypoint(-21, 40, 'SOLMERE HEAT • lose five stars at Reyes Auto');
        game.hud.message('The kingpin is down • five stars, one last run home');
      } else if (
        this.stage === 2 &&
        this.target &&
        game.player.car &&
        groundDistance(game.player.p, this.target) < 14
      ) {
        game.police.clear();
        this.complete();
      }
    }
  }
}
