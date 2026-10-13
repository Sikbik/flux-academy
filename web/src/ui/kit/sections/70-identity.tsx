import { type ArtId, art } from '@/content/art';
import {
  Chip,
  HexBullet,
  HexRing,
  Logo,
  type LogoTone,
  type LogoVariant,
  Marquee,
  Medal,
  type MedalState,
  Panel,
} from '../..';
import { Col, Grid, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'identity', title: 'Marks', order: 70 };

const VARIANTS: { id: LogoVariant; label: string }[] = [
  { id: 'mark', label: 'mark: the bare symbol' },
  { id: 'round', label: 'round: symbol on its disc' },
  { id: 'lockup', label: 'lockup: round + FLUX wordmark' },
  { id: 'academy', label: 'academy: header lockup, live words' },
];

const DARK_TONES: LogoTone[] = ['blue', 'white'];
const MONO_TONES: LogoTone[] = ['black', 'gray'];

interface MedalSpec {
  id: ArtId;
  label: string;
  rule: string;
  tier?: 'cumulus' | 'nimbus' | 'stratus';
}

// The names and rules are CONTENT.md section 6.
const MEDALS: MedalSpec[] = [
  { id: 'medal-first-light', label: 'First light', rule: 'Open your first lesson' },
  {
    id: 'medal-three-is-company',
    label: 'Three is company',
    rule: 'Set instances to 3 or more in any scene or in the forge',
  },
  { id: 'medal-first-blood', label: 'First blood', rule: 'Kill a node in a failover scene' },
  {
    id: 'medal-spec-whisperer',
    label: 'Spec whisperer',
    rule: 'Take a spec from 3 or more lint errors to none',
  },
  {
    id: 'medal-penny-pincher',
    label: 'Penny pincher',
    rule: 'Build a valid 3-instance spec with at least 1 core and 2 GB of RAM for under $3 a month',
  },
  {
    id: 'medal-block-watcher',
    label: 'Block watcher',
    rule: 'Be on the site for three real blocks in a row',
  },
  {
    id: 'medal-globetrotter',
    label: 'Globetrotter',
    rule: 'Hover 15 different countries in the Network Lab',
  },
  { id: 'medal-shell-shocked', label: 'Shell-shocked', rule: 'Finish a terminal scenario' },
  { id: 'medal-explorer', label: 'Explorer', rule: 'Look up a real app in the App Explorer' },
  {
    id: 'medal-cumulus-operator',
    label: 'Cumulus operator',
    rule: 'Finish the Cumulus track',
    tier: 'cumulus',
  },
  { id: 'medal-nimbus-engineer', label: 'Nimbus engineer', rule: 'Finish the Nimbus track', tier: 'nimbus' },
  {
    id: 'medal-stratus-architect',
    label: 'Stratus architect',
    rule: 'Finish the Stratus track',
    tier: 'stratus',
  },
];

const STATES: MedalState[] = ['locked', 'unlocked', 'new'];

function MedalOf({ spec, state, size }: { spec: MedalSpec; state: MedalState; size?: number }) {
  const a = art(spec.id);
  return (
    <Medal
      label={spec.label}
      rule={spec.rule}
      state={state}
      tier={spec.tier}
      size={size}
      image={a.src}
      imageAvif={a.avif}
      imageBox={a.box}
    />
  );
}

const plate = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 28,
  padding: 28,
  background: '#ffffff',
} as const;

