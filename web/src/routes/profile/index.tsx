import { TRACKS } from '@shared/curriculum';
import { useMemo } from 'react';
import { computeRankInfo } from '@/app/useRank';
import { useAchievements } from '@/learn/achievements';
import { trackCompletion, useLearner } from '@/learn/store';
import { HexBullet } from '@/ui';
import { buildActivity } from './activity';
import styles from './Page.module.css';
import { Achievements } from './parts/Achievements';
import { ActivityStrip } from './parts/ActivityStrip';
import { CertificateSection } from './parts/CertificateSection';
import { Preferences } from './parts/Preferences';
import { RankHero, type TrackStanding } from './parts/RankHero';
import { YourData } from './parts/YourData';

const RANK_MEDAL = {
  initiate: null,
  cumulus: 'cumulus-operator',
  nimbus: 'nimbus-engineer',
  stratus: 'stratus-architect',
} as const;

/**
 * The profile: where you stand and what you hold. Rank and XP, the twelve medals, the last twelve weeks,
 * the certificate, preferences and your data. Everything on it is read from, and written to, this browser.
 */
export default function Profile() {
  const lessons = useLearner((s) => s.lessons);
  const xp = useLearner((s) => s.xp);
  const name = useLearner((s) => s.name);
  const activeDays = useLearner((s) => s.activeDays);
  const setName = useLearner((s) => s.setName);
  const { list, unlocked, total } = useAchievements();

  const rank = useMemo(() => computeRankInfo(lessons), [lessons]);
  const completion = useMemo(() => trackCompletion(lessons), [lessons]);
  const standings = useMemo<TrackStanding[]>(
    () =>
      TRACKS.map((t) => ({
        id: t.id,
        done: completion[t.id].done,
        total: completion[t.id].total,
        complete: completion[t.id].complete,
      })),
    [completion],
  );
  const now = useMemo(() => new Date(), []);
  const activity = useMemo(() => buildActivity(activeDays, now), [activeDays, now]);

  const medalId = RANK_MEDAL[rank.id];
  const since = medalId ? (list.find((a) => a.id === medalId)?.unlockedAt ?? null) : null;
  const fresh = Object.keys(lessons).length === 0 && xp === 0;

  const nextTrackId = rank.nextTrack;
  const nextTrack = nextTrackId
    ? (() => {
        const t = TRACKS.find((x) => x.id === nextTrackId);
        return t
          ? {
              name: t.name,
              done: completion[t.id].done,
              total: completion[t.id].total,
              rankName: t.rank,
            }
          : null;
      })()
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>
            <HexBullet />
            <span>Profile</span>
          </p>
          <h1 className={styles.title} tabIndex={-1}>
            Your progress
          </h1>
          <p className={styles.lede}>
            Your rank, medals and certificate, kept in this browser. Nothing here is sent anywhere and nobody
            verifies it: it is your own record, and it is yours to export or erase.
          </p>
        </header>

        <RankHero rank={rank} xp={xp} name={name} standings={standings} since={since} fresh={fresh} />

        <section className={styles.section} aria-labelledby="profile-achievements">
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle} id="profile-achievements">
              Achievements
            </h2>
          </div>
          <Achievements list={list} unlocked={unlocked} total={total} now={now} />
        </section>

        <section className={styles.section} aria-labelledby="profile-activity">
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle} id="profile-activity">
              Activity
            </h2>
            <p className={styles.sectionNote}>The last {activity.weeks} weeks</p>
          </div>
          <ActivityStrip activity={activity} now={now} />
        </section>

        <section className={styles.section} aria-labelledby="profile-certificate">
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle} id="profile-certificate">
              Certificate
            </h2>
          </div>
          <CertificateSection name={name} onNameChange={setName} lessons={lessons} nextTrack={nextTrack} />
        </section>

        <div className={styles.pair}>
          <section className={styles.section} aria-labelledby="profile-prefs">
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle} id="profile-prefs">
                Preferences
              </h2>
            </div>
            <Preferences completion={completion} />
          </section>

          <section className={styles.section} aria-labelledby="profile-data">
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle} id="profile-data">
                Your data
              </h2>
            </div>
            <YourData />
          </section>
        </div>
      </div>
    </div>
  );
}
