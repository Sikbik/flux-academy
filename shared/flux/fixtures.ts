/**
 * Named example specs. Each is lint-clean (no errors and no warnings; infos are allowed), priced in tests
 * against the baked official rates, and feeds the Spec Forge presets and the lessons.
 *
 * The names are examples. Real apps may already use some of them, so the live price calculator treats a
 * spec with a taken name as an update; tests and `verify-pricing` append a unique suffix before asking it.
 *
 * Pure and framework-free. No Node built-ins, no DOM.
 */

import { defaultComponent, EXAMPLE_OWNER } from './spec.ts';
import type { FluxAppSpec } from './types.ts';

export interface FixtureSpec {
  id: string;
  title: string;
  /** One line for pickers. */
  description: string;
  /** Lesson ids (shared/curriculum.ts) this example serves. */
  lessons: string[];
  spec: FluxAppSpec;
}

function app(name: string, description: string, over: Partial<FluxAppSpec>): FluxAppSpec {
  return {
    version: 8,
    name,
    description,
    owner: EXAMPLE_OWNER,
    instances: 3,
    staticip: false,
    enterprise: '',
    contacts: [],
    geolocation: [],
    expire: 88_000,
    nodes: [],
    compose: [],
    ...over,
  };
}

export const FIXTURES: readonly FixtureSpec[] = [
  {
    id: 'hello-world',
    title: 'Hello world',
    description:
      'One nginx container on a free port, three instances, the smallest price the network allows.',
    lessons: ['first-deploy', 'how-apps-run', 'resources-pricing'],
    spec: app('hello-flux', 'Hello world demo', {
      compose: [defaultComponent()],
    }),
  },
  {
    id: 'web-app',
    title: 'Web app',
    description: 'A small web service with an environment variable, spread across Europe.',
    lessons: ['ports-and-domains', 'env-and-secrets', 'geo-placement', 'redundancy-failover'],
    spec: app('academy-web', 'A small web service', {
      geolocation: ['acEU'],
      compose: [
        defaultComponent({
          name: 'web',
          description: 'Echoes request details',
          repotag: 'traefik/whoami:v1.10.3',
          ports: [31010],
          containerPorts: [80],
          domains: [''],
          environmentParameters: ['WHOAMI_NAME=academy-web'],
          cpu: 0.5,
          ram: 500,
          hdd: 5,
        }),
      ],
    }),
  },
  {
    id: 'static-site',
    title: 'Static site on a custom domain',
    description: 'Two instances of nginx serving a site on your own domain.',
    lessons: ['custom-domains', 'ports-and-domains'],
    spec: app('academy-site', 'A static site', {
      instances: 2,
      compose: [
        defaultComponent({
          name: 'site',
          description: 'nginx serving a static site',
          repotag: 'nginx:1.27-alpine',
          ports: [31020],
          containerPorts: [80],
          domains: ['www.example.com'],
        }),
      ],
    }),
  },
  {
    id: 'minecraft',
    title: 'Minecraft server',
    description: 'A Java server with 4 GB of RAM and a primary and standby world volume.',
    lessons: ['minecraft-server', 'persistent-storage'],
    spec: app('academy-minecraft', 'Minecraft Java server', {
      instances: 2,
      compose: [
        defaultComponent({
          name: 'server',
          description: 'Minecraft Java edition',
          repotag: 'itzg/minecraft-server:java21',
          ports: [31025],
          containerPorts: [25565],
          domains: [''],
          environmentParameters: ['EULA=TRUE', 'MEMORY=3G', 'TYPE=PAPER'],
          containerData: 'g:/data',
          cpu: 2,
          ram: 4000,
          hdd: 20,
        }),
      ],
    }),
  },
  {
    id: 'wordpress-mysql',
    title: 'WordPress with MySQL',
    description:
      'Two components: WordPress reaches MySQL by its internal name, and MySQL keeps its data on a g: volume.',
    lessons: ['multi-component', 'shared-database', 'persistent-storage'],
    spec: app('academy-blog', 'WordPress blog with MySQL', {
      compose: [
        defaultComponent({
          name: 'wordpress',
          description: 'WordPress, the web front end',
          repotag: 'wordpress:6.6-apache',
          ports: [31030],
          containerPorts: [80],
          domains: [''],
          environmentParameters: [
            'WORDPRESS_DB_HOST=fluxmysql_academy-blog:3306',
            'WORDPRESS_DB_USER=wordpress',
            'WORDPRESS_DB_PASSWORD=change-me',
            'WORDPRESS_DB_NAME=wordpress',
          ],
          containerData: 'r:/var/www/html',
          cpu: 1,
          ram: 1000,
          hdd: 10,
        }),
        defaultComponent({
          name: 'mysql',
          description: 'MySQL database, reachable only inside the app',
          repotag: 'mysql:8.4',
          ports: [],
          containerPorts: [],
          domains: [],
          environmentParameters: [
            'MYSQL_ROOT_PASSWORD=change-me',
            'MYSQL_DATABASE=wordpress',
            'MYSQL_USER=wordpress',
            'MYSQL_PASSWORD=change-me',
          ],
          containerData: 'g:/var/lib/mysql',
          cpu: 1,
          ram: 1000,
          hdd: 10,
        }),
      ],
    }),
  },
  {
    id: 'redis-cache',
    title: 'Redis cache behind a web component',
    description: 'Redis has no public port; the web component reaches it at fluxredis_academy-cache:6379.',
    lessons: ['multi-component', 'ports-and-domains'],
    spec: app('academy-cache', 'A web component with a private Redis cache', {
      compose: [
        defaultComponent({
          name: 'web',
          description: 'Web front end',
          repotag: 'traefik/whoami:v1.10.3',
          ports: [31040],
          containerPorts: [80],
          domains: [''],
          environmentParameters: ['REDIS_URL=redis://fluxredis_academy-cache:6379'],
          cpu: 0.5,
          ram: 500,
          hdd: 5,
        }),
        defaultComponent({
          name: 'redis',
          description: 'Redis used as a cache',
          repotag: 'redis:7.4-alpine',
          ports: [],
          containerPorts: [],
          domains: [],
          commands: ['redis-server', '--save', '', '--appendonly', 'no'],
          cpu: 0.5,
          ram: 500,
          hdd: 5,
        }),
      ],
    }),
  },
  {
    id: 'three-tier',
    title: 'Three tier app',
    description: 'A web proxy, an API and a PostgreSQL database; only the web component is public.',
    lessons: ['multi-component', 'production-checklist', 'shared-database'],
    spec: app('academy-tiers', 'Web, API and database', {
      compose: [
        defaultComponent({
          name: 'web',
          description: 'nginx front end',
          repotag: 'nginx:1.27-alpine',
          ports: [31050],
          containerPorts: [80],
          domains: [''],
          cpu: 0.2,
          ram: 200,
          hdd: 2,
        }),
        defaultComponent({
          name: 'api',
          description: 'The API service',
          repotag: 'traefik/whoami:v1.10.3',
          ports: [],
          containerPorts: [],
          domains: [],
          environmentParameters: ['DB_HOST=fluxdb_academy-tiers'],
          cpu: 0.5,
          ram: 500,
          hdd: 5,
        }),
        defaultComponent({
          name: 'db',
          description: 'PostgreSQL database',
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
      ],
    }),
  },
];

export function fixtureById(id: string): FixtureSpec | undefined {
  return FIXTURES.find((f) => f.id === id);
}

/** A deep copy, safe for a UI to edit. */
export function cloneFixture(id: string): FluxAppSpec | undefined {
  const f = fixtureById(id);
  return f ? (JSON.parse(JSON.stringify(f.spec)) as FluxAppSpec) : undefined;
}
