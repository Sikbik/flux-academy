/**
 * Widget `fluxcloud-sim` (docs/CONTENT.md section 5): a labelled SIMULATION of the FluxCloud flows with the
 * real labels, field names and order from docs/research/FACTS.md section 9.
 *
 * Props (`stage.props`):
 *   flow     'register' | 'manage' | 'update'   which flow to run (default `register`)
 *   preset   string                             a fixture id from FIXTURES: the app that "Show me"
 *                                               registers (register) or the running app (manage, update).
 *                                               Defaults: register `hello-world`, manage and update `web-app`.
 *   goal     string                             one sentence for the goal line, replacing the default
 *   scenario 'healthy' | 'crash-loop'           what the Logs tab of the sample app shows (default healthy)
 *   blocksLeft number                           blocks left on the sample app's subscription
 *                                               (manage and update; default about 19.8 days)
 *
 * Done (`widget-done`):
 *   register  the deployment timeline reaches "Deployment Successful!"
 *   manage    every one of the ten Manage tabs has been visited
 *   update    the update has been paid and the confirmation is shown
 *
 * "Show me" fills the form from the preset and walks the steps (register), visits every tab (manage) or
 * changes an environment variable and confirms the update (update).
 *
 * Nothing leaves the browser: no request is made, nothing is signed, paid or deployed. Prices, lint and
 * block arithmetic come from `@shared/flux`; see the modules next to this file.
 */
import { BAKED_PRICING, type FluxAppSpec } from '@shared/flux';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChainHeight, usePricing } from '@/data';
import type { StageHost, WidgetComponent } from '@/learn/stage-api';
import { Button, Callout, Chip, FreshnessChip, Glyph, Panel, useReducedMotion } from '@/ui';
import { type FocusGate, type SimEnv, SimEnvProvider } from './context';
import styles from './FluxcloudSim.module.css';
import { type ManageLocation, ManageScreen } from './ManageScreen';
import { type LogScenario, presetSpec, type SampleApp, sampleApp } from './manage';
import { type Account, SIM_EMAIL } from './model';
import { type RegisterLocation, RegisterScreen } from './RegisterScreen';
import { type MenuId, Window } from './Window';
import { type WhyKey, whyFor } from './why';

type Flow = 'register' | 'manage' | 'update';

/** Tip height used while the data layer has none (FACTS snapshot 2026-10-12). */
const FALLBACK_HEIGHT = 3_031_422;

interface Props {
  flow: Flow;
  preset: string | undefined;
  goal: string | undefined;
  scenario: LogScenario;
  blocksLeft: number | undefined;
}

function readProps(raw: Record<string, unknown> | undefined): Props {
  const flow = raw?.flow === 'manage' || raw?.flow === 'update' ? raw.flow : 'register';
  const scenario = raw?.scenario === 'crash-loop' ? 'crash-loop' : 'healthy';
  const bl =
    typeof raw?.blocksLeft === 'number' && Number.isFinite(raw.blocksLeft) ? raw.blocksLeft : undefined;
  return {
    flow,
    preset: typeof raw?.preset === 'string' ? raw.preset : undefined,
    goal: typeof raw?.goal === 'string' ? raw.goal : undefined,
    scenario,
    blocksLeft: bl,
  };
}

const DEFAULT_GOAL: Record<Flow, string> = {
  register:
    'Register an app the way FluxCloud does it, from the first screen to a running deployment. Nothing here is real: no signature, no payment, no deployment.',
  manage:
    'Open the Manage page of a running app and visit every one of its ten tabs. Each tab is marked when you have been there.',
  update:
    'Change one thing in a running app, see what the update costs after the credit for the time left, and confirm it.',
};

const STEPS: Record<Flow, string[]> = {
  register: ['Choose how to deploy', 'Configure', 'Review & Validate', 'Deployment'],
  manage: ['My Applications', 'Manage page', 'Every tab'],
  update: ['Change the spec', 'Review & Validate', 'Confirmed'],
};

/** The app the simulator manages or updates: a fixture, with a placeholder contact so the spec is complete. */
function runningSpec(id: string | undefined): FluxAppSpec {
  const spec = presetSpec(id, 'web-app');
  return spec.contacts.length > 0 ? spec : { ...spec, contacts: [SIM_EMAIL] };
}

interface Loc {
  path: string;
  why: WhyKey;
  step: number;
  locked: boolean;
}

function sameLoc(a: Loc, b: Loc): boolean {
  return a.path === b.path && a.why === b.why && a.step === b.step && a.locked === b.locked;
}

