import { describe, expect, it } from 'vitest';
import { GLYPH_GROUPS, GLYPH_NAMES, GLYPHS, type GlyphShape, isGlyphName } from './glyphs';

// ---- A small SVG path reader: enough to bound every shape the set can draw -------------------

type Pt = [number, number];

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;

function tokens(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  for (const m of d.matchAll(TOKEN)) {
    out.push(m[1] ?? Number(m[2]));
  }
  return out;
}

const angle = (ux: number, uy: number, vx: number, vy: number): number =>
  Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

/** Points along an SVG elliptical arc (SVG 1.1 appendix F.6.5), including its end. */
function arcPoints(
  [x1, y1]: Pt,
  rxIn: number,
  ryIn: number,
  rotDeg: number,
  large: number,
  sweep: number,
  [x2, y2]: Pt,
): Pt[] {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [[x2, y2]];
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const theta = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const out: Pt[] = [];
  const steps = 32;
  for (let k = 1; k <= steps; k++) {
    const t = theta + (delta * k) / steps;
    out.push([
      cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
      cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos,
    ]);
  }
  return out;
}

function bezier(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  const steps = 16;
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    let level = pts;
    while (level.length > 1) {
      const next: Pt[] = [];
      for (let i = 0; i < level.length - 1; i++) {
        const a = level[i] as Pt;
        const b = level[i + 1] as Pt;
        next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
      level = next;
    }
    out.push(level[0] as Pt);
  }
  return out;
}

/** Every point a path visits (vertices, plus samples along curves and arcs). */
function pathPoints(d: string): Pt[] {
  const t = tokens(d);
  const pts: Pt[] = [];
  let i = 0;
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  let prevCtl: Pt | null = null;
  let prevCmd = '';
  const num = (): number => {
    const v = t[i++];
    if (typeof v !== 'number') throw new Error(`expected a number in "${d}"`);
    return v;
  };
  while (i < t.length) {
    const tok = t[i];
    let cmd: string;
    if (typeof tok === 'string') {
      cmd = tok;
      i++;
    } else if (prevCmd) {
      // Implicit repeat: a moveto repeats as a lineto.
      cmd = prevCmd === 'M' ? 'L' : prevCmd === 'm' ? 'l' : prevCmd;
    } else {
      throw new Error(`path "${d}" does not start with a command`);
    }
    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    const ox = rel ? cur[0] : 0;
    const oy = rel ? cur[1] : 0;
    let ctl: Pt | null = null;
    switch (up) {
      case 'M': {
        cur = [ox + num(), oy + num()];
        start = cur;
        pts.push(cur);
        break;
      }
      case 'L': {
        cur = [ox + num(), oy + num()];
        pts.push(cur);
        break;
      }
      case 'H': {
        cur = [ox + num(), cur[1]];
        pts.push(cur);
        break;
      }
      case 'V': {
        cur = [cur[0], oy + num()];
        pts.push(cur);
        break;
      }
      case 'C': {
        const c1: Pt = [ox + num(), oy + num()];
        const c2: Pt = [ox + num(), oy + num()];
        const e: Pt = [ox + num(), oy + num()];
        pts.push(...bezier([cur, c1, c2, e]));
        ctl = c2;
        cur = e;
        break;
      }
      case 'S': {
        const c1: Pt =
          prevCtl && 'CcSs'.includes(prevCmd) ? [2 * cur[0] - prevCtl[0], 2 * cur[1] - prevCtl[1]] : cur;
        const c2: Pt = [ox + num(), oy + num()];
        const e: Pt = [ox + num(), oy + num()];
        pts.push(...bezier([cur, c1, c2, e]));
        ctl = c2;
        cur = e;
        break;
      }
      case 'Q': {
        const c1: Pt = [ox + num(), oy + num()];
        const e: Pt = [ox + num(), oy + num()];
        pts.push(...bezier([cur, c1, e]));
        ctl = c1;
        cur = e;
        break;
      }
      case 'T': {
        const c1: Pt =
          prevCtl && 'QqTt'.includes(prevCmd) ? [2 * cur[0] - prevCtl[0], 2 * cur[1] - prevCtl[1]] : cur;
        const e: Pt = [ox + num(), oy + num()];
        pts.push(...bezier([cur, c1, e]));
        ctl = c1;
        cur = e;
        break;
      }
      case 'A': {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = num();
        const sweep = num();
        const e: Pt = [ox + num(), oy + num()];
        pts.push(...arcPoints(cur, rx, ry, rot, large, sweep, e));
        cur = e;
        break;
      }
      case 'Z': {
        cur = start;
        break;
      }
      default:
        throw new Error(`unknown path command "${cmd}" in "${d}"`);
    }
    prevCtl = ctl;
    prevCmd = cmd;
  }
  return pts;
}

