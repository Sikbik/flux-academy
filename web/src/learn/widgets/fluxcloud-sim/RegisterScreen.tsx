/**
 * The register flow: entry, the Simple or Advanced form, Review & Validate, then the deployment timeline.
 * The state machine is `flow.ts`; this component owns the clocks and the screens.
 */
import type { FluxAppSpec } from '@shared/flux';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { AdvancedForm } from './AdvancedForm';
import { useSimEnv } from './context';
import { DeployScreen } from './DeployScreen';
import { EntryScreen } from './EntryScreen';
import {
  advancedBlockers,
  currentRow,
  initialRegister,
  nextReviewAction,
  registerDeployed,
  registerReducer,
  reviewComplete,
} from './flow';
import { type ManageLocation, ManageScreen } from './ManageScreen';
import { type LogScenario, sampleApp } from './manage';
import {
  blankDraft,
  type Draft,
  draftFromSpec,
  type Mode,
  simpleBlockers,
  simpleLimits,
  slugifyAppName,
  switchMode,
  TAKEN_NAMES,
} from './model';
import { ReviewScreen } from './ReviewScreen';
import { review } from './review';
import { SimpleForm } from './SimpleForm';
import { buildTimeline } from './timeline';
import type { WhyKey } from './why';

export interface RegisterLocation {
  path: string;
  why: WhyKey;
  /** 0 entry, 1 configure, 2 review, 3 deploy. */
  step: number;
  /** The account switch must not change any more. */
  locked: boolean;
}

interface RegisterScreenProps {
  preset: FluxAppSpec;
  /** The solver is running ("Show me"). */
  autopilot: boolean;
  onAutopilotDone: () => void;
  onLocation: (loc: RegisterLocation) => void;
  onDone: () => void;
  scenario: LogScenario;
  /** Changes when "My Applications" is chosen in the menu. */
  manageSignal?: number;
}

/** Advanced mode when Simple mode cannot say it, or would change the name. */
export function startModeFor(spec: FluxAppSpec): Mode {
  const probe = draftFromSpec(spec, 'sso', 'advanced');
  if (simpleLimits(probe).length > 0) return 'advanced';
  return slugifyAppName(spec.name) === spec.name ? 'simple' : 'advanced';
}

