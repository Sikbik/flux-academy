import { Chip } from '../..';
import { Col, Grid, Group, type KitSectionMeta, Row, Spec, Sub, Swatch, SwatchGrid } from '../parts';

export const meta: KitSectionMeta = { id: 'colour', title: 'Colour', order: 10 };

const INKS = ['--void', '--ink-0', '--ink-1', '--ink-2', '--ink-3', '--ink-4', '--ink-5'];
const ACCENT_SCALE = [100, 200, 300, 400, 500, 600, 700, 800].map((n) => `--accent-${n}`);
const ROLES = [
  ['--accent', 'rings, borders on active, icons'],
  ['--accent-text', 'links, numbers (AA on every ink)'],
  ['--accent-strong', 'hover edges, active labels'],
  ['--accent-solid', 'primary control fill'],
  ['--on-accent', 'text on the solid'],
  ['--hot', 'white-hot: focus, beam head'],
  ['--hot-2', 'white tinted by the accent'],
  ['--blueprint', 'annotation lines'],
] as const;

export default function Colour() {
  return (
    <Group
      id="colour"
      title="Colour"
      lead="Dark only. Elevation is lightness (ink-0 to ink-5), not drop shadow. Surfaces carry a 4 to 6 percent Blue Wave cast so panels share a colour space with the accent. Switch the accent in the bar: every role re-points."
    >
      <Sub>Surfaces</Sub>
      <SwatchGrid>
        {INKS.map((t) => (
          <Swatch key={t} token={t} border />
        ))}
      </SwatchGrid>

      <Sub>Lines and text</Sub>
      <SwatchGrid>
        {['--line-1', '--line-2', '--line-3', '--line-blue'].map((t) => (
          <Swatch key={t} token={t} border />
        ))}
      </SwatchGrid>
      <Row>
        {['--text-1', '--text-2', '--text-3', '--text-4'].map((t, i) => (
          <Spec key={t} label={`${t}  ${['19.9', '14.6', '8.8', '4.1'][i]}:1 on ink-0`}>
            <span style={{ color: `var(${t})`, font: 'var(--type-body)' }}>The decentralized cloud</span>
          </Spec>
        ))}
      </Row>

      <Sub>Accent scale and roles (current accent)</Sub>
      <SwatchGrid>
        {ACCENT_SCALE.map((t) => (
          <Swatch key={t} token={t} />
        ))}
      </SwatchGrid>
      <SwatchGrid>
        {ROLES.map(([t, note]) => (
          <Swatch key={t} token={t} note={note} />
        ))}
      </SwatchGrid>

      <Sub>Tiers and tracks (tier colour means tier, nothing else)</Sub>
      <Row>
        <Chip tier="cumulus">Cumulus</Chip>
        <Chip tier="nimbus">Nimbus</Chip>
        <Chip tier="stratus">Stratus</Chip>
        <span className="t-small">Shape also differs: one, two and three layers.</span>
      </Row>
      <SwatchGrid>
        {['--cumulus', '--nimbus', '--stratus'].map((t) => (
          <Swatch key={t} token={t} />
        ))}
      </SwatchGrid>

      <Sub>Status (always an icon and a word)</Sub>
      <Row>
        <Chip kind="status" status="ok">
          Live
        </Chip>
        <Chip kind="status" status="pending">
          Syncing
        </Chip>
        <Chip kind="status" status="warn">
          Cached
        </Chip>
        <Chip kind="status" status="crit">
          Offline
        </Chip>
        <Chip kind="status" status="off">
          Unknown
        </Chip>
      </Row>
      <SwatchGrid>
        {['--status-ok', '--status-pending', '--status-warn', '--status-crit', '--status-off'].map((t) => (
          <Swatch key={t} token={t} />
        ))}
      </SwatchGrid>

      <Sub>Marginalia tints and code</Sub>
      <Grid min={180}>
        {['--callout-why', '--callout-gotcha', '--callout-tip', '--callout-wild', '--callout-cost'].map(
          (t) => (
            <Swatch key={t} token={t} />
          ),
        )}
      </Grid>
      <SwatchGrid>
        {[
          '--code-fg',
          '--code-keyword',
          '--code-fn',
          '--code-string',
          '--code-number',
          '--code-key',
          '--code-flag',
          '--code-type',
          '--code-comment',
          '--code-punct',
        ].map((t) => (
          <Swatch key={t} token={t} />
        ))}
      </SwatchGrid>

      <Sub>Brand anchors (the symbol is only ever these)</Sub>
      <Col>
        <Row>
          {['--flux-blue', '--flux-blue-2', '--flux-blue-3', '--flux-graphite', '--flux-gray'].map((t) => (
            <Swatch key={t} token={t} />
          ))}
        </Row>
      </Col>
    </Group>
  );
}
