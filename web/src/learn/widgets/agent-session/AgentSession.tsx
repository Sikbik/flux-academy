/**
 * One scripted agent session, as a surface the lesson widget and the Agent Desk lab share.
 *
 * The engine (`./engine`) is pure and decides what happens; this file draws it and looks after the person:
 * where focus goes when a prompt appears and when it is answered, the single polite live region, the pacing of
 * the reveal (instant with reduced motion), and following the transcript as it grows.
 *
 * Honesty. The SIMULATION chip is on the panel at all times, the agent is said to be a script, argument values
 * are examples and keys are placeholders, and money in the debrief is the simulation's.
 */

import type { OrbitPlanId } from '@shared/flux';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InlineMarkup } from '@/app/InlineMarkup';
import { Button, Chip, FreshnessChip, Glyph, Panel, useReducedMotion } from '@/ui';
import styles from './AgentSession.module.css';
import { ApprovalPrompt } from './ApprovalPrompt.tsx';
import { DebriefView } from './Debrief.tsx';
import { POLICIES } from './engine/policy.ts';
import { SCENARIOS } from './engine/scenarios/index.ts';
import type { AgentSessionOutcome, Decision, PolicyId, ScenarioId } from './engine/types.ts';
import { Heading } from './Heading.tsx';
import { Transcript } from './Transcript.tsx';
import { type Phase, useAgentSession } from './useAgentSession.ts';
import { connectionLabel, identityLine } from './words.ts';

export interface AgentSessionProps {
  scenario: ScenarioId;
  policy: PolicyId;
  /** Orbit plan, for the `orbit-repo` scenario. */
  plan?: OrbitPlanId;
  /** Begin as soon as the session mounts (a "run again", or "Show me"). */
  autoStart?: boolean;
  /** Decisions to play after the start, one at a time ("Show me"). `null` for a person at the controls. */
  script?: readonly Decision[] | null;
  /** The session sits in a short area above a lesson: less chrome. */
  compact?: boolean;
  /** Heading level of the session's title (2 in the lab, 3 in a lesson). */
  headingLevel?: number;
  /** Shown above the Start button before the session begins (a policy choice, in a lesson). */
  idleExtra?: ReactNode;
  /** Decoration beside the intro before the session begins (the lab's art). */
  aside?: ReactNode;
  onStart?: () => void;
  onPhase?: (phase: Phase) => void;
  onFinish?: (outcome: AgentSessionOutcome) => void;
  /** Run the same scenario again under this policy. Omit to hide the "run it again" row. */
  onRunAgain?: (policy: PolicyId) => void;
  /** The lab: go back to choosing a scenario. */
  onChooseAnother?: () => void;
}

const SCRIPT_STEP_MS = 1000;
const SCRIPT_STEP_REDUCED_MS = 250;

/** One message in the polite live region. Each is its own element, so a message that follows another a
 *  moment later is read after it and does not replace it. */
interface Say {
  id: number;
  text: string;
}

/** The region keeps the last few messages; older ones drop off. */
const KEEP_MESSAGES = 4;

