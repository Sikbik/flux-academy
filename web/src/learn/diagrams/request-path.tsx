/**
 * FIG: a request from the browser to a container. DNS answers with the Flux edge (a load balancer run by
 * Flux Domain Manager), the edge chooses among healthy instances (one is failing its health check), the
 * node forwards its public port to the container port, and the answer comes back over the same hops.
 * FACTS 6.4 (domains, HAProxy, round robin, TCP health check every 3 s, down after 2 failures) and 8.1.
 *
 * Props: `app` (default "shop"), `port` (31001), `containerPort` (80).
 */

import { FDM_EJECT_SEC } from '@shared/flux';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { monoWidth, pt } from './_kit/geometry';
import { Chip, chipWidth, Flow, Head, Hex, Line, Mark, Marker, Slab, Txt } from './_kit/parts';
import { num, str } from './_kit/props';
import type { S } from './_kit/state';

export const meta: DiagramMeta = {
  id: 'request-path',
  title: 'A request, from browser to container',
  beats: [
    "The browser asks DNS where the app's address points.",
    'DNS answers with the Flux edge, a load balancer. The browser sends its HTTPS request there.',
    `The load balancer picks a healthy instance. A failing health check takes one out within about ${FDM_EJECT_SEC} seconds.`,
    'The node forwards its public port to the container port you set in the spec.',
    'The container answers, and the reply goes back the same way.',
  ],
  alt:
    'A request path in five steps. The browser asks DNS for the app address, and DNS answers that it points at the ' +
    'Flux edge, a load balancer. The load balancer chooses one of three instances and skips the one whose health ' +
    'checks are failing. The chosen node forwards its public port to the container port from the spec, and the ' +
    "container's answer returns over the same hops.",
};

const NODES = ['A', 'B', 'C'] as const;
/** Instance B is the one failing its health check. */
const BAD = 1;
/** The load balancer chose instance A. */
const CHOSEN = 0;
const WIDE_MIN = 680;
const GUTTER = 36;
const UP = -Math.PI / 2;
const LEFT = Math.PI;
const HEX_HALF = Math.sqrt(3) / 2;

/** Text inside a hex: shares the hex's state. */
function Inner({ x, y, size = 11, children }: { x: number; y: number; size?: number; children: string }) {
  return (
    <Txt bare x={x} y={y} anchor="middle" semi caps={false} ink="lit" hot={false} size={size}>
      {children}
    </Txt>
  );
}

/** A tiny browser window glyph, centred at (x, y); k scales it. */
function Window({ x, y, k = 1 }: { x: number; y: number; k?: number }) {
  const d = `M${x - 8 * k} ${y - 6 * k}h${16 * k}v${12 * k}h${-16 * k}zM${x - 8 * k} ${y - 2 * k}h${16 * k}`;
  return <Line bare d={d} kind="ann" />;
}

const healthWord = (ok: boolean): string => (ok ? 'healthy' : 'failing');
/** The width a health mark and its word take. */
const healthW = (ok: boolean): number => 14 + monoWidth(healthWord(ok), 11);

/** A health mark and a word; `x` is the centre. */
function Health({ x, y, ok, s, delay = 0 }: { x: number; y: number; ok: boolean; s: S; delay?: number }) {
  const x0 = x - healthW(ok) / 2;
  return (
    <>
      <Mark
        kind={ok ? 'check' : 'x'}
        x={x0 + 5}
        y={y}
        s={s}
        tone={ok ? 'ok' : 'crit'}
        size={4.5}
        delay={delay}
      />
      <Txt x={x0 + 14} y={y + 1} s={s} tone={ok ? 'ok' : 'crit'} caps={false} hot={false} delay={delay + 40}>
        {healthWord(ok)}
      </Txt>
    </>
  );
}

