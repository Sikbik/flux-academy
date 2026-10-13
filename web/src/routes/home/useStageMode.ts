import { useStageStatus } from './stageStatus';

/**
 * `scene` is the hero scene host: the WebGL bench, or, when WebGL is unavailable or forced off
 * (`?q=none`), the diorama's own 2D bench that the host swaps in itself. `lite` is the page's last
 * resort: the scene chunk failed to load, so the stage shows only the calm plate and the hero draws its
 * own small 2D bench.
 */
export type StageMode = 'scene' | 'lite';

export function useStageMode(): StageMode {
  return useStageStatus((s) => s.failed) ? 'lite' : 'scene';
}
