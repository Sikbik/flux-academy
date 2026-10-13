/**
 * Shared types for the lesson validator: problems, the collector and the injected dependencies.
 * Pure. See `validate.ts` for the rules.
 */

import type { LessonMeta } from '@shared/curriculum';
import type { LessonEngine } from './engine';

export type Severity = 'error' | 'warning' | 'info';

export interface Problem {
  severity: Severity;
  /** Stable kebab-case rule code, for example `steps-count` or `solution-fails-check`. */
  code: string;
  /** Where in the lesson, for example `steps[2 "ports"].task.check`. */
  path: string;
  message: string;
}

export class Collector {
  readonly problems: Problem[] = [];

  add(severity: Severity, code: string, path: string, message: string): void {
    this.problems.push({ severity, code, path, message });
  }

  error(code: string, path: string, message: string): void {
    this.add('error', code, path, message);
  }

  warn(code: string, path: string, message: string): void {
    this.add('warning', code, path, message);
  }

  info(code: string, path: string, message: string): void {
    this.add('info', code, path, message);
  }
}

/** Everything the validator needs from outside, so the rules stay pure and testable with fakes. */
export interface ValidateDeps {
  /** The curriculum: lesson metadata (`LESSONS`). */
  lessons: readonly Pick<LessonMeta, 'id' | 'kind'>[];
  /** The labs (`LABS`). */
  labs: readonly { id: string }[];
  /** Every glossary term id. */
  glossary: ReadonlySet<string>;
  /** The domain engine: normalise, default, lint, price. */
  engine: LessonEngine;
  /** Stage kinds, diagram ids and widget ids. Default: the catalog. */
  stageKinds?: readonly string[];
  diagramIds?: readonly string[];
  widgetIds?: readonly string[];
  /**
   * Beats per diagram id, taken from the diagram modules (`meta.beats.length`) when they exist. Falls back
   * to the table in the catalog, so an out-of-range beat is caught either way.
   */
  diagramBeats?: Readonly<Record<string, number>>;
}

export function hasErrors(problems: readonly Problem[]): boolean {
  return problems.some((p) => p.severity === 'error');
}

export function formatProblem(p: Problem, file?: string): string {
  const where = file ? `${file} ${p.path}` : p.path;
  return `${p.severity.toUpperCase().padEnd(7)} ${p.code}  ${where}\n         ${p.message}`;
}

export function formatProblems(problems: readonly Problem[], file?: string): string {
  return problems.map((p) => formatProblem(p, file)).join('\n');
}

export function countBySeverity(problems: readonly Problem[]): Record<Severity, number> {
  const out: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const p of problems) out[p.severity] += 1;
  return out;
}
