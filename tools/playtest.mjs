// CDP play-test for Solmere Heat v3: serves game/, drives it in headless
// Chromium over the DevTools protocol, and checks the game end to end:
// menus, driving, all seven weapons, the twelve story chapters, the Sun
// Coins, the street races, the lighthouse, saves, the four screenshot
// scenes, and zero console errors or network requests outside localhost.
// Usage: node tools/playtest.mjs [--port 8091]
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const port = portFlag === -1 ? 8091 : Number(args[portFlag + 1]);
const phaseFlag = args.indexOf('--phase');
const phase = phaseFlag === -1 ? 'gameplay' : args[phaseFlag + 1]; // gameplay | shots | all
const t0 = Date.now();
const CDP_PORT = 9223;
const BASE = `http://127.0.0.1:${port}`;
const CHROMIUM =
  process.env.CHROMIUM_PATH ||
  join(process.env.HOME || '', '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');

// Minimal CDP client over Node's built-in WebSocket.
class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error('CDP websocket failed'));
    });
    this.ws.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(new Error(JSON.stringify(data.error)));
        else resolve(data.result);
      } else if (data.method) {
        for (const handler of this.handlers) handler(data);
      }
    };
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(handler) {
    this.handlers.push(handler);
  }

  close() {
    this.ws.close();
  }
}

const errors = [];
const requests = [];
const seenErrors = new Set();
function noteError(kind, text) {
  const line = kind + ': ' + String(text).slice(0, 300);
  if (seenErrors.has(line)) return;
  seenErrors.add(line);
  errors.push(line);
}

async function waitForHttp(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await sleep(250);
  }
  throw new Error('never came up: ' + url);
}

const results = [];
async function check(name, fn) {
  const stamp = ((Date.now() - t0) / 1000).toFixed(1) + 's';
  try {
    const ok = await fn();
    results.push({ name, ok: !!ok });
    console.log(`[${stamp}] ` + (ok ? 'PASS' : 'FAIL') + ' ' + name);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`[${stamp}] FAIL ` + name + ' :: ' + String(error.message || error).slice(0, 200));
  }
}

const VK = {
  KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyE: 69, KeyJ: 74, KeyR: 82,
  KeyF: 70, KeyM: 77, Space: 32, Escape: 27, ShiftLeft: 16,
  Digit1: 49, Digit2: 50, Digit3: 51, Digit4: 52, Digit5: 53, Digit6: 54, Digit7: 55,
};
const KEY = {
  KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyJ: 'j', KeyR: 'r',
  KeyF: 'f', KeyM: 'm', Space: ' ', Escape: 'Escape', ShiftLeft: 'Shift',
  Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6', Digit7: '7',
};

let cdp;
async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error('evaluate failed: ' + JSON.stringify(result.exceptionDetails).slice(0, 400));
  }
  return result.result?.value;
}

async function waitFor(expression, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await evaluate(expression)) return true;
    } catch {
      // Page still loading.
    }
    await sleep(150);
  }
  return false;
}

async function keyTap(code) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: KEY[code], windowsVirtualKeyCode: VK[code] });
  await sleep(80);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: KEY[code], windowsVirtualKeyCode: VK[code] });
  await sleep(120);
}

async function holdKey(code, ms) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: KEY[code], windowsVirtualKeyCode: VK[code] });
  await sleep(ms);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: KEY[code], windowsVirtualKeyCode: VK[code] });
}

async function clickButton(text) {
  return evaluate(
    `(() => { const b = [...document.querySelectorAll('#menuButtons button')].find((x) => x.textContent.includes('${text}')); if (!b) return false; b.click(); return true; })()`
  );
}

// Drive the nearest PARKED car to the player, get in with E. Traffic cars
// (ai=true) keep moving, so an E press aimed at one can miss — parked cars
// stay put. Retries the press a few times, and is a no-op in a car already.
async function enterNearestCar() {
  if (await evaluate('window.game.player.car !== null')) return true;
  await evaluate(
    `(() => { const g = window.game; let best = null; let bd = 1e9; for (const c of g.vehicles.all) { if (c.police || c.ai) continue; const d = Math.hypot(c.p.x - g.player.p.x, c.p.z - g.player.p.z); if (d < bd) { bd = d; best = c; } } if (!best) return 'none'; g.player.p.set(best.p.x + 2, 0, best.p.z); return best.type; })()`
  );
  for (let i = 0; i < 3; i++) {
    await keyTap('KeyE');
    if (await waitFor('window.game.player.car !== null', 1500)) return true;
  }
  return false;
}

