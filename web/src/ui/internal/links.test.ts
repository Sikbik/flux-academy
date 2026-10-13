import { describe, expect, it } from 'vitest';
import { isExternalHref, isSafeHref } from './links';

describe('links', () => {
  it('accepts site-relative and http(s) links', () => {
    expect(isSafeHref('/learn/first-deploy')).toBe(true);
    expect(isSafeHref('#why')).toBe(true);
    expect(isSafeHref('../reference')).toBe(true);
    expect(isSafeHref('https://docs.runonflux.com')).toBe(true);
    expect(isSafeHref('http://example.com/a?b=c')).toBe(true);
    expect(isSafeHref('mailto:hi@example.com')).toBe(true);
  });

  it('rejects script and data URLs', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref(' JaVaScRiPt:alert(1)')).toBe(false);
    expect(isSafeHref('data:text/html;base64,AAAA')).toBe(false);
    expect(isSafeHref('vbscript:x')).toBe(false);
    expect(isSafeHref('//evil.example/x')).toBe(false);
    expect(isSafeHref('')).toBe(false);
  });

  it('classifies external hrefs without a window', () => {
    expect(isExternalHref('https://docs.runonflux.com')).toBe(true);
    expect(isExternalHref('//cdn.example/x.js')).toBe(true);
    expect(isExternalHref('/learn')).toBe(false);
    expect(isExternalHref('#top')).toBe(false);
  });
});
