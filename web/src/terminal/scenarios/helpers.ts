/**
 * Small helpers for authoring scenarios: deterministic fake hashes (so output never changes
 * between loads) and fixed-width tables like the ones Docker prints.
 */

import { seeded } from '../engine/stream';

/** The first line of every scenario, so it is always clear this is a simulation. */
export const SIM_INTRO = '[dim]Simulation. Nothing here touches your machine or the network.';

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable pseudo random hex string for `seed`. These are decoration: they are not real digests. */
export function fakeHex(seed: string, length: number): string {
  const rnd = seeded(hashString(seed));
  let out = '';
  while (out.length < length) out += Math.floor(rnd() * 16).toString(16);
  return out;
}

/** `sha256:` plus 64 fake hex characters. */
export function fakeDigest(seed: string): string {
  return `sha256:${fakeHex(seed, 64)}`;
}

/** A BuildKit progress line: the step on the left, its time right aligned. */
export function buildLine(step: string, time: string, width = 84): string {
  const left = ` => ${step}`;
  const gap = Math.max(2, width - left.length - time.length);
  return `${left}${' '.repeat(gap)}${time}`;
}

/** The BuildKit header with the builder name on the right. */
export function buildHeader(
  seconds: string,
  steps: string,
  builder = 'docker:desktop-linux',
  width = 84,
): string {
  const left = `[+] Building ${seconds}s (${steps}) FINISHED`;
  return `${left}${' '.repeat(Math.max(2, width - left.length - builder.length))}${builder}`;
}
