import type { Track } from '@shared/curriculum';
import { type ArtId, TRACK_ART } from '@/content/art';
import type { MapLesson } from '../model';
import { Glyph, HexRing } from '../ui';
import { Art } from './Art';
import styles from './BandHeader.module.css';
import { plural } from './geometry';

export interface ModuleSummary {
  /** The curriculum's module label, for example "The network". */
  module: string;
  /** `${track}|${module}`, the key the map uses to isolate a module. */
  key: string;
  count: number;
  done: number;
  minutes: number;
  art: ArtId | undefined;
}

export interface BandHeaderProps {
  track: Track;
  /** 0-based position of the track, shown as `01 / CUMULUS`. */
  index: number;
  lessons: readonly MapLesson[];
  modules: readonly ModuleSummary[];
  /** The module isolated by a click (sticky). */
  selectedModule: string | null;
  onModulePreview: (key: string | null) => void;
  onModuleToggle: (key: string) => void;
  /** `band` sits above a band of the map, `strip` is its one-line form on a phone, `row` heads a track in the list. */
  variant: 'band' | 'strip' | 'row';
  /** How much room the header has: set by the map from the measured width. */
  density?: 'full' | 'compact' | 'tiny';
  className?: string;
  style?: React.CSSProperties;
  headingId?: string;
}

const TRACK_GLYPH = { cumulus: 'tier-cumulus', nimbus: 'tier-nimbus', stratus: 'tier-stratus' } as const;

/**
 * The track summary: emblem, name, what it teaches, a ring with one cell per lesson, and a chip for each
 * module (with its art as the section marker). Hovering or focusing a module chip lights that module's
 * lessons on the map; pressing it keeps them lit.
 */
export function BandHeader({
  track,
  index,
  lessons,
  modules,
  selectedModule,
  onModulePreview,
  onModuleToggle,
  variant,
  density = 'full',
  className,
  style,
  headingId,
}: BandHeaderProps) {
  const total = lessons.length;
  const done = lessons.filter((l) => l.status === 'complete').length;
  const minutes = lessons.reduce((s, l) => s + l.meta.minutes, 0);
  const complete = total > 0 && done === total;
  const row = variant === 'row';

  if (variant === 'strip') {
    return (
      <header
        className={`${styles.head} ${className ?? ''}`}
        data-tier={track.id}
        data-variant="strip"
        data-complete={complete ? 'true' : undefined}
        style={style}
      >
        <p className={styles.eyebrow}>
          <Glyph name={TRACK_GLYPH[track.id]} size={14} />
          <span>
            {String(index + 1).padStart(2, '0')} / {track.name.toUpperCase()}
          </span>
        </p>
        <h2 className={styles.title} id={headingId}>
          {track.title}
        </h2>
        <p className={styles.stripCount}>
          <span className="sr-only">{`${track.name} track: ${done} of ${total} lessons done`}</span>
          <span aria-hidden="true">
            {done}/{total}
          </span>
        </p>
      </header>
    );
  }

  return (
    <header
      className={`${styles.head} ${className ?? ''}`}
      data-tier={track.id}
      data-variant={variant}
      data-density={density === 'full' ? undefined : density}
      data-complete={complete ? 'true' : undefined}
      style={style}
    >
      <div className={styles.main}>
        <span className={styles.emblem} aria-hidden="true">
          <Art id={TRACK_ART[track.id]} size={row ? 104 : 58} />
        </span>
        <div className={styles.text}>
          <p className={styles.eyebrow}>
            <Glyph name={TRACK_GLYPH[track.id]} size={14} />
            <span>
              {String(index + 1).padStart(2, '0')} / {track.name.toUpperCase()}
            </span>
          </p>
          <h2 className={styles.title} id={headingId}>
            {track.title}
          </h2>
          <p className={styles.meta}>
            {plural(total, 'lesson', 'lessons')}, {minutes} min
          </p>
          {row ? <p className={styles.summary}>{track.summary}</p> : null}
          {row ? (
            <p className={styles.reward}>
              <Glyph name={complete ? 'check' : 'lock'} size={14} />
              {complete ? `Earned: ${track.rank}` : `Finish all ${total} to earn ${track.rank}`}
            </p>
          ) : null}
        </div>
        <HexRing
          value={total > 0 ? done / total : 0}
          segments={Math.max(3, total)}
          size={row ? 76 : 50}
          stroke={row ? 6 : 4.5}
          tier={track.id}
          label={`${track.name} track: ${done} of ${total} lessons done`}
          className={styles.ring}
        >
          <span className={styles.ringNum}>
            {done}
            <small>/{total}</small>
          </span>
        </HexRing>
      </div>

      {!row && modules.length > 1 ? (
        <ul className={styles.modules} aria-label={`Modules in the ${track.name} track`}>
          {modules.map((m) => {
            const pressed = selectedModule === m.key;
            return (
              <li key={m.key}>
                <button
                  type="button"
                  className={styles.module}
                  aria-pressed={pressed}
                  aria-label={`${m.module}, ${m.done} of ${m.count} ${m.count === 1 ? 'lesson' : 'lessons'} done`}
                  title={`${m.module}: ${m.done} of ${m.count} done, ${m.minutes} min`}
                  data-done={m.done === m.count ? 'true' : undefined}
                  onClick={() => onModuleToggle(m.key)}
                  onPointerEnter={() => onModulePreview(m.key)}
                  onPointerLeave={() => onModulePreview(null)}
                  onFocus={() => onModulePreview(m.key)}
                  onBlur={() => onModulePreview(null)}
                >
                  {m.art ? <Art id={m.art} size={26} className={styles.moduleArt} /> : null}
                  <span className={styles.moduleName}>{m.module}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </header>
  );
}
