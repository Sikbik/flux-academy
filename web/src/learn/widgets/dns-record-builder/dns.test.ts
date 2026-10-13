import { describe, expect, it } from 'vitest';
import {
  appDomainOf,
  type DnsCase,
  type Draft,
  domainsFor,
  emptyDraft,
  evaluate,
  FDM_ADDRESS,
  FDM_HOST,
  freeAddressChain,
  isApex,
  isHostname,
  isIPv4,
  PROVIDERS,
  type Provider,
  readCase,
  relativeName,
  solutionFor,
  zoneOf,
} from './dns';

const sub: DnsCase = {
  domain: 'shop.example.com',
  kind: 'subdomain',
  provider: null,
  appName: 'lanternshop',
};
const apex: DnsCase = { domain: 'example.com', kind: 'apex', provider: null, appName: 'lanternshop' };
const APP = 'lanternshop.app.runonflux.io';

function draft(over: Partial<Draft>): Draft {
  return { type: 'CNAME', name: '', value: '', ttl: 'auto', proxied: false, ...over };
}

const codes = (d: Draft, c: DnsCase, p: Provider) => evaluate(d, c, p).issues.map((i) => i.code);

describe('names', () => {
  it('finds the zone and the relative name', () => {
    expect(zoneOf('shop.example.com')).toBe('example.com');
    expect(zoneOf('example.com')).toBe('example.com');
    expect(zoneOf('a.b.example.com')).toBe('example.com');
    expect(zoneOf('shop.example.co.uk')).toBe('example.co.uk');
    expect(zoneOf('example.co.uk')).toBe('example.co.uk');
    expect(relativeName('shop.example.com')).toBe('shop');
    expect(relativeName('a.b.example.com')).toBe('a.b');
    expect(relativeName('example.com')).toBe('@');
    expect(relativeName('example.co.uk')).toBe('@');
  });

  it('knows an apex from a subdomain', () => {
    expect(isApex('example.com')).toBe(true);
    expect(isApex('example.co.uk')).toBe(true);
    expect(isApex('shop.example.com')).toBe(false);
    expect(isApex('')).toBe(false);
  });

  it('validates hosts and addresses', () => {
    expect(isIPv4('203.0.113.40')).toBe(true);
    expect(isIPv4('256.1.1.1')).toBe(false);
    expect(isIPv4('01.2.3.4')).toBe(false);
    expect(isIPv4('lanternshop.app.runonflux.io')).toBe(false);
    expect(isHostname(APP)).toBe(true);
    expect(isHostname('lanternshop')).toBe(false);
    expect(isHostname('-bad.example.com')).toBe(false);
    expect(isHostname('a b.example.com')).toBe(false);
  });

  it('lower cases the app domain as FDM does', () => {
    expect(appDomainOf('LanternShop')).toBe(APP);
  });
});

describe('readCase', () => {
  it('reads the object form from the brief', () => {
    const c = readCase({
      case: { domain: 'Shop.Example.com.', kind: 'subdomain', provider: 'cloudflare' },
      appName: 'myapp',
    });
    expect(c).toEqual({
      domain: 'shop.example.com',
      kind: 'subdomain',
      provider: 'cloudflare',
      appName: 'myapp',
    });
  });

  it('reads the flat form the lessons use', () => {
    expect(readCase({ case: 'subdomain', domain: 'shop.example.com', app: 'lanternshop' })).toEqual(sub);
    expect(readCase({ case: 'apex', domain: 'example.com', app: 'lanternshop' })).toEqual(apex);
  });

  it('lets the domain decide the kind when they disagree', () => {
    expect(readCase({ case: 'subdomain', domain: 'example.com' }).kind).toBe('apex');
    expect(readCase({ case: { domain: 'www.example.com', kind: 'apex' } }).kind).toBe('subdomain');
  });

  it('falls back to a usable case', () => {
    expect(readCase(undefined)).toEqual({ ...sub, appName: 'lanternshop' });
    expect(readCase({ case: 'apex' }).domain).toBe('example.com');
    expect(readCase({ case: 'apex' }).kind).toBe('apex');
    expect(readCase({ case: 7, domain: 42, app: '' }).domain).toBe('shop.example.com');
    expect(readCase({ provider: 'cloudflare' }).provider).toBe('cloudflare');
    expect(readCase({ provider: 'route53' }).provider).toBeNull();
  });
});

