/**
 * FIG: how Flux counts time. Four scales on one ladder: a block (about 30 s), a day, a month and a
 * subscription. All four are drawn from the start and the beats move the focus down the ladder, so a lesson
 * that shows beat 0 still sees the whole idea. FACTS 5.1 (30 s blocks, 88,000 per month), 5.2 (expire is
 * counted from the latest register or update message) and 5.4 (no grace after expiry).
 *
 * Props: `blockSec` (measured block interval, default 30; the stage adapter passes the live mean) and
 * `expire` (subscription length in blocks, default 88,000, at most 1,056,000).
 */

import {
  BLOCKS_PER_MONTH,
  blocksPerDay,
  blocksToSeconds,
  humanDuration,
  MAX_EXPIRE_BLOCKS,
  TARGET_BLOCK_SEC,
} from '@shared/flux';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { group, monoWidth, pt } from './_kit/geometry';
import { Dim, Line, Marker, Ruler, Slab, Txt } from './_kit/parts';
import { num } from './_kit/props';

export const meta: DiagramMeta = {
  id: 'block-clock',
  title: 'Time, counted in blocks',
  beats: [
    `A new block arrives about every ${TARGET_BLOCK_SEC} seconds, so 60 blocks make half an hour.`,
    'A day is about 2,880 blocks.',
    'A subscription month is 88,000 blocks, a little over 30 days.',
    'A subscription ends at its latest registration or update block plus its length. There is no grace after that.',
  ],
  alt:
    `Four time scales on one ladder. First, a ruler of 60 blocks, one tick per block about ${TARGET_BLOCK_SEC} seconds apart, which is ` +
    'half an hour. Second, a ruler of one day marked every hour: about 2,880 blocks. Third, a ruler of 31 days with ' +
    'a bracket over the first 88,000 blocks, the pricing month, which lasts a little over 30 days. Fourth, a ' +
    'subscription bar that runs from the registration block to that block plus its length in blocks, with a wall at ' +
    'its end where the app and its data are removed, and a second bar that restarts when an update is sent.',
};

const RH = 88;
const TOP = 6;
const LAST_H = 116;
const HALF_HOUR = 1800;
const DAY = 86_400;

