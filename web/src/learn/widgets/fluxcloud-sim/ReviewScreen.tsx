/**
 * "Review & Validate": the registration steps of FACTS 9.4.4, one row each, with a spinner and then a tick.
 * Used for a new app and for an update (which adds the row 0 warnings). The rows run by themselves, except
 * the ones that need the learner: Sign Message for a wallet account, the test, and the payment.
 *
 * Nothing here signs, pays or deploys. Where FluxCloud would open a wallet or a card form the simulator
 * says so in words and moves on.
 */
import { humanBlocks } from '@shared/flux';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Button, Chip, Glyph, Switch } from '@/ui';
import { useSimEnv } from './context';
import styles from './FluxcloudSim.module.css';
import {
  currentRow,
  isAutomatic,
  type PayMethod,
  type ReviewAction,
  type ReviewState,
  ROW_LABEL,
  ROW_ORDER,
  type RowId,
} from './flow';
import { dateOf, fluxAmount, grouped, usd } from './format';
import { periodLabelOf } from './model';
import { IssueList, PageTitle, PriceFigure, RowMark } from './Parts';
import type { ReviewResult } from './review';

/** How long an automatic row works before it ticks, in ms. Reduced motion shortens them. */
const WORK_MS: Record<RowId, number> = {
  validate: 900,
  cost: 700,
  expiry: 600,
  signature: 1000,
  registered: 1100,
  test: 2600,
  payment: 0,
};

interface ReviewScreenProps {
  kind: 'register' | 'update';
  result: ReviewResult;
  review: ReviewState;
  dispatch: (a: ReviewAction) => void;
  fluxMultiplier: number;
  /** Row 0: the warnings an update raises, and the free update note. */
  notices?: ReactNode;
  /** Words under the Total Cost row (an update's credit line). */
  costNote?: ReactNode;
  onBack: () => void;
  backLabel: string;
}

export function ReviewScreen({
  kind,
  result,
  review,
  dispatch,
  fluxMultiplier,
  notices,
  costNote,
  onBack,
  backLabel,
}: ReviewScreenProps) {
  const { account, reducedMotion, announce, attempt, paramsSource, nowMs } = useSimEnv();
  const row = currentRow(review);

  // The timers must not restart whenever a parent re-renders with a new `dispatch` function.
  const send = useRef(dispatch);
  send.current = dispatch;
  const valid = useRef(result.valid);
  valid.current = result.valid;

  // Automatic rows tick by themselves.
  useEffect(() => {
    if (!row || !isAutomatic(row, account)) return;
    const ms = reducedMotion ? 120 : WORK_MS[row];
    const id = window.setTimeout(() => {
      send.current({ type: 'finish', row, ...(row === 'validate' ? { ok: valid.current } : {}) });
    }, ms);
    return () => window.clearTimeout(id);
  }, [row, account, reducedMotion]);

  // The test takes a moment too.
  useEffect(() => {
    if (!review.testRunning) return;
    const id = window.setTimeout(
      () => send.current({ type: 'testResult', ok: !review.testWillFail }),
      reducedMotion ? 150 : WORK_MS.test,
    );
    return () => window.clearTimeout(id);
  }, [review.testRunning, review.testWillFail, reducedMotion]);

  // Say what happened, once per change of row. A row that fails is an attempt for the lesson.
  const status = review.rows;
  const reportedFailure = useRef<string | null>(null);
  useEffect(() => {
    const failed = ROW_ORDER.find((r) => status[r] === 'failed') ?? null;
    if (failed !== reportedFailure.current) {
      reportedFailure.current = failed;
      if (failed) attempt();
    }
    if (failed === 'validate') {
      announce('Validate App Spec failed. The errors are listed under the row.');
      return;
    }
    if (failed === 'test') {
      announce('Test failed. Fix the specification, or choose Enable Payment Anyway.');
      return;
    }
    const cur = ROW_ORDER.find((r) => status[r] === 'running');
    if (cur) announce(`${ROW_LABEL[cur]}.`);
  }, [status, announce, attempt]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <PageTitle screenKey="review">Review &amp; Validate</PageTitle>
          <p className={styles.pageSub}>
            {kind === 'update'
              ? 'Each row runs in order. Nothing is charged until the Payment row.'
              : 'Each row runs in order. Nothing is registered until Signature, and nothing is paid until Payment.'}
          </p>
        </div>
        <Button size="sm" variant="ghost" icon="arrow-left" onClick={onBack}>
          {backLabel}
        </Button>
      </div>

      {notices}

      <ol className={styles.rows}>
        {ROW_ORDER.map((id) => (
          <Row key={id} id={id} status={status[id]}>
            {status[id] === 'todo' ? null : (
              <RowBody
                id={id}
                kind={kind}
                result={result}
                review={review}
                dispatch={dispatch}
                paramsSource={paramsSource}
                fluxMultiplier={fluxMultiplier}
                costNote={costNote}
                nowMs={nowMs}
                onBack={onBack}
                backLabel={backLabel}
              />
            )}
          </Row>
        ))}
      </ol>
    </div>
  );
}

