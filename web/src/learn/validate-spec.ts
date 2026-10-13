/**
 * The shape of a v8 spec as the validator needs it: which JSON paths exist. Pure.
 *
 * The key lists mirror `LIMITS.appKeys` and `LIMITS.componentKeys` in shared/flux/spec.ts; a unit test
 * compares them so they cannot drift.
 */

import { parsePath } from './checks';

type Kind = 'app' | 'compose' | 'component' | 'string' | 'number' | 'boolean' | 'string[]' | 'number[]';

export const APP_SHAPE: Readonly<Record<string, Kind>> = {
  version: 'number',
  name: 'string',
  description: 'string',
  owner: 'string',
  compose: 'compose',
  instances: 'number',
  contacts: 'string[]',
  geolocation: 'string[]',
  expire: 'number',
  nodes: 'string[]',
  staticip: 'boolean',
  datacenter: 'boolean',
  enterprise: 'string',
};

export const COMPONENT_SHAPE: Readonly<Record<string, Kind>> = {
  name: 'string',
  description: 'string',
  repotag: 'string',
  ports: 'number[]',
  containerPorts: 'number[]',
  environmentParameters: 'string[]',
  commands: 'string[]',
  containerData: 'string',
  domains: 'string[]',
  repoauth: 'string',
  cpu: 'number',
  ram: 'number',
  hdd: 'number',
};

export interface PathVerdict {
  ok: boolean;
  /** Why not, in a sentence an author can act on. */
  reason?: string;
}

/**
 * Does `path` name something that exists on a spec? Indexes and `[*]` are accepted on arrays; `length` on
 * arrays and strings. A path with the wrong syntax or an unknown key is rejected with a reason.
 */
export function specPathVerdict(path: string): PathVerdict {
  const tokens = parsePath(path);
  if (!tokens) return { ok: false, reason: `"${path}" is not a valid path (use a.b[0].c).` };
  let kind: Kind = 'app';
  for (const t of tokens) {
    if (t.type === 'key') {
      if (kind === 'app') {
        const next = APP_SHAPE[t.key];
        if (!next) {
          return {
            ok: false,
            reason: `"${t.key}" is not a key of a v8 spec (${Object.keys(APP_SHAPE).join(', ')}).`,
          };
        }
        kind = next;
      } else if (kind === 'component') {
        const next = COMPONENT_SHAPE[t.key];
        if (!next) {
          return {
            ok: false,
            reason: `"${t.key}" is not a component key (${Object.keys(COMPONENT_SHAPE).join(', ')}).`,
          };
        }
        kind = next;
      } else if (
        t.key === 'length' &&
        (kind === 'compose' || kind === 'string' || kind === 'string[]' || kind === 'number[]')
      ) {
        kind = 'number';
      } else {
        return { ok: false, reason: `"${t.key}" cannot follow here in "${path}".` };
      }
    } else {
      // an index or `[*]`
      if (kind === 'compose') kind = 'component';
      else if (kind === 'string[]') kind = 'string';
      else if (kind === 'number[]') kind = 'number';
      else return { ok: false, reason: `An index cannot follow here in "${path}".` };
    }
  }
  return { ok: true };
}

/**
 * Paths where `a` and `b` differ, as leaf paths (primitive arrays are leaves). Used to check that a
 * solution only touches what the learner may edit.
 */
export function changedPaths(a: unknown, b: unknown, prefix = ''): string[] {
  if (Array.isArray(a) && Array.isArray(b) && (a.some(isObj) || b.some(isObj))) {
    const out: string[] = [];
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i += 1) out.push(...changedPaths(a[i], b[i], `${prefix}[${i}]`));
    return out;
  }
  if (isObj(a) && isObj(b) && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out: string[] = [];
    for (const k of keys) {
      out.push(...changedPaths(a[k], b[k], prefix ? `${prefix}.${k}` : k));
    }
    return out;
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [prefix];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** `compose[0].ports[1]` -> `compose`, `[0]`, `ports`, `[1]`. */
function pathTokens(path: string): string[] {
  return path.match(/[^.[\]]+|\[[^\]]*\]/g) ?? [];
}

/** One path token against one editable token: `[*]` matches any `[<index>]`, as in the Spec Forge. */
function tokenMatches(editable: string, changed: string): boolean {
  if (editable === changed) return true;
  return editable === '[*]' && /^\[\d+\]$/.test(changed);
}

/**
 * True when a changed path is within (or contains) an editable path. An editable path may use `[*]` for
 * "any index" (`compose[*].cpu`), the same wildcard the Spec Forge's `isPathEditable` understands.
 */
export function coveredByEditable(changed: string, editable: readonly string[]): boolean {
  if (changed === '') return editable.includes('');
  const c = pathTokens(changed);
  return editable.some((e) => {
    if (changed === e) return true;
    const t = pathTokens(e);
    if (t.length === 0) return false;
    // One path must be a prefix of the other, token by token.
    const n = Math.min(c.length, t.length);
    for (let i = 0; i < n; i += 1) {
      if (!tokenMatches(t[i] as string, c[i] as string)) return false;
    }
    return true;
  });
}
