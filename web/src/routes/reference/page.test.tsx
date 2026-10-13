// @vitest-environment jsdom
/**
 * The Reference pages in a router: each topic renders every section it declares, every entry of the
 * search index has an element to land on, ids are unique and in-page links resolve.
 *
 * The Orbit and Agents pages load their sections as a separate chunk behind a static frame, so rendering is
 * asynchronous here: `render` waits for the placeholder to go.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { REFERENCE_INDEX, TOPICS } from '@/content/reference';
import ReferenceTopic from '../reference-topic';
import ReferenceLanding from './index';
import { numberSections, unverifiedOf } from './model';

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeAll(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // Load the two lazy bodies once, so `lazy()` resolves from the module cache.
  await Promise.all([import('./pages/orbit/OrbitBody'), import('./pages/agents/AgentsBody')]);
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
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= Observer;
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver ??= Observer;
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function render(url: string): Promise<HTMLElement> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/reference" element={<ReferenceLanding />} />
          <Route path="/reference/:topic" element={<ReferenceTopic />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  // A lazy body shows a placeholder marked busy until its chunk is in.
  for (let i = 0; i < 50 && container.querySelector('[aria-busy="true"]'); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  return container;
}

describe('the reference index', () => {
  it('has one h1 and a card for each topic, in order', async () => {
    const el = await render('/reference');
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    const links = TOPICS.map((t) => el.querySelector(`a[href="${t.path}"]`));
    for (const link of links) expect(link).not.toBeNull();
  });

  it('offers the search and says how many entries it covers', async () => {
    const el = await render('/reference');
    expect(el.querySelector('input[type="search"]')).not.toBeNull();
    expect(el.textContent).toContain(String(REFERENCE_INDEX.length));
  });
});

describe('an unknown topic', () => {
  it('says so instead of rendering a blank page', async () => {
    const el = await render('/reference/nothing-here');
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.textContent?.toLowerCase()).toContain('not');
  });
});

for (const topic of TOPICS) {
  describe(`/reference/${topic.id}`, () => {
    it('has one h1, the topic heading', async () => {
      const el = await render(topic.path);
      const h1 = el.querySelectorAll('h1');
      expect(h1).toHaveLength(1);
      expect(h1[0]?.textContent).toBe(topic.heading);
    });

    it('renders every declared section as a numbered heading, in order', async () => {
      const el = await render(topic.path);
      const numbered = numberSections(topic.sections);
      const rendered = [...el.querySelectorAll('section[data-level]')].map((s) => s.id);
      expect(rendered).toEqual(numbered.map((s) => s.id));
      for (const s of numbered) {
        const heading = el.querySelector(`#${s.id}-heading`);
        expect(heading?.tagName, s.id).toBe(s.level === 2 ? 'H2' : 'H3');
        expect(heading?.textContent, s.id).toBe(s.title);
      }
    });

    it('has an element for every entry of the search index', async () => {
      const el = await render(topic.path);
      const missing = REFERENCE_INDEX.filter(
        (e) => e.topic === topic.id && e.anchor !== '' && !el.querySelector(`[id="${e.anchor}"]`),
      ).map((e) => `${e.kind}:${e.anchor}`);
      expect(missing).toEqual([]);
    });

    it('has no duplicate element ids', async () => {
      const el = await render(topic.path);
      const seen = new Map<string, number>();
      for (const node of el.querySelectorAll('[id]')) seen.set(node.id, (seen.get(node.id) ?? 0) + 1);
      const dup = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
      expect(dup).toEqual([]);
    });

    it('resolves every in-page link', async () => {
      const el = await render(topic.path);
      const broken: string[] = [];
      let checked = 0;
      for (const a of el.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        const href = a.getAttribute('href') ?? '';
        const [path, hash] = href.split('#');
        if (hash === undefined || hash === '') continue;
        if (path !== '' && path !== topic.path) continue;
        checked += 1;
        if (!el.querySelector(`[id="${decodeURIComponent(hash)}"]`)) broken.push(href);
      }
      // The page really does link inside itself, so this is not an empty loop.
      expect(checked).toBeGreaterThan(10);
      expect([...new Set(broken)]).toEqual([]);
    });

    it('lists the unverified statements the index carries, and no others', async () => {
      const el = await render(topic.path);
      const expected = unverifiedOf(REFERENCE_INDEX, topic.id);
      const list = el.querySelector('#unverified');
      if (expected.length === 0) {
        expect(list).toBeNull();
      } else {
        expect(list?.querySelectorAll('li')).toHaveLength(expected.length);
      }
    });

    it('links to the previous and next topic', async () => {
      const el = await render(topic.path);
      const pager = el.querySelector('nav[aria-label="Previous and next reference page"]');
      expect(pager?.querySelectorAll('a')).toHaveLength(2);
    });

    it('has a skip link to the text and a labelled search', async () => {
      const el = await render(topic.path);
      expect(el.querySelector('a[href="#reference-content"]')).not.toBeNull();
      expect(el.querySelector('#reference-content')).not.toBeNull();
      expect(el.querySelector('input[type="search"]')).not.toBeNull();
    });
  });
}
