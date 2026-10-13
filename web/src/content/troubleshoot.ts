/**
 * Troubleshooting content: stages, symptoms, the error message decoder, lint examples and the index
 * the command deck searches.
 *
 * The data lives in `content/troubleshoot/*` (one file per stage, plus `errors.ts`, `examples.ts` and the
 * endpoint registry). This module assembles it and exports the lookups the page uses. Facts come from
 * docs/research/FACTS.md only; every cause carries a `Proof`. `content/troubleshoot.test.ts` proves that
 * every referenced lint code, lesson, lab and glossary id exists, that every cause has a check and a fix,
 * and that no text carries an em dash or an emoji.
 *
 * Owner: the reference pages agent. Pages are in `routes/troubleshoot/`.
 */

import { LINT_CODES } from '@shared/flux/lint-catalogue';
import { ERROR_STRINGS } from './troubleshoot/errors';
import { AGENTS_SYMPTOMS } from './troubleshoot/stage-agents';
import { BEFORE_SYMPTOMS } from './troubleshoot/stage-before';
import { COST_SYMPTOMS } from './troubleshoot/stage-cost';
import { DATA_SYMPTOMS } from './troubleshoot/stage-data';
import { DOMAIN_SYMPTOMS } from './troubleshoot/stage-domains';
import { GIT_SYMPTOMS } from './troubleshoot/stage-git';
import { INSTALLING_SYMPTOMS } from './troubleshoot/stage-installing';
import { RUNNING_SYMPTOMS } from './troubleshoot/stage-running';
import { VALIDATION_SYMPTOMS } from './troubleshoot/stage-validation';
import {
  type Proof,
  STAGE_IDS,
  type StageId,
  type Symptom,
  type TroubleshootIndexEntry,
} from './troubleshoot/types';

export {
  cleanApp,
  cleanDomain,
  ENDPOINTS,
  ENDPOINTS_VERIFIED,
  type Endpoint,
  endpointById,
  fillTemplate,
} from './troubleshoot/endpoints';
export { ERROR_SOURCE_LABEL, ERROR_STRINGS, errorStringById } from './troubleshoot/errors';
export {
  buildExampleSpec,
  exampleHref,
  LINT_EXAMPLES,
  mergeSpecValue,
  NEEDS_LIVE_DATA,
  specForgePath,
} from './troubleshoot/examples';
export * from './troubleshoot/types';

/**
 * The date docs/research/FACTS.md was compiled and its claims verified. Shown on every proof chip, except
 * where a stage carries a date of its own (`StageInfo.checkedOn`).
 */
export const FACTS_DATE = '2026-10-12';

/**
 * The date section 15 of FACTS.md (Orbit and Deploy with Git, the FluxCloud server for agents, the Orbit
 * server, the assistant in the console) was read. The Git and agent stages carry it, so their pages say so
 * and the first seven stages keep `FACTS_DATE`.
 */
export const SECTION_15_DATE = '2026-10-13';

/** The FluxOS release the source claims were read from. */
export const FLUXOS_VERSION = '8.20.0';

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export interface StageInfo {
  id: StageId;
  /** Card title. */
  title: string;
  /** One line about when you are here. */
  blurb: string;
  /** A glyph name from the design system (checked by the page). */
  glyph: string;
  /**
   * A way of deploying (Git, an agent) rather than a point in the journey from your first image to a running
   * app. The front door shows these under their own heading, so they are not numbered as the next stage.
   */
  route?: boolean;
  /** The date this stage's claims were read, when it is not `FACTS_DATE`. */
  checkedOn?: string;
}

export const STAGES: readonly StageInfo[] = [
  {
    id: 'before',
    title: 'Before you deploy',
    blurb: 'Your image, an old tutorial, the calculator or your login.',
    glyph: 'image',
  },
  {
    id: 'validation',
    title: 'Validation and payment',
    blurb: 'Review and Validate refused something, or a payment did not count.',
    glyph: 'shield',
  },
  {
    id: 'installing',
    title: 'Installing',
    blurb: 'You paid, and the app is not running yet, or not on every node.',
    glyph: 'hourglass',
  },
  {
    id: 'running',
    title: 'Running',
    blurb: 'It is installed, and it errors, restarts, hangs or goes down.',
    glyph: 'instance',
  },
  {
    id: 'domains',
    title: 'Domains and networking',
    blurb: 'Addresses, your own domain, certificates and traffic between parts.',
    glyph: 'globe',
  },
  {
    id: 'cost',
    title: 'Cost and renewal',
    blurb: 'A price you did not expect, an update fee, expiry or a refund.',
    glyph: 'price',
  },
  {
    id: 'data',
    title: 'Data and updates',
    blurb: 'Files or a database vanished, differ, filled up or need recovering.',
    glyph: 'volume',
  },
  {
    id: 'git',
    title: 'Deploying from Git',
    blurb: 'Orbit and Deploy with Git: the build failed, it will not start, or a push did nothing.',
    glyph: 'route',
    route: true,
    checkedOn: SECTION_15_DATE,
  },
  {
    id: 'agents',
    title: 'Agents and assistants',
    blurb: 'An agent will not connect or did something you did not expect, or the assistant did not deploy.',
    glyph: 'sparkle',
    route: true,
    checkedOn: SECTION_15_DATE,
  },
] as const;

