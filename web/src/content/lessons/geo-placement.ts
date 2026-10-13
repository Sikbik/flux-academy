/**
 * Stratus 2: Where your app runs.
 *
 * Arc: the geolocation grammar; deny always wins; a rule that leaves nothing; pinning to nodes is not for
 * most deployers; static IP is a fee and a narrower pool; every rule is a filter on one pool.
 *
 * Facts: FACTS 3.5 (grammar, semantics, and the registration check: refused only when 0 < candidates <
 * instances; a list that leaves none is accepted and nothing is promised to run), 3.2 and 3.7 (nodes,
 * enterprise), 4.4 (scope and static IP fees), 6.2 (who decides), 9.4.2 and 9.4.3 (FluxCloud strings),
 * Snapshot re-read 2026-10-13 (static IP and EU_RU counts, quoted "at the time of writing"), 11 row 26.
 */

import type { Lesson } from '@/learn/types';

/** One small, valid component. Every field is spelled out so specs merge predictably. */
const portal = {
  name: 'portal',
  description: 'Client portal',
  repotag: 'acme/portal:3.4.0',
  repoauth: '',
  ports: [31200],
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
  id: 'geo-placement',
  hook: 'Flux lets you say where your app may run and where it may not, in a handful of short strings. You will write the rules, watch one of them cancel another, and see what each filter costs you in nodes and in money.',
  objectives: [
    'Read and write geolocation entries for a continent, a country and a region, allowed and forbidden.',
    'Predict which nodes a list admits, including the case where it admits none.',
    'Say when pinning to nodes and a static IP are available, what they cost and what they narrow.',
  ],
  steps: [
    {
      id: 'grammar',
      title: 'A place is a short code',
      body: [
        'A {{term:geolocation}} rule is a list of short strings, at most ten. Each one says allow or forbid, then names a place that narrows from left to right: a continent such as EU, then a country such as DE, then optionally a region such as BY. The prefix `ac` allows and `a!c` forbids, so `acEU` allows Europe, `acEU_DE` allows Germany and `a!cNA` forbids North America.',
        'An empty list means no rule at all, and every node may run the app. The continent codes are AF, AN, AS, EU, NA, OC and SA. Pick two places on the map and read the list that the widget builds.',
      ],
      callouts: [
        {
          // fact: FACTS 9.4.2 (Simple mode Location card: six continent buttons and the hint string)
          kind: 'tip',
          body: "FluxCloud's simple form offers one button per continent and warns: 'Restricting to fewer regions reduces the available nodes.' Countries, regions and forbid rules are in Advanced mode.",
        },
      ],
      // fact: FACTS 3.5 (grammar table and continent codes)
      stage: { kind: 'widget', id: 'geo-picker', props: { target: { allowContinents: ['EU', 'NA'] } } },
      task: { kind: 'widget', prompt: 'Select Europe and North America on the map.' },
    },
    {
      id: 'deny-wins',
      title: 'A forbid always wins',
      body: [
        // fact: FACTS 3.5 (a node must match no deny entry and, if any allow entries exist, at least one of them)
        'Each node tests itself against the whole list. It must match none of the forbid entries and, when the list has any allow entries, at least one of them. A forbid therefore beats an allow, and a list that only forbids leaves the rest of the world open.',
        // fact: FACTS Snapshot re-read 2026-10-13 (202 nodes are filed under EU_RU)
        'This app may run anywhere in Europe. Add one entry so that it may run anywhere in Europe except Russia. Russia has the country code RU and, at the time of writing, the network files it under Europe.',
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'clientportal',
          description: 'Client portal',
          instances: 3,
          geolocation: ['acEU'],
          compose: [portal],
        },
        editable: ['geolocation'],
        focus: [
          {
            path: 'geolocation',
            note: 'Allow entries start with `ac` and forbid entries with `a!c`. Add the entry that forbids Russia.',
          },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Keep Europe allowed and forbid Russia.',
        hint: 'A forbid entry is `a!c`, then the continent, an underscore and the two-letter country code, written like the Germany entry in the previous step.',
        check: {
          all: [
            { path: 'geolocation', op: 'includes', value: 'acEU', message: 'Keep acEU in the list.' },
            {
              path: 'geolocation',
              op: 'includes',
              value: 'a!cEU_RU',
              message: 'Add an entry that forbids Russia: the prefix `a!c`, the continent, then the country.',
            },
          ],
        },
        solution: { geolocation: ['acEU', 'a!cEU_RU'] },
      },
    },
    {
      id: 'nothing-left',
      title: 'When the rules cancel out',
      body: [
        // fact: FACTS 3.5 (a list that leaves no candidate is accepted; live: acEU with a!cEU was accepted; nothing is promised to run)
        'This list allows Germany and forbids all of Europe. Germany is in Europe and a forbid beats an allow, so no node can match: nothing could run the app. The network does not catch this at registration. A list that leaves no candidate is accepted, and nothing is promised to run, so a contradiction like this is yours to catch.',
        'The issues panel already flags it. Fix the list so that Germany stays allowed and nothing contradicts it.',
      ],
      callouts: [
        {
          // fact: FACTS 3.5 (refused only when 0 < candidates < instances; unresolved nodes count as candidates) and 9.4.3 (review step title and button)
          kind: 'gotcha',
          body: "Registration is refused when your rule leaves some nodes but fewer than your instance count: the message says it requests N instances but only M eligible nodes exist, and FluxCloud shows 'The network cannot place this app' with an 'Open Geolocation' button. A rule that leaves none is accepted. Nodes whose location the network could not resolve count as candidates, so the count is rarely zero.",
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'clientportal',
          description: 'Client portal',
          instances: 3,
          geolocation: ['acEU_DE', 'a!cEU'],
          compose: [portal],
        },
        editable: ['geolocation'],
        focus: [{ path: 'geolocation', note: 'Every allowed place here is also forbidden.' }],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Make the list satisfiable while keeping Germany allowed.',
        hint: 'A forbid on the continent covers every country inside it. Which of the two entries is working against the other?',
        check: {
          all: [
            {
              path: 'geolocation',
              op: 'includes',
              value: 'acEU_DE',
              message: 'Germany has to stay allowed.',
            },
            {
              lint: 'absent',
              codes: ['GEO_CONFLICT'],
              message: 'Every allowed place is still forbidden by another entry.',
            },
          ],
        },
        solution: { geolocation: ['acEU_DE'] },
      },
    },
    {
      id: 'pin-nodes',
      title: 'Pinning to named nodes',
      body: [
        // fact: FACTS 3.2 and 3.7 (nodes only on enterprise specs; non-empty list only from listed owners), 4.4 (scope fee)
        'The {{term:nodes-field}} list pins an app to specific nodes, written as a collateral outpoint (`txhash:index`) or as `ip:port`. In version 8 it works only on enterprise specs, and the network accepts a non-empty list only from owners on a signed allow-list. It also adds a flat scope fee to the price.',
        'For almost everyone the lever is geolocation, not pinning. This ordinary app pins three nodes: the validator refuses it, and the price shows the fee. Remove the pin.',
      ],
      callouts: [
        {
          // fact: FACTS 3.7 (two different meanings of "enterprise")
          kind: 'gotcha',
          body: 'Two different things share the word enterprise. An enterprise app has an encrypted spec. The enterprise list is a signed list of owners and nodes. Pinning needs both.',
        },
        {
          // fact: FACTS 4.4 (scope USD 4 before the divide by 3)
          kind: 'cost',
          body: 'At the time of writing, an enterprise or pinned app adds a flat USD 4 to the base price before it is divided across instances.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'clientportal',
          description: 'Client portal',
          instances: 3,
          geolocation: ['acEU'],
          nodes: ['203.0.113.10:16127', '203.0.113.11:16127', '203.0.113.12:16127'],
          compose: [portal],
        },
        editable: ['nodes'],
        focus: [{ path: 'nodes', note: 'These documentation addresses stand in for named nodes.' }],
        show: ['form', 'price', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Remove the pinned nodes and let geolocation do the steering.',
        hint: 'Empty the nodes list. The error and the extra price line both go with it.',
        check: {
          all: [
            { path: 'nodes', op: 'empty', message: 'The nodes list still has entries.' },
            {
              lint: 'absent',
              codes: ['NODES_NEED_ENTERPRISE', 'NODES_OWNER_PRIVILEGE'],
              message: 'Pinning is still reported as a problem.',
            },
          ],
        },
        solution: { nodes: [] },
      },
    },
    {
      id: 'static-ip',
      title: 'Static IP: a fee and a smaller pool',
      body: [
        // fact: FACTS 2.4 and 11 row 26 (only static IP nodes; fewer nodes qualify), Snapshot re-read 2026-10-13 (2,145 of 7,078 report a static IP), 4.4 (USD 2 before the divide by 3)
        'Setting `staticip` asks for a {{term:static-ip}}: the app is limited to nodes the network classifies as having a fixed, directly reachable public address. The fee is added to the monthly bundle, which is divided by 3 and billed per instance, so it grows with the instance count. It also shrinks the pool: at the time of writing about three in ten nodes report a static IP, so the network has fewer nodes to choose from and placement can take longer.',
        'Turn it on only when something outside depends on a node address staying the same. A web app that is reached through its Flux domain does not. Switch it off and watch the line leave the price.',
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'clientportal',
          description: 'Client portal',
          instances: 3,
          staticip: true,
          geolocation: ['acEU'],
          compose: [portal],
        },
        editable: ['staticip'],
        focus: [{ path: 'staticip', note: 'A fee on the bundle, and only static IP nodes qualify.' }],
        show: ['form', 'price', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Turn the static IP off.',
        check: { path: 'staticip', op: 'eq', value: false, message: 'Static IP is still on.' },
        solution: { staticip: false },
      },
    },
    {
      id: 'the-pool',
      title: 'Every rule is a filter on one pool',
      body: [
        // fact: FACTS 6.2 (no scheduler; each node refuses an app for the listed reasons)
        'The network is one pool of nodes. Geolocation, static IP, pinned nodes and the size of your app each take some of them out, and your instances land on what is left, one per node. No scheduler assigns them. Each {{term:eligible-node}} decides alone whether to claim a missing instance, so where the copies land is not something you choose.',
        'That is why a narrow rule costs you twice. There is less spread to start with, and when a node dies the replacement has to come from the same small pool. Hover a country to see how many nodes it holds.',
      ],
      callouts: [
        {
          kind: 'tip',
          body: 'Look up any app in the {{lab:explorer}} to see which countries its instances really ended up in, and use the {{lab:network}} to see how nodes are spread right now.',
        },
      ],
      stage: { kind: 'diorama', scene: 'network', live: true },
    },
  ],
  checkpoint: [
    {
      id: 'europe-not-russia',
      kind: 'spec-build',
      prompt:
        "A Berlin accountancy firm hosts its client portal on Flux, and its policy says client data is processed in Europe and never in Russia. A colleague's draft is below. Make it match the policy.",
      spec: {
        name: 'clientportal',
        description: 'Client portal',
        instances: 1,
        staticip: true,
        geolocation: ['acEU', 'acNA'],
        nodes: ['203.0.113.10:16127'],
        compose: [portal],
      },
      requirements: [
        {
          id: 'europe',
          label: 'Europe is allowed',
          check: { path: 'geolocation', op: 'includes', value: 'acEU' },
        },
        {
          id: 'not-russia',
          label: 'Russia is forbidden',
          check: { path: 'geolocation', op: 'includes', value: 'a!cEU_RU' },
        },
        {
          id: 'only-those',
          label: 'Nothing else is allowed: the list has just those two entries',
          check: { path: 'geolocation.length', op: 'lte', value: 2 },
        },
        {
          id: 'three',
          label: 'At least three instances, so one node can fail',
          check: { path: 'instances', op: 'gte', value: 3 },
        },
        {
          id: 'no-static-ip',
          label: 'No static IP: nothing here needs one, and it narrows the pool',
          check: { path: 'staticip', op: 'eq', value: false },
        },
        {
          id: 'no-pin',
          label: 'No pinned nodes: the firm is not on the enterprise list',
          check: { path: 'nodes', op: 'empty' },
        },
        {
          id: 'valid',
          label: 'The validator reports no errors',
          check: { lint: 'valid' },
        },
      ],
      solution: {
        instances: 3,
        staticip: false,
        geolocation: ['acEU', 'a!cEU_RU'],
        nodes: [],
      },
      explain:
        'Europe is allowed and Russia is forbidden: the forbid wins inside the allowed continent. That is the placement rule the network applies, based on its IP location data. It is not a compliance certification, and a node whose location the network could not resolve is not excluded by any entry. The pinned node would have been refused for a non-enterprise app, and the static IP only narrowed the pool.',
      hint: 'Four things are off in the draft: an extra continent, no forbid for Russia, one instance, and two options the account cannot or should not use.',
    },
    {
      id: 'entries-meaning',
      kind: 'match',
      prompt: 'Match each geolocation entry to what it does.',
      pairs: [
        { id: 'eu', left: '`acEU`', right: 'Any node in Europe may run the app' },
        { id: 'de', left: '`acEU_DE`', right: 'Only nodes in Germany may run the app' },
        { id: 'by', left: '`acEU_DE_BY`', right: 'Only nodes in Bavaria, Germany, may run the app' },
        { id: 'na', left: '`a!cNA`', right: 'No node in North America may run the app' },
        { id: 'ru', left: '`a!cEU_RU`', right: 'No node in Russia may run the app' },
      ],
      explain:
        'The prefix says allow or forbid, and the rest narrows from continent to country to region. An allow entry limits the app to the places it names, while a forbid only removes places. Region entries match only nodes whose region the network could resolve, so a region forbid does not catch an unresolved node.',
      hint: 'Read left to right: `ac` or `a!c` first, then the continent, then an underscore and a country, then an underscore and a region.',
    },
    {
      id: 'static-ip-effect',
      kind: 'choice',
      prompt: 'What does turning on `staticip` do to an app?',
      options: [
        {
          id: 'narrow',
          label:
            'Only nodes with a fixed, directly reachable address may run it, and a fee is added to the bundle price',
        },
        {
          id: 'one-ip',
          label: 'All of its instances are served from one shared IP address',
          why: 'Each instance still runs on its own node with its own address. Visitors reach the app through its domain.',
        },
        {
          id: 'sticky',
          label: 'Each instance stays on the node it started on after a restart',
          why: 'A restart keeps an instance where it is anyway. The flag is about which nodes qualify, not about sticking to one.',
        },
        {
          id: 'faster',
          label: 'Failover becomes faster because the addresses never change',
          why: 'Failover is the load balancer noticing a closed port. The flag does not change how fast that happens.',
        },
      ],
      answer: 'narrow',
      explain:
        'The flag is a filter on nodes plus a fee on the bundle price, so it shrinks the pool the network chooses from. Nothing about how traffic reaches the app changes.',
      hint: 'It is one of the filters from this lesson. Think about which nodes it removes and what the price panel showed.',
    },
  ],
  recap: [
    'A geolocation entry is `ac` to allow or `a!c` to forbid, then a continent, a country and a region. An empty list means anywhere.',
    'A node must match no forbid and at least one allow when allows exist, so a forbid always wins and can leave no node at all.',
    'Pinning to nodes is for enterprise specs and listed owners only and adds a fee to the bundle price. Geolocation is the lever you actually have.',
    'A static IP adds a fee to the bundle price and admits only nodes with a fixed address, so use it only when something depends on it.',
    'Every rule filters the same pool. A narrower pool means less spread and fewer places for a replacement to come from.',
  ],
  further: [
    {
      label: 'FluxCloud docs: general settings, including geolocation',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/general',
    },
    {
      label: 'FluxCloud docs: priority nodes (the nodes field)',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/priority-nodes',
    },
  ],
  terms: ['geolocation', 'nodes-field', 'static-ip', 'eligible-node'],
};

export default lesson;
