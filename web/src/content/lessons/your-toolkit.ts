/**
 * Lesson 4, your-toolkit: the short list of things to have before a first registration. A public image, a
 * login, a way to pay and a half hour. Planted failure: a private image with its credentials in a public spec.
 *
 * Facts: docs/research/FACTS.md. Each fact is tagged `// fact: FACTS <section>` on the data it supports.
 * The floor price and the FLUX discount come from the pricing engine's baked parameters; the price chip in
 * the spec stage comes from `quote()`. No computed price is typed into prose.
 */

import { secondsToBlocks } from '@shared/flux/blocks';
import { BAKED_PRICING } from '@shared/flux/pricing';
import {
  DEPLOY_ESTIMATE_MIN,
  PAYMENT_WINDOW_MIN,
  REGISTRATION_DEADLINE_MIN,
  UI_WATCHER_MIN,
} from '@shared/flux/timing';
import type { Lesson } from '@/learn/types';

/**
 * FluxCloud's payment card says "Payment window: 30 minutes remaining", and its screen says deployment takes up
 * to 45 minutes after payment. Both are fixed UI text at the time of writing (no timer, nothing ties the 30 to the
 * message lifetime), and the 45 is an estimate and not a guarantee. The node-side deadline is the registration
 * message's hour, counted from registration on each node. FACTS 6.6. The values come from the engine.
 */
const PAYMENT_WINDOW_MINUTES = PAYMENT_WINDOW_MIN;
const DEPLOY_ESTIMATE_MINUTES = DEPLOY_ESTIMATE_MIN;
const PAYMENT_WINDOW_BLOCKS = secondsToBlocks(PAYMENT_WINDOW_MINUTES * 60);

/** What FluxCloud's new-app form starts with, per instance (FACTS 9.4.2). The spec stage below uses the same. */
const FORM_START = { cpu: 1, ram: 2000, hdd: 20 } as const;

const num = (v: number): string => v.toLocaleString('en-US');

const floorUsd = BAKED_PRICING.params.minUSDPrice;
const fluxDiscountPct = Math.round((1 - BAKED_PRICING.params.fluxmultiplier) * 100);

