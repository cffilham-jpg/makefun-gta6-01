// Danny Reyes' story: nine chapters, each with its own job, told through
// Lena's briefings. A glowing waypoint beam marks the objective in the
// world and on the minimap; finishing a chapter pays cash and (after
// chapter 2) unlocks the SV-9 Deadeye sniper, while chapter 7 unlocks the
// Kestrel DMR. J starts the next chapter; the garage clears the heat
// between jobs. Chapters that hinge on a firefight track their own guards
// in this.foes, so only those guards gate the next stage.
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
    }
  }

  // Pay out the chapter reward, advance the story and offer the next one.
  complete() {
    const chapter = STORY[this.index];
    this.game.player.cash += chapter.reward;
    if (this.index === 1) this.game.weapons.unlock();
    if (this.index === 6) this.game.weapons.unlockById('dmr');
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
    }
  }
}
