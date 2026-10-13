/**
 * Ambient mode's triggers (docs/DESIGN.md section 6): after 120 s without input, by the `A` key, from the
 * deck, or with `?ambient=1`. Any input wakes it again.
 *
 * The decisions are pure (`createIdleTracker`, `createWakeFilter`) so they are tested without a browser;
 * `startAmbientController` wires them to the document and to the overlay store.
 *
 *   - Auto start needs: the preference on, a fine pointer (a phone has no way to "move the mouse"), a
 *     visible tab, no modal open and nothing that asked to block it (`useAmbientBlock`).
 *   - Wake needs: a key (not a lone modifier), a press, a wheel turn, a touch, or the pointer travelling
 *     80 px. The first 700 ms after entering ignore input: that input is the thing that started it.
 */

import { useEffect } from 'react';
import { getFlags } from '@/lib/flags';
import { anyModalOverlayOpen, useOverlays } from '@/system/overlays';
import { usePrefs } from '@/system/prefs';

export const IDLE_MS = 120_000;
export const WAKE_MOVE_PX = 80;
export const WAKE_GRACE_MS = 700;
const CHECK_EVERY_MS = 5000;
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

// ---------------------------------------------------------------------------
// Idle
// ---------------------------------------------------------------------------

export interface IdleTracker {
  /** Something happened at `now`. */
  touch(now: number): void;
  /** Milliseconds since the last input. */
  idleFor(now: number): number;
}

export function createIdleTracker(start = 0): IdleTracker {
  let last = start;
  return {
    touch(now) {
      last = now;
    },
    idleFor(now) {
      return Math.max(0, now - last);
    },
  };
}

// ---------------------------------------------------------------------------
// Wake
// ---------------------------------------------------------------------------

export interface WakeEvent {
  type: string;
  key?: string;
  pointerType?: string;
  clientX?: number;
  clientY?: number;
}

export interface WakeFilter {
  /** Ambient just started at `now`. */
  enter(now: number): void;
  /** Whether this input should wake the page. */
  shouldWake(event: WakeEvent, now: number): boolean;
}

export function createWakeFilter(): WakeFilter {
  let enteredAt = 0;
  let travelled = 0;
  let lastX = Number.NaN;
  let lastY = Number.NaN;
  return {
    enter(now) {
      enteredAt = now;
      travelled = 0;
      lastX = Number.NaN;
      lastY = Number.NaN;
    },
    shouldWake(e, now) {
      if (now - enteredAt < WAKE_GRACE_MS) return false;
      if (e.type === 'keydown' && e.key !== undefined && MODIFIER_KEYS.has(e.key)) return false;
      if (e.type === 'pointermove') {
        // A touch has no "moving the mouse"; its taps are `pointerdown`.
        if (e.pointerType === 'touch') return false;
        const x = e.clientX ?? 0;
        const y = e.clientY ?? 0;
        if (!Number.isNaN(lastX)) travelled += Math.hypot(x - lastX, y - lastY);
        lastX = x;
        lastY = y;
        return travelled >= WAKE_MOVE_PX;
      }
      return true;
    },
  };
}

// ---------------------------------------------------------------------------
// Blockers
// ---------------------------------------------------------------------------

const blockers = new Set<symbol>();

/**
 * Keep ambient mode from starting by itself while something is going on that must not be interrupted (a
 * running simulation the learner is watching, a long upload). The `A` key and the deck still work.
 */
export function useAmbientBlock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const token = Symbol('ambient-block');
    blockers.add(token);
    return () => {
      blockers.delete(token);
    };
  }, [active]);
}

export function ambientBlocked(): boolean {
  return blockers.size > 0;
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

export interface AutoStartInput {
  idleMs: number;
  enabled: boolean;
  finePointer: boolean;
  hidden: boolean;
  ambientOn: boolean;
  modalOpen: boolean;
  blocked: boolean;
}

/** Pure: should ambient mode begin now. */
export function shouldAutoStart(i: AutoStartInput): boolean {
  if (!i.enabled || !i.finePointer || i.hidden || i.ambientOn || i.modalOpen || i.blocked) return false;
  return i.idleMs >= IDLE_MS;
}

/** Starts the triggers. Returns the stop function. Idempotent per call (each call has its own listeners). */
export function startAmbientController(): () => void {
  if (typeof window === 'undefined') return () => {};
  const root = document.documentElement;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const idle = createIdleTracker(performance.now());
  const wake = createWakeFilter();

  if (getFlags().ambient) useOverlays.getState().enterAmbient();

  const apply = (on: boolean) => {
    if (on) {
      root.dataset.ambient = 'true';
      wake.enter(performance.now());
    } else {
      delete root.dataset.ambient;
      idle.touch(performance.now());
    }
  };
  apply(useOverlays.getState().ambient);
  const offStore = useOverlays.subscribe((s, p) => {
    if (s.ambient !== p.ambient) apply(s.ambient);
  });

  const touch = () => idle.touch(performance.now());
  const touchEvents = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
  for (const type of touchEvents) window.addEventListener(type, touch, { capture: true, passive: true });
  const onVisible = () => {
    if (!document.hidden) touch();
  };
  document.addEventListener('visibilitychange', onVisible);

  // The decision is deferred one task, so a hotkey that reacts to the same key (`a` toggles ambient) has
  // already run and is not undone by the wake.
  const onWake = (e: Event) => {
    if (!useOverlays.getState().ambient) return;
    const p = e as PointerEvent;
    const k = e as KeyboardEvent;
    const ok = wake.shouldWake(
      { type: e.type, key: k.key, pointerType: p.pointerType, clientX: p.clientX, clientY: p.clientY },
      performance.now(),
    );
    if (!ok) return;
    window.setTimeout(() => {
      if (useOverlays.getState().ambient) useOverlays.getState().exitAmbient();
    }, 0);
  };
  const wakeEvents = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'] as const;
  for (const type of wakeEvents) window.addEventListener(type, onWake, { capture: true, passive: true });

  // One cheap check every few seconds: no timer is rearmed per pointer event.
  const timer = window.setInterval(() => {
    const overlays = useOverlays.getState();
    if (overlays.ambient || anyModalOverlayOpen(overlays)) {
      touch();
      return;
    }
    const lockedByModal = document.documentElement.dataset.scrollLocked === 'true';
    if (
      shouldAutoStart({
        idleMs: idle.idleFor(performance.now()),
        enabled: usePrefs.getState().ambient,
        finePointer: fine.matches,
        hidden: document.hidden,
        ambientOn: overlays.ambient,
        modalOpen: lockedByModal,
        blocked: ambientBlocked(),
      })
    ) {
      overlays.enterAmbient();
    }
  }, CHECK_EVERY_MS);

  return () => {
    window.clearInterval(timer);
    offStore();
    document.removeEventListener('visibilitychange', onVisible);
    for (const type of touchEvents) window.removeEventListener(type, touch, { capture: true });
    for (const type of wakeEvents) window.removeEventListener(type, onWake, { capture: true });
    delete root.dataset.ambient;
  };
}
