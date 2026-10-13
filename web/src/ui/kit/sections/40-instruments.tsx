import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Button,
  CountUp,
  FreshnessChip,
  Gauge,
  Meter,
  Odometer,
  Panel,
  Progress,
  Skeleton,
  Slider,
  Sparkline,
  Stat,
} from '../..';
import { Col, Grid, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'instruments', title: 'Instruments', order: 40 };

/** A repeatable wobble around `base`, so a screenshot or a test sees the same line twice. */
function series(count: number, seed: number, base: number, spread: number): number[] {
  let s = seed >>> 0;
  return Array.from({ length: count }, (_, i) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const r = s / 4294967296 - 0.5;
    return Math.round((base + r * 2 * spread + Math.sin(i / 2.6) * spread * 0.35) * 10) / 10;
  });
}

/** The numbers in the Odometer and CountUp demos: stat-sized, a little under the hero. */
const DEMO_FIGURE = { fontSize: 'max(1.625rem, calc(var(--fs-stat) * 0.72))' } as const;

function useTicker(active: boolean, ms: number, fn: () => void): void {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => saved.current(), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
}

function Toggle({
  on,
  onChange,
  children,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Button size="sm" variant={on ? 'primary' : 'secondary'} aria-pressed={on} onClick={() => onChange(!on)}>
      {children}
    </Button>
  );
}

/* ---- Progress ------------------------------------------------------------------------------- */

function ProgressBars() {
  return (
    <Grid min={300}>
      <Spec label="empty">
        <Progress label="Course progress" value={0} />
      </Spec>
      <Spec label="partial, with value text" note="aria-valuetext carries the words the eye reads.">
        <Progress label="Cumulus track" value={3} max={8} valueText="3 of 8 lessons" />
      </Spec>
      <Spec label="full">
        <Progress label="Download" value={1} />
      </Spec>
      <Spec label="indeterminate" note="No aria-valuenow: the length of the work is not known.">
        <Progress label="Syncing with the chain" />
      </Spec>
      <Spec label="sizes sm, md, lg">
        <Col gap={14}>
          <Progress size="sm" label="Small" value={0.35} />
          <Progress size="md" label="Medium" value={0.58} />
          <Progress size="lg" label="Large" value={0.81} />
        </Col>
      </Spec>
      <Spec label="tier tint: cumulus, nimbus, stratus">
        <Col gap={14}>
          <Progress tier="cumulus" label="Cumulus" value={0.62} />
          <Progress tier="nimbus" label="Nimbus" value={0.4} />
          <Progress tier="stratus" label="Stratus" value={0.18} />
        </Col>
      </Spec>
      <Spec label="status tone: ok, warn, crit">
        <Col gap={14}>
          <Progress tone="ok" label="Healthy" value={0.4} />
          <Progress tone="warn" label="Filling" value={0.78} />
          <Progress tone="crit" label="Nearly full" value={0.96} />
        </Col>
      </Spec>
    </Grid>
  );
}

