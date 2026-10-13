// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TermCard, type TermCardProps } from './TermCard';

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

function render(props: Partial<TermCardProps> = {}): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const base: TermCardProps = {
    term: {
      id: 'port-fee',
      name: 'port fee',
      kind: 'Money',
      short: 'An extra USD 2.00 for each low port.',
      why: 'A public port 80 can cost more than a free port.',
      lessons: [
        { id: 'a', title: 'Lesson A', href: '/learn/a' },
        { id: 'b', title: 'Lesson B', href: '/learn/b' },
        { id: 'c', title: 'Lesson C', href: '/learn/c' },
      ],
      related: [
        { id: 'expire', name: 'expire', href: '/glossary#expire' },
        { id: 'quote', name: 'quote', href: '/glossary#quote' },
      ],
      href: '/glossary#port-fee',
      docs: 'https://docs.runonflux.com/x',
    },
    renderLink: ({ href, className, children, onClick }) => (
      <a
        href={href}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          onClick?.();
        }}
      >
        {children}
      </a>
    ),
  };
  act(() => root?.render(<TermCard {...base} {...props} />));
  return container;
}

describe('TermCard', () => {
  it('draws the name, kind, definition, why it matters and the way to the entry', () => {
    const el = render();
    expect(el.querySelector('h3')?.textContent).toBe('port fee');
    expect(el.textContent).toContain('Money');
    expect(el.textContent).toContain('An extra USD 2.00 for each low port.');
    expect(el.textContent).toContain('Why it matters');
    expect(el.querySelector('a[href="/glossary#port-fee"]')?.textContent).toContain('Open in the glossary');
    expect(el.querySelector('article')?.getAttribute('data-term')).toBe('port-fee');
  });

  it('is named by its heading, and is not when the name is left to a popover', () => {
    const el = render();
    const article = el.querySelector('article');
    const heading = el.querySelector('h3');
    expect(article?.getAttribute('aria-labelledby')).toBe(heading?.id);
    act(() => root?.unmount());
    container?.remove();
    const quiet = render({ showTitle: false });
    expect(quiet.querySelector('h3')).toBeNull();
    expect(quiet.querySelector('article')?.hasAttribute('aria-labelledby')).toBe(false);
    expect(quiet.textContent).not.toContain('Money');
  });

  it('uses the heading level it is given', () => {
    expect(render({ headingLevel: 2 }).querySelector('h2')?.textContent).toBe('port fee');
  });

  it('lists lessons and related terms only when asked, up to the limit', () => {
    const none = render();
    expect(none.querySelectorAll('a[href^="/learn/"]')).toHaveLength(0);
    expect(none.textContent).not.toContain('Related');
    act(() => root?.unmount());
    container?.remove();
    const some = render({ maxLessons: 2, maxRelated: 1 });
    expect(Array.from(some.querySelectorAll('a[href^="/learn/"]')).map((a) => a.textContent)).toEqual([
      'Lesson A',
      'Lesson B',
    ]);
    expect(some.querySelectorAll('a[href^="/glossary#"]:not([href="/glossary#port-fee"])')).toHaveLength(1);
  });

  it('makes related terms buttons when the host swaps the card itself', () => {
    const open = vi.fn();
    const el = render({ maxRelated: 2, onOpenTerm: open });
    const buttons = Array.from(el.querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent)).toEqual(['expire', 'quote']);
    act(() => buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(open).toHaveBeenCalledWith('quote');
  });

  it('calls onNavigate for an internal link and shows the docs link only when asked', () => {
    const navigate = vi.fn();
    const el = render({ onNavigate: navigate, maxLessons: 1 });
    expect(el.querySelector('a[target="_blank"]')).toBeNull();
    const link = el.querySelector('a[href="/learn/a"]') as HTMLAnchorElement;
    act(() => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
    expect(navigate).toHaveBeenCalledTimes(1);
    act(() => root?.unmount());
    container?.remove();
    const withDocs = render({ withDocs: true });
    const docs = withDocs.querySelector('a[target="_blank"]');
    expect(docs?.getAttribute('href')).toBe('https://docs.runonflux.com/x');
    expect(docs?.getAttribute('rel')).toContain('noopener');
    expect(docs?.textContent).toContain('opens in a new tab');
  });

  it('leaves out the footer when there is nowhere to go', () => {
    const el = render({
      term: { id: 'x', name: 'x', short: 'A definition.' },
    });
    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).not.toContain('Why it matters');
  });
});
