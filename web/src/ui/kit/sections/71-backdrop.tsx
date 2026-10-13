import { type ReactNode, useState } from 'react';
import { Backdrop, type BackdropProps, Button, HexBullet, Panel } from '../..';
import { Grid, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'backdrop', title: 'Backdrop', order: 71 };

/** A positioned stage: the backdrop fills it (`contained`), the content sits above at z 1. */
function Stage({
  children,
  height = 300,
  ...backdrop
}: BackdropProps & { children: ReactNode; height?: number }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        minBlockSize: height,
        padding: 24,
        overflow: 'hidden',
        border: '1px solid var(--line-2)',
        background: 'var(--void)',
      }}
    >
      <Backdrop contained {...backdrop} />
      <div style={{ position: 'relative', zIndex: 1, inlineSize: 'min(100%, 420px)' }}>{children}</div>
    </div>
  );
}

function Card({ title, text }: { title: string; text: string }) {
  return (
    <Panel variant="glass" padding="lg">
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="t-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <HexBullet size={8} /> {title}
        </span>
        <span className="t-small" style={{ color: 'var(--text-2)' }}>
          {text}
        </span>
      </div>
    </Panel>
  );
}

function fireBeat() {
  const root = document.documentElement;
  root.dataset.beat = root.dataset.beat === 'a' ? 'b' : 'a';
}

export default function BackdropKit() {
  const [paused, setPaused] = useState(false);
  return (
    <Group
      id="backdrop"
      title="Backdrop"
      lead="The calm lattice behind non-home pages: hairlines and sparse lit cells painted once, then moved by compositor animations only. Very low contrast, slow drift, paused when the tab is hidden, static under reduced motion, hidden for forced colors."
    >
      <Row>
        <Button variant="secondary" size="sm" onClick={fireBeat}>
          Fire a Beat
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Resume' : 'Pause'} the field
        </Button>
        <span className="t-small">
          A Beat sends one hex ring outward from the centre; reduced motion only fades it.
        </span>
      </Row>

      <Sub>Behind a page (dim 0.35, the default)</Sub>
      <Stage height={420} paused={paused}>
        <Card
          title="02 / Deploy"
          text="Content sits above the field. The lattice is there to be felt, not read: a faint accent-tinted hex grid, a few cells breathing slowly, a vignette that firms up toward the edges."
        />
      </Stage>

      <Sub>Dim and intensity</Sub>
      <Grid min={320}>
        <Spec label="dim 0, intensity 1: the field at full strength">
          <Stage dim={0} paused={paused}>
            <Card title="dim 0" text="The hairlines at the --lattice-line token." />
          </Stage>
        </Spec>
        <Spec label="dim 0.7: behind dense content">
          <Stage dim={0.7} paused={paused}>
            <Card title="dim 0.7" text="Dense text pages want this." />
          </Stage>
        </Spec>
        <Spec label="intensity 0.5">
          <Stage intensity={0.5} paused={paused}>
            <Card title="intensity 0.5" text="Half as present." />
          </Stage>
        </Spec>
      </Grid>

      <Sub>Drift</Sub>
      <Grid min={320}>
        <Spec label="drift 1 (default): 1.5 px per second">
          <Stage paused={paused}>
            <Card title="drift 1" text="One cell width every 32 seconds." />
          </Stage>
        </Spec>
        <Spec label="drift 0: still lattice, cells still breathe">
          <Stage drift={0} paused={paused}>
            <Card title="drift 0" text="For screens where nothing else moves." />
          </Stage>
        </Spec>
        <Spec label="paused: frozen by the prop">
          <Stage paused>
            <Card title="paused" text="Also what a hidden tab and a scrolled-away stage get." />
          </Stage>
        </Spec>
      </Grid>
    </Group>
  );
}
