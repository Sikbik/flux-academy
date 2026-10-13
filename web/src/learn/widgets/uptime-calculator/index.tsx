/**
 * Widget `uptime-calculator` (docs/CONTENT.md section 5): instance count and an assumed per-node
 * availability to combined availability and downtime per month, with the independence assumption stated
 * and the cost of each count beside it so resilience is never shown without its price.
 *
 * Props (`stage.props`):
 *   target    availability to reach, as a percent (99.9) or a fraction (0.999)
 *   defaults  { instances?: number; nodeAvailability?: number } the starting values
 *
 * Emits `widget-done` when the combined availability meets `target` (after the learner has changed
 * something, so a lesson never completes itself). Without a `target` it is an exploration widget and
 * reports done on the first change. Registers a solver for "Show me": it picks the fewest instances that
 * reach the target at the current assumption.
 */
import { BAKED_PRICING, FDM_EJECT_SEC } from '@shared/flux';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePricing } from '@/data';
import type { WidgetComponent } from '@/learn/stage-api';
import { Chip, FreshnessChip, Panel, Slider } from '@/ui';
import { fixtureResources, priceCliff, priceLadder } from './cost';
import {
  combinedAvailability,
  DEFAULT_NODE_AVAILABILITY,
  downtimeMinutesPerMonth,
  formatAvailability,
  formatDowntime,
  instancesFor,
  MAX_INSTANCES,
  MAX_NODE_AVAILABILITY,
  MIN_INSTANCES,
  MIN_NODE_AVAILABILITY,
  marginalSavings,
  nines,
  normalizeAvailability,
  peakShareToCarry,
  survivableLoadShare,
} from './math';
import styles from './UptimeCalculator.module.css';

interface Props {
  target: number | null;
  instances: number;
  nodeAvailability: number;
}

function readProps(raw: Record<string, unknown> | undefined): Props {
  const defaults = raw && typeof raw.defaults === 'object' && raw.defaults !== null ? raw.defaults : {};
  const d = defaults as Record<string, unknown>;
  const instances = typeof d.instances === 'number' ? Math.round(d.instances) : 1;
  const node = normalizeAvailability(typeof d.nodeAvailability === 'number' ? d.nodeAvailability : null);
  return {
    target: normalizeAvailability(typeof raw?.target === 'number' ? raw.target : null),
    instances: Math.min(MAX_INSTANCES, Math.max(MIN_INSTANCES, instances)),
    nodeAvailability: Math.min(
      MAX_NODE_AVAILABILITY,
      Math.max(MIN_NODE_AVAILABILITY, node ?? DEFAULT_NODE_AVAILABILITY),
    ),
  };
}

const usd = (n: number): string => `$${n.toFixed(2)}`;

