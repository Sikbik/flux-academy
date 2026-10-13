/**
 * The forge model: framework-free state, operations, history, text, lint, price and share links.
 * Import from here; the files behind it may move.
 */
export { AchievementTracker, type EditOrigin, type Observation, PENNY_PINCHER } from './achievements';
export {
  BAKED_CONTEXT,
  type CurvePoint,
  freshSpec,
  LINT_CODES,
  type LintContext,
  lintInput,
  normalizeLoose,
  type ParamsSource,
  type PricingContext,
  priceCurve,
  priceSpec,
} from './engine';
export * as fmt from './format';
export { allowedContinents, CONTINENT_NAME, continentOf, type Eligibility, eligibleNodes } from './geo';
export { UndoStack } from './history';
export {
  type JsonNode,
  type JsonProblem,
  lineOfOffset,
  lineStarts,
  locate,
  markerRange,
  offsetToPos,
  parseJsonText,
  specToCompactText,
  specToText,
  type Token,
  tokenizeLine,
} from './jsonText';
export * from './ops';
export {
  ancestors,
  childPath,
  componentIndexOf,
  covers,
  diffPaths,
  fieldPathOf,
  formatPath,
  getAt,
  hasAt,
  hasEditableWithin,
  isPathEditable,
  isWithin,
  lastSegment,
  normalizePath,
  parentPath,
  parsePath,
  removeAt,
  sameJson,
  sectionsOf,
  setAt,
} from './paths';
export { PRESETS, type Preset, presetById, presetSpec } from './presets';
export { restrictToEditable } from './restrict';
export {
  type ChangeOrigin,
  createSession,
  DEFAULT_LINT_CONTEXT,
  ForgeSession,
  type ForgeSnapshot,
  type SessionOptions,
  SPEC_TOOLS,
  specFromPartial,
  type TextState,
} from './session';
export {
  canCompress,
  decodeShare,
  encodeShare,
  readShareHash,
  SHARE_KEY,
  type ShareFailure,
  shareUrl,
} from './share';
