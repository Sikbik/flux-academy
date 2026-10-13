/**
 * Beat state. A diagram is a pure function of its beat: every drawn thing asks "what state am I in at this
 * beat?" and CSS animates the change. Three states are enough to tell the story:
 *
 *   off    not drawn yet (or no longer wanted)
 *   focus  the subject of this beat: drawn, bright, hot edge
 *   on     drawn, context: dimmed so the focus stands out
 */

export type S = 'off' | 'on' | 'focus';

/** Which beats an element is the focus of: one beat, a list, or a predicate. */
export type FocusSpec = number | readonly number[] | ((beat: number) => boolean);

function isFocus(beat: number, spec: FocusSpec): boolean {
  if (typeof spec === 'number') return beat === spec;
  if (typeof spec === 'function') return spec(beat);
  return spec.includes(beat);
}

/**
 * The state of something that first appears at beat `at`.
 * `focus` defaults to the beat it appears on; `until` hides it again from that beat on (a thing that is
 * replaced, such as a packet in transit).
 */
export function stateAt(beat: number, at: number, focus?: FocusSpec, until?: number): S {
  if (beat < at) return 'off';
  if (until !== undefined && beat >= until) return 'off';
  return isFocus(beat, focus ?? at) ? 'focus' : 'on';
}

export type StFn = (at: number, focus?: FocusSpec, until?: number) => S;

/** `st(at, focus?, until?)` bound to one beat. */
export function makeSt(beat: number): StFn {
  return (at, focus, until) => stateAt(beat, at, focus, until);
}

/** Coerce anything to a valid beat index for a diagram with `count` beats. */
export function clampBeat(beat: unknown, count: number): number {
  const n = typeof beat === 'number' && Number.isFinite(beat) ? Math.round(beat) : 0;
  return Math.min(Math.max(0, count - 1), Math.max(0, n));
}

/** True when `beat` is a legal index for `count` beats. */
export function isValidBeat(beat: unknown, count: number): beat is number {
  return typeof beat === 'number' && Number.isInteger(beat) && beat >= 0 && beat < count;
}
