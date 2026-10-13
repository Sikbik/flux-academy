/**
 * The forge session: one editable spec, its history, its text, its lint and its price.
 *
 * Framework-free, synchronous and testable. React binds to it with `useSyncExternalStore`; nothing in here
 * knows about components. The invariants worth knowing:
 *
 *   - `spec` is always a full, normalised v8 spec and is the only thing history stores.
 *   - `text` is what the JSON panel shows. It follows `spec` after every form edit, but while the learner
 *     types in the JSON panel it is THEIR text: it is never rewritten under them, and a text that does not
 *     parse leaves `spec` (and so the form, the lint and the price) on the last good value.
 *   - lint and quote are derived and memoised by identity, so an unrelated change costs nothing.
 *   - `editable` and `readOnly` are enforced here, not only in the form: text edits, imports and presets
 *     cannot change a locked path either. A solver (`apply`) is the one caller that may.
 */

import { defaultSpec, normalizeSpec } from '@shared/flux/spec';
import type { FluxAppSpec, LintReport, Quote } from '@shared/flux/types';
import { applySolution, buildSpec, type SpecTools } from '@/learn/specs';
import type { DeepPartial } from '@/learn/types';
import type { EditOrigin } from './achievements';
import { BAKED_CONTEXT, type LintContext, lintInput, type PricingContext, priceSpec } from './engine';
import { UndoStack } from './history';
import { type JsonNode, type JsonProblem, parseJsonText, specToText } from './jsonText';
import { diffPaths, isPathEditable, sameJson } from './paths';
import { restrictToEditable } from './restrict';

export type ChangeOrigin = EditOrigin;

export const SPEC_TOOLS: SpecTools = { normalizeSpec, defaultSpec };

/**
 * How the forge lints unless told otherwise. The lesson validator verifies lint-based checks with
 * `lintSpec(spec, { teaching: true })`, so the forge does the same: the codes it reports in a `spec`
 * TaskEvent are then exactly the codes the validator expects. Anything richer (the live node count) is
 * opt-in through `lintContext`.
 */
export const DEFAULT_LINT_CONTEXT: LintContext = Object.freeze({ teaching: true });

/** A spec for a stage or challenge: the defaults with the author's partial merged over them. */
export function specFromPartial(partial?: DeepPartial<FluxAppSpec> | FluxAppSpec | null): FluxAppSpec {
  return buildSpec(SPEC_TOOLS, partial as DeepPartial<FluxAppSpec> | null | undefined);
}

export interface TextState {
  /** What the JSON panel shows. */
  text: string;
  /** The parsed tree of `text` when it is valid JSON, for locating lint issues. */
  tree: JsonNode | null;
  /** Why `text` is not valid JSON; the spec is then the last good one. */
  error: JsonProblem | null;
  /** True when `text` is not what the editor would print for the spec (the learner's layout, or broken). */
  custom: boolean;
  /** Paths from the last text edit that were put back because they are locked in this step. */
  ignored: string[];
  /** Plain-language notes from reading the text (a version changed, keys dropped, types converted). */
  notes: string[];
}

export interface ForgeSnapshot {
  /** Increments on every change of anything below. */
  revision: number;
  spec: FluxAppSpec;
  lint: LintReport;
  quote: Quote;
  text: TextState;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  /** What caused the last change. */
  origin: ChangeOrigin;
  /** Paths the last change touched (shortest form). */
  changed: readonly string[];
  pricing: PricingContext;
  readOnly: boolean;
  editable: readonly string[] | undefined;
}

export interface SessionOptions {
  initial: FluxAppSpec;
  editable?: readonly string[];
  readOnly?: boolean;
  pricing?: PricingContext;
  lintContext?: LintContext;
  historyLimit?: number;
  coalesceMs?: number;
  /** Clock for history coalescing; tests inject one. */
  now?: () => number;
}

interface CommitOptions {
  origin: ChangeOrigin;
  key?: string | null;
  label?: string;
  /** What lint should read: the raw parsed JSON for text edits, the spec otherwise. */
  raw?: unknown;
  text?: TextState;
  history?: boolean;
}

export class ForgeSession {
  private spec: FluxAppSpec;
  private raw: unknown;
  private text: TextState;
  private origin: ChangeOrigin = 'init';
  private changed: string[] = [];
  private revision = 0;
  private editable: readonly string[] | undefined;
  private readOnly: boolean;
  private pricing: PricingContext;
  private lintCtx: LintContext;
  private readonly history: UndoStack<FluxAppSpec>;
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();
  private snap: ForgeSnapshot;

  private lintMemo: { raw: unknown; ctx: LintContext; report: LintReport } | null = null;
  private quoteMemo: { spec: FluxAppSpec; pricing: PricingContext; quote: Quote } | null = null;

