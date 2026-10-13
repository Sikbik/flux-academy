/**
 * Per-route `<head>` rewriting for HTML responses, so link unfurlers and crawlers see real metadata
 * without running the app. Everything is derived from `shared/site.ts` and `shared/curriculum.ts`; no
 * request input is reflected (an unknown path gets the same fixed 404 head whatever it was), and every
 * injected value is escaped.
 */
import { LESSONS, lessonById, trackById } from '../../../shared/curriculum.ts';
import { documentTitle, type RouteMeta, routeMeta, SITE } from '../../../shared/site.ts';
import type { PreloadLink } from './preloads.ts';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON for an inline `<script>` data block: no `</script>`, `<!--` or line-separator breakouts. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

type JsonLd = Record<string, unknown>;

export interface HeadModel {
  title: string;
  description: string;
  /** Absolute canonical URL, or null when the page must not declare one (404). */
  canonical: string | null;
  ogType: 'website' | 'article';
  noindex: boolean;
  jsonLd: JsonLd[];
  /** Resource hints for the route's chunks and hero (see `preloads.ts`). Absent means none. */
  preloads?: readonly PreloadLink[];
}

const abs = (path: string): string => `${SITE.origin}${path}`;

const PROVIDER: JsonLd = {
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.origin,
};

const NOT_FOUND: HeadModel = {
  title: `Page not found | ${SITE.name}`,
  description: SITE.description,
  canonical: null,
  ogType: 'website',
  noindex: true,
  jsonLd: [],
};

const KIND_LABEL = { concept: 'Concept lesson', 'hands-on': 'Hands-on lesson', project: 'Project' } as const;

function breadcrumbs(meta: RouteMeta): JsonLd | null {
  if (meta.kind === 'home') return null;
  // Home, then every known ancestor path, then the page itself.
  const trail: { name: string; path: string }[] = [{ name: SITE.name, path: '/' }];
  const parts = meta.path.split('/').filter(Boolean);
  for (let i = 1; i < parts.length; i++) {
    const p = `/${parts.slice(0, i).join('/')}`;
    const m = routeMeta(p);
    if (m) trail.push({ name: m.title, path: m.path });
  }
  trail.push({ name: meta.title, path: meta.path });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: abs(t.path),
    })),
  };
}

function courseLd(meta: RouteMeta): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: `${SITE.name}: the course map`,
    description: meta.description,
    url: abs('/learn'),
    inLanguage: 'en',
    isAccessibleForFree: true,
    provider: PROVIDER,
    hasPart: LESSONS.map((l) => ({
      '@type': 'LearningResource',
      name: l.title,
      description: l.summary,
      url: abs(`/learn/${l.id}`),
      timeRequired: `PT${l.minutes}M`,
      educationalLevel: trackById(l.track).name,
    })),
  };
}

function lessonLd(meta: RouteMeta, id: string): JsonLd | null {
  const l = lessonById(id);
  if (!l) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: l.title,
    description: l.summary,
    url: abs(meta.path),
    inLanguage: 'en',
    isAccessibleForFree: true,
    timeRequired: `PT${l.minutes}M`,
    learningResourceType: KIND_LABEL[l.kind],
    educationalLevel: trackById(l.track).name,
    provider: PROVIDER,
    isPartOf: {
      '@type': 'Course',
      name: `${SITE.name}: the course map`,
      url: abs('/learn'),
      provider: PROVIDER,
    },
  };
}

function websiteLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: abs('/'),
    description: SITE.description,
    inLanguage: 'en',
    publisher: PROVIDER,
  };
}

/** The head for a pathname: a known route gets its own metadata, anything else gets the fixed 404 head. */
export function headFor(pathname: string): { model: HeadModel; found: boolean } {
  const meta = routeMeta(pathname);
  if (!meta) return { model: NOT_FOUND, found: false };
  const jsonLd: JsonLd[] = [];
  if (meta.kind === 'home') jsonLd.push(websiteLd());
  if (meta.kind === 'learn') jsonLd.push(courseLd(meta));
  if (meta.kind === 'lesson') {
    const ld = lessonLd(meta, meta.path.slice('/learn/'.length));
    if (ld) jsonLd.push(ld);
  }
  const crumbs = breadcrumbs(meta);
  if (crumbs) jsonLd.push(crumbs);
  return {
    found: true,
    model: {
      title: documentTitle(meta),
      description: meta.description,
      canonical: abs(meta.path === '/' ? '/' : meta.path),
      ogType: meta.kind === 'lesson' ? 'article' : 'website',
      noindex: false,
      jsonLd,
    },
  };
}

// ---------------------------------------------------------------------------
// Rewriting
// ---------------------------------------------------------------------------

// Attribute-aware tag matchers: a `>` inside a quoted value does not end the tag.
const TAG_BODY = '(?:"[^"]*"|\'[^\']*\'|[^>"\'])*';
const META_RE = new RegExp(`<meta\\b${TAG_BODY}>`, 'gi');
const LINK_RE = new RegExp(`<link\\b${TAG_BODY}>`, 'gi');
const TITLE_RE = /<title\b[^>]*>[\s\S]*?<\/title>/gi;
const LD_RE =
  /[ \t]*<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>[ \t]*\n?/gi;
