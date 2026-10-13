/**
 * Lesson 6, resources-pricing: how CPU, RAM, disk, instances, ports and time make a monthly price.
 *
 * Planted failures: an oversized app (step 2), a fourth instance that doubles the bill (step 4), a restricted
 * public port that triples it (step 5).
 *
 * Facts: docs/research/FACTS.md 4 (pricing), 5 (blocks). Every price and duration in the prose is computed
 * at module load from the engine in shared/flux (`quote`, the blocks helpers, the baked rate card), so the
 * words cannot drift from the numbers. Rates are "at the time of writing".
 */

import type { FluxAppSpec, FluxComponentSpec, Quote } from '@shared/flux';
import {
  BAKED_PRICING,
  BLOCKS_PER_MONTH,
  BUNDLE_INSTANCES,
  blocksPerDay,
  DURATION_DISCOUNTS,
  daysToBlocks,
  defaultComponent,
  defaultSpec,
  ENTERPRISE_PORT_RANGES,
  EXTRA_INSTANCE_FLOOR_USD,
  HW_DISCOUNT_MAX_INSTANCES,
  HW_DISCOUNTS,
  humanDuration,
  LIMITS,
  MAX_EXPIRE_BLOCKS,
  priceStages,
  quote,
  roundUpToCharmPrice,
  TARGET_BLOCK_SEC,
} from '@shared/flux';
import type { Lesson } from '@/learn/types';

const usd = (n: number): string => `USD ${n.toFixed(2)}`;
const grouped = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const SMALL = { cpu: 0.5, ram: 500, hdd: 5 };
const STANDARD = { cpu: 1, ram: 2000, hdd: 20 };
const MEDIUM = { cpu: 2, ram: 4000, hdd: 40 };

/** The whole quote for a one-component app, from the engine and the baked rate card. */
function priced(over: Partial<FluxAppSpec>, comp: Partial<FluxComponentSpec>): Quote {
  const spec: FluxAppSpec = {
    ...defaultSpec(),
    instances: 3,
    ...over,
    compose: [defaultComponent({ ports: [31001], containerPorts: [3000], ...comp })],
  };
  return quote(spec, BAKED_PRICING.params, { fluxUsd: BAKED_PRICING.fluxUsd });
}

const lineUsd = (q: Quote, id: string): number => q.lines.find((l) => l.id === id)?.usd ?? 0;

// Step 1: the anatomy quote, with a restricted port so every kind of line is present.
const ANATOMY = priced({}, { ...STANDARD, ports: [8080], containerPorts: [8080] });

// Step 2: rates per unit, from the rate card.
const P = BAKED_PRICING.params;
const PER_CORE = P.cpu * 10;
const PER_GB_RAM = P.ram * 10;
const PER_GB_DISK = P.hdd;

// Step 3: the medium app across instance counts.
const medium = (n: number): number => priced({ instances: n }, MEDIUM).usdPerMonth;
const MEDIUM_BUNDLE = ['cpu', 'ram', 'hdd'].reduce((s, id) => s + lineUsd(priced({}, MEDIUM), id), 0);
/** One instance of the medium app: a third of the bundle, rounded up to the cent by the engine. */
const MEDIUM_SHARE = Math.ceil((MEDIUM_BUNDLE / BUNDLE_INSTANCES) * 100 - 1e-9) / 100;

// Step 4 and 5: the small app.
const small = (n: number, port = 31001): number =>
  priced({ instances: n }, { ...SMALL, ports: [port], containerPorts: [port === 31001 ? 3000 : port] })
    .usdPerMonth;

// Step 6: time.
const MEDIUM_ONE_MONTH = priced({}, MEDIUM).usdPerMonth;
const MEDIUM_SIX_MONTHS = priced({ expire: 6 * BLOCKS_PER_MONTH }, MEDIUM).usdTotal ?? 0;
const DISCOUNT_TEXT = [...DURATION_DISCOUNTS]
  .sort((a, b) => a.minMonths - b.minMonths)
  .map((d) => `${d.label} off from ${d.minMonths} months`)
  .join(', ');
