/**
 * The hotkey registry: one document listener, scopes, chords and a shortcuts overlay's data source.
 *
 * Combos are lower case and `+` separated: `mod+k`, `shift+/`, `?`, `a`, `escape`. `mod` is Command on
 * Apple platforms and Control elsewhere. A chord is two steps separated by a space: `g o` presses `g`
 * then `o` within 1.2 s.
 *
 * Rules
 * - Plain keys are ignored while the visitor is typing in an input, a textarea or an editor. Combos with
 *   Control, Command or Alt, and `escape`, still work (set `allowInInput` to opt a plain key in).
 * - Scopes: `global` is always on. A page or a lab pushes its own with `useHotkeyScope('lesson')`. An
 *   `exclusive` scope (a modal) silences every other scope while it is on top, so `g o` does nothing
 *   behind the command deck.
 * - A handler may return `false` to leave the event alone (let the browser or another handler act).
 * - Priority: hotkeys run in registration order unless a definition sets `priority`, and a higher one runs
 *   first. A page that wants a key the shell already binds (`/` opens the command deck everywhere, but the
 *   glossary wants it for its own search) takes it with `useHotkeyClaim`, which registers at a priority
 *   above every ordinary binding for as long as the component is mounted. If the claim's handler returns
 *   `false` (the page has nothing to focus right now) the global binding still gets the key.
 *
 *   useHotkey({ id: 'lesson.next', keys: 'arrowright', label: 'Next step', group: 'Lesson',
 *               scope: 'lesson', run: () => next() });
 *   useHotkeyClaim('/', () => searchField.current?.focus(), { scope: 'glossary', label: 'Search the glossary' });
 *
 * Adapted from fluxcommunity/web/src/lib/hotkeys.ts (combo parsing, same owner, MIT).
 */

import { useEffect, useId, useRef } from 'react';
import { create } from 'zustand';
import { isMacLike } from '@/lib/platform';

export type HotkeyScope = string;

export interface HotkeyDef {
  /** Stable id, unique across the app (`deck.open`, `lesson.next`). */
  id: string;
  /** One combo (`mod+k`) or several, or a chord (`g o`). */
  keys: string | readonly string[];
  /** What it does, in a few words: "Open the command deck". */
  label: string;
  /** Heading in the shortcuts overlay. Default `General`. */
  group?: string;
  /** Default `global`. */
  scope?: HotkeyScope;
  /** Return `false` to leave the event unhandled. */
  // biome-ignore lint/suspicious/noConfusingVoidType: most handlers return nothing; `false` is the only meaningful value
  run: (event: KeyboardEvent) => void | false;
  /** Fire even while typing. Default: only combos that carry Control, Command or Alt, and Escape. */
  allowInInput?: boolean;
  /** Evaluated on every key press. */
  enabled?: () => boolean;
  /** Keep it out of the shortcuts overlay. */
  hidden?: boolean;
  /**
   * Which binding gets a key first when several match: higher runs first, ties keep registration order.
   * Default 0. `useHotkeyClaim` uses `CLAIM_PRIORITY`.
   */
  priority?: number;
}

/** The priority of a page's claim on a key the shell binds globally. */
export const CLAIM_PRIORITY = 100;

// ---------------------------------------------------------------------------
// Combos (pure)
// ---------------------------------------------------------------------------

export interface ParsedCombo {
  key: string;
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  /** null: the combo does not care about Shift (the usual case for punctuation like `?`). */
  shift: boolean | null;
}

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const ALIASES: Record<string, string> = {
  esc: 'escape',
  space: ' ',
  spacebar: ' ',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  return: 'enter',
  plus: '+',
  del: 'delete',
};

export function parseCombo(combo: string): ParsedCombo {
  const out: ParsedCombo = { key: '', mod: false, ctrl: false, meta: false, alt: false, shift: null };
  const raw = combo.trim().toLowerCase();
  const parts = raw === '+' ? ['+'] : raw.replace(/\+\+$/, '+plus').split('+');
  for (const part of parts) {
    switch (part) {
      case 'mod':
        out.mod = true;
        break;
      case 'ctrl':
      case 'control':
        out.ctrl = true;
        break;
      case 'meta':
      case 'cmd':
      case 'command':
        out.meta = true;
        break;
      case 'alt':
      case 'option':
        out.alt = true;
        break;
      case 'shift':
        out.shift = true;
        break;
      default:
        out.key = ALIASES[part] ?? part;
    }
  }
  return out;
}

