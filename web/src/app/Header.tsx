import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useOverclockActive } from '@/system/theme';
import { Glyph } from '@/ui';
import { AccentSwitcher } from './header/AccentSwitcher';
import { BlockBeat } from './header/BlockBeat';
import { DeckButton } from './header/DeckButton';
import styles from './header/Header.module.css';
import { MobileSheet } from './header/MobileSheet';
import { PillNav } from './header/PillNav';
import { RankChip } from './header/RankChip';
import { SoundToggle } from './header/SoundToggle';

/** Scroll distance after which the header condenses (docs/DESIGN.md section 5.1). */
export const CONDENSE_AT = 120;

function useCondensed(): boolean {
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      // A little hysteresis so the bar does not flutter at the threshold.
      setCondensed((was) => (was ? window.scrollY > CONDENSE_AT - 24 : window.scrollY > CONDENSE_AT));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return condensed;
}

/** The shell header. See header/ for the pieces. */
export function Header() {
  const condensed = useCondensed();
  const [sheet, setSheet] = useState(false);
  const overclock = useOverclockActive();

  return (
    <header className={styles.header} data-condensed={condensed ? 'true' : 'false'}>
      <span className={styles.glass} aria-hidden="true" />
      <span className={styles.ticks} aria-hidden="true" />
      <div className={styles.bar}>
        <Link to="/" className={styles.lockup} aria-label="Flux Academy, home">
          <img
            className={styles.symbol}
            src="/brand/round/flux-round-blue-white.svg"
            alt=""
            width={32}
            height={32}
            decoding="async"
          />
          <span className={styles.word} aria-hidden="true">
            <b>Flux</b> <span>Academy</span>
          </span>
        </Link>

        <PillNav />

        <div className={styles.cluster}>
          {overclock ? <span className={styles.overclock}>Overclock</span> : null}
          <BlockBeat />
          <RankChip />
          <DeckButton />
          <AccentSwitcher />
          <SoundToggle className={styles.soundDesktop} />
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.phoneOnly}`}
            aria-label="Open the menu"
            aria-haspopup="dialog"
            aria-expanded={sheet}
            onClick={() => setSheet(true)}
          >
            <Glyph name="menu" size={20} />
          </button>
        </div>
      </div>
      <MobileSheet open={sheet} onClose={() => setSheet(false)} />
    </header>
  );
}
