import { useMemo } from 'react';
import { hexPath } from '@/lib/hex';
import { INTRO_TIMING, type IntroPhase } from './intro';
import styles from './intro.module.css';
import { MARK_SHARDS, MARK_VIEWBOX } from './mark';

/** Where each shard comes from, as a direction (a unit-ish vector) and a turn in degrees. */
const FROM: ReadonlyArray<{ x: number; y: number; r: number }> = [
  { x: 0.55, y: 1.15, r: 24 },
  { x: -0.2, y: -1.25, r: -14 },
  { x: 1.15, y: 0.2, r: 18 },
  { x: -1.2, y: 0.45, r: -26 },
];

const RINGS = 6;
const CELL = 38;

interface Cell {
  d: string;
  delay: number;
}

/** Axial hexagon coordinates within `RINGS` of the centre, each with its ignition delay (ms). */
function latticeCells(): Cell[] {
  const out: Cell[] = [];
  for (let q = -RINGS; q <= RINGS; q++) {
    for (let r = -RINGS; r <= RINGS; r++) {
      const s = -q - r;
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      if (ring > RINGS) continue;
      const x = CELL * Math.sqrt(3) * (q + r / 2);
      const y = CELL * 1.5 * r;
      // A touch of jitter so the front is not a perfect ring.
      const jitter = ((q * 73856093) ^ (r * 19349663)) % 40;
      out.push({ d: hexPath(x, y, CELL * 0.94), delay: 70 + ring * 70 + Math.abs(jitter) });
    }
  }
  return out;
}

/**
 * The first-visit intro, about 1.6 s: black, hex cells ignite from the centre, the four shards of the
 * Flux symbol lock into place, one white flash, and the page resolves underneath. It is decoration over
 * a page that is already complete: `aria-hidden`, no pointer events, gone in a fixed time, skipped by
 * any key, click or scroll (see `intro.ts`).
 */
export function Intro({ phase }: { phase: IntroPhase }) {
  const cells = useMemo(latticeCells, []);
  if (phase === 'off' || phase === 'done') return null;
  const scale = 150 / MARK_VIEWBOX.h;
  return (
    <div
      className={styles.intro}
      data-phase={phase}
      aria-hidden="true"
      style={
        {
          '--reveal': `${INTRO_TIMING.reveal}ms`,
          '--end': `${INTRO_TIMING.end}ms`,
        } as React.CSSProperties
      }
    >
      <svg
        className={styles.svg}
        viewBox="-640 -360 1280 720"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
        role="presentation"
        aria-hidden="true"
      >
        <title>Flux mark assembling</title>
        <g className={styles.lattice}>
          {cells.map((c) => (
            <path key={c.d} d={c.d} className={styles.cell} style={{ animationDelay: `${c.delay}ms` }} />
          ))}
        </g>
        <g
          className={styles.mark}
          transform={`translate(${(-MARK_VIEWBOX.w * scale) / 2} ${(-MARK_VIEWBOX.h * scale) / 2}) scale(${scale})`}
        >
          {MARK_SHARDS.map((s, i) => {
            const f = FROM[i] ?? { x: 0, y: 0, r: 0 };
            return (
              <g
                // biome-ignore lint/suspicious/noArrayIndexKey: four fixed shards of one mark
                key={i}
                className={styles.shard}
                style={
                  {
                    '--fx': `${f.x * 190}px`,
                    '--fy': `${f.y * 190}px`,
                    '--fr': `${f.r}deg`,
                    animationDelay: `${470 + i * 70}ms`,
                  } as React.CSSProperties
                }
              >
                <path d={s.d} transform={s.transform} fill="#fff" />
              </g>
            );
          })}
        </g>
      </svg>
      <div className={styles.flash} />
    </div>
  );
}
