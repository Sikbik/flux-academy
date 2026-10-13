/**
 * The session state machine.
 *
 *   startSession(...)      a fresh state at the scenario's first beat
 *   advance(state)         process one beat: a line, a note, a call that runs, or stop at a prompt
 *   runToBlock(state)      advance until a prompt is waiting or the session ends
 *   decide(state, d)       answer the prompt: approve, refuse, say what to do next, or press a checkout choice
 *
 * Everything is a pure function of its arguments and returns a new state, so a session can be replayed from
 * its decisions and the same decisions always give the same result.
 *
 * A call goes one of four ways. A read runs without asking, whatever the policy. A call that is not a read
 * stops at a prompt when the policy asks about its tool (`policy.ts`), and otherwise runs and is recorded as
 * "ran without asking". A call marked `earlier` happened before the session began. Refusing a call skips its
 * effects and follows its `refused` branch, or asks what to do next when it has `refuseReasons`.
 */

import { type FluxAppSpec, type McpTool, ORBIT_PLAN_IDS, orbitPlanById, toolByName } from '@shared/flux';
import { asks } from './policy.ts';
import { scenarioById } from './scenarios/index.ts';
import { EXAMPLE_REPO } from './scenarios/specs.ts';
import {
  formatUsd,
  type PlanView,
  planView,
  type QuoteView,
  quoteView,
  resolveTokens,
  tokenValues,
} from './tokens.ts';
import type {
  Decision,
  Effect,
  ExampleArg,
  PolicyId,
  ResolvedArg,
  ResolvedLine,
  ResultLine,
  Scenario,
  ScenarioOptions,
  SessionState,
  SpecVariant,
  TrailItem,
} from './types.ts';

/** A scenario with its specs priced and its plan viewed. Built once per scenario and options. */
export interface Prepared {
  scenario: Scenario;
  specs: Record<string, SpecVariant>;
  quotes: Record<string, QuoteView>;
  plan: PlanView | null;
}

const preparedCache = new Map<string, Prepared>();

export function prepare(id: string, options: ScenarioOptions = {}): Prepared {
  const scenario = scenarioById(id);
  if (!scenario) throw new Error(`unknown scenario ${id}`);
  const plan = scenario.id === 'orbit-repo' ? (options.plan ?? 'standard') : null;
  const key = `${id}:${plan ?? ''}`;
  const hit = preparedCache.get(key);
  if (hit) return hit;
  const specs = scenario.specs(plan ? { plan } : {});
  const quotes: Record<string, QuoteView> = {};
  for (const [k, v] of Object.entries(specs)) quotes[k] = quoteView(v.spec);
  const planObj = plan ? orbitPlanById(plan) : undefined;
  const prepared: Prepared = {
    scenario,
    specs,
    quotes,
    plan: planObj ? planView(planObj) : null,
  };
  preparedCache.set(key, prepared);
  return prepared;
}

function variant(p: Prepared, key: string): SpecVariant {
  const v = p.specs[key] ?? p.specs.main;
  if (!v) throw new Error(`scenario ${p.scenario.id} has no spec`);
  return v;
}

export function specOf(p: Prepared, key: string): FluxAppSpec {
  return variant(p, key).spec;
}

export function quoteOf(p: Prepared, key: string): QuoteView {
  const q = p.quotes[key] ?? p.quotes.main;
  if (!q) throw new Error(`scenario ${p.scenario.id} has no quote`);
  return q;
}

