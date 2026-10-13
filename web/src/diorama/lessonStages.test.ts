/**
 * The diorama stages of the real lessons, checked against what the diorama can draw. The content
 * validator knows the scene and control ids; this knows the annotation names of each scene and what a
 * stage's `volume` is for, so a typo in `annotate` (which the figure ignores) cannot pass quietly.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DioramaStage, Lesson } from '@/learn/types';
import { SCENES } from './render/scenes';

const DIR = fileURLToPath(new URL('../content/lessons/', import.meta.url));

// Listed at run time, not globbed: a glob can be served from a stale transform cache (see content.test.ts).
const lessons: Lesson[] = await Promise.all(
  readdirSync(DIR)
    .filter((f) => f.endsWith('.ts') && !/\.test\.ts$/.test(f))
    .sort()
    .map(async (f) => ((await import(/* @vite-ignore */ join(DIR, f))) as { default: Lesson }).default),
);

interface Found {
  where: string;
  stage: DioramaStage;
}

const stages: Found[] = lessons.flatMap((lesson) =>
  lesson.steps.flatMap((step) =>
    step.stage?.kind === 'diorama' ? [{ where: `${lesson.id}/${step.id}`, stage: step.stage }] : [],
  ),
);

const step = (lessonId: string, stepId: string) => {
  const found = lessons.find((l) => l.id === lessonId)?.steps.find((s) => s.id === stepId);
  if (!found) throw new Error(`no step ${lessonId}/${stepId}`);
  return found;
};

describe('diorama stages in the lessons', () => {
  it('finds them', () => {
    expect(stages.length).toBeGreaterThan(5);
  });

  it('only name annotations their scene can draw', () => {
    for (const { where, stage } of stages) {
      const names: readonly string[] = SCENES[stage.scene].names;
      for (const a of stage.annotate ?? []) {
        expect(names, `${where}: scene "${stage.scene}" cannot draw "${a}"`).toContain(a);
      }
    }
  });

  it('choose a volume only where there is an app, and only a mode the simulation knows', () => {
    for (const { where, stage } of stages) {
      if (stage.volume === undefined) continue;
      expect(['local', 'replicated', 'primary-standby'], where).toContain(stage.volume);
      expect(SCENES[stage.scene].specimen, `${where}: a volume needs a scene with an app`).toBe(true);
    }
  });

  it('offer Break region only in scenes that have nodes to break and instances on them', () => {
    for (const { where, stage } of stages) {
      if (!stage.controls?.includes('kill-region')) continue;
      expect(SCENES[stage.scene].census, `${where}: no instances in a census scene`).toBe(false);
    }
  });
});

describe('the two lessons that needed the volume and the region break', () => {
  it('persistent-storage step 2 shows the empty disk of a plain volume', () => {
    const s = step('persistent-storage', 'plain-volume');
    expect(s.stage).toMatchObject({ kind: 'diorama', scene: 'failover', volume: 'local' });
    const stage = s.stage as DioramaStage;
    expect(stage.annotate).toContain('lost-data');
    expect(stage.controls).toContain('kill');
    expect(s.task).toMatchObject({ kind: 'kill-nodes' });
    // The old step said the figure could not show the disk.
    expect(JSON.stringify(s.body)).not.toMatch(/cannot show/i);
  });

  it('redundancy-failover spread step breaks a whole region', () => {
    const s = step('redundancy-failover', 'spread');
    const stage = s.stage as DioramaStage;
    expect(stage).toMatchObject({ kind: 'diorama', scene: 'failover', region: 'EU' });
    expect(stage.controls).toEqual(expect.arrayContaining(['kill-region', 'region']));
    expect(s.task).toMatchObject({ kind: 'kill-nodes' });
    // It says honestly that spread is not promised and that the simulator compresses the wait.
    const prose = s.body.join(' ');
    expect(prose).toMatch(/does not promise/);
    expect(prose).toMatch(/compresses/);
  });
});
