// All sound in Solmere Heat is synthesized with WebAudio — no audio files.
// A shared bus feeds every effect; a looping sawtooth oscillator is the car
// engine, its pitch and volume following the car's speed. The context is
// created lazily on the first user gesture (browsers require one).
export class Audio {
  constructor() {
    this.muted = false;
    this.ctx = null;
    this.lastShot = null;
    this.shotCount = 0;
  }

  // Build (or resume) the audio graph. Safe to call on every button click.
  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0.22;
    this.bus.connect(this.ctx.destination);
    this.motor = this.ctx.createOscillator();
    this.motor.type = 'sawtooth';
    this.motorGain = this.ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motor.connect(this.motorGain).connect(this.bus);
    this.motor.start();
  }

  // One short synthesized blip: a falling pitch with a fast decay.
  tone(freq, duration = 0.1, type = 'sine', volume = 0.3) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.4), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(this.bus);
    osc.start();
    osc.stop(now + duration);
  }

  // A gunshot per weapon kind: the sniper gets a deep boom plus a crack.
  shot(kind) {
    this.lastShot = kind;
    this.shotCount++;
    const profile = {
      sniper: [65, 0.55, 0.95],
      pistol: [180, 0.12, 0.5],
      smg: [250, 0.07, 0.35],
      shotgun: [50, 0.3, 0.8],
      rifle: [220, 0.09, 0.4],
      dmr: [90, 0.35, 0.7],
      lmg: [120, 0.08, 0.45],
    }[kind];
    this.tone(profile[0], profile[1], 'sawtooth', profile[2]);
    if (kind === 'sniper' || kind === 'dmr') this.tone(900, 0.08, 'square', 0.5);
  }

  // Keep the engine hum in step with the driven car's speed (0 = silent).
  engine(speed) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.motor.frequency.setTargetAtTime(35 + speed * 3, now, 0.08);
    this.motorGain.gain.setTargetAtTime(speed ? 0.06 : 0, now, 0.1);
  }

  // One wail of a distant police siren; called on a timer while wanted.
  siren(time) {
    if (this.ctx) this.tone(550 + Math.sin(time * 5) * 220, 0.15, 'sine', 0.07);
  }

  // Mute / unmute the whole bus.
  toggle() {
    this.muted = !this.muted;
    if (this.bus) this.bus.gain.value = this.muted ? 0 : 0.22;
  }
}
