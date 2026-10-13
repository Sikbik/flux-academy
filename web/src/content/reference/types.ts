/**
 * The shapes of the Reference section's content.
 *
 * Reference content is DATA, built by functions so a number always comes from the engine
 * (`shared/flux`) at the moment it is built, never from a copy typed here. Prose strings use the
 * lesson inline markup (`**bold**`, `` `code` ``, `{{term:id}}`, `{{lesson:id}}`, `{{lab:id}}`,
 * `[label](https://...)`); the page renders them with `MarkupText`. No em dashes, no emoji.
 *
 * Framework-free: nothing here imports React, so the command deck can import `REFERENCE_INDEX`
 * cheaply.
 */

import type { ArtId } from '@/content/art';

export type TopicId = 'spec' | 'networking' | 'docker' | 'api' | 'orbit' | 'agents';

export const TOPIC_IDS: readonly TopicId[] = ['spec', 'networking', 'docker', 'api', 'orbit', 'agents'];

/**
 * How well a statement is known. These map onto FACTS.md tags and are always shown with words:
 *
 * - `source`      read in the FluxOS 8.20.0 source (VERIFIED-SOURCE)
 * - `live`        observed on the live API on 2026-10-12 (VERIFIED-LIVE)
 * - `docs`        stated in Flux's documentation only (DOCS-ONLY)
 * - `inference`   reasoned from source or from standard Docker behaviour, not tested on Flux
 * - `unverified`  FACTS.md marks it UNVERIFIED: treat as guidance, not as established behaviour
 */
export type Provenance = 'source' | 'live' | 'docs' | 'inference' | 'unverified';

export interface SectionMeta {
  /** The element id and URL fragment: `#component-ports`. Lower kebab case. */
  id: string;
  title: string;
  /** One plain sentence. Shown in the contents rail tooltip and used by search. */
  summary: string;
  /** Extra words that should find this section. */
  keywords?: readonly string[];
  /** 2 for a section, 3 for a subsection (nested under the previous level 2). */
  level: 2 | 3;
}

export interface TopicMeta {
  id: TopicId;
  /** `/reference/spec` */
  path: string;
  /** Short name used in navigation and breadcrumbs: "Application spec". */
  name: string;
  /** The page's one `h1`. */
  heading: string;
  /** One line on the index card. */
  promise: string;
  /** The paragraph under the `h1`. Markup. */
  lead: string;
  art: ArtId;
  /** A glyph name from the design system. */
  glyph: 'code' | 'route' | 'container' | 'terminal' | 'layers' | 'shield';
  sections: readonly SectionMeta[];
  /** Up to three deep links shown on the index card. */
  highlights: readonly { label: string; anchor: string }[];
  /**
   * What the page was checked against, when that is not the FluxOS source and the API read of the other
   * pages. The frame prints `text`, then the date. Pages built from a vendor catalogue (Orbit, the MCP
   * servers) use it so the line under the heading says what was read and when.
   */
  basis?: { text: string; date: string };
}

/**
 * One searchable thing of a page whose content is built lazily (Orbit, Agents and MCP). The page body and the
 * engine catalogues it reads are a separate chunk, so the index carries only this compact record: where it
 * sits, its title and one plain line. A test per page keeps the seeds in step with the catalogues and with the
 * element ids the page renders.
 */
export interface SearchSeed {
  topic: TopicId;
  /** The element id on the page. */
  anchor: string;
  /** The id of the section the element sits in, for the result's group line. */
  section: string;
  kind: ReferenceKind;
  title: string;
  /** One plain sentence, no markup, no number of two digits or more that an engine holds. */
  summary: string;
  keywords?: readonly string[];
  /** Set when the statement is not fully known: it then appears in the page's Unverified list. */
  prov?: readonly Provenance[];
}

