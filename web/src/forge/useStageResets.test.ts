import { describe, expect, it } from 'vitest';
import { splitStepKey } from './useStageResets';

describe('splitStepKey', () => {
  it('separates the step id from the nonce', () => {
    expect(splitStepKey('port:3')).toEqual({ id: 'port', rest: '3' });
    expect(splitStepKey('port:3:9')).toEqual({ id: 'port', rest: '3:9' });
    expect(splitStepKey('port')).toEqual({ id: 'port', rest: '' });
  });
});
