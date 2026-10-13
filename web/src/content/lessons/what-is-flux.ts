/**
 * Lesson 1, what-is-flux: who runs the machines, what the three tiers are and why an app is not "on a
 * server". Planted failure: the belief that placement spreads copies across continents (it does not).
 *
 * Facts: docs/research/FACTS.md. Each fact is tagged `// fact: FACTS <section>` on the data it supports.
 * Tier collateral, tier sizes and the block constants come from the domain engine, so prose and the
 * simulators cannot drift apart. Node counts and the FLUX price appear only in stages, never in prose.
 */

import { BLOCKS_PER_MONTH, LEGACY_BLOCK_SEC, PON_FORK_HEIGHT, TARGET_BLOCK_SEC } from '@shared/flux/blocks';
import { HW_DISCOUNTS } from '@shared/flux/pricing';
import { TIER_FACTS } from '@shared/flux/tiers';
import { LOCATION_TTL_MIN, SPAWN_DEFERRAL_MIN } from '@shared/flux/timing';
import type { Lesson } from '@/learn/types';

const num = (v: number): string => v.toLocaleString('en-US');
const { cumulus, nimbus, stratus } = TIER_FACTS;

/** Payout of a tier relative to a Cumulus turn: 3.5 and 9. FACTS 2.1. */
const nimbusTurn = nimbus.payoutPerBlockFlux / cumulus.payoutPerBlockFlux;
const stratusTurn = stratus.payoutPerBlockFlux / cumulus.payoutPerBlockFlux;

/** "Small" for the install wait: under 3 cores, 6,000 MB and 150 GB. FACTS 2.4 and 2.3. */
const SMALL = HW_DISCOUNTS[0] as (typeof HW_DISCOUNTS)[number];
const { nimbusSmallApp: NIMBUS_WAIT, stratusSmallApp: STRATUS_WAIT } = SPAWN_DEFERRAL_MIN;

