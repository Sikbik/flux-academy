import { type TrackId, trackById } from '@shared/curriculum';
import { useNavigate } from 'react-router';
import type { RankInfo } from '@/app/useRank';
import { loadLesson } from '@/learn/loader';
import { announce } from '@/system/announce';
import { type CourseModel, type ResumeTarget, resumeCopy, resumeHref, type StepInfo } from '../model';
import { Glyph, type GlyphName, HexBullet, HexRing, Odometer, Panel } from '../ui';
import styles from './PageHeader.module.css';
import { RouteButton } from './RouteButton';

const RANK_GLYPH: Record<RankInfo['id'], GlyphName> = {
  initiate: 'spark',
  cumulus: 'tier-cumulus',
  nimbus: 'tier-nimbus',
  stratus: 'tier-stratus',
};

export interface PageHeaderProps {
  model: CourseModel;
  rank: RankInfo;
  xp: number;
  target: ResumeTarget | null;
  /** Content size of the lesson the button resumes, when it has loaded. */
  targetInfo: StepInfo | undefined;
}

/**
 * The top of the course map: the line that says what this page is, and an instrument cluster that shows
 * where the learner is: lessons done, XP, rank, and one button that goes to the right place.
 */
export function PageHeader({ model, rank, xp, target, targetInfo }: PageHeaderProps) {
  const navigate = useNavigate();
  const copy = resumeCopy(model, target, targetInfo);
  const href = target ? resumeHref(target, targetInfo) : '/learn/what-is-flux';
  const fresh = model.startedCount === 0 && xp === 0;
  const firstMinutes = model.lessons[0]?.meta.minutes ?? 7;
  const tier: TrackId | undefined = rank.tier ?? undefined;
  const nextDetail =
    rank.nextTrack === null
      ? 'Every track is done.'
      : `${rank.done} of ${rank.total} ${trackById(rank.nextTrack).name} lessons toward ${rank.nextRankName}`;

  const go = async (e: React.MouseEvent) => {
    announce(copy.announcement);
    // Resuming deep links the saved step, which needs the lesson's content. If it has not loaded yet,
    // wait for it (it is already on its way) rather than landing on the first step.
    if (target?.kind === 'continue' && !targetInfo) {
      e.preventDefault();
      const r = await loadLesson(target.lessonId);
      const info: StepInfo | undefined =
        r.status === 'ready'
          ? {
              steps: r.lesson.steps.length,
              challenges: r.lesson.checkpoint.length,
              stepIds: r.lesson.steps.map((s) => s.id),
            }
          : undefined;
      void navigate(resumeHref(target, info));
    }
  };

  return (
    <header className={styles.head}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>
          <HexBullet />
          <span>Course map</span>
        </p>
        <h1 className={styles.title} tabIndex={-1}>
          <span>Three tracks,</span> <b>{model.total} lessons</b>
        </h1>
        <p className={styles.lede}>
          {fresh
            ? `Start with lesson 1. It takes ${firstMinutes} minutes, needs no account, and your progress stays in this browser.`
            : 'The lines show which lessons help before which. They are advice, not locks: start anywhere you like.'}
        </p>
      </div>

      <Panel
        variant="glass"
        size="lg"
        padding="md"
        ruler="left"
        pattern="br"
        className={styles.cluster}
        contentClassName={styles.clusterBody}
      >
        <div className={styles.cell}>
          <HexRing
            value={model.total > 0 ? model.completed / model.total : 0}
            segments={Math.max(6, model.total)}
            size={92}
            stroke={6}
            label={`${model.completed} of ${model.total} lessons done`}
          >
            <span className={styles.ringNum}>
              {model.completed}
              <small>/{model.total}</small>
            </span>
          </HexRing>
          <p className={`${styles.cap} ${styles.capNowrap}`}>Lessons done</p>
        </div>

        <div className={styles.cell}>
          <p className={styles.xp}>
            <Odometer value={xp} from={0} className={styles.xpNum} />
          </p>
          <p className={`${styles.cap} ${styles.capNowrap}`}>XP earned</p>
        </div>

        <div className={styles.cell} data-tier={tier} data-wide="">
          <p className={styles.rank}>
            <Glyph name={RANK_GLYPH[rank.id]} size={20} />
            <span>{rank.name}</span>
          </p>
          <p className={styles.cap}>{nextDetail}</p>
        </div>

        <div className={styles.cta}>
          <RouteButton to={href} variant="primary" size="lg" iconEnd="arrow-right" onClick={go}>
            {copy.label}
          </RouteButton>
          {copy.caption ? <p className={styles.ctaCap}>{copy.caption}</p> : null}
        </div>
      </Panel>
    </header>
  );
}
