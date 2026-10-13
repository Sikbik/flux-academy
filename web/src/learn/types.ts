/**
 * The lesson content contract.
 *
 * Lessons are DATA, not components. A lesson file (`web/src/content/lessons/<id>.ts`) default-exports a
 * `Lesson`. The lesson engine (`web/src/learn/`) renders it; stages and widgets are looked up by id in
 * registries that other modules fill. Because content is declarative it can be linted, unit tested and
 * (later) served or exported. Authors never write JSX and never write executable predicates.
 *
 * Read docs/CONTENT.md for pedagogy, voice and the definition of done for a lesson.
 *
 * Owner: the lesson-engine agent. Changes are ADDITIVE once content authors start (new optional fields,
 * new union members). Never rename or remove.
 */

import type { FluxAppSpec } from '@shared/flux/types';

/** Recursively optional, for partial specs in stages and fixtures. */
export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

// ---------------------------------------------------------------------------
// Inline markup
// ---------------------------------------------------------------------------

/**
 * Every prose string supports a deliberately tiny inline markup, rendered by one shared component:
 *
 * - `**bold**`, `*italic*`, `` `code` ``
 * - `[label](https://example.com)` external link (opens in a new tab, gets the "opens in a new tab" hint)
 * - `{{term:fdm}}` a glossary term: dotted underline, hover or focus card with the definition. It shows
 *   the term's display name, lower-cased mid-sentence unless the term is `proper`; `{{term:id|lower}}` and
 *   `{{term:id|Cap}}` force the first letter
 * - `{{lesson:first-deploy}}` a link to a lesson (shows its title)
 * - `{{lab:spec-forge}}` a link to a lab (shows its title)
 * - `{{kbd:Ctrl+K}}` a keyboard key cap
 *
 * No HTML, no emoji, no em dashes. Block structure is by array: `body: ['para one', 'para two']`.
 */
export type Markup = string;

export type Terms = string[];

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

export interface Source {
  label: string;
  url: string;
}

export interface Lesson {
  /** Matches `LessonMeta.id` in shared/curriculum.ts. */
  id: string;
  /** One or two sentences: why this matters and what the learner will have at the end. */
  hook: Markup;
  /** "You will be able to ..." statements. Two to four. */
  objectives: Markup[];
  /** Four to nine steps. Each is one idea, one visual, at most one action. */
  steps: Step[];
  /** Two to five graded challenges that close the lesson. */
  checkpoint: Challenge[];
  /** Three to five takeaways, shown on completion. */
  recap: Markup[];
  /** Official docs and further reading. Prefer docs.runonflux.com URLs. */
  further: Source[];
  /** Glossary ids first introduced here (each must exist in content/glossary). */
  terms: Terms;
}

export interface Step {
  /** Unique inside the lesson. Used for deep links (`?step=<id>`) and saved position. */
  id: string;
  title: string;
  /** Plain prose, 25 to 90 words per paragraph, one to three paragraphs. */
  body: Markup[];
  callouts?: Callout[];
  /** The interactive visual that sits beside the text for this step. Persists until the next step sets one. */
  stage?: Stage;
  /** What the learner does before Continue lights up. Absent means the step is read-only. */
  task?: Task;
}

export type CalloutKind = 'why' | 'gotcha' | 'tip' | 'wild' | 'cost';

export interface Callout {
  kind: CalloutKind;
  /** Short label, defaults to the kind's name. */
  title?: Markup;
  body: Markup;
}

// ---------------------------------------------------------------------------
// Stages: what the learner looks at
// ---------------------------------------------------------------------------

export type Stage =
  | DioramaStage
  | SpecStage
  | TerminalStage
  | DiagramStage
  | CodeStage
  | CompareStage
  | WidgetStage;