  constructor(opts: SessionOptions) {
    this.spec = opts.initial;
    this.raw = opts.initial;
    this.editable = opts.editable;
    this.readOnly = opts.readOnly ?? false;
    this.pricing = opts.pricing ?? BAKED_CONTEXT;
    this.lintCtx = opts.lintContext ?? DEFAULT_LINT_CONTEXT;
    this.now = opts.now ?? (() => Date.now());
    this.history = new UndoStack(opts.initial, { limit: opts.historyLimit, coalesceMs: opts.coalesceMs });
    this.text = this.textFor(opts.initial);
    this.snap = this.build();
  }

  // ---- reading -----------------------------------------------------------------------------------------

  getSnapshot = (): ForgeSnapshot => this.snap;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Whether the learner may change a path (form controls ask this to show locks). */
  canEdit(path: string): boolean {
    return !this.readOnly && isPathEditable(path, this.editable);
  }

  // ---- configuration -------------------------------------------------------------------------------------

  setOptions(opts: { editable?: readonly string[] | undefined; readOnly?: boolean }): void {
    const sameEditable =
      this.editable === opts.editable ||
      (this.editable !== undefined &&
        opts.editable !== undefined &&
        this.editable.length === opts.editable.length &&
        this.editable.every((p, i) => p === opts.editable?.[i]));
    const readOnly = opts.readOnly ?? false;
    if (sameEditable && readOnly === this.readOnly) return;
    this.editable = opts.editable;
    this.readOnly = readOnly;
    this.publish();
  }

  /** New rates (live, cached or baked). Re-prices; nothing else changes. */
  setPricing(pricing: PricingContext): void {
    const same =
      pricing.fluxUsd === this.pricing.fluxUsd &&
      pricing.source === this.pricing.source &&
      pricing.fluxSource === this.pricing.fluxSource &&
      pricing.asOf === this.pricing.asOf &&
      pricing.params === this.pricing.params;
    if (same) return;
    this.pricing = pricing;
    this.publish();
  }

  /** New context for the linter (eligible node count, taken names, teaching infos). */
  setLintContext(ctx: LintContext): void {
    const same =
      ctx.eligibleNodes === this.lintCtx.eligibleNodes &&
      ctx.teaching === this.lintCtx.teaching &&
      ctx.takenNames === this.lintCtx.takenNames;
    if (same) return;
    this.lintCtx = ctx;
    this.publish();
  }

  // ---- editing --------------------------------------------------------------------------------------------

  /**
   * Change the spec through a pure function (the operations in `ops.ts`). `paths` are the JSON paths the
   * change touches; if any is locked nothing happens and false is returned. While the JSON text does not
   * parse the form is paused too (false): applying a form edit would replace the text the learner is in the
   * middle of writing, and the text is never clobbered. Undo or "Discard my edit" ends the pause.
   */
  edit(
    paths: readonly string[],
    fn: (spec: FluxAppSpec) => FluxAppSpec,
    opts: { key?: string | null; label?: string; origin?: ChangeOrigin } = {},
  ): boolean {
    if (this.readOnly || this.text.error) return false;
    for (const p of paths) if (!isPathEditable(p, this.editable)) return false;
    const next = fn(this.spec);
    if (Object.is(next, this.spec)) return false;
    this.commit(next, {
      origin: opts.origin ?? 'form',
      key: opts.key === undefined ? (paths[0] ?? null) : opts.key,
      label: opts.label ?? `Change ${paths[0] ?? 'spec'}`,
    });
    return true;
  }

  /** Replace the spec with a different one (import, preset, share link). Locked paths keep their value. */
  replace(
    next: unknown,
    origin: 'import' | 'preset' | 'share',
    label?: string,
  ): { ok: boolean; ignored: string[] } {
    if (this.readOnly) return { ok: false, ignored: [] };
    const norm = normalizeSpec(next);
    const { value, rejected } = restrictToEditable(this.spec, norm.spec, this.editable);
    this.commit(value, {
      origin,
      key: null,
      label:
        label ??
        (origin === 'preset' ? 'Load preset' : origin === 'share' ? 'Open shared spec' : 'Import JSON'),
      raw: rejected.length === 0 ? next : value,
    });
    if (rejected.length) this.text = { ...this.text, ignored: rejected };
    this.publish();
    return { ok: true, ignored: rejected };
  }

  /**
   * Apply a partial spec the way a lesson's "Show me" does, as one undoable step. Not subject to `editable`.
   * It is merged over the current spec, or over `from` (a full or partial spec) when one is given: a lesson
   * writes its solution for the spec a step starts from, and the learner's own edits may stand in its way.
   */
  apply(partial: DeepPartial<FluxAppSpec>, from?: DeepPartial<FluxAppSpec> | FluxAppSpec): void {
    const next = applySolution(SPEC_TOOLS, from ?? this.spec, partial);
    this.commit(next, { origin: 'apply', key: null, label: 'Apply solution' });
  }

