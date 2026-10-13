/**
 * The checkpoint terminal for containers-101: the same shell, with a brief that names the image.
 *
 * Only `maya/todo-api:2.3.1` completes the goals, built for linux/amd64. Any other name still builds and
 * pushes, with a warning that says what the brief asked for, so the learner reads the output instead of
 * pattern matching on the goal tracker.
 */

import type { TerminalScript } from '@/learn/types';
import { dockerShip } from './containers-101-build.ts';

const todoApiServer = [
  "const http = require('http');",
  '',
  "const todos = ['write the spec', 'ship the image'];",
  '',
  'http',
  '  .createServer((req, res) => {',
  "    res.setHeader('Content-Type', 'application/json');",
  '    res.end(JSON.stringify(todos));',
  '  })',
  "  .listen(8000, '0.0.0.0');",
  '',
].join('\n');

const todoApiDockerfile = [
  'FROM node:22-alpine',
  'WORKDIR /app',
  'COPY server.js .',
  'CMD ["node", "server.js"]',
  '',
].join('\n');

const containers101Ship: TerminalScript = dockerShip({
  id: 'containers-101-ship',
  cwd: '~/todo-api',
  files: { 'server.js': todoApiServer, Dockerfile: todoApiDockerfile },
  intro: [
    '[dim] Simulation. Nothing here touches your machine or the network.',
    '[dim] You are in ~/todo-api on an Apple silicon MacBook, signed in to Docker Hub as maya.',
    '[dim] The brief: the spec will run maya/todo-api:2.3.1. Make that image exist on a registry.',
  ],
  want: 'maya/todo-api:2.3.1',
  port: 8000,
  reply: '["write the spec","ship the image"]',
  sample: 'maya/todo-api:2.3.1',
  goals: {
    build: 'Build maya/todo-api:2.3.1 so Flux nodes can run it',
    push: 'Push maya/todo-api:2.3.1 to the registry',
  },
});

export default containers101Ship;