function shapeBox(shape: GlyphShape): Box {
  let pts: Pt[];
  if (typeof shape === 'string') pts = pathPoints(shape);
  else if ('dot' in shape) {
    const [cx, cy, r] = shape.dot;
    pts = [
      [cx - r, cy - r],
      [cx + r, cy + r],
    ];
  } else pts = pathPoints(shape.fill);
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxX: Math.max(...pts.map((p) => p[0])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}

function glyphBox(shapes: readonly GlyphShape[]): Box {
  const boxes = shapes.map(shapeBox);
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

const entries = Object.entries(GLYPHS) as [string, readonly GlyphShape[]][];

// ---- The set ------------------------------------------------------------------------------------

/** What the starter set shipped with: a name is never renamed or removed. */
const STARTER = [
  'tier-cumulus',
  'tier-nimbus',
  'tier-stratus',
  'status-ok',
  'status-warn',
  'status-crit',
  'status-off',
  'status-pending',
  'status-live',
  'arrow-up-right',
  'arrow-right',
  'arrow-left',
  'arrow-up',
  'arrow-down',
  'chevron-down',
  'chevron-up',
  'chevron-left',
  'chevron-right',
  'check',
  'close',
  'plus',
  'minus',
  'search',
  'menu',
  'info',
  'warning',
  'help',
  'copy',
  'download',
  'upload',
  'share',
  'external',
  'link',
  'lock',
  'unlock',
  'play',
  'pause',
  'restart',
  'refresh',
  'undo',
  'redo',
  'reset',
  'command',
  'keyboard',
  'sound-on',
  'sound-off',
  'motion',
  'motion-off',
  'ambient',
  'eye',
  'filter',
  'sort',
  'expand',
  'spark',
  'clock',
  'block',
  'terminal',
  'layers',
  'sliders',
];

/** The brief: every one of these must exist. */
const REQUIRED = [
  // tracks and lesson kinds
  'tier-cumulus',
  'tier-nimbus',
  'tier-stratus',
  'track-cumulus',
  'track-nimbus',
  'track-stratus',
  'kind-concept',
  'kind-hands-on',
  'kind-project',
  // labs
  'lab-forge',
  'lab-network',
  'lab-failover',
  'lab-terminal',
  'lab-explorer',
  'lab-agent-desk',
  // actions
  'play',
  'pause',
  'stop',
  'restart',
  'copy',
  'download',
  'upload',
  'share',
  'undo',
  'redo',
  'reset',
  'lock',
  'unlock',
  'check',
  'cross',
  'warning',
  'info',
  'external',
  'search',
  'menu',
  'close',
  'chevron-up',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'arrow-up',
  'arrow-down',
  'arrow-left',
  'arrow-right',
  'plus',
  'minus',
  'trash',
  'edit',
  'save',
  'filter',
  'sort',
  'settings',
  'eye',
  'eye-off',
  'bookmark',
  'flag',
  'home',
  'user',
  'bell',
  'calendar',
  'book',
  'code',
  'file',
  'folder',
  'key',
  'shield',
  'globe',
  'map-pin',
  'sparkle',
  // status
  'status-ok',
  'status-warn',
  'status-crit',
  'status-off',
  'status-pending',
  'status-live',
  // nodes
  'node',
  'node-off',
  'instance',
  'region',
  'packet',
  'route',
  // docker
  'container',
  'image',
  'layers',
  'registry',
  'port',
  'volume',
  'env',
  'docker-command',
  'dockerfile',
  // money
  'price',
  'flux',
  'wallet',
  // time
  'clock',
  'block',
  'hourglass',
  'timer',
  // achievement marks
  'ach-first-light',
  'ach-three-is-company',
  'ach-first-blood',
  'ach-spec-whisperer',
  'ach-penny-pincher',
  'ach-block-watcher',
  'ach-globetrotter',
  'ach-shell-shocked',
  'ach-explorer',
  'ach-cumulus-operator',
  'ach-nimbus-engineer',
  'ach-stratus-architect',
  // generic chrome
  'list',
  'grid',
  'link',
  'hash',
  'question',
  'lightbulb',
  'target',
  'puzzle',
  'gauge',
];

describe('glyph set', () => {
  it('has at least 80 glyphs', () => {
    expect(GLYPH_NAMES.length).toBeGreaterThanOrEqual(80);
    expect(GLYPH_NAMES).toHaveLength(entries.length);
  });

  it('names are kebab-case', () => {
    for (const name of GLYPH_NAMES) {
      expect(name, name).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    }
  });

  it('keeps every name the starter set shipped with', () => {
    for (const name of STARTER) {
      expect(isGlyphName(name), name).toBe(true);
    }
  });

  it('has every glyph the brief asks for', () => {
    for (const name of REQUIRED) {
      expect(isGlyphName(name), name).toBe(true);
    }
  });

  it('isGlyphName rejects strangers and inherited keys', () => {
    expect(isGlyphName('not-a-glyph')).toBe(false);
    expect(isGlyphName('toString')).toBe(false);
    expect(isGlyphName('')).toBe(false);
  });

  it('every glyph draws something', () => {
    for (const [name, shapes] of entries) {
      expect(shapes.length, name).toBeGreaterThan(0);
      for (const s of shapes) {
        if (typeof s === 'string') expect(s.length, name).toBeGreaterThan(1);
        else if ('dot' in s) expect(s.dot[2], name).toBeGreaterThan(0);
        else expect(s.fill.length, name).toBeGreaterThan(1);
      }
      expect(
        shapes.some((s) => typeof s === 'string' || 'fill' in s),
        `${name} needs a path, not only dots`,
      ).toBe(true);
    }
  });

  it('opacity is a fraction', () => {
    for (const [name, shapes] of entries) {
      for (const s of shapes) {
        if (typeof s !== 'string' && s.o !== undefined) {
          expect(s.o, name).toBeGreaterThan(0);
          expect(s.o, name).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('no two glyphs are the same drawing', () => {
    const seen = new Map<string, string>();
    for (const [name, shapes] of entries) {
      const key = JSON.stringify(shapes);
      const twin = seen.get(key);
      expect(twin, `${name} repeats ${twin}`).toBeUndefined();
      seen.set(key, name);
    }
  });

  it('no glyph draws the same stroked path twice', () => {
    for (const [name, shapes] of entries) {
      const strokes = shapes.filter((s): s is string => typeof s === 'string');
      expect(new Set(strokes).size, `${name} repeats a path`).toBe(strokes.length);
    }
  });
});

describe('glyph geometry', () => {
  it('the path reader understands the commands the set uses', () => {
    expect(pathPoints('M1 2L3 4H5V6Z')).toEqual([
      [1, 2],
      [3, 4],
      [5, 4],
      [5, 6],
    ]);
    expect(pathPoints('M1 1l2 3h1v-1')).toEqual([
      [1, 1],
      [3, 4],
      [4, 4],
      [4, 3],
    ]);
    // A half circle of radius 5 from (0,0) to (10,0) bulges to y = -5 (sweep 1, large 0).
    const arc = pathPoints('M0 0A5 5 0 0 1 10 0');
    expect(Math.min(...arc.map((p) => p[1]))).toBeCloseTo(-5, 1);
    expect(arc.at(-1)?.[0]).toBeCloseTo(10, 5);
    // A cubic that overshoots its end points is bounded by its samples, not its control polygon.
    const curve = pathPoints('M0 0C0 10 10 10 10 0');
    expect(Math.max(...curve.map((p) => p[1]))).toBeCloseTo(7.5, 1);
  });

  it('every shape sits inside the 24 unit canvas with room for the stroke', () => {
    for (const [name, shapes] of entries) {
      const b = glyphBox(shapes);
      expect(b.minX, `${name} minX`).toBeGreaterThanOrEqual(1);
      expect(b.minY, `${name} minY`).toBeGreaterThanOrEqual(1);
      expect(b.maxX, `${name} maxX`).toBeLessThanOrEqual(23);
      expect(b.maxY, `${name} maxY`).toBeLessThanOrEqual(23);
    }
  });

  it('keeps to the live area (3..21; a radius 9.5 hexagon reaches 2.5)', () => {
    for (const [name, shapes] of entries) {
      const b = glyphBox(shapes);
      expect(b.minX, `${name} minX`).toBeGreaterThanOrEqual(2.4);
      expect(b.minY, `${name} minY`).toBeGreaterThanOrEqual(2.4);
      expect(b.maxX, `${name} maxX`).toBeLessThanOrEqual(21.6);
      expect(b.maxY, `${name} maxY`).toBeLessThanOrEqual(21.6);
    }
  });

  it('is not an empty or tiny mark', () => {
    for (const [name, shapes] of entries) {
      const b = glyphBox(shapes);
      expect(Math.max(b.maxX - b.minX, b.maxY - b.minY), name).toBeGreaterThanOrEqual(6);
    }
  });

  it('is roughly centred on the canvas', () => {
    for (const [name, shapes] of entries) {
      const b = glyphBox(shapes);
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      expect(Math.abs(cx - 12), `${name} x centre ${cx}`).toBeLessThanOrEqual(2.6);
      expect(Math.abs(cy - 12), `${name} y centre ${cy}`).toBeLessThanOrEqual(2.6);
    }
  });
});

describe('glyph groups', () => {
  const grouped = GLYPH_GROUPS.flatMap((g) => g.names);

  it('has unique ids and titles, and no empty group', () => {
    const ids = GLYPH_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GLYPH_GROUPS) {
      expect(g.title.length, g.id).toBeGreaterThan(0);
      expect(g.names.length, g.id).toBeGreaterThan(0);
      expect(g.id, g.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('every group name is a glyph', () => {
    for (const name of grouped) {
      expect(isGlyphName(name), name).toBe(true);
    }
  });

  it('every glyph is in exactly one group', () => {
    const count = new Map<string, number>();
    for (const name of grouped) count.set(name, (count.get(name) ?? 0) + 1);
    for (const name of GLYPH_NAMES) {
      expect(count.get(name), `${name} should be in exactly one group`).toBe(1);
    }
    expect(grouped).toHaveLength(GLYPH_NAMES.length);
  });

  it('the groups cover the names', () => {
    expect([...grouped].sort()).toEqual([...GLYPH_NAMES].sort());
  });
});
