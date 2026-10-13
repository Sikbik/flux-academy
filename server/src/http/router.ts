import type { RouteDef } from '../core/context.ts';

export interface Matched {
  def: RouteDef;
  params: Record<string, string>;
}

export type Lookup =
  | { kind: 'match'; match: Matched }
  /** The path exists for other methods. */
  | { kind: 'method'; allow: string[] }
  | { kind: 'none' };

interface Pattern {
  def: RouteDef;
  segments: string[];
  literals: number;
}

const MAX_PARAM_LENGTH = 200;

export function normalisePath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}

/**
 * Method and path to route definition. Exact paths are a map lookup and win over parameterised ones;
 * parameterised patterns are tried most-specific first (more literal segments). Registering two routes
 * with the same method and shape is a programming error and throws at start-up.
 */
export class Router {
  readonly #exact = new Map<string, RouteDef>();
  readonly #patterns: Pattern[] = [];
  readonly #shapes = new Set<string>();

  add(def: RouteDef): void {
    const path = normalisePath(def.path);
    if (!path.startsWith('/')) throw new Error(`route path must start with "/": ${def.path}`);
    const shape = `${def.method} ${path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':')}`;
    if (this.#shapes.has(shape)) throw new Error(`duplicate route ${def.method} ${def.path}`);
    this.#shapes.add(shape);
    if (!path.includes(':')) {
      this.#exact.set(`${def.method} ${path}`, def);
      return;
    }
    const segments = path.split('/').slice(1);
    this.#patterns.push({
      def,
      segments,
      literals: segments.filter((s) => !s.startsWith(':')).length,
    });
    this.#patterns.sort((a, b) => b.literals - a.literals);
  }

  get size(): number {
    return this.#exact.size + this.#patterns.length;
  }

  lookup(method: string, rawPath: string): Lookup {
    const path = normalisePath(rawPath);
    const hit = this.#find(method, path);
    if (hit) return { kind: 'match', match: hit };
    // HEAD is answered by the GET handler.
    if (method === 'HEAD') {
      const get = this.#find('GET', path);
      if (get) return { kind: 'match', match: get };
    }
    const allow = new Set<string>();
    for (const m of ['GET', 'POST']) {
      if (m !== method && this.#find(m, path)) allow.add(m);
    }
    if (allow.size > 0) {
      if (allow.has('GET')) allow.add('HEAD');
      return { kind: 'method', allow: [...allow] };
    }
    return { kind: 'none' };
  }

  #find(method: string, path: string): Matched | null {
    const exact = this.#exact.get(`${method} ${path}`);
    if (exact) return { def: exact, params: {} };
    const parts = path.split('/').slice(1);
    for (const p of this.#patterns) {
      if (p.def.method !== method || p.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length && ok; i++) {
        const seg = p.segments[i] as string;
        const part = parts[i] as string;
        if (seg.startsWith(':')) {
          if (part === '' || part.length > MAX_PARAM_LENGTH) {
            ok = false;
            break;
          }
          try {
            params[seg.slice(1)] = decodeURIComponent(part);
          } catch {
            ok = false;
          }
        } else if (seg !== part) {
          ok = false;
        }
      }
      if (ok) return { def: p.def, params };
    }
    return null;
  }
}
