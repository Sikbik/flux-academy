import { cloneFixture, isBannedPort, isSurchargePort, lintSpec } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import {
  assignPublicPorts,
  blankDraft,
  discountPercent,
  draftFromSpec,
  first,
  freeDomains,
  isValidEmail,
  looksSecret,
  PERIODS,
  PORT_ERROR,
  parsePortRow,
  patchSimple,
  secretKeys,
  simpleBlockers,
  simpleLimits,
  slugifyAppName,
  switchMode,
} from './model';

function filled() {
  let d = blankDraft('sso');
  d = patchSimple(d, { image: 'nginx:1.27', name: 'My-App', portRows: ['80'], tos: true });
  return d;
}

describe('small rules of the Simple form', () => {
  it('strips an app name to lower case letters and digits (FACTS 9.4.2)', () => {
    expect(slugifyAppName('Hello-Flux_01')).toBe('helloflux01');
    expect(slugifyAppName('  ABC ')).toBe('abc');
  });

  it('accepts ports 1 to 65535 and nothing else', () => {
    expect(parsePortRow('8080')).toBe(8080);
    expect(parsePortRow(' 1 ')).toBe(1);
    expect(parsePortRow('65535')).toBe(65535);
    for (const bad of ['', '0', '65536', '-1', '80.5', 'http', '99999']) expect(parsePortRow(bad)).toBeNull();
  });

  it('quotes the port message with the en dash', () => {
    expect(PORT_ERROR).toBe('Enter a valid port (1\u201365535).');
    expect(PORT_ERROR).toContain('\u2013');
  });

  it('uses the Contact email regex of FACTS 9.4.2', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('a b@c.co')).toBe(false);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });

  it('flags the names FACTS 9.4.2 lists as secrets', () => {
    for (const n of [
      'DB_PASSWORD',
      'API_TOKEN',
      'client_secret',
      'PRIVATE_KEY',
      'AWS_ACCESS_KEY',
      'AUTH',
      'SEED',
      'MNEMONIC',
    ]) {
      expect(looksSecret(n)).toBe(true);
    }
    for (const n of ['PORT', 'NODE_ENV', 'WHOAMI_NAME', 'LOG_LEVEL']) expect(looksSecret(n)).toBe(false);
  });

  it('turns blocks into the discount the period buttons show', () => {
    const by = Object.fromEntries(PERIODS.map((p) => [p.id, discountPercent(p.blocks)]));
    expect(by).toEqual({ '1w': null, '2w': null, '1m': null, '3m': 3, '6m': 6, '1y': 12 });
  });
});

describe('public ports are assigned for you', () => {
  it('mirrors the container port when it is allowed', () => {
    expect(assignPublicPorts([3000, 5000], 'app')).toEqual([3000, 5000]);
  });

  it('picks another port when the mirror is priced or banned', () => {
    const [p80, p22, p8080] = assignPublicPorts([80, 22, 8080], 'app');
    for (const p of [p80, p22, p8080]) {
      expect(p).toBeGreaterThanOrEqual(30100);
      expect(p).toBeLessThanOrEqual(39999);
      expect(isBannedPort(p as number)).toBe(false);
      expect(isSurchargePort(p as number)).toBe(false);
    }
  });

  it('never repeats a public port and is stable', () => {
    const a = assignPublicPorts([80, 443, 8080, 8081, 8443], 'same');
    expect(new Set(a).size).toBe(5);
    expect(assignPublicPorts([80, 443, 8080, 8081, 8443], 'same')).toEqual(a);
  });

  it('names the free domains the way Simple mode does', () => {
    expect(freeDomains('Shop', [31000, 31001])).toEqual([
      'shop.app.runonflux.io',
      'shop_31001.app.runonflux.io',
    ]);
  });
});

