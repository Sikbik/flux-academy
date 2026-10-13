import { isMacLike } from '@/lib/platform';
import { keysLabels } from '@/system/hotkeys';
import { useOverlays } from '@/system/overlays';
import { Glyph } from '@/ui';
import styles from './Header.module.css';

/** The command deck button. Shows the right modifier for the platform. */
export function DeckButton() {
  const mac = isMacLike();
  const [chips] = keysLabels('mod+k', mac);
  return (
    <button
      type="button"
      className={`${styles.chip} ${styles.deck}`}
      aria-haspopup="dialog"
      aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}
      aria-label={`Open the command deck (${(chips ?? []).join(' ')})`}
      onClick={() => useOverlays.getState().toggleDeck()}
    >
      <Glyph name="search" size={16} />
      <span className={styles.deckLabel}>Search</span>
      <span className={styles.kbd} aria-hidden="true">
        {(chips ?? []).map((k) => (
          <kbd key={k}>{k}</kbd>
        ))}
      </span>
    </button>
  );
}
