/**
 * The state machines of the simulator's two submission flows (register and update), as pure reducers.
 * The component layer owns time (timers, the deployment clock) and only dispatches into these; tests drive
 * the same reducers without a DOM.
 *
 * Row order and labels are FACTS 9.4.4 ("Review & Validate (the registration steps)"):
 *   Validate App Spec, Total Cost, Expiry, Signature, Registered, Test Application Installation, Payment.
 */

import { type Account, type Draft, SIM_EMAIL, simpleBlockers } from './model';

export type RowId = 'validate' | 'cost' | 'expiry' | 'signature' | 'registered' | 'test' | 'payment';
export type RowStatus = 'todo' | 'running' | 'done' | 'failed';
export type PayMethod = 'card' | 'flux';

export const ROW_ORDER: readonly RowId[] = [
  'validate',
  'cost',
  'expiry',
  'signature',
  'registered',
  'test',
  'payment',
];

/** FACTS 9.4.4, exact labels. */
export const ROW_LABEL: Record<RowId, string> = {
  validate: 'Validate App Spec',
  cost: 'Total Cost',
  expiry: 'Expiry',
  signature: 'Signature',
  registered: 'Registered',
  test: 'Test Application Installation',
  payment: 'Payment',
};

export interface ReviewState {
  rows: Record<RowId, RowStatus>;
  /** The learner asked the simulated test to fail, to see what FluxCloud does then. */
  testWillFail: boolean;
  /** The test is executing right now. */
  testRunning: boolean;
  /** "Enable Payment Anyway" was used after a failed test. */
  testBypassed: boolean;
  method: PayMethod | null;
  /** Wallet users press "Sign Message"; SSO accounts are signed automatically. */
  signedByHand: boolean;
}

function blankRows(): Record<RowId, RowStatus> {
  return {
    validate: 'todo',
    cost: 'todo',
    expiry: 'todo',
    signature: 'todo',
    registered: 'todo',
    test: 'todo',
    payment: 'todo',
  };
}

export function blankReview(): ReviewState {
  return {
    rows: blankRows(),
    testWillFail: false,
    testRunning: false,
    testBypassed: false,
    method: null,
    signedByHand: false,
  };
}

export type ReviewAction =
  | { type: 'begin' }
  /** An automatic row finished. `ok: false` is only meaningful for `validate`. */
  | { type: 'finish'; row: RowId; ok?: boolean }
  | { type: 'sign' }
  | { type: 'toggleTestFail'; on: boolean }
  | { type: 'runTest' }
  | { type: 'testResult'; ok: boolean }
  | { type: 'bypassTest' }
  | { type: 'method'; method: PayMethod }
  | { type: 'pay' };

function nextOf(row: RowId): RowId | null {
  const i = ROW_ORDER.indexOf(row);
  return ROW_ORDER[i + 1] ?? null;
}

/** Whether a row finishes by itself once it is reached. `signature` depends on the account. */
export function isAutomatic(row: RowId, account: Account): boolean {
  switch (row) {
    case 'validate':
    case 'cost':
    case 'expiry':
    case 'registered':
      return true;
    case 'signature':
      return account === 'sso';
    default:
      return false;
  }
}

/** The row the learner (or the clock) is on: the first that is running. */
export function currentRow(s: ReviewState): RowId | null {
  for (const r of ROW_ORDER) if (s.rows[r] === 'running') return r;
  return null;
}

/** Everything up to and including Payment is finished. */
export function reviewComplete(s: ReviewState): boolean {
  return s.rows.payment === 'done';
}

