/**
 * The example drafts of lesson 10 (`ai-assisted-deploy`) are real specs, and the lesson's claims about them
 * are facts of the engine: which codes each carries, which lines are wrong against the sentence, and what
 * each repair costs. If the lint rules or the rate card move, this test says which sentence of the lesson
 * has to move with them.
 */

import { BAKED_PRICING, normalizeSpec } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import {
  ASKED_A,
  ASKED_B,
  BUDGET_A,
  BUDGET_B,
  BUDGET_DOLLARS,
  CARD_TEXT,
  codesOf,
  DRAFT_A,
  DRAFT_A_FOUR,
  DRAFT_A_LINTED,
  DRAFT_A_READ,
  DRAFT_A_SIZED,
  DRAFT_A_SIZED_PUBLIC,
  DRAFT_B,
  DRAFT_B_FIX,
  DRAFT_B_LINES,
  DRAFT_B_OVERSIZED,
  DRAFT_B_REPAIRED,
  driftOf,
  exampleSession,
  flaggedLines,
  lintOf,
  PEAK,
  PRICE,
  PROMPT_A,
  PROMPT_B,
  priceOf,
  SEALED,
  SESSION_WIDTH,
  SIZED,
  valueAt,
} from './ai-assisted-deploy.ts';

const ALL = {
  DRAFT_A,
  DRAFT_A_READ,
  DRAFT_A_LINTED,
  DRAFT_A_SIZED,
  DRAFT_A_SIZED_PUBLIC,
  DRAFT_A_FOUR,
  DRAFT_B,
  DRAFT_B_REPAIRED,
  DRAFT_B_OVERSIZED,
};

/** Error and warning codes of a spec, sorted, so the order of the report does not matter. */
function flags(spec: Parameters<typeof lintOf>[0]): string[] {
  return [
    ...new Set(
      lintOf(spec)
        .issues.filter((i) => i.severity !== 'info')
        .map((i) => i.code),
    ),
  ].sort();
}

describe('every example draft is a real v8 spec', () => {
  for (const [name, spec] of Object.entries(ALL)) {
    it(`${name} normalises with nothing defaulted, dropped or coerced`, () => {
      const r = normalizeSpec(spec);
      expect(r.defaulted).toEqual([]);
      expect(r.dropped).toEqual([]);
      expect(r.coerced).toEqual([]);
      expect(r.spec.compose).toHaveLength(spec.compose.length);
    });
  }

  it('no draft carries a component name or a placement code the page corrects before the form (FACTS 15.2.5)', () => {
    for (const spec of Object.values(ALL)) {
      for (const c of spec.compose) expect(c.name).toMatch(/^[a-z0-9]+$/);
      for (const g of spec.geolocation) expect(g).toMatch(/^a!?c[A-Z]{2}(_[A-Z0-9]+){0,2}$/);
    }
  });
});

