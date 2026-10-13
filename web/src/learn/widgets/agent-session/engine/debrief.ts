/**
 * The debrief: what a finished session cost, changed, exposed, and what each policy would have done at each
 * call that is not a read. Built only from the final state and the scenario, so it is a pure function and
 * a test can check every (scenario, policy, path) combination.
 *
 * Money in the debrief is the simulation's: it comes from the quote of the spec that was paid for (or from
 * `orbitPlanQuoteUsd` for an Orbit plan), never from text.
 */

import {
  type McpServerId,
  type McpTool,
  type ToolRisk,
  toolByName,
  toolRiskLabel,
  toolsOf,
} from '@shared/flux';
import { asks, silentUnderAskSpends } from './policy.ts';
import { prepare, quoteOf, valuesFor } from './session.ts';
import { type PlanView, PRICE_BASIS, type QuoteLine, resolveTokens } from './tokens.ts';
import type { AgentSessionOutcome, FactBasis, PolicyId, SessionState, TrailItem, Verdict } from './types.ts';

export interface PolicyRow {
  tool: string;
  server: McpServerId;
  risk: ToolRisk;
  riskLabel: string;
  /** A short line of what it was called with. */
  summary: string;
  /** Happened before the session started. */
  earlier: boolean;
  asks: Record<PolicyId, boolean>;
  /** What happened in this run. */
  happened: 'approved' | 'refused' | 'ran-unasked' | 'earlier';
}

export interface DebriefPayment {
  label: string;
  usd: number;
  flux: number | null;
  needed: boolean;
}

export interface DebriefLint {
  code: string;
  title: string;
  message: string;
  why: string;
  fix: string;
  /** The learner asked for a fix and the agent made it. */
  fixed: boolean;
}

export interface DebriefFact {
  text: string;
  ref: string;
  basis: FactBasis;
}

export interface Debrief {
  ending: string;
  title: string;
  verdict: Verdict;
  goalMet: boolean;
  summary: string;
  takeaway: string;
  cost: {
    payments: DebriefPayment[];
    totalUsd: number;
    /** The part that was not needed. */
    wastedUsd: number;
    smallFees: string[];
    /** The quote lines of the spec that was paid for, when there was a payment. */
    lines: QuoteLine[];
    minimum: boolean;
    readOn: string;
  };
  registered: string[];
  deleted: string[];
  ended: string[];
  changed: string[];
  /** What left your hands: keys through the chat, private data into it. */
  exposed: string[];
  /** Text a visitor made the app print that the agent then read: the cause, when a scenario plants one. */
  planted: string[];
  rows: PolicyRow[];
  readCount: number;
  /** Calls that ran without a prompt although `ask-all` would have asked. */
  letThrough: { tool: string; riskLabel: string }[];
  /** Tools of this server that `ask-spends` lets through although `ask-all` stops them. */
  silentTools: { tool: string; riskLabel: string }[];
  /** What the validator said that this session is about. `debriefLint` supplies it, loaded on demand. */
  lint: DebriefLint[];
  facts: DebriefFact[];
  /** The plan the session was about, for Orbit. */
  plan: PlanView | null;
}

function toolOfItem(item: TrailItem): McpTool {
  const t = toolByName(item.server, item.tool);
  if (!t) throw new Error(`unknown tool ${item.server}/${item.tool}`);
  return t;
}

/**
 * How many proposed calls carried a private key as an argument. A refused call still wrote the key into the
 * chat, because the model has to produce it to propose the call, so refused calls count.
 */
function keysSent(state: SessionState): number {
  return state.trail.filter((t) => t.keys).length;
}

/** Whether this session's debrief explains lint findings of the first plan (`debriefLint` supplies them). */
export function wantsLint(state: SessionState): boolean {
  const wanted = prepare(state.scenario, state.options).scenario.showLint;
  return Boolean(wanted && wanted.length > 0);
}

/**
 * `lint` is the validator's part, which the caller loads separately (see `debrief-lint.ts`): the linter is
 * the largest thing the debrief would otherwise pull in, and most of it is read after the session ends.
 */
