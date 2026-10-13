import { describe, expect, it } from 'vitest';
import { basename, dirname, displayPath, normalizePath, VirtualFs } from './fs';

describe('path helpers', () => {
  it('normalises dots and slashes', () => {
    expect(normalizePath('/a/b/../c/./d//e')).toBe('/a/c/d/e');
    expect(normalizePath('/..')).toBe('/');
    expect(normalizePath('///')).toBe('/');
    expect(normalizePath('/a/b/c/../../..')).toBe('/');
  });

  it('dirname and basename', () => {
    expect(dirname('/a/b/c')).toBe('/a/b');
    expect(dirname('/a')).toBe('/');
    expect(basename('/a/b/c.txt')).toBe('c.txt');
  });

  it('displays home as a tilde', () => {
    expect(displayPath('/home/learner')).toBe('~');
    expect(displayPath('/home/learner/app')).toBe('~/app');
    expect(displayPath('/etc')).toBe('/etc');
    expect(displayPath('/home/learner2')).toBe('/home/learner2');
  });
});

describe('VirtualFs', () => {
  const fresh = () =>
    VirtualFs.fromScript(
      {
        Dockerfile: 'FROM x\n',
        'src/index.js': 'console.log(1)\n',
        '~/notes.txt': 'hello',
        '/srv/data/a.txt': 'a',
        '.hidden': 'h',
      },
      '/home/learner/app',
    );

  it('seeds files relative to the working directory, absolute and tilde paths', () => {
    const fs = fresh();
    expect(fs.read('/home/learner/app/Dockerfile')).toBe('FROM x\n');
    expect(fs.read('/home/learner/app/src/index.js')).toBe('console.log(1)\n');
    expect(fs.read('/home/learner/notes.txt')).toBe('hello');
    expect(fs.read('/srv/data/a.txt')).toBe('a');
    expect(fs.isDir('/home/learner/app/src')).toBe(true);
    expect(fs.isDir('/srv/data')).toBe(true);
  });

  it('has the standard top level directories and a hostname', () => {
    const fs = fresh();
    for (const d of ['/', '/bin', '/etc', '/home', '/tmp', '/usr', '/var']) expect(fs.isDir(d)).toBe(true);
    expect(fs.read('/etc/hostname')).toBe('sandbox\n');
  });

  it('resolves relative paths, home and parents', () => {
    const fs = fresh();
    const cwd = '/home/learner/app';
    expect(fs.resolve(cwd, 'src/index.js')).toBe('/home/learner/app/src/index.js');
    expect(fs.resolve(cwd, '../notes.txt')).toBe('/home/learner/notes.txt');
    expect(fs.resolve(cwd, '~')).toBe('/home/learner');
    expect(fs.resolve(cwd, '~/notes.txt')).toBe('/home/learner/notes.txt');
    expect(fs.resolve(cwd, '/etc')).toBe('/etc');
    expect(fs.resolve(cwd, '../../..')).toBe('/');
  });

  it('lists directories first, then files, case-insensitively', () => {
    const fs = VirtualFs.fromScript({ b: '', A: '', 'z/x': '', 'Y/x': '' }, '/home/learner/app');
    expect(fs.list('/home/learner/app').map((e) => e.name)).toEqual(['Y', 'z', 'A', 'b']);
  });

  it('writes, appends and refuses missing parents and directories', () => {
    const fs = fresh();
    expect(fs.write('/home/learner/app/new.txt', 'a', 1).ok).toBe(true);
    expect(fs.write('/home/learner/app/new.txt', 'b', 2, true).ok).toBe(true);
    expect(fs.read('/home/learner/app/new.txt')).toBe('ab');
    expect(fs.write('/nope/deep/file', 'x', 1)).toEqual({ ok: false, error: 'No such file or directory' });
    expect(fs.write('/home/learner/app/src', 'x', 1)).toEqual({ ok: false, error: 'Is a directory' });
  });

  it('mkdir with and without -p', () => {
    const fs = fresh();
    expect(fs.mkdir('/home/learner/app/a', 1).ok).toBe(true);
    expect(fs.mkdir('/home/learner/app/a', 1)).toEqual({ ok: false, error: 'File exists' });
    expect(fs.mkdir('/home/learner/app/a', 1, true).ok).toBe(true);
    expect(fs.mkdir('/home/learner/app/x/y', 1).ok).toBe(false);
    expect(fs.mkdir('/home/learner/app/x/y', 1, true).ok).toBe(true);
    expect(fs.isDir('/home/learner/app/x')).toBe(true);
  });

  it('removes files, refuses non-empty directories, and protects home and root', () => {
    const fs = fresh();
    expect(fs.remove('/home/learner/app/Dockerfile').ok).toBe(true);
    expect(fs.exists('/home/learner/app/Dockerfile')).toBe(false);
    expect(fs.remove('/home/learner/app/src')).toEqual({ ok: false, error: 'Directory not empty' });
    expect(fs.remove('/home/learner/app/src', true).ok).toBe(true);
    expect(fs.exists('/home/learner/app/src/index.js')).toBe(false);
    expect(fs.remove('/').ok).toBe(false);
    expect(fs.remove('/home/learner', true).ok).toBe(false);
    expect(fs.remove('/nothing')).toEqual({ ok: false, error: 'No such file or directory' });
  });

  it('clones independently', () => {
    const a = fresh();
    const b = a.clone();
    b.put('/home/learner/app/only-b', 'x', 1);
    b.remove('/home/learner/app/Dockerfile');
    expect(a.exists('/home/learner/app/only-b')).toBe(false);
    expect(a.exists('/home/learner/app/Dockerfile')).toBe(true);
  });

  it('globs one directory level, skipping hidden files unless asked', () => {
    const fs = VirtualFs.fromScript(
      { 'a.js': '', 'b.js': '', 'c.md': '', '.d.js': '', 'src/x.js': '' },
      '/home/learner/app',
    );
    const cwd = '/home/learner/app';
    expect(fs.glob(cwd, '*.js')).toEqual(['a.js', 'b.js']);
    expect(fs.glob(cwd, '?.md')).toEqual(['c.md']);
    expect(fs.glob(cwd, '.*.js')).toEqual(['.d.js']);
    expect(fs.glob(cwd, 'src/*')).toEqual(['src/x.js']);
    expect(fs.glob(cwd, '*.zip')).toEqual([]);
    expect(fs.glob(cwd, '[')).toEqual([]);
  });

  it('put creates parents', () => {
    const fs = fresh();
    fs.put('/var/lib/docker/images/you/app:1.0.0', 'x', 5);
    expect(fs.isDir('/var/lib/docker/images/you')).toBe(true);
    expect(fs.read('/var/lib/docker/images/you/app:1.0.0')).toBe('x');
  });
});