describe('the example session of step 1', () => {
  const { code, highlight } = exampleSession();
  const lines = code.split('\n');

  it('is labelled as an example and not a recording', () => {
    expect(lines[0]).toMatch(/^EXAMPLE/);
    expect(lines[0]).toMatch(/not a real session/i);
  });

  it('shows the draft it comes from: the sentence, the name, the size, the image, the ports and the variable', () => {
    const c = DRAFT_A.compose[0];
    const f = CARD_TEXT.fields;
    expect(code).toContain('Host my quotes API');
    expect(code).toMatch(new RegExp(`${f.name}\\s+${DRAFT_A.name}`));
    expect(code).toMatch(new RegExp(`${f.instances}\\s+${DRAFT_A.instances}`));
    expect(code).toMatch(new RegExp(`${f.term}\\s+1 month`));
    expect(code).toContain(`${c?.cpu} vCPU, ${c?.ram} MB, ${c?.hdd} GB`);
    expect(code).toContain(c?.repotag ?? 'missing');
    expect(code).toContain(`${c?.ports[0]}\u2192${c?.containerPorts[0]}`);
    expect(code).toContain(c?.environmentParameters[0] ?? 'missing');
  });

  it('prints the page strings word for word and highlights exactly the two notes', () => {
    const marked = highlight.map((n) => (lines[n - 1] ?? '').trim()).filter(Boolean);
    expect(marked.join(' ')).toBe(`${CARD_TEXT.envWarning} ${CARD_TEXT.note}`);
    for (const label of CARD_TEXT.buttons) expect(code).toContain(label);
    expect(code).toContain(CARD_TEXT.heading);
    expect(code).toContain(CARD_TEXT.corrected);
  });

  it('follows the order of the real card: summary, components, environment warning, corrections, note, buttons', () => {
    const at = (needle: string): number => code.indexOf(needle);
    const order = [
      CARD_TEXT.heading,
      CARD_TEXT.fields.size,
      DRAFT_A.compose[0]?.repotag ?? 'missing',
      'The environment variables were',
      CARD_TEXT.corrected,
      'Nothing has been deployed',
      CARD_TEXT.buttons[0],
    ].map(at);
    expect(order.every((n) => n >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('says what the page corrected, in the page words, and it is true of the draft', () => {
    const c = DRAFT_A.compose[0];
    expect(c?.repotag.endsWith(':latest')).toBe(true);
    const joined = lines.join(' ').replace(/\s+/g, ' ');
    expect(joined).toContain(CARD_TEXT.tagFixed(c?.name ?? '', c?.repotag ?? ''));
  });

  it('keeps every line short enough to read on a phone, and says nothing a lesson may not', () => {
    for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(SESSION_WIDTH + 2);
    expect(code).not.toMatch(/[\u2014\u2013]/);
    expect(code).not.toContain('!');
    expect(code).not.toMatch(/preview|beta/i);
  });
});

describe('draft A, the quotes API', () => {
  it('is wrong against the sentence in two places the linter cannot see', () => {
    expect(driftOf(DRAFT_A, ASKED_A).sort()).toEqual(['compose[0].containerPorts', 'geolocation']);
    const atThoseLines = lintOf(DRAFT_A).issues.filter(
      (i) => i.path.startsWith('geolocation') || i.path.startsWith('compose[0].containerPorts'),
    );
    expect(atThoseLines).toEqual([]);
    expect(driftOf(DRAFT_A_READ, ASKED_A)).toEqual([]);
  });

  it('puts the token of the sentence in a public environment variable', () => {
    const token = (PROMPT_A.match(/tk_[0-9a-f]+/) ?? [])[0];
    expect(token).toBeTruthy();
    expect(DRAFT_A.compose[0]?.environmentParameters).toEqual([`ADMIN_TOKEN=${token}`]);
    expect(PROMPT_A).toContain(String(valueAt(ASKED_A, 'compose[0].containerPorts')).replace(/\D/g, ''));
    expect(PROMPT_A).toContain(`USD ${BUDGET_DOLLARS}`);
  });

  it('carries the three warnings the lint step names, and no error', () => {
    const r = lintOf(DRAFT_A);
    expect(r.errors).toBe(0);
    expect(flags(DRAFT_A)).toEqual(['ENV_SECRET_PUBLIC', 'IMAGE_LATEST', 'INSTANCES_ONE']);
    // Reading it against the sentence does not change what the linter says.
    expect(flags(DRAFT_A_READ)).toEqual(flags(DRAFT_A));
  });

  it('is clean after the lint step: no error, and only the placeholder note about the sealed value', () => {
    expect(lintOf(DRAFT_A_LINTED).errors).toBe(0);
    expect(flags(DRAFT_A_LINTED)).toEqual(['ENTERPRISE_BLOB_FORMAT']);
    expect(DRAFT_A_LINTED.enterprise).toBe(SEALED);
    expect(DRAFT_A_LINTED.instances).toBeGreaterThan(1);
    expect(DRAFT_A_LINTED.compose[0]?.repotag).not.toMatch(/:latest$/);
    expect(codesOf(lintOf(DRAFT_A_LINTED))).toContain('INSTANCES_PRICE_CLIFF');
  });

  it('the linter already notes the price cliff at three copies, and not at four (the estimate challenge says so)', () => {
    expect(codesOf(lintOf(DRAFT_A_SIZED))).toContain('INSTANCES_PRICE_CLIFF');
    expect(codesOf(lintOf(DRAFT_A_FOUR))).not.toContain('INSTANCES_PRICE_CLIFF');
  });

  it('the price tells the story: the draft looks affordable, the repair breaks the budget, sizing fixes it', () => {
    expect(PRICE.aReturned).toBeLessThanOrEqual(BUDGET_A);
    expect(PRICE.aLinted).toBeGreaterThan(BUDGET_A);
    expect(PRICE.aSized).toBeLessThanOrEqual(BUDGET_A);
    expect(PRICE.aSized).toBeGreaterThan(PRICE.aSizedPublic);
    expect(PRICE.aFour).toBeGreaterThan(BUDGET_A);
    expect(BUDGET_A).toBeCloseTo(BUDGET_DOLLARS - 0.01, 10);
  });

  it('the budget bites on a half measure: sizing for headroom nobody measured is still over', () => {
    const halfway = {
      ...DRAFT_A_LINTED,
      compose: [{ ...(DRAFT_A_LINTED.compose[0] as object), cpu: 1, ram: 2000, hdd: 20 }],
    } as typeof DRAFT_A_LINTED;
    expect(priceOf(halfway)).toBeGreaterThan(BUDGET_A);
  });

  it('the size the lesson solves to is at or above what the test run used, and under budget', () => {
    expect(SIZED.cpu).toBeGreaterThanOrEqual(PEAK.cpu);
    expect(SIZED.ram).toBeGreaterThanOrEqual(PEAK.ram);
    expect(SIZED.hdd).toBeGreaterThanOrEqual(PEAK.hdd);
    expect(priceOf(DRAFT_A_SIZED)).toBeLessThanOrEqual(BUDGET_A);
    // The floor of the sizing task is itself under budget, so the task has a range of passing answers.
    const atPeak = {
      ...DRAFT_A_LINTED,
      compose: [{ ...(DRAFT_A_LINTED.compose[0] as object), ...PEAK }],
    } as typeof DRAFT_A_LINTED;
    expect(priceOf(atPeak)).toBeLessThanOrEqual(BUDGET_A);
  });
});

describe('draft B, the Nextcloud for the family', () => {
  it('warns on exactly the lines the lesson says, with the codes the lesson names', () => {
    const flagged = flaggedLines(DRAFT_B_LINES, DRAFT_B, lintOf(DRAFT_B));
    expect(flagged.map((f) => f.id)).toEqual(['geo', 'image', 'data', 'size']);
    const byId = Object.fromEntries(flagged.map((f) => [f.id, f]));
    expect(byId.image?.codes).toEqual(['IMAGE_LATEST', 'IMAGE_DOCKER_IO_HOST']);
    expect(byId.data?.codes).toEqual(['STATEFUL_NO_VOLUME']);
    expect(byId.size?.codes).toEqual(['RAM_TOO_SMALL_FOR_IMAGE']);
  });

  it('the polarity slip in the placement is wrong against the sentence and has no lint code', () => {
    const geo = flaggedLines(DRAFT_B_LINES, DRAFT_B, lintOf(DRAFT_B)).find((f) => f.id === 'geo');
    expect(geo).toEqual({ id: 'geo', codes: [], drift: true });
    expect(driftOf(DRAFT_B, ASKED_B)).toEqual(['geolocation']);
  });

  it('the two lines that look odd are fine, and each carries the sentence for a learner who picks it', () => {
    const wrong = new Set(flaggedLines(DRAFT_B_LINES, DRAFT_B, lintOf(DRAFT_B)).map((f) => f.id));
    const fine = DRAFT_B_LINES.filter((l) => !wrong.has(l.id));
    expect(fine.map((l) => l.id)).toEqual(['copies', 'ports']);
    for (const l of fine) expect(l.fine).toBeTruthy();
  });

  it('every line covers paths that exist in the draft', () => {
    for (const line of DRAFT_B_LINES) {
      for (const p of line.paths) expect(valueAt(DRAFT_B, p), `${line.id}: ${p}`).not.toBeUndefined();
    }
  });

  it('the repair is clean and inside the budget, and the budget bites on an overcorrection', () => {
    expect(flags(DRAFT_B_REPAIRED)).toEqual([]);
    expect(flaggedLines(DRAFT_B_LINES, DRAFT_B_REPAIRED, lintOf(DRAFT_B_REPAIRED))).toEqual([]);
    expect(driftOf(DRAFT_B_REPAIRED, ASKED_B)).toEqual([]);
    expect(PRICE.bRepaired).toBeLessThanOrEqual(BUDGET_B);
    expect(PRICE.bOversized).toBeGreaterThan(BUDGET_B);
    expect(flags(DRAFT_B_OVERSIZED)).toEqual([]);
  });

  it('the repair keeps the sync mode and the two copies it was given', () => {
    expect(DRAFT_B_FIX.compose[0]?.containerData).toMatch(/^g:\//);
    expect(DRAFT_B_REPAIRED.instances).toBe(DRAFT_B.instances);
    expect(DRAFT_B.compose[0]?.containerData).toMatch(/^g:\//);
  });

  it('the sentence states the budget the check enforces', () => {
    expect(PROMPT_B).toContain(`USD ${(BUDGET_B + 0.01).toFixed(2)}`);
    expect(BUDGET_B).toBeCloseTo(BAKED_PRICING.params.minUSDPrice + 0.5, 10);
  });
});
