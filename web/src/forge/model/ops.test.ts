import { lintSpec } from '@shared/flux/lint';
import { defaultComponent, defaultSpec } from '@shared/flux/spec';
import type { FluxAppSpec } from '@shared/flux/types';
import { describe, expect, it } from 'vitest';
import {
  addComponent,
  addGeoEntry,
  addPort,
  addPrivateComponent,
  alignComponentPorts,
  applySuggestion,
  continentMode,
  duplicateComponent,
  ENTERPRISE_PLACEHOLDER,
  listAppend,
  listMove,
  listRemove,
  listSet,
  monthsOf,
  moveComponent,
  movePort,
  nextFreePort,
  periodOf,
  portsMisaligned,
  readContainerData,
  remapMountRefs,
  removeComponent,
  removePort,
  renameApp,
  renameComponent,
  setContinentMode,
  setEnterprise,
  setExpireMonths,
  setPortCell,
  setStaticIp,
  splitEnv,
  totals,
  uniqueComponentName,
  writeContainerData,
} from './ops';

function three(): FluxAppSpec {
  const s = defaultSpec();
  s.name = 'shop';
  s.compose = [
    defaultComponent({
      name: 'web',
      ports: [31001, 31002],
      containerPorts: [80, 8080],
      domains: ['', 'a.example.com'],
    }),
    defaultComponent({
      name: 'api',
      ports: [31003],
      containerPorts: [3000],
      domains: [''],
      environmentParameters: ['DB_HOST=fluxdb_shop', 'CACHE=fluxdb_shop:6379', 'OTHER=fluxdb_shopper'],
      containerData: 'g:/data|0:/shared|c:0:logs:/logs',
    }),
    defaultComponent({
      name: 'db',
      ports: [],
      containerPorts: [],
      domains: [],
      containerData: 'g:/var/lib/mysql',
    }),
  ];
  return s;
}

describe('ports keep their three arrays aligned', () => {
  it('adds a port to ports, containerPorts and domains with a free public port', () => {
    const s = three();
    const next = addPort(s, 2);
    const c = next.compose[2];
    expect(c?.ports).toHaveLength(1);
    expect(c?.containerPorts).toHaveLength(1);
    expect(c?.domains).toEqual(['']);
    expect(new Set(next.compose.flatMap((x) => x.ports)).size).toBe(
      next.compose.flatMap((x) => x.ports).length,
    );
    expect(c?.ports[0]).toBe(31004);
  });

  it('stops at five ports', () => {
    let s = three();
    for (let i = 0; i < 8; i++) s = addPort(s, 0);
    expect(s.compose[0]?.ports).toHaveLength(5);
    expect(s.compose[0]?.containerPorts).toHaveLength(5);
    expect(s.compose[0]?.domains).toHaveLength(5);
  });

  it('removes a row from all three arrays', () => {
    const next = removePort(three(), 0, 0);
    expect(next.compose[0]?.ports).toEqual([31002]);
    expect(next.compose[0]?.containerPorts).toEqual([8080]);
    expect(next.compose[0]?.domains).toEqual(['a.example.com']);
  });

  it('moves a row in all three arrays', () => {
    const next = movePort(three(), 0, 0, 1);
    expect(next.compose[0]?.ports).toEqual([31002, 31001]);
    expect(next.compose[0]?.containerPorts).toEqual([8080, 80]);
    expect(next.compose[0]?.domains).toEqual(['a.example.com', '']);
  });

  it('repairs a misaligned component before adding a row', () => {
    const s = three();
    s.compose[0] = { ...(s.compose[0] as FluxAppSpec['compose'][number]), containerPorts: [80], domains: [] };
    expect(portsMisaligned(s.compose[0])).toBe(true);
    const next = addPort(s, 0);
    expect(portsMisaligned(next.compose[0] as FluxAppSpec['compose'][number])).toBe(false);
    expect(next.compose[0]?.ports).toHaveLength(3);
    expect(alignComponentPorts(s, 0).compose[0]?.domains).toHaveLength(2);
  });

  it('sets one cell and pads when the row is past a short array', () => {
    const next = setPortCell(three(), 0, 1, 'containerPorts', 9000);
    expect(next.compose[0]?.containerPorts).toEqual([80, 9000]);
    const same = setPortCell(three(), 0, 1, 'containerPorts', 8080);
    expect(same.compose[0]?.containerPorts).toEqual([80, 8080]);
  });

  it('never picks a banned or fee port for a new row', () => {
    const s = three();
    s.compose[0] = { ...(s.compose[0] as FluxAppSpec['compose'][number]), ports: [30000] };
    expect(nextFreePort(s, 30000)).toBeGreaterThanOrEqual(30100);
    expect(nextFreePort(s, 8080)).toBe(8082);
    expect(nextFreePort(s, 80)).toBe(1024);
  });
});

