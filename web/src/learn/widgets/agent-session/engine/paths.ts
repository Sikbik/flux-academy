/**
 * Paths through a session: every way the learner can decide, and the one "Show me" plays.
 *
 * The trees are small (a handful of prompts), so the search is exhaustive and exact. `allEndings` is what
 * the tests walk to prove every (scenario, policy) combination terminates in a defined ending. `bestPath`
 * is the decision list the widget's solver replays: the shortest path to the ending the scenario teaches
 * toward, or, where the policy makes that impossible (an unasked deletion under `allow-all`), the path
 * with the least harm.
 */

import { decide, prepare, promptOf, runToBlock, startSession } from './session.ts';
import type { Decision, PolicyId, ScenarioOptions, SessionState, Verdict } from './types.ts';

export interface Walk {
  decisions: Decision[];
  final: SessionState;
}

/** The decisions available at the prompt that is waiting. */
export function optionsAt(state: SessionState): Decision[] {
  const prompt = promptOf(state);
  if (!prompt) return [];
  if (prompt.kind === 'approve') return [{ choice: 'approve' }, { choice: 'refuse' }];
  if (prompt.kind === 'reason') return prompt.reasons.map((r) => ({ choice: 'reason' as const, id: r.id }));
  return prompt.choices.map((c) => ({ choice: 'human' as const, id: c.id }));
}

const MAX_DEPTH = 24;

/** Every complete walk of the tree for one scenario and policy. */
export function allWalks(scenario: string, policy: PolicyId, options: ScenarioOptions = {}): Walk[] {
  const out: Walk[] = [];
  const visit = (state: SessionState, decisions: Decision[]) => {
    const s = runToBlock(state);
    if (s.status === 'finished') {
      out.push({ decisions, final: s });
      return;
    }
    if (decisions.length >= MAX_DEPTH)
      throw new Error(`session ${scenario} runs deeper than ${MAX_DEPTH} prompts`);
    for (const d of optionsAt(s)) visit(decide(s, d), [...decisions, d]);
  };
  visit(startSession({ scenario, policy, options }), []);
  return out;
}

/** Lower is better. */
const VERDICT_RANK: Record<Verdict, number> = { good: 0, stopped: 1, flawed: 2, costly: 3, harmful: 4 };

/** The decisions that reach the scenario's goal in the fewest steps, else the least harmful ending. */
export function bestPath(scenario: string, policy: PolicyId, options: ScenarioOptions = {}): Decision[] {
  const p = prepare(scenario, options);
  const walks = allWalks(scenario, policy, options);
  let best: Walk | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const w of walks) {
    const ending = w.final.ending ? p.scenario.endings[w.final.ending] : undefined;
    if (!ending) continue;
    const rank = ending.goal ? 0 : 1 + VERDICT_RANK[ending.verdict];
    const score = rank * 100 + w.decisions.length;
    if (score < bestScore) {
      best = w;
      bestScore = score;
    }
  }
  return best ? best.decisions : [];
}
