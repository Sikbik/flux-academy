/**
 * The session as the screen sees it: the engine's state, how much of it has been revealed, and the verbs.
 *
 * The engine settles a whole stretch at once (`runToBlock`), so what the screen adds is time. Entries are
 * revealed one after another so a person can follow what the agent does; with reduced motion, or when the
 * learner presses "show everything", the whole stretch appears at once. A prompt is shown only after every
 * entry before it has been revealed, so the learner never decides on a call they have not seen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildDebrief, type Debrief, type DebriefLint, outcomeOf, wantsLint } from './engine/debrief.ts';
import {
  decide as engineDecide,
  type PromptView,
  promptOf,
  runToBlock,
  startSession,
} from './engine/session.ts';
import type {
  AgentSessionOutcome,
  Decision,
  Entry,
  PolicyId,
  ScenarioId,
  ScenarioOptions,
  SessionState,
} from './engine/types.ts';

export type Phase = 'idle' | 'running' | 'finished';

const NO_LINT: DebriefLint[] = [];

export interface UseAgentSessionInit {
  scenario: ScenarioId;
  policy: PolicyId;
  options: ScenarioOptions;
  /** Reveal everything at once. */
  instant: boolean;
  /** A faster reveal (the "Show me" walk). */
  fast: boolean;
}

export interface AgentSessionView {
  state: SessionState | null;
  phase: Phase;
  /** Entries revealed so far. */
  entries: Entry[];
  /** More entries are still to be revealed. */
  revealing: boolean;
  /** The prompt that waits, once everything before it has been revealed. */
  prompt: PromptView | null;
  /** Changes whenever a different prompt appears (also when the same call asks a second question). */
  promptKey: string | null;
  debrief: Debrief | null;
  outcome: AgentSessionOutcome | null;
  start: () => void;
  decide: (decision: Decision) => void;
  /** Reveal everything up to the next decision. */
  skip: () => void;
  /** Back to the intro, before the session begins. */
  reset: () => void;
}

/** Time before the next entry appears, by what it is. */
function delayFor(entry: Entry | undefined, fast: boolean): number {
  const base = fast ? 150 : 420;
  if (!entry) return base;
  switch (entry.kind) {
    case 'call':
      return entry.gate === 'read' || entry.gate === 'earlier'
        ? Math.round(base * 0.85)
        : Math.round(base * 1.5);
    case 'note':
      return Math.round(base * 1.3);
    case 'human':
      return Math.round(base * 1.3);
    default:
      return base;
  }
}

export function useAgentSession(init: UseAgentSessionInit): AgentSessionView {
  const { scenario, policy, options, instant, fast } = init;
  const [state, setState] = useState<SessionState | null>(null);
  const [shown, setShown] = useState(0);

  const total = state?.entries.length ?? 0;
  const visible = state === null ? 0 : instant ? total : Math.min(shown, total);
  const revealing = state !== null && visible < total;

  // ---- the reveal -------------------------------------------------------------------------------------
  useEffect(() => {
    if (!state || instant || visible >= total) return;
    const id = window.setTimeout(
      () => setShown((n) => Math.min(Math.max(n, visible) + 1, total)),
      delayFor(state.entries[visible], fast),
    );
    return () => window.clearTimeout(id);
  }, [state, instant, fast, visible, total]);

  const start = useCallback(() => {
    setShown(0);
    setState(runToBlock(startSession({ scenario, policy, options })));
  }, [scenario, policy, options]);

  const decide = useCallback((decision: Decision) => {
    setState((cur) => (cur ? runToBlock(engineDecide(cur, decision)) : cur));
  }, []);

  const totalRef = useRef(0);
  totalRef.current = total;
  const skip = useCallback(() => {
    // Everything that exists now. A later decision adds entries, and those are paced again.
    setShown(totalRef.current);
  }, []);

  const reset = useCallback(() => {
    setShown(0);
    setState(null);
  }, []);

  // ---- what the screen is showing ---------------------------------------------------------------------
  const entries = useMemo(() => (state ? state.entries.slice(0, visible) : []), [state, visible]);
  const settled = state !== null && !revealing;
  const prompt = useMemo(() => (settled && state ? promptOf(state) : null), [settled, state]);
  const finished = settled && state?.status === 'finished';
  const phase: Phase = state === null ? 'idle' : finished ? 'finished' : 'running';

  // The validator's lines come from the linter, which is fetched when a session that shows them ends and
  // not with the widget; the debrief appears at once and gains that section a moment later.
  const [lintLoaded, setLintLoaded] = useState<{ state: SessionState; lines: DebriefLint[] } | null>(null);
  useEffect(() => {
    if (!finished || !state || !wantsLint(state)) return;
    let live = true;
    import('./engine/debrief-lint.ts').then(
      (m) => {
        if (live) setLintLoaded({ state, lines: m.debriefLint(state) });
      },
      () => {
        // A failed load leaves the debrief without this one section; everything else on it stands.
      },
    );
    return () => {
      live = false;
    };
  }, [finished, state]);
  const lint = lintLoaded && lintLoaded.state === state ? lintLoaded.lines : NO_LINT;

  const debrief = useMemo(
    () => (finished && state ? buildDebrief(state, lint) : null),
    [finished, state, lint],
  );
  const outcome = useMemo(() => (finished && state ? outcomeOf(state) : null), [finished, state]);
  const promptKey = prompt && state ? `${state.seq}:${prompt.beatId}:${prompt.kind}` : null;

  return {
    state,
    phase,
    entries,
    revealing,
    prompt,
    promptKey,
    debrief,
    outcome,
    start,
    decide,
    skip,
    reset,
  };
}
