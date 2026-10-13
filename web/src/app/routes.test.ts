import { describe, expect, it } from 'vitest';
import { cleanPath, compileRoutes, normalizeRouteDef } from './routes';

describe('normalizeRouteDef', () => {
  it('accepts a default export, a named route export, and named path and meta', () => {
    expect(normalizeRouteDef({ default: { path: '/learn' } })).toEqual({ path: '/learn', meta: undefined });
    expect(normalizeRouteDef({ route: { path: '/glossary', meta: { title: 'Terms' } } })).toEqual({
      path: '/glossary',
      meta: { title: 'Terms' },
    });
    expect(normalizeRouteDef({ path: '/profile', meta: { noindex: true } })).toEqual({
      path: '/profile',
      meta: { noindex: true },
    });
  });

  it('accepts several paths and the not-found splat', () => {
    expect(normalizeRouteDef({ default: { path: ['/labs', '/labs/:labId'] } })?.path).toEqual([
      '/labs',
      '/labs/:labId',
    ]);
    expect(normalizeRouteDef({ default: { path: '*' } })?.path).toBe('*');
  });

  it('rejects an unusable module', () => {
    expect(normalizeRouteDef(null)).toBeNull();
    expect(normalizeRouteDef({ default: {} })).toBeNull();
    expect(normalizeRouteDef({ default: { path: 'learn' } })).toBeNull();
    expect(normalizeRouteDef({ default: { path: [] } })).toBeNull();
    expect(normalizeRouteDef({ default: { path: ['/ok', 'bad'] } })).toBeNull();
  });
});

describe('compileRoutes', () => {
  it('flattens, sorts by folder and keeps the first claim of a path', () => {
    const { entries, problems } = compileRoutes({
      reference: { default: { path: ['/reference', '/reference/:topic'] } },
      learn: { default: { path: '/learn' } },
      dupe: { default: { path: '/learn/' } },
      broken: { default: {} },
    });
    expect(entries.map((e) => `${e.folder}:${e.path}`)).toEqual([
      'dupe:/learn',
      'reference:/reference',
      'reference:/reference/:topic',
    ]);
    expect(problems.some((p) => p.includes('both claim /learn'))).toBe(true);
    expect(problems.some((p) => p.includes('broken'))).toBe(true);
  });
});

describe('cleanPath', () => {
  it('drops trailing slashes but keeps the root and the splat', () => {
    expect(cleanPath('/learn/')).toBe('/learn');
    expect(cleanPath('/')).toBe('/');
    expect(cleanPath('*')).toBe('*');
    expect(cleanPath('///')).toBe('/');
  });
});
