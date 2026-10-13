/**
 * Age formatting for the freshness chips. `3 s`, `2 min`, `5 h`, `2 d`; under a second it is
 * `now`. Null or negative input is unknown and returns an empty string.
 */
export function formatAge(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '';
  const s = Math.floor(ms / 1000);
  if (s < 1) return 'now';
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
