/**
 * The pure half of the `orbit-planner` widget: plans as sizes, their price through the engine, the spec
 * Orbit registers, the Deploy to Flux button URL and its live validation, the goals a lesson may set and
 * the answers "Show me" uses. No React, no DOM, no network.
 *
 * Every number here comes from `shared/flux` (`ORBIT_PLANS`, `orbitPlanQuoteUsd`, `orbitPlanSpec`,
 * `quote`, `tryDeployToFluxUrl`). The widget never types a price. Plan data is a vendor page read on
 * `ORBIT_READ_ON` (DOCS-ONLY); the price of any size is the academy's own formula at the baked rate card
 * (`BAKED_PRICING.capturedAt`), which is why both dates are shown.
 *
 * Facts: FACTS 15.3.10 (plan table), 15.3.11 (plan prices are the formula for the plan's size), 15.3.12
 * (the button URL and what it does), 15.3.16 (what a lesson must not say: no price for a Custom size that
 * is not engine output with its date).
 */

import {
  BAKED_PRICING,
  type DeployToFluxOptions,
  deployToFluxMarkdown,
  deployToFluxUrl,
  type FluxAppSpec,
  ORBIT_CUSTOM,
  ORBIT_PLAN_IDS,
  ORBIT_PLANS,
  type OrbitPlan,
  type OrbitPlanId,
  orbitPlanById,
  orbitPlanQuoteUsd,
  orbitPlanSpec,
  type Quote,
  quote,
  tryDeployToFluxUrl,
} from '@shared/flux';

// ---------------------------------------------------------------------------
// Plans and sizes
// ---------------------------------------------------------------------------

export type PlanKey = OrbitPlanId | 'custom';

/** The three published plans, then Custom: the order of the cards. */
export const PLAN_KEYS: readonly PlanKey[] = [...ORBIT_PLAN_IDS, 'custom'];

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && (PLAN_KEYS as readonly string[]).includes(v);
}

/** What a size is made of. Names follow the plan table, so a plan converts to a size and back. */
export interface Size {
  vcores: number;
  ramMb: number;
  storageGb: number;
  instances: number;
}

export function sizeOf(plan: OrbitPlan): Size {
  return { vcores: plan.vcores, ramMb: plan.ramMb, storageGb: plan.storageGb, instances: plan.instances };
}

/**
 * A plan with another size, for "what would this cost" questions. The id and the flags stay those of
 * `base`; only the numbers the formula reads change, and the name says it is no published plan.
 */
export function atSize(base: OrbitPlan, size: Size): OrbitPlan {
  return {
    ...base,
    name: 'Custom',
    vcores: size.vcores,
    ramMb: size.ramMb,
    storageGb: size.storageGb,
    instances: size.instances,
  };
}

export function sameSize(a: Size, b: Size): boolean {
  return (
    a.vcores === b.vcores && a.ramMb === b.ramMb && a.storageGb === b.storageGb && a.instances === b.instances
  );
}

/** Keep a size inside what the Custom plan allows (FACTS 15.3.10, `ORBIT_CUSTOM`). */
export function clampCustom(size: Size): Size {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    vcores: clamp(size.vcores, ORBIT_CUSTOM.vcoresMin, ORBIT_CUSTOM.vcoresMax),
    ramMb: clamp(size.ramMb, 100, ORBIT_CUSTOM.ramMbMax),
    storageGb: clamp(size.storageGb, ORBIT_CUSTOM.storageGbMin, ORBIT_CUSTOM.storageGbMax),
    instances: clamp(Math.round(size.instances), ORBIT_CUSTOM.instancesMin, ORBIT_CUSTOM.instancesMax),
  };
}

/** The plan a key names. `custom` has no plan of its own: it is built from a base and a size. */
export function planOf(key: PlanKey): OrbitPlan | undefined {
  return key === 'custom' ? undefined : orbitPlanById(key);
}

/** The starting size of the Custom sliders and the base whose flags it borrows. */
export const STANDARD_PLAN: OrbitPlan = orbitPlanById('standard') ?? (ORBIT_PLANS[1] as OrbitPlan);

// ---------------------------------------------------------------------------
// Price: always the engine
// ---------------------------------------------------------------------------

