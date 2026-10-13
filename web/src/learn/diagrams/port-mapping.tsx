/**
 * FIG: the two numbers of a port mapping and the app behind them. A request arrives at the node's public
 * port, Docker forwards it to the container port, and the app has to be listening there, on 0.0.0.0. The last
 * two beats show the two classic mistakes. FACTS 3.4 and 8.1 (ports[i] maps to containerPorts[i], the process
 * must listen on 0.0.0.0) and 11 rows 1 and 2.
 *
 * Props: `port` (public port, default 31001), `containerPort` (default 80) and `appPort` (the port the app
 * really listens on in the mismatch beat, default 3000).
 */

import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { pt, wrapMono } from './_kit/geometry';
import { Badge, Chip, chipWidth, Hex, Line, Mark, Slab, Txt } from './_kit/parts';
import { num } from './_kit/props';

export const meta: DiagramMeta = {
  id: 'port-mapping',
  title: 'Public port, container port, app',
  beats: [
    'The public port is the number the outside world connects to on the node. It is the first number in the spec.',
    'The container port is where Docker delivers that traffic inside the container. It is the second number.',
    'The app must listen on that port, on 0.0.0.0, which means every network interface of the container.',
    'If the app listens on a different port, the traffic arrives at a port nobody serves and every request fails.',
    'An app bound to 127.0.0.1 listens only inside its own container. Bind 0.0.0.0 and the traffic arrives.',
  ],
  alt:
    'A request reaches a node on its public port. Docker forwards it to the container port, inside the container. ' +
    'The app inside has to listen on that same port on 0.0.0.0. Two failures are shown: an app that listens on a ' +
    'different port than the spec says, so the request is refused, and an app bound to 127.0.0.1, which only ' +
    'accepts connections from inside its own container, with the fix of binding 0.0.0.0.',
};

const WIDE_MIN = 560;

