/**
 * Agent Desk: supervise a scripted AI agent that works a Flux MCP server, and see what your client's approval
 * policy lets through.
 *
 * One engine, two surfaces. The session, the prompt and the debrief are `learn/widgets/agent-session`, the same
 * ones the lesson uses; this page adds what a lab owns: a scenario menu, a table of which calls each policy
 * stops on the chosen server, and a record of what you have run, so the three policies can be compared one
 * scenario at a time. The policy and the Orbit plan are chosen inside the session, just before it starts, because
 * they are what the experiment varies.
 *
 * Everything is simulated and says so. The agent is a script, no key appears anywhere, and prices come from
 * `quote()` and `orbitPlanQuoteUsd()` at the baked FLUX price.
 */

import type { OrbitPlanId } from '@shared/flux';
import { toolRiskLabel, toolsOf } from '@shared/flux';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLabFrame } from '@/app/LabFrame';
import { art } from '@/content/art';
import { AgentSession } from '@/learn/widgets/agent-session/AgentSession';
import { asks } from '@/learn/widgets/agent-session/engine/policy';
import { SCENARIO_LIST, SCENARIOS } from '@/learn/widgets/agent-session/engine/scenarios';
import {
  type AgentSessionOutcome,
  POLICY_IDS,
  type PolicyId,
  type ScenarioId,
  type Verdict,
} from '@/learn/widgets/agent-session/engine/types';
import { PlanPicker, PolicyPicker, ScenarioPicker } from '@/learn/widgets/agent-session/Pickers';
import { PolicyTable, type PolicyTableRow } from '@/learn/widgets/agent-session/PolicyTable';
import type { Phase } from '@/learn/widgets/agent-session/useAgentSession';
import { connectionLabel, POLICY_SHORT, VERDICT } from '@/learn/widgets/agent-session/words';
import { Button, Glyph, useIsPhone } from '@/ui';
import styles from './AgentDeskLab.module.css';
import { ABOUT, TEACH } from './notes';

const SESSION_BODY = 'agent-desk-setup';

/** What a finished run records, per scenario and policy. */
interface Ran {
  verdict: Verdict;
  title: string;
}

