/**
 * FIG: what each volume prefix keeps when something fails. Three lanes (a plain path, `r:` and `g:`), three
 * nodes each. The first three beats introduce the lanes; the last two apply the same failure to all of them:
 * a node is lost, then the primary is lost. FACTS 7.1 and 7.2 (what each prefix guarantees) and 6.4 (only the
 * elected primary of a `g:` app receives traffic).
 *
 * Beat 4 deviates from the catalog ("a node moves"): FACTS has no mechanism for a volume moving with a node, so
 * it shows a node being lost, which is what the table in FACTS 7.2 describes.
 */

import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { pt, wrapClamp } from './_kit/geometry';
import { Chip, Hex, Line, Mark, Slab, Txt } from './_kit/parts';
import type { S } from './_kit/state';

export const meta: DiagramMeta = {
  id: 'volume-prefixes',
  title: 'What each volume prefix keeps',
  beats: [
    'A plain path is one volume on one node. Every instance keeps its own data, so the copies drift apart.',
    'With r: every instance holds the data and all of them can write. Changes sync between them.',
    'With g: every instance holds a copy, but only the primary runs. The others wait as standby.',
    'A node is lost. A plain volume loses that data. r: and g: keep it while a current copy remains elsewhere.',
    'The primary fails. A g: standby is elected after a delay of minutes, from its last synced copy. Plain data is gone.',
  ],
  alt:
    'Three lanes of three nodes each: a plain volume, an r: volume and a g: volume. In the plain lane each node ' +
    'holds different data and nothing is copied. In the r: lane every node holds the same data and changes sync ' +
    'both ways. In the g: lane one node is the primary and runs the app while the other two hold copies as ' +
    'standby. When one node is lost, the plain lane loses that data and the other two lanes keep theirs. When ' +
    'the primary is lost, the plain lane loses it, the r: lane still serves from the others, and in the g: lane ' +
    'a standby is elected primary after a delay of minutes, from its last synced copy.',
};

const WIDE_MIN = 600;
const NODES = ['A', 'B', 'C'] as const;

interface Lane {
  prefix: string;
  words: string;
  data: readonly [string, string, string];
}

const LANES: readonly Lane[] = [
  { prefix: '/data', words: 'plain: one node', data: ['x', 'y', 'z'] },
  { prefix: 'r:/data', words: 'replicated: all write', data: ['x', 'x', 'x'] },
  { prefix: 'g:/data', words: 'primary and standby', data: ['x', 'x', 'x'] },
];

/** What each lane says after each failure. [lane][failure] */
const VERDICT = [
  [
    { ok: false, text: "C's data is lost. A replacement starts empty." },
    { ok: false, text: "A's data is lost. A replacement starts empty." },
  ],
  [
    { ok: true, text: 'A and B still hold the data.' },
    { ok: true, text: 'B and C still hold the data and keep serving.' },
  ],
  [
    { ok: true, text: 'The primary A is untouched.' },
    { ok: true, text: 'A standby is elected primary after a delay of minutes.' },
  ],
] as const;

