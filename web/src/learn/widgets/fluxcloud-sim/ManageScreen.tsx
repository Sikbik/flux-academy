/**
 * "My Applications" and the Manage page of one app (FACTS 9.6), including the Subscription tab with its
 * three actions: Renewal, Update and Cancel. An update or a renewal goes through the same Review & Validate
 * screen as a registration, with the credit for the unused time in its price (the engine's `updateCredit`).
 *
 * The flow `manage` is done when every one of the ten tabs has been visited; the flow `update` when an
 * update has been paid and confirmed.
 */
import {
  blocksToSeconds,
  type FluxAppSpec,
  humanBlocks,
  MAX_EXPIRE_BLOCKS,
  TARGET_BLOCK_SEC,
} from '@shared/flux';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  Glyph,
  Progress,
  SegmentedControl,
  Select,
  Slider,
  TabPanel,
  Tabs,
} from '@/ui';
import { AdvancedForm } from './AdvancedForm';
import { useSimEnv } from './context';
import styles from './FluxcloudSim.module.css';
import {
  blankReview,
  currentRow,
  nextReviewAction,
  type ReviewAction,
  ROW_ORDER,
  reviewComplete,
  reviewReducer,
} from './flow';
import { dateOf, grouped, usd } from './format';
import {
  BackupTab,
  ControlTab,
  FileChangesTab,
  InformationTab,
  InstancesTab,
  LogsTab,
  MonitoringTab,
  ShellTab,
  SpecificationsTab,
} from './ManageTabs';
import {
  initialInstances,
  type LiveInstance,
  type LogScenario,
  MANAGE_TABS,
  type ManageTabId,
  NEWER_TABS,
  renewalChoices,
  type SampleApp,
  subscriptionView,
} from './manage';
import { type Draft, discountPercent, draftFromSpec } from './model';
import { Card, PageTitle, PriceFigure } from './Parts';
import { ReviewScreen, UpdateNotices } from './ReviewScreen';
import { meetsFreeUpdateRule, review, updateChanges } from './review';
import type { WhyKey } from './why';

export type ManageView = 'list' | 'page' | 'review' | 'confirmed' | 'cancelled';
export type SubAction = 'renewal' | 'update' | 'cancel';

export interface ManageLocation {
  path: string;
  why: WhyKey;
  view: ManageView;
}

interface Pending {
  kind: 'update' | 'renewal';
  spec: FluxAppSpec;
  enterprise: boolean;
  extension: number;
}

export interface ManageScreenProps {
  app: SampleApp;
  onApp: (a: SampleApp) => void;
  scenario: LogScenario;
  startView: 'list' | 'page';
  startTab: ManageTabId;
  startAction: SubAction;
  onLocation: (loc: ManageLocation) => void;
  onAllVisited: () => void;
  onConfirmed: (kind: 'update' | 'renewal') => void;
  /** The flow is the update flow: no My Applications list, and the tab strip is quieter. */
  focusUpdate?: boolean;
  /** Changes when "My Applications" is chosen in the menu: go back to the list. */
  listSignal?: number;
  /** "Show me" is running: the screen walks its own steps. */
  autopilot?: boolean;
  onAutopilotDone?: () => void;
}

const SUB_ACTIONS: { value: SubAction; label: string }[] = [
  { value: 'renewal', label: 'Renewal' },
  { value: 'update', label: 'Update' },
  { value: 'cancel', label: 'Cancel' },
];

