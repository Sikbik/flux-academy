// @vitest-environment jsdom
/**
 * The lesson bar raises the shell's toast strip while it is mounted, and puts it back afterwards.
 */

import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getOverlayLayer } from '@/app/Portal';
import { type ToastPlace, useToastLift } from './useToastLift';

function Bar({ place }: { place?: ToastPlace }) {
  const ref = useRef<HTMLElement>(null);
  useToastLift(ref, place);
  return <nav ref={ref} />;
}

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mountWithHeight(read: () => number, place?: ToastPlace) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ height: read() }) as DOMRect,
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Bar place={place} />));
}

describe('useToastLift', () => {
  it('sets --safe-bottom on the toast layer to the bar height and removes it on unmount', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    mountWithHeight(() => 71.2);
    const layer = getOverlayLayer('toast');
    expect(layer.style.getPropertyValue('--safe-bottom')).toBe('72px');
    act(() => root?.unmount());
    root = null;
    expect(layer.style.getPropertyValue('--safe-bottom')).toBe('');
  });

  it('follows the bar when it resizes', () => {
    let notify: () => void = () => {};
    class FakeObserver {
      constructor(cb: () => void) {
        notify = cb;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeObserver);
    let height = 60;
    mountWithHeight(() => height);
    const layer = getOverlayLayer('toast');
    expect(layer.style.getPropertyValue('--safe-bottom')).toBe('60px');
    height = 90;
    act(() => notify());
    expect(layer.style.getPropertyValue('--safe-bottom')).toBe('90px');
  });

  it('puts the strip at the top for the stacked layout, without lifting it, and puts it back', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    mountWithHeight(() => 71.2, 'top');
    const layer = getOverlayLayer('toast');
    expect(layer.dataset.place).toBe('top');
    expect(layer.style.getPropertyValue('--safe-bottom')).toBe('');
    act(() => root?.unmount());
    root = null;
    expect(layer.dataset.place).toBeUndefined();
  });

  it('switches between the two places as the layout changes', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    mountWithHeight(() => 60, 'bottom');
    const layer = getOverlayLayer('toast');
    expect(layer.style.getPropertyValue('--safe-bottom')).toBe('60px');
    act(() => root?.render(<Bar place="top" />));
    expect(layer.dataset.place).toBe('top');
    expect(layer.style.getPropertyValue('--safe-bottom')).toBe('');
    act(() => root?.render(<Bar place="bottom" />));
    expect(layer.dataset.place).toBeUndefined();
    expect(layer.style.getPropertyValue('--safe-bottom')).toBe('60px');
  });
});
