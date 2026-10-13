import { LIMITS } from '@shared/flux';
import { useId, useRef } from 'react';
import { anchor } from '@/content/reference';
import { FREE_PORT_EXAMPLE } from '@/content/reference/examples';
import { FDM } from '@/content/reference/facts';
import { buildRequestPath } from '@/content/reference/networking';
import { FigCaption, useElementSize } from '@/ui';
import { Slab } from '../../parts/Facts';
import { CopyLink, Section } from '../../parts/Heading';
import { Md } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import styles from './networking.module.css';

const STEPS = buildRequestPath();

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface NodeSpec {
  id: string;
  title: string;
  lines: readonly string[];
  hot?: boolean;
  dashed?: boolean;
}

/** A box with its top right and bottom left corners cut, like every slab in the system. */
function cut(b: Box, c = 9): string {
  const { x, y, w, h } = b;
  return `M${x} ${y + 3} L${x + 3} ${y} L${x + w - c} ${y} L${x + w} ${y + c} L${x + w} ${y + h - 3} L${x + w - 3} ${y + h} L${x + c} ${y + h} L${x} ${y + h - c} Z`;
}

function Marker({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g className={styles.marker} transform={`translate(${x} ${y})`}>
      <circle r={10} />
      <text textAnchor="middle" dy="0.35em">
        {n}
      </text>
    </g>
  );
}

/**
 * The path of one request, drawn by hand. Two layouts of the same model: a row for wide boxes and a
 * column for phones, picked from the width of the figure itself. The numbers match the steps below.
 */
