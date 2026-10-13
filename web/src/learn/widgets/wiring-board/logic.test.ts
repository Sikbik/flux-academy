import { describe, expect, it } from 'vitest';
import {
  addLink,
  type BoardComponent,
  DEFAULT_APP,
  diffGoal,
  envLines,
  hasLink,
  hostName,
  isSolved,
  kindOf,
  laneReserve,
  networkName,
  publicPortFor,
  type Rect,
  readConfig,
  removeLink,
  routeLinks,
  solution,
  toggleExposed,
  warnings,
} from './logic';

const STORE: BoardComponent[] = [
  { id: 'web', label: 'web', kind: 'web' },
  { id: 'api', label: 'api', kind: 'api' },
  { id: 'cache', label: 'cache', kind: 'cache' },
];

describe('readConfig', () => {
  it('reads the shape the lessons use', () => {
    const cfg = readConfig({
      components: ['web', 'api', 'cache'],
      goal: {
        links: [
          ['web', 'api'],
          ['api', 'cache'],
        ],
        public: ['web'],
      },
    });
    expect(cfg.app).toBe(DEFAULT_APP);
    expect(cfg.components.map((c) => [c.id, c.kind])).toEqual([
      ['web', 'web'],
      ['api', 'api'],
      ['cache', 'cache'],
    ]);
    expect(cfg.goal).toEqual({
      links: [
        { from: 'web', to: 'api' },
        { from: 'api', to: 'cache' },
      ],
      expose: ['web'],
    });
  });

  it('reads objects for components and an array goal with a top level expose', () => {
    const cfg = readConfig({
      app: 'shop',
      components: [
        { id: 'front', label: 'Storefront', kind: 'web' },
        { id: 'orders', kind: 'api' },
        { name: 'pg', kind: 'db' },
      ],
      goal: [
        { from: 'front', to: 'orders' },
        { from: 'orders', to: 'pg' },
      ],
      expose: ['front'],
    });
    expect(cfg.app).toBe('shop');
    expect(cfg.components[0]).toEqual({ id: 'front', label: 'Storefront', kind: 'web' });
    expect(cfg.components[2]).toEqual({ id: 'pg', label: 'pg', kind: 'db' });
    expect(cfg.goal?.links).toHaveLength(2);
    expect(cfg.goal?.expose).toEqual(['front']);
  });

  it('falls back to the three tier example', () => {
    const cfg = readConfig(undefined);
    expect(cfg.components.map((c) => c.id)).toEqual(['web', 'api', 'cache']);
    expect(cfg.goal).toBeNull();
    expect(readConfig({ components: ['only'] }).components).toHaveLength(3);
  });

  it('cleans names to what a component name may be, drops duplicates and caps the count', () => {
    const cfg = readConfig({
      components: ['we-b', 'we b', 'web', 'a$pi', 'c1', 'c2', 'c3', 'c4', 'c5'],
    });
    expect(cfg.components.map((c) => c.id)).toEqual(['web', 'api', 'c1', 'c2', 'c3', 'c4']);
  });

  it('ignores goal links to unknown or identical components and keeps an empty expose list', () => {
    const cfg = readConfig({
      components: ['web', 'api'],
      goal: {
        links: [
          ['web', 'nope'],
          ['web', 'web'],
          ['web', 'api'],
          ['web', 'api'],
        ],
        public: [],
      },
    });
    expect(cfg.goal?.links).toEqual([{ from: 'web', to: 'api' }]);
    expect(cfg.goal?.expose).toEqual([]);
  });

  it('leaves exposure open when the goal does not name it', () => {
    const cfg = readConfig({ components: ['web', 'api'], goal: { links: [['web', 'api']] } });
    expect(cfg.goal?.expose).toBeNull();
  });

  it('guesses a role from the name', () => {
    expect(kindOf('frontend')).toBe('web');
    expect(kindOf('postgres')).toBe('db');
    expect(kindOf('redis')).toBe('cache');
    expect(kindOf('worker')).toBe('api');
    expect(kindOf('db')).toBe('db');
  });
});

describe('names and variables', () => {
  it('builds the container and network names of FACTS 8.2', () => {
    expect(hostName('api', 'store')).toBe('fluxapi_store');
    expect(networkName('store')).toBe('fluxDockerNetwork_store');
  });

  it('gives a URL for a web or API callee and host plus port for a data store', () => {
    expect(envLines({ from: 'web', to: 'api' }, STORE, 'store')).toEqual([
      'API_URL=http://fluxapi_store:4000',
    ]);
    expect(envLines({ from: 'api', to: 'cache' }, STORE, 'store')).toEqual([
      'CACHE_HOST=fluxcache_store',
      'CACHE_PORT=6379',
    ]);
    expect(envLines({ from: 'api', to: 'ghost' }, STORE, 'store')).toEqual([]);
  });

  it('counts public ports up from 31001 in component order', () => {
    expect(publicPortFor('web', ['web', 'cache'], STORE)).toBe(31001);
    expect(publicPortFor('cache', ['cache', 'web'], STORE)).toBe(31002);
  });
});

