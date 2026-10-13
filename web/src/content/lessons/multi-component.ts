/**
 * Stratus 5: Several containers, one app.
 *
 * Arc: one app holds several containers on one private network; component names and ports have rules;
 * wire a frontend to an API to a cache with only the frontend public; totals are app-wide for caps and
 * for price; a worked three-tier spec to copy.
 *
 * Facts: FACTS 3.3 (component keys, name rule, caps 15 cores, 59000 MB, 820 GB, at most 10 components, at
 * most 5 ports each), 3.4 (ports unique across the app), 3.8 and 8.2 (container names, network, hostname,
 * container ports between components, networkWith), 4.3 and 4.4 (one price for the totals; the small app
 * discount tests the totals), 6.4 (the plain app domain is an alias for the first port), 11 rows 8 and 10,
 * legacy audit MCP-02 and MCP-08 (browser code cannot use internal names; no start-order field).
 */

import { BAKED_PRICING, HW_DISCOUNTS, LIMITS } from '@shared/flux';
import type { Lesson } from '@/learn/types';

/** The date of the rate card the budgets in this lesson are graded against. */
const RATES_DATE = BAKED_PRICING.capturedAt;

const num = (n: number): string => n.toLocaleString('en-US');

/** "3 cores, 6 GB of RAM and 150 GB of disk" for one row of the engine's small-app discount table. */
function sizeLine(row: { maxCpu: number; maxRam: number; maxHdd: number } | undefined): string {
  return row
    ? `${row.maxCpu} cores, ${row.maxRam / 1000} GB of RAM and ${row.maxHdd} GB of disk`
    : 'its size';
}
const SMALL = HW_DISCOUNTS[0];
const MEDIUM = HW_DISCOUNTS[1];

interface Part {
  name: string;
  description: string;
  repotag: string;
  repoauth: string;
  ports: number[];
  containerPorts: number[];
  domains: string[];
  environmentParameters: string[];
  commands: string[];
  containerData: string;
  cpu: number;
  ram: number;
  hdd: number;
}

/** A component with every field spelled out, so specs merge predictably. */
function part(o: Partial<Part> & Pick<Part, 'name' | 'repotag'>): Part {
  const { name, repotag, ...rest } = o;
  return {
    name,
    description: name,
    repotag,
    repoauth: '',
    ports: [],
    containerPorts: [],
    domains: [],
    environmentParameters: [],
    commands: [],
    containerData: '/tmp',
    cpu: 0.5,
    ram: 500,
    hdd: 5,
    ...rest,
  };
}

/** The store front: the only component that is public. */
const storeWeb = part({
  name: 'web',
  description: 'Storefront',
  repotag: 'acme/store-web:3.2.0',
  ports: [31900],
  containerPorts: [3000],
  domains: [''],
  environmentParameters: ['API_URL=http://fluxapi_store:4000'],
  cpu: 0.5,
  ram: 500,
  hdd: 5,
});

const storeApi = part({
  name: 'api',
  description: 'Catalogue API',
  repotag: 'acme/store-api:3.2.0',
  environmentParameters: ['CACHE_HOST=fluxcache_store', 'CACHE_PORT=6379'],
  cpu: 1,
  ram: 1000,
  hdd: 5,
});

const storeCache = part({
  name: 'cache',
  description: 'Redis cache',
  repotag: 'redis:7.4-alpine',
  cpu: 0.5,
  ram: 500,
  hdd: 1,
});