export function ManageScreen({
  app,
  onApp,
  scenario,
  startView,
  startTab,
  startAction,
  onLocation,
  onAllVisited,
  onConfirmed,
  focusUpdate,
  listSignal,
  autopilot,
  onAutopilotDone,
}: ManageScreenProps) {
  const env = useSimEnv();
  const { params, fluxUsd, paramsSource, height, nowMs, account, announce, reducedMotion } = env;
  const [view, setView] = useState<ManageView>(startView);
  const [tab, setTab] = useState<ManageTabId>(startTab);
  const [visited, setVisited] = useState<ManageTabId[]>([startTab]);
  const [action, setAction] = useState<SubAction>(startAction);
  const [pending, setPending] = useState<Pending | null>(null);
  const [rv, dispatchReview] = useReducer(reviewReducer, undefined, blankReview);
  const [confirmedKind, setConfirmedKind] = useState<'update' | 'renewal'>('update');
  const [confirmedHard, setConfirmedHard] = useState(false);
  const [instances, setInstances] = useState<LiveInstance[]>(() => initialInstances(app.spec));
  const [selectedIp, setSelectedIp] = useState(() => instances[0]?.node.ip ?? '');
  const [monitoring, setMonitoring] = useState<'on' | 'off' | 'deleted'>('on');
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [ask, setAsk] = useState<{ title: string; body: string; confirm: string; go: () => void } | null>(
    null,
  );
  const reportedAll = useRef(false);
  /** How many times the solver went back to repair a failed review. */
  const recoveries = useRef(0);
  const [draft, setDraft] = useState<Draft>(() => draftFromSpec(app.spec, account, 'advanced'));
  // An update keeps the running name, owner and subscription length.
  const asUpdate: Draft = useMemo(
    () => ({ ...draft, spec: { ...draft.spec, name: app.spec.name, owner: app.spec.owner } }),
    [draft, app.spec.name, app.spec.owner],
  );

  const sub = subscriptionView(app, height, nowMs);
  const fluxMultiplier = params.fluxmultiplier;

  // The instances follow the running spec (an update can change how many copies there are).
  const specKey = `${app.spec.name}|${app.spec.instances}|${app.spec.geolocation.join(',')}`;
  const lastSpecKey = useRef(specKey);
  useEffect(() => {
    if (lastSpecKey.current === specKey) return;
    lastSpecKey.current = specKey;
    const next = initialInstances(app.spec);
    setInstances(next);
    setSelectedIp(next[0]?.node.ip ?? '');
  }, [specKey, app.spec]);

  // A confirmed update replaces the running spec: the editor starts again from it.
  const runKey = `${app.registeredHeight}|${app.spec.expire}`;
  const lastRun = useRef(runKey);
  useEffect(() => {
    if (lastRun.current === runKey) return;
    lastRun.current = runKey;
    setDraft(draftFromSpec(app.spec, account, 'advanced'));
  }, [runKey, app.spec, account]);

  const lastSignal = useRef(listSignal);
  useEffect(() => {
    if (lastSignal.current === listSignal) return;
    lastSignal.current = listSignal;
    if (!focusUpdate) {
      setView('list');
      setPending(null);
    }
  }, [listSignal, focusUpdate]);

  const visit = useCallback((id: ManageTabId) => {
    setTab(id);
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
  }, []);

  useEffect(() => {
    if (visited.length === MANAGE_TABS.length && !reportedAll.current) {
      reportedAll.current = true;
      onAllVisited();
    }
  }, [visited, onAllVisited]);

  // Tell the shell where we are, for the address strip and the annotation.
  useEffect(() => {
    let why: WhyKey;
    let path: string;
    switch (view) {
      case 'list':
        why = 'manage.list';
        path = '/apps/management';
        break;
      case 'review': {
        const row = currentRow(rv) ?? (rv.rows.validate === 'failed' ? 'validate' : 'payment');
        why =
          row === 'cost'
            ? pending?.kind === 'renewal'
              ? 'sub.renewal'
              : 'update.cost'
            : (`review.${row}` as WhyKey);
        path = `/apps/manage/${app.spec.name}`;
        break;
      }
      case 'confirmed':
        why = 'update.confirmed';
        path = `/apps/manage/${app.spec.name}`;
        break;
      case 'cancelled':
        why = 'cancel.done';
        path = `/apps/manage/${app.spec.name}`;
        break;
      default:
        why = tab === 'subscription' ? (`sub.${action}` as WhyKey) : (`tab.${tab}` as WhyKey);
        path = `/apps/manage/${app.spec.name}`;
    }
    onLocation({ path, why, view });
  }, [view, tab, action, pending, rv, app.spec.name, onLocation]);

  // ---- review result for the pending change ------------------------------------------------------
  const result = useMemo(() => {
    if (!pending) return null;
    return review(pending.spec, {
      params,
      fluxUsd,
      paramsSource,
      takenNames: [],
      currentHeight: height,
      nowMs,
      previous: { spec: app.spec, blocksRemaining: sub.blocksLeft },
      extension: pending.extension,
      enterprise: pending.enterprise,
    });
  }, [pending, params, fluxUsd, paramsSource, height, nowMs, app.spec, sub.blocksLeft]);

  // Pay finished: the update is on the chain.
  useEffect(() => {
    if (view !== 'review' || !pending || !result || !reviewComplete(rv)) return;
    const next: SampleApp = {
      spec: { ...pending.spec, expire: result.expireBlocks },
      registeredHeight: height,
    };
    setConfirmedHard(pending.kind === 'update' && updateChanges(app.spec, pending.spec).hard);
    onApp(next);
    setConfirmedKind(pending.kind);
    setView('confirmed');
    announce(
      pending.kind === 'update'
        ? 'Update registered. The simulated update is confirmed.'
        : 'Renewal registered. The subscription now runs longer.',
    );
    onConfirmed(pending.kind);
  }, [rv, view, pending, result, height, app.spec, onApp, onConfirmed, announce]);

  const startReview = useCallback((p: Pending) => {
    setPending(p);
    dispatchReview({ type: 'begin' });
    setView('review');
  }, []);

  const backFromReview = () => {
    setView('page');
    dispatchReview({ type: 'begin' });
    setPending(null);
  };

  // ---- the solver -------------------------------------------------------------------------------
  useEffect(() => {
    if (!autopilot) return;
    const wait = reducedMotion ? 60 : 650;
    const id = window.setTimeout(() => {
      if (focusUpdate) {
        if (view === 'confirmed') {
          onAutopilotDone?.();
          return;
        }
        if (view === 'page') {
          if (tab !== 'subscription') {
            visit('subscription');
            return;
          }
          if (action !== 'update') {
            setAction('update');
            return;
          }
          if (updateChanges(app.spec, asUpdate.spec).changed.length === 0) {
            const c = asUpdate.spec.compose[0];
            if (!c) return;
            const env2 = [
              ...c.environmentParameters.filter((e) => !e.startsWith('APP_MESSAGE=')),
              'APP_MESSAGE=updated',
            ];
            setDraft({
              ...asUpdate,
              spec: {
                ...asUpdate.spec,
                compose: asUpdate.spec.compose.map((x, i) =>
                  i === 0 ? { ...x, environmentParameters: env2 } : x,
                ),
              },
            });
            return;
          }
          startReview({ kind: 'update', spec: asUpdate.spec, enterprise: asUpdate.enterprise, extension: 0 });
          return;
        }
        if (view === 'review' && result) {
          if (rv.rows.validate === 'failed' || rv.rows.test === 'failed') {
            if (recoveries.current >= 2) {
              onAutopilotDone?.();
              return;
            }
            // What was there did not pass: start again from the running spec, with a change that does.
            recoveries.current += 1;
            dispatchReview({ type: 'toggleTestFail', on: false });
            setDraft(draftFromSpec(app.spec, account, 'advanced'));
            setView('page');
            dispatchReview({ type: 'begin' });
            setPending(null);
            return;
          }
          const r = ROW_ORDER.find((x) => rv.rows[x] === 'running');
          if (r === 'signature' || r === 'test' || r === 'payment') {
            const a = nextReviewAction(rv, account, result.valid, 'flux');
            if (a) dispatchReview(a);
          }
        }
        return;
      }
      // The manage flow: open the app, then visit every tab.
      if (view === 'list') {
        setView('page');
        return;
      }
      if (view === 'review' || view === 'confirmed') {
        // A renewal the learner started: back to the page, where the tabs are.
        setPending(null);
        dispatchReview({ type: 'begin' });
        setView('page');
        return;
      }
      if (view === 'cancelled') {
        onAutopilotDone?.();
        return;
      }
      const next = MANAGE_TABS.find((t) => !visited.includes(t.id));
      if (next) visit(next.id);
      else onAutopilotDone?.();
    }, wait);
    return () => window.clearTimeout(id);
  }, [
    autopilot,
    onAutopilotDone,
    startReview,
    visit,
    view,
    tab,
    action,
    visited,
    rv,
    asUpdate,
    app.spec,
    result,
    focusUpdate,
    reducedMotion,
    account,
  ]);

  // ---- views -------------------------------------------------------------------------------------

  if (view === 'list') {
    return (
      <ApplicationsList
        app={app}
        sub={sub}
        onManage={() => {
          setView('page');
          announce(`Manage page of ${app.spec.name}.`);
        }}
      />
    );
  }

  if (view === 'review' && pending && result) {
    const changes = pending.kind === 'update' ? updateChanges(app.spec, pending.spec) : null;
    const free = meetsFreeUpdateRule(app.spec, pending.spec, pending.extension);
    return (
      <ReviewScreen
        kind="update"
        result={result}
        review={rv}
        dispatch={(a: ReviewAction) => dispatchReview(a)}
        fluxMultiplier={fluxMultiplier}
        onBack={backFromReview}
        backLabel={pending.kind === 'update' ? 'Back to the spec' : 'Back to Subscription'}
        notices={
          changes ? (
            <UpdateNotices
              hardReasons={changes.hardReasons}
              resourcesIncreased={changes.resourcesIncreased}
            />
          ) : null
        }
        costNote={
          <div className={styles.rowStack}>
            {result.credit ? (
              <p className={styles.rowText}>
                Credit for the unused subscription: <strong>{usd(result.credit.creditUsd)}</strong> (
                {Math.round(result.credit.unusedFraction * 100)}% of the old subscription, which was worth{' '}
                {usd(result.credit.previousTotalUsd)}).
              </p>
            ) : null}
            <FreeUpdateNote meets={free} kind={pending.kind} />
          </div>
        }
      />
    );
  }

  if (view === 'confirmed') {
    return (
      <Confirmed
        kind={confirmedKind}
        app={app}
        height={height}
        nowMs={nowMs}
        hard={confirmedHard}
        onBack={() => {
          setPending(null);
          dispatchReview({ type: 'begin' });
          setView('page');
        }}
        focusUpdate={focusUpdate}
      />
    );
  }

  if (view === 'cancelled') {
    return (
      <div className={styles.page}>
        <PageTitle screenKey="cancelled">{app.spec.name}</PageTitle>
        <p className={styles.notice} data-tone="crit" role="status">
          Application cancelled (simulated). The network would remove it at once and its data would be lost.
          There is no refund.
        </p>
        <p className={styles.fineprint}>Reload the lesson step to start the simulation again.</p>
      </div>
    );
  }

  // ---- the Manage page --------------------------------------------------------------------------

  const tabItems = [
    ...MANAGE_TABS.map((t) => ({
      value: t.id,
      label: t.label,
      ...(visited.includes(t.id) ? { icon: 'check' as const } : {}),
    })),
    ...NEWER_TABS.map((l) => ({ value: `x-${l}`, label: l, disabled: true })),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <PageTitle screenKey="manage">{app.spec.name}</PageTitle>
          <p className={styles.pageSub}>
            <Chip size="sm" tone="accent">
              Active
            </Chip>{' '}
            <code className={styles.code}>{app.spec.name}.app.runonflux.io</code>
          </p>
        </div>
        <div className={styles.headActions}>
          <Select
            label="Backend"
            hideLabel
            value={selectedIp}
            onValueChange={setSelectedIp}
            options={instances.map((i) => ({
              value: i.node.ip,
              label: `${i.node.ip} (${i.node.countryName})`,
            }))}
          />
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => announce('Backend reloaded.')}>
            Reload
          </Button>
        </div>
      </div>
      <p className={styles.fineprint}>
        The backend selector picks which instance the local tabs (Logs, Monitoring, Control in Local mode)
        talk to.
      </p>

      {focusUpdate ? null : (
        <Progress
          variant="segments"
          label="Tabs visited"
          done={visited.length}
          total={MANAGE_TABS.length}
          valueText={`${visited.length} of ${MANAGE_TABS.length}`}
          showLabel
          showValue
          size="sm"
          tone={visited.length === MANAGE_TABS.length ? 'ok' : undefined}
        />
      )}

      <Tabs
        idBase="sim-manage"
        aria-label="Manage page"
        value={tab}
        onValueChange={(v) => visit(v as ManageTabId)}
        size="sm"
        items={tabItems}
      >
        <TabPanel value="specifications">
          <SpecificationsTab app={app} spec={app.spec} />
        </TabPanel>
        <TabPanel value="information">
          <InformationTab app={app} spec={app.spec} />
        </TabPanel>
        <TabPanel value="file-changes">
          <FileChangesTab />
        </TabPanel>
        <TabPanel value="monitoring">
          <MonitoringTab spec={app.spec} monitoring={monitoring} />
        </TabPanel>
        <TabPanel value="logs">
          <LogsTab spec={app.spec} scenario={scenario} nowMs={nowMs} announce={announce} />
        </TabPanel>
        <TabPanel value="secure-shell">
          <ShellTab spec={app.spec} />
        </TabPanel>
        <TabPanel value="control">
          <ControlTab
            spec={app.spec}
            instances={instances}
            setInstances={setInstances}
            selectedIp={selectedIp}
            monitoring={monitoring}
            setMonitoring={setMonitoring}
            log={actionLog}
            pushLog={(l) => setActionLog((a) => [...a, l])}
            announce={announce}
            ask={(title, body, confirm, go) => setAsk({ title, body, confirm, go })}
          />
        </TabPanel>
        <TabPanel value="backup">
          <BackupTab spec={app.spec} announce={announce} />
        </TabPanel>
        <TabPanel value="instances">
          <InstancesTab instances={instances} selectedIp={selectedIp} />
        </TabPanel>
        <TabPanel value="subscription">
          <SubscriptionTab
            // A confirmed update replaces the running spec: start the editors over.
            key={`${app.registeredHeight}|${app.spec.expire}`}
            app={app}
            sub={sub}
            action={action}
            onAction={setAction}
            fluxMultiplier={fluxMultiplier}
            onReview={startReview}
            asUpdate={asUpdate}
            setDraft={setDraft}
            onCancel={() =>
              setAsk({
                title: 'Cancel Application',
                body: 'No charge, and no refund. The app is removed from the network and its data is lost. "After expiration, your app is permanently removed from the Flux network. The same app cannot be restored - to use it again you will need to register a new app." Refunds are not automatic. If you believe you are entitled to a refund, you must open a support ticket to request one.',
                confirm: 'Cancel Application',
                go: () => {
                  setView('cancelled');
                  announce('Application cancelled in the simulation.');
                },
              })
            }
          />
        </TabPanel>
      </Tabs>

      <Dialog
        open={ask !== null}
        onClose={() => setAsk(null)}
        title={ask?.title ?? ''}
        size="sm"
        role="alertdialog"
        tone="crit"
        dismissOnScrim={false}
        footer={
          <>
            <Button variant="ghost" data-autofocus onClick={() => setAsk(null)}>
              Keep the app as it is
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const go = ask?.go;
                setAsk(null);
                go?.();
              }}
            >
              {ask?.confirm}
            </Button>
          </>
        }
      >
        <p>{ask?.body}</p>
        <p className={styles.fineprint}>Simulation: nothing is signed and nothing leaves this page.</p>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// My Applications
