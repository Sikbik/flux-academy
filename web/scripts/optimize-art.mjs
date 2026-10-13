#!/usr/bin/env node
// Turns the raw generations (assets-src/raw/<id>.png) into shippable art:
//   web/public/art/<id>.webp (always) and <id>.avif (only where it is meaningfully smaller),
// then rewrites assets-src/art-manifest.json and web/src/content/art.ts.
//
// Adapted from fluxcommunity/web/scripts/optimize-art.mjs (same owner, MIT). New here: auto-fit, which
// measures the lit subject and re-frames it so every piece in a group has the same scale and the same
// centring (or the same baseline, for the three tracks), whatever the model drew.
//
//   node web/scripts/optimize-art.mjs                 every piece that has a raw file
//   node web/scripts/optimize-art.mjs --only track-cumulus,mod-network
//   node web/scripts/optimize-art.mjs --no-avif
//   node web/scripts/optimize-art.mjs --report        print the table only (reads the manifest)
//   node web/scripts/optimize-art.mjs --sheet         build assets-src/_work/contact-sheet-*.png (git-ignored)
//   node web/scripts/optimize-art.mjs --meta          refresh alt, desc and flags from the spec, no re-encode
//
// Per piece (see assets-src/art-spec.mjs):
//   1. crush the near-black floor, then frame: auto-fit around the lit subject (square pieces with `fit`)
//      or a centre crop to the target aspect, and resize with Lanczos to the target size
//   2. multiply by a smooth edge mask so the outer ring is exactly #000 (this is what makes
//      mix-blend-mode: screen and additive blending seamless)
//   3. sprites: derive alpha from luminance (colour is un-premultiplied), or grayscale for dirt
//   4. WebP at quality 86 (stepping down only if the byte budget demands it); AVIF at the smallest size
//      whose DSSIM is no worse than the WebP's, kept only if it is at least 15 percent smaller
//   5. measure corners, average colour, lit box, sizes; write the manifest
//
// Needs ImageMagick (`magick`) and `avifenc` on PATH.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PIECES } from '../../assets-src/art-spec.mjs';
import { manifestJson, repoRoot, webRoot, writeArtManifest } from './art-manifest.mjs';

const rawDir = join(repoRoot, 'assets-src', 'raw');
const outDir = join(webRoot, 'public', 'art');
const srcOnlyDir = join(repoRoot, 'assets-src');
const DEFAULT_MAX_KB = 120;
const WEBP_START_Q = 86;
const AVIF_MIN_SAVING = 0.85;

function parseArgs(argv) {
  const o = { only: null, avif: true, report: false, sheet: false, meta: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') o.only = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--no-avif') o.avif = false;
    else if (a === '--report') o.report = true;
    else if (a === '--sheet') o.sheet = true;
    else if (a === '--meta') o.meta = true;
    else {
      console.error(`unknown option ${a}`);
      process.exit(2);
    }
  }
  return o;
}

const mg = (args) => execFileSync('magick', args, { maxBuffer: 512 * 1024 * 1024 });
const mgText = (args) => mg(args).toString('utf8').trim();

function dims(file) {
  const [w, h] = mgText(['identify', '-format', '%w %h', file]).split(' ').map(Number);
  return { w, h };
}

/** Row (0-based) with the highest mean luminance, to centre thin horizontal subjects such as a streak. */
function brightestRow(raw, rh) {
  const txt = mgText([raw, '-colorspace', 'Gray', '-scale', `1x${rh}!`, '-depth', '8', 'txt:-']);
  let best = 0;
  let bestV = -1;
  for (const line of txt.split('\n')) {
    const m = line.match(/^0,(\d+):\s*\((\d+)/);
    if (m && Number(m[2]) > bestV) {
      bestV = Number(m[2]);
      best = Number(m[1]);
    }
  }
  return best;
}

/**
 * Extent of the lit subject in a raw image: the 0.2 and 99.8 percentiles of the light mass above a floor,
 * per axis, so a stray spark or a drifting shard does not drag the box around.
 */
function litBox(raw, { floor = 36, tail = 0.002 } = {}) {
  const { w, h } = dims(raw);
  const buf = mg([raw, '-colorspace', 'Gray', '-depth', '8', 'gray:-']);
  const col = new Float64Array(w);
  const row = new Float64Array(h);
  let total = 0;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      const v = buf[o + x] - floor;
      if (v > 0) {
        col[x] += v;
        row[y] += v;
        total += v;
      }
    }
  }
  if (total === 0) return { x0: 0, y0: 0, x1: w - 1, y1: h - 1, w, h };
  const quantile = (arr, p) => {
    let acc = 0;
    const target = total * p;
    for (let i = 0; i < arr.length; i++) {
      acc += arr[i];
      if (acc >= target) return i;
    }
    return arr.length - 1;
  };
  return {
    x0: quantile(col, tail),
    x1: quantile(col, 1 - tail),
    y0: quantile(row, tail),
    y1: quantile(row, 1 - tail),
    w,
    h,
  };
}

