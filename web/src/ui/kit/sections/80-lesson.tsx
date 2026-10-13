import { useMemo, useState } from 'react';
import {
  Breadcrumbs,
  Button,
  Callout,
  Chip,
  CodeBlock,
  Figure,
  type FigureAnnotation,
  FreshnessChip,
  Kbd,
  Markup,
  type MarkupContext,
  MarkupProvider,
  type MarkupTerm,
  Panel,
  Progress,
  SplitReveal,
  StepRail,
  type StepRailStep,
  type TabItem,
  TabPanel,
  Tabs,
} from '../..';
import { Group, type KitSectionMeta } from '../parts';

export const meta: KitSectionMeta = { id: 'lesson', title: 'Lesson', order: 80 };

const GLOSSARY: Record<string, MarkupTerm> = {
  node: {
    term: 'node',
    short: 'A computer that runs apps for the network, operated by a different person each.',
    why: 'Your app lives on several nodes at once, so one failure does not take it down.',
    href: '/glossary#node',
  },
  instance: {
    term: 'instance',
    short: 'One running copy of your app on one node. Three instances means three **different** nodes.',
    href: '/glossary#instance',
  },
  spec: {
    term: 'app spec',
    short:
      'The JSON that says which image to run, which ports to open and how much CPU and memory to ask for.',
  },
};

const STEPS: StepRailStep[] = [
  { id: 'idea', label: 'The idea' },
  { id: 'spec', label: 'Write the spec' },
  { id: 'place', label: 'Placement' },
  { id: 'check', label: 'Checkpoint', kind: 'check' },
  { id: 'break', label: 'Break it' },
  { id: 'next', label: 'Wrap up' },
];

const SPEC = `{
  "version": 8,
  "name": "hello-flux",
  "instances": 3,
  "compose": [
    {
      "name": "web",
      "repotag": "nginx:1.27-alpine",
      "ports": [31001],
      "containerPorts": [80],
      "cpu": 0.5,
      "ram": 500,
      "hdd": 2
    }
  ]
}`;

// A very small diagram: one spec, three nodes. The Figure draws its own annotation layer.
const NODES = [
  { x: 96, y: 126 },
  { x: 220, y: 126 },
  { x: 344, y: 126 },
] as const;

function hexPoints(cx: number, cy: number, r: number): string {
  return [0, 60, 120, 180, 240, 300]
    .map((deg) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    })
    .join(' ');
}

function PlacementDiagram() {
  return (
    <svg
      viewBox="0 0 440 220"
      role="img"
      aria-label="One spec at the top placing three instances on three different nodes."
      style={{ color: 'var(--accent)' }}
    >
      <title>One spec, three nodes</title>
      <rect
        x="170"
        y="24"
        width="100"
        height="36"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
      />
      <g fill="none" stroke="currentColor" strokeOpacity="0.5" strokeDasharray="3 5">
        {NODES.map((n) => (
          <path key={n.x} d={`M220 60 L${n.x} ${n.y - 38}`} />
        ))}
      </g>
      {NODES.map((n, i) => (
        <g key={n.x}>
          <polygon
            points={hexPoints(n.x, n.y, 40)}
            fill="currentColor"
            fillOpacity={0.08 + i * 0.04}
            stroke="currentColor"
          />
          <polygon
            points={hexPoints(n.x, n.y, 22)}
            fill="currentColor"
            fillOpacity="0.28"
            stroke="var(--hot-2)"
          />
        </g>
      ))}
    </svg>
  );
}

const ANNOTATIONS: FigureAnnotation[] = [
  {
    id: 'spec',
    at: [0.5, 0.27],
    side: 'tr',
    label: 'Spec',
    note: 'One JSON file describes the app once.',
  },
  {
    id: 'nodes',
    at: [0.78, 0.57],
    side: 'br',
    label: 'Instances',
    note: 'Each copy runs on a different node, chosen by the network.',
  },
];

const TABS: TabItem[] = [
  { value: 'json', label: 'JSON', icon: 'code' },
  { value: 'explain', label: 'Explain', icon: 'info' },
];

