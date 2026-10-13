import { BANNED_PORT_RANGES, BLOCKS_PER_MONTH, LIMITS, LINT_CODES } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { num } from './derive';
import { BANNED_PORT_NOTES, FEE_PORT_NOTES, SNAPSHOT } from './facts';
import {
  buildCaps,
  buildEnterpriseFacts,
  buildExpireFacts,
  buildFieldDocs,
  buildGlanceMistakes,
  exampleHeight,
} from './spec';

const FIELD_IDS = new Set(buildFieldDocs().map((d) => d.id));
const FIELDS = new Map(buildFieldDocs().map((d) => [d.id, d] as const));

describe('the size caps at a glance', () => {
  const caps = buildCaps();

  it('has unique ids', () => {
    expect(new Set(caps.map((c) => c.id)).size).toBe(caps.length);
  });

  it('points every tile at a field row that exists', () => {
    for (const c of caps) expect(FIELD_IDS.has(c.field), `${c.id} -> ${c.field}`).toBe(true);
  });

  it('prints the limits the engine holds', () => {
    const byId = new Map(caps.map((c) => [c.id, c] as const));
    expect(byId.get('name')?.value).toContain(String(LIMITS.name.maxLength));
    expect(byId.get('components')?.value).toBe(`${LIMITS.component.min} to ${LIMITS.component.max}`);
    expect(byId.get('instances')?.value).toBe(`${LIMITS.instances.min} to ${LIMITS.instances.max}`);
    expect(byId.get('ports')?.value).toContain(String(LIMITS.ports.perComponentMax));
    expect(byId.get('ram')?.value).toContain(num(LIMITS.totals.ram));
    expect(byId.get('expire')?.value).toContain(num(LIMITS.expire.max));
  });

  it('writes the image limit in gigabytes from the byte limit', () => {
    const image = caps.find((c) => c.id === 'image');
    expect(image?.value).toBe(`${LIMITS.repotag.maxImageBytes / 1_000_000_000} GB`);
  });
});

describe('the mistakes at a glance', () => {
  const mistakes = buildGlanceMistakes();

  it('has unique ids', () => {
    expect(new Set(mistakes.map((m) => m.id)).size).toBe(mistakes.length);
  });

  it('names a lint code that exists and a field row that exists', () => {
    for (const m of mistakes) {
      expect(m.code in LINT_CODES, m.code).toBe(true);
      expect(FIELD_IDS.has(m.field), m.field).toBe(true);
    }
  });

  it('links the code to the field that the linter says it guards', () => {
    for (const m of mistakes) {
      const doc = FIELDS.get(m.field);
      expect(doc?.lint, `${m.id}: ${m.field} lists ${m.code}`).toContain(m.code);
    }
  });
});

describe('enterprise and expire fact rows', () => {
  it('has unique ids inside each list', () => {
    for (const rows of [buildEnterpriseFacts(), buildExpireFacts()]) {
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    }
  });

  it('marks the one behaviour that was not tested on a live node as unverified', () => {
    const burst = buildEnterpriseFacts().find((r) => r.id === 'burst');
    expect(burst?.prov).toContain('unverified');
  });

  it('derives the range and the pricing month from the engine', () => {
    const rows = new Map(buildExpireFacts().map((r) => [r.id, r] as const));
    expect(rows.get('range')?.text).toContain(num(LIMITS.expire.max));
    expect(rows.get('pricing-month')?.text).toContain(num(BLOCKS_PER_MONTH));
    expect(rows.get('ceiling')?.text).toContain(num(LIMITS.expire.max));
  });

  it('uses the height the facts were read at for the arithmetic example', () => {
    expect(exampleHeight()).toBe(SNAPSHOT.blockHeight);
    expect(exampleHeight()).toBeGreaterThan(LIMITS.expire.max);
  });
});

describe('port notes', () => {
  it('has a note for every single port on the fee list outside the privileged range', () => {
    for (const range of LIMITS.ports.surchargeRanges) {
      if (range.from === range.to && range.from >= LIMITS.ports.privilegedBelow) {
        expect(FEE_PORT_NOTES[range.from], `fee port ${range.from}`).toBeTruthy();
      }
    }
  });

  it('does not call a chat port a web port', () => {
    const irc = FEE_PORT_NOTES[6667] ?? '';
    expect(irc).toMatch(/IRC/);
    expect(irc).not.toMatch(/web/i);
  });

  it('only names ports that are on the banned list in the banned notes', () => {
    for (const port of Object.keys(BANNED_PORT_NOTES).map(Number)) {
      const banned = BANNED_PORT_RANGES.some((r) => port >= r.from && port <= r.to);
      expect(banned, `banned note for ${port}`).toBe(true);
    }
  });
});
