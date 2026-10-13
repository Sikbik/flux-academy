// @vitest-environment jsdom
/**
 * Mounts the task panel against a real player store and drives partial progress through it. A selector
 * that returns a fresh object on every call makes React loop ("getSnapshot should be cached"); this is the
 * regression test for that: every kind of in-progress feedback must render and settle.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { tourLesson, tourMeta } from '@/learn/__fixtures__/tour';
import { createPlayer, type PlayerEnv } from '@/learn/player';
import type { StageHost } from '@/learn/stage-api';
import type { Lesson } from '@/learn/types';
import { PlayerContextProvider } from './PlayerContext';
import { TaskPanel } from './TaskPanel';

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

// A lesson whose kill task needs three nodes, so one kill is partial progress.
const lesson: Lesson = {
  ...tourLesson,
  steps: tourLesson.steps.map((s) =>
    s.id === 'break'
      ? { ...s, task: { kind: 'kill-nodes' as const, count: 3, prompt: 'Kill three nodes.' } }
      : s,
  ),
};

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function mount(stepId: string) {
  const store = createPlayer(
    { lesson, meta: tourMeta, engine: () => null, start: { id: stepId }, ephemeral: true },
    env,
  );
  const step = lesson.steps.find((s) => s.id === stepId);
  if (!step) throw new Error(`no step ${stepId}`);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <PlayerContextProvider value={{ store, lesson, meta: tourMeta, host, fixture: true, engine: null }}>
        <TaskPanel step={step} />
      </PlayerContextProvider>,
    );
  });
  return { store, text: () => container?.textContent ?? '', container: container as HTMLElement };
}

describe('TaskPanel with partial progress', () => {
  it('shows the prompt and settles on a kill count that is not enough yet', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, text } = mount('break');
    expect(text()).toContain('Kill three nodes.');
    act(() => store.getState().emit({ type: 'node-killed', count: 1 }));
    expect(text()).toContain('1 of 3 nodes killed.');
    act(() => store.getState().emit({ type: 'node-killed', count: 2 }));
    expect(text()).toContain('2 of 3 nodes killed.');
    act(() => store.getState().emit({ type: 'node-killed', count: 3 }));
    expect(text()).toContain('Done');
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('settles on terminal goals and a wrong instance count', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = mount('build');
    act(() => a.store.getState().emit({ type: 'terminal-goal', goalId: 'build' }));
    expect(a.text()).toContain('1 of 2 goals done.');
    expect(a.text()).toContain('Push the image to a registry');
    act(() => root?.unmount());
    container?.remove();

    const b = mount('place');
    act(() => b.store.getState().emit({ type: 'instances', value: 2 }));
    expect(b.text()).toContain('That is 2.');
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('says it is showing while a slow solver works, then settles on done for you', () => {
    const { store, text } = mount('build');
    act(() => store.getState().openHint());
    expect(text()).toContain('Show me');
    store.getState().registerSolver(() => {});
    act(() => store.getState().showMe());
    expect(text()).toContain('Showing you');
    expect(text()).toContain('Watch the stage.');
    // The button that started it is gone, so it cannot be pressed twice; Skip stays as the way out.
    expect(text()).not.toContain('Show me earns half the XP.');
    expect(text()).toContain('Skip');
    act(() => {
      store.getState().emit({ type: 'terminal-goal', goalId: 'build' });
      store.getState().emit({ type: 'terminal-goal', goalId: 'push' });
    });
    expect(text()).toContain('Done for you');
    expect(text()).not.toContain('Watch the stage.');
  });

  it('offers Show me after a failed attempt', () => {
    const { store, text } = mount('place');
    expect(text()).not.toContain('Show me');
    act(() => store.getState().emit({ type: 'instances', value: 2 }));
    expect(text()).toContain('Show me');
    expect(text()).toContain('Skip');
  });

  it('names a real element with the Hint button, keeps it hidden until asked and then focuses it', () => {
    const { container: el } = mount('build');
    const button = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Hint'));
    expect(button).toBeDefined();
    const id = button?.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    // The region exists (so the reference is valid) and is hidden until the hint is opened.
    const region = el.querySelector<HTMLElement>(`[id="${id}"]`);
    expect(region).not.toBeNull();
    expect(region?.hidden).toBe(true);
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    act(() => button?.click());
    const opened = el.querySelector<HTMLElement>(`[id="${id}"]`);
    expect(opened?.hidden).toBe(false);
    expect(opened?.textContent).toContain('docker build');
    // The button that was pressed is gone: focus moved to the hint, not to the page.
    expect(document.activeElement).toBe(opened);
  });

  it('does not move focus when Show me opens the hint', () => {
    const { store, container: el } = mount('build');
    store.getState().registerSolver(() => {});
    act(() => store.getState().showMe());
    const region = el.querySelector<HTMLElement>('[data-task-region] > div[tabindex="-1"]');
    expect(region?.hidden).toBe(false);
    expect(document.activeElement).not.toBe(region);
  });
});
