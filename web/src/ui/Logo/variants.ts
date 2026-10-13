/**
 * Which official file each (variant, tone) of the Logo is taken from, and what that file fills
 * each role with. The geometry lives in `marks.ts` (generated from the same files); the
 * provenance test in `marks.test.ts` checks both against web/public/brand.
 *
 * Tones are the Brand Book colourways, nothing else: blue (Blue Wave), white, black, gray.
 * The product is dark, so the round and lockup files used are the negative versions for dark
 * backgrounds: a blue disc with a white symbol and wordmark, a white disc with a blue or black
 * symbol, a gray disc with a white symbol.
 */
import type { ArtboardId } from './marks';

export type LogoTone = 'blue' | 'white' | 'black' | 'gray';
export type LogoVariant = 'mark' | 'round' | 'lockup' | 'academy';

/** The four official fills (Brand Book v2.0). The gray is the one the official gray files use. */
export const COLOUR: Record<LogoTone, string> = {
  blue: '#2b61d1',
  white: '#ffffff',
  black: '#000000',
  gray: '#7e7c7c',
};

export interface LogoFills {
  disc?: string;
  symbol: string;
  word?: string;
}

export interface LogoSource {
  /** The official file, relative to web/public/brand. */
  file: string;
  artboard: ArtboardId;
  fills: LogoFills;
}

const W = COLOUR.white;
const B = COLOUR.blue;
const K = COLOUR.black;
const G = COLOUR.gray;

const MARK: Record<LogoTone, LogoSource> = {
  blue: { file: 'mark/flux-mark-blue.svg', artboard: 'mark', fills: { symbol: B } },
  white: { file: 'mark/flux-mark-white.svg', artboard: 'mark', fills: { symbol: W } },
  black: { file: 'mark/flux-mark-black.svg', artboard: 'mark', fills: { symbol: K } },
  gray: { file: 'mark/flux-mark-gray.svg', artboard: 'mark', fills: { symbol: G } },
};

const ROUND: Record<LogoTone, LogoSource> = {
  blue: { file: 'round/flux-round-blue-white.svg', artboard: 'round-ellipse', fills: { disc: B, symbol: W } },
  white: { file: 'round/flux-round-white-blue.svg', artboard: 'round-path', fills: { disc: W, symbol: B } },
  black: { file: 'round/flux-round-white-black.svg', artboard: 'round-path', fills: { disc: W, symbol: K } },
  gray: { file: 'round/flux-round-gray.svg', artboard: 'round-path', fills: { disc: G, symbol: W } },
};

const LOCKUP: Record<LogoTone, LogoSource> = {
  blue: {
    file: 'lockup/flux-logo-blue-white.svg',
    artboard: 'lockup-ellipse',
    fills: { disc: B, symbol: W, word: W },
  },
  white: {
    file: 'lockup/flux-white-blue.svg',
    artboard: 'lockup-path',
    fills: { disc: W, symbol: B, word: W },
  },
  black: {
    file: 'lockup/flux-white-black.svg',
    artboard: 'lockup-path',
    fills: { disc: W, symbol: K, word: W },
  },
  // There is no gray-disc lockup in the brand kit: the official gray lockup is the all-gray one.
  gray: { file: 'lockup/flux-gray-symbol.svg', artboard: 'lockup-mono', fills: { symbol: G, word: G } },
};

/** The source for a variant and tone. `academy` draws the round mark and sets the words live. */
export function logoSource(variant: LogoVariant, tone: LogoTone): LogoSource {
  if (variant === 'mark') return MARK[tone];
  if (variant === 'lockup') return LOCKUP[tone];
  return ROUND[tone];
}

/** Every source the Logo can draw, for the provenance test. */
export function allLogoSources(): LogoSource[] {
  return [...Object.values(MARK), ...Object.values(ROUND), ...Object.values(LOCKUP)];
}

/** The live text colour of the `academy` lockup: white on the dark UI, gray for the gray tone. */
export const ACADEMY_TEXT: Record<LogoTone, string> = {
  blue: W,
  white: W,
  black: W,
  gray: G,
};