  /** Start over from `spec`: history is cleared and the text follows the spec. */
  reset(spec: FluxAppSpec): void {
    this.history.reset(spec);
    this.spec = spec;
    this.raw = spec;
    this.text = this.textFor(spec);
    this.origin = 'reset';
    this.changed = [];
    this.revision++;
    this.publish();
  }

  undo(): boolean {
    // A broken text edit is undone first: it never reached the history.
    if (this.text.error || this.text.custom) {
      if (this.text.error) {
        this.revertText();
        return true;
      }
    }
    const prev = this.history.undo();
    if (prev === null) return false;
    this.commit(prev, { origin: 'undo', history: false });
    return true;
  }

  redo(): boolean {
    const next = this.history.redo();
    if (next === null) return false;
    this.commit(next, { origin: 'redo', history: false });
    return true;
  }

  // ---- the JSON text -----------------------------------------------------------------------------------------

  /** The learner typed in the JSON panel. Never throws; a bad text keeps the last good spec. */
  setText(text: string): void {
    if (this.readOnly) return;
    if (text === this.text.text && !this.text.error) return;
    const parsed = parseJsonText(text);
    if (!parsed.ok) {
      this.text = { text, tree: null, error: parsed.error, custom: true, ignored: [], notes: [] };
      this.origin = 'json';
      this.changed = [];
      this.revision++;
      this.publish();
      return;
    }
    const norm = normalizeSpec(parsed.value);
    const { value, rejected } = restrictToEditable(this.spec, norm.spec, this.editable);
    const next = sameJson(value, this.spec) ? this.spec : value;
    const keepRaw = rejected.length === 0;
    this.commit(next, {
      origin: 'json',
      key: 'json',
      label: 'Edit JSON',
      raw: keepRaw ? parsed.value : next,
      text: {
        text,
        tree: parsed.root,
        error: null,
        custom: text !== specToText(next),
        ignored: rejected,
        notes: norm.notes,
      },
    });
  }

  /** Throw away a text that does not parse (or the learner's layout) and show the spec as the editor prints it. */
  revertText(): void {
    this.text = this.textFor(this.spec);
    this.raw = this.spec;
    this.origin = 'json';
    this.revision++;
    this.publish();
  }

  // ---- internals ------------------------------------------------------------------------------------------------

  private textFor(spec: FluxAppSpec): TextState {
    const text = specToText(spec);
    const parsed = parseJsonText(text);
    return {
      text,
      tree: parsed.ok ? parsed.root : null,
      error: null,
      custom: false,
      ignored: [],
      notes: [],
    };
  }

  private commit(next: FluxAppSpec, o: CommitOptions): void {
    const prev = this.spec;
    const changed = !Object.is(next, prev) && !sameJson(next, prev);
    const effective = changed ? next : prev;
    if (changed && o.history !== false) {
      this.history.push(effective, { key: o.key ?? null, label: o.label, now: this.now() });
    }
    this.spec = effective;
    this.raw = o.raw ?? effective;
    this.changed = changed ? diffPaths(prev, effective) : [];
    this.text = o.text ?? this.textFor(effective);
    this.origin = o.origin;
    this.revision++;
    this.publish();
  }

  private lint(): LintReport {
    const m = this.lintMemo;
    if (m && m.raw === this.raw && m.ctx === this.lintCtx) return m.report;
    const report = lintInput(this.raw, this.lintCtx);
    this.lintMemo = { raw: this.raw, ctx: this.lintCtx, report };
    return report;
  }

  private price(): Quote {
    const m = this.quoteMemo;
    if (m && m.spec === this.spec && m.pricing === this.pricing) return m.quote;
    const quote = priceSpec(this.spec, this.pricing);
    this.quoteMemo = { spec: this.spec, pricing: this.pricing, quote };
    return quote;
  }

  private build(): ForgeSnapshot {
    return {
      revision: this.revision,
      spec: this.spec,
      lint: this.lint(),
      quote: this.price(),
      text: this.text,
      canUndo: this.history.canUndo || this.text.error !== null,
      canRedo: this.history.canRedo,
      undoLabel: this.text.error ? 'Discard the unfinished JSON' : this.history.undoLabel,
      redoLabel: this.history.redoLabel,
      origin: this.origin,
      changed: this.changed,
      pricing: this.pricing,
      readOnly: this.readOnly,
      editable: this.editable,
    };
  }

  private publish(): void {
    this.snap = this.build();
    for (const l of [...this.listeners]) {
      try {
        l();
      } catch (e) {
        console.error('[forge] a session listener threw', e);
      }
    }
  }
}

/** Build a session from a stage's partial spec. */
export function createSession(
  partial: DeepPartial<FluxAppSpec> | FluxAppSpec | null | undefined,
  opts: Omit<SessionOptions, 'initial'> = {},
): ForgeSession {
  return new ForgeSession({ ...opts, initial: specFromPartial(partial) });
}
