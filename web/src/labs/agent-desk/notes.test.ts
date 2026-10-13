import { describe, expect, it } from 'vitest';
import { getTerm } from '@/learn/glossary';
import { markupRefs, parseMarkup } from '@/learn/markup';
import { ABOUT, TEACH } from './notes';

const ALL = [...ABOUT, ...TEACH];

describe('the Agent Desk notes', () => {
  it('parse as markup with no problem', () => {
    for (const text of ALL) expect(parseMarkup(text).problems, text).toEqual([]);
  });

  it('link only glossary terms that exist', () => {
    const ids = ALL.flatMap((t) => markupRefs(t).terms);
    expect(ids.length).toBeGreaterThan(4);
    for (const id of ids) expect(getTerm(id), `glossary term ${id}`).toBeDefined();
  });

  it('use plain words: no dash in prose, no emoji, no exclamation mark', () => {
    for (const text of ALL) {
      expect(text).not.toMatch(/[\u2013\u2014]/);
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text).not.toContain('!');
    }
  });

  it('say that the agent is a script and that nothing leaves the page', () => {
    expect(TEACH[0]).toMatch(/script, not a model/);
    expect(TEACH[0]).toMatch(/nothing leaves the page/);
  });
});
