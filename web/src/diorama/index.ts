/**
 * The diorama: the Bench. An isometric hex map of the Flux network (Canvas 2D), a deterministic headless
 * simulation under it, and the React component that shows them.
 *
 *   import Diorama from '@/diorama';
 *   <Diorama scene="failover" instances={3} controls={['kill', 'revive', 'request']} />
 *
 * Headless parts (no DOM, no React) can be imported on their own:
 *   import { buildSampleBench } from '@/diorama/model';
 *   import { createSim } from '@/diorama/sim';
 *
 * Scenes and their named annotations are documented in ./README.md.
 */
export { instancesByRegion, regionHasNodeUp, regionToBreak } from './breakRegion';
export { default, default as Diorama } from './Diorama';
export * from './model';
export { Narrator, type NarratorOptions } from './narrate';
export { buildNodeItems, type NodeItem, type NodeItemKind, notableNodes } from './nodes';
export { chosenVolume, defaultVolume, placeFor, showsVolumeChip, volumeChipText } from './place';
export type { HoverInfo } from './render/engine';
export {
  defaultAnnotations,
  resolveAnnotations,
  SCENE_IDS,
  SCENES,
  type SceneId,
  type SceneSpec,
} from './render/scenes';
export * from './sim';
export { createKillTally, type KillTally } from './taskEvents';
export type {
  DioramaControl,
  DioramaHandle,
  DioramaProps,
  HoverNodeInfo,
  NodeKilledInfo,
  PromotedInfo,
  RequestInfo,
  TierFilter,
} from './types';
