import type { PricingParams } from '@shared/flux';
import { createContext, useContext } from 'react';
import type { Account } from './model';

/**
 * Focus hand-over between screens. A screen that appears after the user did something takes focus on its
 * heading, so a keyboard user is not left on a button that has just gone away. `armed` is false while the
 * simulator mounts (nothing may take focus from the page) and `root` is the simulator's own element.
 */
export interface FocusGate {
  armed: boolean;
  root: HTMLElement | null;
}

/** What every screen of the simulator reads: the current rates, the chain tip, the clock and the account. */
export interface SimEnv {
  params: PricingParams;
  fluxUsd: number | null;
  paramsSource: 'live' | 'cache' | 'baked';
  /** Tip of the chain (or the baked height while offline). */
  height: number;
  /** Wall clock when the simulator mounted, in ms. */
  nowMs: number;
  account: Account;
  reducedMotion: boolean;
  /** Say something through the polite live region. */
  announce: (text: string) => void;
  /** Tell the lesson the learner hit something that did not work: the first one offers "Show me". */
  attempt: () => void;
  gate: FocusGate;
}

const Ctx = createContext<SimEnv | null>(null);

export const SimEnvProvider = Ctx.Provider;

export function useSimEnv(): SimEnv {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSimEnv outside the simulator');
  return v;
}
