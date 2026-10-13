/**
 * Lesson 2, how-apps-run: one deployment from a signed spec to a live address, in seven beats.
 * Planted failure: a spec the calculator prices and the validator refuses, then a payment that arrives too
 * late to link to anything.
 *
 * Facts: docs/research/FACTS.md. Each fact is tagged `// fact: FACTS <section>` on the data it supports.
 * Prices on screen come from the pricing engine through the spec stage; the prose quotes no computed price.
 */

import { secondsToBlocks, TARGET_BLOCK_SEC } from '@shared/flux/blocks';
import {
  DEPLOY_ESTIMATE_MIN,
  FDM_EJECT_SEC,
  FDM_FAILOVER,
  FDM_TIMING,
  G_STANDBY_WAIT_MIN_PER_POSITION,
  INSTALL_START_USUAL_MIN,
  LOCATION_TTL_MIN,
  LOCATION_TTL_SEC,
  PAYMENT_WINDOW_MIN,
  REGISTRATION_DEADLINE_MIN,
  SIGN_TIMESTAMP_MAX_AHEAD_SEC,
  SPAWN_DEFERRAL_MIN,
  UI_WATCHER_MIN,
  UI_WATCHER_POLL_SEC,
} from '@shared/flux/timing';
import type { Lesson } from '@/learn/types';

const num = (v: number): string => v.toLocaleString('en-US');

/**
 * FluxCloud's payment card says "Payment window: 30 minutes remaining". That is fixed UI text, not a counter,
 * and nothing ties it to the registration message's lifetime, which is an hour from registration on each node.
 * FACTS 6.6. The values come from the engine; the block count is derived, not typed.
 */
const PAYMENT_WINDOW_MINUTES = PAYMENT_WINDOW_MIN;
const PAYMENT_WINDOW_SECONDS = PAYMENT_WINDOW_MINUTES * 60;
const PAYMENT_WINDOW_BLOCKS = secondsToBlocks(PAYMENT_WINDOW_SECONDS);

/** The hello-flux spec the lesson walks through. A partial: the stage merges it over the default spec. */
const helloFlux = {
  name: 'hello-flux',
  description: 'Hello world, served by Flux',
  instances: 3,
  compose: [
    {
      name: 'web',
      description: 'Node web server',
      repotag: 'sam/hello-flux:1.0.0',
      ports: [31001],
      containerPorts: [3000],
      domains: [''],
      environmentParameters: [],
      commands: [],
      containerData: '/tmp',
      repoauth: '',
      cpu: 0.5,
      ram: 500,
      hdd: 5,
    },
  ],
};