export function AgentSession({
  scenario,
  policy,
  plan,
  autoStart = false,
  script = null,
  compact = false,
  headingLevel = 2,
  idleExtra,
  aside,
  onStart,
  onPhase,
  onFinish,
  onRunAgain,
  onChooseAnother,
}: AgentSessionProps) {
  const reduced = useReducedMotion();
  const data = SCENARIOS[scenario];
  const scripted = script !== null;
  const options = useMemo(
    () => (scenario === 'orbit-repo' ? { plan: plan ?? 'standard' } : {}),
    [scenario, plan],
  );
  const session = useAgentSession({ scenario, policy, options, instant: reduced, fast: scripted });
  const { phase, prompt, promptKey, entries, revealing, debrief, outcome } = session;

  // The parent may pass new functions on every render; the latest are used without re-running effects.
  const callbacks = useRef({ onStart, onPhase, onFinish });
  callbacks.current = { onStart, onPhase, onFinish };

  const rootRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLOListElement>(null);
  const promptRef = useRef<HTMLFieldSetElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const debriefRef = useRef<HTMLHeadingElement>(null);
  const [said, setSaid] = useState<Say[]>([]);
  const sayId = useRef(0);
  const announce = useCallback((text: string) => {
    sayId.current += 1;
    const next: Say = { id: sayId.current, text };
    setSaid((list) => [...list, next].slice(-KEEP_MESSAGES));
  }, []);

  // ---- starting ---------------------------------------------------------------------------------------
  const userStarted = useRef(false);
  const begin = useCallback(
    (byPerson: boolean) => {
      userStarted.current = byPerson;
      session.start();
      callbacks.current.onStart?.();
      announce(`Session started under the policy: ${POLICIES[policy].label}. The agent is a script.`);
    },
    [session.start, announce, policy],
  );

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    begin(false);
  }, [autoStart, begin]);

  useEffect(() => {
    callbacks.current.onPhase?.(phase);
  }, [phase]);

  // The learner pressed Start: that button is gone now, so focus goes somewhere that keeps their place.
  useEffect(() => {
    if (!userStarted.current || phase === 'idle') return;
    userStarted.current = false;
    (skipRef.current ?? transcriptRef.current)?.focus({ preventScroll: true });
  }, [phase]);

  // ---- the prompt: scroll to it, focus in, focus back -----------------------------------------------
  const returnTo = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (promptKey === null) return;
    const box = promptRef.current;
    if (!box) return;
    if (!scripted && !returnTo.current) {
      const active = document.activeElement;
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    // Show the whole call, so its arguments are on screen beside the question, when it fits. A call
    // taller than the window shows its prompt instead.
    const card = box.closest('li');
    const behavior = reduced ? 'auto' : 'smooth';
    let scrolled = false;
    if (card) {
      const margin = Number.parseFloat(getComputedStyle(card).scrollMarginTop) || 0;
      if (card.getBoundingClientRect().height + margin <= window.innerHeight) {
        card.scrollIntoView({ block: 'start', behavior });
        scrolled = true;
      } else {
        box.scrollIntoView({ block: 'end', behavior });
        scrolled = true;
      }
    }
    if (!scripted) {
      box.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: scrolled });
    }
  }, [promptKey, scripted, reduced]);

  useEffect(() => {
    const open = promptKey !== null;
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed || scripted || phase === 'finished') return;
    const back = returnTo.current;
    returnTo.current = null;
    // Where the learner was, else the button that skips the wait for the next decision (the agent starts
    // working again as soon as a prompt is answered), else the transcript.
    if (back?.isConnected && !(back as HTMLButtonElement).disabled && rootRef.current?.contains(back)) {
      back.focus({ preventScroll: true });
    } else if (skipRef.current?.isConnected) {
      skipRef.current.focus({ preventScroll: true });
    } else {
      transcriptRef.current?.focus({ preventScroll: true });
    }
  }, [promptKey, scripted, phase]);

  // ---- the debrief: focus lands on its heading, if the learner is here --------------------------------
  useEffect(() => {
    if (phase !== 'finished' || scripted || !debrief) return;
    const active = document.activeElement;
    const here = active === document.body || active === null || rootRef.current?.contains(active) === true;
    // The debrief is the screen the session exists for: bring its top into view, then put focus on its title.
    const section = debriefRef.current?.closest('section');
    section?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    if (here) debriefRef.current?.focus({ preventScroll: true });
    announce(`Session finished. ${debrief.title}. The debrief is below.`);
  }, [phase, scripted, debrief, announce, reduced]);

  useEffect(() => {
    if (outcome) callbacks.current.onFinish?.(outcome);
  }, [outcome]);

  // ---- Show me ----------------------------------------------------------------------------------------
  const step = useRef(0);
  useEffect(() => {
    if (!scripted) return;
    step.current = 0;
  }, [scripted]);
  useEffect(() => {
    if (!script || promptKey === null) return;
    const next = script[step.current];
    if (!next) return;
    const id = window.setTimeout(
      () => {
        step.current += 1;
        session.decide(next);
      },
      reduced ? SCRIPT_STEP_REDUCED_MS : SCRIPT_STEP_MS,
    );
    return () => window.clearTimeout(id);
  }, [script, promptKey, reduced, session.decide]);

  // ---- following the transcript -----------------------------------------------------------------------
  const follow = useRef(true);
  useEffect(() => {
    const stop = () => {
      follow.current = false;
    };
    const stopKey = (e: KeyboardEvent) => {
      if (['PageUp', 'Home', 'ArrowUp'].includes(e.key)) stop();
    };
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    window.addEventListener('keydown', stopKey);
    return () => {
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', stopKey);
    };
  }, []);

  const shownCount = entries.length;
  const lastRevealed = useRef(0);
  useEffect(() => {
    if (shownCount === 0) {
      lastRevealed.current = 0;
      return;
    }
    if (shownCount <= lastRevealed.current) return;
    const fresh = entries.slice(lastRevealed.current, shownCount);
    lastRevealed.current = shownCount;
    // The one thing worth interrupting for: a call that is not a read ran and nobody was asked.
    for (const e of fresh) {
      if (e.kind === 'call' && e.gate === 'auto') announce(`${e.tool} ran without asking you.`);
    }
    // A prompt scrolls to itself and the debrief to its own top; the transcript follows only between them.
    if (!follow.current || promptKey !== null || phase === 'finished') return;
    const items = transcriptRef.current?.children;
    const el = items?.[items.length - 1];
    el?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [shownCount, entries, promptKey, phase, reduced, announce]);

  // ---- verbs ------------------------------------------------------------------------------------------
  const decide = useCallback(
    (d: Decision) => {
      follow.current = true;
      const tool = prompt?.tool?.name;
      if (d.choice === 'approve' && tool) announce(`You approved ${tool}.`);
      else if (d.choice === 'refuse' && tool) announce(`You refused ${tool}.`);
      else if (d.choice === 'reason') announce('Your answer was sent to the agent.');
      else if (d.choice === 'human') announce('You made your choice at the checkout page.');
      session.decide(d);
    },
    [announce, prompt, session.decide],
  );

  const skip = useCallback(() => {
    follow.current = true;
    session.skip();
  }, [session.skip]);

  // ---- what is shown ----------------------------------------------------------------------------------
  const policyInfo = POLICIES[policy];
  // Before the session starts the policy is a choice (when the host offers one), not a fact to report.
  const showPolicy = phase !== 'idle' || !idleExtra;
  const server = connectionLabel(data.server, data.connection);
  const promptAt =
    prompt && session.state?.pending ? Math.min(session.state.pending.entry, entries.length - 1) : null;

  const promptNode =
    prompt && promptAt !== null ? (
      <ApprovalPrompt
        prompt={prompt}
        policy={policy}
        scripted={scripted}
        onDecide={decide}
        level={headingLevel + 1}
        rootRef={promptRef}
      />
    ) : null;

  return (
    <Panel
      variant="glass"
      padding="md"
      container
      halo={false}
      className={styles.panel}
      contentClassName={styles.root}
    >
      <div
        ref={rootRef}
        className={styles.session}
        data-compact={compact ? '' : undefined}
        data-phase={phase}
      >
        <header className={styles.head}>
          <div className={styles.headMain}>
            <p className={styles.eyebrow}>Agent session</p>
            <Heading level={headingLevel} className={styles.title}>
              {data.card.title}
            </Heading>
          </div>
          <div className={styles.headChips}>
            <FreshnessChip kind="simulation" />
            <Chip size="sm" icon="terminal">
              Scripted agent
            </Chip>
          </div>
        </header>

        <dl className={styles.meta}>
          <div>
            <dt>
              <Glyph name="container" size={14} /> Server
            </dt>
            <dd>{server}</dd>
          </div>
          {showPolicy ? (
            <div>
              <dt>
                <Glyph name="shield" size={14} /> Your policy
              </dt>
              <dd>{policyInfo.label}</dd>
            </div>
          ) : null}
        </dl>

        {phase === 'idle' ? (
          <div className={styles.intro}>
            <div className={styles.introMain}>
              <p className={styles.introSummary}>{data.card.summary}</p>
              <p className={styles.introTeaches}>
                <InlineMarkup text={data.card.teaches} />
              </p>
              <p className={styles.introLine}>
                <Glyph name="key" size={14} /> <span>{identityLine(data.server, data.connection)}</span>
              </p>
              <p className={styles.introLine}>
                <Glyph name="terminal" size={14} />
                <span>
                  The agent is a script, not an AI model. The same choices always give the same session, and
                  nothing leaves this page.
                </span>
              </p>
              {idleExtra}
              <div className={styles.introActions}>
                <Button variant="primary" icon="play" onClick={() => begin(true)}>
                  Start the session
                </Button>
              </div>
            </div>
            {aside ? <div className={styles.introAside}>{aside}</div> : null}
          </div>
        ) : (
          <>
            <Transcript
              entries={entries}
              policy={policy}
              promptAt={promptAt}
              prompt={promptNode}
              revealPlanted={phase === 'finished'}
              listRef={transcriptRef}
            />

            {phase === 'running' && !prompt ? (
              <div className={styles.working} data-motion={reduced ? 'reduced' : undefined}>
                <p className={styles.workingText}>
                  <span className={styles.workingDot} aria-hidden="true" />
                  The agent is working.
                </p>
                {revealing && !scripted ? (
                  <Button ref={skipRef} size="sm" variant="ghost" icon="arrow-right" onClick={skip}>
                    Show everything up to the next decision
                  </Button>
                ) : null}
              </div>
            ) : null}

            {phase === 'finished' && debrief ? (
              <DebriefView
                debrief={debrief}
                policy={policy}
                level={headingLevel + 1}
                headingRef={debriefRef}
                onRunAgain={scripted ? undefined : onRunAgain}
                onChooseAnother={scripted ? undefined : onChooseAnother}
              />
            ) : null}

            <div className={styles.foot}>
              <p className={styles.fine}>
                Simulation. No request is sent, and nothing is signed, paid or deployed. The agent follows a
                script, so the same choices always give the same session.
              </p>
              {scripted ? null : (
                <Button size="sm" variant="ghost" icon="reset" onClick={session.reset}>
                  Start over
                </Button>
              )}
            </div>
          </>
        )}

        <div className="sr-only" role="status" aria-live="polite">
          {said.map((m) => (
            <p key={m.id}>{m.text}</p>
          ))}
        </div>
      </div>
    </Panel>
  );
}