const FLUX_OFF = Math.round((1 - P.fluxmultiplier) * 100);
/** The first duration band, in months, from the engine's discount table. */
const FIRST_BAND_MONTHS = Math.min(...DURATION_DISCOUNTS.map((d) => d.minMonths));
/** The small app on one month and on the first discounted term, so the rounding is shown with real totals. */
const SMALL_ONE_MONTH = priced({}, SMALL).usdTotal ?? 0;
const SMALL_FIRST_BAND = priced({ expire: FIRST_BAND_MONTHS * BLOCKS_PER_MONTH }, SMALL).usdTotal ?? 0;
const SMALL_SINGLES = Math.round(FIRST_BAND_MONTHS * SMALL_ONE_MONTH * 100) / 100;
const SMALL_TIER = HW_DISCOUNTS[0] ?? {
  maxCpu: 3,
  maxRam: 6000,
  maxHdd: 150,
  factor: 0.8,
  label: '20 percent',
};
/** The first instance count that no longer gets the small app discount. */
const CLIFF_AT = HW_DISCOUNT_MAX_INSTANCES + 1;
const ORDINAL = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
/** "fourth", from the engine's discount limit, so the words follow the rule. */
const CLIFF_ORDINAL = ORDINAL[CLIFF_AT] ?? `${CLIFF_AT}th`;
const CLIFF_WORD =
  ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][CLIFF_AT] ?? String(CLIFF_AT);
const FLAT_FEE = EXTRA_INSTANCE_FLOOR_USD;

/** The small app at n instances, stage by stage, so the cliff step quotes the engine's own working. */
const smallStages = (n: number) =>
  priceStages(
    {
      ...defaultSpec(),
      instances: n,
      compose: [defaultComponent({ ...SMALL, ports: [31001], containerPorts: [3000] })],
    },
    BAKED_PRICING.params,
  );
/** One instance of the small app: a third of the bundle, rounded up to the cent. */
const SMALL_SHARE = smallStages(1).perInstanceUsd;
/** Just under the cliff: the discounted total, which the minimum then lifts. */
const BELOW_CLIFF = smallStages(CLIFF_AT - 1);
/** At the cliff: the first instance at its share plus a flat fee for each of the others. */
const AT_CLIFF = smallStages(CLIFF_AT);
/** What the cliff would cost if only the discount ended (the share multiplied out, then rounded up). */
const DISCOUNT_ONLY_AT_CLIFF = roundUpToCharmPrice(
  (Math.ceil(SMALL_SHARE * (CLIFF_AT - 1) * 100) + Math.ceil(SMALL_SHARE * 100)) / 100,
);
/** The first instance count at which a cheap app switches to the flat fee for each extra instance. */
const FLAT_FEE_AT = (() => {
  for (let n = 2; n <= 20; n++) {
    const st = smallStages(n);
    const linear = (Math.ceil(st.perInstanceUsd * (n - 1) * 100) + Math.ceil(st.perInstanceUsd * 100)) / 100;
    if (Math.abs(st.instancePriceUsd - linear) > 1e-9) return n;
  }
  return CLIFF_AT;
})();
/**
 * "1 to 1023, 8080, 8081, 8443 and 6667", from the engine's list of charged public ports. The fee table starts
 * at 0, but a public port must be 1 to 65535 (FACTS 3.4), so the lesson names the ports a spec can use.
 */
const FEE_PORTS = (() => {
  const parts = ENTERPRISE_PORT_RANGES.map(([lo, hi]) => {
    const from = Math.max(lo, LIMITS.ports.min);
    return from === hi ? String(from) : `${from} to ${hi}`;
  });
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
})();

/** A component skeleton for the checkpoint specs. */
const api = {
  name: 'api',
  description: 'API',
  repotag: 'yourname/api:1.0.0',
  domains: [''],
  environmentParameters: [],
  commands: [],
  containerData: '/tmp',
  repoauth: '',
};

