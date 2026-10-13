/**
 * What each scene shows. The renderer is one drawing routine; a scene is a handful of switches plus a
 * default list of annotation names (documented in ../README.md).
 */
import type { VolumeMode } from '../sim/types';

export type SceneId = 'tiers' | 'placement' | 'failover' | 'traffic' | 'sync' | 'deploy' | 'network';

export const SCENE_IDS: readonly SceneId[] = [
  'tiers',
  'placement',
  'failover',
  'traffic',
  'sync',
  'deploy',
  'network',
];

export interface SceneSpec {
  id: SceneId;
  /** Draw the specimen cell above the bench. */
  specimen: boolean;
  /** Light arcs from the specimen to each instance. */
  arcs: boolean;
  /** Markers for the places requests come from. */
  users: boolean;
  /** The proxy gate in the sky that every request passes. */
  proxy: boolean;
  /** Volume roles: primary crown, standby rings, replication links. */
  roles: boolean;
  /** The pipeline strip along the bottom. */
  pipeline: boolean;
  /** Pillars are the subject (dimmed by tier filter, hover cards show tiers). */
  census: boolean;
  /** Opacity of non-instance pillars while instances exist, and while none do. */
  ambientWithInstances: number;
  ambientIdle: number;
  /** Annotation names drawn when the lesson does not choose its own. */
  annotations: readonly string[];
  /**
   * Further default annotations when a stage chooses a volume mode on purpose (the `volume` prop). A scene
   * whose lesson never mentions volumes is left as it was.
   */
  volumeAnnotations?: Readonly<Partial<Record<VolumeMode, readonly string[]>>>;
  /** Annotation names this scene can draw (for validation and the README). */
  names: readonly string[];
}

const COMMON = ['frame', 'regions'] as const;

export const SCENES: Readonly<Record<SceneId, SceneSpec>> = {
  tiers: {
    id: 'tiers',
    specimen: false,
    arcs: false,
    users: false,
    proxy: false,
    roles: false,
    pipeline: false,
    census: true,
    ambientWithInstances: 1,
    ambientIdle: 1,
    annotations: ['tiers'],
    names: [...COMMON, 'tiers', 'height'],
  },
  placement: {
    id: 'placement',
    specimen: true,
    arcs: true,
    users: false,
    proxy: false,
    roles: false,
    pipeline: false,
    census: false,
    ambientWithInstances: 0.5,
    ambientIdle: 0.85,
    annotations: ['specimen', 'instances'],
    names: [...COMMON, 'specimen', 'instances', 'span', 'lost-data'],
  },
  failover: {
    id: 'failover',
    specimen: true,
    arcs: true,
    users: true,
    proxy: true,
    roles: false,
    pipeline: false,
    census: false,
    ambientWithInstances: 0.42,
    ambientIdle: 0.85,
    annotations: ['instances', 'down', 'reroute'],
    volumeAnnotations: { local: ['lost-data'] },
    names: [...COMMON, 'specimen', 'instances', 'span', 'down', 'reroute', 'proxy', 'user', 'lost-data'],
  },
  traffic: {
    id: 'traffic',
    specimen: true,
    arcs: true,
    users: true,
    proxy: true,
    roles: false,
    pipeline: false,
    census: false,
    ambientWithInstances: 0.42,
    ambientIdle: 0.8,
    annotations: ['user', 'domain', 'proxy', 'ports', 'instances'],
    names: [
      ...COMMON,
      'specimen',
      'instances',
      'user',
      'domain',
      'proxy',
      'ports',
      'down',
      'reroute',
      'lost-data',
    ],
  },
  sync: {
    id: 'sync',
    specimen: true,
    arcs: true,
    users: false,
    proxy: false,
    roles: true,
    pipeline: false,
    census: false,
    ambientWithInstances: 0.4,
    ambientIdle: 0.8,
    annotations: ['primary', 'standby', 'replication', 'promotion', 'gap'],
    names: [
      ...COMMON,
      'specimen',
      'instances',
      'primary',
      'standby',
      'replication',
      'promotion',
      'gap',
      'down',
      'lost-data',
    ],
  },
  deploy: {
    id: 'deploy',
    specimen: true,
    arcs: true,
    users: false,
    proxy: false,
    roles: false,
    pipeline: true,
    census: false,
    ambientWithInstances: 0.6,
    ambientIdle: 0.85,
    annotations: ['pipeline', 'block', 'candidates'],
    names: [...COMMON, 'specimen', 'instances', 'pipeline', 'block', 'candidates'],
  },
  network: {
    id: 'network',
    specimen: false,
    arcs: false,
    users: false,
    proxy: false,
    roles: false,
    pipeline: false,
    census: true,
    ambientWithInstances: 1,
    ambientIdle: 1,
    annotations: ['regions'],
    names: [...COMMON, 'tiers', 'height'],
  },
};

/**
 * The annotations a scene draws when the lesson names none: its own defaults, plus the ones a chosen
 * volume mode brings (`lost-data` in `failover` with a `local` volume).
 */
export function defaultAnnotations(scene: SceneId, volume?: VolumeMode): string[] {
  const spec = SCENES[scene];
  const out = [...spec.annotations];
  const more = volume ? spec.volumeAnnotations?.[volume] : undefined;
  if (more) for (const n of more) if (!out.includes(n)) out.push(n);
  return out;
}

/**
 * The named annotations of a scene, filtered to ones it knows. Unknown names are ignored. `volume` is the
 * mode a stage chose on purpose, if any: it only matters when `requested` is omitted.
 */
export function resolveAnnotations(
  scene: SceneId,
  requested: readonly string[] | undefined,
  volume?: VolumeMode,
): string[] {
  if (!requested) return defaultAnnotations(scene, volume);
  const spec = SCENES[scene];
  return requested.filter((n) => spec.names.includes(n));
}