/** "30 min", "6 h", "10 d": the short unit labels on the rulers. */
function span(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172_800) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / DAY)} d`;
}

const BlockClock: DiagramComponent = ({ beat, props, reducedMotion }: DiagramProps) => {
  const blockSec = num(props?.blockSec, TARGET_BLOCK_SEC, 5, 600);
  const expire = Math.round(num(props?.expire, BLOCKS_PER_MONTH, 1, MAX_EXPIRE_BLOCKS));
  const perDay = blocksPerDay(blockSec);
  const monthDays = blocksToSeconds(BLOCKS_PER_MONTH, blockSec) / DAY;
  const blocksHalfHour = Math.max(2, Math.round(HALF_HOUR / blockSec));

  return (
    <DiagramRoot meta={meta} beat={beat} reducedMotion={reducedMotion} height={() => TOP + 3 * RH + LAST_H}>
      {({ W, st }) => {
        const x0 = 16;
        const x1 = W - 40;
        const len = x1 - x0;
        const xM = W - 17;
        // A hair under the true pitch so the last tick is never lost to rounding.
        const eps = 0.99999;

        const row = (k: number) => TOP + k * RH;
        const baseY = (k: number) => row(k) + 58;

        // Row 0: half an hour of blocks, one tick per block (every second one when they would crowd).
        const pitch0 = len / blocksHalfHour;
        const every0 = pitch0 < 4 ? 2 : 1;
        const ticks0 = pitch0 * every0 * eps;
        const major0 = Math.max(1, Math.round(10 / every0));
        const labelCount0 = Math.floor(blocksHalfHour / 10);

        // Row 1: a day, one tick per hour. Row 2: 31 days, one tick per day.
        const step1 = (len / 24) * eps;
        const step2 = (len / 31) * eps;
        const monthEnd = x0 + (len * monthDays) / 31;

        // Row 3: the subscription, its end, and the restart an update gives.
        const L1 = len / 1.7;
        const restartAt = x0 + L1 * 0.6;
        const bar2End = Math.min(x1, restartAt + L1);
        const y3 = row(3);
        const lifetime = humanDuration(blocksToSeconds(expire, blockSec));

        const s = [st(0, 0), st(0, 1), st(0, 2), st(0, 3)] as const;

        return (
          <>
            {/* 1: one block, half an hour */}
            <Txt x={x0} y={row(0) + 7} s={s[0]} ink="lit" semi>
              1 BLOCK
            </Txt>
            <Txt x={x1} y={row(0) + 7} s={s[0]} anchor="end" caps={false} ink="dim" hot={false} delay={160}>
              {`about ${Math.round(blockSec)} s apart`}
            </Txt>
            <Dim
              a={pt(x0, baseY(0))}
              b={pt(x1, baseY(0))}
              offset={22}
              label={`${blocksHalfHour} BLOCKS = ${span(blocksHalfHour * blockSec).toUpperCase()}`}
              s={s[0]}
              delay={100}
            />
            <Ruler
              a={pt(x0, baseY(0))}
              b={pt(x1, baseY(0))}
              step={ticks0}
              major={major0}
              len={3.5}
              s={s[0]}
            />
            {Array.from({ length: labelCount0 + 1 }, (_, i) => {
              if (i % 2 === 1 && len < 360) return null;
              const x = x0 + (len * i * 10) / blocksHalfHour;
              return (
                <Txt
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered layout
                  key={`l0-${i}`}
                  x={Math.min(x, x1)}
                  y={baseY(0) + 20}
                  s={s[0]}
                  anchor={i === 0 ? 'start' : 'middle'}
                  caps={false}
                  ink="dim"
                  hot={false}
                  delay={120 + i * 20}
                >
                  {i === 0 ? '0' : span(i * 10 * blockSec)}
                </Txt>
              );
            })}
            <Marker n={1} anchor={pt(x1 + 4, baseY(0))} at={pt(xM, baseY(0))} s={s[0]} delay={200} />

            {/* 2: one day */}
            <Txt x={x0} y={row(1) + 7} s={s[1]} ink="lit" semi>
              1 DAY
            </Txt>
            <Dim
              a={pt(x0, baseY(1))}
              b={pt(x1, baseY(1))}
              offset={22}
              label={`${group(perDay)} BLOCKS = 1 DAY`}
              s={s[1]}
              delay={100}
            />
            <Ruler a={pt(x0, baseY(1))} b={pt(x1, baseY(1))} step={step1} major={6} len={3.5} s={s[1]} />
            {[0, 6, 12, 18, 24].map((h) => (
              <Txt
                key={`l1-${h}`}
                x={x0 + (len * h) / 24}
                y={baseY(1) + 20}
                s={s[1]}
                anchor={h === 0 ? 'start' : 'middle'}
                caps={false}
                ink="dim"
                hot={false}
                delay={120 + h * 6}
              >
                {h === 0 ? '0' : `${h} h`}
              </Txt>
            ))}
            <Marker n={2} anchor={pt(x1 + 4, baseY(1))} at={pt(xM, baseY(1))} s={s[1]} delay={200} />

            {/* 3: one pricing month */}
            <Txt x={x0} y={row(2) + 7} s={s[2]} ink="lit" semi>
              1 MONTH
            </Txt>
            <Txt x={x1} y={row(2) + 7} s={s[2]} anchor="end" caps={false} ink="dim" hot={false} delay={160}>
              {`${monthDays.toFixed(1)} days, not 30`}
            </Txt>
            <Dim
              a={pt(x0, baseY(2))}
              b={pt(monthEnd, baseY(2))}
              offset={22}
              label={`${group(BLOCKS_PER_MONTH)} BLOCKS`}
              s={s[2]}
              delay={100}
            />
            <Ruler a={pt(x0, baseY(2))} b={pt(x1, baseY(2))} step={step2} major={10} len={3.5} s={s[2]} />
            {[0, 10, 20, 30].map((d) => (
              <Txt
                key={`l2-${d}`}
                x={x0 + (len * d) / 31}
                y={baseY(2) + 20}
                s={s[2]}
                anchor={d === 0 ? 'start' : 'middle'}
                caps={false}
                ink="dim"
                hot={false}
                delay={120 + d * 6}
              >
                {d === 0 ? '0' : `${d} d`}
              </Txt>
            ))}
            <Marker n={3} anchor={pt(x1 + 4, baseY(2))} at={pt(xM, baseY(2))} s={s[2]} delay={200} />

            {/* 4: a subscription, its end and a restart */}
            <Txt x={x0} y={y3 + 7} s={s[3]} ink="lit" semi>
              A SUBSCRIPTION
            </Txt>
            <Txt x={x1} y={y3 + 7} s={s[3]} anchor="end" caps={false} ink="dim" hot={false} delay={160}>
              {lifetime}
            </Txt>
            <Slab
              x={x0}
              y={y3 + 24}
              w={L1}
              h={24}
              s={s[3]}
              c={6}
              cm={2}
              wash
              probe="The subscription, counted from the block of the latest registration or update"
            >
              <Txt bare x={x0 + 10} y={y3 + 36} caps={false} ink="lit" hot={false}>
                {`${group(expire)} blocks`}
              </Txt>
            </Slab>
            <Txt x={x0} y={y3 + 62} s={s[3]} caps={false} ink="dim" hot={false} delay={160}>
              H
            </Txt>
            <Line
              pts={[pt(x0 + L1, y3 + 16), pt(x0 + L1, y3 + 58)]}
              kind="ann"
              strong
              tone="crit"
              s={s[3]}
              delay={240}
            />
            <Txt x={x0 + L1 + 9} y={y3 + 30} s={s[3]} tone="crit" ink="lit" hot={false} delay={320}>
              NO GRACE
            </Txt>
            <Txt x={x0 + L1 + 9} y={y3 + 48} s={s[3]} caps={false} ink="dim" hot={false} delay={360}>
              {`at H + ${group(expire)}`}
            </Txt>
            <Line pts={[pt(restartAt, y3 + 50), pt(restartAt, y3 + 80)]} kind="ann" s={s[3]} delay={300} />
            <Txt x={restartAt - 8} y={y3 + 66} s={s[3]} anchor="end" ink="dim" hot={false} delay={340}>
              UPDATE
            </Txt>
            <Slab
              x={restartAt}
              y={y3 + 80}
              w={Math.max(20, bar2End - restartAt)}
              h={22}
              s={s[3]}
              c={5}
              cm={2}
              quiet
              delay={340}
              probe="An update restarts the count from the update's own block"
            >
              <Txt bare x={restartAt + 10} y={y3 + 91} caps={false} ink="dim" hot={false}>
                a new count
              </Txt>
            </Slab>
            <Marker
              n={4}
              anchor={pt(x0 + L1 + 9 + monoWidth('NO GRACE', 11, 0.08) + 8, y3 + 30)}
              at={pt(xM, y3 + 30)}
              s={s[3]}
              delay={200}
            />
          </>
        );
      }}
    </DiagramRoot>
  );
};

export default BlockClock;
