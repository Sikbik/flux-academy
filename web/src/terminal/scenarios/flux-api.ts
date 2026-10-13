/**
 * Scenario 3: Query the Flux API.
 *
 * The Flux API is public and read-only, so `curl` is the natural way to look at the network. The
 * sandbox never calls it: GET answers are trimmed copies of responses recorded on 2026-10-12
 * (src/terminal/fixtures/flux-api.ts, compared with docs/research/samples by a test). The one POST,
 * the price calculator, is read-only too; its answer is computed here with the Academy's copy of
 * the official formula (`quote` in @shared/flux) and says so.
 *
 * `jq` is the engine's real mini jq: a pipe from curl runs on the recorded body, and any filter the
 * learner writes works. The goal for it is a passthrough entry, so it is credited by whatever
 * filter the learner typed as long as it succeeded.
 */

import { BAKED_PRICING, defaultSpec, quote } from '@shared/flux';
import { GATEWAY_TIMEOUT_SEC, LOCATION_TTL_MIN } from '@shared/flux/timing';
import { minifiedJson } from '../engine/json';
import { escapeMarkup } from '../engine/markup';
import type { ScriptedCommand, ScriptWithRequires } from '../engine/types';
import {
  APP_NOT_FOUND,
  BLOCK_COUNT,
  EXPLORER_LOCATION,
  EXPLORER_SPEC,
  MISSING_NAME,
  NODE_COUNT,
  RECORDED_ON,
  SAMPLE_HEADERS,
} from '../fixtures/flux-api';
import { SIM_INTRO } from './helpers';

const HOST = 'https://api\\.runonflux\\.io';
const QUIET = '(?: -(?:s|S|sS))*';
const BASE = 'https://api.runonflux.io';

/** A raw one-line body, made safe for the markup parser. */
const body = (value: unknown): string => escapeMarkup(minifiedJson(value));

// The price answer, computed with the same formula the Spec Forge uses.
const SPEC = defaultSpec();
const SPEC_JSON = `${JSON.stringify(SPEC, null, 2)}\n`;
const PRICE = quote(SPEC, BAKED_PRICING.params, { fluxUsd: BAKED_PRICING.fluxUsd });
const PRICE_BODY = {
  status: 'success',
  data: {
    usd: PRICE.usdTotal ?? PRICE.usdPerMonth,
    flux: PRICE.fluxTotal ?? PRICE.fluxPerMonth,
    fluxDiscount: Math.round((1 - BAKED_PRICING.params.fluxmultiplier) * 100),
  },
};

interface Endpoint {
  /** Path with the leading slash. */
  path: string;
  body: unknown;
  /** Extra response headers (the gateway adds `x-flux-mode` on some paths). */
  headers?: string[];
  goal?: string;
  example?: string;
  explain: string;
  /** Sandbox remarks printed under the body. */
  notes?: string[];
}

function endpointEntries(e: Endpoint): ScriptedCommand[] {
  const url = `${HOST}${e.path.replace(/\./g, '\\.')}`;
  const plain: ScriptedCommand = {
    match: `^curl${QUIET} ${url}${QUIET}$`,
    output: [body(e.body), ...(e.notes ?? []).map((n) => `[note]${n}`)],
    stream: 140,
    explain: e.explain,
    ...(e.goal ? { goal: e.goal } : {}),
    ...(e.example ? { example: e.example } : {}),
  };
  const withHeaders: ScriptedCommand = {
    match: `^curl(?=.* -i(?: |$))(?: -(?:s|S|sS|i))* ${url}(?: -(?:s|S|sS|i))*$`,
    output: [
      ...SAMPLE_HEADERS,
      ...(e.headers ?? []),
      '',
      body(e.body),
      '[note]Headers are trimmed to the ones that matter. `fluxnode` names the gateway node that answered.',
    ],
    stream: 90,
    explain: `\`-i\` prints the response headers before the body. ${e.explain}`,
    ...(e.goal ? { goal: e.goal } : {}),
  };
  return [plain, withHeaders];
}

