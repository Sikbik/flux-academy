import { LESSONS, labById } from '@shared/curriculum';
import { describe, expect, it } from 'vitest';
import { buildHead } from './meta';

describe('buildHead', () => {
  it('uses the route table for known routes', () => {
    const h = buildHead('/labs');
    expect(h.title).toBe('Labs | Flux Academy');
    expect(h.canonical).toBe('https://academy.app.runonflux.io/labs');
    expect(h.noindex).toBe(false);
  });

  it('leads with the name on the home page', () => {
    expect(buildHead('/').title).toContain('Flux Academy:');
  });

  it('knows lessons and labs from the curriculum', () => {
    const lesson = LESSONS[0];
    expect(buildHead(`/learn/${lesson?.id}`).title).toBe(`${lesson?.title} | Flux Academy`);
    expect(buildHead('/labs/failover').title).toBe(`${labById('failover')?.title} | Flux Academy`);
  });

  it('marks an unknown route as not found and noindex', () => {
    const h = buildHead('/nope');
    expect(h.title).toBe('Page not found | Flux Academy');
    expect(h.noindex).toBe(true);
  });

  it('lets overrides win, the last one first', () => {
    const h = buildHead('/labs', { title: 'Route title' }, { title: 'Page title', description: 'Mine' });
    expect(h.title).toBe('Page title | Flux Academy');
    expect(h.description).toBe('Mine');
  });

  it('tolerates a trailing slash', () => {
    expect(buildHead('/labs/').canonical).toBe('https://academy.app.runonflux.io/labs');
  });
});
