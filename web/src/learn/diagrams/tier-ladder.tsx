/**
 * FIG: the three node tiers side by side. One, two and three plates tall (shape, never colour alone),
 * each with its collateral, its node count and its nominal size; then one queue per tier to show that
 * every block pays one node of each tier, in turn. FACTS 1.4 (payees), 2.1 and 2.2 (tiers, hardware).
 *
 * Props (all optional): `counts` and `collateral` as `{ cumulus, nimbus, stratus }`, `payout` (FLUX per
 * block per tier) and `basis` ('live' | 'cache' | 'fallback'), which the stage adapter sets from the data
 * layer so the figure can say where its numbers come from. Without props it shows the 2026-10-13 sample,
 * labelled SAMPLE COUNTS (the confirmed-node counts of FACTS Snapshot "Re-read 2026-10-13").
 */

import { TARGET_BLOCK_SEC, TIER_FACTS, TIER_ORDER, type TierId } from '@shared/flux';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { group, monoWidth, pt } from './_kit/geometry';
import { Grp, Hex, kitStyles, Line, Marker, Plate, Txt } from './_kit/parts';
import { numberRecord, type Props } from './_kit/props';
import type { S } from './_kit/state';

export const meta: DiagramMeta = {
  id: 'tier-ladder',
  title: 'The three node tiers',
  beats: [
    'Cumulus: the smallest node and the smallest collateral. Small apps tend to land on these.',
    'Nimbus: a mid-size node, with more collateral and more hardware than Cumulus.',
    'Stratus: the largest node, with the most collateral. The biggest apps need these.',
    'Every block pays one node of each tier, in turn. More collateral earns a bigger payout per turn.',
  ],
  alt:
    'Three towers of one, two and three plates for the Cumulus, Nimbus and Stratus tiers, each labelled with its ' +
    'collateral in FLUX, its number of nodes and its size. A fourth view shows a queue of nodes per tier: each block ' +
    'pays the node at the front of every queue, then sends it to the back.',
};

/**
 * Counts used when the lesson passes none: the daemon's confirmed-node counts of 2026-10-13 (FACTS Snapshot,
 * "Re-read 2026-10-13": 7,075 nodes). Labelled SAMPLE COUNTS on the figure.
 */
const SAMPLE_COUNTS: Record<TierId, number> = { cumulus: 3584, nimbus: 1664, stratus: 1827 };

/** Nominal node size per tier (FluxOS config, FACTS 2.2): threads, RAM in GB, SSD in GB. */
const SIZE: Record<TierId, { threads: number; ramGb: number; ssdGb: number }> = {
  cumulus: { threads: 4, ramGb: 7, ssdGb: 220 },
  nimbus: { threads: 8, ramGb: 30, ssdGb: 440 },
  stratus: { threads: 16, ramGb: 61, ssdGb: 880 },
};

const QUEUE = 6;

interface Data {
  counts: Record<TierId, number>;
  collateral: Record<TierId, number>;
  payout: Record<TierId, number>;
  basis: 'live' | 'cache' | 'fallback';
}

function readData(props: Props): Data {
  const counts = numberRecord(props?.counts, TIER_ORDER, SAMPLE_COUNTS);
  const collateral = numberRecord(props?.collateral, TIER_ORDER, {
    cumulus: TIER_FACTS.cumulus.collateralFlux,
    nimbus: TIER_FACTS.nimbus.collateralFlux,
    stratus: TIER_FACTS.stratus.collateralFlux,
  });
  const payout = numberRecord(props?.payout, TIER_ORDER, {
    cumulus: TIER_FACTS.cumulus.payoutPerBlockFlux,
    nimbus: TIER_FACTS.nimbus.payoutPerBlockFlux,
    stratus: TIER_FACTS.stratus.payoutPerBlockFlux,
  });
  const b = props?.basis;
  return { counts, collateral, payout, basis: b === 'live' || b === 'cache' ? b : 'fallback' };
}

const BASIS_LABEL = { live: 'LIVE COUNTS', cache: 'CACHED COUNTS', fallback: 'SAMPLE COUNTS' } as const;

const payoutLabel = (n: number): string => `+${Number.isInteger(n) ? n : n.toFixed(1)} FLUX`;

const probeOf = (id: TierId, d: Data): string => {
  const z = SIZE[id];
  return `${TIER_FACTS[id].name}: ${group(d.collateral[id])} FLUX locked, ${group(d.counts[id])} nodes, about ${z.threads} threads, ${z.ramGb} GB RAM, ${z.ssdGb} GB SSD`;
};

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

const ROW_H = 108;
const ROW_TOP = 44;

function narrowH(): number {
  return ROW_TOP + 3 * ROW_H + 22;
}

