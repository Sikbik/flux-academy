import { lessonsOfTrack, TRACKS, type Track, type TrackId, trackMinutes } from '@shared/curriculum';
import { type CSSProperties, useId, useMemo } from 'react';
import { Link } from 'react-router';
import { ART, TRACK_ART } from '@/content/art';
import { useNetworkSelect, useSectionAge } from '@/data';
import { freshnessKind } from '@/data/chips';
import { useLearner } from '@/learn/store';
import { formatInt } from '@/lib/format';
import { useSceneBus } from '@/scenes/bus';
import { FreshnessChip, Glyph, HexRing, Panel } from '@/ui';
import { asOfLine, trackEntry, trackProgress } from './logic';
import styles from './paths.module.css';
import { SectionHead } from './SectionHead';
import section from './section.module.css';

/**
 * A track emblem. The three share one baseline and rise to different heights, so a row of them reads
 * short, mid, tall with no layout code; the box is cropped to the lit part so each slab is only as tall
 * as its tower. Light on black, screened onto the glass.
 */
function TrackArt({ track }: { track: TrackId }) {
  const a = ART[TRACK_ART[track]];
  const top = a.box[1];
  const bottom = a.box[3];
  const style = { '--top': top, '--lit': bottom - top } as CSSProperties;
  return (
    <span className={styles.art} style={style} aria-hidden="true">
      <picture>
        {a.avif ? <source srcSet={a.avif} type="image/avif" /> : null}
        <img
          src={a.src}
          alt=""
          width={a.width}
          height={a.height}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </picture>
    </span>
  );
}

/** How many machines of this tier are online, with the honest "as of" line when it is not live. */
function TierCount({ tier, name }: { tier: TrackId; name: string }) {
  const count = useNetworkSelect((n) => n.nodes.tiers[tier]);
  const sec = useSectionAge('nodes');
  const asOf = asOfLine(sec.status, sec.asOf);
  return (
    <span className={styles.live}>
      <span className={styles.liveNum}>{count === null ? '--' : formatInt(count)}</span>
      <span className={styles.liveText}>
        {name} nodes online
        {asOf ? <span className={styles.asOf}>{asOf}</span> : null}
      </span>
    </span>
  );
}

function Tower({ track }: { track: Track }) {
  const uid = useId();
  const lessons = useLearner((s) => s.lessons);
  const setTierFocus = useSceneBus((s) => s.setTierFocus);
  const progress = useMemo(() => trackProgress(track.id, lessons), [track.id, lessons]);
  const entry = useMemo(() => trackEntry(track.id, lessons), [track.id, lessons]);
  const count = lessonsOfTrack(track.id).length;
  const minutes = trackMinutes(track.id);
  const verb = progress.done >= progress.total ? 'Review' : progress.started ? 'Continue' : 'Start';
  const value = progress.total > 0 ? progress.done / progress.total : 0;

  return (
    <li className={styles.item}>
      <Panel
        as={Link}
        to={`/learn/${entry}`}
        tone={track.id}
        interactive
        tilt={3}
        container
        padding="lg"
        pattern="tr"
        className={styles.card}
        contentClassName={styles.inner}
        aria-labelledby={`${uid}-name`}
        aria-describedby={`${uid}-desc`}
        onPointerEnter={(e: React.PointerEvent) => {
          if (e.pointerType === 'mouse') setTierFocus(track.id);
        }}
        onPointerLeave={() => setTierFocus(null)}
        onFocus={() => setTierFocus(track.id)}
        onBlur={() => setTierFocus(null)}
      >
        <TrackArt track={track.id} />
        <span className={styles.body}>
          <span id={`${uid}-name`} className={styles.name}>
            <span className={styles.tierName}>
              <Glyph name={`tier-${track.id}`} size={16} />
              {track.name}
            </span>
            <span className={styles.title}>{track.title}</span>
          </span>
          <span id={`${uid}-desc`} className={styles.desc}>
            <span className={styles.summary}>{track.summary}</span>
            <span className={styles.meta}>
              {count} lessons, {minutes} min
            </span>
          </span>
          <TierCount tier={track.id} name={track.name} />
        </span>
        <span className={styles.foot}>
          <HexRing
            value={value}
            tier={track.id}
            size={52}
            stroke={4}
            segments={Math.max(6, progress.total)}
            ticks={false}
            label={`${track.name}: ${progress.done} of ${progress.total} lessons done`}
          >
            <span className={styles.ringText}>
              {progress.done}/{progress.total}
            </span>
          </HexRing>
          <span className={styles.cta}>
            {verb} {track.name}
            <Glyph name="arrow-right" size={16} />
          </span>
        </span>
      </Panel>
    </li>
  );
}

/** Pick your path: three towers, one per node tier, as glass slabs that stair-step from short to tall. */
export function Paths() {
  const sec = useSectionAge('nodes');
  return (
    <section id="path" className={section.section} data-scene="path" aria-labelledby="path-title">
      <div className={section.inner}>
        <SectionHead
          id="path-title"
          number="03"
          label="Pick your path"
          title="Three tracks, short to tall"
          lead="Start at the bottom, or jump to the track that matches what you already know. Each one is named for a node tier, smallest machines first."
          aside={
            <>
              <FreshnessChip
                kind={freshnessKind(sec.status)}
                ageMs={sec.ageMs}
                hideAge={sec.status === 'fallback'}
              />
              <span className={styles.asideText}>
                Counts are machines online in each tier, as the chip says, with their age.
              </span>
            </>
          }
        />
        <ul className={styles.towers} aria-label="The three tracks">
          {TRACKS.map((t) => (
            <Tower key={t.id} track={t} />
          ))}
        </ul>
      </div>
    </section>
  );
}
