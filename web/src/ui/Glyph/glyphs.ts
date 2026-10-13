/**
 * The Flux Academy glyph set (DESIGN 3.4). Original artwork: no emoji, no third-party icon
 * paths, never the Flux symbol. Lucide is for generic chrome only.
 *
 * Construction rules, so the set reads as one family at every size:
 *   - a 24 unit grid, live area 3..21 (a pointy-top hexagon of radius 9.5 is the one
 *     exception: its vertices reach 2.5 and 21.5)
 *   - a 1.5 unit stroke, square caps, mitred joins (set by the Glyph component)
 *   - hex-derived geometry: 30, 60 and 90 degree edges, the Flux symbol's own angle;
 *     chamfers (45 degree cuts) instead of radii; the panel silhouette (cuts at the top
 *     right and bottom left) is the default container shape; circles only for a clock face
 *     and a few round-by-nature marks
 *   - parallel strokes sit at least 2.5 units apart, so nothing fills in at 16 px
 *   - optical size, not bounding box: a hexagon is drawn at 9.5, a square at 8
 *   - depth with a 0.22 opacity fill on one primary face, never gradients
 *
 * A shape is one of
 *   string                a stroked path (`d`)
 *   { dot: [cx, cy, r] }  a filled circle
 *   { fill: d, o? }       a filled path (no stroke), optional opacity
 */
import { hexPath } from '../internal/hex';

export type GlyphShape =
  | string
  | { dot: [number, number, number]; o?: number }
  | { fill: string; o?: number };

// ---- Construction helpers (run once at module load; the output is plain path strings) ----

type Pt = readonly [number, number];

const r2 = (v: number): number => Math.round(v * 100) / 100;
const TAN30 = Math.tan(Math.PI / 6);
const RAD = Math.PI / 180;

/** A path through points, optionally closed. Absolute coordinates only. */
const pl = (pts: readonly Pt[], close = false): string =>
  `M${pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}${close ? 'Z' : ''}`;