// ---------------------------------------------------------------------------

function ApplicationsList({
  app,
  sub,
  onManage,
}: {
  app: SampleApp;
  sub: ReturnType<typeof subscriptionView>;
  onManage: () => void;
}) {
  const [tab, setTab] = useState<'active' | 'expired'>('active');
  const spec = app.spec;
  const totals = spec.compose.reduce(
    (t, c) => ({ cpu: t.cpu + c.cpu, ram: t.ram + c.ram, hdd: t.hdd + c.hdd }),
    { cpu: 0, ram: 0, hdd: 0 },
  );
  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <PageTitle screenKey="apps">My Applications</PageTitle>
          <p className={styles.pageSub}>Apps registered by this account.</p>
        </div>
      </div>
      <Tabs
        idBase="sim-apps"
        aria-label="My applications"
        value={tab}
        onValueChange={(v) => setTab(v as 'active' | 'expired')}
        size="sm"
        items={[
          { value: 'active', label: 'My Active Apps', count: 1 },
          { value: 'expired', label: 'My Expired Apps', count: 0 },
        ]}
      >
        <TabPanel value="active">
          <article className={styles.appRow}>
            <dl className={styles.appFields}>
              <div>
                <dt>App Name</dt>
                <dd>
                  <strong>{spec.name}</strong>
                </dd>
              </div>
              <div>
                <dt>Expiry Date</dt>
                <dd>{dateOf(sub.untilMs)}</dd>
              </div>
              <div>
                <dt>App Specification</dt>
                <dd>
                  {Number(totals.cpu.toFixed(2))} CPU cores, {totals.ram} RAM MB, {totals.hdd} Storage GB,{' '}
                  {spec.instances} {spec.instances === 1 ? 'Instance' : 'Instances'}
                </dd>
              </div>
            </dl>
            <div className={styles.appActions}>
              <Button variant="primary" icon="arrow-right" onClick={onManage}>
                Manage
              </Button>
              <Button
                variant="secondary"
                icon="external"
                aria-disabled="true"
                title="Opens the app's own address in FluxCloud. Not part of this simulation."
                onClick={() => undefined}
              >
                Visit
              </Button>
            </div>
          </article>
        </TabPanel>
        <TabPanel value="expired">
          <p className={styles.fineprint}>
            No expired apps. An expired app is gone from the network; Redeploy opens the Register screen
            pre-filled and is paid for like a new registration.
          </p>
        </TabPanel>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

function FreeUpdateNote({ meets, kind }: { meets: boolean; kind: 'update' | 'renewal' }) {
  if (kind === 'renewal') return null;
  return (
    <div className={styles.freeNote}>
      <p className={styles.noticeTitle}>
        <Chip size="sm">Not modelled</Chip> Free update
      </p>
      <p className={styles.fineprint}>
        FluxCloud shows "Free update" and charges nothing when an update keeps the instances, the static IP
        and the number of nodes, raises no component's CPU, RAM or disk, adds no priced port and extends the
        subscription by no more than 8 blocks. The simulator does not apply that rule: it shows what the price
        formula gives.
        {meets ? ' This change meets the rule, so FluxCloud would show it as a free update.' : ''}
      </p>
    </div>
  );
}

function SubscriptionTab({
  app,
  sub,
  action,
  onAction,
  fluxMultiplier,
  onReview,
  onCancel,
  asUpdate,
  setDraft,
}: {
  app: SampleApp;
  sub: ReturnType<typeof subscriptionView>;
  action: SubAction;
  onAction: (a: SubAction) => void;
  fluxMultiplier: number;
  onReview: (p: Pending) => void;
  onCancel: () => void;
  asUpdate: Draft;
  setDraft: (d: Draft) => void;
}) {
  const { params, fluxUsd, paramsSource, height, nowMs, account } = useSimEnv();
  const choices = useMemo(() => renewalChoices(sub.blocksLeft), [sub.blocksLeft]);
  const [pick, setPick] = useState(Math.min(2, Math.max(0, choices.length - 1)));
  const chosen = choices[Math.min(pick, choices.length - 1)];
  const extension = chosen?.blocks ?? 0;

  const renewalResult = useMemo(
    () =>
      review(app.spec, {
        params,
        fluxUsd,
        paramsSource,
        takenNames: [],
        currentHeight: height,
        nowMs,
        previous: { spec: app.spec, blocksRemaining: sub.blocksLeft },
        extension,
      }),
    [app.spec, params, fluxUsd, paramsSource, height, nowMs, sub.blocksLeft, extension],
  );
  const updateResult = useMemo(
    () =>
      review(asUpdate.spec, {
        params,
        fluxUsd,
        paramsSource,
        takenNames: [],
        currentHeight: height,
        nowMs,
        previous: { spec: app.spec, blocksRemaining: sub.blocksLeft },
        extension: 0,
        enterprise: asUpdate.enterprise,
      }),
    [asUpdate, app.spec, params, fluxUsd, paramsSource, height, nowMs, sub.blocksLeft],
  );
  const changes = useMemo(() => updateChanges(app.spec, asUpdate.spec), [app.spec, asUpdate.spec]);
  const afterMs = nowMs + blocksToSeconds(sub.blocksLeft + extension) * 1000;

  return (
    <div className={styles.tabStack}>
      <div className={styles.subHead}>
        <SegmentedControl
          aria-label="Management Action"
          size="sm"
          value={action}
          onValueChange={(v) => onAction(v as SubAction)}
          options={SUB_ACTIONS}
        />
      </div>

      <dl className={styles.kv}>
        <div>
          <dt>Current subscription until:</dt>
          <dd>
            {dateOf(sub.untilMs)} <span className={styles.fineprint}>block {grouped(sub.endHeight)}</span>
          </dd>
        </div>
        <div>
          <dt>Time left:</dt>
          <dd>{humanBlocks(sub.blocksLeft)}</dd>
        </div>
        {action === 'renewal' && chosen ? (
          <div>
            <dt>After renewal subscription until:</dt>
            <dd>{dateOf(afterMs)}</dd>
          </div>
        ) : null}
      </dl>
      {sub.underWeek ? (
        <p className={styles.notice} data-tone="warn">
          Expires in under a week. Renewal subscription to update.
        </p>
      ) : null}

      {action === 'renewal' ? (
        choices.length === 0 ? (
          <p className={styles.notice}>
            Maximum subscription duration is 1 year. Renewal options are adjusted based on your current
            remaining time, and there is no room left to add.
          </p>
        ) : (
          <>
            <Slider
              label="Renewal"
              min={0}
              max={choices.length - 1}
              step={1}
              value={Math.min(pick, choices.length - 1)}
              format={(i) => {
                const p = choices[i];
                if (!p) return '';
                const d = discountPercent(p.blocks);
                return `${p.longLabel}${d ? ` (${d}% off)` : ''}`;
              }}
              onValueChange={setPick}
            />
            <div className={styles.arith}>
              <p>
                <code className={styles.code}>{grouped(sub.blocksLeft)}</code> blocks left{' '}
                <span aria-hidden="true">+</span> <code className={styles.code}>{grouped(extension)}</code>{' '}
                added <span aria-hidden="true">=</span>{' '}
                <code className={styles.code}>{grouped(sub.blocksLeft + extension)}</code> blocks
              </p>
              <p className={styles.fineprint}>
                One block is {TARGET_BLOCK_SEC} seconds and one month is 88,000 blocks. The total may not pass{' '}
                {grouped(MAX_EXPIRE_BLOCKS)} blocks (one year): {grouped(MAX_EXPIRE_BLOCKS - sub.blocksLeft)}{' '}
                blocks of room are left.
              </p>
            </div>
            <PriceFigure
              quote={renewalResult.quote}
              paramsSource={paramsSource}
              fluxMultiplier={fluxMultiplier}
            />
            {renewalResult.credit ? (
              <p className={styles.fineprint}>
                The unused part of the old subscription is credited ({usd(renewalResult.credit.creditUsd)}),
                so you pay for the time you add.
              </p>
            ) : null}
            <div>
              <Button
                variant="primary"
                onClick={() => onReview({ kind: 'renewal', spec: app.spec, enterprise: false, extension })}
              >
                Renew
              </Button>
            </div>
          </>
        )
      ) : null}

      {action === 'update' ? (
        <>
          {changes.changed.length > 0 ? (
            <p className={styles.fineprint}>You changed: {changes.changed.join(', ')}.</p>
          ) : (
            <p className={styles.fineprint}>Nothing changed yet. Edit a field below, then Review.</p>
          )}
          <AdvancedForm
            draft={asUpdate}
            onChange={setDraft}
            walletAccount={account === 'wallet'}
            update
            result={updateResult}
            paramsSource={paramsSource}
            fluxMultiplier={fluxMultiplier}
            mode="advanced"
            reviewLabel="Review"
            costSlot={
              <Card title="What an update costs" span="full">
                <PriceFigure
                  quote={updateResult.quote}
                  paramsSource={paramsSource}
                  fluxMultiplier={fluxMultiplier}
                />
                {updateResult.credit ? (
                  <p className={styles.rowText}>
                    The old subscription was worth {usd(updateResult.credit.previousTotalUsd)}. About{' '}
                    {Math.round(updateResult.credit.unusedFraction * 100)}% of it is unused, so{' '}
                    <strong>{usd(updateResult.credit.creditUsd)}</strong> is credited against the new spec for
                    the time that is left.
                  </p>
                ) : null}
                <FreeUpdateNote
                  meets={changes.changed.length > 0 && meetsFreeUpdateRule(app.spec, asUpdate.spec, 0)}
                  kind="update"
                />
              </Card>
            }
            onReview={() =>
              onReview({ kind: 'update', spec: asUpdate.spec, enterprise: asUpdate.enterprise, extension: 0 })
            }
          />
        </>
      ) : null}

      {action === 'cancel' ? (
        <div className={styles.tabStack}>
          <p className={styles.rowText}>
            Cancelling ends the app now. There is no charge and no refund, the app is removed from the network
            and its data is lost.
          </p>
          <p className={styles.fineprint}>
            Refunds are not automatic. If you believe you are entitled to a refund, you must open a support
            ticket to request one.
          </p>
          <div>
            <Button variant="danger" icon="trash" onClick={onCancel}>
              Cancel Subscription
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

function Confirmed({
  kind,
  app,
  height,
  nowMs,
  hard,
  onBack,
  focusUpdate,
}: {
  kind: 'update' | 'renewal';
  app: SampleApp;
  height: number;
  nowMs: number;
  hard: boolean;
  onBack: () => void;
  focusUpdate?: boolean;
}) {
  const sub = subscriptionView(app, height, nowMs);
  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <PageTitle screenKey={`confirmed-${kind}`}>
            {kind === 'update' ? 'Update registered' : 'Renewal registered'}
          </PageTitle>
          <p className={styles.pageSub}>Simulated: the message was not signed and nothing was paid.</p>
        </div>
        <Button variant="secondary" icon="arrow-left" onClick={onBack}>
          Back to Manage
        </Button>
      </div>
      <ol className={styles.timeline}>
        <li className={styles.event} data-kind="paid">
          <span className={styles.eventMark} aria-hidden="true">
            <Glyph name="check" size={14} />
          </span>
          <div>
            <p className={styles.eventHead}>
              <strong>The {kind} message is signed and paid</strong>
            </p>
            <p className={styles.eventText}>
              It is the same message type for both: an update to the registered app.
            </p>
          </div>
        </li>
        <li className={styles.event} data-kind="block">
          <span className={styles.eventMark} aria-hidden="true">
            <Glyph name="block" size={14} />
          </span>
          <div>
            <p className={styles.eventHead}>
              <strong>Mined into a block, about {TARGET_BLOCK_SEC} seconds later</strong>
            </p>
            <p className={styles.eventText}>
              The subscription now counts from that block: {humanBlocks(app.spec.expire)}, until about{' '}
              {dateOf(sub.untilMs)}.
            </p>
          </div>
        </li>
        {kind === 'update' ? (
          <li className={styles.event} data-kind="running">
            <span className={styles.eventMark} aria-hidden="true">
              <Glyph name={hard ? 'warning' : 'status-ok'} size={14} />
            </span>
            <div>
              <p className={styles.eventHead}>
                <strong>
                  {hard ? 'Nodes apply it as a hard redeploy' : 'Nodes apply it as a soft redeploy'}
                </strong>
              </p>
              <p className={styles.eventText}>
                {hard
                  ? 'The containers are removed and recreated, and their data is deleted.'
                  : 'The containers are recreated and the volumes are kept.'}
              </p>
            </div>
          </li>
        ) : null}
      </ol>
      {focusUpdate ? (
        <p className={styles.notice} role="status">
          That is the last step of the update. The flow is complete.
        </p>
      ) : null}
    </div>
  );
}
