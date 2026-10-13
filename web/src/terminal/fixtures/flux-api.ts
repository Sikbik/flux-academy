/**
 * Recorded responses of the Flux public read-only API, for the "Query the Flux API" scenario.
 *
 * Every value here is a trimmed copy of a real response captured on 2026-10-12 (the files in
 * docs/research/samples, FACTS section 10). The sandbox replays them; it never calls the network.
 * `flux-api.test.ts` compares these constants with the sample files so they cannot drift.
 */

/** The date the samples were recorded. Shown to the learner. */
export const RECORDED_ON = '2026-10-12';

/** GET /daemon/getblockcount (FACTS 10.6 E1). */
export const BLOCK_COUNT = { status: 'success', data: 3031422 } as const;

/** GET /daemon/getfluxnodecount (FACTS 10.6 E2). */
export const NODE_COUNT = {
  status: 'success',
  data: {
    total: 7105,
    stable: 7105,
    'basic-enabled': 3585,
    'super-enabled': 1691,
    'bamf-enabled': 1829,
    'cumulus-enabled': 3585,
    'nimbus-enabled': 1691,
    'stratus-enabled': 1829,
    ipv4: 2516,
    ipv6: 0,
    onion: 0,
  },
} as const;

/** GET /apps/appspecifications/explorer (FACTS 10.6 E15). The app is registered with spec v7. */
export const EXPLORER_SPEC = {
  status: 'success',
  data: {
    version: 7,
    name: 'explorer',
    description: 'Official Flux Explorer explorer.runonflux.io',
    owner: '196GJWyLxzAw3MirTT7Bqs2iGpUQio29GH',
    compose: [
      {
        name: 'mongodb',
        description: 'db component',
        repotag: 'mvertes/alpine-mongo:latest',
        ports: [],
        domains: [],
        environmentParameters: [],
        commands: [],
        containerPorts: [],
        containerData: '/db',
        cpu: 1,
        ram: 2000,
        hdd: 45,
        tiered: false,
        repoauth: '',
        secrets: '',
      },
    ],
    instances: 40,
    contacts: [],
    geolocation: [],
    expire: 88000,
    nodes: [],
    staticip: false,
    hash: 'cfe8a3158c58a0b7438f81d5f314182f177ae68198bcfabcddc1ecfb635345a7',
    height: 3004517,
  },
} as const;

/** GET /apps/location/explorer (FACTS 10.6). Trimmed to two of the app's running instances. */
export const EXPLORER_LOCATION = {
  status: 'success',
  data: [
    {
      ip: '74.103.5.187:16177',
      name: 'explorer',
      hash: 'cfe8a3158c58a0b7438f81d5f314182f177ae68198bcfabcddc1ecfb635345a7',
      broadcastedAt: '2026-10-12T19:02:34.918Z',
      expireAt: '2026-10-12T21:07:34.918Z',
      osUptime: 12074456.45,
      staticIp: false,
      runningSince: '2026-06-04T11:18:15.381Z',
    },
    {
      ip: '176.9.51.187:16127',
      name: 'explorer',
      hash: 'cfe8a3158c58a0b7438f81d5f314182f177ae68198bcfabcddc1ecfb635345a7',
      broadcastedAt: '2026-10-12T18:59:52.665Z',
      expireAt: '2026-10-12T21:04:52.665Z',
      osUptime: 16050349.98,
      staticIp: true,
      runningSince: '2026-09-08T14:22:41.622Z',
    },
  ],
} as const;

/** GET /apps/appspecifications/doesnotexist123: an in-band error (FACTS 10.2). HTTP status is 200. */
export const APP_NOT_FOUND = {
  status: 'error',
  data: { name: 'Error', message: 'Application: doesnotexist123 not found' },
} as const;

/** GET /apps/appspecifications with no name (FACTS 10.2). */
export const MISSING_NAME = {
  status: 'error',
  data: { name: 'Error', message: 'No Flux App name specified' },
} as const;

/** An unknown path is an Express HTML 404, not JSON (FACTS 10.2). */
export const EXPRESS_404 = (path: string): string => `Cannot GET ${path}`;

/** Response headers worth showing for `curl -i`. `fluxnode` names the node that answered (FACTS 10.1). */
export const SAMPLE_HEADERS = [
  'HTTP/2 200',
  'content-type: application/json; charset=utf-8',
  'access-control-allow-origin: *',
  'fluxnode: server24_188.40.127.18',
] as const;
