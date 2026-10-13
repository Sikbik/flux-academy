// Black-box smoke test of a running server or container. Used by CI against the built image:
//   node server/scripts/smoke.ts http://127.0.0.1:42069
// Exits non-zero with a list of failures. Reads expected titles and redirects from shared/ so a renamed
// lesson never breaks the check for the wrong reason.
import { LESSONS } from '../../shared/curriculum.ts';
import { documentTitle, REDIRECTS, routeMeta } from '../../shared/site.ts';

const base = (process.argv[2] ?? 'http://127.0.0.1:42069').replace(/\/+$/, '');
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};
const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const health = await fetch(`${base}/healthz`);
check(health.status === 200 && (await health.text()).trim() === 'ok', '/healthz answers ok');

const net = await fetch(`${base}/api/v1/network`);
const netBody = (await net.json()) as {
  data?: { chain?: { height?: number }; nodes?: { total?: number } };
  meta?: { source?: string };
};
check(
  net.status === 200 &&
    typeof netBody.data?.chain?.height === 'number' &&
    typeof netBody.meta?.source === 'string',
  `/api/v1/network is an envelope (source ${netBody.meta?.source}, height ${netBody.data?.chain?.height})`,
);
check(
  net.headers.get('content-security-policy')?.includes("default-src 'self'") === true,
  'CSP header present',
);

const root = await fetch(`${base}/`);
const rootHtml = await root.text();
check(root.status === 200 && rootHtml.includes('<div id="root">'), '/ serves the app shell');
check(rootHtml.includes('"@type":"WebSite"'), '/ carries WebSite JSON-LD');

const lesson = LESSONS[0];
if (lesson) {
  const path = `/learn/${lesson.id}`;
  const html = await (await fetch(`${base}${path}`)).text();
  const title = documentTitle(routeMeta(path));
  check(html.includes(`<title>${escapeHtml(title)}</title>`), `${path} has the injected title "${title}"`);
  check(html.includes('"@type":"LearningResource"'), `${path} carries LearningResource JSON-LD`);
}

const unknown = await fetch(`${base}/definitely-not-a-page`, { headers: { accept: 'text/html' } });
check(unknown.status === 404, 'an unknown page is a real 404');

const [from, to] = Object.entries(REDIRECTS)[0] ?? [];
if (from && to) {
  const r = await fetch(`${base}${from}?x=1`, { redirect: 'manual' });
  check(r.status === 301 && r.headers.get('location') === `${to}?x=1`, `${from} redirects 301 to ${to}`);
}

const sitemap = await fetch(`${base}/sitemap.xml`);
check(sitemap.status === 200 && (await sitemap.text()).includes('<loc>'), '/sitemap.xml lists urls');

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
