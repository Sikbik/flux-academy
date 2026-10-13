import { useCallback, useState } from 'react';
import {
  Annotated,
  Annotation,
  Button,
  CalloutMarker,
  Crosshair,
  DimensionLine,
  DrawContext,
  FigCaption,
  Figure,
  type FigureAnnotation,
  type FigureDimension,
  LeaderLine,
  Panel,
  TickRuler,
} from '../..';
import { Col, Grid, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'figure', title: 'Figure', order: 60 };

// ---------------------------------------------------------------------------
// The sample diagram: a hex prism (the specimen), three tier pillars and a bench ruler.
// It is a plain SVG that knows nothing about annotation; the Figure draws over it.
// ---------------------------------------------------------------------------

type P = readonly [number, number];

const pts = (list: readonly P[]) => list.map(([x, y]) => `${x},${y}`).join(' ');

/** A squashed, pointy-top hexagon centred at (cx, cy) with half-width w and half-height h. */
function hexTop(cx: number, cy: number, w: number, h: number): P[] {
  return [
    [cx, cy - h],
    [cx + w, cy - h / 2],
    [cx + w, cy + h / 2],
    [cx, cy + h],
    [cx - w, cy + h / 2],
    [cx - w, cy - h / 2],
  ];
}

const PRISM = { cx: 176, cy: 130, w: 70, h: 36, depth: 128 };
const PILLAR = { w: 19, h: 11 };
const STRATUS = { x: 560, base: 280, height: 108 };

/** The drawing's visible window, in its own units. */
const VIEW = { y: 30, w: 640, h: 330 };

/** A point in drawing units as a fraction of the content box, which is what Figure takes. */
const frac = (x: number, y: number): [number, number] => [x / VIEW.w, (y - VIEW.y) / VIEW.h];

function Pillar({ x, base, height, tier }: { x: number; base: number; height: number; tier: string }) {
  const top = hexTop(x, base - height, PILLAR.w, PILLAR.h);
  const [t0, t1, t2, t3, t4, t5] = top as [P, P, P, P, P, P];
  const left = [t4, t3, [t3[0], base + PILLAR.h], [t4[0], base + PILLAR.h / 2]] as const;
  const right = [t3, t2, [t2[0], base + PILLAR.h / 2], [t3[0], base + PILLAR.h]] as const;
  return (
    <g style={{ color: `var(--${tier})` }}>
      <polygon
        points={pts(left)}
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <polygon
        points={pts(right)}
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <polygon
        points={pts([t0, t1, t2, t3, t4, t5])}
        fill="currentColor"
        fillOpacity="0.32"
        stroke="currentColor"
      />
    </g>
  );
}

