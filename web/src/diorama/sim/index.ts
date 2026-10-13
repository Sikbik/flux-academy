/**
 * The headless simulation: placement, health, routing, volume roles and the deploy timeline, seeded and
 * deterministic. The rules (and their FACTS references) are in `rules.ts`.
 */
export { createSim } from './createSim';
export {
  DEFAULT_RULES,
  type DeployRules,
  type GeoConstraint,
  type GeoRule,
  geolocationAllows,
  type HealthRules,
  hasEmptyDisk,
  mergeRules,
  type PlacementRules,
  parseGeolocation,
  type RespawnRules,
  type RoutingRules,
  type Rules,
  type RulesPatch,
  type VolumeRules,
} from './rules';
export type * from './types';
