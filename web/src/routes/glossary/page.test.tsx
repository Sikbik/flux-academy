// @vitest-environment jsdom
/**
 * The glossary page end to end in a router: every term is listed once, the count is the real number, a
 * hash opens a term, a search ranks, and a search that finds nothing offers a way out.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { allTerms } from '@/learn/glossary';
import Glossary from './index';

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no layout engine and no matchMedia: give the page what it asks for.
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
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function render(url: string): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<MemoryRouter initialEntries={[url]}>{<Glossary />}</MemoryRouter>));
  return container;
}

function type(el: HTMLElement, value: string) {
  const input = el.querySelector('input[type="search"]') as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('the glossary page', () => {
  it('has one h1 and lists every term once, with the real count', () => {
    const el = render('/glossary');
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    const entries = el.querySelectorAll('li[id]');
    expect(entries).toHaveLength(allTerms().length);
    expect(el.querySelector('#glossary-count')?.textContent).toBe(`${allTerms().length} terms`);
  });

  it('groups the terms under letters in order', () => {
    const el = render('/glossary');
    const letters = Array.from(el.querySelectorAll('h2[id^="letter-"]')).map((h) => h.textContent);
    expect(letters.length).toBeGreaterThan(5);
    expect(letters).toEqual(
      [...letters].sort((a, b) => (a === '#' ? -1 : b === '#' ? 1 : (a ?? '').localeCompare(b ?? ''))),
    );
  });

  it('puts the best match first when you search, and says how many', () => {
    const el = render('/glossary');
    type(el, 'fluxnode');
    const first = el.querySelector('li[id]');
    expect(first?.id).toBe('fluxnode');
    expect(el.querySelector('#glossary-count')?.textContent).toMatch(/^\d+ of \d+ terms$/);
  });

  it('starts from a search in the address', () => {
    const el = render('/glossary?q=apex');
    const input = el.querySelector('input[type="search"]') as HTMLInputElement;
    expect(input.value).toBe('apex');
    expect(el.querySelector('li[id="apex-domain"]')).not.toBeNull();
  });

  it('filters by kind from the address', () => {
    const el = render('/glossary?kind=docker');
    const ids = Array.from(el.querySelectorAll('li[id]')).map((li) => li.id);
    const docker = allTerms()
      .filter((t) => t.category === 'docker')
      .map((t) => t.id);
    expect(ids.sort()).toEqual(docker.sort());
  });

  it('marks the term a link points at', () => {
    const el = render('/glossary#port-fee');
    expect(el.querySelector('li#port-fee')?.getAttribute('data-target')).toBe('true');
  });

  it('shows the way out when nothing matches', () => {
    const el = render('/glossary');
    type(el, 'zzzzqqqq');
    expect(el.textContent).toContain('No term matches');
    expect(el.querySelector('a[href^="/troubleshoot"]')).not.toBeNull();
    expect(el.querySelector('a[href="/learn"]')).not.toBeNull();
    expect(el.querySelectorAll('li[id]')).toHaveLength(0);
  });

  it('offers the nearest terms for a typo', () => {
    const el = render('/glossary');
    type(el, 'fluxnoed');
    expect(el.textContent).toContain('No term matches');
    expect(el.textContent).toContain('Nearest terms');
    expect(el.textContent).toContain('FluxNode');
  });

  it('says so for a link to a term that does not exist', () => {
    const el = render('/glossary#not-a-real-term');
    expect(el.textContent).toContain('There is no term with the id');
  });
});
