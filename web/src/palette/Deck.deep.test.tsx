// @vitest-environment jsdom
/**
 * The deck's wiring of the Reference and troubleshooting search: when the sources start loading, what is
 * shown while they do, what a metered connection gets, and that Enter on a deep row goes through the app's
 * navigation helper. The sources are injected, so no content is loaded and every call is counted.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDeepSearch,
  type DeepLoaders,
  type DeepSearch,
  type FixMatch,
  type ReferenceMatch,
} from './deep';

const h = vi.hoisted(() => ({
  current: null as unknown as DeepSearch,
  navigate: vi.fn(),
}));

vi.mock('./deepLoaders', () => ({
  saveDataOn: () => false,
  defaultLoaders: {},
  // The deck holds this object for the life of the page: it forwards to whichever search the test built.
  deepSearch: {
    start: () => h.current.start(),
    load: () => h.current.load(),
    status: () => h.current.status(),
    version: () => h.current.version(),
    subscribe: (l: () => void) => h.current.subscribe(l),
    search: (q: string) => h.current.search(q),
  },
}));

vi.mock('@/app/navigation', () => ({
  appNavigate: (to: string) => h.navigate(to),
}));

import { useOverlays } from '@/system/overlays';
import Deck from './Deck';

const ref = (over: Partial<ReferenceMatch> & { id: string }): ReferenceMatch => ({
  kind: 'section',
  topic: 'docker',
  topicName: 'Docker practices',
  title: over.id,
  summary: `About ${over.id}.`,
  group: 'Docker practices',
  path: `/reference/docker#${over.id}`,
  score: 600,
  unverified: false,
  ...over,
});

const fix = (over: Partial<FixMatch> & { id: string }): FixMatch => ({
  kind: 'symptom',
  title: over.id,
  summary: `Summary of ${over.id}.`,
  meta: 'Running',
  path: `/troubleshoot#${over.id}`,
  score: 40,
  exact: false,
  ...over,
});

interface Fake extends DeepLoaders {
  calls: { reference: number; fix: number };
  release(): void;
}

/** Sources that answer from fixed lists, count their loads and can be held back until `release`. */
function fakeLoaders(refs: ReferenceMatch[], fixes: FixMatch[], hold = false): Fake {
  const calls = { reference: 0, fix: 0 };
  let release: () => void = () => {};
  const gate = hold
    ? new Promise<void>((resolve) => {
        release = resolve;
      })
    : Promise.resolve();
  return {
    calls,
    release: () => release(),
    reference: async () => {
      calls.reference += 1;
      await gate;
      return { search: (_q, limit) => refs.slice(0, limit) };
    },
    fix: async () => {
      calls.fix += 1;
      await gate;
      return { search: () => fixes };
    },
  };
}

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  vi.useFakeTimers();
  h.navigate.mockReset();
  document.body.replaceChildren();
  // jsdom has no layout: the few DOM measurements the deck makes must not throw.
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.scrollTo = () => {};
});

