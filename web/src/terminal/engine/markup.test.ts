import { describe, expect, it } from 'vitest';
import { escapeMarkup, hasMarkup, noteLine, parseMarkup, plainLine, stripMarkup } from './markup';

describe('parseMarkup', () => {
  it('reads a prefix tag as the whole-line tone', () => {
    const l = parseMarkup('[ok]Successfully tagged you/app:1.0.0');
    expect(l.tone).toBe('ok');
    expect(l.spans).toEqual([{ text: 'Successfully tagged you/app:1.0.0', kind: 'ok' }]);
    expect(l.text).toBe('Successfully tagged you/app:1.0.0');
    expect(l.channel).toBe('out');
  });

  it('knows the four contract tags', () => {
    for (const tag of ['ok', 'warn', 'err', 'dim'] as const) {
      expect(parseMarkup(`[${tag}]x`).tone).toBe(tag);
    }
  });

  it('drops one space after a prefix tag, keeping deliberate indentation', () => {
    expect(parseMarkup('[ok] naming to docker.io/x').text).toBe('naming to docker.io/x');
    expect(parseMarkup('[dim]   three spaces').text).toBe('  three spaces');
  });

  it('reads inline tags and [/] returns to the line default', () => {
    const l = parseMarkup('Status: [warn]Downloaded newer image[/] for nginx');
    expect(l.spans).toEqual([
      { text: 'Status: ' },
      { text: 'Downloaded newer image', kind: 'warn' },
      { text: ' for nginx' },
    ]);
    const d = parseMarkup('[dim]a [ok]b[/] c');
    expect(d.spans.map((s) => s.kind)).toEqual(['dim', 'ok', 'dim']);
  });

  it('keeps unknown brackets literal', () => {
    expect(parseMarkup('["a", "b"]').text).toBe('["a", "b"]');
    expect(parseMarkup('[]').text).toBe('[]');
    expect(parseMarkup('[ok').text).toBe('[ok');
    expect(parseMarkup('a [unknown] b').text).toBe('a [unknown] b');
    expect(parseMarkup('[+] Building 1.2s (3/3) FINISHED').text).toBe('[+] Building 1.2s (3/3) FINISHED');
  });

  it('honours the backslash escape', () => {
    const l = parseMarkup('literal \\[ok] tag');
    expect(l.text).toBe('literal [ok] tag');
    expect(l.spans).toEqual([{ text: 'literal [ok] tag' }]);
  });

  it('marks the sandbox channel for note lines', () => {
    const l = parseMarkup('[note]Recorded sample.');
    expect(l.channel).toBe('note');
    expect(l.tone).toBeUndefined();
  });

  it('handles empty and all-tag input', () => {
    expect(parseMarkup('').spans).toEqual([]);
    expect(parseMarkup('[ok]').text).toBe('');
    expect(parseMarkup('[/]').text).toBe('');
  });

  it('never throws on odd input', () => {
    for (const s of ['[', ']', '[[ok]]', '\\', '\\[', '[ok][err][dim]', '[ok]\\[ok]']) {
      expect(() => parseMarkup(s)).not.toThrow();
    }
  });
});

describe('escapeMarkup', () => {
  it('round-trips arbitrary text', () => {
    const samples = ['[ok]', 'a [warn] b', '\\[ok]', '[/]', 'plain', '["x"]', '[dim][err]'];
    for (const s of samples) {
      expect(parseMarkup(escapeMarkup(s)).text, s).toBe(s);
    }
  });

  it('prevents tag injection', () => {
    const line = parseMarkup(`[ok]${escapeMarkup('[err]boom')}`);
    expect(line.tone).toBe('ok');
    expect(line.spans.every((s) => s.kind === 'ok')).toBe(true);
  });
});

describe('helpers', () => {
  it('stripMarkup returns plain text', () => {
    expect(stripMarkup('[ok]done [warn]careful[/]!')).toBe('done careful!');
  });

  it('plainLine and noteLine do not parse', () => {
    expect(plainLine('[ok] x').text).toBe('[ok] x');
    expect(noteLine('hi').channel).toBe('note');
    expect(plainLine('', 'dim').spans).toEqual([]);
  });

  it('hasMarkup detects tags but not escaped ones', () => {
    expect(hasMarkup('[ok]x')).toBe(true);
    expect(hasMarkup('x')).toBe(false);
    expect(hasMarkup('\\[ok] x')).toBe(false);
  });
});
