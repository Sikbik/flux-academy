import { describe, expect, it } from 'vitest';
import { createSequenceMatcher, KONAMI } from './konami';

describe('createSequenceMatcher', () => {
  it('completes on the exact sequence, case insensitively', () => {
    const m = createSequenceMatcher();
    const results = KONAMI.map((k) => m.push(k.toUpperCase()));
    expect(results.slice(0, -1).every((r) => !r)).toBe(true);
    expect(results.at(-1)).toBe(true);
  });

  it('restarts on a wrong key but keeps a repeated first key', () => {
    const m = createSequenceMatcher();
    m.push('arrowup');
    m.push('arrowup');
    m.push('arrowup'); // an extra Up must not break the code
    let done = false;
    for (const k of KONAMI.slice(2)) done = m.push(k);
    expect(done).toBe(true);
  });

  it('can be used twice and reset', () => {
    const m = createSequenceMatcher(['a', 'b']);
    expect(m.push('a')).toBe(false);
    expect(m.push('b')).toBe(true);
    m.push('a');
    m.reset();
    expect(m.push('b')).toBe(false);
  });
});