const VolumePrefixes: DiagramComponent = ({ beat, reducedMotion }: DiagramProps) => (
  <DiagramRoot
    meta={meta}
    beat={beat}
    reducedMotion={reducedMotion}
    height={(W) => (W >= WIDE_MIN ? 10 + 3 * 104 + 14 : 10 + 3 * 134 + 12)}
  >
    {({ W, st }) => {
      const R = W - 36;
      const wide = W >= WIDE_MIN;
      const m = wide ? 24 : 12;
      const pitch = wide ? 104 : 134;
      const laneTop = (i: number) => 10 + i * pitch;
      const failC = st(3, 3, 4);
      const failA = st(4);
      // Wide: the lane label, three nodes and what survives, side by side. The nodes close up on a narrow
      // stage and spread out on a wide one.
      const extra = Math.max(0, W - 640);
      const nodePitch = 84 + Math.min(16, extra * 0.2);
      const node0 = m + 176 + Math.min(44, extra * 0.4);
      const verdictAt = node0 + 2 * nodePitch + 48;
      const verdictW = wide ? R - verdictAt : R - m - 80;

      return (
        <>
          {LANES.map((lane, i) => {
            const s = st(i);
            const top = laneTop(i);
            const xs = wide
              ? NODES.map((_, k) => node0 + k * nodePitch)
              : NODES.map((_, k) => m + 40 + (k * (R - m - 80)) / 2);
            const y = wide ? top + 40 : top + 70;
            const isG = i === 2;
            const isR = i === 1;
            const chipY = wide ? top + 22 : top + 14;
            const chipW = lane.prefix.length * 6.6 + 16;
            const wordsX = wide ? m : m + chipW + 12;
            const wordsY = wide ? top + 48 : top + 14;
            const verdictY = wide ? top + 26 : top + 14;
            const verdictX = wide ? verdictAt : m + chipW + 12;
            const [vC, vA] = VERDICT[i] as readonly [
              { ok: boolean; text: string },
              { ok: boolean; text: string },
            ];
            const wordsS = wide ? s : st(i, i, 3);
            const base = (k: number) => {
              // The data label of a node that is lost at some beat is hidden while the overlay shows it.
              if (k === 2) return [st(i, i, 3), st(4, [])] as const;
              if (k === 0) return [st(i, i, 4)] as const;
              return [s] as const;
            };

            return (
              <g key={lane.prefix}>
                {/* the lane label */}
                <Chip x={m} y={chipY} text={lane.prefix} s={s} wash probe={`containerData: ${lane.prefix}`} />
                <Txt x={wordsX} y={wordsY} s={wordsS} caps={false} ink="dim" hot={false} delay={120}>
                  {lane.words}
                </Txt>

                {/* sync lines */}
                {isR && (
                  <>
                    <Line
                      pts={[pt((xs[0] ?? 0) + 17, y), pt((xs[1] ?? 0) - 17, y)]}
                      arrow
                      arrowStart
                      strong
                      flow
                      s={s}
                      delay={200}
                    />
                    <Line
                      pts={[pt((xs[1] ?? 0) + 17, y), pt((xs[2] ?? 0) - 17, y)]}
                      arrow
                      arrowStart
                      strong
                      flow
                      s={s}
                      delay={260}
                    />
                  </>
                )}
                {isG && (
                  <>
                    <Line
                      pts={[pt((xs[0] ?? 0) + 17, y), pt((xs[1] ?? 0) - 17, y)]}
                      arrow
                      strong
                      flow
                      s={s}
                      delay={200}
                    />
                    <Line
                      pts={[
                        pt(xs[0] ?? 0, y - 18),
                        pt(xs[0] ?? 0, y - 28),
                        pt(xs[2] ?? 0, y - 28),
                        pt(xs[2] ?? 0, y - 19),
                      ]}
                      arrow
                      s={s}
                      delay={260}
                    />
                  </>
                )}

                {/* the three nodes */}
                {NODES.map((n, k) => {
                  const x = xs[k] ?? 0;
                  const primary = isG && k === 0;
                  return (
                    <g key={n}>
                      <Hex
                        cx={x}
                        cy={y}
                        r={15}
                        s={s}
                        wash
                        breathe={primary}
                        delay={80 + k * 70}
                        probe={`Node ${n}: ${
                          isG
                            ? primary
                              ? 'the primary, runs the app'
                              : 'standby, holds a copy'
                            : 'runs an instance'
                        }`}
                      >
                        <Txt
                          bare
                          x={x}
                          y={y + 0.5}
                          anchor="middle"
                          caps={false}
                          semi
                          ink="lit"
                          hot={false}
                          size={11}
                        >
                          {n}
                        </Txt>
                      </Hex>
                      <Slab
                        x={x - 24}
                        y={y + 22}
                        w={48}
                        h={18}
                        s={s}
                        c={5}
                        cm={2}
                        quiet={isG && !primary}
                        delay={140 + k * 70}
                        probe={`Volume on node ${n}`}
                      />
                      {base(k).map((bs, j) => (
                        <Txt
                          // biome-ignore lint/suspicious/noArrayIndexKey: one or two fixed windows
                          key={j}
                          x={x}
                          y={y + 31}
                          s={bs}
                          anchor="middle"
                          caps={false}
                          ink="dim"
                          hot={false}
                          size={10}
                        >
                          {`data ${lane.data[k] ?? ''}`}
                        </Txt>
                      ))}
                      {isG && k === 0 && (
                        <Txt
                          x={x}
                          y={y + 52}
                          s={st(2, 2, 4)}
                          anchor="middle"
                          caps={false}
                          ink="dim"
                          hot={false}
                          size={10}
                          delay={240}
                        >
                          primary
                        </Txt>
                      )}
                      {isG && k === 1 && (
                        <>
                          <Txt
                            x={x}
                            y={y + 52}
                            s={st(2, 2, 4)}
                            anchor="middle"
                            caps={false}
                            ink="dim"
                            hot={false}
                            size={10}
                            delay={240}
                          >
                            standby
                          </Txt>
                          <Txt
                            x={x}
                            y={y + 52}
                            s={failA}
                            anchor="middle"
                            caps={false}
                            ink="acc"
                            hot={false}
                            size={10}
                            delay={500}
                          >
                            new primary
                          </Txt>
                        </>
                      )}
                      {isG && k === 2 && (
                        <Txt
                          x={x}
                          y={y + 52}
                          s={s}
                          anchor="middle"
                          caps={false}
                          ink="dim"
                          hot={false}
                          size={10}
                          delay={240}
                        >
                          standby
                        </Txt>
                      )}

                      {/* a lost node: C at beat 4, A at beat 5 */}
                      {k === 2 && <Failed x={x} y={y} s={failC} />}
                      {k === 0 && <Failed x={x} y={y} s={failA} />}
                    </g>
                  );
                })}

                {/* what survives */}
                {[
                  { v: vC, s: failC },
                  { v: vA, s: failA },
                ].map((row, j) => (
                  <g key={j === 0 ? 'c' : 'a'}>
                    <Mark
                      kind={row.v.ok ? 'check' : 'x'}
                      x={verdictX + 6}
                      y={verdictY}
                      s={row.s}
                      tone={row.v.ok ? 'ok' : 'crit'}
                      size={4.5}
                      delay={300}
                    />
                    <Txt
                      x={verdictX + 20}
                      y={verdictY}
                      s={row.s}
                      caps={false}
                      ink="lit"
                      hot={false}
                      tone={row.v.ok ? undefined : 'crit'}
                      lh={15}
                      delay={340}
                    >
                      {wrapClamp(row.v.text, verdictW - 20, 11, wide ? 4 : 3)}
                    </Txt>
                  </g>
                ))}
              </g>
            );
          })}
        </>
      );
    }}
  </DiagramRoot>
);

/** The crit overlay drawn over a lost node and its volume. */
function Failed({ x, y, s }: { x: number; y: number; s: S }) {
  return (
    <>
      <Hex cx={x} cy={y} r={15} s={s} wash tone="crit" delay={0} />
      <Mark kind="x" x={x} y={y} s={s} tone="crit" size={5} delay={200} />
      <Slab x={x - 24} y={y + 22} w={48} h={18} s={s} c={5} cm={2} tone="crit" wash delay={100}>
        <Txt bare x={x} y={y + 31} anchor="middle" caps={false} ink="lit" hot={false} size={10}>
          lost
        </Txt>
      </Slab>
    </>
  );
}

export default VolumePrefixes;