function ProgressDials() {
  return (
    <Col gap={28}>
      {(['ring', 'hex'] as const).map((variant) => (
        <Row key={variant} align="start">
          <Spec label={`${variant}: empty`}>
            <Progress variant={variant} label="Empty" value={0} />
          </Spec>
          <Spec label="partial">
            <Progress variant={variant} label="Partial" value={0.42} />
          </Spec>
          <Spec label="full">
            <Progress variant={variant} label="Full" value={1} />
          </Spec>
          <Spec label="indeterminate">
            <Progress variant={variant} label="Working" />
          </Spec>
          <Spec label="sm, md, lg">
            <Row align="end">
              <Progress variant={variant} size="sm" label="Small" value={0.64} />
              <Progress variant={variant} size="md" label="Medium" value={0.64} />
              <Progress variant={variant} size="lg" label="Large" value={0.64} />
            </Row>
          </Spec>
          <Spec label="tiers">
            <Row>
              <Progress variant={variant} tier="cumulus" label="Cumulus" value={0.75} />
              <Progress variant={variant} tier="nimbus" label="Nimbus" value={0.5} />
              <Progress variant={variant} tier="stratus" label="Stratus" value={0.25} />
            </Row>
          </Spec>
          <Spec label="tone and a centre">
            <Row>
              <Progress variant={variant} size="lg" tone="warn" label="Disk" value={0.82} />
              <Progress variant={variant} size="lg" tier="cumulus" label="Cumulus track" value={5} max={8}>
                <span
                  className="t-num"
                  style={{ color: 'var(--text-1)', font: '500 0.9375rem var(--font-mono)' }}
                >
                  5/8
                </span>
              </Progress>
            </Row>
          </Spec>
        </Row>
      ))}

      <Sub>Segments</Sub>
      <Grid min={300}>
        <Spec label="0 of 6">
          <Progress variant="segments" label="Steps" done={0} total={6} showLabel showValue />
        </Spec>
        <Spec label="3 of 6, cells fill in turn">
          <Progress variant="segments" label="Steps" done={3} total={6} showLabel showValue />
        </Spec>
        <Spec label="6 of 6">
          <Progress variant="segments" label="Steps" done={6} total={6} showLabel showValue />
        </Spec>
        <Spec label="value 0.42 over 20 cells (a partial cell)">
          <Progress variant="segments" label="Storage" value={0.42} cells={20} showLabel showValue />
        </Spec>
        <Spec label="indeterminate">
          <Progress variant="segments" label="Working" showLabel />
        </Spec>
        <Spec label="tiers">
          <Col gap={12}>
            <Progress variant="segments" tier="cumulus" label="Cumulus" done={5} total={8} />
            <Progress variant="segments" tier="nimbus" label="Nimbus" done={3} total={8} />
            <Progress variant="segments" tier="stratus" label="Stratus" done={1} total={8} />
          </Col>
        </Spec>
      </Grid>
    </Col>
  );
}

function ProgressLive() {
  const total = 8;
  const [done, setDone] = useState(3);
  return (
    <Col gap={16}>
      <Row>
        <Button size="sm" onClick={() => setDone((d) => Math.min(total, d + 1))}>
          Complete a lesson
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDone(0)}>
          Reset
        </Button>
      </Row>
      <Grid min={300}>
        <Progress label="Cumulus track" done={done} total={total} valueText={`${done} of ${total} lessons`} />
        <Progress variant="segments" label="Lessons" done={done} total={total} showLabel showValue />
        <Row>
          <Progress variant="ring" label="Track" done={done} total={total} />
          <Progress variant="hex" label="Track" done={done} total={total} tier="cumulus" />
        </Row>
      </Grid>
    </Col>
  );
}

/* ---- Gauge ---------------------------------------------------------------------------------- */

function Gauges() {
  return (
    <Col gap={28}>
      <Row align="start">
        <Spec label="empty">
          <Gauge label="CPU" value={0} unit="%" />
        </Spec>
        <Spec label="partial">
          <Gauge label="CPU" value={46} unit="%" />
        </Spec>
        <Spec label="full">
          <Gauge label="CPU" value={100} unit="%" />
        </Spec>
        <Spec label="sm, md, lg">
          <Row align="end">
            <Gauge size="sm" label="CPU" value={62} unit="%" />
            <Gauge size="md" label="CPU" value={62} unit="%" />
            <Gauge size="lg" label="CPU" value={62} unit="%" />
          </Row>
        </Spec>
        <Spec label="tiers">
          <Row>
            <Gauge tier="cumulus" label="Cumulus" value={70} unit="%" />
            <Gauge tier="nimbus" label="Nimbus" value={52} unit="%" />
            <Gauge tier="stratus" label="Stratus" value={34} unit="%" />
          </Row>
        </Spec>
      </Row>

      <Sub>Thresholds</Sub>
      <Row align="start">
        <Spec label="ok (below 70)">
          <Gauge size="lg" label="RAM" value={38} unit="%" tone="auto" />
        </Spec>
        <Spec label="warn (70 and over)">
          <Gauge size="lg" label="RAM" value={78} unit="%" tone="auto" />
        </Spec>
        <Spec label="crit (90 and over)">
          <Gauge size="lg" label="RAM" value={96} unit="%" tone="auto" />
        </Spec>
        <Spec label="limit tick" note="A hard limit outside the ring. Units, not percent.">
          <Gauge
            size="lg"
            label="Memory"
            value={3.1}
            max={4}
            unit="GB"
            decimals={1}
            limit={3.5}
            tone="auto"
          />
        </Spec>
        <Spec label="low is bad" note="Free space: critical when it runs out.">
          <Gauge size="lg" label="Free disk" value={12} unit="%" tone="auto" lowIsBad />
        </Spec>
        <Spec label="closed ring, custom marks">
          <Gauge
            size="lg"
            label="Uptime"
            value={99.4}
            min={90}
            unit="%"
            decimals={1}
            tone="auto"
            lowIsBad
            thresholds={{ warn: 97, crit: 94 }}
            startAngle={0}
            sweep={360}
          />
        </Spec>
      </Row>
    </Col>
  );
}

