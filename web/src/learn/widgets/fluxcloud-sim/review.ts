/**
 * The "Review & Validate" computation of the FluxCloud simulator: lint, price, expiry and the structural
 * warnings of an update. Pure functions over the shared engine; nothing here computes a price or a rule
 * itself (docs/ARCHITECTURE.md section 4.2). The widget only decides which pieces to show and when.
 */

import {
  blocksToSeconds,
  type FluxAppSpec,
  isSurchargePort,
  type LintIssue,
  lintSpec,
  MAX_EXPIRE_BLOCKS,
  type PricingParams,
  type Quote,
  quote,
  type UpdateCredit,
  updateCredit,
} from '@shared/flux';

/** Lint codes that mean "this is a public spec". The simulator registers Enterprise apps without encrypting. */
const ENTERPRISE_ANSWERS = new Set(['REPOAUTH_NEEDS_ENTERPRISE', 'ENV_SECRET_PUBLIC']);

/** A placeholder that makes the engine price the spec as an Enterprise app. Never shown. */
const ENTERPRISE_PLACEHOLDER = 'simulated-enterprise-blob';

export interface PreviousApp {
  /** The spec that is running now. */
  spec: FluxAppSpec;
  /** Blocks of the running subscription that are left. */
  blocksRemaining: number;
}

export interface ReviewContext {
  params: PricingParams;
  fluxUsd: number | null;
  paramsSource: 'live' | 'cache' | 'baked';
  /** Names that are already registered, any case. */
  takenNames: readonly string[];
  /** Tip of the chain, for the expiry height. */
  currentHeight: number;
  /** Wall clock in ms, for the expiry date. */
  nowMs: number;
  /** Set for an update (and a renewal): the running app. */
  previous?: PreviousApp;
  /** Blocks added on top of what is left. Updates only. */
  extension?: number;
  /** The app is registered as Enterprise (encrypted). Priced as such, lint answered. */
  enterprise?: boolean;
}

export interface ReviewResult {
  /** Every issue the engine found, errors first. */
  issues: LintIssue[];
  errors: LintIssue[];
  warnings: LintIssue[];
  infos: LintIssue[];
  /** No errors: the network would accept the spec. */
  valid: boolean;
  /** The spec that was linted and priced (an update's `expire` is what is left plus the extension). */
  spec: FluxAppSpec;
  quote: Quote;
  /** The credit for the unused part of the running subscription (updates only). */
  credit: UpdateCredit | null;
  /** Length of the subscription this message creates, in blocks. */
  expireBlocks: number;
  /** Height at which it ends. */
  expiryHeight: number;
  /** Estimated wall clock end, in ms. */
  expiryMs: number;
}

/** The subscription an update message carries: what is left, plus the extension, never beyond one year. */
export function updateExpire(remaining: number, extension: number): number {
  const total = Math.max(1, Math.trunc(remaining) + Math.max(0, Math.trunc(extension)));
  return Math.min(total, MAX_EXPIRE_BLOCKS);
}

/** Lint, price and date one spec. Never throws. */
export function review(spec: FluxAppSpec, ctx: ReviewContext): ReviewResult {
  const enterprise = ctx.enterprise === true;
  const prev = ctx.previous;
  const expireBlocks = prev ? updateExpire(prev.blocksRemaining, ctx.extension ?? 0) : spec.expire;
  const plain: FluxAppSpec = { ...spec, enterprise: '', expire: expireBlocks };

  const report = lintSpec(plain, { takenNames: prev ? [] : ctx.takenNames });
  const issues = enterprise ? report.issues.filter((i) => !ENTERPRISE_ANSWERS.has(i.code)) : report.issues;
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  const priced: FluxAppSpec = enterprise ? { ...plain, enterprise: ENTERPRISE_PLACEHOLDER } : plain;
  const credit = prev ? updateCredit(prev.spec, ctx.params, prev.blocksRemaining, prev.spec.expire) : null;
  const q = quote(priced, ctx.params, {
    fluxUsd: ctx.fluxUsd,
    paramsSource: ctx.paramsSource,
    ...(credit ? { creditUsd: credit.creditUsd } : {}),
  });

  return {
    issues,
    errors,
    warnings,
    infos,
    valid: errors.length === 0,
    spec: plain,
    quote: q,
    credit,
    expireBlocks,
    expiryHeight: ctx.currentHeight + expireBlocks,
    expiryMs: ctx.nowMs + blocksToSeconds(expireBlocks) * 1000,
  };
}