/** Vertex k (0 = top, clockwise) of a pointy-top hexagon. */
const hv = (k: number, r = 9.5, cx = 12, cy = 12): Pt => {
  const a = (-90 + 60 * k) * RAD;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

/** A point on a pointy-top hexagon's edge `e` (it runs from vertex e to e + 1) at fraction `f`. */
const he = (e: number, f: number, r = 9.5, cx = 12, cy = 12): Pt => {
  const a = hv(e % 6, r, cx, cy);
  const b = hv((e + 1) % 6, r, cx, cy);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
};

const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/** The family silhouette: a hexagon of radius 9.5 at the centre. */
const H = hexPath(12, 12, 9.5);
/** A hexagon of any radius and centre. */
const h = (r: number, cx = 12, cy = 12): string => hexPath(cx, cy, r);

/** A chamfered rectangle. Cuts are per corner: the panel silhouette is `{ tr, bl }`. */
const cbox = (
  x: number,
  y: number,
  w: number,
  hgt: number,
  c: { tl?: number; tr?: number; br?: number; bl?: number } = {},
): string => {
  const { tl = 0, tr = 0, br = 0, bl = 0 } = c;
  const x2 = x + w;
  const y2 = y + hgt;
  const pts: Pt[] = [];
  if (tl) pts.push([x, y + tl], [x + tl, y]);
  else pts.push([x, y]);
  if (tr) pts.push([x2 - tr, y], [x2, y + tr]);
  else pts.push([x2, y]);
  if (br) pts.push([x2, y2 - br], [x2 - br, y2]);
  else pts.push([x2, y2]);
  if (bl) pts.push([x + bl, y2], [x, y2 - bl]);
  else pts.push([x, y2]);
  return pl(pts, true);
};

/** An open arrowhead (a V) with its tip at (x, y), travelling along `deg` (0 = right, 90 = down). */
const head = (x: number, y: number, deg: number, len = 3.4, spread = 40): string => {
  const b1 = (deg + 180 - spread) * RAD;
  const b2 = (deg + 180 + spread) * RAD;
  return pl([
    [x + len * Math.cos(b1), y + len * Math.sin(b1)],
    [x, y],
    [x + len * Math.cos(b2), y + len * Math.sin(b2)],
  ]);
};

/** A four-point star. `k` is how far the waist pulls in (0 is a plus, 0.5 a diamond). */
const star = (cx: number, cy: number, r: number, k = 0.26): string =>
  pl(
    [
      [cx, cy - r],
      [cx + k * r, cy - k * r],
      [cx + r, cy],
      [cx + k * r, cy + k * r],
      [cx, cy + r],
      [cx - k * r, cy + k * r],
      [cx - r, cy],
      [cx - k * r, cy - k * r],
    ],
    true,
  );

/** The top face of an isometric slab: a rhombus with 30 degree edges. */
const rhomb = (cy: number, w = 8, cx = 12): string => {
  const hh = w * TAN30;
  return pl(
    [
      [cx - w, cy],
      [cx, cy - hh],
      [cx + w, cy],
      [cx, cy + hh],
    ],
    true,
  );
};

/** The two visible lower edges of a slab below the top one: an open V. */
const vee = (cy: number, w = 8, cx = 12): string => {
  const hh = w * TAN30;
  return pl([
    [cx - w, cy],
    [cx, cy + hh],
    [cx + w, cy],
  ]);
};

/** A hex pillar of the bench: an isometric prism with a lit top face. Height is the shaft. */
const pillar = (shaft: number, w = 4.5, cx = 12, base?: number): GlyphShape[] => {
  const hh = w * TAN30;
  // Centred on the canvas unless a baseline is given, so each emblem sits level with text.
  const floor = base ?? 12 + (shaft + 2 * hh) / 2;
  const ty = floor - hh - shaft;
  // The silhouette is one closed hexagon (120 degree corners, so the miters stay inside the
  // walls); the top face and the front edge are drawn inside it, as in `block`.
  return [
    pl(
      [
        [cx, ty - hh],
        [cx + w, ty],
        [cx + w, ty + shaft],
        [cx, ty + hh + shaft],
        [cx - w, ty + shaft],
        [cx - w, ty],
      ],
      true,
    ),
    pl([
      [cx - w + 0.7, ty + 0.7 * TAN30],
      [cx, ty + hh],
      [cx + w - 0.7, ty + 0.7 * TAN30],
    ]),
    pl([
      [cx, ty + hh],
      [cx, ty + hh + shaft - 0.7],
    ]),
    {
      fill: pl(
        [
          [cx, ty - hh],
          [cx + w, ty],
          [cx, ty + hh],
          [cx - w, ty],
        ],
        true,
      ),
      o: 0.22,
    },
  ];
};

/** A loop arrow around a hexagon, clockwise (`dir` 1) or counter-clockwise (`dir` -1). */
const loop = (dir: 1 | -1): string[] => {
  const r = 8;
  const s = he(0, 0.45, r);
  const e = he(5, 0.55, r);
  const pts: Pt[] = [s, hv(1, r), hv(2, r), hv(3, r), hv(4, r), hv(5, r), e];
  const m = (p: Pt): Pt => (dir === 1 ? p : [24 - p[0], p[1]]);
  const path = pl(pts.map(m));
  const tip = m(e);
  const heading = dir === 1 ? -30 : -150; // along the last edge toward the top vertex
  return [path, head(tip[0], tip[1], heading, 4, 45)];
};

/** A gear: six teeth on hexagonal valleys, a hexagonal hole. */
const gear = (): string => {
  const pts: Pt[] = [];
  for (let k = 0; k < 6; k++) {
    const a = -90 + 60 * k;
    for (const [da, rr] of [
      [-21, 6.7],
      [-11, 9.3],
      [11, 9.3],
      [21, 6.7],
    ] as const) {
      const t = (a + da) * RAD;
      pts.push([12 + rr * Math.cos(t), 12 + rr * Math.sin(t)]);
    }
  }
  return pl(pts, true);
};

/** A hexagon drawn as six edge segments with a gap at every vertex (a zone boundary). */
const dashedHex = (r: number, gap = 0.2): string[] =>
  [0, 1, 2, 3, 4, 5].map((e) => pl([he(e, gap, r), he(e, 1 - gap, r)]));

/** A hub hexagon with three solid satellite hexagons on spokes, 120 degrees apart. */
const hubAndSpokes = (): GlyphShape[] => {
  const cx = 12;
  const cy = 14;
  const hub = h(3, cx, cy);
  const out: GlyphShape[] = [hub, { fill: hub, o: 0.22 }];
  for (const deg of [-90, 30, 150]) {
    const a = deg * RAD;
    const at = (d: number): Pt => [cx + d * Math.cos(a), cy + d * Math.sin(a)];
    const [sx, sy] = at(8.6);
    out.push(pl([at(3), at(6.6)]), { fill: h(2, sx, sy) });
  }
  return out;
};

// ---- The set ----------------------------------------------------------------------------

export const GLYPHS = {
  // ---- Tracks and tiers ----------------------------------------------------------------------
  // Tiers are layered slabs (one, two, three: shape, never colour alone). Tracks are bench
  // pillars (short, mid, tall), the same objects the network diorama draws.
  'tier-cumulus': [rhomb(12), { fill: rhomb(12), o: 0.22 }],
  'tier-nimbus': [rhomb(9.8), { fill: rhomb(9.8), o: 0.22 }, vee(14.2)],
  'tier-stratus': [rhomb(7.5), { fill: rhomb(7.5), o: 0.22 }, vee(11.9), vee(16.3)],
  'track-cumulus': pillar(4.5),
  'track-nimbus': pillar(8.6),
  'track-stratus': pillar(12.7),

  // ---- Lesson kinds ----------------------------------------------------------------------------
  // concept: an open book. hands-on: a cell under a pointer. project: parts assembled.
  'kind-concept': [
    pl(
      [
        [12, 6.5],
        [7.5, 5],
        [3.5, 5.5],
        [3.5, 18],
        [7.5, 17.5],
        [12, 19.5],
        [16.5, 17.5],
        [20.5, 18],
        [20.5, 5.5],
        [16.5, 5],
      ],
      true,
    ),
    // The spine stops short of the bottom vertex so its square cap stays inside the miter.
    pl([
      [12, 6.5],
      [12, 19],
    ]),
  ],
  'kind-hands-on': [
    pl([
      hv(3, 6.4, 9.4, 9.4),
      hv(4, 6.4, 9.4, 9.4),
      hv(5, 6.4, 9.4, 9.4),
      hv(0, 6.4, 9.4, 9.4),
      hv(1, 6.4, 9.4, 9.4),
      hv(2, 6.4, 9.4, 9.4),
    ]),
    pl(
      [
        [12.4, 12],
        [12.4, 20.2],
        [14.5, 18.2],
        [16.2, 21.2],
        [18, 20.3],
        [16.3, 17.2],
        [19.2, 17],
      ],
      true,
    ),
    {
      fill: pl(
        [
          [12.4, 12],
          [12.4, 20.2],
          [14.5, 18.2],
          [16.2, 21.2],
          [18, 20.3],
          [16.3, 17.2],
          [19.2, 17],
        ],
        true,
      ),
      o: 0.22,
    },
  ],
  'kind-project': [
    h(4.2, 12, 8.9),
    { fill: h(4.2, 12, 8.9), o: 0.22 },
    h(4.2, 8.36, 15.2),
    h(4.2, 15.64, 15.2),
  ],

  // ---- Labs -----------------------------------------------------------------------------------------
  // forge: an anvil with sparks. network: a hub with three satellites. failover: one cell lost,
  // traffic hopping to another. terminal: a window with a prompt. explorer: a lens over data.
  // agent desk: a request arrow stopped at a gate, and the check that lets it through.
  'lab-forge': [
    pl(
      [
        [2.5, 10],
        [7, 8.5],
        [21, 8.5],
        [21, 11.5],
        [16.5, 11.5],
        [15, 14],
        [15, 16.5],
        [17.5, 19.5],
        [6.5, 19.5],
        [9, 16.5],
        [9, 14],
        [7.5, 11.5],
      ],
      true,
    ),
    'M10.5 3.5V5.5',
    'M14.5 4.5V5.8',
    'M6.5 5.2V6',
  ],
  'lab-network': hubAndSpokes(),
  'lab-failover': [
    // The left cell is open at the top right; the path leaves it, hops over, and lands on the
    // standby cell, which is the one filled.
    pl([
      hv(1, 3.8, 6.6, 16.6),
      hv(2, 3.8, 6.6, 16.6),
      hv(3, 3.8, 6.6, 16.6),
      hv(4, 3.8, 6.6, 16.6),
      hv(5, 3.8, 6.6, 16.6),
      hv(0, 3.8, 6.6, 16.6),
      [6.6, 5.6],
      [8.4, 3.8],
      [15.6, 3.8],
      [17.4, 5.6],
      [17.4, 9.6],
    ]),
    head(17.4, 9.6, 90, 2.8, 42),
    h(3.8, 17.4, 16.6),
    { fill: h(3.8, 17.4, 16.6), o: 0.22 },
  ],
  'lab-terminal': [
    cbox(3.5, 4.5, 17, 15, { tr: 3.5, bl: 3.5 }),
    'M7.5 9.5L11 12.5L7.5 15.5',
    'M13 15.5H16.5',
  ],
  'lab-explorer': [
    h(6.4, 10.2, 10.2),
    'M15 15L20.5 20.5',
    { dot: [8.3, 11.9, 1.1] },
    { dot: [12.1, 11.9, 1.1] },
    { dot: [10.2, 8.5, 1.1] },
  ],
  'lab-agent-desk': [
    'M3 12H8.44',
    head(8.44, 12, 0, 3.2, 42),
    h(7, 14.5, 12),
    { fill: h(7, 14.5, 12), o: 0.22 },
    'M11.9 12.3L13.8 14.2L17.3 10.2',
  ],

  // ---- Status: a hexagon plus a mark, always paired with a word ----------------------------------
  'status-ok': [H, 'M8.4 12.4L11 15L15.8 9.4'],
  'status-warn': [H, 'M12 7.4V13', { dot: [12, 16.2, 1.1] }],
  'status-crit': [H, 'M9 9L15 15', 'M15 9L9 15'],
  'status-off': [H, 'M8.8 12H15.2'],
  'status-pending': [H, 'M12 7.6V12L15.2 14'],
  'status-live': [H, 'M6.8 12H9.4L10.8 8.6L13.2 15.4L14.6 12H17.2'],

  // ---- Actions and controls ---------------------------------------------------------------------------
  play: ['M8 5.5L18.5 12L8 18.5Z'],
  pause: [{ fill: 'M7.5 5.5H10.5V18.5H7.5Z' }, { fill: 'M13.5 5.5H16.5V18.5H13.5Z' }],
  stop: [cbox(6.5, 6.5, 11, 11, { tr: 2.5, bl: 2.5 })],
  restart: [...loop(1), { fill: 'M10.7 9.6L14.9 12L10.7 14.4Z' }],
  refresh: [
    pl([hv(5, 8), hv(0, 8), hv(1, 8)]),
    head(hv(1, 8)[0], hv(1, 8)[1], 30, 4, 45),
    pl([hv(2, 8), hv(3, 8), hv(4, 8)]),
    head(hv(4, 8)[0], hv(4, 8)[1], 210, 4, 45),
  ],
  reset: loop(-1),
  undo: [
    head(4, 8, 180, 5.66, 45),
    pl([
      [4, 8],
      [15.5, 8],
      [19.5, 12],
      [19.5, 16],
      [15.5, 20],
      [9, 20],
    ]),
  ],
  redo: [
    head(20, 8, 0, 5.66, 45),
    pl([
      [20, 8],
      [8.5, 8],
      [4.5, 12],
      [4.5, 16],
      [8.5, 20],
      [15, 20],
    ]),
  ],
  copy: ['M8.5 8.5H16.5L19.5 11.5V19.5H8.5Z', 'M5 15V7.5L8 4.5H16'],
  download: ['M12 4V15', 'M7 10L12 15L17 10', 'M4 20H20'],
  upload: ['M12 15V4', 'M7 9L12 4L17 9', 'M4 20H20'],
  share: ['M12 15V4', 'M8 8L12 4L16 8', 'M5 13V20H19V13'],
  external: ['M14 4H20V10', 'M20 4L11 13', 'M18 14V20H4V6H10'],
  link: [
    'M10 14L14 10',
    'M8.2 11.8L6.4 13.6A3.4 3.4 0 0 0 11.2 18.4L13 16.6',
    'M15.8 12.2L17.6 10.4A3.4 3.4 0 0 0 12.8 5.6L11 7.4',
  ],
  lock: [
    cbox(6, 11, 12, 9, { tr: 2.5, bl: 2.5 }),
    'M9 11V8.2L10.4 6H13.6L15 8.2V11',
    { dot: [12, 15.5, 1.2] },
  ],
  unlock: [
    cbox(6, 11, 12, 9, { tr: 2.5, bl: 2.5 }),
    'M9 11V8.2L10.4 6H13.6L15 8.2V9',
    { dot: [12, 15.5, 1.2] },
  ],
  check: ['M5 12.5L10 17.5L19 7'],
  cross: ['M5.5 5.5L18.5 18.5', 'M18.5 5.5L5.5 18.5'],
  close: ['M6 6L18 18', 'M18 6L6 18'],
  plus: ['M12 5V19', 'M5 12H19'],
  minus: ['M5 12H19'],
  trash: ['M4.5 7H19.5', 'M9.5 7V4.5H14.5V7', 'M6.5 7L7.6 20.5H16.4L17.5 7', 'M10 10.5V17', 'M14 10.5V17'],
  edit: ['M15.8 4.6L19.4 8.2L9.2 18.4L4.85 19.15L5.6 14.8Z', 'M5.6 14.8L9.2 18.4', 'M13.96 6.44L17.56 10.04'],
  save: ['M4 4H17L20 7V20H4Z', 'M8 4V8.5H15V4', 'M7.5 20V14H16.5V20'],
  search: [h(6.2, 10.5, 10.5), 'M15.2 15.2L20.5 20.5'],
  filter: ['M4 5H20L14 12.5V19L10 17V12.5Z'],
  sort: ['M7 4V20', 'M3.5 16.5L7 20L10.5 16.5', 'M17 20V4', 'M13.5 7.5L17 4L20.5 7.5'],
  expand: ['M4 9V4H9', 'M20 9V4H15', 'M4 15V20H9', 'M20 15V20H15'],
  settings: [gear(), h(3, 12, 12)],
  sliders: ['M4 7H20', 'M4 17H20', 'M9 4.5V9.5', 'M15 14.5V19.5'],
  eye: ['M2.5 12C5 7.5 8.5 5.5 12 5.5S19 7.5 21.5 12C19 16.5 15.5 18.5 12 18.5S5 16.5 2.5 12Z', h(2.8)],
  'eye-off': [
    'M2.5 12C5 7.5 8.5 5.5 12 5.5S19 7.5 21.5 12C19 16.5 15.5 18.5 12 18.5S5 16.5 2.5 12Z',
    h(2.8),
    'M4.5 19.5L19.5 4.5',
  ],
  bookmark: ['M7 3.5H17V20.5L12 16.2L7 20.5Z'],
  flag: ['M6 21V3.5', 'M6 4.5H18.5L15.8 8.5L18.5 12.5H6'],

  // ---- Arrows -------------------------------------------------------------------------------------------
  'arrow-up-right': ['M7 17L17 7', 'M9 7H17V15'],
  'arrow-right': ['M4 12H20', 'M14 6L20 12L14 18'],
  'arrow-left': ['M20 12H4', 'M10 6L4 12L10 18'],
  'arrow-up': ['M12 20V4', 'M6 10L12 4L18 10'],
  'arrow-down': ['M12 4V20', 'M6 14L12 20L18 14'],
  'chevron-down': ['M6 9L12 15L18 9'],
  'chevron-up': ['M6 15L12 9L18 15'],
  'chevron-left': ['M15 6L9 12L15 18'],
  'chevron-right': ['M9 6L15 12L9 18'],
  menu: ['M4.5 7.5H19.5', 'M4.5 12H19.5', 'M4.5 16.5H19.5'],

  // ---- Network -------------------------------------------------------------------------------------------
  node: [H, 'M8.6 9.8H15.4', 'M8.6 13.2H15.4', { dot: [12, 17.2, 1] }],
  'node-off': [H, 'M8.6 9.8H12', 'M8.6 13.2H11', 'M5 19L19 5'],
  instance: [H, h(4.2), { fill: h(4.2), o: 0.35 }],
  region: [...dashedHex(9.5), { dot: [12, 12, 1.7] }],
  packet: [h(4.6, 16, 12), { fill: h(4.6, 16, 12), o: 0.22 }, 'M3.5 9H8.3', 'M3.5 12H8.3', 'M3.5 15H8.3'],
  route: [h(2.4, 5.6, 17.6), 'M8 17.6H13V6.4H18', head(19.6, 6.4, 0, 3.2, 40)],
  globe: [H, 'M3.77 12H20.23', 'M12 2.5C7.4 6.5 7.4 17.5 12 21.5', 'M12 2.5C16.6 6.5 16.6 17.5 12 21.5'],
  'map-pin': ['M12 21.5L5.5 13V8.2L9.2 3.5H14.8L18.5 8.2V13Z', { dot: [12, 9.4, 2.1] }],

  // ---- Containers -------------------------------------------------------------------------------------------
  container: [cbox(3.5, 6.5, 17, 11, { tr: 2.5, bl: 2.5 }), 'M8 6.5V17.5', 'M12 6.5V17.5', 'M16 6.5V17.5'],
  image: [
    'M12 2.5L20.23 7.25V16.75L12 21.5L3.77 16.75V7.25Z',
    'M4.47 7.65L12 12L19.53 7.65',
    'M4.47 12.4L12 16.75L19.53 12.4',
  ],
  layers: ['M12 3L21 8L12 13L3 8Z', 'M3 12L12 17L21 12', 'M3 16L12 21L21 16'],
  registry: [
    cbox(4, 4.5, 16, 4.6),
    cbox(4, 10.2, 16, 4.6),
    cbox(4, 15.9, 16, 4.6),
    { dot: [7.2, 6.8, 0.9] },
    { dot: [7.2, 12.5, 0.9] },
    { dot: [7.2, 18.2, 0.9] },
  ],
  port: ['M4.5 7H19.5V17H15L14 19H10L9 17H4.5Z', 'M8.5 7V10.5', 'M12 7V10.5', 'M15.5 7V10.5'],
  volume: [
    // An octagonal lid, so the miter at its ends does not poke past the walls.
    pl(
      [
        [5, 6.7],
        [8, 5.1],
        [16, 5.1],
        [19, 6.7],
        [19, 8.3],
        [16, 9.9],
        [8, 9.9],
        [5, 8.3],
      ],
      true,
    ),
    'M5 8.3V17.3L8 18.9H16L19 17.3V8.3',
    'M5.4 13L8 14.4H16L18.6 13',
  ],
  env: [
    'M9.5 4.5H7.5V10L5 12L7.5 14V19.5H9.5',
    'M14.5 4.5H16.5V10L19 12L16.5 14V19.5H14.5',
    { dot: [12, 12, 1.2] },
  ],
  'docker-command': [H, 'M8.6 9.3L12 12.2L8.6 15.1', 'M13.4 15H16.4'],
  dockerfile: ['M6 3.5H14.5L18.5 7.5V20.5H6Z', 'M14.5 3.5V7.5H18.5', 'M9 12L11.4 14L9 16', 'M13 16.5H15.5'],

  // ---- Money ---------------------------------------------------------------------------------------------------
  price: ['M4 12.5L12.5 4H20V11.5L11.5 20Z', { dot: [16, 8, 1.3] }],
  flux: [H, 'M6.8 12C8.3 8.2 10 8.2 12 12S15.7 15.8 17.2 12'],
  wallet: [
    'M5.5 8L7 4.5H18V8',
    cbox(4, 8, 16, 12.5, { bl: 3 }),
    'M14.5 12.5H20V16H14.5Z',
    { dot: [17.2, 14.25, 0.9] },
  ],

  // ---- Time ----------------------------------------------------------------------------------------------------
  clock: [circle(12, 12, 9.5), 'M12 6.8V12L15.4 14'],
  block: ['M12 3L20 7.5V16.5L12 21L4 16.5V7.5Z', 'M4.7 7.9L12 12L19.3 7.9', 'M12 12V20.3'],
  hourglass: [
    'M6.5 3.5H17.5',
    'M6.5 20.5H17.5',
    'M7.7 3.5V6.5L12 12L7.7 17.5V20.5',
    'M16.3 3.5V6.5L12 12L16.3 17.5V20.5',
    { fill: 'M9.7 19H14.3L12 15.4Z', o: 0.5 },
  ],
  timer: [h(7.6, 12, 13.8), 'M10 3.5H14', 'M12 3.5V6.2', 'M12 13.8V9.8', 'M17.8 6.8L19.3 5.3'],

  // ---- Interface -----------------------------------------------------------------------------------------------
  info: [H, 'M12 11V16.2', { dot: [12, 8, 1.1] }],
  warning: ['M12 3.5L21 19.5H3Z', 'M12 10V14.2', { dot: [12, 16.8, 1] }],
  help: [H, 'M9.6 9.6A2.4 2.4 0 1 1 12 12.2V13.4', { dot: [12, 16.4, 1.1] }],
  question: ['M8.5 9V7.5L10.5 5.5H13.5L15.5 7.5V9.5L12 12.5V14.5', { dot: [12, 18.4, 1.2] }],
  home: ['M3.5 11L12 6.1L20.5 11', 'M5.5 9.9V20.5H18.5V9.9', 'M10 20.5V15H14V20.5'],
  user: [h(3.6, 12, 8.4), 'M5 20.5V17.5L8.5 14.5H15.5L19 17.5V20.5Z'],
  bell: ['M6.5 16.5V10.2L8.8 5.2H15.2L17.5 10.2V16.5', 'M4.5 16.5H19.5', 'M10.2 19.5H13.8', 'M12 3.5V5.2'],
  calendar: [
    cbox(4, 5.5, 16, 15, { tr: 3, bl: 3 }),
    'M8.5 3.5V7.5',
    'M15.5 3.5V7.5',
    'M4 10H20',
    { dot: [8, 13.4, 0.85] },
    { dot: [12, 13.4, 0.85] },
    { dot: [16, 13.4, 0.85] },
    { dot: [8, 17, 0.85] },
    { dot: [12, 17, 0.85] },
  ],
  book: [cbox(6, 3.5, 12.5, 17, { tr: 2.5, bl: 2.5 }), 'M9.5 3.5V20.5', 'M12.5 8.5H15.5'],
  code: ['M8.5 7L3.5 12L8.5 17', 'M15.5 7L20.5 12L15.5 17', 'M13.8 5.5L10.2 18.5'],
  file: ['M6 3.5H14.5L18.5 7.5V20.5H6Z', 'M14.5 3.5V7.5H18.5', 'M9.5 12H15', 'M9.5 15.5H15'],
  folder: ['M3.5 6.5H9.5L11.5 9H20.5V19.5H3.5Z'],
  key: [h(4.2, 7.2, 12), 'M10.84 12H20.5', 'M17 12V15.5', 'M20.5 12V14.5', { dot: [7.2, 12, 1.1] }],
  shield: ['M4 4.5H20V15.5L12 21L4 15.5Z', 'M8.6 11L11 13.4L15.4 8.6'],
  keyboard: [
    'M3 6.5H21V17.5H3Z',
    'M6.5 10.2H7.5',
    'M10.5 10.2H11.5',
    'M14.5 10.2H15.5',
    'M17.5 10.2H18',
    'M8 14H16',
  ],
  command: [
    'M9 9V6.5A2.5 2.5 0 1 0 6.5 9H17.5A2.5 2.5 0 1 0 15 6.5V17.5A2.5 2.5 0 1 0 17.5 15H6.5A2.5 2.5 0 1 0 9 17.5Z',
  ],
  terminal: ['M5 8L10 12L5 16', 'M12.5 17H19'],
  'sound-on': [
    'M4 9.5H8L13 5.5V18.5L8 14.5H4Z',
    'M16.2 9.2C17.4 10.5 17.4 13.5 16.2 14.8',
    'M18.8 6.6C21.4 9.4 21.4 14.6 18.8 17.4',
  ],
  'sound-off': ['M4 9.5H8L13 5.5V18.5L8 14.5H4Z', 'M16.5 9.5L21 14.5', 'M21 9.5L16.5 14.5'],
  motion: ['M3 12C5 5.5 7 5.5 9 12S13 18.5 15 12S19 5.5 21 12'],
  'motion-off': ['M3 12H21'],
  ambient: [H, h(5.8), h(2.2)],
  spark: ['M12 3L14.2 9.8L21 12L14.2 14.2L12 21L9.8 14.2L3 12L9.8 9.8Z'],
  sparkle: [star(10.5, 13.5, 7.5), { fill: star(10.5, 13.5, 7.5), o: 0.22 }, star(18.2, 6, 3)],
  list: [
    'M9.5 7H20',
    'M9.5 12H20',
    'M9.5 17H20',
    { dot: [5.2, 7, 1.2] },
    { dot: [5.2, 12, 1.2] },
    { dot: [5.2, 17, 1.2] },
  ],
  grid: [
    cbox(4, 4, 6.5, 6.5, { tr: 2 }),
    cbox(13.5, 4, 6.5, 6.5, { tr: 2 }),
    cbox(4, 13.5, 6.5, 6.5, { tr: 2 }),
    cbox(13.5, 13.5, 6.5, 6.5, { tr: 2 }),
  ],
  hash: ['M9.5 4L7.5 20', 'M16.5 4L14.5 20', 'M4.5 9H19.5', 'M4.5 15H19.5'],
  lightbulb: ['M12 3L17.5 6V11.2L14.7 14V16.2H9.3V14L6.5 11.2V6Z', 'M9.5 18.7H14.5', 'M10.5 21H13.5'],
  target: [h(9), h(4.4), { dot: [12, 12, 1.2] }, 'M12 3V6.2', 'M12 17.8V21', 'M3.2 12H6.6', 'M17.4 12H20.8'],
  puzzle: [
    pl(
      [
        [3.5, 8],
        [9.5, 8],
        [9.5, 6],
        [11, 4.5],
        [13.5, 4.5],
        [15, 6],
        [15, 8],
        [17.5, 8],
        [17.5, 10],
        [19, 10],
        [20.5, 11.5],
        [20.5, 13.5],
        [19, 15],
        [17.5, 15],
        [17.5, 20.5],
        [3.5, 20.5],
        [3.5, 16],
        [5.5, 16],
        [7, 14.5],
        [7, 12.5],
        [5.5, 11],
        [3.5, 11],
      ],
      true,
    ),
  ],
  gauge: ['M4.5 16.5V7.5L12 3L19.5 7.5V16.5', 'M12 14L15.6 9.2', { dot: [12, 14, 1.6] }, 'M7 20.5H17'],

  // ---- Achievement marks ---------------------------------------------------------------------------------
  // Bolder marks for the centre of a hex medal; they hold at 32 px and above.
  'ach-first-light': [star(12, 10.5, 7.5), { fill: star(12, 10.5, 7.5), o: 0.28 }, 'M4.5 20H19.5'],
  'ach-three-is-company': [
    pl(
      [
        [12, 6],
        [6, 17],
        [18, 17],
      ],
      true,
    ),
    { dot: [12, 6, 2.4] },
    { dot: [6, 17, 2.4] },
    { dot: [18, 17, 2.4] },
  ],
  'ach-first-blood': [
    pl([hv(0, 8.5), hv(1, 8.5), hv(2, 8.5), hv(3, 8.5), hv(4, 8.5), hv(5, 8.5)], true),
    'M12 3.5L9.8 8.8L14 11.6L10.6 15.6L12.6 20.5',
    { dot: [16.6, 14.6, 1.2] },
  ],
  'ach-spec-whisperer': [
    cbox(5.5, 3.5, 13, 17, { tr: 3.5, bl: 3.5 }),
    { fill: cbox(5.5, 3.5, 13, 17, { tr: 3.5, bl: 3.5 }), o: 0.2 },
    'M9 12.5L11.5 15L15.6 9.6',
  ],
  'ach-penny-pincher': [H, { fill: H, o: 0.2 }, 'M12 7.6V16.2', 'M8.4 12.8L12 16.4L15.6 12.8'],
  // A block (a cube) held inside viewfinder corners.
  'ach-block-watcher': [
    'M3.5 8V3.5H8',
    'M16 3.5H20.5V8',
    'M3.5 16V20.5H8',
    'M16 20.5H20.5V16',
    h(5.6),
    'M12 12V17',
    'M12 12L7.15 9.2',
    'M12 12L16.85 9.2',
    { fill: 'M12 6.4L16.85 9.2L12 12L7.15 9.2Z', o: 0.4 },
  ],
  // A globe with a pin planted on its shoulder: places visited.
  'ach-globetrotter': [
    h(6.6, 10, 14.4),
    { fill: h(6.6, 10, 14.4), o: 0.2 },
    'M4.3 14.4H15.7',
    'M10 7.8C7.6 10.6 7.6 18.4 10 21',
    'M10 7.8C12.4 10.6 12.4 18.4 10 21',
    pl(
      [
        [17.6, 11.2],
        [14.87, 7.63],
        [14.87, 5.61],
        [16.42, 3.64],
        [18.78, 3.64],
        [20.33, 5.61],
        [20.33, 7.63],
      ],
      true,
    ),
    { dot: [17.6, 6.2, 1] },
  ],
  'ach-shell-shocked': [
    cbox(3.5, 4.5, 17, 15, { tr: 3.5, bl: 3.5 }),
    pl(
      [
        [13.4, 7],
        [8.4, 12.9],
        [11.8, 12.9],
        [10.4, 17],
        [15.6, 11],
        [12.2, 11],
      ],
      true,
    ),
    {
      fill: pl(
        [
          [13.4, 7],
          [8.4, 12.9],
          [11.8, 12.9],
          [10.4, 17],
          [15.6, 11],
          [12.2, 11],
        ],
        true,
      ),
      o: 0.4,
    },
  ],
  'ach-explorer': [
    h(8.5),
    pl(
      [
        [16.5, 7.5],
        [13.56, 13.56],
        [7.5, 16.5],
        [10.44, 10.44],
      ],
      true,
    ),
    {
      fill: pl(
        [
          [16.5, 7.5],
          [13.56, 13.56],
          [7.5, 16.5],
          [10.44, 10.44],
        ],
        true,
      ),
      o: 0.4,
    },
  ],
  // The track's pillar, with a star: the same objects as the track emblems, earned.
  'ach-cumulus-operator': [...pillar(4.5, 4, 8, 20.5), star(17.8, 6.8, 3.4)],
  'ach-nimbus-engineer': [...pillar(8.6, 4, 8, 20.5), star(17.8, 6.8, 3.4)],
  'ach-stratus-architect': [...pillar(12.7, 4, 8, 20.5), star(17.8, 6.8, 3.4)],
} as const satisfies Record<string, readonly GlyphShape[]>;

export type GlyphName = keyof typeof GLYPHS;

export const GLYPH_NAMES = Object.keys(GLYPHS) as GlyphName[];

export function isGlyphName(name: string): name is GlyphName {
  return Object.hasOwn(GLYPHS, name);
}

// ---- Groups: every glyph in exactly one, for the sheet and for pickers ---------------------

export interface GlyphGroup {
  id: string;
  title: string;
  names: GlyphName[];
}

export const GLYPH_GROUPS: GlyphGroup[] = [
  {
    id: 'tracks',
    title: 'Tracks and tiers',
    names: ['tier-cumulus', 'tier-nimbus', 'tier-stratus', 'track-cumulus', 'track-nimbus', 'track-stratus'],
  },
  { id: 'kinds', title: 'Lesson kinds', names: ['kind-concept', 'kind-hands-on', 'kind-project'] },
  {
    id: 'labs',
    title: 'Labs',
    names: ['lab-forge', 'lab-network', 'lab-failover', 'lab-terminal', 'lab-explorer', 'lab-agent-desk'],
  },
  {
    id: 'status',
    title: 'Status',
    names: ['status-ok', 'status-warn', 'status-crit', 'status-off', 'status-pending', 'status-live'],
  },
  {
    id: 'actions',
    title: 'Actions',
    names: [
      'play',
      'pause',
      'stop',
      'restart',
      'refresh',
      'reset',
      'undo',
      'redo',
      'copy',
      'download',
      'upload',
      'share',
      'external',
      'link',
      'lock',
      'unlock',
      'check',
      'cross',
      'close',
      'plus',
      'minus',
      'trash',
      'edit',
      'save',
      'search',
      'filter',
      'sort',
      'expand',
      'settings',
      'sliders',
      'eye',
      'eye-off',
      'bookmark',
      'flag',
    ],
  },
  {
    id: 'arrows',
    title: 'Arrows',
    names: [
      'arrow-up-right',
      'arrow-right',
      'arrow-left',
      'arrow-up',
      'arrow-down',
      'chevron-up',
      'chevron-down',
      'chevron-left',
      'chevron-right',
      'menu',
    ],
  },
  {
    id: 'network',
    title: 'Network',
    names: ['node', 'node-off', 'instance', 'region', 'packet', 'route', 'globe', 'map-pin'],
  },
  {
    id: 'containers',
    title: 'Containers',
    names: [
      'container',
      'image',
      'layers',
      'registry',
      'port',
      'volume',
      'env',
      'docker-command',
      'dockerfile',
    ],
  },
  { id: 'money', title: 'Money', names: ['price', 'flux', 'wallet'] },
  { id: 'time', title: 'Time', names: ['clock', 'block', 'hourglass', 'timer'] },
  {
    id: 'interface',
    title: 'Interface',
    names: [
      'info',
      'warning',
      'help',
      'question',
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
      'keyboard',
      'command',
      'terminal',
      'sound-on',
      'sound-off',
      'motion',
      'motion-off',
      'ambient',
      'spark',
      'sparkle',
      'list',
      'grid',
      'hash',
      'lightbulb',
      'target',
      'puzzle',
      'gauge',
    ],
  },
  {
    id: 'achievements',
    title: 'Achievement marks',
    names: [
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
    ],
  },
];
