/**
 * Illustration inputs for the Reference: the specs the worked examples price, the sample specs the
 * validate box offers, the Dockerfile patterns and a few strings to parse.
 *
 * These are INPUTS, not claims about Flux: their numbers (a 4 core spec, port 31001) are the example's
 * own. The numbers the pages print as limits and prices come from the engine. Every spec here is
 * checked by `examples.test.ts`: the clean ones lint without errors or warnings, and the priced ones
 * reproduce the live calculator's answers from FACTS.md section 4.6.
 */

import { defaultComponent, defaultSpec, type FluxAppSpec } from '@shared/flux';

export type PriceSize = 'small' | 'medium' | 'large';

export interface PriceExample {
  id: PriceSize;
  label: string;
  /** "0.5 core, 500 MB, 5 GB" for the picker. */
  summary: string;
  spec: FluxAppSpec;
}

function priced(name: string, cpu: number, ram: number, hdd: number): FluxAppSpec {
  const spec = defaultSpec();
  spec.name = name;
  spec.compose = [
    defaultComponent({
      name: 'web',
      description: 'Web server',
      repotag: 'nginx:1.27',
      ports: [31001],
      containerPorts: [80],
      domains: [''],
      cpu,
      ram,
      hdd,
    }),
  ];
  return spec;
}

/**
 * The three sizes of FACTS 4.6 "A price curve with a NON enterprise port (31001)". Port 31001 is above
 * 1023 and not 8080, so no fee port is involved and the numbers show only the formula.
 */
export const PRICE_EXAMPLES: readonly PriceExample[] = [
  {
    id: 'small',
    label: 'Small',
    summary: '0.5 core, 500 MB, 5 GB',
    spec: priced('price-small', 0.5, 500, 5),
  },
  {
    id: 'medium',
    label: 'Medium',
    summary: '2 cores, 4000 MB, 40 GB',
    spec: priced('price-medium', 2, 4000, 40),
  },
  {
    id: 'large',
    label: 'Large',
    summary: '4 cores, 8000 MB, 100 GB',
    spec: priced('price-large', 4, 8000, 100),
  },
];

/** The instance counts of the price curve table (FACTS 4.6). */
export const CURVE_INSTANCES: readonly number[] = [1, 2, 3, 4, 5, 10, 20, 100];

/** Instance counts the interactive example offers. */
export const EXAMPLE_INSTANCES: readonly number[] = [1, 2, 3, 4, 5, 10];

/** Instance counts of the table that shows what one fee port adds to a small app. */
export const FEE_EFFECT_INSTANCES: readonly number[] = [1, 3, 10];

/** Subscription lengths the interactive example offers, in pricing months. */
export const EXAMPLE_MONTHS: readonly number[] = [1, 3, 6, 12];

/** The same example, priced as FACTS 4.6 says the live calculator answered on 2026-10-12 (USD). */
export const VERIFIED_CURVE: Readonly<Record<PriceSize, readonly number[]>> = {
  small: [0.99, 0.99, 0.99, 1.99, 2.49, 4.99, 9.99, 49.99],
  medium: [1.99, 3.49, 4.99, 7.99, 9.99, 19.49, 38.99, 194.49],
  large: [3.99, 7.49, 10.99, 16.49, 20.49, 40.49, 80.49, 400.49],
};

// ---------------------------------------------------------------------------
// The validate box
// ---------------------------------------------------------------------------