/**
 * The network diorama: an isometric hex map of nodes. Implemented in web/src/diorama.
 *
 * Scenes
 * - `tiers`     nodes coloured by tier; hover a node for its tier card. Live counts when `live`.
 * - `placement` N instances land on distinct nodes across regions.
 * - `failover`  placement plus nodes you can kill and revive, with request packets and an "up" indicator.
 * - `traffic`   user, domain, proxy and instances, with port and domain labels; send requests.
 * - `sync`      a volume with a primary and standbys; kill the primary and watch promotion.
 * - `deploy`    the whole pipeline as an animation: spec, block, node selection, start, live.
 * - `network`   the real, live global network with country hover and tier filter.
 *
 * Controls: `instances` (slider), `kill` (take a node offline), `kill-region` ("Break region": every node of
 * the chosen continent, else the one holding the most running instances), `revive`, `request`, `region`
 * (the continent chooser) and `replay`.
 */
export interface DioramaStage {
  kind: 'diorama';
  scene: 'tiers' | 'placement' | 'failover' | 'traffic' | 'sync' | 'deploy' | 'network';
  /** Starting number of app instances, where the scene has them. */
  instances?: number;
  /** Controls to show. Omit for a non-interactive illustration. */
  controls?: ('instances' | 'kill' | 'kill-region' | 'revive' | 'request' | 'region' | 'replay')[];
  /** Use real network data (counts, node positions) instead of the built-in sample world. */
  live?: boolean;
  /** Named annotations to draw, as defined per scene in web/src/diorama/README.md. */
  annotate?: string[];
  /** Restrict the scene to a region code (`EU`, `NA`, ...) when it supports it. */
  region?: string;
  /**
   * The volume model of the app's data (FACTS 7): `local` (a plain path, lost with its node), `replicated`
   * (`r:`) or `primary-standby` (`g:`). Omit it for what the scene does on its own (`primary-standby` in
   * `sync`, a plain local volume elsewhere, with no chip). Choosing one names the model in a chip, and
   * `local` in `failover` draws the `lost-data` annotation: an EMPTY DISK tag on a replacement that
   * started after its node was lost.
   */
  volume?: 'local' | 'replicated' | 'primary-standby';
}

/**
 * The spec editor: form, JSON, price and lint, any subset. Implemented by the Spec Forge module.
 * The spec shown is `defaultSpec()` with `spec` merged over it.
 */
export interface SpecStage {
  kind: 'spec';
  spec: DeepPartial<FluxAppSpec>;
  /** JSON paths the learner may change. Omit for fully editable. Use `[]` for a read-only display. */
  editable?: string[];
  /** Paths to annotate with a callout bubble. */
  focus?: { path: string; note: Markup }[];
  /** Panels to show. Default is all four. */
  show?: ('form' | 'json' | 'price' | 'issues')[];
  /** Reset the editor to `spec` when this step is entered (default true). */
  reset?: boolean;
}

/** A simulated terminal. Nothing here touches the real network or the learner's machine. */
export interface TerminalStage {
  kind: 'terminal';
  script: TerminalScript;
}

/** An animated SVG diagram from the diagram catalog (docs/CONTENT.md section 4). */
export interface DiagramStage {
  kind: 'diagram';
  id: string;
  /** Which beat of the diagram to show, 0-based. Authors move it between steps to animate a story. */
  beat?: number;
  props?: Record<string, unknown>;
}

/** Source files with syntax colour and optional line highlights. */
export interface CodeStage {
  kind: 'code';
  files: {
    name: string;
    lang: 'dockerfile' | 'json' | 'js' | 'ts' | 'yaml' | 'sh' | 'text';
    code: string;
    highlight?: number[];
  }[];
}

/** Two panels side by side, for before and after, good and bad, or option A and B. */
export interface CompareStage {
  kind: 'compare';
  left: { label: Markup; tone?: 'good' | 'bad' | 'neutral'; code?: string; lang?: string; body?: Markup };
  right: { label: Markup; tone?: 'good' | 'bad' | 'neutral'; code?: string; lang?: string; body?: Markup };
}

/**
 * Any registered widget (docs/CONTENT.md section 5): `cost-reactor`, `readiness-checklist`,
 * `fluxcloud-sim`, `uptime-calculator`, `geo-picker`, `wiring-board`, `dns-record-builder`,
 * `block-converter`.
 */
