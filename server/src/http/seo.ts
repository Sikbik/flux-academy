import { allRoutes, SITE } from '../../../shared/site.ts';
import { escapeHtml } from './head.ts';

/** `/sitemap.xml` from the same route table that drives head tags. */
export function sitemapXml(): string {
  const rows = allRoutes()
    .map((r) => {
      const loc = `${SITE.origin}${r.path === '/' ? '/' : r.path}`;
      return `  <url><loc>${escapeHtml(loc)}</loc><priority>${r.priority.toFixed(1)}</priority></url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE.origin}/sitemap.xml\n`;
}
