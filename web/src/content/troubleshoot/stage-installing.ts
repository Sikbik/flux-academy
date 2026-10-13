/**
 * Stage 3: installing. After payment, before the app answers: placement, deferrals, image pulls.
 *
 * The timeline comes from FACTS 6.1 (the thirteen steps) and 6.2 (who decides where instances go).
 * Quoted numbers (151 of 2,078 apps below their requested instances) are the 2026-10-12 snapshot.
 */

import { ORBIT_FACTS } from '@shared/flux';
import { api, both, cmd, docs, fix, fixSh, forge, live, look, src } from './build';
import { FIGURES as F } from './figures';
import type { Cause, Symptom } from './types';

/**
 * An image that is only arm64. A public app with one passes validation and registers (arm64 is an accepted
 * architecture), then stays short of running instances because almost no node can run it. Enterprise apps
 * are refused instead, and that case lives on the validation page. FACTS 11 row 4 says to teach it as
 * "registers but starves".
 */
const ARM64_ONLY: Cause = {
  id: 'arm64-only-image',
  title: 'The image was built for arm64 only',
  why: 'A public app with an arm64-only image passes validation and registers, because arm64 is an accepted architecture. Almost every node is amd64, and every ArcaneOS node is, so only the few arm64 nodes can run it (7 at the 2026-10-12 snapshot). The app registers, then stays short of running instances, or has none.',
  likelihood: 'possible',
  checks: [
    cmd(
      'List the platforms the pushed image provides',
      'docker buildx imagetools inspect user/app:1.0.0',
      'If `linux/amd64` is missing from the `Platform:` lines, this is it.',
    ),
    api(
      'location',
      'Few rows, or none, for an app that registered a good while ago fits an image almost no node can run.',
    ),
  ],
  fixes: [
    fixSh(
      'Rebuild for amd64, or for both, push it under a new tag and update the app to that tag.',
      'docker buildx build --platform linux/amd64,linux/arm64 -t user/app:1.0.1 --push .',
    ),
  ],
  proof: both('11 row 4; 3.7; 2.6', 'The count of arm64 nodes is the 2026-10-12 snapshot.'),
  lessons: ['containers-101'],
  terms: ['amd64', 'image'],
};

