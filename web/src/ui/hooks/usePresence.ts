import { useEffect, useState } from 'react';

export type PresenceState = 'closed' | 'enter' | 'open' | 'exit';

/**
 * Keeps a component mounted while its exit animation plays.
 *
 *   const { mounted, state } = usePresence(open, 320);
 *
 * `state` goes closed, enter (mounted, the pre-transition frame), open, exit, closed. It
 * always starts closed, so a surface that is open on first render still animates in. Style
 * on `data-state`. `exitMs` should match the longest exit transition.
 */
export function usePresence(open: boolean, exitMs: number): { mounted: boolean; state: PresenceState } {
  const [state, setState] = useState<PresenceState>('closed');

  useEffect(() => {
    if (open) {
      setState((s) => (s === 'open' ? s : 'enter'));
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        // Two frames so the entering styles are committed before the transition starts.
        inner = requestAnimationFrame(() => setState('open'));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setState((s) => (s === 'closed' ? s : 'exit'));
    const t = window.setTimeout(() => setState('closed'), exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { mounted: state !== 'closed', state };
}
