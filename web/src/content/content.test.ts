/**
 * The content test: every lesson file and every glossary file, validated.
 *
 *   npm run content:check            (from web/)
 *   npx vitest run src/content
 *
 * What it proves (rules and codes are listed in `learn/validate.ts`):
 *   - every `content/lessons/*.ts` default-exports a Lesson whose id is a curriculum id and matches the
 *     file name, and passes `validateLesson` with no errors (warnings are printed, never fail)
 *   - every `content/glossary/*.ts` default-exports GlossaryTerm[]; ids are unique across all files and
 *     every `related` and `lessons` reference resolves
 *   - curriculum lessons that have no content file yet are listed as a warning, not a failure
 *
 * Set CONTENT_CHECK_QUIET=1 to hide warnings and info lines.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LABS, LESSONS } from '@shared/curriculum';
import * as blocksMod from '@shared/flux/blocks';
import * as lintMod from '@shared/flux/lint';
import * as pricingMod from '@shared/flux/pricing';
import * as specMod from '@shared/flux/spec';
import { beforeAll, describe, expect, it } from 'vitest';
import { DIAGRAM_IDS } from '@/content/catalog';
import { buildEngine, type LessonEngine } from '@/learn/engine';
import type { DiagramMeta } from '@/learn/stage-api';
import type { GlossaryTerm, Lesson } from '@/learn/types';
import {
  countBySeverity,
  formatProblem,
  type Problem,
  validateGlossary,
  validateLesson,
} from '@/learn/validate';

// Content is discovered by listing the folders at run time and importing each file, not with
// `import.meta.glob`: a glob is expanded when a file is transformed, and Vitest reuses transforms from
// earlier runs (`node_modules/.vitest-cache`) unless the file contains the literal text
// `import.meta.glob(`. A lesson added since would be silently skipped. Listing the folder cannot go stale.
const HERE = fileURLToPath(new URL('.', import.meta.url));

interface Loaded<T> {
  /** The file name without its extension. */
  file: string;
  mod: T | null;
  /** Set when the file could not be imported (a syntax error, a bad import). */
  error: string | null;
}

function listFiles(dir: string, ext: RegExp): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => ext.test(f) && !/\.test\.tsx?$/.test(f))
      .sort();
  } catch {
    return [];
  }
}

