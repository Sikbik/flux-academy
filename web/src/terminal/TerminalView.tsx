/**
 * The sandbox terminal: a safe, believable shell that teaches by doing.
 *
 *   <TerminalView script={script} onGoal={(id) => ...} />
 *
 * It runs a `TerminalScript` (the lesson contract, web/src/learn/types.ts) on the framework free
 * engine in ./engine, never touches the learner's machine or network, and says so. What it adds to
 * the engine is the human part: a real input with a visible block caret, tab completion and history,
 * streaming output that any key skips, a "What just happened" panel under the latest command, goals
 * that tick, and quick-run chips so a phone never needs a keyboard.
 *
 * Imperative use goes through `ref` (`TerminalHandle`): `run`, `type`, `typeExample`, `solve`,
 * `reset`, `focus`. A host that wants the learner's state to outlive the view passes its own
 * `session` (the lab keeps one per scenario; the lesson stage keeps one per script id).
 */

import {
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FreshnessChip, Glyph, IconButton, Panel, usePointerFine, useReducedMotion } from '@/ui';
import type { CommandEvent, TerminalSession } from './engine/session';
import type { TerminalScript, TranscriptEntry } from './engine/types';
import { cx } from './view/classes';
import { copyText } from './view/clipboard';
import { Entry } from './view/Entry';
import { GoalTracker } from './view/GoalTracker';
import { renderInline } from './view/inline';
import { PromptInput, type Selection } from './view/PromptInput';
import styles from './view/terminal.module.css';
import { startTyping, type TypingJob } from './view/typing';
import { useTerminalSession } from './view/useTerminalSession';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TerminalHandle {
  /** The live session, for hosts that need state (goals, history) beyond what the callbacks give. */
  readonly session: TerminalSession;
  /** Submit a line as if it had been typed and Enter pressed. Resolves when its output is done. */
  run(line: string): Promise<void>;
  /** Type a line into the prompt with the typing animation. `run: true` presses Enter afterwards. */
  type(line: string, options?: { run?: boolean }): Promise<void>;
  /** Type and run the example of a goal (default: the next open goal). */
  typeExample(goalId?: string): Promise<void>;
  /**
   * Type and run what completes `goals` (default: every open goal), one command at a time, in the
   * script's order. This is "Show me". Resolves when done or when the learner interrupts.
   */
  solve(goals?: readonly string[]): Promise<void>;
  /** Back to the start of the scenario. */
  reset(): void;
  focus(): void;
}

export interface TerminalViewProps {
  script: TerminalScript;
  /** Follow this session instead of creating one from `script`. */
  session?: TerminalSession;
  /** A goal id of the script was completed. */
  onGoal?: (goalId: string) => void;
  /**
   * A command finished (not called for cancelled ones). `event.entry.assisted` is true when the view ran
   * the line itself (the chip, `run`, `type`, `typeExample`, `solve`) rather than the learner.
   */
  onCommand?: (event: CommandEvent) => void;
  /** Tighter chrome for a short area. */
  compact?: boolean;
  /** Focus the prompt on mount (only where there is a fine pointer: a phone would open its keyboard). */
  autoFocus?: boolean;
  className?: string;
  /**
   * `window` (default): the glass window with its own edge, ruler and crosshairs.
   * `embedded`: no frame of its own, for a host that already draws one (the lesson stage).
   */
  variant?: 'window' | 'embedded';
  /** `strip` (default): a count and the next goal that opens into the list. `none`: the host shows goals. */
  goals?: 'strip' | 'none';
  /** Only these goal ids count for the strip and for the next-step chip (a lesson step's task goals). */
  goalFilter?: readonly string[];
  /** The step's task is open: the prompt and the next-step chip draw a little attention. */
  active?: boolean;
  /**
   * Next-step chip: `always` (default) or `never`. The lesson stage uses `never` while a task earns XP:
   * the player's own help ladder (Hint, then Show me for half XP) is the way to get a command typed for you.
   */
  hints?: 'always' | 'never';
  /** Where to keep command history for the browser session. Default: the script id. `false`: none. */
  historyKey?: string | false;
  /** Renders lesson markup (term cards, links). Default: code, bold and italic only. */
  renderMarkup?: (text: string) => ReactNode;
  /** Extra text in the title bar, after the working directory. */
  title?: ReactNode;
  /** Controls placed in the title bar before Reset. */
  actions?: ReactNode;
  /** Show the Reset control in the title bar. Default true. */
  resettable?: boolean;
  /**
   * Show the SIMULATION chip in the title bar. Default true for the window; the embedded variant
   * leaves it to the host frame (the lesson stage frame says Simulation itself).
   */
  simulationChip?: boolean;
  ref?: Ref<TerminalHandle>;
}