/** The rate card every price in the widget uses. Dated `BAKED_PRICING.capturedAt`. */
export const RATE_PARAMS = BAKED_PRICING.params;
export const RATES_DATE = BAKED_PRICING.capturedAt;

/** Monthly USD of a plan (or of an `atSize` plan) by the formula: `orbitPlanQuoteUsd`, nothing else. */
export function priceOf(plan: OrbitPlan, instances?: number): number {
  return orbitPlanQuoteUsd(plan, RATE_PARAMS, instances === undefined ? {} : { instances });
}

/** The itemised quote behind `priceOf`: the same spec, the same rates. */
export function quoteOf(plan: OrbitPlan): Quote {
  return quote(orbitPlanSpec(plan), RATE_PARAMS);
}

/** What the published plan price and the formula say, side by side. Equal for all three plans. */
export function agreement(plan: OrbitPlan): { published: number; formula: number; same: boolean } {
  const formula = priceOf(plan);
  return { published: plan.usd, formula, same: formula === plan.usd };
}

// ---------------------------------------------------------------------------
// What a size means for failure, and the other plan features
// ---------------------------------------------------------------------------

export interface Facts {
  /** One plain sentence about a node that restarts or dies. */
  failover: string;
  /** True when a second instance exists, so one copy can fail. */
  survivesNodeLoss: boolean;
  persistentFolders: string;
  secondPort: string;
}

/**
 * The plan features, in the page's words where the page states them. `key` is the plan; `size` is the
 * size on screen (equal to the plan's for a published plan, the sliders' for Custom).
 */
export function factsOf(key: PlanKey, size: Size): Facts {
  const plan = planOf(key);
  const two = size.instances >= 2;
  const failover =
    key === 'starter'
      ? 'One instance. The page says brief downtime may occur if its node restarts.'
      : !two
        ? 'One instance, so the app is down while its node is.'
        : key === 'custom'
          ? `${size.instances} instances, so one copy can fail and the others keep answering.`
          : `${size.instances} instances, which the page calls failover: one copy can fail and the other keeps answering.`;
  const persistentFolders =
    key === 'custom'
      ? two
        ? 'Yes, because there are 2 or more instances.'
        : `Not with one instance (the page says ${ORBIT_CUSTOM.persistentFoldersMinInstances} or more).`
      : plan?.persistentFolders
        ? 'Yes.'
        : 'No.';
  const secondPort = key === 'custom' ? 'Yes.' : plan?.secondPort ? 'Yes.' : 'No.';
  return { failover, survivesNodeLoss: two, persistentFolders, secondPort };
}

// ---------------------------------------------------------------------------
// The spec Orbit registers, as an excerpt
// ---------------------------------------------------------------------------

/** The placeholder repository the excerpt shows (never a real one). */
export const EXCERPT_REPO = 'https://github.com/example/app';

/**
 * The fields of the generated spec a reader needs, as JSON text. The full spec has a placeholder owner and
 * empty lists; the excerpt keeps what makes it an Orbit app: image, ports, variables and the size.
 */
export function specExcerpt(spec: FluxAppSpec): string {
  const c = spec.compose[0];
  const excerpt = {
    name: spec.name,
    description: spec.description,
    instances: spec.instances,
    compose: c
      ? [
          {
            name: c.name,
            repotag: c.repotag,
            ports: c.ports,
            containerPorts: c.containerPorts,
            environmentParameters: c.environmentParameters,
            containerData: c.containerData,
            cpu: c.cpu,
            ram: c.ram,
            hdd: c.hdd,
          },
        ]
      : [],
  };
  return JSON.stringify(excerpt, null, 2);
}

export function excerptOf(plan: OrbitPlan): string {
  return specExcerpt(orbitPlanSpec(plan, { repo: EXCERPT_REPO }));
}

// ---------------------------------------------------------------------------
// The Deploy to Flux button
// ---------------------------------------------------------------------------

export type ButtonField = 'repo' | 'branch' | 'projectPath' | 'plan';

export const BUTTON_FIELDS: readonly ButtonField[] = ['repo', 'branch', 'projectPath', 'plan'];

/** What the four inputs hold. Empty text means "leave it out", which the page allows for the last three. */
export interface ButtonDraft {
  repo: string;
  branch: string;
  projectPath: string;
  plan: string;
}

export const EMPTY_DRAFT: ButtonDraft = { repo: '', branch: '', projectPath: '', plan: '' };

