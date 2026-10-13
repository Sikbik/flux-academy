/**
 * The bench model: terrain cells on a hex grid derived from a land bitmap, a node model (tier, country,
 * continent, position, height) and two builders. Pure, seeded and framework-free.
 */
export {
  assembleBench,
  cellsOfRegion,
  dominantTier,
  liveHeight,
  TIER_HEIGHT,
} from './bench';
export { CELL_WIDTH, LAND_THRESHOLD, terrainFor } from './cells';
export {
  cellCentreX,
  cellCentreY,
  geometryFor,
  gridAt,
  gridDistance,
  HEX_ROW,
  HEX_W,
  latToY,
  lonToX,
  makeGeometry,
  RESOLUTION_PITCH,
  xToLon,
  yToLat,
} from './geometry';
export { buildLiveBench, type LiveBenchOptions } from './live';
export {
  COUNTRY_NAME,
  countryName,
  REGION_OF_CC,
  SAMPLE_COUNTRIES,
  USER_SEEDS,
} from './places';
export { regionOfLatLon, subregionOf } from './regions';
export { buildSampleBench, DEFAULT_TIER_MIX, type SampleBenchOptions } from './sample';
export * from './types';
