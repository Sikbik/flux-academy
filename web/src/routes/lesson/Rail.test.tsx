// @vitest-environment jsdom
/**
 * The rail's caption on the stacked (phone) layout follows the player's position, not whichever segment is
 * `current`. Regression: after finishing a step that was opened by a deep link, nothing before it had been
 * visited and the step itself was `done`, so the caption fell back to "01 / N ... to do".
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { tourLesson, tourMeta } from '@/learn/__fixtures__/tour';
import { createPlayer, layoutOf, type PlayerEnv } from '@/learn/player';
import type { StageHost } from '@/learn/stage-api';
import { PlayerContextProvider } from './PlayerContext';
import { Rail } from './Rail';

const env: PlayerEnv = {
  learner: {
    lessonProgress: () => undefined,
    lessons: () => ({}),
    xp: () => 0,
    startLesson: () => {},
    setStep: () => {},
    completeStep: () => {},
    markAssist: () => {},
    awardChallenge: () => {},
    completeLesson: () => {},
  },
  unlock: () => {},
  syncTracks: () => [],
  announce: () => {},
  schedule: () => () => {},
  pricing: () => undefined,
};

const host: StageHost = { emit: () => {}, registerSolver: () => {}, unlock: () => {} };

let root: Root | null = null;
let container: HTMLElement | null = null;

function stubMatchMedia(matchesAll: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: matchesAll,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function mount(stepId: string, stacked = true) {
  stubMatchMedia(stacked);
  const store = createPlayer(
    { lesson: tourLesson, meta: tourMeta, engine: () => null, start: { id: stepId }, ephemeral: true },
    env,
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <MemoryRouter>
        <PlayerContextProvider
          value={{ store, lesson: tourLesson, meta: tourMeta, host, fixture: true, engine: null }}
        >
          <Rail onOutline={() => {}} articleTo="/learn/x?view=article" />
        </PlayerContextProvider>
      </MemoryRouter>,
    );
  });
  const el = container;
  return {
    store,
    // The caption is three spans (count, name, state) laid out by flex; read them with a space between.
    caption: () =>
      Array.from(el.querySelectorAll('p'))
        .map((p) =>
          Array.from(p.children)
            .map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())
            .join(' '),
        )
        .find((t) => /^\d\d \/ \d\d /.test(t)) ?? null,
  };
}

const total = layoutOf(tourLesson).end;
const pad = (n: number) => String(n).padStart(2, '0');
const indexOf = (id: string) => tourLesson.steps.findIndex((s) => s.id === id) + 1;

describe('Rail caption on the stacked layout', () => {
  it('names the step the learner is on while it is current', () => {
    const v = mount('build');
    expect(v.caption()).toBe(`${pad(indexOf('build'))} / ${pad(total)} Build and push the image current`);
  });

  it('keeps naming that step, as done, once its task is finished (deep link, nothing visited before it)', () => {
    const v = mount('build');
    act(() => {
      v.store.getState().emit({ type: 'terminal-goal', goalId: 'build' });
      v.store.getState().emit({ type: 'terminal-goal', goalId: 'push' });
    });
    expect(v.store.getState().steps.build?.status).toBe('done');
    expect(v.caption()).toBe(`${pad(indexOf('build'))} / ${pad(total)} Build and push the image done`);
  });

  it('says skipped for a skipped step and names a checkpoint by its number', () => {
    const v = mount('build');
    act(() => v.store.getState().skip());
    expect(v.caption()).toContain('skipped');
    const c = mount('order-lifecycle');
    expect(c.caption()).toMatch(/^\d\d \/ \d\d Checkpoint \d current$/);
  });

  it('shows no caption on the wide layout', () => {
    const v = mount('build', false);
    expect(v.caption()).toBeNull();
  });
});

describe('Rail tab stop', () => {
  const stopOf = (el: HTMLElement) => {
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('button[data-seg]'));
    return {
      index: buttons.findIndex((b) => b.tabIndex === 0),
      count: buttons.filter((b) => b.tabIndex === 0).length,
    };
  };

  it('stays on the step the learner is on after it is finished (no segment is current then)', () => {
    const v = mount('build');
    act(() => {
      v.store.getState().emit({ type: 'terminal-goal', goalId: 'build' });
      v.store.getState().emit({ type: 'terminal-goal', goalId: 'push' });
    });
    expect(v.store.getState().steps.build?.status).toBe('done');
    const stop = stopOf(container as HTMLElement);
    expect(stop.count).toBe(1);
    expect(stop.index).toBe(indexOf('build') - 1);
  });

  it('follows the learner to a checkpoint', () => {
    const v = mount('order-lifecycle');
    expect(v.caption()).toMatch(/Checkpoint \d current$/);
    const stop = stopOf(container as HTMLElement);
    expect(stop.count).toBe(1);
    expect(stop.index).toBe(
      tourLesson.steps.length + tourLesson.checkpoint.findIndex((c) => c.id === 'order-lifecycle'),
    );
  });
});