export function reviewReducer(s: ReviewState, a: ReviewAction): ReviewState {
  switch (a.type) {
    case 'begin': {
      const rows = blankRows();
      rows.validate = 'running';
      return { ...blankReview(), rows, testWillFail: s.testWillFail };
    }
    case 'finish': {
      if (s.rows[a.row] !== 'running') return s;
      const rows = { ...s.rows };
      if (a.row === 'validate' && a.ok === false) {
        rows.validate = 'failed';
        return { ...s, rows };
      }
      rows[a.row] = 'done';
      const n = nextOf(a.row);
      if (n) rows[n] = 'running';
      return { ...s, rows };
    }
    case 'sign': {
      if (s.rows.signature !== 'running') return s;
      const rows = { ...s.rows, signature: 'done' as RowStatus, registered: 'running' as RowStatus };
      return { ...s, rows, signedByHand: true };
    }
    case 'toggleTestFail':
      return { ...s, testWillFail: a.on };
    case 'runTest':
      if (s.rows.test !== 'running' || s.testRunning) return s;
      return { ...s, testRunning: true };
    case 'testResult': {
      if (s.rows.test !== 'running' || !s.testRunning) return s;
      const rows = { ...s.rows };
      if (a.ok) {
        rows.test = 'done';
        rows.payment = 'running';
        return { ...s, rows, testRunning: false };
      }
      rows.test = 'failed';
      return { ...s, rows, testRunning: false };
    }
    case 'bypassTest': {
      if (s.rows.test !== 'failed') return s;
      return { ...s, rows: { ...s.rows, test: 'done', payment: 'running' }, testBypassed: true };
    }
    case 'method':
      return s.rows.payment === 'running' ? { ...s, method: a.method } : s;
    case 'pay': {
      if (s.rows.payment !== 'running' || s.method === null) return s;
      return { ...s, rows: { ...s.rows, payment: 'done' } };
    }
    default:
      return s;
  }
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export type RegisterStage = 'entry' | 'configure' | 'review' | 'deploy';

export interface DeployClock {
  /** Simulated seconds since the payment was sent. */
  t: number;
  /** Simulated seconds until the last event. Set when payment is made. */
  length: number;
  /**
   * Simulated seconds at which FluxCloud's watcher reaches its last screen ("Deployment Successful!" on the
   * first poll that lists a running copy). Absent means the end of the run.
   */
  successAt?: number;
  playing: boolean;
}

export interface RegisterState {
  stage: RegisterStage;
  account: Account;
  draft: Draft;
  review: ReviewState;
  deploy: DeployClock;
  /** The learner opened the Manage page of the new app from the last screen. */
  openedManage: boolean;
}

export function initialRegister(account: Account, draft: Draft): RegisterState {
  return {
    stage: 'entry',
    account,
    draft,
    review: blankReview(),
    deploy: { t: 0, length: 0, playing: false },
    openedManage: false,
  };
}

export type RegisterAction =
  | { type: 'goto'; stage: RegisterStage }
  | { type: 'account'; account: Account }
  | { type: 'draft'; draft: Draft }
  | { type: 'review'; action: ReviewAction }
  /** Payment confirmed in the review. Starts the deployment clock for a timeline of `length` seconds. */
  | { type: 'deploy'; length: number; successAt?: number; autoplay?: boolean }
  | { type: 'tick'; dt: number }
  /** Jump forward to simulated second `t` (the "Next event" button). */
  | { type: 'seek'; t: number }
  | { type: 'playing'; on: boolean }
  | { type: 'skip' }
  | { type: 'openManage' };

/** The last screen is reached: the watcher saw a running copy (or gave up), not necessarily the whole run. */
export function registerDeployed(s: RegisterState): boolean {
  if (s.stage !== 'deploy' || s.deploy.length <= 0) return false;
  return s.deploy.t >= (s.deploy.successAt ?? s.deploy.length);
}

export function registerReducer(s: RegisterState, a: RegisterAction): RegisterState {
  switch (a.type) {
    case 'goto': {
      if (a.stage === 'review') {
        if (simpleBlockersFor(s).length > 0) return s;
        return { ...s, stage: 'review', review: reviewReducer(s.review, { type: 'begin' }) };
      }
      if (a.stage === 'deploy') return s;
      return { ...s, stage: a.stage, review: a.stage === 'configure' ? blankReview() : s.review };
    }
    case 'account':
      return { ...s, account: a.account, draft: withAccountContact(s.draft, a.account) };
    case 'draft':
      return { ...s, draft: a.draft };
    case 'review': {
      if (s.stage !== 'review') return s;
      const next = reviewReducer(s.review, a.action);
      return { ...s, review: next };
    }
    case 'deploy': {
      if (s.stage !== 'review' || !reviewComplete(s.review)) return s;
      return {
        ...s,
        stage: 'deploy',
        deploy: {
          t: 0,
          length: a.length,
          ...(a.successAt === undefined ? {} : { successAt: Math.min(a.successAt, a.length) }),
          playing: a.autoplay !== false,
        },
      };
    }
    case 'tick': {
      if (s.stage !== 'deploy' || !s.deploy.playing) return s;
      const t = Math.min(s.deploy.length, s.deploy.t + Math.max(0, a.dt));
      return { ...s, deploy: { ...s.deploy, t, playing: t < s.deploy.length } };
    }
    case 'seek': {
      if (s.stage !== 'deploy') return s;
      const t = Math.min(s.deploy.length, Math.max(s.deploy.t, a.t));
      return { ...s, deploy: { ...s.deploy, t, playing: s.deploy.playing && t < s.deploy.length } };
    }
    case 'playing':
      return s.stage === 'deploy'
        ? { ...s, deploy: { ...s.deploy, playing: a.on && s.deploy.t < s.deploy.length } }
        : s;
    case 'skip':
      return s.stage === 'deploy' ? { ...s, deploy: { ...s.deploy, t: s.deploy.length, playing: false } } : s;
    case 'openManage':
      return registerDeployed(s) ? { ...s, openedManage: true } : s;
    default:
      return s;
  }
}

function simpleBlockersFor(s: RegisterState): string[] {
  // Simple mode has its own list of what is missing; Advanced is gated by the lint in the review itself.
  return s.draft.mode === 'simple' ? simpleBlockers(s.draft, s.account) : advancedBlockers(s.draft);
}

/** FACTS 9.4.3: the Terms of Service panel gates the form; a name and one component are needed to review. */
export function advancedBlockers(d: Draft): string[] {
  const out: string[] = [];
  if (!d.tos) out.push('Please read and accept the Terms of Service before proceeding to other tabs.');
  return out;
}

function withAccountContact(d: Draft, account: Account): Draft {
  if (account === 'sso') return { ...d, spec: { ...d.spec, contacts: [SIM_EMAIL] } };
  const contacts = d.spec.contacts.filter((c) => c !== SIM_EMAIL);
  return { ...d, spec: { ...d.spec, contacts } };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdateStage = 'change' | 'review' | 'done';

export interface UpdateState {
  stage: UpdateStage;
  account: Account;
  draft: Draft;
  /** Blocks added on top of what is left (0 keeps the original expiry). */
  extension: number;
  review: ReviewState;
}

export function initialUpdate(account: Account, draft: Draft): UpdateState {
  return { stage: 'change', account, draft, extension: 0, review: blankReview() };
}

export type UpdateAction =
  | { type: 'draft'; draft: Draft }
  | { type: 'extension'; blocks: number }
  | { type: 'goto'; stage: 'change' | 'review' }
  | { type: 'review'; action: ReviewAction };

export function updateReducer(s: UpdateState, a: UpdateAction): UpdateState {
  switch (a.type) {
    case 'draft':
      return { ...s, draft: a.draft };
    case 'extension':
      return { ...s, extension: Math.max(0, Math.trunc(a.blocks)) };
    case 'goto': {
      if (a.stage === 'review') {
        return { ...s, stage: 'review', review: reviewReducer(s.review, { type: 'begin' }) };
      }
      return { ...s, stage: 'change', review: blankReview() };
    }
    case 'review': {
      if (s.stage !== 'review') return s;
      const review = reviewReducer(s.review, a.action);
      if (a.action.type === 'pay' && reviewComplete(review)) return { ...s, review, stage: 'done' };
      return { ...s, review };
    }
    default:
      return s;
  }
}

// ---------------------------------------------------------------------------
// Autopilot ("Show me")
// ---------------------------------------------------------------------------

/** What the solver would do next in a review, or null when it is waiting for the clock or the learner. */
export function nextReviewAction(
  s: ReviewState,
  account: Account,
  valid: boolean,
  method: PayMethod,
): ReviewAction | null {
  const row = currentRow(s);
  if (row === null) return null;
  switch (row) {
    case 'validate':
      return { type: 'finish', row, ok: valid };
    case 'cost':
    case 'expiry':
    case 'registered':
      return { type: 'finish', row };
    case 'signature':
      return account === 'sso' ? { type: 'finish', row } : { type: 'sign' };
    case 'test':
      return s.testRunning ? { type: 'testResult', ok: true } : { type: 'runTest' };
    case 'payment':
      return s.method === null ? { type: 'method', method } : { type: 'pay' };
    default:
      return null;
  }
}