const ENDPOINTS: Endpoint[] = [
  {
    path: '/daemon/getblockcount',
    body: BLOCK_COUNT,
    goal: 'height',
    example: `curl ${BASE}/daemon/getblockcount`,
    explain:
      'The reply is JSON with two keys: `status` and `data`. Here `data` is the height of the Flux chain, the number of blocks produced so far. A new block arrives about every 30 seconds, and an app lives for a number of blocks.',
  },
  {
    path: '/daemon/getfluxnodecount',
    body: NODE_COUNT,
    goal: 'nodes',
    example: `curl ${BASE}/daemon/getfluxnodecount`,
    explain:
      '`data.total` is how many FluxNodes the network counts. The tiers are Cumulus, Nimbus and Stratus; the API still prints their older names `basic`, `super` and `bamf` next to them.',
  },
  {
    path: '/apps/appspecifications/explorer',
    body: EXPLORER_SPEC,
    goal: 'spec',
    example: `curl ${BASE}/apps/appspecifications/explorer`,
    explain:
      'This is the registered spec of the app named `explorer`: `compose` lists its components, `instances` is how many copies run and `expire` is its lifetime in blocks. It was registered under spec version 7, which is why a component still shows `tiered` and `secrets`; version 8 does not use them.',
  },
  {
    path: '/apps/location/explorer',
    body: EXPLORER_LOCATION,
    headers: ['x-flux-mode: Roundrobin'],
    goal: 'where',
    example: `curl ${BASE}/apps/location/explorer`,
    explain: `Each row is one node running the app right now: \`ip\` is its address and API port, \`runningSince\` when that instance started. \`expireAt\` is ${LOCATION_TTL_MIN} minutes after \`broadcastedAt\`: a record lapses that long after its node last announced it, and nodes announce about once an hour. The sandbox sample is trimmed to two rows; the live list has one row per instance.`,
  },
  {
    path: '/apps/appspecifications/doesnotexist123',
    body: APP_NOT_FOUND,
    goal: 'error',
    example: `curl ${BASE}/apps/appspecifications/doesnotexist123`,
    explain:
      'A missing app is not an HTTP error: the call still answers 200 and `status` is `error`, with the reason in `data.message`. Always check `status`, not the HTTP code.',
  },
  {
    path: '/apps/location',
    body: MISSING_NAME,
    explain:
      'Leaving out the app name is also reported inside the body, with HTTP 200: `status` is `error` and `data.message` says what was missing.',
  },
];

const endpointCommands = ENDPOINTS.flatMap(endpointEntries);

