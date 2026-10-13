import { LESSONS } from '@shared/curriculum';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { describeStatus, useChainClock, useConnection, useDataAge, useNetwork } from '@/data';
import { allTerms } from '@/learn/glossary';
import { StatusDot } from '@/ui';
import styles from './Ambient.module.css';
import { buildPlaylist, type Caption, describeLive } from './captions';
import { CAPTION_MS, CROSSFADE_MS, captionAt, nextStart } from './schedule';

/** Where the last tour stopped, so the next one carries on instead of opening on the same fact. */
let lastShown: number | null = null;

const TONE: Record<string, 'ok' | 'warn' | 'crit' | 'off' | 'pending'> = {
  ok: 'ok',
  warn: 'warn',
  crit: 'crit',
  off: 'off',
  info: 'pending',
};

function LiveBody({ caption }: { caption: Extract<Caption, { kind: 'live' }> }) {
  const network = useNetwork();
  const clock = useChainClock();
  const connection = useConnection();
  const age = useDataAge('network');
  const live = describeLive(caption.metric, { network: network.data, status: network.status, clock });
  const chip = describeStatus(live.status, { meta: network.meta, ageMs: age, connection });
  return (
    <>
      <p className={styles.headline} style={{ '--i': 1 } as CSSProperties}>
        {live.headline}
      </p>
      <p className={styles.body} style={{ '--i': 2 } as CSSProperties}>
        {live.body}
      </p>
      <p className={styles.source} style={{ '--i': 3 } as CSSProperties}>
        <StatusDot status={TONE[chip.tone] ?? 'off'} pulse={live.status === 'live'} size={8} />
        <span>{chip.label}</span>
        {chip.detail ? <span className={styles.sourceNote}>{chip.detail}</span> : null}
        {live.status !== 'live' && live.status !== 'loading' ? (
          <span className={styles.sourceNote}>{chip.sentence}</span>
        ) : null}
      </p>
    </>
  );
}

function CaptionView({
  caption,
  position,
  total,
  phase,
}: {
  caption: Caption;
  position: number;
  total: number;
  phase: 'enter' | 'leave';
}) {
  return (
    <div className={styles.layer} data-role={phase} aria-hidden={phase === 'leave' ? true : undefined}>
      <div className={styles.cap} style={{ '--cap-ms': `${CAPTION_MS}ms` } as CSSProperties}>
        <p className={styles.eyebrow} style={{ '--i': 0 } as CSSProperties}>
          <span>{caption.label}</span>
          <span className={styles.of}>
            {String(position).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </p>
        {caption.kind === 'live' ? (
          <LiveBody caption={caption} />
        ) : (
          <>
            <p className={styles.headline} style={{ '--i': 1 } as CSSProperties}>
              {caption.headline}
            </p>
            <p className={styles.body} style={{ '--i': 2 } as CSSProperties}>
              {caption.body}
            </p>
          </>
        )}
        <div className={styles.progress} style={{ '--i': 4 } as CSSProperties} aria-hidden="true" />
      </div>
    </div>
  );
}

interface Shown {
  index: number;
  prev: number | null;
  seq: number;
}

/**
 * The caption tour: one fact at a time, 9 s each, a slow crossfade between. Time decides which caption
 * shows (`captionAt`); the component only sleeps until the next boundary, and pauses while the tab is
 * hidden. The current caption is also announced once, politely, for screen readers.
 */
export function Tour() {
  const terms = allTerms();
  const playlist = useMemo(() => buildPlaylist({ terms, lessons: LESSONS }), [terms]);
  const count = playlist.length;
  const startIndex = useRef(nextStart(lastShown, count));
  const [shown, setShown] = useState<Shown>(() => ({ index: startIndex.current, prev: null, seq: 0 }));

  useEffect(() => {
    let timer = 0;
    let startedAt = performance.now();
    let hiddenAt: number | null = null;

    const tick = () => {
      const t = captionAt(performance.now() - startedAt, count, startIndex.current);
      lastShown = t.index;
      setShown((s) => (s.index === t.index ? s : { index: t.index, prev: s.index, seq: s.seq + 1 }));
      timer = window.setTimeout(tick, t.nextInMs);
    };
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = performance.now();
        window.clearTimeout(timer);
      } else if (hiddenAt !== null) {
        // Time away does not count: the caption on screen when you left is the one you return to.
        startedAt += performance.now() - hiddenAt;
        hiddenAt = null;
        tick();
      }
    };
    tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [count]);

  // Retire the outgoing caption once its fade is done.
  useEffect(() => {
    if (shown.prev === null) return;
    const t = window.setTimeout(
      () => setShown((s) => (s.seq === shown.seq ? { ...s, prev: null } : s)),
      CROSSFADE_MS + 100,
    );
    return () => window.clearTimeout(t);
  }, [shown.seq, shown.prev]);

  const current = playlist[shown.index];
  const prev = shown.prev !== null ? playlist[shown.prev] : null;
  if (!current) return null;

  return (
    <div className={styles.tour}>
      {prev && shown.prev !== null ? (
        <CaptionView
          key={`p${shown.seq}`}
          caption={prev}
          position={shown.prev + 1}
          total={count}
          phase="leave"
        />
      ) : null}
      <CaptionView
        key={`c${shown.seq}`}
        caption={current}
        position={shown.index + 1}
        total={count}
        phase="enter"
      />
    </div>
  );
}
