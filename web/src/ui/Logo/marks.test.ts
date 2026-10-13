import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ARTBOARDS, type ShapeRole } from './marks';
import { allLogoSources, COLOUR, type LogoTone, type LogoVariant, logoSource } from './variants';

/** The provenance test: the Logo draws exactly what is in the official files, nothing else. */

const BRAND = fileURLToPath(new URL('../../../public/brand/', import.meta.url));

interface ParsedShape {
  role: ShapeRole;
  tag: string;
  d?: string;
  ellipse?: number[];
  transform: string;
  group: string;
  fill: string;
}

/**
 * A transform list as plain numbers: `translate(0)` and `translate(0 0)` are the same identity
 * and are dropped; `translate(x)` means `translate(x 0)`. Anything else is kept as written.
 */
function norm(s: string | undefined): string {
  const out: string[] = [];
  for (const m of (s ?? '').matchAll(/(\w+)\(([^)]*)\)/g)) {
    const name = m[1] as string;
    const args = (m[2] as string)
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (name === 'translate') {
      const [x = 0, y = 0] = args;
      if (x === 0 && y === 0) continue;
      out.push(`translate(${x} ${y})`);
    } else {
      out.push(`${name}(${args.join(' ')})`);
    }
  }
  return out.join(' ');
}

/** `#fff` and `#ffffff` are the same colour. */
function hex6(c: string): string {
  const m = c
    .trim()
    .toLowerCase()
    .match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : c.trim().toLowerCase();
}

const ARITY: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

/** Path data as a list of [command, ...numbers], with implicit repeats made explicit. */
function canonicalPath(d: string): string[] {
  const out: string[] = [];
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  let cmd = '';
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i] as string;
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
      if (t.toLowerCase() === 'z') out.push(t);
      continue;
    }
    const n = ARITY[cmd.toLowerCase()] ?? 0;
    const args = tokens.slice(i, i + n).map((x) => String(Number(x)));
    out.push([cmd, ...args].join(' '));
    i += n;
  }
  return out;
}

function parseFile(rel: string): { w: number; h: number; shapes: ParsedShape[] } {
  const src = readFileSync(`${BRAND}${rel}`, 'utf8');
  const vb = src.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!vb) throw new Error(`no viewBox in ${rel}`);
  const shapes: ParsedShape[] = [];
  const stack: string[] = [];
  const re = /<(\/?)(g|path|ellipse)\b([^>]*?)\/?>/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const [, close, tag, attrs] = m as unknown as [string, string, string, string];
    const attr = (name: string) => attrs.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
    if (tag === 'g') {
      if (close) stack.pop();
      else stack.push(attr('transform') ?? '');
      continue;
    }
    if (close) continue;
    const id = attr('id') ?? '';
    const role: ShapeRole = /^(Path_81|Ellipse_64)$/.test(id)
      ? 'disc'
      : /^Path_7[3-6]$/.test(id)
        ? 'symbol'
        : 'word';
    shapes.push({
      role,
      tag,
      d: tag === 'path' ? attr('d') : undefined,
      ellipse: tag === 'ellipse' ? ['cx', 'cy', 'rx', 'ry'].map((k) => Number(attr(k))) : undefined,
      transform: norm(attr('transform')),
      group: norm(stack.filter(Boolean).join(' ')),
      fill: hex6(attr('fill') ?? '#000000'),
    });
  }
  return { w: Number(vb[1]), h: Number(vb[2]), shapes };
}

describe('Logo provenance', () => {
  const sources = allLogoSources();

  it('covers every variant and tone', () => {
    const variants: LogoVariant[] = ['mark', 'round', 'lockup', 'academy'];
    const tones: LogoTone[] = ['blue', 'white', 'black', 'gray'];
    for (const v of variants) {
      for (const t of tones) expect(logoSource(v, t)).toBeTruthy();
    }
    expect(logoSource('academy', 'blue')).toBe(logoSource('round', 'blue'));
  });

  it('uses only the four Brand Book colours', () => {
    const allowed = new Set(['#2b61d1', '#ffffff', '#000000', '#7e7c7c']);
    for (const s of sources) {
      for (const fill of Object.values(s.fills)) expect(allowed.has(fill)).toBe(true);
    }
    expect(Object.values(COLOUR).every((c) => allowed.has(c))).toBe(true);
  });

  for (const source of sources) {
    it(`matches the official file ${source.file}`, () => {
      const file = parseFile(source.file);
      const board = ARTBOARDS[source.artboard];
      expect(board.w).toBe(file.w);
      expect(board.h).toBe(file.h);
      expect(board.shapes.length).toBe(file.shapes.length);

      board.shapes.forEach((shape, i) => {
        const official = file.shapes[i] as ParsedShape;
        expect(shape.role).toBe(official.role);
        expect(shape.tag).toBe(official.tag);
        if (shape.tag === 'path') {
          expect(canonicalPath(shape.d ?? '')).toEqual(canonicalPath(official.d ?? ''));
        } else {
          expect([shape.cx, shape.cy, shape.rx, shape.ry]).toEqual(official.ellipse);
        }
        expect(norm(shape.transform)).toBe(official.transform);
        expect(norm(shape.group)).toBe(official.group);

        const want =
          shape.role === 'disc'
            ? source.fills.disc
            : shape.role === 'word'
              ? source.fills.word
              : source.fills.symbol;
        expect(hex6(want ?? '#000000')).toBe(official.fill);
      });
    });
  }
});
