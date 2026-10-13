import { Glyph } from '../../Glyph/Glyph';
import GlyphSheet, { GlyphConstruction } from '../../Glyph/GlyphSheet';
import { Grid, Group, type KitSectionMeta, Row, Spec } from '../parts';

export const meta: KitSectionMeta = { id: 'glyphs', title: 'Glyphs', order: 90 };

export default function GlyphsSection() {
  return (
    <Group
      id="glyphs"
      title="Glyphs"
      lead="One family on a 24 unit grid: 1.5 unit stroke, square caps, mitred joins, hex-derived angles. Colour follows currentColor."
    >
      <Grid min={320}>
        <Spec label="Construction" note="Live area 3 to 21. A hexagon is drawn at radius 9.5.">
          <GlyphConstruction name="lab-forge" />
        </Spec>
        <Spec label="Sizes" note="16, 20, 24, 32 and 48 px. Stroke scales with the size.">
          <Row align="end">
            {[16, 20, 24, 32, 48].map((s) => (
              <Glyph key={s} name="lab-network" size={s} />
            ))}
          </Row>
          <Row align="end">
            {[16, 20, 24, 32, 48].map((s) => (
              <Glyph key={s} name="node" size={s} />
            ))}
          </Row>
        </Spec>
      </Grid>
      <GlyphSheet />
      <h3
        style={{
          marginBlock: '3rem 1rem',
          font: '600 0.75rem/1 var(--font-mono)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--accent-text)',
        }}
      >
        Large view
      </h3>
      <GlyphSheet view="large" />
    </Group>
  );
}