const lesson: Lesson = {
  id: 'how-apps-run',
  hook: 'A deployment is a short chain of events, and almost every confusing delay or refusal is a gap between two links. You will follow one app from a signed document to a live address, and learn where each gap is.',
  objectives: [
    'Put the stages of a deployment in order, from signing the spec to the first request.',
    'Say what a registration message and its hash are, and why the hash decides whether a payment counts.',
    'Tell a price from a validation, and fix a spec the network would refuse.',
    'Explain why nobody assigns your app to a node, and why starting can take longer than a few minutes.',
  ],
  steps: [
    {
      id: 'spec',
      title: 'An app is a document',
      body: [
        'An app on Flux is described by one JSON document, the {{term:app-spec}}: a name, how many copies to run, and under {{term:compose}} one entry per container with its image, ports and resources. The network accepts {{term:spec-version}} 8 for new apps, so a spec copied from an old tutorial usually needs changes.',
        "Nothing in the document says which machine runs it. Your job is to describe the app, and the network's job is to find room for it. Everything else in this lesson happens to this one document.",
      ],
      // fact: FACTS 3.1 (v8 is current), 3.2 (top-level fields), 3.9 (the minimal v8 shape)
      stage: {
        kind: 'spec',
        spec: helloFlux,
        editable: [],
        show: ['json'],
        focus: [
          { path: 'name', note: "The app's identity on the network, and the front of its web address." },
          { path: 'instances', note: 'How many different nodes should each run a copy.' },
          { path: 'compose[0].repotag', note: 'The image to run, pulled from a public registry.' },
        ],
      },
    },
    {
      id: 'price-validate',
      title: 'A price is not a verdict',
      body: [
        "Before you sign, the spec meets two different checkers. The calculator turns CPU, RAM, disk, ports and instances into a {{term:price-quote}}: an amount in USD, and in FLUX at a 5 percent discount. The validator applies the network's rules: names, ports and the image. They are separate things.",
        'This spec has a price and a problem. The chip shows the monthly price and the issues panel what the network would refuse. Fix the problem, then watch the price stay put: pricing looks at resources, not at whether a name is allowed.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 3.9 and 3.10 (the calculator does not run the full validator)
          body: 'The calculator does not run the whole rulebook. It will price a name or an image that registration would refuse, so a price on screen is not proof that a spec is valid.',
        },
      ],
      // fact: FACTS 3.6 (names starting with flux or zel are reserved), 4.7 and 4.4 (FLUX is 5 percent cheaper)
      stage: {
        kind: 'spec',
        spec: { ...helloFlux, name: 'flux-hello' },
        editable: ['name'],
        show: ['form', 'price', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Make the spec valid. The issues panel says what the network would refuse.',
        hint: 'Names that start with `flux` or `zel` are reserved. Rename the app so it does not.',
        check: { lint: 'valid', message: 'The network would still refuse this spec. Read the issues panel.' },
        solution: { name: 'hello-flux' },
      },
    },
    {
      id: 'register',
      title: 'Sign it, and the network gets a message',
      body: [
        'To register, you sign the spec with the key behind its `owner`. A node checks it again, hashes it and passes it round the network as a temporary {{term:registration-message}}. What you get back is the {{term:message-hash}}: a short fingerprint of exactly what you signed.',
        `No block holds it yet and nothing is paid. Each node keeps the message for ${REGISTRATION_DEADLINE_MIN} minutes from the moment it receives it, a few seconds after you register, and waits in that time for money that carries its hash. That hash is the next step.`,
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 6.1 row 4 and 11 row 23 (timestamp window -1 h to +5 min)
          body: `The signature carries a timestamp, and a node accepts one up to an hour old or ${SIGN_TIMESTAMP_MAX_AHEAD_SEC / 60} minutes in the future. A wrong clock on your computer will make a correct spec fail with "Message timestamp is over 1 hour old" or a "from future" error.`,
        },
        {
          kind: 'gotcha',
          title: 'Sign what the node formats',
          // fact: FACTS 3.2 correction (the node formats the spec before checking it: unknown keys are dropped; the
          // signature is checked over type + version + the FORMATTED spec + timestamp, so the signed text must be it)
          body: 'A node formats your spec before it checks the signature: keys it does not know are dropped and the rest are put in its own order. The signature has to match that formatted spec, so if you sign by script, sign the spec that the validation call returns, not your raw JSON.',
        },
      ],
      // fact: FACTS 6.1 rows 4 and 5 (sign, register message and hash), 6.6 (message life 3,600 s on each node, from receipt)
      stage: { kind: 'diagram', id: 'lifecycle', beat: 1 },
    },
    {
      id: 'pay',
      title: 'Pay, with the hash attached',
      body: [
        `Payment is an ordinary transaction to one {{term:payment-address}}, with the message hash in its {{term:op-return}} field: a short note that a transaction can carry. Nodes watching the chain see a payment that names a message they hold, and the next block, about ${TARGET_BLOCK_SEC} seconds later, confirms the app.`,
        `Pay the full quoted amount. FluxCloud asks for it, and the card relay needs at least 98 percent of it. A payment below the network's own floor, which is far lower than the quote, is dropped as underpaid. Pay by card and a relay makes the transaction for you.`,
        `After the install test, FluxCloud's payment card says "Payment window: ${PAYMENT_WINDOW_MINUTES} minutes remaining". That is fixed text, not a counter. The clock that counts is the message's ${REGISTRATION_DEADLINE_MIN} minutes from registration, so treat the half hour as your budget. A payment that arrives after the message is gone finds nothing to link: the screen says registered and the app never installs.`,
      ],
      callouts: [
        {
          kind: 'gotcha',
          title: 'Where the money comes from',
          // fact: FACTS 9.5.1 (DOCS-ONLY game-guide warning: not from an exchange, no memo, may miss the window),
          // 1.5 (wrapped FLUX cannot pay: an inference from the payment detection code, which reads the Flux chain only)
          body: 'Send native FLUX from a wallet you control. The docs warn against paying from an exchange, because a withdrawal usually cannot attach the message. Wrapped FLUX on another chain does not pay either: nodes only read payments on the Flux chain.',
        },
      ],
      // fact: FACTS 4.7 (address, OP_RETURN; the node accepts any payment at or above the on-chain table price, FluxCloud
      // asks for the quote, the card relay needs 98 percent), 6.6 (the 30 minute text is a UI string, the node-side
      // deadline is 60 minutes after registration), 6.1 rows 7 and 8, 11 row 22
      stage: { kind: 'diagram', id: 'lifecycle', beat: 2 },
    },
    {
      id: 'nodes-decide',
      title: 'Nodes decide who runs it',
      body: [
        'Once the app is on the chain, every node can see it. Each node runs a loop, the {{term:spawner}}, on its own timer: it drops apps it cannot or should not run, picks one that is short of copies and starts installing. Nobody tells it to.',
        `Small nodes go first. At the time of writing a Nimbus node holds back ${SPAWN_DEFERRAL_MIN.nimbusSmallApp} minutes and a Stratus node ${SPAWN_DEFERRAL_MIN.stratusSmallApp} before taking a small app (${SPAWN_DEFERRAL_MIN.stratusMediumApp} for a mid-size one), so copies that the small nodes do not take wait for the bigger ones.`,
        `FluxCloud's screen says deployment takes up to ${DEPLOY_ESTIMATE_MIN} minutes after payment, and that a node usually starts installing within ${INSTALL_START_USUAL_MIN.from} to ${INSTALL_START_USUAL_MIN.to} minutes. Both are fixed labels with no timer behind them. The first is an estimate, not a guarantee: a copy can take about two hours when the bigger nodes' waits come into play, and longer when few nodes qualify.`,
      ],
      callouts: [
        {
          kind: 'gotcha',
          title: 'An estimate, not a guarantee',
          // fact: FACTS 6.1 rows 9 and 10, 9.5.1 (up to 45 min is the UI text; usually 1 to 3), 2.4 (57, 87 and 117 min
          // waits), 11 rows 4, 26 and 32 (what else can starve a copy)
          body: "If too few small nodes qualify, for example because you narrowed the regions or asked for a static IP, bigger nodes only join after their wait. A copy missing after an hour is often just waiting for a bigger node's wait to end. If it stays missing, check the geolocation, the static IP and the image architecture.",
        },
      ],
      stage: { kind: 'diorama', scene: 'deploy', instances: 3, controls: ['replay'] },
    },
    {
      id: 'install',
      title: 'Install, then announce',
      body: [
        'A node that took the app pulls the image, creates a private network and a volume for it and starts the container. The pull is the slow part: a small image takes seconds and a large one minutes, so size matters. {{lesson:containers-101}} covers it.',
        `When the container is running, the node announces it in a signed message. That is the app's {{term:location}}: this node runs this app. At the time of writing a record lasts ${num(LOCATION_TTL_SEC)} seconds (${LOCATION_TTL_MIN} minutes) and is refreshed every hour, so a dead node fades out on its own. {{lab:explorer}} shows real ones.`,
        `FluxCloud watches for this once you click pay: every ${UI_WATCHER_POLL_SEC} seconds, for up to ${UI_WATCHER_MIN} minutes. It shows "Deployment Successful" as soon as it sees one copy running, not all of them. If the time runs out first it says "Payment monitoring timed out" and stops watching, but the deployment carries on.`,
      ],
      // fact: FACTS 6.1 rows 11 and 12 (install; location records last 7500 s, refreshed every 3600 s), 6.6 (the UI watcher:
      // 30 min, polls every 30 s, "Deployment Successful" means one copy is running, then stops; the deployment continues)
      // Beat 5 keeps the install drawn and adds the announcement, which is the new idea in this step.
      stage: { kind: 'diagram', id: 'lifecycle', beat: 5 },
    },
    {
      id: 'your-url',
      title: 'Your address',
      body: [
        `FluxCloud gives every app a web address built from its name: an app called \`myapp\` is reached at \`myapp.app.runonflux.io\`. A service called {{term:fdm}}, the Flux Domain Manager, answers for that name and spreads different visitors over the instances that are running. At the time of writing it keeps one browser on the same instance for up to ${FDM_TIMING.stickyHours} hours. That name is the app's {{term:app-domain}}.`,
        'In this simulation each request comes from the next visitor in a list of cities, and each visitor then stays on the instance it got. Send three and watch which instance answers each one. {{lab:failover}} lets you break nodes yourself.',
        `At the time of writing the balancer probes every instance every ${FDM_TIMING.healthIntervalSec} seconds and stops using a dead one in about ${FDM_EJECT_SEC}. A replacement copy takes far longer: about two hours after a node dies (${LOCATION_TTL_MIN} minutes plus the image pull). An app with a \`g:\` volume sends everyone to its {{term:primary-standby}} primary, and moving to a new one takes minutes, not seconds: at least ${FDM_FAILOVER.minFailedChecks} failed checks over ${FDM_FAILOVER.minUnhealthySec} seconds, then about ${G_STANDBY_WAIT_MIN_PER_POSITION} minutes of waiting for each place a standby holds in the order.`,
      ],
      // fact: FACTS 6.4 (domain pattern, FDM, roundrobin with an 8 hour FDMSERVERID cookie, a g: app's backend is its one
      // elected primary; TCP health check every 3 s, down after 2 failures; a g: failover needs at least 3 failed checks
      // and 90 s, and a standby waits about 3 minutes per list position), 6.5 (replacement up to 125 min plus install time)
      stage: { kind: 'diorama', scene: 'traffic', instances: 3, controls: ['request'] },
      task: {
        kind: 'send-requests',
        count: 3,
        prompt: 'Send 3 requests, each from a different visitor, and watch which instance answers each one.',
      },
    },
  ],
  checkpoint: [
    {
      id: 'deployment-order',
      kind: 'order',
      prompt: 'Put the stages of a deployment in the order they happen.',
      items: [
        { id: 'sign', label: 'You sign the spec' },
        { id: 'message', label: 'A node passes it on as a registration message and returns its hash' },
        { id: 'pay', label: 'You pay the full quote, with the hash attached' },
        { id: 'block', label: 'A block confirms the payment and the app enters the chain' },
        { id: 'install', label: 'Nodes with room install the app and announce it' },
        { id: 'route', label: 'The domain starts sending requests to the running copies' },
      ],
      // fact: FACTS 6.1 rows 4 to 13
      explain:
        'The hash exists only after the message does, a payment needs the hash, and nodes install only what the chain confirms. The address is the last link because it has nothing to route to before then.',
      hint: 'Ask what each stage needs from the one before it. A payment needs something to point at, and nodes can only install what is already confirmed.',
    },
    {
      id: 'payment-window',
      kind: 'estimate',
      prompt: `FluxCloud's payment card says the window has ${PAYMENT_WINDOW_MINUTES} minutes remaining, and a block arrives about every ${TARGET_BLOCK_SEC} seconds. About how many blocks is that window?`,
      quantity: 'blocks',
      value: PAYMENT_WINDOW_BLOCKS,
      tolerance: 0.1,
      unit: 'blocks',
      // fact: FACTS 5.1 (30 s blocks), 6.6 (the 30 minute window is UI text)
      explain: `${PAYMENT_WINDOW_MINUTES} minutes is ${num(PAYMENT_WINDOW_SECONDS)} seconds, and ${num(PAYMENT_WINDOW_SECONDS)} divided by ${TARGET_BLOCK_SEC} is ${PAYMENT_WINDOW_BLOCKS} blocks, so the screen's window is about ${PAYMENT_WINDOW_BLOCKS} blocks long.`,
      hint: 'Convert the window to seconds first, then divide by the seconds in one block.',
    },
    {
      id: 'what-links-payment',
      kind: 'choice',
      prompt: 'A payment arrives at the payment address. What tells the network which app it is for?',
      options: [
        {
          id: 'hash',
          label: 'The hash of the signed registration message, in the OP_RETURN field.',
        },
        {
          id: 'sender',
          label: 'The sender address: each wallet can own one app.',
          why: 'A wallet can own many apps, and the sender is not what links a payment to one of them. The hash does.',
        },
        {
          id: 'amount',
          label: 'The amount: every app has a unique price.',
          why: 'Many apps have the same price, so the amount cannot name one of them. Pay the full quoted amount, and let the hash be what links it.',
        },
        {
          id: 'name',
          label: 'The app name, typed into the transaction.',
          why: 'The note carries the message hash, not the name. The hash covers the whole signed spec, name included.',
        },
      ],
      answer: 'hash',
      // fact: FACTS 4.7 and 6.1 row 8 (the hash in OP_RETURN links payment to message)
      explain:
        'The hash is a fingerprint of exactly what you signed. A payment that carries it names one message and nothing else, which is how nodes link money to a spec.',
      hint: 'Look at what the message returned in the register step: a short fingerprint. Which field of the payment carries it?',
    },
    {
      id: 'late-payment',
      kind: 'choice',
      prompt:
        'A deployer signs a spec, goes to lunch, and sends the right amount with the right message 90 minutes later. What happens?',
      options: [
        {
          id: 'expired',
          label: 'The message has expired, so the payment links to nothing and the app never installs.',
        },
        {
          id: 'late',
          label: 'It installs, just late. A payment never expires.',
          why: 'The temporary message lives for an hour from registration. After that there is nothing for the hash to point at.',
        },
        {
          id: 'refund',
          label: 'The payment is refunded automatically and the app is cancelled.',
          why: 'Nothing in the protocol returns a payment. Refunds are handled by support, by ticket.',
        },
        {
          id: 'wait',
          label: `A Stratus node installs it after its ${SPAWN_DEFERRAL_MIN.stratusSmallApp} minute wait.`,
          why: 'That wait applies to apps the chain has confirmed. A payment that no longer links to a message confirms nothing.',
        },
      ],
      answer: 'expired',
      // fact: FACTS 6.6 (the message lives 3,600 s on each node from receipt; the 30 minute text is UI only), 11 row 22,
      // 1.5 (refunds)
      explain: `FluxCloud's screen says ${PAYMENT_WINDOW_MINUTES} minutes, and the node's own clock is the message's ${REGISTRATION_DEADLINE_MIN} minutes from registration. At 90 minutes both have passed. Register again and pay promptly. The protocol does not return the payment already sent, so contact support by ticket about it.`,
      hint: 'The registration message is temporary. How long does it wait for money before the network forgets it?',
    },
  ],
  recap: [
    'A deployment is sign, message, pay, confirm, install, announce and route, in that order.',
    'The hash of the signed message is what links a payment to a spec, so pay the full quote with the message attached, well inside the hour the message lives.',
    'The calculator prices and the validator decides. A price on screen is not proof that a spec is valid.',
    'Nodes pick apps for themselves, small nodes first, so starting usually takes minutes and can take about two hours or more. "Deployment Successful" means one copy runs, not all of them.',
    'The balancer drops a dead instance in seconds, but a replacement copy can take about two hours, and a `g:` primary changes over in minutes.',
  ],
  further: [
    {
      label: 'Docs: review, signing and payment',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/review',
    },
    {
      label:
        'Docs: the FluxCloud cost calculator (that page still shows an old minimum of 3 instances and a g: discount that does not exist)',
      url: 'https://docs.runonflux.com/fluxcloud/cost-calculator',
    },
    {
      label: 'Docs: where an app runs, the instances tab of an app',
      url: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/instances',
    },
  ],
  terms: [
    'app-spec',
    'compose',
    'spec-version',
    'price-quote',
    'registration-message',
    'message-hash',
    'payment-address',
    'op-return',
    'spawner',
    'location',
    'fdm',
    'primary-standby',
    'app-domain',
  ],
};

export default lesson;
