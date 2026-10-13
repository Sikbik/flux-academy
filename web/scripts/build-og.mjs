#!/usr/bin/env node
// Renders the social cards with Playwright (system Chromium):
//   web/public/og/og-image.jpg          1200x630, under 150 KB
//   web/public/og/og-image-square.jpg   1200x1200, under 150 KB
//
// Adapted from fluxcommunity/web/scripts/build-og.mjs (same owner, MIT).
//
//   node web/scripts/build-og.mjs
//
// Layers: the generated backdrop (assets-src/og-backdrop.webp, built by optimize-art.mjs), the REAL
// Flux lockup from web/public/brand/lockup, and real text in Montserrat (from @fontsource). Nothing
// here is generated text or a generated logo.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { repoRoot, webRoot } from './art-manifest.mjs';

const MAX_BYTES = 150 * 1024;
const outDir = join(webRoot, 'public', 'og');
const backdropWide = join(repoRoot, 'assets-src', 'og-backdrop.webp');
const backdropSquare = join(repoRoot, 'assets-src', 'og-backdrop-square.webp');
const lockup = join(webRoot, 'public', 'brand', 'lockup', 'flux-logo-blue-white.svg');
const fontMontserrat = join(
  webRoot,
  'node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2',
);
const fontMono = join(
  webRoot,
  'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',
);

for (const f of [backdropWide, backdropSquare, lockup, fontMontserrat, fontMono]) {
  if (!existsSync(f)) {
    console.error(
      `missing ${f}${f.includes('backdrop') ? ' (run node web/scripts/optimize-art.mjs first)' : ''}`,
    );
    process.exit(2);
  }
}

const url = (f) => pathToFileURL(f).href;

function page({ w, h, art, artCss, shade, text, lockupCss }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Montserrat'; src: url('${url(fontMontserrat)}') format('woff2'); font-weight: 100 900; font-style: normal; }
@font-face { font-family: 'IBM Plex Mono'; src: url('${url(fontMono)}') format('woff2'); font-weight: 400; font-style: normal; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #000; }
.card { position: relative; width: ${w}px; height: ${h}px; overflow: hidden; background: #000; color: #fff; font-family: 'Montserrat', sans-serif; }
.art { position: absolute; inset: 0; background: url('${url(art)}') no-repeat; ${artCss} }
.shade { position: absolute; inset: 0; background: ${shade}; }
.lockup { position: absolute; ${lockupCss} width: auto; display: block; }
.text { position: absolute; ${text.pos} }
h1 { margin: 0; font-size: ${text.title}px; line-height: 0.96; letter-spacing: -0.045em; font-weight: 300; }
h1 b { font-weight: 700; }
p.tag { margin: ${text.gap}px 0 0; font-size: ${text.tag}px; line-height: 1.34; letter-spacing: -0.015em; font-weight: 300; color: rgba(255,255,255,.88); max-width: ${text.tagWidth}px; }
.rule { width: 56px; height: 2px; margin: ${text.gap}px 0 0; background: linear-gradient(90deg, #4f7ad4, #86a1da); }
.url { position: absolute; left: 72px; bottom: 52px; font-family: 'IBM Plex Mono', monospace; font-size: 17px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(134,161,218,.9); }
</style></head><body>
<div class="card">
  <div class="art"></div>
  <div class="shade"></div>
  <img class="lockup" src="${url(lockup)}" alt="">
  <div class="text">
    <h1><b>Flux</b><br>Academy</h1>
    <div class="rule"></div>
    <p class="tag">Learn to deploy on the decentralized cloud</p>
  </div>
  <div class="url">academy.app.runonflux.io</div>
</div>
</body></html>`;
}

const VARIANTS = [
  {
    file: 'og-image.jpg',
    w: 1200,
    h: 630,
    art: backdropWide,
    // The backdrop is 2:1 with its left 40 percent empty; at 630 px tall it is 1260 px wide, so it spans the card.
    artCss: 'background-size: auto 630px; background-position: right center;',
    shade: 'linear-gradient(90deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.6) 34%, rgba(0,0,0,0) 58%)',
    lockupCss: 'left: 72px; top: 60px; height: 56px;',
    text: { pos: 'left: 72px; top: 156px;', title: 112, tag: 29, tagWidth: 470, gap: 28 },
  },
  {
    file: 'og-image-square.jpg',
    w: 1200,
    h: 1200,
    art: backdropSquare,
    artCss: 'background-size: 1200px 1200px; background-position: 0 0;',
    shade: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)',
    lockupCss: 'left: 72px; top: 72px; height: 64px;',
    text: { pos: 'left: 72px; top: 640px;', title: 140, tag: 38, tagWidth: 580, gap: 34 },
  },
];

function toJpeg(png, name) {
  for (let q = 90; q >= 60; q -= 2) {
    const r = spawnSync(
      'magick',
      ['png:-', '-strip', '-interlace', 'Plane', '-sampling-factor', '4:2:0', '-quality', String(q), 'jpg:-'],
      { input: png, maxBuffer: 64 * 1024 * 1024 },
    );
    if (r.status !== 0) throw new Error(`magick failed for ${name}: ${String(r.stderr).slice(0, 200)}`);
    if (r.stdout.length <= MAX_BYTES) return { buf: r.stdout, q };
  }
  throw new Error(`${name} does not fit ${MAX_BYTES} bytes`);
}

const executablePath = [
  '/usr/bin/chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
].find((p) => existsSync(p));
if (!executablePath) {
  console.error('no Chromium found');
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'flux-academy-og-'));
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
try {
  for (const v of VARIANTS) {
    const html = join(tmp, `${v.file}.html`);
    writeFileSync(html, page(v));
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.goto(pathToFileURL(html).href, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(250);
    const png = await p.screenshot({ type: 'png' });
    await ctx.close();
    const { buf, q } = toJpeg(png, v.file);
    writeFileSync(join(outDir, v.file), buf);
    console.log(`ok  ${v.file}  ${v.w}x${v.h}  ${(buf.length / 1024).toFixed(1)} KB  q${q}`);
  }
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
