import { describe, expect, it } from 'vitest';
import { computeBacklinks, type LessonTerms, termsOfLesson } from './backlinks';

const KNOWN = new Set(['what-is-flux', 'how-apps-run', 'custom-domains']);

function lesson(id: string, introduced: string[], mentioned: string[]): LessonTerms {
  return { id, introduced, mentioned: new Set(mentioned) };
}

describe('termsOfLesson', () => {
  it('finds a term directive in any string, however deep', () => {
    const found = termsOfLesson({
      id: 'x',
      terms: ['image'],
      steps: [
        {
          id: 's',
          body: ['An {{term:image}} runs as a {{term:container}}.'],
          callouts: [{ kind: 'tip', body: 'See {{term:port-fee}}' }],
        },
      ],
      recap: ['{{lesson:how-apps-run}} is not a term'],
    });
    expect([...found.mentioned].sort()).toEqual(['container', 'image', 'port-fee']);
    expect(found.introduced).toEqual(['image']);
  });
  it('counts a term written with a display-case modifier', () => {
    const found = termsOfLesson({
      id: 'x',
      terms: [],
      steps: [{ id: 's', body: ['Say {{term:port-fee|lower}} here, and {{term:instance|Cap}} there.'] }],
    });
    expect([...found.mentioned].sort()).toEqual(['instance', 'port-fee']);
  });
  it('does not count other directives', () => {
    const found = termsOfLesson({
      id: 'x',
      terms: [],
      hook: '{{lab:spec-forge}} {{lesson:y}} {{kbd:Ctrl+K}}',
    });
    expect(found.mentioned.size).toBe(0);
  });
});

describe('computeBacklinks', () => {
  it('uses the glossary lessons field with nothing loaded', () => {
    const index = computeBacklinks([{ id: 'cname', lessons: ['custom-domains'] }], [], KNOWN);
    expect(index.get('cname')).toEqual([{ lessonId: 'custom-domains', kind: 'listed' }]);
  });
  it('adds introduced and mentioned lessons and keeps the strongest kind', () => {
    const index = computeBacklinks(
      [{ id: 'fluxnode', lessons: ['what-is-flux'] }],
      [lesson('what-is-flux', ['fluxnode'], ['fluxnode']), lesson('how-apps-run', [], ['fluxnode'])],
      KNOWN,
    );
    expect(index.get('fluxnode')).toEqual([
      { lessonId: 'what-is-flux', kind: 'introduced' },
      { lessonId: 'how-apps-run', kind: 'mentioned' },
    ]);
  });
  it('orders by the curriculum, not by arrival', () => {
    const index = computeBacklinks(
      [],
      [lesson('how-apps-run', [], ['t']), lesson('what-is-flux', [], ['t'])],
      KNOWN,
    );
    expect(index.get('t')?.map((r) => r.lessonId)).toEqual(['what-is-flux', 'how-apps-run']);
  });
  it('drops lessons that are not in the curriculum', () => {
    const index = computeBacklinks([{ id: 'a', lessons: ['ghost'] }], [lesson('ghost', ['a'], [])], KNOWN);
    expect(index.get('a')).toBeUndefined();
  });
  it('has no entry for a term nothing mentions', () => {
    expect(computeBacklinks([{ id: 'lonely' }], [], KNOWN).get('lonely')).toBeUndefined();
  });
});
