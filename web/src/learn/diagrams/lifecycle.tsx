/**
 * FIG: one deployment, start to finish. Seven numbered stations on a spine: the spec, its signed
 * registration, the block that confirms the payment, the nodes that see it, the install, the live
 * announcement and the domain. Every width gets a metro line with a detail slab for the station in focus: a
 * wide figure names each station on the line, a phone numbers them and lets the slab carry the words.
 * FACTS 4.7, 6.1 (sequence and typical times) and 6.6 (the clocks: the message lives an hour on each node from
 * receipt, "Deployment Successful" in the UI means one copy was seen running).
 */

import { DEPLOY_ESTIMATE_MIN, INSTALL_START_USUAL_MIN, TARGET_BLOCK_SEC } from '@shared/flux';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { pt, wrapMono } from './_kit/geometry';
import { Badge, Dim, Line, Slab, Txt } from './_kit/parts';

export const meta: DiagramMeta = {
  id: 'lifecycle',
  title: 'One deployment, start to finish',
  beats: [
    'You write the spec: the containers, ports, resources, instances and length of your app.',
    'You sign it and register it. The hash of the signed message is the id your payment carries. The message lives about an hour.',
    `Your payment, carrying that hash, lands in a block about ${TARGET_BLOCK_SEC} seconds later. The spec is now on chain.`,
    'Every node reads the new app list. There is no central scheduler: each node decides alone.',
    'Nodes with room pull your image and start the containers. The image pull is usually the slow part.',
    'Each node that runs your app announces it. FluxCloud reports success once it sees one copy running, not all of them.',
    'The domain manager adds those nodes to its load balancer, and your address starts routing to them.',
  ],
  alt:
    'A seven step timeline of one deployment. One: you write the spec. Two: you sign and register it, and the hash of ' +
    `the signed message becomes its id. Three: your payment carrying that hash is confirmed in a block about ${TARGET_BLOCK_SEC} ` +
    'seconds later. Four: every node reads the app list and decides alone whether to install. Five: nodes with room ' +
    'pull the image and start the containers. Six: each node announces the app. Seven: the domain manager routes ' +
    `your address to those nodes. FluxCloud's screen says deployment takes up to ${DEPLOY_ESTIMATE_MIN} minutes after payment. That is ` +
    'its estimate, not a guarantee, and its Deployment Successful label means one copy is running, not all of them.',
};

interface Station {
  /** Short name on the metro line. */
  name: string;
  /** Title in the detail slab. */
  title: string;
  /** One line for the phone list. */
  sub: string;
  /** The sentence in the detail slab. */
  detail: string;
  /** How long this takes, honestly. */
  time: string;
}

const STATIONS: readonly Station[] = [
  {
    name: 'SPEC',
    title: 'A SPEC YOU WRITE',
    sub: 'the app as one JSON file',
    detail: 'Containers, ports, resources, instances and length, written as one JSON document.',
    time: 'you set the pace',
  },
  {
    name: 'REGISTER',
    title: 'SIGNED AND REGISTERED',
    sub: 'signed; its hash is its id',
    detail:
      'You sign the spec with your key and send it. The hash of that signed message names your app until it is paid. Each node keeps the message for an hour.',
    time: '5 to 10 seconds',
  },
  {
    name: 'BLOCK',
    title: 'CONFIRMED IN A BLOCK',
    sub: 'the payment lands in a block',
    detail:
      'Your payment carries the hash. When a block includes it, every node links the payment to your spec.',
    time: `about ${TARGET_BLOCK_SEC} seconds`,
  },
  {
    name: 'NODES',
    title: 'THE NODES SEE IT',
    sub: 'every node reads the app list',
    detail:
      'There is no central scheduler. Each node reads the list and decides alone whether to install. Bigger nodes wait before taking a small app.',
    time: `${INSTALL_START_USUAL_MIN.from} to ${INSTALL_START_USUAL_MIN.to} minutes, FluxCloud says`,
  },
  {
    name: 'INSTALL',
    title: 'INSTANCES INSTALL',
    sub: 'pull the image, start it',
    detail:
      'Nodes with room pull your image and start the containers. The image pull is usually the slow part.',
    time: 'seconds to tens of minutes',
  },
  {
    name: 'LIVE',
    title: 'THE APP IS LIVE',
    sub: 'each node announces the app',
    detail:
      'Each node that runs your app announces it. FluxCloud shows "Deployment Successful" when it sees one copy running, not all of them.',
    time: 'seconds',
  },
  {
    name: 'DOMAIN',
    title: 'THE DOMAIN ROUTES',
    sub: 'name.app.runonflux.io routes',
    detail:
      'The domain manager adds those nodes to its load balancer. Your address now sends traffic to them.',
    time: 'tens of seconds to minutes, not timed',
  },
];

/** FluxCloud's own on-screen text (FACTS 6.6, 9.5.1). A fixed label, an estimate: bigger nodes wait 57 to 117 minutes first. */
const ESTIMATE = 'FLUXCLOUD ESTIMATE, UP TO 45 MIN';
const WIDE_MIN = 544;

/** The phone figure: a numbered line, then a slab with the station in focus. Type is 11 px and up. */
const NARROW = { m: 12, spineY: 22, panelY: 52, textSize: 11, lh: 16 };

function narrowGeo(W: number) {
  const textW = W - NARROW.m * 2 - 28;
  // The slab is as tall as its longest station, so the figure keeps one height from beat to beat.
  const lines = Math.max(...STATIONS.map((s) => wrapMono(s.detail, textW, NARROW.textSize).length));
  const panelH = 14 + 18 + 10 + lines * NARROW.lh + 12 + 18 + 12;
  return { ...NARROW, textW, panelH, H: NARROW.panelY + panelH + 14 + 26 };
}

