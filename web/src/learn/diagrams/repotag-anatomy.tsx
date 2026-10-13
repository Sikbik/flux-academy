/**
 * FIG: the four parts of an image name, `registry/namespace/image:tag`, drawn as one long mono string with a
 * bracket and a number under each part. A readout panel explains the part in focus; the last beat shows
 * why a tag that can move (latest) lets nodes run different builds. FACTS 3.3 (repotag grammar: FluxOS itself
 * refuses an uppercase name as "not in valid format", and a `docker.io/` prefix fails the registry lookup) and
 * 6.3 / 11 row 19 (every 6 hours FluxOS compares the running image's digest with the registry's for the same tag
 * and soft-redeploys on a difference; read from source, not observed live).
 *
 * Props: `repotag` (default `sam/hello-flux:1.0.0`, the name the containers lessons build).
 * Parts that are left out are drawn as ghosts, because Docker fills them in: Docker Hub, the official
 * `library` namespace and the `latest` tag.
 */

import { IMAGE_RECHECK_HOURS, parseRepotag } from '@shared/flux';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { clamp, monoWidth, pt, wrapMono } from './_kit/geometry';
import { Badge, Hex, Line, Marker, Slab, Txt } from './_kit/parts';
import { str } from './_kit/props';

export const meta: DiagramMeta = {
  id: 'repotag-anatomy',
  title: 'The parts of an image name',
  beats: [
    'The registry hosts the image. Left out, Docker adds docker.io itself. Do not write docker.io/ in a spec: FluxOS fails the lookup.',
    'The namespace is the account or organisation that owns the image.',
    'The image name is the software itself, in lower case.',
    'The tag picks one version of the image. Nodes pull exactly this name.',
    `A tag can move. FluxOS is set to compare digests every ${IMAGE_RECHECK_HOURS} hours and redeploy, so a changed latest can reach nodes at different times.`,
  ],
  alt:
    'An image name split into four parts with a numbered bracket under each: the registry, the namespace, the ' +
    'image and the tag. Parts that were left out are shown as ghosts because Docker adds them itself; you do not ' +
    'write them in your spec, and a docker.io prefix fails there. A last view ' +
    'compares two tags: a moving tag called latest, where some nodes could already run the new build while others ' +
    'still run the old one, and a fixed version tag, where every node runs the same build.',
};

type Key = 'registry' | 'namespace' | 'image' | 'tag';

interface Seg {
  key: Key;
  /** What is drawn, with its separator: `docker.io/`, `sam/`, `hello-flux`, `:1.0.0`. */
  text: string;
  /** The bare value shown in the readout. */
  value: string;
  implied: boolean;
}

const DEFAULT = 'sam/hello-flux:1.0.0';

function segments(raw: string): Seg[] {
  const p = parseRepotag(raw);
  return [
    {
      key: 'registry',
      text: `${p.registry ?? 'docker.io'}/`,
      value: p.registry ?? 'docker.io',
      implied: p.registry === null,
    },
    {
      key: 'namespace',
      text: `${p.namespace ?? 'library'}/`,
      value: p.namespace ?? 'library',
      implied: p.namespace === null,
    },
    { key: 'image', text: p.repository || 'image', value: p.repository || 'image', implied: false },
    { key: 'tag', text: `:${p.tag ?? 'latest'}`, value: p.tag ?? 'latest', implied: p.tag === null },
  ];
}

const NAMES: Record<Key, string> = {
  registry: 'REGISTRY',
  namespace: 'NAMESPACE',
  image: 'IMAGE',
  tag: 'TAG',
};

function what(seg: Seg): { head: string; note: string; rule: string } {
  switch (seg.key) {
    case 'registry':
      return {
        head: 'The host that stores the image and serves it to nodes.',
        note: seg.implied
          ? 'None is written here. Docker adds docker.io itself, so Docker Hub is used; you do not write it in your spec.'
          : seg.value === 'docker.io'
            ? 'Written out here. Docker accepts it, but a spec must not carry it: FluxOS fails the lookup.'
            : 'Written out here, so the image is not on Docker Hub.',
        rule: 'On Flux the image must be public, unless the app is an enterprise app.',
      };
    case 'namespace':
      return {
        head: 'The account or organisation that owns the image.',
        note: seg.implied
          ? 'None is written here. Docker adds library itself: this is an official image.'
          : 'Usually your account name on the registry.',
        rule: 'On Flux it is just part of the name that nodes pull.',
      };
    case 'image':
      return {
        head: 'The software itself: the project you are running.',
        note: 'Lower case only. FluxOS refuses a capital letter here as "not in valid format".',
        rule: 'On Flux the whole name is at most 200 characters.',
      };
    case 'tag':
      return {
        head: 'The version of the image. Nodes pull exactly this name.',
        note: seg.implied
          ? 'None is written here, so Docker uses latest.'
          : 'A tag is only a label. Whoever owns the image can move it.',
        rule: 'Capitals are allowed in a tag, and nowhere else in the name.',
      };
  }
}

