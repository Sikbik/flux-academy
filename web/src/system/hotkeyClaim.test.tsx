// @vitest-environment jsdom
/**
 * `useHotkeyClaim`: a page takes a key the shell binds globally (`/` opens the command deck everywhere)
 * for as long as it is mounted, with the registry's own rules for typing and modifiers.
 */

import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachHotkeys, hotkeys, registerHotkey, useHotkeyClaim, useHotkeyView } from './hotkeys';

let root: Root | null = null;
let container: HTMLElement | null = null;
const cleanups: Array<() => void> = [];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let deck = vi.fn();

beforeEach(() => {
  deck = vi.fn();
  cleanups.push(attachHotkeys(document));
  cleanups.push(registerHotkey({ id: 'deck.slash', keys: '/', label: 'Search the Academy', run: deck }));
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  for (const off of cleanups.splice(0)) off();
  delete document.documentElement.dataset.scrollLocked;
  hotkeys.reset();
});

function Page({
  focused,
  handler,
  active = true,
}: {
  focused?: () => void;
  handler?: () => undefined | false;
  active?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input id="search" ref={ref} type="search" />
      <input id="other" type="text" />
      <button type="button" id="btn">
        go
      </button>
      {active ? (
        <Claim
          run={() => {
            if (handler) return handler();
            ref.current?.focus();
            focused?.();
            return undefined;
          }}
        />
      ) : null}
    </div>
  );
}

function Claim({ run, label = 'Search the glossary' }: { run: () => undefined | false; label?: string }) {
  useHotkeyClaim('/', run, { scope: 'glossary', label });
  return null;
}

function mount(node: React.ReactNode): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
}

function press(target: Element | Document, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(e);
  });
  return e;
}

describe('useHotkeyClaim', () => {
  it('takes the key from the global binding while mounted', () => {
    const focused = vi.fn();
    mount(<Page focused={focused} />);
    const e = press(document.body);
    expect(focused).toHaveBeenCalledOnce();
    expect(document.activeElement?.id).toBe('search');
    expect(e.defaultPrevented).toBe(true);
    expect(deck).not.toHaveBeenCalled();
  });

  it('gives the key back to the global binding when the page unmounts', () => {
    mount(<Page />);
    act(() => root?.render(<Page active={false} />));
    press(document.body);
    expect(deck).toHaveBeenCalledOnce();
  });

  it('works from a button, not only from the page', () => {
    const focused = vi.fn();
    mount(<Page focused={focused} />);
    press(document.getElementById('btn') as HTMLElement);
    expect(focused).toHaveBeenCalledOnce();
    expect(deck).not.toHaveBeenCalled();
  });

  it('leaves a slash typed in a field alone, claim and deck both', () => {
    const focused = vi.fn();
    mount(<Page focused={focused} />);
    const other = document.getElementById('other') as HTMLInputElement;
    other.focus();
    const e = press(other);
    expect(e.defaultPrevented).toBe(false);
    expect(focused).not.toHaveBeenCalled();
    expect(deck).not.toHaveBeenCalled();
  });

  it('ignores a modifier combination', () => {
    const focused = vi.fn();
    mount(<Page focused={focused} />);
    press(document.body, { ctrlKey: true });
    press(document.body, { metaKey: true });
    press(document.body, { altKey: true });
    expect(focused).not.toHaveBeenCalled();
  });

  it('stands down while a modal holds the page', () => {
    const focused = vi.fn();
    mount(<Page focused={focused} />);
    document.documentElement.dataset.scrollLocked = 'true';
    press(document.body);
    expect(focused).not.toHaveBeenCalled();
    // The global binding makes its own decision about modals; the claim only declines.
    expect(deck).toHaveBeenCalledOnce();
  });

  it('lets the global binding have the key when the handler returns false', () => {
    mount(<Page handler={() => false} />);
    const e = press(document.body);
    expect(deck).toHaveBeenCalledOnce();
    expect(e.defaultPrevented).toBe(true);
  });

  it('is silent while an exclusive scope (the deck) is on top', () => {
    const focused = vi.fn();
    mount(<Page focused={focused} />);
    const pop = hotkeys.pushScope('deck', true);
    press(document.body);
    pop();
    expect(focused).not.toHaveBeenCalled();
  });

  it('shows up in the registry for the shortcuts overlay, with its label, and leaves with the page', () => {
    mount(<Page />);
    const claimed = useHotkeyView
      .getState()
      .defs.filter((d) => d.keys === '/' && d.label === 'Search the glossary');
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.hidden).toBe(false);
    act(() => root?.render(<Page active={false} />));
    expect(useHotkeyView.getState().defs.some((d) => d.label === 'Search the glossary')).toBe(false);
  });

  it('pushes its scope while mounted and pops it after', () => {
    mount(<Page />);
    expect(hotkeys.scopes().some((s) => s.name === 'glossary')).toBe(true);
    act(() => root?.render(<Page active={false} />));
    expect(hotkeys.scopes().some((s) => s.name === 'glossary')).toBe(false);
  });
});
