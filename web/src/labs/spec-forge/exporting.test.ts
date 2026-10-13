import { defaultSpec } from '@shared/flux/spec';
import { describe, expect, it } from 'vitest';
import { ENTERPRISE_PLACEHOLDER } from '@/forge/model';
import { deployCopy, shareCopy } from './exporting';

describe('deployCopy', () => {
  it('copies the spec as pretty JSON', () => {
    const { text, enterpriseLeftEmpty } = deployCopy(defaultSpec());
    expect(enterpriseLeftEmpty).toBe(false);
    expect(JSON.parse(text).name).toBe('hello-flux');
    expect(text).toContain('\n');
  });

  it('leaves the enterprise placeholder out and says so', () => {
    const spec = { ...defaultSpec(), enterprise: ENTERPRISE_PLACEHOLDER };
    const { text, enterpriseLeftEmpty } = deployCopy(spec);
    expect(enterpriseLeftEmpty).toBe(true);
    expect(JSON.parse(text).enterprise).toBe('');
    expect(text).not.toContain(ENTERPRISE_PLACEHOLDER);
  });

  it('keeps a real encrypted value', () => {
    const spec = { ...defaultSpec(), enterprise: 'AAAA' };
    expect(JSON.parse(deployCopy(spec).text).enterprise).toBe('AAAA');
  });
});

describe('shareCopy', () => {
  it('passes a spec without credentials through untouched', () => {
    const spec = defaultSpec();
    const r = shareCopy(spec);
    expect(r.credentialsLeftOut).toBe(0);
    expect(r.spec).toBe(spec);
  });

  it('never puts registry credentials in a link', () => {
    const base = defaultSpec();
    const c = base.compose[0];
    if (!c) throw new Error('no component');
    const spec = {
      ...base,
      compose: [
        { ...c, repoauth: 'user:secret-token' },
        { ...c, name: 'two', repoauth: '' },
      ],
    };
    const r = shareCopy(spec);
    expect(r.credentialsLeftOut).toBe(1);
    expect(JSON.stringify(r.spec)).not.toContain('secret-token');
    expect(r.spec.compose[1]?.name).toBe('two');
    // The original is not changed.
    expect(spec.compose[0]?.repoauth).toBe('user:secret-token');
  });
});
