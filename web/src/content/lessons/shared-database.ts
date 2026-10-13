/**
 * Stratus 4: A database that follows your app.
 *
 * Arc: one draft with three faults (an open database port, data that will not follow the app, a host name
 * that points nowhere) fixed one per step; then the failure the design exists for; then what it is not.
 *
 * Facts: FACTS 8.2 (container names, no public port needed between components, bare component name is only
 * the container's hostname), 7.2 and 6.4 (g: single writer, only the primary runs, re-election takes a delay
 * of minutes), 3.3 (allowed component keys: no start-order field), 9.4.3 (min 2 instances with synced
 * storage), 9.6 (Instances tab string), 9.9.4 (Shared DB, DOCS-ONLY), 7.1 (live mount counts), 8.3 (the
 * spec is public). Guidance, not Flux guarantees: that a single writer engine belongs on `g:` and not on
 * `r:` (FACTS 11 rows 14 and 15), and that the newest writes can be missing after a failover.
 */

import { BAKED_PRICING, FDM_FAILOVER, G_STANDBY_WAIT_MIN_PER_POSITION } from '@shared/flux';
import type { Lesson } from '@/learn/types';

/** The date of the rate card the budget in the checkpoint is graded against. */
const RATES_DATE = BAKED_PRICING.capturedAt;

/** The web component of the shop front. Env and ports vary per step, so the base keeps them neutral. */
const web = {
  name: 'web',
  description: 'Storefront',
  repotag: 'acme/shopfront:1.6.0',
  repoauth: '',
  ports: [31600],
  containerPorts: [3000],
  domains: [''],
  environmentParameters: ['DB_HOST=db', 'DB_PORT=5432'],
  commands: [],
  containerData: '/tmp',
  cpu: 0.5,
  ram: 500,
  hdd: 5,
};

/** The database component as the draft has it: published port and a plain volume. */
const dbDraft = {
  name: 'db',
  description: 'Orders database',
  repotag: 'postgres:16-alpine',
  repoauth: '',
  ports: [5432],
  containerPorts: [5432],
  domains: [''],
  environmentParameters: ['POSTGRES_PASSWORD=change-me'],
  commands: [],
  containerData: '/var/lib/postgresql/data',
  cpu: 0.5,
  ram: 1000,
  hdd: 10,
};

/** The same component with the port closed. */
const dbPrivate = { ...dbDraft, ports: [], containerPorts: [], domains: [] };