describe('components', () => {
  it('adds a component with a unique name and a free port, up to ten', () => {
    let s = three();
    s = addComponent(s);
    expect(s.compose).toHaveLength(4);
    expect(s.compose[3]?.name).toBe('component');
    s = addComponent(s);
    expect(s.compose[4]?.name).toBe('component2');
    for (let i = 0; i < 12; i++) s = addComponent(s);
    expect(s.compose).toHaveLength(10);
    const ports = s.compose.flatMap((c) => c.ports);
    expect(new Set(ports).size).toBe(ports.length);
  });

  it('adds a private component with no public port, no domain and no container port', () => {
    const s = addPrivateComponent(defaultSpec());
    const added = s.compose[1];
    expect(s.compose).toHaveLength(2);
    expect(added?.name).toBe('private');
    expect(added?.ports).toEqual([]);
    expect(added?.containerPorts).toEqual([]);
    expect(added?.domains).toEqual([]);
    expect(added?.repotag).toBeTruthy();
    expect(added?.cpu).toBe(0.1);
    // The component it sits beside is untouched, and the app is still valid.
    expect(s.compose[0]).toEqual(defaultSpec().compose[0]);
    expect(lintSpec(s, { teaching: true }).valid).toBe(true);
  });

  it('names private components apart, takes no public port and stops at ten', () => {
    let s = defaultSpec();
    s = addPrivateComponent(s);
    s = addPrivateComponent(s);
    expect(s.compose.map((c) => c.name)).toEqual(['web', 'private', 'private2']);
    const before = s.compose.flatMap((c) => c.ports);
    s = addComponent(s);
    expect(s.compose[3]?.ports).toHaveLength(1);
    expect(before).toEqual([31001]);
    for (let i = 0; i < 12; i++) s = addPrivateComponent(s);
    expect(s.compose).toHaveLength(10);
    expect(addPrivateComponent(s)).toBe(s);
  });

  it('lets the caller choose the name and image of a private component', () => {
    const s = addPrivateComponent(defaultSpec(), { name: 'db', repotag: 'postgres:16' });
    expect(s.compose[1]?.name).toBe('db');
    expect(s.compose[1]?.repotag).toBe('postgres:16');
    expect(s.compose[1]?.ports).toEqual([]);
  });

  it('keeps names to letters and digits and away from reserved prefixes', () => {
    const s = three();
    expect(uniqueComponentName(s, 'my-db')).toBe('mydb');
    expect(uniqueComponentName(s, 'flux')).toBe('component');
    expect(uniqueComponentName(s, 'fluxdb')).toBe('db2');
    expect(uniqueComponentName(s, 'fluxcache')).toBe('cache');
    expect(uniqueComponentName(s, 'zelflux')).toBe('component');
    expect(uniqueComponentName(s, 'web')).toBe('web2');
  });

  it('remaps positional mounts when a component is removed', () => {
    const s = three();
    const next = removeComponent(s, 0);
    // api referenced component 0 (`0:/shared`, `c:0:logs:/logs`): those mounts go with it.
    expect(next.compose.map((c) => c.name)).toEqual(['api', 'db']);
    expect(next.compose[0]?.containerData).toBe('g:/data');
  });

  it('remaps positional mounts when a component moves', () => {
    const s = three();
    const next = moveComponent(s, 0, 2);
    expect(next.compose.map((c) => c.name)).toEqual(['api', 'db', 'web']);
    // web moved from index 0 to 2, so api's references follow it.
    expect(next.compose[0]?.containerData).toBe('g:/data|2:/shared|c:2:logs:/logs');
  });

  it('keeps references true when a component is duplicated before them', () => {
    const s = three();
    const next = duplicateComponent(s, 0);
    expect(next.compose.map((c) => c.name)).toEqual(['web', 'web2', 'api', 'db']);
    // api is now at index 2 and still borrows from web, which did not move.
    expect(next.compose[2]?.containerData).toBe('g:/data|0:/shared|c:0:logs:/logs');
    const copyPorts = next.compose[1]?.ports ?? [];
    const all = next.compose.flatMap((c) => c.ports);
    expect(copyPorts).toHaveLength(2);
    expect(new Set(all).size).toBe(all.length);
  });

  it('rewrites internal host names when a component is renamed', () => {
    const r = renameComponent(three(), 2, 'database');
    expect(r.rewritten).toBe(2);
    expect(r.spec.compose[2]?.name).toBe('database');
    expect(r.spec.compose[1]?.environmentParameters).toEqual([
      'DB_HOST=fluxdatabase_shop',
      'CACHE=fluxdatabase_shop:6379',
      'OTHER=fluxdb_shopper',
    ]);
  });

  it('rewrites internal host names when the app is renamed', () => {
    const s = three();
    s.compose[1] = {
      ...(s.compose[1] as FluxAppSpec['compose'][number]),
      environmentParameters: ['A=fluxdb_shop', 'B=fluxweb_shop:80'],
    };
    const r = renameApp(s, 'store');
    expect(r.rewritten).toBe(2);
    expect(r.spec.compose[1]?.environmentParameters).toEqual(['A=fluxdb_store', 'B=fluxweb_store:80']);
    expect(renameApp(s, 'shop').rewritten).toBe(0);
  });

  it('remapMountRefs leaves the primary mount and other kinds alone', () => {
    expect(remapMountRefs('r:/data', () => 9)).toBe('r:/data');
    expect(remapMountRefs('/data|m:logs:/l|f:c.yaml:/c', () => 9)).toBe('/data|m:logs:/l|f:c.yaml:/c');
    expect(remapMountRefs('/data|1:/x|cf:1:f:/y', (n) => n + 1)).toBe('/data|2:/x|cf:2:f:/y');
    expect(remapMountRefs('/data|1:/x', () => null)).toBe('/data');
  });

  it('returns the same object when nothing changes', () => {
    const s = three();
    expect(removeComponent(s, 9)).toBe(s);
    expect(moveComponent(s, 1, 1)).toBe(s);
    expect(setStaticIp(s, false)).toBe(s);
    expect(setEnterprise(s, false)).toBe(s);
  });
});

