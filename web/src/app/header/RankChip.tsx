import { Link } from 'react-router';
import { hexPath } from '@/lib/hex';
import { Glyph, type GlyphName } from '@/ui';
import { useRankInfo } from '../useRank';
import styles from './Header.module.css';

const RING = hexPath(13, 13, 11.5);

const GLYPH: Record<string, GlyphName> = {
  initiate: 'spark',
  cumulus: 'tier-cumulus',
  nimbus: 'tier-nimbus',
  stratus: 'tier-stratus',
};

/** The rank chip: a hex progress ring around the rank glyph, opening the profile. */
export function RankChip({ onNavigate }: { onNavigate?: () => void }) {
  const rank = useRankInfo();
  const detail =
    rank.nextTrack === null
      ? 'Every track is complete.'
      : `${rank.done} of ${rank.total} ${rank.nextTrack} lessons done on the way to ${rank.nextRankName}.`;
  return (
    <Link
      to="/profile"
      className={`${styles.chip} ${styles.rank}`}
      data-tier={rank.tier ?? undefined}
      title={`${rank.name}. ${detail}`}
      aria-label={`Rank: ${rank.name}. ${detail} Open your profile.`}
      onClick={onNavigate}
    >
      <span className={styles.rankRing} aria-hidden="true">
        <svg viewBox="0 0 26 26" fill="none" strokeWidth="1.8" role="presentation" aria-hidden="true">
          <path d={RING} stroke="var(--line-2)" />
          <path
            d={RING}
            stroke="currentColor"
            strokeLinecap="square"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 - rank.progress * 100}
          />
        </svg>
        <Glyph name={GLYPH[rank.id] ?? 'spark'} size={14} />
      </span>
      <span className={styles.rankName}>{rank.name}</span>
    </Link>
  );
}
