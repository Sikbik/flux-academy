/**
 * Stratus 7: Production checklist and capstone.
 *
 * Arc: the image, what Flux does and does not restart, the guard rails of a spec, state decided before
 * shipping, the clock with no grace period, then a client brief built line by line.
 *
 * Facts: FACTS 3.3 (5 GB image cap), 6.3 (restart ladder, no HEALTHCHECK, image recheck every 6 hours),
 * 6.1 and 2.4 (deferrals: bigger specs place slower), 7.3 (hdd is fixed; hard redeploy on growth; log size;
 * permissions caveat, UNVERIFIED), 4.3 and 4.4 (fees, cliff, duration discounts), 5.4 and 11 row 25 (no
 * grace, renewal, Stripe auto-renewal), 3.2 (contacts public unless enterprise), 9.4.3 (UI strings).
 * Every price and duration below is computed from `shared/flux` at module load (quote, monthsToBlocks), at
 * the baked rate card, so the prose cannot drift from the engine.
 *
 * Deliberately not asked of the learner: enterprise. FACTS 3.5 notes that FluxCloud's docs say geolocation
 * is not offered with Enterprise (the validator has no such rule), and nothing in FACTS says how FDM learns
 * custom domains from an encrypted compose, so the capstone brief keeps the app public and says so.
 */

import type { FluxAppSpec } from '@shared/flux';
import {
  BAKED_PRICING,
  BLOCKS_PER_MONTH,
  CRASH_BACKOFF_MAX_MIN,
  CRASH_BACKOFF_SEC,
  CRASH_STABLE_RUN_MIN,
  DURATION_DISCOUNTS,
  defaultComponent,
  defaultSpec,
  HW_DISCOUNTS,
  IMAGE_RECHECK_HOURS,
  LIMITS,
  monthsToBlocks,
  quote,
  SPAWN_DEFERRAL_MIN,
  TARGET_BLOCK_SEC,
} from '@shared/flux';
import type { Lesson } from '@/learn/types';

/** The crash restart ladder after the first, immediate restart: 30 seconds, then 5, 15 and 30 minutes. */
const CRASH_IMMEDIATE_SEC = CRASH_BACKOFF_SEC[0] ?? 0;
const CRASH_FIRST_PAUSE_SEC = CRASH_BACKOFF_SEC[1] ?? 0;
const CRASH_MID_MIN = CRASH_BACKOFF_SEC.slice(2, -1)
  .map((sec) => sec / 60)
  .join(', ');

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

// ---------------------------------------------------------------------------------------------------
// The client and the finished spec. Prices below are computed from this one definition.
// ---------------------------------------------------------------------------------------------------

const APP = 'lanternpress';
const DOMAIN = 'read.example.com';
const CONTACT = 'press@example.com';
const BUDGET_USD = 1.99;
const TERM_BLOCKS = monthsToBlocks(3);
/** The date of the rate card every price in this lesson is computed from. */
const RATES_DATE = BAKED_PRICING.capturedAt;

// The sum the `state` step teaches: 1,500 covers a year at 4 MB, three years, half again as headroom.
const COVERS_PER_YEAR = 1500;
const COVER_MB = 4;
const COVER_YEARS = 3;
const HEADROOM = 1.5;
const GB_PER_YEAR = (COVERS_PER_YEAR * COVER_MB) / 1000;
const DISK_GB = GB_PER_YEAR * COVER_YEARS * HEADROOM;

const webFinal = part({
  name: 'web',
  description: 'Reader site',
  repotag: 'acme/lantern-press:4.2.0',
  ports: [31700],
  containerPorts: [3000],
  domains: [DOMAIN],
  environmentParameters: [`CACHE_HOST=fluxcache_${APP}`],
  containerData: 'r:/data',
  cpu: 0.5,
  ram: 500,
  hdd: DISK_GB,
});

const cacheFinal = part({
  name: 'cache',
  description: 'Page cache',
  repotag: 'redis:7.4-alpine',
  cpu: 0.3,
  ram: 300,
  hdd: 1,
});