function SpecimenDiagram() {
  const { cx, cy, w, h, depth } = PRISM;
  const top = hexTop(cx, cy, w, h);
  const [t0, t1, t2, t3, t4, t5] = top as [P, P, P, P, P, P];
  const leftFace = [t4, t3, [t3[0], t3[1] + depth], [t4[0], t4[1] + depth]] as const;
  const rightFace = [t3, t2, [t2[0], t2[1] + depth], [t3[0], t3[1] + depth]] as const;
  const slabs = [34, 62, 90, 116];
  return (
    <svg
      viewBox={`0 ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      role="img"
      aria-label="A glass hexagonal prism, the specimen, with four layered slabs and three gauges. To its right, three pillars of increasing height: cumulus, nimbus and stratus."
      style={{ color: 'var(--accent)' }}
    >
      <title>The specimen and three tier pillars</title>
      {/* bench cells */}
      {[400, 480, 560].map((x) => (
        <polygon
          key={x}
          points={pts(hexTop(x, 290, 30, 17))}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.28"
        />
      ))}
      {/* light trails from the specimen to each pillar */}
      <g fill="none" stroke="currentColor" strokeOpacity="0.5" strokeDasharray="3 5">
        <path d="M246 112 Q 330 30 400 232" />
        <path d="M246 112 Q 380 20 480 202" />
        <path d="M246 112 Q 450 10 560 172" />
      </g>
      <Pillar x={400} base={280} height={48} tier="cumulus" />
      <Pillar x={480} base={280} height={78} tier="nimbus" />
      <Pillar x={STRATUS.x} base={STRATUS.base} height={STRATUS.height} tier="stratus" />

      {/* the specimen */}
      <polygon points={pts(leftFace)} fill="currentColor" fillOpacity="0.06" stroke="currentColor" />
      <polygon points={pts(rightFace)} fill="currentColor" fillOpacity="0.13" stroke="currentColor" />
      {slabs.map((d) => (
        <polygon
          key={d}
          points={pts(hexTop(cx, cy + d, w * 0.78, h * 0.78))}
          fill="currentColor"
          fillOpacity="0.05"
          stroke="currentColor"
          strokeOpacity="0.55"
        />
      ))}
      <polygon
        points={pts([t0, t1, t2, t3, t4, t5])}
        fill="currentColor"
        fillOpacity="0.2"
        stroke="var(--hot-2)"
      />
      {[190, 222, 254].map((y, i) => (
        <g key={y}>
          <circle cx="132" cy={y + i * 0} r="7" fill="none" stroke="currentColor" strokeOpacity="0.4" />
          <path
            d={`M132 ${y - 7} A7 7 0 ${i === 2 ? 1 : 0} 1 ${i === 0 ? 139 : i === 1 ? 128 : 125} ${y + (i === 0 ? 0 : 3)}`}
            fill="none"
            stroke="var(--hot-2)"
            strokeWidth="2"
          />
        </g>
      ))}

      {/* the bench ruler: an annotation part used straight inside an author's SVG. It scales
          with the drawing, so it carries no numerals that would shrink to nothing on a phone. */}
      <TickRuler x={40} y={334} length={560} step={8} major={5} side="up" baseline />
    </svg>
  );
}

// The upper corners of the prism's top face, and the stratus pillar's right-hand edge.
const CELL_L = frac(PRISM.cx - PRISM.w, PRISM.cy - PRISM.h / 2);
const CELL_R = frac(PRISM.cx + PRISM.w, PRISM.cy - PRISM.h / 2);
const STRATUS_EDGE_X = STRATUS.x + PILLAR.w;
const STRATUS_EDGE_TOP = STRATUS.base - STRATUS.height + PILLAR.h / 2;
const STRATUS_EDGE_BASE = STRATUS.base + PILLAR.h / 2;

const ANNOTATIONS: FigureAnnotation[] = [
  {
    id: 'cell',
    at: CELL_L,
    side: 'tl',
    label: 'Specimen',
    note: 'The cell: one app, drawn as a glass prism with its layers inside.',
  },
  {
    id: 'gauge',
    at: frac(132, 222),
    side: 'bl',
    label: 'Gauge',
    note: 'One of three gauge arcs: CPU, RAM and disk.',
  },
  {
    id: 'stratus',
    at: frac(STRATUS.x, STRATUS.base - STRATUS.height),
    side: 'tr',
    label: 'Stratus',
    note: 'The tallest pillar is a Stratus node, the largest tier.',
  },
];

const DIMENSIONS: FigureDimension[] = [
  {
    id: 'width',
    from: CELL_L,
    to: CELL_R,
    side: 'top',
    offset: 44,
    label: `${PRISM.w * 2} px`,
    name: 'Width of the specimen',
  },
  {
    id: 'height',
    from: frac(STRATUS_EDGE_X, STRATUS_EDGE_BASE),
    to: frac(STRATUS_EDGE_X, STRATUS_EDGE_TOP),
    side: 'right',
    offset: 22,
    label: String(STRATUS.height),
    name: 'Height of the Stratus pillar',
  },
];

// ---------------------------------------------------------------------------
// The section
// ---------------------------------------------------------------------------

/** Flips `draw` false then true so a part's draw-in can be watched again. */
function useReplay(): [boolean, () => void] {
  const [drawn, setDrawn] = useState(true);
  const replay = useCallback(() => {
    setDrawn(false);
    window.setTimeout(() => setDrawn(true), 80);
  }, []);
  return [drawn, replay];
}

function Stage({ children, w = 280, h = 150 }: { children: React.ReactNode; w?: number; h?: number }) {
  return (
    <Panel variant="slab" size="sm" padding="none" halo={false} marks={false} pattern="none">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        role="img"
        aria-label="Annotation part specimen"
        style={{ display: 'block' }}
      >
        {children}
      </svg>
    </Panel>
  );
}

export default function FigureSection() {
  const [drawn, replay] = useReplay();
  const [figureDraw, setFigureDraw] = useState<boolean | undefined>(undefined);
  const [key, setKey] = useState(0);

  const replayFigure = () => {
    setFigureDraw(false);
    setKey((k) => k + 1);
    window.setTimeout(() => setFigureDraw(true), 120);
  };

  return (
    <Group
      id="figure"
      title="Figure and annotation"
      lead="The blueprint layer: callout rings on leader lines, dimension lines, tick rulers, crosshairs and FIG captions. Every stroke draws itself in (dash offset), never fades in. Fractional coordinates follow the content box at any width."
    >
      <Row>
        <Button variant="secondary" icon="restart" onClick={replayFigure}>
          Replay the figure
        </Button>
        <Button variant="secondary" icon="restart" onClick={replay}>
          Replay the parts
        </Button>
      </Row>

      <Sub>Figure</Sub>
      <div style={{ maxWidth: 980, marginBlockStart: 16 }}>
        <Figure
          key={key}
          num="3.2"
          caption="Placement of three instances"
          note="The specimen is placed on three nodes, one of each tier. Hover the plate: the probe reads where you are."
          ratio={`${VIEW.w} / ${VIEW.h}`}
          ruler="left"
          annotations={ANNOTATIONS}
          dimensions={DIMENSIONS}
          legend="visible"
          probe
          draw={figureDraw}
        >
          <SpecimenDiagram />
        </Figure>
      </div>

      <Sub>Parts (SVG-native, for authors drawing inside an svg)</Sub>
      <DrawContext.Provider value={drawn}>
        <Grid min={300}>
          <Spec
            label="LeaderLine, straight and elbow"
            note="Dot on the object, 1 px line. Elbow runs 45 degrees, then straight."
          >
            <Stage>
              <rect
                x="20"
                y="64"
                width="64"
                height="40"
                fill="none"
                stroke="var(--accent)"
                strokeOpacity="0.6"
              />
              <rect
                x="150"
                y="84"
                width="64"
                height="40"
                fill="none"
                stroke="var(--accent)"
                strokeOpacity="0.6"
              />
              <LeaderLine from={{ x: 84, y: 70 }} to={{ x: 180, y: 28 }} />
              <LeaderLine
                from={{ x: 150, y: 110 }}
                to={{ x: 40, y: 140 }}
                route="elbow"
                dot="both"
                delay={200}
              />
            </Stage>
          </Spec>

          <Spec
            label="CalloutMarker"
            note="A ring that draws around a number; with `anchor` it brings its leader."
          >
            <Stage>
              <CalloutMarker x={60} y={40} n={1} />
              <CalloutMarker x={120} y={40} n={2} r={11} delay={120} />
              <CalloutMarker x={180} y={40} n="A" delay={240} />
              <CalloutMarker x={110} y={100} n={3} anchor={{ x: 40, y: 128 }} delay={360} />
              <CalloutMarker x={210} y={104} n={4} label="Node" anchor={{ x: 250, y: 130 }} delay={480} />
            </Stage>
          </Spec>

          <Spec
            label="Annotation (leader + ring)"
            note="Sides tl, tr, bl, br with elbows; give it a box and it flips to fit."
          >
            <Stage>
              <circle cx="140" cy="75" r="14" fill="none" stroke="var(--accent)" strokeOpacity="0.6" />
              <Annotation anchor={{ x: 132, y: 66 }} side="tl" n={1} length={40} />
              <Annotation anchor={{ x: 148, y: 66 }} side="tr" n={2} length={40} delay={150} />
              <Annotation anchor={{ x: 132, y: 84 }} side="bl" n={3} length={40} delay={300} />
              <Annotation anchor={{ x: 148, y: 84 }} side="br" n={4} length={40} delay={450} />
            </Stage>
          </Spec>

          <Spec
            label="DimensionLine, caps arrow, bar, both"
            note="Extension lines, a value set into a break in the line."
          >
            <Stage>
              <rect
                x="40"
                y="60"
                width="200"
                height="30"
                fill="none"
                stroke="var(--accent)"
                strokeOpacity="0.5"
              />
              <DimensionLine
                from={{ x: 40, y: 60 }}
                to={{ x: 240, y: 60 }}
                label="200 px"
                side="top"
                offset={22}
              />
              <DimensionLine
                from={{ x: 40, y: 90 }}
                to={{ x: 140, y: 90 }}
                label="100"
                side="bottom"
                offset={18}
                caps="bar"
                delay={250}
              />
              <DimensionLine
                from={{ x: 140, y: 90 }}
                to={{ x: 240, y: 90 }}
                label="100"
                side="bottom"
                offset={34}
                caps="both"
                delay={400}
              />
            </Stage>
          </Spec>

          <Spec label="DimensionLine, vertical" note="The value reads along the line, never upside down.">
            <Stage>
              <rect
                x="110"
                y="30"
                width="60"
                height="90"
                fill="none"
                stroke="var(--accent)"
                strokeOpacity="0.5"
              />
              <DimensionLine
                from={{ x: 110, y: 30 }}
                to={{ x: 110, y: 120 }}
                label="90"
                side="left"
                offset={26}
              />
              <DimensionLine
                from={{ x: 170, y: 30 }}
                to={{ x: 170, y: 120 }}
                label="90 px"
                side="right"
                offset={26}
                caps="bar"
                delay={200}
              />
            </Stage>
          </Spec>

          <Spec label="TickRuler" note="Minor ticks, a long one every fifth, optional mono numerals.">
            <Stage>
              <TickRuler x={20} y={40} length={204} step={6} major={5} baseline />
              <TickRuler
                x={20}
                y={120}
                length={200}
                step={8}
                major={5}
                labels
                labelEvery={1}
                valuePerTick={5}
                side="up"
                delay={200}
              />
              <TickRuler
                x={262}
                y={30}
                length={96}
                orientation="vertical"
                step={8}
                major={5}
                side="left"
                delay={400}
              />
            </Stage>
          </Spec>

          <Spec
            label="Crosshair and reticle"
            note="A thin plus, or a ring with the arms crossing it and a centre dot."
          >
            <Stage>
              <Crosshair x={50} y={60} size={11} />
              <Crosshair x={110} y={60} size={15} delay={120} />
              <Crosshair x={170} y={60} size={20} gap={4} delay={240} />
              <Crosshair x={230} y={60} size={18} ring delay={360} />
            </Stage>
          </Spec>

          <Spec
            label="Annotated over any content"
            note="An svg layer that measures its parent and draws once, in view."
          >
            <Panel variant="slab" size="sm" padding="none" halo={false} marks={false} pattern="none">
              <div style={{ position: 'relative', blockSize: 150, display: 'grid', placeItems: 'center' }}>
                <span style={{ font: '600 1.1rem var(--font-display)', color: 'var(--text-1)' }}>
                  Any element
                </span>
                <Annotated draw={drawn}>
                  {({ width, height }) => (
                    <>
                      <Annotation
                        anchor={{ x: width / 2 + 40, y: height / 2 - 8 }}
                        side="tr"
                        n={1}
                        box={{ width, height }}
                      />
                      <DimensionLine
                        from={{ x: width / 2 - 60, y: height / 2 + 14 }}
                        to={{ x: width / 2 + 60, y: height / 2 + 14 }}
                        label="120 px"
                        side="bottom"
                        offset={18}
                      />
                    </>
                  )}
                </Annotated>
              </div>
            </Panel>
          </Spec>
        </Grid>
      </DrawContext.Provider>

      <Sub>Frames and captions</Sub>
      <Grid min={320}>
        <Spec label="frame ghost, legend hidden, caption only">
          <Figure num="1.1" caption="Ghost frame" frame="ghost" ratio="16 / 7">
            <svg
              viewBox="0 0 320 140"
              role="img"
              aria-label="Three hexagons in a row"
              style={{ color: 'var(--accent)' }}
            >
              {[70, 160, 250].map((x) => (
                <polygon key={x} points={pts(hexTop(x, 70, 36, 30))} fill="none" stroke="currentColor" />
              ))}
            </svg>
          </Figure>
        </Spec>
        <Spec
          label="narrow plate, compact"
          note="Under 520 px of plate the rings shrink and their labels move into the legend."
        >
          <div style={{ maxWidth: 360 }}>
            <Figure
              num="3.3"
              caption="The same figure, narrow"
              ratio={`${VIEW.w} / ${VIEW.h}`}
              annotations={ANNOTATIONS}
              dimensions={DIMENSIONS}
            >
              <SpecimenDiagram />
            </Figure>
          </div>
        </Spec>
        <Spec
          label="frame none, annotated"
          note="No plate: the content sits on the page; the layer and caption still apply."
        >
          <Figure
            num="4.7"
            caption="A bare figure"
            frame="none"
            ratio="320 / 90"
            annotations={[
              {
                id: 'origin',
                at: [0.03, 0.66],
                n: 'A',
                label: 'Origin',
                side: 'tr',
                note: 'Where the scale starts.',
              },
              { id: 'end', at: [0.97, 0.66], n: 'B', side: 'tl', note: 'The far end of the scale.' },
            ]}
          >
            <svg
              viewBox="0 0 320 90"
              role="img"
              aria-label="A baseline with ticks"
              style={{ color: 'var(--accent)' }}
            >
              <TickRuler x={10} y={60} length={300} step={6} major={5} baseline />
            </svg>
          </Figure>
        </Spec>
        <Spec label="FigCaption on its own">
          <Col>
            <figure style={{ margin: 0 }}>
              <FigCaption
                num="5.1"
                title="Any figure element"
                note="Use FigCaption inside a plain figure when the frame is not wanted."
              />
            </figure>
          </Col>
        </Spec>
      </Grid>
    </Group>
  );
}
