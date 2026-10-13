import { useEffect, useRef, useState } from 'react';
import { Button, Panel } from '../..';
import { Col, Grid, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'motion', title: 'Motion', order: 12 };

const DURATIONS = [
  ['--dur-1', 120, 'hover colour, focus'],
  ['--dur-2', 220, 'small UI transitions'],
  ['--dur-3', 380, 'panels, drawers, tooltips'],
  ['--dur-4', 700, 'reveals, count-ups, steps'],
  ['--dur-5', 1200, 'camera moves, hero beats'],
] as const;

const EASES = [
  ['--ease-out', 'cubic-bezier(.16, 1, .3, 1)', 'default entrance'],
  ['--ease-in-out', 'cubic-bezier(.65, 0, .35, 1)', 'movement across the screen'],
  ['--ease-snap', 'cubic-bezier(.2, .9, .2, 1.15)', 'press release'],
] as const;

function Curve({ bezier }: { bezier: string }) {
  const m = bezier.match(/cubic-bezier\(([^)]+)\)/);
  const [x1, y1, x2, y2] = (m?.[1] ?? '0,0,1,1').split(',').map((n) => Number(n.trim()));
  const W = 120;
  const H = 72;
  const px = (x: number) => 8 + x * (W - 16);
  const py = (y: number) => H - 8 - y * (H - 16);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Curve ${bezier}`}>
      <rect x="8" y="8" width={W - 16} height={H - 16} fill="none" stroke="var(--line-2)" />
      <path
        d={`M${px(0)} ${py(0)}C${px(x1 ?? 0)} ${py(y1 ?? 0)} ${px(x2 ?? 1)} ${py(y2 ?? 1)} ${px(1)} ${py(1)}`}
        fill="none"
        stroke="var(--accent-text)"
        strokeWidth="1.75"
      />
      <circle cx={px(0)} cy={py(0)} r="2.5" fill="var(--hot)" />
      <circle cx={px(1)} cy={py(1)} r="2.5" fill="var(--hot)" />
    </svg>
  );
}

function DurationBar({ token, ms }: { token: string; ms: number }) {
  const [on, setOn] = useState(false);
  return (
    <Spec label={`${token}  ${ms} ms`}>
      <button
        type="button"
        aria-label={`Replay ${token}`}
        onClick={() => setOn((v) => !v)}
        style={{
          position: 'relative',
          inlineSize: '100%',
          blockSize: 28,
          background: 'var(--ink-1)',
          border: '1px solid var(--line-2)',
          textAlign: 'start',
        }}
      >
        <span
          style={{
            position: 'absolute',
            insetBlock: 4,
            insetInlineStart: 4,
            inlineSize: 18,
            background: 'var(--accent-solid)',
            clipPath: 'var(--hex-clip)',
            translate: on ? 'calc(var(--w, 260px) - 28px) 0' : '0 0',
            transition: `translate var(${token}) var(--ease-out)`,
            ['--w' as string]: '100%',
          }}
        />
      </button>
    </Spec>
  );
}

export default function Motion() {
  const beat = useRef<'a' | 'b'>('a');
  const [stagger, setStagger] = useState(0);
  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.beat;
    };
  }, []);

  return (
    <Group
      id="motion"
      title="Motion"
      lead="Native scrolling, always. Everything is interruptible and has a reduced-motion twin that is calm but complete (opacity fades, no parallax, no camera moves). Toggle Reduce motion in the bar to see the twins."
    >
      <Sub>Durations (click to replay)</Sub>
      <Grid min={240}>
        {DURATIONS.map(([t, ms]) => (
          <DurationBar key={t} token={t} ms={ms} />
        ))}
      </Grid>

      <Sub>Easings</Sub>
      <Row>
        {EASES.map(([token, bezier, note]) => (
          <Spec key={token} label={`${token}`} note={`${bezier}: ${note}`}>
            <Curve bezier={bezier} />
          </Spec>
        ))}
      </Row>

      <Sub>The Beat</Sub>
      <Panel padding="lg" ruler="left">
        <Col gap={14}>
          <p className="t-small" style={{ maxInlineSize: '60ch' }}>
            Every real block fires one soft pulse: tick marks flare, hairlines brighten. The shell flips
            <code> html[data-beat]</code> between <code>a</code> and <code>b</code>; panels, rulers and halos
            read the registered <code>--flash</code> property. There is no simulated beat.
          </p>
          <Row>
            <Button
              variant="secondary"
              icon="block"
              onClick={() => {
                beat.current = beat.current === 'a' ? 'b' : 'a';
                document.documentElement.dataset.beat = beat.current;
              }}
            >
              Fire a beat
            </Button>
          </Row>
        </Col>
      </Panel>

      <Sub>Stagger (60 ms per item)</Sub>
      <Row>
        <Button variant="secondary" size="sm" icon="restart" onClick={() => setStagger((n) => n + 1)}>
          Replay
        </Button>
      </Row>
      <div key={stagger} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingBlockStart: 12 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            style={{
              inlineSize: 56,
              blockSize: 64,
              background: 'var(--accent-soft-2)',
              clipPath: 'var(--hex-clip)',
              animation: `kit-rise var(--dur-4) var(--ease-out) ${i * 60}ms both`,
            }}
          />
        ))}
      </div>
      <style>
        {
          '@keyframes kit-rise { from { opacity: 0; translate: 0 var(--reveal-y); filter: blur(var(--reveal-blur)); } }'
        }
      </style>
    </Group>
  );
}