/** Monthly USD for the finished app with a patch applied, from the engine at the baked rate card. */
function priceOf(patch: Partial<FluxAppSpec> = {}, compose: Part[] = [webFinal, cacheFinal]): number {
  const spec: FluxAppSpec = {
    ...defaultSpec(),
    name: APP,
    instances: 3,
    ...patch,
    compose: compose.map((c) => defaultComponent(c)),
  };
  return quote(spec, BAKED_PRICING.params, { months: 1 }).usdPerMonth;
}

/** The whole subscription and the monthly figure for it, from the engine at the baked rate card. */
function termOf(months: number, hdd: number = DISK_GB): { total: number; perMonth: number } {
  const spec: FluxAppSpec = {
    ...defaultSpec(),
    name: APP,
    instances: 3,
    compose: [{ ...webFinal, hdd }, cacheFinal].map((c) => defaultComponent(c)),
  };
  const q = quote(spec, BAKED_PRICING.params, { months });
  return { total: q.usdTotal ?? q.usdPerMonth * months, perMonth: q.usdPerMonth };
}

const usd = (n: number): string => `USD ${n.toFixed(2)}`;

const P_FINAL = priceOf();
const P_ONE = priceOf({ instances: 1 });
const P_FOUR = priceOf({ instances: 4 });
const P_STATIC = priceOf({ staticip: true });
const P_FEE = priceOf({}, [{ ...webFinal, ports: [8080] }, cacheFinal]);
const P_DRAFT_SIZE = priceOf({}, [{ ...webFinal, cpu: 1, ram: 1000, hdd: 10 }, cacheFinal]);
const P_DISK_SMALL = priceOf({}, [{ ...webFinal, hdd: 5 }, cacheFinal]);
const P_DISK_BIG = priceOf({}, [{ ...webFinal, hdd: DISK_GB }, cacheFinal]);

// What a longer term does to the finished app, and to the same app with a small disk. The point of the
// `term` step: the total is rounded up to .49 or .99 after the percentage comes off, so check the total.
const T_ONE = termOf(1);
const T_THREE = termOf(3);
const T_NINE = termOf(9);
const T_TWELVE = termOf(12);
const T_SMALL_ONE = termOf(1, 5);
const T_SMALL_THREE = termOf(3, 5);

// Size lines, from the engine's own table of small-app discounts and the network's image limit.
const sizeLine = (tier: { maxCpu: number; maxRam: number; maxHdd: number } | undefined): string =>
  tier ? `${tier.maxCpu} cores, ${tier.maxRam / 1000} GB of RAM and ${tier.maxHdd} GB of disk` : 'its size';
const smallLine = sizeLine(HW_DISCOUNTS[0]);
const mediumLine = sizeLine(HW_DISCOUNTS[1]);
const IMAGE_LIMIT_GB = LIMITS.repotag.maxImageBytes / 1_000_000_000;

const discount = (months: number): string =>
  DURATION_DISCOUNTS.find((d) => d.minMonths === months)?.label ?? 'a discount';

// ---------------------------------------------------------------------------------------------------
// Dockerfiles for the compare stage
// ---------------------------------------------------------------------------------------------------

const BAD_DOCKERFILE = [
  'FROM node:latest',
  'WORKDIR /app',
  'COPY . .',
  'RUN npm install',
  'CMD ["node", "server.js"]',
].join('\n');

const GOOD_DOCKERFILE = [
  'FROM node:22-alpine AS build',
  'WORKDIR /app',
  'COPY package*.json ./',
  'RUN npm ci',
  'COPY . .',
  'RUN npm run build',
  '',
  'FROM node:22-alpine',
  'WORKDIR /app',
  'COPY --from=build /app/dist ./dist',
  'COPY --from=build /app/node_modules ./node_modules',
  'USER node',
  'ENV HOST=0.0.0.0 PORT=3000',
  'EXPOSE 3000',
  'CMD ["node", "dist/server.js"]',
].join('\n');

