/** Display formatting for the simulator. Pure; the numbers themselves always come from the shared engine. */

export const usd = (n: number): string => `$${n.toFixed(2)}`;

export const fluxAmount = (n: number | null | undefined): string =>
  n === null || n === undefined ? '--' : `${n.toFixed(2)}`;

export const grouped = (n: number): string => Math.round(n).toLocaleString('en-US');

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function dateOf(ms: number): string {
  return Number.isFinite(ms) ? DATE.format(new Date(ms)) : '--';
}

/** `ports` as `31010 to 80` pairs for a summary line. */
export function portPairs(ports: readonly number[], containerPorts: readonly number[]): string {
  if (ports.length === 0) return 'none';
  return ports.map((p, i) => `${p} to ${containerPorts[i] ?? p}`).join(', ');
}

/** `GB` for a memory figure in MB, the way the Simple form shows it (1 GB = 1000 MB). */
export function gb(mb: number): string {
  const v = mb / 1000;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} GB`;
}

export function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