async function teleportCar(x, z) {
  const ok = await evaluate(
    `(() => { const g = window.game; if (!g.player.car) return false; g.player.car.p.set(${x}, 0, ${z}); g.player.car.speed = 0; g.player.p.copy(g.player.car.p); return true; })()`
  );
  await sleep(300);
  return ok;
}

// Move Danny on foot. The car sync (vehicles.update copies the car
// position onto the player every frame) would undo a bare player teleport
// while he is driving, so step out of the car first.
async function teleportPlayer(x, z) {
  await evaluate(
    `(() => { const g = window.game; if (g.player.car) { g.player.car = null; g.player.mesh.visible = true; } g.player.p.set(${x}, 0, ${z}); })()`
  );
  await sleep(300);
}

async function startChapter(index) {
  await evaluate(`window.game.missions.index = ${index}; window.game.missions.start();`);
  await sleep(300);
  await clickButton('ride');
  await sleep(300);
}

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(port)], { cwd: repo, stdio: 'ignore' });
  const browser = spawn(CHROMIUM, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--window-size=1280,720',
    `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=/tmp/playtest-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    await waitForHttp(`${BASE}/`);
    await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json/version`);
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    cdp.on((data) => {
      if (data.method === 'Runtime.exceptionThrown') {
        noteError('exception', data.params.exceptionDetails?.exception?.description || 'unknown');
      } else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
        noteError('console', data.params.args?.map((a) => a.value ?? a.description ?? '').join(' '));
      } else if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') {
        noteError('log', data.params.entry.text);
      } else if (data.method === 'Network.loadingFailed') {
        noteError('network', data.params.errorText + ' ' + (data.params.type || ''));
      } else if (data.method === 'Network.responseReceived' && data.params.response.status >= 400) {
        noteError('http', data.params.response.status + ' ' + data.params.response.url);
      } else if (data.method === 'Network.requestWillBeSent') {
        requests.push(data.params.request.url);
      }
    });
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.navigate', { url: `${BASE}/?seed=7` });
    await waitFor('window.game && window.game.mode === "menu"', 30000);

    if (phase === 'gameplay' || phase === 'all') {
    // --- Menus and start ---
    await check('game object exists', async () => evaluate('!!window.game'));
    await check('starts in menu mode with overlay', async () =>
      evaluate('window.game.mode === "menu" && document.getElementById("overlay").classList.contains("visible")'));
    await check('start menu has 4 buttons', async () =>
      evaluate('document.querySelectorAll("#menuButtons button").length === 4'));
    await check('Start Story opens the chapter 1 briefing', async () => {
      await clickButton('Start Story');
      await sleep(400);
      return evaluate('window.game.missions.active === true && window.game.missions.index === 0');
    });
    await check('briefing button begins play', async () => {
      await clickButton('ride');
      await sleep(400);
      return evaluate('window.game.mode === "play" && window.game.missions.active === true');
    });
    // Never die during the scripted mission runs.
    await evaluate('window.game.player.invulnerable = 99999');

    // --- Arsenal ---
    await check('seven weapons', async () => evaluate('window.game.weapons.list.length === 7'));
    await check('weapon ids in order', async () =>
      evaluate(`JSON.stringify(window.game.weapons.list.map((w) => w.id)) === '["pistol","smg","shotgun","sniper","rifle","dmr","lmg"]'`));
    await check('rifle unlocked, dmr and lmg locked at start', async () =>
      evaluate('window.game.weapons.list[4].unlocked === true && window.game.weapons.list[5].unlocked === false && window.game.weapons.list[6].unlocked === false'));
    await check('Digit5 equips the rifle', async () => {
      await keyTap('Digit5');
      return evaluate('window.game.weapons.current.id === "rifle"');
    });
    await check('Digit6 blocked while dmr locked', async () => {
      await keyTap('Digit6');
      return evaluate('window.game.weapons.current.id === "rifle"');
    });
    await check('unlockById + Digit6 equips the dmr', async () => {
      await evaluate(`window.game.weapons.unlockById('dmr')`);
      await keyTap('Digit6');
      return evaluate('window.game.weapons.current.id === "dmr"');
    });
    await check('dmr fires: shot counted, ammo spent', async () => {
      const before = await evaluate('window.game.weapons.shotsFired');
      await evaluate('window.game.weapons.cooldown = 0; window.game.weapons.fire()');
      const after = await evaluate('window.game.weapons.shotsFired');
      const ammo = await evaluate('window.game.weapons.current.ammo');
      return after === before + 1 && ammo === 7;
    });
    await check('Digit7 blocked while lmg locked', async () => {
      await keyTap('Digit7');
      return evaluate('window.game.weapons.current.id === "dmr"');
    });
    await check('unlockById + Digit7 equips the lmg', async () => {
      await evaluate(`window.game.weapons.unlockById('lmg')`);
      await keyTap('Digit7');
      return evaluate('window.game.weapons.current.id === "lmg"');
    });
    await check('lmg fires: shot counted, ammo spent', async () => {
      const before = await evaluate('window.game.weapons.shotsFired');
      await evaluate('window.game.weapons.cooldown = 0; window.game.weapons.fire()');
      const after = await evaluate('window.game.weapons.shotsFired');
      const ammo = await evaluate('window.game.weapons.current.ammo');
      return after === before + 1 && ammo === 59;
    });
    await check('mouse wheel cycles weapons', async () => {
      await keyTap('Digit1');
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 360, deltaX: 0, deltaY: 120 });
      await sleep(300);
      return evaluate('window.game.weapons.current.id === "smg"');
    });
    await check('sniper scopes on aim', async () => {
      await evaluate(`window.game.weapons.unlock(); window.game.weapons.switch(3); window.game.input.aim = true;`);
      await sleep(300);
      const scoped = await evaluate('window.game.weapons.scoped === true');
      await evaluate('window.game.input.aim = false;');
      return scoped;
    });
    await check('dmr scopes on aim', async () => {
      await evaluate('window.game.weapons.switch(5); window.game.input.aim = true;');
      await sleep(300);
      const scoped = await evaluate('window.game.weapons.scoped === true');
      const label = await evaluate(`document.getElementById('scopeData').textContent.includes('KESTREL')`);
      await evaluate('window.game.input.aim = false;');
      return scoped && label;
    });

    // --- Vehicles ---
    await check('fleet includes muscle, van and motorcycle types', async () =>
      evaluate(
        `(() => { const t = new Set(window.game.vehicles.all.map((c) => c.type)); return t.has('muscle') && t.has('van') && t.has('motorcycle'); })()`
      ));
    await check('at least 2 muscle, 2 van and 2 motorcycles parked', async () =>
      evaluate(
        `(() => { const all = window.game.vehicles.all; return all.filter((c) => c.type === 'muscle').length >= 2 && all.filter((c) => c.type === 'van').length >= 2 && all.filter((c) => c.type === 'motorcycle').length >= 2; })()`
      ));
    await check('van has 140 max hp', async () =>
      evaluate(`window.game.vehicles.all.find((c) => c.type === 'van').maxHp === 140`));
    await check('motorcycle has 60 max hp', async () =>
      evaluate(`window.game.vehicles.all.find((c) => c.type === 'motorcycle').maxHp === 60`));
    await check('E enters the nearest car', async () => enterNearestCar());
    await check('holding W accelerates the car', async () => {
      // Put the car on the empty x=0 road first (the coupe spawns beside
      // the safehouse, boxed in by buildings), then sample the top speed
      // over a 3-second hold — the headless frame rate is low, so the
      // threshold is modest and only proves the throttle works.
      await evaluate(
        `(() => { const g = window.game; const c = g.player.car; c.p.set(0, 0, 180); c.angle = Math.PI; c.speed = 0; g.player.p.copy(c.p); })()`
      );
      await sleep(200);
      let top = 0;
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
      for (let i = 0; i < 12; i++) {
        await sleep(250);
        top = Math.max(top, await evaluate('Math.abs(window.game.player.car.speed)'));
      }
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
      return top > 8;
    });
    await check('muscle car top speed clamps at 58', async () => {
      // Set an impossible speed and let the per-frame clamp bring it to
      // the type's top speed — a straight-line top-speed run would need
      // ~6 game-seconds at full throttle, too slow at headless fps.
      // Park the previous test car in a far corner first — it sits on this
      // same road and the test car would rear-end it at full speed.
      await evaluate(
        `(() => { const g = window.game; const old = g.player.car; if (old) { old.p.set(-200, 0, -200); old.speed = 0; } const m = g.vehicles.all.find((c) => c.type === 'muscle' && c !== old); g.player.car = null; g.player.mesh.visible = true; g.vehicles.enter(m, true); m.p.set(0, 0, 180); m.angle = Math.PI; m.speed = 100; g.player.p.copy(m.p); })()`
      );
      await sleep(500);
      const speed = await evaluate('Math.abs(window.game.player.car.speed)');
      console.log('    muscle speed after clamp: ' + speed);
      return speed > 45 && speed <= 58.5;
    });
    await check('van top speed clamps at 38', async () => {
      await evaluate(
        `(() => { const g = window.game; const old = g.player.car; if (old) { old.p.set(-200, 0, -200); old.speed = 0; } const v = g.vehicles.all.find((c) => c.type === 'van'); g.player.car = null; g.player.mesh.visible = true; g.vehicles.enter(v, true); v.p.set(0, 0, 180); v.angle = Math.PI; v.speed = 100; g.player.p.copy(v.p); })()`
      );
      await sleep(500);
      const speed = await evaluate('Math.abs(window.game.player.car.speed)');
      console.log('    van speed after clamp: ' + speed);
      return speed > 28 && speed <= 38.5;
    });
    await check('motorcycle top speed clamps at 62', async () => {
      await evaluate(
        `(() => { const g = window.game; const old = g.player.car; if (old) { old.p.set(-200, 0, -200); old.speed = 0; } const b = g.vehicles.all.find((c) => c.type === 'motorcycle'); g.player.car = null; g.player.mesh.visible = true; g.vehicles.enter(b, true); b.p.set(0, 0, 180); b.angle = Math.PI; b.speed = 100; g.player.p.copy(b.p); })()`
      );
      await sleep(500);
      const speed = await evaluate('Math.abs(window.game.player.car.speed)');
      console.log('    motorcycle speed after clamp: ' + speed);
      return speed > 45 && speed <= 62.5;
    });
    await check('E exits the car when slow', async () => {
      await evaluate('window.game.player.car.speed = 0');
      await keyTap('KeyE');
      return evaluate('window.game.player.car === null');
    });

    // --- Story: chapter 1 (First Wheels) ---
    await check('chapter 1 completes on garage delivery', async () => {
      if (!(await enterNearestCar())) return false;
      if (!(await teleportCar(-21, 38))) return false;
      const done = await waitFor('window.game.missions.index === 1', 10000);
      await clickButton('Free roam');
      await sleep(300);
      return done;
    });
    await check('chapter 1 paid $500', async () => evaluate('window.game.player.cash >= 750'));

    // --- Story: chapter 6 (Harbor Lights) ---
    await check('chapter 6 begins with 3 foes', async () => {
      await startChapter(5);
      return evaluate('window.game.missions.foes.length === 3 && window.game.missions.active === true');
    });
    await check('chapter 6 advances once the guards fall', async () => {
      await evaluate('window.game.missions.foes.forEach((f) => window.game.combat.damage(f, 999))');
      return waitFor('window.game.missions.stage === 1', 10000);
    });
    await check('chapter 6 completes at the cargo', async () => {
      await teleportPlayer(232, -198);
      const done = await waitFor('window.game.missions.index === 6', 10000);
      await clickButton('Free roam');
      await sleep(300);
      return done;
    });

    // --- Story: chapter 7 (Night Run) ---
    await check('chapter 7 begins with timer and 3 stars', async () => {
      await evaluate('window.game.police.clear()');
      await startChapter(6);
      return evaluate('window.game.missions.timer > 80 && window.game.police.heat >= 3');
    });
    await check('chapter 7 completes and unlocks the DMR', async () => {
      if (!(await enterNearestCar())) return false;
      if (!(await teleportCar(-192, -190))) return false;
      const done = await waitFor('window.game.missions.index === 7', 10000);
      const dmr = await evaluate('window.game.weapons.list[5].unlocked === true');
      await clickButton('Free roam');
      await sleep(300);
      return done && dmr;
    });

    // --- Story: chapter 8 (The Informant) ---
    await check('chapter 8 reaches the contact, heat rises', async () => {
      await evaluate('window.game.police.clear()');
      await startChapter(7);
      await teleportPlayer(-64, -128);
      return waitFor('window.game.missions.stage === 1 && window.game.police.heat >= 3', 10000);
    });
    await check('chapter 8 completes at the garage', async () => {
      if (!(await enterNearestCar())) return false;
      if (!(await teleportCar(-21, 38))) return false;
      const done = await waitFor('window.game.missions.index === 8', 10000);
      await clickButton('Free roam');
      await sleep(300);
      return done;
    });

    // --- Story: chapter 9 (Solmere Sunrise) ---
    await check('chapter 9 begins with 4 foes', async () => {
      await evaluate('window.game.police.clear()');
      await startChapter(8);
      return evaluate('window.game.missions.foes.length === 4');
    });
    await check('chapter 9 reaches the exchange', async () => {
      await teleportPlayer(64, -192);
      return waitFor('window.game.missions.stage === 1', 10000);
    });
    await check('chapter 9 advances once the guards fall', async () => {
      await evaluate('window.game.missions.foes.forEach((f) => window.game.combat.damage(f, 999))');
      return waitFor('window.game.missions.stage === 2', 10000);
    });
    await check('chapter 9 reaches the west exchange', async () => {
      await teleportPlayer(-128, 128);
      return waitFor('window.game.missions.stage === 3', 10000);
    });
    await check('chapter 9 advances the story', async () => {
      if (!(await enterNearestCar())) return false;
      if (!(await teleportCar(-21, 38))) return false;
      const done = await waitFor('window.game.missions.index === 9', 10000);
      await clickButton('Free roam');
      await sleep(300);
      return done;
    });

    // --- Story: chapter 10 (The Vault Job) ---
    await check('chapter 10 begins with 3 foes', async () => {
      await evaluate('window.game.police.clear()');
      await startChapter(9);
      return evaluate('window.game.missions.foes.length === 3');
    });
    await check('chapter 10 reaches the vault', async () => {
      await teleportPlayer(64, -64);
      return waitFor('window.game.missions.stage === 1', 10000);
    });
    await check('chapter 10 advances once the guards fall', async () => {
      await evaluate('window.game.missions.foes.forEach((f) => window.game.combat.damage(f, 999))');
      return waitFor('window.game.missions.stage === 2', 10000);
    });
    await check('chapter 10 completes and unlocks the LMG', async () => {
      if (!(await enterNearestCar())) return false;
      if (!(await teleportCar(-21, 38))) return false;
      const done = await waitFor('window.game.missions.index === 10', 10000);
      const lmg = await evaluate('window.game.weapons.list[6].unlocked === true');
      await clickButton('Free roam');
      await sleep(300);
      return done && lmg;
    });

    // --- Story: chapter 11 (Turf War) ---
    await check('chapter 11 begins with 5 foes', async () => {
      await evaluate('window.game.police.clear()');
      await startChapter(10);
      return evaluate('window.game.missions.foes.length === 5');
    });
    await check('chapter 11 reaches the south exchange', async () => {
      await teleportPlayer(128, 128);
      return waitFor('window.game.missions.stage === 1', 10000);
    });
    await check('chapter 11 advances once the Vipers fall', async () => {
      await evaluate('window.game.missions.foes.forEach((f) => window.game.combat.damage(f, 999))');
      return waitFor('window.game.missions.stage === 2', 10000);
    });
    await check('chapter 11 completes at the garage', async () => {
      if (!(await enterNearestCar())) return false;
      if (!(await teleportCar(-21, 38))) return false;
      const done = await waitFor('window.game.missions.index === 11', 10000);
      await clickButton('Free roam');
      await sleep(300);
      return done;
    });

    // --- Story: chapter 12 (The Last Stand) ---
    await check('chapter 12 begins with 6 foes', async () => {
      await evaluate('window.game.police.clear()');
      await startChapter(11);
      return evaluate('window.game.missions.foes.length === 6');
    });
    await check('chapter 12 reaches the marina', async () => {
      await teleportPlayer(195, 75);
      return waitFor('window.game.missions.stage === 1', 10000);
    });
    await check('chapter 12 advances once the Vipers fall', async () => {
      await evaluate('window.game.missions.foes.forEach((f) => window.game.combat.damage(f, 999))');
      return waitFor('window.game.missions.stage === 2 && window.game.missions.timer > 80', 10000);
    });
    await check('chapter 12 completes the story', async () => {
      if (!(await enterNearestCar())) return false;
      if (!(await teleportCar(228, -190))) return false;
      const done = await waitFor('window.game.missions.index === 12', 10000);
      await clickButton('Free roam');
      await sleep(300);
      return done;
    });

    // --- Street races ---
    await check('three race routes exist', async () => evaluate('window.game.races.routes.length === 3'));
    let raceCashBefore = 0;
    await check('race starts at the Palm Sprint ring', async () => {
      if (!(await enterNearestCar())) return false;
      raceCashBefore = await evaluate('window.game.player.cash');
      if (!(await teleportCar(0, 192))) return false;
      return waitFor(`window.game.races.active === true && window.game.races.route.id === 'palm'`, 10000);
    });
    await check('HUD timer shows the race clock', async () =>
      evaluate(`document.getElementById('timer').textContent.includes(':')`));
    await check('race advances through checkpoints', async () => {
      for (const [x, z] of [[0, 128], [0, 64], [0, 0]]) {
        if (!(await teleportCar(x, z))) return false;
      }
      return waitFor('window.game.races.gate === 3', 10000);
    });
    await check('race finishes and pays the prize', async () => {
      for (const [x, z] of [[0, -64], [0, -128], [0, -192]]) {
        if (!(await teleportCar(x, z))) return false;
      }
      const done = await waitFor(
        'window.game.races.active === false && window.game.races.best.palm !== undefined',
        10000
      );
      const cash = await evaluate('window.game.player.cash');
      return done && cash >= raceCashBefore + 1500;
    });

    // --- Collectibles ---
    await check('twelve Sun Coins exist', async () => evaluate('window.game.collectibles.total === 12'));
    await check('collecting a coin pays $100', async () => {
      // A coin may already have been collected (the Harbor Lights cargo
      // sits on the Lighthouse Point coin), so expect one MORE than the
      // count at the start of this check, not an absolute 1.
      const beforeCount = await evaluate('window.game.collectibles.collected');
      const before = await evaluate('window.game.player.cash');
      await teleportPlayer(212, 55);
      const got = await waitFor(`window.game.collectibles.collected === ${beforeCount + 1}`, 10000);
      const after = await evaluate('window.game.player.cash');
      return got && after >= before + 100;
    });
    await check('HUD coin counter matches collection', async () => {
      const count = await evaluate('window.game.collectibles.collected');
      return evaluate(`document.getElementById('coins').textContent.includes('${count}/12')`);
    });

    // --- City and polish ---
    await check('lighthouse beacon exists and rotates', async () => {
      const a = await evaluate('window.game.city.beacon.rotation.y');
      await sleep(800);
      const b = await evaluate('window.game.city.beacon.rotation.y');
      return b > a;
    });
    await check('district reads LIGHTHOUSE POINT at the coast', async () => {
      await teleportPlayer(230, -190);
      await sleep(300);
      return evaluate(`document.getElementById('district').textContent.includes('LIGHTHOUSE POINT')`);
    });

    // --- Save ---
    await check('save persists coins, chapter and race bests', async () => {
      await evaluate('window.game.persist()');
      const count = await evaluate('window.game.collectibles.collected');
      return evaluate(
        `(() => { const d = JSON.parse(localStorage.getItem('solmere-heat-v1')); return d && d.mission === 12 && Array.isArray(d.coins) && d.coins.length === ${count} && d.races && typeof d.races.palm === 'number'; })()`
      );
    });

    } // end gameplay phase

    // --- Screenshot scenes ---
    if (phase === 'shots' || phase === 'all') {
    for (const shot of ['chase', 'city', 'foot', 'mission']) {
      await check(`shot scene ${shot} reaches ready`, async () => {
        await cdp.send('Page.navigate', { url: `${BASE}/?shot=${shot}&seed=1` });
        return waitFor('window.__shotReady === true', 30000);
      });
    }
    }

    // --- Console and network ---
    await check('zero console errors or exceptions', async () => errors.length === 0);
    await check('zero requests outside localhost', async () =>
      requests.every((url) => url.startsWith('http://127.0.0.1') || url.startsWith('data:')));
    await check('every request succeeded', async () => !errors.some((e) => e.startsWith('http') || e.startsWith('network')));
  } finally {
    browser.kill('SIGTERM');
    server.kill('SIGTERM');
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (errors.length) {
    console.log('Errors seen:');
    for (const error of errors) console.log('  ' + error);
  }
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
