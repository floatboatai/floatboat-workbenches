// ABOUTME: 生成工作台自带的原创示例素材（程序绘制的画面与合成音频），输出到 app/samples。
// 运行：node samples-src/generate.mjs（需要 ffmpeg，带 libx264 与 aac）。素材完全由本脚本计算，不含第三方作品。
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const W = 1280, H = 720, FPS = 30, RATE = 48000;
const out = join(import.meta.dirname, '../app/samples');
const temp = join(tmpdir(), 'openmontage-samples-' + process.pid);
await mkdir(out, { recursive: true });
await mkdir(temp, { recursive: true });

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };

function run(args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited ' + code))));
    if (input) input(p.stdin).catch(reject);
  });
}
async function writeFrames(stdin, frames, paint) {
  const frame = Buffer.alloc(W * H * 3);
  for (let i = 0; i < frames; i++) {
    paint(frame, i / FPS, i);
    if (!stdin.write(frame)) await new Promise((r) => stdin.once('drain', r));
  }
  stdin.end();
}
function wav(channels) {
  const n = channels[0].length, c = channels.length, data = Buffer.alloc(n * c * 2);
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) data.writeInt16LE(Math.round(clamp(channels[k][i], -1, 1) * 32000), (i * c + k) * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8); head.write('fmt ', 12);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(c, 22); head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * c * 2, 28); head.writeUInt16LE(c * 2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

// 海浪声：低通噪声叠加缓慢涌动的包络。
function seaSound(seconds, seed) {
  const r = rng(seed), n = Math.round(seconds * RATE), L = new Float32Array(n), R = new Float32Array(n);
  let a = 0, b = 0, c = 0, d = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, swell = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 4.6 + seed), 2.2);
    a += (r() * 2 - 1 - a) * 0.035; b += (a - b) * 0.08; c += (r() * 2 - 1 - c) * 0.03; d += (c - d) * 0.09;
    const fade = smooth(0, 0.6, t) * smooth(seconds, seconds - 0.6, t);
    L[i] = b * 1.9 * swell * fade; R[i] = d * 1.9 * (0.4 + 0.6 * swell) * fade;
  }
  return [L, R];
}

// 配乐：C–G–Am–F 的柔和铺底与拨弦琶音，Karplus-Strong 合成。
function theme(seconds) {
  const n = Math.round(seconds * RATE), L = new Float32Array(n), R = new Float32Array(n);
  const chords = [[48, 55, 60, 64], [43, 50, 59, 62], [45, 52, 57, 60], [41, 48, 57, 60]];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12), bar = 3.5;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, chord = chords[Math.floor(t / bar) % 4], local = (t % bar) / bar;
    const env = smooth(0, 0.18, local) * (1 - 0.35 * smooth(0.7, 1, local));
    let pad = 0;
    for (const m of chord) { const f = hz(m); pad += Math.sin(2 * Math.PI * f * t) * 0.6 + Math.sin(2 * Math.PI * f * 2.003 * t) * 0.18 + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.2; }
    const fade = smooth(0, 2.5, t) * smooth(seconds, seconds - 3, t), v = pad * 0.045 * env * fade;
    L[i] += v * (1 + 0.15 * Math.sin(t * 0.7)); R[i] += v * (1 - 0.15 * Math.sin(t * 0.7));
  }
  const step = bar / 8, pattern = [0, 2, 3, 1, 2, 3, 2, 1];
  for (let k = 0; k * step < seconds - 2; k++) {
    const chord = chords[Math.floor((k * step) / bar) % 4], midi = chord[pattern[k % 8]] + 12, period = Math.round(RATE / hz(midi));
    const buf = new Float32Array(period), r = rng(k + 7);
    for (let j = 0; j < period; j++) buf[j] = r() * 2 - 1;
    const start = Math.round(k * step * RATE), len = Math.round(RATE * 1.6), pan = 0.5 + 0.35 * Math.sin(k * 1.7);
    for (let j = 0, p = 0; j < len && start + j < n; j++) {
      const next = (p + 1) % period, v = buf[p];
      buf[p] = (buf[p] + buf[next]) * 0.4975; p = next;
      const fade = smooth(seconds, seconds - 3, (start + j) / RATE) * smooth(0, 3, (start + j) / RATE);
      L[start + j] += v * 0.16 * (1 - pan) * fade; R[start + j] += v * 0.16 * pan * fade;
    }
  }
  return [L, R];
}

