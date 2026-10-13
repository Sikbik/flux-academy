import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { LABS, LESSONS } from '../../shared/curriculum.ts';
import { allRoutes, documentTitle, routeMeta, SITE } from '../../shared/site.ts';
import { applyHead, escapeHtml, type HeadModel, headFor, jsonForScript } from '../src/http/head.ts';

const TEMPLATE = readFileSync(new URL('../../web/index.html', import.meta.url), 'utf8');

const count = (haystack: string, needle: string | RegExp) =>
  typeof needle === 'string' ? haystack.split(needle).length - 1 : (haystack.match(needle) ?? []).length;

function ldBlocks(html: string): Record<string, unknown>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1] as string) as Record<string, unknown>,
  );
}

describe('escaping', () => {
  it('escapes the five HTML metacharacters', () => {
    assert.equal(
      escapeHtml(`<a href="x" onclick='y'>&</a>`),
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
  it('keeps JSON-LD from breaking out of its script element', () => {
    const out = jsonForScript({ name: '</script><script>alert(1)</script><!--', sep: '  ' });
    assert.ok(!out.includes('</script>'));
    assert.ok(!out.includes('<!--'));
    assert.ok(!out.includes(' '));
    assert.deepEqual(JSON.parse(out), { name: '</script><script>alert(1)</script><!--', sep: '  ' });
  });
});

describe('applyHead on the real web/index.html', () => {
  const lesson = LESSONS[0];
  assert.ok(lesson);
  const path = `/learn/${lesson.id}`;
  const html = applyHead(TEMPLATE, headFor(path).model);

  it('replaces title, description, canonical, Open Graph and Twitter tags exactly once each', () => {
    assert.equal(count(html, /<title>/g), 1);
    assert.ok(html.includes(`<title>${escapeHtml(documentTitle(routeMeta(path)))}</title>`));
    for (const key of [
      'name="description"',
      'property="og:title"',
      'property="og:description"',
      'property="og:url"',
      'property="og:image"',
      'property="og:type"',
      'property="og:site_name"',
      'name="twitter:card"',
      'name="twitter:title"',
      'name="twitter:description"',
      'name="twitter:image"',
    ]) {
      assert.equal(count(html, key), 1, key);
    }
    assert.equal(count(html, 'rel="canonical"'), 1);
    assert.ok(html.includes(`<link rel="canonical" href="${SITE.origin}${path}">`));
    assert.ok(html.includes(`<meta property="og:url" content="${SITE.origin}${path}">`));
    assert.ok(html.includes(`<meta property="og:type" content="article">`));
    assert.ok(html.includes(`<meta name="description" content="${escapeHtml(lesson.summary)}">`));
    // Template tags that are not ours are untouched.
    assert.ok(html.includes('<meta name="viewport"'));
    assert.ok(html.includes('<meta property="og:image:width" content="1200" />'));
    assert.ok(html.includes('<div id="root"></div>'));
  });

  it('adds LearningResource and BreadcrumbList JSON-LD for a lesson', () => {
    const [res, crumbs, ...rest] = ldBlocks(html);
    assert.equal(rest.length, 0);
    assert.equal(res?.['@type'], 'LearningResource');
    assert.equal(res?.name, lesson.title);
    assert.equal(res?.url, `${SITE.origin}${path}`);
    assert.equal(res?.timeRequired, `PT${lesson.minutes}M`);
    assert.equal(crumbs?.['@type'], 'BreadcrumbList');
    const items = crumbs?.itemListElement as { position: number; item: string; name: string }[];
    assert.deepEqual(
      items.map((i) => i.item),
      [`${SITE.origin}/`, `${SITE.origin}/learn`, `${SITE.origin}${path}`],
    );
    assert.deepEqual(
      items.map((i) => i.position),
      [1, 2, 3],
    );
  });

  it('is idempotent', () => {
    assert.equal(applyHead(html, headFor(path).model), html);
  });

  it('home gets WebSite, the course map gets Course with every lesson', () => {
    const home = ldBlocks(applyHead(TEMPLATE, headFor('/').model));
    assert.deepEqual(
      home.map((b) => b['@type']),
      ['WebSite'],
    );
    assert.equal(home[0]?.url, `${SITE.origin}/`);
    const learn = ldBlocks(applyHead(TEMPLATE, headFor('/learn').model));
    assert.deepEqual(
      learn.map((b) => b['@type']),
      ['Course', 'BreadcrumbList'],
    );
    assert.equal(((learn[0]?.hasPart ?? []) as unknown[]).length, LESSONS.length);
    assert.equal(learn[0]?.isAccessibleForFree, true);
  });

  it('every sitemap route resolves to a head with its own title and a canonical', () => {
    const seen = new Set<string>();
    for (const r of allRoutes()) {
      const { model, found } = headFor(r.path);
      assert.ok(found, r.path);
      assert.equal(model.canonical, `${SITE.origin}${r.path === '/' ? '/' : r.path}`);
      assert.ok(!seen.has(model.title), `duplicate title ${model.title}`);
      seen.add(model.title);
    }
    assert.equal(LABS.length > 0, true);
  });

  it('nested reference routes list known ancestors in the breadcrumb', () => {
    const crumbs = ldBlocks(applyHead(TEMPLATE, headFor('/reference/spec').model)).find(
      (b) => b['@type'] === 'BreadcrumbList',
    );
    const items = crumbs?.itemListElement as { item: string }[];
    assert.deepEqual(
      items.map((i) => i.item),
      [`${SITE.origin}/`, `${SITE.origin}/reference`, `${SITE.origin}/reference/spec`],
    );
  });
});

describe('applyHead hostile and minimal templates', () => {
  const evil: HeadModel = {
    title: `"><script>alert(1)</script>`,
    description: `a & b <c> "d" 'e'`,
    canonical: `https://x.test/?a="b"&c=<d>`,
    ogType: 'website',
    noindex: false,
    jsonLd: [{ '@context': 'https://schema.org', name: '</script><img src=x onerror=alert(1)>' }],
  };

  it('escapes every injected value and cannot close the script element', () => {
    const out = applyHead('<!doctype html><html><head></head><body></body></html>', evil);
    assert.ok(!out.includes('<script>alert(1)'));
    assert.ok(!out.includes('<img src=x'));
    assert.ok(out.includes('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(out.includes('content="a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;"'));
    assert.equal(count(out, /<script/g), 1, 'only our JSON-LD script exists');
    assert.equal(ldBlocks(out).length, 1);
  });

  it('inserts missing tags into a bare head, and a head-less document', () => {
    const bare = applyHead('<head></head><body></body>', headFor('/labs').model);
    assert.ok(bare.includes('<title>Labs | Flux Academy</title>'));
    assert.ok(bare.includes('<meta property="og:image"'));
    const headless = applyHead('<body>hi</body>', headFor('/labs').model);
    assert.ok(headless.startsWith('    <title>Labs'));
  });

  it('collapses duplicate tags and handles single quotes and a > inside an attribute', () => {
    const t =
      `<head><title>a</title><title>b</title><meta name='description' content='x > y'>` +
      `<meta name="description" content="dup"><link rel=canonical href=/old></head>`;
    const out = applyHead(t, headFor('/labs').model);
    assert.equal(count(out, /name="description"/g), 1);
    assert.equal(count(out, /<title>/g), 1);
    assert.equal(count(out, /rel="canonical"/g), 1);
    assert.ok(!out.includes('/old'));
  });

  it('drops the canonical and og:url and adds noindex for an unknown route', () => {
    const { model, found } = headFor('/definitely/not/a/route');
    assert.equal(found, false);
    const out = applyHead(TEMPLATE, model);
    assert.ok(!out.includes('rel="canonical"'));
    assert.ok(!out.includes('og:url'));
    assert.ok(out.includes('<meta name="robots" content="noindex">'));
    assert.equal(ldBlocks(out).length, 0);
  });
});