export function RequestPath() {
  const wrap = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(wrap);
  const narrow = width > 0 && width < 640;
  const uid = useId();
  const arrow = `${uid}-arrow`;
  const suffix = LIMITS.appDomainSuffix;

  const nodes: Record<string, NodeSpec> = {
    browser: { id: 'browser', title: 'Browser', lines: ['asks for', `my-app.${suffix}`] },
    dns: { id: 'dns', title: 'DNS', lines: ['CNAME to the', 'load balancer'], dashed: true },
    lb: { id: 'lb', title: 'Load balancer', lines: ['HAProxy, ends TLS', 'picks an instance'] },
    node: { id: 'node', title: 'Node', lines: ['public port', `ports[i], e.g. ${FREE_PORT_EXAMPLE}`] },
    container: {
      id: 'container',
      title: 'Container',
      lines: ['containerPorts[i]', 'listens on 0.0.0.0'],
      hot: true,
    },
  };

  // Wide: a row. Four boxes on the main line and DNS above it, off to the side.
  const widths = { browser: 200, lb: 176, node: 168, container: 168 } as const;
  const total = widths.browser + widths.lb + widths.node + widths.container;
  const gap = (920 - total) / 3;
  const rowY = 150;
  const rowH = 90;
  const lbX = widths.browser + gap;
  const nodeX = lbX + widths.lb + gap;
  const containerX = nodeX + widths.node + gap;
  const wideBoxes = {
    browser: { x: 0, y: rowY, w: widths.browser, h: rowH },
    dns: { x: 240, y: 12, w: 200, h: 72 },
    lb: { x: lbX, y: rowY, w: widths.lb, h: rowH },
    node: { x: nodeX, y: rowY, w: widths.node, h: rowH },
    container: { x: containerX, y: rowY, w: widths.container, h: rowH },
  } satisfies Record<string, Box>;

  // Narrow: a column, in the order things happen.
  const col = (i: number): Box => ({ x: 0, y: i * 132, w: 288, h: 80 });
  const narrowBoxes = {
    browser: col(0),
    dns: col(1),
    lb: col(2),
    node: col(3),
    container: col(4),
  } satisfies Record<string, Box>;
  const NARROW_EDGES = [
    'looks the name up',
    'then connects over HTTPS',
    'plain HTTP to the port',
    'Docker forwards',
  ] as const;

  const view = narrow ? '0 0 340 600' : '0 0 920 262';
  const b = narrow ? narrowBoxes : wideBoxes;
  const mid = (box: Box) => box.y + box.h / 2;

  const edge = (d: string, dashed = false) => (
    <path
      d={d}
      className={styles.edge}
      data-dashed={dashed ? 'true' : undefined}
      markerEnd={`url(#${arrow})`}
    />
  );

  return (
    <Section id="request-path">
      <div ref={wrap} className={styles.figureWrap}>
        <Slab padded>
          <figure className={styles.figure}>
            <svg
              viewBox={view}
              className={styles.svg}
              data-layout={narrow ? 'narrow' : 'wide'}
              role="img"
              aria-label="A request goes from the browser to the load balancer, to the public port of a node, and on to the container port."
            >
              <defs>
                <marker
                  id={arrow}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0 L10 5 L0 10 z" className={styles.arrowHead} />
                </marker>
              </defs>

              {(Object.keys(nodes) as (keyof typeof nodes)[]).map((key) => {
                const n = nodes[key];
                const box = (b as Record<string, Box>)[key];
                if (!n || !box) return null;
                return (
                  <g
                    key={key}
                    className={styles.node}
                    data-hot={n.hot ? 'true' : undefined}
                    data-dashed={n.dashed ? 'true' : undefined}
                  >
                    <path d={cut(box)} />
                    <text x={box.x + 14} y={box.y + 28} className={styles.nodeTitle}>
                      {n.title}
                    </text>
                    {n.lines.map((line, i) => (
                      <text key={line} x={box.x + 14} y={box.y + 50 + i * 17} className={styles.nodeLine}>
                        {line}
                      </text>
                    ))}
                  </g>
                );
              })}

              {narrow ? (
                <>
                  {[b.browser, b.dns, b.lb, b.node].map((from, i) => {
                    const to = [b.dns, b.lb, b.node, b.container][i];
                    if (!to) return null;
                    const x = 144;
                    return (
                      <g key={NARROW_EDGES[i]}>
                        {edge(`M${x} ${from.y + from.h + 2} L${x} ${to.y - 3}`, i < 2)}
                        <text x={x + 14} y={from.y + from.h + 30} className={styles.edgeLabel}>
                          {NARROW_EDGES[i]}
                        </text>
                      </g>
                    );
                  })}
                  <Marker n={1} x={b.dns.w + 26} y={b.dns.y + 24} />
                  <Marker n={2} x={b.lb.w + 26} y={b.lb.y + 24} />
                  <Marker n={3} x={b.lb.w + 26} y={b.lb.y + 56} />
                  <Marker n={4} x={b.node.w + 26} y={b.node.y + 40} />
                  <Marker n={5} x={b.node.w + 26} y={b.node.y + b.node.h + 26} />
                  <Marker n={6} x={b.container.w + 26} y={b.container.y + 40} />
                </>
              ) : (
                <>
                  {edge(
                    `M${b.browser.x + 100} ${b.browser.y - 2} C${b.browser.x + 100} 62 168 48 ${b.dns.x - 3} 48`,
                    true,
                  )}
                  <text x={b.browser.x + 112} y={112} className={styles.edgeLabel}>
                    looks the name up
                  </text>
                  {edge(`M${b.dns.x + 100} ${b.dns.y + b.dns.h + 2} L${b.lb.x + 88} ${b.lb.y - 3}`, true)}
                  <text x={b.lb.x + 100} y={120} className={styles.edgeLabel}>
                    resolves to it
                  </text>
                  {edge(`M${b.browser.x + b.browser.w + 3} ${mid(b.browser)} L${b.lb.x - 3} ${mid(b.lb)}`)}
                  <text
                    x={b.browser.x + b.browser.w + 5}
                    y={mid(b.browser) - 10}
                    className={styles.edgeLabel}
                  >
                    HTTPS {FDM.httpsPort}
                  </text>
                  {edge(`M${b.lb.x + b.lb.w + 3} ${mid(b.lb)} L${b.node.x - 3} ${mid(b.node)}`)}
                  <text x={b.lb.x + b.lb.w + 14} y={mid(b.lb) - 10} className={styles.edgeLabel}>
                    HTTP
                  </text>
                  {edge(
                    `M${b.node.x + b.node.w + 3} ${mid(b.node)} L${b.container.x - 3} ${mid(b.container)}`,
                  )}
                  <text x={b.node.x + b.node.w + 10} y={mid(b.node) - 10} className={styles.edgeLabel}>
                    Docker
                  </text>
                  <Marker n={1} x={b.dns.x + b.dns.w - 16} y={b.dns.y + 18} />
                  <Marker n={2} x={b.lb.x + 18} y={b.lb.y - 16} />
                  <Marker n={3} x={b.lb.x + 48} y={b.lb.y - 16} />
                  <Marker n={4} x={b.node.x + 18} y={b.node.y - 16} />
                  <Marker n={5} x={b.node.x + b.node.w + gap / 2} y={mid(b.node) + 28} />
                  <Marker n={6} x={b.container.x + 18} y={b.container.y - 16} />
                </>
              )}
            </svg>
            <FigCaption
              num="1"
              title="One request, from the browser to your process"
              note="The numbers match the steps below. A custom domain adds one DNS record and changes nothing else on the path."
            />
          </figure>
        </Slab>
      </div>

      <Slab>
        <ol className={styles.pathSteps}>
          {STEPS.map((s, i) => {
            const id = anchor.pathStep(s.id);
            return (
              <li key={s.id} id={id} className={styles.pathStep}>
                <span className={styles.pathNum} aria-hidden="true">
                  {i + 1}
                </span>
                <div className={styles.pathBody}>
                  <p className={styles.pathTitle}>
                    <span>{s.title}</span>
                    <CopyLink id={id} label={s.title} className={styles.pathLink} />
                  </p>
                  <p className={styles.pathText}>
                    <Md text={s.text} />
                  </p>
                  <ProvChips prov={s.prov} />
                </div>
              </li>
            );
          })}
        </ol>
      </Slab>
    </Section>
  );
}
