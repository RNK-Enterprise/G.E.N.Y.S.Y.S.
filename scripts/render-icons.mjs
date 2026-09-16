#!/usr/bin/env node
/**
 * VEIL™ — regenerate the Tauri icon set from src/assets/logo.svg
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Rasterizes the SVG with the repo's own Playwright Chromium (system
 * ImageMagick has no SVG delegate on many hosts), then assembles icon.ico and
 * icon.icns. ICO: BMP frames 16/24/32/48/64 + a PNG frame at 128 (Vista+).
 * ICNS: PNG-embedded types (icp4/icp5/icp6 + ic07/ic08/ic09/ic10).
 *
 * Output: src-tauri/icons/{32x32,128x128,128x128@2x}.png, icon.ico, icon.icns
 *
 * Usage: node scripts/render-icons.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SVG = path.join(ROOT, 'src', 'assets', 'logo.svg');
const OUT_DIR = path.join(ROOT, 'src-tauri', 'icons');

const SIZES = [16, 24, 32, 48, 64, 128, 256];

/** Pinned-build cache miss → newest chromium already in the Playwright cache. */
async function launchChromium() {
  try {
    return await chromium.launch();
  } catch (err) {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache', 'ms-playwright');
    const candidates = [];
    for (const dir of fs.existsSync(base) ? fs.readdirSync(base) : []) {
      if (dir.startsWith('chromium_headless_shell-')) {
        candidates.push(path.join(base, dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell'));
      } else if (dir.startsWith('chromium-')) {
        candidates.push(path.join(base, dir, 'chrome-linux', 'chrome'));
      }
    }
    const exe = candidates.filter((p) => fs.existsSync(p)).sort().pop();
    if (!exe) throw err;
    console.log(`pinned playwright chromium missing — using cached ${path.basename(path.dirname(path.dirname(exe)))}`);
    return chromium.launch({ executablePath: exe });
  }
}

async function rasterize() {
  const svg = fs.readFileSync(SVG, 'utf8');
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    const frames = {};
    for (const size of SIZES) {
      frames[size] = await page.evaluate(async ({ svg, size }) => {
        const img = new Image();
        const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('SVG decode failed'));
          img.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        const png = new Uint8Array(await blob.arrayBuffer());
        return { png, rgba: ctx.getImageData(0, 0, size, size).data };
      }, { svg, size });
    }
    return frames;
  } finally {
    await browser.close();
  }
}

/** BMP-format frame for ICO from raw canvas RGBA (rows flipped, + 1-bit mask). */
function bmpFrame(rgba, W) {
  const H = W;
  const row = W * 4;
  const px = Buffer.alloc(row * H);
  const maskRow = Math.ceil(W / 32) * 4;
  const mask = Buffer.alloc(maskRow * H);
  for (let y = 0; y < H; y++) {
    Buffer.from(rgba.buffer, y * row, row).copy(px, (H - 1 - y) * row);
    // 1-bit AND mask: opaque where alpha >= 128.
    for (let x = 0; x < W; x++) {
      const a = rgba[y * row + x * 4 + 3];
      if (a < 128) mask[(H - 1 - y) * maskRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(W, 4);
  header.writeInt32LE(H * 2, 8); // XOR + mask planes
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  return Buffer.concat([header, px, mask]);
}

function buildIco(frames) {
  const bmpSizes = [16, 24, 32, 48, 64];
  const entries = [
    ...bmpSizes.map((size) => ({ size, bmp: true, data: bmpFrame(frames[size].rgba, size) })),
    { size: 128, bmp: false, data: Buffer.from(frames[128].png) },
  ];
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + entries.length * 16;
  const dir = Buffer.alloc(entries.length * 16);
  const payloads = [];
  entries.forEach(({ size, data, bmp }, i) => {
    const e = i * 16;
    dir.writeUInt8(size, e);
    dir.writeUInt8(size, e + 1);
    dir.writeUInt16LE(1, e + 4); // type: icon
    dir.writeUInt16LE(bmp ? 32 : 24, e + 6); // bit count
    dir.writeUInt32LE(data.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += data.length;
    payloads.push(data);
  });
  return Buffer.concat([header, dir, ...payloads]);
}

function buildIcns(frames) {
  const types = [
    ['icp4', 16], ['icp5', 32], ['icp6', 64],
    ['ic07', 128], ['ic08', 256],
  ];
  const chunks = [];
  for (const [type, size] of types) {
    if (!frames[size]) continue;
    const data = Buffer.from(frames[size].png);
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(8 + data.length, 4);
    chunks.push(head, data);
  }
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([head, body]);
}

const frames = await rasterize();

// Sanity: the ice-blue accent (#8ab4f8) must actually be present in bulk —
// guards against an invisible/empty raster the way a broken SVG delegate produces.
{
  const rgba = frames[64].rgba;
  let accentPixels = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
    if (a > 200 && Math.abs(r - 138) <= 28 && Math.abs(g - 180) <= 28 && Math.abs(b - 248) <= 28) accentPixels++;
  }
  if (accentPixels < 150) {
    console.error(`icon render sanity check FAILED — only ${accentPixels} ice-blue pixels in the 64px render (expected 150+)`);
    process.exit(1);
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, '32x32.png'), frames[32].png);
fs.writeFileSync(path.join(OUT_DIR, '128x128.png'), frames[128].png);
fs.writeFileSync(path.join(OUT_DIR, '128x128@2x.png'), frames[256].png);
fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), buildIco(frames));
fs.writeFileSync(path.join(OUT_DIR, 'icon.icns'), buildIcns(frames));

for (const f of ['32x32.png', '128x128.png', '128x128@2x.png', 'icon.ico', 'icon.icns']) {
  const st = fs.statSync(path.join(OUT_DIR, f));
  console.log(`${f.padEnd(18)} ${String(st.size).padStart(7)} bytes`);
}
console.log('icon set regenerated from src/assets/logo.svg');
