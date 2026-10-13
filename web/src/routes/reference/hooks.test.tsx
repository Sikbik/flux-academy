// @vitest-environment jsdom
/**
 * The scroll spy measures when the page scrolls or resizes, and also when the page changes height. The
 * second matters for a page whose body loads after the frame (Orbit and Agents): the sections arrive without
 * a scroll, and without a measure the contents list would keep marking the wrong one until the reader moved.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollSpy } from './hooks';

type Callback = (entries: unknown[], observer: unknown) => void;

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: Callback;
  observed: Element[] = [];
  disconnected = false;
  constructor(callback: Callback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

function Probe({ ids }: { ids: readonly string[] }) {
  const active = useScrollSpy(ids, 64);
  return <p data-testid="active">{active}</p>;
}

let root: Root | null = null;
let container: HTMLElement | null = null;
const added: HTMLElement[] = [];
const tops = new Map<string, number>();

/** A heading whose position the test controls, since jsdom has no layout. */
function heading(id: string, top: number): HTMLElement {
  const el = document.createElement('h2');
  el.id = id;
  tops.set(id, top);
  el.getBoundingClientRect = () => ({ top: tops.get(id) ?? 0 }) as DOMRect;
  document.body.appendChild(el);
  added.push(el);
  return el;
}

function mount(ids: readonly string[]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Probe ids={ids} />));
}

const shown = () => container?.querySelector('[data-testid="active"]')?.textContent;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  FakeResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  for (const el of added.splice(0)) el.remove();
  tops.clear();
  root = null;
  container = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useScrollSpy', () => {
  it('watches the height of the page and stops when the page goes', () => {
    heading('two', 20);
    mount(['one', 'two']);
    const watch = FakeResizeObserver.instances[0];
    expect(watch?.observed).toContain(document.body);
    act(() => root?.unmount());
    root = null;
    expect(watch?.disconnected).toBe(true);
  });

  it('picks up sections that arrive after the frame, without a scroll', () => {
    // Only the last section exists when the frame mounts, so it is the one being read.
    heading('two', 20);
    mount(['one', 'two']);
    expect(shown()).toBe('two');

    // The body loads: the first section sits near the top of the page and the second far below it.
    heading('one', 100);
    tops.set('two', 3000);
    act(() => FakeResizeObserver.instances[0]?.callback([], FakeResizeObserver.instances[0]));
    expect(shown()).toBe('one');
  });

  it('still works where there is no ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    heading('one', 100);
    heading('two', 3000);
    mount(['one', 'two']);
    expect(shown()).toBe('one');
  });
});
