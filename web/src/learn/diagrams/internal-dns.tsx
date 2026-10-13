/**
 * FIG: components of one app reaching each other by name. Every app gets its own private docker network;
 * on it a container is reachable as `flux<component>_<app>`, on its container port, with nothing published.
 * Only a component with a public port can be reached from outside. FACTS 3.8 and 8.2 (names, network,
 * container port between components) and 3.4 (a port is public only when it is in `ports`).
 *
 * Props: `app` (default "store") and `components` (a list of names or `{ name }` objects, default
 * web, api, cache; two to four are drawn). The names come from `derivedNames` in the shared engine.
 */

import { defaultComponent, defaultSpec, derivedNames } from '@shared/flux';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { monoWidth, pt } from './_kit/geometry';
import { Badge, Chip, chipWidth, Hex, Line, Mark, Slab, Txt } from './_kit/parts';
import { nameList, str } from './_kit/props';

export const meta: DiagramMeta = {
  id: 'internal-dns',
  title: 'Components reaching each other by name',
  beats: [
    'An app is several containers, one per component, started together on the same node.',
    'On the app private network each container answers to the name flux, the component, an underscore and the app.',
    'The frontend calls the API by that name and the container port. Nothing needs to be published.',
    'The API reaches the next component the same way, by name.',
    'Only the frontend has a public port. The other components cannot be reached from outside.',
  ],
  alt:
    'Three components of one app inside a private network. First the components, then the container name of ' +
    'each, written flux, the component name, an underscore and the app name. Then arrows from the frontend to the ' +
    'API and from the API to the last component, each labelled with the container name and port it calls. Last, ' +
    'a request from outside reaches only the frontend through its public port, while the other components have ' +
    'no public port and cannot be reached.',
};

/** The least width the row layout is used at (more when the names are long or there are many). */
const WIDE_FLOOR = 600;

/** A plausible container port from a component's name, for the example only. */
function portFor(name: string, index: number): number {
  const n = name.toLowerCase();
  if (/(web|front|ui|site|nginx|proxy)/.test(n)) return 80;
  if (/(api|back|server|app|service)/.test(n)) return 3000;
  if (/(redis|cache)/.test(n)) return 6379;
  if (/(mysql|maria)/.test(n)) return 3306;
  if (/(mongo)/.test(n)) return 27017;
  if (/(db|data|postgres|pg|sql)/.test(n)) return 5432;
  return [80, 3000, 6379, 5432][index] ?? 8080;
}

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);

