// @vitest-environment jsdom
/**
 * The order challenge on a touch screen.
 *
 * `motion` marks every row it can drag `touch-action: pan-x` (a vertical drag has to win over a vertical
 * scroll), so a swipe that starts on any row drags it, and a list that fills the screen cannot be scrolled
 * past. The rows therefore hand their dragging to a handle (`dragListener={false}`): the row itself keeps the
 * browser's own touch handling, and only the handle, which is `touch-action: none` in the stylesheet, keeps a
 * vertical swipe for itself.
 */

import * as blocksMod from '@shared/flux/blocks';
import * as lintMod from '@shared/flux/lint';
import * as pricingMod from '@shared/flux/pricing';
import * as specMod from '@shared/flux/spec';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { tourLesson, tourMeta } from '@/learn/__fixtures__/tour';
import { buildEngine } from '@/learn/engine';
import { createPlayer, type PlayerEnv } from '@/learn/player';
import type { StageHost } from '@/learn/stage-api';
import { ChallengeView } from '../ChallengeView';
import { PlayerContextProvider } from '../PlayerContext';

const asRecord = (m: unknown) => m as Record<string, unknown>;
const engine = buildEngine({
  spec: asRecord(specMod),
  pricing: asRecord(pricingMod),
  blocks: asRecord(blocksMod),
  lint: asRecord(lintMod),
  catalogue: asRecord(lintMod),
});

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
  pricing: () => pricingMod.BAKED_PRICING.params,
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
  const index = tourLesson.checkpoint.findIndex((c) => c.id === challengeId);
  const challenge = tourLesson.checkpoint[index];
  if (!challenge) throw new Error(`no challenge ${challengeId}`);
  const store = createPlayer(
    { lesson: tourLesson, meta: tourMeta, engine: () => engine, start: { id: challengeId }, ephemeral: true },
    env,
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <PlayerContextProvider
        value={{ store, lesson: tourLesson, meta: tourMeta, host, fixture: true, engine }}
      >
        <ChallengeView
          challenge={challenge}
          index={index}
          total={tourLesson.checkpoint.length}
          headingRef={null}
        />
      </PlayerContextProvider>,
    );
  });
  return container;
}

describe('the order challenge rows', () => {
  it('leave vertical swipes to the browser', () => {
    const view = mount('order-lifecycle');
    const rows = Array.from(view.querySelectorAll<HTMLElement>('ol[aria-label="Your order"] > li'));
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      // `motion` writes these inline when a row listens for a drag itself.
      expect(row.style.touchAction).toBe('');
      expect(row.hasAttribute('draggable')).toBe(false);
    }
  });

  it('are still reorderable with the keyboard', () => {
    const view = mount('order-lifecycle');
    const buttons = view.querySelectorAll<HTMLButtonElement>('ol[aria-label="Your order"] button');
    // An earlier and a later button on each of the four rows.
    expect(buttons).toHaveLength(8);
  });

  it('say where to drag a row', () => {
    const view = mount('order-lifecycle');
    expect(view.textContent).toContain('Drag the rows by the dots on the left');
  });
});
