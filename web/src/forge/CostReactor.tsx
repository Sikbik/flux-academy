/**
 * The cost reactor: what the spec costs and why.
 *
 *   gauges      CPU, RAM and disk as a share of the smallest node tier that can host the app
 *   price       USD and FLUX as odometers, the subscription length, the saving, the basis of the number
 *   waterfall   every line of the quote with its one-sentence reason
 *   curve       the same app at 1 to 10 instances, with the discount cliff drawn where it is
 *
 * It is presentational: the SpecEditor feeds it a spec and a quote from the session, the lesson widget
 * feeds it its own. The price on screen is always labelled with its basis (OFFICIAL when Flux's own
 * calculator agreed, COMPUTED from the live rates, BAKED from the built-in table) and with the age of the
 * rates it used.
 */

import { BLOCKS_PER_MONTH, durationDiscount } from '@shared/flux/blocks';
import { tiersThatFit } from '@shared/flux/tiers';
import type { FluxAppSpec, Quote } from '@shared/flux/types';
import { useMemo } from 'react';
import { describeStatus, freshnessKind, useDataAge, usePricing } from '@/data';
import { Button, FreshnessChip, Glyph, Odometer, Popover, SegmentedControl, Switch } from '@/ui';
import type { VerifyState } from './hooks';
import { PERIODS, type PricingContext, periodOf, priceCurve, priceSpec, totals } from './model';
import { money } from './model/format';
import { Gauges, TierFit } from './reactor/Gauges';
import { PriceCurve } from './reactor/PriceCurve';
import styles from './reactor/reactor.module.css';
import { Waterfall } from './reactor/Waterfall';

export type ReactorSection = 'gauges' | 'price' | 'waterfall' | 'curve';

export interface CostReactorProps {
  spec: FluxAppSpec;
  /** The locally computed quote of `spec`. */
  quote: Quote;
  /** The rates and FLUX price `quote` was computed with. */
  pricing: PricingContext;
  /** Server confirmation. Omit it and the "Verify with Flux" row is not drawn. */
  verify?: {
    state: VerifyState;
    /** The result is for the spec on screen. */
    current: boolean;
    run: () => void;
    auto: boolean;
    onAuto: (on: boolean) => void;
  };
  /** Pick an instance count from the curve. Omit for a read-only display. */
  onInstances?: (n: number) => void;
  /** Pick a subscription length in blocks. Omit for a read-only display. */
  onExpire?: (blocks: number) => void;
  instancesLocked?: boolean;
  expireLocked?: boolean;
  /** What to draw. Default all four. */
  sections?: readonly ReactorSection[];
  /**
   * `baked` says the USD rates are the built-in ones (a lesson's numbers), so the live freshness chip,
   * which is about the network's rates, is left out. Default `live`.
   */
  ratesMode?: 'live' | 'baked';
  /** Draw the title row with the basis and freshness chips. Default true. */
  header?: boolean;
  className?: string;
}

const ALL: readonly ReactorSection[] = ['gauges', 'price', 'waterfall', 'curve'];

const SHORT: Record<string, string> = {
  '1w': '1 wk',
  '2w': '2 wk',
  '1m': '1 mo',
  '3m': '3 mo',
  '6m': '6 mo',
  '12m': '1 yr',
};

function periodWord(months: number): string {
  if (months < 0.2) return 'a few days';
  if (months < 0.95)
    return `${Math.round(months * 4.33)} ${Math.round(months * 4.33) === 1 ? 'week' : 'weeks'}`;
  const m = Number(months.toFixed(1));
  return `${m} ${m === 1 ? 'month' : 'months'}`;
}