function LoadDemo() {
  const [load, setLoad] = useState(58);
  return (
    <Col gap={18}>
      <div style={{ maxInlineSize: 480 }}>
        <Slider label="Load" value={load} onValueChange={setLoad} min={0} max={100} step={1} unit="%" />
      </div>
      <Row align="end">
        <Gauge size="sm" label="Load" value={load} unit="%" tone="auto" />
        <Gauge size="md" label="Load" value={load} unit="%" tone="auto" />
        <Gauge size="lg" label="Load" value={load} unit="%" tone="auto" limit={95} />
        <div style={{ inlineSize: 'min(100%, 320px)' }}>
          <Meter label="Load" value={load} tone="auto" limit={95} />
        </div>
      </Row>
    </Col>
  );
}

/* ---- Meter ---------------------------------------------------------------------------------- */

function Meters() {
  return (
    <Grid min={300}>
      <Spec label="empty">
        <Meter label="CPU" value={0} unit="vCPU" max={4} />
      </Spec>
      <Spec label="partial, unit and max">
        <Meter label="CPU" value={1.5} unit="vCPU" max={4} decimals={1} />
      </Spec>
      <Spec label="full">
        <Meter label="Disk" value={100} />
      </Spec>
      <Spec label="thresholds: ok, warn, crit" note="Cells are zoned, and a word says it too.">
        <Col gap={14}>
          <Meter label="CPU" value={34} tone="auto" />
          <Meter label="CPU" value={78} tone="auto" />
          <Meter label="CPU" value={95} tone="auto" />
        </Col>
      </Spec>
      <Spec label="limit and target markers" note="Solid is a hard limit, dashed a recommendation.">
        <Meter
          label="Memory"
          value={5.2}
          unit="GB"
          max={8}
          decimals={1}
          limit={7}
          limitLabel="limit"
          target={4}
          targetLabel="plan"
          tone="auto"
        />
      </Spec>
      <Spec label="sm, md">
        <Col gap={14}>
          <Meter size="sm" label="Small" value={42} />
          <Meter size="md" label="Medium" value={42} />
        </Col>
      </Spec>
      <Spec label="tier tint">
        <Col gap={14}>
          <Meter tier="cumulus" label="Cumulus" value={64} />
          <Meter tier="nimbus" label="Nimbus" value={48} />
          <Meter tier="stratus" label="Stratus" value={31} />
        </Col>
      </Spec>
      <Spec label="12 cells, low is bad">
        <Meter label="Free space" value={22} cells={12} tone="auto" lowIsBad />
      </Spec>
    </Grid>
  );
}

/* ---- Stat ----------------------------------------------------------------------------------- */