export function stageById(id: StageId): StageInfo {
  const s = STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown troubleshooting stage ${id}`);
  return s;
}

/** The date a problem's claims were checked: the date of its stage, or `FACTS_DATE`. */
export function checkedOnOf(symptom: Pick<Symptom, 'stage'>): string {
  return stageById(symptom.stage).checkedOn ?? FACTS_DATE;
}

// ---------------------------------------------------------------------------
// Symptoms
// ---------------------------------------------------------------------------

const BY_STAGE: Record<StageId, Symptom[]> = {
  before: BEFORE_SYMPTOMS,
  validation: VALIDATION_SYMPTOMS,
  installing: INSTALLING_SYMPTOMS,
  running: RUNNING_SYMPTOMS,
  domains: DOMAIN_SYMPTOMS,
  cost: COST_SYMPTOMS,
  data: DATA_SYMPTOMS,
  git: GIT_SYMPTOMS,
  agents: AGENTS_SYMPTOMS,
};

/** Every symptom, in stage order and then in the order the stage file lists them. */
export const SYMPTOMS: readonly Symptom[] = STAGE_IDS.flatMap((id) => BY_STAGE[id]);

const SYMPTOM_BY_ID = new Map(SYMPTOMS.map((s) => [s.id, s]));

export function symptomById(id: string): Symptom | undefined {
  return SYMPTOM_BY_ID.get(id);
}

export function symptomsOfStage(stage: StageId): readonly Symptom[] {
  return BY_STAGE[stage];
}

/** The id the page uses for a lint code in the URL hash. */
export function codeAnchor(code: string): string {
  return `code-${code}`;
}

/** The id the page uses for an error message in the URL hash. */
export function messageAnchor(id: string): string {
  return `message-${id}`;
}

// ---------------------------------------------------------------------------
// The index for the command deck
// ---------------------------------------------------------------------------

const PATH = '/troubleshoot';

function symptomEntries(): TroubleshootIndexEntry[] {
  return SYMPTOMS.map((s) => ({
    id: s.id,
    title: s.title,
    summary: s.summary,
    path: `${PATH}#${s.id}`,
    kind: 'symptom' as const,
  }));
}

function messageEntries(): TroubleshootIndexEntry[] {
  return ERROR_STRINGS.map((e) => ({
    id: messageAnchor(e.id),
    title: e.text,
    summary: e.where,
    path: `${PATH}#${messageAnchor(e.id)}`,
    kind: 'message' as const,
  }));
}

function codeEntries(): TroubleshootIndexEntry[] {
  return Object.values(LINT_CODES).map((c) => ({
    id: codeAnchor(c.code),
    title: `${c.code}: ${c.title}`,
    summary: c.why,
    path: `${PATH}#${codeAnchor(c.code)}`,
    kind: 'code' as const,
  }));
}

/**
 * What the command deck searches: every symptom first, then the error messages the decoder knows, then
 * the lint codes. Each `path` opens the page on that entry.
 */
export const TROUBLESHOOT_INDEX: readonly TroubleshootIndexEntry[] = [
  ...symptomEntries(),
  ...messageEntries(),
  ...codeEntries(),
];

// ---------------------------------------------------------------------------
// Proof labels (shared by the page and the tests)
// ---------------------------------------------------------------------------

/** The short chip text for a proof: "Source", "Live", "Source and live", "Docs only" or "Unverified". */
export function proofLabel(p: Proof): string {
  if (p.status === 'unverified') return 'Unverified';
  if (p.status === 'docs') return 'Docs only';
  const via = p.via ?? [];
  if (via.includes('source') && via.includes('live')) return 'Source and live';
  if (via.includes('live')) return 'Live';
  return 'Source';
}
