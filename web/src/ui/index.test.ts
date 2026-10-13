import { describe, expect, it } from 'vitest';
import * as ui from './index';

/**
 * The public surface of `@/ui`. Pages and labs import these names, so removing or renaming
 * one is a breaking change: add to this list, never edit a name in it.
 */
const COMPONENTS = [
  'Accordion',
  'AccordionItem',
  'Annotated',
  'Annotation',
  'Backdrop',
  'Breadcrumbs',
  'Button',
  'Callout',
  'CalloutMarker',
  'Chip',
  'CodeBlock',
  'CodeBlockSkeleton',
  'CountUp',
  'Crosshair',
  'Dialog',
  'DimensionLine',
  'Drawer',
  'FigCaption',
  'Figure',
  'FreshnessChip',
  'Gauge',
  'Glyph',
  'HexBullet',
  'HexRing',
  'IconButton',
  'Kbd',
  'LeaderLine',
  'LinkButton',
  'Logo',
  'Markup',
  'MarkupProvider',
  'Marquee',
  'Medal',
  'Meter',
  'Odometer',
  'Panel',
  'Popover',
  'ProbeReticle',
  'Progress',
  'Reveal',
  'SearchField',
  'SegmentedControl',
  'Select',
  'Skeleton',
  'Slider',
  'Sparkline',
  'SplitReveal',
  'Stat',
  'StatusDot',
  'StepRail',
  'Surface',
  'Switch',
  'TabPanel',
  'Tabs',
  'TextArea',
  'TextField',
  'TickRuler',
  'Toast',
  'ToastViewport',
  'Tooltip',
];

const HOOKS = [
  'useControllableState',
  'useCountUp',
  'useDraw',
  'useElementSize',
  'useFocusTrap',
  'useInView',
  'useIsDesktop',
  'useIsPhone',
  'useMagnetic',
  'useMedia',
  'usePointerFine',
  'usePresence',
  'useReducedMotion',
  'useReveal',
  'useSpotlight',
  'useTilt',
];

const HELPERS = [
  'DrawContext',
  'GLYPH_GROUPS',
  'GLYPH_NAMES',
  'formatAge',
  'formatNumber',
  'isGlyphName',
  'parseMarkup',
  'stripMarkup',
  'tabIds',
];

describe('@/ui barrel', () => {
  it('exports every component', () => {
    expect(COMPONENTS.filter((n) => !(n in ui))).toEqual([]);
  });

  it('exports every hook', () => {
    expect(HOOKS.filter((n) => !(n in ui))).toEqual([]);
  });

  it('exports the helpers', () => {
    expect(HELPERS.filter((n) => !(n in ui))).toEqual([]);
  });
});
