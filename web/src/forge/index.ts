/**
 * The Spec Forge. `SpecEditor` is the whole editor (form, JSON, price, issues); `CostReactor` and
 * `PlacementPreview` are the price instrument and the map, usable on their own; the model is framework free
 * (`./model`) and is what the lab, the lesson stage and the tests drive.
 */
export { CostReactor, type CostReactorProps, type ReactorSection } from './CostReactor';
export { useForgeSession, usePricingContext, useSnapshot, useVerify } from './hooks';
export * as forgeModel from './model';
export { PlacementPreview, type PlacementPreviewProps } from './PlacementPreview';
export { downloadText } from './panels/JsonPanel';
export { eligibleIndices, type PlacementResult, placeInstances } from './placement';
export {
  type ForgePanel,
  type ForgeState,
  SpecEditor,
  type SpecEditorHandle,
  type SpecEditorProps,
} from './SpecEditor';
