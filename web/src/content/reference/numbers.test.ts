/**
 * "Every number on a page comes from an engine export."
 *
 * Two checks keep that true:
 *
 * 1. A source scan. The content modules may not type a number of two or more digits in prose or code:
 *    limits and prices come from `@shared/flux`, and every other fact is registered, with its FACTS
 *    section, in `facts.ts`. Data files (`facts.ts`, `examples.ts`, `endpoints.data.ts`, `topics.ts`)
 *    are excluded, as are HTTP status codes, which are protocol constants. A line that ends in
 *    `// literal: <why>` is exempt. The Orbit and Agents modules (and their search records) are scanned
 *    too: a vendor's figure there is written as a word or carries a `// literal:` with its FACTS row.
 * 2. A sentinel test. Every printed limit is changed in the engine to a value nobody would type, the
 *    content is rebuilt, and the sentinel must show up. A page that quoted a stale copy would not.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BAKED_PRICING, BANNED_PORT_RANGES, LIMITS } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { buildDockerTrouble, buildImageNameFacts, buildRegistryFacts, buildSizeFacts } from './docker';
import { buildNetworkTrouble, buildPortFacts } from './networking';
import { buildAppFields, buildComponentFields, buildPriceSteps } from './spec';

const DIR = fileURLToPath(new URL('.', import.meta.url));

/** The modules whose prose is checked. Data files and the search algorithm are not listed on purpose. */
const SCANNED = [
  'spec.ts',
  'networking.ts',
  'docker.ts',
  'api.ts',
  'derive.ts',
  'orbit.ts',
  'orbit.search.ts',
  'agents.ts',
  'agents.search.ts',
];

/** Numbers that are protocol constants, not facts of Flux. */
const ALLOWED = new Set(['200', '202', '400', '403', '404', '410', '413', '429', '502', '503', '504']);