describe('a subdomain', () => {
  it('is correct as a CNAME to the free address, at every provider', () => {
    for (const p of ['cloudflare', 'namecheap', 'generic'] as const) {
      const e = evaluate(draft({ name: 'shop', value: APP }), sub, p);
      expect(e.correct).toBe(true);
      expect(e.outcome).toBe('flux');
      expect(e.hops.map((h) => h.type)).toEqual(['CNAME', 'CNAME', 'A']);
      expect(e.hops[0]?.name).toBe('shop.example.com');
      expect(e.hops[1]?.name).toBe(APP);
      expect(e.hops[2]?.name).toBe(FDM_HOST);
      expect(e.hops[2]?.data).toBe(FDM_ADDRESS);
    }
  });

  it('accepts the full name, a trailing dot and capitals in the value', () => {
    expect(evaluate(draft({ name: 'shop', value: `${APP.toUpperCase()}.` }), sub, 'generic').correct).toBe(
      true,
    );
    expect(evaluate(draft({ name: 'SHOP', value: APP }), sub, 'generic').correct).toBe(true);
  });

  it('accepts the full domain in the name only where the provider recognises it', () => {
    expect(evaluate(draft({ name: 'shop.example.com', value: APP }), sub, 'cloudflare').correct).toBe(true);
    const g = evaluate(draft({ name: 'shop.example.com', value: APP }), sub, 'generic');
    expect(g.correct).toBe(false);
    expect(g.issues.map((i) => i.code)).toContain('NAME_DOUBLED');
    expect(g.stored?.fqdn).toBe('shop.example.com.example.com');
    expect(g.outcome).toBe('nxdomain');
  });

  it('is also correct as an A record to the address the free address resolves to', () => {
    const e = evaluate(draft({ type: 'A', name: 'shop', value: FDM_ADDRESS }), sub, 'generic');
    expect(e.correct).toBe(true);
    expect(e.hops.map((h) => h.type)).toEqual(['A']);
    expect(e.issues.map((i) => i.code)).toContain('A_UPKEEP');
  });

  it('is correct as an ALIAS where the provider offers one', () => {
    expect(evaluate(draft({ type: 'ALIAS', name: 'shop', value: APP }), sub, 'namecheap').correct).toBe(true);
  });

  it('says what is wrong with the name', () => {
    expect(codes(draft({ name: '', value: APP }), sub, 'generic')).toContain('NAME_EMPTY');
    expect(codes(draft({ name: '@', value: APP }), sub, 'generic')).toContain('NAME_IS_APEX');
    expect(codes(draft({ name: 'www', value: APP }), sub, 'generic')).toContain('NAME_OTHER');
    expect(codes(draft({ name: 'sh op', value: APP }), sub, 'generic')).toContain('NAME_FORMAT');
  });

  it('says what is wrong with the target', () => {
    const cases: [string, string][] = [
      ['https://lanternshop.app.runonflux.io', 'VALUE_NOT_HOST'],
      ['lanternshop.app.runonflux.io/path', 'VALUE_NOT_HOST'],
      ['lanternshop.app.runonflux.io:443', 'VALUE_NOT_HOST'],
      ['203.0.113.40', 'VALUE_IS_ADDRESS'],
      ['lanternshop', 'VALUE_INCOMPLETE'],
      ['lanternshop.app.runonflux.com', 'VALUE_WRONG_TLD'],
      ['lanternshopp.app.runonflux.io', 'VALUE_WRONG_APP'],
      ['lanternshop_31001.app.runonflux.io', 'VALUE_PORT_ADDRESS'],
      ['cloud.runonflux.com', 'VALUE_FLUX_OTHER'],
      ['example.org', 'VALUE_NOT_FLUX'],
      ['shop.example.com', 'VALUE_LOOP'],
      ['lantern shop.app.runonflux.io', 'VALUE_FORMAT'],
    ];
    for (const [value, code] of cases) {
      const e = evaluate(draft({ name: 'shop', value }), sub, 'generic');
      expect(e.correct, value).toBe(false);
      expect(
        e.issues.map((i) => i.code),
        value,
      ).toContain(code);
    }
  });

  it('breaks the chain at a name that does not exist', () => {
    const e = evaluate(draft({ name: 'shop', value: 'lanternshop.app.runonflux.com' }), sub, 'generic');
    expect(e.outcome).toBe('nxdomain');
    const last = e.hops[e.hops.length - 1];
    expect(last?.type).toBe('NXDOMAIN');
    expect(last?.name).toBe('lanternshop.app.runonflux.com');
    expect(e.hops[0]?.type).toBe('CNAME');
  });

  it('sends visitors elsewhere with an address that is not the free address', () => {
    const e = evaluate(draft({ type: 'A', name: 'shop', value: '192.0.2.10' }), sub, 'generic');
    expect(e.correct).toBe(false);
    expect(e.outcome).toBe('elsewhere');
    expect(e.issues.map((i) => i.code)).toContain('A_NOT_FLUX');
  });

  it('rejects a name where an address is needed and the other way round', () => {
    expect(codes(draft({ type: 'A', name: 'shop', value: APP }), sub, 'generic')).toContain(
      'A_NEEDS_ADDRESS',
    );
    expect(codes(draft({ type: 'TXT', name: 'shop', value: 'hello' }), sub, 'generic')).toContain(
      'TYPE_NO_ADDRESS',
    );
    expect(codes(draft({ type: 'MX', name: 'shop', value: 'mail.example.com' }), sub, 'generic')).toContain(
      'TYPE_NO_ADDRESS',
    );
    expect(evaluate(draft({ type: 'TXT', name: 'shop', value: 'x' }), sub, 'generic').outcome).toBe(
      'no-answer',
    );
  });
});