function Stats() {
  const trend = series(32, 7, 30, 4);
  return (
    <Col gap={32}>
      <Grid min={220}>
        <Spec label="size sm">
          <Stat size="sm" label="Nodes" value={7960} />
        </Spec>
        <Spec label="size md, with a unit">
          <Stat label="Storage" value={1284.6} decimals={1} unit="TB" />
        </Spec>
        <Spec label="size lg">
          <Stat size="lg" label="Block height" value={1284913} />
        </Spec>
        <Spec label="sub line">
          <Stat label="Block time" value={30} unit="s" sub="Target is 30 s per block" />
        </Spec>
      </Grid>

      <Sub>Change: sign, glyph and word</Sub>
      <Grid min={220}>
        <Spec label="up is good">
          <Stat label="Nodes" value={7960} delta={{ value: 2.4, label: 'vs 24 h' }} />
        </Spec>
        <Spec label="down is bad">
          <Stat label="Nodes" value={7960} delta={{ value: -3.1, label: 'vs 24 h' }} />
        </Spec>
        <Spec label="down is good (fees)">
          <Stat label="Fee" value={0.0021} decimals={4} delta={{ value: -12.5, good: 'down' }} />
        </Spec>
        <Spec label="flat">
          <Stat label="Supply" value={440_000_000} delta={{ value: 0, label: 'vs 24 h' }} />
        </Spec>
        <Spec label="absolute change, neutral">
          <Stat
            label="Blocks"
            value={2880}
            delta={{ value: 12, unit: 'blocks', decimals: 0, good: 'neutral' }}
          />
        </Spec>
      </Grid>

      <Sub>Freshness</Sub>
      <Grid min={240}>
        <Spec label="live">
          <Stat label="Block height" value={1284913} freshness={{ kind: 'live', ageMs: 3000 }} />
        </Spec>
        <Spec label="cached">
          <Stat label="Block height" value={1284880} freshness={{ kind: 'cached', ageMs: 120_000 }} />
        </Spec>
        <Spec label="offline, last known">
          <Stat label="Block height" value={1284851} freshness={{ kind: 'offline' }} />
        </Spec>
        <Spec label="simulation">
          <Stat label="Yearly reward" value={1840} unit="FLUX" freshness={{ kind: 'simulation' }} />
        </Spec>
      </Grid>

      <Sub>States</Sub>
      <Grid min={220}>
        <Spec label="no data" note="Never a fake zero.">
          <Stat label="Price" value={null} unit="USD" />
        </Spec>
        <Spec label="loading" note="The label stays. aria-busy is set on the stat.">
          <Stat label="Price" loading />
        </Spec>
        <Spec label="gradient hero">
          <Stat size="lg" label="Runs on" value={7960} gradient sub="nodes worldwide" />
        </Spec>
        <Spec label="tier tint">
          <Stat tier="nimbus" label="Nimbus cores" value={8} sub="per instance" />
        </Spec>
        <Spec label="as a description list" note="dt for the caption, dd for the figure.">
          <Stat as="dl" label="Instances" value={412} delta={{ value: 1.8 }} />
        </Spec>
      </Grid>

      <Sub>With children</Sub>
      <Grid min={300}>
        <Spec label="a Stat and a Sparkline">
          <Stat
            label="Block interval"
            value={29.4}
            decimals={1}
            unit="s"
            freshness={{ kind: 'live', ageMs: 1000 }}
            delta={{ value: -1.2, good: 'neutral', label: 'vs 1 h' }}
          >
            <Sparkline
              values={trend}
              target={30}
              targetLabel="30 s"
              label="Block interval, seconds"
              height={64}
            />
          </Stat>
        </Spec>
      </Grid>
    </Col>
  );
}

/* ---- Odometer ------------------------------------------------------------------------------- */