/** An IPv4 address is a name, not a quantity. */
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function stripComments(source: string): string[] {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.split('\n').map((line) => {
    if (/\/\/\s*literal:/.test(line)) return '';
    if (/^\s*\/\//.test(line)) return '';
    return line.replace(/\s\/\/\s.*$/, '');
  });
}

describe('no typed numbers in the content modules', () => {
  for (const file of SCANNED) {
    it(file, () => {
      const lines = stripComments(readFileSync(`${DIR}${file}`, 'utf8'));
      const found: string[] = [];
      lines.forEach((line, i) => {
        for (const m of line.matchAll(/(?<![\w.#$-])\d{2,}(?:[.,]\d+)*(?![\w])/g)) {
          const token = m[0];
          if (ALLOWED.has(token) || IPV4.test(token)) continue;
          found.push(`${file}:${i + 1}  ${token}  in  ${line.trim().slice(0, 100)}`);
        }
      });
      expect(found).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Sentinels
// ---------------------------------------------------------------------------

type Mutable = Record<string, unknown>;

/** Replace a numeric leaf, run `fn`, and put it back even when `fn` throws. */
function withValue<T>(holder: Mutable, key: string, value: number, fn: () => T): T {
  const old = holder[key];
  holder[key] = value;
  try {
    return fn();
  } finally {
    holder[key] = old;
  }
}

/** Both the plain and the grouped spelling of a sentinel. */
function spellings(n: number): string[] {
  return [String(n), n.toLocaleString('en-US')];
}

function appears(text: string, n: number): boolean {
  return spellings(n).some((s) => text.includes(s));
}

function fieldText(): string {
  return JSON.stringify([...buildAppFields(), ...buildComponentFields()]);
}

describe('limits flow from the engine into the field reference', () => {
  const limits = LIMITS as unknown as Record<string, Mutable>;
  const cases: { path: string; holder: () => Mutable; key: string }[] = [
    { path: 'name.maxLength', holder: () => limits.name as Mutable, key: 'maxLength' },
    { path: 'component.min', holder: () => limits.component as Mutable, key: 'min' },
    { path: 'component.max', holder: () => limits.component as Mutable, key: 'max' },
    { path: 'component.nameMaxLength', holder: () => limits.component as Mutable, key: 'nameMaxLength' },
    { path: 'owner.fluxIdMinLength', holder: () => limits.owner as Mutable, key: 'fluxIdMinLength' },
    { path: 'owner.fluxIdMaxLength', holder: () => limits.owner as Mutable, key: 'fluxIdMaxLength' },
    { path: 'instances.min', holder: () => limits.instances as Mutable, key: 'min' },
    { path: 'instances.max', holder: () => limits.instances as Mutable, key: 'max' },
    { path: 'instances.legacyMin', holder: () => limits.instances as Mutable, key: 'legacyMin' },
    { path: 'ports.perComponentMax', holder: () => limits.ports as Mutable, key: 'perComponentMax' },
    { path: 'ports.max', holder: () => limits.ports as Mutable, key: 'max' },
    { path: 'ports.containerMax', holder: () => limits.ports as Mutable, key: 'containerMax' },
    { path: 'domains.maxLength', holder: () => limits.domains as Mutable, key: 'maxLength' },
    { path: 'environment.maxCount', holder: () => limits.environment as Mutable, key: 'maxCount' },
    { path: 'environment.maxLength', holder: () => limits.environment as Mutable, key: 'maxLength' },
    { path: 'commands.maxCount', holder: () => limits.commands as Mutable, key: 'maxCount' },
    { path: 'commands.maxLength', holder: () => limits.commands as Mutable, key: 'maxLength' },
    { path: 'containerData.minLength', holder: () => limits.containerData as Mutable, key: 'minLength' },
    { path: 'containerData.maxLength', holder: () => limits.containerData as Mutable, key: 'maxLength' },
    { path: 'repotag.maxLength', holder: () => limits.repotag as Mutable, key: 'maxLength' },
    { path: 'repotag.maxImageBytes', holder: () => limits.repotag as Mutable, key: 'maxImageBytes' },
    { path: 'repoauth.maxLength', holder: () => limits.repoauth as Mutable, key: 'maxLength' },
    { path: 'contacts.maxCount', holder: () => limits.contacts as Mutable, key: 'maxCount' },
    { path: 'contacts.maxLength', holder: () => limits.contacts as Mutable, key: 'maxLength' },
    { path: 'geolocation.maxCount', holder: () => limits.geolocation as Mutable, key: 'maxCount' },
    { path: 'geolocation.maxLength', holder: () => limits.geolocation as Mutable, key: 'maxLength' },
    { path: 'nodes.maxCount', holder: () => limits.nodes as Mutable, key: 'maxCount' },
    { path: 'nodes.maxLength', holder: () => limits.nodes as Mutable, key: 'maxLength' },
    { path: 'expire.min', holder: () => limits.expire as Mutable, key: 'min' },
    { path: 'expire.max', holder: () => limits.expire as Mutable, key: 'max' },
    { path: 'expire.default', holder: () => limits.expire as Mutable, key: 'default' },
    { path: 'totals.cpu', holder: () => limits.totals as Mutable, key: 'cpu' },
    { path: 'totals.ram', holder: () => limits.totals as Mutable, key: 'ram' },
    { path: 'totals.hdd', holder: () => limits.totals as Mutable, key: 'hdd' },
    { path: 'descriptionMaxLength', holder: () => limits, key: 'descriptionMaxLength' },
  ];
  cases.forEach(({ path, holder, key }, i) => {
    it(path, () => {
      const sentinel = 880_001 + i * 7;
      const text = withValue(holder(), key, sentinel, fieldText);
      expect(appears(text, sentinel)).toBe(true);
    });
  });
});

describe('prices flow from the baked rates into the price steps', () => {
  const params = BAKED_PRICING.params as unknown as Mutable;
  for (const key of ['cpu', 'ram', 'hdd', 'port', 'scope', 'staticip', 'minUSDPrice']) {
    it(key, () => {
      const sentinel = 4242.5;
      const text = withValue(params, key, sentinel, () =>
        JSON.stringify([buildPriceSteps(), buildAppFields(), buildComponentFields()]),
      );
      expect(text.includes('4242.50') || text.includes('4242.5')).toBe(true);
    });
  }
});

describe('port lists flow from the engine into the networking page', () => {
  it('prints the first banned range from the engine', () => {
    const first = BANNED_PORT_RANGES[0];
    expect(first).toBeDefined();
    if (!first) return;
    const old = { from: first.from, to: first.to };
    // Smaller than every real entry, so it sorts first.
    (first as unknown as Mutable).from = 7;
    (first as unknown as Mutable).to = 7;
    try {
      const text = JSON.stringify([buildNetworkTrouble(), buildPortFacts()]);
      expect(text.includes('Assigned port 7 is not allowed')).toBe(true);
    } finally {
      (first as unknown as Mutable).from = old.from;
      (first as unknown as Mutable).to = old.to;
    }
  });

  it('prints the size limit and the image name limit from the engine', () => {
    const repotag = LIMITS.repotag as unknown as Mutable;
    const text = withValue(repotag, 'maxImageBytes', 7_000_000_000, () =>
      JSON.stringify([buildSizeFacts(), buildDockerTrouble(), buildRegistryFacts(), buildImageNameFacts()]),
    );
    expect(text.includes('7 GB')).toBe(true);
  });
});