describe('the wiring', () => {
  const goal = {
    links: [
      { from: 'web', to: 'api' },
      { from: 'api', to: 'cache' },
    ],
    expose: ['web'],
  };

  it('adds and removes without duplicates and refuses a self link', () => {
    let links = addLink([], 'web', 'api');
    links = addLink(links, 'web', 'api');
    links = addLink(links, 'api', 'api');
    expect(links).toEqual([{ from: 'web', to: 'api' }]);
    expect(hasLink(links, 'web', 'api')).toBe(true);
    expect(hasLink(links, 'api', 'web')).toBe(false);
    expect(removeLink(links, 'web', 'api')).toEqual([]);
    expect(toggleExposed(toggleExposed([], 'web'), 'web')).toEqual([]);
  });

  it('is solved only when the connection set equals the goal and so does the published set', () => {
    const state = { links: [...goal.links].reverse(), exposed: ['web'] };
    expect(isSolved(goal, state)).toBe(true);
    expect(isSolved(goal, { ...state, exposed: [] })).toBe(false);
    expect(isSolved(goal, { ...state, exposed: ['web', 'cache'] })).toBe(false);
    expect(isSolved(goal, { ...state, links: [{ from: 'web', to: 'api' }] })).toBe(false);
    expect(isSolved(goal, { ...state, links: [...goal.links, { from: 'web', to: 'cache' }] })).toBe(false);
    expect(isSolved(null, state)).toBe(false);
  });

  it('treats direction as part of the answer', () => {
    const backwards = {
      links: [
        { from: 'api', to: 'web' },
        { from: 'cache', to: 'api' },
      ],
      exposed: ['web'],
    };
    expect(isSolved(goal, backwards)).toBe(false);
    const diff = diffGoal(goal, backwards);
    expect(diff.reversed).toHaveLength(2);
    expect(diff.extra).toHaveLength(0);
    expect(diff.missing).toHaveLength(2);
  });

  it('ignores exposure when the goal does not name it', () => {
    const open = { links: goal.links, expose: null };
    expect(isSolved(open, { links: goal.links, exposed: ['cache'] })).toBe(true);
  });

  it('reports what is missing and what is too much', () => {
    const diff = diffGoal(goal, {
      links: [
        { from: 'web', to: 'api' },
        { from: 'web', to: 'cache' },
      ],
      exposed: ['api', 'cache'],
    });
    expect(diff.missing).toEqual([{ from: 'api', to: 'cache' }]);
    expect(diff.extra).toEqual([{ from: 'web', to: 'cache' }]);
    expect(diff.unpublished).toEqual(['web']);
    expect(diff.overpublished).toEqual(['api', 'cache']);
  });

  it('solves itself', () => {
    expect(isSolved(goal, solution(goal))).toBe(true);
    expect(solution(null)).toEqual({ links: [], exposed: [] });
  });

  it('flags a published database or cache and nothing else', () => {
    const comps: BoardComponent[] = [...STORE, { id: 'db', label: 'db', kind: 'db' }];
    const w = warnings(['web', 'api', 'cache', 'db'], comps, 'store');
    expect(w.map((x) => x.id)).toEqual(['cache', 'db']);
    expect(w[1]?.text).toContain('fluxdb_store');
    expect(warnings(['web', 'api'], comps, 'store')).toEqual([]);
  });
});

describe('routeLinks', () => {
  const row: Record<string, Rect> = {
    web: { x: 0, y: 40, w: 100, h: 80 },
    api: { x: 140, y: 40, w: 100, h: 80 },
    cache: { x: 280, y: 40, w: 100, h: 80 },
  };
  const order = ['web', 'api', 'cache'];

  it('joins neighbours in a row with a straight line between the facing edges', () => {
    const [r] = routeLinks(row, order, [{ from: 'web', to: 'api' }]);
    expect(r?.key).toBe('web>api');
    expect(r?.d.startsWith('M')).toBe(true);
    expect(r?.d).toContain('L');
    // y is the vertical middle of the cards
    expect(r?.mid.y).toBe(80);
    expect(r?.mid.x).toBeGreaterThan(100);
    expect(r?.mid.x).toBeLessThan(140);
  });

  it('goes over the top for a link that skips a card, above every card', () => {
    const [r] = routeLinks(row, order, [{ from: 'web', to: 'cache' }]);
    const ys = [...(r?.d.matchAll(/L?-?\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g) ?? [])].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeLessThan(40);
    expect(r?.mid.y).toBeLessThan(40);
  });

  it('offsets two opposite links between the same pair so they do not overlap', () => {
    const [a, b] = routeLinks(row, order, [
      { from: 'web', to: 'api' },
      { from: 'api', to: 'web' },
    ]);
    expect(a?.mid.y).not.toBe(b?.mid.y);
  });

  it('runs down the right side for a skipping link in a column', () => {
    const col: Record<string, Rect> = {
      web: { x: 0, y: 0, w: 200, h: 60 },
      api: { x: 0, y: 80, w: 200, h: 60 },
      cache: { x: 0, y: 160, w: 200, h: 60 },
    };
    const [r] = routeLinks(col, order, [{ from: 'web', to: 'cache' }]);
    expect(r?.mid.x).toBeGreaterThan(200);
    const [n] = routeLinks(col, order, [{ from: 'web', to: 'api' }]);
    expect(n?.mid.x).toBe(100);
    expect(n?.mid.y).toBeGreaterThan(60);
    expect(n?.mid.y).toBeLessThan(80);
  });

  it('draws nothing until two cards are measured', () => {
    expect(routeLinks({}, order, [{ from: 'web', to: 'api' }])).toEqual([]);
    expect(routeLinks({ web: row.web as Rect }, order, [{ from: 'web', to: 'api' }])).toEqual([]);
  });

  it('reserves a fixed amount of room for arcs, none for two components', () => {
    expect(laneReserve(2)).toBe(0);
    expect(laneReserve(3)).toBeGreaterThan(0);
    expect(laneReserve(6)).toBe(laneReserve(5));
  });
});
