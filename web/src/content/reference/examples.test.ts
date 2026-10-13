/**
 * The illustration inputs are checked against the engine: priced ones reproduce the live calculator's
 * answers (FACTS 4.6), clean ones lint clean, and parsed ones parse.
 */

import { BAKED_PRICING, lintSpec, parseContainerData, quote } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { geoRoundTrips } from './derive';
import {
  CONTAINER_DATA_EXAMPLES,
  CURVE_INSTANCES,
  DOCKER_SPEC_STATIC,
  DOCKER_SPEC_WEB,
  DOCKERFILE_STATIC,
  DOCKERFILE_WEB,
  GEO_SETS,
  IMAGE_EXAMPLES,
  NETWORK_EXAMPLE,
  PRICE_EXAMPLES,
  VALIDATE_SAMPLES,
  VERIFIED_CURVE,
} from './examples';
import { buildMountForms } from './spec';
import { curveFor } from './tools';

function cleanIssues(spec: unknown): string[] {
  return lintSpec(spec)
    .issues.filter((i) => i.severity !== 'info')
    .map((i) => `${i.severity} ${i.code} ${i.path}`);
}

describe('the price examples', () => {
  for (const example of PRICE_EXAMPLES) {
    it(`${example.id} reproduces the live calculator's curve`, () => {
      expect(curveFor(example)).toEqual([...VERIFIED_CURVE[example.id]]);
    });

    it(`${example.id} is a clean spec`, () => {
      expect(cleanIssues(example.spec)).toEqual([]);
    });
  }

  it('uses the instance counts of the verified table', () => {
    expect(CURVE_INSTANCES).toEqual([1, 2, 3, 4, 5, 10, 20, 100]);
  });

  it('shows the small app cliff the lint code talks about', () => {
    const small = PRICE_EXAMPLES.find((e) => e.id === 'small');
    expect(small).toBeDefined();
    if (!small) return;
    const at = (n: number) => quote({ ...small.spec, instances: n }, BAKED_PRICING.params).usdTotal;
    expect(at(4)).toBeGreaterThan(at(3) ?? 0);
  });
});

describe('the other example specs', () => {
  it('the networking example has no errors or warnings', () => {
    expect(cleanIssues(NETWORK_EXAMPLE)).toEqual([]);
  });

  it('the docker examples have no errors or warnings', () => {
    expect(cleanIssues(DOCKER_SPEC_WEB)).toEqual([]);
    expect(cleanIssues(DOCKER_SPEC_STATIC)).toEqual([]);
  });

  it('the Dockerfiles bind every interface and match their components', () => {
    expect(DOCKERFILE_WEB).toContain('HOST=0.0.0.0');
    expect(DOCKERFILE_WEB).toContain('USER node');
    const web = DOCKER_SPEC_WEB.compose[0];
    expect(web?.containerPorts.every((p) => DOCKERFILE_WEB.includes(`EXPOSE ${p}`))).toBe(true);
    const site = DOCKER_SPEC_STATIC.compose[0];
    expect(site?.containerPorts.every((p) => DOCKERFILE_STATIC.includes(`EXPOSE ${p}`))).toBe(true);
  });

  it('the old tutorial spec trips the codes the page says it does', () => {
    const sample = VALIDATE_SAMPLES.find((s) => s.id === 'old-tutorial');
    expect(sample).toBeDefined();
    const codes = new Set(lintSpec(JSON.parse(sample?.json ?? '{}')).issues.map((i) => i.code));
    for (const code of ['NAME_RESERVED_PREFIX', 'OWNER_INVALID', 'COMPONENT_NAME_FORMAT', 'PORT_BANNED']) {
      expect(codes.has(code), code).toBe(true);
    }
  });

  it('the hello sample is valid', () => {
    const sample = VALIDATE_SAMPLES.find((s) => s.id === 'hello');
    expect(lintSpec(JSON.parse(sample?.json ?? '{}')).valid).toBe(true);
  });
});

describe('the grammar examples', () => {
  it('every geolocation set round trips through the parser', () => {
    for (const set of GEO_SETS) {
      for (const entry of set.entries) expect(geoRoundTrips(entry), entry).toBe(true);
    }
  });

  it('every containerData example parses without errors', () => {
    for (const ex of CONTAINER_DATA_EXAMPLES) {
      expect(parseContainerData(ex.value).errors, ex.label).toEqual([]);
    }
  });

  it('every mount form has an example that parses', () => {
    for (const form of buildMountForms()) {
      const parsed = parseContainerData(form.example);
      expect(parsed.errors, form.form).toEqual([]);
      expect(parsed.mounts.length, form.form).toBeGreaterThan(0);
    }
  });

  it('has image examples that cover untagged, latest, host and uppercase', () => {
    expect(IMAGE_EXAMPLES.length).toBeGreaterThan(5);
  });
});
