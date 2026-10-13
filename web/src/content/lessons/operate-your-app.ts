/**
 * Lesson 10, operate-your-app: the Manage page, reading a crash loop, soft versus hard redeploys, free
 * updates, expiry and renewal, and finding where an app runs.
 *
 * Planted failure: an update that renames a component and would recreate its volume (step 3).
 *
 * Facts: docs/research/FACTS.md 4.5 and 9.5 (updates, renewal, cancel), 5 (blocks and expiry), 6.3 (health
 * and restart), 7.3 (soft and hard), 9.6 (Manage page), 10 (location API). Durations and prices in the
 * prose come from the engine in shared/flux.
 */

import {
  BLOCKS_PER_MONTH,
  blocksRemaining,
  blocksToSeconds,
  CRASH_BACKOFF_MAX_MIN,
  CRASH_BACKOFF_SEC,
  CRASH_STABLE_RUN_MIN,
  expiryHeight,
  humanDuration,
  LOCATION_TTL_MIN,
  monthsToBlocks,
  TARGET_BLOCK_SEC,
} from '@shared/flux';
import type { Lesson } from '@/learn/types';

/** The crash restart ladder after the first, immediate restart: 30 seconds, then 5, 15 and 30 minutes. */
const CRASH_FIRST_PAUSE_SEC = CRASH_BACKOFF_SEC[1] ?? 0;
const CRASH_MID_MIN = CRASH_BACKOFF_SEC.slice(2, -1)
  .map((sec) => sec / 60)
  .join(', ');

const grouped = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const span = (blocks: number): string => humanDuration(blocksToSeconds(blocks));

// Free update rate limits, in blocks (FACTS 4.5): 5 in 720, 8 in 1,440, 10 in 3,600.
const WINDOWS = [720, 1440, 3600] as const;

// Step 5 case: registered at this height with three months.
const START_HEIGHT = 3_030_000;
const THREE_MONTHS = monthsToBlocks(3);

// Checkpoint: blocks left.
const REGISTERED = 3_000_000;
const EXPIRE = monthsToBlocks(3);
const NOW = 3_100_000;
const LEFT = blocksRemaining(REGISTERED, EXPIRE, NOW);

const crashLog = [
  '09:14:02 notes-api 2.0.0 starting',
  '09:14:02 Error: DB_URL is not set',
  '09:14:02 process exited with code 1',
  '09:14:02 notes-api 2.0.0 starting',
  '09:14:02 Error: DB_URL is not set',
  '09:14:02 process exited with code 1',
  '09:14:32 notes-api 2.0.0 starting',
  '09:14:32 Error: DB_URL is not set',
  '09:14:32 process exited with code 1',
  '09:19:32 notes-api 2.0.0 starting',
  '09:19:32 Error: DB_URL is not set',
  '09:19:32 process exited with code 1',
  '09:34:32 notes-api 2.0.0 starting',
  '09:34:32 Error: DB_URL is not set',
  '09:34:32 process exited with code 1',
  '10:04:32 notes-api 2.0.0 starting',
  '',
].join('\n');

/** The notes API as a partial component. The running component is called `api`. */
const api = {
  name: 'api',
  description: 'Notes API',
  repotag: 'yourname/notes-api:2.0.0',
  ports: [31001],
  containerPorts: [3000],
  domains: [''],
  environmentParameters: ['LOG_LEVEL=info'],
  commands: [],
  containerData: '/data',
  repoauth: '',
  cpu: 0.5,
  ram: 500,
  hdd: 5,
};