function OdometerDemo() {
  const [height, setHeight] = useState(1284913);
  const [price, setPrice] = useState(0.4821);
  const [secs, setSecs] = useState(24);
  const [run, setRun] = useState(false);

  useTicker(run, 1000, () => {
    setSecs((s) => (s <= 0 ? 30 : s - 1));
    setHeight((h) => h + (Math.random() < 0.18 ? 1 : 0));
  });

  return (
    <Col gap={22}>
      <Row>
        <Button size="sm" onClick={() => setHeight((h) => h + 1)}>
          +1 block
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setHeight((h) => h - 1)}>
          &minus;1
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setHeight((h) => h + 1234)}>
          +1,234
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setHeight(9999)}>
          Set 9,999
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPrice((p) => Math.round((p + 0.0123) * 10000) / 10000)}
        >
          Price +0.0123
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPrice((p) => Math.max(0, Math.round((p - 0.0119) * 10000) / 10000))}
        >
          Price &minus;0.0119
        </Button>
        <Toggle on={run} onChange={setRun}>
          {run ? 'Stop the clock' : 'Run the clock'}
        </Toggle>
      </Row>
      <Grid min={300}>
        <Spec label="grouped integer: digits roll, the least significant first">
          <span className="t-stat" style={DEMO_FIGURE}>
            <Odometer value={height} />
          </span>
        </Spec>
        <Spec label="prefix and four decimals">
          <span className="t-stat" style={DEMO_FIGURE}>
            <Odometer value={price} decimals={4} prefix="$" />
          </span>
        </Spec>
        <Spec label="minDigits 2: a countdown" note="Next block in, seconds.">
          <span className="t-stat" style={DEMO_FIGURE}>
            <Odometer value={secs} minDigits={2} suffix=" s" />
          </span>
        </Spec>
        <Spec label="gradient hero">
          <span className="t-stat" style={{ fontSize: 'var(--fs-stat)' }}>
            <Odometer value={height} gradient />
          </span>
        </Spec>
        <Spec label="no flash" note="flash={false}: the roll alone.">
          <span className="t-stat" style={DEMO_FIGURE}>
            <Odometer value={height} flash={false} />
          </span>
        </Spec>
        <Spec label="mono, small" note="Inherits any font. Here the instrument voice.">
          <span style={{ font: '500 var(--fs-md) var(--font-mono)', color: 'var(--text-1)' }}>
            <Odometer value={height} />
          </span>
        </Spec>
      </Grid>
    </Col>
  );
}

/* ---- CountUp -------------------------------------------------------------------------------- */

function CountUps() {
  const [target, setTarget] = useState(8420);
  return (
    <Col gap={22}>
      <Row>
        <Button size="sm" onClick={() => setTarget(12960)}>
          Set 12,960
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setTarget(3150)}>
          Set 3,150
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setTarget(8420)}>
          Back to 8,420
        </Button>
      </Row>
      <Grid min={300}>
        <Spec
          label="counts once, when scrolled into view"
          note="Then eases to any new value from where it is."
        >
          <span className="t-stat" style={DEMO_FIGURE}>
            <CountUp value={target} />
          </span>
        </Spec>
        <Spec label="decimals and unit">
          <span className="t-stat" style={DEMO_FIGURE}>
            <CountUp value={target / 10} decimals={1} suffix=" TB" />
          </span>
        </Spec>
        <Spec label="immediate">
          <span className="t-stat" style={DEMO_FIGURE}>
            <CountUp value={target} immediate />
          </span>
        </Spec>
        <Spec label="from 1,000,000" note="A counter that starts near the end.">
          <span className="t-stat" style={DEMO_FIGURE}>
            <CountUp value={1284913} from={1000000} />
          </span>
        </Spec>
      </Grid>
    </Col>
  );
}

/* ---- Sparkline ------------------------------------------------------------------------------ */

