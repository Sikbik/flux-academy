/**
 * The Konami code easter egg: Up Up Down Down Left Right Left Right B A.
 *
 * A pure sequence matcher plus a hook. The effect (overclock: the accent goes stratus gold for 20 s)
 * lives in `theme.ts`.
 */

import { useEffect, useRef } from 'react';
import { isTypingTarget } from './hotkeys';

export const KONAMI = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
] as const;

export interface SequenceMatcher {
  /** Feed one key. Returns true when the whole sequence has just been completed. */
  push(key: string): boolean;
  reset(): void;
}

export function createSequenceMatcher(sequence: readonly string[] = KONAMI): SequenceMatcher {
  // A rolling window of the last N keys: a mistaken extra key (Up Up Up Down ...) never breaks the code.
  let recent: string[] = [];
  return {
    push(rawKey) {
      recent.push(rawKey.toLowerCase());
      if (recent.length > sequence.length) recent = recent.slice(-sequence.length);
      if (recent.length === sequence.length && recent.every((k, i) => k === sequence[i])) {
        recent = [];
        return true;
      }
      return false;
    },
    reset() {
      recent = [];
    },
  };
}

/**
 * Calls `onSuccess` when the code is typed anywhere outside a text field.
 *
 * It listens in the capture phase and swallows the key that completes the code. The last key is "A",
 * which is also the ambient mode hotkey: without this the easter egg would open ambient mode over
 * itself.
 */
export function useKonami(onSuccess: () => void): void {
  const cb = useRef(onSuccess);
  cb.current = onSuccess;
  useEffect(() => {
    const matcher = createSequenceMatcher();
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) {
        matcher.reset();
        return;
      }
      if (matcher.push(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        cb.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);
}