export function matchCombo(e: KeyLike, combo: ParsedCombo, mac: boolean): boolean {
  if (!combo.key) return false;
  if (e.key.toLowerCase() !== combo.key) return false;
  const wantCtrl = combo.ctrl || (combo.mod && !mac);
  const wantMeta = combo.meta || (combo.mod && mac);
  if (e.ctrlKey !== wantCtrl) return false;
  if (e.metaKey !== wantMeta) return false;
  if (e.altKey !== combo.alt) return false;
  if (combo.shift === true && !e.shiftKey) return false;
  // A capital letter is somebody typing, not a shortcut: Shift+A must not toggle ambient mode.
  if (combo.shift === null && e.shiftKey && /^[a-z]$/.test(combo.key)) return false;
  return true;
}

/** True when the event target is somewhere the visitor is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).tagName !== 'string') return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color', 'image'].includes(
      type,
    );
  }
  return el.isContentEditable === true;
}

/** Human labels for one step: `mod+k` -> ["Ctrl", "K"] or ["Cmd", "K"]. */
export function comboLabels(combo: string, mac: boolean): string[] {
  const c = parseCombo(combo);
  const out: string[] = [];
  if (c.mod) out.push(mac ? '⌘' : 'Ctrl');
  if (c.ctrl) out.push(mac ? '⌃' : 'Ctrl');
  if (c.alt) out.push(mac ? '⌥' : 'Alt');
  if (c.shift === true) out.push(mac ? '⇧' : 'Shift');
  if (c.meta) out.push(mac ? '⌘' : 'Win');
  const names: Record<string, string> = {
    escape: 'Esc',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    ' ': 'Space',
    enter: 'Enter',
  };
  const key =
    names[c.key] ??
    (c.key.length === 1 ? c.key.toUpperCase() : c.key.charAt(0).toUpperCase() + c.key.slice(1));
  out.push(key);
  return out;
}

/** The kbd chips for a whole `keys` string, one array per step: `g o` -> [["G"], ["O"]]. */
export function keysLabels(keys: string, mac: boolean): string[][] {
  return keys
    .trim()
    .split(/\s+/)
    .map((step) => comboLabels(step, mac));
}

// ---------------------------------------------------------------------------
// Engine (pure given its inputs)
// ---------------------------------------------------------------------------

export const CHORD_TIMEOUT_MS = 1200;

interface Compiled {
  def: HotkeyDef;
  /** Each alternative is one or two parsed steps. */
  sequences: ParsedCombo[][];
  order: number;
}

export interface ScopeEntry {
  name: HotkeyScope;
  /** While on top, only this scope's hotkeys run. */
  exclusive: boolean;
}

export interface EngineOptions {
  mac?: boolean;
  chordTimeoutMs?: number;
  now?: () => number;
}

export interface HandleInput extends KeyLike {
  target?: EventTarget | null;
  repeat?: boolean;
  isComposing?: boolean;
}

export type HandleResult = 'handled' | 'armed' | 'ignored';

export interface HotkeyEngine {
  register(def: HotkeyDef): () => void;
  pushScope(name: HotkeyScope, exclusive?: boolean): () => void;
  /** Feed one keydown. `run` is called with the original event object when a hotkey matches. */
  handle(input: HandleInput, event: KeyboardEvent): HandleResult;
  /** Everything registered, in registration order. */
  list(): HotkeyDef[];
  /** The scopes that are active right now, bottom first (always starts with `global`). */
  scopes(): ScopeEntry[];
  /** The prefix keys of a chord that is waiting for its second key, or null. */
  pending(): string | null;
  reset(): void;
}

