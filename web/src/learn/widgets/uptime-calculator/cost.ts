/**
 * What each instance count costs, from the shared pricing engine. One fixture spec, instances changed,
 * everything else equal, so the only thing that moves the price is the count (docs/CONTENT.md section 5).
 *
 * The fixture is the "Web app" example (0.5 core, 500 MB, 5 GB), small enough that the monthly floor of
 * USD 0.99 decides the price for one to three instances and the small-app discount (instances under 4)
 * ends at four. That jump is real (FACTS 4.4, 11 row 29) and is exactly why cost against resilience is
 * not a straight line, so the calculator shows it rather than smoothing it away.
 */
import { BAKED_PRICING, FIXTURES, type FluxAppSpec, type PricingParams, quote } from '@shared/flux';

export const COST_FIXTURE_ID = 'web-app';

export interface PriceRow {
  instances: number;
  usdPerMonth: number;
}

function fixtureSpec(id: string): FluxAppSpec {
  const hit = FIXTURES.find((f) => f.id === id) ?? FIXTURES[0];
  if (!hit) throw new Error('no fixtures');
  return hit.spec;
}

/** The fixture's resources, for a caption: "0.5 cores, 500 MB RAM, 5 GB disk". */
export function fixtureResources(id: string = COST_FIXTURE_ID): {
  cpu: number;
  ramMb: number;
  hddGb: number;
} {
  const spec = fixtureSpec(id);
  let cpu = 0;
  let ramMb = 0;
  let hddGb = 0;
  for (const c of spec.compose) {
    cpu += c.cpu;
    ramMb += c.ram;
    hddGb += c.hdd;
  }
  return { cpu: Math.round(cpu * 10) / 10, ramMb, hddGb };
}

/** Monthly USD for one to `max` instances. `params` are the official rates (live or baked). */
export function priceLadder(
  max: number,
  params: PricingParams = BAKED_PRICING.params,
  fixtureId: string = COST_FIXTURE_ID,
): PriceRow[] {
  const spec = fixtureSpec(fixtureId);
  const rows: PriceRow[] = [];
  for (let n = 1; n <= max; n++) {
    const q = quote({ ...spec, instances: n }, params, { months: 1 });
    rows.push({ instances: n, usdPerMonth: q.usdPerMonth });
  }
  return rows;
}

/** The instance count at which the price first jumps by more than half, or null (the "cliff"). */
export function priceCliff(rows: readonly PriceRow[]): number | null {
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const before = rows[i - 1];
    if (row && before && before.usdPerMonth > 0 && row.usdPerMonth / before.usdPerMonth > 1.5) {
      return row.instances;
    }
  }
  return null;
}
