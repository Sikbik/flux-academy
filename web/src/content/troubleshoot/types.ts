/**
 * The troubleshooting data model.
 *
 * Troubleshooting content is DATA: a list of symptoms, each with ranked causes, each cause with how to
 * check it and how to fix it. The page (`routes/troubleshoot`) renders it; `content/troubleshoot.test.ts`
 * proves every reference resolves. Facts come from docs/research/FACTS.md and nowhere else: every cause
 * carries a `Proof` that says where in FACTS the claim lives and how it was verified.
 *
 * Voice: calm, exact, no jokes. No em dashes, no emoji, no exclamation marks in prose (a quoted UI string
 * may keep its own punctuation, and says so by being in `ErrorString.text`).
 */

import type { FluxAppSpec } from '@shared/flux/types';
import type { DeepPartial, Markup } from '@/learn/types';

// ---------------------------------------------------------------------------
// Stages: when in the journey you are stuck
// ---------------------------------------------------------------------------

export const STAGE_IDS = [
  'before',
  'validation',
  'installing',
  'running',
  'domains',
  'cost',
  'data',
  'git',
  'agents',
] as const;
export type StageId = (typeof STAGE_IDS)[number];

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * How well a claim is established. This mirrors the tags in FACTS.md:
 * - `verified`  read in FluxOS or FDM source and/or observed on the live API (`via` says which)
 * - `docs`      the official docs say so and nothing contradicted it, but it was not checked against source
 * - `unverified` an inference, a guess or something nobody tested; `note` says exactly what is unknown
 */
export type ProofStatus = 'verified' | 'docs' | 'unverified';

