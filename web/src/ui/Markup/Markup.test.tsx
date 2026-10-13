// @vitest-environment jsdom
/**
 * The design system's `Markup`: how a term reads in a sentence (the one rule of `learn/markup.ts`), and
 * the shared card a term opens.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { MarkupContext } from './context';
import { Markup } from './Markup';

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

const TERMS: Record<string, { id: string; term: string; proper?: boolean; short: string; why?: string }> = {
  instance: {
    id: 'instance',
    term: 'Instance',
    short: 'One running copy of your app.',
    why: 'More is safer.',
  },
  flux: { id: 'flux', term: 'Flux', proper: true, short: 'A cloud.' },
  fdm: { id: 'fdm', term: 'FDM', short: 'The domain manager.' },
};

const context: MarkupContext = {
  term: (id) => {
    const t = TERMS[id];
    return t ? { ...t, href: `/glossary#${t.id}` } : undefined;
  },
};

function render(node: React.ReactNode): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

describe('Markup terms', () => {
  it('reads a plain capitalised name as prose wants it', () => {
    const el = render(
      <Markup
        context={context}
        text="Your only {{term:instance}} runs on {{term:flux}} with the {{term:fdm}}."
      />,
    );
    expect(el.textContent).toBe('Your only instance runs on Flux with the FDM.');
  });

  it('keeps the name at the start of a sentence and of the text', () => {
    const el = render(
      <Markup
        context={context}
        text="{{term:instance}} first. Then an {{term:instance}}. {{term:instance}} again."
      />,
    );
    expect(el.textContent).toBe('Instance first. Then an instance. Instance again.');
  });

  it('keeps the glossary spelling in a heading, and honours |lower and |Cap', () => {
    const heading = render(
      <Markup context={context} heading text="Why an {{term:instance}} is not a server" />,
    );
    expect(heading.textContent).toBe('Why an Instance is not a server');
    act(() => root?.unmount());
    container?.remove();
    const forced = render(
      <Markup
        context={context}
        heading
        text="a {{term:instance|lower}} and {{term:flux|lower}} and {{term:fdm|Cap}}"
      />,
    );
    expect(forced.textContent).toBe('a instance and flux and FDM');
  });

  it('shows the same words with the cards off (inline) as with them on', () => {
    const on = render(<Markup context={context} text="Your only {{term:instance}}." />).textContent;
    act(() => root?.unmount());
    container?.remove();
    const off = render(<Markup context={context} inline text="Your only {{term:instance}}." />).textContent;
    expect(off).toBe(on);
    expect(off).toBe('Your only instance.');
  });

  it('writes a term it cannot resolve as the words of its id', () => {
    const el = render(
      <Markup text="The {{term:flux-daemon-manager}} and {{term:flux-daemon-manager|Cap}}." />,
    );
    expect(el.textContent).toBe('The flux daemon manager and Flux daemon manager.');
  });

  it('makes a card trigger only when there is a card to open', () => {
    const el = render(<Markup context={context} text="An {{term:instance}} and {{term:nope}}." />);
    expect(el.querySelectorAll('button')).toHaveLength(1);
    const plain = el.querySelector('span[data-plain="true"]');
    expect(plain?.textContent).toBe('nope');
  });
});

describe('Markup cross-references', () => {
  const links: MarkupContext = {
    lab: (id) => ({ title: 'Spec Forge', href: `/labs/${id}` }),
    lesson: (id) => ({ title: 'First deploy', href: `/learn/${id}` }),
  };

  it('keeps the icon and the first word of a lab link together', () => {
    const el = render(<Markup context={links} inline text="Check it in {{lab:spec-forge}} today." />);
    const link = el.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/labs/spec-forge');
    expect(link.textContent).toBe('Spec Forge');
    // The lead is one element holding the glyph and the first word; the rest of the title follows it.
    const lead = link.firstElementChild as HTMLElement;
    expect(lead.querySelector('svg')).not.toBeNull();
    expect(lead.textContent).toBe('Spec');
    expect(link.lastChild?.textContent).toBe(' Forge');
  });

  it('handles a one word title', () => {
    const el = render(
      <Markup
        context={{ lab: () => ({ title: 'Terminal', href: '/labs/terminal' }) }}
        inline
        text="{{lab:terminal}}"
      />,
    );
    const link = el.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent).toBe('Terminal');
    expect((link.firstElementChild as HTMLElement).textContent).toBe('Terminal');
  });
});