const lesson: Lesson = {
  id: 'what-is-flux',
  hook: 'On Flux your app does not run on a server you rent. It runs on machines that independent operators own, and how those machines differ explains most of what you will configure.',
  objectives: [
    'Match the three node tiers to the deposit and the hardware that define them.',
    "Put the layers of the Flux stack in order, from a stranger's machine up to your containers.",
    'Explain why a small app tends to land on the smallest nodes without anyone assigning it.',
    'Say what you can expect about where your copies land and what the spec has to ask for.',
  ],
  steps: [
    {
      id: 'map',
      title: "A map of strangers' computers",
      body: [
        '{{term:flux}} is a cloud built from machines that independent operators run. Each marker on this map is one of them, a {{term:fluxnode}}: a server that somebody set up and keeps online. The operator locks up some {{term:flux-token}} as a deposit and is paid in FLUX for keeping the machine in service.',
        "This is live data, so the spread you see is today's, not the one this lesson was written with. Your app will run on a handful of these machines, and the rest of this lesson is how it gets there.",
      ],
      callouts: [
        {
          kind: 'tip',
          body: '{{lab:network}} is the same map with a country list and a tier filter, if you want to look at it for longer.',
        },
      ],
      // fact: FACTS 1.1 (independent operators run the nodes), 1.4 (operators are paid from block rewards);
      // the counts are on the map itself (FACTS Snapshot), not in prose.
      stage: { kind: 'diorama', scene: 'network', live: true },
    },
    {
      id: 'stack',
      title: "From a stranger's machine to your app",
      body: [
        'Read the plates from the bottom. Independent operators supply the machines. {{term:fluxos}} turns each one into a small cloud server that can start containers. The chain, one shared record that every node reads, keeps them all in agreement. Your containers sit on top, on the nodes that chose to install your app.',
        'Operators differ and hardware differs, but every node runs FluxOS, and most run it on {{term:arcaneos}}, a hardened operating system for nodes. To your container nodes look much alike: a Docker host that starts it from your spec.',
      ],
      // fact: FACTS 1.2 (FluxOS and ArcaneOS rows), 2.6 (ArcaneOS share of the fleet), 6.2 (nodes choose)
      stage: { kind: 'diagram', id: 'flux-layers', beat: 3 },
    },
    {
      id: 'tiers',
      title: 'Three sizes of node',
      body: [
        `Operators choose one of three sizes, and the deposit fixes it. A {{term:cumulus}} node locks ${num(cumulus.collateralFlux)} FLUX as {{term:collateral}}, a {{term:nimbus}} node ${num(nimbus.collateralFlux)} and a {{term:stratus}} node ${num(stratus.collateralFlux)}. FluxOS reads the tier from the amount locked.`,
        `Bigger deposits come with bigger machines. FluxOS plans around ${cumulus.nominal.threads}, ${nimbus.nominal.threads} and ${stratus.nominal.threads} CPU threads; ${num(cumulus.nominal.ramMb)}, ${num(nimbus.nominal.ramMb)} and ${num(stratus.nominal.ramMb)} MB of RAM; and ${cumulus.nominal.ssdGb}, ${nimbus.nominal.ssdGb} and ${stratus.nominal.ssdGb} GB of disk.`,
      ],
      callouts: [
        {
          kind: 'wild',
          title: 'Where small apps land',
          // fact: FACTS 2.4 and 6.1 row 10 (Nimbus waits 57 min and Stratus 117 min for apps under 3 cores, 6000 MB, 150 GB;
          // "not a guarantee"), 2.3 (a nominal Cumulus node offers about 3 cores, 5000 MB and 129 GB to apps; real nodes
          // often have more, and a node already full of apps offers less)
          body: `Small apps tend to land on Cumulus nodes, and nobody assigns them there. At the time of writing, a Nimbus node waits ${NIMBUS_WAIT} minutes and a Stratus node ${STRATUS_WAIT} before taking an app under ${SMALL.maxCpu} cores, ${num(SMALL.maxRam)} MB of RAM and ${SMALL.maxHdd} GB of disk, so smaller nodes get the first chance. The cut-off is for the wait, not a promise that the app fits: a Cumulus node typically offers apps about ${cumulus.appCapacity.cpu} cores, ${num(cumulus.appCapacity.ramMb)} MB and ${cumulus.usableHddGb} GB, and less if it already runs other apps.`,
        },
      ],
      // fact: FACTS 2.1 (collateral), 2.2 and 2.3 (nominal sizes; the system keeps a share on every node)
      stage: { kind: 'diorama', scene: 'tiers', live: true },
      task: {
        kind: 'confirm',
        label: 'I hovered a node of each tier',
        prompt: 'Hover a node of each tier on the map and read its card.',
      },
    },
    {
      id: 'ladder',
      title: 'What the deposit buys',
      body: [
        `The deposit does two jobs. It makes a node costly to abuse, and it fixes the tier. Each block, the network pays one node from every tier, in rotation, out of newly issued FLUX: a Nimbus turn pays ${nimbusTurn} times as much as a Cumulus turn, and a Stratus turn pays ${stratusTurn} times as much.`,
        'Bigger deposit, bigger machine, bigger turn: the tiers are three rungs of one ladder. Which rung hosts your app is not something you buy. It falls out of what the app needs and what the nodes will take.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          title: 'Not live yet',
          // fact: FACTS 0 row C2, 1.5 (nodes are paid from newly issued FLUX only; sharing app fees is planned)
          body: 'Docs and older guides describe app revenue being shared with node operators. That is planned, not live. Today operators are paid only from newly issued FLUX, and app payments go to a single network address.',
        },
        {
          kind: 'gotcha',
          title: 'No per-tier sizes',
          // fact: FACTS 2.4 (v8 removed tiered), 3.2 correction (an unknown key is dropped, so it has no effect)
          body: 'Old tutorials let one spec ask for different sizes per tier with a `tiered` key. A version 8 spec has no such key: it is ignored, so it has no effect.',
        },
      ],
      // fact: FACTS 1.4 (one node of each tier is paid per block), 2.1 (payout per block 1 / 3.5 / 9)
      stage: { kind: 'diagram', id: 'tier-ladder', beat: 3 },
    },
    {
      id: 'blocks',
      title: 'Time is counted in blocks',
      body: [
        `The chain adds a {{term:block}} about every ${TARGET_BLOCK_SEC} seconds. Since block ${num(PON_FORK_HEIGHT)}, in October 2025, nothing is mined: under {{term:proof-of-node}} any confirmed node can win a slot by a hash lottery, so blocks keep a steady clock instead of a race.`,
        `That clock is how Flux measures time. A subscription is counted in blocks, a month is ${num(BLOCKS_PER_MONTH)} of them, and every payment, registration and expiry is pinned to a {{term:block-height}}: the number of the latest block, which only goes up.`,
      ],
      callouts: [
        {
          kind: 'gotcha',
          title: 'Older guides',
          // fact: FACTS 0 row C8, 1.4 eras (120 s blocks and PoW before height 2,020,000)
          body: `Guides from before October 2025 describe ${LEGACY_BLOCK_SEC / 60} minute blocks and mining FLUX. Both ended at block ${num(PON_FORK_HEIGHT)}. Blocks are ${TARGET_BLOCK_SEC} seconds now and there is no mining.`,
        },
      ],
      // fact: FACTS 1.4 (Proof of Node), 5.1 (30 s blocks, 88000 blocks is a FluxOS month)
      stage: { kind: 'diagram', id: 'block-clock', beat: 2 },
    },
    {
      id: 'no-scheduler',
      title: 'Nobody decides where it runs',
      body: [
        'There is no central scheduler. Every node reads the same public list of apps, notices when one has fewer running copies than it asks for and, if it has room and the rules allow, installs one and announces it. Each running copy is an {{term:instance}}.',
        // fact: FACTS 6.1 rows 9 and 10 (nodes act on their own timers; usually 1 to 3 minutes to start), 6.2 (no live app
        // has two copies on one host, re-checked 2026-10-13; many nodes share a hosting organisation)
        'Set the instances to 3 and watch where the copies land. In practice no two copies of an app run on the same node, so one failed machine takes out one copy, not all of them. Here a copy appears at once; on the real network each node acts on its own timer, so placement usually takes minutes and can take much longer.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          title: 'Different nodes, not different continents',
          // fact: FACTS 6.2 (no live app has two copies on one node IP, observed and re-checked 2026-10-13; it is not a
          // rule; 358 organisation strings for 7,078 stats rows on 2026-10-13, so many nodes share a hosting
          // organisation and two copies can share one; geolocation is a spec rule; nothing else about the spread is stated)
          body: 'In practice each copy runs on a different node: no live app has two copies on one host, and that is an observation, not a rule. Many nodes share a hosting provider, though: at the time of writing about 358 organisation names cover about 7,078 nodes. So two copies on different nodes can still sit with the same provider, or in the same country. Ask for regions with `geolocation`, covered in {{lesson:geo-placement}}.',
        },
      ],
      stage: { kind: 'diorama', scene: 'placement', instances: 1, controls: ['instances'] },
      task: {
        kind: 'set-instances',
        min: 3,
        prompt: 'Set the instances to 3 or more and watch where the copies land.',
      },
    },
    {
      id: 'trade-offs',
      title: 'What this means for you',
      body: [
        'Neither side wins. A rented server is simpler to reason about and hands you the whole machine. Flux prices the whole app for the period you choose, you have no machine of your own to patch, and the network treats a lost node as normal. You still keep your image up to date, and you give up the idea that your app lives in one place.',
        // fact: FACTS 6.5 and 11 row 13 (one instance is one node; a replacement waits for the location record, 125 minutes,
        // plus the image pull); the old share of single-instance apps without a copy is not quoted (FACTS 15.3.3)
        `Take failure seriously. One instance lives on one node, each node belongs to an operator you do not know, and when that node stops your app stops with it. The network does not replace the copy at once: at the time of writing it takes about two hours (${LOCATION_TTL_MIN} minutes plus the image pull). Ask for three instances and a failed node takes out one copy of three. {{lesson:redundancy-failover}} lets you break nodes on purpose and watch it happen.`,
      ],
      stage: {
        kind: 'compare',
        left: {
          label: 'A rented server',
          tone: 'neutral',
          body: 'One machine, one provider, one place. You choose the size and the city, you get the whole box, and a failure is a single event you can see. Redundancy is something you build: a second server, a load balancer, a plan for the night it fails.',
        },
        right: {
          label: 'Flux',
          tone: 'neutral',
          body: 'Many machines run by many operators, none of them yours. You describe the app and nodes pick it up. A node going away is routine, so redundancy is a number you set: instances. You design for failure instead of hoping for one reliable box.',
        },
      },
    },
  ],
  checkpoint: [
    {
      id: 'tier-sizes',
      kind: 'match',
      prompt: 'Match each tier to the deposit and the hardware FluxOS plans around.',
      pairs: [
        {
          id: 'cumulus',
          left: 'Cumulus',
          right: `${num(cumulus.collateralFlux)} FLUX, ${cumulus.nominal.threads} threads, ${num(cumulus.nominal.ramMb)} MB of RAM`,
        },
        {
          id: 'nimbus',
          left: 'Nimbus',
          right: `${num(nimbus.collateralFlux)} FLUX, ${nimbus.nominal.threads} threads, ${num(nimbus.nominal.ramMb)} MB of RAM`,
        },
        {
          id: 'stratus',
          left: 'Stratus',
          right: `${num(stratus.collateralFlux)} FLUX, ${stratus.nominal.threads} threads, ${num(stratus.nominal.ramMb)} MB of RAM`,
        },
      ],
      // fact: FACTS 2.1 and 2.2 (collateral, nominal sizes)
      explain:
        'The deposit and the machine rise together, and the deposit is what fixes the tier. Cumulus is the smallest in both, Stratus the largest.',
      hint: 'The names run smallest to largest: Cumulus, Nimbus, Stratus. Hover a node of each tier on the map in the third step and read its card.',
    },
    {
      id: 'stack-order',
      kind: 'order',
      prompt: 'Put the layers in the order the diagram draws them, from the bottom plate to the top.',
      items: [
        { id: 'machines', label: 'Machines run by independent operators' },
        { id: 'fluxos', label: 'FluxOS on each machine, making it a cloud server' },
        { id: 'chain', label: 'The chain every node reads and agrees on' },
        { id: 'containers', label: 'Your containers, on the nodes that chose to install them' },
      ],
      // fact: FACTS 1.1, 1.2, 1.4 and 6.2 (the pieces; the bottom-to-top order is the diagram's teaching picture, not a
      // statement in FACTS about how the daemons are layered on a node)
      explain:
        'The diagram draws operators supplying machines, FluxOS making each one a server, the chain keeping them in agreement and your containers on top. It is a teaching picture of how the pieces relate, not a map of how the software is installed on one node.',
      hint: 'Start with what exists before any Flux software does, and finish with the thing you will deploy. The diagram in the second step draws them in this order.',
    },
    {
      id: 'small-apps',
      kind: 'choice',
      prompt:
        'An app asks for 0.5 cores, 500 MB of RAM and 5 GB of disk. Where is it most likely to run, and why?',
      options: [
        {
          id: 'cumulus',
          label: 'On Cumulus nodes, because bigger nodes wait before taking an app this small.',
        },
        {
          id: 'stratus',
          label: 'On Stratus nodes, because they have the most room to spare.',
          why: `They have the room, and that is why they wait. At the time of writing a Stratus node holds back from an app this small for ${STRATUS_WAIT} minutes so smaller nodes get the first chance.`,
        },
        {
          id: 'owner',
          label: 'On whichever tier the owner chose in the spec.',
          why: 'A version 8 spec has no tier field. Every instance gets the same resources on any tier, and the owner does not pick one.',
        },
        {
          id: 'network',
          label: 'On nodes picked by the network, starting with Nimbus.',
          why: 'Nothing picks nodes for you. Each node decides alone. The main ordering comes from the waits that bigger nodes apply to small apps.',
        },
      ],
      answer: 'cumulus',
      // fact: FACTS 2.4 and 6.2 (soft tier preference through install delays, "not a guarantee")
      explain: `Each node applies its own wait. At the time of writing Nimbus waits ${NIMBUS_WAIT} minutes and Stratus ${STRATUS_WAIT} before taking an app under ${SMALL.maxCpu} cores, ${num(SMALL.maxRam)} MB and ${SMALL.maxHdd} GB, so Cumulus nodes usually get there first. It is a tendency, not a rule.`,
      hint: 'Think about which nodes act first. Bigger nodes do not refuse small apps, they hold back from them.',
    },
    {
      id: 'spread-belief',
      kind: 'choice',
      prompt: 'You ask for 3 instances and say nothing about regions. Which statement is true?',
      options: [
        {
          id: 'distinct-nodes',
          label:
            'In practice each copy runs on a different node, and nothing else about their spread is promised.',
        },
        {
          id: 'continents',
          label: 'The copies are spread over at least two continents.',
          why: 'Placement does not put copies on different continents for you. Two can sit in the same country unless the spec uses `geolocation`.',
        },
        {
          id: 'tiers',
          label: 'One copy lands on each tier.',
          why: 'Tier is not a placement rule. All three copies can land on Cumulus nodes.',
        },
        {
          id: 'one-node',
          label: 'The three copies run on one node and share its CPU.',
          why: 'In practice each copy runs on its own node: no live app has two copies on one host. Separate machines are the point of extra instances.',
        },
      ],
      answer: 'distinct-nodes',
      // fact: FACTS 6.2 (no live app has two copies on one node IP, observed; geolocation is how you constrain regions)
      explain:
        'In practice each copy runs on a different node, and placement promises nothing beyond that. Different continents is something you ask for with `geolocation`, and Flux does not do it for you.',
      hint: 'Separate machines are what you see in practice. Separate places are a request you make in the spec.',
    },
  ],
  recap: [
    'Independent operators run the machines, FluxOS makes each one a small cloud server and the chain keeps them in agreement.',
    'Cumulus, Nimbus and Stratus are fixed by the deposit, and small apps tend to land on the smallest nodes.',
    `Time is counted in blocks: one about every ${TARGET_BLOCK_SEC} seconds, and ${num(BLOCKS_PER_MONTH)} to a month.`,
    'Nodes pick apps for themselves. In practice each copy lands on its own node, but where is not promised: ask for regions with `geolocation`.',
    'On Flux, redundancy is a number you set: instances.',
  ],
  further: [
    {
      label: 'Docs: what a FluxNode is (its reward and RAM figures are out of date)',
      url: 'https://docs.runonflux.com/fluxnodes/what-are-fluxnodes',
    },
    {
      label: 'Docs: the FluxCloud network dashboards, overview and map',
      url: 'https://docs.runonflux.com/fluxcloud/dashboard/overview',
    },
    {
      label: 'Docs: ArcaneOS, the hardened node operating system',
      url: 'https://docs.runonflux.com/fluxnodes/arcaneos-fluxnode/',
    },
  ],
  terms: [
    'flux',
    'fluxnode',
    'flux-token',
    'fluxos',
    'arcaneos',
    'collateral',
    'cumulus',
    'nimbus',
    'stratus',
    'block',
    'proof-of-node',
    'block-height',
    'instance',
  ],
};

export default lesson;
