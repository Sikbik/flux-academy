/**
 * Presets: the named example specs of `shared/flux/fixtures.ts`, as the forge's "Start from" menu lists
 * them. The fixtures are lint-clean by construction and priced in the engine's tests, so every preset is
 * a spec a learner can trust as a starting point.
 */

import { cloneFixture, FIXTURES } from '@shared/flux/fixtures';
import type { FluxAppSpec } from '@shared/flux/types';

export interface Preset {
  id: string;
  /** Short name for a menu. */
  label: string;
  /** One line: what it shows. */
  description: string;
  /** Lessons that use this example. */
  lessons: readonly string[];
}

const LABELS: Record<string, string> = {
  'hello-world': 'Hello world',
  'web-app': 'Web app',
  'static-site': 'Static site',
  minecraft: 'Minecraft',
  'wordpress-mysql': 'WordPress and MySQL',
  'redis-cache': 'Redis cache',
  'three-tier': 'Three-tier',
};

export const PRESETS: readonly Preset[] = FIXTURES.map((f) => ({
  id: f.id,
  label: LABELS[f.id] ?? f.title,
  description: f.description,
  lessons: f.lessons,
}));

/** A fresh copy of a preset's spec, safe to edit. */
export function presetSpec(id: string): FluxAppSpec | null {
  return cloneFixture(id) ?? null;
}

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
