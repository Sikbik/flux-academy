/**
 * Which countries the visitor has hovered or focused, for the Globetrotter medal. The set survives a
 * reload (a returning visitor keeps their progress) and the medal is granted the moment it reaches the
 * goal. Storage failures are harmless: the count simply restarts.
 */
import { useCallback, useRef, useState } from 'react';
import { unlock } from '@/learn/achievements';
import { readJson, writeJson } from '@/lib/storage';
import { explore, GLOBETROTTER_GOAL, restoreExplored } from './model';

export const EXPLORED_KEY = 'flux-academy:v2:network-countries';

export interface Explored {
  /** Upper case ISO codes seen so far. */
  explored: ReadonlySet<string>;
  /** Marks a country as seen. Unknown or empty codes are ignored. */
  seen: (code: string | null | undefined) => void;
  count: number;
  goal: number;
}

export function useExplored(goal: number = GLOBETROTTER_GOAL): Explored {
  const [explored, setExplored] = useState<ReadonlySet<string>>(() =>
    restoreExplored(readJson(EXPLORED_KEY)),
  );
  const latest = useRef(explored);

  const seen = useCallback(
    (code: string | null | undefined) => {
      const next = explore(latest.current, code);
      if (next.size === latest.current.size) return;
      latest.current = next;
      setExplored(next);
      writeJson(EXPLORED_KEY, [...next]);
      if (next.size >= goal) unlock('globetrotter');
    },
    [goal],
  );

  return { explored, seen, count: explored.size, goal };
}
