/**
 * Placement options and volume modes as the component applies them. Pure and framework free, so the
 * mapping from a stage's `volume` to the simulation is unit tested on its own.
 */
import { SCENES, type SceneId } from './render/scenes';
import type { PlaceOptions, VolumeMode } from './sim/types';

/**
 * The volume mode a scene runs when nothing chooses one: the `sync` scene is the primary and standby
 * volume, every other scene shows a plain local volume.
 */
export function defaultVolume(scene: SceneId): VolumeMode {
  return scene === 'sync' ? 'primary-standby' : 'local';
}

/** The mode a stage or caller chose on purpose (the `volume` prop, else `place.volume`), if any. */
export function chosenVolume(
  volume: VolumeMode | undefined,
  place: PlaceOptions | undefined,
): VolumeMode | undefined {
  return volume ?? place?.volume;
}

/**
 * The placement options of a scene. The component spreads instances over continents and lets every tier
 * compete so the picture reads (a teaching layout, not a network claim), then applies the caller's
 * `place`, then the chosen volume. Without a choice the volume is the scene's own.
 */
export function placeFor(
  scene: SceneId,
  extra: PlaceOptions | undefined,
  volume?: VolumeMode,
): PlaceOptions & { volume: VolumeMode } {
  const merged: PlaceOptions = { waitedMin: 120, spread: 'regions', ...extra };
  return { ...merged, volume: volume ?? extra?.volume ?? defaultVolume(scene) };
}

/**
 * Whether the figure names its volume model in a chip: when a stage or caller chose one, and always in
 * `sync` (which is about nothing else). A lesson that never talks about volumes never sees the chip.
 */
export function showsVolumeChip(scene: SceneId, chosen: VolumeMode | undefined): boolean {
  if (!SCENES[scene].specimen) return false;
  return chosen !== undefined || scene === 'sync';
}

/** The words of the volume chip. Mechanics only; the lesson prose carries the claims (FACTS 7.2). */
export function volumeChipText(mode: VolumeMode): string {
  switch (mode) {
    case 'local':
      return 'Volume: local, on one node';
    case 'replicated':
      return 'Volume: replicated to all';
    case 'primary-standby':
      return 'Volume: primary and standby';
  }
}
