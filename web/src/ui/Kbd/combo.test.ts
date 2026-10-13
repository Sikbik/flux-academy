import { describe, expect, it } from 'vitest';
import { keyLabel, parseCombo, spokenCombo } from './combo';

describe('keyLabel', () => {
  it('maps mod to Command on a Mac and Ctrl elsewhere', () => {
    expect(keyLabel('mod', true)).toEqual({ glyph: 'command', spoken: 'Command' });
    expect(keyLabel('mod', false)).toEqual({ text: 'Ctrl', spoken: 'Control' });
  });

  it('upper-cases single characters and keeps named keys', () => {
    expect(keyLabel('k', false).text).toBe('K');
    expect(keyLabel('esc', false).text).toBe('Esc');
    expect(keyLabel('ArrowLeft', false).glyph).toBe('arrow-left');
  });
});

describe('parseCombo', () => {
  it('parses a chord', () => {
    const t = parseCombo('mod+shift+k', false);
    expect(t.map((x) => (x.kind === 'key' ? (x.label.text ?? x.label.glyph) : '>'))).toEqual([
      'Ctrl',
      'Shift',
      'K',
    ]);
  });

  it('parses a sequence', () => {
    const t = parseCombo('g o', false);
    expect(t.map((x) => x.kind)).toEqual(['key', 'then', 'key']);
    expect(spokenCombo(t)).toBe('G then O');
  });

  it('treats a lone plus as the plus key', () => {
    const t = parseCombo('+', false);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ kind: 'key', label: { text: '+' } });
  });

  it('speaks a chord', () => {
    expect(spokenCombo(parseCombo('mod+k', true))).toBe('Command K');
  });
});
