/**
 * Public surface of the data layer (`@/data`). Everything else in the app reads live numbers through
 * these exports and nothing else calls `fetch`.
 *
 *   Hooks            useNetwork, useGeo, useBlocks, usePricing, useChainClock, useConnection, ...
 *   Events           onBlock(cb) for the Beat
 *   Requests         postLint, postQuote, exploreApp, exploreSearch
 *   Computation      useQuote, useLint (local, instant, optionally confirmed by the server)
 *   Chip helpers     describeStatus, freshnessLabel
 *
 * Importing this module starts nothing: the layer runs while a hook is mounted.
 */

export type { ApiError, ApiResult } from './api';
export {
  describeStatus,
  type FreshnessChipKind,
  freshnessKind,
  type StatusChip,
  type StatusTone,
} from './chips';
export { FRESH_WINDOW_MS, SECTION_WINDOW_MS, type SectionKey } from './freshness';
export {
  readChainClock,
  useBlocks,
  useChainClock,
  useChainHeight,
  useConnection,
  useDataAge,
  useDataLayerDebug,
  useFluxPrice,
  useGeo,
  useNetwork,
  useNetworkSelect,
  usePricing,
  useSectionAge,
  useSectionStatus,
} from './hooks';
export {
  type LintResult,
  type QuoteBasis,
  type QuoteOptions,
  type QuoteResult,
  type QuoteVerification,
  quoteLocally,
  useLint,
  useQuote,
} from './quote';
export { exploreApp, exploreSearch, postLint, postQuote, SAMPLE_APP } from './requests';
export { useDataStore } from './store';
export type {
  ChainClock,
  ConnectionState,
  DataLayerDebug,
  DataState,
  DataStatus,
  ResourceKey,
} from './types';
export { onBlock, startDataLayer } from './useLayer';