function LiveSparkline() {
  const [vals, setVals] = useState(() => series(40, 11, 30, 5));
  const [grow, setGrow] = useState(() => series(8, 5, 30, 4));
  const [run, setRun] = useState(false);
  const tick = useRef(0);

  const nextValue = () => {
    tick.current += 1;
    return Math.round((30 + Math.sin(tick.current * 1.7) * 6 + (Math.random() - 0.5) * 4) * 10) / 10;
  };
  const append = () => {
    setVals((v) => [...v.slice(1), nextValue()]);
    setGrow((g) => (g.length >= 30 ? series(8, 5, 30, 4) : [...g, nextValue()]));
  };
  useTicker(run, 1400, append);

  return (
    <Col gap={18}>
      <Row>
        <Button size="sm" onClick={append}>
          Append a block
        </Button>
        <Toggle on={run} onChange={setRun}>
          {run ? 'Stop the feed' : 'Run the feed'}
        </Toggle>
      </Row>
      <Grid min={320}>
        <Spec
          label="rolling window: the series slides one step left"
          note="Hover, touch or use arrow keys for the readout."
        >
          <Sparkline
            values={vals}
            target={30}
            targetLabel="30 s"
            label="Block interval, seconds"
            height={72}
            pointLabel={(i) => `Block ${1284873 + i}`}
          />
        </Spec>
        <Spec label="growing: new points make room">
          <Sparkline
            values={grow}
            label="Block interval, seconds"
            height={72}
            formatValue={(n) => `${n} s`}
          />
        </Spec>
      </Grid>
    </Col>
  );
}

function ForcedFocus({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.firstElementChild?.setAttribute('data-force', 'focus');
  }, []);
  return <div ref={box}>{children}</div>;
}

function Sparklines() {
  const a = series(36, 3, 30, 5);
  const withGaps: (number | null)[] = [...series(14, 9, 30, 4), null, null, null, ...series(14, 21, 31, 4)];
  return (
    <Col gap={32}>
      <Grid min={260}>
        <Spec label="default">
          <Sparkline values={a} label="Block interval, seconds" />
        </Spec>
        <Spec label="target and caption">
          <Sparkline values={a} target={30} targetLabel="30 s" label="Block interval, seconds" />
        </Spec>
        <Spec label="no area, no marker">
          <Sparkline values={a} area={false} showLast={false} label="Block interval, seconds" />
        </Spec>
        <Spec label="gaps (null) break the line">
          <Sparkline values={withGaps} label="Block interval, seconds" />
        </Spec>
        <Spec label="fixed scale 0 to 60" note="min and max pin the axis.">
          <Sparkline
            values={a}
            min={0}
            max={60}
            target={30}
            targetLabel="30 s"
            label="Block interval, seconds"
          />
        </Spec>
        <Spec label="tall, 120 px">
          <Sparkline values={a} height={120} target={30} label="Block interval, seconds" />
        </Spec>
        <Spec label="tier tint">
          <Col gap={10}>
            <Sparkline tier="cumulus" values={series(30, 2, 30, 6)} label="Cumulus" height={40} />
            <Sparkline tier="nimbus" values={series(30, 4, 30, 6)} label="Nimbus" height={40} />
            <Sparkline tier="stratus" values={series(30, 6, 30, 6)} label="Stratus" height={40} />
          </Col>
        </Spec>
        <Spec label="one point, and none">
          <Col gap={10}>
            <Sparkline values={[28]} label="Block interval, seconds" height={40} />
            <Sparkline values={[]} label="Block interval, seconds" height={40} />
          </Col>
        </Spec>
        <Spec label="not interactive (an image)">
          <Sparkline values={a} interactive={false} label="Block interval, seconds" height={40} />
        </Spec>
        <Spec label="focus ring state (forced)">
          <ForcedFocus>
            <Sparkline values={a} label="Block interval, seconds" />
          </ForcedFocus>
        </Spec>
      </Grid>
      <LiveSparkline />
    </Col>
  );
}

/* ---- Skeleton ------------------------------------------------------------------------------- */