// 画面一：海上日出。天空渐亮，太阳升起，海面有闪烁倒影。
function sunrise(f, t) {
  const p = t / 7, sunY = mix(0.70, 0.44, smooth(0, 1, p)) * H, sunX = W * 0.58, horizon = H * 0.62;
  for (let y = 0; y < H; y++) {
    const sky = y / horizon;
    for (let x = 0; x < W; x++) {
      let r, g, b, i = (y * W + x) * 3;
      if (y < horizon) {
        const warm = smooth(0.25, 1, sky) * (0.55 + 0.45 * p);
        r = mix(mix(18, 70, p), 255, warm * 0.85); g = mix(mix(24, 95, p), 150, warm * 0.75); b = mix(mix(70, 160, p), 120, warm * 0.6);
        const d = Math.hypot(x - sunX, y - sunY), glow = Math.exp(-d / (120 + 60 * p)) * (0.6 + 0.4 * p);
        r += 240 * glow; g += 170 * glow; b += 90 * glow;
        if (d < 46) { r = 255; g = mix(200, 240, p); b = mix(130, 200, p); }
        const cloud = Math.sin(x * 0.006 + t * 0.12 + Math.sin(y * 0.04) * 2) * Math.sin(y * 0.05 + 1.3);
        if (y < horizon * 0.6 && cloud > 0.75) { const c = (cloud - 0.75) * 2.4; r = mix(r, 255, c * 0.35); g = mix(g, 190, c * 0.3); b = mix(b, 190, c * 0.25); }
      } else {
        const depth = (y - horizon) / (H - horizon);
        r = mix(40, 8, depth) + 20 * p; g = mix(60, 22, depth) + 25 * p; b = mix(110, 50, depth) + 30 * p;
        const wave = Math.sin(x * 0.045 * (1 + depth * 2) + t * 2.1 + y * 0.5) * Math.sin(y * 0.9 - t * 1.3);
        const column = Math.exp(-Math.pow((x - sunX) / (40 + depth * 160), 2));
        const sparkle = wave > 0.55 ? (wave - 0.55) * 2.2 * column : 0;
        r += 255 * sparkle; g += 190 * sparkle; b += 110 * sparkle;
        r += wave * 6; g += wave * 8; b += wave * 12;
      }
      f[i] = clamp(r, 0, 255); f[i + 1] = clamp(g, 0, 255); f[i + 2] = clamp(b, 0, 255);
    }
  }
}

// 画面二：近景浪花。多层正弦海浪从右向左推进，浪尖泛白。
function waves(f, t) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, ny = y / H;
    let r = mix(150, 60, ny), g = mix(205, 120, ny), b = mix(230, 170, ny);
    for (let layer = 0; layer < 4; layer++) {
      const base = H * (0.34 + layer * 0.15), speed = 40 + layer * 35, amp = 14 + layer * 10;
      const crest = base + Math.sin((x + t * speed) * (0.008 + layer * 0.002) + layer) * amp + Math.sin((x - t * speed * 0.6) * 0.021 + layer * 2) * amp * 0.35;
      if (y > crest) {
        const deep = clamp((y - crest) / 180);
        r = mix(20 + layer * 8, 6, deep); g = mix(110 + layer * 12, 50, deep); b = mix(150 + layer * 10, 90, deep);
        const foam = Math.exp(-(y - crest) / 5) * (0.55 + 0.45 * hash(Math.floor((x + t * speed) / 3), layer));
        r = mix(r, 245, foam); g = mix(g, 250, foam); b = mix(b, 252, foam);
      }
    }
    f[i] = clamp(r, 0, 255); f[i + 1] = clamp(g, 0, 255); f[i + 2] = clamp(b, 0, 255);
  }
}

