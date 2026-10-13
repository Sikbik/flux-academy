// Re-checks the pricing formula in shared/flux/pricing.ts against the live official calculator.
//
//   node server/scripts/verify-pricing.ts            12 cases, about 15 seconds
//   node server/scripts/verify-pricing.ts --quick    6 cases
//   node server/scripts/verify-pricing.ts --all      every captured case (36) plus the marketplace probes
//
// What it does, read-only:
//   1. GET  api.runonflux.io/apps/getappspecsusdprice          the live price table
//   2. GET  viprates.runonflux.io/rates                         the FLUX price the node uses
//   3. POST api.runonflux.io/apps/calculatefiatandfluxprice     one request per case, text/plain
// Each case is priced locally with the live table and compared with what the network answered. Names are fresh
// per run so nothing is ever priced as an update of a real app. Requests are spaced to stay under 2 per second.
//
// Exit codes: 0 all match, 1 drift (formula or table is wrong), 2 could not reach the network (nothing verified).
// No dependencies, no secrets, nothing written to disk.

import { OFFICIAL_CASES } from '../../shared/flux/pricing.fixtures.ts';
import { BAKED_PRICING, quote } from '../../shared/flux/pricing.ts';
import type { FluxAppSpec, PricingParams } from '../../shared/flux/types.ts';

const API = process.env.FLUX_API ?? 'https://api.runonflux.io';
const RATES = process.env.FLUX_RATES ?? 'https://viprates.runonflux.io';
const GAP_MS = 600;
const TIMEOUT_MS = 20_000;
/** Cents may differ by this much (the brief: within a cent). Official prices end in .49 or .99 so this is exact in practice. */
const USD_TOLERANCE = 0.01;
/** The node caches its FLUX rate for a while, so allow a little drift between our read and its. */
const FLUX_TOLERANCE = 0.01;

const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const all = args.has('--all');

const QUICK_IDS = [
  'hello-1-instance',
  'small-3-instances',
  'static-ip-3',
  'ports-80-443',
  'expire-6-months',
  'multi-3-components',
];
const DEFAULT_IDS = [
  ...QUICK_IDS,
  'hello-2-instances',
  'small-10-instances',
  'big-ram-disk-4',
  'nodes-pinned',
  'expire-12-months',
  'hw-discount-edge-4-instances-small',
];

class NetworkDown extends Error {}

