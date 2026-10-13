/**
 * The same app priced at 1 to 10 instances. The current count is marked, a press on a point sets it, and
 * the cliff is drawn where it is: a small app loses its 10 or 20 percent discount at the fourth instance, so
 * the line steps up there and the chart says why.
 */

import { type CSSProperties, useId, useMemo } from 'react';
import type { CurvePoint } from '../model';
import { money } from '../model/format';
import styles from './reactor.module.css';

const W = 320;
const H = 96;
const PAD = { l: 8, r: 8, t: 14, b: 22 };

export function PriceCurve({
  points,
  instances,
  onPick,
  locked,
}: {
  points: readonly CurvePoint[];
  instances: number;
  onPick?: (n: number) => void;
  locked?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const geometry = useMemo(() => {
    const max = Math.max(...points.map((p) => p.usdPerMonth), 0.01);
    const x = (n: number) => PAD.l + ((n - 1) / Math.max(1, points.length - 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
    const path = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.instances).toFixed(1)} ${y(p.usdPerMonth).toFixed(1)}`)
      .join(' ');
    const area = `${path} L${x(points.length)} ${H - PAD.b} L${x(1)} ${H - PAD.b} Z`;
    // The cliff: the first point after a discounted one that is not discounted.
    let cliff: { n: number; from: number; to: number } | null = null;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (a?.discounted && b && !b.discounted) {
        cliff = { n: b.instances, from: a.usdPerMonth, to: b.usdPerMonth };
        break;
      }
    }
    return { x, y, path, area, cliff, max };
  }, [points]);

  const current = points.find((p) => p.instances === instances);
  const { x, y } = geometry;

  return (
    <figure className={styles.curve}>
      <figcaption className={styles.sectionTitle}>Price against instances</figcaption>
      <div className={styles.curveBox}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.curveSvg}
          role="img"
          aria-label={`Monthly price for 1 to ${points.length} instances. ${current ? `At ${instances} it is $${money(current.usdPerMonth)}.` : ''}`}
        >
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'rgb(var(--accent-rgb) / 0.35)' }} />
              <stop offset="1" style={{ stopColor: 'rgb(var(--accent-rgb) / 0)' }} />
            </linearGradient>
          </defs>
          {/* baseline and instance ticks */}
          <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className={styles.curveAxis} />
          {points.map((p) => (
            <g key={p.instances}>
              <line
                x1={x(p.instances)}
                x2={x(p.instances)}
                y1={H - PAD.b}
                y2={H - PAD.b + 4}
                className={styles.curveAxis}
              />
              <text
                x={x(p.instances)}
                y={H - 6}
                className={styles.curveTick}
                textAnchor="middle"
                data-current={p.instances === instances ? 'true' : undefined}
              >
                {p.instances}
              </text>
            </g>
          ))}
          <path d={geometry.area} fill={`url(#${id}-fill)`} />
          <path d={geometry.path} className={styles.curveLine} pathLength={1} />
          {geometry.cliff ? (
            <g className={styles.cliff}>
              <line
                x1={x(geometry.cliff.n)}
                x2={x(geometry.cliff.n)}
                y1={y(geometry.cliff.to)}
                y2={y(geometry.cliff.from)}
                className={styles.cliffRule}
              />
              <text
                x={Math.min(W - 6, x(geometry.cliff.n) + 6)}
                y={Math.max(PAD.t + 4, y(geometry.cliff.to) - 6)}
                className={styles.cliffText}
                textAnchor={x(geometry.cliff.n) > W - 90 ? 'end' : 'start'}
              >
                discount ends
              </text>
            </g>
          ) : null}
          {points.map((p) => (
            <circle
              key={p.instances}
              cx={x(p.instances)}
              cy={y(p.usdPerMonth)}
              r={p.instances === instances ? 5 : 2.5}
              className={styles.curveDot}
              data-current={p.instances === instances ? 'true' : undefined}
            />
          ))}
        </svg>
        {/* the pressable points: real buttons over the drawing, so keyboard and touch work */}
        <div className={styles.curvePicks}>
          {points.map((p) => (
            <button
              key={p.instances}
              type="button"
              className={styles.curvePick}
              style={{ insetInlineStart: `${(x(p.instances) / W) * 100}%` } as CSSProperties}
              aria-pressed={p.instances === instances}
              aria-label={`${p.instances} ${p.instances === 1 ? 'instance' : 'instances'}: $${money(p.usdPerMonth)} per month`}
              disabled={locked || !onPick}
              onClick={() => onPick?.(p.instances)}
            />
          ))}
        </div>
      </div>
      <p className={styles.curveNote}>
        {geometry.cliff
          ? `The price steps from $${money(geometry.cliff.from)} to $${money(geometry.cliff.to)} at ${geometry.cliff.n} instances, because a small app loses its discount there (and a very cheap app pays a flat USD 0.50 for each extra instance).`
          : 'Close to a straight line: each extra instance costs about the same again.'}
      </p>
    </figure>
  );
}