export function createHotkeyEngine(options: EngineOptions = {}): HotkeyEngine {
  const mac = options.mac ?? isMacLike();
  const chordMs = options.chordTimeoutMs ?? CHORD_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const compiled = new Map<string, Compiled>();
  const scopeStack: ScopeEntry[] = [];
  let order = 0;
  let armed: { combo: ParsedCombo; text: string; at: number } | null = null;

  const compile = (def: HotkeyDef): Compiled => ({
    def,
    sequences: (Array.isArray(def.keys) ? [...def.keys] : [def.keys as string]).map((k) =>
      k.trim().split(/\s+/).slice(0, 2).map(parseCombo),
    ),
    order: order++,
  });

  const activeScopes = (): Set<string> => {
    const top = scopeStack[scopeStack.length - 1];
    if (top?.exclusive) return new Set([top.name]);
    return new Set(['global', ...scopeStack.map((s) => s.name)]);
  };

  const isPlain = (c: ParsedCombo) => !c.mod && !c.ctrl && !c.meta && !c.alt;

  const matchesAllowed = (c: Compiled, typing: boolean, scopes: Set<string>): boolean => {
    const scope = c.def.scope ?? 'global';
    if (!scopes.has(scope)) return false;
    if (c.def.enabled && !c.def.enabled()) return false;
    return typing
      ? c.def.allowInInput === true ||
          c.sequences.some((s) => !isPlain(s[0] as ParsedCombo) || s[0]?.key === 'escape')
      : true;
  };

  return {
    register(def) {
      compiled.set(def.id, compile(def));
      return () => {
        compiled.delete(def.id);
      };
    },

    pushScope(name, exclusive = false) {
      const entry: ScopeEntry = { name, exclusive };
      scopeStack.push(entry);
      return () => {
        const i = scopeStack.indexOf(entry);
        if (i >= 0) scopeStack.splice(i, 1);
      };
    },

    handle(input, event) {
      if (input.isComposing) return 'ignored';
      const typing = isTypingTarget(input.target ?? null);
      const scopes = activeScopes();
      const list = [...compiled.values()].sort(
        (a, b) => (b.def.priority ?? 0) - (a.def.priority ?? 0) || a.order - b.order,
      );
      const t = now();
      if (armed && t - armed.at > chordMs) armed = null;

      // Second step of a chord.
      if (armed) {
        const first = armed.combo;
        armed = null;
        for (const c of list) {
          if (!matchesAllowed(c, typing, scopes)) continue;
          for (const seq of c.sequences) {
            if (seq.length !== 2) continue;
            const [a, b] = seq as [ParsedCombo, ParsedCombo];
            if (a.key === first.key && matchCombo(input, b, mac)) {
              if (c.def.run(event) !== false) return 'handled';
            }
          }
        }
        // Not a chord: fall through and treat this key on its own.
      }

      // First step of a chord: arm and wait.
      for (const c of list) {
        if (!matchesAllowed(c, typing, scopes)) continue;
        for (const seq of c.sequences) {
          if (seq.length === 2 && matchCombo(input, seq[0] as ParsedCombo, mac)) {
            if (input.repeat) return 'ignored';
            armed = { combo: seq[0] as ParsedCombo, text: input.key, at: t };
            return 'armed';
          }
        }
      }

      // A single combo.
      for (const c of list) {
        if (!matchesAllowed(c, typing, scopes)) continue;
        for (const seq of c.sequences) {
          if (seq.length === 1 && matchCombo(input, seq[0] as ParsedCombo, mac)) {
            if (c.def.run(event) !== false) return 'handled';
          }
        }
      }
      return 'ignored';
    },

    list() {
      return [...compiled.values()].sort((a, b) => a.order - b.order).map((c) => c.def);
    },

    scopes() {
      return [{ name: 'global', exclusive: false }, ...scopeStack];
    },

    pending() {
      if (armed && now() - armed.at <= chordMs) return armed.text;
      return null;
    },

    reset() {
      armed = null;
    },
  };
}

// ---------------------------------------------------------------------------
// The app's engine and the React bindings
// ---------------------------------------------------------------------------

export const hotkeys = createHotkeyEngine();

/** A reactive mirror of the registry, for the shortcuts overlay and the chord hint. */
interface HotkeyView {
  defs: HotkeyDef[];
  scopes: string[];
  pending: string | null;
}

export const useHotkeyView = create<HotkeyView>(() => ({ defs: [], scopes: ['global'], pending: null }));

function refreshView(): void {
  const defs = hotkeys.list();
  const scopes = hotkeys.scopes().map((s) => s.name);
  const cur = useHotkeyView.getState();
  if (
    cur.defs.length === defs.length &&
    cur.defs.every((d, i) => d === defs[i]) &&
    cur.scopes.length === scopes.length &&
    cur.scopes.every((s, i) => s === scopes[i])
  ) {
    return;
  }
  useHotkeyView.setState({ defs, scopes });
}

/** Register outside React (app start-up). Returns the unregister function. */
export function registerHotkey(def: HotkeyDef): () => void {
  const off = hotkeys.register(def);
  refreshView();
  return () => {
    off();
    refreshView();
  };
}

/** Register a hotkey for the life of the component. Re-registers only when `id` or `keys` change. */
export function useHotkey(def: HotkeyDef): void {
  const ref = useRef(def);
  ref.current = def;
  const keysKey = Array.isArray(def.keys) ? def.keys.join('|') : (def.keys as string);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `ref` always holds the latest definition.
  useEffect(() => {
    const unregister = hotkeys.register({
      ...ref.current,
      run: (e) => ref.current.run(e),
      enabled: () => (ref.current.enabled ? ref.current.enabled() : true),
    });
    refreshView();
    return () => {
      unregister();
      refreshView();
    };
  }, [def.id, keysKey, def.scope, def.group, def.label, def.hidden, def.priority]);
}

