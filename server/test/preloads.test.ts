import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { LABS, LESSONS } from '../../shared/curriculum.ts';
import { ART } from '../../web/src/content/art.ts';
import {
  type BundleLike,
  CHILD_MODULES,
  computeRoutePreloads,
  parseRoutePaths,
  readRouteSources,
} from '../../web/vite-plugins/route-preloads.ts';
import { applyHead, escapeHtml, type HeadModel, headFor, renderPreload } from '../src/http/head.ts';
import {
  HOME_HERO_AVIF,
  loadRoutePreloads,
  matchRoute,
  parseRoutePreloads,
  preloadLinksFor,
  ROUTE_PRELOADS_FILE,
} from '../src/http/preloads.ts';
import { makeWebDist, request, startFixtureServer, type TestServer } from './helpers.ts';

const WEB = new URL('../../web/', import.meta.url).pathname;

const FILE = {
  version: 1,
  routes: [
    {
      folder: 'home',
      paths: ['/'],
      js: ['/assets/home-AAA.js', '/assets/Chip-BBB.js'],
      css: ['/assets/home-CCC.css'],
    },
    { folder: 'learn', paths: ['/learn'], js: ['/assets/learn-DDD.js'], css: [] },
    {
      folder: 'lesson',
      paths: ['/learn/:lessonId'],
      js: ['/assets/lesson-EEE.js'],
      css: ['/assets/lesson-FFF.css'],
    },
    { folder: 'labs', paths: ['/labs', '/labs/:labId'], js: ['/assets/labs-GGG.js'], css: [] },
    {
      folder: 'labs',
      paths: ['/labs/spec-forge'],
      js: ['/assets/labs-GGG.js', '/assets/spec-forge-HHH.js'],
      css: ['/assets/spec-forge-III.css'],
    },
  ],
};

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Template</title>
    <link rel="stylesheet" crossorigin href="/assets/index-XYZ.css">
  </head>
  <body><div id="root"></div></body>
