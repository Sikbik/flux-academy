/**
 * FIG: the stack from hardware to your app, as an exploded view of four glass plates (the specimen).
 * Five node columns run through every plate, named A to E so the same node can be followed upward:
 * a machine, FluxOS on it, the one shared chain every node reads, and, on three of the nodes, your
 * containers. FACTS 1.1, 1.2, 1.4 and 6.2.
 */

import { TARGET_BLOCK_SEC } from '@shared/flux';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { pt } from './_kit/geometry';
import { Line, Marker, Ping, Plate, Txt } from './_kit/parts';

export const meta: DiagramMeta = {
  id: 'flux-layers',
  title: 'The Flux stack',
  beats: [
    'Independent operators run the machines.',
    'FluxOS turns each machine into a small cloud server that can run containers.',
    `The chain keeps every node in agreement: a new block about every ${TARGET_BLOCK_SEC} seconds.`,
    'Your containers run on top, on the nodes that chose to install your app.',
  ],
  alt:
    'An exploded stack of four layers. At the bottom, five machines labelled A to E, run by different operators. ' +
    'Above them, FluxOS runs on each machine. Above that, one shared chain that every node reads, with a new block ' +
    `about every ${TARGET_BLOCK_SEC} seconds. On top, three of the nodes, A, C and E, run your containers.`,
};

const COLS = 5;
const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
/** The nodes that chose to run your app. */
const APP_COLS = [0, 2, 4];

interface Layout {
  H: number;
  cx: number;
  pw: number;
  ph: number;
  t: number;
  y: number[];
  colX: number[];
  mini: { w: number; h: number };
  markerX: number;
}

function layout(W: number, narrow: boolean): Layout {
  const mx = narrow ? 10 : 24;
  const gutter = narrow ? 42 : 66;
  const pw = Math.min(W - 2 * mx - gutter, narrow ? 340 : 560);
  const x0 = Math.max(mx, (W - (pw + gutter)) / 2);
  const cx = x0 + pw / 2;
  const ph = narrow ? 70 : 88;
  const t = narrow ? 7 : 9;
  const pitch = narrow ? 70 : 88;
  const top = narrow ? 46 : 54;
  const y = [0, 1, 2, 3].map((i) => top + (3 - i) * pitch);
  const inset = narrow ? 40 : 66;
  const span = pw - inset * 2;
  const colX = Array.from({ length: COLS }, (_, k) => cx - pw / 2 + inset + (span * k) / (COLS - 1));
  const gap = span / (COLS - 1);
  const mw = Math.min(narrow ? 44 : 64, gap - 10);
  const H = (y[0] ?? 0) + ph / 2 + t + (narrow ? 14 : 20);
  return { H, cx, pw, ph, t, y, colX, mini: { w: mw, h: mw * 0.4 }, markerX: x0 + pw + gutter - 20 };
}

const LAYERS = [
  {
    name: 'HARDWARE',
    sub: 'many owners',
    probe: 'Hardware: machines owned and run by independent operators',
  },
  { name: 'FLUXOS', sub: 'node software', probe: 'FluxOS: makes each machine a cloud server for containers' },
  {
    name: 'THE CHAIN',
    sub: `${TARGET_BLOCK_SEC} s per block`,
    probe: 'The chain: the shared record every node reads and agrees on',
  },
  {
    name: 'YOUR CONTAINERS',
    sub: 'on 3 nodes',
    probe: 'Your containers: placed on nodes that chose to install the app',
  },
] as const;

const FluxLayers: DiagramComponent = ({ beat, reducedMotion }: DiagramProps) => (
  <DiagramRoot
    meta={meta}
    beat={beat}
    reducedMotion={reducedMotion}
    height={(W, narrow) => layout(W, narrow).H}
  >
    {({ W, narrow, st }) => {
      const L = layout(W, narrow);
      const lx = L.cx - L.pw / 4 + (narrow ? 8 : 14);
      const mid = (i: number) => (L.y[i] ?? 0) - L.ph * 0.1;
      const front = (i: number) => (L.y[i] ?? 0) + L.ph * (narrow ? 0.21 : 0.17);
      const subFont = narrow ? 11 : 12;

      return (
        <>
          {[0, 1, 2, 3].map((i) => {
            const s = st(i);
            const y = L.y[i] ?? 0;
            const layer = LAYERS[i] as (typeof LAYERS)[number];
            return (
              <g key={layer.name}>
                <Plate cx={L.cx} cy={y} w={L.pw} h={L.ph} t={L.t} s={s} probe={layer.probe}>
                  <Txt bare x={lx} y={front(i)} ink="lit" semi>
                    {layer.name}
                  </Txt>
                  <Txt bare x={lx} y={front(i) + 14} caps={false} ink="dim" hot={false} size={subFont}>
                    {layer.sub}
                  </Txt>
                </Plate>

                {i < 2 &&
                  L.colX.map((x, k) => (
                    <Plate
                      key={LETTERS[k]}
                      cx={x}
                      cy={mid(i)}
                      w={L.mini.w}
                      h={L.mini.h}
                      t={i === 0 ? 6 : 3}
                      s={s}
                      delay={60 + k * 50}
                      probe={
                        i === 0
                          ? `Machine ${LETTERS[k]}, a node run by an independent operator`
                          : `FluxOS on machine ${LETTERS[k]}`
                      }
                    >
                      <Txt
                        bare
                        x={x}
                        y={mid(i)}
                        caps={false}
                        anchor="middle"
                        ink={i === 0 ? 'lit' : 'dim'}
                        semi
                        size={11}
                      >
                        {LETTERS[k] ?? ''}
                      </Txt>
                    </Plate>
                  ))}

                {i === 2 && (
                  <>
                    <Line
                      pts={[pt(L.colX[0] ?? 0, mid(2)), pt(L.colX[COLS - 1] ?? 0, mid(2))]}
                      kind="line"
                      s={s}
                      delay={80}
                    />
                    {L.colX.map((x, k) => (
                      <Plate
                        key={LETTERS[k]}
                        cx={x}
                        cy={mid(2)}
                        w={L.mini.w * 0.78}
                        h={L.mini.h * 0.78}
                        t={4}
                        s={s}
                        delay={100 + k * 50}
                        probe={`A block, about ${TARGET_BLOCK_SEC} seconds after the one before`}
                      />
                    ))}
                    <Ping cx={L.colX[COLS - 1] ?? 0} cy={mid(2)} r={narrow ? 9 : 12} s={s} />
                  </>
                )}

                {i === 3 &&
                  APP_COLS.map((k, n) => (
                    <Plate
                      key={LETTERS[k]}
                      cx={L.colX[k] ?? 0}
                      cy={mid(3) - 5}
                      w={L.mini.w - 6}
                      h={L.mini.h - 3}
                      t={narrow ? 11 : 15}
                      s={s}
                      delay={80 + n * 80}
                      probe={`An instance of your app on node ${LETTERS[k]}`}
                    >
                      <Txt
                        bare
                        x={L.colX[k] ?? 0}
                        y={mid(3) - 5}
                        caps={false}
                        anchor="middle"
                        ink="lit"
                        semi
                        size={11}
                      >
                        {LETTERS[k] ?? ''}
                      </Txt>
                    </Plate>
                  ))}

                <Marker n={i + 1} anchor={pt(L.cx + L.pw / 2, y)} at={pt(L.markerX, y)} s={s} delay={120} />
              </g>
            );
          })}
        </>
      );
    }}
  </DiagramRoot>
);

export default FluxLayers;