export interface Proof {
  status: ProofStatus;
  /** For `verified`: how. */
  via?: readonly ('source' | 'live')[];
  /**
   * For `verified` through `source`: whose code was read, when it is not FluxOS. `mcp` is the
   * `@runonflux/flux-cloud-mcp` package, `console` the shipped FluxCloud console front end (FACTS 15.1, 15.2).
   * The page says so in the evidence line instead of claiming the FluxOS source.
   */
  codebase?: 'mcp' | 'console';
  /** Where in docs/research/FACTS.md the claim is, for example `11 row 4` or `6.4`. */
  facts: string;
  /** What is not known (required for `unverified`) or a caveat that travels with a verified claim. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Examples a lab can open
// ---------------------------------------------------------------------------

/** A starting spec for the Spec Forge: a named fixture, with a patch merged over it. */
export interface SpecExample {
  /** `FIXTURES` id in shared/flux/fixtures.ts. */
  fixture: string;
  /** Merged over the fixture. Objects merge, arrays of objects merge by index, other arrays replace. */
  patch?: DeepPartial<FluxAppSpec>;
  /** Top-level keys to delete after the patch (to show a missing field). */
  omit?: readonly string[];
  /** Lint codes this example is meant to raise. A test lints the result and requires each of them. */
  shows?: readonly string[];
}

// ---------------------------------------------------------------------------
// Checks and fixes
// ---------------------------------------------------------------------------

/**
 * How to find out whether a cause is the one. `{app}` and `{domain}` in text, commands and paths are filled
 * from the visitor's own app name and domain when they have typed them.
 */
export type Check =
  /** Something to look at in the FluxCloud UI or in your own project. */
  | { kind: 'look'; text: Markup }
  /** A shell command to run on your own machine. */
  | { kind: 'command'; label: string; command: string; expect?: Markup }
  /** A read-only public API call from FACTS section 10. The URL is built from the endpoint registry. */
  | { kind: 'api'; endpoint: string; expect: Markup; label?: string }
  /** A lab, optionally with a spec loaded. */
  | { kind: 'lab'; lab: string; label: string; spec?: SpecExample; expect?: Markup };

export interface Fix {
  /** What to do, in one or two sentences. */
  text: Markup;
  /** Something to copy and paste. */
  snippet?: { lang: 'json' | 'sh' | 'dockerfile' | 'text'; code: string; label?: string };
  /** A lab (usually the Spec Forge) that shows the fix, optionally with a spec loaded. */
  lab?: { lab: string; label: string; spec?: SpecExample };
  /**
   * The evidence for this one fix, when it is weaker than the cause it belongs to. A cause can be read in
   * source while the advice for it is our judgement: the cause carries the first, the fix the second.
   */
  proof?: Proof;
}

// ---------------------------------------------------------------------------
// Causes and symptoms
// ---------------------------------------------------------------------------

/**
 * How often this is the cause. It is the author's judgement, not a measurement (the page says so),
 * except where `proof` cites live data.
 */
export type Likelihood = 'usual' | 'common' | 'possible' | 'rare';

export interface Cause {
  /** Unique inside the symptom. */
  id: string;
  /** A short statement of what is wrong, as a noun phrase or a sentence fragment. */
  title: string;
  /** Why it produces this symptom: one to three sentences. */
  why: Markup;
  likelihood: Likelihood;
  /** At least one. */
  checks: Check[];
  /** At least one. */
  fixes: Fix[];
  proof: Proof;
  /** Lint codes (shared/flux `LINT_CODES`) the Spec Forge raises for this cause. */
  lint?: string[];
  /** Lesson ids that teach it. */
  lessons?: string[];
  /** Glossary ids worth reading. */
  terms?: string[];
  /** Other symptom ids to read next when this cause points at them. */
  see?: string[];
}

export interface Symptom {
  /** URL-safe, permanent: it is the hash of the deep link (`/troubleshoot#<id>`). */
  id: string;
  stage: StageId;
  /** What the person would say: "My app is stuck installing". */
  title: string;
  /** One line: what you see. */
  summary: string;
  /** Exact strings or states a person may see. Searchable. */
  seen: string[];
  /** Extra search words and phrases. */
  keywords: string[];
  /** The short answer, visible without scrolling. One or two sentences. */
  quick: Markup;
  /** Ranked, most likely first. At least two. */
  causes: Cause[];
  /** Lessons that teach this properly. */
  lessons: string[];
  /** Labs worth opening. */
  labs?: string[];
  /** Other symptom ids. */
  related?: string[];
  /** Lint codes involved, for the reverse link from the code lookup. */
  lint?: string[];
  /**
   * What the evidence line says the claims were checked against, when it is not FluxOS 8.20.0: for example
   * the Orbit docs and the live specs. Shown after the date under the short answer.
   */
  checkedAgainst?: string;
  /** One honest caveat for the whole symptom (what we do not know). Shown under the causes. */
  caveat?: Markup;
  /**
   * A note that belongs right under the short answer, ahead of the causes: a warning that stops a costly
   * mistake (paying twice) or a misconception to clear. Use it sparingly.
   */
  notice?: { title: string; text: Markup };
}

// ---------------------------------------------------------------------------
// The error message decoder
// ---------------------------------------------------------------------------

/** Where a message shows up. */
export type ErrorSource = 'validator' | 'fluxcloud' | 'api' | 'node-log' | 'payment' | 'orbit' | 'mcp';

export interface ErrorString {
  id: string;
  /**
   * The text exactly as FACTS gives it. A value that changes is written in braces, for example
   * `Minimum number of instances is {n}`. A quote with an elision keeps its `...`.
   */
  text: string;
  /**
   * Lower case fragments that must all appear (in any order) for a pasted message to match. Defaults to
   * the literal parts of `text`. Use it when `text` has an elision or two variants.
   */
  match?: string[];
  source: ErrorSource;
  /** Where you see it, in a few words. */
  where: string;
  /** What it means and what to do, one to three sentences. */
  means: Markup;
  /** The symptom that goes with it. */
  symptom?: string;
  /** Lint codes that say the same thing. */
  lint?: string[];
  proof: Proof;
}

// ---------------------------------------------------------------------------
// The index the command deck searches
// ---------------------------------------------------------------------------

export interface TroubleshootIndexEntry {
  id: string;
  title: string;
  summary: string;
  /** Where it lives, for example `/troubleshoot#app-stuck-installing`. */
  path: string;
  /** What sort of entry it is, so the deck can group and label results. */
  kind?: 'symptom' | 'message' | 'code';
}