const PortMapping: DiagramComponent = ({ beat, props, reducedMotion }: DiagramProps) => {
  const port = Math.round(num(props?.port, 31001, 1, 65535));
  const cport = Math.round(num(props?.containerPort, 80, 0, 65535));
  const rawApp = Math.round(num(props?.appPort, 3000, 1, 65535));
  const appPort = rawApp === cport ? (cport === 3000 ? 8080 : 3000) : rawApp;
  const specPorts = `"ports": [${port}],`;
  const specCports = `"containerPorts": [${cport}]`;
  const ways = [
    {
      addr: `127.0.0.1:${cport}`,
      kind: 'x' as const,
      tone: 'crit' as const,
      text: 'Only loopback. Docker delivers to another interface, so the request is refused.',
    },
    {
      addr: `0.0.0.0:${cport}`,
      kind: 'check' as const,
      tone: 'ok' as const,
      text: 'Every interface, so the request arrives.',
    },
  ];

  return (
    <DiagramRoot
      meta={meta}
      beat={beat}
      reducedMotion={reducedMotion}
      height={(W) => (W >= WIDE_MIN ? 372 : 462)}
    >
      {({ W, st }) => {
        const s0 = st(0);
        const s1 = st(1);
        const s2 = st(2);
        const s4 = st(4);
        const w1 = chipWidth(String(port));
        const w2 = Math.max(chipWidth(String(cport)), 36);
        const R = W - 36;
        const wide = W >= WIDE_MIN;

        // The app's listening address, per beat, and where traffic ends up.
        const listens = [
          { k: 2, addr: `0.0.0.0:${cport}`, note: 'every interface', tone: undefined, s: st(2, 2, 3) },
          {
            k: 3,
            addr: `0.0.0.0:${appPort}`,
            note: `not port ${cport}`,
            tone: 'crit' as const,
            s: st(3, 3, 4),
          },
          { k: 4, addr: `127.0.0.1:${cport}`, note: 'loopback only', tone: 'crit' as const, s: st(4) },
        ] as const;

        if (!wide) {
          const m = 12;
          const fx = m + 58;
          const nodeY = 100;
          const contY = nodeY + 56;
          const appY = contY + 60;
          const contBottom = contY + 100;
          const nodeBottom = contBottom + 12;
          const panelY = nodeBottom + 20;
          const lw = R - m - 44;
          const badLines = wrapMono(ways[0]?.text ?? '', lw, 11).length;
          const goodY = panelY + 34 + 18 + badLines * 15 + 16;
          return (
            <>
              {/* the two numbers, as written in the spec */}
              <Txt x={m + 4} y={14} s={s0} caps={false} ink="lit" semi>
                {specPorts}
              </Txt>
              <Txt x={m + 4} y={33} s={s1} caps={false} ink="lit" semi>
                {specCports}
              </Txt>

              {/* a request, and the node it reaches */}
              <Line pts={[pt(fx, 50), pt(fx, nodeY - 13)]} arrow strong flow s={s0} delay={120} />
              <Txt x={fx + 12} y={64} s={s0} ink="dim" hot={false}>
                A REQUEST
              </Txt>
              <Slab
                x={m}
                y={nodeY}
                w={R - m}
                h={nodeBottom - nodeY}
                s={s0}
                c={14}
                wash
                probe="The node: a machine run by an operator"
              >
                <Txt bare x={R - 14} y={nodeY + 17} anchor="end" semi ink="lit">
                  NODE
                </Txt>
              </Slab>
              <Chip
                x={fx - w1 / 2}
                y={nodeY}
                text={String(port)}
                s={s0}
                wash
                probe={`Public port ${port}`}
                delay={160}
              />
              <Badge n={1} at={pt(fx + w1 / 2 + 17, nodeY - 17)} s={s0} delay={200} />
              <Txt x={fx + w1 / 2 + 33} y={nodeY - 17} s={s0} ink="dim" hot={false} delay={240}>
                PUBLIC PORT
              </Txt>

              {/* Docker forwards to the container port */}
              <Slab
                x={m + 14}
                y={contY}
                w={R - m - 28}
                h={contBottom - contY}
                s={s1}
                c={12}
                wash
                probe="The container: your app in its own small world"
              >
                <Txt bare x={R - m - 14} y={contY + 17} anchor="end" semi ink="lit">
                  CONTAINER
                </Txt>
              </Slab>
              <Line pts={[pt(fx, nodeY + 12), pt(fx, contY - 13)]} arrow strong flow s={s1} delay={100} />
              <Txt x={fx + 12} y={nodeY + 22} s={s1} caps={false} ink="dim" hot={false} delay={260}>
                Docker forwards
              </Txt>
              <Chip
                x={fx - w2 / 2}
                y={contY}
                text={String(cport)}
                s={s1}
                wash
                probe={`Container port ${cport}`}
                delay={200}
              />
              <Badge n={2} at={pt(fx + w2 / 2 + 17, contY - 17)} s={s1} delay={240} />
              <Txt x={fx + w2 / 2 + 33} y={contY - 17} s={s1} ink="dim" hot={false} delay={280}>
                CONTAINER PORT
              </Txt>

              {/* the app, and whether traffic reaches it */}
              <Hex cx={fx} cy={appY} r={17} s={s2} wash probe="Your app, a process inside the container">
                <Txt bare x={fx} y={appY} anchor="middle" caps={false} ink="lit" semi hot={false} size={10}>
                  APP
                </Txt>
              </Hex>
              <Line
                pts={[pt(fx, contY + 12), pt(fx, appY - 18)]}
                arrow
                strong
                flow
                s={st(2, 2, 3)}
                delay={160}
              />
              <Mark kind="check" x={fx - 20} y={contY + 30} s={st(2, 2, 3)} tone="ok" size={5} delay={420} />
              <Line
                pts={[pt(fx, contY + 12), pt(fx, contY + 23)]}
                kind="ann"
                tone="crit"
                strong
                s={st(3)}
                delay={160}
              />
              <Mark kind="x" x={fx} y={contY + 30} s={st(3)} tone="crit" size={4.5} delay={420} />
              {listens.map((l) => {
                const x = fx + 50;
                return (
                  <g key={l.k}>
                    {l.k < 4 && <Badge n={l.k + 1} at={pt(fx + 34, appY - 12)} s={l.s} delay={200} />}
                    <Txt x={x} y={appY - 12} s={l.s} ink="dim" hot={false}>
                      LISTENS ON
                    </Txt>
                    <Txt x={x} y={appY + 5} s={l.s} caps={false} ink="lit" semi tone={l.tone} delay={80}>
                      {l.addr}
                    </Txt>
                    <Txt
                      x={x}
                      y={appY + 22}
                      s={l.s}
                      caps={false}
                      ink="dim"
                      hot={false}
                      tone={l.tone}
                      delay={140}
                    >
                      {l.note}
                    </Txt>
                  </g>
                );
              })}

              {/* the two ways to listen */}
              <Badge n={5} at={pt(m + 12, panelY + 10)} s={s4} delay={100} />
              <Txt x={m + 30} y={panelY + 10} s={s4} ink="acc" semi>
                TWO WAYS TO LISTEN
              </Txt>
              {ways.map((row, i) => {
                const y = i === 0 ? panelY + 38 : goodY;
                return (
                  <g key={row.addr}>
                    <Mark kind={row.kind} x={m + 12} y={y} s={s4} tone={row.tone} size={5} delay={i * 100} />
                    <Txt
                      x={m + 30}
                      y={y}
                      s={s4}
                      caps={false}
                      ink="lit"
                      semi
                      tone={row.tone}
                      delay={i * 100 + 40}
                    >
                      {row.addr}
                    </Txt>
                    <Txt
                      x={m + 30}
                      y={y + 18}
                      s={s4}
                      caps={false}
                      ink="dim"
                      hot={false}
                      lh={15}
                      delay={i * 100 + 100}
                    >
                      {wrapMono(row.text, lw, 11)}
                    </Txt>
                  </g>
                );
              })}
            </>
          );
        }

        // Wide: the request travels left to right, boxes inside boxes.
        const m = 24;
        const nodeX = 120;
        const nodeY = 76;
        const contX = nodeX + 168;
        const contY = nodeY + 24;
        const contH = 120;
        const yF = contY + 52;
        const nodeBottom = contY + contH + 14;
        const contW = R - 22 - contX;
        const appX = contX + contW - 74;
        const panelY = nodeBottom + 24;
        return (
          <>
            <Txt x={m} y={16} s={s0} caps={false} ink="lit" semi>
              {specPorts}
            </Txt>
            <Txt x={m} y={35} s={s1} caps={false} ink="lit" semi>
              {specCports}
            </Txt>

            <Txt x={m} y={yF - 26} s={s0} ink="dim" hot={false}>
              A REQUEST
            </Txt>
            <Line pts={[pt(m, yF), pt(nodeX - w1 / 2 - 4, yF)]} arrow strong flow s={s0} delay={120} />

            <Txt x={nodeX + 4} y={nodeY - 10} s={s0} ink="lit" semi>
              NODE
            </Txt>
            <Slab
              x={nodeX}
              y={nodeY}
              w={R - nodeX}
              h={nodeBottom - nodeY}
              s={s0}
              c={16}
              wash
              probe="The node: a machine run by an operator"
            />
            <Chip
              x={nodeX - w1 / 2}
              y={yF}
              text={String(port)}
              s={s0}
              wash
              probe={`Public port ${port}`}
              delay={160}
            />
            <Badge n={1} at={pt(nodeX + 26, yF - 26)} s={s0} delay={200} />
            <Txt x={nodeX + 42} y={yF - 26} s={s0} ink="dim" hot={false} delay={240}>
              PUBLIC PORT
            </Txt>

            <Txt x={contX + 4} y={contY - 10} s={s1} ink="lit" semi>
              CONTAINER
            </Txt>
            <Slab
              x={contX}
              y={contY}
              w={contW}
              h={contH}
              s={s1}
              c={14}
              wash
              probe="The container: your app in its own small world"
            />
            <Line
              pts={[pt(nodeX + w1 / 2 + 4, yF), pt(contX - w2 / 2 - 4, yF)]}
              arrow
              strong
              flow
              s={s1}
              delay={100}
            />
            <Txt
              x={(nodeX + w1 / 2 + contX - w2 / 2) / 2}
              y={yF + 17}
              s={s1}
              anchor="middle"
              caps={false}
              ink="dim"
              hot={false}
              delay={260}
            >
              Docker forwards
            </Txt>
            <Chip
              x={contX - w2 / 2}
              y={yF}
              text={String(cport)}
              s={s1}
              wash
              probe={`Container port ${cport}`}
              delay={200}
            />
            <Badge n={2} at={pt(contX + 26, yF - 26)} s={s1} delay={240} />
            <Txt x={contX + 42} y={yF - 26} s={s1} ink="dim" hot={false} delay={280}>
              CONTAINER PORT
            </Txt>

            <Hex cx={appX} cy={yF} r={20} s={s2} wash probe="Your app, a process inside the container">
              <Txt bare x={appX} y={yF} anchor="middle" caps={false} ink="lit" semi hot={false} size={10}>
                APP
              </Txt>
            </Hex>
            <Line
              pts={[pt(contX + w2 / 2 + 4, yF), pt(appX - 24, yF)]}
              arrow
              strong
              flow
              s={st(2, 2, 3)}
              delay={160}
            />
            <Mark
              kind="check"
              x={(contX + w2 / 2 + appX - 24) / 2}
              y={yF - 14}
              s={st(2, 2, 3)}
              tone="ok"
              size={5}
              delay={420}
            />
            <Line
              pts={[pt(contX + w2 / 2 + 4, yF), pt((contX + w2 / 2 + appX - 24) / 2 + 6, yF)]}
              kind="ann"
              tone="crit"
              strong
              s={st(3)}
              delay={160}
            />
            <Mark
              kind="x"
              x={(contX + w2 / 2 + appX - 24) / 2 + 22}
              y={yF}
              s={st(3)}
              tone="crit"
              size={5}
              delay={420}
            />
            {listens.map((l) => (
              <g key={l.k}>
                {l.k < 4 && <Badge n={l.k + 1} at={pt(appX - 52, yF + 40)} s={l.s} delay={200} />}
                <Txt x={appX} y={yF + 40} s={l.s} anchor="middle" ink="dim" hot={false}>
                  LISTENS ON
                </Txt>
                <Txt
                  x={appX}
                  y={yF + 57}
                  s={l.s}
                  anchor="middle"
                  caps={false}
                  ink="lit"
                  semi
                  tone={l.tone}
                  delay={80}
                >
                  {l.addr}
                </Txt>
                <Txt
                  x={appX}
                  y={yF + 74}
                  s={l.s}
                  anchor="middle"
                  caps={false}
                  ink="dim"
                  hot={false}
                  tone={l.tone}
                  delay={140}
                >
                  {l.note}
                </Txt>
              </g>
            ))}

            <Badge n={5} at={pt(m + 10, panelY + 8)} s={s4} delay={100} />
            <Txt x={m + 28} y={panelY + 8} s={s4} ink="acc" semi>
              TWO WAYS TO LISTEN
            </Txt>
            {ways.map((row, i) => {
              const cw = Math.floor((R - m) / 2);
              const x = m + i * cw;
              const y = panelY + 38;
              const lw = cw - 46;
              return (
                <g key={row.addr}>
                  <Mark kind={row.kind} x={x + 10} y={y} s={s4} tone={row.tone} size={5} delay={i * 100} />
                  <Txt
                    x={x + 28}
                    y={y}
                    s={s4}
                    caps={false}
                    ink="lit"
                    semi
                    tone={row.tone}
                    delay={i * 100 + 40}
                  >
                    {row.addr}
                  </Txt>
                  <Txt
                    x={x + 28}
                    y={y + 18}
                    s={s4}
                    caps={false}
                    ink="dim"
                    hot={false}
                    lh={15}
                    delay={i * 100 + 100}
                  >
                    {wrapMono(row.text, lw, 11)}
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

export default PortMapping;
