/**
 * FIG: the spec as a labelled object. A trimmed v8 spec (the fields a first app needs) is drawn as code, and each
 * beat marks the part it explains: the app-level fields, the compose array, one component, its resources, its
 * ports and its storage. FACTS 3.2 (top level fields), 3.3 (component fields), 3.4 (ports) and 7.1 (containerData).
 *
 * Props: `fixture` (an id from the shared fixtures, default `hello-world`).
 */

import { FIXTURES } from '@shared/flux';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { monoWidth, pt, wrapMono } from './_kit/geometry';
import { Badge, Slab, Txt } from './_kit/parts';
import { str } from './_kit/props';

export const meta: DiagramMeta = {
  id: 'spec-anatomy',
  title: 'The parts of a spec',
  beats: [
    'The app-level fields describe the whole app: its name, its owner, how many instances and how long it lives.',
    'compose is an array of containers, one entry per component, from 1 to 10.',
    'A component is one container, with its own image, resources, ports and volume.',
    'Resources are CPU in cores, RAM in MB and disk in GB. They add up across components and set the price.',
    'Ports come as two lists: the public port and the container port. They pair by position.',
    'containerData is the path of the volume. Use /tmp when nothing needs to be kept.',
  ],
  alt:
    'A trimmed app spec shown as code. Six views mark one part each: the fields about the whole app, the compose ' +
    'array that holds the containers, one component, its resources (cpu, ram and hdd), its pair of ports and its ' +
    'storage path.',
};

interface Line {
  indent: number;
  key?: string;
  value?: string;
  raw?: string;
}

/** Which lines each beat marks, as inclusive ranges. */
const RANGES: readonly (readonly [number, number][])[] = [
  [[1, 5]],
  [
    [6, 6],
    [17, 17],
  ],
  [[7, 16]],
  [[12, 14]],
  [[10, 11]],
  [[15, 15]],
];

const NOTES: readonly { title: string; text: string }[] = [
  {
    title: 'APP-LEVEL FIELDS',
    text: 'About the whole app: name, owner, how many instances and how long it lives.',
  },
  { title: 'COMPOSE', text: 'The array of containers. One entry per component, from 1 to 10 of them.' },
  {
    title: 'A COMPONENT',
    text: 'One container: its image, resources, ports and volume. Every instance runs all of them.',
  },
  {
    title: 'RESOURCES',
    text: 'CPU in cores, RAM in MB, disk in GB. They add up across components and set the price.',
  },
  { title: 'PORTS', text: 'The public port and the container port. The two lists pair by position.' },
  {
    title: 'STORAGE',
    text: 'The path of the volume inside the container. /tmp when nothing needs to be kept.',
  },
];

const num = (n: number): string => String(n);
const q = (s: string): string => `"${s}"`;
const list = (a: readonly (string | number)[]): string =>
  `[${a.map((x) => (typeof x === 'number' ? String(x) : q(x))).join(', ')}]`;

