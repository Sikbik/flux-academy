/**
 * The catalog: every id a lesson may refer to by name, as readonly lists.
 *
 * These are the lists in docs/CONTENT.md sections 3 to 6. The content test (`content.test.ts`) and the
 * validator (`learn/validate.ts`) reject a lesson that names a stage kind, diagram, widget or achievement
 * that is not here. Adding a diagram or a widget is TWO steps: the module under `learn/diagrams` or
 * `learn/widgets`, and one line here (and in docs/CONTENT.md).
 *
 * Owner: the lesson engine. Additive changes only.
 */

import type { DioramaStage, Stage } from '@/learn/types';

// ---------------------------------------------------------------------------
// Stage kinds (CONTENT.md section 3)
// ---------------------------------------------------------------------------

export const STAGE_KINDS = ['diorama', 'spec', 'terminal', 'diagram', 'code', 'compare', 'widget'] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

// Compile-time guard: STAGE_KINDS must name exactly the members of the `Stage` union.
type _StageKindsCovered = Exclude<Stage['kind'], StageKind> extends never ? true : never;
type _StageKindsExact = Exclude<StageKind, Stage['kind']> extends never ? true : never;
const _stageKindsOk: [_StageKindsCovered, _StageKindsExact] = [true, true];
void _stageKindsOk;

/** Scenes of the diorama stage (types.ts `DioramaStage`). */
export const DIORAMA_SCENES = [
  'tiers',
  'placement',
  'failover',
  'traffic',
  'sync',
  'deploy',
  'network',
] as const satisfies readonly DioramaStage['scene'][];

/** Controls a diorama stage may show. */
export const DIORAMA_CONTROLS = [
  'instances',
  'kill',
  'kill-region',
  'revive',
  'request',
  'region',
  'replay',
] as const satisfies readonly NonNullable<DioramaStage['controls']>[number][];

/** Languages the code stage knows. */
export const CODE_LANGS = ['dockerfile', 'json', 'js', 'ts', 'yaml', 'sh', 'text'] as const;

export const CALLOUT_KINDS = ['why', 'gotcha', 'tip', 'wild', 'cost'] as const;

// ---------------------------------------------------------------------------
// Diagrams (CONTENT.md section 4)
// ---------------------------------------------------------------------------

export const DIAGRAM_IDS = [
  'flux-layers',
  'tier-ladder',
  'lifecycle',
  'request-path',
  'container-layers',
  'repotag-anatomy',
  'port-mapping',
  'internal-dns',
  'dns-cname',
  'spec-anatomy',
  'volume-prefixes',
  'block-clock',
  'price-waterfall',
  'failure-modes',
] as const;
export type DiagramId = (typeof DIAGRAM_IDS)[number];

/**
 * The beats each diagram declares in CONTENT.md section 4. The diagram module's own `meta.beats` is the
 * truth at run time; this table is what the validator falls back to until the module exists, so an
 * out-of-range `beat` is caught either way.
 */
export const DIAGRAM_BEAT_COUNTS: Readonly<Record<DiagramId, number>> = {
  'flux-layers': 4,
  'tier-ladder': 4,
  lifecycle: 7,
  'request-path': 5,
  'container-layers': 5,
  'repotag-anatomy': 5,
  'port-mapping': 5,
  'internal-dns': 5,
  'dns-cname': 5,
  'spec-anatomy': 6,
  'volume-prefixes': 5,
  'block-clock': 4,
  'price-waterfall': 7,
  'failure-modes': 5,
};

// ---------------------------------------------------------------------------
// Widgets (CONTENT.md section 5)
// ---------------------------------------------------------------------------

export const WIDGET_IDS = [
  'readiness-checklist',
  'cost-reactor',
  'fluxcloud-sim',
  'uptime-calculator',
  'geo-picker',
  'wiring-board',
  'dns-record-builder',
  'block-converter',
  'orbit-planner',
  'agent-session',
] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

// ---------------------------------------------------------------------------
// Achievements (CONTENT.md section 6)
// ---------------------------------------------------------------------------

export const ACHIEVEMENT_IDS = [
  'first-light',
  'three-is-company',
  'first-blood',
  'spec-whisperer',
  'penny-pincher',
  'block-watcher',
  'globetrotter',
  'shell-shocked',
  'explorer',
  'cumulus-operator',
  'nimbus-engineer',
  'stratus-architect',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

// ---------------------------------------------------------------------------
// Tasks and challenges (types.ts)
// ---------------------------------------------------------------------------

export const TASK_KINDS = [
  'read',
  'set-instances',
  'kill-nodes',
  'send-requests',
  'spec',
  'terminal',
  'widget',
  'confirm',
] as const;

export const CHALLENGE_KINDS = [
  'choice',
  'multi',
  'order',
  'match',
  'spec-fix',
  'spec-build',
  'terminal',
  'estimate',
] as const;

/** Challenge kinds in which the learner changes or produces something (a "doing" challenge). */
export const DOING_CHALLENGE_KINDS = ['spec-fix', 'spec-build', 'terminal', 'estimate'] as const;