/** One row of the field reference. */
export interface FieldDoc {
  /** The JSON key, for example `ports`. */
  key: string;
  scope: 'app' | 'component';
  /** `app-instances` or `component-ports`. */
  id: string;
  /** `integer`, `string`, `array of integers`, ... */
  type: string;
  /** Short and exact: `yes`, `yes, may be empty`, `no`. */
  required: string;
  /** What the FluxCloud form or the Academy's default spec puts there. Markup. */
  defaultValue: string;
  /** Each a short statement of a limit or rule. Markup. */
  limits: readonly string[];
  /** What it does, one or two sentences. Markup. */
  summary: string;
  /** One line: the mistake to avoid. Markup. */
  mistake: string;
  /** Lesson ids that teach it (shared/curriculum.ts). */
  lessons: readonly string[];
  /** Lint codes that guard it (shared/flux LINT_CODES). */
  lint: readonly string[];
  prov: readonly Provenance[];
  /** An extra paragraph for the expanded row. Markup. */
  note?: string;
}

/** A search and deep-link target. */
export type ReferenceKind = 'page' | 'section' | 'field' | 'lint' | 'endpoint' | 'tool' | 'fact';

export interface ReferenceEntry {
  /** Unique and stable: `spec/component-ports`, `lint/PORT_BANNED`. */
  id: string;
  kind: ReferenceKind;
  topic: TopicId;
  /** The element id inside the page. Empty for a page entry. */
  anchor: string;
  /** Where it lives: `/reference/spec#component-ports`. */
  path: string;
  title: string;
  /** Where it sits: `Application spec, component fields`. */
  group: string;
  /** One plain sentence, no markup. */
  summary: string;
  /** Extra words that should find it (field names, codes, synonyms). */
  keywords: readonly string[];
  /** Plain text the search also reads. Not shown. */
  text: string;
  /** How well the statement is known, when the entry is one statement. Drives the "Unverified" list. */
  prov?: readonly Provenance[];
}

/** A statement with its provenance: a row of a facts table or an item of a list. */
export interface FactRow {
  /** Stable, unique inside its list. Used for anchors and keys. */
  id: string;
  /** The short subject: "Binding inside the container". Markup allowed. */
  label: string;
  /** The statement. Markup. */
  text: string;
  prov: readonly Provenance[];
}

/** One row of a "what you see, why, what to do" table. */
export interface TroubleRow {
  id: string;
  /** What the person sees. Markup. */
  symptom: string;
  /** Why it happens. Markup. */
  cause: string;
  /** What to do. Markup. */
  fix: string;
  /** Lint codes that catch it before registration (shared/flux LINT_CODES). */
  lint: readonly string[];
  prov: readonly Provenance[];
}

/** A lint code row for the lint index: the engine's own text plus where the reference links to it. */
export interface LintRow {
  code: string;
  title: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  why: string;
  fix: string;
  /** The field docs that list this code (`component-ports`), for "guards" links. */
  fields: readonly string[];
}

// ---------------------------------------------------------------------------
// The read-only API
// ---------------------------------------------------------------------------

export type ApiGroupId = 'network' | 'blocks' | 'nodes' | 'apps' | 'prices';

export const API_GROUP_IDS: readonly ApiGroupId[] = ['network', 'blocks', 'nodes', 'apps', 'prices'];

/** `gateway` is api.runonflux.io, `stats` is stats.runonflux.io. */
export type ApiHostId = 'gateway' | 'stats';

export interface EndpointParam {
  name: string;
  where: 'path' | 'query' | 'body';
  required: boolean;
  /** Markup. */
  text: string;
}

export interface Endpoint {
  /** Stable anchor: `daemon-getblockcount`. */
  id: string;
  group: ApiGroupId;
  method: 'GET' | 'POST';
  host: ApiHostId;
  /** The route, with `:name` for path parameters: `/apps/location/:appname`. */
  path: string;
  /** A concrete path and query that works, used for the curl line. */
  example: string;
  title: string;
  /** One plain sentence. */
  summary: string;
  /** What `data` holds. Markup. */
  returns: string;
  params: readonly EndpointParam[];
  /** Server cache, as FACTS states it: "30 s", "none". */
  cache: string;
  /** Decoded body size at the time of testing: "35 bytes", "2.9 MB". */
  size: string;
  /** Key into the samples: the file name without `.json`. */
  sample: string;
  /** Extra statements. Markup. */
  notes: readonly string[];
  /** A warning shown above the sample. Markup. */
  warning?: string;
  /** Answers about the node that served the request, not about the network. */
  nodeLocal?: boolean;
  /** Add `--compressed` to the curl line. */
  compressed?: boolean;
  prov: readonly Provenance[];
}