const SpecAnatomy: DiagramComponent = ({ beat, props, reducedMotion }: DiagramProps) => {
  const id = str(props?.fixture, 'hello-world', 24);
  const fx = FIXTURES.find((f) => f.id === id) ?? FIXTURES[0];
  const spec = fx?.spec;
  const c = spec?.compose[0];
  const owner = spec?.owner ?? '';
  const lines: Line[] = [
    { indent: 0, raw: '{' },
    { indent: 1, key: 'version', value: num(spec?.version ?? 8) },
    { indent: 1, key: 'name', value: q(spec?.name ?? 'hello-flux') },
    { indent: 1, key: 'owner', value: q(`${owner.slice(0, 10)}...`) },
    { indent: 1, key: 'instances', value: num(spec?.instances ?? 3) },
    { indent: 1, key: 'expire', value: num(spec?.expire ?? 88000) },
    { indent: 1, key: 'compose', value: '[' },
    { indent: 2, raw: '{' },
    { indent: 3, key: 'name', value: q(c?.name ?? 'web') },
    { indent: 3, key: 'repotag', value: q(c?.repotag ?? 'nginx:1.27') },
    { indent: 3, key: 'ports', value: list(c?.ports ?? [31001]) },
    { indent: 3, key: 'containerPorts', value: list(c?.containerPorts ?? [80]) },
    { indent: 3, key: 'cpu', value: num(c?.cpu ?? 0.1) },
    { indent: 3, key: 'ram', value: num(c?.ram ?? 100) },
    { indent: 3, key: 'hdd', value: num(c?.hdd ?? 1) },
    { indent: 3, key: 'containerData', value: q(c?.containerData ?? '/tmp') },
    { indent: 2, raw: '}' },
    { indent: 1, raw: ']' },
    { indent: 0, raw: '}' },
  ];
  const lineBeats = lines.map((_, i) =>
    RANGES.flatMap((rs, k) => (rs.some(([a, b]) => i >= a && i <= b) ? [k] : [])),
  );

  return (
    <DiagramRoot
      meta={meta}
      beat={beat}
      reducedMotion={reducedMotion}
      height={(W) => (W >= 560 ? 20 + lines.length * 18 + 16 : 16 + lines.length * 17 + 20 + 112)}
    >
      {({ W, st }) => {
        const R = W - 36;
        const wide = W >= 560;
        const m = wide ? 24 : 12;
        const lh = wide ? 18 : 17;
        const top = wide ? 20 : 16;
        const codeW = wide ? 330 : R - m;
        const adv = 6.6;
        const lineY = (i: number) => top + i * lh + lh / 2;
        const labelX = wide ? m + codeW + 40 : m + 6;
        const labelW = wide ? R - labelX : R - m - 12;
        const labelY = wide ? top + 8 : top + lines.length * lh + 22;

        return (
          <>
            <Slab x={m} y={top - 8} w={codeW} h={lines.length * lh + 16} s={st(0, [])} c={12} quiet />

            {/* what each beat marks */}
            {RANGES.map((rs, k) =>
              rs.map(([a, b]) => (
                <Slab
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered layout
                  key={`hl-${k}-${a}`}
                  x={m + 6}
                  y={lineY(a) - lh / 2 + 1}
                  w={codeW - 12}
                  h={(b - a + 1) * lh - 2}
                  s={st(k, k, k + 1)}
                  c={5}
                  cm={2}
                  wash
                />
              )),
            )}

            {lines.map((ln, i) => {
              const s = st(0, lineBeats[i] ?? []);
              const x = m + 16 + ln.indent * 2 * adv;
              const y = lineY(i);
              if (ln.raw !== undefined) {
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed listing
                  <Txt key={i} x={x} y={y} s={s} caps={false} ink="dim" hot={false} delay={i * 25}>
                    {ln.raw}
                  </Txt>
                );
              }
              const keyText = `"${ln.key}": `;
              const trailing =
                i < lines.length - 1 && lines[i + 1]?.raw !== '}' && lines[i + 1]?.raw !== ']' ? ',' : '';
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed listing
                <g key={i}>
                  <Txt x={x} y={y} s={s} caps={false} ink="acc" hot={false} delay={i * 25}>
                    {keyText}
                  </Txt>
                  <Txt x={x + monoWidth(keyText, 11)} y={y} s={s} caps={false} ink="lit" delay={i * 25 + 30}>
                    {`${ln.value ?? ''}${ln.value === '[' ? '' : trailing}`}
                  </Txt>
                </g>
              );
            })}

            {/* the note for the part in focus */}
            {NOTES.map((n, k) => {
              const s = st(k, k, k + 1);
              return (
                <g key={n.title}>
                  <Badge n={k + 1} at={pt(labelX + 8, labelY)} s={s} delay={120} />
                  <Txt x={labelX + 28} y={labelY} s={s} ink="acc" semi delay={160}>
                    {n.title}
                  </Txt>
                  <Txt x={labelX} y={labelY + 30} s={s} caps={false} ink="lit" lh={16} delay={220}>
                    {wrapMono(n.text, labelW, 11)}
                  </Txt>
                </g>
              );
            })}
          </>
        );
      }}
    </DiagramRoot>
  );
};

export default SpecAnatomy;
