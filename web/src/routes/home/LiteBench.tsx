import type { Tier } from '@shared/api';
import { useMemo } from 'react';
import { Glyph } from '@/ui';
import styles from './lite.module.css';
import {
  arcPath,
  CELL,
  fieldCells,
  LITE_H,
  LITE_W,
  PILLAR_HEIGHT,
  PILLAR_R,
  prism,
  SLOTS,
  slotPoint,
} from './liteGeometry';
import { type LiteInstance, useLiteSim } from './useLiteSim';

const TIER_NAME: Record<Tier, string> = { cumulus: 'Cumulus', nimbus: 'Nimbus', stratus: 'Stratus' };

function Pillar({ inst }: { inst: LiteInstance }) {
  const base = slotPoint(inst.position);
  const h = PILLAR_HEIGHT[inst.tier];
  const p = prism(base, PILLAR_R, h);
  const topY = base.y - h;
  return (
    <g className={styles.pillar} data-tier={inst.tier} data-down={inst.healthy ? undefined : 'true'}>
      <polygon className={styles.faceL} points={p.left} />
      <polygon className={styles.faceR} points={p.right} />
      <polygon className={styles.faceT} points={p.top} />
      {inst.healthy ? null : (
        <path
          className={styles.crack}
          d={`M${base.x - 9} ${topY - 3}l5 4l-3 4l6 3l-2 4l6 2`}
          pathLength={1}
        />
      )}
      <text className={styles.cc} x={base.x} y={base.y + 22} textAnchor="middle">
        {inst.cc || '--'}
      </text>
    </g>
  );
}

/**
 * The calm 2D bench: twelve pillars on a gentle arc, the cell above them, an arc to every pillar that
 * hosts a copy and packets that only travel to healthy ones. It is what the hero shows when there is no
 * WebGL (or the visitor forced it off), and it keeps every control working. Simulation: the placement,
 * health and routing are the diorama's headless rules on the built-in sample bench.
 */
export function LiteBench() {
  const view = useLiteSim(true);
  const field = useMemo(() => fieldCells(), []);
  const hosts = new Set(view.instances.map((i) => i.position));
  const healthyArcs = view.instances.filter((i) => i.healthy);

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${LITE_W} ${LITE_H}`}
        role="img"
        aria-label={`A simulated bench of ${SLOTS} nodes. ${view.placed} copies of the app are placed, ${view.healthy} healthy.`}
        focusable="false"
      >
        <defs>
          <linearGradient id="lite-arc" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="1" stopColor="var(--accent-text)" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        <g className={styles.field}>
          {field.map((c) => (
            <circle key={`${c.x}:${c.y}`} cx={c.x} cy={c.y} r={3.2} />
          ))}
        </g>

        {/* Pillars that do not host a copy: the rest of the network. */}
        {Array.from({ length: SLOTS }, (_, i) => i)
          .filter((i) => !hosts.has(i))
          .map((i) => {
            const base = slotPoint(i);
            const p = prism(base, PILLAR_R - 3, 12);
            return (
              <g key={`idle-${i}`} className={styles.idle}>
                <polygon className={styles.faceL} points={p.left} />
                <polygon className={styles.faceR} points={p.right} />
                <polygon className={styles.faceT} points={p.top} />
              </g>
            );
          })}

        {/* Arcs from the cell to each host, and packets on the healthy ones. */}
        {view.instances.map((inst) => {
          const base = slotPoint(inst.position);
          const to = { x: base.x, y: base.y - PILLAR_HEIGHT[inst.tier] - 6 };
          const d = arcPath(to);
          return (
            <g key={`arc-${inst.key}`}>
              <path
                className={styles.arc}
                d={d}
                pathLength={1}
                data-tier={inst.tier}
                data-down={inst.healthy ? undefined : 'true'}
              />
              {inst.healthy
                ? [0, 1].map((n) => (
                    <circle
                      key={n}
                      className={styles.packet}
                      r={2.4}
                      style={{
                        offsetPath: `path("${d}")`,
                        animationDelay: `${(inst.position * 0.37 + n * 1.1).toFixed(2)}s`,
                      }}
                    />
                  ))
                : null}
            </g>
          );
        })}

        {view.instances.map((inst) => (
          <Pillar key={inst.key} inst={inst} />
        ))}

        {/* The cell: a glass prism with three layers. */}
        <g className={styles.cell} data-live={healthyArcs.length > 0 ? 'true' : 'false'}>
          <polygon className={styles.cellL} points={prism({ x: CELL.x, y: CELL.y + 26 }, 38, 40).left} />
          <polygon className={styles.cellR} points={prism({ x: CELL.x, y: CELL.y + 26 }, 38, 40).right} />
          {[0.28, 0.5, 0.72].map((k) => (
            <polygon
              key={k}
              className={styles.cellSlab}
              points={prism({ x: CELL.x, y: CELL.y + 26 - 40 * (1 - k) }, 30, 0).top}
            />
          ))}
          <polygon className={styles.cellT} points={prism({ x: CELL.x, y: CELL.y + 26 }, 38, 40).top} />
        </g>
      </svg>
      <ul className={styles.legend} aria-label="Instances on the simulated bench">
        {view.instances.map((inst) => (
          <li key={inst.key} data-down={inst.healthy ? undefined : 'true'} data-tier={inst.tier}>
            <Glyph name={`tier-${inst.tier}` as 'tier-cumulus'} size={14} />
            <span>
              {TIER_NAME[inst.tier]}, {inst.label}: {inst.healthy ? 'healthy' : 'down'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
