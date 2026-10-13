/**
 * The agent session engine: types.
 *
 * A session is a scripted tree. The "agent" is a script, not a model: it proposes tool calls in a fixed
 * order, the learner's approve and refuse choices pick the branch, and the same choices always give the same
 * outcome. Nothing here touches the network, signs or pays.
 *
 * Everything the screen shows about money, terms and durations is a TOKEN in the scenario data (`{usd}`,
 * `{messageLife}`), resolved by the engine from `@shared/flux` (`quote()`, `orbitPlanQuoteUsd()`, the timing
 * constants). Scenario data therefore never contains a computed number, and a test pins that.
 *
 * Pure and framework-free: no React, no DOM, no Node built-ins.
 */

import type { FluxAppSpec, McpServerId, OrbitPlanId } from '@shared/flux';

export const SCENARIO_IDS = ['deploy-nginx', 'poisoned-log', 'retry-after-timeout', 'orbit-repo'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export const POLICY_IDS = ['ask-all', 'ask-spends', 'allow-all'] as const;
export type PolicyId = (typeof POLICY_IDS)[number];

/** How the agent reaches the server: the FluxCloud server hosted by Flux, on your machine, or Orbit's account. */
export type Connection = 'hosted' | 'local' | 'account';

/**
 * How well a statement is known (FACTS tags). `verified`: read in the source or seen live. `docs`: a vendor
 * page or a UI string says so. `guidance`: FACTS marks it UNVERIFIED, so it is advice, not established
 * behaviour.
 */
export type FactBasis = 'verified' | 'docs' | 'guidance';

/** How a session ended, for tone: nothing lost, a flaw got through, money wasted, data or an app lost. */
export type Verdict = 'good' | 'flawed' | 'costly' | 'harmful' | 'stopped';

// ---------------------------------------------------------------------------
// Scenario data
// ---------------------------------------------------------------------------

/** One argument of a proposed call. Values are examples; a key is always a placeholder. */
export interface ExampleArg {
  name: string;
  /** The text shown. May hold `{tokens}`. */
  value: string;
  /** Extra lines under the value, for an object argument (a spec summary). */
  lines?: string[];
  /** The argument carries a private key. The value is a placeholder, never a key. */
  key?: boolean;
  /** Plain note shown under the value. */
  note?: string;
  /** `confirm`: the flag that turns a plan into a payment. `danger`: the argument that deletes. */
  emphasis?: 'confirm' | 'danger';
}

/**
 * One line of a tool result. `k` is an optional label. `kind` tints the line (never colour alone: the
 * renderer adds a word or glyph). `planted` marks text a visitor caused the app to print: the screen reveals it
 * in the debrief. Lines starting with `@` are directives the engine expands (see `expandResult`).
 */
export interface ResultLine {
  k?: string;
  v: string;
  kind?: 'text' | 'log' | 'ok' | 'warn' | 'crit';
  planted?: boolean;
}

/** What a step does to the world. The debrief is built from these, in the order they happened. */
export type Effect =
  /** Money leaves: `quote` is the current spec's quote, `plan` the Orbit plan price, `minimum` a tiny network fee. */
  | { kind: 'spend'; label: string; amount: 'quote' | 'plan' | 'minimum'; needed: boolean }
  | { kind: 'register'; text: string }
  | { kind: 'change'; text: string }
  | { kind: 'delete'; text: string }
  | { kind: 'end-app'; text: string }
  | { kind: 'expose'; text: string }
  /** Switch which spec variant the tokens read (the fix path of the first scenario). */
  | { kind: 'use-spec'; key: string };

export interface RefuseReason {
  id: string;
  /** The message the learner sends with the refusal, in the first person. */
  label: string;
  /** Beat to continue with. */
  next: string;
}

interface BeatBase {
  id: string;
}

export interface SayBeat extends BeatBase {
  kind: 'say';
  who: 'user' | 'agent';
  text: string;
  next: string;
  /** Effects applied when the line is shown (a spec switch). */
  effects?: Effect[];
}

/** A teaching aside placed in the transcript. `gotcha` is a warning about something the learner could miss. */
export interface NoteBeat extends BeatBase {
  kind: 'note';
  title: string;
  text: string;
  tone?: 'gotcha' | 'why';
  next: string;
}

export interface CallBeat extends BeatBase {
  kind: 'call';
  server: McpServerId;
  tool: string;
  args: ExampleArg[];
  /** The reason the agent gives, one sentence, shown in the transcript and in the prompt. */
  why: string;
  /** What the call returns, as the simulation shows it. */
  result: ResultLine[];
  effects?: Effect[];
  next: string;
  /** Where to go when the learner refuses. Required for a call any policy can gate. */
  refused?: string;
  /** After a refusal, the learner says what to do next. Each choice has its own continuation. */
  refuseReasons?: RefuseReason[];
  /** Happened before the session started: shown as already approved, not a decision. */
  earlier?: boolean;
  /** Orbit tools publish no arguments, so none are shown (FACTS 15.4.9). */
  argsUnknown?: boolean;
}

/** A step only the person can do: the checkout page. Not a tool call, not subject to any policy. */
export interface HumanBeat extends BeatBase {
  kind: 'human';
  title: string;
  text: string;
  choices: { id: string; label: string; effects?: Effect[]; next: string }[];
}

/** Continue with one of two beats depending on which spec variant is current. */
export interface BranchBeat extends BeatBase {
  kind: 'branch';
  spec: string;
  /** The beat to continue with when the current spec variant is `spec`. */
  match: string;
  /** The beat to continue with otherwise. */
  otherwise: string;
}

export interface EndBeat extends BeatBase {
  kind: 'end';
  ending: string;
}

export type Beat = SayBeat | NoteBeat | CallBeat | HumanBeat | BranchBeat | EndBeat;

export interface Ending {
  id: string;
  /** A short headline for the debrief. */
  title: string;
  verdict: Verdict;
  /** The outcome the scenario teaches toward (what a lesson task can ask for). */
  goal: boolean;
  /** Two sentences on what happened. May hold tokens and glossary markup. */
  summary: string;
  /** One sentence to take away. */
  takeaway: string;
  /**
   * Used instead of `takeaway` when one of these tools ran without any prompt: the learner could not have
   * stopped it, so the lesson is about the policy and not about their choice.
   */
  silent?: { tools: string[]; takeaway: string };
}

export interface ScenarioFact {
  text: string;
  /** FACTS section, for example `15.1.5`. */
  ref: string;
  basis: FactBasis;
}

export interface ScenarioCard {
  title: string;
  /** The one sentence the scenario teaches. */
  teaches: string;
  /** What the agent is about to do, for the picker. */
  summary: string;
}

export interface ScenarioOptions {
  /** Orbit plan for `orbit-repo`. */
  plan?: OrbitPlanId;
}

export interface SpecVariant {
  spec: FluxAppSpec;
  /** Lint codes this variant is expected to raise (a test pins them). */
  expectLint: string[];
}

export interface Scenario {
  id: ScenarioId;
  card: ScenarioCard;
  server: McpServerId;
  connection: Connection;
  /** The first beat. */
  start: string;
  /** The user's request, shown first. May hold tokens. */
  request: string;
  /** Spec variants the scenario prices and lints; `main` is the starting one. */
  specs: (options: ScenarioOptions) => Record<string, SpecVariant>;
  beats: Record<string, Beat>;
  endings: Record<string, Ending>;
  facts: ScenarioFact[];
  /**
   * Lint codes of the starting spec the debrief explains (`lintSpec` supplies the message, why and fix). A
   * code that is the product's own doing, such as the Orbit image tag, is left out on purpose.
   */
  showLint?: string[];
}

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

export interface ResolvedArg {
  name: string;
  value: string;
  lines: string[];
  key: boolean;
  note?: string;
  emphasis?: 'confirm' | 'danger';
}

export type CallStatus = 'pending' | 'ran' | 'refused';
/** How a call was resolved: a read (never asks), a prompt the learner answered, or ran without asking. */
export type Gate = 'read' | 'prompted' | 'auto' | 'earlier';

export interface CallEntry {
  kind: 'call';
  n: number;
  beatId: string;
  server: McpServerId;
  tool: string;
  args: ResolvedArg[];
  argsUnknown: boolean;
  why: string;
  status: CallStatus;
  gate: Gate;
  /** `approved` or `refused` when a person decided. */
  decision: 'approved' | 'refused' | null;
  result: ResolvedLine[] | null;
}

export interface ResolvedLine {
  k?: string;
  v: string;
  kind: NonNullable<ResultLine['kind']>;
  planted: boolean;
}

export interface SayEntry {
  kind: 'say';
  n: number;
  who: 'user' | 'agent';
  text: string;
}

export interface NoteEntry {
  kind: 'note';
  n: number;
  title: string;
  text: string;
  tone: 'gotcha' | 'why';
}

export interface HumanEntry {
  kind: 'human';
  n: number;
  title: string;
  text: string;
  /** The choice made, when it has been made. */
  chosen: string | null;
}

export type Entry = CallEntry | SayEntry | NoteEntry | HumanEntry;

/** What is waiting for the person. */
export type Pending =
  | { kind: 'approve'; beatId: string; entry: number }
  | { kind: 'reason'; beatId: string; entry: number }
  | { kind: 'human'; beatId: string; entry: number };

/** One proposed call on the path, for the policy table and the outcome. */
export interface TrailItem {
  beatId: string;
  server: McpServerId;
  tool: string;
  gate: Gate;
  decision: 'approved' | 'refused' | null;
  /** Whether the call ran. */
  ran: boolean;
  keys: boolean;
  earlier: boolean;
  /** A short line of what it was called with, for the table. */
  summary: string;
}

export interface PaymentRecord {
  label: string;
  usd: number;
  flux: number | null;
  needed: boolean;
}

export interface SessionState {
  scenario: ScenarioId;
  policy: PolicyId;
  options: ScenarioOptions;
  status: 'running' | 'awaiting' | 'finished';
  cursor: string | null;
  entries: Entry[];
  pending: Pending | null;
  trail: TrailItem[];
  /** The spec variant the tokens read. */
  specKey: string;
  payments: PaymentRecord[];
  /** Tiny network fees that have no amount to show (a cancel). */
  smallFees: string[];
  registered: string[];
  changed: string[];
  deleted: string[];
  endedApps: string[];
  exposed: string[];
  ending: string | null;
  /** Counter for entry numbers. */
  seq: number;
}

/** What the learner does at a prompt. */
export type Decision =
  | { choice: 'approve' }
  | { choice: 'refuse' }
  | { choice: 'reason'; id: string }
  | { choice: 'human'; id: string };

/** The result a lesson can read. */
export interface AgentSessionOutcome {
  scenario: ScenarioId;
  policy: PolicyId;
  /** Id of the ending, for example `deployed-pinned`. */
  ending: string;
  /** True when the ending is the one the scenario teaches toward. */
  goalMet: boolean;
  verdict: Verdict;
  /** Tools the learner approved at a prompt, in order. */
  approved: string[];
  /** Tools the learner refused at a prompt, in order. */
  refused: string[];
  /** Calls that are not reads and ran without any prompt. */
  ranUnasked: string[];
  /** Simulated money paid, in USD. */
  paidUsd: number;
  /** Money paid that was not needed (a second payment). */
  wastedUsd: number;
  dataDeleted: boolean;
  appEnded: boolean;
  /** How many calls carried a private key as an argument. */
  keysSent: number;
  /** How many approval prompts the learner saw. */
  prompts: number;
}
