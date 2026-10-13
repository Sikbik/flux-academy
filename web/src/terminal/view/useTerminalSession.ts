/**
 * Binding the framework free session to React: create it once per scenario, follow its snapshots
 * with `useSyncExternalStore`, keep history across reloads, and make sure leaving the page never
 * leaves a command half played.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useReducedMotion } from '@/ui';
import { createSession, type TerminalSession } from '../engine/session';
import type { SessionState, TerminalScript } from '../engine/types';
import { loadHistory, saveHistory } from './storage';

/**
 * A cheap fingerprint of a script. A script that keeps its id but gains commands or goals is a
 * different scenario, so the session is rebuilt instead of running new goals on old state.
 */
export function scriptSignature(script: TerminalScript): string {
  return `${script.id}|${script.commands.length}|${script.goals.map((g) => g.id).join(',')}`;
}

export interface UseTerminalSessionOptions {
  script: TerminalScript;
  /** An existing session to follow instead of creating one. */
  session?: TerminalSession;
  /** Where history is kept for the browser session. Default: the script id. `false` keeps none. */
  historyKey?: string | false;
}

interface Owned {
  key: string;
  session: TerminalSession;
}

export function useTerminalSession({ script, session: provided, historyKey }: UseTerminalSessionOptions): {
  session: TerminalSession;
  state: SessionState;
} {
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const storeKey = historyKey === false ? null : (historyKey ?? script.id);
  const owned = useRef<Owned | null>(null);
  const key = scriptSignature(script);
  if (!provided && (owned.current === null || owned.current.key !== key)) {
    owned.current = {
      key,
      session: createSession({
        script,
        history: storeKey ? loadHistory(storeKey) : [],
        reducedMotion: () => reducedRef.current,
      }),
    };
  }
  const session = provided ?? (owned.current as Owned).session;

  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState);

  // Remember what was typed, like a shell does.
  useEffect(() => {
    if (!storeKey) return;
    return session.onCommand(() => saveHistory(storeKey, session.historyList));
  }, [session, storeKey]);

  // Leaving mid-command finishes it, so nothing is left half played and no timer outlives the view.
  useEffect(() => () => session.skip(), [session]);

  return { session, state };
}
