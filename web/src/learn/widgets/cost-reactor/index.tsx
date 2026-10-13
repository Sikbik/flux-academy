/**
 * Widget `cost-reactor`: sliders for CPU, RAM, disk and instances over a live price breakdown.
 *
 *   stage: { kind: 'widget', id: 'cost-reactor', props: {
 *     spec:    { instances: 3, compose: [{ cpu: 2, ram: 4000, hdd: 40 }] },   // a partial spec, as in a spec stage
 *     target:  { usdMax: 1.99 },       // the goal; usdMin, instances, instancesMin and instancesMax also work
 *     sliders: ['cpu', 'ram', 'hdd'],  // which sliders to offer (default all four)
 *     show:    ['gauges', 'price', 'waterfall', 'curve'],  // which parts of the reactor to draw
 *   } }
 *
 * Done (`widget-done`) when the price and the instance count satisfy `target`. With no target it is done
 * once the learner has moved a slider. "Show me" walks the app to a configuration that meets the target,
 * one stop at a time, touching only the sliders the learner has.
 *
 * Prices are monthly USD at the built-in rates, the numbers the lesson text uses, so a goal of "$1.99 or
 * less" means the same thing on screen and in the content tests. The widget also reports `spec` events,
 * so the achievements that read a spec (a valid spec for under $3, three instances) work here too.
 */

import type { FluxAppSpec } from '@shared/flux/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CostReactor, type ReactorSection } from '@/forge';
import { GRIDS, GridSlider } from '@/forge/controls/GridSlider';
import { useRatesContext } from '@/forge/hooks';
import { specEvent } from '@/forge/lessonFacts';
import { priceSpec, specFromPartial } from '@/forge/model';
import { cores, disk, instances as fmtInstances, memory, money } from '@/forge/model/format';
import { useStageResets } from '@/forge/useStageResets';
import { Chip, Glyph, SegmentedControl } from '@/ui';
import type { WidgetComponent } from '../../stage-api';
import type { DeepPartial } from '../../types';
import styles from './cost-reactor.module.css';
import {
  describeTarget,
  gapSentence,
  meets,
  monthlyUsd,
  readSliders,
  readTarget,
  type SliderId,
  solveTarget,
} from './target';

const REPORT_MS = 120;

const coresLabel = (v: number): string => `${cores(v)} ${v === 1 ? 'core' : 'cores'}`;

const ROWS: Record<
  SliderId,
  {
    label: string;
    stops: readonly number[];
    format: (v: number) => string;
    key: 'cpu' | 'ram' | 'hdd' | 'instances';
  }
> = {
  cpu: { label: 'CPU', stops: GRIDS.cpu, format: coresLabel, key: 'cpu' },
  ram: { label: 'RAM', stops: GRIDS.ram, format: memory, key: 'ram' },
  hdd: { label: 'Disk', stops: GRIDS.hdd, format: disk, key: 'hdd' },
  instances: { label: 'Instances', stops: GRIDS.instances, format: fmtInstances, key: 'instances' },
};

const SECTIONS: readonly ReactorSection[] = ['gauges', 'price', 'waterfall', 'curve'];

function readSections(raw: unknown): readonly ReactorSection[] {
  if (!Array.isArray(raw)) return ['gauges', 'price', 'waterfall'];
  const picked = SECTIONS.filter((s) => raw.includes(s));
  return picked.length > 0 ? picked : ['gauges', 'price', 'waterfall'];
}

interface Model {
  resets: number;
  spec: FluxAppSpec;
  touched: boolean;
  done: boolean;
}

function withResource(
  spec: FluxAppSpec,
  index: number,
  key: 'cpu' | 'ram' | 'hdd',
  value: number,
): FluxAppSpec {
  const c = spec.compose[index];
  if (!c || c[key] === value) return spec;
  const compose = spec.compose.slice();
  compose[index] = { ...c, [key]: value };
  return { ...spec, compose };
}