const InternalDns: DiagramComponent = ({ beat, props, reducedMotion }: DiagramProps) => {
  const app = clip(str(props?.app, 'store', 12).replace(/[^a-zA-Z0-9-]/g, '') || 'store', 10);
  const names = nameList(props?.components, ['web', 'api', 'cache'], 4)
    .map((n) => clip(n, 8))
    .slice(0, 4);
  const count = Math.max(2, names.length);
  const spec = {
    ...defaultSpec(),
    name: app,
    compose: names.map((name, i) =>
      defaultComponent({ name, ports: [], containerPorts: [portFor(name, i)], domains: [] }),
    ),
  };
  const derived = derivedNames(spec);
  const comps = derived.components.map((c, i) => ({
    name: c.name,
    container: c.containerName,
    address: c.internalAddresses[0] ?? c.containerName,
    port: portFor(c.name, i),
  }));
  const publicPort = 31001;
  const wPort = chipWidth(String(publicPort));
  const network = derived.network;
  // The row layout needs every name and address to have its own stretch of the row.
  const slot = Math.max(0, ...comps.flatMap((c) => [monoWidth(c.address, 11), chipWidth(c.container)])) + 14;
  const wideMin = Math.max(WIDE_FLOOR, Math.ceil(132 + 84 + (count - 1) * slot + 78 + 36));

  return (
    <DiagramRoot
      meta={meta}
      beat={beat}
      reducedMotion={reducedMotion}
      height={(W) => (W >= wideMin ? 280 : 58 + 62 + (count - 1) * 80 + 38 + 14)}
    >
      {({ W, st }) => {
        const s0 = st(0);
        const s1 = st(1);
        const s2 = st(2);
        const s3 = st(3);
        const s4 = st(4);
        const R = W - 36;
        const wide = W >= wideMin;

        if (!wide) {
          const m = 12;
          const hx = m + 40;
          const top = 58;
          const rowY = (k: number) => top + 62 + k * 80;
          const bottom = rowY(count - 1) + 38;
          const appLabel = st(0, 0, 4);
          return (
            <>
              {/* the app, then (last beat) the outside world */}
              <Txt x={m + 4} y={24} s={appLabel} ink="lit" semi>
                {`ONE APP: ${app}`}
              </Txt>
              <Txt x={R} y={24} s={appLabel} anchor="end" caps={false} ink="dim" hot={false} delay={120}>
                {`${count} components`}
              </Txt>
              <Hex cx={hx} cy={22} r={15} s={s4} wash probe="A request from outside">
                <Txt bare x={hx} y={22} anchor="middle" caps={false} ink="lit" semi hot={false} size={9}>
                  you
                </Txt>
              </Hex>
              <Txt x={hx + 26} y={22} s={s4} ink="dim" hot={false} delay={80}>
                FROM OUTSIDE
              </Txt>
              <Line pts={[pt(hx, 40), pt(hx, top - 13)]} arrow strong flow s={s4} delay={120} />
              <Badge n={5} at={pt(R - 12, 22)} s={s4} delay={240} />

              {/* the private network */}
              <Slab
                x={m}
                y={top}
                w={R - m}
                h={bottom - top}
                s={s0}
                c={14}
                wash
                probe="The app's private docker network"
              >
                <Txt bare x={hx + 56} y={top + 17} ink="lit" semi>
                  PRIVATE NETWORK
                </Txt>
              </Slab>
              <Badge n={1} at={pt(hx + 38, top + 17)} s={s0} delay={100} />
              <Txt x={m + 36} y={top + 34} s={s1} caps={false} ink="acc" hot={false} delay={80}>
                {network}
              </Txt>
              <Chip
                x={hx - wPort / 2}
                y={top}
                text={String(publicPort)}
                s={s4}
                wash
                probe="The one public port"
                delay={160}
              />
              <Txt x={hx + wPort / 2 + 10} y={top - 15} s={s4} caps={false} ink="dim" hot={false} delay={200}>
                public port
              </Txt>

              {comps.slice(0, count).map((c, k) => {
                const y = rowY(k);
                const first = k === 0;
                const callS = k === 0 ? s2 : s3;
                return (
                  <g key={c.name}>
                    <Hex cx={hx} cy={y} r={20} s={s0} wash delay={k * 90} probe={`Component ${c.name}`}>
                      <Txt
                        bare
                        x={hx}
                        y={y}
                        anchor="middle"
                        caps={false}
                        semi
                        ink="lit"
                        hot={false}
                        size={10}
                      >
                        {String(k + 1)}
                      </Txt>
                    </Hex>
                    <Txt x={hx + 32} y={y - 12} s={s0} caps={false} ink="lit" semi delay={120 + k * 90}>
                      {c.name}
                    </Txt>
                    <Chip
                      x={hx + 32}
                      y={y + 10}
                      text={c.container}
                      s={s1}
                      wash
                      probe={`The container name of ${c.name}`}
                      delay={k * 90}
                    />
                    {!first && (
                      <>
                        <Mark
                          kind="x"
                          x={R - 14 - monoWidth('not public', 11) - 14}
                          y={y - 12}
                          s={s4}
                          tone="crit"
                          size={4.5}
                          delay={300 + k * 90}
                        />
                        <Txt
                          x={R - 14}
                          y={y - 12}
                          s={s4}
                          anchor="end"
                          caps={false}
                          tone="crit"
                          hot={false}
                          delay={300 + k * 90}
                        >
                          not public
                        </Txt>
                      </>
                    )}
                    {k < count - 1 && (
                      <>
                        <Line
                          pts={[pt(hx, y + 24), pt(hx, rowY(k + 1) - 24)]}
                          arrow
                          strong
                          flow
                          s={callS}
                          delay={k * 60}
                        />
                        <Txt
                          x={hx + 12}
                          y={(y + rowY(k + 1)) / 2 + 1}
                          s={callS}
                          caps={false}
                          ink="acc"
                          hot={false}
                          delay={200}
                        >
                          {comps[k + 1]?.address ?? ''}
                        </Txt>
                      </>
                    )}
                  </g>
                );
              })}
              <Badge n={2} at={pt(R - 12, rowY(0) + 10)} s={s1} delay={200} />
              <Badge n={3} at={pt(R - 12, (rowY(0) + rowY(1)) / 2)} s={s2} delay={240} />
              {count > 2 && <Badge n={4} at={pt(R - 12, (rowY(1) + rowY(2)) / 2)} s={s3} delay={240} />}
            </>
          );
        }

        // Wide: the network is a long slab, the components sit in a row inside it.
        const outX = 64;
        const netX = 132;
        const netY = 56;
        const netH = 196;
        const hxOf = (k: number) => netX + 84 + ((R - netX - 84 - 78) * k) / Math.max(1, count - 1);
        const yC = netY + 84;
        return (
          <>
            <Hex cx={outX} cy={yC} r={20} s={s4} wash probe="A request from outside">
              <Txt bare x={outX} y={yC} anchor="middle" caps={false} ink="lit" semi hot={false} size={10}>
                you
              </Txt>
            </Hex>
            <Txt x={outX} y={yC + 36} s={s4} anchor="middle" ink="dim" hot={false}>
              FROM OUTSIDE
            </Txt>
            <Line
              pts={[pt(outX + 24, yC), pt(netX - wPort / 2 - 4, yC)]}
              arrow
              strong
              flow
              s={s4}
              delay={120}
            />
            <Badge n={5} at={pt(outX + 8, yC - 40)} s={s4} delay={240} />

            <Slab
              x={netX}
              y={netY}
              w={R - netX}
              h={netH}
              s={s0}
              c={16}
              wash
              probe="The app's private docker network"
            >
              <Txt bare x={netX + 40} y={netY + 17} ink="dim" semi>
                PRIVATE NETWORK
              </Txt>
            </Slab>
            <Badge n={1} at={pt(netX + 20, netY + 17)} s={s0} delay={100} />
            <Txt x={R - 14} y={netY + 17} s={s1} anchor="end" caps={false} ink="acc" delay={80}>
              {network}
            </Txt>
            <Chip
              x={netX - wPort / 2}
              y={yC}
              text={String(publicPort)}
              s={s4}
              wash
              probe="The one public port"
              delay={160}
            />
            <Txt x={netX} y={yC - 26} s={s4} anchor="middle" caps={false} ink="dim" hot={false} delay={200}>
              public port
            </Txt>

            {comps.slice(0, count).map((c, k) => {
              const x = hxOf(k);
              const first = k === 0;
              const next = comps[k + 1];
              return (
                <g key={c.name}>
                  <Hex cx={x} cy={yC} r={24} s={s0} wash delay={k * 90} probe={`Component ${c.name}`}>
                    <Txt bare x={x} y={yC} anchor="middle" caps={false} semi ink="lit" hot={false} size={11}>
                      {String(k + 1)}
                    </Txt>
                  </Hex>
                  <Txt
                    x={x}
                    y={yC - 40}
                    s={s0}
                    anchor="middle"
                    caps={false}
                    ink="lit"
                    semi
                    delay={120 + k * 90}
                  >
                    {c.name}
                  </Txt>
                  <Chip
                    x={x}
                    y={yC + 44}
                    text={c.container}
                    anchor="middle"
                    s={s1}
                    wash
                    probe={`The container name of ${c.name}`}
                    delay={k * 90}
                  />
                  {!first && (
                    <>
                      <Mark
                        kind="x"
                        x={x - monoWidth('not public', 11) / 2 - 12}
                        y={yC + 74}
                        s={s4}
                        tone="crit"
                        size={5}
                        delay={300 + k * 90}
                      />
                      <Txt
                        x={x}
                        y={yC + 74}
                        s={s4}
                        anchor="middle"
                        caps={false}
                        tone="crit"
                        hot={false}
                        delay={300 + k * 90}
                      >
                        not public
                      </Txt>
                    </>
                  )}
                  {next && (
                    <>
                      <Line
                        pts={[pt(x + 28, yC), pt(hxOf(k + 1) - 28, yC)]}
                        arrow
                        strong
                        flow
                        s={k === 0 ? s2 : s3}
                        delay={k * 60}
                      />
                      <Txt
                        x={(x + hxOf(k + 1)) / 2}
                        y={yC - 14}
                        s={k === 0 ? s2 : s3}
                        anchor="middle"
                        caps={false}
                        ink="acc"
                        hot={false}
                        delay={200}
                      >
                        {next.address}
                      </Txt>
                    </>
                  )}
                </g>
              );
            })}
            <Badge n={2} at={pt(hxOf(0) - 74, yC + 44)} s={s1} delay={200} />
            <Badge n={3} at={pt((hxOf(0) + hxOf(1)) / 2, yC + 14)} s={s2} delay={240} />
            {count > 2 && <Badge n={4} at={pt((hxOf(1) + hxOf(2)) / 2, yC + 14)} s={s3} delay={240} />}
          </>
        );
      }}
    </DiagramRoot>
  );
};

export default InternalDns;