const FluxcloudSim: WidgetComponent = ({ stage, host, stepKey }) => {
  const props = readProps(stage.props);
  const propsKey = JSON.stringify(props);
  return <Sim key={`${stepKey}|${propsKey}`} props={props} host={host} />;
};

export default FluxcloudSim;

interface SimProps {
  props: Props;
  host: StageHost;
}

function Sim({ props, host }: SimProps) {
  const { flow } = props;
  const pricing = usePricing();
  const tip = useChainHeight();
  const reducedMotion = useReducedMotion();
  const [account, setAccount] = useState<Account>('sso');
  const [message, setMessage] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [autopilot, setAutopilot] = useState(false);
  const [done, setDone] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const gate = useRef<FocusGate>({ armed: false, root: null }).current;
  const setRoot = useCallback(
    (el: HTMLElement | null) => {
      gate.root = el;
    },
    [gate],
  );
  // Child effects run first, so nothing takes focus while the simulator mounts.
  useEffect(() => {
    gate.armed = true;
    return () => {
      gate.armed = false;
    };
  }, [gate]);

  const announce = useCallback((text: string) => setMessage(text), []);
  const attempt = useCallback(() => host.emit({ type: 'custom', name: 'attempt' }), [host]);
  const stopAutopilot = useCallback(() => setAutopilot(false), []);

  const params = pricing.data?.params ?? BAKED_PRICING.params;
  const fluxUsd = pricing.data?.fluxUsd ?? null;
  const paramsSource = pricing.data ? pricing.data.paramsSource : 'baked';
  // The simulation is a snapshot: the tip at mount, so the sample app's time left does not jump when a
  // live height arrives a moment later.
  const [height] = useState(() => tip ?? FALLBACK_HEIGHT);

  const env: SimEnv = useMemo(
    () => ({
      params,
      fluxUsd,
      paramsSource,
      height,
      nowMs,
      account,
      reducedMotion,
      announce,
      attempt,
      gate,
    }),
    [params, fluxUsd, paramsSource, height, nowMs, account, reducedMotion, announce, attempt, gate],
  );

  // ---- the app being managed or updated ----------------------------------------------------------
  const baseSpec = useMemo(
    () => runningSpec(flow === 'register' ? undefined : props.preset),
    [flow, props.preset],
  );
  const [app, setApp] = useState<SampleApp>(() => sampleApp(baseSpec, height, props.blocksLeft));
  // The sample app is fixed when the simulator mounts; later chain blocks only count down its time.
  const registerPreset = useMemo(() => presetSpec(props.preset, 'hello-world'), [props.preset]);

  // ---- done and solver ---------------------------------------------------------------------------
  const finished = useRef(false);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setDone(true);
    host.emit({ type: 'widget-done' });
  }, [host]);

  // "Show me" walks the flow, which takes seconds. The solver hands the player a promise that settles when
  // the walk ends (the screens stop the autopilot) or the simulator goes away, so the player waits for the
  // walk instead of marking the task shown after a short grace while the steps are still running.
  const walkEnd = useRef<(() => void) | null>(null);
  const solveRef = useRef<() => void | Promise<void>>(() => undefined);
  solveRef.current = () =>
    new Promise<void>((resolve) => {
      walkEnd.current?.();
      walkEnd.current = resolve;
      setAutopilot(true);
    });
  useEffect(() => {
    if (autopilot) return;
    walkEnd.current?.();
    walkEnd.current = null;
  }, [autopilot]);
  useEffect(
    () => () => {
      walkEnd.current?.();
      walkEnd.current = null;
    },
    [],
  );
  useEffect(() => {
    host.registerSolver(() => solveRef.current());
    return () => host.registerSolver(null);
  }, [host]);

  // ---- where we are (address strip, annotation, steps) -------------------------------------------
  const [loc, setLoc] = useState<Loc>({
    path:
      flow === 'register'
        ? '/apps/register'
        : flow === 'update'
          ? `/apps/manage/${baseSpec.name}`
          : '/apps/management',
    why: flow === 'register' ? 'register.entry' : flow === 'update' ? 'sub.update' : 'manage.list',
    step: 0,
    locked: false,
  });
  const [manageStep, setManageStep] = useState(0);
  const [allTabs, setAllTabs] = useState(false);
  const [updateStep, setUpdateStep] = useState(0);

  const setLocation = useCallback((next: Loc) => setLoc((cur) => (sameLoc(cur, next) ? cur : next)), []);
  const onRegisterLocation = useCallback((l: RegisterLocation) => setLocation(l), [setLocation]);
  const onManageLocation = useCallback(
    (l: ManageLocation) => {
      setLoc((cur) => {
        const next: Loc = {
          path: l.path,
          why: l.why,
          step: cur.step,
          locked: l.view === 'review' || l.view === 'confirmed',
        };
        return sameLoc(cur, next) ? cur : next;
      });
      if (flow === 'manage') setManageStep(l.view === 'list' ? 0 : allTabs ? 2 : 1);
      if (flow === 'update') setUpdateStep(l.view === 'review' ? 1 : l.view === 'confirmed' ? 2 : 0);
    },
    [flow, allTabs],
  );

  const onAllVisited = useCallback(() => {
    setAllTabs(true);
    setManageStep(2);
    if (flow === 'manage') finish();
  }, [flow, finish]);

  const onConfirmed = useCallback(
    (kind: 'update' | 'renewal') => {
      if (flow === 'update' && kind === 'update') finish();
    },
    [flow, finish],
  );

  const step = flow === 'register' ? loc.step : flow === 'manage' ? manageStep : updateStep;
  const why = whyFor(loc.why);
  const menu: MenuId = flow === 'register' && loc.path.startsWith('/apps/register') ? 'register' : 'apps';
  // Only the entries that lead somewhere in this flow are live.
  const [menuSignal, setMenuSignal] = useState(0);
  const onMenu = useCallback((id: MenuId) => {
    if (id === 'apps') setMenuSignal((n) => n + 1);
  }, []);
  const liveMenu: MenuId[] =
    flow === 'register'
      ? loc.why === 'register.deployed'
        ? ['register', 'apps']
        : ['register']
      : flow === 'manage'
        ? ['apps']
        : [];

  const reset = () => {
    setResetKey((k) => k + 1);
    setAutopilot(false);
    setApp(sampleApp(baseSpec, height, props.blocksLeft));
    setMessage('The simulation was reset.');
  };

  const total = STEPS[flow].length;

  return (
    <SimEnvProvider value={env}>
      <Panel variant="glass" padding="md" container contentClassName={styles.root} ref={setRoot}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>FluxCloud simulator</p>
          <div className={styles.headChips}>
            <FreshnessChip kind="simulation" />
            <Chip size="sm" icon="lock">
              Nothing leaves this page
            </Chip>
          </div>
        </div>
        <p className={styles.goal}>{props.goal ?? DEFAULT_GOAL[flow]}</p>

        <ol className={styles.steps} aria-label={`Steps of the ${flow} flow`}>
          {STEPS[flow].map((label, i) => (
            <li
              key={label}
              className={styles.stepItem}
              data-state={done || i < step ? 'done' : i === step ? 'current' : 'todo'}
              aria-current={i === step && !done ? 'step' : undefined}
            >
              <span className={styles.stepMark} aria-hidden="true">
                {done || i < step ? <Glyph name="check" size={12} /> : i + 1}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <Window
          path={loc.path}
          current={menu}
          live={liveMenu}
          onMenu={onMenu}
          account={account}
          onAccount={setAccount}
          accountLocked={loc.locked}
        >
          {flow === 'register' ? (
            <RegisterScreen
              key={resetKey}
              preset={registerPreset}
              autopilot={autopilot}
              onAutopilotDone={stopAutopilot}
              onLocation={onRegisterLocation}
              onDone={finish}
              scenario={props.scenario}
              manageSignal={menuSignal}
            />
          ) : (
            <ManageScreen
              key={resetKey}
              app={app}
              onApp={setApp}
              scenario={props.scenario}
              startView={flow === 'update' ? 'page' : 'list'}
              startTab={flow === 'update' ? 'subscription' : 'specifications'}
              startAction={flow === 'update' ? 'update' : 'renewal'}
              onLocation={onManageLocation}
              onAllVisited={onAllVisited}
              onConfirmed={onConfirmed}
              focusUpdate={flow === 'update'}
              listSignal={menuSignal}
              autopilot={autopilot}
              onAutopilotDone={stopAutopilot}
            />
          )}
        </Window>

        <Callout kind="why" title="Why this step exists" compact>
          <strong>{why.step}</strong> {why.body}
        </Callout>

        <div className={styles.foot}>
          <p className={styles.fineprint}>
            Simulation. No request is sent, nothing is signed, paid or deployed, and the nodes and addresses
            are samples. {done ? 'This flow is complete.' : `Step ${Math.min(step + 1, total)} of ${total}.`}
          </p>
          <Button size="sm" variant="ghost" icon="reset" onClick={reset}>
            Reset the simulation
          </Button>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {message}
        </p>
      </Panel>
    </SimEnvProvider>
  );
}
