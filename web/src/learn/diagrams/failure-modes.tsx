/**
 * FIG: what can fail, who notices and who heals it. Five scenarios in a list; the one in focus fills a detail
 * panel with who notices, who heals and how long, and marks the times on a log scale so that "traffic moves in
 * seconds, a replacement takes about two hours or more" is something you see. FACTS 6.3 (restart back-off, the
 * location record lifetime of 7,500 s, clean shutdown 420 s), 6.4 (TCP check every 3 s, down after 2
 * failures), 5.4 (no grace on expiry) and 7.3 (soft and hard redeploy).
 *
 * Beat 5 (an update rolls out) is limited to what FACTS documents: each node redeploys its own copy, soft
 * keeps volumes and hard recreates them, a structure or disk change escalates. How long it takes is not
 * documented, so no time is drawn.
 */

import {
  CRASH_BACKOFF_MAX_MIN,
  CRASH_BACKOFF_SEC,
  FDM_EJECT_SEC,
  FDM_TIMING,
  LOCATION_CLEAN_SHUTDOWN_DROP_SEC,
  LOCATION_TTL_MIN,
  LOCATION_TTL_SEC,
  SYNCED_RESPAWN_EXTRA_MIN,
} from '@shared/flux';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { monoWidth, pt, wrapMono } from './_kit/geometry';
import { Badge, Dot, Line, Slab, Txt } from './_kit/parts';

/** The crash ladder after the first, immediate restart: 30 s, then 5, 15 and 30 minutes. */
const CRASH_FIRST_PAUSE_SEC = CRASH_BACKOFF_SEC[1] ?? 0;
const CRASH_MID_MIN = CRASH_BACKOFF_SEC.slice(2, -1)
  .map((sec) => sec / 60)
  .join(', ');

export const meta: DiagramMeta = {
  id: 'failure-modes',
  title: 'What can fail, and who heals it',
  beats: [
    'A container crashes. FluxOS on the same node restarts it, and waits longer if it keeps crashing.',
    'A node goes offline. The load balancer reroutes in seconds, but a replacement takes about two hours or more.',
    'A region goes dark. Every node there is lost at once, and the instances left carry the traffic.',
    'A subscription expires. Nothing heals it: there is no grace period, and the app and its data are removed.',
    'An update rolls out. Each node redeploys its own copy, and a soft redeploy keeps the volume.',
  ],
  alt:
    'A list of five things that can go wrong, with a detail panel for the one in focus. A crash is restarted by ' +
    `FluxOS on the same node with growing waits. A lost node is skipped by the load balancer in about ${FDM_EJECT_SEC} ` +
    `seconds, and replaced by another node only after its location record lapses, up to ${LOCATION_TTL_MIN} minutes, plus the image pull. A dark ` +
    'region is the same for every node in it, and the surviving instances carry the traffic. An expired ' +
    'subscription is not healed: the app and its data are removed. An update is applied by each node to its own ' +
    'copy, soft keeping the volume and hard recreating it.',
};

interface Scenario {
  title: string;
  short: string;
  notices: string;
  heals: string;
  how: string;
}

const SCENARIOS: readonly Scenario[] = [
  {
    title: 'A CONTAINER CRASHES',
    short: 'container crashes',
    notices: 'FluxOS on that node sees the container exit.',
    heals: `The same node restarts it. If it keeps crashing the waits grow: ${CRASH_FIRST_PAUSE_SEC} s, ${CRASH_MID_MIN}, then ${CRASH_BACKOFF_MAX_MIN} minutes.`,
    how: 'The first restart is immediate. A container that runs but is unhealthy is not replaced.',
  },
  {
    title: 'A NODE GOES OFFLINE',
    short: 'node goes offline',
    notices: `The load balancer checks the port every ${FDM_TIMING.healthIntervalSec} seconds. Two failures in a row mean down.`,
    heals: 'Traffic moves to the other instances. Another node replaces it once the lost record lapses.',
    how: `About ${FDM_EJECT_SEC} seconds to reroute. A replacement can take about ${LOCATION_TTL_MIN} minutes plus the image pull, and up to about ${SYNCED_RESPAWN_EXTRA_MIN} minutes more for synced storage.`,
  },
  {
    title: 'A REGION GOES DARK',
    short: 'region goes dark',
    notices: 'The same checks, for every node in the region at once.',
    heals:
      'The instances left carry the traffic. Replacements appear elsewhere only where the geolocation rules allow.',
    how: 'Reroute in seconds, replacement as for one node. Size for the instances that survive.',
  },
  {
    title: 'A SUBSCRIPTION EXPIRES',
    short: 'subscription expires',
    notices: 'Every node reads the app list. At expiry the app is no longer in it.',
    heals: 'Nothing. There is no grace period: containers, volumes and data are removed. Renew before.',
    how: 'Gone within minutes to a few hours of the expiry block.',
  },
  {
    title: 'AN UPDATE ROLLS OUT',
    short: 'update rolls out',
    notices: 'Each node sees the new spec on its own.',
    heals:
      'Each node redeploys its own copy. Soft keeps the volume, hard recreates it. A structure or disk change goes hard.',
    how: 'How long it takes is not documented. Back up before a change that goes hard.',
  },
];