export function RegisterScreen({
  preset,
  autopilot,
  onAutopilotDone,
  onLocation,
  onDone,
  scenario,
  manageSignal,
}: RegisterScreenProps) {
  const env = useSimEnv();
  const { account, params, fluxUsd, paramsSource, height, nowMs, reducedMotion, announce } = env;
  const [state, dispatch] = useReducer(registerReducer, undefined, () =>
    initialRegister(account, blankDraft(account)),
  );
  const filled = useRef(false);
  const doneRef = useRef(false);
  /** How many times the solver went back to repair a failed review. */
  const recoveries = useRef(0);

  // The account switch in the title bar.
  useEffect(() => {
    if (state.account !== account) dispatch({ type: 'account', account });
  }, [account, state.account]);

  const result = useMemo(
    () =>
      review(state.draft.spec, {
        params,
        fluxUsd,
        paramsSource,
        takenNames: TAKEN_NAMES,
        currentHeight: height,
        nowMs,
        enterprise: state.draft.enterprise,
      }),
    [state.draft.spec, state.draft.enterprise, params, fluxUsd, paramsSource, height, nowMs],
  );

  const blockers = useMemo(
    () =>
      state.draft.mode === 'simple'
        ? simpleBlockers(state.draft, state.account)
        : advancedBlockers(state.draft),
    [state.draft, state.account],
  );

  const timeline = useMemo(
    () => buildTimeline(state.draft.spec, state.review.method ?? 'flux'),
    [state.draft.spec, state.review.method],
  );

  const setDraft = useCallback((d: Draft) => dispatch({ type: 'draft', draft: d }), []);
  const setMode = (m: Mode) => dispatch({ type: 'draft', draft: switchMode(state.draft, m) });

  // Payment confirmed: the deployment starts.
  useEffect(() => {
    if (state.stage === 'review' && reviewComplete(state.review)) {
      dispatch({
        type: 'deploy',
        length: timeline.length,
        successAt: timeline.successAt,
        autoplay: !reducedMotion,
      });
      announce('Registration Successful! Nodes will now find the app and install it.');
    }
  }, [state.stage, state.review, timeline.length, timeline.successAt, reducedMotion, announce]);

  // "My Applications" in the menu, once there is an app to manage.
  const lastManage = useRef(manageSignal);
  useEffect(() => {
    if (lastManage.current === manageSignal) return;
    lastManage.current = manageSignal;
    dispatch({ type: 'openManage' });
  }, [manageSignal]);

  const manageLocation = useCallback(
    (l: ManageLocation) => onLocation({ path: l.path, why: l.why, step: 3, locked: false }),
    [onLocation],
  );

  // Done: the last screen is reached.
  const deployed = registerDeployed(state);
  useEffect(() => {
    if (deployed && !doneRef.current) {
      doneRef.current = true;
      announce(
        timeline.outcome === 'success'
          ? 'Deployment Successful!'
          : 'Payment monitoring timed out. Please check your application status.',
      );
      onDone();
    }
  }, [deployed, onDone, announce, timeline.outcome]);

  // Where we are, for the address strip and the annotation.
  const row = currentRow(state.review);
  useEffect(() => {
    let loc: RegisterLocation;
    switch (state.stage) {
      case 'entry':
        loc = { path: '/apps/register', why: 'register.entry', step: 0, locked: false };
        break;
      case 'configure':
        loc = {
          path: '/apps/register/configure',
          why: state.draft.mode === 'simple' ? 'register.simple' : 'register.advanced',
          step: 1,
          locked: false,
        };
        break;
      case 'review': {
        const r = row ?? (state.review.rows.validate === 'failed' ? 'validate' : 'validate');
        loc = {
          path: '/apps/register/configure',
          why: `review.${r}` as WhyKey,
          step: 2,
          locked: true,
        };
        break;
      }
      default:
        loc = {
          path: '/apps/register/configure',
          why: deployed ? 'register.deployed' : 'register.deploy',
          step: 3,
          locked: true,
        };
    }
    onLocation(loc);
  }, [state.stage, state.draft.mode, row, state.review.rows.validate, deployed, onLocation]);

  // ---- the solver --------------------------------------------------------------------------------
  const manualSteps = useCallback(() => {
    switch (state.stage) {
      case 'entry':
        dispatch({ type: 'goto', stage: 'configure' });
        return;
      case 'configure': {
        if (!filled.current) {
          filled.current = true;
          dispatch({ type: 'draft', draft: draftFromSpec(preset, state.account, startModeFor(preset)) });
          return;
        }
        dispatch({ type: 'goto', stage: 'review' });
        return;
      }
      case 'review': {
        if (state.review.rows.validate === 'failed' || state.review.rows.test === 'failed') {
          // What was there did not pass: go back, put the preset in the form again, review again.
          recoveries.current += 1;
          filled.current = false;
          dispatch({ type: 'goto', stage: 'configure' });
          return;
        }
        const r = currentRow(state.review);
        if (r === 'signature' || r === 'test' || r === 'payment') {
          const a = nextReviewAction(state.review, state.account, result.valid, 'flux');
          if (a) dispatch({ type: 'review', action: a });
        }
        return;
      }
      case 'deploy':
        if (reducedMotion) dispatch({ type: 'skip' });
        return;
      default:
    }
  }, [state, preset, result.valid, reducedMotion]);

  useEffect(() => {
    if (!autopilot) return;
    if (registerDeployed(state)) {
      onAutopilotDone();
      return;
    }
    // A failed validation or test sends the solver back to the form once or twice, then it gives up.
    if (
      state.stage === 'review' &&
      recoveries.current >= 2 &&
      (state.review.rows.validate === 'failed' || state.review.rows.test === 'failed')
    ) {
      onAutopilotDone();
      return;
    }
    const id = window.setTimeout(manualSteps, reducedMotion ? 60 : 650);
    return () => window.clearTimeout(id);
  }, [autopilot, state, manualSteps, reducedMotion, onAutopilotDone]);

  // ---- screens -----------------------------------------------------------------------------------
  if (state.openedManage) {
    const app = sampleApp(state.draft.spec, height, state.draft.spec.expire);
    return (
      <ManageScreen
        app={app}
        onApp={() => undefined}
        scenario={scenario}
        startView="page"
        startTab="instances"
        startAction="renewal"
        onLocation={manageLocation}
        onAllVisited={() => undefined}
        onConfirmed={() => undefined}
      />
    );
  }

  if (state.stage === 'entry') {
    return <EntryScreen onDocker={() => dispatch({ type: 'goto', stage: 'configure' })} />;
  }

  if (state.stage === 'configure') {
    if (state.draft.mode === 'simple') {
      return (
        <SimpleForm
          draft={state.draft}
          onChange={setDraft}
          walletAccount={state.account === 'wallet'}
          result={result}
          paramsSource={paramsSource}
          fluxMultiplier={params.fluxmultiplier}
          blockers={blockers}
          mode={state.draft.mode}
          onMode={setMode}
          onBack={() => dispatch({ type: 'goto', stage: 'entry' })}
          onReview={() => dispatch({ type: 'goto', stage: 'review' })}
        />
      );
    }
    return (
      <AdvancedForm
        draft={state.draft}
        onChange={setDraft}
        walletAccount={state.account === 'wallet'}
        result={result}
        paramsSource={paramsSource}
        fluxMultiplier={params.fluxmultiplier}
        mode={state.draft.mode}
        onMode={setMode}
        onReview={() => dispatch({ type: 'goto', stage: 'review' })}
      />
    );
  }

  if (state.stage === 'review') {
    return (
      <ReviewScreen
        kind="register"
        result={result}
        review={state.review}
        dispatch={(a) => dispatch({ type: 'review', action: a })}
        fluxMultiplier={params.fluxmultiplier}
        onBack={() => dispatch({ type: 'goto', stage: 'configure' })}
        backLabel="Back to the form"
      />
    );
  }

  return (
    <DeployScreen
      timeline={timeline}
      deploy={state.deploy}
      onTick={(dt) => dispatch({ type: 'tick', dt })}
      onSeek={(t) => dispatch({ type: 'seek', t })}
      onPlaying={(on) => dispatch({ type: 'playing', on })}
      onSkip={() => dispatch({ type: 'skip' })}
      onManage={() => dispatch({ type: 'openManage' })}
      appName={state.draft.spec.name}
    />
  );
}
