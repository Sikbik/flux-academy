/**
 * The completion moment: the XP rolls up in an odometer, a hex shard lands in the track badge, the
 * objectives tick, the recap, the next lesson and the related labs. A finished track plays the rank-up
 * (a 600 ms wash of the tier colour; under reduced motion a still banner).
 *
 * Copying the completion link copies the lesson URL only: there is no server state to share.
 */

import { labById, trackById } from '@shared/curriculum';
import { type Ref, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { achievementById } from '@/learn/achievements';
import { MarkupText } from '@/learn/MarkupText';
import { toast } from '@/system/toasts';
import { Button, Chip, Glyph, type GlyphName, Odometer, useReducedMotion } from '@/ui';
import styles from './Completion.module.css';
import { usePlayer, usePlayerCtx } from './PlayerContext';

export interface CompletionProps {
  headingRef: Ref<HTMLHeadingElement>;
}

function tierOf(rank: string): 'cumulus' | 'nimbus' | 'stratus' | null {
  const r = rank.toLowerCase();
  if (r.includes('cumulus')) return 'cumulus';
  if (r.includes('nimbus')) return 'nimbus';
  if (r.includes('stratus')) return 'stratus';
  return null;
}

export function Completion({ headingRef }: CompletionProps) {
  const { lesson, meta, store, fixture } = usePlayerCtx();
  const c = usePlayer((s) => s.completion);
  const reduced = useReducedMotion();
  const [washing, setWashing] = useState(false);

  const ranked = c?.rankedUpFrom != null;
  useEffect(() => {
    if (!ranked || reduced) return;
    setWashing(true);
    const t = window.setTimeout(() => setWashing(false), 700);
    return () => window.clearTimeout(t);
  }, [ranked, reduced]);

  if (!c) return null;

  const track = trackById(meta.track);
  const labs = meta.labs.map((id) => labById(id)).filter((l): l is NonNullable<typeof l> => Boolean(l));
  const rankTier = tierOf(c.rankAfter);
  const trackDone = c.trackCompleted ? trackById(c.trackCompleted) : null;

  const copyLink = async () => {
    const url = `${window.location.origin}/learn/${lesson.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const breakdown: string[] = [];
  if (c.alreadyCompleted) {
    breakdown.push('You have completed this lesson before, so replaying it earns nothing new.');
  } else {
    breakdown.push(`Lesson ${c.lessonXp} of ${c.lessonBase} XP`);
    if (c.challengeXp > 0 || lesson.checkpoint.length > 0) breakdown.push(`Checkpoint ${c.challengeXp} XP`);
  }

  return (
    <div className={styles.done} data-reduced={reduced ? 'true' : undefined}>
      {washing ? <span className={styles.wash} data-tier={rankTier ?? undefined} aria-hidden="true" /> : null}

      <header className={styles.hero}>
        <div className={styles.shard} data-tier={meta.track} aria-hidden="true">
          <svg
            viewBox="0 0 120 120"
            width="120"
            height="120"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path className={styles.shardRing} d="M60 6L106 33V87L60 114L14 87V33Z" />
            <path className={styles.shardFill} d="M60 26L88 42V78L60 94L32 78V42Z" />
            <path className={styles.shardCheck} d="M44 61L56 73L78 48" />
          </svg>
        </div>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>
            <Chip tier={meta.track} size="sm">
              {track.name}
            </Chip>
            Lesson complete
          </p>
          <h2 ref={headingRef} tabIndex={-1} className={styles.title}>
            {meta.title}
          </h2>
          <p className={styles.hook}>
            <MarkupText text={lesson.hook} />
          </p>
        </div>
      </header>

      <section className={styles.xp} aria-label="Experience earned">
        <div className={styles.xpBig}>
          <Odometer
            value={c.total}
            from={0}
            prefix="+"
            suffix=" XP"
            className={styles.odo}
            label={`${c.total} experience points earned`}
          />
        </div>
        <ul className={styles.lines}>
          {breakdown.map((l) => (
            <li key={l}>{l}</li>
          ))}
          {c.shown > 0 ? (
            <li>{c.shown === 1 ? '1 task' : `${c.shown} tasks`} finished with Show me (half XP)</li>
          ) : null}
          {c.skipped > 0 ? (
            <li>{c.skipped === 1 ? '1 task' : `${c.skipped} tasks`} skipped (no XP)</li>
          ) : null}
          {fixture ? <li>A development fixture: nothing was saved.</li> : null}
        </ul>
        <p className={styles.total}>
          <span>Total XP</span>
          <strong>{c.xpAfter.toLocaleString('en-US')}</strong>
          <Chip tier={rankTier ?? undefined} size="sm">
            {c.rankAfter}
          </Chip>
        </p>
      </section>

      {c.rankedUpFrom ? (
        <section className={styles.rank} data-tier={rankTier ?? undefined} aria-label="Rank up">
          <Glyph name="spark" size={20} />
          <p>
            <strong>Rank up.</strong> You went from {c.rankedUpFrom} to {c.rankAfter}.
            {trackDone ? ` You have finished the ${trackDone.name} track.` : ''}
          </p>
        </section>
      ) : null}

      {c.achievements.length > 0 ? (
        <section className={styles.medals} aria-label="Achievements unlocked">
          {c.achievements.map((id) => {
            const def = achievementById(id);
            return (
              <p key={id} className={styles.medal}>
                <Glyph name={`ach-${id}` as GlyphName} size={28} />
                <span>
                  <strong>{def?.title ?? id}</strong>
                  <span>{def?.rule}</span>
                </span>
              </p>
            );
          })}
        </section>
      ) : null}

      <div className={styles.columns}>
        <section aria-labelledby="done-can" className={styles.block}>
          <h3 id="done-can" className={styles.h3}>
            You can now
          </h3>
          <ul className={styles.ticks}>
            {lesson.objectives.map((o, i) => (
              <li key={o} style={{ ['--i' as string]: i }}>
                <span className={styles.tick} aria-hidden="true">
                  <Glyph name="check" size={13} />
                </span>
                <MarkupText text={o} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="done-recap" className={styles.block}>
          <h3 id="done-recap" className={styles.h3}>
            What to keep
          </h3>
          <ul className={styles.recap}>
            {lesson.recap.map((r) => (
              <li key={r}>
                <MarkupText text={r} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={styles.next}>
        {c.next ? (
          <Link className={styles.nextCard} to={`/learn/${c.next.id}`}>
            <span className={styles.nextLabel}>Next lesson</span>
            <span className={styles.nextTitle}>{c.next.title}</span>
            <span className={styles.nextMeta}>
              <Chip tier={c.next.track} size="sm">
                {trackById(c.next.track).name}
              </Chip>
              <span>{c.next.minutes} min</span>
            </span>
            <span className={styles.nextGo}>
              Start
              <Glyph name="arrow-right" size={16} />
            </span>
          </Link>
        ) : (
          <Link className={styles.nextCard} to="/learn">
            <span className={styles.nextLabel}>That is the last lesson</span>
            <span className={styles.nextTitle}>Back to the course map</span>
            <span className={styles.nextGo}>
              Open the map
              <Glyph name="arrow-right" size={16} />
            </span>
          </Link>
        )}

        {labs.length > 0 ? (
          <section className={styles.labs} aria-labelledby="done-labs">
            <h3 id="done-labs" className={styles.h3}>
              Try it in a lab
            </h3>
            <ul>
              {labs.map((l) => (
                <li key={l.id}>
                  <Link to={`/labs/${l.id}`}>
                    <span>{l.title}</span>
                    <Glyph name="arrow-right" size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {lesson.further.length > 0 ? (
        <section aria-labelledby="done-further" className={styles.further}>
          <h3 id="done-further" className={styles.h3}>
            Further reading
          </h3>
          <ul>
            {lesson.further.map((f) => (
              <li key={f.url}>
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  {f.label}
                  <Glyph name="arrow-up-right" size={12} />
                  <span className="sr-only">. Opens in a new tab</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={styles.actions}>
        <Button variant="secondary" size="sm" icon="copy" onClick={copyLink}>
          Copy completion link
        </Button>
        <Button variant="ghost" size="sm" icon="restart" onClick={() => store.getState().review()}>
          Review this lesson
        </Button>
        <Link className={styles.mapLink} to="/learn">
          Course map
        </Link>
      </div>
    </div>
  );
}