const lesson: Lesson = {
  id: 'shared-database',
  hook: 'Here is a shop front and its Postgres, written in a hurry with three faults. You will fix them one at a time, then kill the node the database runs on and see what the design gives you and what it cannot.',
  objectives: [
    'Put a database in the same app as a component with no public port, and wire the app to it by its container name.',
    'Choose the volume and instance count that let a single-writer database survive losing its node.',
    'Explain what failover costs this design in downtime and in capacity, and what it is not.',
  ],
  steps: [
    {
      id: 'two-components',
      title: 'A database is a private component',
      body: [
        'The shop front and its database are two containers, and on Flux they belong in one app, each as its own {{term:component}}. Components of one app share a private network, so the web container can reach the database without the database being on the internet.',
        'The one rule is about `ports`. Whatever is listed there is opened on the node address, on every node that runs an instance. A database should list nothing. This draft has three faults and the issues panel lists them all; fix them one per step, starting with the open port.',
      ],
      callouts: [
        {
          // fact: FACTS 8.2 (use the container port between components; no need to expose it in ports), 3.4 (ports are bound on the node)
          kind: 'gotcha',
          body: 'Do not publish the database port just for debugging. A published port is open to the whole internet on every node that runs an instance. Nothing between components needs `ports`.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'shopfront',
          description: 'Online shop',
          instances: 1,
          compose: [web, dbDraft],
        },
        editable: ['compose[1].ports', 'compose[1].containerPorts', 'compose[1].domains'],
        focus: [
          {
            path: 'compose[1].ports',
            note: 'This publishes the database on the public address of the node.',
          },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Close the database to the outside: leave its public ports empty.',
        hint: 'Empty the database component ports, its container ports and its domains. The three lists pair by position, so they stay the same length.',
        check: {
          all: [
            { path: 'compose[1].ports', op: 'empty', message: 'The database still publishes a port.' },
            {
              lint: 'absent',
              codes: ['DATABASE_PORT_PUBLIC', 'PORT_LENGTH_MISMATCH', 'DOMAINS_LENGTH_MISMATCH'],
              message: 'The ports, container ports and domains lists have to stay the same length.',
            },
          ],
        },
        solution: { compose: [{}, { ports: [], containerPorts: [], domains: [] }] },
      },
    },
    {
      id: 'data-on-g',
      title: 'Data that follows the app',
      body: [
        'The database keeps its files in a folder, and that folder has to outlive its node. A plain volume dies with the node, and `r:` would let every instance write the same database files. The usual guidance for a single-writer engine is {{term:primary-standby}}, written `g:`: one elected primary runs, and standbys hold synced copies. Postgres keeps its data in `/var/lib/postgresql/data`, so that is the path to mount.',
        'Add the prefix, then give the copies somewhere to go. A synced volume needs at least two instances, and every instance is billed, standbys included.',
      ],
      callouts: [
        {
          // fact: FACTS 11 row 15 and SB-10 (g: is priced like any other volume; the 20 percent g: discount does not exist)
          kind: 'cost',
          body: 'A standby is billed like any other instance, and `g:` adds nothing to the price by itself. Redundancy costs instances, nothing else.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'shopfront',
          description: 'Online shop',
          instances: 1,
          compose: [web, dbPrivate],
        },
        editable: ['compose[1].containerData', 'instances'],
        focus: [
          { path: 'compose[1].containerData', note: 'A plain path: the data stays on one node.' },
          { path: 'instances', note: 'One instance leaves a synced volume with no copy to hold.' },
        ],
        show: ['form', 'issues', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: 'Put the data folder on a `g:` volume and run at least two instances.',
        hint: 'The prefix goes in front of the same path. The issues panel names the single-instance problems until you add a second instance.',
        check: {
          all: [
            {
              path: 'compose[1].containerData',
              op: 'matches',
              value: '^g:/var/lib/postgresql/data$',
              message: 'Prefix the Postgres data folder with `g:` and keep the path.',
            },
            { path: 'instances', op: 'gte', value: 2, message: 'Run at least two instances.' },
            {
              lint: 'absent',
              codes: [
                'STATEFUL_NO_VOLUME',
                'STATEFUL_NOT_SYNCED',
                'STATEFUL_SINGLE_INSTANCE',
                'SYNC_SINGLE_INSTANCE',
              ],
            },
          ],
        },
        solution: { instances: 2, compose: [{}, { containerData: 'g:/var/lib/postgresql/data' }] },
      },
    },
    {
      id: 'wire-it',
      title: 'Wire the web component to it',
      body: [
        // fact: FACTS 8.2 and 3.8 (container name flux<component>_<app>; bare component name is only the container's own hostname)
        "Docker resolves other containers by name, and Flux names every container `flux<component>_<app>`. The database component is `db` in the app `shopfront`, so its address is `fluxdb_shopfront`, on its container port. The bare component name is only the container's own hostname and is not a documented way to reach another component.",
        // fact: FACTS 8.3 (the spec is public unless enterprise)
        'The web component learns the address from an environment variable, and this one points at `db`. Fix it. The spec is public, so a real password does not belong in it: {{lesson:env-and-secrets}} shows where one goes.',
      ],
      callouts: [
        {
          kind: 'tip',
          body: 'The next lesson, {{lesson:multi-component}}, takes the naming rules apart. For now the pattern is the whole of it: flux, the component name, an underscore, the app name.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'shopfront',
          description: 'Online shop',
          instances: 2,
          compose: [web, { ...dbPrivate, containerData: 'g:/var/lib/postgresql/data' }],
        },
        editable: ['compose[0].environmentParameters'],
        focus: [
          {
            path: 'compose[0].environmentParameters',
            note: 'DB_HOST has to be the database container name.',
          },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Set `DB_HOST` to the container name of the database.',
        hint: 'flux, then the component name, an underscore and the app name, with nothing else added: the port is in DB_PORT.',
        check: {
          path: 'compose[0].environmentParameters',
          op: 'includes',
          value: 'DB_HOST=fluxdb_shopfront',
          message:
            'DB_HOST has to be fluxdb_shopfront: the prefix flux, the component db, an underscore and the app shopfront.',
        },
        solution: { compose: [{ environmentParameters: ['DB_HOST=fluxdb_shopfront', 'DB_PORT=5432'] }, {}] },
      },
    },
    {
      id: 'break-it',
      title: 'Kill the primary',
      body: [
        // fact: FACTS 7.2 and 6.4 (the election starts and stops only the g: component; non-g components keep running on every instance node; FDM sends every port to the primary node; 3 failed checks and 90 s, election every 30 s, a standby waits about 3 minutes per place), 9.6 (Instances tab string), 3.3 (no start-order field)
        'Now the failure the design exists for. The primary node runs the database, and its standbys hold a synced copy of the database folder. Kill the primary node and watch a standby take over. The figure puts the copies on different continents so you can tell them apart, which the network does not promise.',
        'The election starts and stops only the component with `g:`, so here only the database moves. The web component is not stopped on the standbys: it keeps running on every instance, but the load balancer sends every port of the app to the primary node. A standby is elected and starts the database from its synced copy.',
        `The v8 spec has no field that orders component starts, so the web container on that node may be waiting for a database that is not up yet, and it has to retry. Be straight about the gap: the load balancer moves away only after at least ${FDM_FAILOVER.minFailedChecks} failed checks and ${FDM_FAILOVER.minUnhealthySec} seconds, and a standby can wait about ${G_STANDBY_WAIT_MIN_PER_POSITION} minutes per place in the order. On the real network that is minutes, not seconds, and FluxCloud shows 'Defining New Primary In Progress' meanwhile.`,
      ],
      callouts: [
        {
          // fact: FACTS 6.4 and 7.2 (the load balancer's backend lists exactly one server, the elected primary; standbys are not in it)
          kind: 'why',
          body: 'The standbys are insurance, not capacity. While the primary is healthy it serves all the traffic, so more instances here buy safety and not speed.',
        },
        {
          // inference: file sync is asynchronous (FACTS 7.2 describes r: as eventually consistent); no measured lag is published
          kind: 'gotcha',
          body: 'Standby copies arrive by file sync, which is not instant, so the newest writes can be missing after a failover. That is design inference, not a measured figure.',
        },
      ],
      stage: {
        kind: 'diorama',
        scene: 'sync',
        instances: 2,
        controls: ['kill', 'revive'],
      },
      task: {
        kind: 'kill-nodes',
        count: 1,
        prompt: 'Kill the primary node and watch the standby take over.',
      },
    },
    {
      id: 'limits',
      title: 'What this is not',
      body: [
        'What you built is a single database with a spare, not a cluster. That is the right size for many apps and the wrong one for others: it has one writer, it is down while a new primary is elected, and it cannot spread reads across instances.',
        // fact: FACTS 9.9.4 (Shared DB: docs only; MySQL supported, MongoDB and PostgreSQL in progress; clients connect on port 3307; master-slave cluster)
        "Flux's docs describe a heavier option called Shared DB: a MySQL component plus an operator component that keeps a master and replicas, with clients connecting through the operator on port 3307. It is documented for MySQL only, and this course has not verified it end to end, so treat the docs as the source.",
      ],
      callouts: [
        {
          // fact: FACTS 7.1 live usage (316 of 1,097 components visible in plain specs have a g: primary mount, FACTS Snapshot re-read 2026-10-13)
          kind: 'wild',
          body: 'At the time of writing, more than a quarter of the components visible in public specs mount a `g:` volume. It is the most common synced mount, ahead of `r:` and `s:`.',
        },
      ],
      stage: {
        kind: 'compare',
        left: {
          label: 'A database on g:',
          tone: 'good',
          body: 'One writer, one running database and synced standbys. A stock image and no extra components. A new primary takes a delay of minutes, and the newest writes may be missing.',
        },
        right: {
          label: 'Shared DB, as documented',
          tone: 'neutral',
          body: 'A MySQL component and an operator that runs a master with replicas, reached on port 3307. Documented for MySQL only. Not verified here.',
        },
      },
    },
  ],
  checkpoint: [
    {
      id: 'box-office',
      kind: 'spec-build',
      prompt:
        'A box office runs a tickets API and needs a database beside it. Add a MariaDB component named db and meet every line of the brief.',
      spec: {
        name: 'boxoffice',
        description: 'Ticket box office',
        instances: 1,
        compose: [
          {
            name: 'api',
            description: 'Tickets API',
            repotag: 'acme/tickets-api:3.1.0',
            repoauth: '',
            ports: [31700],
            containerPorts: [8080],
            domains: [''],
            environmentParameters: [],
            commands: [],
            containerData: '/tmp',
            cpu: 0.5,
            ram: 500,
            hdd: 5,
          },
        ],
      },
      requirements: [
        {
          id: 'two-components',
          label: 'The app has a database component as well as the API',
          check: { path: 'compose.length', op: 'gte', value: 2 },
        },
        {
          id: 'mariadb-pinned',
          label: 'The database image is MariaDB with a version tag, not latest',
          check: { path: 'compose[*].repotag', op: 'matches', value: '^mariadb:[0-9]' },
        },
        {
          id: 'private',
          label: 'The database port is not published',
          check: { lint: 'absent', codes: ['DATABASE_PORT_PUBLIC'] },
        },
        {
          id: 'data-on-g',
          label: 'MariaDB keeps its data in /var/lib/mysql on a g: volume',
          check: { path: 'compose[*].containerData', op: 'matches', value: '^g:/var/lib/mysql$' },
        },
        {
          id: 'standby',
          label: 'At least two instances, so a standby exists',
          check: { path: 'instances', op: 'gte', value: 2 },
        },
        {
          id: 'wired',
          label: 'The API gets DB_HOST set to the database container name',
          check: {
            path: 'compose[*].environmentParameters',
            op: 'includes',
            value: 'DB_HOST=fluxdb_boxoffice',
          },
        },
        {
          id: 'no-secret',
          label:
            'No real password in the public spec: use the placeholder change-me. For a real deployment the password goes in an enterprise (encrypted) spec, see {{lesson:env-and-secrets}}',
          check: { lint: 'absent', codes: ['ENV_SECRET_PUBLIC'] },
        },
        {
          id: 'budget',
          label: `Costs less than USD 2 a month, at the rates read on ${RATES_DATE}`,
          check: { price: 'max', usd: 1.99 },
        },
      ],
      solution: {
        instances: 2,
        compose: [
          { environmentParameters: ['DB_HOST=fluxdb_boxoffice'] },
          {
            name: 'db',
            description: 'MariaDB',
            repotag: 'mariadb:11.4',
            repoauth: '',
            ports: [],
            containerPorts: [],
            domains: [],
            environmentParameters: ['MARIADB_ROOT_PASSWORD=change-me'],
            commands: [],
            containerData: 'g:/var/lib/mysql',
            cpu: 0.5,
            ram: 1000,
            hdd: 10,
          },
        ],
      },
      explain:
        'The database is a second component with no public ports, its data folder sits on g: so a standby can take over, and two instances give it one. The API reaches it by container name, and the budget fits two instances but not three.',
      hint: 'Work through the checklist top to bottom. MariaDB keeps its data in /var/lib/mysql, its container is flux, then db, an underscore and the app name, and the price chip shows what a third instance would cost.',
    },
    {
      id: 'notes-three-faults',
      kind: 'spec-fix',
      prompt:
        'This notes app has the same three faults as the shop front draft, in a different dress. Fix them so the database is private, its data follows the app and the web component can find it.',
      spec: {
        name: 'notes',
        description: 'Team notes',
        instances: 1,
        compose: [
          {
            name: 'web',
            description: 'Notes web app',
            repotag: 'acme/notes:0.9.4',
            repoauth: '',
            ports: [31800],
            containerPorts: [4000],
            domains: [''],
            environmentParameters: ['DB_HOST=db', 'DB_PORT=3306'],
            commands: [],
            containerData: '/tmp',
            cpu: 0.5,
            ram: 500,
            hdd: 5,
          },
          {
            name: 'db',
            description: 'Notes database',
            repotag: 'mysql:8.4',
            repoauth: '',
            ports: [3306],
            containerPorts: [3306],
            domains: [''],
            environmentParameters: ['MYSQL_ROOT_PASSWORD=change-me'],
            commands: [],
            containerData: '/var/lib/mysql',
            cpu: 0.5,
            ram: 1000,
            hdd: 10,
          },
        ],
      },
      check: {
        all: [
          { lint: 'absent', codes: ['DATABASE_PORT_PUBLIC'] },
          { path: 'compose[*].containerData', op: 'matches', value: '^g:/var/lib/mysql$' },
          { path: 'instances', op: 'gte', value: 2 },
          { path: 'compose[*].environmentParameters', op: 'includes', value: 'DB_HOST=fluxdb_notes' },
          {
            lint: 'absent',
            codes: ['STATEFUL_NOT_SYNCED', 'STATEFUL_SINGLE_INSTANCE', 'SYNC_SINGLE_INSTANCE'],
          },
        ],
      },
      solution: {
        instances: 2,
        compose: [
          { environmentParameters: ['DB_HOST=fluxdb_notes', 'DB_PORT=3306'] },
          { ports: [], containerPorts: [], domains: [], containerData: 'g:/var/lib/mysql' },
        ],
      },
      explain:
        'The database port was published to the whole internet, its data was on a plain volume that would die with the node and the single instance had no standby, and DB_HOST named the bare component instead of the container flux, db, underscore, notes.',
      hint: 'Check three places: the database component ports, its containerData with the instance count, and the DB_HOST value on the web component.',
    },
    {
      id: 'host-name',
      kind: 'choice',
      prompt:
        'The app `shopfront` has components `web` and `db`. What does the web component use to reach the database?',
      options: [
        { id: 'container', label: '`fluxdb_shopfront`, on the database container port' },
        {
          id: 'bare',
          label: '`db`',
          why: "That is only the database container's own hostname. It is not a documented way for another component to reach it.",
        },
        {
          id: 'public',
          label: '`shopfront.app.runonflux.io`',
          why: 'That is the public address, and it points at the first published port, which belongs to the web component.',
        },
        {
          id: 'localhost',
          label: '`localhost`',
          why: 'Each component is a separate container, so localhost is the web container itself.',
        },
      ],
      answer: 'container',
      explain:
        'Flux names each container flux, the component, an underscore and the app. Components reach each other by that name over the private network, on the container port, and nothing needs to be published.',
      hint: 'The pattern is flux, then the component name, an underscore, then the app name.',
    },
    {
      id: 'failover-order',
      kind: 'order',
      prompt: 'The primary node of a `g:` app loses power. Put the recovery in order.',
      items: [
        { id: 'dark', label: 'The primary node stops answering and the load balancer checks start failing' },
        {
          id: 'gap',
          label:
            'No primary is running, the app is down and FluxCloud shows that a new primary is being defined',
        },
        { id: 'elect', label: 'A standby is elected primary' },
        { id: 'start', label: 'The database starts on the standby from its synced copy of the data' },
        {
          id: 'retry',
          label: 'The web component retries until the database accepts connections, and traffic resumes',
        },
      ],
      explain:
        'There is a real gap between the primary dying and a new one running, which is why the app has to retry and why this design suits services that can wait a few minutes.',
      hint: 'Nothing can start on the standby until it has been elected, and nothing serves traffic until the database answers.',
    },
  ],
  recap: [
    'A database is a component of the same app with no public ports. Components reach each other by container name over the private network.',
    "The container name is flux, the component name, an underscore and the app name. The bare component name is only the container's own hostname.",
    'A single-writer engine goes on `g:` with at least two instances: one primary runs and standbys hold synced copies.',
    'The election starts and stops only the `g:` component, so the database moves while the web component keeps running on every instance. All traffic goes to the primary node, and a new primary takes minutes, so the app must retry. Standbys are insurance, not extra capacity.',
    'This is a single database with a spare, not a multi-writer cluster. The newest writes can be missing after a failover.',
  ],
  further: [
    {
      label: 'FluxCloud docs: the shared database component',
      url: 'https://docs.runonflux.com/fluxcloud/shared-database/component',
    },
    {
      label: 'FluxCloud docs: components and the container data path',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
    },
  ],
  terms: ['component', 'primary-standby'],
};

export default lesson;
