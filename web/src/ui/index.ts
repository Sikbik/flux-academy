/**
 * The Flux Academy design system. Import everything from `@/ui`; `ui/README.md` documents
 * every component's props and the rules for building with them.
 *
 * Exports are added as each primitive lands, in priority order. Nothing outside `ui/`
 * should import from a deeper path.
 */

// Navigation and flow
export {
  Accordion,
  AccordionItem,
  type AccordionItemProps,
  type AccordionProps,
} from './Accordion/Accordion';
// Identity: the official marks, the lattice backdrop, medals, hex ornaments, the marquee
export { Backdrop, type BackdropProps } from './Backdrop/Backdrop';
export {
  type BreadcrumbItem,
  type BreadcrumbLinkProps,
  Breadcrumbs,
  type BreadcrumbsProps,
} from './Breadcrumbs/Breadcrumbs';
// Controls
export {
  Button,
  type ButtonProps,
  type ButtonVisualProps,
  LinkButton,
  type LinkButtonProps,
} from './Button/Button';
export { Callout, type CalloutKind, type CalloutProps } from './Callout/Callout';
export { Chip, type ChipProps, type ChipTier } from './Chip/Chip';
// Lesson prose: code, inline markup, callouts
export { CodeBlock, type CodeBlockProps, CodeBlockSkeleton } from './CodeBlock/CodeBlock';
export {
  type CodeLang,
  copyText as codeCopyText,
  type Token as CodeToken,
  type TokenType as CodeTokenType,
  tokenize as tokenizeCode,
} from './CodeBlock/tokenize';
// Instruments
export { CountUp, type CountUpProps } from './CountUp/CountUp';
export { Dialog, type DialogProps } from './Dialog/Dialog';
export { Drawer, type DrawerProps } from './Drawer/Drawer';
// Figure and the blueprint annotation parts
export {
  Annotated,
  type AnnotatedProps,
  Annotation,
  type AnnotationProps,
  type Box as FigureBox,
  CalloutMarker,
  type CalloutMarkerProps,
  Crosshair,
  type CrosshairProps,
  DimensionLine,
  type DimensionLineProps,
  type DimSide,
  DrawContext,
  type DrawProps,
  FigCaption,
  type FigCaptionProps,
  Figure,
  type FigureAnnotation,
  type FigureDimension,
  type FigureProps,
  LeaderLine,
  type LeaderLineProps,
  type LeaderRoute,
  type Point as FigurePoint,
  ProbeReticle,
  type ProbeReticleProps,
  type Side8,
  TickRuler,
  type TickRulerProps,
  useDraw,
} from './Figure';
export { formatAge } from './FreshnessChip/age';
export { FreshnessChip, type FreshnessChipProps, type FreshnessKind } from './FreshnessChip/FreshnessChip';
export { Gauge, type GaugeProps, type GaugeTier } from './Gauge/Gauge';
export type {
  Thresholds as InstrumentThresholds,
  ToneProp as InstrumentTone,
} from './Gauge/tone';
// Marks and glyphs
export { Glyph, type GlyphProps } from './Glyph/Glyph';
export {
  GLYPH_GROUPS,
  GLYPH_NAMES,
  type GlyphGroup,
  type GlyphName,
  isGlyphName,
} from './Glyph/glyphs';
export { HexBullet, type HexBulletProps } from './HexBullet/HexBullet';
export { HexRing, type HexRingProps } from './HexRing/HexRing';
// Hooks
export * from './hooks';
export { IconButton, type IconButtonProps } from './IconButton/IconButton';
export { Kbd, type KbdProps } from './Kbd/Kbd';
export { Logo, type LogoProps, type LogoTone, type LogoVariant } from './Logo/Logo';
export {
  Markup,
  type MarkupContext,
  type MarkupNode,
  type MarkupProps,
  MarkupProvider,
  type MarkupTarget,
  type MarkupTerm,
  parseMarkup,
  stripMarkup,
  TermCard,
  type TermCardLinkProps,
  type TermCardProps,
  type TermCardTerm,
  useMarkupContext,
} from './Markup/Markup';
export { Marquee, type MarqueeProps } from './Marquee/Marquee';
export { Medal, type MedalProps, type MedalState } from './Medal/Medal';
export { Meter, type MeterProps, type MeterTier } from './Meter/Meter';
export { formatNumber, type NumberFormat } from './Odometer/format';
export { Odometer, type OdometerProps } from './Odometer/Odometer';
// Material
export { Panel, type PanelCorner, type PanelCut, type PanelProps, type PanelTone } from './Panel/Panel';
export { Popover, type PopoverProps } from './Popover/Popover';
export { Progress, type ProgressProps, type ProgressTier, type ProgressVariant } from './Progress/Progress';
export { Reveal, type RevealProps } from './Reveal/Reveal';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentOption,
} from './SegmentedControl/SegmentedControl';
export { Select, type SelectOption, type SelectProps } from './Select/Select';
export { Skeleton, type SkeletonProps } from './Skeleton/Skeleton';
export { Slider, type SliderMark, type SliderProps } from './Slider/Slider';
export { Sparkline, type SparklineProps, type SparklineTier } from './Sparkline/Sparkline';
export { SplitReveal, type SplitRevealProps } from './SplitReveal/SplitReveal';
export { Stat, type StatAs, type StatDelta, type StatProps, type StatSize, type StatTier } from './Stat/Stat';
export { type Status, StatusDot, type StatusDotProps } from './StatusDot/StatusDot';
export {
  type StepKind,
  StepRail,
  type StepRailProps,
  type StepRailStep,
  type StepState,
} from './StepRail/StepRail';
export { Surface, type SurfaceProps } from './Surface/Surface';
export { Switch, type SwitchProps } from './Switch/Switch';
export { tabIds } from './Tabs/ids';
export { type TabItem, TabPanel, type TabPanelProps, Tabs, type TabsProps } from './Tabs/Tabs';
export {
  SearchField,
  type SearchFieldProps,
  TextArea,
  type TextAreaProps,
  TextField,
  type TextFieldProps,
} from './TextField/TextField';
export {
  Toast,
  type ToastItem,
  type ToastKind,
  type ToastProps,
  ToastViewport,
  type ToastViewportProps,
} from './Toast/Toast';
export { Tooltip, type TooltipProps } from './Tooltip/Tooltip';