export function buildDebrief(state: SessionState, lint: DebriefLint[] = []): Debrief {
  if (state.status !== 'finished' || state.ending === null) {
    throw new Error('the session is not finished');
  }
  const p = prepare(state.scenario, state.options);
  const scenario = p.scenario;
  const ending = scenario.endings[state.ending];
  if (!ending) throw new Error(`scenario ${scenario.id} has no ending ${state.ending}`);
  const values = valuesFor(p, state.specKey);
  // Text is resolved against the spec that was current at the end, so a pinned image reads as pinned.
  const text = (s: string) => resolveTokens(s, values);

  const ranUnasked = state.trail.filter((t) => t.ran && t.gate === 'auto').map((t) => t.tool);
  const silentHit = ending.silent?.tools.some((t) => ranUnasked.includes(t)) ?? false;
  const takeaway = text(silentHit && ending.silent ? ending.silent.takeaway : ending.takeaway);

  // ---- money ---------------------------------------------------------------------------------------
  const payments: DebriefPayment[] = state.payments.map((x) => ({ ...x }));
  const totalUsd = Number(payments.reduce((sum, x) => sum + x.usd, 0).toFixed(2));
  const wastedUsd = Number(
    payments
      .filter((x) => !x.needed)
      .reduce((sum, x) => sum + x.usd, 0)
      .toFixed(2),
  );
  const paidSpec = quoteOf(p, state.specKey);
  const lines: QuoteLine[] = payments.length > 0 ? paidSpec.lines : [];

  // ---- the policy table ----------------------------------------------------------------------------
  const rows: PolicyRow[] = [];
  let readCount = 0;
  for (const item of state.trail) {
    const tool = toolOfItem(item);
    if (tool.risk === 'reads') {
      readCount += 1;
      continue;
    }
    const happened: PolicyRow['happened'] =
      item.gate === 'earlier'
        ? 'earlier'
        : item.gate === 'auto'
          ? 'ran-unasked'
          : item.decision === 'refused'
            ? 'refused'
            : 'approved';
    rows.push({
      tool: item.tool,
      server: item.server,
      risk: tool.risk,
      riskLabel: toolRiskLabel(tool),
      summary: item.summary,
      earlier: item.earlier,
      asks: {
        'ask-all': asks('ask-all', tool),
        'ask-spends': asks('ask-spends', tool),
        'allow-all': asks('allow-all', tool),
      },
      happened,
    });
  }

  // ---- the gap -------------------------------------------------------------------------------------
  const seen = new Set<string>();
  const letThrough: Debrief['letThrough'] = [];
  for (const item of state.trail) {
    const tool = toolOfItem(item);
    if (item.gate !== 'auto' || !item.ran) continue;
    if (asks('ask-all', tool) && !seen.has(item.tool)) {
      seen.add(item.tool);
      letThrough.push({ tool: item.tool, riskLabel: toolRiskLabel(tool) });
    }
  }
  const silentTools = silentUnderAskSpends(toolsOf(scenario.server)).map((t) => ({
    tool: t.name,
    riskLabel: toolRiskLabel(t),
  }));

  // ---- exposure ------------------------------------------------------------------------------------
  const exposed = [...state.exposed];
  const sent = keysSent(state);
  if (sent > 0) {
    const conn = scenario.connection;
    exposed.unshift(
      conn === 'hosted'
        ? `Your Flux ID key and payment key were written into the arguments of ${sent} ${sent === 1 ? 'call' : 'calls'} the agent proposed. On the hosted server they pass through your AI vendor and stay in the chat history.`
        : `Keys were passed to ${sent} ${sent === 1 ? 'call' : 'calls'}.`,
    );
  }
  if (scenario.connection === 'account') {
    if (exposed.length === 0) {
      exposed.push(
        'Nothing secret was handed to the agent. It acted as your signed-in account, and any payment went through a checkout page that you complete, as the Orbit guide describes it.',
      );
    }
    // Keep the contrast in view: the other server's agent holds keys and can pay by itself.
    exposed.push(
      'The FluxCloud MCP server is different. Its agent holds two private keys, and a call with confirm set pays without a checkout page. Do not apply the rules of one server to the other.',
    );
  }

  const planted: string[] = [];
  for (const e of state.entries) {
    if (e.kind !== 'call' || !e.result) continue;
    for (const l of e.result) if (l.planted) planted.push(l.v);
  }

  return {
    ending: ending.id,
    title: text(ending.title),
    verdict: ending.verdict,
    goalMet: ending.goal,
    summary: text(ending.summary),
    takeaway,
    cost: {
      payments,
      totalUsd,
      wastedUsd,
      smallFees: [...state.smallFees],
      lines,
      minimum: paidSpec.minimum,
      readOn: PRICE_BASIS.readOn,
    },
    registered: [...state.registered],
    deleted: [...state.deleted],
    ended: [...state.endedApps],
    changed: [...state.changed],
    exposed,
    planted,
    rows,
    readCount,
    letThrough,
    silentTools,
    lint,
    facts: scenario.facts.map((f) => ({ text: text(f.text), ref: f.ref, basis: f.basis })),
    plan: p.plan,
  };
}

// ---------------------------------------------------------------------------
// The outcome a lesson can read
// ---------------------------------------------------------------------------

export function outcomeOf(state: SessionState): AgentSessionOutcome {
  const d = buildDebrief(state);
  const prompted = state.trail.filter((t) => t.gate === 'prompted');
  return {
    scenario: state.scenario,
    policy: state.policy,
    ending: d.ending,
    goalMet: d.goalMet,
    verdict: d.verdict,
    approved: prompted.filter((t) => t.decision === 'approved').map((t) => t.tool),
    refused: prompted.filter((t) => t.decision === 'refused').map((t) => t.tool),
    ranUnasked: state.trail.filter((t) => t.ran && t.gate === 'auto').map((t) => t.tool),
    paidUsd: d.cost.totalUsd,
    wastedUsd: d.cost.wastedUsd,
    dataDeleted: state.deleted.length > 0,
    appEnded: state.endedApps.length > 0,
    keysSent: keysSent(state),
    prompts: prompted.length,
  };
}