const lesson: Lesson = {
  id: 'resources-pricing',
  hook: 'A Flux price is a short sum you can do in your head once you know its lines. You will resize an app, find the instance count where the price jumps, remove a hidden fee and convert months into blocks.',
  objectives: [
    'Name the lines of a monthly price and say which resource weighs most.',
    `Predict the price of an app from its resources and instance count, including the step at the ${CLIFF_ORDINAL} instance.`,
    'Find and remove the extra charge on a restricted public port.',
    'Convert a subscription length into blocks and say what a longer subscription saves.',
  ],
  steps: [
    {
      id: 'anatomy',
      title: 'A price is a short sum',
      body: [
        // fact: FACTS 4.3 and 4.4 (formula, restricted ports USD 2, small app discount, rounding)
        `Here is a {{term:price-quote}} for a small web app: 1 core, 2000 MB of RAM, 20 GB of disk and three instances, published on port 8080. The resources add up to ${usd(lineUsd(ANATOMY, 'cpu'))} for CPU, ${usd(lineUsd(ANATOMY, 'ram'))} for RAM and ${usd(lineUsd(ANATOMY, 'hdd'))} for disk, and the restricted port adds ${usd(lineUsd(ANATOMY, 'ports'))}. A discount and a rounding step then turn that sum into ${usd(ANATOMY.usdPerMonth)} a month.`,
        'Every line carries a note that says how it came about, and the diagram steps through them in order. The rates are stated for a bundle of three instances, which is why three is the number this lesson keeps returning to. They are the rates at the time of writing; the engine reads the live rate card when it can reach it.',
      ],
      callouts: [
        {
          kind: 'why',
          // fact: FACTS 4.4 (fluxmultiplier 0.95), 4.7
          body: `Prices are set in USD. Paying in FLUX converts at the current rate and takes ${FLUX_OFF} percent off the converted amount: the {{term:flux-multiplier}}.`,
        },
        {
          kind: 'cost',
          // fact: FACTS 4.4 (minimum USD 0.99, rounded up to .49 or .99)
          body: `The total is rounded up to the next price ending in .49 or .99 and never falls below ${usd(P.minUSDPrice)}, the {{term:minimum-price}}.`,
        },
      ],
      stage: { kind: 'diagram', id: 'price-waterfall', beat: 6, props: { quote: ANATOMY } },
    },
    {
      id: 'cpu-ram-disk',
      title: 'CPU is the dearest line',
      body: [
        // fact: FACTS 4.1 (rate card: cpu 0.15 per 0.1 core, ram 0.05 per 100 MB, hdd 0.02 per GB)
        `Per bundle of three instances a core costs ${usd(PER_CORE)}, a gigabyte of RAM ${usd(PER_GB_RAM)} and a gigabyte of disk ${usd(PER_GB_DISK)}. One core therefore costs as much as ${PER_CORE / PER_GB_RAM} GB of RAM or ${Math.round(PER_CORE / PER_GB_DISK)} GB of disk. CPU is the dearest line per unit, so it is the first place to look when an app costs more than you expected.`,
        'Move the sliders and watch the waterfall: each line shows its note, and the odometer shows the monthly price in USD and in FLUX. Bring the app below the target and notice which slider moved the price most. The instance count stays at three, so the app keeps its redundancy while it shrinks.',
      ],
      callouts: [
        {
          kind: 'tip',
          // fact: FACTS 4.3 (the price is computed from the spec numbers only)
          body: 'You pay for what the spec reserves, not for what the app uses. A container that asks for 2 cores is billed for 2 cores while it idles, so measure before you size.',
        },
      ],
      stage: {
        kind: 'widget',
        id: 'cost-reactor',
        props: {
          spec: {
            name: 'sizing',
            description: 'An app to shrink',
            instances: 3,
            compose: [{ ...api, ...MEDIUM, ports: [31001], containerPorts: [3000] }],
          },
          target: { usdMax: 1.99 },
          sliders: ['cpu', 'ram', 'hdd'],
        },
      },
      task: { kind: 'widget', prompt: `Resize the app until it costs ${usd(1.99)} a month or less.` },
    },
    {
      id: 'instances',
      title: 'Each instance adds a share',
      body: [
        // fact: FACTS 4.3 step A (per instance is a third of the bundle, rounded up to the cent), 4.6 curve
        `The bundle is the price of three instances, so one instance is a third of it, rounded up to the cent. For this app of 2 cores, 4000 MB and 40 GB the bundle is ${usd(MEDIUM_BUNDLE)}, so each instance is ${usd(MEDIUM_SHARE)}. Past the third instance the price climbs by about that much each time: ${usd(medium(5))} at five, ${usd(medium(6))} at six and ${usd(medium(10))} at ten.`,
        'That is close to linear, so redundancy is a plain budget choice. Your budget here is USD 10 a month. Find the largest number of instances that fits it, and let the price tell you when you have gone over.',
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'budgeted',
          description: 'An app with a budget',
          instances: 3,
          compose: [{ ...api, ...MEDIUM, ports: [31001], containerPorts: [3000] }],
        },
        editable: ['instances'],
        show: ['form', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: 'Run as many instances as fit in USD 10 a month.',
        hint: 'Raise the count one step at a time and watch the price. Each instance adds about the same amount here, so the last count under the budget is the answer.',
        check: {
          all: [
            { price: 'max', usd: 9.99, message: 'That is over USD 10 a month. Lower the instance count.' },
            {
              path: 'instances',
              op: 'gte',
              value: 5,
              message: 'The budget allows more instances: each one adds about the same amount.',
            },
          ],
        },
        solution: { instances: 5 },
      },
    },
    {
      id: 'cliff',
      title: `The ${CLIFF_ORDINAL} instance can double a small app's price`,
      body: [
        // fact: FACTS 4.4 (small app cliff: 0.99 at 3, 1.99 at 4), 11 row 29
        `Take the small app: half a core, 500 MB and 5 GB. Three instances cost ${usd(small(3))}, which is the minimum the network charges. Four cost ${usd(small(4))}. Only one instance was added, and the price doubled.`,
        // fact: FACTS 4.3 step D (hardware discount only below 4 instances), step E (the floor comes after the discount)
        `Two rules change at ${CLIFF_WORD} instances. First, the {{term:small-app-discount}} takes ${SMALL_TIER.label} off apps under ${SMALL_TIER.maxCpu} cores, ${grouped(SMALL_TIER.maxRam)} MB of RAM and ${SMALL_TIER.maxHdd} GB of disk, but only up to ${HW_DISCOUNT_MAX_INSTANCES} instances. At ${HW_DISCOUNT_MAX_INSTANCES} instances the app costs ${usd(BELOW_CLIFF.instancePriceUsd)} before the discount and ${usd(BELOW_CLIFF.afterMultiplierRawUsd)} after it. That is under the minimum, so it is lifted to ${usd(BAKED_PRICING.params.minUSDPrice)}.`,
        // fact: FACTS 4.3 step A, 4.4 (cheap apps pay 0.50 per extra instance when one instance is under 0.50 and there are more than 2 extra)
        `Second, one instance of this app costs only ${usd(SMALL_SHARE)}, which is under ${usd(FLAT_FEE)}. From ${FLAT_FEE_AT} instances on, the first instance costs its share and every other one costs a flat ${usd(FLAT_FEE)}: ${usd(SMALL_SHARE)} + ${CLIFF_AT - 1} x ${usd(FLAT_FEE)} = ${usd(AT_CLIFF.instancePriceUsd)}, rounded up to ${usd(small(CLIFF_AT))}. Without that rule the price at ${CLIFF_WORD} would be ${usd(DISCOUNT_ONLY_AT_CLIFF)}. Bigger apps feel only the discount ending: the medium app goes from ${usd(medium(3))} at three instances to ${usd(medium(4))} at four.`,
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'tiny',
          description: 'A very small app',
          instances: 3,
          compose: [{ ...api, ...SMALL, ports: [31001], containerPorts: [3000] }],
        },
        editable: ['instances'],
        show: ['form', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: `Find the smallest instance count that costs more than ${usd(1.5)}.`,
        hint: 'Raise the instances one at a time and watch the price. It does not move at first, then it jumps. The count where it jumps is the answer.',
        check: {
          all: [
            { price: 'min', usd: 1.5, message: 'The price has not jumped yet. Add another instance.' },
            {
              path: 'instances',
              op: 'lte',
              value: CLIFF_AT,
              message:
                'That passes the price test, but the jump happens at a lower count. Look for the first one.',
            },
          ],
        },
        solution: { instances: CLIFF_AT },
      },
    },
    {
      id: 'port-tax',
      title: 'A port can cost more than the CPU',
      body: [
        // fact: FACTS 3.4 and 4.4 (restricted ports 1-1023, 8080, 8081, 8443, 6667: USD 2 each, before the divide by three; port 0 is refused, 80 is accepted and priced as restricted)
        `The public ports ${FEE_PORTS} carry a {{term:port-fee}}: ${usd(P.port)} each, added to the bundle before it is divided by three, so about ${usd(P.port / BUNDLE_INSTANCES)} per instance before discounts. They are accepted, only charged. The small app below publishes 8080, because its image listens there, and that one number takes the price from ${usd(small(3))} to ${usd(small(3, 8080))}.`,
        'The fee applies to the public port only. The container can keep listening on 8080, and any free public port can point at it, because `ports` and `containerPorts` pair by position. Change the public port and watch the price fall.',
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'tiny',
          description: 'A very small app',
          instances: 3,
          compose: [{ ...api, ...SMALL, ports: [8080], containerPorts: [8080] }],
        },
        editable: ['compose[0].ports', 'compose[0].containerPorts'],
        focus: [
          { path: 'compose[0].ports', note: 'The public port. This is the one that is priced.' },
          {
            path: 'compose[0].containerPorts',
            note: 'Where the container listens. It is free to keep 8080.',
          },
        ],
        show: ['form', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: 'Move the public port off the charged list and keep the container on 8080.',
        hint: 'The fee follows the public port. The container port can stay as it is, because the two lists pair by position. Any number in the 31000 range is free.',
        check: {
          all: [
            {
              lint: 'absent',
              codes: ['PORT_FEE'],
              message:
                'The public port is still charged. Pick a number outside 1 to 1023, 8080, 8081, 8443 and 6667.',
            },
            {
              path: 'compose[0].containerPorts',
              op: 'includes',
              value: 8080,
              message: 'The container keeps listening on 8080, so keep 8080 in `containerPorts`.',
            },
          ],
        },
        solution: { compose: [{ ports: [31001] }] },
      },
    },
    {
      id: 'time',
      title: 'Months, blocks and discounts',
      body: [
        // fact: FACTS 5.1 and 5.3 (30 s blocks, 88,000 per month, 1,056,000 maximum), 4.4 (duration discounts)
        `The {{term:expire}} field counts a subscription in blocks, one every ${TARGET_BLOCK_SEC} seconds, which is ${grouped(blocksPerDay())} a day. FluxOS prices a month as ${grouped(BLOCKS_PER_MONTH)} blocks, about ${humanDuration(BLOCKS_PER_MONTH * TARGET_BLOCK_SEC)}, and the longest subscription is ${grouped(MAX_EXPIRE_BLOCKS)} blocks. The price is linear in blocks before the discounts.`,
        `Longer saves money through the {{term:duration-discount}}: ${DISCOUNT_TEXT}. The medium app costs ${usd(MEDIUM_ONE_MONTH)} for one month, so six single months cost ${usd(6 * MEDIUM_ONE_MONTH)}. One six month subscription costs ${usd(MEDIUM_SIX_MONTHS)}.`,
        // fact: FACTS 4.4 (longer terms and charm rounding: the discount comes off before the last step, which rounds up to .49 or .99)
        SMALL_FIRST_BAND > SMALL_SINGLES
          ? `Check totals, not percentages. The discount comes off first and the total is then rounded up to .49 or .99. The small app costs ${usd(SMALL_ONE_MONTH)} for one month${SMALL_ONE_MONTH <= P.minUSDPrice ? ', the minimum,' : ''} and ${usd(SMALL_FIRST_BAND)} for ${FIRST_BAND_MONTHS} months: more than ${FIRST_BAND_MONTHS} single months at ${usd(SMALL_SINGLES)}. A longer term can cost more per month than a shorter one.`
          : 'Check totals, not percentages. The discount comes off first and the total is then rounded up to .49 or .99, which can swallow the saving of a small app.',
      ],
      stage: {
        kind: 'widget',
        id: 'block-converter',
        props: { case: { kind: 'months-to-blocks', value: 6 } },
      },
      task: { kind: 'widget', prompt: 'Convert 6 months into blocks.' },
    },
  ],
  checkpoint: [
    {
      id: 'four-instances',
      kind: 'estimate',
      prompt:
        'What does this cost per month in USD: 2 cores, 4000 MB of RAM and 40 GB of disk, four instances, public port 31001?',
      spec: {
        name: 'estimate-me',
        instances: 4,
        compose: [{ ...api, ...MEDIUM, ports: [31001], containerPorts: [3000] }],
      },
      quantity: 'usd-per-month',
      tolerance: 0.1,
      unit: 'USD',
      // fact: FACTS 4.3 (bundle divided by three, the small app discount ends at four) and 4.6
      explain: `The bundle is divided by three to get one instance, and four instances are billed at that share each, with no small app discount because it ends at ${CLIFF_WORD}. The total is then rounded up to the next price ending in .49 or .99.`,
      hint: 'Add the three resource lines, divide by three for one instance (rounded up to the cent) and multiply by four. Then ask whether the small app discount still applies at four instances.',
    },
    {
      id: 'penny-pincher',
      kind: 'spec-build',
      prompt:
        'This spec was sized by guesswork and publishes a charged port. Make it a lean three-instance app that still has at least 1 core and 2000 MB of RAM, for under USD 3 a month.',
      spec: {
        name: 'lean-api',
        description: 'An API that was sized by guess',
        instances: 3,
        compose: [{ ...api, ...MEDIUM, ports: [8080], containerPorts: [8080] }],
      },
      requirements: [
        {
          id: 'copies',
          label: 'Three instances',
          check: {
            path: 'instances',
            op: 'eq',
            value: 3,
            message: 'Keep three instances: that is the brief.',
          },
        },
        {
          id: 'cpu',
          label: 'At least 1 core',
          check: {
            path: 'compose[0].cpu',
            op: 'gte',
            value: 1,
            message: 'The brief wants at least 1 core, so do not go lower.',
          },
        },
        {
          id: 'ram',
          label: 'At least 2000 MB of RAM',
          check: {
            path: 'compose[0].ram',
            op: 'gte',
            value: 2000,
            message: 'The brief wants at least 2000 MB of RAM.',
          },
        },
        {
          id: 'port',
          label: 'No charged public port',
          check: {
            lint: 'absent',
            codes: ['PORT_FEE'],
            message: 'The public port is on the charged list. A number in the 31000 range is free.',
          },
        },
        {
          id: 'budget',
          label: 'Under USD 3 a month',
          check: {
            price: 'max',
            usd: 2.99,
            message: 'Still over budget. Compare the waterfall lines: one of them is a fee, not a resource.',
          },
        },
        {
          id: 'valid',
          label: 'No errors',
          check: { lint: 'valid', message: 'The issues panel still lists an error to fix.' },
        },
      ],
      solution: { compose: [{ ports: [31001], cpu: 1, ram: 2000, hdd: 20 }] },
      explain:
        'Two things were wrong: a charged port and an oversized app. Moving the public port removes the fee, and trimming CPU and disk to the floor of the brief brings the total under the budget.',
      hint: 'Look at the price waterfall for the two biggest lines. One of them is not a resource at all.',
    },
    {
      id: 'days-in-blocks',
      kind: 'estimate',
      prompt: 'About how many blocks pass in 3 days?',
      quantity: 'blocks',
      value: daysToBlocks(3),
      tolerance: 0.02,
      unit: 'blocks',
      // fact: FACTS 5.1 (30 s blocks, 2,880 a day)
      explain: `A block takes ${TARGET_BLOCK_SEC} seconds, so a day holds ${grouped(blocksPerDay())} blocks and three days hold ${grouped(daysToBlocks(3))}.`,
      hint: 'Work out blocks per day first: 24 hours of 60 minutes of 60 seconds, divided by the block time.',
    },
    {
      id: 'why-four',
      kind: 'choice',
      prompt: 'Why can a small app cost much more at four instances than at three?',
      options: [
        {
          id: 'double',
          label: 'Every instance after the third is billed at double',
          why: 'No instance is billed at double. A bigger app adds about a third of the bundle for each instance, and a cheap app adds a flat amount.',
        },
        {
          id: 'tier',
          label: 'A fourth instance has to run on a bigger node tier',
          why: 'Price follows resources and instance count. The tier of the node plays no part.',
        },
        {
          id: 'discount',
          label: `The discount ends at ${CLIFF_WORD} instances, and a cheap app pays a flat ${usd(FLAT_FEE)} for each instance after the first`,
        },
        {
          id: 'fee',
          label: 'Flux charges a redundancy fee from four instances',
          why: `No fee is added. The change comes from the discount ending and from a cheap app paying a flat ${usd(FLAT_FEE)} for each instance after the first.`,
        },
      ],
      answer: 'discount',
      // fact: FACTS 4.3 step A, D, E and 4.4
      explain: `Below ${CLIFF_WORD} instances a small app gets ${SMALL_TIER.label} off, and at three the discounted total (${usd(BELOW_CLIFF.afterMultiplierRawUsd)}) falls under the minimum and is lifted to ${usd(BAKED_PRICING.params.minUSDPrice)}. At ${CLIFF_WORD} the discount is gone, and because one instance costs under ${usd(FLAT_FEE)}, each instance after the first is billed a flat ${usd(FLAT_FEE)}: ${usd(small(CLIFF_AT))} after rounding.`,
      hint: 'Two rules change at the same count: a discount that depends on the number of instances, and a flat charge for each extra instance of a cheap app.',
    },
  ],
  recap: [
    'A price is the resource lines for a bundle of three instances, a third of it for each instance, plus fees, with a discount and a rounding step.',
    `CPU is the dearest line per unit: one core costs as much as ${PER_CORE / PER_GB_RAM} GB of RAM.`,
    `The ${CLIFF_ORDINAL} instance of a small app ends the ${SMALL_TIER.label} discount, and a cheap app is then billed a flat ${usd(FLAT_FEE)} for each instance after the first, so the price can double.`,
    `A restricted public port adds ${usd(P.port)} to the bundle, about ${usd(P.port / BUNDLE_INSTANCES)} per instance, and the cost grows with the instance count. Keep the container port and publish a free number.`,
    `A month is ${grouped(BLOCKS_PER_MONTH)} blocks of ${TARGET_BLOCK_SEC} seconds, and longer subscriptions are discounted: ${DISCOUNT_TEXT}. The total is rounded up to .49 or .99 afterwards, so compare totals: for a small app the rounding can swallow the saving.`,
  ],
  further: [
    {
      label: 'FluxCloud docs: the cost calculator',
      url: 'https://docs.runonflux.com/fluxcloud/cost-calculator',
    },
    {
      label: 'FluxCloud docs: components, ports and resources',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
    },
    {
      label: 'FluxCloud docs: subscription, renewal and updates',
      url: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/subscription',
    },
  ],
  terms: [
    'price-quote',
    'flux-multiplier',
    'minimum-price',
    'small-app-discount',
    'port-fee',
    'duration-discount',
  ],
};

export default lesson;