const lesson: Lesson = {
  id: 'production-checklist',
  hook: 'A spec that registers is not yet a spec you would trust with customers. You will walk the image, the spec, the state and the clock with a checklist, then build a complete spec to a client brief, one live requirement at a time.',
  objectives: [
    'Prepare an image for Flux: pinned, small, amd64, bound to 0.0.0.0, logging to standard output and exiting when it is broken.',
    'Apply the guard rails of a production spec: instances, geolocation, no needless fees, a size that fits most nodes and a contact.',
    'Choose a volume prefix and a disk size before shipping, and a term that cannot lapse unnoticed.',
    'Turn a written brief into a valid spec and say what each requirement does to the price.',
  ],
  steps: [
    {
      id: 'image',
      title: 'The image is part of the deployment',
      body: [
        // fact: FACTS 6.3 and 11 row 19 (image recheck every 6 hours), 3.3 and 11 row 5 (5 GB cap), 6.1 row 11 (the pull dominates install time)
        `Flux runs the image you name and nothing else, so what makes an image dependable matters more here than on a laptop. Pin the tag: nodes check the registry every ${IMAGE_RECHECK_HOURS} hours, so a moving tag such as \`latest\` can change under a running app. Keep it small: every new node pulls it before it can serve, and the network refuses an image over ${IMAGE_LIMIT_GB} GB in total.`,
        // fact: FACTS 7.3 (json-file logging, 4 files, about 20 MB total unless log shipping), 11 row 4 (amd64; an arm64-only image registers and then starves, only enterprise apps are refused for it), 8.1 (bind 0.0.0.0)
        'Build for `linux/amd64`, which nearly every node runs. An image built only for arm64, the default on a laptop with Apple silicon, still registers, then starves: at the time of writing a handful of nodes can run it. Bind `0.0.0.0` and say so explicitly. Write logs to standard output: Flux keeps a few files of about 20 MB in total per container unless you ship them elsewhere. Compare the two Dockerfiles.',
      ],
      callouts: [
        {
          // fact: FACTS 7.3 and 11 row 31 (permissions: non-root images may need their own chown on the volume; user-level behaviour UNVERIFIED)
          kind: 'gotcha',
          title: 'Non-root and volumes',
          body: 'Running as a non-root user is good practice, and the volume is where it can bite: if the app cannot write its volume folder, the cause may be file ownership. The exact behaviour is not verified, so write a file to the volume on first start and test it.',
        },
      ],
      stage: {
        kind: 'compare',
        left: {
          label: 'Works on a laptop',
          tone: 'bad',
          lang: 'dockerfile',
          code: BAD_DOCKERFILE,
          body: 'A moving tag, build tools and every dev dependency in the final image, and no stated bind address.',
        },
        right: {
          label: 'Ready for Flux',
          tone: 'good',
          lang: 'dockerfile',
          code: GOOD_DOCKERFILE,
          body: 'A pinned tag, a second stage that ships only the build output, a non-root user and an explicit bind address.',
        },
      },
    },
    {
      id: 'no-healthcheck',
      title: 'Flux restarts what exits, not what hangs',
      body: [
        // fact: FACTS 6.3 and 11 rows 20 and 21 (no HEALTHCHECK, restart policy no, ladder 0, 30 s, 5, 15, 30 min, 10 min stable run resets)
        `FluxOS does not read a Docker {{term:healthcheck}}. A container counts as healthy while it is running, and its restart policy is \`no\`, so FluxOS does the restarting itself: after a crash it waits ${CRASH_IMMEDIATE_SEC} seconds, then ${CRASH_FIRST_PAUSE_SEC} seconds, then ${CRASH_MID_MIN} and ${CRASH_BACKOFF_MAX_MIN} minutes, and a run of ${CRASH_STABLE_RUN_MIN} minutes without a crash resets the ladder.`,
        // fact: FACTS 6.4 (the load balancer only checks that the port accepts a connection)
        'A process that hangs but keeps running therefore stays where it is. The load balancer drops an instance that stops accepting connections, but one that accepts and answers every request with an error passes its check. Make the process exit when it is broken, and keep three instances so that one wedged copy is not the whole app.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          body: `A start-up crash heals slowly: restarts are spaced ${CRASH_FIRST_PAUSE_SEC} seconds, then ${CRASH_MID_MIN} and ${CRASH_BACKOFF_MAX_MIN} minutes. A wrong \`commands\` entry can keep an instance down for a long stretch before anyone notices.`,
        },
      ],
      stage: { kind: 'diagram', id: 'failure-modes', beat: 0 },
    },
    {
      id: 'guard-rails',
      title: 'Guard rails in the spec',
      body: [
        'Most production mistakes are defaults nobody revisited: a moving tag, a single instance, a port that carries a fee, a fee for a fixed address nothing needs, and a size that rules out most nodes. The issues panel and the price chip show every one of them in this draft.',
        // fact: FACTS 2.4 (delay table: Stratus waits 87 minutes before a medium app) and 11 row 26 (large apps fit only Nimbus and Stratus)
        `That last one is easy to miss. An app bigger than a Cumulus node can offer fits only the fewer Nimbus and Stratus nodes, and Stratus nodes wait about ${SPAWN_DEFERRAL_MIN.stratusMediumApp} minutes before taking an app of medium size (under ${mediumLine}). Size to what the app needs, and stay under the line (${smallLine}) unless it truly cannot.`,
      ],
      callouts: [
        {
          kind: 'cost',
          body: `At the rates read on ${RATES_DATE}, the finished app with one instance would cost ${usd(P_ONE)} a month and with three ${usd(P_FINAL)}. Each fee is added to the monthly bundle, which is divided by 3 and billed per instance, so a fee port such as 8080 would put three instances at ${usd(P_FEE)}, and a static IP at ${usd(P_STATIC)}.`,
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: APP,
          description: 'Lantern Press reader site',
          instances: 1,
          staticip: true,
          compose: [
            {
              ...webFinal,
              repotag: 'acme/lantern-press:latest',
              ports: [8080],
              domains: [''],
              environmentParameters: [],
              containerData: '/tmp',
              cpu: 4,
              ram: 8000,
              hdd: 20,
            },
          ],
        },
        editable: [
          'instances',
          'staticip',
          'compose[0].repotag',
          'compose[0].ports',
          'compose[0].cpu',
          'compose[0].ram',
          'compose[0].hdd',
        ],
        focus: [
          { path: 'instances', note: 'One instance: the node going down takes the app with it.' },
          { path: 'staticip', note: 'A fee for a fixed address that nothing here needs.' },
          { path: 'compose[0].repotag', note: 'A moving tag. Pin a version.' },
          {
            path: 'compose[0].ports',
            note: 'Public port 8080 carries a fee. Any port in the 31000 range does not.',
          },
          {
            path: 'compose[0].cpu',
            note: 'Bigger than a Cumulus node offers. A reader site needs far less.',
          },
        ],
        show: ['form', 'price', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt:
          'Pin the tag, run three instances, drop the static IP, move off the fee port and size the app to fit a Cumulus node.',
        hint: 'Work down the issues panel. The image has a version, 4.2.0. Any public port in the 31000 range is free, and half a core with 500 MB of RAM is plenty for this site.',
        check: {
          all: [
            {
              lint: 'absent',
              codes: [
                'IMAGE_LATEST',
                'IMAGE_UNTAGGED',
                'PORT_FEE',
                'SIZE_EXCLUDES_CUMULUS',
                'SIZE_NEEDS_STRATUS',
                'INSTANCES_ONE',
              ],
              message: 'The issues panel still lists one of the guard rails.',
            },
            { path: 'instances', op: 'gte', value: 3, message: 'Run at least three instances.' },
            {
              path: 'staticip',
              op: 'eq',
              value: false,
              message: 'Nothing here needs a fixed address: turn the static IP off.',
            },
          ],
        },
        solution: {
          instances: 3,
          staticip: false,
          compose: [{ repotag: 'acme/lantern-press:4.2.0', ports: [31700], cpu: 0.5, ram: 500, hdd: 5 }],
        },
      },
    },
    {
      id: 'state',
      title: 'Decide state before you ship',
      body: [
        // fact: FACTS 7.3 and 11 rows 16 and 17 (hdd is fixed; growing it is a hard redeploy), 7.2 (r: for data that tolerates replication)
        `Disk is the cheapest line on the price and the most painful to grow, because a bigger \`hdd\` is an update that recreates the volume. So size it once, with headroom, and choose the prefix in the same sitting. The press uploads about ${COVERS_PER_YEAR.toLocaleString('en-US')} covers a year at ${COVER_MB} MB each, and the folder has to hold three years of them with half again as much headroom.`,
        'Covers are files that tolerate replication, so `r:` suits them: every instance serves them, and a lost node does not take the files with it as long as another instance already holds a current copy. A cover that has not synced yet is lost with its node. Work the sum before you type the size.',
      ],
      callouts: [
        {
          kind: 'cost',
          body: `At the rates read on ${RATES_DATE}, going from 5 GB to ${DISK_GB} GB of disk moves the monthly price of the finished app from ${usd(P_DISK_SMALL)} to ${usd(P_DISK_BIG)}. The expensive mistake is a disk that fills.`,
        },
        {
          kind: 'gotcha',
          body: 'Back up before any update that grows a disk or changes components: both are hard redeploys. {{lesson:persistent-storage}} shows where the backup tab is.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: APP,
          description: 'Lantern Press reader site',
          instances: 3,
          compose: [{ ...webFinal, containerData: '/data', hdd: 5, environmentParameters: [] }],
        },
        editable: ['compose[0].containerData', 'compose[0].hdd'],
        focus: [
          {
            path: 'compose[0].containerData',
            note: 'A plain path: one volume per instance, lost with its node.',
          },
          {
            path: 'compose[0].hdd',
            note: 'Fixed when the volume is created. Growing it later recreates it.',
          },
        ],
        show: ['form', 'price', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt:
          'Make `/data` a replicated volume and size the disk for three years of covers with half again as headroom.',
        hint: `${COVERS_PER_YEAR.toLocaleString('en-US')} covers at ${COVER_MB} MB is ${GB_PER_YEAR} GB a year. Three years is ${GB_PER_YEAR * COVER_YEARS} GB, and half again is ${DISK_GB} GB. The prefix goes in front of the path.`,
        check: {
          all: [
            {
              path: 'compose[0].containerData',
              op: 'matches',
              value: '^r:/data$',
              message: 'Put the prefix `r:` in front of `/data`.',
            },
            {
              path: 'compose[0].hdd',
              op: 'gte',
              value: DISK_GB,
              message: `Too small: ${COVERS_PER_YEAR.toLocaleString('en-US')} covers of ${COVER_MB} MB is ${GB_PER_YEAR} GB a year, three years is ${GB_PER_YEAR * COVER_YEARS} GB, and half again is ${DISK_GB} GB.`,
            },
          ],
        },
        solution: { compose: [{ containerData: 'r:/data', hdd: DISK_GB }] },
      },
    },
    {
      id: 'no-grace',
      title: 'The clock has no grace period',
      body: [
        // fact: FACTS 5.2 and 5.4 (expire counts blocks from the latest register or update; expiry sweep; containers, volumes and data removed; the name is freed)
        `A subscription is a block count, {{term:expire}}, paid up front and counted from the block of the latest register or update. A month is ${BLOCKS_PER_MONTH.toLocaleString('en-US')} blocks of about ${TARGET_BLOCK_SEC} seconds. When it runs out nothing waits: the app drops from the network list, nodes uninstall it, its containers, volumes and data are removed, and the name is free for anyone to register.`,
        // fact: FACTS 5.4 and 9.6 (renewal adds time on top of what remains; Stripe auto-renewal for cards; the UI warns under a week)
        'Two habits cover it. Renew early: the Subscription tab in FluxCloud shows "Expires in under a week" once less than a week is left, and a {{term:renewal}} adds time on top of what remains. And keep a contact: the field is described as the address for expiry notices, though who sends them was not verified. Card payers can turn on auto-renewal through Stripe, while a subscription paid in FLUX is renewed by hand.',
      ],
      stage: { kind: 'diagram', id: 'block-clock', beat: 3 },
    },
    {
      id: 'term',
      title: 'Pay for a term you can defend',
      body: [
        // fact: FACTS 4.4 and 5.3 (duration discounts 3, 6 and 12 percent on the whole price; max one year)
        `Longer terms take ${discount(3)} off the whole price at three months, ${discount(6)} at six and ${discount(9)} at nine or more, and they give you runway before a missed renewal becomes an outage. But the total is then rounded up to a price ending .49 or .99, and for a small app that can swallow the saving. Check the total, not the percentage.`,
        `At the rates read on ${RATES_DATE}, this app is ${usd(T_ONE.total)} for one month and ${usd(T_THREE.total)} for three, and nine months is ${usd(T_NINE.total)} (${usd(T_NINE.perMonth)} a month) and twelve is ${usd(T_TWELVE.total)} (${usd(T_TWELVE.perMonth)} a month). With a 5 GB disk it would be ${usd(T_SMALL_ONE.total)} for one month and ${usd(T_SMALL_THREE.total)} for three (${usd(T_SMALL_THREE.perMonth)} a month), where three single months come to ${usd(3 * T_SMALL_ONE.total)}. Set this app to three months, which is ${TERM_BLOCKS.toLocaleString('en-US')} blocks, and give it a contact.`,
        'The price panel shows a monthly figure for the whole term, and under it what you pay up front. Contacts are published with a public spec, so use a role address that you do not mind anyone reading.',
      ],
      callouts: [
        {
          // fact: FACTS 3.2 and lint CONTACTS_PUBLIC (contacts are public unless the app is enterprise)
          kind: 'gotcha',
          body: 'Any address in `contacts` can be read by anyone who fetches the spec, unless the app is enterprise. Pick one you are happy to publish.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: APP,
          description: 'Lantern Press reader site',
          instances: 3,
          compose: [webFinal, cacheFinal],
        },
        editable: ['expire', 'contacts'],
        focus: [
          { path: 'expire', note: 'A number of blocks. A month is the default.' },
          {
            path: 'contacts',
            note: 'Meant for expiry notices; who sends them was not verified. Published with a public spec.',
          },
        ],
        show: ['form', 'price', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: `Set the term to three months (${TERM_BLOCKS.toLocaleString('en-US')} blocks) and add \`${CONTACT}\` as a contact.`,
        hint: 'Three months is three times the month length shown in the field. The contact goes in the contacts list as a plain address.',
        check: {
          all: [
            {
              path: 'expire',
              op: 'gte',
              value: TERM_BLOCKS,
              message: `Three months is ${TERM_BLOCKS.toLocaleString('en-US')} blocks.`,
            },
            {
              path: 'contacts',
              op: 'includes',
              value: CONTACT,
              message: `Add ${CONTACT} to the contacts.`,
            },
          ],
        },
        solution: { expire: TERM_BLOCKS, contacts: [CONTACT] },
      },
    },
  ],
  checkpoint: [
    {
      id: 'expiry-sequence',
      kind: 'order',
      prompt: 'A subscription is not renewed. Put what happens to the app in order.',
      items: [
        { id: 'height', label: 'The chain passes the height where the subscription ends' },
        { id: 'sweep', label: 'A sweep that runs every few blocks removes the app from the network list' },
        { id: 'notice', label: 'Nodes see that the app is no longer listed' },
        { id: 'remove', label: 'They uninstall it: the containers, the volumes and the data are removed' },
        { id: 'name', label: 'The app name becomes free for anyone to register' },
      ],
      explain:
        'There is no grace period at any step. Nothing is kept for you, and a backup you downloaded or sent to FluxDrive is the only copy of the data that is left. Backups held on a node go with the node and with the app.',
      hint: 'Start with the chain reaching the end of the subscription and finish with what is left once the nodes have cleaned up.',
    },
    {
      id: 'surprise-bill',
      kind: 'estimate',
      prompt:
        'A hurried colleague drafted this app. Read the spec and estimate what it costs per month, in USD.',
      spec: {
        name: APP,
        description: 'Draft',
        instances: 4,
        staticip: true,
        compose: [
          {
            ...webFinal,
            ports: [8080],
            domains: [''],
            environmentParameters: [],
            containerData: '/tmp',
            cpu: 1,
            ram: 1000,
            hdd: 10,
          },
          cacheFinal,
        ],
      },
      quantity: 'usd-per-month',
      tolerance: 0.1,
      unit: 'USD',
      explain: `Two flat fees go on the base before it is divided by three: the static IP and the fee port. A fourth instance then removes the small app discount. At the rates read on ${RATES_DATE}, the finished app costs ${usd(P_FINAL)} a month, and the same sizes as the draft with three instances and no fees would have cost ${usd(P_DRAFT_SIZE)}.`,
      hint: 'Add the cores, the RAM and the disk of both components, price them, add the two flat fees, divide by three and multiply by four. Four instances get no small app discount.',
    },
    {
      id: 'lantern-press',
      kind: 'spec-build',
      prompt:
        'Lantern Press, a small independent publisher, is moving its reader site to Flux. The managing editor writes: "If one server dies on a Friday night I do not want a phone call, and I want a bill I can explain." Build the spec its brief asks for.',
      spec: {
        name: APP,
        description: 'Lantern Press reader site',
        instances: 1,
        compose: [
          part({
            name: 'web',
            description: 'Reader site',
            repotag: 'acme/lantern-press:latest',
            ports: [8080],
            containerPorts: [3000],
            domains: [''],
            containerData: '/data',
            cpu: 1,
            ram: 1000,
            hdd: 10,
          }),
        ],
      },
      requirements: [
        {
          id: 'three',
          label: `Three or more instances, so any one node can fail. Each instance is billed: at the rates read on ${RATES_DATE}, one costs ${usd(P_ONE)} and three cost ${usd(P_FINAL)}.`,
          check: { path: 'instances', op: 'gte', value: 3 },
        },
        {
          id: 'places',
          label:
            'Allowed in Europe and North America only, and Russia forbidden. This costs nothing and narrows the pool.',
          check: {
            all: [
              { path: 'geolocation', op: 'includes', value: 'acEU' },
              { path: 'geolocation', op: 'includes', value: 'acNA' },
              { path: 'geolocation', op: 'includes', value: 'a!cEU_RU' },
              { path: 'geolocation.length', op: 'lte', value: 3 },
            ],
          },
        },
        {
          id: 'only-web',
          label: `Only web publishes a port, and not a fee port: 8080 would put the price at ${usd(P_FEE)}. The cache has no ports.`,
          check: {
            all: [
              { path: 'compose[0].ports', op: 'len>=', value: 1 },
              { path: 'compose[1].ports', op: 'empty' },
              { lint: 'absent', codes: ['PORT_FEE', 'PORT_BANNED', 'DATABASE_PORT_PUBLIC'] },
            ],
          },
        },
        {
          id: 'wired',
          label: `The page cache is a second component named cache, and web gets CACHE_HOST=fluxcache_${APP}`,
          check: {
            all: [
              { path: 'compose[1].name', op: 'eq', value: 'cache' },
              {
                path: 'compose[0].environmentParameters',
                op: 'matches',
                value: `^CACHE_HOST=fluxcache_${APP}$`,
              },
            ],
          },
        },
        {
          id: 'uploads',
          label:
            'Editors upload cover images to /data, and they should survive a node loss as long as another instance holds a current copy: a replicated r: volume. The volume is priced by its disk size, not by its prefix.',
          check: { path: 'compose[0].containerData', op: 'matches', value: '^r:/data$' },
        },
        {
          id: 'disk',
          label: `Room for three years of covers: ${COVERS_PER_YEAR.toLocaleString('en-US')} a year at ${COVER_MB} MB with half again as headroom, which is ${DISK_GB} GB of disk on web. Growing a disk later is a hard redeploy.`,
          check: { path: 'compose[0].hdd', op: 'gte', value: DISK_GB },
        },
        {
          id: 'domain',
          label: `The reader site answers on ${DOMAIN}, listed on the web port. Naming a domain is free, and the site only answers there once you add a CNAME at your DNS provider (see {{lesson:custom-domains}}).`,
          check: {
            all: [
              { path: 'compose[0].domains[0]', op: 'eq', value: DOMAIN },
              { lint: 'absent', codes: ['DOMAINS_LENGTH_MISMATCH'] },
            ],
          },
        },
        {
          id: 'pinned',
          label:
            'Both images are pinned: acme/lantern-press at 4.2.0 and Redis with a version tag, so nothing changes under the app',
          check: {
            all: [
              { path: 'compose[0].repotag', op: 'eq', value: 'acme/lantern-press:4.2.0' },
              { path: 'compose[1].repotag', op: 'matches', value: '^redis:[0-9]' },
              { lint: 'absent', codes: ['IMAGE_LATEST', 'IMAGE_UNTAGGED'] },
            ],
          },
        },
        {
          id: 'term',
          label: `Paid for three months, ${TERM_BLOCKS.toLocaleString('en-US')} blocks, which is ${usd(T_THREE.total)} up front for this app after ${discount(3)} comes off and the total is rounded up, and ${CONTACT} as the contact for expiry notices`,
          check: {
            all: [
              { path: 'expire', op: 'gte', value: TERM_BLOCKS },
              { path: 'contacts', op: 'includes', value: CONTACT },
            ],
          },
        },
        {
          id: 'budget',
          label: `Under USD 2.00 a month with web keeping at least half a core and 500 MB. At the rates read on ${RATES_DATE}, the draft sizes would be ${usd(P_DRAFT_SIZE)}; a fourth instance ${usd(P_FOUR)}; a static IP ${usd(P_STATIC)}.`,
          check: {
            all: [
              { price: 'max', usd: BUDGET_USD },
              { path: 'compose[0].cpu', op: 'gte', value: 0.5 },
              { path: 'compose[0].ram', op: 'gte', value: 500 },
            ],
          },
        },
      ],
      solution: {
        instances: 3,
        geolocation: ['acEU', 'acNA', 'a!cEU_RU'],
        contacts: [CONTACT],
        expire: TERM_BLOCKS,
        compose: [
          {
            repotag: 'acme/lantern-press:4.2.0',
            ports: [31700],
            containerPorts: [3000],
            domains: [DOMAIN],
            environmentParameters: [`CACHE_HOST=fluxcache_${APP}`],
            containerData: 'r:/data',
            cpu: 0.5,
            ram: 500,
            hdd: DISK_GB,
          },
          cacheFinal,
        ],
      },
      explain:
        'Every line is a habit from this track: a count that survives a node, a policy written as a list, one public door on a port that carries no fee, an internal name for the cache, a volume sized to three years of covers, a pinned image and a term with a contact. The two fees you left off, and the fourth instance you did not add, are what kept it under budget.',
      hint: 'Take the lines from the top. The draft is too big and on the wrong port, and Redis is a second component with no public ports. The container name of the cache is flux, the component name, an underscore and the app name.',
    },
  ],
  recap: [
    'An image for Flux is pinned, small, built for amd64, bound to 0.0.0.0 and logging to standard output. Flux restarts what exits, not what hangs.',
    'The guard rails are defaults you revisit: three instances, a pinned tag, no static IP, no fee port and a size that fits most nodes.',
    'Size the disk and choose the prefix before shipping: growing a volume later is a hard redeploy, so back up first.',
    'A subscription ends without grace. Renew early, keep a contact that is safe to publish, and compare the total for a term, not the percentage: rounding up to .49 or .99 can erase the saving.',
    'Every line of a brief maps to a field of the spec and to a line of the price. Read both.',
  ],
  further: [
    {
      label: 'FluxCloud docs: subscription, renewal and cancellation',
      url: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/subscription',
    },
    {
      label: 'FluxCloud docs: backup and restore',
      url: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/backup-and-restore',
    },
    {
      label: 'Docker docs: multi-stage builds',
      url: 'https://docs.docker.com/build/building/multi-stage/',
    },
  ],
  terms: ['healthcheck'],
};

export default lesson;
