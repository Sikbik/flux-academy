import type { CSSProperties } from 'react';
import { Glyph } from './Glyph';
import styles from './GlyphSheet.module.css';
import { GLYPH_GROUPS, GLYPH_NAMES, type GlyphName } from './glyphs';

/** One glyph at 48, 24 and 16 px, with its name. */
function Cell({ name }: { name: GlyphName }) {
  return (
    <li className={styles.cell}>
      <span className={styles.sizes}>
        <span className={styles.big}>
          <Glyph name={name} size={48} />
        </span>
        <span className={styles.mid}>
          <Glyph name={name} size={24} />
        </span>
        <span className={styles.small}>
          <Glyph name={name} size={16} />
        </span>
      </span>
      <code className={styles.name}>{name}</code>
    </li>
  );
}

/** The construction view: one glyph at 8x over its 24 unit grid and the 3..21 live area. */
export function GlyphConstruction({ name }: { name: GlyphName }) {
  return (
    <div className={styles.construct} style={{ '--u': '10px' } as CSSProperties}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.live} aria-hidden="true" />
      <Glyph name={name} size={240} className={styles.constructGlyph} />
    </div>
  );
}

/** One glyph large, for review: the shapes at 96 px with their name. */
function LargeCell({ name }: { name: GlyphName }) {
  return (
    <li className={styles.largeCell}>
      <Glyph name={name} size={96} />
      <code className={styles.name}>{name}</code>
    </li>
  );
}

export interface GlyphSheetProps {
  /** `working` (default): 48, 24 and 16 px per glyph. `large`: 96 px, to study the drawing. */
  view?: 'working' | 'large';
}

/**
 * Every glyph, grouped, at the three working sizes. The 16 px row is the test: if a glyph
 * is muddy there, it is redrawn. Used by the kit gallery.
 */
export default function GlyphSheet({ view = 'working' }: GlyphSheetProps) {
  const large = view === 'large';
  return (
    <div className={styles.sheet}>
      <p className={styles.count}>
        {GLYPH_NAMES.length} glyphs in {GLYPH_GROUPS.length} groups.{' '}
        {large ? 'Shown at 96 px.' : 'Shown at 48, 24 and 16 px.'}
      </p>
      {GLYPH_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`glyph-group-${view}-${group.id}`} className={styles.group}>
          <h3 id={`glyph-group-${view}-${group.id}`} className={styles.title}>
            {group.title}
            <span className={styles.n}>{group.names.length}</span>
          </h3>
          <ul className={large ? styles.largeList : styles.list}>
            {group.names.map((name) =>
              large ? <LargeCell key={name} name={name} /> : <Cell key={name} name={name} />,
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
