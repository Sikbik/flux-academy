/**
 * The Reference content, as data. The command deck imports `REFERENCE_INDEX` from here; the reference
 * pages import the builders directly.
 *
 *   REFERENCE_INDEX   every searchable thing, typed `ReferenceEntry[]`:
 *                       { id, kind, topic, anchor, path, title, group, summary, keywords, text }
 *                     `path` is a site path with the fragment (`/reference/spec#component-ports`), so
 *                     `navigate(entry.path)` is all a consumer needs. `kind` is one of
 *                     page | section | field | lint | endpoint | tool | fact.
 *   TOPICS            the pages, in order.
 *   searchReference   ranked search over any list of entries (see search.ts).
 *
 * Importing this module builds the index once and pulls the engine in (`@shared/flux`), but no React and
 * none of the API samples.
 */

import { LINT_CODES, lintBasis } from '@shared/flux';
import { AGENTS_SEEDS } from './agents.search';
import { anchor } from './anchors';
import {
  buildAcademyRoutes,
  buildBudget,
  buildEnvelopeFacts,
  buildExcluded,
  buildHostFacts,
  buildHosts,
  buildLimitFacts,
  buildMisleading,
} from './api';
import { plain } from './derive';
import {
  buildArchitectureFacts,
  buildBindingFacts,
  buildCommonImages,
  buildDockerTrouble,
  buildEnvFacts,
  buildHealthFacts,
  buildImageNameFacts,
  buildLogFacts,
  buildRegistryFacts,
  buildSizeFacts,
  buildStatelessFacts,
  buildTagFacts,
  buildUserFacts,
} from './docker';
import { API_GROUPS, ENDPOINTS } from './endpoints.data';
import { VERSION_HISTORY } from './facts';
import {
  buildBannedRows,
  buildCustomDomainSteps,
  buildDnsNotes,
  buildEnvironmentFacts,
  buildGeneratedDomainFacts,
  buildInternalFacts,
  buildLinkFacts,
  buildLoadBalancingFacts,
  buildNetworkTrouble,
  buildNonHttpFacts,
  buildPortFacts,
  buildRequestPath,
} from './networking';
import { ORBIT_SEEDS } from './orbit.search';
import {
  buildAppFields,
  buildCaps,
  buildComponentFields,
  buildEnterpriseFacts,
  buildExpireFacts,
  buildExpireRows,
  buildGeoForms,
  buildGeoPitfalls,
  buildGlanceMistakes,
  buildMountForms,
  buildPriceSteps,
  buildStorageGuarantees,
  buildStorageMechanics,
} from './spec';
import { TOPICS, topicById } from './topics';
import type { FactRow, Provenance, ReferenceEntry, TopicId, TroubleRow } from './types';

export { anchor, fragmentId } from './anchors';
export { type SearchHit, type SearchOptions, searchReference } from './search';
export { neighbours, TOPICS, topicById } from './topics';
export type {
  FieldDoc,
  Provenance,
  ReferenceEntry,
  ReferenceKind,
  SectionMeta,
  TopicId,
  TopicMeta,
} from './types';

// ---------------------------------------------------------------------------
// Which lists feed which sections
// ---------------------------------------------------------------------------

interface FactTableDef {
  topic: TopicId;
  /** The section the table sits in: it is the id prefix of every row. */
  section: string;
  rows: () => FactRow[];
}

/** The facts tables of the pages. The pages render the same lists under the same section ids. */
export const FACT_TABLES: readonly FactTableDef[] = [
  { topic: 'spec', section: 'nodes-and-enterprise', rows: buildEnterpriseFacts },
  { topic: 'spec', section: 'expire', rows: buildExpireFacts },
  { topic: 'networking', section: 'public-and-container-ports', rows: buildPortFacts },
  { topic: 'networking', section: 'internal-dns', rows: buildInternalFacts },
  { topic: 'networking', section: 'linking-apps', rows: buildLinkFacts },
  { topic: 'networking', section: 'generated-domains', rows: buildGeneratedDomainFacts },
  { topic: 'networking', section: 'custom-domains', rows: buildDnsNotes },
  { topic: 'networking', section: 'load-balancing', rows: buildLoadBalancingFacts },
  { topic: 'networking', section: 'non-http', rows: buildNonHttpFacts },
  { topic: 'networking', section: 'environment', rows: buildEnvironmentFacts },
  { topic: 'docker', section: 'image-names', rows: buildImageNameFacts },
  { topic: 'docker', section: 'pin-tags', rows: buildTagFacts },
  { topic: 'docker', section: 'architecture', rows: buildArchitectureFacts },
  { topic: 'docker', section: 'registries', rows: buildRegistryFacts },
  { topic: 'docker', section: 'size-and-startup', rows: buildSizeFacts },
  { topic: 'docker', section: 'binding', rows: buildBindingFacts },
  { topic: 'docker', section: 'environment-variables', rows: buildEnvFacts },
  { topic: 'docker', section: 'users-and-permissions', rows: buildUserFacts },
  { topic: 'docker', section: 'logs', rows: buildLogFacts },
  { topic: 'docker', section: 'health', rows: buildHealthFacts },
  { topic: 'docker', section: 'stateless', rows: buildStatelessFacts },
  { topic: 'api', section: 'base-urls', rows: buildHostFacts },
  { topic: 'api', section: 'envelope', rows: buildEnvelopeFacts },
  { topic: 'api', section: 'limits', rows: buildLimitFacts },
  { topic: 'api', section: 'left-out', rows: buildExcluded },
];