const Request: DiagramComponent = ({ beat, props, reducedMotion }: DiagramProps) => {
  const app = str(props?.app, 'shop', 14).toLowerCase();
  const port = Math.round(num(props?.port, 31001, 1, 65535));
  const cport = Math.round(num(props?.containerPort, 80, 0, 65535));
  const host = `${app}.app.runonflux.io`;
  const portProbe = `Public port ${port} on the node goes to port ${cport} in the container`;

  return (
    <DiagramRoot
      meta={meta}
      beat={beat}
      reducedMotion={reducedMotion}
      height={(W) => (W >= WIDE_MIN ? 384 : 380)}
    >
      {({ W, st }) => {
        const s0 = st(0);
        const s1 = st(1);
        const s2 = st(2);
        const s3 = st(3);
        const s4 = st(4);
        const xM = W - 17;
        const w1 = chipWidth(String(port));
        const w2 = Math.max(chipWidth(String(cport)), 36);

        if (W < WIDE_MIN) {
          const m = 12;
          const R = W - GUTTER;
          const colX = m + 34;
          const dx = R - 20;
          const ay = 34;
          const edgeY = 108;
          const edgeH = 50;
          const nodeY = 218;
          const nr = 21;
          const nx = (k: number) => colX + ((R - 34 - colX) * k) / (NODES.length - 1);
          const detY = 308;
          const cx0 = colX - w1 / 2;
          const gap = 32;
          const c2x = cx0 + w1 + gap;
          const hexX = c2x + w2 + gap + 18;
          const ansY = detY + 54;
          const ansText = 'the answer returns the same way';
          const edgeBottom = edgeY + edgeH + 1;
          const aTop = nodeY - nr - 1;
          return (
            <>
              {/* the DNS lookup */}
              <Hex cx={colX} cy={ay} r={20} s={s0} wash probe="The browser">
                <Window x={colX} y={ay} />
              </Hex>
              <Txt x={colX} y={ay + 34} s={s0} anchor="middle">
                BROWSER
              </Txt>
              <Hex cx={dx} cy={ay} r={20} s={s0} wash probe="DNS: turns a name into an address">
                <Inner x={dx} y={ay}>
                  DNS
                </Inner>
              </Hex>
              <Line pts={[pt(colX + 23, ay - 7), pt(dx - 23, ay - 7)]} arrow s={s0} />
              <Txt
                x={(colX + dx) / 2}
                y={ay - 18}
                s={s0}
                anchor="middle"
                caps={false}
                ink="lit"
                hot={false}
                delay={120}
              >
                {`${host} ?`}
              </Txt>
              <Line pts={[pt(dx - 23, ay + 7), pt(colX + 23, ay + 7)]} arrow s={s1} />
              <Txt
                x={(colX + dx) / 2}
                y={ay + 22}
                s={s1}
                anchor="middle"
                caps={false}
                ink="acc"
                hot={false}
                delay={120}
              >
                CNAME: the Flux edge
              </Txt>
              <Marker n={1} anchor={pt(dx + 17, ay - 10)} at={pt(xM, ay - 8)} s={s0} delay={200} />

              {/* the Flux edge */}
              <Line pts={[pt(colX, ay + 46), pt(colX, edgeY - 1)]} arrow strong flow s={s1} delay={200} />
              <Txt
                x={colX + 10}
                y={(ay + 46 + edgeY) / 2 + 1}
                s={s1}
                caps={false}
                ink="dim"
                hot={false}
                delay={300}
              >
                HTTPS
              </Txt>
              <Slab
                x={m}
                y={edgeY}
                w={R - m}
                h={edgeH}
                s={s1}
                c={12}
                wash
                probe="The Flux edge: a load balancer run by Flux Domain Manager"
              >
                <Txt bare x={m + 14} y={edgeY + 18} semi ink="lit">
                  FLUX EDGE
                </Txt>
                <Txt bare x={m + 14} y={edgeY + 36} caps={false} ink="dim" hot={false}>
                  load balancer, round robin
                </Txt>
              </Slab>
              <Marker n={2} anchor={pt(R - 3, edgeY + 14)} at={pt(xM, edgeY + 14)} s={s1} delay={200} />

              {/* three instances, one failing its health check */}
              {NODES.map((n, k) => {
                const x = nx(k);
                const bad = k === BAD;
                const chosen = k === CHOSEN;
                return (
                  <g key={n}>
                    <Line
                      pts={[pt(x, edgeBottom), pt(x, aTop)]}
                      arrow={!bad}
                      kind={bad ? 'line' : 'ann'}
                      tone={bad ? 'crit' : undefined}
                      dashed={bad}
                      strong={chosen}
                      flow={chosen}
                      s={s2}
                      delay={k * 60}
                    />
                    <Hex
                      cx={x}
                      cy={nodeY}
                      r={nr}
                      s={s2}
                      tone={bad ? 'crit' : undefined}
                      wash
                      delay={60 + k * 60}
                      probe={
                        bad
                          ? 'Instance B: two health checks failed, so it gets no traffic'
                          : `Instance ${n}: healthy`
                      }
                    >
                      <Inner x={x} y={nodeY} size={12}>
                        {n}
                      </Inner>
                    </Hex>
                    <Health x={x} y={nodeY + nr + 15} ok={!bad} s={s2} delay={200} />
                  </g>
                );
              })}
              <Marker
                n={3}
                anchor={pt(nx(2) + nr * HEX_HALF + 1, nodeY)}
                at={pt(xM, nodeY)}
                s={s2}
                delay={200}
              />

              {/* the node forwards its public port to the container port */}
              <Line pts={[pt(colX, nodeY + nr + 27), pt(colX, detY - 14)]} kind="line" dashed s={s3} />
              <Chip x={cx0} y={detY} text={String(port)} s={s3} wash probe={portProbe} />
              <Line pts={[pt(cx0 + w1 + 4, detY), pt(c2x - 4, detY)]} arrow strong flow s={s3} delay={200} />
              <Chip x={c2x} y={detY} text={String(cport)} s={s3} wash probe={portProbe} />
              <Line pts={[pt(c2x + w2 + 4, detY), pt(hexX - 20, detY)]} arrow s={s3} delay={320} />
              <Hex
                cx={hexX}
                cy={detY}
                r={18}
                s={s3}
                wash
                probe="The container: your app, listening on its container port"
              >
                <Inner x={hexX} y={detY} size={10}>
                  APP
                </Inner>
              </Hex>
              <Txt x={cx0} y={detY + 24} s={s3} ink="dim" hot={false} delay={120}>
                NODE PORT
              </Txt>
              <Txt x={c2x} y={detY + 24} s={s3} ink="dim" hot={false} delay={160}>
                CONTAINER
              </Txt>
              <Marker
                n={4}
                anchor={pt(hexX + 18 * HEX_HALF + 1, detY)}
                at={pt(xM, detY)}
                s={s3}
                delay={240}
              />

              {/* the reply: the same hops, running backwards */}
              <Head at={pt(colX, ay + 46)} angle={UP} s={s4} />
              <Head at={pt(colX, edgeBottom)} angle={UP} s={s4} delay={60} />
              <Head at={pt(cx0 + w1 + 4, detY)} angle={LEFT} s={s4} delay={120} />
              <Head at={pt(c2x + w2 + 4, detY)} angle={LEFT} s={s4} delay={160} />
              <Flow pts={[pt(colX, edgeY - 1), pt(colX, ay + 46)]} s={s4} />
              <Flow pts={[pt(colX, aTop), pt(colX, edgeBottom)]} s={s4} />
              <Flow pts={[pt(colX, detY - 14), pt(colX, nodeY + nr + 27)]} s={s4} />
              <Flow pts={[pt(c2x - 4, detY), pt(cx0 + w1 + 4, detY)]} s={s4} />
              <Flow pts={[pt(hexX - 20, detY), pt(c2x + w2 + 4, detY)]} s={s4} />
              <Txt x={m + 6} y={ansY} s={s4} caps={false} ink="lit" delay={200}>
                {ansText}
              </Txt>
              <Marker
                n={5}
                anchor={pt(m + 6 + monoWidth(ansText, 11) + 8, ansY)}
                at={pt(xM, ansY)}
                s={s4}
                delay={240}
              />
            </>
          );
        }

        // Wide: the lookup runs along the top, the request path below it, left to right.
        const m = 26;
        const ay = 40;
        const bx = m + 26;
        const dnsX = W - 58;
        const edgeTop = 130;
        const nodeH = 60;
        const rowGap = 12;
        const pillarW = 128;
        const pillarR = m + pillarW;
        const nodeX = pillarR + 60;
        const nodeW = Math.min(W - nodeX - 44, 520);
        const rowTop = (k: number) => edgeTop + k * (nodeH + rowGap);
        const rowMid = (k: number) => rowTop(k) + nodeH / 2;
        const stackH = 3 * nodeH + 2 * rowGap;
        const colRight = Math.min(nodeX + nodeW + 34, xM);
        const aTopY = rowTop(CHOSEN);
        const r2y = aTopY + 42;
        const px0 = nodeX + 16;
        const chip1X = px0 + monoWidth('NODE PORT', 11, 0.08) + 8;
        const lab2X = chip1X + w1 + 34;
        const chip2X = lab2X + monoWidth('CONTAINER', 11, 0.08) + 8;
        const hexX = chip2X + w2 + 34 + 15;
        const ansY = edgeTop + stackH + 26;
        const ansText = 'the answer returns the same way';
        return (
          <>
            {/* the DNS lookup */}
            <Hex cx={bx} cy={ay} r={22} s={s0} wash probe="The browser">
              <Window x={bx} y={ay} k={1.2} />
            </Hex>
            <Txt x={bx} y={ay + 37} s={s0} anchor="middle">
              BROWSER
            </Txt>
            <Hex cx={dnsX} cy={ay} r={22} s={s0} wash probe="DNS: turns a name into an address">
              <Inner x={dnsX} y={ay}>
                DNS
              </Inner>
            </Hex>
            <Line pts={[pt(bx + 25, ay - 7), pt(dnsX - 25, ay - 7)]} arrow s={s0} />
            <Txt
              x={(bx + dnsX) / 2}
              y={ay - 19}
              s={s0}
              anchor="middle"
              caps={false}
              ink="lit"
              hot={false}
              delay={120}
            >
              {`${host} ?`}
            </Txt>
            <Line pts={[pt(dnsX - 25, ay + 7), pt(bx + 25, ay + 7)]} arrow s={s1} />
            <Txt
              x={(bx + dnsX) / 2}
              y={ay + 23}
              s={s1}
              anchor="middle"
              caps={false}
              ink="acc"
              hot={false}
              delay={120}
            >
              CNAME: the Flux edge
            </Txt>
            <Marker n={1} anchor={pt(dnsX + 19, ay - 11)} at={pt(xM, ay - 8)} s={s0} delay={200} />

            {/* the Flux edge */}
            <Line pts={[pt(bx, ay + 50), pt(bx, edgeTop - 1)]} arrow strong flow s={s1} delay={200} />
            <Txt
              x={bx + 12}
              y={(ay + 50 + edgeTop) / 2 + 1}
              s={s1}
              caps={false}
              ink="dim"
              hot={false}
              delay={300}
            >
              HTTPS
            </Txt>
            <Slab
              x={m}
              y={edgeTop}
              w={pillarW}
              h={stackH}
              s={s1}
              c={14}
              wash
              probe="The Flux edge: a load balancer run by Flux Domain Manager"
            >
              <Txt bare x={m + pillarW / 2} y={edgeTop + stackH / 2 - 16} anchor="middle" semi ink="lit">
                FLUX EDGE
              </Txt>
              <Txt
                bare
                x={m + pillarW / 2}
                y={edgeTop + stackH / 2 + 2}
                anchor="middle"
                caps={false}
                ink="dim"
                hot={false}
              >
                load balancer
              </Txt>
              <Txt
                bare
                x={m + pillarW / 2}
                y={edgeTop + stackH / 2 + 19}
                anchor="middle"
                caps={false}
                ink="dim"
                hot={false}
              >
                round robin
              </Txt>
            </Slab>
            <Marker
              n={2}
              anchor={pt(pillarR - 7, edgeTop + 1)}
              at={pt(pillarR + 30, edgeTop - 26)}
              s={s1}
              delay={200}
            />

            {/* three instances, one failing its health check */}
            {NODES.map((n, k) => {
              const y = rowTop(k);
              const mid = rowMid(k);
              const bad = k === BAD;
              const chosen = k === CHOSEN;
              return (
                <g key={n}>
                  <Line
                    pts={[pt(pillarR + 1, mid), pt(nodeX - 1, mid)]}
                    arrow={!bad}
                    kind={bad ? 'line' : 'ann'}
                    tone={bad ? 'crit' : undefined}
                    dashed={bad}
                    strong={chosen}
                    flow={chosen}
                    s={s2}
                    delay={k * 60}
                  />
                  <Slab
                    x={nodeX}
                    y={y}
                    w={nodeW}
                    h={nodeH}
                    s={s2}
                    c={12}
                    tone={bad ? 'crit' : undefined}
                    wash
                    delay={60 + k * 60}
                    probe={
                      bad
                        ? 'Instance B: two health checks failed, so it gets no traffic'
                        : `Instance ${n}: healthy`
                    }
                  >
                    <Txt bare x={px0} y={y + 20} semi ink="lit">
                      {`INSTANCE ${n}`}
                    </Txt>
                  </Slab>
                  <Health
                    x={nodeX + nodeW - 16 - healthW(!bad) / 2}
                    y={y + 20}
                    ok={!bad}
                    s={s2}
                    delay={220}
                  />
                  {bad && (
                    <Txt x={px0} y={y + 42} s={s2} caps={false} tone="crit" hot={false} delay={300}>
                      out of rotation after 2 failed checks
                    </Txt>
                  )}
                </g>
              );
            })}
            <Marker
              n={3}
              anchor={pt(nodeX + nodeW, rowMid(BAD))}
              at={pt(colRight, rowMid(BAD))}
              s={s2}
              delay={200}
            />

            {/* inside the chosen instance: public port to container port */}
            <Txt x={px0} y={r2y} s={s3} ink="dim" hot={false}>
              NODE PORT
            </Txt>
            <Chip x={chip1X} y={r2y} text={String(port)} s={s3} wash probe={portProbe} />
            <Line pts={[pt(chip1X + w1 + 4, r2y), pt(lab2X - 6, r2y)]} arrow strong flow s={s3} delay={200} />
            <Txt x={lab2X} y={r2y} s={s3} ink="dim" hot={false} delay={160}>
              CONTAINER
            </Txt>
            <Chip x={chip2X} y={r2y} text={String(cport)} s={s3} wash probe={portProbe} />
            <Line pts={[pt(chip2X + w2 + 4, r2y), pt(hexX - 17, r2y)]} arrow s={s3} delay={320} />
            <Hex
              cx={hexX}
              cy={r2y}
              r={15}
              s={s3}
              wash
              probe="The container: your app, listening on its container port"
            >
              <Inner x={hexX} y={r2y} size={9}>
                APP
              </Inner>
            </Hex>
            <Marker
              n={4}
              anchor={pt(hexX + 15 * HEX_HALF + 1, r2y)}
              at={pt(colRight, r2y)}
              s={s3}
              delay={240}
            />

            {/* the reply: the same hops, running backwards */}
            <Head at={pt(bx, ay + 50)} angle={UP} s={s4} />
            <Head at={pt(pillarR + 1, rowMid(CHOSEN))} angle={LEFT} s={s4} delay={60} />
            <Head at={pt(chip1X + w1 + 4, r2y)} angle={LEFT} s={s4} delay={120} />
            <Head at={pt(chip2X + w2 + 4, r2y)} angle={LEFT} s={s4} delay={160} />
            <Flow pts={[pt(bx, edgeTop - 1), pt(bx, ay + 50)]} s={s4} />
            <Flow pts={[pt(nodeX - 1, rowMid(CHOSEN)), pt(pillarR + 1, rowMid(CHOSEN))]} s={s4} />
            <Flow pts={[pt(lab2X - 6, r2y), pt(chip1X + w1 + 4, r2y)]} s={s4} />
            <Flow pts={[pt(hexX - 17, r2y), pt(chip2X + w2 + 4, r2y)]} s={s4} />
            <Txt x={nodeX + nodeW} y={ansY} s={s4} anchor="end" caps={false} ink="lit" delay={200}>
              {ansText}
            </Txt>
            <Marker n={5} anchor={pt(nodeX + nodeW + 8, ansY)} at={pt(colRight, ansY)} s={s4} delay={240} />
          </>
        );
      }}
    </DiagramRoot>
  );
};

export default Request;