const CostReactorWidget: WidgetComponent = ({ stage, host, stepKey, compact }) => {
  const raw = stage.props;
  const target = useMemo(() => readTarget(raw?.target), [raw?.target]);
  const sliders = useMemo(() => readSliders(raw?.sliders), [raw?.sliders]);
  const sections = useMemo(() => readSections(raw?.show), [raw?.show]);
  // The price sits beside the sliders; the rest of the reactor goes under them.
  const below = useMemo(() => sections.filter((s) => s !== 'price'), [sections]);
  const start = useMemo(
    () => specFromPartial((raw?.spec as DeepPartial<FluxAppSpec> | undefined) ?? undefined),
    [raw?.spec],
  );

  const resets = useStageResets(stage, stepKey, true);
  const [model, setModel] = useState<Model>(() => ({ resets, spec: start, touched: false, done: false }));
  let m = model;
  if (model.resets !== resets) {
    m = { resets, spec: start, touched: false, done: false };
    setModel(m);
  }
  const { spec } = m;

  const [index, setIndex] = useState(0);
  const component = spec.compose[Math.min(index, spec.compose.length - 1)];
  const at = Math.min(index, Math.max(0, spec.compose.length - 1));

  const pricing = useRatesContext('baked');
  const quote = useMemo(() => priceSpec(spec, pricing), [spec, pricing]);
  const usd = useMemo(() => monthlyUsd(spec), [spec]);
  const met = target ? meets(target, spec, usd) : m.touched;

  // ---- reporting ----------------------------------------------------------------------------------------------
  const hostRef = useRef(host);
  hostRef.current = host;
  const timer = useRef(0);
  const lastReported = useRef<FluxAppSpec | null>(null);
  const lastInstances = useRef(start.instances);

  const update = useCallback(
    (next: FluxAppSpec, by: 'learner' | 'solver') => {
      setModel((cur) => {
        if (cur.spec === next) return cur;
        return { ...cur, spec: next, touched: true };
      });
      window.clearTimeout(timer.current);
      const send = () => {
        hostRef.current.emit(specEvent(next));
        lastReported.current = next;
        // A change that does not reach the goal is an attempt: the first one offers "Show me".
        if (by === 'learner' && target && !meets(target, next, monthlyUsd(next))) {
          hostRef.current.emit({ type: 'custom', name: 'attempt' });
        }
      };
      if (by === 'learner' && next.instances !== lastInstances.current) {
        hostRef.current.emit({ type: 'instances', value: next.instances });
      }
      lastInstances.current = next.instances;
      if (by === 'solver') send();
      else timer.current = window.setTimeout(send, REPORT_MS);
    },
    [target],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // A new step starts from its own spec: nothing reported for the old one may reach it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the step restarts
  useEffect(() => {
    window.clearTimeout(timer.current);
    lastReported.current = null;
    lastInstances.current = start.instances;
    setIndex(0);
  }, [resets]);

  // The goal is reported once, when it holds after the learner has done something.
  useEffect(() => {
    if (!m.touched || m.done || !met) return;
    setModel((cur) => (cur.done ? cur : { ...cur, done: true }));
    hostRef.current.emit({ type: 'widget-done' });
  }, [m.touched, m.done, met]);

  // ---- Show me ----------------------------------------------------------------------------------------------------
  const specRef = useRef(spec);
  specRef.current = spec;
  // The engine forgets the solver when a step is entered, so it is registered again for every step.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stepKey is the trigger, not a value read here
  useEffect(() => {
    host.registerSolver(() => {
      const current = specRef.current;
      if (!target) {
        update({ ...current }, 'solver');
        return;
      }
      const solved = solveTarget(current, at, target, sliders);
      update(solved ?? current, 'solver');
    });
    return () => host.registerSolver(null);
  }, [host, target, sliders, at, stepKey, update]);

  // ---- rendering --------------------------------------------------------------------------------------------------
  const currentValue = (id: SliderId): number => {
    if (id === 'instances') return spec.instances;
    return component ? component[ROWS[id].key as 'cpu' | 'ram' | 'hdd'] : 0;
  };

  const setValue = (id: SliderId, value: number) => {
    if (id === 'instances') update({ ...spec, instances: value }, 'learner');
    else update(withResource(spec, at, id, value), 'learner');
  };

  const scale =
    target?.usdMax !== undefined ? Math.max(target.usdMax * 2, usd * 1.08) : Math.max(usd * 1.4, 1);
  const markAt =
    target?.usdMax !== undefined
      ? target.usdMax / scale
      : target?.usdMin !== undefined
        ? target.usdMin / scale
        : null;
  const fillTo = Math.min(1, usd / scale);
  const gap = target ? gapSentence(target, spec, usd) : '';

  return (
    <div className={styles.widget} data-compact={compact ? 'true' : undefined}>
      {target ? (
        <section className={styles.goal} data-met={met ? 'true' : undefined} aria-label="Goal">
          <div className={styles.goalHead}>
            <Chip
              kind="status"
              status={met ? 'ok' : 'pending'}
              icon={met ? 'status-ok' : 'status-pending'}
              size="sm"
            >
              {met ? 'Goal met' : 'Goal'}
            </Chip>
            <p className={styles.goalText}>
              Get it to {describeTarget(target)}.{' '}
              <span className={styles.now}>
                Now ${money(usd)} a month{!met && gap ? `, ${gap}` : ''}.
              </span>
            </p>
          </div>
          {target.usdMax !== undefined || target.usdMin !== undefined ? (
            <div className={styles.track} aria-hidden="true">
              <span
                className={styles.fill}
                style={{ inlineSize: `${fillTo * 100}%` }}
                data-met={met ? 'true' : undefined}
              />
              {markAt !== null ? (
                <span className={styles.mark} style={{ insetInlineStart: `${markAt * 100}%` }} />
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className={styles.work}>
        <section className={styles.sliders} aria-label="Resources">
          {spec.compose.length > 1 ? (
            <SegmentedControl
              aria-label="Component"
              size="sm"
              value={String(at)}
              options={spec.compose.map((c, i) => ({
                value: String(i),
                label: c.name || `Component ${i + 1}`,
              }))}
              onValueChange={(v) => setIndex(Number(v))}
            />
          ) : null}
          {sliders.map((id) => {
            const row = ROWS[id];
            const value = currentValue(id);
            return (
              <div key={id} className={styles.row}>
                <div className={styles.rowHead}>
                  <span className={styles.rowLabel}>{row.label}</span>
                  <output className={styles.rowValue}>{row.format(value)}</output>
                </div>
                <GridSlider
                  label={`${row.label}${id !== 'instances' && spec.compose.length > 1 ? ` of ${component?.name ?? ''}` : ''}`}
                  value={value}
                  stops={row.stops}
                  format={row.format}
                  onChange={(v) => setValue(id, v)}
                />
              </div>
            );
          })}
        </section>

        <CostReactor
          className={styles.priceBox}
          spec={spec}
          quote={quote}
          pricing={pricing}
          ratesMode="baked"
          sections={['price']}
        />
      </div>

      <CostReactor
        spec={spec}
        quote={quote}
        pricing={pricing}
        ratesMode="baked"
        header={false}
        sections={below}
        onInstances={
          sliders.includes('instances') ? (n) => update({ ...spec, instances: n }, 'learner') : undefined
        }
        instancesLocked={!sliders.includes('instances')}
      />

      {target && !met ? (
        <p className={styles.nudge}>
          <Glyph name="info" size={14} /> Every line of the breakdown says why it costs what it costs.
        </p>
      ) : null}
    </div>
  );
};

export default CostReactorWidget;
