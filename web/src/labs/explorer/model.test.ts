import type { ExploreInstance } from '@shared/api';
import { describe, expect, it } from 'vitest';
import {
  describeFailure,
  maskIp,
  publicCalls,
  runningStatus,
  SEEDED_SUGGESTIONS,
  sampleOnlyFailure,
  sinceText,
  summarizePlacement,
} from './model';

describe('maskIp', () => {
  it('keeps two octets and hides the rest', () => {
    expect(maskIp('5.9.73.116')).toBe('5.9.x.x');
    expect(maskIp('208.102.14.252')).toBe('208.102.x.x');
    expect(maskIp('45.152.51.172:16127')).toBe('45.152.x.x');
  });

  it('handles IPv6 and junk', () => {
    expect(maskIp('2a01:4f8:abcd:1::5')).toBe('2a01:4f8::x');
    expect(maskIp('')).toBe('hidden');
    expect(maskIp('not an address')).toBe('hidden');
  });

  it('never returns a full address', () => {
    for (const ip of ['1.2.3.4', '255.255.255.255', '10.0.0.1', '192.0.2.10']) {
      expect(maskIp(ip)).toMatch(/^\d+\.\d+\.x\.x$/);
    }
  });
});

describe('publicCalls', () => {
  it('builds the two read-only calls a learner can repeat', () => {
    const [spec, loc] = publicCalls('Minecraft');
    expect(spec?.url).toBe('https://api.runonflux.io/apps/appspecifications/Minecraft');
    expect(loc?.url).toBe('https://api.runonflux.io/apps/location/Minecraft');
    expect(spec?.curl).toBe('curl -s https://api.runonflux.io/apps/appspecifications/Minecraft');
  });

  it('escapes the name and prefers the URLs the server sent when they are the public API', () => {
    const [spec] = publicCalls('a b', {
      specUrl: 'https://api.runonflux.io/apps/appspecifications/a%20b',
      locationUrl: 'https://evil.example/x',
    });
    expect(spec?.url).toBe('https://api.runonflux.io/apps/appspecifications/a%20b');
    const [, loc] = publicCalls('a b', {
      specUrl: '',
      locationUrl: 'https://evil.example/x',
    });
    expect(loc?.url).toBe('https://api.runonflux.io/apps/location/a%20b');
  });
});

describe('describeFailure', () => {
  const err = (over: object) => ({ kind: 'http' as const, message: 'x', ...over });

  it('explains a missing app and what to try', () => {
    const v = describeFailure(err({ status: 404, code: 'app_not_found' }), 'ghost');
    expect(v?.reason).toBe('not-found');
    expect(v?.title).toContain('ghost');
    expect(v?.body).toMatch(/expired|misspelled/);
    expect(v?.body).toMatch(/part of the name/);
  });

  it('names a bad name, a rate limit and an upstream outage', () => {
    expect(describeFailure(err({ status: 400, code: 'bad_name' }), 'x')?.reason).toBe('bad-name');
    const rl = describeFailure(err({ status: 429, retryAfterMs: 4200 }), 'x');
    expect(rl?.reason).toBe('rate-limited');
    expect(rl?.retryAfterSec).toBe(5);
    expect(describeFailure(err({ status: 503, code: 'upstream_unavailable' }), 'x')?.reason).toBe(
      'unavailable',
    );
  });

  it('says plainly that sample mode only has the made-up app', () => {
    const v = sampleOnlyFailure('Minecraft');
    expect(v.reason).toBe('sample-only');
    expect(v.title).toContain('Minecraft');
    expect(v.body).toMatch(/sample app/);
    expect(v.retryAfterSec).toBeNull();
  });

  it('treats a network error as offline and an abort as nothing', () => {
    expect(describeFailure({ kind: 'network', message: 'down' }, 'x')?.reason).toBe('offline');
    expect(describeFailure({ kind: 'timeout', message: 'slow' }, 'x')?.reason).toBe('offline');
    expect(describeFailure({ kind: 'aborted', message: 'cancelled' }, 'x')).toBeNull();
  });
});

describe('summarizePlacement', () => {
  const inst = (cc: string | null, tier: ExploreInstance['tier']): ExploreInstance => ({
    ip: '1.2.3.4',
    tier,
    cc,
    country: cc === 'DE' ? 'Germany' : cc === 'US' ? 'United States' : null,
    lat: null,
    lon: null,
    broadcastedAt: null,
  });

  it('counts countries and tiers', () => {
    const s = summarizePlacement([
      inst('DE', 'stratus'),
      inst('DE', 'cumulus'),
      inst('US', 'nimbus'),
      inst(null, null),
    ]);
    expect(s.countries).toEqual([
      { cc: 'DE', name: 'Germany', instances: 2 },
      { cc: 'US', name: 'United States', instances: 1 },
    ]);
    expect(s.tiers).toEqual({ cumulus: 1, nimbus: 1, stratus: 1 });
    expect(s.unknownTier).toBe(1);
    expect(s.unlocated).toBe(1);
  });
});

describe('runningStatus', () => {
  it('is honest about a shortfall', () => {
    expect(runningStatus({ instancesRunning: 3, instancesWanted: 3 }).tone).toBe('ok');
    expect(runningStatus({ instancesRunning: 1, instancesWanted: 3 }).tone).toBe('warn');
    expect(runningStatus({ instancesRunning: 0, instancesWanted: 3 }).tone).toBe('crit');
    expect(runningStatus({ instancesRunning: 2, instancesWanted: 0 }).word).toBe('Unknown');
  });
});

describe('sinceText', () => {
  const now = Date.parse('2026-10-12T21:00:00Z');
  it('reads like a person', () => {
    expect(sinceText('2026-10-12T20:59:30Z', now)).toBe('just now');
    expect(sinceText('2026-10-12T20:48:00Z', now)).toBe('12 min ago');
    expect(sinceText('2026-10-12T17:00:00Z', now)).toBe('4 h ago');
    expect(sinceText(null, now)).toBe('unknown');
    expect(sinceText('garbage', now)).toBe('unknown');
  });
});

describe('seeded suggestions', () => {
  it('has three, as the brief asks, with unique names', () => {
    expect(SEEDED_SUGGESTIONS).toHaveLength(3);
    expect(new Set(SEEDED_SUGGESTIONS.map((s) => s.name)).size).toBe(3);
  });
});