export function CostReactor({
  spec,
  quote: local,
  pricing,
  verify,
  onInstances,
  onExpire,
  instancesLocked,
  expireLocked,
  sections = ALL,
  ratesMode = 'live',
  header = true,
  className,
}: CostReactorProps) {
  const rates = usePricing();
  const age = useDataAge('pricing');
  const chip = describeStatus(rates.status, { meta: rates.meta, ageMs: age });
  const has = (s: ReactorSection) => sections.includes(s);

  // The official answer replaces the local one only while it is for this exact spec. The data layer keeps
  // only the per-month figures of an official quote, so the totals and the length come from what is known:
  // the official total the server reported, and the subscription this spec asks for.
  const official = verify?.current && verify.state.status === 'official' ? verify.state : null;
  const quote = useMemo<Quote>(() => {
    const q = official?.quote;
    if (!q) return local;
    const months = local.months;
    const cents = (n: number) => Math.round(n * 100) / 100;
    return {
      ...q,
      months,
      usdTotal: q.usdTotal ?? official.officialUsd ?? cents(q.usdPerMonth * months),
      fluxTotal: q.fluxTotal ?? (q.fluxPerMonth !== null ? cents(q.fluxPerMonth * months) : null),
    };
  }, [official, local]);
  const basis: 'official' | 'computed' | 'baked' =
    quote.basis === 'official' ? 'official' : quote.paramsSource === 'baked' ? 'baked' : 'computed';

  const sum = useMemo(() => totals(spec), [spec]);
  const fits = useMemo(() => tiersThatFit(sum), [sum]);
  const curve = useMemo(() => priceCurve(spec, pricing, 10), [spec, pricing]);

  const months = quote.months;
  const wholeMonths = months >= 0.95;
  const total = quote.usdTotal ?? quote.usdPerMonth * months;
  const discount = durationDiscount(months);
  const fluxTotal = quote.fluxTotal ?? null;

  // What month by month would have cost, to say what a longer subscription saves.
  const oneMonth = useMemo(() => {
    if (months < 2.95) return null;
    return priceSpec({ ...spec, expire: BLOCKS_PER_MONTH }, pricing).usdTotal ?? null;
  }, [spec, pricing, months]);
  const saved = oneMonth !== null ? Math.round((oneMonth * months - total) * 100) / 100 : 0;

  const period = periodOf(spec);
  const periodOptions = useMemo(() => {
    const base = PERIODS.filter((p) => ['1m', '3m', '6m', '12m'].includes(p.id)).map((p) => ({
      value: p.id,
      label: SHORT[p.id] ?? p.label,
    }));
    if (period && !['1m', '3m', '6m', '12m'].includes(period.id)) {
      return [{ value: period.id, label: SHORT[period.id] ?? period.label }, ...base];
    }
    if (!period) return [{ value: 'custom', label: 'Custom' }, ...base];
    return base;
  }, [period]);

  const fluxMultiplier = pricing.params.fluxmultiplier;
  const fluxOff = Math.round((1 - fluxMultiplier) * 100);

  return (
    <div className={`${styles.reactor}${className ? ` ${className}` : ''}`}>
      {header ? (
        <div className={styles.header}>
          <span className={styles.headerTitle}>Cost reactor</span>
          <FreshnessChip kind={basis} />
          {ratesMode === 'live' ? (
            <>
              <FreshnessChip kind={freshnessKind(rates.status)} ageMs={age} />
              <span className="sr-only">{chip.sentence}</span>
            </>
          ) : null}
        </div>
      ) : null}

      {has('gauges') ? (
        <div>
          <Gauges totals={sum} />
          <TierFit tiers={fits} />
        </div>
      ) : null}

      {has('price') ? (
        <section className={styles.price} aria-label="Price">
          <div className={styles.figures}>
            <div className={styles.figure}>
              <span className={styles.figureLabel}>
                USD {wholeMonths ? 'per month' : `for ${periodWord(months)}`}
              </span>
              <Odometer
                className={styles.big}
                value={wholeMonths ? quote.usdPerMonth : total}
                decimals={2}
                prefix="$"
                gradient
                label={`${wholeMonths ? quote.usdPerMonth : total} US dollars${wholeMonths ? ' per month' : ''}`}
              />
            </div>
            <div className={styles.figure}>
              <span className={styles.figureLabel}>
                FLUX {wholeMonths ? 'per month' : `for ${periodWord(months)}`}
                {quote.fluxPerMonth !== null ? (
                  <Popover
                    title="How the FLUX price is made"
                    width={340}
                    content={
                      <div className={styles.help}>
                        <p>
                          Prices are set in US dollars and converted at the current FLUX price
                          {quote.fluxUsd ? ` ($${quote.fluxUsd.toFixed(4)} per FLUX)` : ''}. Paying in FLUX
                          multiplies the converted price by {fluxMultiplier}, which is {fluxOff} percent off.
                        </p>
                        <p>
                          <strong>FLUX = USD / price x {fluxMultiplier}</strong>
                        </p>
                        {(pricing.fluxSource ?? pricing.source) === 'baked' ? (
                          <p>
                            This FLUX price is a built-in snapshot
                            {pricing.asOf ? ` from ${pricing.asOf}` : ''}, so treat the figure as an estimate.
                          </p>
                        ) : null}
                      </div>
                    }
                  >
                    <button type="button" className={styles.helpBtn} aria-label="How the FLUX price is made">
                      <Glyph name="help" size={14} />
                    </button>
                  </Popover>
                ) : null}
              </span>
              {quote.fluxPerMonth !== null && fluxTotal !== null ? (
                <Odometer
                  className={styles.bigFlux}
                  value={wholeMonths ? quote.fluxPerMonth : fluxTotal}
                  decimals={2}
                  suffix=" FLUX"
                />
              ) : (
                <span className={styles.bigFlux}>--</span>
              )}
              {quote.fluxPerMonth !== null ? (
                <span className={styles.saving}>
                  <Glyph name="check" size={12} />
                  {fluxOff}% less than USD
                </span>
              ) : (
                <span className={styles.per}>FLUX price not known right now</span>
              )}
            </div>
          </div>

          {onExpire ? (
            <SegmentedControl
              aria-label="Subscription length"
              size="sm"
              fullWidth
              value={period ? period.id : 'custom'}
              options={expireLocked ? periodOptions.map((o) => ({ ...o, disabled: true })) : periodOptions}
              onValueChange={(id) => {
                const p = PERIODS.find((x) => x.id === id);
                if (p && !expireLocked) onExpire(p.blocks);
              }}
            />
          ) : null}

          <p className={styles.sub}>
            You pay <b>${money(total)}</b> up front for {periodWord(months)}
            {discount ? `, which is ${discount.label} off the whole price` : ''}
            {saved > 0.005 ? ` and saves $${money(saved)} against going month by month` : ''}.{' '}
            {quote.minimumApplied
              ? 'The 0.99 minimum applies, so making a very small app smaller does not make it cheaper.'
              : ''}
          </p>

          {verify ? (
            <div className={styles.verifyRow}>
              <Button
                size="sm"
                variant="secondary"
                icon="shield"
                loading={verify.state.status === 'pending'}
                onClick={verify.run}
              >
                Verify with Flux
              </Button>
              <p
                className={styles.verifyMsg}
                data-status={verify.current ? verify.state.status : 'idle'}
                aria-live="polite"
              >
                {verify.current && verify.state.message
                  ? verify.state.message
                  : "Ask Flux's own calculator to confirm this price."}
              </p>
              <span className={styles.verifyAuto}>
                <Switch size="sm" checked={verify.auto} onCheckedChange={verify.onAuto}>
                  Auto
                </Switch>
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {has('waterfall') ? <Waterfall quote={quote} /> : null}

      {has('curve') ? (
        <PriceCurve points={curve} instances={spec.instances} onPick={onInstances} locked={instancesLocked} />
      ) : null}
    </div>
  );
}
