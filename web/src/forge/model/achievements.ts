/**
 * Achievements the forge can earn, as a pure observer of edits (docs/CONTENT.md section 6).
 *
 *   three-is-company  the learner sets instances to 3 or more
 *   spec-whisperer    the learner takes a spec from 3 or more errors to none
 *   penny-pincher     the learner builds a valid 3 instance spec with 1 core and 2 GB or more for under $3
 *
 * Only the learner's own edits count (form, JSON, an applied suggestion, undo and redo). A preset, an
 * import, a share link or a solver ("Show me") never earns one: loading a good spec is not the skill.
 */

import type { FluxAppSpec, LintReport, Quote } from '@shared/flux/types';

export type EditOrigin =
  | 'init'
  | 'form'
  | 'json'
  | 'undo'
  | 'redo'
  | 'apply'
  | 'reset'
  | 'import'
  | 'preset'
  | 'share'
  | 'suggestion';

/** Origins that are the learner doing the work. */
const LEARNER: ReadonlySet<EditOrigin> = new Set(['form', 'json', 'suggestion', 'undo', 'redo']);

/** Origins that replace the spec with a different one, so earlier progress no longer applies. */
const NEW_SPEC: ReadonlySet<EditOrigin> = new Set(['init', 'reset', 'import', 'preset', 'share']);

export interface Observation {
  origin: EditOrigin;
  spec: FluxAppSpec;
  lint: Pick<LintReport, 'valid' | 'errors'>;
  quote: Pick<Quote, 'usdPerMonth'>;
  /** Paths changed by this edit (see `diffPaths`). */
  changed: readonly string[];
}

export const PENNY_PINCHER = { instances: 3, minCpu: 1, minRam: 2000, maxUsd: 3 } as const;

export class AchievementTracker {
  private peakErrors = 0;
  private unlocked = new Set<string>();

  constructor(private readonly onUnlock: (id: string) => void) {}

  /** Forget what has been seen (a new lesson step reusing the editor). */
  reset(): void {
    this.peakErrors = 0;
    this.unlocked.clear();
  }

  observe(o: Observation): string[] {
    const earned: string[] = [];
    const grant = (id: string) => {
      if (this.unlocked.has(id)) return;
      this.unlocked.add(id);
      earned.push(id);
      this.onUnlock(id);
    };

    if (NEW_SPEC.has(o.origin)) this.peakErrors = o.lint.errors;
    else this.peakErrors = Math.max(this.peakErrors, o.lint.errors);

    if (!LEARNER.has(o.origin)) return earned;

    if (o.changed.includes('instances') && Number.isInteger(o.spec.instances) && o.spec.instances >= 3) {
      grant('three-is-company');
    }

    if (this.peakErrors >= 3 && o.lint.errors === 0) {
      grant('spec-whisperer');
      this.peakErrors = 0;
    }

    if (o.lint.valid && o.spec.instances === PENNY_PINCHER.instances) {
      let cpu = 0;
      let ram = 0;
      for (const c of o.spec.compose) {
        cpu += c.cpu;
        ram += c.ram;
      }
      if (
        cpu >= PENNY_PINCHER.minCpu - 1e-9 &&
        ram >= PENNY_PINCHER.minRam &&
        o.quote.usdPerMonth < PENNY_PINCHER.maxUsd
      ) {
        grant('penny-pincher');
      }
    }
    return earned;
  }
}