/** A valid repository to test the optional fields against, so one bad field never hides another. */
const PROBE_REPO = 'https://github.com/example/app';

/** Options for the engine: an empty optional field is left out, as the page documents. */
export function toOptions(d: ButtonDraft): DeployToFluxOptions {
  const o: DeployToFluxOptions = { repo: d.repo };
  if (d.branch !== '') o.branch = d.branch;
  if (d.projectPath !== '') o.projectPath = d.projectPath;
  if (d.plan !== '') o.plan = d.plan;
  return o;
}

export interface ButtonEvaluation {
  ok: boolean;
  /** The link, when every field is accepted. */
  url: string | null;
  /** The README badge for the same link. */
  markdown: string | null;
  /** The engine's own message for each field it refuses. */
  errors: Partial<Record<ButtonField, string>>;
}

/**
 * Live validation. Each field is checked against the engine on its own (the others replaced by something
 * valid), so a form shows every problem at once instead of the first one. When all four pass, the link and
 * the badge are the engine's output for the whole draft.
 */
export function evaluateButton(d: ButtonDraft): ButtonEvaluation {
  const errors: Partial<Record<ButtonField, string>> = {};
  const repo = tryDeployToFluxUrl({ repo: d.repo });
  if (!repo.ok) errors.repo = repo.message;
  const probe = (field: Exclude<ButtonField, 'repo'>) => {
    if (d[field] === '') return;
    const r = tryDeployToFluxUrl({ repo: PROBE_REPO, [field]: d[field] });
    if (!r.ok && r.field === field) errors[field] = r.message;
  };
  probe('branch');
  probe('projectPath');
  probe('plan');
  if (Object.keys(errors).length > 0) return { ok: false, url: null, markdown: null, errors };
  const o = toOptions(d);
  return { ok: true, url: deployToFluxUrl(o), markdown: deployToFluxMarkdown(o), errors };
}

/**
 * The same button, with the harmless variants folded together: a trailing `.git` or slash on the repository
 * and a trailing slash on the project path name the same thing. Used to grade, never to rewrite the form.
 */
export function canonicalOptions(o: DeployToFluxOptions): DeployToFluxOptions {
  const out: DeployToFluxOptions = { repo: o.repo.replace(/\/+$/, '').replace(/\.git$/i, '') };
  if (o.branch !== undefined) out.branch = o.branch;
  if (o.projectPath !== undefined) out.projectPath = o.projectPath.replace(/\/+$/, '');
  if (o.plan !== undefined) out.plan = o.plan;
  return out;
}

/** The link the engine builds for `o` after `canonicalOptions`, or null when the engine refuses it. */
function canonicalUrl(o: DeployToFluxOptions): string | null {
  const r = tryDeployToFluxUrl(canonicalOptions(o));
  return r.ok ? r.url : null;
}

/** Whether the draft builds the same link as the expected inputs. */
export function buttonMatches(d: ButtonDraft, expected: DeployToFluxOptions): boolean {
  const want = canonicalUrl(expected);
  return want !== null && canonicalUrl(toOptions(d)) === want;
}

/** The draft that builds `expected`, for "Show me" and for the starting point of a lesson. */
export function draftOf(o: DeployToFluxOptions): ButtonDraft {
  return { repo: o.repo, branch: o.branch ?? '', projectPath: o.projectPath ?? '', plan: o.plan ?? '' };
}

/**
 * What differs between a draft that is accepted and the link that was asked for, as a short phrase for
 * the goal line. Null when they match or the draft is not accepted yet.
 */