// 画面三：黄昏港城。天空转紫，楼群剪影的窗灯逐渐亮起，镜头缓慢横移。
const town = (() => { const r = rng(42), list = []; for (let x = -200; x < W + 400;) { const w = 40 + r() * 90; list.push({ x, w, h: 90 + r() * 260, seed: r() }); x += w + r() * 8; } return list; })();
function dusk(f, t) {
  const p = t / 7, pan = t * 24, ground = H * 0.86;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, ny = y / ground;
    let r = mix(mix(70, 30, p), 250, smooth(0.35, 1, ny) * (1 - p * 0.6)), g = mix(mix(60, 30, p), 130, smooth(0.45, 1, ny) * (1 - p * 0.7)), b = mix(mix(140, 80, p), 120, smooth(0.5, 1, ny));
    if (y < H * 0.5 && hash(x, y) > 0.9993 - p * 0.0008) { r = g = b = 230; }
    if (y >= ground) { r = 12; g = 14; b = 26; const ref = Math.sin(x * 0.05 + t * 1.5 + y) > 0.92; if (ref) { r = 200; g = 150; b = 80; } }
    f[i] = r; f[i + 1] = g; f[i + 2] = b;
  }
  for (const bld of town) {
    const left = Math.round(bld.x - pan * 0.9), top = Math.round(ground - bld.h);
    for (let y = Math.max(0, top); y < ground; y++) for (let x = Math.max(0, left); x < Math.min(W, left + bld.w); x++) {
      const i = (y * W + x) * 3, wx = Math.floor((x - left) / 11), wy = Math.floor((y - top) / 15);
      const win = (x - left) % 11 > 3 && (y - top) % 15 > 5 && hash(wx + bld.seed * 100, wy) < smooth(0.1, 0.9, p) * 0.7;
      if (win) { f[i] = 255; f[i + 1] = 205; f[i + 2] = 120; } else { f[i] = 18; f[i + 1] = 20; f[i + 2] = 38; }
    }
  }
}

// 静帧：夜色灯塔。
function lighthouse(f) {
  const r = rng(9), cx = W * 0.7, top = H * 0.32, ground = H * 0.78;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, ny = y / H;
    let R = mix(8, 30, ny), G = mix(14, 40, ny), B = mix(40, 80, ny);
    if (hash(x * 1.3, y * 0.7) > 0.9985) { R = G = B = 200 + 55 * hash(y, x); }
    const ang = Math.atan2(y - top, x - cx), beam = Math.exp(-Math.pow((ang - Math.PI * 0.93) / 0.06, 2)) * Math.exp(-Math.hypot(x - cx, y - top) / 900);
    R += 240 * beam; G += 220 * beam; B += 150 * beam;
    if (y > ground) { const d = (y - ground) / (H - ground); R = mix(14, 4, d); G = mix(24, 10, d); B = mix(50, 24, d); if (Math.sin(x * 0.04 + y * 0.6) > 0.9) { R += 30; G += 30; B += 40; } }
    const half = mix(16, 26, clamp((y - top) / (ground - top)));
    if (y > top && y < ground && Math.abs(x - cx) < half) { const band = Math.floor((y - top) / 38) % 2; R = band ? 210 : 120; G = band ? 205 : 30; B = band ? 200 : 30; }
    if (Math.abs(y - top) < 14 && Math.abs(x - cx) < 18) { R = 255; G = 240; B = 170; }
    if (y > ground - 30 && y <= ground && Math.abs(x - cx) < 120 + 40 * Math.sin(x * 0.02)) { R = 10; G = 12; B = 20; }
    f[i] = clamp(R, 0, 255); f[i + 1] = clamp(G, 0, 255); f[i + 2] = clamp(B, 0, 255);
  }
  void r;
}

async function video(name, seconds, paint, audio) {
  const target = join(out, name), wavPath = join(temp, name + '.wav');
  const args = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-'];
  if (audio) { await writeFile(wavPath, wav(audio)); args.push('-i', wavPath, '-c:a', 'aac', '-b:a', '80k'); }
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-g', '30', '-movflags', '+faststart', '-shortest', target);
  await run(args, (stdin) => writeFrames(stdin, Math.round(seconds * FPS), paint));
}
async function still(name) {
  const frame = Buffer.alloc(W * H * 3);
  lighthouse(frame);
  await run(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', '-', '-frames:v', '1', '-q:v', '4', join(out, name)], async (stdin) => { stdin.end(frame); });
}
async function audio(name, channels) {
  const wavPath = join(temp, name + '.wav');
  await writeFile(wavPath, wav(channels));
  await run(['-i', wavPath, '-c:a', 'aac', '-b:a', '112k', '-movflags', '+faststart', join(out, name)]);
}

await video('sunrise.mp4', 7, sunrise, seaSound(7, 1));
await video('waves.mp4', 6, waves, seaSound(6, 4));
await video('harbor-dusk.mp4', 7, dusk);
await still('lighthouse.jpg');
await audio('theme.m4a', theme(30));
await audio('sea-ambience.m4a', seaSound(12, 8));
await rm(temp, { recursive: true, force: true });
for (const name of ['sunrise.mp4', 'waves.mp4', 'harbor-dusk.mp4', 'lighthouse.jpg', 'theme.m4a', 'sea-ambience.m4a']) {
  const bytes = await readFile(join(out, name));
  console.log(name, (await stat(join(out, name))).size, createHash('sha256').update(bytes).digest('hex'));
}
