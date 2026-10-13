/** The pure checks behind the port checker and the image name parser. */

import { describe, expect, it } from 'vitest';
import { imageFindings } from './docker';
import { NETWORK_EXAMPLE } from './examples';
import {
  buildBannedRows,
  buildInternalRows,
  buildPairingRows,
  checkContainerPort,
  checkPublicPort,
} from './networking';

describe('checkPublicPort', () => {
  it('reads the verdict from the engine lists', () => {
    expect(checkPublicPort('').status).toBe('empty');
    expect(checkPublicPort('abc').status).toBe('not-integer');
    expect(checkPublicPort('80.5').status).toBe('not-integer');
    expect(checkPublicPort('0').status).toBe('out-of-range');
    expect(checkPublicPort('70000').status).toBe('out-of-range');
    expect(checkPublicPort('22').status).toBe('banned');
    expect(checkPublicPort('16127').status).toBe('banned');
    expect(checkPublicPort('80').status).toBe('fee');
    expect(checkPublicPort('8080').status).toBe('fee');
    expect(checkPublicPort('31001').status).toBe('free');
  });

  it('names the lint code that fires', () => {
    expect(checkPublicPort('22').lint).toEqual(['PORT_BANNED']);
    expect(checkPublicPort('443').lint).toEqual(['PORT_FEE']);
    expect(checkPublicPort('31001').lint).toEqual([]);
  });

  it('tells a person the way out in the summary', () => {
    expect(checkPublicPort('22').summary).toContain('container port');
    expect(checkPublicPort('8080').summary).toContain('outside');
  });
});

describe('checkContainerPort', () => {
  it('accepts a high port and flags a privileged one', () => {
    expect(checkContainerPort('3000').status).toBe('ok');
    expect(checkContainerPort('80').status).toBe('privileged');
    expect(checkContainerPort('80').lint).toEqual(['PORT_PRIVILEGED_CONTAINER']);
    expect(checkContainerPort('70000').status).toBe('invalid');
    expect(checkContainerPort('').status).toBe('empty');
  });
});

describe('the banned table', () => {
  it('is sorted and covers the whole list', () => {
    const rows = buildBannedRows();
    const froms = rows.map((r) => r.range.from);
    expect([...froms].sort((a, b) => a - b)).toEqual(froms);
    expect(rows.find((r) => r.range.from === 22)?.usedFor).toContain('SSH');
  });
});

describe('names derived from the example spec', () => {
  it('pairs every public port with its domain entry', () => {
    const rows = buildPairingRows(NETWORK_EXAMPLE);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.customDomains).toEqual(['shop.example.com']);
    expect(rows[0]?.appDomain).toBe('my-shop.app.runonflux.io');
    expect(rows[1]?.appDomain).toBeNull();
    expect(rows[1]?.generatedDomain).toBe('my-shop_31002.app.runonflux.io');
  });

  it('gives each component an address another component can dial', () => {
    const rows = buildInternalRows(NETWORK_EXAMPLE);
    const db = rows.find((r) => r.component === 'db');
    expect(db?.containerName).toBe('fluxdb_my-shop');
    expect(db?.published).toBe(false);
    expect(db?.address).toBe('fluxdb_my-shop:5432');
    expect(db?.portSource).toBe('image');
    const web = rows.find((r) => r.component === 'web');
    expect(web?.address).toBe('fluxweb_my-shop:80');
    expect(web?.portSource).toBe('containerPorts');
  });
});

describe('imageFindings', () => {
  it('asks the linter what it thinks of a name', () => {
    expect(imageFindings('nginx:1.27-alpine').codes).toEqual([]);
    expect(imageFindings('nginx').codes).toContain('IMAGE_UNTAGGED');
    expect(imageFindings('nginx:latest').codes).toContain('IMAGE_LATEST');
    expect(imageFindings('docker.io/library/nginx:1.27').codes).toContain('IMAGE_DOCKER_IO_HOST');
    expect(imageFindings('Yourname/My-Web-App:1.0.0').codes).toContain('IMAGE_UPPERCASE');
  });

  it('parses the parts', () => {
    const f = imageFindings('ghcr.io/yourname/app:1.0.0');
    expect(f.parsed.registry).toBe('ghcr.io');
    expect(f.parsed.namespace).toBe('yourname');
    expect(f.parsed.repository).toBe('app');
    expect(f.parsed.tag).toBe('1.0.0');
  });
});
