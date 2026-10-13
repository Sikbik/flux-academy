/**
 * The lab's scenarios. Each is a `TerminalScript` (the lesson contract) with the optional engine
 * extensions `requires`, `also` and `passthrough` (see engine/types.ts), plus the metadata the lab
 * shows: a one-line objective for the challenge card and what the scenario teaches.
 */

import type { GlyphName } from '@/ui';
import type { ScriptWithRequires } from '../engine/types';
import { buildAndPush } from './build-and-push';
import { dnsCheck } from './dns-check';
import { dockerBasics } from './docker-basics';
import { fluxApi } from './flux-api';

export interface ScenarioMeta {
  /** Same as the script id. Stable: the lab keeps progress under it. */
  id: string;
  /** Tab label. */
  title: string;
  /** One line: what the learner is trying to do. */
  objective: string;
  /** Short list of what it teaches, for the Teach me drawer. */
  teaches: string[];
  /** Rough time for a first run. */
  minutes: number;
  /** Glyph name from the design system. */
  glyph: GlyphName;
  script: ScriptWithRequires;
}

export const SCENARIOS: readonly ScenarioMeta[] = [
  {
    id: 'docker-basics',
    title: 'Docker basics',
    objective: 'Run a container in the background, look at it, read its logs and stop it.',
    teaches: [
      'An image is the template and a container is one running copy of it.',
      '`-d` runs in the background, `--name` gives a handle and `-p 8080:80` publishes a port. A Flux spec has the same pair: `ports` and `containerPorts`.',
      'Logs are what the container prints; FluxCloud shows the same stream.',
    ],
    minutes: 4,
    glyph: 'container',
    script: dockerBasics,
  },
  {
    id: 'build-and-push',
    title: 'Build and push',
    objective: 'Get an image onto Docker Hub that Flux nodes can actually run.',
    teaches: [
      'A Dockerfile is the recipe; `docker build -t name:tag .` turns it into an image.',
      'Docker builds for the CPU it runs on. Flux nodes are almost all linux/amd64, so an arm64 laptop needs `--platform linux/amd64`.',
      'A tag is just a name; pin a version in your spec because a moving tag like `latest` can change under you.',
    ],
    minutes: 6,
    glyph: 'registry',
    script: buildAndPush,
  },
  {
    id: 'flux-api',
    title: 'Query the Flux API',
    objective: 'Read the network with curl and jq: blocks, nodes, an app spec, where it runs, a price.',
    teaches: [
      'The API is public and read-only; every answer is JSON with `status` and `data`.',
      'Errors come back as HTTP 200 with `status: "error"`, so read `status`, not the HTTP code.',
      '`jq` picks one value out of a response. The price calculator is a POST that only reads and needs `text/plain`.',
    ],
    minutes: 6,
    glyph: 'block',
    script: fluxApi,
  },
  {
    id: 'dns-check',
    title: 'DNS check',
    objective: 'Find out why shop.example.com does not reach your Flux app.',
    teaches: [
      'A custom domain works when it points at `<app>.app.runonflux.io` and is listed in the component `domains`.',
      "Your resolver caches the old answer for the TTL; your DNS provider's own server shows the record as it is now.",
      'A proxy in front of a domain hides the target, so FDM sees it as not pointed and requests no certificate.',
    ],
    minutes: 5,
    glyph: 'globe',
    script: dnsCheck,
  },
];

export function scenarioById(id: string): ScenarioMeta | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export { buildAndPush, dnsCheck, dockerBasics, fluxApi };
