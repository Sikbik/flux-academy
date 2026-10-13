/**
 * Small constructors so the symptom files read like the content they are, not like object noise.
 * Pure data helpers: nothing here renders or fetches.
 */

import type { Markup } from '@/learn/types';
import type { Check, Fix, Proof, SpecExample } from './types';

// ---- provenance --------------------------------------------------------------------------------

/** Read in FluxOS or FDM source (FACTS says `VERIFIED-SOURCE`). */
export const src = (facts: string, note?: string): Proof => ({
  status: 'verified',
  via: ['source'],
  facts,
  ...(note ? { note } : {}),
});

/** Observed on the live API or a live host (FACTS says `VERIFIED-LIVE`). */
export const live = (facts: string, note?: string): Proof => ({
  status: 'verified',
  via: ['live'],
  facts,
  ...(note ? { note } : {}),
});

/** Both: source and a live check. */
export const both = (facts: string, note?: string): Proof => ({
  status: 'verified',
  via: ['source', 'live'],
  facts,
  ...(note ? { note } : {}),
});

/**
 * Read in the code of something other than FluxOS: the `@runonflux/flux-cloud-mcp` package (`mcp`) or the shipped
 * FluxCloud console (`console`), FACTS 15.1 and 15.2. The evidence line then names that code instead of FluxOS.
 */
export const inCode = (
  codebase: 'mcp' | 'console',
  facts: string,
  note?: string,
  via: readonly ('source' | 'live')[] = ['source'],
): Proof => ({
  status: 'verified',
  via,
  codebase,
  facts,
  ...(note ? { note } : {}),
});

/** The official docs say so (FACTS says `DOCS-ONLY`). */
export const docs = (facts: string, note?: string): Proof => ({
  status: 'docs',
  facts,
  ...(note ? { note } : {}),
});

/** An inference or something nobody tested. `note` says exactly what is not known. */
export const guess = (facts: string, note: string): Proof => ({ status: 'unverified', facts, note });

/**
 * Which synced prefix (`r:`, `g:`, `s:`) suits which app is design judgement. How each prefix behaves is read in
 * source (FACTS 7.2); the advice built on it is not verified (FACTS 11 rows 14 and 15). Put this on the fix.
 */
export const PREFIX_ADVICE: Proof = guess(
  '11 rows 14 and 15',
  'Which prefix suits which app is our design judgement. How each prefix behaves is read in source.',
);

// ---- checks ------------------------------------------------------------------------------------

export const look = (text: Markup): Check => ({ kind: 'look', text });

export const cmd = (label: string, command: string, expect?: Markup): Check => ({
  kind: 'command',
  label,
  command,
  ...(expect ? { expect } : {}),
});

export const api = (endpoint: string, expect: Markup, label?: string): Check => ({
  kind: 'api',
  endpoint,
  expect,
  ...(label ? { label } : {}),
});

export const forge = (label: string, spec?: SpecExample, expect?: Markup): Check => ({
  kind: 'lab',
  lab: 'spec-forge',
  label,
  ...(spec ? { spec } : {}),
  ...(expect ? { expect } : {}),
});

export const lab = (id: string, label: string, expect?: Markup): Check => ({
  kind: 'lab',
  lab: id,
  label,
  ...(expect ? { expect } : {}),
});

// ---- fixes -------------------------------------------------------------------------------------

export const fix = (text: Markup, extra: Omit<Fix, 'text'> = {}): Fix => ({ text, ...extra });

export const fixJson = (text: Markup, code: string, label?: string, proof?: Proof): Fix => ({
  text,
  snippet: { lang: 'json', code, ...(label ? { label } : {}) },
  ...(proof ? { proof } : {}),
});

export const fixSh = (text: Markup, code: string, label?: string, proof?: Proof): Fix => ({
  text,
  snippet: { lang: 'sh', code, ...(label ? { label } : {}) },
  ...(proof ? { proof } : {}),
});

export const fixForge = (text: Markup, label: string, spec?: SpecExample): Fix => ({
  text,
  lab: { lab: 'spec-forge', label, ...(spec ? { spec } : {}) },
});
