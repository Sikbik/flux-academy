/**
 * FIG: from recipe to running image. A Dockerfile is built into read-only layers, the image gets a name
 * and tag, it is pushed to a registry, and the nodes that take your app pull it. FACTS 3.3 (public image,
 * 5 GB of compressed layers, amd64), 6.1 row 11 (the pull is the slow part) and 6.3 (a digest re-check every
 * 6 h, then a soft redeploy; read from source, not observed live).
 * Docker behaviour (which instructions add a layer) is standard Docker and is labelled as such.
 *
 * Props: `dockerfile` (up to 6 lines, default the node:22-alpine file the lessons build) and `repotag`
 * (default `sam/hello-flux:1.0.0`).
 */

import type { ReactNode } from 'react';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { monoWidth, pt } from './_kit/geometry';
import { Badge, Chip, chipWidth, Hex, Line, Plate, Slab, Txt } from './_kit/parts';
import { str } from './_kit/props';

export const meta: DiagramMeta = {
  id: 'container-layers',
  title: 'From Dockerfile to running image',
  beats: [
    'A Dockerfile is a recipe: a base image, then the steps that add your app.',
    'Docker runs the recipe one instruction at a time. Each one that changes files adds a read-only layer.',
    'The stack of layers is the image. A name and a tag make it findable.',
    'Pushing uploads the layers to a registry. Flux nodes pull from it without credentials, unless the app is an enterprise app.',
    'Every node that takes your app pulls the image from the registry. The pull is usually the slow part.',
  ],
  alt:
    'A pipeline in five steps. A Dockerfile of four lines. Docker builds it into a stack of read-only layers: a base ' +
    'image, a folder and your file, with the start command kept as a setting. The stack is the image and carries a ' +
    'name and a tag. It is pushed to a registry. Three nodes then pull the same image from the registry.',
};

const DEFAULT_FILE = ['FROM node:22-alpine', 'WORKDIR /app', 'COPY server.js .', 'CMD ["node", "server.js"]'];
const DEFAULT_TAG = 'sam/hello-flux:1.0.0';
const WIDE_MIN = 560;

interface Step {
  op: string;
  /** As written in the file. */
  args: string;
  /** For a label: a JSON array flattened to words. */
  plain: string;
  layer: boolean;
  note: string;
}

const LAYER_OPS: Record<string, string> = {
  FROM: 'the base image',
  WORKDIR: 'adds the folder',
  COPY: 'adds your files',
  ADD: 'adds your files',
  RUN: 'adds what it installs',
};