interface Placed extends Seg {
  x: number;
  w: number;
  line: number;
}

const Repotag: DiagramComponent = ({ beat, props, reducedMotion }: DiagramProps) => {
  const raw = str(props?.repotag, DEFAULT, 200);
  const segs = segments(raw);
  const fixedTag = (() => {
    const t = parseRepotag(raw).tag;
    return t && t !== 'latest' ? t : '1.0.0';
  })();

  return (
    <DiagramRoot meta={meta} beat={beat} reducedMotion={reducedMotion} height={(W) => layoutOf(W, segs).H}>
      {({ W, st }) => {
        const L = layoutOf(W, segs);
        const { fs, placed, m, R, panelY, panelH } = L;
        const sAll = (k: number) => st(0, k);

        const readout = (k: number) => {
          const seg = segs[k] as Seg;
          const w = what(seg);
          const s = st(k, k, k + 1);
          const lw = R - m - 40;
          return (
            <g key={seg.key}>
              <Badge n={k + 1} at={pt(m + 22, panelY + 24)} s={s} />
              <Txt x={m + 42} y={panelY + 24} s={s} ink="acc" semi>
                {NAMES[seg.key]}
              </Txt>
              <Txt x={R - 14} y={panelY + 24} s={s} anchor="end" caps={false} ink="lit" semi delay={60}>
                {seg.value}
              </Txt>
              <Txt x={m + 18} y={panelY + 52} s={s} caps={false} ink="lit" lh={16} delay={120}>
                {wrapMono(w.head, lw, 11)}
              </Txt>
              <Txt
                x={m + 18}
                y={panelY + 52 + wrapMono(w.head, lw, 11).length * 16 + 8}
                s={s}
                caps={false}
                ink="dim"
                hot={false}
                lh={16}
                delay={180}
              >
                {wrapMono(w.note, lw, 11)}
              </Txt>
              <Txt
                x={m + 18}
                y={
                  panelY + 52 + (wrapMono(w.head, lw, 11).length + wrapMono(w.note, lw, 11).length) * 16 + 16
                }
                s={s}
                caps={false}
                ink="acc"
                hot={false}
                lh={16}
                delay={240}
              >
                {wrapMono(w.rule, lw, 11)}
              </Txt>
            </g>
          );
        };

        // The last beat: a moving tag against a fixed one, three nodes each.
        const sMove = st(4);
        const laneH = L.wide ? 60 : 74;
        const lane0 = panelY + 30;
        const nodeR = 13;
        const noteW = R - m - 36;
        const lanes = [
          {
            tag: ':latest',
            builds: ['B', 'A', 'A'],
            note: 'latest moved to build B. A node switches when its digest check sees the change.',
            moving: true,
          },
          {
            tag: `:${fixedTag}`,
            builds: ['A', 'A', 'A'],
            note: `${fixedTag} stays on build A. Every node runs A.`,
            moving: false,
          },
        ] as const;

        return (
          <>
            {/* the name, one bracket and one number under each part */}
            {placed.map((p, k) => {
              const s = sAll(k);
              const cx = p.x + p.w / 2;
              const y = L.lineY(p.line);
              const by = y + fs * 0.72 + 3;
              return (
                <g key={p.key}>
                  <Txt
                    x={p.x}
                    y={y}
                    s={s}
                    caps={false}
                    ink={p.implied ? 'dim' : 'lit'}
                    size={fs}
                    semi={!p.implied}
                    probe={`${NAMES[p.key]}: ${p.value}${p.implied ? ' (left out: Docker adds it, you do not write it)' : ''}`}
                  >
                    {p.text}
                  </Txt>
                  <Line
                    pts={[
                      pt(p.x + 1, by),
                      pt(p.x + 1, by + 5),
                      pt(p.x + p.w - 2, by + 5),
                      pt(p.x + p.w - 2, by),
                    ]}
                    kind={p.implied ? 'line' : 'ann'}
                    dashed={p.implied}
                    s={s}
                    delay={80}
                  />
                  <Line pts={[pt(cx, by + 5), pt(cx, by + 15)]} kind="line" s={s} delay={140} />
                  <Badge n={k + 1} at={pt(cx, by + 25)} s={s} probe={`${NAMES[p.key]}: ${p.value}`} />
                </g>
              );
            })}

            {/* the readout */}
            <Slab x={m} y={panelY} w={R - m} h={panelH} s={st(0)} c={12} wash />
            {[0, 1, 2, 3].map(readout)}

            {/* beat 5: two tags, three nodes each */}
            <Txt x={m + 18} y={panelY + 18} s={st(4, 4, 5)} ink="acc" semi>
              ONE IMAGE, TWO TAGS
            </Txt>
            {lanes.map((lane, i) => {
              const y = lane0 + 12 + i * laneH;
              const tagW = monoWidth(lane.tag, 11) + 16;
              const nodesX = R - 14 - 2 * 32 - nodeR;
              return (
                <g key={lane.tag}>
                  <Slab x={m + 18} y={y - 11} w={tagW} h={22} s={sMove} c={6} cm={2} wash delay={i * 80}>
                    <Txt bare x={m + 18 + tagW / 2} y={y} anchor="middle" caps={false} ink="lit" hot={false}>
                      {lane.tag}
                    </Txt>
                  </Slab>
                  {lane.builds.map((b, j) => {
                    const x = nodesX + j * 32;
                    return (
                      <Hex
                        // biome-ignore lint/suspicious/noArrayIndexKey: three fixed nodes
                        key={j}
                        cx={x}
                        cy={y}
                        r={nodeR}
                        s={sMove}
                        tone={lane.moving && b === 'A' ? 'warn' : undefined}
                        wash
                        delay={200 + j * 60 + i * 80}
                        probe={`Node ${j + 1} runs build ${b}`}
                      >
                        <Txt bare x={x} y={y} anchor="middle" caps={false} semi ink="lit" hot={false}>
                          {b}
                        </Txt>
                      </Hex>
                    );
                  })}
                  <Txt
                    x={m + 18}
                    y={y + 28}
                    s={sMove}
                    caps={false}
                    ink="dim"
                    hot={false}
                    lh={15}
                    delay={300 + i * 80}
                  >
                    {wrapMono(lane.note, noteW, 11)}
                  </Txt>
                </g>
              );
            })}
            <Marker
              n={5}
              anchor={pt(R - 1, panelY + 14)}
              at={pt(W - 17, panelY + 14)}
              s={sMove}
              delay={200}
            />
          </>
        );
      }}
    </DiagramRoot>
  );
};