function Skeletons() {
  const [loading, setLoading] = useState(true);
  return (
    <Col gap={28}>
      <Grid min={220}>
        <Spec label="line">
          <Skeleton shape="line" />
        </Spec>
        <Spec label="three lines">
          <Skeleton shape="line" lines={3} />
        </Spec>
        <Spec label="block">
          <Skeleton shape="block" height={96} />
        </Spec>
        <Spec label="circle, hex">
          <Row>
            <Skeleton shape="circle" width={56} />
            <Skeleton shape="hex" width={56} />
          </Row>
        </Spec>
        <Spec label="stat">
          <Skeleton shape="stat" />
        </Spec>
        <Spec
          label="announcing: role=status"
          note="With `label`; otherwise it is aria-hidden and the container says aria-busy."
        >
          <Skeleton shape="block" height={56} label="Loading the lesson" />
        </Spec>
      </Grid>

      <Sub>Loading to loaded</Sub>
      <Row>
        <Toggle on={loading} onChange={setLoading}>
          {loading ? 'Show the data' : 'Show loading'}
        </Toggle>
      </Row>
      <Grid min={360}>
        <Panel>
          <Col gap={18}>
            <Stat
              label="Block height"
              value={loading ? undefined : 1284913}
              loading={loading}
              animate={false}
            />
            <Stat
              size="sm"
              label="Nodes"
              value={loading ? undefined : 7960}
              loading={loading}
              sub={loading ? undefined : 'Across 6 regions'}
              animate={false}
            />
            {loading ? <Skeleton shape="line" lines={2} /> : <Meter label="Storage" value={64} tone="auto" />}
          </Col>
        </Panel>
      </Grid>
    </Col>
  );
}

/* ---- Composition ---------------------------------------------------------------------------- */

function NodeCard() {
  const cpu = series(36, 31, 46, 14).map((n) => Math.max(4, Math.min(98, n)));
  return (
    <Grid min={340}>
      <Panel>
        <Col gap={20}>
          <Stat
            label="Node health"
            value={99.94}
            decimals={2}
            unit="%"
            tier="cumulus"
            freshness={{ kind: 'live', ageMs: 2000 }}
            delta={{ value: 0.02, decimals: 2, label: 'vs 7 d' }}
          />
          <Row align="start">
            <Gauge label="CPU" value={46} unit="%" tone="auto" tier="cumulus" />
            <Gauge label="RAM" value={78} unit="%" tone="auto" />
            <Gauge label="SSD" value={91} unit="%" tone="auto" />
          </Row>
          <Meter label="Bandwidth" value={620} max={1000} unit="Mbps" showMax tone="auto" limit={900} />
          <Sparkline
            values={cpu}
            label="CPU over the last 36 samples, percent"
            height={56}
            target={80}
            targetLabel="80 %"
          />
        </Col>
      </Panel>
      <Panel>
        <Col gap={16}>
          <Progress label="Cumulus track" value={5} max={8} valueText="5 of 8 lessons" tier="cumulus" />
          <Row align="start">
            <Progress variant="hex" size="lg" label="Cumulus" value={5} max={8} tier="cumulus" />
            <Progress variant="hex" size="lg" label="Nimbus" value={2} max={8} tier="nimbus" />
            <Progress variant="hex" size="lg" label="Stratus" value={0} max={8} tier="stratus" />
          </Row>
          <FreshnessChip kind="simulation" />
        </Col>
      </Panel>
    </Grid>
  );
}

/* ---- Section -------------------------------------------------------------------------------- */

export default function Instruments() {
  return (
    <Group
      id="instruments"
      title="Instruments"
      lead="Readouts for a network that is alive. Every number is tabular mono or Montserrat figures, every status is a word and a glyph as well as a colour, and everything that moves has a reduced motion twin: flip Motion in the header to see them all."
    >
      <Sub>Progress: bar</Sub>
      <ProgressBars />
      <Sub>Progress: ring, hex, segments</Sub>
      <ProgressDials />
      <Sub>Progress: live</Sub>
      <ProgressLive />

      <Sub>Gauge</Sub>
      <Gauges />
      <Sub>Gauge, meter and slider: drag the load</Sub>
      <LoadDemo />

      <Sub>Meter</Sub>
      <Meters />

      <Sub>Stat</Sub>
      <Stats />

      <Sub>Odometer</Sub>
      <OdometerDemo />

      <Sub>CountUp</Sub>
      <CountUps />

      <Sub>Sparkline</Sub>
      <Sparklines />

      <Sub>Skeleton</Sub>
      <Skeletons />

      <Sub>In a panel</Sub>
      <NodeCard />
    </Group>
  );
}