interface WideGeo {
  mx: number;
  colW: number;
  pw: number;
  ph: number;
  pitch: number;
  base: number;
  nameY: number;
  H: number;
}

function wideGeo(W: number): WideGeo {
  const mx = 18;
  const colW = (W - mx * 2) / 3;
  const pw = Math.min(colW - 30, 168);
  const ph = pw * 0.3;
  const pitch = ph * 0.66;
  const base = 112 + 2 * pitch + ph / 2;
  const nameY = base + ph / 2 + 7 + 22;
  return { mx, colW, pw, ph, pitch, base, nameY, H: nameY + 142 };
}

const TierLadder: DiagramComponent = ({ beat, props, reducedMotion }: DiagramProps) => {
  const data = readData(props);
  return (
    <DiagramRoot
      meta={meta}
      beat={beat}
      reducedMotion={reducedMotion}
      height={(W, narrow) => (narrow ? narrowH() : wideGeo(W).H)}
    >
      {({ W, narrow, st }) => {
        const sBlock = st(3);

        if (narrow) {
          const textX = 112;
          const towerX = 66;
          const pw = 70;
          const ph = 25;
          const pitch = 15;
          const gx = 16;
          return (
            <>
              <Marker n={4} anchor={pt(towerX - 12, 20)} at={pt(gx, 20)} s={sBlock} />
              <Hex
                cx={towerX}
                cy={20}
                r={9}
                s={sBlock}
                wash
                probe={`One block, about every ${TARGET_BLOCK_SEC} seconds`}
              />
              <Txt x={towerX + 18} y={20} s={sBlock} ink="lit" semi>
                BLOCK
              </Txt>
              {TIER_ORDER.map((id, k) => {
                const f = TIER_FACTS[id];
                const s = st(k);
                const y0 = ROW_TOP + k * ROW_H;
                const baseY = y0 + 74;
                const n = k + 1;
                const z = SIZE[id];
                const num = group(data.collateral[id]);
                return (
                  <g key={id}>
                    {Array.from({ length: n }, (_, p) => (
                      <Plate
                        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered layout
                        key={`${id}-${p}`}
                        cx={towerX}
                        cy={baseY - p * pitch}
                        w={pw}
                        h={ph}
                        t={5}
                        tier={id}
                        s={s}
                        delay={p * 70}
                        probe={probeOf(id, data)}
                      />
                    ))}
                    <Txt x={textX} y={y0 + 12} s={s} tier={id} ink="acc" semi>
                      {f.name.toUpperCase()}
                    </Txt>
                    <Txt x={textX} y={y0 + 38} s={s} disp size={26} caps={false} ink="lit">
                      {num}
                    </Txt>
                    <Txt x={textX + monoWidth(num, 26, 0) + 8} y={y0 + 41} s={s} ink="dim" hot={false}>
                      FLUX
                    </Txt>
                    <Txt x={textX} y={y0 + 60} s={s} caps={false} ink="lit" hot={false}>
                      {`${group(data.counts[id])} nodes, ${z.threads} threads`}
                    </Txt>
                    <Txt x={textX} y={y0 + 76} s={s} caps={false} ink="dim" hot={false}>
                      {`${z.ramGb} GB RAM, ${z.ssdGb} GB SSD`}
                    </Txt>
                    <Marker
                      n={n}
                      anchor={pt(towerX - pw / 2 + 5, baseY - (n - 1) * pitch)}
                      at={pt(gx, baseY - (n - 1) * pitch - 6)}
                      s={s}
                      delay={120}
                    />
                    <Queue
                      x={textX + 4}
                      y={y0 + 96}
                      id={id}
                      s={sBlock}
                      label={payoutLabel(data.payout[id])}
                      slot={14}
                      size={4.5}
                      labelX={textX + 4 + QUEUE * 14 + 2}
                    />
                  </g>
                );
              })}
              <Txt x={14} y={narrowH() - 8} s={st(0)} caps={false} ink="dim" hot={false} size={11}>
                {BASIS_LABEL[data.basis].toLowerCase()}
              </Txt>
            </>
          );
        }

        const g = wideGeo(W);
        const cxOf = (k: number) => g.mx + g.colW * (k + 0.5);
        const blockY = 18;
        const queueY = 70;
        return (
          <>
            <Hex
              cx={W / 2}
              cy={blockY}
              r={10}
              s={sBlock}
              wash
              probe={`One block, about every ${TARGET_BLOCK_SEC} seconds`}
            />
            <Txt x={W / 2 + 18} y={blockY} s={sBlock} ink="lit" semi>
              BLOCK
            </Txt>
            <Marker n={4} anchor={pt(W / 2 - 9, blockY)} at={pt(W / 2 - 60, blockY)} s={sBlock} />
            {TIER_ORDER.map((id, k) => {
              const f = TIER_FACTS[id];
              const s = st(k);
              const x = cxOf(k);
              const n = k + 1;
              const z = SIZE[id];
              const num = group(data.collateral[id]);
              const slot = Math.min(20, (g.colW - 40) / QUEUE);
              const qx = x - ((QUEUE - 1) * slot) / 2;
              return (
                <g key={id}>
                  <Line
                    pts={[
                      pt(W / 2, blockY + 11),
                      pt(W / 2, blockY + 26),
                      pt(x, blockY + 26),
                      pt(x, queueY - 12),
                    ]}
                    kind="line"
                    flow
                    s={sBlock}
                    delay={80 + k * 60}
                  />
                  <Queue
                    x={qx}
                    y={queueY}
                    id={id}
                    s={sBlock}
                    label={payoutLabel(data.payout[id])}
                    slot={slot}
                    size={5.5}
                    labelX={x}
                    labelY={queueY + 22}
                    center
                  />
                  {Array.from({ length: n }, (_, p) => (
                    <Plate
                      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered layout
                      key={`${id}-${p}`}
                      cx={x}
                      cy={g.base - p * g.pitch}
                      w={g.pw}
                      h={g.ph}
                      t={7}
                      tier={id}
                      s={s}
                      delay={p * 80}
                      probe={probeOf(id, data)}
                    />
                  ))}
                  <Txt x={x} y={g.nameY} s={s} tier={id} anchor="middle" ink="acc" semi>
                    {f.name.toUpperCase()}
                  </Txt>
                  <Txt x={x} y={g.nameY + 34} s={s} anchor="middle" disp size={32} caps={false} ink="lit">
                    {num}
                  </Txt>
                  <Txt x={x} y={g.nameY + 58} s={s} anchor="middle" ink="dim" hot={false}>
                    FLUX LOCKED
                  </Txt>
                  <Txt x={x} y={g.nameY + 84} s={s} anchor="middle" caps={false} ink="lit" hot={false}>
                    {`${group(data.counts[id])} nodes`}
                  </Txt>
                  <Txt x={x} y={g.nameY + 101} s={s} anchor="middle" caps={false} ink="dim" hot={false}>
                    {`${z.threads} threads, ${z.ramGb} GB RAM`}
                  </Txt>
                  <Txt x={x} y={g.nameY + 117} s={s} anchor="middle" caps={false} ink="dim" hot={false}>
                    {`${z.ssdGb} GB SSD`}
                  </Txt>
                  <Marker
                    n={n}
                    anchor={pt(x + g.pw / 2 - 6, g.base - (n - 1) * g.pitch)}
                    at={pt(Math.min(x + g.pw / 2 + 24, W - 16), g.base - (n - 1) * g.pitch - 24)}
                    s={s}
                    delay={120}
                  />
                </g>
              );
            })}
            <Txt x={W - 14} y={14} s={st(0)} anchor="end" ink="dim" hot={false}>
              {BASIS_LABEL[data.basis]}
            </Txt>
          </>
        );
      }}
    </DiagramRoot>
  );
};

