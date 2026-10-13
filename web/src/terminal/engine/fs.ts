/**
 * The virtual file system: an in-memory tree seeded from `script.files`. Paths are absolute and
 * normalised; `~` is the home directory. Nothing here ever touches a real disk.
 */

export const DEFAULT_HOME = '/home/learner';
export const DEFAULT_CWD = '~/app';
/** The modification time given to seeded files (2026-10-12 09:41 UTC). */
export const SEED_MTIME = Date.UTC(2026, 9, 12, 9, 41, 0);

interface FsNode {
  kind: 'file' | 'dir';
  content: string;
  mtime: number;
}

export interface FsEntry {
  name: string;
  path: string;
  kind: 'file' | 'dir';
  size: number;
  mtime: number;
}

export type FsResult = { ok: true } | { ok: false; error: string };

/** Collapse `.`, `..` and repeated slashes. The result always starts with `/` and has no trailing slash. */
export function normalizePath(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return `/${out.join('/')}`;
}

export function dirname(abs: string): string {
  const i = abs.lastIndexOf('/');
  return i <= 0 ? '/' : abs.slice(0, i);
}

export function basename(abs: string): string {
  return abs.slice(abs.lastIndexOf('/') + 1);
}

/** `/home/learner/app` becomes `~/app`. */
export function displayPath(abs: string, home: string = DEFAULT_HOME): string {
  if (abs === home) return '~';
  if (abs.startsWith(`${home}/`)) return `~${abs.slice(home.length)}`;
  return abs;
}

const TEMPLATE_DIRS = ['/bin', '/etc', '/home', '/tmp', '/usr', '/var'];

export class VirtualFs {
  private nodes = new Map<string, FsNode>();
  readonly home: string;

  constructor(home: string = DEFAULT_HOME) {
    this.home = home;
    this.nodes.set('/', { kind: 'dir', content: '', mtime: SEED_MTIME });
    for (const d of TEMPLATE_DIRS) this.nodes.set(d, { kind: 'dir', content: '', mtime: SEED_MTIME });
    this.mkdirp(home);
    this.nodes.set('/etc/hostname', { kind: 'file', content: 'sandbox\n', mtime: SEED_MTIME });
  }

  /** Build the file system a script describes. Keys may be relative to `cwd`, absolute or `~/...`. */
  static fromScript(
    files: Record<string, string> | undefined,
    cwd: string,
    home: string = DEFAULT_HOME,
  ): VirtualFs {
    const fs = new VirtualFs(home);
    fs.mkdirp(cwd);
    for (const [name, content] of Object.entries(files ?? {})) {
      const abs = fs.resolve(cwd, name);
      fs.mkdirp(dirname(abs));
      fs.nodes.set(abs, { kind: 'file', content, mtime: SEED_MTIME });
    }
    return fs;
  }

  clone(): VirtualFs {
    const copy = new VirtualFs(this.home);
    copy.nodes = new Map(Array.from(this.nodes, ([k, v]) => [k, { ...v }]));
    return copy;
  }

  /** Absolute, normalised path for `path` typed in `cwd`. */
  resolve(cwd: string, path: string): string {
    let p = path;
    if (p === '~') p = this.home;
    else if (p.startsWith('~/')) p = `${this.home}${p.slice(1)}`;
    return normalizePath(p.startsWith('/') ? p : `${cwd}/${p}`);
  }

  exists(abs: string): boolean {
    return this.nodes.has(abs);
  }

  isDir(abs: string): boolean {
    return this.nodes.get(abs)?.kind === 'dir';
  }

  isFile(abs: string): boolean {
    return this.nodes.get(abs)?.kind === 'file';
  }

  read(abs: string): string | null {
    const n = this.nodes.get(abs);
    return n && n.kind === 'file' ? n.content : null;
  }

  stat(abs: string): FsEntry | null {
    const n = this.nodes.get(abs);
    if (!n) return null;
    return { name: basename(abs) || '/', path: abs, kind: n.kind, size: n.content.length, mtime: n.mtime };
  }

