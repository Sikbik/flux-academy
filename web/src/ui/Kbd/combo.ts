/**
 * Keyboard combo parsing for the Kbd primitive. Pure: platform is passed in.
 *
 *   "mod+k"       Ctrl K on Windows and Linux, Command K on a Mac
 *   "shift+/"     Shift /
 *   "g o"         two keys in sequence: G then O
 */

export interface KeyLabel {
  /** What is rendered: text, or a glyph name for keys drawn as an icon. */
  text?: string;
  glyph?: 'command' | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right';
  /** Spoken name, for the accessible label. */
  spoken: string;
}

const NAMED: Record<string, { text: string; spoken: string }> = {
  ctrl: { text: 'Ctrl', spoken: 'Control' },
  control: { text: 'Ctrl', spoken: 'Control' },
  shift: { text: 'Shift', spoken: 'Shift' },
  alt: { text: 'Alt', spoken: 'Alt' },
  option: { text: 'Alt', spoken: 'Alt' },
  enter: { text: 'Enter', spoken: 'Enter' },
  return: { text: 'Enter', spoken: 'Enter' },
  esc: { text: 'Esc', spoken: 'Escape' },
  escape: { text: 'Esc', spoken: 'Escape' },
  tab: { text: 'Tab', spoken: 'Tab' },
  space: { text: 'Space', spoken: 'Space' },
  backspace: { text: 'Bksp', spoken: 'Backspace' },
  delete: { text: 'Del', spoken: 'Delete' },
  home: { text: 'Home', spoken: 'Home' },
  end: { text: 'End', spoken: 'End' },
  pageup: { text: 'PgUp', spoken: 'Page up' },
  pagedown: { text: 'PgDn', spoken: 'Page down' },
};

/** One key of a combo, as a label for the given platform. */
export function keyLabel(key: string, mac: boolean): KeyLabel {
  const k = key.trim().toLowerCase();
  if (k === 'mod') {
    return mac ? { glyph: 'command', spoken: 'Command' } : { text: 'Ctrl', spoken: 'Control' };
  }
  if (k === 'cmd' || k === 'meta' || k === 'command') {
    return mac ? { glyph: 'command', spoken: 'Command' } : { text: 'Win', spoken: 'Windows' };
  }
  if (k === 'up' || k === 'arrowup') return { glyph: 'arrow-up', spoken: 'Up arrow' };
  if (k === 'down' || k === 'arrowdown') return { glyph: 'arrow-down', spoken: 'Down arrow' };
  if (k === 'left' || k === 'arrowleft') return { glyph: 'arrow-left', spoken: 'Left arrow' };
  if (k === 'right' || k === 'arrowright') return { glyph: 'arrow-right', spoken: 'Right arrow' };
  const named = NAMED[k];
  if (named) return named;
  const text = key.length === 1 ? key.toUpperCase() : key;
  return { text, spoken: text };
}

export type ComboToken = { kind: 'key'; label: KeyLabel } | { kind: 'then' };

/** Splits "mod+shift+k" into keys and "g o" into keys joined by a sequence marker. */
export function parseCombo(combo: string, mac: boolean): ComboToken[] {
  const out: ComboToken[] = [];
  const steps = combo.trim().split(/\s+/).filter(Boolean);
  steps.forEach((step, si) => {
    if (si > 0) out.push({ kind: 'then' });
    // A bare "+" is the plus key; otherwise "+" joins keys.
    const keys = step === '+' ? ['+'] : step.split('+').filter((k) => k !== '');
    for (const k of keys) out.push({ kind: 'key', label: keyLabel(k, mac) });
  });
  return out;
}

/** "Control K" or "G then O": for aria-label. */
export function spokenCombo(tokens: ComboToken[]): string {
  const parts: string[] = [];
  let chord: string[] = [];
  const flush = () => {
    if (chord.length) parts.push(chord.join(' '));
    chord = [];
  };
  for (const t of tokens) {
    if (t.kind === 'key') chord.push(t.label.spoken);
    else flush();
  }
  flush();
  return parts.join(' then ');
}

export function detectMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}
