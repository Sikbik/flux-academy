#!/usr/bin/env node
// Performance budget check for a production build (docs/DESIGN.md section 10).
//
//   npm run build && node scripts/check-budgets.mjs                          # static: sizes from dist/
//   node scripts/check-budgets.mjs --base http://127.0.0.1:42069             # + JS fetched per route
//   node scripts/check-budgets.mjs --base http://127.0.0.1:42069 --vitals    # + FCP, LCP, CLS, throttled
//
// Static part: gzip size of what index.html pulls in (the entry's static module graph), the hero scene
// chunk, the lesson chunk, the fonts a page can request, and the art. Dynamic part (--base): opens each
// route in headless Chromium and sums what it fetched before the first interaction (transfer size as the
// server sent it), and with --vitals measures FCP, LCP and CLS under CDP throttling (9 Mbps, 170 ms RTT,
// 2x CPU slowdown: "fast 4G, mid laptop"). Vitals are noisy on a busy machine, so they are reported with
// the budget but only fail the run with --strict-vitals.
//
// Exit code 1 when a size budget is exceeded. INP and frame rate are not measured here.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : (argv[i + 1] ?? fallback);
};
const dist = resolve(opt('--dist', resolve(here, '../dist')));
const base = opt('--base');
const vitals = flag('--vitals');
const strictVitals = flag('--strict-vitals');

const KB = 1000;
// Ceilings, not wishes: each is a little above what the build measured on 2026-10-13 so a regression shows
// up. docs/DESIGN.md section 10 explains the numbers (React DOM and the router are about 86 KB of the
// initial 160 KB).
const BUDGET = {
  initialJs: 165 * KB, // entry + vendor + runtime + HTML, gzip
  heroChunk: 220 * KB, // three.js subset + scene, lazy
  lessonRoute: 76 * KB, // the lesson player chunk, stages and widgets excluded
  fontsPerPage: 150 * KB,
  artFile: 120 * KB,
  artTotal: 1400 * KB,
  lcp: 2000,
  cls: 0.02,
};
// JS fetched before the first interaction, excluding the hero scene chunk (transfer size, brotli).
const ROUTES = [
  { path: '/', js: 230 * KB },
  { path: '/learn', js: 185 * KB },
  { path: '/learn/first-deploy', js: 335 * KB },
  // The index is its own route (routes/reference); the topic pages are another (routes/reference-topic) and
  // carry the four older pages, so one of them stands for those and the two newer ones have their own line.
  { path: '/reference', js: 270 * KB },
  { path: '/reference/spec', js: 340 * KB },
  { path: '/reference/orbit', js: 365 * KB },
  { path: '/reference/agents', js: 362 * KB },
  { path: '/labs/spec-forge', js: 360 * KB },
  // Holds the validator's lines out of the first load (debrief-lint.ts is imported when a session ends).
  { path: '/labs/agent-desk', js: 250 * KB },
];

if (!existsSync(join(dist, 'index.html'))) {
  console.error(`no build at ${dist}; run \`npm run build\` first`);
  process.exit(2);
}

const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const kb = (n) => `${(n / KB).toFixed(1)} KB`;
const rows = [];
let failed = false;
function check(name, value, budget, note = '') {
  const ok = value <= budget;
  if (!ok) failed = true;
  rows.push(
    `${ok ? 'ok  ' : 'OVER'} ${name.padEnd(46)} ${kb(value).padStart(10)}  budget ${kb(budget).padStart(9)} ${note}`,
  );
}

// ---- static: what index.html pulls in ------------------------------------------------------------------
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = (re) => [...html.matchAll(re)].map((m) => m[1]);
const scripts = refs(/<script[^>]+type="module"[^>]+src="([^"]+)"/g);
const preloads = refs(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g);
const styles = refs(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g);
const abs = (p) => join(dist, p.replace(/^\//, ''));

const initial = [...new Set([...scripts, ...preloads])].filter((p) => existsSync(abs(p)));
const initialGz = initial.reduce((n, p) => n + gz(abs(p)), 0) + gzipSync(Buffer.from(html)).length;
check('Initial JS + HTML (gzip)', initialGz, BUDGET.initialJs, `(${initial.length} files)`);
const cssGz = styles.filter((p) => existsSync(abs(p))).reduce((n, p) => n + gz(abs(p)), 0);
rows.push(`info Stylesheets in index.html (gzip)${' '.repeat(12)} ${kb(cssGz).padStart(10)}`);

// ---- static: chunks, fonts, art -----------------------------------------------------------------------
const assets = join(dist, 'assets');
const files = existsSync(assets) ? readdirSync(assets) : [];
const js = files
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ f, gz: gz(join(assets, f)) }))
  .sort((a, b) => b.gz - a.gz);
const hero = js.find((c) => /^engine-/.test(c.f) && c.gz > 100 * KB);
if (hero) check(`Hero scene chunk ${hero.f}`, hero.gz, BUDGET.heroChunk);
const lesson = js.find((c) => /^lesson-/.test(c.f));
if (lesson) check(`Lesson route chunk ${lesson.f}`, lesson.gz, BUDGET.lessonRoute);

