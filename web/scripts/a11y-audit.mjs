#!/usr/bin/env node
// Automated accessibility audit with axe-core over the app's main routes and a few open-overlay states.
// It reports violations (and, with --incomplete, the checks axe could not decide). It does not replace
// keyboard and screen reader testing; it catches the mechanical failures (names, roles, contrast, ids).
//
//   AXE_PATH=/path/to/axe.min.js node scripts/a11y-audit.mjs --base http://127.0.0.1:5180
//   node scripts/a11y-audit.mjs --base http://127.0.0.1:5180 --mobile --only /,/learn
//
// axe-core is resolved from AXE_PATH, else web/node_modules/axe-core/axe.min.js (a devDependency of web/).
//
// Options
//   --base <url>      origin of a running dev or production server (default http://127.0.0.1:5180)
//   --only <a,b>      only these paths (exact match against the list below)
//   --mobile          390x844 at dpr 2 with touch (default 1440x900)
//   --incomplete      also print "needs review" results
//   --best-practice   include axe's best-practice rules (default: WCAG 2.0 to 2.2 A and AA only)
//
// Exit code is 1 when any violation is found.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));

const ROUTES = [
  { path: '/' },
  { path: '/learn' },
  { path: '/learn/what-is-flux?step=tiers' },
  { path: '/learn/first-deploy?step=spec' },
  { path: '/learn/first-deploy?step=register' },
  { path: '/learn/containers-101?step=build' },
  { path: '/learn/production-checklist' },
  { path: '/learn/deploy-from-git?step=plans' },
  { path: '/learn/deploy-from-git?step=button' },
  { path: '/learn/ai-assisted-deploy?step=read-it' },
  { path: '/learn/agents-and-mcp?step=first-session' },
  { path: '/learn/agents-and-mcp?step=orbit' },
  { path: '/labs' },
  { path: '/labs/spec-forge' },
  { path: '/labs/network' },
  { path: '/labs/failover' },
  { path: '/labs/explorer' },
  { path: '/labs/terminal' },
  { path: '/labs/agent-desk' },
  { path: '/reference' },
  { path: '/reference/spec' },
  { path: '/reference/networking' },
  { path: '/reference/docker' },
  { path: '/reference/api' },
  { path: '/reference/orbit' },
  { path: '/reference/agents' },
  { path: '/glossary' },
  { path: '/troubleshoot' },
  { path: '/profile' },
  { path: '/nope', label: '/nope (404)' },
  { path: '/', label: '/ with the command deck open', keys: ['Control+K'] },
  { path: '/learn', label: '/learn with the shortcuts sheet open', keys: ['?'] },
];

function parse(argv) {
  const o = {
    base: 'http://127.0.0.1:5180',
    only: null,
    mobile: false,
    incomplete: false,
    bestPractice: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--base') o.base = next().replace(/\/$/, '');
    else if (a === '--only') o.only = next().split(',').filter(Boolean);
    else if (a === '--mobile') o.mobile = true;
    else if (a === '--incomplete') o.incomplete = true;
    else if (a === '--best-practice') o.bestPractice = true;
    else {
      console.error(`unknown option ${a}`);
      process.exit(2);
    }
  }
  return o;
}

const o = parse(process.argv.slice(2));
const axePath = [process.env.AXE_PATH, resolve(here, '../node_modules/axe-core/axe.min.js')]
  .filter(Boolean)
  .find((p) => existsSync(p));
if (!axePath) {
  console.error('axe-core not found: run `npm --prefix web ci` or set AXE_PATH');
  process.exit(2);
}
const axeSource = readFileSync(axePath, 'utf8');
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
    '--hide-scrollbars',
    '--use-gl=angle',
    '--use-angle=gl',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
});

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
if (o.bestPractice) tags.push('best-practice');

let total = 0;
const rows = ROUTES.filter((r) => !o.only || o.only.includes(r.path));
for (const r of rows) {
  const context = await browser.newContext({
    viewport: o.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: o.mobile ? 2 : 1,
    isMobile: o.mobile,
    hasTouch: o.mobile,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const label = r.label ?? r.path;
  try {
    const sep = r.path.includes('?') ? '&' : '?';
    await page.goto(`${o.base}${r.path}${sep}intro=0&demo=1`, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(2200);
    for (const k of r.keys ?? []) {
      await page.keyboard.press(k);
      await page.waitForTimeout(700);
    }
    await page.evaluate(axeSource);
    const result = await page.evaluate(
      (runTags) =>
        window.axe.run(document, {
          runOnly: { type: 'tag', values: runTags },
          resultTypes: ['violations', 'incomplete'],
        }),
      tags,
    );
    const v = result.violations;
    total += v.length;
    console.log(
      `${v.length === 0 ? 'ok  ' : 'FAIL'} ${label}  (${v.length} violation${v.length === 1 ? '' : 's'}, ${result.incomplete.length} to review)`,
    );
    for (const item of v) {
      console.log(
        `     [${item.impact}] ${item.id}: ${item.help} (${item.nodes.length} node${item.nodes.length === 1 ? '' : 's'})`,
      );
      for (const n of item.nodes.slice(0, 3)) {
        console.log(`         ${n.target.join(' ')}`);
        const why = (n.any[0] ?? n.all[0] ?? n.none[0])?.message;
        if (why) console.log(`           ${why.slice(0, 170)}`);
      }
    }
    if (o.incomplete) {
      for (const item of result.incomplete) {
        console.log(`     [review] ${item.id}: ${item.help} (${item.nodes.length})`);
      }
    }
  } catch (e) {
    total += 1;
    console.log(`FAIL ${label}  audit error: ${String(e.message).slice(0, 200)}`);
  }
  await context.close();
}

await browser.close();
console.log(`\n${total} violation${total === 1 ? '' : 's'} across ${rows.length} page states`);
process.exit(total > 0 ? 1 : 0);