/**
 * A row of node dots. While the queue is the focus a ring steps along it, one node per block; the
 * paid node goes to the back (the dots are all alike, so the walk along the row is the story).
 */
function Queue({
  x,
  y,
  id,
  s,
  label,
  slot,
  size,
  labelX,
  labelY,
  center,
}: {
  x: number;
  y: number;
  id: TierId;
  s: S;
  label: string;
  slot: number;
  size: number;
  labelX: number;
  labelY?: number;
  center?: boolean;
}) {
  return (
    <>
      <Grp s={s} tier={id}>
        <g style={{ ['--n' as string]: QUEUE }}>
          {Array.from({ length: QUEUE }, (_, i) => {
            const cx = x + i * slot;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length queue
              <g key={i}>
                <circle
                  className={`${kitStyles.fill} ${kitStyles.solid}`}
                  cx={cx}
                  cy={y}
                  r={size - 1.5}
                  opacity={0.55}
                />
                <circle
                  className={kitStyles.qlit}
                  cx={cx}
                  cy={y}
                  r={size + 1.5}
                  style={{ ['--i' as string]: i }}
                />
              </g>
            );
          })}
        </g>
      </Grp>
      <Txt
        x={labelX}
        y={labelY ?? y}
        s={s}
        tier={id}
        ink="acc"
        semi
        caps={false}
        hot={false}
        anchor={center ? 'middle' : 'start'}
      >
        {label}
      </Txt>
    </>
  );
}

export default TierLadder;