const lesson: Lesson = {
  id: 'operate-your-app',
  hook: 'Launch day is the start of the job: apps crash, specs change and subscriptions end. You will read a crash loop, update an app without losing its data, see what an update costs and when a subscription ends, and find where your instances run.',
  objectives: [
    'Name the tabs of the Manage page and read a crash loop in the Logs tab.',
    'Tell a soft redeploy from a hard one, and keep an update soft.',
    'Say when an update is free and work out how many blocks a subscription has left.',
    'Find the nodes that run an app.',
  ],
  steps: [
    {
      id: 'manage',
      title: 'The control room',
      body: [
        // fact: FACTS 9.6 (menu, tabs, exact labels in order)
        'In FluxCloud, My Applications lists your apps, and each row has a Manage button. The Manage page has one tab per job: Specifications, Information, File Changes, Monitoring, Logs, Secure Shell, Control, Backup & Restore, Instances and Subscription.',
        'The simulator mirrors those labels in that order, and nothing in it touches the network. Visit each tab. Logs and Monitoring show one instance at a time, picked with the backend selector at the top, so a problem on one node can hide on another.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 9.6 (Pause Application only freezes the container; billing is the subscription)
          body: 'Pause Application in the Control tab freezes the container. It does not pause billing: the subscription keeps running until it expires or you cancel.',
        },
      ],
      stage: { kind: 'widget', id: 'fluxcloud-sim', props: { flow: 'manage' } },
      task: { kind: 'widget', prompt: 'Open the Manage page of the sample app and visit every tab.' },
    },
    {
      id: 'logs',
      title: 'Read the log first',
      body: [
        // fact: FACTS 9.6 (Log Viewer: component, line count, since, filter, copy, download)
        'The Logs tab is a log viewer: pick a component, a line count and a time window, then filter, copy or download. Read it before you change anything. This one shows a {{term:crash-loop}}: the process fails on startup because a variable is missing, and exits at once.',
        // fact: FACTS 6.3 (crash backoff ladder 0, 30 s, 5, 15, 30 min; a 10 minute run resets it), 11 row 21
        `FluxOS restarts a crashed container with growing pauses: none, then ${CRASH_FIRST_PAUSE_SEC} seconds, then ${CRASH_MID_MIN} and ${CRASH_BACKOFF_MAX_MIN} minutes. A run of ${CRASH_STABLE_RUN_MIN} minutes resets the ladder. Read the timestamps of the starting lines: that spacing is how you spot a loop.`,
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 6.3 and 11 row 20 (FluxOS ignores HEALTHCHECK, restarts exited containers)
          body: 'Only a container that exits is restarted. FluxOS does not read a Docker HEALTHCHECK, so a process that runs and returns errors is never replaced.',
        },
        {
          kind: 'tip',
          // fact: FACTS 9.6 (Secure Shell: terminal and volume browser)
          body: "Secure Shell gives you a terminal in the container and a browser for its volume. Use it to look: a change to the container's own filesystem is not part of the spec and is lost when the container is recreated, while files on the volume stay through a soft redeploy.",
        },
      ],
      stage: {
        kind: 'code',
        files: [{ name: 'logs: notes-api', lang: 'text', code: crashLog, highlight: [1, 4, 7, 10, 13, 16] }],
      },
    },
    {
      id: 'soft-hard',
      title: 'Soft or hard redeploy',
      body: [
        // fact: FACTS 7.3 and 9.5.4 (soft keeps data, hard recreates volumes, structure change escalates)
        'An {{term:app-update}} replaces the spec of a running app, and the nodes apply it one of two ways. A {{term:soft-redeploy}} recreates the containers and keeps the volumes. A {{term:hard-redeploy}} starts from nothing, so the volumes come back empty and the data is gone.',
        // fact: FACTS 9.5.4 (hard redeploy when components are added, removed or renamed, disk size changes, version upgraded)
        'FluxOS goes hard on its own when the structure changes: a component added, removed or renamed, a disk size changed or the spec version upgraded. The update in the editor renames `api` to `backend`, which makes it a new component.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 9.5.4 (the review step warns before payment), 7.4 (a local backup is a file inside the volume; no weekly scheduler in the source read)
          body: 'FluxCloud warns "This update will trigger a hard redeploy" in the review step, before you pay. Back up first, in the Backup & Restore tab, and download the file or send it to FluxDrive: a local backup sits inside the volume on that node, so a hard redeploy deletes it with the data. The tab says weekly backups are automatic, but the source read has no weekly scheduler, so do not count on one.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'notes',
          description: 'A small notes API',
          instances: 3,
          compose: [{ ...api, name: 'backend' }],
        },
        editable: ['compose[0].name', 'compose[0].repotag'],
        focus: [
          {
            path: 'compose[0].name',
            note: 'The running component is called api. A different name is a different component.',
          },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Set the image to `yourname/notes-api:2.1.0` and keep the name `api`.',
        hint: 'The image tag is a soft change: the containers are recreated and the volume is kept. The component name is part of the structure, so a new name is a hard redeploy that empties the volume.',
        check: {
          all: [
            {
              path: 'compose[0].name',
              op: 'eq',
              value: 'api',
              message:
                'The running component is called `api`. Another name is a new component: the old one is removed with its data.',
            },
            {
              path: 'compose[0].repotag',
              op: 'eq',
              value: 'yourname/notes-api:2.1.0',
              message: 'Set the image to the new tag, `yourname/notes-api:2.1.0`.',
            },
          ],
        },
        solution: { compose: [{ name: 'api', repotag: 'yourname/notes-api:2.1.0' }] },
      },
    },
    {
      id: 'free-updates',
      title: 'Some updates cost nothing',
      body: [
        // fact: FACTS 4.5 (free update conditions), 9.5.4 (changing image, env or commands is free)
        'The network offers a {{term:free-update}} with conditions. It keeps the same number of instances, the same static IP setting, the same number of pinned nodes and the same number of components, gives no component more CPU, RAM or disk, adds no restricted port, and extends the subscription by 8 blocks or fewer. Changing an image tag, a variable or a command fits all of that.',
        // fact: FACTS 4.5 (rate limits 5 in 720, 8 in 1440, 10 in 3600 blocks)
        `Free updates are rationed, and the windows are counted in blocks: about 5 in ${grouped(WINDOWS[0])} blocks, 8 in ${grouped(WINDOWS[1])} and 10 in ${grouped(WINDOWS[2])}, which is ${span(WINDOWS[0])}, ${span(WINDOWS[1])} and ${span(WINDOWS[2])} at ${TARGET_BLOCK_SEC} seconds a block. The code states these windows in block units from before Proof of Node, so treat the clock times as rough. Any other update costs the new total minus a credit for the unused part of the old subscription.`,
      ],
      stage: {
        kind: 'compare',
        left: {
          label: 'Free update',
          tone: 'good',
          body: 'The same number of instances, components and pinned nodes, and the same static IP setting. No more CPU, RAM or disk, no restricted port added, and at most 8 blocks of extra life.',
        },
        right: {
          label: 'Charged update',
          tone: 'bad',
          body: 'A different number of instances (fewer is not free either), a changed static IP setting, more CPU, RAM or disk, a restricted port, a longer subscription, or more free updates than the window allows.',
        },
      },
    },
    {
      id: 'renewal',
      title: 'Time, expiry and renewal',
      body: [
        // fact: FACTS 5.2 and 5.4 (expiry height, no grace, removal and data loss), 9.6 (Subscription tab warns in the last week)
        `A subscription ends at an {{term:expiry-height}}: the height of the latest register or update message plus {{term:expire}}. There is no grace period: once the chain passes that height the app leaves the list, and nodes uninstall it with its volumes and data. The Subscription tab warns you in the last week.`,
        // fact: FACTS 4.5 and 5.4 (renewal is an update with a higher expire, credit, one year maximum)
        `{{term:renewal}} is an update that raises \`expire\`: you pay the new total minus a credit for the unused time, up to one year in total. An app registered at block ${grouped(START_HEIGHT)} with a 3 month subscription, which is ${grouped(THREE_MONTHS)} blocks or about ${span(THREE_MONTHS)}, expires at which height?`,
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 9.5.4 (cancel: no charge, no refund, app and data removed)
          body: 'Cancel is final. It needs a signature, charges nothing, refunds nothing, and removes the app and its data.',
        },
      ],
      stage: {
        kind: 'widget',
        id: 'block-converter',
        props: { case: { kind: 'expiry-height', value: THREE_MONTHS, startHeight: START_HEIGHT } },
      },
      task: {
        kind: 'widget',
        prompt: `Work out the height at which the app registered at block ${grouped(START_HEIGHT)} expires.`,
      },
    },
    {
      id: 'where',
      title: 'Where is it running?',
      body: [
        // fact: FACTS 9.6 (Instances tab), 10 E24 (location rows), 6.1 row 12 (records valid 125 minutes)
        'Your instances run on nodes you can name. The Instances tab of a running app lists each node address with its continent, country and region, and marks the primary of an app with a `g:` volume. The public API gives the same list: `/apps/location/<name>` returns one {{term:location}} record per running instance.',
        `The {{lab:explorer}} does that lookup for any app on the network, with a map. Records are refreshed every hour and stay valid for ${LOCATION_TTL_MIN} minutes, so a node that has just failed can still be listed for a while. Look up a real app and read where its instances run.`,
      ],
      stage: { kind: 'diorama', scene: 'network', live: true },
      task: {
        kind: 'confirm',
        label: 'I looked up an app in the App Explorer',
        prompt: 'Open the App Explorer, look up a real app and read where its instances run.',
      },
    },
  ],
  checkpoint: [
    {
      id: 'update-order',
      kind: 'order',
      prompt: 'Put the steps of updating an app in FluxCloud in order.',
      items: [
        { id: 'open', label: 'Open the Subscription tab of the app and choose Update' },
        { id: 'edit', label: 'Change the spec, for example the image tag' },
        { id: 'validate', label: 'Review: the spec is validated and the total cost shows, or Free update' },
        { id: 'sign', label: 'Sign the update message' },
        { id: 'pay', label: 'Pay if the update is not free, then the nodes redeploy' },
      ],
      // fact: FACTS 9.4.4 (review rows), 9.5.4 (update flow and free update label), 9.6 (Subscription tab)
      explain:
        'The review comes before the signature so you see the cost and any hard redeploy warning first. A free update skips the payment, and the nodes apply the change after it.',
      hint: 'You choose the action, change the spec, see what it costs, sign, and only then pay.',
    },
    {
      id: 'blocks-left',
      kind: 'estimate',
      prompt: `An app was registered at block ${grouped(REGISTERED)} with an expire of ${grouped(EXPIRE)} blocks. The chain is at block ${grouped(NOW)}. How many blocks does it have left?`,
      quantity: 'blocks',
      value: LEFT,
      tolerance: 0.02,
      unit: 'blocks',
      // fact: FACTS 5.2 (expiry height = message height + expire)
      explain: `It expires at block ${grouped(expiryHeight(REGISTERED, EXPIRE))}, so ${grouped(LEFT)} blocks remain, about ${span(LEFT)}.`,
      hint: 'Add expire to the registration height to get the expiry height, then subtract the height the chain is at now.',
    },
    {
      id: 'hard-redeploy-data',
      kind: 'choice',
      prompt: "An update triggers a hard redeploy. What happens to the data on the app's plain volume?",
      options: [
        {
          id: 'kept',
          label: 'It is kept, because volumes always survive an update',
          why: 'That describes a soft redeploy. A hard one removes the volume with the containers.',
        },
        { id: 'deleted', label: 'It is deleted and the volume is recreated empty' },
        {
          id: 'moved',
          label: 'It is moved to the node that takes over',
          why: 'Plain volumes are never copied between nodes by a redeploy.',
        },
        {
          id: 'restored',
          label: 'It is restored from the last backup',
          why: 'A redeploy does not restore backups. You restore one yourself, and a local backup is a file inside the same volume, so a hard redeploy removes it too. Only a copy you downloaded or sent to FluxDrive survives.',
        },
      ],
      answer: 'deleted',
      // fact: FACTS 7.3 (hard recreates the volume), 9.6 (Hard Reinstall wording)
      explain:
        'A hard redeploy removes and recreates the application, volumes included. Back up first, or keep the update soft.',
      hint: 'Recall the two words from the Control tab: one keeps existing data, the other removes and redeploys everything.',
    },
    {
      id: 'action-effect',
      kind: 'match',
      prompt: 'Match each action to what it does to the app.',
      pairs: [
        { id: 'restart', left: 'Restart Application', right: 'The containers restart on the same volumes' },
        { id: 'soft', left: 'Soft Reinstall', right: 'The app is redeployed and its data is kept' },
        { id: 'hard', left: 'Hard Reinstall', right: 'The volumes are recreated and the data is deleted' },
        {
          id: 'cancel',
          left: 'Cancel the subscription',
          right: 'The app is removed from the network with its data',
        },
      ],
      // fact: FACTS 9.6 (Control tab strings), 9.5.4 (cancel)
      explain:
        'Restart and soft reinstall keep your data. Hard reinstall and cancel do not, and neither can be undone.',
      hint: 'Sort the four by what survives: one keeps the volume untouched, one keeps data through a redeploy, and two delete it.',
    },
  ],
  recap: [
    `Read the Logs tab first: a crash loop shows the same error at ${CRASH_FIRST_PAUSE_SEC} second, ${CRASH_MID_MIN} and ${CRASH_BACKOFF_MAX_MIN} minute spacing.`,
    'A soft redeploy keeps volumes. A hard one deletes them, and a renamed, added or removed component or a new disk size forces it.',
    'Changing an image tag, a variable or a command is a free update, within a rationed number of updates per window.',
    `A subscription ends at its message height plus expire, with no grace. A month is ${grouped(BLOCKS_PER_MONTH)} blocks, and renewal is an update that raises expire.`,
    'The Instances tab and the public location API list the nodes that run an app.',
  ],
  further: [
    {
      label: 'FluxCloud docs: managing a running app',
      url: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app',
    },
    {
      label: 'FluxCloud docs: the Control tab, soft and hard reinstall',
      url: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/control',
    },
    {
      label: 'FluxCloud docs: subscription, renewal and updates',
      url: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/subscription',
    },
  ],
  terms: [
    'soft-redeploy',
    'hard-redeploy',
    'renewal',
    'app-update',
    'crash-loop',
    'free-update',
    'expiry-height',
  ],
};

export default lesson;