function flatten(args: string): string {
  if (args.startsWith('[') && args.endsWith(']')) {
    try {
      const v: unknown = JSON.parse(args);
      if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return (v as string[]).join(' ');
    } catch {
      // Not JSON: show it as written.
    }
  }
  return args;
}

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}...` : s);

function readSteps(v: unknown): Step[] {
  const lines =
    Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string')
      ? (v as string[]).slice(0, 6)
      : DEFAULT_FILE;
  return lines.map((raw) => {
    const t = raw.trim();
    const i = t.indexOf(' ');
    const op = (i < 0 ? t : t.slice(0, i)).toUpperCase();
    const args = clip(i < 0 ? '' : t.slice(i + 1).trim(), 26);
    const layer = op in LAYER_OPS;
    return {
      op,
      args,
      plain: clip(flatten(args), 18),
      layer,
      note: layer ? (LAYER_OPS[op] as string) : 'a setting, no files',
    };
  });
}

const ContainerLayers: DiagramComponent = ({ beat, props, reducedMotion }: DiagramProps) => {
  const steps = readSteps(props?.dockerfile);
  const tag = str(props?.repotag, DEFAULT_TAG, 60);
  // Layers stack bottom to top in file order; settings ride on top as one strip.
  const layers = steps.filter((s) => s.layer);
  const settings = steps.filter((s) => !s.layer);
  const rows = layers.length + (settings.length ? 1 : 0);
  const n = steps.length;

  return (
    <DiagramRoot
      meta={meta}
      beat={beat}
      reducedMotion={reducedMotion}
      height={(W) => (W >= WIDE_MIN ? 44 + rows * 46 + 124 : 8 + 38 + n * 18 + 40 + rows * 32 + 232)}
    >
      {({ W, st }) => {
        const s0 = st(0);
        const s1 = st(1);
        const s2 = st(2);
        const s3 = st(3);
        const s4 = st(4);
        const m = 12;
        const R = W - 36;
        const tagW = chipWidth(tag);

        const dockerfile = (x: number, y: number, w: number): ReactNode => (
          <>
            <Slab
              x={x}
              y={y}
              w={w}
              h={38 + n * 18}
              s={s0}
              c={12}
              wash
              probe="The Dockerfile: the recipe, one instruction per line"
            >
              <Txt bare x={x + 40} y={y + 17} semi ink="lit">
                DOCKERFILE
              </Txt>
            </Slab>
            <Badge n={1} at={pt(x + 20, y + 17)} s={s0} delay={100} />
            {steps.map((step, i) => {
              const ly = y + 44 + i * 18;
              const opW = monoWidth(`${step.op} `, 11);
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: ordered file lines
                <g key={i}>
                  <Txt x={x + 14} y={ly} s={s0} caps={false} ink="acc" semi delay={140 + i * 50}>
                    {step.op}
                  </Txt>
                  <Txt x={x + 14 + opW} y={ly} s={s0} caps={false} ink="lit" hot={false} delay={160 + i * 50}>
                    {step.args}
                  </Txt>
                </g>
              );
            })}
          </>
        );

        /** The stack of plates, bottom plate first so higher ones paint over lower ones. */
        const stack = (cx: number, top: number, pitch: number, w: number, h: number, labelX: number) => {
          const yOf = (rowFromTop: number) => top + rowFromTop * pitch + h / 2;
          const out: ReactNode[] = [];
          layers.forEach((l, i) => {
            const y = yOf(rows - 1 - i);
            out.push(
              <g
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered layout
                key={`layer-${l.op}-${l.args}-${i}`}
              >
                <Plate
                  cx={cx}
                  cy={y}
                  w={w}
                  h={h}
                  t={7}
                  s={s1}
                  delay={i * 110}
                  probe={`${l.op} ${l.args}: ${l.note}`}
                />
                <Txt x={labelX} y={y - 3} s={s1} caps={false} ink="lit" semi delay={120 + i * 110}>
                  {`${l.op} ${l.plain}`}
                </Txt>
                <Txt x={labelX} y={y + 13} s={s1} caps={false} ink="dim" hot={false} delay={160 + i * 110}>
                  {l.note}
                </Txt>
              </g>,
            );
          });
          if (settings.length) {
            const y = yOf(0);
            const text = clip(settings.map((x) => `${x.op} ${x.plain}`).join(' '), 24);
            out.push(
              <g key="settings">
                <Plate
                  cx={cx}
                  cy={y}
                  w={w * 0.7}
                  h={h * 0.7}
                  t={3}
                  s={s1}
                  delay={layers.length * 110}
                  wash={false}
                />
                <Txt
                  x={labelX}
                  y={y - 3}
                  s={s1}
                  caps={false}
                  ink="lit"
                  semi
                  delay={120 + layers.length * 110}
                >
                  {text}
                </Txt>
                <Txt
                  x={labelX}
                  y={y + 13}
                  s={s1}
                  caps={false}
                  ink="dim"
                  hot={false}
                  delay={160 + layers.length * 110}
                >
                  a setting, no files
                </Txt>
              </g>,
            );
          }
          return out;
        };

        const node = (x: number, y: number, k: number, r: number, delay: number) => (
          <Hex
            key={`node-${k}`}
            cx={x}
            cy={y}
            r={r}
            s={s4}
            wash
            delay={delay}
            probe="A node that took your app and pulled the image"
          >
            <Txt bare x={x} y={y} anchor="middle" caps={false} semi ink="lit" hot={false} size={10}>
              {['A', 'B', 'C'][k] as string}
            </Txt>
          </Hex>
        );

        if (W < WIDE_MIN) {
          const dTop = 8;
          const dH = 38 + n * 18;
          const buildY = dTop + dH + 4;
          const sTop = buildY + 38;
          const pitch = 32;
          const cx = m + 52;
          const stackBottom = sTop + rows * pitch;
          const tagY = stackBottom + 14;
          const regTop = tagY + 36;
          const regH = 44;
          const nodesY = regTop + regH + 46;
          return (
            <>
              {dockerfile(m, dTop, R - m)}

              <Line pts={[pt(cx, buildY), pt(cx, buildY + 28)]} arrow strong flow s={s1} />
              <Txt x={cx + 12} y={buildY + 14} s={s1} caps={false} ink="dim" hot={false} delay={120}>
                docker build
              </Txt>
              <Badge n={2} at={pt(R - 70, buildY + 14)} s={s1} delay={200} />
              <Txt x={R - 54} y={buildY + 14} s={s1} ink="acc" semi delay={240}>
                IMAGE
              </Txt>
              {stack(cx, sTop, pitch, 84, 24, cx + 56)}

              <Badge n={3} at={pt(m + 12, tagY)} s={s2} delay={160} />
              <Chip x={m + 30} y={tagY} text={tag} s={s2} wash probe="The image name and tag" />

              <Line pts={[pt(cx, tagY + 14), pt(cx, regTop - 4)]} arrow strong flow s={s3} />
              <Txt
                x={cx + 12}
                y={(tagY + regTop) / 2 + 7}
                s={s3}
                caps={false}
                ink="dim"
                hot={false}
                delay={120}
              >
                docker push
              </Txt>
              <Slab
                x={m}
                y={regTop}
                w={R - m}
                h={regH}
                s={s3}
                c={12}
                wash
                probe="A registry: a store for images, such as Docker Hub"
              >
                <Txt bare x={m + 40} y={regTop + regH / 2} semi ink="lit">
                  REGISTRY
                </Txt>
                <Txt bare x={R - 14} y={regTop + regH / 2} anchor="end" caps={false} ink="dim" hot={false}>
                  Docker Hub
                </Txt>
              </Slab>
              <Badge n={4} at={pt(m + 20, regTop + regH / 2)} s={s3} delay={160} />

              {[0, 1, 2].map((k) => {
                const x = m + 40 + ((R - m - 80) * k) / 2;
                return (
                  <g key={`pull-${k}`}>
                    <Line
                      pts={[pt(x, regTop + regH + 4), pt(x, nodesY - 20)]}
                      arrow
                      strong={k === 0}
                      flow={k === 0}
                      s={s4}
                      delay={k * 80}
                    />
                    {node(x, nodesY, k, 16, 120 + k * 80)}
                  </g>
                );
              })}
              <Txt x={m + 52} y={regTop + regH + 24} s={s4} caps={false} ink="dim" hot={false} delay={120}>
                pull
              </Txt>
              <Badge n={5} at={pt(m + 12, nodesY + 40)} s={s4} delay={200} />
              <Txt x={m + 30} y={nodesY + 40} s={s4} caps={false} ink="dim" hot={false} delay={240}>
                each node pulls, then starts it
              </Txt>
            </>
          );
        }

        // Wide: the recipe and the image on top, the registry and the nodes below. The second row sits
        // under the stack when there is room, and slides left, toward the recipe, when there is not.
        const mw = 24;
        const extra = Math.max(0, W - 688);
        const dW = 196 + Math.min(extra * 0.1, 30);
        const pitch = 46;
        const top = 44;
        const cx = mw + dW + 36 + 50 + extra * 0.18;
        const labelX = cx + 62;
        const stackBottom = top + rows * pitch;
        const tagY = stackBottom + 12;
        const regW = 120;
        const regTop = tagY - 12;
        const regH = 100;
        const need = tagW + 44 + regW + 60;
        const chipX = Math.max(mw + 24, Math.min(cx - tagW / 2, R - 14 - need));
        const slack = Math.max(0, R - 14 - (chipX + need));
        const regX = chipX + tagW + 44 + Math.min(20, slack * 0.5);
        const nodeX = regX + regW + 46 + Math.min(10, slack * 0.25);
        return (
          <>
            {dockerfile(mw, top, dW)}
            <Line pts={[pt(mw + dW + 4, top + 60), pt(cx - 64, top + 60)]} arrow strong flow s={s1} />
            <Txt
              x={(mw + dW + cx - 64) / 2}
              y={top + 46}
              s={s1}
              anchor="middle"
              caps={false}
              ink="dim"
              hot={false}
              delay={120}
            >
              docker build
            </Txt>
            <Badge n={2} at={pt(cx - 50, top - 22)} s={s1} delay={200} />
            <Txt x={cx - 34} y={top - 22} s={s1} ink="acc" semi delay={240}>
              IMAGE: READ-ONLY LAYERS
            </Txt>
            {stack(cx, top, pitch, 112, 34, labelX)}

            <Chip x={chipX} y={tagY + 10} text={tag} s={s2} wash probe="The image name and tag" />
            <Badge n={3} at={pt(chipX - 18, tagY + 10)} s={s2} delay={160} />

            <Line pts={[pt(chipX + tagW + 4, tagY + 10), pt(regX - 4, tagY + 10)]} arrow strong flow s={s3} />
            <Txt
              x={(chipX + tagW + regX) / 2}
              y={tagY - 6}
              s={s3}
              anchor="middle"
              caps={false}
              ink="dim"
              hot={false}
              delay={120}
            >
              push
            </Txt>
            <Slab
              x={regX}
              y={regTop}
              w={regW}
              h={regH}
              s={s3}
              c={12}
              wash
              probe="A registry: a store for images, such as Docker Hub"
            >
              <Txt bare x={regX + 38} y={regTop + 22} semi ink="lit">
                REGISTRY
              </Txt>
              <Txt bare x={regX + 14} y={regTop + 48} caps={false} ink="dim" hot={false}>
                Docker Hub
              </Txt>
            </Slab>
            <Badge n={4} at={pt(regX + 20, regTop + 22)} s={s3} delay={160} />

            {[0, 1, 2].map((k) => {
              const y = regTop + 18 + k * 32;
              return (
                <g key={`pull-${k}`}>
                  <Line
                    pts={[pt(regX + regW + 4, y), pt(nodeX - 21, y)]}
                    arrow
                    strong={k === 0}
                    flow={k === 0}
                    s={s4}
                    delay={k * 80}
                  />
                  {node(nodeX, y, k, 14, 120 + k * 80)}
                </g>
              );
            })}
            <Badge n={5} at={pt(nodeX + 14 - 99 - 18, regTop + regH + 14)} s={s4} delay={200} />
            <Txt
              x={nodeX + 14}
              y={regTop + regH + 14}
              s={s4}
              anchor="end"
              caps={false}
              ink="dim"
              hot={false}
              delay={240}
            >
              each node pulls
            </Txt>
          </>
        );
      }}
    </DiagramRoot>
  );
};

export default ContainerLayers;