describe('Simple mode builds a spec', () => {
  it('seeds the on-screen defaults of FACTS 9.4.2', () => {
    const d = blankDraft('sso');
    const c = first(d.spec);
    expect(d.spec.version).toBe(8);
    expect(d.spec.instances).toBe(1);
    expect(d.spec.expire).toBe(88000);
    expect([c.cpu, c.ram, c.hdd, c.containerData]).toEqual([1, 2000, 20, '/tmp']);
    expect(d.spec.contacts).toEqual(['you@example.com']);
  });

  it('derives name, description, ports and container data from the form', () => {
    const d = filled();
    expect(d.spec.name).toBe('myapp');
    expect(d.spec.description).toBe('myapp');
    expect(first(d.spec).containerPorts).toEqual([80]);
    expect(first(d.spec).ports).toHaveLength(1);
    expect(first(d.spec).containerData).toBe('/tmp');
    expect(simpleBlockers(d, 'sso')).toEqual([]);
  });

  it('lists what stops the Review & deploy button, in page order', () => {
    const d = blankDraft('wallet');
    expect(simpleBlockers(d, 'wallet')).toEqual([
      'Enter a Docker image.',
      'Choose an app name.',
      PORT_ERROR,
      'Enter a valid contact email.',
      'Accept the Terms & Conditions.',
    ]);
  });

  it('asks for the folder when the app stores data, and writes r: when it is kept safe', () => {
    let d = filled();
    d = patchSimple(d, { storeData: true, folder: '' });
    expect(simpleBlockers(d, 'sso')).toContain('Enter the folder to keep.');
    d = patchSimple(d, { folder: '/data', keepSafe: true });
    expect(first(d.spec).containerData).toBe('r:/data');
    expect(d.spec.instances).toBeGreaterThanOrEqual(2);
    d = patchSimple(d, { keepSafe: false });
    expect(first(d.spec).containerData).toBe('/data');
  });

  it('registers as Enterprise for a private image or a secret looking variable', () => {
    let d = filled();
    d = patchSimple(d, { privateImage: true, repoauth: 'user:token' });
    expect(d.enterprise).toBe(true);
    d = patchSimple(d, { privateImage: false, repoauth: '' });
    expect(d.enterprise).toBe(false);
    d = patchSimple(d, { env: [{ key: 'DB_PASSWORD', value: 'x' }] });
    expect(d.enterprise).toBe(true);
    expect(secretKeys(d.spec)).toEqual(['DB_PASSWORD']);
  });

  it('turns the continent buttons into ac<CODE> entries', () => {
    let d = filled();
    d = patchSimple(d, { regionsOn: true, continents: ['EU', 'NA'] });
    expect(d.spec.geolocation).toEqual(['acEU', 'acNA']);
    d = patchSimple(d, { regionsOn: false });
    expect(d.spec.geolocation).toEqual([]);
  });

  it('produces a spec the shared linter accepts', () => {
    const d = filled();
    const report = lintSpec(d.spec);
    expect(report.errors).toBe(0);
  });
});

describe('moving between modes and presets', () => {
  it('keeps the spec when going to Advanced and reads the switches back', () => {
    const d = switchMode(filled(), 'advanced');
    expect(d.mode).toBe('advanced');
    expect(d.spec.name).toBe('myapp');
    const back = switchMode(d, 'simple');
    expect(back.portRows).toEqual(['80']);
  });

  it('knows which presets Simple mode cannot show', () => {
    const wp = cloneFixture('wordpress-mysql');
    const mc = cloneFixture('minecraft');
    const site = cloneFixture('static-site');
    const web = cloneFixture('web-app');
    expect(wp && simpleLimits(draftFromSpec(wp, 'sso', 'advanced')).length).toBeGreaterThan(0);
    expect(mc && simpleLimits(draftFromSpec(mc, 'sso', 'advanced')).length).toBeGreaterThan(0);
    expect(site && simpleLimits(draftFromSpec(site, 'sso', 'advanced')).length).toBeGreaterThan(0);
    expect(web && simpleLimits(draftFromSpec(web, 'sso', 'advanced'))).toEqual([]);
  });

  it('fills the form from a preset, with the terms accepted', () => {
    const web = cloneFixture('web-app');
    if (!web) throw new Error('fixture');
    const d = draftFromSpec(web, 'sso', 'simple');
    expect(d.mode).toBe('simple');
    expect(d.tos).toBe(true);
    expect(d.spec.name).toBe('academyweb');
    expect(d.spec.geolocation).toEqual(['acEU']);
    expect(simpleBlockers(d, 'sso')).toEqual([]);
  });
});
