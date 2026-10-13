// @vitest-environment jsdom
/**
 * The knowledge-check challenges end to end in the DOM: choice, multi, order and match. Each is driven the
 * way a learner drives it (radios, checkboxes, the two arrows on a row, click-then-click pairing) against a
 * real player store, and the result is read back from the rendered text.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { conceptLesson, conceptMeta } from '@/learn/__fixtures__/concept';
import { createPlayer, type PlayerEnv } from '@/learn/player';
import type { StageHost } from '@/learn/stage-api';
import { ChallengeView } from './ChallengeView';
import { PlayerContextProvider } from './PlayerContext';

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

function mount(challengeId: string) {
  const index = conceptLesson.checkpoint.findIndex((c) => c.id === challengeId);
  const challenge = conceptLesson.checkpoint[index];
  if (!challenge) throw new Error(`no challenge ${challengeId}`);
  const store = createPlayer(
    {
      lesson: conceptLesson,
      meta: conceptMeta,
      engine: () => null,
      start: { id: challengeId },
      ephemeral: true,
    },
    env,
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <PlayerContextProvider
        value={{ store, lesson: conceptLesson, meta: conceptMeta, host, fixture: true, engine: null }}
      >
        <ChallengeView
          challenge={challenge}
          index={index}
          total={conceptLesson.checkpoint.length}
          headingRef={null}
        />
      </PlayerContextProvider>,
    );
  });
  const root_ = container;
  return {
    store,
    root: root_,
    text: () => root_.textContent ?? '',
    byText: (selector: string, text: string) =>
      Array.from(root_.querySelectorAll<HTMLElement>(selector)).find((e) =>
        (e.textContent ?? '').includes(text),
      ) ?? null,
    click: (el: Element | null) => {
      if (!el) throw new Error('nothing to click');
      act(() => (el as HTMLElement).click());
    },
    byLabel: (label: string) => root_.querySelector<HTMLElement>(`[aria-label="${label}"]`),
  };
}

describe('choice', () => {
  it('strikes a wrong answer with its reason, keeps the challenge open, then accepts the right one', () => {
    const v = mount('blocks-time');
    const radios = Array.from(v.byText('fieldset', 'Pick one')?.querySelectorAll('input') ?? []);
    expect(radios).toHaveLength(3);

    v.click(radios[0] ?? null); // 2 seconds
    v.click(v.byText('button', 'Check answer'));
    expect(v.text()).toContain('That is far faster than the chain runs.');
    expect(v.store.getState().challenges['blocks-time']?.status).toBe('open');

    const after = Array.from(v.byText('fieldset', 'Pick one')?.querySelectorAll('input') ?? []);
    expect((after[0] as HTMLInputElement).disabled).toBe(true);

    v.click(after[1] ?? null); // 30 seconds
    v.click(v.byText('button', 'Check answer'));
    expect(v.store.getState().challenges['blocks-time']?.status).toBe('correct');
    expect(v.text()).toContain('Correct');
    expect(v.text()).toContain('2,880 a day');
  });
});

describe('multi', () => {
  it('says what is missing and what does not belong, then accepts the full set', () => {
    const v = mount('tier-members');
    const boxes = () => Array.from(v.byText('fieldset', 'Pick every')?.querySelectorAll('input') ?? []);

    v.click(boxes()[0] ?? null); // cumulus
    v.click(boxes()[2] ?? null); // cirrus, which does not belong
    v.click(v.byText('button', 'Check answers'));
    expect(v.text()).toContain('One of your picks does not belong.');
    expect(v.text()).toContain('2 right answers are still missing.');
    expect(v.store.getState().challenges['tier-members']?.status).toBe('open');

    // Take the wrong one off and add the missing two.
    v.click(boxes()[2] ?? null);
    v.click(boxes()[1] ?? null);
    v.click(boxes()[3] ?? null);
    v.click(v.byText('button', 'Check answers'));
    expect(v.store.getState().challenges['tier-members']?.status).toBe('correct');
  });
});

describe('order', () => {
  const labels = ['Cumulus', 'Nimbus', 'Stratus'];
  const rowsOf = (v: ReturnType<typeof mount>) =>
    Array.from(v.byLabel('Your order')?.querySelectorAll('li') ?? []).map((li) =>
      labels.find((l) => (li.textContent ?? '').includes(l)),
    );

  it('reports how many rows sit right, and accepts the order built with the arrows', () => {
    const v = mount('tier-order');
    expect(rowsOf(v)).toHaveLength(3);
    expect(rowsOf(v)).not.toEqual(labels);

    v.click(v.byText('button', 'Check order'));
    expect(v.text()).toMatch(/\d of 3 sit in the right place|None of these is in the right place/);
    expect(v.store.getState().challenges['tier-order']?.status).toBe('open');

    // Selection sort with the "earlier" arrow, one move at a time.
    for (let target = 0; target < labels.length; target += 1) {
      const want = labels[target] as string;
      while (rowsOf(v).indexOf(want) > target) {
        v.click(v.byLabel(`Move ${want} earlier`));
      }
    }
    expect(rowsOf(v)).toEqual(labels);
    v.click(v.byText('button', 'Check order'));
    expect(v.store.getState().challenges['tier-order']?.status).toBe('correct');
  });
});

describe('match', () => {
  const col = (v: ReturnType<typeof mount>, label: string) =>
    Array.from(v.byLabel(label)?.querySelectorAll('button') ?? []);
  const pick = (v: ReturnType<typeof mount>, side: 'Items to match' | 'Matches', text: string) =>
    v.click(col(v, side).find((b) => (b.textContent ?? '').includes(text)) ?? null);

  it('locks the pairs that are right, frees the rest, and accepts the corrected set', () => {
    const v = mount('tier-match');
    expect(v.text()).toContain('0 of 3 paired');

    // Cumulus and Nimbus swapped; Stratus right.
    pick(v, 'Items to match', 'Cumulus');
    pick(v, 'Matches', '12,500 FLUX');
    pick(v, 'Items to match', 'Nimbus');
    pick(v, 'Matches', '1,000 FLUX');
    pick(v, 'Items to match', 'Stratus');
    pick(v, 'Matches', '40,000 FLUX');
    expect(v.text()).toContain('3 of 3 paired');

    v.click(v.byText('button', 'Check matches'));
    expect(v.text()).toContain('1 of 3 are right and now locked.');
    expect(v.store.getState().challenges['tier-match']?.status).toBe('open');

    // The locked pair cannot be changed; the two free ones are paired again, correctly this time.
    const stratus = col(v, 'Items to match').find((b) => (b.textContent ?? '').includes('Stratus'));
    expect((stratus as HTMLButtonElement).disabled).toBe(true);
    pick(v, 'Items to match', 'Cumulus');
    pick(v, 'Matches', '1,000 FLUX');
    pick(v, 'Items to match', 'Nimbus');
    pick(v, 'Matches', '12,500 FLUX');
    v.click(v.byText('button', 'Check matches'));
    expect(v.store.getState().challenges['tier-match']?.status).toBe('correct');
  });
});

describe('the Hint button', () => {
  it('names a region that exists, keeps it hidden until asked, then focuses it', () => {
    const v = mount('tier-members');
    const button = v.byText('button', 'Hint');
    expect(button).not.toBeNull();
    const id = button?.getAttribute('aria-controls') ?? '';
    expect(id).not.toBe('');
    const region = v.root.querySelector<HTMLElement>(`[id="${id}"]`);
    expect(region).not.toBeNull();
    expect(region?.hidden).toBe(true);
    expect(button?.getAttribute('aria-expanded')).toBe('false');

    v.click(button);
    const opened = v.root.querySelector<HTMLElement>(`[id="${id}"]`);
    expect(opened?.hidden).toBe(false);
    expect(document.activeElement).toBe(opened);
  });

  it('opens by itself after a wrong answer, without taking focus', () => {
    const v = mount('tier-order');
    v.click(v.byText('button', 'Check order'));
    const hint = v.root.querySelector<HTMLElement>('div[tabindex="-1"]');
    expect(hint?.hidden).toBe(false);
    expect(document.activeElement).not.toBe(hint);
  });
});
