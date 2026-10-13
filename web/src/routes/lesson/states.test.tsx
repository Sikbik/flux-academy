// @vitest-environment jsdom
/**
 * The states around the player render and say the right thing: a lesson being written, one that failed
 * to load, and the loading skeleton. These are the states no real curriculum lesson reaches any more.
 */

import { LESSONS } from '@shared/curriculum';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ComingSoon, LessonError, LessonSkeleton } from './states';

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

function render(node: React.ReactNode): () => string {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<MemoryRouter>{node}</MemoryRouter>));
  return () => container?.textContent ?? '';
}

describe('lesson states', () => {
  it('says a lesson is being written and links to what to finish first', () => {
    const withPrereq = LESSONS.find((l) => l.prerequisites.length > 0);
    if (!withPrereq) throw new Error('the curriculum has no lesson with a prerequisite');
    const text = render(<ComingSoon meta={withPrereq} />);
    expect(text()).toContain(withPrereq.title);
    expect(text()).toContain('being written');
    expect(text()).toContain('Worth finishing first');
    const links = Array.from(container?.querySelectorAll('a') ?? []).map((a) => a.getAttribute('href'));
    expect(links.some((h) => h?.startsWith('/learn/'))).toBe(true);
  });

  it('shows the failure message and a way to reload', () => {
    const text = render(<LessonError message="Unexpected token in first-deploy.ts" />);
    expect(text()).toContain('could not be loaded');
    expect(text()).toContain('Unexpected token in first-deploy.ts');
    expect(text()).toContain('Reload the page');
    expect(text()).toContain('progress is saved in this browser');
  });

  it('announces loading to assistive tech without drawing anything else', () => {
    const text = render(<LessonSkeleton />);
    expect(text()).toContain('Loading the lesson');
    expect(container?.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
