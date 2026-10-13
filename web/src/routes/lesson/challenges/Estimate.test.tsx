// @vitest-environment jsdom
/**
 * The estimate challenge in the DOM. It is graded, and its figure revealed, on the baked rate card: the card
 * the lessons quote. The live parameters the environment reports do not reach it, and a price says which
 * rates it was worked out at, in the form's help line and again in the reveal.
 */

import * as blocksMod from '@shared/flux/blocks';
import * as lintMod from '@shared/flux/lint';
import * as pricingMod from '@shared/flux/pricing';
import * as specMod from '@shared/flux/spec';
import type { PricingParams } from '@shared/flux/types';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { tourLesson, tourMeta } from '@/learn/__fixtures__/tour';
import { buildEngine } from '@/learn/engine';
import { createPlayer, type PlayerEnv } from '@/learn/player';
import type { StageHost } from '@/learn/stage-api';
import type { EstimateChallenge, Lesson } from '@/learn/types';
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

const baked = pricingMod.BAKED_PRICING;
// Live rates that have moved well past the tolerance since the card was read.
const live: PricingParams = {
  ...baked.params,
  cpu: baked.params.cpu * 2,
  ram: baked.params.ram * 2,
  hdd: baked.params.hdd * 2,
};

const priced = tourLesson.checkpoint.find((c) => c.id === 'estimate-price');
if (priced?.kind !== 'estimate') throw new Error('the tour fixture has no estimate challenge');
const pricedChallenge: EstimateChallenge = priced;

const unpriced: EstimateChallenge = {
  id: 'blocks-estimate',
  kind: 'estimate',
  prompt: 'About how many blocks pass in a day?',
  quantity: 'blocks',
  value: 2880,
  tolerance: 0.05,
  unit: 'blocks',
  explain: 'A day holds 2,880 blocks.',
  hint: 'A block takes 30 seconds.',
};

const lesson: Lesson = { ...tourLesson, checkpoint: [...tourLesson.checkpoint, unpriced] };

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
  // What the learner's live calculator shows: not what a lesson is graded on.
  pricing: () => live,
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
  const index = lesson.checkpoint.findIndex((c) => c.id === challengeId);
  const challenge = lesson.checkpoint[index];
  if (!challenge) throw new Error(`no challenge ${challengeId}`);
  const store = createPlayer(
    { lesson, meta: tourMeta, engine: () => engine, start: { id: challengeId }, ephemeral: true },
    env,
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <PlayerContextProvider value={{ store, lesson, meta: tourMeta, host, fixture: true, engine }}>
        <ChallengeView
          challenge={challenge}
          index={index}
          total={lesson.checkpoint.length}
          headingRef={null}
        />
      </PlayerContextProvider>,
    );
  });
  const host_ = container;
  return {
    store,
    text: () => host_.textContent ?? '',
    input: () => host_.querySelector<HTMLInputElement>('input'),
    type: (value: string) => {
      const input = host_.querySelector<HTMLInputElement>('input');
      if (!input) throw new Error('no input');
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      act(() => {
        set?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    },
    submit: () => {
      const button = Array.from(host_.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
        (b.textContent ?? '').includes('Check estimate'),
      );
      if (!button) throw new Error('no Check estimate button');
      act(() => button.click());
    },
  };
}

const priceAt = (params: PricingParams) =>
  pricingMod.quoteLoose(pricedChallenge.spec, params, { fluxUsd: baked.fluxUsd, months: 1 }).usdPerMonth;

describe('a priced estimate', () => {
  it('says which rates it is priced at before the learner answers', () => {
    const v = mount('estimate-price');
    expect(v.text()).toContain(`Priced at the rates read on ${baked.capturedAt}.`);
  });

  it('accepts the baked-card answer while the live parameters differ, and names the rates in the reveal', () => {
    const v = mount('estimate-price');
    v.type(String(priceAt(baked.params)));
    v.submit();
    expect(v.store.getState().challenges['estimate-price']?.status).toBe('correct');
    expect(v.text()).toContain('The answer is');
    expect(v.text()).toContain(`at the rates read on ${baked.capturedAt}`);
    // The figure it reveals is the card's, not the live calculator's.
    expect(v.text()).toContain(`$${priceAt(baked.params).toFixed(2)} a month`);
    expect(v.text()).not.toContain(`$${priceAt(live).toFixed(2)} a month`);
  });

  it('keeps an answer that is right only at the live rates open and does not reveal anything', () => {
    const v = mount('estimate-price');
    v.type(String(priceAt(live)));
    v.submit();
    expect(v.store.getState().challenges['estimate-price']?.status).toBe('open');
    expect(v.text()).not.toContain('The answer is');
  });
});

describe('an estimate that is not a price', () => {
  it('reveals its figure without a rate date', () => {
    const v = mount('blocks-estimate');
    expect(v.text()).not.toContain('at the rates read on');
    v.type('2880');
    v.submit();
    expect(v.store.getState().challenges['blocks-estimate']?.status).toBe('correct');
    expect(v.text()).toContain('The answer is');
    expect(v.text()).not.toContain('rates read on');
  });
});
