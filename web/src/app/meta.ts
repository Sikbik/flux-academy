/**
 * Document head management for the SPA. The server injects the right `<title>`, description, canonical
 * and Open Graph tags for crawlers and link unfurls (docs/ARCHITECTURE.md section 8); this keeps them
 * correct as the visitor navigates client side.
 *
 * Base values come from `shared/site.ts` (`routeMeta` and `documentTitle`). A route's `meta` and a
 * page's own `useDocumentMeta({ title, description })` override them, the page winning.
 *
 *   function FailoverLab() {
 *     useDocumentMeta({ title: 'Failover Lab' });
 *   }
 */

import { documentTitle, routeMeta, SITE } from '@shared/site';
import { useEffect } from 'react';
import { create } from 'zustand';

export interface MetaOverride {
  /** Page title without the site suffix, for example "Failover Lab". */
  title?: string;
  description?: string;
  noindex?: boolean;
}

export interface HeadValues {
  title: string;
  description: string;
  canonical: string;
  noindex: boolean;
}

/** Pure: the head values for a pathname, from the route table and any overrides. */
export function buildHead(
  pathname: string,
  ...overrides: Array<MetaOverride | null | undefined>
): HeadValues {
  const base = routeMeta(pathname);
  const merged: MetaOverride = {};
  for (const o of overrides) if (o) Object.assign(merged, JSON.parse(JSON.stringify(o)) as MetaOverride);
  const known = base !== null;
  const title =
    merged.title !== undefined
      ? `${merged.title} | ${SITE.name}`
      : known
        ? documentTitle(base)
        : `Page not found | ${SITE.name}`;
  const description = merged.description ?? base?.description ?? SITE.description;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return {
    title,
    description,
    canonical: `${SITE.origin}${clean}`,
    noindex: merged.noindex === true || !known,
  };
}

interface OverrideState {
  override: MetaOverride | null;
  set: (o: MetaOverride | null) => void;
}

export const useMetaOverride = create<OverrideState>((set) => ({
  override: null,
  set: (override) => set({ override }),
}));

/** Let a page set its own title or description (a lesson, a lab, a reference topic). */
export function useDocumentMeta(override: MetaOverride): void {
  const { title, description, noindex } = override;
  useEffect(() => {
    useMetaOverride.getState().set({ title, description, noindex });
    return () => useMetaOverride.getState().set(null);
  }, [title, description, noindex]);
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  if (el.content !== content) el.content = content;
}

/** Writes head values to the document. Idempotent. */
export function applyHead(head: HeadValues): void {
  if (document.title !== head.title) document.title = head.title;
  setMeta('meta[name="description"]', 'name', 'description', head.description);
  setMeta('meta[property="og:title"]', 'property', 'og:title', head.title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', head.description);
  setMeta('meta[property="og:url"]', 'property', 'og:url', head.canonical);
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', head.title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', head.description);
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  if (link.href !== head.canonical) link.href = head.canonical;
  const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (head.noindex) setMeta('meta[name="robots"]', 'name', 'robots', 'noindex');
  else robots?.remove();
}