// ---------------------------------------------------------------------------
// What an update changes (FACTS 9.5.4 and 4.5)
// ---------------------------------------------------------------------------

export interface UpdateChanges {
  /** FACTS 9.5.4: components added, removed or renamed, a disk size changed or the spec version raised. */
  hard: boolean;
  /** Plain reasons, in the order FluxCloud lists the causes. */
  hardReasons: string[];
  /** FACTS 9.5.4: "Resource requirements increased". */
  resourcesIncreased: boolean;
  /** Which fields changed, for the summary line. */
  changed: string[];
}

function enterprisePorts(spec: FluxAppSpec): number {
  let n = 0;
  for (const c of spec.compose) for (const p of c.ports) if (isSurchargePort(p)) n += 1;
  return n;
}

/** Compare the running spec with the new one, the way the review step words it. */
export function updateChanges(prev: FluxAppSpec, next: FluxAppSpec): UpdateChanges {
  const hardReasons: string[] = [];
  if (next.version > prev.version) hardReasons.push('The specification version is upgraded.');
  const prevNames = prev.compose.map((c) => c.name);
  const nextNames = next.compose.map((c) => c.name);
  const added = nextNames.filter((n) => !prevNames.includes(n));
  const removed = prevNames.filter((n) => !nextNames.includes(n));
  if (added.length > 0 && removed.length > 0) {
    hardReasons.push(`A component is renamed or replaced (${removed.join(', ')} to ${added.join(', ')}).`);
  } else if (added.length > 0) {
    hardReasons.push(`A component is added (${added.join(', ')}).`);
  } else if (removed.length > 0) {
    hardReasons.push(`A component is removed (${removed.join(', ')}).`);
  }
  const diskChanged: string[] = [];
  let increased = false;
  const changed: string[] = [];
  for (const c of next.compose) {
    const old = prev.compose.find((p) => p.name === c.name);
    if (!old) continue;
    if (old.hdd !== c.hdd) diskChanged.push(c.name);
    if (c.cpu > old.cpu || c.ram > old.ram || c.hdd > old.hdd) increased = true;
    if (old.repotag !== c.repotag) changed.push(`image of ${c.name}`);
    if (old.cpu !== c.cpu) changed.push(`CPU of ${c.name}`);
    if (old.ram !== c.ram) changed.push(`RAM of ${c.name}`);
    if (old.hdd !== c.hdd) changed.push(`disk of ${c.name}`);
    if (old.environmentParameters.join('\n') !== c.environmentParameters.join('\n')) {
      changed.push(`environment of ${c.name}`);
    }
    if (old.commands.join('\n') !== c.commands.join('\n')) changed.push(`commands of ${c.name}`);
    if (old.containerData !== c.containerData) changed.push(`data path of ${c.name}`);
    if (
      old.ports.join(',') !== c.ports.join(',') ||
      old.containerPorts.join(',') !== c.containerPorts.join(',')
    ) {
      changed.push(`ports of ${c.name}`);
    }
  }
  if (diskChanged.length > 0) {
    hardReasons.push(`The disk size of ${diskChanged.join(', ')} changes, so its volume is recreated.`);
  }
  if (prev.instances !== next.instances) changed.push('instances');
  if (prev.staticip !== next.staticip) changed.push('static IP');
  if (prev.expire !== next.expire) changed.push('subscription');
  if (added.length > 0 || removed.length > 0) changed.push('components');
  return { hard: hardReasons.length > 0, hardReasons, resourcesIncreased: increased, changed };
}

/**
 * FACTS 4.5 and 9.5.4: the rule behind "Free update". The simulator does NOT apply it to the price it shows
 * (the brief for this widget: not modelled); it only reports whether a change meets it, so the note can say
 * what FluxCloud would do. The rate limits (5 updates in 720 blocks, and so on) are not checked.
 */
export function meetsFreeUpdateRule(prev: FluxAppSpec, next: FluxAppSpec, extensionBlocks: number): boolean {
  if (extensionBlocks > 8) return false;
  if (prev.instances !== next.instances) return false;
  if (prev.staticip !== next.staticip) return false;
  if (prev.nodes.length !== next.nodes.length) return false;
  if (prev.compose.length !== next.compose.length) return false;
  for (let i = 0; i < next.compose.length; i++) {
    const a = prev.compose[i];
    const b = next.compose[i];
    if (!a || !b) return false;
    if (b.cpu > a.cpu || b.ram > a.ram || b.hdd > a.hdd) return false;
  }
  return enterprisePorts(next) <= enterprisePorts(prev);
}
