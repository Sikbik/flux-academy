/**
 * The choices that set a session up: a scenario, an approval policy and, for Orbit, a plan. Each is a native
 * radio group (arrow keys move, a screen reader announces "1 of 4"), drawn as cards. The radio itself covers
 * its card, so the whole card is the target and the focus ring is the card's own.
 *
 * Used by the lab on its set-up rail and by the lesson widget when a lesson leaves the policy open.
 */

import type { OrbitPlanId } from '@shared/flux';
import { useId, useMemo } from 'react';
import { Chip, FreshnessChip, Glyph } from '@/ui';
import styles from './AgentSession.module.css';
import { POLICIES } from './engine/policy.ts';
import { SCENARIO_LIST } from './engine/scenarios/index.ts';
import { planChoices } from './engine/session.ts';
import { formatFlux, formatUsd } from './engine/tokens.ts';
import { POLICY_IDS, type PolicyId, type ScenarioId } from './engine/types.ts';
import { connectionLabel } from './words.ts';

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

export interface ScenarioPickerProps {
  value: ScenarioId;
  onChange: (id: ScenarioId) => void;
  disabled?: boolean;
  /** Scenarios that have been run to a debrief at least once. */
  ran?: ReadonlySet<ScenarioId>;
  legend?: string;
  /** Keep the legend for assistive technology only (the page already has a heading). */
  hideLegend?: boolean;
  /** On a narrow container only the chosen scenario shows its description, so the list stays short. */
  compact?: boolean;
}

export function ScenarioPicker({
  value,
  onChange,
  disabled,
  ran,
  legend = 'Scenario',
  hideLegend = false,
  compact = false,
}: ScenarioPickerProps) {
  const name = useId();
  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend className={hideLegend ? 'sr-only' : styles.pickerLegend}>{legend}</legend>
      <div className={styles.options} data-compact={compact ? '' : undefined}>
        {SCENARIO_LIST.map((s) => {
          const checked = value === s.id;
          const labelId = `${name}-${s.id}-t`;
          const descId = `${name}-${s.id}-d`;
          return (
            <label key={s.id} className={styles.option} data-checked={checked ? '' : undefined}>
              <input
                type="radio"
                name={name}
                value={s.id}
                checked={checked}
                onChange={() => onChange(s.id)}
                className={styles.radio}
                aria-labelledby={labelId}
                aria-describedby={descId}
              />
              <span className={styles.optionCard}>
                <span className={styles.optionHead}>
                  <span id={labelId} className={styles.optionTitle}>
                    {s.card.title}
                  </span>
                  <span className={styles.optionMark} aria-hidden="true">
                    {checked ? <Glyph name="check" size={14} /> : null}
                  </span>
                </span>
                <span id={descId} className={styles.optionText}>
                  {s.card.summary}
                </span>
                <span className={styles.optionFoot}>
                  <Chip size="sm" icon={s.server === 'orbit' ? 'user' : 'key'}>
                    {connectionLabel(s.server, s.connection)}
                  </Chip>
                  {ran?.has(s.id) ? (
                    <Chip size="sm" icon="check">
                      Run
                    </Chip>
                  ) : null}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export interface PolicyPickerProps {
  value: PolicyId;
  onChange: (id: PolicyId) => void;
  disabled?: boolean;
  legend?: string;
}

export function PolicyPicker({
  value,
  onChange,
  disabled,
  legend = 'How your client asks',
}: PolicyPickerProps) {
  const name = useId();
  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend className={styles.pickerLegend}>{legend}</legend>
      <div className={styles.options} data-layout="policy">
        {POLICY_IDS.map((id) => {
          const p = POLICIES[id];
          const checked = value === id;
          const labelId = `${name}-${id}-t`;
          const descId = `${name}-${id}-d`;
          return (
            <label key={id} className={styles.option} data-checked={checked ? '' : undefined}>
              <input
                type="radio"
                name={name}
                value={id}
                checked={checked}
                onChange={() => onChange(id)}
                className={styles.radio}
                aria-labelledby={labelId}
                aria-describedby={descId}
              />
              <span className={styles.optionCard}>
                <span className={styles.optionHead}>
                  <span id={labelId} className={styles.optionTitle}>
                    {p.label}
                  </span>
                  <span className={styles.optionMark} aria-hidden="true">
                    {checked ? <Glyph name="check" size={14} /> : null}
                  </span>
                </span>
                <span id={descId} className={styles.optionText}>
                  {p.blurb}
                </span>
                {id === 'ask-all' ? (
                  <span className={styles.optionFoot}>
                    <Chip size="sm" tone="accent" icon="shield">
                      Recommended
                    </Chip>
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Orbit plan
// ---------------------------------------------------------------------------

export interface PlanPickerProps {
  value: OrbitPlanId;
  onChange: (id: OrbitPlanId) => void;
  disabled?: boolean;
}

export function PlanPicker({ value, onChange, disabled }: PlanPickerProps) {
  const name = useId();
  const plans = useMemo(() => planChoices(), []);
  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend className={styles.pickerLegend}>
        Orbit plan <FreshnessChip kind="simulation" />
      </legend>
      <div className={styles.options} data-layout="stack">
        {plans.map(({ view, term }) => {
          const id = view.id as OrbitPlanId;
          const checked = value === id;
          const labelId = `${name}-${id}-t`;
          const descId = `${name}-${id}-d`;
          return (
            <label key={id} className={styles.option} data-checked={checked ? '' : undefined}>
              <input
                type="radio"
                name={name}
                value={id}
                checked={checked}
                onChange={() => onChange(id)}
                className={styles.radio}
                aria-labelledby={labelId}
                aria-describedby={descId}
              />
              <span className={styles.optionCard}>
                <span className={styles.optionHead}>
                  <span id={labelId} className={styles.optionTitle}>
                    {view.name}
                  </span>
                  <span className={styles.optionPrice}>
                    {formatUsd(view.usd)} <span className={styles.optionTerm}>for {term}</span>
                  </span>
                </span>
                <span id={descId} className={styles.optionText}>
                  {view.instances} {view.instances === 1 ? 'instance' : 'instances'}, {view.size}. About{' '}
                  {formatFlux(view.flux)} at the baked FLUX price.
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
