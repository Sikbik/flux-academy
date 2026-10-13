/**
 * The pure half of the wiring board: reading the lesson's props, what a connection produces (the internal
 * host name and the environment variable lines), whether the learner's wiring matches the goal, and the
 * routes the arrows take over the board. No React, no DOM.
 *
 * Facts (FACTS 8.2): every app has its own Docker network, and a component is reached by its container name
 * `flux<component>_<app>` on its container port. Nothing needs a public port for that, and a component that
 * is not published is unreachable from outside the app. Environment variables are `KEY=value` strings of
 * the component's `environmentParameters` (FACTS 8.3); the variable names are the app's own choice.
 */

export type ComponentKind = 'web' | 'api' | 'db' | 'cache';

export interface BoardComponent {
  /** Letters and digits only, as the spec requires for a component name. */
  id: string;
  label: string;
  kind: ComponentKind;
}

/** A connection: `from` calls `to`. */
export interface Link {
  from: string;
  to: string;
}

export interface Goal {
  links: Link[];
  /** The components that must have a public port. Null when the lesson does not constrain it. */
  expose: string[] | null;
}

export interface BoardConfig {
  app: string;
  components: BoardComponent[];
  goal: Goal | null;
}

export interface BoardState {
  links: Link[];
  exposed: string[];
}

export const DEFAULT_APP = 'store';
export const DEFAULT_COMPONENTS: readonly string[] = ['web', 'api', 'cache'];
export const MAX_COMPONENTS = 6;

/** The container port each kind listens on in the worked example (the lesson's store spec). */
const CONTAINER_PORT: Record<ComponentKind, number> = { web: 3000, api: 4000, db: 5432, cache: 6379 };

/** First public port shown for a published component; the next ones count up from it. */
export const FIRST_PUBLIC_PORT = 31001;

export const KIND_LABEL: Record<ComponentKind, string> = {
  web: 'Frontend',
  api: 'API',
  db: 'Database',
  cache: 'Cache',
};

// ---------------------------------------------------------------------------
// Reading props
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A component or app name, reduced to what the spec allows. */
function cleanId(raw: unknown, max: number): string {
  return typeof raw === 'string' ? raw.replace(/[^A-Za-z0-9]/g, '').slice(0, max) : '';
}

function isKind(v: unknown): v is ComponentKind {
  return v === 'web' || v === 'api' || v === 'db' || v === 'cache';
}

/** The role a component name most likely plays, for a lesson that gives names only. */
export function kindOf(id: string): ComponentKind {
  const n = id.toLowerCase();
  if (/(^|[^a-z])(db|database|sql|postgres|postgresql|mysql|mariadb|mongo|mongodb)([^a-z]|$)/.test(n)) {
    return 'db';
  }
  if (/(cache|redis|memcache|memcached|valkey)/.test(n)) return 'cache';
  if (/(^|[^a-z])(web|frontend|front|ui|site|www|client|storefront|nginx)([^a-z]|$)/.test(n)) return 'web';
  if (/(postgres|mysql|mongo|database)/.test(n)) return 'db';
  return 'api';
}

function readComponents(v: unknown): BoardComponent[] {
  const out: BoardComponent[] = [];
  const seen = new Set<string>();
  const items: unknown[] = Array.isArray(v) ? v : [];
  for (const item of items) {
    let id = '';
    let label = '';
    let kind: ComponentKind | null = null;
    if (typeof item === 'string') {
      id = cleanId(item, 20);
    } else if (isRecord(item)) {
      id = cleanId(item.id ?? item.name, 20);
      if (typeof item.label === 'string') label = item.label.trim().slice(0, 28);
      if (isKind(item.kind)) kind = item.kind;
    }
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: label || id, kind: kind ?? kindOf(id) });
    if (out.length >= MAX_COMPONENTS) break;
  }
  if (out.length >= 2) return out;
  return DEFAULT_COMPONENTS.map((id) => ({ id, label: id, kind: kindOf(id) }));
}

function readLinks(v: unknown, ids: ReadonlySet<string>): Link[] {
  const out: Link[] = [];
  const items: unknown[] = Array.isArray(v) ? v : [];
  for (const item of items) {
    let from: unknown;
    let to: unknown;
    if (Array.isArray(item)) {
      [from, to] = item;
    } else if (isRecord(item)) {
      from = item.from;
      to = item.to;
    }
    if (typeof from !== 'string' || typeof to !== 'string') continue;
    if (!ids.has(from) || !ids.has(to) || from === to) continue;
    if (out.some((l) => l.from === from && l.to === to)) continue;
    out.push({ from, to });
  }
  return out;
}