/**
 * The window (in raw pixels, with the aspect of the output) an auto-fit piece is cropped from. It may extend
 * past the raw frame: the overhang is padded with black. `fill` sizes the window so the lit box fills that
 * fraction of it; `height` + `baseline` size it so the lit box is that tall and its base sits at `baseline`.
 */
function fitWindow(piece, raw) {
  const b = litBox(raw);
  const bw = Math.max(1, b.x1 - b.x0);
  const bh = Math.max(1, b.y1 - b.y0);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const f = piece.fit;
  const aspect = piece.w / piece.h;
  if (f.height) {
    const wh = Math.round(bh / f.height);
    const ww = Math.round(wh * aspect);
    return { ww, wh, x: Math.round(cx - ww / 2), y: Math.round(b.y1 - (f.baseline ?? 0.9) * wh) };
  }
  const fill = f.fill ?? 0.76;
  const ww = Math.round(Math.max(bw / fill, (bh / fill) * aspect));
  const wh = Math.round(ww / aspect);
  return { ww, wh, x: Math.round(cx - ww / 2), y: Math.round(cy - wh / 2) };
}

/**
 * Smooth edge mask (1 inside, easing to exactly 0 on the outer pixel ring) for a `w` x `h` image, written
 * to `file`. Built at quarter size (the function is smooth) and scaled up. Fractions are of the size.
 */
function writeEdgeMask(file, w, h, fx, fy) {
  const mw = Math.max(2, Math.round(w / 4));
  const mh = Math.max(2, Math.round(h / 4));
  const fpx = Math.max(1, (fx * w) / 4);
  const fpy = Math.max(1, (fy * h) / 4);
  mg([
    '-size',
    `${mw}x${mh}`,
    'xc:white',
    '-fx',
    `dx=min(i,w-1-i)/${fpx}; dy=min(j,h-1-j)/${fpy}; dist=min(dx,dy); tt=min(dist,1); tt*tt*(3-2*tt)`,
    '-filter',
    'Triangle',
    '-resize',
    `${w}x${h}!`,
    '-colorspace',
    'Gray',
    file,
  ]);
}