  /** Entries of a directory, directories first then files, each group sorted case-insensitively. */
  list(abs: string): FsEntry[] {
    if (!this.isDir(abs)) return [];
    const prefix = abs === '/' ? '/' : `${abs}/`;
    const out: FsEntry[] = [];
    for (const [path, node] of this.nodes) {
      if (path === abs || !path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (rest.includes('/')) continue;
      out.push({ name: rest, path, kind: node.kind, size: node.content.length, mtime: node.mtime });
    }
    return out.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      const x = a.name.toLowerCase();
      const y = b.name.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  /** All absolute paths, for completion. */
  paths(): string[] {
    return Array.from(this.nodes.keys());
  }

  mkdirp(abs: string): void {
    let acc = '';
    for (const part of abs.split('/').filter(Boolean)) {
      acc += `/${part}`;
      if (!this.nodes.has(acc)) this.nodes.set(acc, { kind: 'dir', content: '', mtime: SEED_MTIME });
    }
  }

  mkdir(abs: string, now: number, parents = false): FsResult {
    if (this.nodes.has(abs)) return parents ? { ok: true } : { ok: false, error: 'File exists' };
    const parent = dirname(abs);
    if (!this.isDir(parent)) {
      if (!parents) return { ok: false, error: 'No such file or directory' };
      this.mkdirp(parent);
    }
    this.nodes.set(abs, { kind: 'dir', content: '', mtime: now });
    return { ok: true };
  }

  write(abs: string, content: string, now: number, append = false): FsResult {
    const parent = dirname(abs);
    if (!this.isDir(parent)) return { ok: false, error: 'No such file or directory' };
    const existing = this.nodes.get(abs);
    if (existing?.kind === 'dir') return { ok: false, error: 'Is a directory' };
    const next = append && existing ? existing.content + content : content;
    this.nodes.set(abs, { kind: 'file', content: next, mtime: now });
    return { ok: true };
  }

  /** Create or replace a file, creating parent directories (used by scripted `writes`). */
  put(abs: string, content: string, now: number): void {
    this.mkdirp(dirname(abs));
    this.nodes.set(abs, { kind: 'file', content, mtime: now });
  }

  remove(abs: string, recursive = false): FsResult {
    const n = this.nodes.get(abs);
    if (!n) return { ok: false, error: 'No such file or directory' };
    if (abs === '/' || abs === this.home) return { ok: false, error: 'Permission denied' };
    if (n.kind === 'dir') {
      const kids = this.list(abs);
      if (kids.length > 0 && !recursive) return { ok: false, error: 'Directory not empty' };
      if (!recursive) return { ok: false, error: 'Is a directory' };
      const prefix = `${abs}/`;
      for (const p of Array.from(this.nodes.keys())) if (p.startsWith(prefix)) this.nodes.delete(p);
    }
    this.nodes.delete(abs);
    return { ok: true };
  }

  /** Expand a glob (`*`, `?`) against one directory level. Returns matches in directory order. */
  glob(cwd: string, pattern: string): string[] {
    const slash = pattern.lastIndexOf('/');
    const dirPart = slash >= 0 ? pattern.slice(0, slash + 1) : '';
    const filePart = slash >= 0 ? pattern.slice(slash + 1) : pattern;
    if (/[*?[]/.test(dirPart)) return [];
    const dirAbs = this.resolve(cwd, dirPart || '.');
    let re: RegExp;
    try {
      re = new RegExp(
        `^${filePart
          .replace(/[.+^${}()|\\]/g, '\\$&')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '[^/]')}$`,
      );
    } catch {
      return [];
    }
    const showHidden = filePart.startsWith('.');
    return this.list(dirAbs)
      .filter((e) => re.test(e.name) && (showHidden || !e.name.startsWith('.')))
      .map((e) => `${dirPart}${e.name}`);
  }
}
