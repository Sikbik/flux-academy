#!/usr/bin/env node
// Builds the favicon set and the web manifest from the OFFICIAL round Flux mark. The mark is never
// redrawn, recoloured or stretched: it is copied, then only rasterised at its own aspect ratio.
//
// Adapted from fluxcommunity/web/scripts/build-icons.mjs (same owner, MIT).
//
//   node web/scripts/build-icons.mjs
//
// Output (all in web/public):
//   favicon.svg              byte copy of brand/round/flux-round-blue-white.svg
//   favicon.ico              16, 32 and 48 px frames
//   apple-touch-icon.png     180 px, the mark on solid black (iOS rounds the corners itself)
//   icon-192.png             192 px, purpose "any", transparent
//   icon-512.png             512 px, purpose "any", transparent
//   icon-maskable-512.png    512 px, purpose "maskable": full-bleed black, mark inside the safe zone
//   site.webmanifest         name "Flux Academy", theme and background #000000, start_url "/"
//
// Needs rsvg-convert and ImageMagick (`magick`).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webRoot } from './art-manifest.mjs';

const pub = join(webRoot, 'public');
const official = join(pub, 'brand', 'round', 'flux-round-blue-white.svg');
const svg = join(pub, 'favicon.svg');
if (!existsSync(official)) {
  console.error(`missing ${official}`);
  process.exit(2);
}
copyFileSync(official, svg);

const tmp = mkdtempSync(join(tmpdir(), 'flux-academy-icons-'));
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

/** Render the round mark `size` px wide (its height follows the official aspect ratio) with transparency. */
function mark(size, out) {
  run('rsvg-convert', ['-w', String(size), svg, '-o', out]);
}

/** The mark `ratio` of the canvas wide, centred on a `size` square of `bg` ('none' = transparent). */
function onCanvas(size, ratio, bg, out) {
  const m = join(tmp, `m-${size}-${ratio}.png`);
  mark(Math.round(size * ratio), m);
  run('magick', [
    '-size',
    `${size}x${size}`,
    `xc:${bg}`,
    m,
    '-gravity',
    'center',
    '-composite',
    '-depth',
    '8',
    '-strip',
    out,
  ]);
}

try {
  // favicon.ico: render each frame at its own size so the small ones stay crisp.
  const frames = [16, 32, 48].map((s) => {
    const f = join(tmp, `ico-${s}.png`);
    const m = join(tmp, `ico-mark-${s}.png`);
    mark(s, m);
    run('magick', ['-size', `${s}x${s}`, 'xc:none', m, '-gravity', 'center', '-composite', f]);
    return f;
  });
  run('magick', [...frames, join(pub, 'favicon.ico')]);

  onCanvas(180, 0.8, '#000000', join(pub, 'apple-touch-icon.png'));
  onCanvas(192, 0.96, 'none', join(pub, 'icon-192.png'));
  onCanvas(512, 0.96, 'none', join(pub, 'icon-512.png'));
  // Maskable: Android may crop to a circle of 80 percent of the width, so keep the mark inside 70 percent.
  onCanvas(512, 0.7, '#000000', join(pub, 'icon-maskable-512.png'));

  const manifest = {
    name: 'Flux Academy',
    short_name: 'Flux Academy',
    description:
      'Learn to deploy on the decentralized cloud: interactive lessons, labs and live network data.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#000000',
    theme_color: '#000000',
    lang: 'en',
    categories: ['education'],
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  writeFileSync(join(pub, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('icons and site.webmanifest written to web/public');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