function DeskArt() {
  const a = art('lab-agent-desk');
  return (
    <span className={styles.art} aria-hidden="true">
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

export default function AgentDeskLab() {
  const [scenario, setScenario] = useState<ScenarioId>('deploy-nginx');
  const [policy, setPolicy] = useState<PolicyId>('ask-all');
  const [plan, setPlan] = useState<OrbitPlanId>('standard');
  const [run, setRun] = useState({ key: 0, autoStart: false });
  const [phase, setPhase] = useState<Phase>('idle');
  const [ran, setRan] = useState<Readonly<Record<string, Ran>>>({});
  const [setupOpen, setSetupOpen] = useState(true);
  const setupRef = useRef<HTMLDivElement>(null);
  const [focusSetup, setFocusSetup] = useState(false);

  const isPhone = useIsPhone();
  const data = SCENARIOS[scenario];
  const running = phase === 'running';

  // ---- choosing -----------------------------------------------------------------------------------------
  const pickScenario = useCallback((id: ScenarioId) => {
    setScenario(id);
    setRun((r) => ({ key: r.key + 1, autoStart: false }));
  }, []);

  const runAgain = useCallback((next: PolicyId) => {
    setPolicy(next);
    setRun((r) => ({ key: r.key + 1, autoStart: true }));
  }, []);

  const chooseAnother = useCallback(() => {
    setRun((r) => ({ key: r.key + 1, autoStart: false }));
    setSetupOpen(true);
    setFocusSetup(true);
  }, []);

  useEffect(() => {
    if (!focusSetup) return;
    setFocusSetup(false);
    setupRef.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus();
  }, [focusSetup]);

  // ---- what happened ------------------------------------------------------------------------------------
  const onFinish = useCallback((o: AgentSessionOutcome) => {
    const ending = SCENARIOS[o.scenario].endings[o.ending];
    setRan((r) => ({
      ...r,
      [`${o.scenario}:${o.policy}`]: { verdict: o.verdict, title: ending?.title ?? o.ending },
    }));
  }, []);

  const ranScenarios = useMemo(() => {
    const set = new Set<ScenarioId>();
    for (const key of Object.keys(ran)) set.add(key.split(':')[0] as ScenarioId);
    return set;
  }, [ran]);

  // On a narrow screen the set-up folds away once a session runs, so the session is what is on screen.
  useEffect(() => {
    if (phase === 'running') setSetupOpen(false);
  }, [phase]);

  // ---- the frame ----------------------------------------------------------------------------------------
  const statusText =
    phase === 'idle'
      ? `Ready: ${data.card.title}.`
      : phase === 'running'
        ? `Running: ${data.card.title}, ${POLICY_SHORT[policy].toLowerCase()}.`
        : `Finished: ${data.card.title}, ${POLICY_SHORT[policy].toLowerCase()}.`;

  useLabFrame({
    simulation: true,
    about: ABOUT,
    teach: TEACH,
    teachTitle: 'Teach me',
    shortcuts: [
      { keys: 'tab', label: 'Move between choices' },
      { keys: 'enter', label: 'Press the focused button' },
    ],
    status: statusText,
  });

  // ---- the tools of this server, against the three policies --------------------------------------------
  const rows = useMemo<PolicyTableRow[]>(
    () =>
      toolsOf(data.server)
        .filter((t) => t.risk !== 'reads')
        .map((t) => ({
          tool: t.name,
          risk: t.risk,
          riskLabel: toolRiskLabel(t),
          asks: {
            'ask-all': asks('ask-all', t),
            'ask-spends': asks('ask-spends', t),
            'allow-all': asks('allow-all', t),
          },
        })),
    [data.server],
  );

  const toolCount = toolsOf(data.server).length;

  // The two settings the experiment varies sit in the session's intro, right above Start.
  const idleExtra = (
    <>
      {scenario === 'orbit-repo' ? <PlanPicker value={plan} onChange={setPlan} /> : null}
      <PolicyPicker value={policy} onChange={setPolicy} />
    </>
  );

  return (
    <div className={styles.lab}>
      <div className={styles.grid}>
        {/* ---- the scenarios ---------------------------------------------------------------------------- */}
        <section className={styles.rail} aria-labelledby="agent-desk-setup-title">
          <div className={styles.railHead}>
            <h2 id="agent-desk-setup-title" className={styles.railTitle}>
              Scenarios
            </h2>
            <Button
              size="sm"
              variant="ghost"
              icon={setupOpen ? 'chevron-up' : 'chevron-down'}
              className={styles.railToggle}
              aria-expanded={setupOpen}
              aria-controls={SESSION_BODY}
              onClick={() => setSetupOpen((o) => !o)}
            >
              {setupOpen ? 'Hide the scenarios' : 'Change the scenario'}
            </Button>
          </div>
          <p className={styles.railSummary}>
            <strong>{data.card.title}</strong>
          </p>

          <div
            id={SESSION_BODY}
            ref={setupRef}
            className={styles.setup}
            data-collapsed={setupOpen ? undefined : ''}
          >
            <ScenarioPicker
              legend="Choose a scenario"
              hideLegend
              compact={isPhone}
              value={scenario}
              onChange={pickScenario}
              disabled={running}
              ran={ranScenarios}
            />
            {running ? (
              <p className={styles.runningHint}>
                A session is running. Finish it, or press Start over, to choose another scenario.
              </p>
            ) : null}

            {Object.keys(ran).length > 0 ? (
              <section className={styles.tried} aria-labelledby="agent-desk-tried">
                <h3 id="agent-desk-tried" className={styles.triedTitle}>
                  <Glyph name="list" size={16} /> What you have run
                </h3>
                <table className={styles.triedTable}>
                  <caption className="sr-only">
                    How each scenario ended under each policy you have tried
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Scenario</th>
                      {POLICY_IDS.map((p) => (
                        <th key={p} scope="col">
                          {POLICY_SHORT[p]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SCENARIO_LIST.map((s) => (
                      <tr key={s.id}>
                        <th scope="row">{s.card.title}</th>
                        {POLICY_IDS.map((p) => {
                          const r = ran[`${s.id}:${p}`];
                          return (
                            <td key={p}>
                              {r ? (
                                <span className={styles.triedCell} data-verdict={r.verdict} title={r.title}>
                                  <Glyph name={VERDICT[r.verdict].glyph} size={14} />
                                  <span>{VERDICT[r.verdict].label}</span>
                                </span>
                              ) : (
                                <span className={styles.triedNone}>Not run</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}
          </div>
        </section>

        {/* ---- the session ------------------------------------------------------------------------------ */}
        <div className={styles.stage}>
          <AgentSession
            key={`${scenario}|${run.key}`}
            scenario={scenario}
            policy={policy}
            plan={plan}
            autoStart={run.autoStart}
            headingLevel={2}
            idleExtra={idleExtra}
            aside={<DeskArt />}
            onPhase={setPhase}
            onFinish={onFinish}
            onRunAgain={runAgain}
            onChooseAnother={chooseAnother}
          />

          <details className={styles.tools}>
            <summary>
              Which calls does each policy stop?
              <span className={styles.toolsCount}>
                {rows.length} of {toolCount} tools are not reads
              </span>
            </summary>
            <p className={styles.toolsLead}>
              {connectionLabel(data.server, data.connection)}. Reads run without a prompt under every policy,
              so they are left out.
            </p>
            <PolicyTable
              rows={rows}
              active={policy}
              caption={`Tools of the ${data.server === 'orbit' ? 'Orbit' : 'FluxCloud'} MCP server that are not reads, and which policies ask before them`}
            />
          </details>
        </div>
      </div>
    </div>
  );
}
