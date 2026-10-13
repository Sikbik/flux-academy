import { cloneFixture } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import {
  blankReview,
  currentRow,
  initialRegister,
  initialUpdate,
  nextReviewAction,
  type ReviewAction,
  type ReviewState,
  ROW_LABEL,
  ROW_ORDER,
  registerDeployed,
  registerReducer,
  reviewComplete,
  reviewReducer,
  updateReducer,
} from './flow';
import { blankDraft, draftFromSpec, patchSimple } from './model';

function run(s: ReviewState, actions: ReviewAction[]): ReviewState {
  return actions.reduce(reviewReducer, s);
}

/** Drive a review with the autopilot until it stops asking for something. */
function autopilot(s: ReviewState, account: 'sso' | 'wallet', valid = true): ReviewState {
  let cur = s;
  for (let i = 0; i < 40; i++) {
    const a = nextReviewAction(cur, account, valid, 'flux');
    if (!a) break;
    cur = reviewReducer(cur, a);
    if (reviewComplete(cur)) break;
  }
  return cur;
}

describe('review rows', () => {
  it('uses the labels and order of FACTS 9.4.4', () => {
    expect(ROW_ORDER.map((r) => ROW_LABEL[r])).toEqual([
      'Validate App Spec',
      'Total Cost',
      'Expiry',
      'Signature',
      'Registered',
      'Test Application Installation',
      'Payment',
    ]);
  });

  it('moves one row at a time and signs SSO accounts by itself', () => {
    let s = reviewReducer(blankReview(), { type: 'begin' });
    expect(currentRow(s)).toBe('validate');
    s = run(s, [
      { type: 'finish', row: 'validate', ok: true },
      { type: 'finish', row: 'cost' },
      { type: 'finish', row: 'expiry' },
    ]);
    expect(currentRow(s)).toBe('signature');
    s = reviewReducer(s, { type: 'finish', row: 'signature' });
    expect(currentRow(s)).toBe('registered');
  });

  it('ignores a finish for a row that is not current', () => {
    const s = reviewReducer(blankReview(), { type: 'begin' });
    expect(reviewReducer(s, { type: 'finish', row: 'cost' })).toBe(s);
  });

  it('stops at a failed validation and stays there', () => {
    let s = reviewReducer(blankReview(), { type: 'begin' });
    s = reviewReducer(s, { type: 'finish', row: 'validate', ok: false });
    expect(s.rows.validate).toBe('failed');
    expect(currentRow(s)).toBeNull();
  });

  it('makes wallet users press Sign Message', () => {
    let s = autopilot(reviewReducer(blankReview(), { type: 'begin' }), 'wallet');
    expect(reviewComplete(s)).toBe(true);
    s = reviewReducer(blankReview(), { type: 'begin' });
    s = run(s, [
      { type: 'finish', row: 'validate', ok: true },
      { type: 'finish', row: 'cost' },
      { type: 'finish', row: 'expiry' },
    ]);
    expect(currentRow(s)).toBe('signature');
    expect(s.signedByHand).toBe(false);
    s = reviewReducer(s, { type: 'sign' });
    expect(s.signedByHand).toBe(true);
    expect(currentRow(s)).toBe('registered');
  });

  it('runs the test, and offers Enable Payment Anyway after a failure', () => {
    let s = autopilot(reviewReducer(blankReview(), { type: 'begin' }), 'sso');
    expect(reviewComplete(s)).toBe(true);

    s = reviewReducer(blankReview(), { type: 'begin' });
    s = run(s, [
      { type: 'finish', row: 'validate', ok: true },
      { type: 'finish', row: 'cost' },
      { type: 'finish', row: 'expiry' },
      { type: 'finish', row: 'signature' },
      { type: 'finish', row: 'registered' },
      { type: 'runTest' },
    ]);
    expect(s.testRunning).toBe(true);
    s = reviewReducer(s, { type: 'testResult', ok: false });
    expect(s.rows.test).toBe('failed');
    expect(s.rows.payment).toBe('todo');
    s = reviewReducer(s, { type: 'bypassTest' });
    expect(s.testBypassed).toBe(true);
    expect(currentRow(s)).toBe('payment');
  });

  it('needs a payment method before paying', () => {
    let s = reviewReducer(blankReview(), { type: 'begin' });
    s = run(s, [
      { type: 'finish', row: 'validate', ok: true },
      { type: 'finish', row: 'cost' },
      { type: 'finish', row: 'expiry' },
      { type: 'finish', row: 'signature' },
      { type: 'finish', row: 'registered' },
      { type: 'runTest' },
      { type: 'testResult', ok: true },
    ]);
    expect(currentRow(s)).toBe('payment');
    expect(reviewReducer(s, { type: 'pay' })).toBe(s);
    s = run(s, [{ type: 'method', method: 'card' }, { type: 'pay' }]);
    expect(reviewComplete(s)).toBe(true);
  });
});

