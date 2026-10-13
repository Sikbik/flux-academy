/**
 * The stage column: the interactive visual beside the narrative. It owns the frame (kind label,
 * SIMULATION chip, the collapse control on phones), the crossfade between stages, the error boundary
 * and the lookup of the stage component by kind. A stage that has not been built shows a calm panel.
 */

import { AnimatePresence, motion } from 'motion/react';
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { BuildingPanel } from '@/learn/parts/BuildingPanel';
import { StageSkeleton } from '@/learn/parts/StageSkeleton';
import { challengeAsTask, challengeStage, effectiveStage, layoutOf, stageIdentity } from '@/learn/player';
import { stageComponent } from '@/learn/stage-registry';
import type { Stage, Task } from '@/learn/types';
import { Button, Glyph, useReducedMotion } from '@/ui';
import { LessonPanel } from './LessonPanel';
import { usePlayer, usePlayerCtx } from './PlayerContext';
import styles from './StageColumn.module.css';
import { useCompactStage, useStacked } from './useStacked';

const KIND_LABEL: Record<Stage['kind'], string> = {
  diorama: 'Diorama',
  spec: 'Spec editor',
  terminal: 'Terminal',
  diagram: 'Diagram',
  code: 'Code',
  compare: 'Compare',
  widget: 'Widget',
};

/** Surfaces that simulate the network or a tool say so in their frame (docs/DESIGN.md section 8). */
export function isSimulation(stage: Stage): boolean {
  switch (stage.kind) {
    case 'terminal':
      return true;
    case 'diorama':
      return stage.scene !== 'network' && stage.scene !== 'tiers';
    case 'widget':
      // The FluxCloud walkthrough and the scripted agent session are simulations; the planner and the
      // calculators work on the baked card and carry a BAKED chip instead.
      return stage.id === 'fluxcloud-sim' || stage.id === 'agent-session';
    default:
      return false;
  }
}

function frameLabel(stage: Stage): string {
  switch (stage.kind) {
    case 'diorama':
      return `Diorama, ${stage.scene}`;
    case 'diagram':
      return `Diagram, ${stage.id}`;
    case 'widget':
      return `Widget, ${stage.id}`;
    default:
      return KIND_LABEL[stage.kind];
  }
}

// ---------------------------------------------------------------------------
// Error boundary: a stage that throws must not take the lesson down with it.
// ---------------------------------------------------------------------------

interface BoundaryProps {
  resetKey: string;
  children: ReactNode;
}

class StageBoundary extends Component<BoundaryProps, { failed: Error | null; key: string }> {
  override state = { failed: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { failed: error };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: { failed: Error | null; key: string }) {
    if (props.resetKey !== state.key) return { failed: null, key: props.resetKey };
    return null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Stage crashed', error, info.componentStack);
  }