const lesson: Lesson = {
  id: 'your-toolkit',
  hook: 'A first deployment can stall on something small: an image that is private, a login nobody set up, a payment that arrives late. You will check each of them now, so that the real registration goes through in one sitting.',
  objectives: [
    'List what you need before a first registration, and what you can skip.',
    'Say who signs for an SSO account and who signs for a wallet account.',
    'Choose a way to pay and say what each costs.',
    'Plan the payment window so that your registration message does not expire under you.',
  ],
  steps: [
    {
      id: 'checklist',
      title: 'Before you register',
      body: [
        "Registering on {{term:fluxcloud}}, the dashboard at cloud.runonflux.com, goes smoothly when five things are in place: a login, a public image, a way to pay, enough to cover one period and a clear half hour. The checklist lists them with the real link for each. Tick what you have, mark what you will do later and watch the readiness meter. FluxCloud's form also asks for a contact email, which goes into the spec.",
        'Docker on your own machine is optional, because any public image can be deployed as it is. The image has to be public, since nodes pull it without credentials. A private image needs an {{term:enterprise-app}}: a spec encrypted so that only ArcaneOS nodes can read it.',
      ],
      callouts: [
        {
          kind: 'wild',
          // fact: FACTS 1.2 (Marketplace templates, Flux Orbit deploys from Git), 9.8.1 (Orbit: own portal, checkout, plans)
          body: 'A hand-written spec is not the only way in. The {{term:marketplace}} has one-click templates for games and apps, and it fills in a spec for you to sign and pay for. {{term:flux-orbit}} builds a Git repository for you, and it is its own portal, with its own checkout and plans.',
        },
      ],
      // fact: FACTS 3.3 and 3.7 (public images; repoauth only on enterprise apps), 9.14 (FluxCloud)
      stage: { kind: 'widget', id: 'readiness-checklist' },
      task: {
        kind: 'widget',
        prompt: 'Go through the checklist until every item is ticked or marked for later.',
      },
    },
    {
      id: 'login',
      title: 'Two ways to sign in',
      body: [
        'FluxCloud has one login screen and two kinds of account. With {{term:sso}} you sign in with email, Google or Apple, and FluxCloud signs for you: you hold no key and there is no wallet to set up. With a wallet such as {{term:zelcore}} or {{term:ssp}}, you hold the key and you sign every registration yourself.',
        "Whichever you use, the spec's `owner` is the identity that the network checks each signature against: the Flux ID of the wallet that signs, a {{term:zelid}} or an Ethereum address. The trade is convenience against control. SSO is the quickest start, and a wallet means nobody signs for you. Open [FluxCloud](https://cloud.runonflux.com) in another tab and look at the login options.",
      ],
      callouts: [
        {
          kind: 'gotcha',
          title: 'The contact is public',
          // fact: FACTS 3.2 (contacts are public unless the app is enterprise; FluxCloud's FORM requires an email and SSO fills
          // it, the protocol accepts `contacts: []`; who sends deployment or expiry notices is UNVERIFIED), 9.2
          body: "The contact email goes into the spec, and anyone can read a public spec. FluxCloud's form requires one, and SSO accounts fill in their account email and lock it. The network itself accepts an empty list, and who sends notices to it is not documented. Use an address you are happy to publish.",
        },
        {
          kind: 'gotcha',
          title: 'Which address is the owner',
          // fact: FACTS 3.2 (owner: a base58check Flux ID starting with 1, 25 to 34 characters, or 0x + 40 hex; a t1...
          // address was refused live 2026-10-13)
          body: 'The `owner` has to be a Flux ID, a base58 address that starts with `1`, or an Ethereum address (`0x` and 40 hex characters). A transparent address that starts with `t1` is a payment address, not an owner, and the network refuses it.',
        },
      ],
      // fact: FACTS 9.2 (login options; SSO users hold no key, a signing service signs for them)
      stage: {
        kind: 'compare',
        left: {
          label: 'An SSO account',
          tone: 'neutral',
          body: 'Email, Google or Apple. FluxCloud signs your registrations for you, so there is no Sign Message button and no wallet to install. You hold no key, and the contact email is filled in from the account.',
        },
        right: {
          label: 'A wallet',
          tone: 'neutral',
          body: 'ZelCore, SSP, MetaMask or WalletConnect. You hold the key and sign each message in the wallet, or by pasting a signature. Nobody signs for you, and if you lose the key you lose control of the app.',
        },
      },
      task: {
        kind: 'confirm',
        label: 'I opened FluxCloud and looked at the login options',
        prompt: 'Open FluxCloud in another tab and find the login options.',
      },
    },
    {
      id: 'paying',
      title: 'What a month costs, and the floor',
      body: [
        // fact: FACTS 9.5.1 (Stripe or PayPal, or FLUX; the docs warn against paying from an exchange), 1.5 (wrapped FLUX does
        // not pay: inferred from the payment detection code), 4.4 (fluxmultiplier)
        `You can pay by card (Stripe or PayPal, shown plus VAT) or in native FLUX from a wallet you control. Prices are set in USD. The FLUX amount is that price at the going rate times ${BAKED_PRICING.params.fluxmultiplier}, a factor the network calls the {{term:flux-multiplier}}, so at the time of writing paying in FLUX is ${fluxDiscountPct} percent cheaper.`,
        // fact: FACTS 4.7 (the node accepts any payment at or above the on-chain table price and drops one below it as
        // underpaid; FluxCloud asks for the quote; the card relay refuses below 98 percent of it)
        "Whichever way you pay, pay the full quoted amount. FluxCloud asks for it, and the card relay needs at least 98 percent of it. A payment below the network's own floor, which is much lower than the quote, is dropped as underpaid.",
        `At the time of writing, FluxCloud's new-app form starts at ${FORM_START.cpu} core, ${num(FORM_START.ram)} MB of RAM and ${FORM_START.hdd} GB of disk per instance, and this spec runs three instances. A hello server needs a fraction of that. Size it down and watch the price chip: it stops falling at a floor.`,
      ],
      callouts: [
        {
          kind: 'cost',
          // fact: FACTS 4.4 (minimum price USD 0.99 after every discount), 4.1 (rate card)
          body: `At the time of writing the network charges at least USD ${floorUsd} for a subscription, however far you shrink the app. A tiny app and a tinier one cost the same, so size to what the app needs, not to the floor.`,
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'hello-flux',
          description: 'Hello world, served by Flux',
          instances: 3,
          compose: [{ ...FORM_START }],
        },
        editable: ['compose[0].cpu', 'compose[0].ram', 'compose[0].hdd'],
        focus: [{ path: 'compose[0].cpu', note: 'CPU costs the most per unit. Start here.' }],
        show: ['form', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: 'Size the app down until the price stops falling.',
        hint: 'CPU, RAM and disk each add to the price. Lower all three and watch the chip: when it stops moving, you are at the floor.',
        check: {
          price: 'max',
          usd: floorUsd,
          message:
            'The price is still above the network minimum. Lower CPU, RAM or disk until it stops falling.',
        },
        solution: { compose: [{ cpu: 0.1, ram: 100, hdd: 1 }] },
      },
    },
    {
      id: 'clock',
      title: 'The clock starts when you register',
      body: [
        `The registration message lives for ${REGISTRATION_DEADLINE_MIN} minutes on each node, counted from when that node receives it, which is seconds after you register. It is not counted from signing, and not from when the payment screen appears. After the optional install test, FluxCloud's payment card shows the fixed text "Payment window: ${PAYMENT_WINDOW_MINUTES} minutes remaining", about ${PAYMENT_WINDOW_BLOCKS} blocks. It is not a counter, and nothing ties it to the hour, so treat the half hour as your budget.`,
        `After payment, FluxCloud's screen says deployment takes up to ${DEPLOY_ESTIMATE_MINUTES} minutes. That is a fixed label and an estimate, not a guarantee, though a first node usually starts installing within a few minutes. The page then watches for ${UI_WATCHER_MIN} minutes and shows "Deployment Successful" once one copy is running, not all of them. If it times out it stops watching and the deployment carries on.`,
        'If the hour passes before the payment is confirmed, the app does not install, and the fix is to register again. The protocol does not return a late payment: refunds go through support, by ticket. A card payment follows the same clock, because the relay makes the same transaction. Have the funds ready before you open the wizard, not after.',
      ],
      // fact: FACTS 6.6 (message TTL 3,600 s from receipt on each node; "Payment window: 30 minutes remaining" is a UI string
      // shown after the test install, not a counter; the UI watcher is 30 min and "Deployment Successful" means one copy),
      // 9.5.1 (up to 45 minutes, usually 1 to 3), 5.1 (30 s blocks), 1.5 (refunds are handled by support), 4.7 (the card
      // path is a relay that pays the chain)
      stage: { kind: 'diagram', id: 'block-clock', beat: 0 },
    },
  ],
  checkpoint: [
    {
      id: 'private-image',
      kind: 'spec-fix',
      prompt:
        'A teammate pasted registry credentials into a public spec. Fix it so the network would not refuse it, and keep the image.',
      spec: {
        name: 'team-api',
        description: 'Team API',
        instances: 3,
        compose: [
          {
            name: 'api',
            description: 'Team API',
            repotag: 'maya/todo-api:2.3.1',
            ports: [31001],
            containerPorts: [8000],
            domains: [''],
            environmentParameters: [],
            commands: [],
            containerData: '/tmp',
            repoauth: 'maya:example-token',
            cpu: 0.5,
            ram: 500,
            hdd: 5,
          },
        ],
      },
      check: {
        all: [
          {
            lint: 'absent',
            codes: ['REPOAUTH_NEEDS_ENTERPRISE'],
            message: 'The spec still carries credentials in `repoauth`, and a public spec is not allowed to.',
          },
          {
            path: 'compose[0].repotag',
            op: 'eq',
            value: 'maya/todo-api:2.3.1',
            message: 'Keep the image. The fix is in the credentials, not in the name.',
          },
        ],
      },
      solution: { compose: [{ repoauth: '' }] },
      // fact: FACTS 3.7 and 11 row 6 (private images need enterprise), 11 row 18 (a public spec is readable)
      explain:
        'The network only allows credentials on an enterprise app, whose spec is encrypted. In a public spec they would be readable through the API. Make the image public, or make the app enterprise.',
      hint: 'The issues panel names the field. A public spec has no private values: what does an empty `repoauth` mean for the image?',
    },
    {
      id: 'price-floor',
      kind: 'estimate',
      prompt:
        'What does this cost per month, in USD: 0.5 cores, 500 MB of RAM and 5 GB of disk, on three instances?',
      spec: {
        name: 'estimate-me',
        instances: 3,
        compose: [{ cpu: 0.5, ram: 500, hdd: 5 }],
      },
      quantity: 'usd-per-month',
      tolerance: 0.1,
      unit: 'USD',
      // fact: FACTS 4.4 (the minimum price) and 9.5.3 (spot check)
      explain:
        'Three instances of a small app price below the network minimum, so the minimum is what you pay. That is why a smaller app costs the same.',
      hint: 'Work out what the resources add up to, then remember what the network does with a total that low.',
    },
    {
      id: 'who-signs',
      kind: 'choice',
      prompt:
        'You log in to FluxCloud with Google and register an app. Who produces the signature the network checks?',
      options: [
        {
          id: 'service',
          label: 'A signing service run for FluxCloud, on your behalf.',
        },
        {
          id: 'google',
          label: 'Your Google account, which holds a Flux key.',
          why: 'Google only proves to FluxCloud who you are. It holds no Flux key and signs nothing for the network.',
        },
        {
          id: 'browser',
          label: 'Your browser, with a key it created for you.',
          why: 'An SSO user holds no key at all, in the browser or anywhere else. That is what makes SSO quick to start.',
        },
        {
          id: 'nobody',
          label: 'Nobody. SSO apps are registered without a signature.',
          why: 'Every registration and update is signed. A message without a valid signature is refused.',
        },
      ],
      answer: 'service',
      // fact: FACTS 9.2 (SSO users hold no key; the UI sends the message to a signing service)
      explain:
        'An SSO user holds no key. FluxCloud sends the message to a signing service and gets the signature back, which is why the Sign Message button is hidden.',
      hint: 'Think about what an SSO user does not have, then ask who else could sign.',
    },
    {
      id: 'before-register',
      kind: 'multi',
      prompt: 'Which of these do you need before you register a first app? Pick all that apply.',
      options: [
        { id: 'image', label: 'A public image on a registry.' },
        { id: 'login', label: 'A FluxCloud login, SSO or a wallet.' },
        { id: 'payment', label: 'A way to pay: a card, or native FLUX in a wallet you control.' },
        {
          id: 'docker',
          label: 'Docker installed on your laptop.',
          why: 'Optional. Any public image can be deployed as it is, and a build service can make your own.',
        },
        {
          id: 'collateral',
          label: 'FLUX locked as collateral.',
          why: 'Collateral is what node operators lock to run a node. Deployers do not need it.',
        },
        {
          id: 'domain',
          label: 'A domain name of your own.',
          why: 'Optional. Every app gets a free address under app.runonflux.io.',
        },
      ],
      answers: ['image', 'login', 'payment'],
      // fact: FACTS 3.3, 9.2, 9.5.1, 6.4
      explain:
        'Of these, an image, a login and a way to pay are required. Docker, a domain and collateral are all optional or belong to someone else.',
      hint: 'Ask of each item: would the registration stall without it, or does it only make something nicer?',
    },
  ],
  recap: [
    'You need a login, a public image, a way to pay, enough to cover one period and a clear half hour. Local Docker is optional.',
    'SSO signs for you and holds the key. A wallet means you sign, and you can lose the key.',
    `Card pays the USD price plus VAT. FLUX pays ${fluxDiscountPct} percent less, and it has to be native FLUX on the Flux chain. Pay the full quoted amount either way.`,
    `No subscription costs less than the network minimum, USD ${floorUsd} at the time of writing, so size to what the app needs.`,
    `Have the funds ready before you register. The screen says ${PAYMENT_WINDOW_MINUTES} minutes to pay, the message lasts ${REGISTRATION_DEADLINE_MIN} minutes from registration, and the up to ${DEPLOY_ESTIMATE_MINUTES} minute deployment estimate is not a guarantee. "Deployment Successful" means one copy runs.`,
  ],
  further: [
    {
      label: 'Docs: review, signing and payment',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/review',
    },
    {
      label:
        'Docs: the cost calculator (that page still shows an old minimum of 3 instances and a g: discount that does not exist)',
      url: 'https://docs.runonflux.com/fluxcloud/cost-calculator',
    },
    { label: 'FluxCloud, the real dashboard', url: 'https://cloud.runonflux.com' },
  ],
  terms: [
    'fluxcloud',
    'enterprise-app',
    'marketplace',
    'flux-orbit',
    'sso',
    'zelcore',
    'ssp',
    'zelid',
    'flux-multiplier',
  ],
};

export default lesson;
