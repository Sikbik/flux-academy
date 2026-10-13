/**
 * The figure frame around a diagram: the diagram itself, the `FIG n.m` caption as real text (the shared
 * `FigCaption`), a beat pager so the learner can explore the story freely (it never touches the lesson's
 * task), and a switch for the whole-diagram description. Used by the lesson stage adapter and by the lab.
 *
 * Two shapes:
 *   framed     (default) its own slab, at its natural height. Articles, the lab.
 *   frameless  for a lesson stage, which already has a frame: no slab, and the figure is fitted to the stage
 *              body (see useFit.ts). The caption and the pager are always on screen; when the diagram is
 *              still too tall at its smallest legible size, only the window it is seen through scrolls, and
 *              the figure offers to open larger in a dialog.
 */

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, FigCaption, Glyph, IconButton, Panel, useInView } from '@/ui';
import styles from './figure.module.css';
import { type DiagramModule, figureNumber, hasDiagram, loadDiagram } from './registry';
import { clampBeat } from './state';
import { useFit } from './useFit';
import { useProbe } from './useProbe';

export interface DiagramFigureProps {
  id: string;
  /** The beat the lesson wants, 0-based. The learner may scrub away from it. */
  beat?: number;
  /** Authored props for the diagram (live data is merged in by the stage adapter). */
  props?: Record<string, unknown>;
  reducedMotion: boolean;
  /** A short, collapsible stage: tighter chrome. */
  compact?: boolean;
  /** Override the figure number (`FIG n.m`). */
  figure?: number;
  /** Hide the pager (print and article views). */
  scrubber?: boolean;
  /**
   * Draw the figure's own slab (default). A lesson stage has a frame already: it passes `false`, and the
   * figure then sizes itself to the stage body.
   */
  framed?: boolean;
  /**
   * Offer to open the figure larger in a dialog when the stage is too small to show it whole (default
   * true; the dialog's own figure passes false).
   */
  enlargeable?: boolean;
  /** Prefix of the ids the figure sets on its parts. A second copy of a figure on the page needs its own. */
  idPrefix?: string;
  /** Called when the learner moves the beat. */
  onBeat?: (beat: number) => void;
}

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; mod: DiagramModule }
  | { status: 'missing' }
  | { status: 'error'; message: string };

function useDiagramModule(id: string): Loaded {
  const [state, setState] = useState<Loaded>(() =>
    hasDiagram(id) ? { status: 'loading' } : { status: 'missing' },
  );
  useEffect(() => {
    if (!hasDiagram(id)) {
      setState({ status: 'missing' });
      return;
    }
    let live = true;
    setState({ status: 'loading' });
    loadDiagram(id).then(
      (mod) => live && setState({ status: 'ready', mod }),
      (e: unknown) =>
        live &&
        setState({
          status: 'error',
          message: e instanceof Error ? e.message : 'The diagram failed to load.',
        }),
    );
    return () => {
      live = false;
    };
  }, [id]);
  return state;
}

function FigureError({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel variant="slab" padding="lg" tone="warn" cut="tr-bl" halo={false}>
      <div className={styles.error} role="status">
        <Glyph name="status-warn" size={22} />
        <div>
          <p className={styles.errorTitle}>{title}</p>
          <p className={styles.errorBody}>{children}</p>
        </div>
      </div>
    </Panel>
  );
}

/** The longest caption of a figure, drawn invisibly so the caption area never changes height between beats. */
function longest(beats: readonly string[]): string {
  let best = '';
  for (const b of beats) if (b.length > best.length) best = b;
  return best;
}

