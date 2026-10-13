/**
 * Integrity of the reference content: everything it points at exists, every string is well formed and
 * obeys the voice rules, and the field reference covers the engine's keys exactly.
 */

import { LABS, LESSONS } from '@shared/curriculum';
import { LIMITS, LINT_CODES } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { ART } from '@/content/art';
import { hasTerm } from '@/learn/glossary';
import { markupRefs, parseMarkup } from '@/learn/markup';
import * as agents from './agents';
import { buildAcademyRoutes, buildBudget, buildHosts, buildMisleading } from './api';
import { buildBindingFacts, buildCommonImages, buildStaticNotes, buildWebNotes } from './docker';
import { ENDPOINTS } from './endpoints.data';
import { VERSION_HISTORY } from './facts';
import { FACT_TABLES, TROUBLE_TABLES } from './index';
import { buildBannedRows, buildCustomDomainSteps, buildRequestPath } from './networking';
import * as orbit from './orbit';
import {
  buildAppFields,
  buildComponentFields,
  buildExpireRows,
  buildGeoForms,
  buildGeoPitfalls,
  buildMountForms,
  buildPriceSteps,
  buildStorageGuarantees,
  buildStorageMechanics,
  WHOLE_SPEC_CODES,
} from './spec';
import { TOPICS } from './topics';
import { TOPIC_IDS, type TroubleRow } from './types';

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

const FIELDS = [...buildAppFields(), ...buildComponentFields()];
const TROUBLE: TroubleRow[] = TROUBLE_TABLES.flatMap((t) => t.rows());

/** What the Orbit page prints that is data. */
function orbitData(): unknown {
  return [
    orbit.buildGlanceLines(),
    orbit.buildGlanceTiles(),
    orbit.buildPlanRows(),
    orbit.buildPlanFacts(),
    orbit.buildCustomRows(),
    orbit.buildCustomPriceRows(),
    orbit.buildCustomFacts(),
    orbit.buildDeploySteps(),
    orbit.buildStatusStages(),
    orbit.buildDeployFacts(),
    (['starter', 'standard', 'pro'] as const).map((id) => orbit.buildSpecView(id)),
    orbit.buildVariableRows(),
    orbit.buildVariableFacts(),
    orbit.buildButtonParams(),
    orbit.buildButtonFacts(),
    orbit.buildWebhookFacts(),
    orbit.buildMarkerRows(),
    orbit.buildSampleRows(),
    orbit.buildNetworkFacts(),
    orbit.buildLimitFacts(),
    orbit.buildNotPublished(),
    orbit.buildOrbitMcpText(),
  ];
}

/** What the Agents page prints that is data. */
function agentsData(): unknown {
  return [
    agents.buildRiskFilters(),
    agents.buildGlanceTiles(),
    agents.buildGlanceFacts(),
    agents.buildServerRows(),
    agents.buildConnectionRows(),
    agents.buildConfigSamples(),
    agents.buildConnectingFacts(),
    agents.buildToolEntries('flux-cloud'),
    agents.buildToolEntries('orbit'),
    agents.buildHostedKeyArgs(),
    agents.buildFluxCloudToolFacts(),
    agents.buildOrbitToolFacts(),
    agents.buildConfirmSteps(),
    agents.buildConfirmFacts(),
    agents.buildKeyFacts(),
    agents.buildKeyNeeds(),
    agents.buildHostedFacts(),
    agents.buildSpendFacts(),
    agents.buildPolicyRows(),
    agents.CONSOLE_TOOL_GROUPS,
    agents.CONSOLE_NEVER,
    agents.buildConsoleFacts(),
    agents.buildGapRows(),
    agents.buildEstimateRows(),
    agents.buildGapNotes(),
  ];
}

/** Everything the pages print that is data, as one tree. */
function everything(): unknown {
  return {
    topics: TOPICS,
    fields: FIELDS,
    geo: [buildGeoForms(), buildGeoPitfalls()],
    mounts: [buildMountForms(), buildStorageGuarantees(), buildStorageMechanics()],
    expire: buildExpireRows(),
    steps: buildPriceSteps(),
    versions: VERSION_HISTORY,
    request: buildRequestPath(),
    banned: buildBannedRows(),
    domainSteps: buildCustomDomainSteps(),
    facts: FACT_TABLES.map((t) => t.rows()),
    trouble: TROUBLE,
    endpoints: ENDPOINTS,
    hosts: buildHosts(),
    budget: buildBudget(),
    misleading: buildMisleading(),
    academy: buildAcademyRoutes(),
    docker: [buildWebNotes(), buildStaticNotes(), buildBindingFacts(), buildCommonImages()],
    orbit: orbitData(),
    agents: agentsData(),
  };
}

const ALL = strings(everything());

/** Protocol constants, allowed in prose. */
const HTTP_STATUS = new Set(['200', '202', '400', '403', '404', '410', '413', '429', '502', '503', '504']);