function processOf(repotag: string): string {
  const last = repotag.split('/').pop() ?? '';
  return last.split(':')[0] || 'the container';
}

function Row({
  id,
  status,
  children,
}: {
  id: RowId;
  status: ReviewState['rows'][RowId];
  children: ReactNode;
}) {
  return (
    <li className={styles.row} data-status={status} data-row={id}>
      <RowMark status={status} />
      <div className={styles.rowBody}>
        <h4 className={styles.rowLabel}>{ROW_LABEL[id]}</h4>
        {children}
      </div>
    </li>
  );
}

interface RowBodyProps {
  id: RowId;
  kind: 'register' | 'update';
  result: ReviewResult;
  review: ReviewState;
  dispatch: (a: ReviewAction) => void;
  paramsSource: 'live' | 'cache' | 'baked';
  fluxMultiplier: number;
  costNote?: ReactNode;
  nowMs: number;
  onBack: () => void;
  backLabel: string;
}

function RowBody({
  id,
  kind,
  result,
  review,
  dispatch,
  paramsSource,
  fluxMultiplier,
  costNote,
  onBack,
  backLabel,
}: RowBodyProps) {
  const { account } = useSimEnv();
  const status = review.rows[id];
  const uid = useId();

  switch (id) {
    case 'validate': {
      if (status === 'running') {
        return <p className={styles.rowText}>Checking the spec with the rules the network applies.</p>;
      }
      if (status === 'failed') {
        return (
          <div className={styles.rowStack}>
            <p className={styles.fieldError} role="alert">
              Validation Error:
            </p>
            <IssueList issues={result.errors} label="Validation errors" />
            <div>
              <Button size="sm" variant="secondary" icon="arrow-left" onClick={onBack}>
                {backLabel}
              </Button>
            </div>
          </div>
        );
      }
      const heads = [...result.warnings, ...result.infos];
      return (
        <div className={styles.rowStack}>
          <p className={styles.rowText}>
            The spec is valid
            {result.warnings.length > 0
              ? `, with ${result.warnings.length} ${result.warnings.length === 1 ? 'warning' : 'warnings'}.`
              : '.'}
          </p>
          <IssueList issues={heads} label="Warnings and notes" />
        </div>
      );
    }
    case 'cost':
      if (status === 'running') return <p className={styles.rowText}>Asking for the price.</p>;
      return (
        <div className={styles.rowStack}>
          <PriceFigure
            quote={result.quote}
            paramsSource={paramsSource}
            fluxMultiplier={fluxMultiplier}
            periodLabel={periodLabelOf(result.expireBlocks)}
          />
          {costNote}
        </div>
      );
    case 'expiry':
      if (status === 'running') return <p className={styles.rowText}>Working out when it ends.</p>;
      return (
        <p className={styles.rowText}>
          The subscription runs until about <strong>{dateOf(result.expiryMs)}</strong>, block{' '}
          <code className={styles.code}>{grouped(result.expiryHeight)}</code>. That is{' '}
          {humanBlocks(result.expireBlocks)}, counted from the block your message lands in.
        </p>
      );
    case 'signature':
      if (account === 'sso') {
        return (
          <p className={styles.rowText}>
            {status === 'running'
              ? 'Signing with your account.'
              : 'Signed automatically. An SSO account holds no key, so FluxCloud signs for you and hides the Sign Message button.'}
          </p>
        );
      }
      if (status === 'running') {
        return (
          <div className={styles.rowStack}>
            <p className={styles.rowText}>
              Your wallet signs the registration message: its type, a version, the spec as JSON and a
              timestamp. In FluxCloud this opens ZelCore, SSP, MetaMask or WalletConnect, or a Manual Signing
              dialog ("Copy the message below, sign it externally, then paste the signature.").
            </p>
            <div>
              <Button variant="primary" icon="key" onClick={() => dispatch({ type: 'sign' })}>
                Sign Message
              </Button>
            </div>
            <p className={styles.fineprint}>
              Simulation: no wallet opens and nothing is signed. The button only moves you on.
            </p>
          </div>
        );
      }
      return (
        <p className={styles.rowText}>
          Signed (simulated). In FluxCloud your wallet produced this signature.
        </p>
      );
    case 'registered':
      return (
        <p className={styles.rowText}>
          {status === 'running'
            ? 'Broadcasting the signed message.'
            : 'The signed message is propagated on the Flux network. It is a temporary message until it is paid.'}
        </p>
      );
    case 'test':
      return (
        <div className={styles.rowStack}>
          <p className={styles.rowText}>
            Test your application install/launch to ensure your specifications work correctly.
          </p>
          {status === 'running' && !review.testRunning ? (
            <div className={styles.rowActions}>
              <Button variant="primary" icon="play" onClick={() => dispatch({ type: 'runTest' })}>
                Test Installation
              </Button>
              <Switch
                size="sm"
                checked={review.testWillFail}
                onCheckedChange={(on) => dispatch({ type: 'toggleTestFail', on })}
              >
                Make the test fail (simulation only)
              </Switch>
            </div>
          ) : null}
          {review.testRunning ? <p className={styles.rowText}>Nodes are test-installing the app.</p> : null}
          {status === 'failed' ? (
            <div className={styles.rowStack}>
              <p className={styles.fieldError} role="alert">
                Test failed! Check logs below and fix your specifications before paying.
              </p>
              <pre className={styles.logBox} role="log" aria-label="Sample test log">
                {`starting ${processOf(result.spec.compose[0]?.repotag ?? '')}\nfatal: exited with code 1\n(sample log: the simulator wrote this)`}
              </pre>
              <div className={styles.rowActions}>
                <Button size="sm" variant="secondary" icon="arrow-left" onClick={onBack}>
                  {backLabel}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={styles.wrapBtn}
                  onClick={() => dispatch({ type: 'bypassTest' })}
                >
                  Enable Payment Anyway
                </Button>
              </div>
            </div>
          ) : null}
          {status === 'done' ? (
            <p className={styles.rowText}>
              {review.testBypassed
                ? 'The test failed and payment was enabled anyway.'
                : 'The test install passed. The app runs from this spec.'}
            </p>
          ) : null}
        </div>
      );
    case 'payment':
      return (
        <PaymentBody
          kind={kind}
          status={status}
          review={review}
          dispatch={dispatch}
          result={result}
          fluxMultiplier={fluxMultiplier}
          uid={uid}
        />
      );
    default:
      return null;
  }
}

