import { useRef, useState } from 'react';
import {
  Button,
  CodeBlock,
  Panel,
  useCountUp,
  useElementSize,
  useInView,
  useIsDesktop,
  useIsPhone,
  useMagnetic,
  useMedia,
  usePointerFine,
  useReducedMotion,
  useReveal,
  useSpotlight,
  useTilt,
} from '../..';
import { Grid, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'hooks', title: 'Hooks', order: 27 };

const tile = {
  display: 'grid',
  placeItems: 'center',
  minBlockSize: 120,
  padding: 16,
  border: '1px solid var(--line-2)',
  background: 'rgb(var(--ink-1-rgb) / 0.7)',
  color: 'var(--text-1)',
  font: '500 var(--fs-sm) / 1.4 var(--font-mono)',
  textAlign: 'center',
} as const;

function Value({ children }: { children: string | number | boolean }) {
  return (
    <code className="t-mono" style={{ color: 'var(--accent-text)' }}>
      {String(children)}
    </code>
  );
}

function MagneticDemo() {
  const ref = useRef<HTMLDivElement>(null);
  useMagnetic(ref, { strength: 10, field: 100 });
  return (
    <div style={{ display: 'grid', placeItems: 'center', minBlockSize: 150 }}>
      <div
        ref={ref}
        style={{
          ...tile,
          minBlockSize: 64,
          inlineSize: 180,
          translate: 'var(--mx, 0px) var(--my, 0px)',
          transition: 'translate var(--dur-1) var(--ease-out)',
        }}
      >
        drifts toward you
      </div>
    </div>
  );
}

function TiltDemo() {
  const ref = useRef<HTMLDivElement>(null);
  useTilt(ref, { max: 8 });
  return (
    <div style={{ display: 'grid', placeItems: 'center', minBlockSize: 150 }}>
      <div
        ref={ref}
        style={{
          ...tile,
          inlineSize: 200,
          transform: 'perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))',
        }}
      >
        tilts up to 8 degrees
      </div>
    </div>
  );
}

function SpotlightDemo() {
  const ref = useRef<HTMLDivElement>(null);
  useSpotlight(ref);
  return (
    <div
      ref={ref}
      style={{
        ...tile,
        minBlockSize: 150,
        background:
          'radial-gradient(180px 180px at var(--px, 50%) var(--py, 50%), rgb(var(--accent-rgb) / 0.28), transparent 70%), rgb(var(--ink-1-rgb) / 0.7)',
      }}
    >
      writes --px and --py
    </div>
  );
}

function InViewDemo() {
  const scroller = useRef<HTMLElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const inView = useInView(target, { threshold: 0.6 });
  return (
    <div>
      <section
        ref={scroller}
        style={{
          ...tile,
          display: 'block',
          blockSize: 120,
          overflowY: 'auto',
          padding: 0,
          textAlign: 'start',
        }}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable demo region must be keyboard reachable
        tabIndex={0}
        aria-label="Scroll to bring the marker into view"
      >
        <div style={{ blockSize: 160, padding: 12 }}>Scroll down in this box.</div>
        <div ref={target} style={{ padding: 12, background: 'rgb(var(--accent-rgb) / 0.18)' }}>
          marker
        </div>
        <div style={{ blockSize: 160 }} />
      </section>
      <p className="t-small" style={{ marginBlockStart: 8 }}>
        in view: <Value>{inView}</Value> (true once 60 percent of the marker is visible)
      </p>
    </div>
  );
}

function RevealDemo() {
  const [run, setRun] = useState(0);
  return (
    <div key={run}>
      <RevealBox />
      <Row>
        <Button size="sm" variant="secondary" icon="restart" onClick={() => setRun((n) => n + 1)}>
          Replay
        </Button>
      </Row>
    </div>
  );
}

function RevealBox() {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useReveal(ref, { immediate: true });
  return (
    <div
      ref={ref}
      data-shown={shown}
      style={{
        ...tile,
        minBlockSize: 80,
        marginBlockEnd: 12,
        opacity: shown ? 1 : 0,
        translate: shown ? '0 0' : '0 var(--reveal-y, 24px)',
        transition: 'opacity var(--dur-3) var(--ease-out), translate var(--dur-3) var(--ease-out)',
      }}
    >
      data-shown={String(shown)}
    </div>
  );
}

function CountDemo() {
  const [target, setTarget] = useState(7105);
  const { value, ref } = useCountUp<HTMLSpanElement>(target, { duration: 900 });
  return (
    <div>
      <span ref={ref} className="t-stat" style={{ display: 'block', marginBlockEnd: 12 }}>
        {Math.round(value).toLocaleString('en-US')}
      </span>
      <Row>
        <Button size="sm" variant="secondary" onClick={() => setTarget(7960)}>
          7,960
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setTarget(1284913)}>
          1,284,913
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setTarget(7105)}>
          Back
        </Button>
      </Row>
    </div>
  );
}

function SizeDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(ref);
  return (
    <div
      ref={ref}
      style={{
        ...tile,
        resize: 'both',
        overflow: 'auto',
        inlineSize: 220,
        blockSize: 110,
        minInlineSize: 140,
        minBlockSize: 70,
        maxInlineSize: '100%',
      }}
    >
      {Math.round(width)} x {Math.round(height)}
      <br />
      drag the corner
    </div>
  );
}

function StateReadouts() {
  const reduced = useReducedMotion();
  const fine = usePointerFine();
  const desktop = useIsDesktop();
  const phone = useIsPhone();
  const dark = useMedia('(prefers-color-scheme: dark)');
  const more = useMedia('(prefers-contrast: more)');
  return (
    <ul
      style={{ display: 'grid', gap: 6, margin: 0, padding: 0, listStyle: 'none', fontSize: 'var(--fs-sm)' }}
    >
      <li>
        useReducedMotion(): <Value>{reduced}</Value>
      </li>
      <li>
        usePointerFine(): <Value>{fine}</Value>
      </li>
      <li>
        useIsDesktop() at 1100 px: <Value>{desktop}</Value>
      </li>
      <li>
        useIsPhone() under 720 px: <Value>{phone}</Value>
      </li>
      <li>
        useMedia(prefers-color-scheme: dark): <Value>{dark}</Value>
      </li>
      <li>
        useMedia(prefers-contrast: more): <Value>{more}</Value>
      </li>
    </ul>
  );
}

const USAGE = `// Pointer hooks write custom properties; the element's CSS draws them. React never re-renders.
const ref = useRef<HTMLDivElement>(null);
useMagnetic(ref, { strength: 6, field: 80 });   // --mx, --my  (px)
useTilt(ref, { max: 5 });                       // --rx, --ry  (deg)
useSpotlight(ref);                              // --px, --py  (px), --pxp, --pyp (0..1)

// State hooks
const inView = useInView(ref, { once: true, threshold: 0.6 });
const shown = useReveal(ref);                   // style on [data-shown]
const reduced = useReducedMotion();             // html[data-motion] or the OS setting
const { value, ref: countRef } = useCountUp(7105, { duration: 900 });
const { width, height } = useElementSize(ref);

// Behaviour hooks (what Dialog, Drawer and Popover are built on)
const { mounted, state } = usePresence(open, 340);     // closed, enter, open, exit
useFocusTrap(surfaceRef, { active: open, onEscape: close });
const [value, setValue] = useControllableState(props.value, 'x', props.onChange);`;

export default function HooksKit() {
  return (
    <Group
      id="hooks"
      title="Hooks"
      lead="Pointer hooks write CSS custom properties and let the element's own CSS draw them, so a pointer move never re-renders React. They are fine-pointer only and switch themselves off under reduced motion."
    >
      <Sub>Pointer (move the mouse over each tile)</Sub>
      <Grid min={240}>
        <Spec label="useMagnetic" note="Writes --mx and --my; translate: var(--mx) var(--my).">
          <MagneticDemo />
        </Spec>
        <Spec label="useTilt" note="Writes --rx and --ry; eases back to flat on leave.">
          <TiltDemo />
        </Spec>
        <Spec label="useSpotlight" note="Writes --px, --py and sets data-hover.">
          <SpotlightDemo />
        </Spec>
      </Grid>

      <Sub>State</Sub>
      <Grid min={260}>
        <Spec label="useInView">
          <InViewDemo />
        </Spec>
        <Spec
          label="useReveal"
          note="Content is visible without JS; the hidden state is set after hydration."
        >
          <RevealDemo />
        </Spec>
        <Spec label="useCountUp" note="Counts once when scrolled into view, then eases to a new target.">
          <CountDemo />
        </Spec>
        <Spec label="useElementSize" note="A ResizeObserver; zero until measured.">
          <SizeDemo />
        </Spec>
        <Spec label="Media and motion">
          <StateReadouts />
        </Spec>
      </Grid>

      <Sub>Usage</Sub>
      <CodeBlock lang="ts" filename="hooks.ts" code={USAGE} copy={false} />

      <Sub>In a panel (the interactive Panel composes three of them)</Sub>
      <div style={{ maxInlineSize: 360 }}>
        <Panel interactive tilt>
          <span className="t-label">Panel interactive tilt</span>
          <p className="t-small" style={{ marginBlockStart: 8 }}>
            useSpotlight and useTilt, with press compression, behind two props.
          </p>
        </Panel>
      </div>
    </Group>
  );
}
