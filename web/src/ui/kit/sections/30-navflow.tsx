import { type CSSProperties, useState } from 'react';
import {
  Accordion,
  AccordionItem,
  type BreadcrumbItem,
  Breadcrumbs,
  Button,
  SegmentedControl,
  type SegmentOption,
  StepRail,
  type StepRailStep,
  type TabItem,
  TabPanel,
  Tabs,
} from '../..';
import { Col, Grid, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'navflow', title: 'Navigation', order: 30 };

const VIEWS: TabItem[] = [
  { value: 'form', label: 'Form', icon: 'sliders' },
  { value: 'json', label: 'JSON', icon: 'code' },
  { value: 'yaml', label: 'YAML', icon: 'file' },
  { value: 'diff', label: 'Diff', icon: 'layers', count: 3 },
  { value: 'history', label: 'History', disabled: true },
];

const PLATES: TabItem[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'components', label: 'Components', count: 4 },
  { value: 'domains', label: 'Domains' },
  { value: 'logs', label: 'Logs', icon: 'terminal' },
];

const MANY: TabItem[] = [
  'Overview',
  'Deploy',
  'Domains',
  'Volumes',
  'Env',
  'Scaling',
  'Failover',
  'Logs',
  'Billing',
  'Renewals',
  'Members',
  'Danger zone',
].map((label) => ({ value: label.toLowerCase().replace(/ /g, '-'), label }));

const ROUTES: TabItem[] = [
  { value: 'overview', label: 'Overview', href: '#navflow-route-overview' },
  { value: 'components', label: 'Components', href: '#navflow-route-components', count: 4 },
  { value: 'domains', label: 'Domains', href: '#navflow-route-domains' },
];

const FORCED_TABS: TabItem[] = [
  { value: 'rest', label: 'At rest' },
  { value: 'hover', label: 'Hover', force: 'hover' },
  { value: 'press', label: 'Press', force: 'press' },
  { value: 'focus', label: 'Focus', force: 'focus' },
];

const UNITS: SegmentOption[] = [
  { value: 'usd', label: 'USD' },
  { value: 'flux', label: 'FLUX' },
  { value: 'eur', label: 'EUR' },
];

const FORMATS: SegmentOption[] = [
  { value: 'form', label: 'Form' },
  { value: 'json', label: 'JSON' },
];

const LAYOUTS: SegmentOption[] = [
  { value: 'list', icon: 'list', ariaLabel: 'List view' },
  { value: 'grid', icon: 'grid', ariaLabel: 'Grid view' },
  { value: 'map', icon: 'globe', ariaLabel: 'Map view' },
];

const COUNTED: SegmentOption[] = [
  { value: 'all', label: 'All', count: 24 },
  { value: 'running', label: 'Running', count: 18 },
  { value: 'stopped', label: 'Stopped', count: 6 },
];

const WITH_DISABLED: SegmentOption[] = [
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week', disabled: true },
];

const FIT_OPTIONS: SegmentOption[] = [
  { value: 'cumulus', label: 'Cumulus', icon: 'layers' },
  { value: 'nimbus', label: 'Nimbus', icon: 'container' },
  { value: 'stratus', label: 'Stratus', icon: 'gauge' },
];

const FORCED_SEGMENTS: SegmentOption[] = [
  { value: 'rest', label: 'Rest' },
  { value: 'hover', label: 'Hover', force: 'hover' },
  { value: 'press', label: 'Press', force: 'press' },
  { value: 'focus', label: 'Focus', force: 'focus' },
];

const TRAIL: BreadcrumbItem[] = [
  { label: 'Learn', href: '#navflow-crumb-learn' },
  { label: 'Cumulus', href: '#navflow-crumb-cumulus' },
  { label: 'A cloud nobody owns' },
];