/** Activate a hotkey scope while the component is mounted (and `active`). */
export function useHotkeyScope(
  name: HotkeyScope,
  opts: { active?: boolean; exclusive?: boolean } = {},
): void {
  const active = opts.active ?? true;
  const exclusive = opts.exclusive ?? false;
  useEffect(() => {
    if (!active) return;
    const pop = hotkeys.pushScope(name, exclusive);
    refreshView();
    return () => {
      pop();
      refreshView();
    };
  }, [name, active, exclusive]);
}

export interface HotkeyClaimOptions {
  /**
   * The scope the claim lives in, pushed for as long as the component is mounted. The deck and the
   * shortcuts sheet are exclusive scopes, so a claim is silent behind them. Default: a private scope.
   */
  scope?: HotkeyScope;
  /** Unique across the app. Default: derived from the keys and the component instance. */
  id?: string;
  /** What the shortcuts overlay says the key does on this page: "Search the glossary". */
  label?: string;
  /** Heading in the shortcuts overlay. Default `General`. */
  group?: string;
  /** Keep it out of the overlay. Default: hidden only when no `label` is given. */
  hidden?: boolean;
  /** Fire even while the visitor is typing in a field. Default false. */
  allowInInput?: boolean;
  /** Fire while a modal (a dialog or drawer) holds the page. Default false. */
  allowInModal?: boolean;
  /** Evaluated on every key press. */
  enabled?: () => boolean;
}

/**
 * A page's claim on a key the shell already binds. While the component is mounted the claim runs before
 * every ordinary binding of the same key, so `/` can focus the page's own search instead of opening the
 * command deck. It keeps the registry's rules: a plain key is ignored while the visitor is typing, a
 * modifier changes the combo (Ctrl+/ is not `/`), and it stays quiet while a modal holds the page.
 * Return `false` from `run` when there is nothing to do right now and the global binding gets the key.
 *
 *   const search = useRef<HTMLInputElement>(null);
 *   useHotkeyClaim('/', () => { search.current?.focus(); search.current?.select(); }, {
 *     label: 'Search the glossary',
 *   });
 */
export function useHotkeyClaim(
  keys: string | readonly string[],
  // biome-ignore lint/suspicious/noConfusingVoidType: most handlers return nothing; `false` is the only meaningful value
  run: (event: KeyboardEvent) => void | false,
  opts: HotkeyClaimOptions = {},
): void {
  const uid = useId();
  const keysKey = Array.isArray(keys) ? keys.join('|') : (keys as string);
  const id = opts.id ?? `claim.${keysKey}.${uid}`;
  const scope = opts.scope ?? `claim:${uid}`;
  const allowInModal = opts.allowInModal === true;

  useHotkeyScope(scope);
  useHotkey({
    id,
    keys: keys as string | readonly string[],
    label: opts.label ?? 'Page shortcut',
    group: opts.group ?? 'General',
    scope,
    hidden: opts.hidden ?? opts.label === undefined,
    allowInInput: opts.allowInInput,
    enabled: opts.enabled,
    priority: CLAIM_PRIORITY,
    run: (e) => {
      if (!allowInModal && isModalOpen()) return false;
      return run(e);
    },
  });
}

/** A dialog or drawer from the design system holds the page (it sets `data-scroll-locked`). */
function isModalOpen(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.scrollLocked === 'true';
}

let attached = 0;
let detach: (() => void) | null = null;

/** Attach the one document listener. Refcounted; returns a detach function. */
export function attachHotkeys(doc: Document = document): () => void {
  attached += 1;
  if (attached === 1) {
    const onKeyDown = (e: KeyboardEvent) => {
      const before = hotkeys.pending();
      const result = hotkeys.handle(e, e);
      if (result === 'armed') useHotkeyView.setState({ pending: e.key });
      else if (before !== null || useHotkeyView.getState().pending !== null) {
        useHotkeyView.setState({ pending: null });
      }
      if (result === 'handled' || result === 'armed') {
        // `g` then `o` and friends are ours; a handled combo should not also reach the page.
        if (result === 'handled') e.preventDefault();
      }
    };
    doc.addEventListener('keydown', onKeyDown);
    // A chord that times out should clear the hint.
    const timer = window.setInterval(() => {
      if (useHotkeyView.getState().pending !== null && hotkeys.pending() === null) {
        useHotkeyView.setState({ pending: null });
      }
    }, 300);
    detach = () => {
      doc.removeEventListener('keydown', onKeyDown);
      window.clearInterval(timer);
    };
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    attached -= 1;
    if (attached === 0) {
      detach?.();
      detach = null;
    }
  };
}
