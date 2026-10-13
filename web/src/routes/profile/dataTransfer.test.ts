import { LESSONS } from '@shared/curriculum';
import { describe, expect, it } from 'vitest';
import type { LearnerState } from '@/learn/store';
import {
  buildExport,
  exportFileName,
  exportText,
  MAX_IMPORT_BYTES,
  readImport,
  sanitizeImport,
  summariseState,
} from './dataTransfer';

const first = LESSONS[0]?.id ?? 'what-is-flux';
const second = LESSONS[1]?.id ?? 'how-apps-run';

function state(extra: Partial<LearnerState> = {}): LearnerState {
  return {
    schema: 2,
    xp: 410,
    name: 'Alex Rivera',
    lessons: {
      [first]: {
        step: 5,
        stepsDone: ['a', 'b'],
        challenges: { c1: 10 },
        startedAt: '2026-09-01T10:00:00.000Z',
        completedAt: '2026-09-02T10:00:00.000Z',
      },
      [second]: {
        step: 1,
        stepsDone: ['a'],
        challenges: {},
        startedAt: '2026-09-03T10:00:00.000Z',
        completedAt: null,
      },
    },
    achievements: { 'first-light': '2026-09-01T10:00:00.000Z' },
    activeDays: ['2026-09-01', '2026-09-02', '2026-09-03'],
    ...extra,
  };
}

describe('export', () => {
  it('labels the file and carries exactly the stored fields', () => {
    const f = buildExport(state(), new Date('2026-10-12T08:00:00Z'));
    expect(f.app).toBe('flux-academy');
    expect(f.kind).toBe('progress');
    expect(f.schema).toBe(2);
    expect(f.exportedAt).toBe('2026-10-12T08:00:00.000Z');
    expect(Object.keys(f).sort()).toEqual(
      ['achievements', 'activeDays', 'app', 'exportedAt', 'kind', 'lessons', 'name', 'schema', 'xp'].sort(),
    );
  });

  it('is readable JSON that reads back to the same state', () => {
    const s = state();
    const text = exportText(s, new Date('2026-10-12T08:00:00Z'));
    expect(text.endsWith('\n')).toBe(true);
    const r = readImport(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state).toEqual(s);
  });

  it('names the file by local date', () => {
    expect(exportFileName(new Date(2026, 9, 12))).toBe('flux-academy-progress-2026-10-12.json');
    expect(exportFileName(new Date(2027, 0, 3))).toBe('flux-academy-progress-2027-01-03.json');
  });
});

describe('summariseState', () => {
  it('counts what is done, started, earned and active', () => {
    expect(summariseState(state())).toEqual({
      lessonsDone: 1,
      lessonsStarted: 2,
      lessonsTotal: LESSONS.length,
      xp: 410,
      medals: 1,
      medalsTotal: 12,
      activeDays: 3,
      name: 'Alex Rivera',
    });
  });

  it('does not count lessons or medals the app does not have', () => {
    const s = state({
      lessons: {
        ...state().lessons,
        'no-such-lesson': {
          step: 0,
          stepsDone: [],
          challenges: {},
          startedAt: '',
          completedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      achievements: { 'first-light': 'x', 'made-up': 'y' },
    });
    const sum = summariseState(s);
    expect(sum.lessonsDone).toBe(1);
    expect(sum.medals).toBe(1);
  });
});

describe('sanitizeImport', () => {
  it('drops unknown lessons and medals and bad or repeated days, and sorts the days', () => {
    const dirty = state({
      lessons: {
        ...state().lessons,
        ghost: { step: 0, stepsDone: [], challenges: {}, startedAt: '', completedAt: null },
      },
      achievements: { 'first-light': 'x', ghost: 'y' },
      activeDays: ['2026-09-03', 'nope', '2026-09-01', '2026-09-01', '2026-02-31'],
    });
    const clean = sanitizeImport(dirty);
    expect(Object.keys(clean.lessons).sort()).toEqual([first, second].sort());
    expect(Object.keys(clean.achievements)).toEqual(['first-light']);
    expect(clean.activeDays).toEqual(['2026-09-01', '2026-09-03']);
  });

  it('keeps at most 400 days, the newest', () => {
    const days: string[] = [];
    for (let i = 0; i < 500; i++) {
      const d = new Date(2025, 0, 1 + i);
      days.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      );
    }
    const clean = sanitizeImport(state({ activeDays: days }));
    expect(clean.activeDays).toHaveLength(400);
    expect(clean.activeDays[399]).toBe(days[499]);
  });
});

describe('readImport', () => {
  const bad = (text: string, bytes?: number) => {
    const r = readImport(text, bytes);
    expect(r.ok).toBe(false);
    return r.ok ? '' : r.reason;
  };

  it('explains an empty file', () => {
    expect(bad('')).toMatch(/empty/);
    expect(bad('   \n')).toMatch(/empty/);
  });

  it('explains text that is not JSON', () => {
    expect(bad('hello there')).toMatch(/not JSON/);
    expect(bad('{"schema": 2,')).toMatch(/not JSON/);
  });

  it('refuses things that are JSON but not a progress object', () => {
    expect(bad('[1,2,3]')).toMatch(/does not look like/);
    expect(bad('"text"')).toMatch(/does not look like/);
    expect(bad('null')).toMatch(/does not look like/);
    expect(bad('{"hello":"world"}')).toMatch(/does not look like/);
  });

  it('names a different format version', () => {
    expect(bad('{"schema": 1, "xp": 5}')).toMatch(/format 1/);
    expect(bad('{"schema": 3}')).toMatch(/format 3/);
  });

  it('refuses a file that is far too large', () => {
    expect(bad('{}', MAX_IMPORT_BYTES + 1)).toMatch(/too large/);
  });

  it('accepts a minimal valid file and reports what it holds', () => {
    const r = readImport('{"schema":2,"xp":120,"lessons":{},"achievements":{},"activeDays":[],"name":"A"}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.summary.xp).toBe(120);
      expect(r.summary.lessonsDone).toBe(0);
      expect(r.dropped).toBe(0);
    }
  });

  it('counts what it had to leave out', () => {
    const text = JSON.stringify({
      ...buildExport(state()),
      lessons: { ...state().lessons, ghost: { step: 0 } },
    });
    const r = readImport(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dropped).toBe(1);
  });

  it('never throws on hostile input', () => {
    for (const text of [
      '{"schema":2,"lessons":{"__proto__":{"step":1}}}',
      '{"schema":2,"xp":-5}',
      '{"schema":2,"xp":"lots"}',
      '\u0000\u0001',
    ]) {
      expect(() => readImport(text)).not.toThrow();
    }
    const r = readImport('{"schema":2,"xp":-5}');
    expect(r.ok && r.state.xp).toBe(0);
  });

  it('reasons carry no em dash', () => {
    const reasons = [bad(''), bad('x'), bad('[]'), bad('{"schema":9}'), bad('{}', MAX_IMPORT_BYTES + 1)];
    for (const r of reasons) expect(r).not.toContain('—');
  });
});