// A page requests only the faces its CSS uses, so the budget is the largest set a route really loads
// (measured with --base); statically we can only report what is shipped.
const fonts = files.filter((f) => /\.(woff2?|ttf|otf)$/.test(f));
const fontBytes = fonts.reduce((n, f) => n + statSync(join(assets, f)).size, 0);
rows.push(`info Font files shipped: ${fonts.length}, ${kb(fontBytes)} (a page loads the faces it uses)`);

const artDir = join(dist, 'art');
if (existsSync(artDir)) {
  const art = readdirSync(artDir).filter((f) => /\.(webp|avif)$/.test(f));
  // A visitor gets one format per image (AVIF where supported), so count the larger of each pair.
  const bySize = new Map();
  for (const f of art) {
    const stem = f.replace(/\.(webp|avif)$/, '');
    bySize.set(stem, Math.max(bySize.get(stem) ?? 0, statSync(join(artDir, f)).size));
  }
  const biggest = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0];
  if (biggest) check(`Largest art file (${biggest[0]})`, biggest[1], BUDGET.artFile);
  check(
    'Art total (one format per image)',
    [...bySize.values()].reduce((n, v) => n + v, 0),
    BUDGET.artTotal,
  );
}

rows.push('');
rows.push('Largest JS chunks (gzip):');
for (const c of js.slice(0, 8)) rows.push(`     ${kb(c.gz).padStart(10)}  ${c.f}`);
console.log(rows.join('\n'));

// ---- dynamic: what routes really load, and how fast ---------------------------------------------------
if (base) {
  const { chromium } = await import('playwright-core');
  const chrome = [
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ]
    .filter(Boolean)
    .find((p) => existsSync(p));
  if (!chrome) {
    console.error('no Chromium found; set CHROME_PATH');
    process.exit(2);
  }
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=gl',
      '--ignore-gpu-blocklist',
    ],
  });
  console.log(`\nPer route, ${vitals ? 'throttled to fast 4G with a 2x CPU slowdown' : 'unthrottled'}:`);
  const origin = new URL(base).origin;
  for (const r of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    const page = await ctx.newPage();
    if (vitals) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 170,
        downloadThroughput: (9 * 1000 * 1000) / 8,
        uploadThroughput: (1.5 * 1000 * 1000) / 8,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
      await page.addInitScript(() => {
        const v = { lcp: 0, cls: 0, fcp: 0 };
        window.__v = v;
        const watch = (type, fn) =>
          new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true });
        watch('largest-contentful-paint', (e) => {
          v.lcp = e.startTime;
        });
        watch('layout-shift', (e) => {
          if (!e.hadRecentInput) v.cls += e.value;
        });
        watch('paint', (e) => {
          if (e.name === 'first-contentful-paint') v.fcp = e.startTime;
        });
      });
    }
    const sizes = new Map();
    page.on('response', async (res) => {
      try {
        const u = new URL(res.url());
        if (u.origin !== origin) return;
        const h = await res.allHeaders();
        const len = Number(h['content-length'] ?? 0) || (await res.body()).length;
        sizes.set(u.pathname, { len, kind: u.pathname.split('.').pop() });
      } catch {
        // a request cancelled by navigation
      }
    });
    await page.goto(`${base}${r.path}?intro=0`, { waitUntil: 'load', timeout: 90_000 });
    await page.waitForTimeout(vitals ? 4500 : 3000);
    let jsBytes = 0;
    let heroBytes = 0;
    let fontBytes2 = 0;
    for (const [p, s] of sizes) {
      if (s.kind === 'js') {
        if (/\/engine-[^/]+\.js$/.test(p) && s.len > 50 * KB) heroBytes += s.len;
        else jsBytes += s.len;
      } else if (/woff2?$/.test(s.kind)) fontBytes2 += s.len;
    }
    const jsOver = jsBytes > r.js;
    const fontOver = fontBytes2 > BUDGET.fontsPerPage;
    if (jsOver || fontOver) failed = true;
    let line =
      `${jsOver || fontOver ? 'OVER' : 'ok  '} ${r.path.padEnd(20)} js ${kb(jsBytes).padStart(9)}` +
      ` (budget ${kb(r.js)}, hero ${kb(heroBytes)})  fonts ${kb(fontBytes2)}`;
    if (vitals) {
      const v = await page.evaluate(() => window.__v);
      const slow = v.lcp > BUDGET.lcp || v.cls > BUDGET.cls;
      if (slow && strictVitals) failed = true;
      line += `  FCP ${Math.round(v.fcp)} ms  LCP ${Math.round(v.lcp)} ms${v.lcp > BUDGET.lcp ? ' (over 2000)' : ''}  CLS ${v.cls.toFixed(3)}`;
    }
    console.log(line);
    await ctx.close();
  }
  await browser.close();
}

process.exit(failed ? 1 : 0);
