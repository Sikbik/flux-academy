/**
 * Stratus 1: Instances and failure.
 *
 * Arc: one instance is one machine; three survive a node loss; rerouting takes seconds but replacing a
 * node takes about two hours or more; instances are on distinct nodes, not distinct continents; the
 * arithmetic of independent failures; redundancy is a price decision.
 *
 * Facts: FACTS 6.2 (placement), 6.3 (location records and respawn), 6.4 (FDM health checks and retries),
 * 6.5 (how many instances), 4.4 (the small app cliff), 9.4.2 and 9.4.3 (FluxCloud strings). Two live
 * figures are quoted "at the time of writing" and match the FACTS Snapshot re-read of 2026-10-13: 5,033 of
 * 7,078 nodes in Europe (71.1 percent), and the Flux explorer app's 34 EU and 6 NA copies of 40.
 */

import {
  BAKED_PRICING,
  FDM_EJECT_SEC,
  FDM_TIMING,
  HW_DISCOUNTS,
  LIMITS,
  LOCATION_TTL_MIN,
  ORBIT_FACTS,
} from '@shared/flux';
import type { Lesson } from '@/learn/types';

/** The small-app line of the price table, from the engine, so the prose cannot drift from the quote. */
const SMALL_APP = HW_DISCOUNTS[0];
const SMALL_APP_LINE = SMALL_APP
  ? `${SMALL_APP.maxCpu} cores, ${SMALL_APP.maxRam / 1000} GB of RAM and ${SMALL_APP.maxHdd} GB of disk`
  : 'the small app size';
const RATES_DATE = BAKED_PRICING.capturedAt;

/**
 * The arithmetic of the "arithmetic" step and the "downtime-minutes" question, computed so the prose and
 * the graded value cannot drift apart. A node is up 97 percent of the time (the figure the node setup
 * guide asks for, FACTS 2.2) and failures are independent, which is the assumption the lesson names.
 */
const NODE_DOWN = 0.03;
const MONTH_MINUTES = 30 * 24 * 60;
const ALL_DOWN = NODE_DOWN ** 3;
const ALL_DOWN_MINUTES = ALL_DOWN * MONTH_MINUTES;
const ONE_DOWN_MINUTES = NODE_DOWN * MONTH_MINUTES;
const ALL_DOWN_PERCENT_CEIL = Math.ceil(ALL_DOWN * 100 * 1000) / 1000;
const grouped = (n: number): string => n.toLocaleString('en-US');

/** One small, valid component shared by the specs in this lesson. Every field is spelled out. */
const web = {
  name: 'web',
  description: 'Ticket sales page',
  repotag: 'acme/ticketdesk:2.1.0',
  repoauth: '',
  ports: [31080],
  containerPorts: [3000],
  domains: [''],
  environmentParameters: [],
  commands: [],
  containerData: '/tmp',
  cpu: 0.5,
  ram: 500,
  hdd: 5,
};

