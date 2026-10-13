import { lazy } from 'react';

/**
 * The hero scene host, as its own chunk: three.js, the simulation and the 2D bench are fetched by the
 * host after it mounts, so nothing here is on the critical path of the page's own text.
 */
export const LazyHeroScene = lazy(() => import('@/scenes'));
