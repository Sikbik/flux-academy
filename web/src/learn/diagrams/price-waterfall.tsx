/**
 * FIG: how a monthly price is built, as a waterfall over a `Quote`. CPU, RAM and disk add up to a bundle price
 * for three instances, flat add-ons join it, the bundle is split into a share per instance and each instance
 * adds a share (a cheap app pays a flat rate for each instance after the first), then the floor, the length
 * and the small-app rules adjust it and the price rounds up to .49 or .99.
 * The bars are the quote's own `lines`, so the figure always agrees with the engine. FACTS 4.3 and 4.4.
 *
 * Beats follow the order of the quote lines, which differs from the catalog: add-ons come before the
 * instances beat because the formula adds them to the bundle before it divides by three (FACTS 4.3 step A).
 *
 * Props: `quote` (a `Quote` from `@shared/flux`) or `fixture` (a fixture id, quoted with the baked rates).
 * Without either it shows the `minecraft` fixture.
 */

import {
  BAKED_PRICING,
  BUNDLE_INSTANCES,
  EXTRA_INSTANCE_FLOOR_USD,
  FIXTURES,
  quote as makeQuote,
  type Quote,
} from '@shared/flux';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { monoWidth, pt } from './_kit/geometry';
import { Badge, Line, Slab, Txt } from './_kit/parts';
import { isRecord, str } from './_kit/props';

export const meta: DiagramMeta = {
  id: 'price-waterfall',
  title: 'How a monthly price is built',
  beats: [
    'CPU is priced per core. The rate is stated for a bundle of three instances.',
    'RAM is priced per gigabyte, at the same bundle rate.',
    'Disk is priced per gigabyte of volume, also at the bundle rate.',
    'Flat add-ons join the bundle: a static IP, pinned nodes or an enterprise app, and restricted ports.',
    `Each instance adds a share of the bundle. From ${BUNDLE_INSTANCES + 1} instances a cheap app pays a flat USD ${EXTRA_INSTANCE_FLOOR_USD.toFixed(2)} for each one after the first.`,
    'The minimum price, the length of the subscription and the small-app rule adjust it. It rounds up to .49 or .99.',
    'The total is the price for the subscription. Paying in FLUX takes 5 percent off the dollar figure.',
  ],
  alt:
    'A waterfall of how a price is built. Bars for CPU, RAM and disk stack up to a bundle price for three ' +
    'instances. Flat add-ons are added, then the bundle is split into a share per instance and each instance ' +
    'adds a share, with a flat rate for each extra instance of a cheap app. Adjustments follow: the minimum price, the subscription length, the ' +
    'small-app discount and the rounding up to .49 or .99. The last bar is the total price.',
};

const WIDE_MIN = 560;

interface Row {
  kind: 'step' | 'subtotal' | 'total';
  group: number;
  label: string;
  detail?: string;
  /** Signed change in dollars (steps). */
  delta?: number;
  /** Running total after this row, in dollars. */
  after: number;
  /** Running total before this row. */
  before: number;
  note?: string;
}

/** Short names for the adjustment lines, with the figure after the comma in the engine's label as detail. */
const SHORT: Record<string, string> = {
  minimum: 'MONTHLY MINIMUM',
  duration: 'LENGTH',
  credit: 'UNUSED TIME CREDIT',
  'hw-discount': 'SMALL APP',
  marketplace: 'MARKETPLACE',
  'minimum-final': 'MINIMUM PRICE',
  'duration-discount': 'LONG SUBSCRIPTION',
  rounding: 'ROUNDED UP',
};

function adjustLabel(id: string, label: string): { label: string; detail?: string } {
  const tail = label.includes(',') ? label.slice(label.lastIndexOf(',') + 1).trim() : undefined;
  if (id === 'rounding') return { label: SHORT.rounding as string, detail: 'to .49 or .99' };
  if (id === 'hw-discount' || id === 'duration-discount' || id === 'duration') {
    return { label: SHORT[id] as string, detail: tail };
  }
  return { label: SHORT[id] ?? label.toUpperCase() };
}

const cents = (n: number): number => Math.round(n * 100);
const dollars = (c: number): number => c / 100;
const money = (n: number): string => `$${n.toFixed(2)}`;
const signed = (n: number): string => `${n < 0 ? '-' : '+'}${money(Math.abs(n))}`;

function isQuote(v: unknown): v is Quote {
  if (!isRecord(v)) return false;
  if (typeof v.usdPerMonth !== 'number' || !Array.isArray(v.lines)) return false;
  return v.lines.every((l) => isRecord(l) && typeof l.id === 'string' && typeof l.usd === 'number');
}

function pickQuote(props: Record<string, unknown> | undefined): Quote {
  if (isQuote(props?.quote)) return props.quote;
  const fixtureId = str(props?.fixture, 'minecraft', 24);
  const fx =
    FIXTURES.find((f) => f.id === fixtureId) ?? FIXTURES.find((f) => f.id === 'minecraft') ?? FIXTURES[0];
  return makeQuote(fx!.spec, BAKED_PRICING.params, { fluxUsd: 0.085 });
}