/** Marks on the log time axis, per scenario: seconds and a label. */
const MARKS: readonly (readonly { t: number; label: string; hot?: boolean }[])[] = [
  [
    { t: 1, label: 'restart', hot: true },
    ...CRASH_BACKOFF_SEC.filter((sec) => sec > 0).map((sec) => ({
      t: sec,
      label: sec < 60 ? `${sec} s` : `${sec / 60} min`,
    })),
  ],
  [
    { t: FDM_EJECT_SEC, label: 'reroute', hot: true },
    { t: LOCATION_CLEAN_SHUTDOWN_DROP_SEC, label: 'clean stop' },
    { t: LOCATION_TTL_SEC, label: `crash: ${LOCATION_TTL_MIN} min`, hot: true },
  ],
  [
    { t: FDM_EJECT_SEC, label: 'reroute', hot: true },
    { t: LOCATION_TTL_SEC, label: `replace: ${LOCATION_TTL_MIN} min+`, hot: true },
  ],
  [],
  [],
];

const AXIS_TICKS: readonly { t: number; label: string }[] = [
  { t: 1, label: '1 s' },
  { t: 10, label: '10 s' },
  { t: 60, label: '1 min' },
  { t: 600, label: '10 min' },
  { t: 3600, label: '1 h' },
  { t: 10800, label: '3 h' },
];
const LOG_MAX = Math.log10(10800);

const WIDE_MIN = 560;

/**
 * The geometry of the figure at a width. The detail panel is as tall as its longest scenario needs: three
 * wrapped texts, then the time axis with its marks under them.
 */
function geoOf(W: number) {
  const R = W - 36;
  const wide = W >= WIDE_MIN;
  const m = wide ? 24 : 12;
  const listW = wide ? 210 : R - m;
  const rowH = wide ? 52 : 26;
  const listTop = 14;
  const dx = wide ? m + listW + 24 : m;
  const dy = wide ? 10 : listTop + 5 * rowH + 10;
  const dw = R - dx;
  const tw = dw - 36;
  const lines = Math.max(
    ...SCENARIOS.map(
      (sc) =>
        wrapMono(sc.notices, tw, 11).length +
        wrapMono(sc.heals, tw, 11).length +
        wrapMono(sc.how, tw, 11).length,
    ),
  );
  const dh = Math.max(wide ? 320 : 0, 201 + (lines - 1) * 15);
  return { wide, m, listW, rowH, listTop, dx, dy, dw, tw, dh, H: dy + dh + 10 };
}

