// Screenshot runner for Solmere Heat: serves game/ locally, captures the
// four shots from shots.json in headless Chromium, and converts them to
// JPEGs under the gate's limits (each at most 256 KiB, long side 1280,
// short side at least 480). Chromium CLI only — no npm installs.
// Usage: node tools/shots.mjs [--port 8080] [--out screenshots]
import { spawn, execFile } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const port = portFlag === -1 ? 8080 : Number(args[portFlag + 1]);
const outFlag = args.indexOf('--out');
const outDir = outFlag === -1 ? join(repo, 'screenshots') : args[outFlag + 1];

const CHROMIUM =
  process.env.CHROMIUM_PATH ||
  join(process.env.HOME || '', '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');

function run(command, commandArgs, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(command, commandArgs, { timeout: 120000, ...options }, (error, stdout, stderr) => {
      if (error) rejectPromise(new Error(`${command} failed: ${stderr || error.message}`));
      else resolvePromise(stdout);
    });
  });
}

function waitForServer(url, tries = 40) {
  return new Promise((resolvePromise, rejectPromise) => {
    const attempt = async (left) => {
      try {
        const response = await fetch(url);
        if (response.ok) return resolvePromise();
      } catch {
        // Not up yet.
      }
      if (left <= 0) return rejectPromise(new Error('server did not start'));
      setTimeout(() => attempt(left - 1), 250);
    };
    attempt(tries);
  });
}

// Convert a PNG screenshot to a JPEG that fits the gate: start at quality
// 85 and step down until it is under 256 KiB (dimensions stay 1280x720).
async function toJpeg(pngPath, jpegPath) {
  const script = `
from PIL import Image
import sys
img = Image.open(sys.argv[1]).convert("RGB")
for quality in (85, 75, 65, 55, 45):
    img.save(sys.argv[2], "JPEG", quality=quality)
    import os
    if os.path.getsize(sys.argv[2]) <= 262144:
        print(quality)
        break
`;
  const quality = await run('python3', ['-c', script, pngPath, jpegPath]);
  const size = statSync(jpegPath).size;
  if (size > 262144) throw new Error(`${jpegPath} is ${size} bytes even at low quality`);
  return { quality: Number(quality.trim()), size };
}

const spec = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));
const { width, height } = spec.viewport;
mkdirSync(outDir, { recursive: true });

if (!existsSync(CHROMIUM)) {
  console.error(`Chromium not found at ${CHROMIUM}; set CHROMIUM_PATH.`);
  process.exit(1);
}

const server = spawn('node', ['serve.ts', '--port', String(port)], {
  cwd: repo,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let failed = false;
try {
  await waitForServer(`http://127.0.0.1:${port}/`);
  for (const shot of spec.shots) {
    const png = join(outDir, shot.file.replace(/\.jpe?g$/i, '.png'));
    const jpeg = join(outDir, shot.file);
    const url = `http://127.0.0.1:${port}/${shot.query}`;
    await run(CHROMIUM, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      '--virtual-time-budget=8000',
      `--screenshot=${png}`,
      url,
    ]);
    const { quality, size } = await toJpeg(png, jpeg);
    console.log(`${shot.file}: ${size} bytes at JPEG quality ${quality}`);
  }
} catch (error) {
  failed = true;
  console.error(error.message);
} finally {
  server.kill('SIGTERM');
}
process.exit(failed ? 1 : 0);
