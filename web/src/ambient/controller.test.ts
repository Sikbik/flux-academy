import { describe, expect, it } from 'vitest';
import {
  createIdleTracker,
  createWakeFilter,
  IDLE_MS,
  shouldAutoStart,
  WAKE_GRACE_MS,
  WAKE_MOVE_PX,
} from './controller';

const base = {
  idleMs: IDLE_MS,
  enabled: true,
  finePointer: true,
  hidden: false,
  ambientOn: false,
  modalOpen: false,
  blocked: false,
};

describe('shouldAutoStart', () => {
  it('starts after 120 s of stillness', () => {
    expect(IDLE_MS).toBe(120_000);
    expect(shouldAutoStart(base)).toBe(true);
    expect(shouldAutoStart({ ...base, idleMs: IDLE_MS - 1 })).toBe(false);
  });

  it('respects the preference, a coarse pointer, a hidden tab, a modal and blockers', () => {
    expect(shouldAutoStart({ ...base, enabled: false })).toBe(false);
    expect(shouldAutoStart({ ...base, finePointer: false })).toBe(false);
    expect(shouldAutoStart({ ...base, hidden: true })).toBe(false);
    expect(shouldAutoStart({ ...base, modalOpen: true })).toBe(false);
    expect(shouldAutoStart({ ...base, blocked: true })).toBe(false);
    expect(shouldAutoStart({ ...base, ambientOn: true })).toBe(false);
  });
});

describe('createIdleTracker', () => {
  it('measures time since the last input', () => {
    const t = createIdleTracker(1000);
    expect(t.idleFor(1500)).toBe(500);
    t.touch(2000);
    expect(t.idleFor(2600)).toBe(600);
    expect(t.idleFor(1000)).toBe(0);
  });
});

describe('createWakeFilter', () => {
  it('ignores input in the grace period', () => {
    const f = createWakeFilter();
    f.enter(0);
    expect(f.shouldWake({ type: 'keydown', key: 'a' }, WAKE_GRACE_MS - 1)).toBe(false);
    expect(f.shouldWake({ type: 'keydown', key: 'a' }, WAKE_GRACE_MS)).toBe(true);
  });

  it('wakes on a key, a press, a wheel turn or a touch, but not a lone modifier', () => {
    const f = createWakeFilter();
    f.enter(0);
    const t = 5000;
    expect(f.shouldWake({ type: 'keydown', key: 'Shift' }, t)).toBe(false);
    expect(f.shouldWake({ type: 'keydown', key: 'Control' }, t)).toBe(false);
    expect(f.shouldWake({ type: 'keydown', key: 'Enter' }, t)).toBe(true);
    expect(f.shouldWake({ type: 'pointerdown' }, t)).toBe(true);
    expect(f.shouldWake({ type: 'wheel' }, t)).toBe(true);
    expect(f.shouldWake({ type: 'touchstart' }, t)).toBe(true);
  });

  it('needs the pointer to travel before it wakes', () => {
    const f = createWakeFilter();
    f.enter(0);
    const t = 5000;
    expect(f.shouldWake({ type: 'pointermove', pointerType: 'mouse', clientX: 100, clientY: 100 }, t)).toBe(
      false,
    );
    expect(f.shouldWake({ type: 'pointermove', pointerType: 'mouse', clientX: 110, clientY: 100 }, t)).toBe(
      false,
    );
    expect(
      f.shouldWake(
        { type: 'pointermove', pointerType: 'mouse', clientX: 110 + WAKE_MOVE_PX, clientY: 100 },
        t,
      ),
    ).toBe(true);
  });

  it('does not count a touch as moving the mouse', () => {
    const f = createWakeFilter();
    f.enter(0);
    expect(f.shouldWake({ type: 'pointermove', pointerType: 'touch', clientX: 0, clientY: 0 }, 5000)).toBe(
      false,
    );
    expect(
      f.shouldWake({ type: 'pointermove', pointerType: 'touch', clientX: 900, clientY: 900 }, 5000),
    ).toBe(false);
  });

  it('starts counting travel again on each entry', () => {
    const f = createWakeFilter();
    f.enter(0);
    f.shouldWake({ type: 'pointermove', pointerType: 'mouse', clientX: 0, clientY: 0 }, 5000);
    expect(f.shouldWake({ type: 'pointermove', pointerType: 'mouse', clientX: 500, clientY: 0 }, 5000)).toBe(
      true,
    );
    f.enter(6000);
    expect(f.shouldWake({ type: 'pointermove', pointerType: 'mouse', clientX: 500, clientY: 0 }, 7000)).toBe(
      false,
    );
  });
});
