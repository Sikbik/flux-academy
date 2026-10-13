#!/usr/bin/env node
// Visual smoke test for things the unit tests cannot see because they are painted, not computed. Today:
// the odometers. A number can be right in the DOM and wrong on screen (a text clip that ignores the strip's
// transform paints every digit as "0"; a text clip on a tall element drops glyphs in Firefox).
//
//   node scripts/visual-smoke.mjs --base http://127.0.0.1:5180
//   node scripts/visual-smoke.mjs --base http://127.0.0.1:4180 --engine firefox
//
// Per engine it opens the home page and checks, for every odometer once it has settled:
//   1. the digits its strips are resting on spell the number the page speaks (the sr-only text);
//   2. for the gradient count in the headline, the painted glyphs match the same number painted as plain
//      white text (intersection over union of the bright pixels, at least 0.85).
// Chromium is looked up like the other scripts (CHROME_PATH or a system install). Firefox is Playwright's
// own build and is skipped, with a note, when it is not installed (`npx playwright-core install firefox`).
//
// Options
//   --base <url>       origin of a running dev or production server (default http://127.0.0.1:5180)
//   --engine <name>    chromium, firefox or all (default all)
//   --mobile           390x844 at dpr 2 with touch (default 1440x900)
//
// Exit code is 1 when any check fails.
import { existsSync } from 'node:fs';
import { chromium, firefox } from 'playwright-core';

function parse(argv) {
  const o = { base: 'http://127.0.0.1:5180', engine: 'all', mobile: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--base') o.base = next().replace(/\/$/, '');
    else if (a === '--engine') o.engine = next();
    else if (a === '--mobile') o.mobile = true;
    else {
      console.error(`unknown option ${a}`);
      process.exit(2);
    }
  }
  if (!['all', 'chromium', 'firefox'].includes(o.engine)) {
    console.error(`unknown engine ${o.engine}`);
    process.exit(2);
  }
  return o;
}

const o = parse(process.argv.slice(2));
const viewport = o.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const IOU_MIN = 0.85;

function findChrome() {
  return [
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ]
    .filter(Boolean)
    .find((p) => existsSync(p));
}

async function launch(engine) {
  if (engine === 'chromium') {
    const executablePath = findChrome();
    if (!executablePath) return { skipped: 'no Chromium found; set CHROME_PATH' };
    return {
      browser: await chromium.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
      }),
    };
  }
  if (!existsSync(firefox.executablePath())) {
    return { skipped: 'Firefox is not installed (npx playwright-core install firefox)' };
  }
  return { browser: await firefox.launch({ headless: true }) };
}

/** Runs in the page: what each settled odometer shows against what it speaks. */
function readOdometers() {
  const out = [];
  for (const odo of document.querySelectorAll('[data-odometer]')) {
    // Not painted at this size (the site header hides its node counter on a phone): nothing to check, and its
    // strips have no layout to read a resting digit from.
    if (odo.getClientRects().length === 0) continue;
    if (odo.getAnimations({ subtree: true }).length > 0) {
      out.push({ settled: false });
      continue;
    }
    const spoken = odo.querySelector('.sr-only')?.textContent ?? '';
    let shown = '';
    const visual = odo.querySelector('[aria-hidden="true"]:not([class*="glow"])');
    for (const piece of visual?.querySelectorAll('[data-piece]') ?? []) {
      const strip = piece.firstElementChild;
      if (strip && piece.children.length === 1 && getComputedStyle(strip).transform !== 'none') {
        const m = new DOMMatrixReadOnly(getComputedStyle(strip).transform);
        const row = -m.m42 / (Number.parseFloat(getComputedStyle(strip).fontSize) || 16);
        shown += String(((Math.round(row) % 10) + 10) % 10);
      } else {
        shown += piece.textContent ?? '';
      }
    }
    out.push({ settled: true, spoken, shown, gradient: odo.dataset.gradient === 'true' });
  }
  return out;
}

