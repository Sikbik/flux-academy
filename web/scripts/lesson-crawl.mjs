#!/usr/bin/env node
// End-to-end lesson crawler. Opens each lesson in the real player and walks it to the completion screen
// using the learner's own help ladder (Continue, else Hint then Show me, else Skip). It reports console
// errors, page errors, failed same-origin requests, horizontal overflow and whether the lesson completed.
// It is a smoke test for the integration of content, stages, widgets and diagrams: it does not judge
// whether an answer is pedagogically right (the content validator does that).
//
//   node scripts/lesson-crawl.mjs --base http://127.0.0.1:5180
//   node scripts/lesson-crawl.mjs --base http://127.0.0.1:5180 --only first-deploy,minecraft-server --mobile
//
// Options
//   --base <url>      origin of a running dev or production server (default http://127.0.0.1:5180)
//   --only <a,b>      lesson ids to crawl (default: every lesson in shared/curriculum.ts)
//   --mobile          390x844 at dpr 2 with touch (default 1440x900)
//   --shots <dir>     save the completion screen and any failing step as PNGs here
//   --max-steps <n>   give up on a lesson after n actions (default 400)
//   --live            do not add ?demo=1 (use the real API)
//   --verbose         print every action and step change
//
// Exit code is 1 when any lesson did not complete or logged errors.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));

function parse(argv) {
  const o = {
    base: 'http://127.0.0.1:5180',
    only: null,
    mobile: false,
    shots: null,
    maxSteps: 400,
    live: false,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--base') o.base = next().replace(/\/$/, '');
    else if (a === '--only') o.only = next().split(',').filter(Boolean);
    else if (a === '--mobile') o.mobile = true;
    else if (a === '--shots') o.shots = resolve(next());
    else if (a === '--max-steps') o.maxSteps = Number(next());
    else if (a === '--live') o.live = true;
    else if (a === '--verbose') o.verbose = true;
    else {
      console.error(`unknown option ${a}`);
      process.exit(2);
    }
  }
  return o;
}

/** Lesson ids in curriculum order, read from the TypeScript source without importing it. */
function lessonIds() {
  const src = readFileSync(resolve(here, '../../shared/curriculum.ts'), 'utf8');
  const from = src.indexOf('export const LESSONS');
  const to = src.indexOf('export const LABS');
  const block = src.slice(from, to > from ? to : undefined);
  const ids = [];
  for (const m of block.matchAll(/^\s{4}id: '([a-z0-9-]+)',/gm)) ids.push(m[1]);
  return [...new Set(ids)];
}

function findChrome() {
  return [
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ]
    .filter(Boolean)
    .find((p) => existsSync(p));
}

const o = parse(process.argv.slice(2));
const ids = o.only ?? lessonIds();
const executablePath = findChrome();
if (!executablePath) {
  console.error('no Chromium found; set CHROME_PATH');
  process.exit(2);
}
if (o.shots) mkdirSync(o.shots, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--use-gl=angle',
    '--use-angle=gl',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
});

const results = [];
const log = (...a) => {
  if (o.verbose) console.log('   ', ...a);
};