export interface WidgetStage {
  kind: 'widget';
  id: string;
  props?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tasks: the one thing a learner does on a step
// ---------------------------------------------------------------------------

export type Task =
  | { kind: 'read' }
  /** Drag the diorama instance control into a range. */
  | { kind: 'set-instances'; min?: number; max?: number; exactly?: number; prompt: Markup }
  /** Kill this many distinct nodes in a failover scene. */
  | { kind: 'kill-nodes'; count: number; prompt: Markup }
  /** Send this many requests in a traffic scene. */
  | { kind: 'send-requests'; count: number; prompt: Markup }
  /**
   * Edit the spec until the check passes. `solution` is merged over the starting spec by "Show me" and
   * by tests, which assert that applying it makes `check` pass.
   */
  | { kind: 'spec'; check: Check; prompt: Markup; hint?: Markup; solution: DeepPartial<FluxAppSpec> }
  /** Run these commands, in order, in the terminal stage. Goal ids come from the script. */
  | { kind: 'terminal'; goals: string[]; prompt: Markup; hint?: Markup }
  /** Operate a registered widget until it reports done (the widget defines what done is). */
  | { kind: 'widget'; prompt: Markup; hint?: Markup }
  /** Honour-system confirmation for something done outside the page (for example in FluxCloud). */
  | { kind: 'confirm'; label: Markup; prompt: Markup };

// ---------------------------------------------------------------------------
// Checks: declarative predicates over a spec (no code in content)
// ---------------------------------------------------------------------------

export type CheckOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  /** The array at `path` includes `value`, or the string at `path` includes `value`. */
  | 'includes'
  /** The string at `path` matches the regular expression source in `value`. */
  | 'matches'
  | 'exists'
  | 'empty'
  /** Length of the array or string at `path` is at least `value`. */
  | 'len>=';

export type Check =
  | { path: string; op: CheckOp; value?: string | number | boolean; message?: Markup }
  /** Lint has no `error` issues. */
  | { lint: 'valid'; message?: Markup }
  /** None of these lint codes are present. */
  | { lint: 'absent'; codes: string[]; message?: Markup }
  /** Monthly USD price is at most / at least this much. */
  | { price: 'max' | 'min'; usd: number; message?: Markup }
  | { all: Check[] }
  | { any: Check[] };

// ---------------------------------------------------------------------------
// Challenges: graded, at the end of a lesson
// ---------------------------------------------------------------------------

export interface ChallengeBase {
  id: string;
  prompt: Markup;
  /** Shown after a correct answer: why it is right, in one or two sentences. */
  explain: Markup;
  /** Shown after a wrong answer, before retrying. Should teach, not scold. */
  hint?: Markup;
  /** XP, defaults to 10. */
  xp?: number;
}

export interface ChoiceChallenge extends ChallengeBase {
  kind: 'choice';
  options: { id: string; label: Markup; why?: Markup }[];
  /** The correct option id. */
  answer: string;
}

export interface MultiChallenge extends ChallengeBase {
  kind: 'multi';
  options: { id: string; label: Markup; why?: Markup }[];
  answers: string[];
}

export interface OrderChallenge extends ChallengeBase {
  kind: 'order';
  /** Items in the CORRECT order; the UI shuffles them. */
  items: { id: string; label: Markup }[];
}

export interface MatchChallenge extends ChallengeBase {
  kind: 'match';
  pairs: { id: string; left: Markup; right: Markup }[];
}

/** A spec with planted problems. The learner edits it until `check` passes. */
export interface SpecFixChallenge extends ChallengeBase {
  kind: 'spec-fix';
  spec: DeepPartial<FluxAppSpec>;
  check: Check;
  /** A known fix, merged over `spec`. Tests assert it satisfies `check`; "Show me" applies it. */
  solution: DeepPartial<FluxAppSpec>;
}

/** A blank-ish spec and a written brief. The learner builds a spec that satisfies `check`. */
export interface SpecBuildChallenge extends ChallengeBase {
  kind: 'spec-build';
  spec: DeepPartial<FluxAppSpec>;
  /** The brief as a short list of requirements, shown as a live checklist beside the editor. */
  requirements: { id: string; label: Markup; check: Check }[];
  /** A known passing spec, merged over `spec`. Tests assert it satisfies every requirement. */
  solution: DeepPartial<FluxAppSpec>;
}

export interface TerminalChallenge extends ChallengeBase {
  kind: 'terminal';
  script: TerminalScript;
  goals: string[];
}

/** Guess a number (a monthly price, a block count) within a tolerance. */
export interface EstimateChallenge extends ChallengeBase {
  kind: 'estimate';
  /** Spec whose price or derived value is asked about; the answer is computed by the engine at the baked rate card (the date is shown with it). */
  spec?: DeepPartial<FluxAppSpec>;
  /** What is being estimated. */
  quantity: 'usd-per-month' | 'flux-per-month' | 'blocks' | 'number';
  /** Used for `number` and `blocks`, and as a fixed answer when `spec` is absent. */
  value?: number;
  /** Accept answers within this fraction of the truth, for example 0.1 for ten percent. */
  tolerance: number;
  unit?: string;
}

export type Challenge =
  | ChoiceChallenge
  | MultiChallenge
  | OrderChallenge
  | MatchChallenge
  | SpecFixChallenge
  | SpecBuildChallenge
  | TerminalChallenge
  | EstimateChallenge;

// ---------------------------------------------------------------------------
// Terminal scripts
// ---------------------------------------------------------------------------

/**
 * A declarative terminal scenario. The engine provides `ls`, `cat`, `cd`, `pwd`, `echo`, `clear`,
 * `help` and history; a script adds the commands the lesson is about. Input is matched against each
 * command's `match` regular expression in order; the first match wins.
 */
export interface TerminalScript {
  id: string;
  /** Shell prompt, default `$`. */
  prompt?: string;
  /** Working directory shown in the prompt, default `~/app`. */
  cwd?: string;
  /** Virtual files, name to contents. */
  files?: Record<string, string>;
  /** Lines printed when the terminal opens. */
  intro?: string[];
  commands: TerminalCommand[];
  /** Goal ids and the sentence shown in the goal tracker, in the intended order. */
  goals: { id: string; label: Markup }[];
  /** Printed for unknown input, `{input}` is replaced. A good default is provided. */
  notFound?: string;
}

export interface TerminalCommand {
  /** Regular expression source, matched against the whole trimmed input line. Capture groups feed `{1}`. */
  match: string;
  /** Output lines. Prefix a line with `[ok]`, `[warn]`, `[err]` or `[dim]` for colour. `{1}` is capture 1. */
  output: string[];
  /** Goal this command completes. */
  goal?: string;
  /** Files created or replaced by this command. */
  writes?: Record<string, string>;
  /** Milliseconds between output lines, for a streaming feel. Default 40. */
  stream?: number;
  /** One or two sentences shown in "What just happened" after the command runs. */
  explain?: Markup;
  /** The canonical spelling, used for hints and for autocompletion. */
  example?: string;
}

// ---------------------------------------------------------------------------
// Glossary
// ---------------------------------------------------------------------------

export type GlossaryCategory = 'network' | 'app' | 'docker' | 'money' | 'ops';

/** One glossary entry. Files in `web/src/content/glossary/*.ts` default-export `GlossaryTerm[]`. */
export interface GlossaryTerm {
  /** Lower-kebab id used in `{{term:id}}`. Permanent. */
  id: string;
  /** The word or phrase as displayed, for example "FluxNode". */
  term: string;
  /**
   * A proper noun, a product name or a name with a deliberate capital ("Docker", "FluxOS", "N minus 1").
   * Such a name is shown exactly as written wherever `{{term:id}}` puts it in a sentence. Without it a
   * name that is a capital followed only by lower case ("Renewal", "Eligible node") is lower-cased in the
   * middle of a sentence, so prose reads "your only instance". `{{term:id|lower}}` and `{{term:id|Cap}}`
   * override either way for one use.
   */
  proper?: boolean;
  /** Other spellings that should find this entry in search. */
  aka?: string[];
  /** The definition: plain language, at most 28 words, no jargon not defined elsewhere. */
  short: Markup;
  /** Why a deployer cares, at most 40 words. */
  why: Markup;
  category: GlossaryCategory;
  /** Other term ids. */
  related?: string[];
  /** Lesson ids where it matters most. */
  lessons?: string[];
  /** Official docs URL, when one exists. */
  docs?: string;
}