/** The token values for a spec variant of a prepared scenario. */
export function valuesFor(p: Prepared, key: string): Record<string, string> {
  return tokenValues({ spec: specOf(p, key), quote: quoteOf(p, key), plan: p.plan, repo: EXAMPLE_REPO });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export interface SessionInit {
  scenario: string;
  policy: PolicyId;
  options?: ScenarioOptions;
}

export function startSession(init: SessionInit): SessionState {
  const p = prepare(init.scenario, init.options ?? {});
  return {
    scenario: p.scenario.id,
    policy: init.policy,
    options: p.plan ? { plan: p.plan.id as ScenarioOptions['plan'] } : {},
    status: 'running',
    cursor: p.scenario.start,
    entries: [],
    pending: null,
    trail: [],
    specKey: 'main',
    payments: [],
    smallFees: [],
    registered: [],
    changed: [],
    deleted: [],
    endedApps: [],
    exposed: [],
    ending: null,
    seq: 0,
  };
}

// ---------------------------------------------------------------------------
// Resolving what a beat shows
// ---------------------------------------------------------------------------

function resolveArg(a: ExampleArg, values: Record<string, string>): ResolvedArg {
  const out: ResolvedArg = {
    name: a.name,
    value: resolveTokens(a.value, values),
    lines: (a.lines ?? []).map((l) => resolveTokens(l, values)),
    key: a.key === true,
  };
  if (a.note) out.note = resolveTokens(a.note, values);
  if (a.emphasis) out.emphasis = a.emphasis;
  return out;
}

function line(
  l: { k?: string; v: string; kind?: ResultLine['kind']; planted?: boolean },
  values: Record<string, string>,
): ResolvedLine {
  const out: ResolvedLine = {
    v: resolveTokens(l.v, values),
    kind: l.kind ?? 'text',
    planted: l.planted === true,
  };
  if (l.k !== undefined) out.k = l.k;
  return out;
}

/** Expand the `@spec` and `@plans` directives, then resolve tokens. */
export function expandResult(lines: readonly ResultLine[], p: Prepared, specKey: string): ResolvedLine[] {
  const values = valuesFor(p, specKey);
  const out: ResolvedLine[] = [];
  for (const l of lines) {
    if (l.v === '@spec') {
      for (const s of [
        { k: 'name', v: '{app}' },
        { k: 'image', v: '{image}' },
        { k: 'size', v: '{size}' },
        { k: 'instances', v: '{instanceCount}' },
        { k: 'term', v: '{term}' },
      ]) {
        out.push(line(s, values));
      }
    } else if (l.v === '@plans') {
      for (const name of ORBIT_PLAN_IDS) {
        const plan = orbitPlanById(name);
        if (!plan) continue;
        const v = planView(plan);
        const mine = p.plan?.id === v.id ? ' (the plan you asked for)' : '';
        out.push({
          k: v.name,
          v: `${formatUsd(v.usd)} a month, ${v.instances} ${v.instances === 1 ? 'instance' : 'instances'}, ${v.size}${mine}`,
          kind: 'text',
          planted: false,
        });
      }
    } else {
      out.push(line(l, values));
    }
  }
  return out;
}

/** A short line for the policy table: the arguments that say what the call does. */
export function summarize(args: readonly ResolvedArg[]): string {
  const parts: string[] = [];
  for (const a of args) {
    if (a.key || a.name === 'name' || a.name === 'spec' || a.lines.length > 0) continue;
    if (a.value.length > 24) continue;
    parts.push(`${a.name}: ${a.value}`);
  }
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

function applyEffects(
  state: SessionState,
  effects: readonly Effect[] | undefined,
  p: Prepared,
): SessionState {
  if (!effects || effects.length === 0) return state;
  let next = state;
  for (const e of effects) {
    const values = valuesFor(p, next.specKey);
    switch (e.kind) {
      case 'spend': {
        const label = resolveTokens(e.label, values);
        if (e.amount === 'minimum') {
          next = { ...next, smallFees: [...next.smallFees, label] };
        } else if (e.amount === 'plan') {
          if (!p.plan) throw new Error('a plan payment needs an Orbit plan');
          next = {
            ...next,
            payments: [...next.payments, { label, usd: p.plan.usd, flux: p.plan.flux, needed: e.needed }],
          };
        } else {
          const q = quoteOf(p, next.specKey);
          next = {
            ...next,
            payments: [...next.payments, { label, usd: q.usd, flux: q.flux, needed: e.needed }],
          };
        }
        break;
      }
      case 'register':
        next = { ...next, registered: [...next.registered, resolveTokens(e.text, values)] };
        break;
      case 'change':
        next = { ...next, changed: [...next.changed, resolveTokens(e.text, values)] };
        break;
      case 'delete':
        next = { ...next, deleted: [...next.deleted, resolveTokens(e.text, values)] };
        break;
      case 'end-app':
        next = { ...next, endedApps: [...next.endedApps, resolveTokens(e.text, values)] };
        break;
      case 'expose':
        next = { ...next, exposed: [...next.exposed, resolveTokens(e.text, values)] };
        break;
      case 'use-spec':
        next = { ...next, specKey: e.key };
        break;
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Advance
// ---------------------------------------------------------------------------

function toolOf(beatServer: string, name: string): McpTool {
  const tool = toolByName(beatServer as McpTool['server'], name);
  if (!tool) throw new Error(`unknown tool ${beatServer}/${name}`);
  return tool;
}

/** Process one beat. A state that is waiting or finished is returned as it is. */
export function advance(state: SessionState): SessionState {
  if (state.status !== 'running' || state.cursor === null) return state;
  const p = prepare(state.scenario, state.options);
  const beat = p.scenario.beats[state.cursor];
  if (!beat) throw new Error(`scenario ${state.scenario} has no beat ${state.cursor}`);
  const values = valuesFor(p, state.specKey);
  const n = state.seq + 1;

  switch (beat.kind) {
    case 'say': {
      let next: SessionState = {
        ...state,
        seq: n,
        cursor: beat.next,
        entries: [
          ...state.entries,
          { kind: 'say', n, who: beat.who, text: resolveTokens(beat.text, values) },
        ],
      };
      next = applyEffects(next, beat.effects, p);
      return next;
    }
    case 'note':
      return {
        ...state,
        seq: n,
        cursor: beat.next,
        entries: [
          ...state.entries,
          {
            kind: 'note',
            n,
            title: resolveTokens(beat.title, values),
            text: resolveTokens(beat.text, values),
            tone: beat.tone ?? 'why',
          },
        ],
      };
    case 'branch':
      return { ...state, cursor: state.specKey === beat.spec ? beat.match : beat.otherwise };
    case 'end':
      return { ...state, cursor: null, status: 'finished', ending: beat.ending };
    case 'human':
      return {
        ...state,
        seq: n,
        status: 'awaiting',
        entries: [
          ...state.entries,
          {
            kind: 'human',
            n,
            title: resolveTokens(beat.title, values),
            text: resolveTokens(beat.text, values),
            chosen: null,
          },
        ],
        pending: { kind: 'human', beatId: beat.id, entry: state.entries.length },
      };
    case 'call': {
      const tool = toolOf(beat.server, beat.tool);
      const args = beat.argsUnknown ? [] : beat.args.map((a) => resolveArg(a, values));
      const base = {
        kind: 'call' as const,
        n,
        beatId: beat.id,
        server: beat.server,
        tool: beat.tool,
        args,
        argsUnknown: beat.argsUnknown === true,
        why: resolveTokens(beat.why, values),
      };
      const trailBase: Omit<TrailItem, 'gate' | 'decision' | 'ran'> = {
        beatId: beat.id,
        server: beat.server,
        tool: beat.tool,
        keys: args.some((a) => a.key),
        earlier: beat.earlier === true,
        summary: summarize(args),
      };
      if (beat.earlier) {
        let next: SessionState = {
          ...state,
          seq: n,
          cursor: beat.next,
          entries: [
            ...state.entries,
            {
              ...base,
              status: 'ran',
              gate: 'earlier',
              decision: 'approved',
              result: expandResult(beat.result, p, state.specKey),
            },
          ],
          trail: [...state.trail, { ...trailBase, gate: 'earlier', decision: 'approved', ran: true }],
        };
        next = applyEffects(next, beat.effects, p);
        return next;
      }
      if (asks(state.policy, tool)) {
        return {
          ...state,
          seq: n,
          status: 'awaiting',
          entries: [
            ...state.entries,
            { ...base, status: 'pending', gate: 'prompted', decision: null, result: null },
          ],
          pending: { kind: 'approve', beatId: beat.id, entry: state.entries.length },
        };
      }
      const gate = tool.risk === 'reads' ? 'read' : 'auto';
      let next: SessionState = {
        ...state,
        seq: n,
        cursor: beat.next,
        entries: [
          ...state.entries,
          {
            ...base,
            status: 'ran',
            gate,
            decision: null,
            result: expandResult(beat.result, p, state.specKey),
          },
        ],
        trail: [...state.trail, { ...trailBase, gate, decision: null, ran: true }],
      };
      next = applyEffects(next, beat.effects, p);
      return exposureOf(next, tool);
    }
  }
}

/**
 * A call that returns data private to the app owner puts it into the chat, and so in front of the model
 * and its vendor. The tool's own `watch` sentence says what to look out for (FACTS 15.1.10).
 */
function exposureOf(state: SessionState, tool: McpTool): SessionState {
  if (!tool.readsPrivateAppData) return state;
  const watch = tool.watch ? ` ${tool.watch}` : '';
  const text = `${tool.name} returned data that is private to the app owner. It is now in the chat, so it went to the model.${watch}`;
  return { ...state, exposed: [...state.exposed, text] };
}

/** Advance until a prompt waits or the session ends. */
export function runToBlock(state: SessionState, maxSteps = 400): SessionState {
  let s = state;
  for (let i = 0; i < maxSteps && s.status === 'running'; i++) s = advance(s);
  if (s.status === 'running') throw new Error('the session did not settle');
  return s;
}

// ---------------------------------------------------------------------------
// Decide
// ---------------------------------------------------------------------------

export function decide(state: SessionState, decision: Decision): SessionState {
  if (state.status !== 'awaiting' || !state.pending) return state;
  const p = prepare(state.scenario, state.options);
  const pending = state.pending;
  const beat = p.scenario.beats[pending.beatId];
  if (!beat) return state;
  const values = valuesFor(p, state.specKey);

  if (pending.kind === 'approve' && beat.kind === 'call') {
    const tool = toolOf(beat.server, beat.tool);
    const entry = state.entries[pending.entry];
    if (entry?.kind !== 'call') return state;
    if (decision.choice === 'approve') {
      const ran = {
        ...entry,
        status: 'ran' as const,
        decision: 'approved' as const,
        result: expandResult(beat.result, p, state.specKey),
      };
      let next: SessionState = {
        ...state,
        status: 'running',
        pending: null,
        cursor: beat.next,
        entries: replaceAt(state.entries, pending.entry, ran),
        trail: [
          ...state.trail,
          {
            beatId: beat.id,
            server: beat.server,
            tool: beat.tool,
            gate: 'prompted',
            decision: 'approved',
            ran: true,
            keys: entry.args.some((a) => a.key),
            earlier: false,
            summary: summarize(entry.args),
          },
        ],
      };
      next = applyEffects(next, beat.effects, p);
      return exposureOf(next, tool);
    }
    if (decision.choice === 'refuse') {
      const refused = { ...entry, status: 'refused' as const, decision: 'refused' as const };
      const trail: TrailItem[] = [
        ...state.trail,
        {
          beatId: beat.id,
          server: beat.server,
          tool: beat.tool,
          gate: 'prompted',
          decision: 'refused',
          ran: false,
          keys: entry.args.some((a) => a.key),
          earlier: false,
          summary: summarize(entry.args),
        },
      ];
      const entries = replaceAt(state.entries, pending.entry, refused);
      if (beat.refuseReasons && beat.refuseReasons.length > 0) {
        return {
          ...state,
          entries,
          trail,
          pending: { kind: 'reason', beatId: beat.id, entry: pending.entry },
        };
      }
      if (!beat.refused) throw new Error(`beat ${beat.id} can be refused but has no refused branch`);
      return { ...state, status: 'running', pending: null, entries, trail, cursor: beat.refused };
    }
    return state;
  }

  if (pending.kind === 'reason' && beat.kind === 'call' && decision.choice === 'reason') {
    const reason = beat.refuseReasons?.find((r) => r.id === decision.id);
    if (!reason) return state;
    const n = state.seq + 1;
    return {
      ...state,
      seq: n,
      status: 'running',
      pending: null,
      cursor: reason.next,
      entries: [...state.entries, { kind: 'say', n, who: 'user', text: resolveTokens(reason.label, values) }],
    };
  }

  if (pending.kind === 'human' && beat.kind === 'human' && decision.choice === 'human') {
    const choice = beat.choices.find((c) => c.id === decision.id);
    if (!choice) return state;
    const entry = state.entries[pending.entry];
    if (entry?.kind !== 'human') return state;
    const chosen = { ...entry, chosen: resolveTokens(choice.label, values) };
    let next: SessionState = {
      ...state,
      status: 'running',
      pending: null,
      cursor: choice.next,
      entries: replaceAt(state.entries, pending.entry, chosen),
    };
    next = applyEffects(next, choice.effects, p);
    return next;
  }

  return state;
}

function replaceAt<T>(list: readonly T[], index: number, item: T): T[] {
  const copy = list.slice();
  copy[index] = item;
  return copy;
}

// ---------------------------------------------------------------------------
// What is waiting
// ---------------------------------------------------------------------------

export interface PromptView {
  kind: 'approve' | 'reason' | 'human';
  beatId: string;
  tool: McpTool | null;
  /** The reasons the learner may give after a refusal. */
  reasons: { id: string; label: string }[];
  /** The choices of a checkout. */
  choices: { id: string; label: string }[];
}

/** What the screen needs to draw the prompt. Null when nothing waits. */
export function promptOf(state: SessionState): PromptView | null {
  if (state.status !== 'awaiting' || !state.pending) return null;
  const p = prepare(state.scenario, state.options);
  const values = valuesFor(p, state.specKey);
  const beat = p.scenario.beats[state.pending.beatId];
  if (!beat) return null;
  if (beat.kind === 'human') {
    return {
      kind: 'human',
      beatId: beat.id,
      tool: null,
      reasons: [],
      choices: beat.choices.map((c) => ({ id: c.id, label: resolveTokens(c.label, values) })),
    };
  }
  if (beat.kind !== 'call') return null;
  return {
    kind: state.pending.kind === 'reason' ? 'reason' : 'approve',
    beatId: beat.id,
    tool: toolOf(beat.server, beat.tool),
    reasons: (beat.refuseReasons ?? []).map((r) => ({ id: r.id, label: resolveTokens(r.label, values) })),
    choices: [],
  };
}

// ---------------------------------------------------------------------------
// The Orbit plans, for a picker
// ---------------------------------------------------------------------------

export interface PlanChoice {
  view: PlanView;
  /** The term the plan's price covers, from the plan's own specification. */
  term: string;
}

/** Every Orbit plan with its price (`orbitPlanQuoteUsd`) and the term that price covers. */
export function planChoices(): PlanChoice[] {
  const out: PlanChoice[] = [];
  for (const id of ORBIT_PLAN_IDS) {
    const plan = orbitPlanById(id);
    if (!plan) continue;
    const p = prepare('orbit-repo', { plan: id });
    out.push({ view: p.plan ?? planView(plan), term: valuesFor(p, 'main').term ?? '' });
  }
  return out;
}