describe('lists', () => {
  it('appends, sets, removes and moves', () => {
    let s = three();
    s = listAppend(s, 'compose[0].commands', 'node');
    s = listAppend(s, 'compose[0].commands', 'server.js');
    expect(s.compose[0]?.commands).toEqual(['node', 'server.js']);
    s = listSet(s, 'compose[0].commands', 1, 'app.js');
    s = listMove(s, 'compose[0].commands', 1, 0);
    expect(s.compose[0]?.commands).toEqual(['app.js', 'node']);
    s = listRemove(s, 'compose[0].commands', 0);
    expect(s.compose[0]?.commands).toEqual(['node']);
  });

  it('respects a maximum', () => {
    let s = three();
    for (let i = 0; i < 7; i++) s = listAppend(s, 'contacts', `a${i}@example.com`, 5);
    expect(s.contacts).toHaveLength(5);
  });

  it('splits environment entries at the first equals sign', () => {
    expect(splitEnv('URL=postgres://u:p@h/db?x=1')).toEqual({ key: 'URL', value: 'postgres://u:p@h/db?x=1' });
    expect(splitEnv('NOVALUE')).toEqual({ key: 'NOVALUE', value: '' });
  });
});

describe('toggles and subscription', () => {
  it('toggles enterprise with a labelled placeholder', () => {
    const on = setEnterprise(three(), true);
    expect(on.enterprise).toBe(ENTERPRISE_PLACEHOLDER);
    expect(setEnterprise(on, false).enterprise).toBe('');
    expect(setEnterprise(on, true)).toBe(on);
  });

  it('sets expire from months and reads it back', () => {
    const s = setExpireMonths(three(), 3);
    expect(s.expire).toBe(264_000);
    expect(monthsOf(s)).toBe(3);
    expect(periodOf(s)?.id).toBe('3m');
    expect(periodOf({ ...s, expire: 1234 })).toBeNull();
  });
});