function PaymentBody({
  kind,
  status,
  review,
  dispatch,
  result,
  fluxMultiplier,
  uid,
}: {
  kind: 'register' | 'update';
  status: ReviewState['rows'][RowId];
  review: ReviewState;
  dispatch: (a: ReviewAction) => void;
  result: ReviewResult;
  fluxMultiplier: number;
  uid: string;
}) {
  const discount = Math.round((1 - fluxMultiplier) * 100);
  const choose = (m: PayMethod) => dispatch({ type: 'method', method: m });
  if (status === 'done') {
    return (
      <p className={styles.rowText}>
        {kind === 'update' ? 'Payment confirmed (simulated).' : 'Payment sent (simulated).'}
      </p>
    );
  }
  return (
    <div className={styles.rowStack}>
      <p className={styles.payHead} id={`${uid}-pay`} aria-hidden="true">
        Select payment method
      </p>
      <fieldset className={styles.payChoice}>
        <legend className="sr-only">Select payment method</legend>
        <button
          type="button"
          className={styles.payCard}
          aria-pressed={review.method === 'card'}
          onClick={() => choose('card')}
        >
          <span className={styles.payTitle}>
            <Glyph name="price" size={18} /> Pay with Card
          </span>
          <span className={styles.paySub}>Secure &amp; instant payment</span>
          <span className={styles.payList}>Stripe, PayPal</span>
          <span className={styles.payPrice}>{usd(result.quote.usdTotal ?? 0)} USD + VAT</span>
        </button>
        <button
          type="button"
          className={styles.payCard}
          aria-pressed={review.method === 'flux'}
          onClick={() => choose('flux')}
        >
          <span className={styles.payTitle}>
            <Glyph name="flux" size={18} /> Pay with FLUX
          </span>
          <span className={styles.paySub}>Cryptocurrency payment</span>
          <span className={styles.payList}>Zelcore, SSP, or manual</span>
          <span className={styles.payPrice}>
            {fluxAmount(result.quote.fluxTotal)} FLUX
            {discount > 0 ? (
              <Chip size="sm" tone="accent">
                {discount}% discount
              </Chip>
            ) : null}
          </span>
        </button>
      </fieldset>

      {review.method === 'flux' ? (
        <dl className={styles.manual}>
          <div>
            <dt>Send to</dt>
            <dd>
              <code className={styles.code}>t3Nr...FLUX</code>
              <span className={styles.fineprint}>
                The deployment address is shown in full by FluxCloud, never here.
              </span>
            </dd>
          </div>
          <div>
            <dt>Message</dt>
            <dd>
              <code className={styles.code}>(the registration hash)</code>
              <span className={styles.fineprint}>
                The message is mandatory. A payment without it cannot be matched to your app.
              </span>
            </dd>
          </div>
        </dl>
      ) : null}
      {review.method === 'card' ? (
        <p className={styles.fineprint}>
          The checkout opens in a popup. Stripe and PayPal appear only when the payment bridge reports them
          up. Auto-renewal is a Stripe-only option.
        </p>
      ) : null}

      <div className={styles.rowActions}>
        <Button
          variant="primary"
          icon="check"
          className={styles.wrapBtn}
          disabled={review.method === null}
          onClick={() => dispatch({ type: 'pay' })}
        >
          Complete the simulated payment
        </Button>
      </div>
      <p className={styles.fineprint}>
        Simulation: no card is charged and no FLUX is sent. Payment window: 30 minutes remaining. Deployment
        time: Up to 45 min after payment. Both lines are fixed text, not timers: the network keeps the
        registration for an hour, counted from the registration itself.
      </p>
    </div>
  );
}

/** Row 0 of an update: the two warnings FluxCloud raises before the cost. */
export function UpdateNotices({
  hardReasons,
  resourcesIncreased,
}: {
  hardReasons: string[];
  resourcesIncreased: boolean;
}) {
  if (hardReasons.length === 0 && !resourcesIncreased) return null;
  return (
    <div className={styles.notices}>
      {hardReasons.length > 0 ? (
        <div className={styles.noticeBlock} data-tone="crit">
          <p className={styles.noticeTitle}>
            <Glyph name="warning" size={16} /> This update will trigger a hard redeploy
          </p>
          <ul>
            {hardReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className={styles.fineprint}>Container data is deleted. A soft redeploy would have kept it.</p>
        </div>
      ) : null}
      {resourcesIncreased ? (
        <div className={styles.noticeBlock} data-tone="warn">
          <p className={styles.noticeTitle}>
            <Glyph name="warning" size={16} /> Resource requirements increased
          </p>
          <p>
            If the current nodes cannot hold the larger spec, the app is reinstalled elsewhere and its data is
            lost.
          </p>
        </div>
      ) : null}
    </div>
  );
}