describe('voice', () => {
  it('has no em dash, en dash or emoji', () => {
    const bad = ALL.filter((s) => /[–—]|\p{Extended_Pictographic}/u.test(s));
    expect(bad).toEqual([]);
  });

  it('has no unbalanced or unknown markup', () => {
    const bad = ALL.filter((s) => parseMarkup(s).problems.length > 0);
    expect(bad).toEqual([]);
  });

  it('keeps sentences plain: no exclamation marks and no hype words', () => {
    const hype =
      /!|\b(?:seamless(?:ly)?|revolutionary|blazing|supercharge|unleash|game-?changing|effortless(?:ly)?)\b/i;
    const bad = ALL.filter((s) => hype.test(s.replace(/a!c/g, '')));
    expect(bad).toEqual([]);
  });
});

describe('references resolve', () => {
  it('every glossary term, lesson and lab in the markup exists', () => {
    const lessons = new Set(LESSONS.map((l) => l.id));
    const labs = new Set(LABS.map((l) => l.id));
    const missing: string[] = [];
    for (const s of ALL) {
      const refs = markupRefs(s);
      for (const t of refs.terms) if (!hasTerm(t)) missing.push(`term ${t}`);
      for (const l of refs.lessons) if (!lessons.has(l)) missing.push(`lesson ${l}`);
      for (const l of refs.labs) if (!labs.has(l)) missing.push(`lab ${l}`);
    }
    expect(missing).toEqual([]);
  });

  it('every lesson a field names exists', () => {
    const lessons = new Set(LESSONS.map((l) => l.id));
    const missing = FIELDS.flatMap((f) =>
      f.lessons.filter((l) => !lessons.has(l)).map((l) => `${f.id}: ${l}`),
    );
    expect(missing).toEqual([]);
  });

  it('every lint code a field or a table names exists', () => {
    const known = new Set(Object.keys(LINT_CODES));
    const named = [...FIELDS.flatMap((f) => f.lint), ...TROUBLE.flatMap((t) => t.lint)];
    expect(named.filter((c) => !known.has(c))).toEqual([]);
  });

  it('every topic art id exists in the art manifest', () => {
    const known = new Set(Object.keys(ART));
    expect(TOPICS.filter((t) => !known.has(t.art)).map((t) => t.id)).toEqual([]);
  });

  it('every provenance is one of the five kinds', () => {
    const kinds = new Set(['source', 'live', 'docs', 'inference', 'unverified']);
    const all = [
      ...FIELDS.flatMap((f) => f.prov),
      ...TROUBLE.flatMap((t) => t.prov),
      ...FACT_TABLES.flatMap((t) => t.rows().flatMap((r) => r.prov)),
      ...ENDPOINTS.flatMap((e) => e.prov),
    ];
    expect(all.filter((p) => !kinds.has(p))).toEqual([]);
  });
});

describe('the field reference covers the engine', () => {
  it('documents every top level key, in the engine order', () => {
    expect(buildAppFields().map((f) => f.key)).toEqual([...LIMITS.appKeys]);
  });

  it('documents every component key, in the engine order', () => {
    expect(buildComponentFields().map((f) => f.key)).toEqual([...LIMITS.componentKeys]);
  });

  it('gives every field a unique id, a lesson and a lint code', () => {
    const ids = FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FIELDS) {
      expect(f.lessons.length, `${f.id} lessons`).toBeGreaterThan(0);
      expect(f.lint.length, `${f.id} lint`).toBeGreaterThan(0);
      expect(f.mistake.length, `${f.id} mistake`).toBeGreaterThan(0);
      expect(f.limits.length, `${f.id} limits`).toBeGreaterThan(0);
    }
  });

  it('names every lint code somewhere a reader can find it', () => {
    const guarded = new Set([...FIELDS.flatMap((f) => f.lint), ...TROUBLE.flatMap((t) => t.lint)]);
    const loose = Object.keys(LINT_CODES).filter((c) => !guarded.has(c));
    // A code about the whole spec has no single field. The page lists those under "At a glance".
    expect(loose.filter((c) => !WHOLE_SPEC_CODES.includes(c))).toEqual([]);
  });
});

describe('topics', () => {
  it('lists the topics in order with unique section ids', () => {
    expect(TOPICS.map((t) => t.id)).toEqual([...TOPIC_IDS]);
    for (const t of TOPICS) {
      const ids = t.sections.map((s) => s.id);
      expect(new Set(ids).size, `${t.id} section ids`).toBe(ids.length);
      expect(t.sections.filter((s) => s.level === 2).length).toBeGreaterThan(3);
      for (const h of t.highlights) expect(ids, `${t.id} highlight`).toContain(h.anchor);
    }
  });

  it('keeps the page headings equal to the route titles', async () => {
    const { routeMeta } = await import('@shared/site');
    for (const t of TOPICS) expect(routeMeta(t.path)?.title).toBe(t.heading);
  });

  it('puts no number of two or more digits in a lead, a summary or a promise', () => {
    const text = TOPICS.flatMap((t) => [t.lead, t.promise, ...t.sections.map((s) => s.summary)]);
    const typed = (s: string) => [...s.matchAll(/(?<![\w.#-])\d{2,}/g)].some((m) => !HTTP_STATUS.has(m[0]));
    expect(text.filter(typed)).toEqual([]);
  });
});