const JQ_TARGETS = [
  'daemon/getblockcount',
  'daemon/getfluxnodecount',
  'apps/appspecifications/explorer',
  'apps/appspecifications/doesnotexist123',
  'apps/location/explorer',
]
  .map((p) => p.replace(/\//g, '\\/'))
  .join('|');

const POST_URL = `(?=[^|;&<>]* ${HOST}/apps/calculate(?:fiatandflux)?price(?: |$))`;
const POST_DATA = '(?=[^|;&<>]* (?:-d|--data|--data-binary) @spec\\.json(?: |$))';
const POST_BODY_OK = `file:spec.json=${SPEC_JSON.trim()}`;

export const fluxApi: ScriptWithRequires = {
  id: 'flux-api',
  cwd: '~/app',
  files: { 'spec.json': SPEC_JSON },
  intro: [
    SIM_INTRO,
    `curl answers with responses recorded from api.runonflux.io on ${RECORDED_ON}, not live ones.`,
    'The Flux API is public and needs no key. Every answer has a status and a data field.',
    `Start with: curl ${BASE}/daemon/getblockcount`,
  ],
  notFound:
    '[err]sandbox: no recorded response for `{input}`. The sandbox never calls the network, so it only knows the requests listed by help.',
  commands: [
    ...endpointCommands,

    // ---- jq on a piped response (credited for any filter that succeeds) -------------------------
    {
      match: `^curl${QUIET} ${HOST}/(?:${JQ_TARGETS})${QUIET} \\| jq(?: -[rc])* .+$`,
      output: [],
      passthrough: true,
      goal: 'jq',
      example: `curl -s ${BASE}/daemon/getfluxnodecount | jq .data.total`,
      explain:
        '`jq` reads the JSON that `curl` printed and prints only the part you ask for, indented and coloured. A filter is a path: `.data.total` means the key `total` inside `data`. `-s` keeps curl quiet so only the body goes down the pipe.',
    },

    // ---- the price calculator: a POST that only reads ----------------------------------------------
    {
      match: `^curl${POST_URL}(?=[^|;&<>]* (?:-H|--header) ["']Content-Type: text/plain["'](?: |$))${POST_DATA}[^|;&<>]*$`,
      requires: [POST_BODY_OK],
      output: [
        body(PRICE_BODY),
        `[note]Computed in the sandbox with the Academy's copy of the price formula and the FLUX price of ${BAKED_PRICING.capturedAt}. The live endpoint answers in the same shape.`,
      ],
      stream: 200,
      goal: 'price',
      example: `curl -X POST ${BASE}/apps/calculatefiatandfluxprice -H 'Content-Type: text/plain' -d @spec.json`,
      explain:
        'The calculator takes the whole app spec as the request body and answers `usd` and `flux` for the whole subscription, plus `fluxDiscount`, the percentage you save by paying in FLUX. It is a POST but only reads: nothing is registered. Send the body as `text/plain`.',
    },
    {
      match: `^curl${POST_URL}(?=[^|;&<>]* (?:-H|--header) ["']Content-Type: application/json["'](?: |$))${POST_DATA}[^|;&<>]*$`,
      output: [
        '[note]No answer. With Content-Type: application/json this endpoint never replies.',
        `[note]After about ${GATEWAY_TIMEOUT_SEC} seconds the gateway gives up with HTTP 504. The sandbox skips the wait.`,
        "[note]Send the same body as text/plain instead: -H 'Content-Type: text/plain'",
      ],
      stream: 700,
      explain:
        'The calculator reads the raw body itself, and a JSON content type makes the server consume it first, so the handler never gets it. This is a quirk of this endpoint, not of JSON APIs in general.',
    },
    {
      match: `^curl${POST_URL}(?![^|;&<>]* (?:-H|--header) )${POST_DATA}[^|;&<>]*$`,
      requires: [POST_BODY_OK],
      output: [
        body(PRICE_BODY),
        `[note]Computed in the sandbox with the Academy's copy of the price formula and the FLUX price of ${BAKED_PRICING.capturedAt}.`,
      ],
      stream: 200,
      goal: 'price',
      explain:
        'With no header, curl labels `-d` data as a web form (`application/x-www-form-urlencoded`), which this endpoint also accepts. It works, but naming `text/plain` is clearer.',
    },
    {
      match: `^curl${POST_URL}[^|;&<>]*$`,
      output: [
        '[note]The sandbox only prices the spec.json that came with this scenario, sent with -d @spec.json.',
        '[note]To price a spec of your own, open the Spec Forge lab.',
      ],
      explain: 'The sandbox cannot call the live calculator, so it prices only the file it shipped with.',
    },
  ],
  goals: [
    { id: 'height', label: 'Ask the network for its block height' },
    { id: 'nodes', label: 'Count the FluxNodes' },
    { id: 'jq', label: 'Pull one number out with jq' },
    { id: 'spec', label: 'Read the spec of the app named explorer' },
    { id: 'where', label: 'See which nodes run it' },
    { id: 'error', label: 'Ask for an app that does not exist' },
    { id: 'price', label: 'Ask the calculator what an app costs' },
  ],
};

export { PRICE_BODY };
