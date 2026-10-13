// @vitest-environment jsdom
/**
 * The markup renderer in its two modes. Reveal wraps every word in a span so the words can rise in one by
 * one; it must never change what is said, and punctuation that touches a piece must stay in the same
 * text run as it (the spans are inline boxes, so the browser keeps them together).
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MarkupText } from './MarkupText';

// A small glossary of our own, so these tests say what a name should look like without depending on the
// content: a plain capitalised name, a proper noun, an acronym and a name with a capital inside.
vi.mock('./glossary', () => {
  const TERMS: Record<string, { id: string; term: string; proper?: boolean; short: string; why: string }> = {
    renewal: {
      id: 'renewal',
      term: 'Renewal',
      short: 'An update that adds time.',
      why: 'Nothing renews alone.',
    },
    'eligible-node': {
      id: 'eligible-node',
      term: 'Eligible node',
      short: 'A node that may run it.',
      why: 'Placement is local.',
    },
    flux: { id: 'flux', term: 'Flux', proper: true, short: 'A cloud.', why: 'It runs your app.' },
    fdm: { id: 'fdm', term: 'FDM', short: 'The domain manager.', why: 'It routes.' },
    'internal-dns': { id: 'internal-dns', term: 'Internal DNS', short: 'Names inside.', why: 'No IPs.' },
  };
  return { getTerm: (id: string) => TERMS[id] };
});

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
});

function render(text: string, reveal: boolean): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<MarkupText text={text} reveal={reveal} />));
  return container;
}

const SAMPLES = [
  'The image is `yourname/quotes:1.2.0`, it listens on 8000 and the budget is tight.',
  'Set it (`ports`) first, then **docker build**, then *push*.',
  'Press {{kbd:Ctrl+K}} to search; read [the docs](https://docs.runonflux.com) too.',
];

describe('MarkupText', () => {
  for (const text of SAMPLES) {
    it(`says the same words with and without reveal: ${text.slice(0, 32)}...`, () => {
      const plain = render(text, false).textContent;
      act(() => root?.unmount());
      container?.remove();
      const revealed = render(text, true).textContent;
      expect(revealed).toBe(plain);
    });
  }

  it('wraps each word of a revealed paragraph in its own span, in order, with a rising index', () => {
    const el = render('One two three', true);
    const words = Array.from(el.querySelectorAll('[class*="word"]'));
    expect(words.map((w) => w.textContent)).toEqual(['One', 'two', 'three']);
    expect(words.map((w) => (w as HTMLElement).style.getPropertyValue('--i'))).toEqual(['0', '1', '2']);
  });

  it('wraps a code chip as one unit and keeps the comma after it as a word of its own', () => {
    const el = render('Use `docker`, then stop.', true);
    const words = Array.from(el.querySelectorAll('[class*="word"]')).map((w) => w.textContent);
    expect(words).toEqual(['Use', 'docker', ',', 'then', 'stop.']);
  });

  it('adds no word wrappers when reveal is off', () => {
    const el = render('One two three', false);
    expect(el.querySelectorAll('[class*="word"]')).toHaveLength(0);
  });
});

describe('MarkupText terms', () => {
  const words = (text: string, props: Partial<React.ComponentProps<typeof MarkupText>> = {}): string[] => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<MarkupText text={text} {...props} />));
    return Array.from(container.querySelectorAll('button')).map((b) => b.textContent ?? '');
  };

  it('lower-cases a plain capitalised name in the middle of a sentence', () => {
    expect(words('Pay for a {{term:renewal}} on each {{term:eligible-node}}.')).toEqual([
      'renewal',
      'eligible node',
    ]);
  });

  it('keeps the name at the start of a sentence', () => {
    expect(
      words('{{term:renewal}} adds time. A {{term:renewal}} costs. {{term:eligible-node}} wins.'),
    ).toEqual(['Renewal', 'renewal', 'Eligible node']);
  });

  it('keeps a proper noun, an acronym and a name with another capital wherever they stand', () => {
    expect(words('Ask {{term:flux}} for the {{term:fdm}} and {{term:internal-dns}}.')).toEqual([
      'Flux',
      'FDM',
      'Internal DNS',
    ]);
  });

  it('honours an explicit |lower and |Cap', () => {
    expect(
      words('{{term:renewal|lower}} first, and a {{term:flux|lower}} and a {{term:eligible-node|Cap}}.'),
    ).toEqual(['renewal', 'flux', 'Eligible node']);
  });

  it('keeps the glossary spelling inside a heading', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root?.render(
        <div>
          <h2>
            Why a <MarkupText text="{{term:renewal}}" /> matters
          </h2>
          <p>
            Why a <MarkupText text="{{term:renewal}}" /> matters
          </p>
        </div>,
      ),
    );
    const heading = container.querySelector('h2 button')?.textContent;
    const paragraph = container.querySelector('p button')?.textContent;
    expect(heading).toBe('Renewal');
    expect(paragraph).toBe('Renewal');
  });

  it('lower-cases a term that follows words in prose, and keeps it with the heading prop', () => {
    expect(words('Why a {{term:renewal}} matters', { heading: true })).toEqual(['Renewal']);
    expect(words('Why a {{term:renewal}} matters', { heading: false })).toEqual(['renewal']);
  });

  it('shows the same words in plain mode, where a term is not a button', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<MarkupText text="Pay for a {{term:renewal}} on {{term:flux}}." plain />));
    expect(container.textContent).toBe('Pay for a renewal on Flux.');
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('writes an unknown term as the words of its id', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<MarkupText text="See {{term:no-such-term}} and {{term:no-such-term|Cap}}." />));
    expect(container.textContent).toBe('See no such term and No such term.');
  });
});

describe('MarkupText links', () => {
  const links = (text: string, props: Partial<React.ComponentProps<typeof MarkupText>> = {}) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root?.render(
        <MemoryRouter>
          <MarkupText text={text} {...props} />
        </MemoryRouter>,
      ),
    );
    return Array.from(container.querySelectorAll('a')).map((a) => ({
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
      text: a.textContent,
    }));
  };

  it('opens an external link in a new tab and keeps a page of the Academy in the same tab', () => {
    const found = links(
      'Read [the docs](https://docs.runonflux.com) and [the plans](/reference/orbit#plans).',
    );
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ href: 'https://docs.runonflux.com/', target: '_blank' });
    expect(found[1]).toMatchObject({ href: '/reference/orbit#plans', target: null });
    expect(found[1]?.text).toBe('the plans');
  });

  it('shows a link as text where links are not wanted, and never links a protocol-relative address', () => {
    expect(links('See [the plans](/reference/orbit).', { plain: true })).toEqual([]);
    expect(links('See [a site](//example.com/page) and [another](http://example.com).')).toEqual([]);
  });
});