for (const id of ids) {
  const context = await browser.newContext({
    viewport: o.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: o.mobile ? 2 : 1,
    isMobile: o.mobile,
    hasTouch: o.mobile,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      problems.push(`[console.${m.type()}] ${m.text().slice(0, 240)}`);
  });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${String(e.message).slice(0, 240)}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(o.base) && !r.url().includes('/api/')) {
      problems.push(`[http ${r.status()}] ${r.url()}`);
    }
  });

  const started = Date.now();
  const res = {
    id,
    completed: false,
    actions: 0,
    stuckAt: null,
    overflow: false,
    problems,
    ms: 0,
    ladder: { show: 0, skip: 0, hint: 0, confirm: 0 },
  };
  const url = `${o.base}/learn/${id}?intro=0${o.live ? '' : '&demo=1'}`;

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(800);
    // A fresh browser context starts with empty progress, so completion shows up in localStorage.
    const done = async () =>
      page.evaluate((lessonId) => {
        try {
          const raw = localStorage.getItem('flux-academy:v2:learner');
          if (!raw) return false;
          return Boolean(JSON.parse(raw)?.lessons?.[lessonId]?.completedAt);
        } catch {
          return false;
        }
      }, id);

    const cont = page.getByRole('button', { name: /^(Continue|Start the checkpoint|Finish the lesson)/ });
    let lastSig = '';
    let sameSince = Date.now();
    const tickedOnce = new Set();

    for (let i = 0; i < o.maxSteps; i++) {
      if (await done()) {
        res.completed = true;
        break;
      }
      res.actions = i;
      // A signature of where we are, to notice a stall.
      const sig = await page.evaluate(() => location.search);
      if (sig !== lastSig) {
        lastSig = sig;
        sameSince = Date.now();
        log(`step ${sig.replace('?intro=0&demo=1', '')}`);
      }
      // "Show me" appears after 25 s without progress (STUCK_AFTER_MS in learn/player.ts), so allow 50 s.
      if (Date.now() - sameSince > 50_000) {
        res.stuckAt = sig.slice(0, 120);
        break;
      }

      const contEnabled =
        (await cont.count()) > 0 &&
        (await cont.first().getAttribute('aria-disabled')) !== 'true' &&
        (await cont.first().isEnabled());
      if (contEnabled) {
        log('continue');
        await cont
          .first()
          .click({ timeout: 5000 })
          .catch(() => {});
        sameSince = Date.now();
        await page.waitForTimeout(350);
        continue;
      }

      // A "confirm" task is a checkbox ("I hovered a node of each tier"). Tick each one once per step.
      const boxes = page.getByRole('checkbox');
      const nBoxes = await boxes.count();
      let ticked = false;
      for (let b = 0; b < nBoxes && !ticked; b++) {
        const key = `${sig}|box:${b}`;
        if (tickedOnce.has(key)) continue;
        const box = boxes.nth(b);
        if (await box.isChecked().catch(() => true)) continue;
        tickedOnce.add(key);
        // The input is visually hidden behind a styled label, so a pointer click is "obscured".
        await box.evaluate((el) => el.click()).catch(() => {});
        res.ladder.confirm++;
        log('confirm');
        ticked = true;
      }
      if (ticked) {
        sameSince = Date.now();
        await page.waitForTimeout(400);
        continue;
      }

      // Blocked by a task: use the help ladder.
      const show = page.getByRole('button', { name: /^Show me/ }).first();
      const hint = page.getByRole('button', { name: /^Hint/ }).first();
      const skip = page.getByRole('button', { name: /^Skip/ }).first();
      if ((await show.count()) > 0 && (await show.isVisible().catch(() => false))) {
        await show.click({ timeout: 5000 }).catch(() => {});
        res.ladder.show++;
        log('show me');
        sameSince = Date.now();
        // The stage performs the task (a terminal types, a form fills); give it time.
        await page.waitForTimeout(1500);
        for (let w = 0; w < 24; w++) {
          const ok =
            (await cont.count()) > 0 && (await cont.first().getAttribute('aria-disabled')) !== 'true';
          if (ok || (await done())) break;
          await page.waitForTimeout(500);
        }
        continue;
      }
      if (
        (await hint.count()) > 0 &&
        (await hint.isVisible().catch(() => false)) &&
        (await hint.isEnabled().catch(() => false))
      ) {
        await hint.click({ timeout: 5000 }).catch(() => {});
        res.ladder.hint++;
        log('hint');
        sameSince = Date.now();
        await page.waitForTimeout(400);
        continue;
      }
      if ((await skip.count()) > 0 && (await skip.isVisible().catch(() => false))) {
        await skip.click({ timeout: 5000 }).catch(() => {});
        res.ladder.skip++;
        log('skip');
        sameSince = Date.now();
        await page.waitForTimeout(400);
        continue;
      }
      // Nothing to press yet. The player offers "Show me" after 25 s without progress (STUCK_AFTER_MS in
      // learn/player.ts), so waiting in real time is the faithful way to reach it.
      await page.waitForTimeout(1000);
    }

    if (await done()) res.completed = true;
    res.endedAt = await page.evaluate(() => location.search);

    res.overflow = await page.evaluate(
      () => document.scrollingElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    if (o.shots) {
      await page.screenshot({
        path: resolve(o.shots, `${id}${o.mobile ? '-m' : ''}-${res.completed ? 'done' : 'STUCK'}.png`),
        fullPage: false,
      });
    }
  } catch (e) {
    problems.push(`[crawler] ${String(e.message).slice(0, 240)}`);
  }
  res.ms = Date.now() - started;
  results.push(res);
  const flag = res.completed && problems.length === 0 && !res.overflow ? 'ok  ' : 'FAIL';
  console.log(
    `${flag} ${id.padEnd(24)} ${res.completed ? 'completed' : 'NOT COMPLETED'}  actions=${res.actions} ` +
      `confirm=${res.ladder.confirm} show=${res.ladder.show} hint=${res.ladder.hint} skip=${res.ladder.skip} ${Math.round(res.ms / 1000)}s` +
      `${res.overflow ? '  OVERFLOW' : ''}${res.completed ? '' : `  ended at ${res.endedAt}`}`,
  );
  for (const p of problems.slice(0, 6)) console.log(`       ${p}`);
  await context.close();
}

await browser.close();
const bad = results.filter((r) => !r.completed || r.problems.length > 0 || r.overflow);
console.log(`\n${results.length - bad.length} of ${results.length} lessons clean`);
process.exit(bad.length > 0 ? 1 : 0);