/** A previously injected preload link, with its indentation and line break, so it can be removed whole. */
const PRELOAD_LINE_RE = new RegExp(`[ \\t]*<link\\b${TAG_BODY}>[ \\t]*\\n?`, 'gi');
const PRELOAD_MARK = 'data-route-preload';
const ATTR_RE = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+))/g;

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  for (let m = ATTR_RE.exec(tag); m !== null; m = ATTR_RE.exec(tag)) {
    out[(m[1] as string).toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

interface MetaSpec {
  attr: 'name' | 'property';
  key: string;
  value: string | null;
}

const metaTag = (s: MetaSpec & { value: string }): string =>
  `<meta ${s.attr}="${s.key}" content="${escapeHtml(s.value)}">`;

/**
 * One resource hint. Chunks are fetched in the same CORS mode Vite's own preload helper uses
 * (`crossorigin`), so the later `import()` and stylesheet link reuse the response instead of fetching it
 * twice. Stylesheets are low priority on purpose: at the default (highest) priority the route's CSS
 * competes with the entry's render-blocking CSS and delayed first paint by 0.3 to 0.5 s in measurements.
 * Every value is escaped; hrefs come from the build's route list or a constant, never the request.
 */
export function renderPreload(link: PreloadLink): string {
  const href = escapeHtml(link.href);
  switch (link.kind) {
    case 'script':
      return `<link rel="modulepreload" crossorigin href="${href}" ${PRELOAD_MARK}="1">`;
    case 'style':
      return `<link rel="preload" as="style" crossorigin fetchpriority="low" href="${href}" ${PRELOAD_MARK}="1">`;
    case 'image':
      return `<link rel="preload" as="image" href="${href}" type="${escapeHtml(link.type)}" fetchpriority="high" ${PRELOAD_MARK}="1">`;
  }
}

/**
 * Rewrites the managed head tags of `html` for `model`: replaces each existing tag, drops duplicates,
 * inserts the ones the template lacks (before `</head>`), and appends JSON-LD. Idempotent.
 */
export function applyHead(html: string, model: HeadModel): string {
  const image = abs(SITE.ogImage);
  const specs: MetaSpec[] = [
    { attr: 'name', key: 'description', value: model.description },
    { attr: 'name', key: 'application-name', value: SITE.name },
    { attr: 'name', key: 'robots', value: model.noindex ? 'noindex' : null },
    { attr: 'property', key: 'og:site_name', value: SITE.name },
    { attr: 'property', key: 'og:type', value: model.ogType },
    { attr: 'property', key: 'og:title', value: model.title },
    { attr: 'property', key: 'og:description', value: model.description },
    { attr: 'property', key: 'og:url', value: model.canonical },
    { attr: 'property', key: 'og:image', value: image },
    { attr: 'name', key: 'twitter:card', value: 'summary_large_image' },
    { attr: 'name', key: 'twitter:title', value: model.title },
    { attr: 'name', key: 'twitter:description', value: model.description },
    { attr: 'name', key: 'twitter:image', value: image },
  ];
  const wanted = new Map(specs.map((s) => [`${s.attr}:${s.key}`, s]));
  const placed = new Set<string>();

  let out = html.replace(LD_RE, '');
  out = out.replace(PRELOAD_LINE_RE, (tag) => (PRELOAD_MARK in attrs(tag) ? '' : tag));

  out = out.replace(META_RE, (tag) => {
    const a = attrs(tag);
    const attr = a.name !== undefined ? 'name' : a.property !== undefined ? 'property' : null;
    if (!attr) return tag;
    const id = `${attr}:${(a[attr] as string).toLowerCase()}`;
    const spec = wanted.get(id);
    if (!spec) return tag;
    if (placed.has(id) || spec.value === null) return '';
    placed.add(id);
    return metaTag({ ...spec, value: spec.value });
  });

  let canonicalPlaced = false;
  out = out.replace(LINK_RE, (tag) => {
    if ((attrs(tag).rel ?? '').toLowerCase() !== 'canonical') return tag;
    if (canonicalPlaced || model.canonical === null) return '';
    canonicalPlaced = true;
    return `<link rel="canonical" href="${escapeHtml(model.canonical)}">`;
  });

  const titleTag = `<title>${escapeHtml(model.title)}</title>`;
  let hasTitle = false;
  out = out.replace(TITLE_RE, () => {
    if (hasTitle) return '';
    hasTitle = true;
    return titleTag;
  });

  const additions: string[] = [];
  if (!hasTitle) additions.push(titleTag);
  for (const s of specs) {
    if (s.value !== null && !placed.has(`${s.attr}:${s.key}`))
      additions.push(metaTag({ ...s, value: s.value }));
  }
  if (model.canonical !== null && !canonicalPlaced) {
    additions.push(`<link rel="canonical" href="${escapeHtml(model.canonical)}">`);
  }
  // Before the JSON-LD (which can be large) so the hints sit as early in the document as they can.
  for (const link of model.preloads ?? []) additions.push(renderPreload(link));
  for (const ld of model.jsonLd) {
    additions.push(`<script type="application/ld+json">${jsonForScript(ld)}</script>`);
  }
  if (additions.length === 0) return out;
  const block = `    ${additions.join('\n    ')}\n`;
  const close = out.search(/<\/head\s*>/i);
  if (close !== -1) {
    // Insert at the start of the line that holds `</head>` so repeated runs do not pile up whitespace.
    let at = close;
    while (at > 0 && (out[at - 1] === ' ' || out[at - 1] === '\t')) at--;
    const lead = at > 0 && out[at - 1] !== '\n' ? '\n' : '';
    return `${out.slice(0, at)}${lead}${block}${out.slice(at)}`;
  }
  const open = /<head\b[^>]*>/i.exec(out);
  if (open) {
    const at = open.index + open[0].length;
    return `${out.slice(0, at)}\n${block}${out.slice(at)}`;
  }
  return `${block}${out}`;
}