export default function Identity() {
  const first = MEDALS[0] as MedalSpec;
  return (
    <Group
      id="identity"
      title="Marks"
      lead="The official Flux marks, inlined verbatim and never recoloured or distorted; the medal and the hex ornaments that carry the lattice into the UI; the marquee that keeps a long row calm."
    >
      <Sub>Logo on the void (blue, white)</Sub>
      <Col gap={36}>
        <Grid min={190}>
          {VARIANTS.filter((v) => v.id !== 'academy').flatMap((v) =>
            DARK_TONES.map((t) => (
              <Spec key={`${v.id}-${t}`} label={`${v.id} / ${t}`} note={t === 'blue' ? v.label : undefined}>
                <Logo variant={v.id} tone={t} size={v.id === 'mark' ? 56 : 44} title={`Flux ${v.id}`} />
              </Spec>
            )),
          )}
        </Grid>
        <Grid min={340}>
          {DARK_TONES.map((t) => (
            <Spec
              key={t}
              label={`academy / ${t}`}
              note={t === 'blue' ? 'academy: header lockup, live words' : undefined}
            >
              <Logo variant="academy" tone={t} size={44} title="Flux Academy" />
            </Spec>
          ))}
        </Grid>
      </Col>

      <Sub>Logo on a Panel</Sub>
      <Panel variant="slab" padding="lg">
        <Row>
          <Logo variant="academy" size={36} />
          <Logo variant="round" size={48} />
          <Logo variant="lockup" tone="white" size={40} />
          <Logo variant="mark" tone="white" size={44} />
        </Row>
      </Panel>

      <Sub>Black and gray, the negative files (still the dark UI)</Sub>
      <Col gap={36}>
        <Grid min={190}>
          {VARIANTS.filter((v) => v.id === 'round' || v.id === 'lockup').flatMap((v) =>
            MONO_TONES.map((t) => (
              <Spec
                key={`${v.id}-${t}`}
                label={`${v.id} / ${t}`}
                note={
                  v.id === 'round' && t === 'black'
                    ? 'white disc, black symbol'
                    : v.id === 'lockup' && t === 'gray'
                      ? 'the all-gray official lockup'
                      : undefined
                }
              >
                <Logo variant={v.id} tone={t} size={40} title={`Flux ${v.id}`} />
              </Spec>
            )),
          )}
        </Grid>
        <Grid min={340}>
          {MONO_TONES.map((t) => (
            <Spec key={t} label={`academy / ${t}`}>
              <Logo variant="academy" tone={t} size={40} title="Flux Academy" />
            </Spec>
          ))}
        </Grid>
      </Col>

      <Sub>Single-colour marks on a light surface (the only place a light plate is right)</Sub>
      <div style={plate}>
        <Logo variant="mark" tone="black" size={44} />
        <Logo variant="mark" tone="gray" size={44} />
        <Logo variant="round" tone="gray" size={44} />
        <Logo variant="lockup" tone="gray" size={44} />
      </div>

      <Sub>Clear space: x = symbol diameter / 3.6</Sub>
      <Row>
        <span style={{ outline: '1px dashed var(--blueprint-strong)' }}>
          <Logo variant="round" size={72} clearSpace />
        </span>
        <span style={{ outline: '1px dashed var(--blueprint-strong)' }}>
          <Logo variant="lockup" tone="white" size={56} clearSpace />
        </span>
        <span style={{ outline: '1px dashed var(--blueprint-strong)' }}>
          <Logo variant="academy" size={40} clearSpace href="#identity" title="Flux Academy, home" />
        </span>
      </Row>

      <Sub>Medal: locked, earned, new</Sub>
      <Row align="start">
        {STATES.map((s) => (
          <Spec key={s} label={`state="${s}"`}>
            <MedalOf spec={first} state={s} size={112} />
          </Spec>
        ))}
        <Spec label="glyph medal" note="No art: a glyph in the lit frame.">
          <Medal label="Check" glyph="check" state="unlocked" size={112} rule="A glyph stands in for art" />
        </Spec>
        <Spec label="glyph, locked">
          <Medal label="Locked glyph" glyph="shield" state="locked" size={112} rule="Rule stays visible" />
        </Spec>
      </Row>

      <Sub>The set (CONTENT.md section 6)</Sub>
      <Grid min={170}>
        {MEDALS.map((m, i) => (
          <MedalOf
            key={m.id}
            spec={m}
            state={i % 4 === 3 ? 'locked' : i % 5 === 4 ? 'new' : 'unlocked'}
            size={96}
          />
        ))}
      </Grid>

      <Sub>Tier medals wear the tier colour; sizes</Sub>
      <Row align="end">
        {[56, 72, 96, 128].map((s) => (
          <Medal
            key={s}
            label={`${s}`}
            showState={false}
            state="unlocked"
            glyph="layers"
            size={s}
            tier="nimbus"
          />
        ))}
      </Row>

      <Sub>HexBullet</Sub>
      <Grid min={220}>
        <Spec label="tones, filled">
          <Col gap={10}>
            {(['accent', 'hot', 'muted', 'ok', 'warn', 'crit'] as const).map((t) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <HexBullet tone={t} />
                <span className="t-label">{t}</span>
              </span>
            ))}
          </Col>
        </Spec>
        <Spec label="outline, sizes, pulse (live only)">
          <Col gap={10}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <HexBullet filled={false} size={7} />
              <HexBullet filled={false} size={9} />
              <HexBullet filled={false} size={12} />
              <HexBullet filled={false} size={16} tone="muted" />
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <HexBullet pulse tone="ok" />
              <span className="t-label">live, 12 blocks ago</span>
            </span>
          </Col>
        </Spec>
        <Spec label="eyebrow">
          <span className="t-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <HexBullet size={8} /> 03 / Deploy
          </span>
        </Spec>
        <Spec label="list marker">
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {['Pick a node tier', 'Write the spec', 'Ship it'].map((t) => (
              <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <HexBullet size={8} /> {t}
              </li>
            ))}
          </ul>
        </Spec>
      </Grid>

      <Sub>HexRing</Sub>
      <Row align="start">
        {[0, 0.25, 0.58, 1].map((v) => (
          <Spec key={v} label={`value=${v}`}>
            <HexRing value={v} size={104} label={`${Math.round(v * 100)} percent`}>
              <b className="t-num">{Math.round(v * 100)}</b>
            </HexRing>
          </Spec>
        ))}
        <Spec label="tier cumulus, 6 segments">
          <HexRing value={0.5} segments={6} tier="cumulus" size={104} label="Cumulus: 50 percent">
            <b className="t-num">3/6</b>
          </HexRing>
        </Spec>
        <Spec label="tier nimbus, 24 segments">
          <HexRing value={0.7} segments={24} tier="nimbus" size={104} stroke={4} label="Nimbus: 70 percent">
            <b className="t-num">70</b>
          </HexRing>
        </Spec>
        <Spec label="tier stratus, dim">
          <HexRing value={0.35} tier="stratus" size={104} dim label="Stratus: 35 percent">
            <b className="t-num">35</b>
          </HexRing>
        </Spec>
      </Row>

      <Sub>Marquee (hover or focus pauses; the control is always visible)</Sub>
      <Col gap={20}>
        <Marquee label="What Flux runs" speed={44}>
          {[
            'Decentralised',
            'Redundant',
            'Proof of useful work',
            'Docker native',
            'Global',
            'Open source',
            'Pay in FLUX',
          ].map((t) => (
            <Chip key={t} tone="accent">
              {t}
            </Chip>
          ))}
        </Marquee>
        <Marquee label="Counters, right to left" direction="right" speed={30} gap={56}>
          {[
            ['Nodes', '8,412'],
            ['Cores', '77,030'],
            ['RAM TB', '328'],
            ['Apps', '9,402'],
          ].map(([k, v]) => (
            <span
              key={k}
              style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, whiteSpace: 'nowrap' }}
            >
              <b className="t-stat" style={{ fontSize: 28 }}>
                {v}
              </b>
              <span className="t-label">{k}</span>
            </span>
          ))}
        </Marquee>
        <Marquee label="A short run, repeated" speed={60} control={false} fade={false}>
          <Logo variant="mark" tone="white" size={28} />
          <Logo variant="mark" tone="blue" size={28} />
        </Marquee>
      </Col>
    </Group>
  );
}
