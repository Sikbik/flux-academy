import { describe, expect, it } from 'vitest';
import { destinationPathname, wantsIris } from './transitions';

const base = 'https://academy.test/learn/what-is-flux?step=2';

describe('destinationPathname', () => {
  it('reads strings, relative strings and partial paths', () => {
    expect(destinationPathname('/labs', base)).toBe('/labs');
    expect(destinationPathname('/learn/x?step=1#top', base)).toBe('/learn/x');
    expect(destinationPathname('?step=3', base)).toBe('/learn/what-is-flux');
    expect(destinationPathname({ pathname: '/glossary', search: '?q=a' }, base)).toBe('/glossary');
    expect(destinationPathname({ search: '?q=a' }, base)).toBe('/learn/what-is-flux');
    expect(destinationPathname(-1, base)).toBeNull();
  });
});

describe('wantsIris', () => {
  const ok = {
    to: '/labs',
    explicit: undefined,
    currentPathname: '/learn',
    destinationPathname: '/labs',
    reducedMotion: false,
    supported: true,
  } as const;

  it('plays for a page change', () => {
    expect(wantsIris(ok)).toBe(true);
  });

  it('does not play for reduced motion, no support, history steps, or the same page', () => {
    expect(wantsIris({ ...ok, reducedMotion: true })).toBe(false);
    expect(wantsIris({ ...ok, supported: false })).toBe(false);
    expect(wantsIris({ ...ok, to: -1 })).toBe(false);
    expect(wantsIris({ ...ok, destinationPathname: '/learn' })).toBe(false);
  });

  it('honours an explicit opt out', () => {
    expect(wantsIris({ ...ok, explicit: false })).toBe(false);
    expect(wantsIris({ ...ok, explicit: true })).toBe(true);
  });
});
