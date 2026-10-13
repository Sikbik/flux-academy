/**
 * Column alignment for scripted output. Authors write a table with one tab between cells and the
 * engine pads the columns after templating, because the widest cell is only known once captures
 * and `{file:}` values are in: the widest cell of a column plus three spaces, as `docker ps` does.
 * The last cell of a line is never padded.
 */

import type { OutLine, Span } from './types';

type Cell = Span[];

const cellLength = (cell: Cell): number => cell.reduce((n, s) => n + s.text.length, 0);

function splitCells(spans: readonly Span[]): Cell[] {
  const cells: Cell[] = [[]];
  for (const span of spans) {
    const parts = span.text.split('\t');
    parts.forEach((part, i) => {
      if (i > 0) cells.push([]);
      if (part !== '') (cells[cells.length - 1] as Cell).push({ ...span, text: part });
    });
  }
  return cells;
}

function merge(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && last.kind === s.kind) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/** Align the tab separated lines of `lines`. Lines without a tab are returned unchanged. */
export function alignTable(lines: readonly OutLine[], gap = 3): OutLine[] {
  const rows = lines.map((l) => (l.text.includes('\t') ? splitCells(l.spans) : null));
  const widths: number[] = [];
  for (const cells of rows) {
    if (!cells) continue;
    cells.forEach((cell, i) => {
      if (i < cells.length - 1) widths[i] = Math.max(widths[i] ?? 0, cellLength(cell));
    });
  }
  return lines.map((line, k) => {
    const cells = rows[k];
    if (!cells) return line;
    const spans: Span[] = [];
    cells.forEach((cell, i) => {
      spans.push(...cell);
      if (i < cells.length - 1) {
        spans.push({ text: ' '.repeat((widths[i] ?? 0) - cellLength(cell) + gap) });
      }
    });
    const merged = merge(spans.filter((s) => s.text !== ''));
    return {
      ...line,
      spans: merged,
      text: merged
        .map((s) => s.text)
        .join('')
        .replace(/\s+$/, ''),
      table: true,
    };
  });
}