/**
 * The wide figure: the metro line names every station, and the slab under it is as tall as its longest
 * station at this width (title, sentence, then the time on a line of its own), so the figure keeps one
 * height from beat to beat.
 */
function wideGeo(W: number) {
  const m = 44;
  const panelY = 112;
  const textW = W - m * 2 - 108 - 24;
  const lines = Math.max(...STATIONS.map((s) => wrapMono(s.detail, textW, 12, 0).length));
  const timeY = 54 + (lines - 1) * 17 + 26;
  const panelH = timeY + 20;
  return { m, spineY: 56, panelY, panelH, textW, timeY, H: panelY + panelH + 18, W };
}

const Lifecycle: DiagramComponent = ({ beat, reducedMotion }: DiagramProps) => (
  <DiagramRoot
    meta={meta}
    beat={beat}
    reducedMotion={reducedMotion}
    height={(W) => (W >= WIDE_MIN ? wideGeo(W).H : narrowGeo(W).H)}
  >
    {({ W, st }) => {
      if (W < WIDE_MIN) {
        const n = narrowGeo(W);
        const x0 = n.m + 12;
        const x1 = W - n.m - 12;
        const xs = STATIONS.map((_, k) => x0 + ((x1 - x0) * k) / (STATIONS.length - 1));
        return (
          <>
            {STATIONS.map((stn, k) => {
              const s = st(k);
              const x = xs[k] ?? 0;
              const prev = xs[k - 1] ?? 0;
              return (
                <g key={stn.name}>
                  {k > 0 && <Line pts={[pt(prev + 11, n.spineY), pt(x - 11, n.spineY)]} flow s={s} />}
                  <Badge n={k + 1} at={pt(x, n.spineY)} s={s} probe={`${stn.name}: ${stn.detail}`} />
                </g>
              );
            })}

            <Slab x={n.m} y={n.panelY} w={W - n.m * 2} h={n.panelH} s={st(0)} c={12} />
            {STATIONS.map((stn, k) => {
              const s = st(k, k, k + 1);
              const lines = wrapMono(stn.detail, n.textW, n.textSize);
              const tx = n.m + 14;
              return (
                <g key={`d-${stn.name}`}>
                  <Txt x={tx} y={n.panelY + 22} s={s} semi ink="acc">
                    {`${String(k + 1).padStart(2, '0')}  ${stn.title}`}
                  </Txt>
                  <Txt
                    x={tx}
                    y={n.panelY + 50}
                    s={s}
                    caps={false}
                    size={n.textSize}
                    lh={n.lh}
                    ink="lit"
                    delay={80}
                  >
                    {lines}
                  </Txt>
                  <Txt x={tx} y={n.panelY + n.panelH - 20} s={s} ink="dim" hot={false} delay={120}>
                    {`TIME  ${stn.time.toUpperCase()}`}
                  </Txt>
                </g>
              );
            })}
            <Txt x={n.m + 2} y={n.panelY + n.panelH + 22} s={st(2)} ink="acc" semi delay={0}>
              {ESTIMATE}
            </Txt>
          </>
        );
      }

      const g = wideGeo(W);
      const span = W - g.m * 2;
      const xs = STATIONS.map((_, k) => g.m + (span * k) / (STATIONS.length - 1));
      return (
        <>
          <Dim
            a={pt(xs[2] ?? 0, g.spineY - 14)}
            b={pt(xs[6] ?? 0, g.spineY - 14)}
            offset={16}
            label={ESTIMATE}
            s={st(2)}
          />
          {STATIONS.map((stn, k) => {
            const s = st(k);
            const x = xs[k] ?? 0;
            const prev = xs[k - 1] ?? 0;
            return (
              <g key={stn.name}>
                {k > 0 && <Line pts={[pt(prev + 11, g.spineY), pt(x - 11, g.spineY)]} flow s={s} />}
                <Badge n={k + 1} at={pt(x, g.spineY)} s={s} probe={stn.detail} />
                <Txt x={x} y={g.spineY + 26} s={s} anchor="middle" semi delay={80}>
                  {stn.name}
                </Txt>
              </g>
            );
          })}

          <Slab x={g.m} y={g.panelY} w={span} h={g.panelH} s={st(0)} c={14} />
          {STATIONS.map((stn, k) => {
            const s = st(k, k, k + 1);
            const lines = wrapMono(stn.detail, g.textW, 12, 0);
            return (
              <g key={`d-${stn.name}`}>
                <Txt x={g.m + 24} y={g.panelY + 50} s={s} disp size={42} caps={false} ink="lit">
                  {String(k + 1).padStart(2, '0')}
                </Txt>
                <Txt x={g.m + 108} y={g.panelY + 30} s={s} semi ink="acc" delay={60}>
                  {stn.title}
                </Txt>
                <Txt
                  x={g.m + 108}
                  y={g.panelY + 54}
                  s={s}
                  caps={false}
                  size={12}
                  lh={17}
                  ink="lit"
                  delay={120}
                >
                  {lines}
                </Txt>
                <Txt x={g.m + 108} y={g.panelY + g.timeY} s={s} ink="dim" hot={false} delay={160}>
                  {`TIME  ${stn.time.toUpperCase()}`}
                </Txt>
              </g>
            );
          })}
        </>
      );
    }}
  </DiagramRoot>
);

export default Lifecycle;