const FailureModes: DiagramComponent = ({ beat, reducedMotion }: DiagramProps) => (
  <DiagramRoot meta={meta} beat={beat} reducedMotion={reducedMotion} height={(W) => geoOf(W).H}>
    {({ W, st }) => {
      const { wide, m, rowH, listTop, dx, dy, dw, dh, tw } = geoOf(W);

      // The scenario list.
      const listX = m;

      // The detail panel.
      const tx = dx + 18;
      const axisY = dy + dh - 44;
      const ax0 = dx + 24;
      const ax1 = dx + dw - 24;
      const xOf = (t: number) => ax0 + ((ax1 - ax0) * Math.log10(Math.max(1, t))) / LOG_MAX;

      const list = SCENARIOS.map((sc, k) => {
        const s = st(0, k);
        const y = listTop + k * rowH + rowH / 2;
        return (
          <g key={sc.title}>
            <Badge n={k + 1} at={pt(listX + 12, y)} s={s} delay={k * 60} probe={sc.title.toLowerCase()} />
            <Txt x={listX + 32} y={y} s={s} semi={false} ink="lit" delay={80 + k * 60}>
              {wide ? sc.title : sc.short}
            </Txt>
          </g>
        );
      });

      const panel = SCENARIOS.map((sc, k) => {
        const s = st(k, k, k + 1);
        const notices = wrapMono(sc.notices, tw, 11);
        const heals = wrapMono(sc.heals, tw, 11);
        const how = wrapMono(sc.how, tw, 11);
        const y0 = dy + 20;
        const yN = y0 + 34;
        const yH = yN + notices.length * 15 + 26;
        const yW = yH + heals.length * 15 + 26;
        return (
          <g key={`d-${sc.title}`}>
            <Txt x={tx} y={y0} s={s} ink="acc" semi>
              {sc.title}
            </Txt>
            <Txt x={tx} y={yN - 14} s={s} ink="dim" hot={false} delay={60}>
              WHO NOTICES
            </Txt>
            <Txt x={tx} y={yN + 2} s={s} caps={false} ink="lit" lh={15} delay={100}>
              {notices}
            </Txt>
            <Txt x={tx} y={yH - 14} s={s} ink="dim" hot={false} delay={140}>
              WHO HEALS IT
            </Txt>
            <Txt x={tx} y={yH + 2} s={s} caps={false} ink="lit" lh={15} delay={180}>
              {heals}
            </Txt>
            <Txt x={tx} y={yW - 14} s={s} ink="dim" hot={false} delay={220}>
              HOW LONG
            </Txt>
            <Txt x={tx} y={yW + 2} s={s} caps={false} ink="lit" lh={15} delay={260}>
              {how}
            </Txt>
          </g>
        );
      });

      const axis = (
        <g>
          <Line pts={[pt(ax0, axisY), pt(ax1, axisY)]} kind="line" s={st(0, [])} />
          {AXIS_TICKS.map((tick) => (
            <g key={tick.label}>
              <Line
                pts={[pt(xOf(tick.t), axisY - 3), pt(xOf(tick.t), axisY + 3)]}
                kind="line"
                s={st(0, [])}
              />
              <Txt
                x={xOf(tick.t)}
                y={axisY + 16}
                s={st(0, [])}
                anchor="middle"
                caps={false}
                ink="dim"
                hot={false}
                size={10}
              >
                {tick.label}
              </Txt>
            </g>
          ))}
        </g>
      );

      const marks = MARKS.map((ms, k) => {
        const s = st(k, k, k + 1);
        return (
          <g key={`m-${SCENARIOS[k]?.title}`}>
            {ms.map((mk, j) => {
              const x = xOf(mk.t);
              const label = mk.label;
              const w = monoWidth(label, 10);
              const right = x + w / 2 > ax1 + 20;
              return (
                <g key={label}>
                  <Dot x={x} y={axisY} r={mk.hot ? 4 : 3} s={s} delay={j * 120} />
                  <Txt
                    x={right ? Math.min(x + 4, W - 8) : x}
                    y={axisY - 14 - (j % 2) * 14}
                    s={s}
                    anchor={right ? 'end' : 'middle'}
                    caps={false}
                    ink={mk.hot ? 'lit' : 'dim'}
                    hot={false}
                    size={10}
                    delay={160 + j * 120}
                  >
                    {label}
                  </Txt>
                </g>
              );
            })}
            {ms.length === 0 && (
              <Txt x={ax0} y={axisY - 14} s={s} caps={false} ink="dim" hot={false} size={10} delay={160}>
                {k === 3 ? 'no timer to wait out' : 'no time is documented'}
              </Txt>
            )}
          </g>
        );
      });

      return (
        <>
          {list}
          <Slab x={dx} y={dy} w={dw} h={dh} s={st(0)} c={14} wash />
          {panel}
          {axis}
          {marks}
        </>
      );
    }}
  </DiagramRoot>
);

export default FailureModes;
