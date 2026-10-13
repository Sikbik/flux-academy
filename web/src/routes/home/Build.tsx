import { lessonById, trackById } from '@shared/curriculum';
import { type CSSProperties, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ART } from '@/content/art';
import { useLearner } from '@/learn/store';
import { Chip, Glyph, IconButton, Panel, useReducedMotion } from '@/ui';
import styles from './build.module.css';
import { buildCopy, EXAMPLES, type Example } from './copy';
import { SectionHead } from './SectionHead';
import section from './section.module.css';

function ExampleArt({ example }: { example: Example }) {
  const a = ART[example.art];
  const style = { '--cx': (a.box[0] + a.box[2]) / 2, '--cy': (a.box[1] + a.box[3]) / 2 } as CSSProperties;
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

const KIND_WORD = { concept: 'Concept', 'hands-on': 'Hands-on', project: 'Project' } as const;

function Card({ example, index }: { example: Example; index: number }) {
  const uid = useId();
  const lesson = lessonById(example.lesson);
  const done = useLearner((s) => Boolean(s.lessons[example.lesson]?.completedAt));
  if (!lesson) return null;
  const track = trackById(lesson.track);
  return (
    <li className={styles.item} data-index={index}>
      <Panel
        as={Link}
        to={`/learn/${lesson.id}`}
        variant="slab"
        interactive
        tilt={3}
        container
        padding="md"
        tone={lesson.track}
        pattern="br"
        className={styles.card}
        contentClassName={styles.inner}
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-desc`}
      >
        <ExampleArt example={example} />
        <span className={styles.tags}>
          <Chip tier={lesson.track} size="sm">
            {track.name}
          </Chip>
          <span className={styles.meta}>
            {KIND_WORD[lesson.kind]}, {lesson.minutes} min
          </span>
          {done ? (
            <Chip kind="status" status="ok" size="sm" icon="check">
              Done
            </Chip>
          ) : null}
        </span>
        <span id={`${uid}-title`} className={styles.title}>
          {example.title}
        </span>
        <span id={`${uid}-desc`} className={styles.blurb}>
          {example.blurb}
        </span>
        <span className={styles.cta}>
          {lesson.title}
          <Glyph name="arrow-right" size={16} />
        </span>
      </Panel>
    </li>
  );
}

/**
 * What you will build: the real examples on a scroll-snap rail in course order, each a doorway to the lesson
 * that builds it. The rail scrolls, so any number of cards fits; the chevrons and the keyboard walk it.
 */
export function Build() {
  const copy = buildCopy(EXAMPLES.length);
  const rail = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    const start = el.scrollLeft <= 2;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setEdge((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
    };
  }, [measure]);

  const step = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('li');
    const w = first ? first.getBoundingClientRect().width + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * w, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <section id="build" className={section.section} data-scene="build" aria-labelledby="build-title">
      <div className={section.inner}>
        <SectionHead
          id="build-title"
          number="06"
          label="What you will build"
          title={copy.title}
          lead={copy.lead}
          aside={
            <span className={styles.controls}>
              <IconButton
                icon="chevron-left"
                label="Previous example"
                size="sm"
                disabled={edge.start}
                onClick={() => step(-1)}
              />
              <IconButton
                icon="chevron-right"
                label="Next example"
                size="sm"
                disabled={edge.end}
                onClick={() => step(1)}
              />
            </span>
          }
        />
      </div>
      <div className={styles.bleed}>
        <ul ref={rail} className={styles.rail} aria-label={copy.listLabel}>
          {EXAMPLES.map((e, i) => (
            <Card key={e.id} example={e} index={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}