afterEach(() => {
  act(() => {
    useOverlays.getState().closeDeck();
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

async function openDeck(search: DeepSearch): Promise<void> {
  h.current = search;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<Deck />);
  });
  await act(async () => {
    useOverlays.getState().openDeck();
  });
}

const input = (): HTMLInputElement => {
  const el = document.querySelector<HTMLInputElement>('[role=dialog] input[role=combobox]');
  if (!el) throw new Error('the deck is not open');
  return el;
};

async function type(text: string): Promise<void> {
  await act(async () => {
    const el = input();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    set?.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function settle(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const dialogText = (): string => document.querySelector('[role=dialog]')?.textContent ?? '';
const titles = (): string[] =>
  [...document.querySelectorAll('[role=dialog] [role=option]')].map(
    (o) => o.querySelector('[class*=title]')?.textContent ?? '',
  );
const groups = (): string[] =>
  [...document.querySelectorAll('[role=dialog] [role=group] [role=presentation] span:first-child')].map(
    (s) => s.textContent ?? '',
  );

describe('when the sources start loading', () => {
  it('waits a moment after the deck opens, so a deck opened by mistake costs nothing', async () => {
    const loaders = fakeLoaders([], []);
    await openDeck(createDeepSearch(loaders));
    await settle(200);
    expect(loaders.calls).toEqual({ reference: 0, fix: 0 });
    await settle(100);
    expect(loaders.calls).toEqual({ reference: 1, fix: 1 });
  });

  it('starts at once on a query of two characters, and not on one', async () => {
    const loaders = fakeLoaders([], []);
    await openDeck(createDeepSearch(loaders));
    await type('p');
    expect(loaders.calls).toEqual({ reference: 0, fix: 0 });
    await type('po');
    expect(loaders.calls).toEqual({ reference: 1, fix: 1 });
    await settle(1000);
    expect(loaders.calls).toEqual({ reference: 1, fix: 1 });
  });

  it('does not start for the ask mode', async () => {
    const loaders = fakeLoaders([], []);
    await openDeck(createDeepSearch(loaders));
    await type('>block');
    await settle(200);
    expect(loaders.calls).toEqual({ reference: 0, fix: 0 });
  });
});

describe('what the deck shows', () => {
  it('groups the Reference and Fix it rows by what they are', async () => {
    const loaders = fakeLoaders(
      [ref({ id: 'registries', title: 'Registries and private images', score: 900 })],
      [fix({ id: 'code-PORT_FEE', kind: 'code', title: 'PORT_FEE', meta: 'Lint code', exact: true })],
    );
    await openDeck(createDeepSearch(loaders));
    await type('docker.io');
    await settle(50);
    expect(groups()).toContain('Reference');
    expect(groups()).toContain('Fix it');
    expect(titles()).toContain('Registries and private images');
    expect(titles()).toContain('PORT_FEE');
    expect(dialogText()).toContain('Docker practices');
    expect(dialogText()).toContain('Lint code');
  });

  it('says it is searching, not "No match", while a source is on its way', async () => {
    const loaders = fakeLoaders(
      [ref({ id: 'registries', title: 'Registries and private images' })],
      [],
      true,
    );
    await openDeck(createDeepSearch(loaders));
    await type('zzqq-registries');
    await settle(50);
    expect(dialogText()).toContain('Searching the reference and troubleshooting');
    expect(dialogText()).not.toContain('No match');
    await act(async () => {
      loaders.release();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(titles()).toContain('Registries and private images');
    expect(dialogText()).not.toContain('Searching the reference');
  });

  it('says "No match" once everything has loaded and nothing was found', async () => {
    const loaders = fakeLoaders([], []);
    await openDeck(createDeepSearch(loaders));
    await type('zzqqxx');
    await settle(50);
    expect(dialogText()).toContain('No match');
  });
});

describe('on a metered connection', () => {
  it('loads nothing, says so, and loads when the visitor asks', async () => {
    const loaders = fakeLoaders(
      [],
      [fix({ id: 'code-PORT_FEE', kind: 'code', title: 'PORT_FEE', meta: 'Lint code', exact: true })],
    );
    await openDeck(createDeepSearch(loaders, { saveData: () => true }));
    await type('PORT_FEE');
    await settle(500);
    expect(loaders.calls).toEqual({ reference: 0, fix: 0 });
    expect(dialogText()).toContain('not searched while Data Saver is on');
    expect(dialogText()).toContain('No match in the lessons or glossary');

    const button = [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find((b) =>
      /search them/i.test(b.textContent ?? ''),
    );
    expect(button).toBeTruthy();
    await act(async () => {
      button?.click();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(loaders.calls).toEqual({ reference: 1, fix: 1 });
    expect(titles()).toContain('PORT_FEE');
    const gone = [...document.querySelectorAll('[role=dialog] button')].every(
      (b) => !/search them/i.test(b.textContent ?? ''),
    );
    expect(gone).toBe(true);
    // The polite announcement follows the typing pause: it now counts what was found.
    await settle(400);
    expect(document.querySelector('[role=dialog] ~ [role=status], [role=status]')?.textContent).toBe(
      '1 result',
    );
  });
});

describe('opening a deep row', () => {
  it('goes through the app navigation helper with the anchor, and closes the deck', async () => {
    const loaders = fakeLoaders(
      [],
      [fix({ id: 'code-PORT_FEE', kind: 'code', title: 'PORT_FEE', meta: 'Lint code', exact: true })],
    );
    await openDeck(createDeepSearch(loaders));
    await type('PORT_FEE');
    await settle(50);
    expect(titles()[0]).toBe('PORT_FEE');
    await act(async () => {
      input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(h.navigate).toHaveBeenCalledWith('/troubleshoot#code-PORT_FEE');
    expect(useOverlays.getState().deck).toBe(false);
  });

  it('keeps the arrow keys on the combobox: focus stays in the input', async () => {
    const loaders = fakeLoaders(
      [ref({ id: 'registries', title: 'Registries and private images', score: 900 })],
      [fix({ id: 'code-PORT_FEE', kind: 'code', title: 'PORT_FEE', meta: 'Lint code', exact: true })],
    );
    await openDeck(createDeepSearch(loaders));
    await type('PORT_FEE');
    await settle(50);
    const first = input().getAttribute('aria-activedescendant');
    await act(async () => {
      input().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
    });
    const second = input().getAttribute('aria-activedescendant');
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    expect(document.getElementById(second ?? '')?.getAttribute('role')).toBe('option');
  });
});