export interface ValidateSample {
  id: string;
  label: string;
  json: string;
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** A spec written the way old tutorials did: reserved prefix, placeholder owner, a banned port. */
const OLD_STYLE = {
  version: 8,
  name: 'flux-demo',
  description: 'Spec copied from an old tutorial',
  owner: 'YOUR_ZELID_HERE',
  instances: 2,
  compose: [
    {
      name: 'web-server',
      description: 'Web server',
      repotag: 'nginx:latest',
      ports: [22],
      containerPorts: [80],
      domains: [''],
      environmentParameters: [],
      commands: [],
      containerData: '/tmp',
      tiered: false,
      cpu: 0.5,
      ram: 500,
      hdd: 5,
    },
  ],
};

export const VALIDATE_SAMPLES: readonly ValidateSample[] = [
  { id: 'old-tutorial', label: 'An old tutorial spec', json: pretty(OLD_STYLE) },
  { id: 'hello', label: 'Hello world', json: pretty(defaultSpec()) },
];

// ---------------------------------------------------------------------------
// Grammar examples
// ---------------------------------------------------------------------------

export interface GeoSet {
  id: string;
  label: string;
  entries: readonly string[];
  /** What the list does, in one plain sentence. */
  outcome: string;
}

export const GEO_SETS: readonly GeoSet[] = [
  {
    id: 'europe-not-russia',
    label: 'Europe, but not Russia',
    entries: ['acEU', 'a!cEU_RU'],
    outcome: 'A node must be in Europe and must not be in Russia.',
  },
  {
    id: 'two-countries',
    label: 'Germany or France',
    entries: ['acEU_DE', 'acEU_FR'],
    outcome: 'A node must be in Germany or in France.',
  },
  {
    id: 'not-north-america',
    label: 'Anywhere but North America',
    entries: ['a!cNA'],
    outcome: 'With no allow entry, any node that is not denied qualifies.',
  },
];

/** Strings the containerData parser demo starts from. */
export const CONTAINER_DATA_EXAMPLES: readonly { label: string; value: string }[] = [
  { label: 'No data wanted', value: '/tmp' },
  { label: 'A database with a standby', value: 'g:/var/lib/mysql' },
  { label: 'Several mounts', value: 'r:/data|m:logs:/var/log|f:config.yaml:/etc/app.yaml' },
  { label: 'Another component volume', value: '/data|0:/shared' },
];

/** Public ports the checker offers as one click examples. */
export const PORT_EXAMPLES: readonly number[] = [22, 80, 8080, 16127, 31001];

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------

/**
 * The app the networking page reads its names from: a web component with two public ports (one with a
 * custom domain), an API and a database that publish nothing. The image `yourname/shop-api` is a
 * placeholder for your own.
 *
 * The database uses `g:` (primary and standby). FACTS 7.2: only the primary runs that component's container,
 * the other components keep running on every instance node, and FDM sends every port to the primary node.
 * The example is for names and ports, not a recommended production layout.
 */
export const NETWORK_EXAMPLE: FluxAppSpec = (() => {
  const spec = defaultSpec();
  spec.name = 'my-shop';
  spec.description = 'A shop: web front end, API and database';
  spec.compose = [
    defaultComponent({
      name: 'web',
      description: 'nginx front end and a second port for a metrics page',
      repotag: 'nginx:1.27-alpine',
      ports: [31001, 31002],
      containerPorts: [80, 8080],
      domains: ['shop.example.com', ''],
      cpu: 0.2,
      ram: 200,
      hdd: 2,
    }),
    defaultComponent({
      name: 'api',
      description: 'The API, reachable only from inside the app',
      repotag: 'yourname/shop-api:1.0.0',
      ports: [],
      containerPorts: [],
      domains: [],
      environmentParameters: ['DB_HOST=fluxdb_my-shop', 'DB_PORT=5432'],
      cpu: 0.5,
      ram: 500,
      hdd: 5,
    }),
    defaultComponent({
      name: 'db',
      description: 'PostgreSQL, reachable only from inside the app',
      repotag: 'postgres:16-alpine',
      ports: [],
      containerPorts: [],
      domains: [],
      environmentParameters: ['POSTGRES_PASSWORD=change-me', 'POSTGRES_DB=app'],
      containerData: 'g:/var/lib/postgresql/data',
      cpu: 1,
      ram: 1000,
      hdd: 10,
    }),
  ];
  return spec;
})();

// ---------------------------------------------------------------------------
// Docker
// ---------------------------------------------------------------------------

/** The port the web app Dockerfile and its component use. */
export const DOCKER_WEB_PORT = 3000;

/** Public ports the prose names as examples of a fee port and a free port. */
export const FEE_PORT_EXAMPLES = { web: 80, alt: 8080 } as const;
export const FREE_PORT_EXAMPLE = 31001;

/** Tags the docker page uses to show a moving tag and a pinned one. */
export const TAG_EXAMPLES = { moving: '24-alpine', pinned: '1.27.3', own: '1.0.0' } as const;

export const DOCKERFILE_WEB = `# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=${DOCKER_WEB_PORT}
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE ${DOCKER_WEB_PORT}
CMD ["node", "dist/server.js"]
`;

export const DOCKERFILE_STATIC = `# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /site
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /site/dist /usr/share/nginx/html
EXPOSE 80
`;

/** The component each Dockerfile pairs with. The image names are placeholders for your own. */
export const DOCKER_SPEC_WEB: FluxAppSpec = (() => {
  const spec = defaultSpec();
  spec.name = 'my-web-app';
  spec.compose = [
    defaultComponent({
      name: 'web',
      description: 'Node web server',
      repotag: 'yourname/my-web-app:1.0.0',
      ports: [31001],
      containerPorts: [DOCKER_WEB_PORT],
      domains: [''],
      environmentParameters: ['HOST=0.0.0.0', `PORT=${DOCKER_WEB_PORT}`],
      cpu: 0.5,
      ram: 500,
      hdd: 5,
    }),
  ];
  return spec;
})();

export const DOCKER_SPEC_STATIC: FluxAppSpec = (() => {
  const spec = defaultSpec();
  spec.name = 'my-site';
  spec.instances = 2;
  spec.compose = [
    defaultComponent({
      name: 'site',
      description: 'nginx serving the built site',
      repotag: 'yourname/my-site:1.0.0',
      ports: [31020],
      containerPorts: [80],
      domains: [''],
      cpu: 0.1,
      ram: 100,
      hdd: 1,
    }),
  ];
  return spec;
})();

/** Image references the docker page parses. The digest is made up. */
export const IMAGE_EXAMPLES: readonly string[] = [
  'nginx:1.27-alpine',
  'yourname/my-web-app:1.0.0',
  'ghcr.io/yourname/my-web-app:1.0.0',
  'nginx',
  'nginx:latest',
  'docker.io/library/nginx:1.27',
  'Yourname/My-Web-App:1.0.0',
  'nginx@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
];

/** How common runtimes are told to listen on every interface. Standard behaviour of each tool. */
export const BIND_SNIPPETS: readonly { runtime: string; lang: 'js' | 'sh' | 'text'; code: string }[] = [
  {
    runtime: 'Node.js',
    lang: 'js',
    code: `server.listen(Number(process.env.PORT ?? ${DOCKER_WEB_PORT}), '0.0.0.0');`,
  },
  {
    runtime: 'Python, Flask',
    lang: 'text',
    code: "app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '8000')))",
  },
  { runtime: 'Python, uvicorn', lang: 'sh', code: 'uvicorn app:app --host 0.0.0.0 --port 8000' },
  { runtime: 'Python, gunicorn', lang: 'sh', code: 'gunicorn --bind 0.0.0.0:8000 app:app' },
  {
    runtime: 'Go',
    lang: 'text',
    code: 'http.ListenAndServe(":8080", mux)  // an empty host means every interface',
  },
  { runtime: 'nginx', lang: 'text', code: 'listen 80;  # no address means every interface' },
];
