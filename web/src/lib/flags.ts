/**
 * Query flags for development and QA (docs/ARCHITECTURE.md section 4.8), parsed once per page load.
 *
 *   ?demo=1          use the built-in baked sample instead of the API (always labelled fallback)
 *   ?beat=<seconds>  development only, with ?demo=1: simulate a block every N seconds so the Beat and
 *                    anything driven by `onBlock` can be exercised offline. Never present in production.
 *   ?ambient=1       start in ambient mode
 *   ?intro=0         skip the intro
 *   ?q=low|medium|high|none   force a quality tier (read by `lib/quality.ts`)
 *   ?stage=debug     scene stats overlay (read by the scenes)
 *   ?accent=<id>     development only: force an accent regardless of unlock state
 */

export interface Flags {
  demo: boolean;
  /** Development only, seconds between simulated blocks in demo mode. null when not requested. */
  beatSec: number | null;
  ambient: boolean;
  /** false only when ?intro=0 (or false) was passed. */
  intro: boolean;
  stage: string | null;
  q: string | null;
  accent: string | null;
}

function truthy(v: string | null): boolean {
  return v === '1' || v === 'true' || v === '';
}

export function parseFlags(search: string, isDev: boolean): Flags {
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(search);
  } catch {
    p = new URLSearchParams();
  }
  const beat = Number(p.get('beat'));
  return {
    demo: p.has('demo') && truthy(p.get('demo')),
    beatSec: isDev && Number.isFinite(beat) && beat >= 1 ? Math.min(beat, 3600) : null,
    ambient: p.has('ambient') && truthy(p.get('ambient')),
    intro: p.get('intro') !== '0' && p.get('intro') !== 'false',
    stage: p.get('stage'),
    q: p.get('q'),
    accent: isDev ? p.get('accent') : null,
  };
}

let cached: Flags | null = null;

/** The flags of this page load. Stable for the life of the page (a client navigation does not change them). */
export function getFlags(): Flags {
  if (!cached) {
    cached = parseFlags(
      typeof location === 'undefined' ? '' : location.search,
      typeof import.meta !== 'undefined' && import.meta.env?.DEV === true,
    );
  }
  return cached;
}
