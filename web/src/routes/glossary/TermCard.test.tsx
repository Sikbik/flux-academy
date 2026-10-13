// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { GlossaryTerm } from '@/learn/types';
import { TermCard } from './TermCard';

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

const TERM: GlossaryTerm = {
  id: 'port-fee',
  term: 'port fee',
  short: 'An extra USD 2.00 for each public port among `0` to `1023`.',
  why: 'A public port 80 can cost more than a free port.',
  category: 'money',
  lessons: ['resources-pricing', 'no-such-lesson'],
};

function render(node: React.ReactNode): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<MemoryRouter>{node}</MemoryRouter>));
  return container;
}

describe('TermCard', () => {
  it('shows the name, kind, definition, why it matters and a link to the entry', () => {
    const el = render(<TermCard term={TERM} />);
    expect(el.querySelector('h3')?.textContent).toBe('port fee');
    expect(el.textContent).toContain('Money');
    expect(el.textContent).toContain('An extra USD 2.00 for each public port among 0 to 1023.');
    expect(el.textContent).toContain('Why it matters');
    expect(el.querySelector('a[href="/glossary#port-fee"]')).not.toBeNull();
  });

  it('can leave the name to a popover that already shows it', () => {
    const el = render(<TermCard term={TERM} showTitle={false} />);
    expect(el.querySelector('h3')).toBeNull();
    expect(el.textContent).not.toContain('Money');
  });

  it('uses the heading level it is given', () => {
    const el = render(<TermCard term={TERM} headingLevel={5} />);
    expect(el.querySelector('h5')?.textContent).toBe('port fee');
  });

  it('lists the lessons it is tied to, skipping ids that are not lessons', () => {
    const el = render(<TermCard term={TERM} withLessons />);
    const links = Array.from(el.querySelectorAll('a[href^="/learn/"]'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/learn/resources-pricing']);
  });

  it('calls onNavigate when a link is followed', () => {
    let n = 0;
    const el = render(<TermCard term={TERM} onNavigate={() => (n += 1)} />);
    const link = el.querySelector('a[href="/glossary#port-fee"]') as HTMLAnchorElement;
    act(() => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
    expect(n).toBe(1);
  });
});
