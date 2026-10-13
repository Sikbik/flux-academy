/**
 * Pure helpers of the Reference pages: section numbering, scroll spy, labels. No React, no DOM, so each
 * rule can be tested without a page.
 */

import type { Provenance, ReferenceEntry, SectionMeta, TopicId } from '@/content/reference';

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export interface NumberedSection extends SectionMeta {
  /** `1`, `2`, ... for a section and `2.1` for its subsection. */
  number: string;
  /** The id of the level 2 section a level 3 section sits under, or null. */
  parent: string | null;
}

/** Numbers the sections the way a manual does: 1, 2, 2.1, 2.2, 3. A level 3 follows its level 2. */
export function numberSections(sections: readonly SectionMeta[]): NumberedSection[] {
  const out: NumberedSection[] = [];
  let major = 0;
  let minor = 0;
  let parent: string | null = null;
  for (const s of sections) {
    if (s.level === 2) {
      major += 1;
      minor = 0;
      parent = s.id;
      out.push({ ...s, number: String(major), parent: null });
    } else {
      minor += 1;
      out.push({ ...s, number: `${major}.${minor}`, parent });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scroll spy
// ---------------------------------------------------------------------------

export interface SpyItem {
  id: string;
  /** `getBoundingClientRect().top` of the heading. */
  top: number;
}

/**
 * The section being read: the last one whose heading has reached `line`. Items are in document order.
 * At the very bottom of the page the last section wins, because a short last section may never reach the
 * line. Before the first heading has reached it, the first section is current. Returns null for no items.
 */
export function computeActive(items: readonly SpyItem[], line: number, atBottom: boolean): string | null {
  if (items.length === 0) return null;
  if (atBottom) return items[items.length - 1]?.id ?? null;
  let current = items[0]?.id ?? null;
  for (const item of items) {
    if (item.top <= line) current = item.id;
    else break;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export interface ProvInfo {
  /** The word on the chip. */
  label: string;
  /** What it means, one sentence. */
  meaning: string;
  /** Statements wearing this are not established facts. */
  caution: boolean;
}

/** Always shown with its words: a colour alone never carries the meaning. */
export const PROV: Readonly<Record<Provenance, ProvInfo>> = {
  source: {
    label: 'Source',
    meaning: 'Read in the FluxOS source code.',
    caution: false,
  },
  live: {
    label: 'Live',
    meaning: 'Observed on the live network and its API.',
    caution: false,
  },
  docs: {
    label: 'Docs',
    meaning: "Stated in Flux's documentation and not checked against the source.",
    caution: false,
  },
  inference: {
    label: 'Inference',
    meaning: 'Reasoned from the source or from how Docker normally behaves. Not tested on Flux.',
    caution: true,
  },
  unverified: {
    label: 'Unverified',
    meaning: 'Not confirmed. Treat it as guidance and test it before you rely on it.',
    caution: true,
  },
};

export const PROV_ORDER: readonly Provenance[] = ['source', 'live', 'docs', 'inference', 'unverified'];

/** Provenance in the fixed order above, without repeats. */
export function sortedProv(prov: readonly Provenance[]): Provenance[] {
  return PROV_ORDER.filter((p) => prov.includes(p));
}

/** True when a statement is wholly or partly unverified. */
export function isUnverified(prov: readonly Provenance[] | undefined): boolean {
  return !!prov && prov.includes('unverified');
}

/** "yes, may be empty" -> `{ required: true, detail: 'may be empty' }`. */
export function readRequired(text: string): { required: boolean; detail: string } {
  const t = text.trim().toLowerCase();
  if (t === 'no') return { required: false, detail: '' };
  if (t.startsWith('yes')) {
    return { required: true, detail: t.replace(/^yes,?\s*/, '') };
  }
  return { required: false, detail: t };
}

/** The entries of a topic that wear the Unverified label, in index order. */
export function unverifiedOf(entries: readonly ReferenceEntry[], topic: TopicId): ReferenceEntry[] {
  return entries.filter((e) => e.topic === topic && e.anchor !== '' && isUnverified(e.prov));
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/** `https://academy.example/reference/spec#component-ports` from the origin and a site path. */
export function absoluteLink(origin: string, path: string, id: string): string {
  const base = path.replace(/#.*$/, '');
  return `${origin}${base}#${id}`;
}

/** The Flux Academy path of a lint code in the lint index. */
export function lintPath(code: string): string {
  return `/reference/spec#lint-${code}`;
}

/** True when the string is a plausible element id (kept narrow so it is safe in a selector). */
export function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}
