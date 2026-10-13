/**
 * Widget `orbit-planner` (docs/CONTENT.md section 5): the Orbit plans as sizes priced by the formula, the
 * spec Orbit registers for each, and the Deploy to Flux button builder with live validation. The rules are in
 * `logic.ts` (pure, tested); every price comes from `orbitPlanQuoteUsd` and every link from `deployToFluxUrl`.
 *
 * Props (`stage.props`):
 *   view   'plans' (default) or 'button': which half the step is about
 *   plan   the card selected first in the plans view: 'starter' | 'standard' | 'pro' | 'custom'
 *   goal   what finishes the step. Either
 *            { kind: 'custom', minInstances: 2, cheaperThan: 'standard' }   a Custom size, priced by the formula
 *            { kind: 'url', expected: { repo, branch?, projectPath?, plan? } }  the same link as `expected`
 *          Without a goal the widget is an exploration and reports done on the first change.
 *   draft  the starting values of the button builder { repo, branch, projectPath, plan }: a lesson plants
 *          its mistakes here
 *
 * Emits `widget-done` when the goal is met after the learner has changed something, and a `custom` event
 * named `attempt` when a change misses the goal (the first attempt offers "Show me"). Registers a solver for
 * "Show me". Nothing here touches the network: the page the link opens is the real one, and the widget says
 * so; the plan table is baked data read on `ORBIT_READ_ON` and says BAKED.
 */

import { ORBIT_CUSTOM, ORBIT_READ_ON } from '@shared/flux';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { GRIDS, GridSlider } from '@/forge/controls/GridSlider';
import type { StageHost, WidgetComponent } from '@/learn/stage-api';
import { Chip, CodeBlock, FreshnessChip, Glyph, LinkButton, Panel, Select, TextField } from '@/ui';
import {
  agreement,
  atSize,
  BUTTON_PLAN_VALUES,
  type ButtonDraft,
  type ButtonField,
  buttonMatches,
  customGoalMet,
  differsFrom,
  draftOf,
  evaluateButton,
  excerptOf,
  factsOf,
  type Goal,
  PLAN_KEYS,
  type PlanKey,
  type PlannerProps,
  planOf,
  priceOf,
  quoteOf,
  RATES_DATE,
  readProps,
  type Size,
  STANDARD_PLAN,
  sizeOf,
  solveCustom,
} from './logic';
import styles from './OrbitPlanner.module.css';

// ---------------------------------------------------------------------------
// Words and small formatters
// ---------------------------------------------------------------------------

const usd = (n: number): string => `$${n.toFixed(2)}`;
const signed = (n: number): string => `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(2)}`;
const vcoresLabel = (v: number): string => `${v} ${v === 1 ? 'vCore' : 'vCores'}`;
const ramLabel = (mb: number): string => `${mb} MB`;
const diskLabel = (gb: number): string => `${gb} GB`;
const instancesLabel = (n: number): string => `${n} ${n === 1 ? 'instance' : 'instances'}`;

const PLAN_NAME: Record<PlanKey, string> = {
  starter: 'Starter',
  standard: 'Standard',
  pro: 'Pro',
  custom: 'Custom',
};

/** A pause before a change that missed the goal counts as an attempt, so typing is not a run of attempts. */
const ATTEMPT_PAUSE_MS = 1200;

// ---------------------------------------------------------------------------
// The goal line, shared by both views
// ---------------------------------------------------------------------------

