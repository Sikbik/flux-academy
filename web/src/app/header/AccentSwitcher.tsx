import { TRACKS } from '@shared/curriculum';
import type { CSSProperties } from 'react';
import { trackCompletion, useLearner } from '@/learn/store';
import { ACCENTS, type AccentId, isAccentUnlocked, unlockRule, usePrefs } from '@/system/prefs';
import { useEffectiveAccent } from '@/system/theme';
import { toast } from '@/system/toasts';
import { Glyph } from '@/ui';
import styles from './Header.module.css';

const COLOUR: Record<AccentId, string> = {
  flux: 'var(--flux-blue)',
  cumulus: 'var(--cumulus)',
  nimbus: 'var(--nimbus)',
  stratus: 'var(--stratus)',
};

const NAME: Record<AccentId, string> = {
  flux: 'Flux blue',
  cumulus: 'Cumulus cyan',
  nimbus: 'Nimbus violet',
  stratus: 'Stratus gold',
};

/**
 * Four hex swatches. A tier accent unlocks when that track is finished (docs/DESIGN.md section 3.1):
 * the locked ones are dim, wear a lock glyph and say the rule. Pressing a locked one explains it
 * instead of doing nothing.
 */
export function AccentSwitcher({ className }: { className?: string }) {
  const lessons = useLearner((s) => s.lessons);
  const active = useEffectiveAccent();
  const completion = trackCompletion(lessons);

  const choose = (accent: AccentId) => {
    if (usePrefs.getState().setAccent(accent)) return;
    toast.warn(unlockRule(accent), { key: 'accent-locked' });
  };

  return (
    <fieldset className={`${styles.accents} ${className ?? ''}`}>
      <legend className="sr-only">Accent colour</legend>
      {ACCENTS.map((accent) => {
        const unlocked = isAccentUnlocked(accent, completion);
        const track = TRACKS.find((t) => t.id === accent);
        const label = unlocked
          ? `${NAME[accent]} accent`
          : `${NAME[accent]} accent, locked. ${unlockRule(accent)}`;
        return (
          <button
            key={accent}
            type="button"
            className={styles.swatch}
            style={{ '--sw': COLOUR[accent] } as CSSProperties}
            aria-pressed={active === accent}
            aria-label={label}
            title={unlocked ? `${track?.name ?? 'Flux'} accent` : unlockRule(accent)}
            data-locked={unlocked ? undefined : 'true'}
            onClick={() => choose(accent)}
          >
            <span className={styles.hex} />
            {unlocked ? null : (
              <span className={styles.lock}>
                <Glyph name="lock" size={11} />
              </span>
            )}
          </button>
        );
      })}
    </fieldset>
  );
}