export function differsFrom(d: ButtonDraft, expected: DeployToFluxOptions): string | null {
  const have = canonicalOptions(toOptions(d));
  const want = canonicalOptions(expected);
  const names: Record<ButtonField, string> = {
    repo: 'the repository',
    branch: 'the branch',
    projectPath: 'the project path',
    plan: 'the plan',
  };
  const diff = BUTTON_FIELDS.filter((f) => (have[f] ?? '') !== (want[f] ?? ''));
  if (diff.length === 0) return null;
  const words = diff.map((f) => names[f]);
  const last = words.pop();
  return words.length > 0 ? `${words.join(', ')} and ${last}` : (last ?? null);
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type Goal =
  /** A Custom size with at least `minInstances` instances that the formula prices below a plan. */
  | { kind: 'custom'; minInstances: number; cheaperThan: OrbitPlanId }
  /** A button that builds the same link as `expected`. */
  | { kind: 'url'; expected: DeployToFluxOptions };

export function customGoalMet(goal: Extract<Goal, { kind: 'custom' }>, size: Size): boolean {
  const ceiling = orbitPlanById(goal.cheaperThan);
  if (!ceiling) return false;
  return size.instances >= goal.minInstances && priceOf(atSize(STANDARD_PLAN, size)) < priceOf(ceiling);
}

/**
 * A size that meets a custom goal, for "Show me". It starts from `from` and gives up the dearest thing
 * first (CPU), then RAM, then disk, keeping the instances the goal asks for, and stops at the first size
 * that is cheap enough. Null when nothing in the Custom range meets the goal.
 */
export function solveCustom(goal: Extract<Goal, { kind: 'custom' }>, from: Size): Size | null {
  const base: Size = { ...from, instances: Math.max(from.instances, goal.minInstances) };
  const cpuStops = [1.5, 1.4, 1.3, 1.2, 1.1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
  const ramStops = [4000, 3000, 2000, 1000, 500, 100];
  const hddStops = [15, 10, 5, 1];
  const tries: Size[] = [];
  for (const vcores of cpuStops.filter((v) => v <= base.vcores)) tries.push({ ...base, vcores });
  for (const ramMb of ramStops.filter((v) => v <= base.ramMb)) {
    for (const vcores of cpuStops.filter((v) => v <= base.vcores)) tries.push({ ...base, vcores, ramMb });
  }
  for (const storageGb of hddStops.filter((v) => v <= base.storageGb)) {
    for (const ramMb of ramStops.filter((v) => v <= base.ramMb)) {
      for (const vcores of cpuStops.filter((v) => v <= base.vcores)) {
        tries.push({ ...base, vcores, ramMb, storageGb });
      }
    }
  }
  for (const t of tries) if (customGoalMet(goal, t)) return t;
  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PlannerProps {
  /** Which half the step is about. */
  view: 'plans' | 'button';
  /** The card selected first (plans view). */
  plan: PlanKey;
  goal: Goal | null;
  /** The starting values of the builder (button view). A lesson plants its mistakes here. */
  draft: ButtonDraft;
}

function record(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function readOptions(raw: unknown): DeployToFluxOptions | null {
  const r = record(raw);
  const repo = str(r?.repo);
  if (!r || repo === undefined) return null;
  const o: DeployToFluxOptions = { repo };
  const branch = str(r.branch);
  const projectPath = str(r.projectPath);
  const plan = str(r.plan);
  if (branch !== undefined) o.branch = branch;
  if (projectPath !== undefined) o.projectPath = projectPath;
  if (plan !== undefined) o.plan = plan;
  return o;
}

function readGoal(raw: unknown): Goal | null {
  const r = record(raw);
  if (!r) return null;
  if (r.kind === 'custom') {
    const cheaper = str(r.cheaperThan);
    const plan = cheaper !== undefined ? orbitPlanById(cheaper) : undefined;
    const min = typeof r.minInstances === 'number' ? Math.round(r.minInstances) : 2;
    if (!plan) return null;
    return { kind: 'custom', minInstances: Math.max(1, min), cheaperThan: plan.id };
  }
  if (r.kind === 'url') {
    const expected = readOptions(r.expected);
    return expected ? { kind: 'url', expected } : null;
  }
  return null;
}

export function readProps(raw: Record<string, unknown> | undefined): PlannerProps {
  const view = raw?.view === 'button' ? 'button' : 'plans';
  const plan = isPlanKey(raw?.plan) ? raw.plan : 'standard';
  const draft = record(raw?.draft);
  return {
    view,
    plan,
    goal: readGoal(raw?.goal),
    draft: {
      repo: str(draft?.repo) ?? '',
      branch: str(draft?.branch) ?? '',
      projectPath: str(draft?.projectPath) ?? '',
      plan: str(draft?.plan) ?? '',
    },
  };
}

/** The options of the plan select: the page's three values, and the older one a README may still carry. */
export const BUTTON_PLAN_VALUES: readonly string[] = [...ORBIT_PLAN_IDS, 'free'];