const DEEP_TRAIL: BreadcrumbItem[] = [
  { label: 'Home', href: '#navflow-crumb-home' },
  { label: 'Learn', href: '#navflow-crumb-learn' },
  { label: 'Stratus', href: '#navflow-crumb-stratus' },
  { label: 'Failover', href: '#navflow-crumb-failover' },
  { label: 'Regions', href: '#navflow-crumb-regions' },
  { label: 'Pick a region on purpose' },
];

const FORCED_TRAIL: BreadcrumbItem[] = [
  { label: 'At rest', href: '#navflow-crumb-rest' },
  { label: 'Hover', href: '#navflow-crumb-hover', force: 'hover' },
  { label: 'Press', href: '#navflow-crumb-press', force: 'press' },
  { label: 'Focus', href: '#navflow-crumb-focus', force: 'focus' },
  { label: 'Current page' },
];

const LESSON: StepRailStep[] = [
  { id: 's1', label: 'The brief' },
  { id: 's2', label: 'What a node is' },
  { id: 's3', label: 'Run a container' },
  { id: 's4', label: 'Open a port' },
  { id: 's5', label: 'Checkpoint: ports', kind: 'check' },
  { id: 's6', label: 'Add an env variable' },
  { id: 's7', label: 'Scale to three' },
  { id: 's8', label: 'Watch a failover' },
  { id: 's9', label: 'Checkpoint: ship it', kind: 'check' },
];

const MIXED: StepRailStep[] = [
  { id: 'a', label: 'Intro', state: 'done' },
  { id: 'b', label: 'Warm-up, skipped', state: 'skipped' },
  { id: 'c', label: 'Current step', state: 'current' },
  { id: 'd', label: 'To do' },
  { id: 'e', label: 'Checkpoint, to do', kind: 'check', state: 'todo' },
  { id: 'f', label: 'Locked', state: 'locked' },
  { id: 'g', label: 'Checkpoint, locked', kind: 'check', state: 'locked' },
];

const CHECKS: StepRailStep[] = [
  { id: 'c1', label: 'Checkpoint, done', kind: 'check', state: 'done' },
  { id: 'c2', label: 'Checkpoint, current', kind: 'check', state: 'current' },
  { id: 'c3', label: 'Checkpoint, to do', kind: 'check', state: 'todo' },
  { id: 'c4', label: 'Checkpoint, skipped', kind: 'check', state: 'skipped' },
  { id: 'c5', label: 'Checkpoint, locked', kind: 'check', state: 'locked' },
];

const FORCED_STEPS: StepRailStep[] = [
  { id: 'f1', label: 'At rest', state: 'todo' },
  { id: 'f2', label: 'Hover', state: 'todo', force: 'hover' },
  { id: 'f3', label: 'Press', state: 'todo', force: 'press' },
  { id: 'f4', label: 'Focus, current', state: 'current', force: 'focus' },
  { id: 'f5', label: 'Done, hover', state: 'done', force: 'hover' },
  { id: 'f6', label: 'Checkpoint, focus', kind: 'check', state: 'todo', force: 'focus' },
];

/** The lesson player's rail with a working Complete button, to watch a segment land. */
function LessonRailDemo() {
  const [cur, setCur] = useState('s5');
  const [finished, setFinished] = useState(false);
  const at = Math.max(
    0,
    LESSON.findIndex((s) => s.id === cur),
  );
  const steps: StepRailStep[] = LESSON.map((s, k) => {
    if (finished) return { ...s, state: 'done' };
    if (k > at + 1) return { ...s, state: 'locked' };
    return s;
  });
  const complete = () => {
    if (at >= LESSON.length - 1) setFinished(true);
    else setCur(LESSON[at + 1]?.id ?? cur);
  };
  return (
    <Col gap={16}>
      <StepRail
        aria-label="Lesson progress"
        steps={steps}
        current={finished ? undefined : cur}
        onSelect={(id) => setCur(id)}
        tier="cumulus"
      />
      <Row>
        <Button size="sm" variant="primary" onClick={complete} disabled={finished}>
          {at >= LESSON.length - 1 && !finished ? 'Finish lesson' : 'Complete step'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setFinished(false);
            setCur('s1');
          }}
        >
          Reset
        </Button>
        <span className="t-label">{finished ? 'Lesson complete' : `Step ${at + 1} of ${LESSON.length}`}</span>
      </Row>
    </Col>
  );
}

