import { ART, medalArt } from '@/content/art';
import type { AchievementState } from '@/learn/achievements';
import { Glyph, Medal } from '@/ui';
import styles from './Achievements.module.css';

export interface AchievementsProps {
  list: readonly AchievementState[];
  unlocked: number;
  total: number;
  /** The current time: a medal earned in the last day shows as new (its burst plays once). */
  now: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function earnedOn(iso: string | null): { text: string; iso: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    iso,
    text: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d),
  };
}

const RANK_MEDALS = new Set(['cumulus-operator', 'nimbus-engineer', 'stratus-architect']);

/**
 * The twelve medals. An earned medal is lit and carries its date; a locked one is dim and says, in words,
 * what earns it. Both say which state they are in as text, not only as light.
 */
export function Achievements({ list, unlocked, total, now }: AchievementsProps) {
  return (
    <>
      <div className={styles.summary}>
        <p className={styles.count} aria-live="off">
          <b>{unlocked}</b> of {total} earned
        </p>
        {unlocked === 0 ? (
          <p className={styles.hint}>
            <Glyph name="info" size={15} />
            Your first one is waiting: open lesson 1 and you earn First light.
          </p>
        ) : null}
      </div>

      <ul className={styles.grid} aria-label="Achievements">
        {list.map((a) => {
          const earned = earnedOn(a.unlockedAt);
          const recent = earned !== null && now.getTime() - Date.parse(earned.iso) < DAY_MS;
          const artId = medalArt(a.id);
          const art = artId ? ART[artId] : undefined;
          return (
            <li key={a.id} className={styles.cell} data-earned={earned ? 'true' : 'false'} data-tier={a.tier}>
              <Medal
                label={a.title}
                state={recent ? 'new' : earned ? 'unlocked' : 'locked'}
                size={120}
                tier={RANK_MEDALS.has(a.id) ? a.tier : undefined}
                image={art?.src}
                imageAvif={art?.avif}
                imageBox={art?.box}
                glyph={art ? undefined : 'spark'}
                rule={
                  <>
                    <span className={styles.rule}>{a.rule}</span>
                    {earned ? (
                      <time className={styles.when} dateTime={earned.iso}>
                        {earned.text}
                      </time>
                    ) : null}
                  </>
                }
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
