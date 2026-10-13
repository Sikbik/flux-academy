import { lessonById } from '@shared/curriculum';
import { type CSSProperties, useId } from 'react';
import { Link } from 'react-router';
import { useSceneBus } from '@/scenes/bus';
import { FigCaption, Glyph, Panel, useReducedMotion } from '@/ui';
import { CHAPTERS, type Chapter } from './copy';
import { figureProgress } from './logic';
import { SectionHead } from './SectionHead';
import { HashFigure, PlaceFigure, RunFigure, SpecFigure } from './StoryFigures';
import section from './section.module.css';
import styles from './story.module.css';

/** The figure progress of chapter `index`: whole once passed, empty before, live while it is being read. */
function useFigureProgress(index: number): number {
  const reduced = useReducedMotion();
  const chapter = useSceneBus((s) => s.chapter);
  const progress = useSceneBus((s) => s.chapterProgress);
  // A still twin: with reduced motion every figure shows its finished state.
  if (reduced) return 1;
  return figureProgress(index, chapter, progress);
}

function ChapterFigure({ index }: { index: number }) {
  const p = useFigureProgress(index);
  switch (index) {
    case 0:
      return <SpecFigure progress={p} />;
    case 1:
      return <HashFigure progress={p} />;
    case 2:
      return <PlaceFigure progress={p} />;
    default:
      return <RunFigure progress={p} />;
  }
}

function ChapterCard({ chapter, index }: { chapter: Chapter; index: number }) {
  const uid = useId();
  const active = useSceneBus((s) => s.section === 'story' && s.chapter === index);
  const lesson = lessonById(chapter.lesson);
  return (
    <li
      id={`chapter-${chapter.id}`}
      className={styles.chapter}
      data-chapter={index}
      data-active={active ? 'true' : 'false'}
    >
      <Panel
        as="article"
        variant="glass"
        size="lg"
        padding="lg"
        pattern="tr"
        ruler="left"
        className={styles.card}
        contentClassName={styles.cardInner}
        aria-labelledby={`${uid}-title`}
      >
        <header className={styles.cardHead}>
          <span className={styles.step} aria-hidden="true">
            <span className={styles.stepNum}>{chapter.number}</span>
            <span className={styles.stepOf}>/ 04</span>
          </span>
          <h3 id={`${uid}-title`} className={styles.cardTitle}>
            {chapter.name}
          </h3>
        </header>
        <p className={styles.text}>{chapter.text}</p>
        <figure className={styles.figure}>
          <ChapterFigure index={index} />
          <FigCaption num={`2.${index + 1}`} title={chapter.figure} />
        </figure>
        {lesson ? (
          <p className={styles.go}>
            <Link to={`/learn/${lesson.id}`} className={styles.goLink}>
              <span className={styles.goKicker}>Go deeper</span>
              <span className={styles.goTitle}>{lesson.title}</span>
              <Glyph name="arrow-right" size={16} />
            </Link>
          </p>
        ) : null}
      </Panel>
    </li>
  );
}

/** The scrubber along the foot of the frame: four steps, the one being read lit, each a link. */
function Rail() {
  const section_ = useSceneBus((s) => s.section);
  const chapter = useSceneBus((s) => s.chapter);
  const progress = useSceneBus((s) => s.chapterProgress);
  const inStory = section_ === 'story';
  return (
    <Panel
      as="nav"
      variant="glass"
      size="sm"
      padding="sm"
      pattern="none"
      halo={false}
      className={styles.rail}
      contentClassName={styles.railInner}
      aria-label="The four steps"
    >
      <ol>
        {CHAPTERS.map((c, i) => {
          const done = chapter > i;
          const current = inStory && chapter === i;
          const fill = done ? 1 : current ? progress : 0;
          return (
            <li key={c.id} data-state={current ? 'current' : done ? 'done' : 'todo'}>
              <a href={`#chapter-${c.id}`} aria-current={current ? 'step' : undefined}>
                <span className={styles.railNum}>{c.number}</span>
                <span className={styles.railName}>{c.name}</span>
                <span
                  className={styles.railBar}
                  style={{ '--fill': fill } as CSSProperties}
                  aria-hidden="true"
                />
              </a>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/**
 * How it works: four chapters the page scrolls through while the bench behind the page acts each one out.
 * The chapter text blocks are the scroll story: the bus chapter is whichever block holds the reading line,
 * and the progress is how far through it the line has travelled. The frame on the right is the free area
 * the scene is framed in; it sticks to the viewport while the chapters pass.
 */
export function Story() {
  return (
    <section id="story" className={styles.story} data-scene="story" aria-labelledby="story-title">
      <div className={section.inner}>
        <SectionHead
          id="story-title"
          number="02"
          label="How it works"
          title="From a file to a running app, in four steps"
          lead="Scroll through them. The bench behind the page acts out each step, and every figure is tied to what it shows."
        />
      </div>
      <div className={styles.track}>
        <ol className={styles.chapters} aria-label="Describe, register, place, run">
          {CHAPTERS.map((c, i) => (
            <ChapterCard key={c.id} chapter={c} index={i} />
          ))}
        </ol>
        <div className={styles.frameCol}>
          <figure
            className={styles.frame}
            data-pin
            aria-label="The bench, following the step you are reading"
          >
            <div className={styles.area} data-frame="story" />
            <Rail />
          </figure>
        </div>
      </div>
    </section>
  );
}
