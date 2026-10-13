// The ambient scene: the same bench as a screensaver. A slow camera drifts across it, the cell stays
// small and steady, the app deploys, serves, fails and heals on a long loop, and a ring crosses the
// bench for every real block. No interaction, no controls: captions and any HUD are DOM, owned by the
// app platform. Reduced motion gets a still, dim frame.

import { SceneHost, type SceneProps } from './host';

export type { SceneProps };

export default function AmbientScene(props: SceneProps) {
  return <SceneHost mode="ambient" {...props} />;
}