const SAMPLE_INTRO =
  'An {{term:spec}} is written once and placed many times. You ask for three {{term:instance}}s and the network chooses three different {{term:node}}s for them. Try it in the {{lab:spec-forge}}, then press {{kbd:Ctrl+K}} to find the next step.';

export default function LessonKit() {
  const [current, setCurrent] = useState('place');
  const [tab, setTab] = useState('json');
  const context = useMemo<MarkupContext>(
    () => ({
      term: (id) => GLOSSARY[id],
      lab: (id) => (id === 'spec-forge' ? { title: 'Spec Forge', href: '/labs/spec-forge' } : undefined),
      lesson: (id) => ({ title: id.replace(/-/g, ' '), href: `/learn/${id}` }),
      navigate: () => {},
    }),
    [],
  );
  const index = STEPS.findIndex((s) => s.id === current);

  return (
    <Group
      id="lesson"
      title="A lesson, composed"
      lead="Nothing new here: the primitives together, the way the lesson player uses them. A slab with a ruler, a headline that rises word by word, prose with a glossary term, a callout, a code block, and a figure with annotations."
    >
      <MarkupProvider value={context}>
        <div style={{ maxInlineSize: 880 }}>
          <Panel padding="lg" ruler="left" tone="cumulus" container>
            <div style={{ display: 'grid', gap: 20 }}>
              <Breadcrumbs
                items={[
                  { label: 'Learn', href: '/learn' },
                  { label: 'Cumulus', href: '/learn#cumulus' },
                  { label: 'Placement' },
                ]}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <Chip tier="cumulus">Cumulus</Chip>
                <Chip icon="clock">12 min</Chip>
                <Chip icon="kind-hands-on">Hands-on</Chip>
                <FreshnessChip kind="simulation" />
              </div>

              <SplitReveal as="h3" className="t-h2" immediate>
                Where your app <b className="t-grad">lands</b>
              </SplitReveal>

              <div>
                <StepRail
                  aria-label="Lesson progress"
                  steps={STEPS}
                  current={current}
                  onSelect={(id) => setCurrent(id)}
                  tier="cumulus"
                  showLabel
                />
                <div style={{ marginBlockStart: 12 }}>
                  <Progress
                    label="Track progress"
                    value={index + 1}
                    max={STEPS.length}
                    valueText={`Step ${index + 1} of ${STEPS.length}`}
                    tier="cumulus"
                    size="sm"
                  />
                </div>
              </div>

              <Markup block text={SAMPLE_INTRO} />

              <Callout kind="why">
                You never choose a machine. You describe the app and its size, and placement is the network's
                job: that is what lets one machine fail while the app keeps answering.
              </Callout>

              <div style={{ display: 'grid', gap: 12 }}>
                <Tabs
                  idBase="lesson-spec"
                  aria-label="Spec view"
                  items={TABS}
                  value={tab}
                  onValueChange={setTab}
                  variant="plate"
                  size="sm"
                >
                  <TabPanel value="json">
                    <CodeBlock lang="json" filename="flux-spec.json" highlight={[4]} code={SPEC} />
                  </TabPanel>
                  <TabPanel value="explain">
                    <Callout kind="tip" title="Read it top to bottom">
                      <Markup
                        inline
                        text="`instances` is how many copies, `compose` is what each copy runs, and `ports` is where the world connects."
                      />
                    </Callout>
                  </TabPanel>
                </Tabs>
              </div>

              <Figure
                num="2.1"
                caption="One spec, three nodes"
                note="The spec stays one file. The network turns it into three instances on three different nodes."
                ratio="440 / 220"
                annotations={ANNOTATIONS}
                legend="visible"
              >
                <PlacementDiagram />
              </Figure>

              <Callout kind="gotcha">
                The port your container listens on is not the port the world connects to. Set both in the
                spec, then check them with <Markup inline text="`docker ps`" />.
              </Callout>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span className="t-small">
                  Press <Kbd combo="Enter" /> to continue.
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="ghost" icon="arrow-left">
                    Back
                  </Button>
                  <Button variant="primary" iconEnd="arrow-right">
                    Next step
                  </Button>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </MarkupProvider>
    </Group>
  );
}