async function loadAll<T>(dir: string, ext: RegExp): Promise<Loaded<T>[]> {
  return Promise.all(
    listFiles(dir, ext).map(async (f): Promise<Loaded<T>> => {
      const file = f.replace(ext, '');
      try {
        const mod = (await import(/* @vite-ignore */ join(dir, f))) as T;
        return { file, mod, error: null };
      } catch (e) {
        return { file, mod: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}

const lessonModules = await loadAll<{ default: Lesson }>(join(HERE, 'lessons'), /\.ts$/);
const glossaryModules = await loadAll<{ default: GlossaryTerm[] }>(join(HERE, 'glossary'), /\.ts$/);
// Diagram modules declare their beats. They are loaded defensively: a module that cannot load in a test
// environment must not take the content test down.
const DIAGRAM_DIR = join(HERE, '..', 'learn', 'diagrams');
const diagramFiles = listFiles(DIAGRAM_DIR, /\.tsx$/);

const QUIET = process.env.CONTENT_CHECK_QUIET === '1';

const engine: LessonEngine = buildEngine({
  spec: specMod as unknown as Record<string, unknown>,
  pricing: pricingMod as unknown as Record<string, unknown>,
  blocks: blocksMod as unknown as Record<string, unknown>,
  lint: lintMod as unknown as Record<string, unknown>,
  catalogue: lintMod as unknown as Record<string, unknown>,
});

const glossaryFiles = glossaryModules.map((m) => ({
  file: m.file,
  error: m.error,
  terms: Array.isArray(m.mod?.default) ? (m.mod?.default as GlossaryTerm[]) : [],
  isArray: Array.isArray(m.mod?.default),
}));
const glossaryIds = new Set(glossaryFiles.flatMap((f) => f.terms.map((t) => t.id)));
const lessonIds = new Set(LESSONS.map((l) => l.id));

const diagramBeats: Record<string, number> = {};
beforeAll(async () => {
  for (const f of diagramFiles) {
    try {
      const m = (await import(/* @vite-ignore */ join(DIAGRAM_DIR, f))) as { meta?: DiagramMeta };
      if (m.meta && Array.isArray(m.meta.beats)) diagramBeats[m.meta.id] = m.meta.beats.length;
    } catch {
      // A diagram that cannot load here is the diagrams owner's to fix; its beats fall back to the catalog.
    }
  }
});

function report(file: string, problems: readonly Problem[]): void {
  if (QUIET) return;
  const shown = problems.filter((p) => p.severity !== 'error');
  if (shown.length === 0) return;
  const n = countBySeverity(problems);
  console.warn(
    `\n[content] ${file}: ${n.warning} warning(s), ${n.info} note(s)\n${shown.map((p) => formatProblem(p, file)).join('\n')}`,
  );
}

describe('glossary', () => {
  it('finds glossary files (warning only when there are none yet)', () => {
    if (glossaryFiles.length === 0 && !QUIET)
      console.warn('\n[content] no glossary files yet (content/glossary/*.ts)');
    expect(true).toBe(true);
  });

  it('has unique term ids across every file', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const f of glossaryFiles) {
      for (const t of f.terms) {
        const first = seen.get(t.id);
        if (first !== undefined) clashes.push(`"${t.id}" in ${f.file} and ${first}`);
        else seen.set(t.id, f.file);
      }
    }
    expect(clashes).toEqual([]);
  });

  for (const f of glossaryFiles) {
    it(`${f.file} is a valid glossary file`, () => {
      expect(f.error, `${f.file}.ts could not be imported`).toBeNull();
      expect(f.isArray, `${f.file} must default-export GlossaryTerm[]`).toBe(true);
      const problems = validateGlossary(f.terms, { ids: glossaryIds, lessonIds });
      report(f.file, problems);
      const errors = problems.filter((p) => p.severity === 'error');
      expect(errors.map((p) => formatProblem(p, f.file)).join('\n')).toBe('');
    });
  }
});

describe('lessons', () => {
  const entries = lessonModules.map((m) => ({
    file: m.file,
    error: m.error,
    lesson: m.mod?.default as Lesson,
  }));

  it('lists curriculum lessons with no content yet (warning only)', () => {
    const have = new Set(entries.map((e) => e.lesson?.id));
    const missing = LESSONS.filter((l) => !have.has(l.id)).map((l) => l.id);
    if (missing.length > 0 && !QUIET) {
      console.warn(
        `\n[content] ${missing.length} of ${LESSONS.length} curriculum lessons have no content yet: ${missing.join(', ')}`,
      );
    }
    expect(true).toBe(true);
  });

  it('has at most one file per curriculum lesson and no unknown lesson files', () => {
    const seen = new Map<string, string>();
    const problems: string[] = [];
    for (const e of entries) {
      const id = e.lesson?.id;
      if (!id || !lessonIds.has(id)) problems.push(`${e.file}.ts: "${id}" is not a curriculum lesson id`);
      else if (seen.has(id)) problems.push(`${e.file}.ts and ${seen.get(id)}.ts both define "${id}"`);
      else seen.set(id, `${e.file}.ts`);
      if (id && id !== e.file)
        problems.push(`${e.file}.ts must be named ${id}.ts (the file name is the lesson id)`);
    }
    expect(problems).toEqual([]);
  });

  it('knows every catalogued diagram (warning only)', () => {
    const missing = DIAGRAM_IDS.filter((id) => diagramBeats[id] === undefined);
    if (missing.length > 0 && !QUIET && diagramFiles.length > 0) {
      console.warn(`\n[content] diagram modules not found or without meta: ${missing.join(', ')}`);
    }
    expect(true).toBe(true);
  });

  for (const e of entries) {
    it(`${e.file} validates`, () => {
      expect(e.error, `${e.file}.ts could not be imported`).toBeNull();
      expect(e.lesson, `${e.file}.ts must default-export a Lesson`).toBeTruthy();
      const problems = validateLesson(e.lesson, {
        lessons: LESSONS,
        labs: LABS,
        glossary: glossaryIds,
        engine,
        diagramBeats,
      });
      report(e.file, problems);
      const errors = problems.filter((p) => p.severity === 'error');
      expect(errors.map((p) => formatProblem(p, e.file)).join('\n')).toBe('');
    });
  }
});