  override render() {
    if (this.state.failed) {
      return (
        <div className={styles.failed} role="alert">
          <Glyph name="warning" size={28} />
          <p className={styles.failedTitle}>This stage hit a problem.</p>
          <p className={styles.failedBody}>
            The rest of the lesson still works. You can read the step, use Show me or skip the task.
          </p>
          <Button size="sm" onClick={() => this.setState({ failed: null })}>
            Try the stage again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// One stage
// ---------------------------------------------------------------------------

function StageBody({
  stage,
  task,
  active,
  stepKey,
  compact,
}: {
  stage: Stage;
  task: Task | undefined;
  active: boolean;
  stepKey: string;
  compact: boolean;
}) {
  const { host } = usePlayerCtx();
  const Comp = stageComponent(stage.kind);
  if (!Comp) {
    return (
      <BuildingPanel
        what={`The ${KIND_LABEL[stage.kind].toLowerCase()} stage`}
        stage={stage}
        host={host}
        task={task}
      />
    );
  }
  return (
    <Suspense fallback={<StageSkeleton />}>
      <Comp stage={stage} host={host} active={active} task={task} stepKey={stepKey} compact={compact} />
    </Suspense>
  );
}

export function StageColumn() {
  const { lesson } = usePlayerCtx();
  const position = usePlayer((s) => s.position);
  const nonce = usePlayer((s) => s.stageNonce);
  const override = usePlayer((s) => s.stageOverride);
  const steps = usePlayer((s) => s.steps);
  const challenges = usePlayer((s) => s.challenges);
  const reduced = useReducedMotion();
  // Stacked: the stage is in the short, collapsible area above the narrative. Compact is wider than that: a
  // phone on its side draws the stage beside the narrative, and in an area just as short.
  const stacked = useStacked();
  const compact = useCompactStage();
  // The learner's own choice, kept from step to step. It only means something while stacked: the control
  // is not there otherwise, and a stage must never stay hidden behind a control that cannot be reached.
  const [collapsed, setCollapsed] = useState(false);
  // A checkpoint question that needs no stage starts with the stage collapsed (see below); this is the
  // question the learner opened it on.
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const regionId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);

  // A new step or challenge opens its stage at the top. The body is one scroll box shared by every stage, so
  // without this the next stage opens scrolled to wherever the last one was left. Only the position moves
  // it: a layout that merely turns compact (a rotation, a resize) keeps the learner's place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the position is the trigger
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = 0;
    body.scrollLeft = 0;
  }, [position]);

  const layout = layoutOf(lesson);
  let stage: Stage | null = null;
  let task: Task | undefined;
  let active = false;
  let stepKey = `${position}:${nonce}`;

  if (position < layout.steps) {
    const step = lesson.steps[position];
    stage = effectiveStage(lesson, position);
    task = step?.task && step.task.kind !== 'read' ? step.task : undefined;
    active = Boolean(step && task && steps[step.id]?.status === 'open');
    if (step) stepKey = `${step.id}:${nonce}`;
  } else if (position < layout.end) {
    const c = lesson.checkpoint[position - layout.steps];
    if (c) {
      stage = challengeStage(c);
      task = challengeAsTask(c);
      active = challenges[c.id]?.status === 'open';
      stepKey = `${c.id}:${nonce}`;
    }
  }
  if (override && override.position === position) {
    stage = override.stage;
    stepKey = `${stepKey}:${override.nonce}`;
  }

  // On a phone the stage is pinned above the narrative, and a checkpoint question that has no stage of its own
  // (a choice, an order, a match) would pin the lesson's objectives there, over the options the learner is
  // choosing between. Such a question starts with the stage collapsed to its title bar, with the same toggle
  // to open it. A question that has a stage (a spec, a terminal) needs it, so it stays open.
  const inChallenge = position >= layout.steps && position < layout.end;
  const stageless = stage === null;
  const autoCollapsible = stacked && stageless && inChallenge;
  const isCollapsed = stacked && (autoCollapsible ? openedAt !== position : collapsed);
  const toggle = () => {
    if (autoCollapsible) setOpenedAt(isCollapsed ? position : null);
    else setCollapsed((c) => !c);
  };

  const identity = stage ? stageIdentity(stage) : 'checkpoint';
  const sim = stage ? isSimulation(stage) : false;
  const label = stage ? frameLabel(stage) : 'Checkpoint';
  const t = reduced ? 0.12 : 0.38;

  // The body is one scroll box shared by every stage. A stage with nothing focusable in it (the checkpoint
  // panel, a read-only diagram) that is taller than the box could not be scrolled from the keyboard, so the
  // box takes a tab stop while, and only while, it overflows.
  const [scrolls, setScrolls] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new stage or step brings new content to watch
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || isCollapsed) {
      setScrolls(false);
      return;
    }
    const measure = () =>
      setScrolls(body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(body);
    for (const child of Array.from(body.children)) watch.observe(child);
    return () => watch.disconnect();
  }, [identity, stepKey, isCollapsed]);
  const scrollProps = scrolls
    ? ({ tabIndex: 0, role: 'region', 'aria-label': 'Stage content' } as const)
    : {};

  return (
    <section
      className={styles.column}
      aria-label="Stage"
      data-lesson-stage=""
      data-collapsed={isCollapsed ? 'true' : undefined}
    >
      <div className={styles.frame} data-kind={stage?.kind ?? 'checkpoint'}>
        <span className={styles.edge} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.kind}>
            <span className={styles.bullet} aria-hidden="true" />
            {label}
          </span>
          {sim ? (
            <span className={styles.sim} title="This is a simulation. Nothing here touches the real network.">
              <Glyph name="status-off" size={12} />
              Simulation
            </span>
          ) : null}
          <button
            type="button"
            className={styles.collapse}
            aria-expanded={!isCollapsed}
            aria-controls={regionId}
            onClick={toggle}
          >
            <Glyph name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={14} />
            <span>{isCollapsed ? 'Show stage' : 'Hide stage'}</span>
          </button>
        </header>
        <div id={regionId} ref={bodyRef} className={styles.body} hidden={isCollapsed} {...scrollProps}>
          <span key={identity} className={styles.scan} aria-hidden="true" />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={identity}
              className={styles.stage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: t, ease: [0.16, 1, 0.3, 1] }}
            >
              <StageBoundary resetKey={`${identity}:${stepKey}`}>
                {stage ? (
                  <StageBody stage={stage} task={task} active={active} stepKey={stepKey} compact={compact} />
                ) : (
                  <LessonPanel />
                )}
              </StageBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