const sum = (q: Quote, ids: readonly string[]): number =>
  q.lines.filter((l) => ids.includes(l.id)).reduce((a, l) => a + l.usd, 0);

/** Sum the numbers in labels such as "CPU, 2 cores" across components. */
function totalFromLabels(q: Quote, id: string, re: RegExp): number {
  let n = 0;
  for (const l of q.lines) {
    if (l.id !== id) continue;
    const m = l.label.match(re);
    if (m?.[1]) n += Number(m[1].replace(/,/g, ''));
  }
  return n;
}

function buildRows(q: Quote): Row[] {
  const cores = totalFromLabels(q, 'cpu', /CPU, ([\d.,]+)/);
  const ramMb = totalFromLabels(q, 'ram', /RAM, ([\d.,]+)/);
  const diskGb = totalFromLabels(q, 'hdd', /Disk, ([\d.,]+)/);
  const parts: { group: number; label: string; detail: string; usd: number; note?: string }[] = [
    {
      group: 0,
      label: 'CPU',
      detail: `${cores} ${cores === 1 ? 'core' : 'cores'}`,
      usd: sum(q, ['cpu']),
      note: q.lines.find((l) => l.id === 'cpu')?.note,
    },
    {
      group: 1,
      label: 'RAM',
      detail: `${ramMb.toLocaleString('en-US')} MB`,
      usd: sum(q, ['ram']),
      note: q.lines.find((l) => l.id === 'ram')?.note,
    },
    {
      group: 2,
      label: 'DISK',
      detail: `${diskGb.toLocaleString('en-US')} GB`,
      usd: sum(q, ['hdd']),
      note: q.lines.find((l) => l.id === 'hdd')?.note,
    },
  ];
  const addIds = ['staticip', 'scope', 'ports'];
  const adds = q.lines.filter((l) => addIds.includes(l.id));
  parts.push({
    group: 3,
    label: 'ADD-ONS',
    detail: adds.length ? adds.map((l) => l.label.toLowerCase()).join(', ') : 'none',
    usd: sum(q, addIds),
    note: adds[0]?.note ?? 'No static IP, pinned nodes, enterprise app or restricted ports in this app.',
  });

  const rows: Row[] = [];
  let run = 0;
  const push = (r: Omit<Row, 'before' | 'after' | 'kind'>) => {
    const before = run;
    run = cents(dollars(run) + (r.delta ?? 0));
    rows.push({ ...r, kind: 'step', before: dollars(before), after: dollars(run) });
  };
  for (const p of parts) {
    push({ group: p.group, label: p.label, detail: p.detail, delta: dollars(cents(p.usd)), note: p.note });
  }
  // Subtotal for three instances, then the instance step.
  rows.push({ kind: 'subtotal', group: 4, label: 'BUNDLE OF THREE', before: 0, after: dollars(run) });
  const inst = q.lines.find((l) => l.id === 'instances');
  const n = q.instances ?? 3;
  push({
    group: 4,
    label: `${n} ${n === 1 ? 'INSTANCE' : 'INSTANCES'}`,
    detail: inst?.note?.includes('flat') ? 'flat rate after the first' : `${n} x a third`,
    delta: dollars(cents(inst?.usd ?? 0)),
    note: inst?.note,
  });

  // Adjustments: everything that is not a resource, add-on or the instance step, in order.
  const used = new Set([...addIds, 'cpu', 'ram', 'hdd', 'instances']);
  const rest = q.lines.filter((l) => !used.has(l.id));
  const shown = rest.slice(0, 3);
  const extra = rest.slice(3);
  for (const l of shown) {
    const a = adjustLabel(l.id, l.label);
    push({
      group: 5,
      label: a.label,
      detail: a.detail,
      delta: dollars(cents(l.usd)),
      note: l.note,
    });
  }
  if (extra.length) {
    push({
      group: 5,
      label: 'OTHER ADJUSTMENTS',
      delta: dollars(cents(extra.reduce((a, l) => a + l.usd, 0))),
    });
  }
  if (rest.length === 0) {
    rows.push({
      kind: 'step',
      group: 5,
      label: 'NO ADJUSTMENTS',
      detail: 'the price is already above the floor',
      delta: 0,
      before: dollars(run),
      after: dollars(run),
    });
  }
  rows.push({ kind: 'total', group: 6, label: 'PER SUBSCRIPTION', before: 0, after: dollars(run) });
  return rows;
}