</html>
`;

const model = (pathname: string, preloads?: HeadModel['preloads']): HeadModel => ({
  ...headFor(pathname).model,
  preloads,
});

describe('route preload matching (the client folderForPath rule)', () => {
  const pre = parseRoutePreloads(FILE);
  assert.ok(pre);

  it('matches literal, parameterised and trailing-slash paths', () => {
    assert.equal(matchRoute(pre, '/')?.path, '/');
    assert.equal(matchRoute(pre, '/learn')?.path, '/learn');
    assert.equal(matchRoute(pre, '/learn/')?.path, '/learn');
    assert.equal(matchRoute(pre, '/learn/what-is-flux')?.path, '/learn/:lessonId');
    assert.equal(matchRoute(pre, '/labs')?.path, '/labs');
    assert.equal(matchRoute(pre, '/labs/network')?.path, '/labs/:labId');
  });
  it('lets a literal path beat a parameterised one', () => {
    assert.equal(matchRoute(pre, '/labs/spec-forge')?.path, '/labs/spec-forge');
  });
  it('matches nothing for a path no entry covers', () => {
    assert.equal(matchRoute(pre, '/nope'), null);
    assert.equal(matchRoute(pre, '/learn/a/b'), null);
    assert.equal(matchRoute(pre, '/profile'), null);
  });
  it('treats pattern characters in a path literally', () => {
    const odd = parseRoutePreloads({
      version: 1,
      routes: [{ folder: 'x', paths: ['/a.b'], js: ['/assets/x-1.js'], css: [] }],
    });
    assert.ok(odd);
    assert.equal(matchRoute(odd, '/a.b')?.path, '/a.b');
    assert.equal(matchRoute(odd, '/aXb'), null);
  });
});

describe('route-preloads.json validation', () => {
  const bad = (patch: (f: typeof FILE) => unknown) => parseRoutePreloads(patch(structuredClone(FILE)));
  it('accepts the build output shape', () => {
    assert.ok(parseRoutePreloads(FILE));
  });
  it('rejects anything that is not a plain asset path', () => {
    for (const href of [
      '/assets/../../etc/passwd.js',
      'https://evil.example/x.js',
      '//evil.example/x.js',
      '/assets/x.js?q=1',
      '/assets/x".js',
      '/assets/x.js" onload="y',
      '/assets/x.html',
      'assets/x.js',
    ]) {
      assert.equal(
        bad((f) => {
          f.routes[0]?.js.push(href);
          return f;
        }),
        null,
        href,
      );
    }
  });
  it('rejects a css file listed as js and the other way round', () => {
    assert.equal(
      bad((f) => {
        f.routes[0]?.js.push('/assets/a-1.css');
        return f;
      }),
      null,
    );
    assert.equal(
      bad((f) => {
        f.routes[0]?.css.push('/assets/a-1.js');
        return f;
      }),
      null,
    );
  });
  it('rejects the wrong version, wrong types and hostile path patterns', () => {
    assert.equal(parseRoutePreloads(null), null);
    assert.equal(parseRoutePreloads({ version: 2, routes: [] }), null);
    assert.equal(parseRoutePreloads({ version: 1, routes: 'x' }), null);
    assert.equal(
      bad((f) => {
        f.routes[0]?.paths.push('/a(b');
        return f;
      }),
      null,
    );
  });
  it('treats a missing or unreadable file as no preloads', async () => {
    assert.equal(await loadRoutePreloads('/nonexistent/route-preloads.json'), null);
    const dir = await makeWebDist({ [ROUTE_PRELOADS_FILE]: '{not json' });
    assert.equal(await loadRoutePreloads(join(dir, ROUTE_PRELOADS_FILE)), null);
    assert.deepEqual(preloadLinksFor(null, '/learn'), []);
  });
});

describe('preload tags', () => {
  const pre = parseRoutePreloads(FILE);
  assert.ok(pre);

  it('renders a modulepreload per chunk and a low priority style preload per stylesheet, in the CORS mode Vite uses', () => {
    const links = preloadLinksFor(pre, '/learn/what-is-flux');
    assert.deepEqual(links.map(renderPreload), [
      '<link rel="modulepreload" crossorigin href="/assets/lesson-EEE.js" data-route-preload="1">',
      '<link rel="preload" as="style" crossorigin fetchpriority="low" href="/assets/lesson-FFF.css" data-route-preload="1">',
    ]);
  });
  it('adds the hero image only on the home route', () => {
    const home = preloadLinksFor(pre, '/').map(renderPreload);
    assert.equal(
      home[0],
      `<link rel="preload" as="image" href="${HOME_HERO_AVIF}" type="image/avif" fetchpriority="high" data-route-preload="1">`,
    );
    assert.equal(home.length, 4);
    for (const p of ['/learn', '/labs', '/labs/spec-forge']) {
      assert.ok(!preloadLinksFor(pre, p).some((l) => l.kind === 'image'), p);
    }
  });
  it('escapes every value', () => {
    const tag = renderPreload({ kind: 'script', href: '/a"><script>alert(1)</script>.js' });
    assert.ok(!tag.includes('<script>'));
    assert.ok(tag.includes(escapeHtml('/a"><script>alert(1)</script>.js')));
    const img = renderPreload({ kind: 'image', href: '/x.avif', type: 'image/avif" onerror="x' });
    assert.ok(!img.includes('onerror="x'));
  });
  it('places the tags in the head, marked, and leaves a template without preloads unchanged', () => {
    const links = preloadLinksFor(pre, '/learn');
    const withTags = applyHead(TEMPLATE, model('/learn', links));
    const without = applyHead(TEMPLATE, model('/learn'));
    assert.equal((withTags.match(/data-route-preload="1"/g) ?? []).length, 1, 'one marked link for /learn');
    assert.ok(withTags.indexOf('data-route-preload') < withTags.indexOf('</head>'));
    assert.ok(!without.includes('data-route-preload'));
    assert.equal(withTags.replace(/ *<link rel="modulepreload"[^>]*data-route-preload[^>]*>\n/, ''), without);
  });
  it('is idempotent and replaces earlier hints instead of piling up', () => {
    const a = preloadLinksFor(pre, '/learn/what-is-flux');
    const b = preloadLinksFor(pre, '/labs/spec-forge');
    const once = applyHead(TEMPLATE, model('/learn/what-is-flux', a));
    assert.equal(applyHead(once, model('/learn/what-is-flux', a)), once);
    const other = applyHead(once, model('/labs/spec-forge', b));
    assert.equal(other, applyHead(TEMPLATE, model('/labs/spec-forge', b)));
    assert.ok(!other.includes('lesson-EEE.js'));
    const cleared = applyHead(other, model('/labs/spec-forge'));
    assert.ok(!cleared.includes('data-route-preload'));
    assert.equal(cleared, applyHead(TEMPLATE, model('/labs/spec-forge')));
  });
  it('does not touch links of its own that are not marked', () => {
    const out = applyHead(TEMPLATE, model('/learn', preloadLinksFor(pre, '/learn')));
    assert.ok(out.includes('<link rel="stylesheet" crossorigin href="/assets/index-XYZ.css">'));
  });
});

describe('the home hero preload', () => {
  it('points at the file the art manifest says the plate is', () => {
    assert.equal(HOME_HERO_AVIF, ART['bg-bench'].avif);
  });
  it('exists in web/public/art', () => {
    assert.ok(existsSync(join(WEB, 'public', HOME_HERO_AVIF)));
  });
});

describe('served shells', () => {
  let s: TestServer;
  let dir: string;
  before(async () => {
    dir = await makeWebDist({ 'index.html': TEMPLATE, [ROUTE_PRELOADS_FILE]: JSON.stringify(FILE) });
    s = await startFixtureServer({ WEB_DIST: dir });
  });
  after(async () => {
    await s.stop();
  });
  const get = (path: string) => request(s.port, path, { headers: { 'accept-encoding': 'identity' } });
  const marked = (html: string) => html.match(/<link [^>]*data-route-preload[^>]*>/g) ?? [];

  it('injects the matched route and nothing else', async () => {
    const lesson = LESSONS[0];
    assert.ok(lesson);
    const r = await get(`/learn/${lesson.id}`);
    assert.equal(r.status, 200);
    assert.deepEqual(marked(r.text).length, 2);
    assert.ok(r.text.includes('href="/assets/lesson-EEE.js"'));
    assert.ok(r.text.includes('href="/assets/lesson-FFF.css"'));
    assert.ok(!r.text.includes('learn-DDD.js'));
  });
  it('gives a lab its own chunk and the labs chunk, and a lab without one the route chunk', async () => {
    const forge = await get('/labs/spec-forge');
    assert.ok(forge.text.includes('spec-forge-HHH.js') && forge.text.includes('labs-GGG.js'));
    assert.ok(forge.text.includes('spec-forge-III.css'));
    const other = LABS.find((l) => l.id !== 'spec-forge');
    assert.ok(other);
    const r = await get(`/labs/${other.id}`);
    assert.equal(r.status, 200);
    assert.ok(r.text.includes('labs-GGG.js'));
    assert.ok(!r.text.includes('spec-forge-HHH.js'));
  });
  it('adds the hero image to the home route', async () => {
    const r = await get('/');
    assert.ok(r.text.includes(`<link rel="preload" as="image" href="${HOME_HERO_AVIF}"`));
    assert.ok(r.text.includes('href="/assets/home-AAA.js"'));
  });
  it('gives a route without an entry, and an unknown path, no hints and never reflects the path', async () => {
    const profile = await get('/profile');
    assert.equal(profile.status, 200);
    assert.equal(marked(profile.text).length, 0);
    const nope = await get('/learn/%3Cscript%3E');
    assert.equal(nope.status, 404);
    assert.equal(marked(nope.text).length, 0);
    assert.ok(!nope.text.includes('lesson-EEE.js'));
  });
  it('keeps the shell cache honest when the json changes under it', async () => {
    const before = await get('/learn');
    assert.ok(before.text.includes('learn-DDD.js'));
    const next = structuredClone(FILE);
    next.routes[1] = { folder: 'learn', paths: ['/learn'], js: ['/assets/learn-ZZZ.js'], css: [] };
    const file = join(dir, ROUTE_PRELOADS_FILE);
    await writeFile(file, JSON.stringify(next));
    const later = new Date(statSync(file).mtimeMs + 5_000);
    await utimes(file, later, later);
    const after = await get('/learn');
    assert.ok(after.text.includes('learn-ZZZ.js') && !after.text.includes('learn-DDD.js'));
  });
});

describe('a dist without route-preloads.json (dev, or an older build)', () => {
  let s: TestServer;
  before(async () => {
    s = await startFixtureServer({ WEB_DIST: await makeWebDist({ 'index.html': TEMPLATE }) });
  });
  after(async () => {
    await s.stop();
  });
  it('serves the shell with no hints', async () => {
    for (const p of ['/', '/learn', '/labs/spec-forge']) {
      const r = await request(s.port, p, { headers: { 'accept-encoding': 'identity' } });
      assert.equal(r.status, 200);
      assert.ok(!r.text.includes('data-route-preload'), p);
    }
  });
});

describe('web/vite-plugins/route-preloads.ts', () => {
  it('reads the path of a route.ts in the accepted shapes', () => {
    assert.deepEqual(parseRoutePaths(`export default { path: '/x' } satisfies RouteDef;`, 'a'), ['/x']);
    assert.deepEqual(
      parseRoutePaths(
        `/** doc */\nexport default {\n  path: ["/a", "/a/:b"],\n  meta: {},\n} satisfies RouteDef;`,
        'a',
      ),
      ['/a', '/a/:b'],
    );
    assert.deepEqual(parseRoutePaths(`export default { path: '*', meta: { title: 'x' } };`, 'a'), ['*']);
  });
  it('fails loudly on anything else', () => {
    for (const src of [
      `const p = '/x'; export default { path: p };`,
      'export default { path: `/x` };',
      `export default { path: ['/x', y] };`,
      `export default { meta: {} };`,
      `export default { path: 'x' };`,
      `export default { path: [] };`,
      `export const route = { path: '/x' };`,
    ]) {
      assert.throws(() => parseRoutePaths(src, 'routes/a/route.ts'), /route-preloads/, src);
    }
  });
  it('parses every real route.ts in the web app', () => {
    const sources = readRouteSources(join(WEB, 'src/routes'));
    const folders = readdirSync(join(WEB, 'src/routes'), { withFileTypes: true }).filter((d) =>
      existsSync(join(WEB, 'src/routes', d.name, 'route.ts')),
    );
    assert.equal(sources.length, folders.length);
    assert.ok(sources.some((r) => r.folder === 'home' && r.paths.includes('/')));
  });

  const chunk = (fileName: string, imports: string[], css: string[] = [], extra: object = {}) => ({
    type: 'chunk' as const,
    fileName,
    facadeModuleId: null as string | null,
    isEntry: false,
    imports,
    viteMetadata: { importedCss: new Set(css) },
    ...extra,
  });
  const bundle: BundleLike = {
    'assets/index.js': chunk('assets/index.js', ['assets/vendor.js'], ['assets/index.css'], {
      isEntry: true,
    }),
    'assets/vendor.js': chunk('assets/vendor.js', []),
    'assets/shared.js': chunk('assets/shared.js', ['assets/vendor.js'], ['assets/shared.css']),
    'assets/home.js': chunk('assets/home.js', ['assets/vendor.js', 'assets/shared.js'], ['assets/home.css'], {
      facadeModuleId: '/w/src/routes/home/index.tsx',
    }),
    'assets/labs.js': chunk('assets/labs.js', ['assets/shared.js'], [], {
      facadeModuleId: '/w/src/routes/labs/index.tsx',
    }),
    'assets/forge.js': chunk(
      'assets/forge.js',
      ['assets/shared.js', 'assets/labs.js', 'assets/editor.js'],
      [],
      {
        facadeModuleId: '/w/src/labs/spec-forge/index.tsx',
      },
    ),
    'assets/editor.js': chunk('assets/editor.js', ['assets/vendor.js'], ['assets/editor.css']),
    'assets/index.html': { type: 'asset' },
  };
  const run = (routes: { folder: string; paths: string[] }[], base = '/') =>
    computeRoutePreloads({
      bundle,
      routes,
      pageIdFor: (f) => `/w/src/routes/${f}/index.tsx`,
      childrenFor: (f) =>
        f === 'labs' ? [{ id: 'spec-forge', moduleId: '/w/src/labs/spec-forge/index.tsx' }] : [],
      base,
    });

  it('keeps the page chunk and its static imports, minus the entry graph, with their CSS', () => {
    const out = run([{ folder: 'home', paths: ['/'] }]);
    assert.deepEqual(out.routes, [
      {
        folder: 'home',
        paths: ['/'],
        js: ['/assets/home.js', '/assets/shared.js'],
        css: ['/assets/home.css', '/assets/shared.css'],
      },
    ]);
  });
  it('adds an entry per child module with the route chunks and the child chunks', () => {
    const out = run([
      { folder: 'labs', paths: ['/labs', '/labs/:labId'] },
      { folder: 'home', paths: ['/'] },
    ]);
    assert.deepEqual(out.routes[0]?.paths, ['/labs', '/labs/:labId']);
    assert.deepEqual(out.routes[1], {
      folder: 'labs',
      paths: ['/labs/spec-forge'],
      js: ['/assets/labs.js', '/assets/shared.js', '/assets/forge.js', '/assets/editor.js'],
      css: ['/assets/shared.css', '/assets/editor.css'],
    });
  });
  it('leaves the not-found page out and honours the base', () => {
    const out = run(
      [
        { folder: 'home', paths: ['/'] },
        { folder: 'not-found', paths: ['*'] },
      ],
      '/academy/',
    );
    assert.deepEqual(
      out.routes.map((r) => r.folder),
      ['home'],
    );
    assert.equal(out.routes[0]?.js[0], '/academy/assets/home.js');
  });
  it('throws when a page chunk is missing or the base is relative', () => {
    assert.throws(() => run([{ folder: 'missing', paths: ['/m'] }]), /no chunk for/);
    assert.throws(() => run([{ folder: 'home', paths: ['/'] }], './'), /absolute/);
  });
  it('knows which routes have child modules', () => {
    assert.deepEqual(CHILD_MODULES, [{ folder: 'labs', dir: 'src/labs' }]);
  });
});