/** Runs in the page: how much of the lit pixels of two images coincide. */
async function maskOverlap({ a, b, threshold }) {
  const load = (src) =>
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const w = Math.min(ia.width, ib.width);
  const h = Math.min(ia.height, ib.height);
  const read = (img) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, w, h).data;
  };
  const da = read(ia);
  const db = read(ib);
  let inter = 0;
  let union = 0;
  for (let i = 0; i < da.length; i += 4) {
    const la = da[i] * 0.2126 + da[i + 1] * 0.7152 + da[i + 2] * 0.0722 > threshold;
    const lb = db[i] * 0.2126 + db[i + 1] * 0.7152 + db[i + 2] * 0.0722 > threshold;
    if (la && lb) inter++;
    if (la || lb) union++;
  }
  return { iou: union ? inter / union : 1, ink: union };
}

async function runEngine(engine) {
  const { browser, skipped } = await launch(engine);
  if (!browser) return [{ name: `${engine}`, status: 'skip', detail: skipped }];
  const rows = [];
  try {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: o.mobile ? 2 : 1,
      isMobile: o.mobile && engine === 'chromium',
      hasTouch: o.mobile && engine === 'chromium',
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto(`${o.base}/?intro=0`, { waitUntil: 'load' });
    await page.waitForSelector('[data-odometer][data-gradient="true"]', { timeout: 20000 });
    // Settled: every odometer has stopped rolling. Counters that tick (the block height) may roll once
    // more, so poll for a quiet reading rather than assuming one.
    let readings = [];
    for (let i = 0; i < 40; i++) {
      readings = await page.evaluate(readOdometers);
      if (readings.length > 0 && readings.every((r) => r.settled)) break;
      await page.waitForTimeout(250);
    }

    if (readings.length === 0 || !readings.every((r) => r.settled)) {
      rows.push({ name: `${engine}: odometers settle`, status: 'FAIL', detail: 'still rolling after 10 s' });
    } else {
      for (const r of readings) {
        const ok = r.shown === r.spoken;
        rows.push({
          name: `${engine}: digits spell "${r.spoken}"`,
          status: ok ? 'ok' : 'FAIL',
          detail: ok ? '' : `strips rest on "${r.shown}"`,
        });
      }
    }

    // The headline count: painted gradient against painted plain text.
    const target = page.locator('[data-odometer][data-gradient="true"]').first();
    await target.evaluate((el) => {
      el.style.background = '#000';
      el.querySelector('[class*="glow"]')?.remove();
      el.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(200);
    // A clip of the page, not an element screenshot: that one waits for the box to hold still, and the
    // headline's words keep a transform on them.
    const box = await target.boundingBox();
    if (!box) throw new Error('the gradient count has no box');
    const clip = {
      x: Math.max(0, box.x - 4),
      y: Math.max(0, box.y - 4),
      width: box.width + 8,
      height: box.height + 8,
    };
    const withGradient = (await page.screenshot({ clip })).toString('base64');
    await target.evaluate((el) => {
      el.removeAttribute('data-gradient');
      el.style.color = '#fff';
    });
    await page.waitForTimeout(200);
    const plain = (await page.screenshot({ clip })).toString('base64');
    const { iou, ink } = await page.evaluate(maskOverlap, {
      a: `data:image/png;base64,${withGradient}`,
      b: `data:image/png;base64,${plain}`,
      threshold: 48,
    });
    const painted = ink > 200 && iou >= IOU_MIN;
    rows.push({
      name: `${engine}: gradient count paints its own digits`,
      status: painted ? 'ok' : 'FAIL',
      detail: `overlap ${iou.toFixed(2)} (needs ${IOU_MIN}), ${ink} lit pixels`,
    });
  } catch (err) {
    rows.push({ name: `${engine}: run`, status: 'FAIL', detail: String(err?.message ?? err).split('\n')[0] });
  } finally {
    await browser.close();
  }
  return rows;
}

const engines = o.engine === 'all' ? ['chromium', 'firefox'] : [o.engine];
let failed = false;
for (const engine of engines) {
  for (const r of await runEngine(engine)) {
    if (r.status === 'FAIL') failed = true;
    console.log(`${r.status.padEnd(4)} ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
  }
}
process.exit(failed ? 1 : 0);