describe('the bare domain', () => {
  it('refuses a CNAME at generic and Namecheap providers, with the rule in plain words', () => {
    for (const p of ['generic', 'namecheap'] as const) {
      const e = evaluate(draft({ name: '@', value: APP }), apex, p);
      expect(e.correct).toBe(false);
      expect(e.outcome).toBe('refused');
      expect(e.stored).toBeNull();
      const issue = e.issues.find((i) => i.code === 'APEX_CNAME');
      expect(issue?.message).toMatch(/^A CNAME cannot sit at the apex of a zone\./);
      expect(issue?.fix).toMatch(/ALIAS|flatten/);
    }
  });

  it('accepts a CNAME named @ at Cloudflare, answered with addresses', () => {
    const e = evaluate(draft({ name: '@', value: APP, proxied: false }), apex, 'cloudflare');
    expect(e.correct).toBe(true);
    expect(e.outcome).toBe('flux');
    expect(e.hops).toHaveLength(1);
    expect(e.hops[0]?.type).toBe('A');
    expect(e.hops[0]?.owner).toBe('provider');
  });

  it('accepts an ALIAS record and an A record', () => {
    expect(evaluate(draft({ type: 'ALIAS', name: '@', value: APP }), apex, 'generic').correct).toBe(true);
    expect(evaluate(draft({ type: 'ALIAS', name: '@', value: APP }), apex, 'namecheap').correct).toBe(true);
    expect(evaluate(draft({ type: 'A', name: '@', value: FDM_ADDRESS }), apex, 'generic').correct).toBe(true);
  });

  it('wants @, not a subdomain name', () => {
    expect(codes(draft({ type: 'A', name: 'www', value: FDM_ADDRESS }), apex, 'generic')).toContain(
      'NAME_NOT_APEX',
    );
  });

  it('accepts the bare domain typed out only where the provider recognises it', () => {
    expect(
      evaluate(draft({ type: 'A', name: 'example.com', value: FDM_ADDRESS }), apex, 'cloudflare').correct,
    ).toBe(true);
    expect(codes(draft({ type: 'A', name: 'example.com', value: FDM_ADDRESS }), apex, 'generic')).toContain(
      'NAME_DOUBLED',
    );
  });
});