/** Build the master PNG (final pixels, lossless) for a piece. */
function buildMaster(piece, rawFile, master, tmp) {
  const post = piece.post ?? {};
  const black = post.black ?? 1.2; // percent of full scale crushed to 0
  const fx = post.featherX ?? post.feather ?? 0.075; // fraction of width
  const fy = post.featherY ?? post.feather ?? 0.075; // fraction of height

  let raw = rawFile;
  if (piece.fit) {
    // Auto-fit re-frames the subject, so first make sure the raw frame itself ends in black: anything lit
    // that touches the raw edge is faded out here, otherwise the re-framed piece would show a hard cut.
    const { w: w0, h: h0 } = dims(rawFile);
    const rawMask = join(tmp, 'raw-mask.png');
    const rf = post.rawFeather ?? 0.025;
    writeEdgeMask(rawMask, w0, h0, rf, rf);
    raw = join(tmp, 'raw-faded.png');
    mg([rawFile, '-level', `${black}%,100%`, rawMask, '-compose', 'multiply', '-composite', '-strip', raw]);
  }
  const { w: rw, h: rh } = dims(raw);
  const steps = [raw];
  if (raw === rawFile) steps.push('-level', `${black}%,100%`);

  if (piece.fit) {
    const win = fitWindow(piece, raw);
    const pad = Math.max(0, -win.x, -win.y, win.x + win.ww - rw, win.y + win.wh - rh) + 2;
    steps.push(
      '-bordercolor',
      'black',
      '-border',
      `${pad}x${pad}`,
      '-crop',
      `${win.ww}x${win.wh}+${win.x + pad}+${win.y + pad}`,
      '+repage',
    );
  } else {
    const aspect = piece.w / piece.h;
    let cw = rw;
    let ch = Math.round(rw / aspect);
    if (ch > rh) {
      ch = rh;
      cw = Math.round(rh * aspect);
    }
    const cx = Math.round((rw - cw) / 2);
    let cy = Math.round((rh - ch) / 2);
    if (post.centerBrightRow) {
      cy = Math.max(0, Math.min(rh - ch, brightestRow(raw, rh) - Math.round(ch / 2)));
    }
    steps.push('-crop', `${cw}x${ch}+${cx}+${cy}`, '+repage');
  }
  steps.push('-filter', 'Lanczos', '-resize', `${piece.w}x${piece.h}!`);

  // Final edge mask. A feather of 0 means "leave the edges alone".
  if (fx > 0 && fy > 0) {
    const maskFile = join(tmp, 'mask.png');
    writeEdgeMask(maskFile, piece.w, piece.h, fx, fy);
    steps.push(maskFile, '-compose', 'multiply', '-composite');
  }
  if (post.gray) steps.push('-colorspace', 'Gray', '-colorspace', 'sRGB');
  steps.push('-strip', master);
  mg(steps);

  if (post.alpha) {
    // alpha = brightest channel; colour = original / alpha, so compositing over black reproduces the
    // original and compositing over anything else behaves like added light.
    const alphaFile = join(tmp, 'alpha.png');
    const colourFile = join(tmp, 'colour.png');
    mg([master, '-separate', '-evaluate-sequence', 'max', '-colorspace', 'Gray', alphaFile]);
    mg([master, alphaFile, '-fx', 'u/max(v,0.02)', '-clamp', colourFile]);
    mg([colourFile, alphaFile, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', '-strip', master]);
  }
}

function encodeWebp(master, out, maxBytes, hasAlpha, startQ) {
  let best = null;
  for (let q = startQ; q >= 40; q -= 2) {
    const args = [
      master,
      '-define',
      'webp:method=6',
      '-define',
      'webp:use-sharp-yuv=true',
      '-define',
      'webp:sns-strength=80',
      '-quality',
      String(q),
    ];
    if (hasAlpha) args.push('-define', 'webp:alpha-quality=92');
    args.push(out);
    mg(args);
    const size = statSync(out).size;
    if (size <= maxBytes) {
      best = { q, size };
      break;
    }
  }
  if (!best) throw new Error(`cannot fit ${out} under ${maxBytes} bytes`);
  return best;
}

/** Normalised DSSIM between two images (0 is identical, lower is better). */
function dssim(a, b) {
  const r = spawnSync('magick', ['compare', '-metric', 'DSSIM', a, b, 'null:'], { encoding: 'utf8' });
  const m = String(r.stderr).match(/\(([\d.eE+-]+)\)/);
  return m ? Number.parseFloat(m[1]) : Number.POSITIVE_INFINITY;
}

function encodeAvif(master, out, dssimTarget, tmp) {
  // Search from low quality upward: the first quality that is as good as the WebP is the smallest.
  for (let q = 36; q <= 92; q += 4) {
    const r = spawnSync('avifenc', ['-q', String(q), '-s', '4', '-j', '4', '--yuv', '444', master, out], {
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(`avifenc failed: ${r.stderr}`);
    const dec = join(tmp, 'avif-dec.png');
    mg([out, dec]);
    const d = dssim(master, dec);
    if (d <= dssimTarget) return { q, size: statSync(out).size, dssim: d };
  }
  return null;
}

function measure(master) {
  const { w, h } = dims(master);
  const k = Math.max(8, Math.round(Math.min(w, h) * 0.03));
  const corners = [
    `${k}x${k}+0+0`,
    `${k}x${k}+${w - k}+0`,
    `${k}x${k}+0+${h - k}`,
    `${k}x${k}+${w - k}+${h - k}`,
  ];
  let cornerMax = 0;
  for (const g of corners) {
    // Over black, so alpha pieces are measured as they will look on the page.
    const v = Number(
      mgText([
        master,
        '-background',
        'black',
        '-alpha',
        'remove',
        '-crop',
        g,
        '+repage',
        '-colorspace',
        'Gray',
        '-format',
        '%[fx:maxima*255]',
        'info:',
      ]),
    );
    cornerMax = Math.max(cornerMax, v);
  }
  // Outer 1 px ring (all four sides).
  const ring = Number(
    mgText([
      master,
      '-background',
      'black',
      '-alpha',
      'remove',
      '-colorspace',
      'Gray',
      '(',
      '+clone',
      '-crop',
      `${w}x1+0+0`,
      '+repage',
      ')',
      '(',
      '-clone',
      '0',
      '-crop',
      `${w}x1+0+${h - 1}`,
      '+repage',
      ')',
      '(',
      '-clone',
      '0',
      '-crop',
      `1x${h}+0+0`,
      '+repage',
      '-rotate',
      '90',
      ')',
      '(',
      '-clone',
      '0',
      '-crop',
      `1x${h}+${w - 1}+0`,
      '+repage',
      '-rotate',
      '90',
      ')',
      '-delete',
      '0',
      '-append',
      '-format',
      '%[fx:maxima*255]',
      'info:',
    ]),
  );
  const avg = mgText([
    master,
    '-background',
    'black',
    '-alpha',
    'remove',
    '-resize',
    '1x1!',
    '-depth',
    '8',
    '-format',
    '#%[hex:u.p{0,0}]',
    'info:',
  ]).toLowerCase();
  // Bounding box of everything brighter than 12 percent luminance, as fractions of the frame:
  // the safe area for cropping and positioning.
  const trim = mgText([
    master,
    '-background',
    'black',
    '-alpha',
    'remove',
    '-colorspace',
    'Gray',
    '-threshold',
    '12%',
    '-format',
    '%@',
    'info:',
  ]);
  const t = trim.match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/);
  const f2 = (v) => Math.round(v * 100) / 100;
  const box = t
    ? [
        f2(Number(t[3]) / w),
        f2(Number(t[4]) / h),
        f2((Number(t[3]) + Number(t[1])) / w),
        f2((Number(t[4]) + Number(t[2])) / h),
      ]
    : [0, 0, 1, 1];
  return { cornerMax, ring, avg: avg.slice(0, 7), box };
}

/**
 * Contact sheets of the shipped files, composited the way the UI uses them (on a dark panel colour), so the
 * set can be judged as a family. One sheet per group of related pieces.
 */
function buildSheets() {
  const m = JSON.parse(readFileSync(manifestJson, 'utf8'));
  const dir = join(repoRoot, 'assets-src', '_work');
  mkdirSync(dir, { recursive: true });
  const sheets = [
    {
      name: 'contact-sheet-emblems.png',
      pick: (a) => ['tracks', 'modules', 'labs'].includes(a.group),
      cols: 6,
      tile: 300,
    },
    { name: 'contact-sheet-medals.png', pick: (a) => a.group === 'medals', cols: 6, tile: 300 },
    {
      name: 'contact-sheet-atmosphere.png',
      pick: (a) => a.group === 'atmosphere' || a.id === 'certificate-backdrop',
      cols: 3,
      tile: 560,
    },
  ];
  for (const sheet of sheets) {
    const items = m.art.filter(sheet.pick);
    if (items.length === 0) continue;
    const args = ['montage', '-background', '#0b0e14', '-fill', '#9aa7c0', '-pointsize', '15'];
    for (const a of items) {
      args.push('-label', a.id, join(webRoot, 'public', a.src));
    }
    args.push(
      '-tile',
      `${sheet.cols}x`,
      '-geometry',
      `${sheet.tile}x${sheet.tile}+6+6`,
      '-background',
      '#0b0e14',
      join(dir, sheet.name),
    );
    mg(args);
    console.log(`wrote assets-src/_work/${sheet.name} (${items.length} pieces)`);
  }
}

const o = parseArgs(process.argv.slice(2));

if (o.sheet) {
  buildSheets();
  process.exit(0);
}

if (o.report) {
  const m = JSON.parse(readFileSync(manifestJson, 'utf8'));
  console.table(
    m.art.map((a) => ({
      id: a.id,
      size: `${a.width}x${a.height}`,
      webpKB: a.webpKB,
      avifKB: a.avifKB,
      corner: a.cornerMax,
      ring: a.ringMax,
    })),
  );
  const total = m.art.reduce((s, a) => s + a.webpKB, 0);
  console.log(`total webp ${total.toFixed(0)} KB over ${m.art.length} pieces`);
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'flux-academy-art-'));
const previous = existsSync(manifestJson) ? JSON.parse(readFileSync(manifestJson, 'utf8')).art : [];
const byId = new Map(previous.map((a) => [a.id, a]));

if (o.meta) {
  // Text and flags only: the files on disk are untouched.
  for (const piece of PIECES) {
    const e = byId.get(piece.id);
    if (!e) continue;
    e.alt = piece.alt;
    if (piece.desc) e.desc = piece.desc;
    else delete e.desc;
    if (piece.decorative) e.decorative = true;
    else delete e.decorative;
    e.blend = piece.blend;
    e.accent = piece.accent;
    e.group = piece.group;
  }
  const ordered = PIECES.map((p) => byId.get(p.id)).filter(Boolean);
  writeFileSync(manifestJson, `${JSON.stringify({ art: ordered.filter((a) => a.shipped) }, null, 2)}\n`);
  const r = writeArtManifest();
  console.log(`metadata refreshed: ${r.art} art entries`);
  rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
}

try {
  for (const piece of PIECES) {
    if (o.only && !o.only.includes(piece.id)) continue;
    const raw = join(rawDir, `${piece.id}.png`);
    if (!existsSync(raw)) {
      console.log(`skip  ${piece.id} (no raw)`);
      continue;
    }
    const master = join(tmp, `${piece.id}.png`);
    buildMaster(piece, raw, master, tmp);
    const hasAlpha = !!piece.post?.alpha;
    const isSprite = piece.id.startsWith('sprite-');
    const maxBytes = (piece.maxKB ?? (isSprite ? 60 : DEFAULT_MAX_KB)) * 1024;
    const shipped = piece.ship !== false;
    const webpOut = shipped ? join(outDir, `${piece.id}.webp`) : join(srcOnlyDir, `${piece.id}.webp`);
    const webp = encodeWebp(master, webpOut, maxBytes, hasAlpha, piece.post?.webpQ ?? WEBP_START_Q);

    let avifInfo = null;
    const avifOut = join(outDir, `${piece.id}.avif`);
    if (o.avif && shipped) {
      const webpPng = join(tmp, 'webp-dec.png');
      mg([webpOut, webpPng]);
      avifInfo = encodeAvif(master, avifOut, dssim(master, webpPng), tmp);
      if (!avifInfo || avifInfo.size > webp.size * AVIF_MIN_SAVING || avifInfo.size > maxBytes) {
        rmSync(avifOut, { force: true });
        avifInfo = null;
      }
    } else if (shipped) {
      rmSync(avifOut, { force: true });
    }

    const m = measure(master);
    const entry = {
      id: piece.id,
      group: piece.group,
      src: `/art/${piece.id}.webp`,
      ...(avifInfo ? { avif: `/art/${piece.id}.avif` } : {}),
      width: piece.w,
      height: piece.h,
      avg: m.avg,
      box: m.box,
      ...(hasAlpha ? { alpha: true } : {}),
      ...(isSprite ? { sprite: hasAlpha ? 'alpha' : 'additive' } : {}),
      alt: piece.alt,
      ...(piece.desc ? { desc: piece.desc } : {}),
      ...(piece.decorative ? { decorative: true } : {}),
      blend: piece.blend,
      accent: piece.accent,
      webpKB: Number((webp.size / 1024).toFixed(1)),
      webpQ: webp.q,
      ...(avifInfo ? { avifKB: Number((avifInfo.size / 1024).toFixed(1)), avifQ: avifInfo.q } : {}),
      cornerMax: m.cornerMax,
      ringMax: m.ring,
      shipped,
    };
    byId.set(piece.id, entry);
    console.log(
      `ok    ${piece.id.padEnd(26)} ${`${piece.w}x${piece.h}`.padEnd(9)} webp ${String(entry.webpKB).padStart(6)} KB (q${webp.q})` +
        `${avifInfo ? `  avif ${String(entry.avifKB).padStart(6)} KB (q${avifInfo.q})` : '  no avif          '}  corner<=${m.cornerMax} ring<=${m.ring}  avg ${m.avg}`,
    );
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// Keep manifest order identical to the spec; build inputs (the OG backdrop) are not site art.
const ordered = PIECES.map((p) => byId.get(p.id)).filter(Boolean);
writeFileSync(manifestJson, `${JSON.stringify({ art: ordered.filter((a) => a.shipped) }, null, 2)}\n`);
const r = writeArtManifest();
console.log(`\nart.ts updated: ${r.art} art entries`);
