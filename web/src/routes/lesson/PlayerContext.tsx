/**
 * The player context: one store per lesson visit, the stage host that stages talk to, and hooks.
 */

import type { LessonMeta } from '@shared/curriculum';
import { type Context, createContext, type ReactNode, useContext, useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { usePricing } from '@/data';
import type { LessonEngine } from '@/learn/engine';
import { createPlayer, defaultPlayerEnv, type Player, type PlayerStore } from '@/learn/player';
import type { StageHost } from '@/learn/stage-api';
import type { Lesson } from '@/learn/types';
import { useEngine } from '@/learn/useEngine';

export interface PlayerCtx {
  store: PlayerStore;
  lesson: Lesson;
  meta: LessonMeta;
  host: StageHost;
  /** A development fixture: progress is not recorded. */
  fixture: boolean;
  engine: LessonEngine | null;
}

// A hot update of this module would otherwise make a second context object: the provider that is already
// mounted and the hooks that were just re-evaluated would stop agreeing, and the route would fall to its
// error page ("usePlayerCtx must be used inside a PlayerProvider") until a reload. The development server
// keeps one object across updates; a production build has no `import.meta.hot` and makes it once. (A test
// runner may have `hot` without `data`, so both are checked.)
const hotData: Record<string, unknown> | undefined = import.meta.hot?.data;
const Ctx: Context<PlayerCtx | null> =
  (hotData?.playerCtx as Context<PlayerCtx | null> | undefined) ?? createContext<PlayerCtx | null>(null);
if (hotData) hotData.playerCtx = Ctx;

export interface PlayerProviderProps {
  lesson: Lesson;
  meta: LessonMeta;
  fixture: boolean;
  /** A step or challenge id from `?step=`. */
  startId: string | null;
  children: ReactNode;
}

export function PlayerProvider({ lesson, meta, fixture, startId, children }: PlayerProviderProps) {
  const engine = useEngine();
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const pricing = usePricing();
  const paramsRef = useRef(pricing.data?.params);
  paramsRef.current = pricing.data?.params;
  const startRef = useRef(startId);

  // Creating the store has no side effects (begin is deferred), so React may build it twice safely.
  const store = useMemo(
    () =>
      createPlayer(
        {
          lesson,
          meta,
          engine: () => engineRef.current,
          start: { id: startRef.current },
          ephemeral: fixture,
          deferBegin: true,
        },
        { ...defaultPlayerEnv(), pricing: () => paramsRef.current },
      ),
    [lesson, meta, fixture],
  );

  useEffect(() => {
    store.getState().begin();
    return () => store.getState().destroy();
  }, [store]);

  const host = useMemo<StageHost>(
    () => ({
      emit: (e) => store.getState().emit(e),
      registerSolver: (s) => store.getState().registerSolver(s),
      unlock: (id) => store.getState().unlock(id),
    }),
    [store],
  );

  const value = useMemo<PlayerCtx>(
    () => ({ store, lesson, meta, host, fixture, engine }),
    [store, lesson, meta, host, fixture, engine],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Provide a ready-made context (tests, and previews that build their own store). */
export function PlayerContextProvider({ value, children }: { value: PlayerCtx; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayerCtx(): PlayerCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlayerCtx must be used inside a PlayerProvider');
  return c;
}

/** Select from the player state. */
export function usePlayer<T>(selector: (p: Player) => T): T {
  const { store } = usePlayerCtx();
  return useStore(store, selector);
}

/** The player's actions (stable). */
export function usePlayerActions(): Player {
  const { store } = usePlayerCtx();
  return store.getState();
}