function GoalLine({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <p className={styles.goal} data-met={met ? 'true' : 'false'}>
      <Chip kind="status" status={met ? 'ok' : 'pending'} size="sm">
        {met ? 'Goal met' : 'Goal not met'}
      </Chip>
      <span className={styles.goalText}>{children}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// The plans
// ---------------------------------------------------------------------------

function customGoalText(goal: Extract<Goal, { kind: 'custom' }>): string {
  const ceiling = planOf(goal.cheaperThan);
  const name = ceiling ? ceiling.name : goal.cheaperThan;
  return `Goal: a Custom size with ${goal.minInstances} or more instances that the formula prices below ${name} (${ceiling ? usd(priceOf(ceiling)) : ''}).`;
}

function PlansView({ props, host }: { props: PlannerProps; host: StageHost }) {
  const uid = useId();
  const goal = props.goal?.kind === 'custom' ? props.goal : null;

  const [selected, setSelected] = useState<PlanKey>(props.plan);
  const [custom, setCustom] = useState<Size>(() => sizeOf(planOf(props.plan) ?? STANDARD_PLAN));
  const [customTouched, setCustomTouched] = useState(false);
  const [touched, setTouched] = useState(false);

  const plan = planOf(selected);
  const size: Size = plan ? sizeOf(plan) : custom;
  const shown = plan ?? atSize(STANDARD_PLAN, custom);
  const price = priceOf(shown);
  const quote = useMemo(() => quoteOf(shown), [shown]);
  const facts = factsOf(selected, size);
  const excerpt = useMemo(() => excerptOf(shown), [shown]);

  const met = goal ? selected === 'custom' && customGoalMet(goal, custom) : touched;

  // ---- the goal is reported once, after the learner acted --------------------------------------------------
  const reported = useRef(false);
  useEffect(() => {
    if (!touched || !met || reported.current) return;
    reported.current = true;
    host.emit({ type: 'widget-done' });
  }, [touched, met, host]);

  // ---- a Custom size that misses the goal is an attempt, once per size, after a pause -----------------------
  const lastAttempt = useRef('');
  useEffect(() => {
    if (!goal || !customTouched || selected !== 'custom' || met) return;
    const key = `${custom.vcores}|${custom.ramMb}|${custom.storageGb}|${custom.instances}`;
    const id = window.setTimeout(() => {
      if (lastAttempt.current === key) return;
      lastAttempt.current = key;
      host.emit({ type: 'custom', name: 'attempt' });
    }, ATTEMPT_PAUSE_MS);
    return () => window.clearTimeout(id);
  }, [goal, customTouched, selected, met, custom, host]);

  // ---- "Show me": a Custom size that meets the goal, from where the learner stands -------------------------
  const latest = useRef({ goal, custom, selected });
  latest.current = { goal, custom, selected };
  useEffect(() => {
    host.registerSolver(() => {
      const { goal: g, custom: c, selected: s } = latest.current;
      const from = s === 'custom' ? c : sizeOf(STANDARD_PLAN);
      const solved = g ? (solveCustom(g, from) ?? solveCustom(g, sizeOf(STANDARD_PLAN))) : null;
      setSelected('custom');
      if (solved) setCustom(solved);
      setCustomTouched(true);
      setTouched(true);
    });
    return () => host.registerSolver(null);
  }, [host]);

  const choose = (key: PlanKey) => {
    setSelected(key);
    setTouched(true);
    // Custom starts from the plan the learner was looking at, until they move a slider of their own.
    if (key === 'custom' && !customTouched) {
      const from = planOf(selected);
      if (from) setCustom(sizeOf(from));
    }
  };

  const setSizePart = (part: Partial<Size>) => {
    setCustom((c) => ({ ...c, ...part }));
    setCustomTouched(true);
    setTouched(true);
  };

  const same = plan ? agreement(plan) : null;
  const runningRows = useMemo(() => {
    let running = 0;
    return quote.lines.map((line) => {
      running += line.usd;
      return { line, running: Math.round(running * 1e6) / 1e6 };
    });
  }, [quote]);

  const cardMeta = (key: PlanKey): string => {
    const p = planOf(key);
    return p
      ? instancesLabel(p.instances)
      : `${ORBIT_CUSTOM.instancesMin} to ${ORBIT_CUSTOM.instancesMax} instances`;
  };
  const cardPrice = (key: PlanKey): string => {
    const p = planOf(key);
    return p ? usd(priceOf(p)) : `from ${usd(ORBIT_CUSTOM.fromUsd)}`;
  };

  return (
    <Panel variant="glass" padding="md" container className={styles.root} contentClassName={styles.content}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Orbit plans</p>
        <div className={styles.chips}>
          <FreshnessChip kind="baked" />
        </div>
      </div>
      <p className={styles.basis}>
        Plan table: the Orbit page as read on {ORBIT_READ_ON}. Prices: the formula at the rates read on{' '}
        {RATES_DATE}. These are prices for a plain spec: the page says private repositories and secret
        variables are deployed encrypted, which the formula prices higher, and the page does not say how Orbit
        prices that.
      </p>

      {goal ? (
        <GoalLine met={met}>
          {customGoalText(goal)}{' '}
          {selected === 'custom'
            ? `Now ${instancesLabel(custom.instances)} at ${usd(price)}.`
            : 'Choose Custom and move the sliders.'}
        </GoalLine>
      ) : null}

      <fieldset className={styles.cards}>
        <legend className="sr-only">Plan</legend>
        {PLAN_KEYS.map((key) => (
          <label key={key} className={styles.card} data-selected={selected === key ? 'true' : undefined}>
            <input
              type="radio"
              name={`${uid}-plan`}
              value={key}
              checked={selected === key}
              onChange={() => choose(key)}
            />
            <span className={styles.cardName}>{PLAN_NAME[key]}</span>
            {selected === key ? (
              <span className={styles.cardMark} aria-hidden="true">
                <Glyph name="check" size={14} />
              </span>
            ) : null}
            <span className={styles.cardPrice}>{cardPrice(key)}</span>
            <span className={styles.cardMeta}>{cardMeta(key)}</span>
          </label>
        ))}
      </fieldset>

      <section className={styles.detail} aria-label={`${PLAN_NAME[selected]}: size and price`}>
        {plan ? (
          <dl className={styles.size}>
            <div>
              <dt>CPU</dt>
              <dd>{vcoresLabel(size.vcores)}</dd>
            </div>
            <div>
              <dt>RAM</dt>
              <dd>{ramLabel(size.ramMb)}</dd>
            </div>
            <div>
              <dt>Disk</dt>
              <dd>{diskLabel(size.storageGb)}</dd>
            </div>
            <div>
              <dt>Instances</dt>
              <dd>{size.instances}</dd>
            </div>
          </dl>
        ) : (
          <div className={styles.sliders}>
            <SizeSlider
              label="CPU"
              value={vcoresLabel(custom.vcores)}
              slider={
                <GridSlider
                  label="CPU in vCores"
                  value={custom.vcores}
                  stops={GRIDS.cpu}
                  min={ORBIT_CUSTOM.vcoresMin}
                  max={ORBIT_CUSTOM.vcoresMax}
                  format={vcoresLabel}
                  onChange={(v) => setSizePart({ vcores: v })}
                />
              }
            />
            <SizeSlider
              label="RAM"
              value={ramLabel(custom.ramMb)}
              slider={
                <GridSlider
                  label="RAM in megabytes"
                  value={custom.ramMb}
                  stops={GRIDS.ram}
                  max={ORBIT_CUSTOM.ramMbMax}
                  format={ramLabel}
                  onChange={(v) => setSizePart({ ramMb: v })}
                />
              }
            />
            <SizeSlider
              label="Disk"
              value={diskLabel(custom.storageGb)}
              slider={
                <GridSlider
                  label="Disk in gigabytes"
                  value={custom.storageGb}
                  stops={GRIDS.hdd}
                  min={ORBIT_CUSTOM.storageGbMin}
                  max={ORBIT_CUSTOM.storageGbMax}
                  format={diskLabel}
                  onChange={(v) => setSizePart({ storageGb: v })}
                />
              }
            />
            <SizeSlider
              label="Instances"
              value={String(custom.instances)}
              slider={
                <GridSlider
                  label="Instances"
                  value={custom.instances}
                  stops={GRIDS.instances}
                  min={ORBIT_CUSTOM.instancesMin}
                  max={ORBIT_CUSTOM.instancesMax}
                  format={String}
                  onChange={(v) => setSizePart({ instances: v })}
                />
              }
            />
            <p className={styles.note}>
              The page states {ORBIT_CUSTOM.vcoresMin} to {ORBIT_CUSTOM.vcoresMax} vCores, up to{' '}
              {ORBIT_CUSTOM.ramMbMax} MB of RAM, {ORBIT_CUSTOM.storageGbMin} to {ORBIT_CUSTOM.storageGbMax} GB
              of disk and {ORBIT_CUSTOM.instancesMin} to {ORBIT_CUSTOM.instancesMax} instances for Custom.
            </p>
          </div>
        )}

        <div className={styles.priceRow}>
          <p className={styles.price} aria-live="polite">
            <span className={styles.priceFigure} data-testid="formula-price">
              {usd(price)}
            </span>
            <span className={styles.priceUnit}>per month by the formula</span>
          </p>
          {same ? (
            <p className={styles.page}>
              The plan page says {usd(same.published)}.{' '}
              <Chip kind="status" status={same.same ? 'ok' : 'warn'} size="sm">
                {same.same ? 'Same number' : 'Differs'}
              </Chip>
            </p>
          ) : (
            <p className={styles.page}>
              The page says "from {usd(ORBIT_CUSTOM.fromUsd)}" and states no price for a size. This is the
              formula's number, not a quote from Orbit: read the price its checkout shows.
            </p>
          )}
        </div>

        <ul className={styles.facts} aria-label="What this size means">
          <li>
            <span className={styles.factMark}>
              <Glyph name={facts.survivesNodeLoss ? 'status-ok' : 'status-warn'} size={16} />
            </span>
            <span>
              <strong>Node restarts.</strong> {facts.failover}
            </span>
          </li>
          <li>
            <span className={styles.factMark}>
              <Glyph name={facts.persistentFolders.startsWith('Yes') ? 'check' : 'minus'} size={16} />
            </span>
            <span>
              <strong>Persistent folders.</strong> {facts.persistentFolders}
            </span>
          </li>
          <li>
            <span className={styles.factMark}>
              <Glyph name={facts.secondPort.startsWith('Yes') ? 'check' : 'minus'} size={16} />
            </span>
            <span>
              <strong>Second app port.</strong> {facts.secondPort}
            </span>
          </li>
        </ul>

        <div className={styles.lines}>
          <h3 className={styles.subhead}>How the formula gets there</h3>
          <ol aria-label="Lines of the price">
            {runningRows.map(({ line, running }) => (
              <li key={`${line.id}:${line.component ?? ''}:${line.label}`}>
                <span className={styles.lineLabel}>{line.label}</span>
                <span className={styles.lineAmount} data-neg={line.usd < 0 ? 'true' : undefined}>
                  {signed(line.usd)}
                </span>
                <span className={styles.lineTotal}>{usd(running)}</span>
                {line.note ? <span className={styles.lineNote}>{line.note}</span> : null}
              </li>
            ))}
          </ol>
        </div>

        <details className={styles.spec}>
          <summary>The spec Orbit registers for this size</summary>
          <CodeBlock code={excerpt} lang="json" filename="spec (excerpt)" label="Spec excerpt" wrap />
          <p className={styles.note}>
            The owner, the repository and the public ports are placeholders; the rest follows the shape of
            live Orbit specs read on {ORBIT_READ_ON}. An ordinary version 8 spec: the image is what makes it
            an Orbit app.
          </p>
        </details>
      </section>
    </Panel>
  );
}

function SizeSlider({ label, value, slider }: { label: string; value: string; slider: ReactNode }) {
  return (
    <div className={styles.slideRow}>
      <div className={styles.slideHead}>
        <span className={styles.slideLabel}>{label}</span>
        <output className={styles.slideValue}>{value}</output>
      </div>
      {slider}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The button
// ---------------------------------------------------------------------------

const FIELD_LABEL: Record<ButtonField, string> = {
  repo: 'Repository URL',
  branch: 'Branch',
  projectPath: 'Project path',
  plan: 'Plan',
};

function goalText(expected: { repo: string; branch?: string; projectPath?: string; plan?: string }): string {
  const parts = [`the repository ${expected.repo}`];
  if (expected.branch) parts.push(`branch ${expected.branch}`);
  if (expected.projectPath) parts.push(`folder ${expected.projectPath}`);
  if (expected.plan) parts.push(`plan ${expected.plan}`);
  return `Goal: a link for ${parts.join(', ')}.`;
}

function ButtonView({ props, host }: { props: PlannerProps; host: StageHost }) {
  const goal = props.goal?.kind === 'url' ? props.goal : null;
  const [draft, setDraft] = useState<ButtonDraft>(props.draft);
  const [touched, setTouched] = useState(false);

  const ev = useMemo(() => evaluateButton(draft), [draft]);
  const met = goal ? ev.ok && buttonMatches(draft, goal.expected) : ev.ok && touched;
  const refused = Object.keys(ev.errors).length;

  const reported = useRef(false);
  useEffect(() => {
    if (!touched || !met || reported.current) return;
    reported.current = true;
    host.emit({ type: 'widget-done' });
  }, [touched, met, host]);

  // A draft the learner has settled on that misses the goal is an attempt, once per distinct draft.
  const lastAttempt = useRef('');
  useEffect(() => {
    if (!goal || !touched || met) return;
    const key = `${draft.repo}|${draft.branch}|${draft.projectPath}|${draft.plan}`;
    const id = window.setTimeout(() => {
      if (lastAttempt.current === key) return;
      lastAttempt.current = key;
      host.emit({ type: 'custom', name: 'attempt' });
    }, ATTEMPT_PAUSE_MS);
    return () => window.clearTimeout(id);
  }, [goal, touched, met, draft, host]);

  const goalRef = useRef(goal);
  goalRef.current = goal;
  useEffect(() => {
    host.registerSolver(() => {
      const g = goalRef.current;
      if (g) setDraft(draftOf(g.expected));
      setTouched(true);
    });
    return () => host.registerSolver(null);
  }, [host]);

  const patch = (field: ButtonField, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setTouched(true);
  };

  const planOptions = [
    { value: '', label: 'Orbit default (leave it out)' },
    ...BUTTON_PLAN_VALUES.map((v) => ({
      value: v,
      label: v === 'free' ? 'free (older buttons)' : v,
    })),
  ];

  const planError = ev.errors.plan
    ? draft.plan === 'free'
      ? `${ev.errors.plan} The page opens Starter for an older button that says free; write starter in a new one.`
      : ev.errors.plan
    : undefined;

  const missed = goal && ev.ok && !met ? differsFrom(draft, goal.expected) : null;

  return (
    <Panel variant="glass" padding="md" container className={styles.root} contentClassName={styles.content}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Deploy to Flux button</p>
        <div className={styles.chips}>
          <FreshnessChip kind="baked" />
          <Chip size="sm" tone="accent">
            Format read {ORBIT_READ_ON}
          </Chip>
        </div>
      </div>

      {goal ? (
        <GoalLine met={met}>
          {goalText(goal.expected)}{' '}
          {met
            ? 'The link below is that one.'
            : missed
              ? `This one is accepted, but it differs in ${missed}.`
              : ev.ok
                ? ''
                : `${refused} ${refused === 1 ? 'value is' : 'values are'} refused.`}
        </GoalLine>
      ) : null}

      <div className={styles.form}>
        <TextField
          label={FIELD_LABEL.repo}
          mono
          value={draft.repo}
          onValueChange={(v) => patch('repo', v)}
          error={ev.errors.repo}
          hint="A full https URL. A trailing .git is optional."
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <div className={styles.pair}>
          <TextField
            label={FIELD_LABEL.branch}
            mono
            value={draft.branch}
            onValueChange={(v) => patch('branch', v)}
            error={ev.errors.branch}
            hint="Optional."
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <TextField
            label={FIELD_LABEL.projectPath}
            mono
            value={draft.projectPath}
            onValueChange={(v) => patch('projectPath', v)}
            error={ev.errors.projectPath}
            hint="Optional. A folder of a monorepo."
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <Select
          label={FIELD_LABEL.plan}
          options={planOptions}
          value={draft.plan}
          onValueChange={(v) => patch('plan', v)}
          error={planError}
          hint="Optional. Custom sizes are set in the dashboard after the deploy."
        />
      </div>

      <section className={styles.result} aria-label="The link" aria-live="polite">
        <p className={styles.verdict} data-ok={ev.ok ? 'true' : 'false'}>
          <span className={styles.verdictMark}>
            <Glyph name={ev.ok ? 'status-ok' : 'status-crit'} size={18} />
          </span>
          <span>
            {ev.ok
              ? "Accepted by the Academy's checks. This is the link the button would carry."
              : `${refused} ${refused === 1 ? 'value is' : 'values are'} refused. Fix them and the link appears here.`}
          </span>
        </p>
        {ev.url ? (
          <>
            <CodeBlock code={ev.url} lang="text" filename="button link" label="Button link" wrap copy />
            <CodeBlock
              code={ev.markdown ?? ''}
              lang="text"
              filename="README.md"
              label="README badge"
              wrap
              copy
            />
            <LinkButton href={ev.url} variant="secondary" size="sm" icon="external" newTab>
              Open it on runonflux.com
            </LinkButton>
          </>
        ) : null}
      </section>

      <p className={styles.note}>
        <span className={styles.noteMark}>
          <Glyph name="info" size={14} />
        </span>
        <span>
          The link opens the deployment wizard with these fields filled in. It does not deploy anything by
          itself: you finish the deployment in Orbit. The checks on these fields are the Academy's: Orbit
          publishes the format, not a list of refused values.
        </span>
      </p>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// The widget
// ---------------------------------------------------------------------------

const OrbitPlanner: WidgetComponent = ({ stage, host, stepKey }) => {
  // The props object may be a new identity on every render; its content is what matters.
  const propsKey = JSON.stringify(stage.props ?? {});
  const props = useMemo(() => readProps(JSON.parse(propsKey) as Record<string, unknown>), [propsKey]);
  // A new step, or a new set of props, starts from a clean widget: nothing reported for one may reach the next.
  const key = `${stepKey}|${propsKey}`;
  return props.view === 'button' ? (
    <ButtonView key={key} props={props} host={host} />
  ) : (
    <PlansView key={key} props={props} host={host} />
  );
};

export default OrbitPlanner;