function readIdList(v: unknown, ids: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === 'string' && ids.has(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

/**
 * Props, as a lesson author writes them. Both shapes work:
 *
 *   { components: ['web', 'api', 'cache'], goal: { links: [['web','api'], ['api','cache']], public: ['web'] } }
 *   { components: [{ id: 'web', label: 'Frontend', kind: 'web' }], goal: [{ from: 'web', to: 'api' }],
 *     expose: ['web'], app: 'store' }
 */
export function readConfig(props: Record<string, unknown> | undefined): BoardConfig {
  const p = props ?? {};
  const components = readComponents(p.components);
  const ids = new Set(components.map((c) => c.id));
  const app = cleanId(p.app, 16) || DEFAULT_APP;

  const rawGoal = p.goal;
  let links: Link[] = [];
  let expose: string[] | null = null;
  let hasGoal = false;
  if (Array.isArray(rawGoal)) {
    links = readLinks(rawGoal, ids);
    hasGoal = true;
  } else if (isRecord(rawGoal)) {
    links = readLinks(rawGoal.links ?? rawGoal.connections, ids);
    expose = readIdList(rawGoal.public ?? rawGoal.expose ?? rawGoal.exposed, ids);
    hasGoal = true;
  }
  if (expose === null) expose = readIdList(p.expose ?? p.public, ids);
  const goal: Goal | null = hasGoal || expose !== null ? { links, expose } : null;
  return { app, components, goal };
}

// ---------------------------------------------------------------------------
// Names and variables
// ---------------------------------------------------------------------------

/** `fluxapi_store`: the name a component answers to on its app's network (FACTS 8.2). */
export function hostName(id: string, app: string): string {
  return `flux${id}_${app}`;
}

/** `fluxDockerNetwork_store`: the app's private network (FACTS 8.2). */
export function networkName(app: string): string {
  return `fluxDockerNetwork_${app}`;
}

export function containerPortOf(kind: ComponentKind): number {
  return CONTAINER_PORT[kind];
}

function envKey(id: string): string {
  return id.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * The environment variables a connection gives the caller, as the `KEY=value` strings that go in its
 * `environmentParameters`. A web or API callee is reached by URL, a database or cache by host and port.
 */
export function envLines(link: Link, components: readonly BoardComponent[], app: string): string[] {
  const callee = components.find((c) => c.id === link.to);
  if (!callee) return [];
  const host = hostName(callee.id, app);
  const port = containerPortOf(callee.kind);
  const key = envKey(callee.id);
  if (callee.kind === 'web' || callee.kind === 'api') return [`${key}_URL=http://${host}:${port}`];
  return [`${key}_HOST=${host}`, `${key}_PORT=${port}`];
}

/** The public port shown for the nth published component. */
export function publicPortFor(
  id: string,
  exposed: readonly string[],
  components: readonly BoardComponent[],
): number {
  const order = components.map((c) => c.id).filter((c) => exposed.includes(c));
  const i = order.indexOf(id);
  return FIRST_PUBLIC_PORT + Math.max(0, i);
}

// ---------------------------------------------------------------------------
// The wiring itself
// ---------------------------------------------------------------------------

export const linkKey = (l: Link): string => `${l.from}>${l.to}`;

export function hasLink(links: readonly Link[], from: string, to: string): boolean {
  return links.some((l) => l.from === from && l.to === to);
}

/** Add `from` calls `to`. A connection to itself or a repeated one changes nothing. */
export function addLink(links: readonly Link[], from: string, to: string): Link[] {
  if (from === to || hasLink(links, from, to)) return [...links];
  return [...links, { from, to }];
}

export function removeLink(links: readonly Link[], from: string, to: string): Link[] {
  return links.filter((l) => !(l.from === from && l.to === to));
}

export function toggleExposed(exposed: readonly string[], id: string): string[] {
  return exposed.includes(id) ? exposed.filter((e) => e !== id) : [...exposed, id];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function sameLinks(a: readonly Link[], b: readonly Link[]): boolean {
  return sameSet(a.map(linkKey), b.map(linkKey));
}

/** True when the connection set equals the goal, and the published set does where the goal names one. */
export function isSolved(goal: Goal | null, state: BoardState): boolean {
  if (!goal) return false;
  if (!sameLinks(goal.links, state.links)) return false;
  return goal.expose === null || sameSet(goal.expose, state.exposed);
}

export interface Diff {
  /** In the goal, not drawn. */
  missing: Link[];
  /** Drawn, not in the goal. */
  extra: Link[];
  /** Drawn the wrong way round: the goal has the opposite direction. */
  reversed: Link[];
  /** Should be published and is not. */
  unpublished: string[];
  /** Published and should not be. */
  overpublished: string[];
}

export function diffGoal(goal: Goal, state: BoardState): Diff {
  const missing = goal.links.filter((g) => !hasLink(state.links, g.from, g.to));
  const extraAll = state.links.filter((l) => !hasLink(goal.links, l.from, l.to));
  const reversed = extraAll.filter((l) => hasLink(goal.links, l.to, l.from));
  const extra = extraAll.filter((l) => !reversed.includes(l));
  const expose = goal.expose;
  return {
    missing,
    extra,
    reversed,
    unpublished: expose ? expose.filter((e) => !state.exposed.includes(e)) : [],
    overpublished: expose ? state.exposed.filter((e) => !expose.includes(e)) : [],
  };
}

/** With no goal ("Show me" in a free exploration): the components in a chain, only the first published. */
export function chainSolution(components: readonly BoardComponent[]): BoardState {
  const links: Link[] = [];
  for (let i = 0; i + 1 < components.length; i += 1) {
    const a = components[i];
    const b = components[i + 1];
    if (a && b) links.push({ from: a.id, to: b.id });
  }
  const first = components[0];
  return { links, exposed: first ? [first.id] : [] };
}

/** The wiring that satisfies the goal: what "Show me" sets. */
export function solution(goal: Goal | null): BoardState {
  if (!goal) return { links: [], exposed: [] };
  return { links: goal.links.map((l) => ({ ...l })), exposed: goal.expose ? [...goal.expose] : [] };
}

export interface Warning {
  id: string;
  text: string;
}

/**
 * What is wrong with a published data store. A database or a cache with a public port is open on the
 * node's public address, on every node that runs an instance (FACTS 8.1), and the other components do not
 * need it: they reach it by name on the private network (FACTS 8.2).
 */
export function warnings(
  exposed: readonly string[],
  components: readonly BoardComponent[],
  app: string,
): Warning[] {
  const out: Warning[] = [];
  for (const c of components) {
    if (!exposed.includes(c.id)) continue;
    if (c.kind !== 'db' && c.kind !== 'cache') continue;
    const host = hostName(c.id, app);
    const what = c.kind === 'db' ? 'database' : 'cache';
    out.push({
      id: c.id,
      text: `The ${what} ${host} has a public port. It is open to the internet on every node that runs an instance, and nothing needs that: the other components reach it by name on the private network. Remove the public port.`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Arrow routes
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Route {
  key: string;
  /** The line, as SVG path data. */
  d: string;
  /** The arrow head at the callee, as SVG path data. */
  head: string;
  /** A point on the line, for the hover and accessible label. */
  mid: { x: number; y: number };
}

/** Pixels reserved at the top (row layout) or the right (column layout) for the arcs of non-adjacent links. */
export const LANE_STEP = 12;
export const MAX_LANES = 4;

/** How much room the arcs need, for a number of components. Static, so adding a link never moves the board. */
export function laneReserve(count: number): number {
  const pairs = (count * (count - 1)) / 2 - (count - 1);
  const lanes = Math.max(0, Math.min(MAX_LANES, pairs));
  return lanes === 0 ? 0 : 16 + lanes * LANE_STEP;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

function headD(x: number, y: number, dx: number, dy: number, size = 6): string {
  // An open chevron pointing along (dx, dy), tip at (x, y): two strokes, so it draws on like the line.
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = x - ux * size;
  const by = y - uy * size;
  const px = -uy * (size * 0.6);
  const py = ux * (size * 0.6);
  return `M${r1(bx + px)} ${r1(by + py)}L${r1(x)} ${r1(y)}L${r1(bx - px)} ${r1(by - py)}`;
}

/**
 * The paths of the arrows, from the measured rectangles of the component cards (relative to the board).
 * Neighbours in the layout are joined straight; links that skip a component go round over the top (a row)
 * or down the right side (a column), one lane each, so no arrow crosses a card it is not joining.
 */
export function routeLinks(
  rects: Readonly<Record<string, Rect>>,
  order: readonly string[],
  links: readonly Link[],
  gap = 6,
): Route[] {
  const placed = order.filter((id) => rects[id]);
  if (placed.length < 2) return [];
  const rs = placed.map((id) => rects[id] as Rect);
  const minY = Math.min(...rs.map((r) => r.y));
  const maxY = Math.max(...rs.map((r) => r.y));
  const isRow = maxY - minY < Math.min(...rs.map((r) => r.h)) / 2;
  const top = minY;
  const right = Math.max(...rs.map((r) => r.x + r.w));

  const index = (id: string) => placed.indexOf(id);
  const routes: Route[] = [];

  // Spread several links that start or end on the same card across its edge.
  const outCount: Record<string, number> = {};
  const outSeen: Record<string, number> = {};
  for (const l of links) outCount[l.from] = (outCount[l.from] ?? 0) + 1;

  let lane = 0;
  for (const l of links) {
    const a = rects[l.from];
    const b = rects[l.to];
    if (!a || !b) continue;
    const ia = index(l.from);
    const ib = index(l.to);
    const adjacent = Math.abs(ia - ib) === 1;
    const reverse = links.some((o) => o.from === l.to && o.to === l.from);
    const side = reverse ? (ia < ib ? -1 : 1) * 6 : 0;
    const k = outSeen[l.from] ?? 0;
    outSeen[l.from] = k + 1;
    const spread = ((k - ((outCount[l.from] ?? 1) - 1) / 2) * 8) | 0;
    const key = linkKey(l);

    if (isRow && adjacent) {
      const forward = ia < ib;
      const y = a.y + a.h / 2 + side;
      const x1 = forward ? a.x + a.w : a.x;
      const x2 = forward ? b.x - gap : b.x + b.w + gap;
      const x1g = forward ? x1 + 2 : x1 - 2;
      routes.push({
        key,
        d: `M${r1(x1g)} ${r1(y)}L${r1(x2)} ${r1(y)}`,
        head: headD(x2 + (forward ? 1 : -1) * 0.5, y, forward ? 1 : -1, 0),
        mid: { x: (x1g + x2) / 2, y },
      });
    } else if (isRow) {
      const laneY = top - 10 - (lane % MAX_LANES) * LANE_STEP;
      lane += 1;
      const xa = a.x + a.w / 2 + spread;
      const xb = b.x + b.w / 2 + spread;
      const y1 = a.y - 1;
      const y2 = b.y - gap;
      routes.push({
        key,
        d: `M${r1(xa)} ${r1(y1)}L${r1(xa)} ${r1(laneY)}L${r1(xb)} ${r1(laneY)}L${r1(xb)} ${r1(y2)}`,
        head: headD(xb, y2 + 0.5, 0, 1),
        mid: { x: (xa + xb) / 2, y: laneY },
      });
    } else if (adjacent) {
      const down = ia < ib;
      const x = a.x + a.w / 2 + side;
      const y1 = down ? a.y + a.h + 2 : a.y - 2;
      const y2 = down ? b.y - gap : b.y + b.h + gap;
      routes.push({
        key,
        d: `M${r1(x)} ${r1(y1)}L${r1(x)} ${r1(y2)}`,
        head: headD(x, y2 + (down ? 0.5 : -0.5), 0, down ? 1 : -1),
        mid: { x, y: (y1 + y2) / 2 },
      });
    } else {
      const laneX = right + 10 + (lane % MAX_LANES) * LANE_STEP;
      lane += 1;
      const ya = a.y + a.h / 2 + spread;
      const yb = b.y + b.h / 2 + spread;
      const xa = a.x + a.w + 1;
      const xb = b.x + b.w + gap;
      routes.push({
        key,
        d: `M${r1(xa)} ${r1(ya)}L${r1(laneX)} ${r1(ya)}L${r1(laneX)} ${r1(yb)}L${r1(xb)} ${r1(yb)}`,
        head: headD(xb - 0.5, yb, -1, 0),
        mid: { x: laneX, y: (ya + yb) / 2 },
      });
    }
  }
  return routes;
}