export function DiagramFigure({
  id,
  beat = 0,
  props,
  reducedMotion,
  compact,
  figure,
  scrubber = true,
  framed = true,
  enlargeable = true,
  idPrefix = 'fig',
  onBeat,
}: DiagramFigureProps) {
  const loaded = useDiagramModule(id);
  const [view, setView] = useState(beat);
  const [describe, setDescribe] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  // More of the figure below the edge of its window: the window fades out there so it reads as scrollable.
  const [more, setMore] = useState(false);
  const lastPropBeat = useRef(beat);

  const hostRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLElement>(null);
  const windowRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pagerRef = useRef<HTMLElement>(null);

  const ready = loaded.status === 'ready';
  const count = loaded.status === 'ready' ? loaded.mod.meta.beats.length : 1;
  const shown = clampBeat(view, count);
  // The host is always mounted, so the in-view observer attaches on the first render and not after the load.
  const seen = useInView(hostRef, { once: true, threshold: 0.2 });
  useProbe(stageRef, ready);
  const fit = useFit(
    { host: innerRef, stage: stageRef, body: bodyRef, window: windowRef, pager: pagerRef },
    ready && !framed,
    [shown, compact, id],
  );

  const updateMore = useCallback(() => {
    const el = windowRef.current;
    const m = !!el && el.scrollHeight - el.clientHeight - el.scrollTop > 2;
    setMore((p) => (p === m ? p : m));
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read the window when its content or size changes
  useEffect(updateMore, [updateMore, fit.clipped, fit.scale, fit.limit, shown, ready]);

  // The lesson moved the beat (a new step): follow it. A learner's own scrubbing is kept until then.
  useEffect(() => {
    if (lastPropBeat.current !== beat) {
      lastPropBeat.current = beat;
      setView(beat);
    }
  }, [beat]);

  const ghost = useMemo(() => (loaded.status === 'ready' ? longest(loaded.mod.meta.beats) : ''), [loaded]);

  const hostStyle: CSSProperties | undefined =
    !framed && fit.limit !== null ? { maxBlockSize: fit.limit } : undefined;

  if (loaded.status === 'missing') {
    return (
      <div ref={hostRef} className={styles.host} data-framed={framed}>
        <FigureError title="This diagram is not available">
          The lesson asks for a diagram called <code>{id}</code>, and there is no such figure yet. The lesson
          text still stands on its own.
        </FigureError>
      </div>
    );
  }
  if (loaded.status === 'error') {
    return (
      <div ref={hostRef} className={styles.host} data-framed={framed}>
        <FigureError title="The diagram did not load">
          {loaded.message} Reload the page to try again.
        </FigureError>
      </div>
    );
  }
  if (loaded.status === 'loading') {
    return (
      <div ref={hostRef} className={styles.host} data-framed={framed}>
        <div className={styles.loading} aria-busy="true" aria-live="polite">
          <span className={styles.loadingLabel}>Loading figure</span>
        </div>
      </div>
    );
  }

  const { default: Diagram, meta } = loaded.mod;
  const beatOk = Number.isInteger(view) && view >= 0 && view < count;
  const n = figure ?? figureNumber(id);
  const caption = meta.beats[shown] ?? '';
  const capId = `${idPrefix}-${id}`;
  const descId = `${capId}-desc`;
  const go = (b: number) => {
    const next = clampBeat(b, count);
    setView(next);
    onBeat?.(next);
  };

  const scaled = fit.scale < 1;
  const clipped = !framed && fit.clipped;
  const canEnlarge = enlargeable && clipped;
  const content = (
    <>
      <figure
        ref={bodyRef}
        className={styles.body}
        aria-labelledby={`${capId}-title`}
        aria-describedby={`${capId}-note`}
      >
        {!beatOk && (
          <p className={styles.notice} role="status">
            This step asked for beat {String(view + 1)}, but the figure has {count}. Showing beat {shown + 1}.
          </p>
        )}

        <section
          ref={windowRef}
          className={styles.window}
          data-clipped={clipped || undefined}
          data-more={(clipped && more && !describe) || undefined}
          onScroll={clipped ? updateMore : undefined}
          tabIndex={clipped ? 0 : undefined}
          aria-label={clipped ? `${meta.title}, scrollable` : undefined}
        >
          <div
            className={styles.fit}
            style={scaled ? { blockSize: Math.ceil(fit.natural * fit.scale) } : undefined}
          >
            <div
              ref={stageRef}
              className={styles.stage}
              data-probe-root=""
              data-scaled={scaled || undefined}
              style={scaled ? { transform: `scale(${fit.scale})` } : undefined}
            >
              <Diagram beat={shown} props={props} reducedMotion={reducedMotion} />
              <span className={styles.reticleH} data-probe-h="" aria-hidden="true" />
              <span className={styles.reticleV} data-probe-v="" aria-hidden="true" />
              <span className={styles.readout} data-probe-readout="" aria-hidden="true" />
            </div>
          </div>

          {describe && (
            <p id={descId} className={styles.alt}>
              {meta.alt}
            </p>
          )}
        </section>

        <FigCaption
          id={capId}
          num={`${n}.${shown + 1}`}
          title={meta.title}
          draw={seen || reducedMotion}
          className={styles.caption}
          note={
            <span className={styles.note}>
              <span className={styles.noteLive} aria-live="polite" aria-atomic="true">
                {caption}
              </span>
              {ghost ? (
                <span className={styles.noteGhost} aria-hidden="true">
                  {ghost}
                </span>
              ) : null}
            </span>
          }
        />
      </figure>

      {(scrubber && count > 1) || !compact || canEnlarge ? (
        <nav ref={pagerRef} className={styles.pager} aria-label={`${meta.title}: beats`}>
          {scrubber && count > 1 ? (
            <>
              <IconButton
                icon="chevron-left"
                label="Previous beat"
                size="sm"
                tooltip={false}
                disabled={shown === 0}
                onClick={() => go(shown - 1)}
              />
              <ol className={styles.dots}>
                {meta.beats.map((b, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: beats are a fixed ordered list
                  <li key={i}>
                    <button
                      type="button"
                      className={styles.dot}
                      aria-label={`Beat ${i + 1} of ${count}: ${b}`}
                      aria-current={i === shown ? 'step' : undefined}
                      data-state={i === shown ? 'now' : i < shown ? 'past' : 'next'}
                      onClick={() => go(i)}
                    >
                      <span className={styles.dotHex} />
                    </button>
                  </li>
                ))}
              </ol>
              <IconButton
                icon="chevron-right"
                label="Next beat"
                size="sm"
                tooltip={false}
                disabled={shown === count - 1}
                onClick={() => go(shown + 1)}
              />
              <span className={styles.count} aria-hidden="true">
                {shown + 1} / {count}
              </span>
            </>
          ) : null}
          <span className={styles.tools}>
            {canEnlarge ? (
              <IconButton
                icon="expand"
                label="Open the figure larger"
                size="sm"
                variant="ghost"
                tooltip={false}
                aria-haspopup="dialog"
                onClick={() => setEnlarged(true)}
              />
            ) : null}
            <IconButton
              icon="info"
              label={describe ? 'Hide the description of this figure' : 'Describe this figure'}
              size="sm"
              variant="ghost"
              aria-expanded={describe}
              aria-controls={descId}
              onClick={() => setDescribe((d) => !d)}
            />
          </span>
        </nav>
      ) : null}
    </>
  );

  return (
    <div
      ref={hostRef}
      className={styles.host}
      data-framed={framed}
      data-compact={compact || undefined}
      data-fitted={!framed ? '' : undefined}
    >
      {framed ? (
        <Panel variant="slab" padding="md" halo={false} ruler="left" className={styles.frame}>
          <div ref={innerRef} className={styles.inner}>
            {content}
          </div>
        </Panel>
      ) : (
        <div ref={innerRef} className={styles.inner} style={hostStyle}>
          {content}
        </div>
      )}
      {enlargeable && !framed ? (
        <Dialog open={enlarged} onClose={() => setEnlarged(false)} title={meta.title} size="lg">
          <DiagramFigure
            id={id}
            beat={shown}
            props={props}
            reducedMotion={reducedMotion}
            compact={compact}
            figure={n}
            scrubber={scrubber}
            framed={false}
            enlargeable={false}
            idPrefix={`${idPrefix}-large`}
            onBeat={go}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
