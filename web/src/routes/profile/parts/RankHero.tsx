import { TRACKS, type TrackId } from '@shared/curriculum';
import { useNavigate } from 'react-router';
import type { RankInfo } from '@/app/useRank';
import { ART, medalArt } from '@/content/art';
import { Glyph, HexRing, LinkButton, Medal, Odometer, Panel, Progress } from '@/ui';
import styles from './RankHero.module.css';

export interface TrackStanding {
  id: TrackId;
  done: number;
  total: number;
  complete: boolean;
}

export interface RankHeroProps {
  rank: RankInfo;
  xp: number;
  /** The name for the certificate, shown here only as a greeting. Empty when not set. */
  name: string;
  standings: readonly TrackStanding[];
  /** When the rank's medal was earned (ISO), or null. */
  since: string | null;
  /** True when nothing has been started: the hero points at lesson 1. */
  fresh: boolean;
}

const RANK_MEDAL: Record<RankInfo['id'], string | null> = {
  initiate: null,
  cumulus: 'cumulus-operator',
  nimbus: 'nimbus-engineer',
  stratus: 'stratus-architect',
};

function shortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/**
 * The top of the profile: the rank held (as a medal), the XP odometer, how far the next rank is, and one
 * ring per track. The words say the same as the rings; nothing is told by colour alone.
 */
export function RankHero({ rank, xp, name, standings, since, fresh }: RankHeroProps) {
  const navigate = useNavigate();
  const medalId = RANK_MEDAL[rank.id];
  const artId = medalId ? medalArt(medalId) : undefined;
  const art = artId ? ART[artId] : undefined;
  const remaining = rank.total - rank.done;
  const nextTrackName = TRACKS.find((t) => t.id === rank.nextTrack)?.name ?? '';

  let note: string;
  if (rank.nextTrack === null) {
    note = 'Every track is finished. There is no higher rank: go and deploy something real.';
  } else if (rank.id === 'initiate' && rank.done === 0) {
    note = `Finish the ${nextTrackName} track to become a ${rank.nextRankName}.`;
  } else {
    const more = remaining === 1 ? 'One more lesson makes' : `${remaining} more lessons make`;
    note = `${rank.done} of ${rank.total} ${nextTrackName} lessons done. ${more} you a ${rank.nextRankName}.`;
  }

  const heading = 'profile-rank';
  const sinceText = shortDate(since);

  return (
    <Panel
      as="section"
      variant="glass"
      size="lg"
      padding="lg"
      ruler="left"
      pattern="br"
      data-tier={rank.tier ?? undefined}
      aria-labelledby={heading}
      className={styles.hero}
      contentClassName={styles.body}
    >
      <div className={styles.emblem}>
        <Medal
          label={rank.name}
          state="unlocked"
          size={176}
          tier={rank.tier ?? undefined}
          image={art?.src}
          imageAvif={art?.avif}
          imageBox={art?.box}
          glyph={art ? undefined : 'spark'}
          showLabel={false}
          showState={false}
        />
      </div>

      <div className={styles.text}>
        <p className={styles.kicker}>
          <span>Your rank</span>
          {name ? <span className={styles.who}>{name}</span> : null}
        </p>
        <h2 className={styles.rankName} id={heading}>
          <span className="sr-only">Rank: </span>
          {rank.name}
        </h2>
        {sinceText && rank.id !== 'initiate' ? <p className={styles.since}>Since {sinceText}</p> : null}

        <div className={styles.xpRow}>
          <span className={styles.xp}>
            <Odometer value={xp} from={0} />
          </span>
          <span className={styles.xpLabel}>XP earned</span>
        </div>

        <div className={styles.next}>
          <Progress
            label={rank.nextRankName ? `Progress to ${rank.nextRankName}` : 'All tracks finished'}
            value={rank.progress}
            valueText={rank.nextTrack ? `${rank.done} of ${rank.total} lessons` : 'Done'}
            tier={rank.nextTrack ?? rank.tier ?? undefined}
            size="md"
            showLabel={false}
          />
          <p className={styles.note}>{note}</p>
        </div>

        {fresh ? (
          <LinkButton
            variant="primary"
            iconEnd="arrow-right"
            href="/learn/what-is-flux"
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              void navigate('/learn/what-is-flux');
            }}
          >
            Start with lesson 1
          </LinkButton>
        ) : null}
      </div>

      <ul className={styles.tracks} aria-label="Progress in each track">
        {standings.map((s) => {
          const t = TRACKS.find((x) => x.id === s.id);
          if (!t) return null;
          return (
            <li
              key={s.id}
              className={styles.track}
              data-tier={s.id}
              data-complete={s.complete ? 'true' : undefined}
            >
              <HexRing
                value={s.total > 0 ? s.done / s.total : 0}
                segments={Math.max(3, s.total)}
                size={76}
                stroke={5.5}
                tier={s.id}
                label={`${t.name} track: ${s.done} of ${s.total} lessons done`}
              >
                <span className={styles.ringNum}>
                  {s.done}
                  <small>/{s.total}</small>
                </span>
              </HexRing>
              <span className={styles.trackText}>
                <span className={styles.trackName}>
                  <Glyph name={`tier-${s.id}` as 'tier-cumulus'} size={15} />
                  {t.name}
                </span>
                <span className={styles.trackState}>
                  {s.complete ? `Finished: ${t.rank}` : `${s.done} of ${s.total} lessons`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
