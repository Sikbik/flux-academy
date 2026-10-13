/** Helpers for engine tests. Not part of the public surface. */

import { createSession, type SessionOptions, type TerminalSession } from './session';
import type { ScriptWithRequires, TerminalScript } from './types';

/** 2026-10-12 09:41:07 UTC, so `date` and file times are the same in every run. */
export const FIXED_NOW = Date.UTC(2026, 9, 12, 9, 41, 7);

export function script(over: Partial<ScriptWithRequires> = {}): TerminalScript {
  return {
    id: 'test',
    cwd: '~/app',
    files: {
      Dockerfile: 'FROM node:22-alpine\nWORKDIR /app\nCOPY server.js .\nCMD ["node", "server.js"]\n',
      'server.js': "require('http').createServer((q, r) => r.end('hi')).listen(3000, '0.0.0.0');\n",
      'src/main.js': 'console.log(1);\n',
      '.env.example': 'PORT=3000\n',
    },
    intro: ['[dim]Simulation. Nothing here touches your machine or the network.'],
    commands: [
      {
        match: 'docker build -t (\\S+) \\.',
        output: ['[+] Building 1.0s (3/3) FINISHED', '[ok] naming to docker.io/{1}'],
        goal: 'build',
        explain: 'Built **{1}**.',
        example: 'docker build -t you/app:1.0.0 .',
        writes: { '/var/lib/docker/images/{1}': 'built' },
      },
      {
        match: 'docker push (\\S+)',
        requires: ['build', 'file:/var/lib/docker/images/{1}'],
        output: ['The push refers to repository [docker.io/{1}]', '[ok]pushed'],
        goal: 'push',
        example: 'docker push you/app:1.0.0',
      },
      {
        match: 'docker push (\\S+)',
        output: ['[err]An image does not exist locally with the tag: {1}'],
      },
    ],
    goals: [
      { id: 'build', label: 'Build the image' },
      { id: 'push', label: 'Push the image' },
    ],
    ...over,
  } as TerminalScript;
}

export function make(s: TerminalScript = script(), options: Partial<SessionOptions> = {}): TerminalSession {
  return createSession({ script: s, instant: true, now: () => FIXED_NOW, ...options });
}

/** Run a line and return its plain output lines and the new entry. */
export function run(
  session: TerminalSession,
  line: string,
): { text: string[]; explain: string | null; goals: string[] } {
  const before = session.getState().entries.at(-1)?.id;
  session.submit(line);
  const last = session.getState().entries.at(-1);
  if (!last || last.id === before) return { text: [], explain: null, goals: [] };
  return {
    text: last.lines.map((l) => l.text),
    explain: last.explain,
    goals: last.goals,
  };
}