/**
 * A dashed box `px` wide that is never wider than the page. It is sized from the viewport, not
 * with a percentage: the specimen grid sizes itself from its content, so a percentage cycles.
 */
const box = (px: number): CSSProperties => ({
  inlineSize: `min(${px}px, 100vw - 2 * var(--gutter))`,
  outline: '1px dashed var(--line-3)',
  outlineOffset: 6,
});

export default function Navflow() {
  const [view, setView] = useState('form');
  const [plate, setPlate] = useState('overview');
  const [route, setRoute] = useState('overview');
  const [unit, setUnit] = useState('usd');
  const [layout, setLayout] = useState('grid');
  return (
    <Group
      id="navflow"
      title="Navigation and flow"
      lead="Tabs, segmented controls and the step rail are one tab stop and move with the arrow keys, Home and End; accordion headers take Tab and add the arrows on top. Touch targets are 44 px and every indicator moves with transform only. The focus beam sweeps once and rests."
    >
      <Sub>Tabs</Sub>
      <Grid min={520}>
        <Spec
          label="Line: icon, count, disabled, panels"
          note="Arrows select as they move. The head and the lit ruler follow the selected tab."
        >
          <Tabs idBase="nf-view" aria-label="Spec view" items={VIEWS} value={view} onValueChange={setView}>
            <TabPanel value="form">
              <p className="t-small">Name the app, add components, set CPU, RAM and disk with sliders.</p>
            </TabPanel>
            <TabPanel value="json">
              <p className="t-small">The same app as a Flux spec, ready to paste into the deploy form.</p>
            </TabPanel>
            <TabPanel value="yaml">
              <p className="t-small">Indented, with the keys in the order the spec reads best.</p>
            </TabPanel>
            <TabPanel value="diff">
              <p className="t-small">Three changes since the last deploy: one added, two edited.</p>
            </TabPanel>
          </Tabs>
        </Spec>
        <Spec label="Line, sm">
          <Tabs idBase="nf-sm" aria-label="Spec view, small" items={VIEWS} size="sm" defaultValue="json" />
        </Spec>
        <Spec label="Plate" note="Chamfered plates for dense toolbars. The selected plate lights its edge.">
          <Tabs
            idBase="nf-plate"
            aria-label="App sections"
            variant="plate"
            items={PLATES}
            value={plate}
            onValueChange={setPlate}
          />
        </Spec>
        <Spec label="Plate, sm">
          <Tabs
            idBase="nf-plate-sm"
            aria-label="App sections, small"
            variant="plate"
            size="sm"
            items={PLATES}
          />
        </Spec>
        <Spec label="Manual activation" note="Arrows move focus. Enter or Space selects.">
          <Tabs
            idBase="nf-manual"
            aria-label="Spec view, manual"
            activation="manual"
            items={VIEWS}
            defaultValue="yaml"
          />
        </Spec>
        <Spec
          label="Overflow: 12 tabs in 380 px"
          note="The row scrolls, the edges fade, and the selected tab is centred."
        >
          <div style={box(380)}>
            <Tabs idBase="nf-many" aria-label="App settings" items={MANY} defaultValue="renewals" />
          </div>
        </Spec>
        <Spec
          label="Route-backed: tabs are links"
          note="A plain click goes to your router. Modified clicks open normally."
        >
          <Tabs idBase="nf-route" aria-label="Routes" items={ROUTES} value={route} onValueChange={setRoute} />
        </Spec>
        <Spec label="Full width">
          <Tabs idBase="nf-full" aria-label="Spec view, full" items={VIEWS.slice(0, 4)} fullWidth />
        </Spec>
        <Spec label="Forced: hover, press, focus-visible">
          <Tabs idBase="nf-force" aria-label="Forced states" items={FORCED_TABS} defaultValue="rest" />
          <Tabs
            idBase="nf-force-plate"
            aria-label="Forced states, plate"
            variant="plate"
            items={FORCED_TABS}
          />
        </Spec>
      </Grid>

      <Sub>Segmented control</Sub>
      <Grid min={320}>
        <Spec label="Units, md" note="One width for every segment, so the thumb only translates.">
          <SegmentedControl aria-label="Currency" options={UNITS} value={unit} onValueChange={setUnit} />
        </Spec>
        <Spec label="Sizes: sm, md, lg">
          <Col gap={12}>
            <SegmentedControl aria-label="Format, small" size="sm" options={FORMATS} defaultValue="json" />
            <SegmentedControl aria-label="Format, medium" size="md" options={FORMATS} defaultValue="json" />
            <SegmentedControl aria-label="Format, large" size="lg" options={FORMATS} defaultValue="json" />
          </Col>
        </Spec>
        <Spec label="Icon only, with accessible names">
          <SegmentedControl aria-label="Layout" options={LAYOUTS} value={layout} onValueChange={setLayout} />
        </Spec>
        <Spec label="Counts">
          <SegmentedControl aria-label="Filter instances" options={COUNTED} defaultValue="running" />
        </Spec>
        <Spec label="One disabled option">
          <SegmentedControl aria-label="Range" options={WITH_DISABLED} defaultValue="day" />
        </Spec>
        <Spec label="Full width">
          <SegmentedControl aria-label="Currency, full" options={UNITS} fullWidth defaultValue="flux" />
        </Spec>
        <Spec
          label="Fit: 360 px, 260 px, 190 px"
          note="Too wide for its box, it drops the icons first, then stacks the options."
        >
          <Col gap={20}>
            <div style={box(360)}>
              <SegmentedControl aria-label="Track, roomy" options={FIT_OPTIONS} defaultValue="nimbus" />
            </div>
            <div style={box(260)}>
              <SegmentedControl aria-label="Track, compact" options={FIT_OPTIONS} defaultValue="nimbus" />
            </div>
            <div style={box(190)}>
              <SegmentedControl aria-label="Track, stacked" options={FIT_OPTIONS} defaultValue="stratus" />
            </div>
          </Col>
        </Spec>
        <Spec label="Forced: hover, press, focus-visible">
          <SegmentedControl aria-label="Forced states" options={FORCED_SEGMENTS} defaultValue="focus" />
        </Spec>
      </Grid>

      <Sub>Breadcrumbs</Sub>
      <Grid min={440}>
        <Spec label="Label voice (default)">
          <Breadcrumbs items={TRAIL} />
        </Spec>
        <Spec label="Text voice">
          <Breadcrumbs items={TRAIL} variant="text" />
        </Spec>
        <Spec
          label="Six levels, maxItems 4"
          note="The middle folds behind the dots. Activate them to unfold."
        >
          <Breadcrumbs items={DEEP_TRAIL} maxItems={4} />
        </Spec>
        <Spec
          label="Six levels in 300 px"
          note="No prop: when the trail does not fit, the middle folds on its own."
        >
          <div style={box(300)}>
            <Breadcrumbs items={DEEP_TRAIL} />
          </div>
        </Spec>
        <Spec
          label="Six levels, text voice, column width"
          note="A trail that fits never folds. Narrow the window to watch it."
        >
          <Breadcrumbs items={DEEP_TRAIL} variant="text" />
        </Spec>
        <Spec label="Forced: hover, press, focus-visible">
          <Breadcrumbs items={FORCED_TRAIL} />
        </Spec>
      </Grid>

      <Sub>Accordion</Sub>
      <Grid min={440}>
        <Spec
          label="Single, collapsible"
          note="Open one, the other closes. Up, Down, Home and End move between headers."
        >
          <Accordion defaultValue="web">
            <AccordionItem value="web" icon="container" title="web" meta="0.5 vCPU, 512 MB">
              <p className="t-small">
                Serves the site on port 8080. Three instances, spread over three regions, behind one domain.
              </p>
            </AccordionItem>
            <AccordionItem value="db" icon="layers" title="db" meta="1 vCPU, 2 GB">
              <p className="t-small">
                A single writer with a 10 GB volume. It is the one component that must not scale out.
              </p>
            </AccordionItem>
            <AccordionItem value="worker" icon="gauge" title="worker" meta="paused" disabled>
              <p className="t-small">Not deployed yet.</p>
            </AccordionItem>
            <AccordionItem value="cache" icon="port" title="cache" meta="0.1 vCPU, 128 MB">
              <p className="t-small">An in-memory store. Safe to lose, so it needs no volume.</p>
            </AccordionItem>
          </Accordion>
        </Spec>
        <Spec label="Multiple, no icons" note="Panels open and close on their own.">
          <Accordion type="multiple" defaultValue={['ports', 'env']}>
            <AccordionItem value="ports" title="Ports" meta="2">
              <p className="t-small">Declare each port the container listens on, and Flux routes to it.</p>
            </AccordionItem>
            <AccordionItem value="env" title="Environment" meta="4 variables">
              <p className="t-small">
                Plain values live in the spec. Secrets belong in a private image or an encrypted field.
              </p>
            </AccordionItem>
            <AccordionItem value="volumes" title="Volumes">
              <p className="t-small">A volume is a folder inside the container that survives a restart.</p>
            </AccordionItem>
          </Accordion>
        </Spec>
        <Spec label="Forced: hover, press, focus-visible">
          <Accordion type="multiple">
            <AccordionItem value="rest" title="At rest" meta="closed">
              <p className="t-small">Hidden.</p>
            </AccordionItem>
            <AccordionItem value="hover" title="Hover" force="hover">
              <p className="t-small">Hidden.</p>
            </AccordionItem>
            <AccordionItem value="press" title="Press" force="press">
              <p className="t-small">Hidden.</p>
            </AccordionItem>
            <AccordionItem value="focus" title="Focus-visible" force="focus">
              <p className="t-small">Hidden.</p>
            </AccordionItem>
          </Accordion>
        </Spec>
      </Grid>

      <Sub>Step rail</Sub>
      <Grid min={440}>
        <Spec
          label="The player's rail: Complete a step to watch it land"
          note="Steps past the next one are locked. Checkpoints wear a hex bead."
        >
          <LessonRailDemo />
        </Spec>
        <Spec label="Static, no onSelect" note="A progress readout: not focusable.">
          <StepRail aria-label="Lesson progress, read only" steps={LESSON} current="s6" tier="cumulus" />
        </Spec>
        <Spec label="Every state">
          <Col gap={16}>
            <StepRail aria-label="Step states" steps={MIXED} onSelect={() => {}} tier="nimbus" />
            <StepRail aria-label="Checkpoint states" steps={CHECKS} onSelect={() => {}} tier="nimbus" />
          </Col>
        </Spec>
        <Spec label="Tiers: cumulus, nimbus, stratus">
          <Col gap={16}>
            <StepRail aria-label="Cumulus lesson" steps={LESSON} current="s5" tier="cumulus" />
            <StepRail aria-label="Nimbus lesson" steps={LESSON} current="s5" tier="nimbus" />
            <StepRail aria-label="Stratus lesson" steps={LESSON} current="s5" tier="stratus" />
          </Col>
        </Spec>
        <Spec label="Compact, 340 px" note="The current step's name shows beneath.">
          <div style={box(340)}>
            <StepRail
              aria-label="Lesson progress, compact"
              steps={LESSON}
              current="s7"
              compact
              tier="stratus"
            />
          </div>
        </Spec>
        <Spec label="Forced: hover, press, focus-visible">
          <StepRail aria-label="Forced states" steps={FORCED_STEPS} onSelect={() => {}} />
        </Spec>
      </Grid>
    </Group>
  );
}
