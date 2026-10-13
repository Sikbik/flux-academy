import { Panel, type PanelCut, type PanelTone } from '../..';
import { Grid, Group, type KitSectionMeta, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'panel', title: 'Panel', order: 21 };

const CUTS: PanelCut[] = ['tr-bl', 'tl-br', 'all', 'tl', 'none'];
const TONES: PanelTone[] = ['neutral', 'ok', 'warn', 'crit', 'cumulus', 'nimbus', 'stratus'];

function Body({ title, text }: { title: string; text?: string }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span className="t-label">{title}</span>
      <span className="t-small" style={{ color: 'var(--text-2)' }}>
        {text ?? 'The glass slab: a gradient edge, hex pattern, grain, corner crosshairs.'}
      </span>
    </div>
  );
}

export default function PanelKit() {
  return (
    <Group
      id="panel"
      title="Panel"
      lead="The glass slab. Chamfered cuts (never radius), a 1 px gradient edge that burns hot on one cut, a faint hex lattice, grain, corner crosshairs and an optional tick ruler. Interactive panels add a cursor spotlight with a crosshair, an edge that catches the pointer, tilt and a 2 percent press compression."
    >
      <Sub>Variants</Sub>
      <Grid min={260}>
        <Spec label="glass (default): blurred, bloom">
          <Panel>
            <Body title="Glass" />
          </Panel>
        </Spec>
        <Spec label="slab: opaque, no blur (lists)">
          <Panel variant="slab">
            <Body title="Slab" text="Use for long lists and anywhere panels stack." />
          </Panel>
        </Spec>
        <Spec label="ghost: edge, ticks and pattern only">
          <Panel variant="ghost">
            <Body title="Ghost" text="Sits on a scene without hiding it." />
          </Panel>
        </Spec>
      </Grid>

      <Sub>Cuts and sizes</Sub>
      <Grid min={200}>
        {CUTS.map((c) => (
          <Spec key={c} label={`cut="${c}"`}>
            <Panel cut={c} pattern={c === 'tl-br' ? 'bl' : 'br'}>
              <Body title={c} />
            </Panel>
          </Spec>
        ))}
        <Spec label='size="sm" chamfer 8'>
          <Panel size="sm" padding="sm">
            <Body title="Small" />
          </Panel>
        </Spec>
        <Spec label='size="lg" chamfer 22'>
          <Panel size="lg" padding="lg">
            <Body title="Large" />
          </Panel>
        </Spec>
      </Grid>

      <Sub>Tick ruler (blueprint furniture)</Sub>
      <Grid min={200}>
        {(['left', 'right', 'top', 'bottom'] as const).map((r) => (
          <Spec key={r} label={`ruler="${r}"`}>
            <Panel ruler={r} padding="lg" hot={r === 'left' ? 'tl' : 'tr'}>
              <Body title={`Ruler ${r}`} />
            </Panel>
          </Spec>
        ))}
      </Grid>

      <Sub>Tones (recolour the edge, pattern and glow)</Sub>
      <Grid min={170}>
        {TONES.map((t) => (
          <Spec key={t} label={`tone="${t}"`}>
            <Panel tone={t} padding="sm">
              <Body title={t} text="Tier colour means tier." />
            </Panel>
          </Spec>
        ))}
      </Grid>

      <Sub>Interactive (hover for the spotlight, press to compress, Tab for the beam)</Sub>
      <Grid min={240}>
        <Spec label="interactive + tilt">
          <Panel as="button" type="button" interactive tilt padding="lg" style={{ inlineSize: '100%' }}>
            <Body title="Hover me" text="Spotlight, crosshair, tilt up to 5 degrees." />
          </Panel>
        </Spec>
        <Spec label="interactive link">
          <Panel as="a" href="#panel" interactive padding="lg" tone="cumulus">
            <Body title="A whole-card link" text="One real link; the panel is the target." />
          </Panel>
        </Spec>
        <Spec label='data-force="hover" (forced state)'>
          <Panel interactive data-force="hover" padding="lg" style={{ minBlockSize: 120 }}>
            <Body title="Hover state" />
          </Panel>
        </Spec>
        <Spec label='data-force="focus" (focus beam)'>
          <Panel as="button" type="button" data-force="focus" padding="lg" style={{ inlineSize: '100%' }}>
            <Body title="Focus-visible" />
          </Panel>
        </Spec>
      </Grid>
    </Group>
  );
}