const PriceWaterfall: DiagramComponent = ({ beat, props, reducedMotion }: DiagramProps) => {
  const q = pickQuote(props);
  const rows = buildRows(q);
  const floor = BAKED_PRICING.params.minUSDPrice;
  const maxV = Math.max(floor * 1.4, ...rows.map((r) => Math.max(r.before, r.after)));
  const total = rows[rows.length - 1]?.after ?? 0;
  const months = q.months > 0 ? q.months : 1;
  const flux = q.fluxPerMonth;

  return (
    <DiagramRoot
      meta={meta}
      beat={beat}
      reducedMotion={reducedMotion}
      height={(W) => (W >= WIDE_MIN ? 18 + rows.length * 32 + 56 : 18 + rows.length * 40 + 60)}
    >
      {({ W, st }) => {
        const R = W - 36;
        const wide = W >= WIDE_MIN;
        const m = wide ? 24 : 12;
        const rowH = wide ? 32 : 40;
        const top = 18;
        const x0 = wide ? m + 210 : m + 4;
        const x1 = wide ? R - 90 : R - 4;
        const barX = (v: number) => x0 + ((x1 - x0) * Math.max(0, v)) / maxV;
        const floorX = barX(floor);
        const fS = st(5, 5);

        const grpFirst = new Map<number, number>();
        rows.forEach((r, i) => {
          if (!grpFirst.has(r.group)) grpFirst.set(r.group, i);
        });

        return (
          <>
            {/* the floor, as a rule on the scale */}
            <Line
              pts={[pt(floorX, top - 6), pt(floorX, top + rows.length * rowH)]}
              kind="line"
              dashed
              s={fS}
              delay={100}
            />
            <Txt
              x={floorX}
              y={top - 10}
              s={fS}
              anchor="middle"
              caps={false}
              ink="dim"
              hot={false}
              size={10}
              delay={160}
            >
              {`floor ${money(floor)}`}
            </Txt>

            {rows.map((r, i) => {
              const s = st(r.group);
              const y = top + i * rowH;
              const first = grpFirst.get(r.group) === i;
              const neg = (r.delta ?? 0) < 0;
              const isTotal = r.kind === 'total';
              const isSub = r.kind === 'subtotal';
              const a = Math.min(r.before, r.after);
              const b = Math.max(r.before, r.after);
              const bx = isTotal || isSub ? x0 : barX(a);
              const bw = Math.max(3, (isTotal || isSub ? barX(r.after) : barX(b)) - bx);
              const labelY = wide ? y + rowH / 2 : y + 10;
              const barY = wide ? y + rowH / 2 - 6 : y + 22;
              const amount = isTotal ? money(total) : isSub ? money(r.after) : signed(r.delta ?? 0);
              const probe = r.note ?? r.label.toLowerCase();
              return (
                <g
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered layout
                  key={`${r.group}-${i}`}
                >
                  {first && (
                    <Badge
                      n={r.group + 1}
                      at={pt(wide ? m + 10 : R + 18, wide ? y + rowH / 2 : y + 10)}
                      s={s}
                      delay={80}
                    />
                  )}
                  <Txt
                    x={wide ? m + 28 : m + 4}
                    y={labelY}
                    s={s}
                    ink={isTotal ? 'acc' : 'lit'}
                    semi={isTotal || isSub}
                    delay={60}
                    probe={probe}
                  >
                    {r.label}
                  </Txt>
                  {r.detail && (
                    <Txt
                      x={
                        wide
                          ? m + 28 + monoWidth(r.label, 11, 0.08) + 12
                          : m + 4 + monoWidth(r.label, 11, 0.08) + 10
                      }
                      y={labelY}
                      s={s}
                      caps={false}
                      ink="dim"
                      hot={false}
                      delay={100}
                    >
                      {r.detail}
                    </Txt>
                  )}
                  <Txt
                    x={R}
                    y={labelY}
                    s={s}
                    anchor="end"
                    caps={false}
                    ink={isTotal ? 'acc' : 'lit'}
                    semi
                    tone={neg ? 'ok' : undefined}
                    delay={140}
                  >
                    {amount}
                  </Txt>
                  <Slab
                    x={bx}
                    y={barY}
                    w={bw}
                    h={12}
                    s={s}
                    c={4}
                    cm={0}
                    wash={!isTotal && !isSub}
                    tone={neg ? 'ok' : undefined}
                    delay={120}
                    probe={probe}
                  />
                </g>
              );
            })}

            {/* the FLUX price, under the total */}
            <Txt
              x={R}
              y={top + rows.length * rowH + 14}
              s={st(6)}
              anchor="end"
              caps={false}
              ink="dim"
              hot={false}
              delay={260}
            >
              {months !== 1 ? `${months} months, ${money(total / months)} a month` : 'one month'}
            </Txt>
            {flux !== null && flux !== undefined && (
              <Txt
                x={R}
                y={top + rows.length * rowH + 32}
                s={st(6)}
                anchor="end"
                caps={false}
                ink="acc"
                hot={false}
                delay={320}
              >
                {`about ${flux.toFixed(2)} FLUX a month`}
              </Txt>
            )}
          </>
        );
      }}
    </DiagramRoot>
  );
};

export default PriceWaterfall;