describe('the proxy', () => {
  it('still counts as correct and shows the provider addresses', () => {
    const e = evaluate(draft({ name: 'shop', value: APP, proxied: true }), sub, 'cloudflare');
    expect(e.correct).toBe(true);
    expect(e.proxied).toBe(true);
    expect(e.outcome).toBe('flux-proxied');
    expect(e.hops.every((h) => h.type === 'A' && h.owner === 'provider')).toBe(true);
    const ids = e.issues.map((i) => i.code);
    expect(ids).toContain('PROXY_CERT');
    const ssl = e.issues.find((i) => i.code === 'PROXY_SSL_MODE');
    expect(ssl?.inference).toBe(true);
  });

  it('is ignored at providers without a proxy', () => {
    const e = evaluate(draft({ name: 'shop', value: APP, proxied: true }), sub, 'generic');
    expect(e.proxied).toBe(false);
    expect(e.outcome).toBe('flux');
  });

  it('does not hide a wrong target', () => {
    const e = evaluate(
      draft({ name: 'shop', value: 'lanternshop.app.runonflux.com', proxied: true }),
      sub,
      'cloudflare',
    );
    expect(e.correct).toBe(false);
    expect(e.outcome).toBe('nxdomain');
  });
});

describe('empty drafts and solutions', () => {
  it('reports nothing for an empty draft', () => {
    const e = evaluate(emptyDraft('generic'), sub, 'generic');
    expect(e.outcome).toBe('empty');
    expect(e.issues).toEqual([]);
    expect(e.correct).toBe(false);
  });

  it('has a correct solution for every case and provider', () => {
    for (const c of [sub, apex]) {
      for (const p of Object.keys(PROVIDERS) as Provider[]) {
        const e = evaluate(solutionFor(c, p), c, p);
        expect(e.correct, `${c.domain} at ${p}`).toBe(true);
      }
    }
  });

  it('keeps every error message kind: a sentence, no dashes, no emoji', () => {
    const bad: Draft[] = [
      draft({ name: '', value: '' }),
      draft({ name: '@', value: APP }),
      draft({ name: 'shop', value: 'https://x.io/y' }),
      draft({ name: 'shop', value: '203.0.113.40' }),
      draft({ type: 'TXT', name: 'shop', value: 'x' }),
      draft({ type: 'A', name: 'shop', value: 'nope' }),
    ];
    for (const d of bad) {
      for (const c of [sub, apex]) {
        for (const i of evaluate(d, c, 'generic').issues) {
          const text = `${i.message} ${i.fix ?? ''}`;
          expect(text).not.toMatch(/—|–/);
          expect(i.message.length).toBeGreaterThan(10);
          expect(i.message.endsWith('.')).toBe(true);
        }
      }
    }
  });
});

describe('the other half', () => {
  it('lists the domain on the chosen port and an empty string elsewhere', () => {
    expect(domainsFor('shop.example.com', 0)).toEqual(['shop.example.com', '']);
    expect(domainsFor('shop.example.com', 1)).toEqual(['', 'shop.example.com']);
    expect(domainsFor('shop.example.com', 1, 3)).toEqual(['', 'shop.example.com', '']);
  });

  it('resolves the free address in two Flux links', () => {
    const chain = freeAddressChain('lanternshop');
    expect(chain.map((h) => h.type)).toEqual(['CNAME', 'A']);
    expect(chain[0]?.name).toBe(APP);
    expect(chain[1]?.data).toBe(FDM_ADDRESS);
  });
});
