/**
 * Moving progress in and out of the browser: the export file, reading an import safely, and the numbers
 * the confirmation shows. Pure; the page does the file and storage work.
 *
 * An import is untrusted. It goes through `parseLearnerState` (shape and types) and then `sanitizeImport`
 * (only lessons and medals that exist, only real calendar days) before anything is written.
 */

import { LESSONS } from '@shared/curriculum';
import { ACHIEVEMENT_IDS } from '@/content/catalog';
import { type LearnerState, parseLearnerState } from '@/learn/store';
import { parseKey } from './activity';

/** The file is plain JSON of the stored fields, labelled so a person knows what it is. */
export interface ExportFile {
  app: 'flux-academy';
  kind: 'progress';
  schema: number;
  exportedAt: string;
  name: string;
  xp: number;
  lessons: LearnerState['lessons'];
  achievements: LearnerState['achievements'];
  activeDays: string[];
}

/** An import larger than this is not a progress file (a full save is a few kilobytes). */
export const MAX_IMPORT_BYTES = 512 * 1024;

export function buildExport(state: LearnerState, now: Date = new Date()): ExportFile {
  return {
    app: 'flux-academy',
    kind: 'progress',
    schema: state.schema,
    exportedAt: now.toISOString(),
    name: state.name,
    xp: state.xp,
    lessons: state.lessons,
    achievements: state.achievements,
    activeDays: state.activeDays,
  };
}

/** The file's text: two-space JSON, so it can be read and diffed by a person. */
export function exportText(state: LearnerState, now: Date = new Date()): string {
  return `${JSON.stringify(buildExport(state, now), null, 2)}\n`;
}

/** "flux-academy-progress-2026-10-12.json" (local date). */
export function exportFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `flux-academy-progress-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface StateSummary {
  lessonsDone: number;
  lessonsStarted: number;
  lessonsTotal: number;
  xp: number;
  medals: number;
  medalsTotal: number;
  activeDays: number;
  name: string;
}

export function summariseState(state: LearnerState): StateSummary {
  const known = new Set(LESSONS.map((l) => l.id));
  const medalIds = new Set<string>(ACHIEVEMENT_IDS);
  let done = 0;
  let started = 0;
  for (const [id, lp] of Object.entries(state.lessons)) {
    if (!known.has(id)) continue;
    started += 1;
    if (lp.completedAt) done += 1;
  }
  return {
    lessonsDone: done,
    lessonsStarted: started,
    lessonsTotal: LESSONS.length,
    xp: state.xp,
    medals: Object.keys(state.achievements).filter((id) => medalIds.has(id)).length,
    medalsTotal: ACHIEVEMENT_IDS.length,
    activeDays: state.activeDays.length,
    name: state.name,
  };
}

// ---------------------------------------------------------------------------
// Reading an import
// ---------------------------------------------------------------------------

/** Keeps only what the app knows: curriculum lessons, real medals, real calendar days. */
export function sanitizeImport(state: LearnerState): LearnerState {
  const lessonIds = new Set(LESSONS.map((l) => l.id));
  const medalIds = new Set<string>(ACHIEVEMENT_IDS);
  const lessons: LearnerState['lessons'] = {};
  for (const [id, lp] of Object.entries(state.lessons)) if (lessonIds.has(id)) lessons[id] = lp;
  const achievements: LearnerState['achievements'] = {};
  for (const [id, at] of Object.entries(state.achievements)) if (medalIds.has(id)) achievements[id] = at;
  const days = [...new Set(state.activeDays.filter((d) => parseKey(d) !== null))].sort();
  return { ...state, lessons, achievements, activeDays: days.slice(-400) };
}

export type ImportResult =
  | { ok: true; state: LearnerState; summary: StateSummary; dropped: number }
  | { ok: false; reason: string };

/**
 * Reads the text of a chosen file. Never throws. The reasons are sentences for the person: what was wrong
 * and what to do.
 */
export function readImport(text: string, bytes: number = text.length): ImportResult {
  if (bytes > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      reason: 'That file is too large to be a progress file. Choose the one this page exported.',
    };
  }
  if (text.trim() === '') {
    return { ok: false, reason: 'That file is empty. Choose a progress file exported from this page.' };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      reason: 'That file is not JSON, so it is not a progress file. Choose the one this page exported.',
    };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      reason: 'That file does not look like a progress file. Choose the one this page exported.',
    };
  }
  const schema = (raw as { schema?: unknown }).schema;
  if (typeof schema === 'number' && schema !== 2) {
    return {
      ok: false,
      reason: `That file was saved by a different version of Flux Academy (format ${schema}). This page reads format 2.`,
    };
  }
  const parsed = parseLearnerState(raw);
  if (!parsed) {
    return {
      ok: false,
      reason: 'That file does not look like a progress file. Choose the one this page exported.',
    };
  }
  const state = sanitizeImport(parsed);
  const dropped =
    Object.keys(parsed.lessons).length -
    Object.keys(state.lessons).length +
    (Object.keys(parsed.achievements).length - Object.keys(state.achievements).length);
  return { ok: true, state, summary: summariseState(state), dropped };
}
