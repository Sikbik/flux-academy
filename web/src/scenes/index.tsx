// The hero scene: "Deploy and break". A bench of glass hexagon cells, a cell of light above it, copies that
// leave the cell and land on real nodes, and a failure the network routes around. The page renders
// <HeroScene />, and drives it through the bus (see ./README.md); it never imports three.js.
//
// This module is light on purpose: React, the bus and a WebGL probe. The engine, three.js and the
// simulation are fetched by the host after mount, in their own chunk.

import { SceneHost, type SceneProps } from './host';

export {
  type Accent,
  type ChainState,
  type Chapter,
  type DeployControls,
  type PulseKind,
  type SceneBusState,
  type SceneEvent,
  type SceneHover,
  type SceneReason,
  type SceneSection,
  type SceneSlice,
  type StageInsets,
  useSceneBus,
} from './bus';
export { STAMP_BEATS, STORY_BREAK_AT, STORY_HEAL_AT, type StoryPlan, storyPlan } from './lib/story';
export type { SceneProps };

export default function HeroScene(props: SceneProps) {
  return <SceneHost mode="hero" {...props} />;
}
