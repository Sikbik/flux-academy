/**
 * What the lab remembers on this device: which scenarios were finished (so a tab keeps its tick after a
 * reload) and which tab was open. Both are conveniences: every access is guarded and the lab works
 * without them.
 */

const DONE_KEY = 'flux-academy:terminal-lab:done';
const TAB_KEY = 'flux-academy:terminal-lab:tab';

export function loadDone(valid: readonly string[]): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(DONE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && valid.includes(v));
  } catch {
    return [];
  }
}

export function saveDone(ids: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(DONE_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // not worth surfacing
  }
}

export function loadTab(valid: readonly string[]): string | null {
  try {
    const v = globalThis.sessionStorage?.getItem(TAB_KEY);
    return v && valid.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveTab(id: string): void {
  try {
    globalThis.sessionStorage?.setItem(TAB_KEY, id);
  } catch {
    // not worth surfacing
  }
}
