// @vitest-environment jsdom
/**
 * The rail has one tab stop. It sits on the step the learner is on, even when that step is already `done`
 * (a revisited step, or one that has just been completed), where no segment is `current`.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { StepRail, type StepRailStep } from './StepRail';

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

function mount(steps: StepRailStep[], current?: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<StepRail aria-label="Progress" steps={steps} current={current} onSelect={() => {}} />);
  });
  const el = container;
  const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('button[data-seg]'));
  return {
    buttons,
    stop: () => buttons().findIndex((b) => b.tabIndex === 0),
    stops: () => buttons().filter((b) => b.tabIndex === 0).length,
    ariaCurrent: () => buttons().findIndex((b) => b.getAttribute('aria-current') === 'step'),
  };
}

const step = (id: string, state: StepRailStep['state']): StepRailStep => ({ id, label: id, state });

describe('StepRail tab stop', () => {
  it('sits on the current segment', () => {
    const v = mount([step('a', 'done'), step('b', 'current'), step('c', 'todo'), step('d', 'todo')]);
    expect(v.stop()).toBe(1);
    expect(v.stops()).toBe(1);
  });

  it('sits on the named step when that step is done, not on the first todo segment', () => {
    // The learner finished step b (a deep link: a was never visited, so it is still todo).
    const steps = [step('a', 'todo'), step('b', 'done'), step('c', 'todo'), step('d', 'todo')];
    const v = mount(steps, 'b');
    expect(v.stop()).toBe(1);
    expect(v.stops()).toBe(1);
    expect(v.ariaCurrent()).toBe(1);
  });

  it('sits on a skipped or assisted step the learner returned to', () => {
    const v = mount([step('a', 'done'), step('b', 'done'), step('c', 'skipped'), step('d', 'todo')], 'c');
    expect(v.stop()).toBe(2);
    expect(v.ariaCurrent()).toBe(2);
  });

  it('falls back to the first todo segment when nothing is named or current', () => {
    const v = mount([step('a', 'done'), step('b', 'todo'), step('c', 'todo')]);
    expect(v.stop()).toBe(1);
  });
});