/** A function suitable for `host.registerSolver`: types what completes `goals`, if the view is there. */
export function makeSolver(
  getHandle: () => TerminalHandle | null,
  getGoals?: () => readonly string[] | undefined,
): () => void {
  return () => {
    const goals = getGoals?.();
    // An empty list means "these are all done": nothing to type (not "everything").
    if (goals && goals.length === 0) return;
    void getHandle()?.solve(goals);
  };
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

function firstLine(text: string): { line: string; extra: boolean } {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
  return { line: lines[0] ?? '', extra: lines.length > 1 };
}

/** What a screen reader hears when a command finishes: one short message, never the whole stream. */
function announcement(e: CommandEvent, labels: ReadonlyMap<string, string>): string {
  const { entry } = e;
  const out = entry.lines.filter((l) => l.channel === 'out' && l.text.trim() !== '');
  const notes = entry.lines.filter((l) => l.channel === 'note' && l.text.trim() !== '');
  const parts = [`${entry.exit === 0 ? 'Finished' : 'Failed'}: ${entry.input}.`];
  if (out.length > 0) {
    parts.push(
      out
        .slice(0, 3)
        .map((l) => l.text.trim())
        .join('. '),
    );
    if (out.length > 3) parts.push(`${out.length - 3} more lines.`);
  }
  if (notes[0]) parts.push(`Sandbox: ${notes[0].text.trim()}`);
  for (const id of entry.goals) parts.push(`Goal complete: ${labels.get(id) ?? id}.`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export function TerminalView({
  script,
  session: provided,
  onGoal,
  onCommand,
  compact = false,
  autoFocus = false,
  className,
  variant = 'window',
  goals = 'strip',
  goalFilter,
  active = false,
  hints = 'always',
  historyKey,
  renderMarkup = renderInline,
  title,
  actions,
  resettable = true,
  simulationChip,
  ref,
}: TerminalViewProps) {
  const { session, state } = useTerminalSession({ script, session: provided, historyKey });
  const reduced = useReducedMotion();
  const fine = usePointerFine();
  const hintId = useId();

  const [value, setValue] = useState('');
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [focused, setFocused] = useState(false);
  const [completions, setCompletions] = useState<{ options: string[]; index: number } | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [stick, setStick] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLFormElement | null>(null);
  const typing = useRef<TypingJob | null>(null);
  const nav = useRef<{ index: number; draft: string }>({ index: -1, draft: '' });
  const solving = useRef(0);
  const alive = useRef(true);
  const toggle = useRef(false);
  const latest = useRef({ onGoal, onCommand, reduced, value });
  latest.current = { onGoal, onCommand, reduced, value };

  const goalLabels = useMemo(() => new Map(script.goals.map((g) => [g.id, g.label])), [script.goals]);
  const prompt = session.prompt();

  // ---- wiring the engine's events to the host and to assistive tech -------------------------------

  useEffect(() => session.onGoal((id) => latest.current.onGoal?.(id)), [session]);

  useEffect(
    () =>
      session.onCommand((e) => {
        latest.current.onCommand?.(e);
        toggle.current = !toggle.current;
        setStatus(`${announcement(e, goalLabels)}${toggle.current ? '​' : ''}`);
      }),
    [session, goalLabels],
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      solving.current += 1;
      typing.current?.cancel();
    };
  }, []);

  // ---- keeping the newest output in view ------------------------------------------------------------

  // biome-ignore lint/correctness/useExhaustiveDependencies: state.version is the trigger (any change of the transcript)
  useLayoutEffect(() => {
    const el = screenRef.current;
    if (el && stick) el.scrollTop = el.scrollHeight;
  }, [state.version, stick]);

  const onScreenScroll = useCallback(() => {
    const el = screenRef.current;
    if (!el) return;
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 28);
    setScrolled(el.scrollTop > 4);
  }, []);

  // ---- a phone's keyboard: keep the prompt above it ------------------------------------------------

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !focused) return;
    const reveal = (): void => {
      const row = rowRef.current;
      if (!row) return;
      const bottom = row.getBoundingClientRect().bottom;
      const visibleBottom = vv.offsetTop + vv.height;
      if (bottom > visibleBottom - 8)
        window.scrollBy({ top: bottom - visibleBottom + 12, behavior: 'instant' });
    };
    reveal();
    vv.addEventListener('resize', reveal);
    vv.addEventListener('scroll', reveal);
    return () => {
      vv.removeEventListener('resize', reveal);
      vv.removeEventListener('scroll', reveal);
    };
  }, [focused]);

  useEffect(() => {
    if (autoFocus && fine) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus, fine]);

  // ---- line editing ---------------------------------------------------------------------------------

  const setLine = useCallback((next: string, keepCompletions = false) => {
    setValue(next);
    setSelection({ start: next.length, end: next.length });
    if (!keepCompletions) setCompletions(null);
  }, []);

  const cancelTyping = useCallback(() => {
    typing.current?.cancel();
    typing.current = null;
  }, []);

  const interrupt = useCallback(() => {
    solving.current += 1;
    cancelTyping();
  }, [cancelTyping]);

  const submit = useCallback(
    (line: string, assisted = false): Promise<void> => {
      interrupt();
      nav.current = { index: -1, draft: '' };
      setLine('');
      setStick(true);
      return session.submit(line, { assisted }).finished;
    },
    [session, interrupt, setLine],
  );

  const typeLine = useCallback(
    (line: string): Promise<boolean> => {
      typing.current?.cancel();
      const job = startTyping(
        line,
        (v) => {
          if (alive.current) setLine(v);
        },
        { instant: latest.current.reduced },
      );
      typing.current = job;
      void job.done.then(() => {
        if (typing.current === job) typing.current = null;
      });
      return job.done;
    },
    [setLine],
  );

  const stepHistory = useCallback(
    (dir: -1 | 1) => {
      const h = session.historyList;
      if (h.length === 0) return;
      const n = nav.current;
      if (dir === -1) {
        if (n.index === -1) {
          n.draft = latest.current.value;
          n.index = h.length - 1;
        } else {
          n.index = Math.max(0, n.index - 1);
        }
      } else {
        if (n.index === -1) return;
        n.index += 1;
        if (n.index >= h.length) {
          n.index = -1;
          setLine(n.draft);
          return;
        }
      }
      setLine(h[n.index] ?? '');
    },
    [session, setLine],
  );

  /** Tab. Returns false when there was nothing to complete (focus then moves on as usual). */
  const complete = useCallback((): boolean => {
    if (completions && completions.options.length > 0) {
      const index = (completions.index + 1) % completions.options.length;
      setCompletions({ ...completions, index });
      setLine(completions.options[index] ?? '', true);
      return true;
    }
    const current = latest.current.value;
    const r = session.complete(current);
    if (r.candidates.length === 0) return false;
    if (r.common.length > current.length) {
      setLine(r.common);
      return true;
    }
    if (r.candidates.length === 1) {
      const only = r.candidates[0] ?? '';
      if (only === current) return false;
      setLine(only);
      return true;
    }
    setCompletions({ options: r.candidates.slice(0, 8), index: -1 });
    return true;
  }, [completions, session, setLine]);

  // The version matters: finishing a goal reorders which example is suggested first.
  // biome-ignore lint/correctness/useExhaustiveDependencies: state.version is the trigger
  const ghost = useMemo(() => {
    if (!focused || value === '' || selection.start !== value.length) return '';
    return session.complete(value).ghost;
  }, [focused, value, selection.start, session, state.version]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const key = e.key;
    const mod = e.ctrlKey || e.metaKey;
    const isModifier =
      key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta' || key === 'CapsLock';
    const copying = mod && key.toLowerCase() === 'c' && selection.start !== selection.end;

    // Any key finishes streaming output at once; Escape cancels the command instead.
    if (session.busy && key !== 'Escape' && !isModifier && !copying) session.skip();
    // The learner takes over from a typing animation or a "Show me".
    if (!isModifier && key !== 'Escape' && (typing.current || solving.current > 0) && key !== 'Enter') {
      solving.current += 1;
      cancelTyping();
    }

    if (key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (!e.shiftKey) void submit(latest.current.value);
      return;
    }
    if ((key === 'ArrowUp' || key === 'ArrowDown') && !mod && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      stepHistory(key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (key === 'Tab' && !e.shiftKey && !mod && !e.altKey) {
      if (complete()) e.preventDefault();
      return;
    }
    if ((key === 'ArrowRight' || key === 'End') && ghost && selection.start === value.length && !mod) {
      e.preventDefault();
      setLine(value + ghost);
      return;
    }
    if (key === 'Escape') {
      if (session.busy) {
        e.preventDefault();
        e.stopPropagation();
        session.cancel();
        return;
      }
      if (latest.current.value !== '' || completions) {
        e.preventDefault();
        e.stopPropagation();
        nav.current = { index: -1, draft: '' };
        setLine('');
      }
      return;
    }
    if (mod && key.toLowerCase() === 'c' && !copying) {
      e.preventDefault();
      if (session.busy) session.cancel();
      else {
        nav.current = { index: -1, draft: '' };
        setLine('');
      }
      return;
    }
    if (mod && key.toLowerCase() === 'l') {
      e.preventDefault();
      void submit('clear');
      return;
    }
    if (mod && key.toLowerCase() === 'u') {
      e.preventDefault();
      setLine(value.slice(selection.start));
      setSelection({ start: 0, end: 0 });
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>): void => {
    const text = e.clipboardData.getData('text');
    if (!/[\r\n]/.test(text)) return;
    // A shell would run a pasted block line by line. The sandbox takes the first line and says so.
    e.preventDefault();
    const { line, extra } = firstLine(text);
    const el = e.currentTarget;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + line + value.slice(end);
    setLine(next);
    if (extra) setStatus('Pasted text had several lines. Only the first line was used.');
  };

  // ---- the imperative surface ------------------------------------------------------------------------

  const run = useCallback((line: string): Promise<void> => submit(line, true), [submit]);

  const type = useCallback(
    async (line: string, options?: { run?: boolean }): Promise<void> => {
      const typed = await typeLine(line);
      if (!typed || !alive.current) return;
      if (options?.run) {
        await sleep(latest.current.reduced ? 0 : 260);
        if (alive.current) await submit(line, true);
      }
    },
    [typeLine, submit],
  );

  const typeExample = useCallback(
    async (goalId?: string): Promise<void> => {
      const line = goalId ? session.exampleFor(goalId) : session.nextExample();
      if (line) await type(line, { run: true });
    },
    [session, type],
  );

  const solve = useCallback(
    async (wanted?: readonly string[]): Promise<void> => {
      if (wanted && wanted.length === 0) return;
      const token = ++solving.current;
      for (let guard = 0; guard < 40; guard += 1) {
        const step = session.plan(wanted && wanted.length > 0 ? wanted : undefined)[0];
        if (!step || !alive.current || token !== solving.current) return;
        const typed = await typeLine(step.line);
        if (!typed || !alive.current || token !== solving.current) return;
        await sleep(latest.current.reduced ? 0 : 340);
        if (!alive.current || token !== solving.current) return;
        const finished = session.submit(step.line, { assisted: true }).finished;
        setLine('');
        setStick(true);
        await finished;
        await sleep(latest.current.reduced ? 0 : 260);
      }
    },
    [session, typeLine, setLine],
  );

  const reset = useCallback((): void => {
    interrupt();
    nav.current = { index: -1, draft: '' };
    session.reset();
    setLine('');
    setStick(true);
    setStatus('Scenario reset. Your goals are cleared.');
  }, [session, interrupt, setLine]);

  const focus = useCallback((): void => {
    inputRef.current?.focus();
  }, []);

  useImperativeHandle(ref, () => ({ session, run, type, typeExample, solve, reset, focus }), [
    session,
    run,
    type,
    typeExample,
    solve,
    reset,
    focus,
  ]);

  // ---- copy -----------------------------------------------------------------------------------------

  const copyTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const onCopy = useCallback(async (entry: TranscriptEntry): Promise<void> => {
    const text = entry.lines
      .filter((l) => l.channel === 'out')
      .map((l) => l.text)
      .join('\n');
    const ok = await copyText(text);
    setStatus(ok ? 'Output copied.' : 'Could not copy. Select the text and copy it yourself.');
    if (!ok) return;
    setCopiedId(entry.id);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedId(null), 1600);
  }, []);

  // ---- render ---------------------------------------------------------------------------------------

  const visibleGoals = goalFilter ? state.goals.filter((g) => goalFilter.includes(g.id)) : state.goals;
  const allDone = visibleGoals.length > 0 && visibleGoals.every((g) => g.done);
  // biome-ignore lint/correctness/useExhaustiveDependencies: state.version is the trigger
  const step = useMemo(
    () =>
      hints === 'never'
        ? null
        : (session.plan(goalFilter && goalFilter.length > 0 ? goalFilter : undefined)[0] ?? null),
    [session, goalFilter, hints, state.version],
  );
  const stepLabel = step ? goalLabels.get(step.goal) : undefined;
  const lastCommandId = useMemo(() => {
    for (let i = state.entries.length - 1; i >= 0; i -= 1) {
      if (state.entries[i]?.kind === 'command') return state.entries[i]?.id ?? -1;
    }
    return -1;
  }, [state.entries]);

  const body = (
    <>
      <header className={styles.bar}>
        <span className={styles.bullet} aria-hidden="true" />
        <span className={styles.where}>
          <span className={styles.who}>
            {prompt.user}@{prompt.host}
          </span>
          <span className={cx(styles.cwd, styles.cwdHide)}>{prompt.cwd}</span>
          {title ? <span className={styles.titleExtra}>{title}</span> : null}
        </span>
        <span className={styles.barTools}>
          {(simulationChip ?? variant === 'window') ? <FreshnessChip kind="simulation" /> : null}
          {actions}
          {resettable ? (
            <IconButton
              icon="reset"
              label="Reset the scenario"
              size="sm"
              variant="ghost"
              tooltipPlacement="bottom"
              onClick={reset}
            />
          ) : null}
        </span>
      </header>

      <p className={styles.notice}>
        <Glyph name="shield" size={14} />
        <span>
          <strong>Sandbox:</strong> nothing here touches your machine or the network.
        </span>
      </p>

      {goals === 'strip' && visibleGoals.length > 0 ? (
        <div className={styles.goalsHost}>
          <GoalTracker goals={state.goals} only={goalFilter} renderMarkup={renderMarkup} />
        </div>
      ) : null}

      <div className={styles.screenWrap} data-scrolled={scrolled ? 'true' : undefined}>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: a pointer convenience (skip the stream, focus the prompt); keyboard users have the prompt itself, where any key skips */}
        <div
          ref={screenRef}
          className={styles.screen}
          role="log"
          aria-live="off"
          aria-label="Terminal output"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling log must be reachable by keyboard
          tabIndex={0}
          data-terminal-screen=""
          onScroll={onScreenScroll}
          onClick={() => {
            if (session.busy) session.skip();
            const sel = window.getSelection();
            if (fine && (!sel || sel.isCollapsed)) inputRef.current?.focus({ preventScroll: true });
          }}
        >
          {state.entries.map((e) => (
            <Entry
              key={e.id}
              entry={e}
              symbol={prompt.symbol}
              latest={e.id === lastCommandId}
              goalLabels={goalLabels}
              renderMarkup={renderMarkup}
              copied={copiedId === e.id}
              onCopy={onCopy}
            />
          ))}
        </div>
        {!stick ? (
          <button
            type="button"
            className={styles.jump}
            onClick={() => {
              setStick(true);
              const el = screenRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            <Glyph name="arrow-down" size={13} />
            Jump to latest
          </button>
        ) : null}
      </div>

      {completions && completions.options.length > 1 ? (
        <fieldset className={styles.completions}>
          <legend className="sr-only">Completions</legend>
          <span aria-hidden="true">Tab</span>
          {completions.options.map((o, i) => (
            <button
              key={o}
              type="button"
              aria-current={i === completions.index ? 'true' : undefined}
              onClick={() => {
                setLine(o);
                inputRef.current?.focus();
              }}
            >
              {o}
            </button>
          ))}
        </fieldset>
      ) : null}

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: a pointer convenience (a click anywhere on the row focuses the prompt); the textarea is the keyboard path */}
      <form
        ref={rowRef}
        className={styles.promptForm}
        data-active={active && !allDone ? 'true' : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          void submit(value);
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <PromptInput
          value={value}
          selection={selection}
          onValueChange={(v, sel) => {
            nav.current = { index: -1, draft: '' };
            setCompletions(null);
            if (typing.current || solving.current > 0) interrupt();
            setValue(v.replace(/[\r\n]+/g, ' '));
            setSelection(sel);
          }}
          onSelectionChange={setSelection}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          ghost={ghost}
          focused={focused}
          onFocusChange={setFocused}
          blink={!reduced}
          placeholder="Type a command"
          cwd={prompt.cwd}
          symbol={prompt.symbol}
          inputRef={inputRef}
          describedBy={hintId}
          label="Terminal input"
        />
        <button type="submit" className={styles.run} aria-label="Run the command">
          <Glyph name="arrow-right" size={18} />
        </button>
      </form>

      {hints === 'never' ? null : (
        <div className={styles.next}>
          {step ? (
            <>
              <span className={styles.nextLabel}>Next</span>
              <button
                type="button"
                className={styles.chip}
                disabled={state.busy}
                onClick={() => void type(step.line, { run: true })}
                aria-label={`Type and run: ${step.line}`}
              >
                <Glyph name="play" size={14} />
                <span>{step.line}</span>
              </button>
              {stepLabel ? <p className={styles.nextWhat}>{renderMarkup(stepLabel)}</p> : null}
            </>
          ) : allDone ? (
            <p className={styles.doneNote}>All goals done. Type help to see what else works here.</p>
          ) : null}
        </div>
      )}

      <p id={hintId} className="sr-only">
        Press Enter to run. Up and down arrows move through history. Tab completes. Escape stops a running
        command. Any other key skips the animation of the output.
      </p>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </div>
    </>
  );

  return (
    <div
      className={cx(styles.root, className)}
      data-compact={compact ? 'true' : undefined}
      data-variant={variant}
      data-terminal=""
      data-script={script.id}
    >
      {variant === 'window' ? (
        <Panel
          className={styles.window}
          contentClassName={styles.frame}
          variant="glass"
          padding="none"
          ruler="left"
          cut="tr-bl"
          pattern="tr"
          hot="tr"
          data-terminal-window=""
        >
          {body}
        </Panel>
      ) : (
        <div className={cx(styles.plain, styles.frame)}>{body}</div>
      )}
    </div>
  );
}