describe('register flow', () => {
  const web = cloneFixture('web-app');
  if (!web) throw new Error('fixture');

  it('will not open the review while Simple mode is missing something', () => {
    const s = initialRegister('sso', blankDraft('sso'));
    const at = registerReducer(s, { type: 'goto', stage: 'configure' });
    expect(registerReducer(at, { type: 'goto', stage: 'review' }).stage).toBe('configure');
  });

  it('opens the review once the form is complete, and pays through to deployment', () => {
    let s = initialRegister('sso', draftFromSpec(web, 'sso', 'simple'));
    s = registerReducer(s, { type: 'goto', stage: 'configure' });
    s = registerReducer(s, { type: 'goto', stage: 'review' });
    expect(s.stage).toBe('review');
    expect(currentRow(s.review)).toBe('validate');

    // Deployment cannot start before payment.
    expect(registerReducer(s, { type: 'deploy', length: 200 }).stage).toBe('review');

    const done = autopilot(s.review, 'sso');
    s = registerReducer(s, { type: 'review', action: { type: 'finish', row: 'validate', ok: true } });
    expect(done.rows.payment).toBe('done');
    // Replay the autopilot actions through the register reducer.
    let cur = s;
    for (let i = 0; i < 40; i++) {
      const a = nextReviewAction(cur.review, 'sso', true, 'card');
      if (!a) break;
      cur = registerReducer(cur, { type: 'review', action: a });
    }
    expect(reviewComplete(cur.review)).toBe(true);
    cur = registerReducer(cur, { type: 'deploy', length: 200 });
    expect(cur.stage).toBe('deploy');
    expect(registerDeployed(cur)).toBe(false);
    cur = registerReducer(cur, { type: 'tick', dt: 150 });
    expect(cur.deploy.t).toBe(150);
    expect(cur.deploy.playing).toBe(true);
    cur = registerReducer(cur, { type: 'tick', dt: 500 });
    expect(cur.deploy.t).toBe(200);
    expect(registerDeployed(cur)).toBe(true);
    expect(cur.deploy.playing).toBe(false);
  });

  it('reaches the last screen at the watcher time, before the run is over', () => {
    let s = initialRegister('sso', draftFromSpec(web, 'sso', 'simple'));
    s = registerReducer(s, { type: 'goto', stage: 'review' });
    for (let i = 0; i < 40; i++) {
      const a = nextReviewAction(s.review, 'sso', true, 'flux');
      if (!a) break;
      s = registerReducer(s, { type: 'review', action: a });
    }
    s = registerReducer(s, { type: 'deploy', length: 300, successAt: 120 });
    s = registerReducer(s, { type: 'tick', dt: 100 });
    expect(registerDeployed(s)).toBe(false);
    s = registerReducer(s, { type: 'tick', dt: 30 });
    expect(registerDeployed(s)).toBe(true);
    // The clock keeps going until every copy is up.
    expect(s.deploy.playing).toBe(true);
    expect(s.deploy.t).toBeLessThan(s.deploy.length);
  });

  it('skips to the end of the deployment', () => {
    let s = initialRegister('wallet', draftFromSpec(web, 'wallet', 'simple'));
    s = registerReducer(s, { type: 'goto', stage: 'review' });
    for (let i = 0; i < 40; i++) {
      const a = nextReviewAction(s.review, 'wallet', true, 'flux');
      if (!a) break;
      s = registerReducer(s, { type: 'review', action: a });
    }
    s = registerReducer(s, { type: 'deploy', length: 300 });
    s = registerReducer(s, { type: 'skip' });
    expect(registerDeployed(s)).toBe(true);
  });

  it('goes back to configure with a clean review', () => {
    let s = initialRegister('sso', draftFromSpec(web, 'sso', 'simple'));
    s = registerReducer(s, { type: 'goto', stage: 'review' });
    s = registerReducer(s, { type: 'goto', stage: 'configure' });
    expect(s.stage).toBe('configure');
    expect(currentRow(s.review)).toBeNull();
  });

  it('keeps the email locked for SSO and empty for a wallet', () => {
    let s = initialRegister('sso', blankDraft('sso'));
    s = registerReducer(s, { type: 'account', account: 'wallet' });
    expect(s.draft.spec.contacts).toEqual([]);
    s = registerReducer(s, { type: 'account', account: 'sso' });
    expect(s.draft.spec.contacts).toEqual(['you@example.com']);
  });

  it('gates Advanced on the Terms of Service', () => {
    const draft = { ...draftFromSpec(web, 'sso', 'advanced'), tos: false };
    const s = initialRegister('sso', draft);
    expect(registerReducer(s, { type: 'goto', stage: 'review' }).stage).toBe('entry');
    const ok = initialRegister('sso', { ...draft, tos: true });
    expect(registerReducer(ok, { type: 'goto', stage: 'review' }).stage).toBe('review');
  });

  it('is complete with the simple form filled by hand', () => {
    let d = blankDraft('sso');
    d = patchSimple(d, { image: 'nginx:1.27', name: 'demo', portRows: ['80'], tos: true });
    let s = initialRegister('sso', d);
    s = registerReducer(s, { type: 'goto', stage: 'review' });
    expect(s.stage).toBe('review');
  });
});

describe('update flow', () => {
  const web = cloneFixture('web-app');
  if (!web) throw new Error('fixture');

  it('finishes when payment is confirmed', () => {
    let s = initialUpdate('sso', draftFromSpec(web, 'sso', 'advanced'));
    s = updateReducer(s, { type: 'goto', stage: 'review' });
    expect(s.stage).toBe('review');
    for (let i = 0; i < 40 && s.stage === 'review'; i++) {
      const a = nextReviewAction(s.review, 'sso', true, 'flux');
      if (!a) break;
      s = updateReducer(s, { type: 'review', action: a });
    }
    expect(s.stage).toBe('done');
  });

  it('keeps the extension as whole non-negative blocks', () => {
    let s = initialUpdate('sso', draftFromSpec(web, 'sso', 'advanced'));
    s = updateReducer(s, { type: 'extension', blocks: 88_000.9 });
    expect(s.extension).toBe(88_000);
    s = updateReducer(s, { type: 'extension', blocks: -5 });
    expect(s.extension).toBe(0);
  });
});
