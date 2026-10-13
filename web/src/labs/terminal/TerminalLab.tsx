/**
 * The Terminal lab: scenario tabs, a glass terminal window, and beside it the challenge card with its
 * goals. Scenarios are scripts (web/src/terminal/scenarios); the engine runs them with no network and no
 * access to the learner's machine, and the window says so.
 *
 * Every scenario keeps its own session, so switching tabs never loses a learner's place. Finishing a
 * scenario is remembered on this device (the tab keeps its tick) and unlocks `shell-shocked`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLabFrame } from '@/app/LabFrame';
import { useLearner } from '@/learn/store';
import { announce } from '@/system/announce';
import { createSession, type TerminalSession } from '@/terminal/engine';
import { SCENARIOS, type ScenarioMeta } from '@/terminal/scenarios';
import { type TerminalHandle, TerminalView } from '@/terminal/TerminalView';
import { GoalTracker } from '@/terminal/view/GoalTracker';
import { loadHistory } from '@/terminal/view/storage';
import { Button, Glyph, Panel, type TabItem, TabPanel, Tabs, useReducedMotion } from '@/ui';
import { loadDone, loadTab, saveDone, saveTab } from './progress';
import styles from './TerminalLab.module.css';

const IDS = SCENARIOS.map((s) => s.id);
const TAB_BASE = 'terminal-lab';

/** One session per scenario, created once and kept for as long as the lab is open. */
function useSessions(): ReadonlyMap<string, TerminalSession> {
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const ref = useRef<Map<string, TerminalSession> | null>(null);
  if (ref.current === null) {
    ref.current = new Map(
      SCENARIOS.map((m) => [
        m.id,
        createSession({
          script: m.script,
          history: loadHistory(`lab:${m.id}`),
          reducedMotion: () => reducedRef.current,
        }),
      ]),
    );
  }
  const sessions = ref.current;
  useEffect(
    () => () => {
      for (const s of sessions.values()) s.skip();
    },
    [sessions],
  );
  return sessions;
}

interface Progress {
  done: number;
  total: number;
}

/** Goals done per scenario, re-read whenever any session changes. */
function useProgress(sessions: ReadonlyMap<string, TerminalSession>): Record<string, Progress> {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const offs = [...sessions.values()].map((s) => s.subscribe(onChange));
      return () => {
        for (const off of offs) off();
      };
    },
    [sessions],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    () =>
      [...sessions]
        .map(([id, s]) => {
          const st = s.getState();
          return `${id}:${st.completed.length}/${st.goals.length}`;
        })
        .join(','),
    () => '',
  );
  return useMemo(() => {
    const out: Record<string, Progress> = {};
    for (const part of snapshot.split(',')) {
      const [id, frac] = part.split(':');
      const [done, total] = (frac ?? '0/0').split('/').map(Number);
      if (id) out[id] = { done: done ?? 0, total: total ?? 0 };
    }
    return out;
  }, [snapshot]);
}