async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'flux-academy-verify-pricing/1', ...(init.headers ?? {}) },
    });
  } catch (err) {
    throw new NetworkDown(`${url}: ${(err as Error).message}`);
  }
  if (!res.ok) throw new NetworkDown(`${url}: HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new NetworkDown(`${url}: answer was not JSON`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

async function livePrices(): Promise<PricingParams> {
  const body = await fetchJson(`${API}/apps/getappspecsusdprice`);
  if (!isObj(body) || body.status !== 'success' || !isObj(body.data)) {
    throw new NetworkDown('getappspecsusdprice did not return a success envelope');
  }
  const d = body.data;
  const keys = [
    'cpu',
    'ram',
    'hdd',
    'minPrice',
    'port',
    'scope',
    'staticip',
    'fluxmultiplier',
    'multiplier',
    'minUSDPrice',
  ];
  for (const k of keys) {
    if (typeof d[k] !== 'number' || !Number.isFinite(d[k]))
      throw new NetworkDown(`price table has no usable ${k}`);
  }
  return d as unknown as PricingParams;
}

async function liveFluxUsd(): Promise<number> {
  const doc = await fetchJson(`${RATES}/rates`);
  if (!Array.isArray(doc) || !Array.isArray(doc[0]))
    throw new NetworkDown('rates document has an unexpected shape');
  const usd = (doc[0] as { code?: unknown; rate?: unknown }[]).find((r) => r?.code === 'USD');
  if (typeof usd?.rate !== 'number') throw new NetworkDown('rates document has no USD rate');
  for (const part of doc.slice(1)) {
    const f = (part as Record<string, unknown> | null)?.FLUX;
    if (typeof f === 'number' && f > 0) return usd.rate * f;
  }
  throw new NetworkDown('rates document has no FLUX rate');
}

interface Official {
  usd: number;
  flux: number;
}

async function official(spec: FluxAppSpec): Promise<Official | { rejected: string }> {
  // text/plain on purpose: the node hangs for a minute on application/json.
  const body = await fetchJson(`${API}/apps/calculatefiatandfluxprice`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(spec),
  });
  if (!isObj(body)) throw new NetworkDown('calculator answered something that is not an object');
  if (body.status !== 'success') {
    const d = body.data;
    return { rejected: isObj(d) && typeof d.message === 'string' ? d.message : 'status was not success' };
  }
  const d = body.data;
  if (!isObj(d) || typeof d.usd !== 'number' || typeof d.flux !== 'number') {
    throw new NetworkDown('calculator answer has no usd and flux numbers');
  }
  return { usd: d.usd, flux: d.flux };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

async function main(): Promise<number> {
  const tag = Date.now().toString(36);
  const problems: string[] = [];

  const [params, fluxUsd] = await Promise.all([livePrices(), liveFluxUsd()]);
  console.log(`live price table  ${JSON.stringify(params)}`);
  console.log(`live FLUX price   ${fluxUsd.toFixed(8)} USD (viprates.runonflux.io)`);

  // 1. Is the baked table still the network's table?
  const bakedParams = BAKED_PRICING.params as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(params as unknown as Record<string, number>)) {
    if (k === 'height') continue;
    if (bakedParams[k] !== v) problems.push(`baked ${k} is ${bakedParams[k]} but the network says ${v}`);
  }

  // 2. Which cases to run.
  const ids = all ? OFFICIAL_CASES.map((c) => c.id) : quick ? QUICK_IDS : DEFAULT_IDS;
  const cases = ids
    .map((id) => OFFICIAL_CASES.find((c) => c.id === id))
    .filter((c): c is (typeof OFFICIAL_CASES)[number] => c !== undefined);
  const probes: { id: string; spec: FluxAppSpec }[] = cases.map((c, i) => ({
    id: c.id,
    spec: { ...structuredClone(c.spec), name: `acadverify${tag}${i}` },
  }));
  if (all) {
    // Marketplace names get a price multiplier on the network. Fresh suffix, so it is still not an update.
    const base = OFFICIAL_CASES.find((c) => c.id === 'big-ram-disk-4')?.spec;
    if (base) {
      for (const [i, prefix] of ['Minecraft8GB', 'FiroMN'].entries()) {
        probes.push({
          id: `marketplace-${prefix}`,
          spec: { ...structuredClone(base), name: `${prefix}verify${tag}${i}` },
        });
      }
    }
  }

  console.log('');
  console.log(`${pad('case', 38)}${pad('computed', 18)}${pad('official', 18)}result`);
  let checked = 0;
  for (const [i, p] of probes.entries()) {
    if (i > 0) await sleep(GAP_MS);
    const local = quote(p.spec, params, { fluxUsd, paramsSource: 'live' });
    const net = await official(p.spec);
    if ('rejected' in net) {
      problems.push(`${p.id}: the calculator rejected a spec we price (${net.rejected})`);
      console.log(`${pad(p.id, 38)}${pad(`$${local.usdTotal}`, 18)}${pad('rejected', 18)}DRIFT`);
      continue;
    }
    checked++;
    const usdOk = Math.abs((local.usdTotal ?? Number.NaN) - net.usd) <= USD_TOLERANCE;
    const fluxLocal = local.fluxTotal ?? Number.NaN;
    const fluxOk = Math.abs(fluxLocal - net.flux) <= Math.max(0.02, net.flux * FLUX_TOLERANCE);
    const cell = (usd: number, flux: number) => pad(`$${usd.toFixed(2)} ${flux.toFixed(2)}F`, 18);
    console.log(
      `${pad(p.id, 38)}${cell(local.usdTotal ?? 0, fluxLocal)}${cell(net.usd, net.flux)}${usdOk && fluxOk ? 'ok' : 'DRIFT'}`,
    );
    if (!usdOk) problems.push(`${p.id}: computed $${local.usdTotal} but the network answered $${net.usd}`);
    else if (!fluxOk)
      problems.push(`${p.id}: computed ${fluxLocal} FLUX but the network answered ${net.flux}`);
  }

  console.log('');
  if (problems.length === 0) {
    console.log(`ok: ${checked} of ${probes.length} cases match the official calculator within a cent`);
    return 0;
  }
  console.log(`DRIFT: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
  for (const m of problems) console.log(`  - ${m}`);
  console.log('Fix shared/flux/pricing.ts (and BAKED_PRICING) before shipping, then re-run.');
  return 1;
}

try {
  process.exitCode = await main();
} catch (err) {
  if (err instanceof NetworkDown) {
    console.error(`could not verify: ${err.message}`);
    process.exitCode = 2;
  } else {
    throw err;
  }
}
