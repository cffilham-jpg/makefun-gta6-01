// The Solmere clock: a full day-night cycle. One game day lasts eight
// real minutes, starting at the golden hour (18:42) the game is known
// for. The sun swings across the sky, the sky dome, fog, sunlight and
// hemisphere light blend through dawn, noon, dusk and night palettes,
// the street lamps glow after dark, the lighthouse beam brightens, and
// the moon rises when the sun sets. The HUD shows the live clock, and
// the city itself reacts: traffic slows and the sidewalks thin out at
// night. setClock() lets screenshot scenes and tests jump to any hour.
import * as THREE from 'three';

export const DAY_LENGTH = 480; // real seconds per full game day
export const START_CLOCK = 18.7; // 18:42, golden hour

// Keyframes: [hour, sky top, sky horizon, fog, sun colour, sun
// intensity, hemisphere intensity, lamp glow, sun elevation, sun azimuth].
// The 24:00 row repeats midnight so the day wraps cleanly.
const KEYS = [
  [0, '#0a1424', '#1c2f45', '#16283a', '#8fa8c8', 0.3, 0.35, 2.4, -25, 0],
  [5, '#1a2b4a', '#5a5a78', '#2a3a52', '#c8a888', 0.6, 0.5, 1.8, 4, -70],
  [7, '#3a6a8a', '#e8b48a', '#c8a888', '#ffd9a0', 1.8, 1.1, 0.6, 24, -48],
  [12, '#2a7ab0', '#a8d8e8', '#b8d0d8', '#fff2d0', 3.0, 1.6, 0.3, 64, 0],
  [17, '#3a7aa8', '#e8c898', '#d8b898', '#ffe0a0', 2.6, 1.4, 0.4, 30, 46],
  [18.7, '#45889a', '#ffb27a', '#e5bfa0', '#ffe1af', 3.0, 2.0, 0.5, 17, 62],
  [20, '#1a2a4a', '#c86a4a', '#5a4038', '#ff9a68', 1.0, 0.7, 1.6, 2, 76],
  [22, '#0a1424', '#1c2f45', '#16283a', '#8fa8c8', 0.3, 0.35, 2.4, -25, 90],
  [24, '#0a1424', '#1c2f45', '#16283a', '#8fa8c8', 0.3, 0.35, 2.4, -25, 0],
];

export class DayNight {
  constructor(game) {
    this.game = game;
    this.clock = START_CLOCK;
    this.scratch = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
    this.apply();
  }

  // Night, when the lamps burn and the sidewalks thin out.
  get isNight() {
    return this.clock >= 20 || this.clock < 5.5;
  }

  // The clock as HH:MM for the HUD district line.
  timeText() {
    const hours = Math.floor(this.clock);
    const minutes = Math.floor((this.clock - hours) * 60);
    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
  }

  // Jump to an hour (screenshot scenes, tests) and apply it at once.
  setClock(hour) {
    this.clock = ((hour % 24) + 24) % 24;
    this.apply();
  }

  // Back to the golden hour (a fresh run).
  reset() {
    this.clock = START_CLOCK;
    this.apply();
  }

  // Blend the two keyframes around the current hour into scratch colours
  // and numbers, then paint the whole scene from them.
  apply() {
    const hour = this.clock;
    let lower = KEYS[0];
    let upper = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (hour >= KEYS[i][0] && hour <= KEYS[i + 1][0]) {
        lower = KEYS[i];
        upper = KEYS[i + 1];
        break;
      }
    }
    const span = upper[0] - lower[0] || 1;
    const t = Math.min(1, Math.max(0, (hour - lower[0]) / span));
    const lerp = (a, b) => a + (b - a) * t;
    const [skyTop, skyBottom, fog, sunColor] = this.scratch;
    skyTop.set(lower[1]).lerp(new THREE.Color(upper[1]), t);
    skyBottom.set(lower[2]).lerp(new THREE.Color(upper[2]), t);
    fog.set(lower[3]).lerp(new THREE.Color(upper[3]), t);
    sunColor.set(lower[4]).lerp(new THREE.Color(upper[4]), t);
    const sunIntensity = lerp(lower[5], upper[5]);
    const hemiIntensity = lerp(lower[6], upper[6]);
    const lampGlow = lerp(lower[7], upper[7]);
    const elevation = (lerp(lower[8], upper[8]) * Math.PI) / 180;
    const azimuth = (lerp(lower[9], upper[9]) * Math.PI) / 180;

    const game = this.game;
    const city = game.city;
    city.skyUniforms.topColor.value.copy(skyTop);
    city.skyUniforms.bottomColor.value.copy(skyBottom);
    game.scene.fog.color.copy(fog);
    game.sun.color.copy(sunColor);
    game.sun.intensity = sunIntensity;
    game.hemi.intensity = hemiIntensity;
    // The directional light follows the sun's arc; after dark it becomes
    // moonlight from the opposite side of the sky.
    const radius = 240;
    const daylight = elevation > 0;
    const lightEl = daylight ? elevation : -elevation;
    const lightAz = daylight ? azimuth : azimuth + Math.PI;
    game.sun.position.set(
      Math.sin(lightAz) * Math.cos(lightEl) * radius,
      Math.max(20, Math.sin(lightEl) * radius),
      -Math.cos(lightAz) * Math.cos(lightEl) * radius
    );
    // The visible sun disc and moon disc on the sky dome.
    const discRadius = 700;
    city.sunMesh.position.set(
      Math.sin(azimuth) * Math.cos(elevation) * discRadius,
      Math.sin(elevation) * discRadius,
      -Math.cos(azimuth) * Math.cos(elevation) * discRadius
    );
    city.sunMesh.visible = daylight;
    city.moonMesh.position.set(
      -Math.sin(azimuth) * discRadius * 0.7,
      320,
      Math.cos(azimuth) * discRadius * 0.7
    );
    city.moonMesh.visible = !daylight;
    // Lamps burn brighter as the light fades; the lighthouse beam too.
    for (const material of city.lampGlows) material.emissiveIntensity = lampGlow;
    if (city.beaconBeamMat) city.beaconBeamMat.opacity = daylight ? 0.22 : 0.5;
  }

  // Advance the clock while playing (a frozen screenshot scene never
  // moves it).
  update(dt) {
    if (this.game.mode !== 'play') return;
    this.clock = (this.clock + (dt * 24) / DAY_LENGTH) % 24;
    this.apply();
  }
}