interface Layout {
  wide: boolean;
  fs: number;
  m: number;
  R: number;
  placed: Placed[];
  lineY: (line: number) => number;
  panelY: number;
  panelH: number;
  H: number;
}

function layoutOf(W: number, segs: Seg[]): Layout {
  const wide = W >= 560;
  const m = wide ? 24 : 12;
  const R = W - (wide ? 40 : 36);
  const avail = R - m - 8;
  const chars = segs.reduce((n, s) => n + [...s.text].length, 0);
  const fs = clamp(avail / (chars * 0.6), 11, wide ? 26 : 16);
  const adv = fs * 0.6;

  // Flow the parts onto lines at part boundaries.
  const placed: Placed[] = [];
  let x = m + 4;
  let line = 0;
  for (const s of segs) {
    const w = [...s.text].length * adv;
    if (x + w > R && x > m + 4) {
      line += 1;
      x = m + 4;
    }
    placed.push({ ...s, x, w, line });
    x += w;
  }
  const lines = line + 1;
  const lineGap = fs * 0.72 + 3 + 25 + 9.5 + 16;
  const top = 6 + fs * 0.6;
  const lineY = (n: number) => top + n * lineGap;
  const stringBottom = lineY(lines - 1) + fs * 0.72 + 3 + 25 + 9.5;
  const panelY = stringBottom + 14;
  // The readout is as tall as its longest part, so the figure keeps one height from beat to beat.
  const lw = R - m - 40;
  const need = segs.map((seg) => {
    const w = what(seg);
    const n =
      wrapMono(w.head, lw, 11).length + wrapMono(w.note, lw, 11).length + wrapMono(w.rule, lw, 11).length;
    return 52 + n * 16 + 16 + 14;
  });
  const panelH = Math.max(wide ? 158 : 186, ...need);
  return { wide, fs, m, R, placed, lineY, panelY, panelH, H: panelY + panelH + 8 };
}

export default Repotag;
