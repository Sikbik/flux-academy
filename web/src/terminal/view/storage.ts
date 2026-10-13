/**
 * Command history survives a reload of the page for the length of the browser session, like a
 * shell's history does for the length of the terminal. sessionStorage can be missing or throw
 * (private windows, blocked storage), so every access is guarded and the terminal works without it.
 */

const PREFIX = 'flux-academy:terminal:history:';
export const MAX_STORED = 200;
const MAX_LINE = 1000;

export function loadHistory(id: string): string[] {
  try {
    const raw = globalThis.sessionStorage?.getItem(PREFIX + id);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_LINE)
      .slice(-MAX_STORED);
  } catch {
    return [];
  }
}

export function saveHistory(id: string, history: readonly string[]): void {
  try {
    globalThis.sessionStorage?.setItem(PREFIX + id, JSON.stringify(history.slice(-MAX_STORED)));
  } catch {
    // Storage is a convenience: losing it loses nothing that matters.
  }
}
