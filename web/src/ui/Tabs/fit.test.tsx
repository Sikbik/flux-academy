// @vitest-environment jsdom
/**
 * A tab row that does not fit gives up padding, then type size, then icons, before it scrolls. jsdom has no
 * layout, so the scroller's widths are stubbed from the compaction level the component has set: wider at
 * level 0, narrower at each level after.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

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
  vi.restoreAllMocks();
});

/** Content widths by level, and the width the scroller has. */
function stubLayout(widths: number[], client: number) {
  const level = (el: Element) => Number(el.closest('[data-fit]')?.getAttribute('data-fit') ?? '0');
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
    return this.getAttribute('role') === 'tablist' || this.parentElement?.getAttribute('data-variant')
      ? (widths[level(this)] ?? 0)
      : 0;
  });
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this.parentElement?.getAttribute('data-variant') ? client : 0;
  });
  // jsdom has no scrolling: the selected tab is scrolled into view only when the row overflows.
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
}

const items = [
  { value: 'a', label: 'Docker basics', icon: 'code' as const },
  { value: 'b', label: 'Build and push', icon: 'code' as const },
  { value: 'c', label: 'Query the Flux API', icon: 'code' as const },
];

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<Tabs idBase="t" aria-label="Scenarios" items={items} defaultValue="a" />);
  });
  const rootEl = container.querySelector<HTMLElement>('[data-variant]');
  if (!rootEl) throw new Error('no tabs root');
  return rootEl;
}

describe('Tabs fit', () => {
  it('stays at the natural size when the row fits', () => {
    stubLayout([600, 560, 520, 440], 640);
    expect(mount().dataset.fit).toBe('0');
  });

  it('settles on the first level that fits', () => {
    stubLayout([700, 640, 600, 520], 610);
    expect(mount().dataset.fit).toBe('2');
  });

  it('stops at the tightest level when none fits, and the row scrolls', () => {
    stubLayout([900, 840, 800, 720], 300);
    expect(mount().dataset.fit).toBe('3');
  });

  it('marks tabs that have a label, so icons are only ever dropped from labelled ones', () => {
    stubLayout([600, 560, 520, 440], 640);
    mount();
    const tabs = Array.from((container as HTMLElement).querySelectorAll('[role="tab"]'));
    expect(tabs.every((t) => t.getAttribute('data-labelled') === 'true')).toBe(true);
  });
});
