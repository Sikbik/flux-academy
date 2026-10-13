import { describe, expect, it } from 'vitest';
import { sanitizeId, tabIds } from './ids';

describe('tabIds', () => {
  it('builds paired ids from the base and the value', () => {
    expect(tabIds('forge', 'json')).toEqual({ tab: 'forge-tab-json', panel: 'forge-panel-json' });
  });

  it('sanitises awkward values', () => {
    expect(sanitizeId('a b/c:d')).toBe('a_b_c_d');
    expect(tabIds('x', 'Spec Forge #1').tab).toBe('x-tab-Spec_Forge__1');
  });

  it('is deterministic', () => {
    expect(tabIds('a', 'b')).toEqual(tabIds('a', 'b'));
  });
});