interface TroubleTableDef {
  topic: TopicId;
  section: string;
  rows: () => TroubleRow[];
}

export const TROUBLE_TABLES: readonly TroubleTableDef[] = [
  { topic: 'networking', section: 'networking-trouble', rows: buildNetworkTrouble },
  { topic: 'docker', section: 'docker-trouble', rows: buildDockerTrouble },
];

/** Sections that hold an interactive tool, so a search result says "tool". */
const TOOL_SECTIONS: ReadonlySet<string> = new Set([
  'annotated-example',
  'geolocation-try',
  'container-data-try',
  'pricing-example',
  'validate',
  'check-a-port',
  'try-an-image',
  'try-it',
  'deploy-button-builder',
]);

// ---------------------------------------------------------------------------
// Building the index
// ---------------------------------------------------------------------------

function oneLine(markup: string, max = 180): string {
  const text = plain(markup).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return stop > 60 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, '')}...`;
}

function pathOf(topic: TopicId, fragment: string): string {
  const base = topicById(topic)?.path ?? `/reference/${topic}`;
  return fragment ? `${base}#${fragment}` : base;
}

export function buildReferenceIndex(): ReferenceEntry[] {
  const out: ReferenceEntry[] = [];
  const add = (e: Omit<ReferenceEntry, 'path' | 'id'> & { id?: string }): void => {
    out.push({
      ...e,
      id: e.id ?? `${e.topic}/${e.anchor}`,
      path: pathOf(e.topic, e.anchor),
    });
  };
  const sectionTitle = (topic: TopicId, section: string): string =>
    topicById(topic)?.sections.find((s) => s.id === section)?.title ?? section;
  const groupOf = (topic: TopicId, section: string): string =>
    `${topicById(topic)?.name ?? topic}, ${sectionTitle(topic, section)}`;

  // Pages and sections.
  for (const t of TOPICS) {
    add({
      id: `page/${t.id}`,
      kind: 'page',
      topic: t.id,
      anchor: '',
      title: t.heading,
      group: 'Reference',
      summary: t.promise,
      keywords: [t.name, t.id, ...t.sections.filter((s) => s.level === 2).map((s) => s.title)],
      text: `${plain(t.lead)} ${t.sections.map((s) => s.title).join(' ')}`,
    });
    for (const s of t.sections) {
      add({
        kind: TOOL_SECTIONS.has(s.id) ? 'tool' : 'section',
        topic: t.id,
        anchor: s.id,
        title: s.title,
        group: t.name,
        summary: s.summary,
        keywords: s.keywords ?? [],
        text: s.summary,
      });
    }
  }

  // Fields.
  const fields = [...buildAppFields(), ...buildComponentFields()];
  for (const f of fields) {
    const scopeName = f.scope === 'app' ? 'top level fields' : 'component fields';
    add({
      kind: 'field',
      topic: 'spec',
      anchor: anchor.field(f),
      title: f.key,
      group: `Application spec, ${scopeName}`,
      summary: oneLine(f.summary),
      keywords: [`${f.scope} ${f.key}`, f.type, ...f.lint, ...f.lessons],
      text: plain([f.summary, ...f.limits, f.mistake, f.note ?? '', f.defaultValue, f.required].join(' ')),
      prov: f.prov,
    });
  }

  // Lint codes.
  const fieldsOf = new Map<string, string[]>();
  for (const f of fields) for (const c of f.lint) fieldsOf.set(c, [...(fieldsOf.get(c) ?? []), f.key]);
  for (const meta of Object.values(LINT_CODES)) {
    add({
      kind: 'lint',
      topic: 'spec',
      anchor: anchor.lint(meta.code),
      title: meta.code,
      group: 'Application spec, lint codes',
      summary: meta.title,
      keywords: [meta.title, meta.category, meta.severity, ...(fieldsOf.get(meta.code) ?? [])],
      text: `${meta.why} ${meta.fix}`,
      prov: [lintBasis(meta)],
    });
  }

  // Spec tables.
  const spec = (
    id: string,
    kind: ReferenceEntry['kind'],
    a: string,
    title: string,
    section: string,
    text: string,
    kw: string[] = [],
    prov?: readonly Provenance[],
  ): void =>
    add({
      id,
      kind,
      topic: 'spec',
      anchor: a,
      title,
      group: groupOf('spec', section),
      summary: oneLine(text),
      keywords: kw,
      text: plain(text),
      ...(prov ? { prov } : {}),
    });
  for (const g of buildGeoForms()) {
    spec(
      `spec/${anchor.geoForm(g.id)}`,
      'fact',
      anchor.geoForm(g.id),
      g.pattern,
      'geolocation-forms',
      `${g.meaning} ${g.note ?? ''}`,
      [g.example],
      ['source'],
    );
  }
  for (const g of buildGeoPitfalls()) {
    spec(
      `spec/${anchor.geoPitfall(g.id)}`,
      'fact',
      anchor.geoPitfall(g.id),
      g.entry,
      'geolocation',
      g.text,
      [],
      g.prov,
    );
  }
  for (const m of buildMountForms()) {
    spec(
      `spec/${anchor.mountForm(m.id)}`,
      'fact',
      anchor.mountForm(m.id),
      m.form,
      'container-data-forms',
      `${m.meaning} ${m.note ?? ''}`,
      [m.example],
      m.prov,
    );
  }
  for (const g of buildStorageGuarantees()) {
    spec(
      `spec/${anchor.storage(g.id)}`,
      'fact',
      anchor.storage(g.id),
      `Prefix ${g.prefix}`,
      'container-data-guarantees',
      `${g.lives} ${g.nodeLoss} ${g.consistency}`,
      [],
      g.prov,
    );
  }
  for (const m of buildStorageMechanics()) {
    spec(
      `spec/${anchor.mechanic(m.id)}`,
      'fact',
      anchor.mechanic(m.id),
      m.topic,
      'container-data-mechanics',
      m.fact,
      [],
      m.prov,
    );
  }
  for (const r of buildExpireRows()) {
    spec(
      `spec/${anchor.expire(r.id)}`,
      'fact',
      anchor.expire(r.id),
      r.label,
      'expire',
      `${r.blocks} blocks, ${r.about}`,
      [],
      ['source'],
    );
  }
  for (const p of buildPriceSteps()) {
    spec(
      `spec/${anchor.priceStep(p.id)}`,
      'fact',
      anchor.priceStep(p.id),
      p.title,
      'pricing-steps',
      p.body,
      [],
      p.prov ?? ['source', 'live'],
    );
  }
  for (const v of VERSION_HISTORY) {
    spec(
      `spec/${anchor.version(v.version)}`,
      'fact',
      anchor.version(v.version),
      `Version ${v.version}`,
      'versions',
      `From block ${v.fromBlock}. ${v.added}`,
      [],
      ['source'],
    );
  }

  for (const c of buildCaps()) {
    spec(
      `spec/${anchor.cap(c.id)}`,
      'fact',
      anchor.cap(c.id),
      `${c.label}: ${c.value}`,
      'at-a-glance',
      c.note,
      [c.field],
      ['source'],
    );
  }
  for (const m of buildGlanceMistakes()) {
    spec(
      `spec/${anchor.mistake(m.id)}`,
      'fact',
      anchor.mistake(m.id),
      oneLine(m.text, 90),
      'at-a-glance',
      `${m.text} Caught by ${m.code}.`,
      [m.code, m.field],
      ['source'],
    );
  }

  // Facts tables.
  for (const def of FACT_TABLES) {
    for (const row of def.rows()) {
      add({
        id: `${def.topic}/${anchor.fact(def.section, row.id)}`,
        kind: 'fact',
        topic: def.topic,
        anchor: anchor.fact(def.section, row.id),
        title: plain(row.label),
        group: groupOf(def.topic, def.section),
        summary: oneLine(row.text),
        keywords: [],
        text: plain(row.text),
        prov: row.prov,
      });
    }
  }
  for (const def of TROUBLE_TABLES) {
    for (const row of def.rows()) {
      add({
        id: `${def.topic}/${anchor.trouble(def.section, row.id)}`,
        kind: 'fact',
        topic: def.topic,
        anchor: anchor.trouble(def.section, row.id),
        title: oneLine(row.symptom, 90),
        group: groupOf(def.topic, def.section),
        summary: oneLine(row.fix),
        keywords: [...row.lint],
        text: plain(`${row.symptom} ${row.cause} ${row.fix}`),
        prov: row.prov,
      });
    }
  }

  // Networking tables.
  for (const r of buildBannedRows()) {
    add({
      kind: 'fact',
      topic: 'networking',
      anchor: anchor.banned(r.range.from),
      title: `Banned port ${r.text}`,
      group: groupOf('networking', 'banned-ports'),
      summary: r.usedFor || 'On the banned list of public ports.',
      keywords: ['banned', 'port', r.text],
      text: `${r.text} ${r.usedFor}`,
      prov: ['source', 'live'],
    });
  }
  for (const p of buildRequestPath()) {
    add({
      kind: 'fact',
      topic: 'networking',
      anchor: anchor.pathStep(p.id),
      title: p.title,
      group: groupOf('networking', 'request-path'),
      summary: oneLine(p.text),
      keywords: [],
      text: plain(p.text),
      prov: p.prov,
    });
  }
  for (const d of buildCustomDomainSteps()) {
    add({
      kind: 'fact',
      topic: 'networking',
      anchor: anchor.domainStep(d.id),
      title: d.title,
      group: groupOf('networking', 'custom-domains'),
      summary: oneLine(d.text),
      keywords: [],
      text: plain(d.text),
      prov: d.prov,
    });
  }

  // API.
  for (const e of ENDPOINTS) {
    const group = API_GROUPS.find((g) => g.id === e.group)?.label ?? e.group;
    add({
      kind: 'endpoint',
      topic: 'api',
      anchor: anchor.endpoint(e.id),
      title: `${e.method} ${e.path}`,
      group: `API cheat sheet, ${group}`,
      summary: e.summary,
      keywords: [e.title, e.id, e.host, e.group, ...e.params.map((p) => p.name)],
      text: plain([e.returns, ...e.notes, e.warning ?? '', ...e.params.map((p) => p.text)].join(' ')),
      prov: e.prov,
    });
  }
  for (const h of buildHosts()) {
    add({
      kind: 'fact',
      topic: 'api',
      anchor: anchor.host(h.id),
      title: h.title,
      group: groupOf('api', 'base-urls'),
      summary: oneLine(h.text),
      keywords: [h.url],
      text: `${h.url} ${plain(h.text)}`,
      prov: h.prov,
    });
  }
  for (const b of buildBudget()) {
    add({
      kind: 'fact',
      topic: 'api',
      anchor: anchor.budget(b.id),
      title: b.pattern,
      group: groupOf('api', 'limits'),
      summary: oneLine(b.advice),
      keywords: [],
      text: plain(b.advice),
    });
  }
  for (const m of buildMisleading()) {
    add({
      kind: 'fact',
      topic: 'api',
      anchor: anchor.misleading(m.id),
      title: plain(m.item),
      group: groupOf('api', 'misleading'),
      summary: oneLine(m.status),
      keywords: [],
      text: plain(m.status),
      prov: m.prov,
    });
  }
  for (const a of buildAcademyRoutes()) {
    add({
      kind: 'endpoint',
      topic: 'api',
      anchor: anchor.academy(a.id),
      title: `${a.method} ${a.path}`,
      group: groupOf('api', 'academy-api'),
      summary: oneLine(a.text),
      keywords: [a.shape, 'academy', 'api v1'],
      text: plain(a.text),
    });
  }

  // Orbit and Agents: compact records, because the page bodies and their catalogues are a lazy chunk.
  for (const seed of [...ORBIT_SEEDS, ...AGENTS_SEEDS]) {
    add({
      id: `${seed.topic}/${seed.anchor}`,
      kind: seed.kind,
      topic: seed.topic,
      anchor: seed.anchor,
      title: seed.title,
      group: groupOf(seed.topic, seed.section),
      summary: seed.summary,
      keywords: seed.keywords ?? [],
      text: seed.summary,
      ...(seed.prov ? { prov: seed.prov } : {}),
    });
  }

  // Common images of the docker page.
  for (const c of buildCommonImages()) {
    add({
      kind: 'fact',
      topic: 'docker',
      anchor: anchor.commonImage(c.id),
      title: c.label,
      group: groupOf('docker', 'common-images'),
      summary: `${c.kind}${c.port === null ? '' : `, port ${c.port}`}`,
      keywords: [c.kind, ...c.dataPaths],
      text: `${c.label} ${c.kind} ${c.dataPaths.join(' ')}`,
    });
  }

  return out;
}

/** Every searchable entry of the Reference. Built once, when the module loads. */
export const REFERENCE_INDEX: readonly ReferenceEntry[] = buildReferenceIndex();
