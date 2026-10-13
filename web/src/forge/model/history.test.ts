import { describe, expect, it } from 'vitest';
import { UndoStack } from './history';

describe('UndoStack', () => {
  it('undoes and redoes in order', () => {
    const h = new UndoStack(0);
    h.push(1, { now: 0 });
    h.push(2, { now: 0 });
    expect(h.present).toBe(2);
    expect(h.undo()).toBe(1);
    expect(h.undo()).toBe(0);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe(1);
    expect(h.redo()).toBe(2);
    expect(h.redo()).toBeNull();
  });

  it('drops the redo branch on a new edit', () => {
    const h = new UndoStack('a');
    h.push('b');
    h.push('c');
    h.undo();
    h.push('d');
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBe('b');
  });

  it('coalesces rapid edits to one key into one step', () => {
    const h = new UndoStack(0, { coalesceMs: 500 });
    h.push(1, { key: 'name', now: 1000 });
    h.push(2, { key: 'name', now: 1100 });
    h.push(3, { key: 'name', now: 1400 });
    expect(h.depth).toBe(1);
    expect(h.undo()).toBe(0);
  });

  it('starts a new step after a pause or for another key', () => {
    const h = new UndoStack(0, { coalesceMs: 500 });
    h.push(1, { key: 'name', now: 1000 });
    h.push(2, { key: 'name', now: 1600 });
    h.push(3, { key: 'port', now: 1650 });
    expect(h.depth).toBe(3);
  });

  it('never merges across an undo', () => {
    const h = new UndoStack(0, { coalesceMs: 5000 });
    h.push(1, { key: 'k', now: 0 });
    h.push(2, { key: 'k', now: 1 });
    h.undo();
    h.push(9, { key: 'k', now: 2 });
    expect(h.undo()).toBe(0);
  });

  it('is bounded', () => {
    const h = new UndoStack(0, { limit: 3 });
    for (let i = 1; i <= 10; i++) h.push(i);
    expect(h.depth).toBe(3);
    h.undo();
    h.undo();
    expect(h.undo()).toBe(7);
    expect(h.undo()).toBeNull();
  });

  it('ignores identical values and resets', () => {
    const o = { a: 1 };
    const h = new UndoStack(o);
    h.push(o);
    expect(h.canUndo).toBe(false);
    h.push({ a: 2 });
    h.reset({ a: 3 });
    expect(h.canUndo).toBe(false);
    expect(h.present).toEqual({ a: 3 });
  });

  it('labels steps for tooltips', () => {
    const h = new UndoStack(0);
    h.push(1, { label: 'Change instances' });
    expect(h.undoLabel).toBe('Change instances');
    h.undo();
    expect(h.redoLabel).toBe('Change instances');
    expect(h.undoLabel).toBeNull();
  });
});
