/**
 * Widget `agent-session` (docs/CONTENT.md section 5): a SIMULATION of an AI agent proposing tool calls to a Flux
 * MCP server while the learner is the person who approves them.
 *
 * Props (`stage.props`):
 *   scenario  'deploy-nginx' | 'poisoned-log' | 'retry-after-timeout' | 'orbit-repo'
 *               deploy-nginx         FluxCloud server, hosted: plan, then confirm. The plan has a flaw to catch.
 *               poisoned-log         FluxCloud server, on your machine: a log line tells the agent to remove the app.
 *               retry-after-timeout  FluxCloud server, hosted: a wait times out and the agent wants to pay again.
 *               orbit-repo           Orbit server, your account: registering is a call, paying is a checkout page.
 *   policy    'ask-all' | 'ask-spends' | 'allow-all'
 *               The approval policy of the client. Omit it and the learner chooses before starting
 *               (the choice starts at `ask-all`, the academy's recommendation).
 *   plan      'starter' | 'standard' | 'pro'    Orbit plan for `orbit-repo` (default `standard`).
 *   goal      'finish' | 'safe'
 *               `finish` (default): done when the session ends and the debrief is on screen, whatever the ending.
 *               `safe`: done only when it ends the way the scenario teaches; any other ending is an attempt.
 *
 * Events to the lesson engine:
 *   widget-done                        see `goal`.
 *   custom `attempt`                   the learner started a session, or ended one that was not the goal.
 *   custom `agent-session-outcome`     `data` is an `AgentSessionOutcome` (engine/types.ts): scenario, policy,
 *                                      ending, goalMet, verdict, approved, refused, ranUnasked, paidUsd,
 *                                      wastedUsd, dataDeleted, appEnded, keysSent, prompts.
 *
 * "Show me" starts a fresh session and plays the shortest path to the scenario's goal, or, where the policy
 * makes the goal impossible (nothing asks under `allow-all`), the path with the least harm. It returns a promise
 * that settles when the debrief is up.
 *
 * The agent is a script. Nothing is sent, signed, paid or deployed. Prices come from `quote()` and
 * `orbitPlanQuoteUsd()` at the baked FLUX price, durations from `shared/flux/timing.ts`.
 */

import { ORBIT_PLAN_IDS, type OrbitPlanId } from '@shared/flux';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StageHost, WidgetComponent } from '@/learn/stage-api';
import { Callout } from '@/ui';
import { AgentSession } from './AgentSession.tsx';
import { bestPath } from './engine/paths.ts';
import {
  type AgentSessionOutcome,
  type Decision,
  POLICY_IDS,
  type PolicyId,
  SCENARIO_IDS,
  type ScenarioId,
} from './engine/types.ts';
import { PolicyPicker } from './Pickers.tsx';

type Goal = 'finish' | 'safe';

interface Props {
  scenario: ScenarioId;
  /** The scenario id the lesson asked for when it is not one this widget knows. */
  unknown: string | null;
  /** Fixed by the lesson, or undefined when the learner chooses. */
  policy: PolicyId | undefined;
  plan: OrbitPlanId;
  goal: Goal;
}

const DEFAULT_SCENARIO: ScenarioId = 'deploy-nginx';

function readProps(raw: Record<string, unknown> | undefined): Props {
  const s = raw?.scenario;
  const known = typeof s === 'string' && (SCENARIO_IDS as readonly string[]).includes(s);
  const p = raw?.policy;
  const policy =
    typeof p === 'string' && (POLICY_IDS as readonly string[]).includes(p) ? (p as PolicyId) : undefined;
  const pl = raw?.plan;
  const plan =
    typeof pl === 'string' && (ORBIT_PLAN_IDS as readonly string[]).includes(pl)
      ? (pl as OrbitPlanId)
      : 'standard';
  return {
    scenario: known ? (s as ScenarioId) : DEFAULT_SCENARIO,
    unknown: typeof s === 'string' && !known ? s : null,
    policy,
    plan,
    goal: raw?.goal === 'safe' ? 'safe' : 'finish',
  };
}

const AgentSessionWidget: WidgetComponent = ({ stage, host, stepKey, compact }) => {
  const props = readProps(stage.props);
  const propsKey = JSON.stringify(props);
  // A new step, or the same step entered again, starts a fresh session.
  return <Widget key={`${stepKey}|${propsKey}`} props={props} host={host} compact={compact === true} />;
};

export default AgentSessionWidget;

interface WidgetProps {
  props: Props;
  host: StageHost;
  compact: boolean;
}

interface Run {
  key: number;
  autoStart: boolean;
  script: readonly Decision[] | null;
}

function Widget({ props, host, compact }: WidgetProps) {
  const [policy, setPolicy] = useState<PolicyId>(props.policy ?? 'ask-all');
  const [run, setRun] = useState<Run>({ key: 0, autoStart: false, script: null });

  const policyRef = useRef(policy);
  policyRef.current = policy;

  // ---- reporting ----------------------------------------------------------------------------------------
  const settle = useRef<(() => void) | null>(null);
  const { goal } = props;

  const onStart = useCallback(() => host.emit({ type: 'custom', name: 'attempt' }), [host]);

  const onFinish = useCallback(
    (outcome: AgentSessionOutcome) => {
      host.emit({ type: 'custom', name: 'agent-session-outcome', data: outcome });
      if (goal === 'finish' || outcome.goalMet) host.emit({ type: 'widget-done' });
      else host.emit({ type: 'custom', name: 'attempt' });
      settle.current?.();
      settle.current = null;
    },
    [host, goal],
  );

  // ---- Show me --------------------------------------------------------------------------------------------
  const { scenario, plan } = props;
  useEffect(() => {
    host.registerSolver(
      () =>
        new Promise<void>((resolve) => {
          settle.current?.();
          settle.current = resolve;
          const decisions = bestPath(scenario, policyRef.current, scenario === 'orbit-repo' ? { plan } : {});
          setRun((r) => ({ key: r.key + 1, autoStart: true, script: decisions }));
        }),
    );
    return () => host.registerSolver(null);
  }, [host, scenario, plan]);

  useEffect(
    () => () => {
      settle.current?.();
      settle.current = null;
    },
    [],
  );

  // ---- run again ------------------------------------------------------------------------------------------
  const runAgain = useCallback((next: PolicyId) => {
    setPolicy(next);
    setRun((r) => ({ key: r.key + 1, autoStart: true, script: null }));
  }, []);

  const idleExtra =
    props.policy === undefined ? (
      <PolicyPicker value={policy} onChange={setPolicy} legend="How your client asks" />
    ) : null;

  return (
    <>
      {props.unknown !== null ? (
        <Callout kind="gotcha" compact>
          This step asks for the scenario &ldquo;{props.unknown}&rdquo;, which this widget does not have. It
          shows {DEFAULT_SCENARIO} instead.
        </Callout>
      ) : null}
      <AgentSession
        key={run.key}
        scenario={scenario}
        policy={policy}
        plan={plan}
        autoStart={run.autoStart}
        script={run.script}
        compact={compact}
        headingLevel={3}
        idleExtra={idleExtra}
        onStart={onStart}
        onFinish={onFinish}
        onRunAgain={runAgain}
      />
    </>
  );
}