export default function TerminalLab() {
  const sessions = useSessions();
  const progress = useProgress(sessions);
  const [active, setActive] = useState<string>(() => loadTab(IDS) ?? (SCENARIOS[0]?.id as string));
  const [finished, setFinished] = useState<string[]>(() => loadDone(IDS));
  const handle = useRef<TerminalHandle | null>(null);

  const meta = (SCENARIOS.find((s) => s.id === active) ?? SCENARIOS[0]) as ScenarioMeta;
  const index = SCENARIOS.findIndex((s) => s.id === meta.id);
  const session = sessions.get(meta.id) as TerminalSession;
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState);

  const select = useCallback((id: string) => {
    setActive(id);
    saveTab(id);
  }, []);

  // A scenario was finished: remember it, say so, and award the medal.
  useEffect(() => {
    const offs = [...sessions].map(([id, s]) =>
      s.onGoal(() => {
        if (!s.getState().allDone) return;
        setFinished((prev) => {
          if (prev.includes(id)) return prev;
          const next = [...prev, id];
          saveDone(next);
          return next;
        });
        useLearner.getState().unlock('shell-shocked');
        const title = SCENARIOS.find((m) => m.id === id)?.title ?? id;
        announce(`Scenario complete: ${title}.`);
      }),
    );
    return () => {
      for (const off of offs) off();
    };
  }, [sessions]);

  useLabFrame({
    simulation: true,
    about: [
      'A simulated shell for the tools you meet on the way to a Flux app: Docker, curl and DNS lookups.',
      'It runs scripted scenarios. Nothing here touches your machine or the network, and responses from the Flux API are recordings, not live answers.',
    ],
    teach: [
      'This terminal is a **simulation**. It runs a scripted scenario and never touches your machine or the network. A command the scenario does not know says so and points at the nearest one it does.',
      ...meta.teaches,
      'Press {{kbd:Tab}} to complete a command and the up and down arrows to walk through your history. {{kbd:Esc}} stops a running command. Type `help` to list what works in this scenario.',
    ],
    teachTitle: 'Teach me: the terminal',
    shortcuts: [
      { keys: 'tab', label: 'Complete' },
      { keys: 'up', label: 'History' },
      { keys: 'esc', label: 'Stop a command' },
    ],
    status: `${meta.title}: ${state.completed.length} of ${state.goals.length} goals`,
  });

  const items: TabItem[] = SCENARIOS.map((m) => {
    const p = progress[m.id];
    const done = finished.includes(m.id) || (p !== undefined && p.total > 0 && p.done === p.total);
    return {
      value: m.id,
      label: m.title,
      icon: m.glyph,
      count: done ? 'Done' : p && p.done > 0 ? `${p.done}/${p.total}` : undefined,
    };
  });

  const allDone = state.allDone;
  const next = SCENARIOS[(index + 1) % SCENARIOS.length] as ScenarioMeta;
  const cardId = `${TAB_BASE}-card`;

  return (
    <div className={styles.lab} data-lab-terminal="">
      <Tabs
        idBase={TAB_BASE}
        aria-label="Scenarios"
        items={items}
        value={meta.id}
        onValueChange={select}
        className={styles.tabs}
      />

      <div className={styles.grid}>
        <TabPanel value={meta.id} idBase={TAB_BASE} active className={styles.term}>
          <TerminalView
            key={meta.id}
            ref={handle}
            script={meta.script}
            session={session}
            historyKey={`lab:${meta.id}`}
            variant="window"
            goals="none"
            autoFocus
            active
          />
        </TabPanel>

        <aside className={styles.side} aria-labelledby={cardId}>
          <Panel
            variant="slab"
            padding="md"
            cut="tr-bl"
            size="sm"
            pattern="none"
            tone={allDone ? 'ok' : 'neutral'}
          >
            <div className={styles.card}>
              <p className={styles.eyebrow}>
                <b>
                  Challenge {index + 1} of {SCENARIOS.length}
                </b>
                <span>About {meta.minutes} min</span>
              </p>
              <h2 id={cardId} className={styles.cardTitle}>
                {meta.title}
              </h2>
              <p className={styles.objective}>{meta.objective}</p>

              <div className={styles.meter}>
                <span>
                  {state.completed.length} of {state.goals.length}
                </span>
                <span
                  className={styles.bar}
                  data-done={allDone ? 'true' : undefined}
                  style={
                    {
                      '--p': state.goals.length ? state.completed.length / state.goals.length : 0,
                    } as React.CSSProperties
                  }
                  aria-hidden="true"
                >
                  <span />
                </span>
                <span>goals</span>
              </div>

              <GoalTracker goals={state.goals} variant="list" />

              {allDone ? (
                <div className={styles.complete} role="status">
                  <p>
                    <strong>Scenario complete.</strong> Everything above ran in the sandbox. Keep going: type
                    anything and read what it says, or try the next scenario.
                  </p>
                  <div className={styles.actions}>
                    <Button size="sm" variant="primary" iconEnd="arrow-right" onClick={() => select(next.id)}>
                      {next.title}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className={styles.actions}>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="play"
                  disabled={allDone || state.busy}
                  onClick={() => void handle.current?.typeExample()}
                >
                  Show me the next step
                </Button>
                <Button size="sm" variant="ghost" icon="reset" onClick={() => handle.current?.reset()}>
                  Reset
                </Button>
              </div>
            </div>
          </Panel>

          <div>
            <p className={styles.tipsHead}>In the terminal</p>
            <ul className={styles.tips}>
              <li>
                <Glyph name="keyboard" size={14} />
                <span>
                  <code>Tab</code> completes, <code>Up</code> and <code>Down</code> walk your history.
                </span>
              </li>
              <li>
                <Glyph name="help" size={14} />
                <span>
                  <code>help</code> lists what works here. A mistyped command gets the nearest suggestion.
                </span>
              </li>
              <li>
                <Glyph name="stop" size={14} />
                <span>
                  <code>Esc</code> stops a running command; any other key skips the animation.
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
