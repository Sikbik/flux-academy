import { Link } from 'react-router';
import styles from './catalogue.module.css';
import { Md } from './Prose';
import { Ul } from './Semantics';

export interface TileItem {
  id: string;
  label: string;
  value: string;
  /** Inline markup. */
  note: string;
  /** The element id on this page that explains the figure. */
  to: string;
}

/** A few headline figures. Each one is a link to the section that explains it. */
export function Tiles({ tiles, label }: { tiles: readonly TileItem[]; label: string }) {
  return (
    <Ul className={styles.tiles} aria-label={label}>
      {tiles.map((t) => (
        <li key={t.id} className={styles.tile}>
          <Link to={{ hash: `#${t.to}` }} className={styles.tileLink}>
            <span className={styles.tileLabel}>{t.label}</span>
            <span className={styles.tileValue}>{t.value}</span>
            <span className={styles.tileNote}>
              <Md text={t.note} />
            </span>
          </Link>
        </li>
      ))}
    </Ul>
  );
}