export const INSTALLING_SYMPTOMS: Symptom[] = [
  {
    id: 'app-stuck-installing',
    stage: 'installing',
    title: 'My app is stuck: still installing, or it never starts',
    summary: 'You paid and registered. There is no running instance and no working address yet.',
    seen: [
      'Installing for a long time',
      'Deployment time: Up to 45 min after payment',
      'No instance listed',
      'The app address does not answer yet',
    ],
    keywords: [
      'stuck',
      'installing',
      'not starting',
      'never starts',
      'deploying',
      'pending',
      'waiting',
      'how long',
      'no instances',
      'not running',
      'deployment time',
    ],
    quick: `FluxCloud says deployment takes up to ${F.deployEstimateMin} minutes after payment. That is its estimate, not a guarantee. A node usually starts installing within ${F.installStartUsual} minutes, a big image or a narrow placement rule adds time, and bigger nodes wait before they take a small app, so a copy can take about two hours. If it is still not running after ${F.deployEstimateMin} minutes, check these in order.`,
    causes: [
      {
        id: 'inside-window',
        title: 'It is still inside the time FluxCloud estimates, or a little past it',
        why: `The next block (about ${F.blockSec} seconds) links your payment to the spec. Each node then decides on its own timer whether to take the app: usually within ${F.installStartUsual} minutes, but a node that is large for a small app waits ${F.spawnRange} minutes first, so small apps are first picked up by the small nodes. Pulling the image is often the longest step. The ${F.deployEstimateMin} minutes on the FluxCloud screen is an estimate, and a copy can take about two hours.`,
        likelihood: 'usual',
        checks: [
          look(
            'Note the time you paid. The FluxCloud screen says "Up to 45 min after payment". That is an estimate, not a guarantee.',
          ),
          api(
            'location',
            'Each row is a running instance. An empty `data` list means no node has announced one yet.',
          ),
          api(
            'installing',
            'Nodes in `data` are installing your app right now. An empty list is normal outside an install.',
          ),
        ],
        fixes: [
          fix(
            `Give it the ${F.deployEstimateMin} minutes the screen estimates, and expect that it can take longer: bigger nodes wait ${F.spawnList} minutes before they take a small app, and a copy takes longer still when few nodes qualify. Do not pay again while the app shows as registered.`,
          ),
        ],
        proof: src('6.1; 9.5.1; 2.4'),
        lessons: ['how-apps-run'],
        terms: ['spawner', 'location'],
      },
      {
        id: 'not-confirmed',
        title: 'The network has not recorded a paid registration',
        why: 'The app is only in the global list once a payment with its hash is confirmed in a block. Without that, no node will ever try to install it.',
        likelihood: 'common',
        checks: [
          api(
            'appspec',
            '`Application: {app} not found` means there is no confirmed registration under that name.',
          ),
          api('messages', 'A `fluxappregister` entry with your hash and a `height` means it was confirmed.'),
        ],
        fixes: [
          fix(
            'Follow the checks for a payment that is not recognised. If a confirmed `fluxappregister` is listed, do not pay again. If you paid and nothing was matched, FluxCloud says refunds are not automatic and that you must open a support ticket to request one: keep the transaction id and the registration hash to hand, and ask before you pay a second time.',
          ),
        ],
        proof: src('6.1 steps 7 and 8; 11 row 22; 9.0 row 7'),
        see: ['payment-not-recognised'],
        lessons: ['how-apps-run'],
        terms: ['registration-message'],
      },
      {
        id: 'narrow-placement',
        title: 'Few nodes qualify for this spec',
        why: `A static IP, a narrow geolocation or a large spec leaves only a subset of nodes able to take the app, and nodes that are too big for a small app defer for ${F.spawnRange} minutes. Large apps fit only the largest nodes.`,
        likelihood: 'common',
        checks: [
          api(
            'placement',
            'Find your continent and countries and look at `nodes`. A small number means a small pool.',
          ),
          forge('See what the linter says about a static IP and a large spec', {
            fixture: 'hello-world',
            patch: { staticip: true, compose: [{ cpu: 10, ram: 20000, hdd: 100 }] },
            shows: ['STATICIP_COST', 'SIZE_NEEDS_STRATUS'],
          }),
        ],
        fixes: [
          fix(
            `Drop \`staticip\` unless you need it. To fit most Cumulus nodes keep the app under ${F.cumulusCpu} cores, ${F.cumulusRam} MB of RAM and about ${F.cumulusHdd} GB of disk (the rule that makes bigger nodes wait for a small app uses ${F.discountSmall}). Widen \`geolocation\`.`,
          ),
        ],
        proof: src('11 row 26; 6.1 step 10; 2.4'),
        lint: [
          'STATICIP_COST',
          'SIZE_EXCLUDES_CUMULUS',
          'SIZE_NEEDS_STRATUS',
          'GEO_ONE_REGION',
          'INSTANCES_EXCEED_NODES',
        ],
        lessons: ['geo-placement', 'resources-pricing'],
        terms: ['eligible-node', 'static-ip', 'geolocation'],
      },
      ARM64_ONLY,
      {
        id: 'image-pull',
        title: 'The image is large or the registry is slow',
        why: 'The Docker pull is the dominant cost of an install and ranges from seconds to tens of minutes. Every node that tries pulls its own copy.',
        likelihood: 'possible',
        checks: [
          api('installing', 'A node listed here for a long time is still pulling.'),
          cmd(
            'Size up the image',
            'docker image ls user/app',
            'Several gigabytes unpacked means a slow pull.',
          ),
        ],
        fixes: [
          fix(
            `Slim the image with a multi-stage build and a small base. Use an exact tag rather than \`latest\`: FluxOS is set to re-check the registry about every ${F.imageRecheckHours} hours for a changed image under the same tag (read from source, not observed live).`,
          ),
        ],
        proof: src('6.1 step 11'),
        see: ['image-too-big'],
        lessons: ['containers-101', 'production-checklist'],
        terms: ['image'],
      },
      {
        id: 'install-errors',
        title: 'Nodes try and fail with the same reason',
        why: 'When an install fails, the node broadcasts the reason. One failure on one node is normal, and another node tries. We have seen one example reason, insufficient space, and have not catalogued the others. Reading the same reason from many nodes as a sign of a problem in the spec is our inference.',
        likelihood: 'possible',
        checks: [
          api(
            'install-errors',
            'Each row has a node `ip` and an `error` string, for example "Insufficient space on Flux Node".',
            'Recent install failures for your app',
          ),
        ],
        fixes: [
          fix(
            'Read the reason on each row. If most nodes report that they have no space, check how much `hdd` the spec asks for. If it names a policy, see the blocklist cause on the image page.',
          ),
        ],
        proof: live(
          '10.6.4 E26',
          'The endpoint and the example reason were observed live. What the other reasons say, and what repeats of one reason mean, was not catalogued.',
        ),
        see: ['image-not-found'],
        lessons: ['how-apps-run'],
      },
    ],
    lessons: ['how-apps-run', 'geo-placement'],
    labs: ['explorer', 'network'],
    related: ['fewer-instances-than-requested', 'payment-not-recognised', 'url-502-503'],
    lint: ['STATICIP_COST', 'SIZE_NEEDS_STRATUS'],
  },

  {
    id: 'fewer-instances-than-requested',
    stage: 'installing',
    title: 'Only some of my instances are running',
    summary:
      'You asked for three and see one or two, or the instance count never reaches the number you set.',
    seen: [
      '3 requested, 1 or 2 running',
      'Fewer nodes in the instances list',
      'An app below its requested instances',
    ],
    keywords: [
      'fewer instances',
      'some instances',
      'only one instance',
      'not all instances',
      'instances missing',
      'below requested',
      'placement',
      'not enough nodes',
    ],
    quick: `Fewer copies than requested happens for a while after deploying, and for specs with narrow rules. On 2026-10-12, 151 of 2,078 apps on the network ran fewer copies than they asked for, and 96 ran none. That count includes apps that were still being deployed. It also includes apps that will never run: on ${ORBIT_FACTS.orbitOneInstanceNotRunning.readOn}, ${ORBIT_FACTS.orbitOneInstanceNotRunning.value} apps with no copy were Orbit deployments whose owners are on the network blocklist, which nodes refuse to run.`,
    causes: [
      {
        id: 'still-placing',
        title: 'The network is still placing them',
        why: `Every node decides alone, from the same public list, and announces its claim. Instances arrive one by one, and nodes that are too big for a small app wait ${F.spawnList} minutes before they join in.`,
        likelihood: 'usual',
        checks: [api('location', 'Count the rows. Run it again in ten minutes and compare.')],
        fixes: [
          fix(
            'Wait before you change the spec: a copy can take about two hours, and longer when few nodes qualify, because the larger nodes wait before they take a small app. Raising resources is a priced update. An update that only lowers CPU or RAM is free, but changing the disk size recreates the volume (a hard redeploy).',
          ),
        ],
        proof: src('6.1; 6.2; 2.4; 4.5'),
        lessons: ['how-apps-run'],
        terms: ['spawner', 'instance'],
      },
      {
        id: 'small-pool',
        title: 'Fewer eligible nodes than instances',
        why: 'Geolocation, static IP, pinned nodes and size all shrink the pool of nodes that may take your app. Registration is refused when the rules leave some eligible nodes but fewer than your instance count. A node whose location the network could not resolve still counts as eligible, so the number is larger than a count by country suggests. A list that leaves no node at all is accepted, and nothing is promised to run. A synced app with more instances than fault domains is accepted too, with a warning only in the node log.',
        likelihood: 'common',
        checks: [
          api('placement', 'Count nodes in the countries you allow.'),
          forge('See the lint for more instances than nodes allowed', {
            fixture: 'hello-world',
            patch: { instances: 20, geolocation: ['acEU_DE_BY'] },
            shows: ['GEO_ONE_REGION'],
          }),
        ],
        fixes: [
          fix(
            'Widen `geolocation`, remove `staticip`, or ask for fewer instances. A node installs only an app it qualifies for, so the copies you can get are limited by the nodes that qualify.',
          ),
        ],
        proof: src('3.5; 6.2'),
        lint: ['INSTANCES_EXCEED_NODES', 'GEO_ONE_REGION', 'STATICIP_COST'],
        lessons: ['geo-placement'],
        terms: ['eligible-node', 'geolocation'],
      },
      ARM64_ONLY,
      {
        id: 'fault-domains',
        title: 'Synced storage limits instances per hosting organisation',
        why: 'For apps with `r:`, `g:` or `s:` volumes the spawner caps instances per fault domain (a hosting organisation, else an allocation block, else a /16 network), so replicas land in different places.',
        likelihood: 'possible',
        checks: [look('Check whether `containerData` starts with `r:`, `g:` or `s:`.')],
        fixes: [fix('Ask for fewer instances, or widen geolocation so more fault domains qualify.')],
        proof: src('6.2'),
        lessons: ['persistent-storage', 'geo-placement'],
        terms: ['container-data'],
      },
      {
        id: 'node-lost',
        title: 'A node went away and the replacement has not started',
        why: `When a node disappears its location record stays for up to ${F.locationTtlMin} minutes, and the replacement spawns after that, plus the image pull. Synced apps can wait up to about ${F.syncedExtraMin} minutes longer.`,
        likelihood: 'possible',
        checks: [
          api(
            'location',
            `Each row has \`broadcastedAt\` and \`expireAt\`. A row that is not refreshed disappears about ${F.locationTtlMin} minutes after the node went quiet.`,
          ),
        ],
        fixes: [
          fix('Wait it out, and plan for fewer copies than you asked for. Size the app for N minus 1.'),
        ],
        proof: src('6.3; 6.5'),
        lessons: ['redundancy-failover'],
        terms: ['n-minus-1', 'failover'],
      },
      {
        id: 'port-test-failures',
        title: 'Nodes drop the app after a port test fails',
        why: 'Nodes test each other’s published ports. A node whose test fails enters a state that removes apps with unreachable ports. Nothing in your spec causes it, and the instance respawns elsewhere.',
        likelihood: 'rare',
        checks: [
          look('Watch whether the same node IP appears, disappears and appears again in the location list.'),
        ],
        fixes: [
          fix(
            'Nothing to change in the spec: the cause is the network of that node. If many different nodes drop the same app, it is worth checking that the container listens on 0.0.0.0 and on its container port. We have not verified that this is what the test looks at.',
          ),
        ],
        proof: src('11 row 32; 6.3', 'The consequence was read in source and not live tested.'),
        see: ['instance-vanished'],
      },
    ],
    lessons: ['geo-placement', 'redundancy-failover'],
    labs: ['explorer', 'network'],
    related: ['app-stuck-installing', 'single-instance-down'],
    lint: ['INSTANCES_EXCEED_NODES'],
  },

  {
    id: 'instance-vanished',
    stage: 'installing',
    title: 'An instance appeared, then disappeared',
    summary: 'A node listed your app, and a little later it was gone from the list.',
    seen: [
      'An instance disappears after it installs',
      'Remove Application',
      'A node IP flickers in the list',
    ],
    keywords: [
      'instance disappeared',
      'instance removed',
      'node dropped app',
      'port test',
      'dos',
      'remove application',
      'surplus copies',
    ],
    quick:
      'A node that fails its port test, or that lost a race for the same slot, drops its copy and another node takes over. Both are about the node, not your spec.',
    causes: [
      {
        id: 'port-test',
        title: 'The node failed its port reachability test',
        why: 'Nodes check each other’s published ports, hourly by default. When that check fails (a firewall or NAT problem on that node) the node enters a state that removes its apps. The app respawns on another node.',
        likelihood: 'usual',
        checks: [
          api(
            'location',
            'Compare two readings. Other nodes should still be listed and the count should recover.',
          ),
        ],
        fixes: [
          fix(
            'Nothing to fix in the spec. If every node loses the app, it is worth checking that the container listens on 0.0.0.0 and on its container port. We have not verified that this is what the test looks at.',
          ),
        ],
        proof: src('11 row 32; 6.3', 'The consequence was read in source and not live tested.'),
        lessons: ['ports-and-domains'],
      },
      {
        id: 'surplus-removed',
        title: 'More nodes installed it than you asked for',
        why: 'Competing claims are ranked, and nodes that end up above the requested instance count remove their surplus copies.',
        likelihood: 'common',
        checks: [api('location', 'The final count should settle at your `instances` value.')],
        fixes: [fix('No action. This is how the network converges on the number you asked for.')],
        proof: src('6.2', 'The exact tie-break between two claims was not read in detail.'),
        lessons: ['how-apps-run'],
        terms: ['spawner'],
      },
      {
        id: 'removed-on-purpose',
        title: 'Someone used Remove Application on that node',
        why: 'The Control tab has Remove Application. The docs say it removes the app from the selected nodes, so another node picks it up, that the subscription continues, and that it deletes the app data on those nodes.',
        likelihood: 'possible',
        checks: [
          look(
            'Ask whoever manages the app whether they used Remove Application, Soft Reinstall or Hard Reinstall.',
          ),
        ],
        fixes: [
          fix(
            'No action is needed for the app: another node takes over. Data held only on the removed node is gone, so back up before you use it again. To end the app for good, cancel the subscription instead.',
          ),
        ],
        proof: docs(
          '9.5.4; 9.6',
          'The button name is read in the FluxCloud strings. What it does comes from the docs only.',
        ),
        lessons: ['operate-your-app'],
        terms: ['soft-redeploy', 'hard-redeploy'],
      },
    ],
    lessons: ['how-apps-run', 'operate-your-app'],
    labs: ['explorer'],
    related: ['fewer-instances-than-requested'],
  },
];