describe('geolocation', () => {
  it('sets and reads continent modes without touching country entries', () => {
    let s = three();
    s = { ...s, geolocation: ['acEU_DE'] };
    s = setContinentMode(s, 'EU', 'allow');
    expect(s.geolocation).toEqual(['acEU_DE', 'acEU']);
    expect(continentMode(s, 'EU')).toBe('allow');
    s = setContinentMode(s, 'EU', 'deny');
    expect(s.geolocation).toEqual(['acEU_DE', 'a!cEU']);
    expect(continentMode(s, 'EU')).toBe('deny');
    s = setContinentMode(s, 'EU', 'off');
    expect(s.geolocation).toEqual(['acEU_DE']);
    expect(continentMode(s, 'NA')).toBe('off');
  });

  it('reads the legacy continent entry as allow', () => {
    expect(continentMode({ ...three(), geolocation: ['aEU'] }, 'EU')).toBe('allow');
  });

  it('adds raw entries once and stops at ten', () => {
    let s = three();
    s = addGeoEntry(s, 'acNA_US');
    s = addGeoEntry(s, 'acNA_US');
    expect(s.geolocation).toEqual(['acNA_US']);
    for (let i = 0; i < 12; i++) s = addGeoEntry(s, `acEU_X${String.fromCharCode(65 + i)}`);
    expect(s.geolocation).toHaveLength(10);
  });
});

describe('containerData', () => {
  it('reads and writes the primary mount and keeps the extras verbatim', () => {
    const m = readContainerData('g:/data|m:logs:/var/log|f:c.yaml:/etc/c.yaml');
    expect(m).toEqual({
      prefix: 'g',
      path: '/data',
      extra: 'm:logs:/var/log|f:c.yaml:/etc/c.yaml',
      understood: true,
    });
    expect(writeContainerData({ ...m, prefix: 'r' })).toBe('r:/data|m:logs:/var/log|f:c.yaml:/etc/c.yaml');
    expect(writeContainerData({ prefix: '', path: '/tmp', extra: '' })).toBe('/tmp');
  });

  it('flags a primary definition the builder cannot represent', () => {
    expect(readContainerData('rg:/data').understood).toBe(false);
    expect(readContainerData('m:logs:/var/log').understood).toBe(false);
    expect(readContainerData('/data').understood).toBe(true);
    expect(readContainerData('').path).toBe('');
  });
});

describe('suggestions and totals', () => {
  it('applies a lint suggestion at its path', () => {
    const s = three();
    expect(applySuggestion(s, { path: 'compose[0].ports[0]', suggestion: 32000 }).compose[0]?.ports[0]).toBe(
      32000,
    );
    expect(applySuggestion(s, { path: 'name' })).toBe(s);
  });

  it('adds up resources over every component', () => {
    const s = three();
    expect(totals(s)).toEqual({ cpu: 0.3, ram: 300, hdd: 3, ports: 3 });
  });
});