const lesson: Lesson = {
  id: 'redundancy-failover',
  hook: "One instance is a bet that a stranger's computer stays online. You will break nodes on purpose, watch traffic route around them, see why a replacement takes far longer than the reroute, and size an app to a failure you name in advance.",
  objectives: [
    'Say what happens to traffic, and to your instance count, when a node fails, and why the two take very different times.',
    'Estimate availability and monthly downtime for a number of instances, and name the assumption that makes the estimate optimistic.',
    'Choose an instance count and a geolocation that carry a stated failure inside a budget.',
    'Explain why four instances can cost much more than three.',
  ],
  steps: [
    {
      id: 'one-instance',
      title: 'One instance is one machine',
      body: [
        'Your app does not run in "the cloud". It runs in a container on a {{term:fluxnode}}: a computer that an independent operator owns and keeps online. Operators reboot, update and lose power. When the machine that holds your only {{term:instance}} goes dark, your app goes with it.',
        'Send a request, kill the node that runs your instance, then send another. That second request is what a visitor sees.',
      ],
      callouts: [
        {
          // fact: FACTS 6.5 (CORRECTED note), 11 row 13 and 15.3.3: the 78 single-instance apps with no running copy on
          // 2026-10-13 were all Orbit deployments of blocklisted owners; every other single-instance app had one. Counts
          // come from ORBIT_FACTS so they carry their date. Not a failure rate: there is none in FACTS.
          kind: 'wild',
          title: 'A snapshot is not a failure rate',
          body: `On ${ORBIT_FACTS.orbitOneInstanceNotRunning.readOn}, ${ORBIT_FACTS.orbitOneInstanceNotRunning.value} apps that asked for one instance had no running copy. All of them were {{term:flux-orbit}} deployments whose owners the {{term:network-policy}} blocklist names, so nodes refuse to run them. Every other single-instance app had a running copy. That is a fact about one day. It does not show that one instance is safe: a snapshot cannot show what happens when a node fails.`,
        },
        {
          // fact: FACTS 9.4.2 (exact FluxCloud hint beside the copies stepper)
          kind: 'why',
          title: 'Why one is allowed at all',
          body: "Some apps can afford to be down: a hobby page, a demo. FluxCloud is blunt about it beside the copies stepper: 'A single copy. If its node reboots, your app may briefly go offline.'",
        },
      ],
      stage: {
        kind: 'diorama',
        scene: 'failover',
        instances: 1,
        controls: ['kill', 'revive', 'request'],
      },
      task: {
        kind: 'kill-nodes',
        count: 1,
        prompt: 'Kill the node that runs your only instance, then send a request.',
      },
    },
    {
      id: 'three-instances',
      title: 'Three instances, one node down',
      body: [
        // fact: FACTS 6.4 (TCP connect check every 3 s, down after 2 failures, retries 3 with redispatch, FDMSERVERID cookie up to 8 h)
        `Now the same failure with three instances. Between visitors and your instances sits a load balancer: {{term:fdm}}, which configures {{term:haproxy}}. It opens a TCP connection to every instance every ${FDM_TIMING.healthIntervalSec} seconds, and ${FDM_TIMING.ejectAfterFailures} failed checks in a row take that instance out of rotation: about ${FDM_EJECT_SEC} seconds in all.`,
        'A request that cannot connect is retried on another instance, and a visitor pinned to the dead one by a cookie moves to a survivor once it is marked down. Sending traffic around a dead instance is called {{term:failover}}. In the seconds before the check marks it down, some requests are retried and some may fail.',
        'In these figures the copies sit on different continents so you can tell them apart. The network does not promise that: the step on distinct nodes comes back to it.',
      ],
      callouts: [
        {
          // fact: FACTS 9.4.3 (Advanced form, Instances slider hint)
          kind: 'why',
          title: 'Why three and not two',
          body: "FluxCloud's Advanced form says it plainly: 'The minimum recommended for a decentralized network is 3 instances.' With two, one failure leaves a single point of failure. With three you can lose one and still have a pair.",
        },
      ],
      stage: {
        kind: 'diorama',
        scene: 'failover',
        instances: 3,
        controls: ['kill', 'revive', 'request'],
      },
      task: {
        kind: 'kill-nodes',
        count: 1,
        prompt: 'Send a few requests, kill one node, then send a few more.',
      },
    },
    {
      id: 'detect-vs-replace',
      title: 'Failing over is fast. Replacing is not.',
      body: [
        // fact: FACTS 6.3 and 6.5 (location record valid 7500 s, refreshed every 3600 s; respawn only after it lapses)
        `Rerouting only needs a closed port to be noticed, so it takes seconds. A replacement runs on a different clock. The network learns that a node is gone when its {{term:location}} record lapses: records are refreshed every hour and stay valid for ${LOCATION_TTL_MIN} minutes. Only then does another node, deciding on its own, claim your app, pull the image and start it.`,
        'In the simulator the replacement arrives after a short wait, because time is compressed. On the real network, a replacement can take about two hours after the node dies, more for an app with synced storage, plus the image pull. Plan for the instances you still have, not the ones that are coming. That habit is called {{term:n-minus-1}} planning: size each instance so the survivors can carry the whole load.',
      ],
      callouts: [
        {
          // fact: FACTS 6.3 (clean shutdowns announce themselves, peers drop the rows after 420 s)
          kind: 'wild',
          body: 'A clean shutdown announces itself and peers drop the record after about 7 minutes. A crash, a cut cable or a power cut is the slow case.',
        },
      ],
      stage: { kind: 'diagram', id: 'failure-modes', beat: 1 },
    },
    {
      id: 'spread',
      title: 'Distinct nodes, not distinct continents',
      body: [
        // fact: FACTS 6.2 (no two instances on one node IP; each node decides alone); node share by continent is in the FACTS Snapshot re-read of 2026-10-13, see file header
        'In practice each instance runs on a different node: no live app has two copies on one host. Placement does not promise anything beyond that, and different nodes can still sit with the same hosting provider. In particular it does not promise different countries. Every node decides alone whether it may run your app, and with no {{term:geolocation}} rule location is not part of that decision. At the time of writing about seven in ten nodes are in Europe, so most instances end up there.',
        // fact: FACTS 3.5 (a geolocation allow entry is a hard filter on which nodes may run the app) and 6.3 (a replacement waits for the location record to lapse, up to 125 minutes)
        'The Region control is the rule in this figure. With Europe selected, instances may only run in Europe, as `acEU` would say, so all three share a continent and anything that hits that continent hits them together. Press Break region to stand in for a continent-wide outage: every node in Europe goes dark at once and the app with it. Nothing in the allowed region is left, so no replacement can start.',
        'Treat the picture as an outline, not a forecast. With no rule the figure spreads instances over several continents so that you can tell them apart, which the real network does not promise. And the simulator compresses the wait for a replacement, which on the real network is about two hours or more, into a short pause.',
      ],
      callouts: [
        {
          // fact: FACTS Snapshot re-read 2026-10-13 (explorer app: 40 instances, geolocation [], 34 in Europe and 6 in North America)
          kind: 'wild',
          body: 'Look up a big app in the {{lab:explorer}}. At the time of writing the Flux explorer app asks for 40 instances with no geolocation rule, and 34 of them run in Europe.',
        },
        {
          kind: 'gotcha',
          body: 'Allowing two continents widens the pool; it does not promise a copy on each. Guaranteeing one per region would take two apps, one allowed per region, and your own traffic splitting in front. That is design inference, not a Flux feature.',
        },
      ],
      stage: {
        kind: 'diorama',
        scene: 'failover',
        instances: 3,
        region: 'EU',
        controls: ['kill', 'kill-region', 'revive', 'request', 'region'],
      },
      task: {
        kind: 'kill-nodes',
        count: 3,
        prompt: 'Break the region your instances share and watch the app go down.',
      },
    },
    {
      id: 'arithmetic',
      title: 'The arithmetic of more instances',
      body: [
        // fact: FACTS 2.2 (node setup guide asks for about 97 percent uptime; DOCS-ONLY); the arithmetic is the lesson's own
        `Express how often an app answers as {{term:availability}}. If each node is up 97 percent of the time and failures are independent, the chance that all three are down together is ${NODE_DOWN} cubed: under ${ALL_DOWN_PERCENT_CEIL} percent. Every instance you add multiplies the chance of a total outage by the same small number.`,
        'Now read the assumption the calculator states: independent failures. Nodes in one data center, on one provider or in one country fail together, so treat the result as the best case. The node setup guide asks operators for about 97 percent uptime. This course has no measured figure, so the number is yours to set.',
      ],
      stage: { kind: 'widget', id: 'uptime-calculator', props: { target: 99.99 } },
      task: { kind: 'widget', prompt: 'Reach 99.99 percent availability with 97 percent nodes.' },
    },
    {
      id: 'price-of-redundancy',
      title: 'Redundancy is a price decision',
      body: [
        // fact: FACTS 4.3 and 4.4 (price near linear; 20 percent small app discount only below 4 instances; USD 0.50 per extra instance; floor)
        `Every instance is billed, and the price is close to linear in the {{term:instances-field}}. The exceptions sit at the bottom: an app under ${SMALL_APP_LINE} gets ${SMALL_APP?.label ?? 'a discount'} off while it has fewer than ${LIMITS.instances.smallAppDiscountBelow} instances, a very cheap instance is billed a flat minimum from the fourth, and the network never charges less than a fixed monthly minimum.`,
        `So name the failure first, then buy the instances that survive it. At the rates read on ${RATES_DATE}, find how many instances this small app can have for under USD 1.50 a month.`,
      ],
      callouts: [
        {
          kind: 'cost',
          body: 'For a very small app the step from 3 to 4 instances can roughly double the monthly price. {{lesson:resources-pricing}} shows where each line comes from.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: { name: 'ticketdesk', instances: 6, compose: [web] },
        editable: ['instances'],
        focus: [{ path: 'instances', note: 'Every instance is billed. Watch the price at 4 and at 3.' }],
        show: ['form', 'price', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Keep at least 3 instances and get the price under USD 1.50 a month.',
        hint: 'The price panel itemises each line. Step the count down from 6 and watch for the line that changes between 4 and 3.',
        check: {
          all: [
            { path: 'instances', op: 'gte', value: 3, message: 'Keep at least 3 instances.' },
            {
              price: 'max',
              usd: 1.49,
              message: 'Still USD 1.50 or more. A fourth instance removes the small app discount.',
            },
          ],
        },
        solution: { instances: 3 },
      },
    },
  ],
  checkpoint: [
    {
      id: 'ticket-desk',
      kind: 'spec-build',
      prompt:
        'A venue sells tickets on Friday morning and cannot afford a dead page. Build the spec its brief asks for.',
      spec: {
        name: 'ticketdesk',
        description: 'Ticket sales page',
        instances: 1,
        staticip: true,
        geolocation: ['acEU_DE'],
        compose: [web],
      },
      requirements: [
        {
          id: 'survive-one',
          label: 'Still has two instances after any one node fails: at least 3 instances',
          check: { path: 'instances', op: 'gte', value: 3 },
        },
        {
          id: 'two-continents',
          label: 'Allowed to run in Europe and in North America, where the customers are',
          check: {
            all: [
              { path: 'geolocation', op: 'includes', value: 'acEU' },
              { path: 'geolocation', op: 'includes', value: 'acNA' },
            ],
          },
        },
        {
          id: 'no-static-ip',
          label: 'No static IP: nothing here needs a fixed address, and it narrows the pool',
          check: { path: 'staticip', op: 'eq', value: false },
        },
        {
          id: 'budget',
          label: `Costs less than USD 1.50 a month, at the rates read on ${RATES_DATE}`,
          check: { price: 'max', usd: 1.49 },
        },
      ],
      solution: { instances: 3, staticip: false, geolocation: ['acEU', 'acNA'] },
      explain:
        'Three instances mean any one node can fail and two keep serving. Allowing Europe and North America changes the pool the nodes pick from. Each node still decides alone, so it does not promise a copy on each. The static IP was a flat fee that bought nothing here, and a fourth instance would have broken the budget.',
      hint: 'One lost node leaves instances minus one, so count from there. The price panel itemises every line: find the one that is not buying you anything.',
    },
    {
      id: 'downtime-minutes',
      kind: 'estimate',
      prompt:
        'Each node is up 97 percent of the time and failures are independent. About how many minutes in a 30-day month are all three instances down at the same time?',
      quantity: 'number',
      value: Number(ALL_DOWN_MINUTES.toFixed(2)),
      tolerance: 0.2,
      unit: 'minutes',
      explain: `All three are down together with probability ${NODE_DOWN} x ${NODE_DOWN} x ${NODE_DOWN} = ${ALL_DOWN.toFixed(6)}. A 30-day month is ${grouped(MONTH_MINUTES)} minutes, so that is about ${ALL_DOWN_MINUTES.toFixed(1)} minutes. One instance on its own would be down ${grouped(ONE_DOWN_MINUTES)} minutes, over ${Math.floor(ONE_DOWN_MINUTES / 60)} hours.`,
      hint: `Probabilities of independent events multiply. The chance that one node is down is ${NODE_DOWN}, and a 30-day month has ${grouped(MONTH_MINUTES)} minutes.`,
    },
    {
      id: 'clocks-in-order',
      kind: 'order',
      prompt: 'A node loses power. Put what happens next in order.',
      items: [
        { id: 'dark', label: 'The node loses power and stops answering' },
        { id: 'eject', label: 'The load balancer fails two checks in a row and stops sending it traffic' },
        { id: 'lapse', label: "The node's location record stops being refreshed and lapses" },
        { id: 'claim', label: 'Another node sees the app is short of an instance and claims it' },
        { id: 'pull', label: 'It pulls the image and starts the container' },
        { id: 'join', label: 'The new instance announces itself and the load balancer picks it up' },
      ],
      explain: `Detection takes seconds because it only needs a closed port. Replacement waits for the record to lapse (up to ${LOCATION_TTL_MIN} minutes), then for a node to claim the app and pull the image.`,
      hint: 'There are two clocks. The load balancer reacts first. Nothing can be replaced until the network believes the node is gone.',
    },
    {
      id: 'why-four-costs-more',
      kind: 'choice',
      prompt:
        'A very small app costs far more at 4 instances than at 3, although the fourth instance adds almost no compute. What changed?',
      options: [
        {
          id: 'cliff',
          label:
            'The small app discount ends below 4 instances, and a very cheap instance is billed a flat minimum from the fourth',
        },
        {
          id: 'tier',
          label: 'The fourth instance has to run on a larger node tier',
          why: 'Tier is a soft preference expressed as install delays. It does not change the price.',
        },
        {
          id: 'fee',
          label: 'The network adds a redundancy fee from the fourth instance',
          why: 'There is no such fee. Price comes from resources, instances and the add-ons.',
        },
        {
          id: 'linear',
          label: 'Nothing changed: every instance costs the same as the first',
          why: 'The first instances are discounted and floored, so the price is not a straight line.',
        },
      ],
      answer: 'cliff',
      explain:
        'Below 4 instances a small app gets 20 percent off, and the monthly minimum hides it. At 4 the discount is gone and each instance after the first is billed a flat minimum, so the price steps instead of sliding.',
      hint: 'Open the price waterfall at 3 and at 4 instances and read the instance line and the discount line.',
    },
  ],
  recap: [
    'A single instance is a single point of failure; with three, one node can fail and two keep serving.',
    `The load balancer drops a dead instance in about ${FDM_EJECT_SEC} seconds. A replacement can take about two hours after the node dies, more for synced storage, so plan for the instances you have left.`,
    'Instances land on different nodes, not necessarily different continents: geolocation sets where they may run, and placement promises nothing beyond different nodes.',
    'Combined availability assumes independent failures. Nodes that share a provider or a place fail together.',
    'Redundancy is a price decision, and for a tiny app the step from 3 to 4 instances can roughly double it.',
  ],
  further: [
    {
      label: 'FluxCloud docs: the Instances tab of a running app',
      url: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/instances',
    },
    {
      label: 'FluxCloud cost calculator, to price any instance count',
      url: 'https://cloud.runonflux.com/cost-calculator',
    },
  ],
  terms: ['instance', 'instances-field', 'failover', 'availability', 'n-minus-1'],
};

export default lesson;