const lesson: Lesson = {
  id: 'multi-component',
  hook: 'Real apps are rarely one container. You will put a frontend, an API and a cache in one app, learn the naming and port rules that registration enforces, wire them so only the frontend is public, and see how the totals decide the price.',
  objectives: [
    'Name components and assign ports so that registration accepts the spec.',
    'Wire components to each other by container name and keep every component but the frontend off the public address.',
    'Predict how component sizes add up against the caps and against the price.',
    'Explain why browser code cannot use the internal names.',
  ],
  steps: [
    {
      id: 'one-app',
      title: 'One app, several containers',
      body: [
        // fact: FACTS 3.2 and 3.3 (compose holds 1 to 10 components), 8.2 (one docker network per app, names flux<component>_<app>)
        'An app is not limited to one container. {{term:compose}} holds up to ten components, and each {{term:component}} is a container with its own image, resources, ports and volume. Every instance of the app runs all of them together on one node, on a private network that only they share.',
        'On that network each container has a name: `flux<component>_<app>`. In an app called `store`, a frontend, an API and a cache are `fluxweb_store`, `fluxapi_store` and `fluxcache_store`. This is {{term:internal-dns}}. They reach one another by those names, on the container port, with nothing published.',
      ],
      callouts: [
        {
          // fact: FACTS 8.2 (networkWith: linked apps must be installed on the same node by the same owner; the install fails otherwise)
          kind: 'gotcha',
          body: 'Two separate apps do not share a network. A description token, `networkWith:[appA,appB]`, can link them, but only on a node that happens to run both, and the install fails when it does not. Prefer one app with several components.',
        },
        {
          // fact: FACTS 12 (Compose: counts toward one price and one name)
          kind: 'why',
          body: 'One app is one name, one price and one expiry. Splitting an app in two doubles the bookkeeping and gives up the private network.',
        },
      ],
      stage: { kind: 'diagram', id: 'internal-dns', beat: 1 },
    },
    {
      id: 'naming',
      title: 'Names and ports have rules',
      body: [
        // fact: FACTS 3.3 and 11 rows 9 and 10 (component names letters and digits only; zel and flux prefixes reserved; unique; at most 10 components)
        'Component names are stricter than app names. They allow letters and digits only, so no hyphens even though app names allow them, they must not start with `zel` or `flux`, which are reserved, and each must be unique in the app. An app holds at most 10 components.',
        // fact: FACTS 3.4 (max 5 ports per component, unique across all components)
        'Ports have one more rule: a public port number can appear once in the whole app, across every component, and a component lists at most five. This draft breaks two of the name rules, and the issues panel names them. Fix them without removing a component.',
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'store',
          description: 'Online store',
          instances: 3,
          compose: [storeWeb, { ...storeApi, name: 'api-server' }, { ...storeCache, name: 'fluxcache' }],
        },
        editable: ['compose[1].name', 'compose[2].name'],
        focus: [
          { path: 'compose[1].name', note: 'Letters and digits only. A hyphen is not allowed here.' },
          { path: 'compose[2].name', note: 'Names starting with flux or zel are reserved.' },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Rename the two components so that both name rules are satisfied.',
        hint: 'Keep three components. Use short names made of letters and digits that do not start with flux or zel, such as api and cache.',
        check: {
          all: [
            { path: 'compose.length', op: 'gte', value: 3, message: 'Keep all three components.' },
            {
              lint: 'absent',
              codes: ['COMPONENT_NAME_FORMAT', 'COMPONENT_NAME_RESERVED', 'COMPONENT_NAME_DUPLICATE'],
              message:
                'A component name still breaks a rule: letters and digits only, no flux or zel prefix, unique.',
            },
          ],
        },
        solution: { compose: [{}, { name: 'api' }, { name: 'cache' }] },
      },
    },
    {
      id: 'wiring',
      title: 'Wire the tiers',
      body: [
        'The frontend calls the API and the API calls the cache. Only the frontend should be reachable from outside, because every public port is open to the whole internet on every node that runs an instance. Connect the components on the board in that direction and leave the other two unpublished.',
        // fact: FACTS 8.2 (use the container port between components; nothing needs ports); 11 MCP-02 (browser code cannot resolve per-app Docker DNS)
        'Each connection gives the caller an environment variable holding the callee container name and container port. The board shows both. Notice what is missing: the internal names exist only between containers, so code that runs in a visitor browser cannot use them.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          body: 'A single page app runs its JavaScript in the visitor browser. That code has to call the API through a public address, which means the API needs a published port. A server rendered frontend can call the API internally and keep it private.',
        },
      ],
      stage: {
        kind: 'widget',
        id: 'wiring-board',
        props: {
          app: 'store',
          components: ['web', 'api', 'cache'],
          goal: {
            links: [
              ['web', 'api'],
              ['api', 'cache'],
            ],
            public: ['web'],
          },
        },
      },
      task: {
        kind: 'widget',
        prompt: 'Connect web to api and api to cache, with only web public.',
      },
    },
    {
      id: 'totals',
      title: 'Everything adds up',
      body: [
        // fact: FACTS 3.3 (caps are sums over components: 15 cores, 59000 MB, 820 GB, enforced by the validator) and 3.3 (a node also checks live free capacity)
        `Resources are counted for the whole app. The validator caps the sum of every component at ${LIMITS.totals.cpu} cores, ${num(LIMITS.totals.ram)} MB of RAM and ${LIMITS.totals.hdd} GB of disk, and a node also has to have that much free. One greedy component can take the room of the others.`,
        // fact: FACTS 4.3 and 4.4 (one price for the totals; small app discount tested on the totals and only below 4 instances)
        `The price is one number for the totals, not one per component, and the discount tiers test the totals too. An app under ${sizeLine(SMALL)} gets ${SMALL?.label ?? 'a discount'} off, and one under ${sizeLine(MEDIUM)} gets ${MEDIUM?.label ?? 'a discount'}, while it has fewer than ${LIMITS.instances.smallAppDiscountBelow} instances. This app starts at the 10 percent line. Trim it below its budget and watch that line become the 20 percent one.`,
      ],
      callouts: [
        {
          kind: 'cost',
          body: 'A component costs what its reserved resources cost, billed once per instance like the rest of the app. An idle cache is billed for what you reserved, not for what it uses.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'store',
          description: 'Online store',
          instances: 3,
          compose: [
            { ...storeWeb, cpu: 1, ram: 1000, hdd: 5 },
            { ...storeApi, cpu: 2, ram: 2000, hdd: 10 },
            { ...storeCache, cpu: 0.5, ram: 500, hdd: 1 },
          ],
        },
        editable: [
          'compose[0].cpu',
          'compose[0].ram',
          'compose[0].hdd',
          'compose[1].cpu',
          'compose[1].ram',
          'compose[1].hdd',
          'compose[2].cpu',
          'compose[2].ram',
          'compose[2].hdd',
        ],
        focus: [
          {
            path: 'compose[1].cpu',
            note: 'The API is the biggest line. The totals decide the discount tier.',
          },
        ],
        show: ['form', 'price', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: `Get the app under USD 5.50 a month with all three components and all three instances, at the rates read on ${RATES_DATE}.`,
        hint: 'The price waterfall has a small app discount line. Look at how many cores the three components add up to.',
        check: {
          all: [
            { path: 'compose.length', op: 'gte', value: 3, message: 'Keep all three components.' },
            {
              price: 'max',
              usd: 5.49,
              message:
                'Still USD 5.50 or more. Trim the resources, and look at the discount line in the price.',
            },
          ],
        },
        solution: { compose: [{}, { cpu: 1.4 }, {}] },
      },
    },
    {
      id: 'ship-it',
      title: 'The three-tier shape',
      body: [
        // fact: FACTS 6.4 (the plain app domain is an alias for the first port), 8.2
        'This is the shape most three-tier apps take. One component publishes a port, and the plain address of the app points at the first port in the list. The other components list no ports at all and are reached by container name. Each caller finds its callee through an environment variable.',
        'Read the spec top to bottom with the notes. It starts three instances of all three components together, and nothing about start order is written anywhere: the v8 spec has no field for it, so each component should retry until its neighbour answers.',
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'store',
          description: 'Online store',
          instances: 3,
          compose: [storeWeb, storeApi, storeCache],
        },
        editable: [],
        focus: [
          {
            path: 'compose[0].ports',
            note: 'The only public port. The plain app address points at the first port.',
          },
          {
            path: 'compose[0].environmentParameters',
            note: 'The frontend finds the API by container name and container port.',
          },
          { path: 'compose[1].ports', note: 'Empty: the API is reached only from inside the app.' },
          { path: 'compose[2].containerData', note: 'A cache keeps nothing worth saving, so /tmp.' },
        ],
        show: ['form', 'json', 'price'],
      },
    },
  ],
  checkpoint: [
    {
      id: 'bookshop',
      kind: 'spec-build',
      prompt:
        'A bookshop runs a storefront, an API and a Redis cache as one app. Add the two missing components and meet every line of the brief.',
      spec: {
        name: 'bookshop',
        description: 'Online bookshop',
        instances: 1,
        compose: [
          part({
            name: 'web',
            description: 'Storefront',
            repotag: 'acme/bookshop-web:2.0.0',
            ports: [31900],
            containerPorts: [3000],
            domains: [''],
          }),
        ],
      },
      requirements: [
        {
          id: 'names',
          label: 'Three components named web, api and cache, in that order',
          check: {
            all: [
              { path: 'compose[0].name', op: 'eq', value: 'web' },
              { path: 'compose[1].name', op: 'eq', value: 'api' },
              { path: 'compose[2].name', op: 'eq', value: 'cache' },
            ],
          },
        },
        {
          id: 'images',
          label:
            'api runs acme/bookshop-api:2.0.0, which listens on 4000; cache runs Redis 7.4 with a version tag',
          check: {
            all: [
              { path: 'compose[1].repotag', op: 'eq', value: 'acme/bookshop-api:2.0.0' },
              { path: 'compose[2].repotag', op: 'matches', value: '^redis:7\\.4' },
            ],
          },
        },
        {
          id: 'only-web-public',
          label: 'Only web publishes a port: the api and the cache have none',
          check: {
            all: [
              { path: 'compose[0].ports', op: 'len>=', value: 1 },
              { path: 'compose[1].ports', op: 'empty' },
              { path: 'compose[2].ports', op: 'empty' },
            ],
          },
        },
        {
          id: 'web-to-api',
          label: 'web gets API_URL=http://fluxapi_bookshop:4000',
          check: {
            path: 'compose[0].environmentParameters',
            op: 'matches',
            value: '^API_URL=http://fluxapi_bookshop:4000/?$',
          },
        },
        {
          id: 'api-to-cache',
          label: 'api gets CACHE_HOST=fluxcache_bookshop',
          check: {
            path: 'compose[1].environmentParameters',
            op: 'matches',
            value: '^CACHE_HOST=fluxcache_bookshop$',
          },
        },
        {
          id: 'sizes',
          label: 'The api has at least 500 MB of RAM',
          check: { path: 'compose[1].ram', op: 'gte', value: 500 },
        },
        {
          id: 'instances',
          label: 'Three instances',
          check: { path: 'instances', op: 'eq', value: 3 },
        },
        {
          id: 'budget',
          label: `Costs less than USD 2.50 a month, at the rates read on ${RATES_DATE}`,
          check: { price: 'max', usd: 2.49 },
        },
      ],
      solution: {
        instances: 3,
        compose: [
          { environmentParameters: ['API_URL=http://fluxapi_bookshop:4000'] },
          part({
            name: 'api',
            description: 'Bookshop API',
            repotag: 'acme/bookshop-api:2.0.0',
            environmentParameters: ['CACHE_HOST=fluxcache_bookshop'],
            cpu: 0.5,
            ram: 500,
            hdd: 5,
          }),
          part({
            name: 'cache',
            description: 'Redis cache',
            repotag: 'redis:7.4-alpine',
            cpu: 0.3,
            ram: 300,
            hdd: 1,
          }),
        ],
      },
      explain:
        'The two inner components list no ports and are reached by container name, which keeps them off the public address. The sizes add up to a small app, so three instances stay inside the budget.',
      hint: 'Container names are flux, the component, an underscore and the app: fluxapi_bookshop and fluxcache_bookshop. Every component you add starts small, so raise the api RAM and keep the others modest.',
    },
    {
      id: 'newsroom-fix',
      kind: 'spec-fix',
      prompt:
        'Registration would refuse this newsroom spec for three different reasons, one of them about the component name, one about a port and one about the totals. Fix all three and keep every component.',
      spec: {
        name: 'newsroom',
        description: 'News site',
        instances: 3,
        compose: [
          part({
            name: 'web',
            description: 'Site',
            repotag: 'acme/news-web:5.1.0',
            ports: [31950],
            containerPorts: [3000],
            domains: [''],
            cpu: 3,
            ram: 3000,
            hdd: 10,
          }),
          part({
            name: 'api-gateway',
            description: 'API gateway',
            repotag: 'acme/news-api:5.1.0',
            ports: [31950],
            containerPorts: [4000],
            domains: [''],
            cpu: 3,
            ram: 3000,
            hdd: 10,
          }),
          part({
            name: 'cache',
            description: 'Cache',
            repotag: 'redis:7.4-alpine',
            cpu: 10,
            ram: 4000,
            hdd: 5,
          }),
        ],
      },
      check: {
        all: [
          { lint: 'valid', message: 'The spec still has an error. Read the issues panel.' },
          { path: 'compose.length', op: 'gte', value: 3, message: 'Keep every component.' },
        ],
      },
      solution: {
        compose: [{}, { name: 'apigateway', ports: [], containerPorts: [], domains: [] }, { cpu: 1 }],
      },
      explain:
        'The hyphen in a component name is refused, two components cannot both publish port 31950, and the cores added up past the cap of 15. The better fix for the port is no port at all: the gateway is reached by container name, and a cache does not need ten cores.',
      hint: 'The issues panel has three errors: a name, a duplicate public port and a total. A component that other components call does not need a public port.',
    },
    {
      id: 'host-names',
      kind: 'match',
      prompt: 'Match each component to the host name another component uses to reach it.',
      pairs: [
        { id: 'api', left: 'The `api` component of the app `store`', right: '`fluxapi_store`' },
        { id: 'cache', left: 'The `cache` component of the app `store`', right: '`fluxcache_store`' },
        { id: 'db', left: 'The `db` component of the app `orders`', right: '`fluxdb_orders`' },
        { id: 'web', left: 'The `web` component of the app `docs`', right: '`fluxweb_docs`' },
      ],
      explain:
        'The pattern never changes: flux, the component name, an underscore and the app name. The container port follows after a colon when a port is needed.',
      hint: 'Put flux first, then the component, an underscore and the app name.',
    },
    {
      id: 'browser-names',
      kind: 'choice',
      prompt:
        'A single page app runs JavaScript in the visitor browser and needs data from the `api` component. What has to be true?',
      options: [
        {
          id: 'public',
          label: 'The api publishes a port and the browser calls its public address',
        },
        {
          id: 'internal',
          label: 'The page calls `fluxapi_store:4000` directly',
          why: 'Internal names resolve only between containers of the app. A visitor browser is outside that network.',
        },
        {
          id: 'localhost',
          label: 'The page calls `localhost:4000`',
          why: 'In the browser localhost is the visitor computer, not your node.',
        },
        {
          id: 'domains',
          label: 'Add the api to the `domains` of the web component',
          why: 'A domain entry attaches a custom hostname to one port of one component. It does not connect two components.',
        },
      ],
      answer: 'public',
      explain:
        'Code in a browser is outside the private network, so it needs a public address for each service it calls. A frontend that renders on the server can use the internal name instead and keep the API private.',
      hint: 'Where does the JavaScript run: on a node or on the visitor computer?',
    },
  ],
  recap: [
    'One app holds up to ten components. Each runs as a container of its own on one private network, and each instance runs all of them together.',
    'Component names allow letters and digits only and must not start with zel or flux. A public port number appears once in the whole app.',
    'Components reach each other as flux, the component, an underscore and the app, on the container port, with nothing published.',
    'Only the components that outsiders need get public ports. Browser code cannot use internal names, so it needs a public address.',
    'Caps and price are computed on the totals of the whole app, and the discount tiers test the totals too.',
  ],
  further: [
    {
      label: 'FluxCloud docs: components, names and ports',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
    },
    {
      label: 'FluxCloud docs: the shared database component, an example of two components',
      url: 'https://docs.runonflux.com/fluxcloud/shared-database/component',
    },
  ],
  terms: ['compose', 'internal-dns', 'component'],
};

export default lesson;