const UptimeCalculator: WidgetComponent = ({ stage, host, stepKey }) => {
  const props = useMemo(() => readProps(stage.props), [stage.props]);
  const [instances, setInstances] = useState(props.instances);
  const [nodeAvail, setNodeAvail] = useState(props.nodeAvailability);
  const [touched, setTouched] = useState(false);
  const pricing = usePricing();

  // A new step starts untouched: the widget never completes a task the learner has not acted on.
  const lastStep = useRef(stepKey);
  useEffect(() => {
    if (lastStep.current !== stepKey) {
      lastStep.current = stepKey;
      setTouched(false);
    }
  }, [stepKey]);

  const params = pricing.data?.params ?? BAKED_PRICING.params;
  const priceBasis = pricing.data ? pricing.data.paramsSource : 'baked';
  const prices = useMemo(() => priceLadder(MAX_INSTANCES, params), [params]);
  const cliff = priceCliff(prices);
  const resources = useMemo(() => fixtureResources(), []);

  const availability = combinedAvailability(instances, nodeAvail);
  const downtime = downtimeMinutesPerMonth(availability);
  const rows = useMemo(() => marginalSavings(MAX_INSTANCES, nodeAvail), [nodeAvail]);
  const worst = rows[0]?.downtimeMin ?? 1;
  const bestSaving = Math.max(1e-9, ...rows.map((r) => r.savedMin));
  const headroom = survivableLoadShare(instances);
  const carry = peakShareToCarry(instances);
  const met = props.target !== null ? availability >= props.target - 1e-12 : true;
  const needed = props.target !== null ? instancesFor(props.target, nodeAvail, MAX_INSTANCES) : null;

  // Report done on the transition to met, after the learner touched something.
  const reported = useRef(false);
  useEffect(() => {
    if (!touched || !met) {
      if (!met) reported.current = false;
      return;
    }
    if (reported.current) return;
    reported.current = true;
    host.emit({ type: 'widget-done' });
  }, [touched, met, host]);

  // "Show me": the fewest instances that reach the target. If the assumption makes that impossible, use the
  // stated default assumption first.
  const solverInputs = useRef({ target: props.target, nodeAvail });
  solverInputs.current = { target: props.target, nodeAvail };
  useEffect(() => {
    host.registerSolver(() => {
      const { target, nodeAvail: a } = solverInputs.current;
      let assumption = a;
      let n = target === null ? 3 : instancesFor(target, assumption, MAX_INSTANCES);
      if (n === null) {
        assumption = DEFAULT_NODE_AVAILABILITY;
        n = target === null ? 3 : (instancesFor(target, assumption, MAX_INSTANCES) ?? MAX_INSTANCES);
      }
      setNodeAvail(assumption);
      setInstances(n);
      setTouched(true);
    });
    return () => host.registerSolver(null);
  }, [host]);

  const targetText = props.target !== null ? formatAvailability(props.target) : null;

  return (
    <Panel variant="glass" padding="md" container className={styles.root} contentClassName={styles.content}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Uptime arithmetic</p>
        <Chip size="sm" tone="accent">
          A model, not a measurement
        </Chip>
      </div>

      <div className={styles.controls}>
        <Slider
          label="Instances"
          min={MIN_INSTANCES}
          max={MAX_INSTANCES}
          step={1}
          value={instances}
          marks
          onValueChange={(v) => {
            setInstances(v);
            setTouched(true);
          }}
          format={(v) => `${v} ${v === 1 ? 'instance' : 'instances'}`}
        />
        <Slider
          label="Assumed availability of one node"
          min={MIN_NODE_AVAILABILITY}
          max={MAX_NODE_AVAILABILITY}
          step={0.001}
          value={nodeAvail}
          marks={[
            { value: MIN_NODE_AVAILABILITY, label: '90%' },
            { value: DEFAULT_NODE_AVAILABILITY, label: '97%' },
            { value: MAX_NODE_AVAILABILITY, label: '99.9%' },
          ]}
          onValueChange={(v) => {
            setNodeAvail(v);
            setTouched(true);
          }}
          format={(v) => `${(v * 100).toFixed(1)}%`}
          hint="An assumption you can change. The docs ask operators for about 97 percent. This course has no measured figure, so the number is yours to set."
        />
      </div>

      <dl className={styles.results} aria-live="polite">
        <div className={styles.result} data-primary="">
          <dt>Combined availability</dt>
          <dd>
            <span className={styles.big}>{formatAvailability(availability)}</span>
            <span className={styles.unit}>%</span>
          </dd>
          <dd className={styles.sub}>{nines(availability).toFixed(1)} nines</dd>
        </div>
        <div className={styles.result}>
          <dt>Downtime per month</dt>
          <dd>
            <span className={styles.big}>{formatDowntime(downtime)}</span>
          </dd>
          <dd className={styles.sub}>of a 30 day month</dd>
        </div>
        <div className={styles.result}>
          <dt>Busiest safe load per instance</dt>
          <dd>
            <span className={styles.big}>
              {instances === 1 ? 'none' : `up to ${Math.round(headroom * 100)}%`}
            </span>
          </dd>
          <dd className={styles.sub}>
            {instances === 1
              ? 'one instance survives no failure'
              : `as a share of its own capacity, so the other ${instances - 1} can carry it`}
          </dd>
        </div>
      </dl>

      {props.target !== null ? (
        <p className={styles.goal} data-met={met ? 'true' : 'false'}>
          <Chip kind="status" status={met ? 'ok' : 'pending'} size="sm">
            {met ? 'Goal met' : 'Goal not met'}
          </Chip>
          <span>
            Goal: {targetText}% or better.{' '}
            {met
              ? `${instances} ${instances === 1 ? 'instance reaches' : 'instances reach'} it under this assumption.`
              : needed !== null
                ? `Under this assumption the fewest instances that reach it is ${needed}.`
                : 'No count up to 12 reaches it under this assumption.'}
          </span>
        </p>
      ) : null}

      <div className={styles.ladder}>
        <div className={styles.ladderHead}>
          <h3>What each extra instance buys</h3>
          <span className={styles.ladderBasis}>
            <FreshnessChip kind={priceBasis === 'baked' ? 'baked' : 'computed'} />
          </span>
        </div>
        <ol className={styles.rows} aria-label="Downtime and price by instance count">
          {rows.map((row) => {
            const price = prices[row.instances - 1]?.usdPerMonth ?? 0;
            const selected = row.instances === instances;
            return (
              <li key={row.instances} data-selected={selected ? 'true' : undefined}>
                <button
                  type="button"
                  className={styles.row}
                  aria-pressed={selected}
                  onClick={() => {
                    setInstances(row.instances);
                    setTouched(true);
                  }}
                >
                  <span className={styles.n}>{row.instances}</span>
                  <span className={styles.bar} aria-hidden="true">
                    <span
                      className={styles.fill}
                      style={{ inlineSize: `${Math.max(0.6, (row.downtimeMin / worst) * 100)}%` }}
                    />
                  </span>
                  <span className={styles.down}>{formatDowntime(row.downtimeMin)}</span>
                  <span
                    className={styles.saved}
                    data-strong={row.savedMin / bestSaving > 0.5 ? 'true' : undefined}
                  >
                    {row.instances === 1 ? '' : `saves ${formatDowntime(row.savedMin)}`}
                  </span>
                  <span className={styles.price}>{usd(price)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className={styles.note}>
          Prices are for a small web app ({resources.cpu} core, {resources.ramMb} MB RAM, {resources.hddGb} GB
          disk), per month, in USD
          {priceBasis === 'baked' ? ' at the built-in rates' : ' at the current rates'}.
          {cliff !== null
            ? ` The price steps up at ${cliff} instances because the small-app discount applies only below 4.`
            : ''}
        </p>
      </div>

      <div className={styles.caveats}>
        <h3>What this model assumes</h3>
        <ul>
          <li>
            <strong>Nodes fail independently.</strong> That is the generous case. A whole region, a shared
            host or a bad image takes several instances at once, and then the arithmetic no longer holds.
          </li>
          <li>
            <strong>The availability of one node is a number you chose.</strong> It is not measured here.
          </li>
          <li>
            <strong>N minus 1 capacity.</strong> When one instance fails the rest take its traffic, so each
            instance must be able to carry 1/(n-1) of peak on its own.{' '}
            {carry === null
              ? 'With one instance there is nothing to take over: no size survives a failure.'
              : instances === 2
                ? 'With 2 instances each must carry the whole peak.'
                : `With ${instances} instances each must carry ${Math.round(carry * 100)}% of peak, and with 2 the whole peak.`}
          </li>
          <li>
            <strong>Detection takes seconds, replacement takes much longer.</strong> The load balancer drops a
            dead instance in about {FDM_EJECT_SEC} s; a replacement can take about two hours after the node
            dies, more for an app with synced storage, plus the image pull.
          </li>
        </ul>
      </div>
    </Panel>
  );
};

export default UptimeCalculator;
