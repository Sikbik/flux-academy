/**
 * Scenario `deploy-nginx` (FluxCloud MCP server, hosted): "run a small web server for a month".
 *
 * What it teaches: plan first, then confirm. `confirm` is a flag the agent sets, so the client's policy is
 * the gate; the price is the academy's `quote()` for the spec; and a plan can carry a flaw (a floating image
 * tag) that every validator accepts and only a person reading the plan catches.
 *
 * Path: identity, pricing, build, validate, quote (reads), then `flux_deploy_app` as a plan (asks), then
 * `flux_deploy_app` with confirm (asks), then wait and read the app (reads). Refusing either deploy call and
 * saying "pin the tag" sends the agent through build, quote and a second plan with `nginx:1.27`.
 *
 * Facts: FACTS 15.1.3 (keys are call arguments on the hosted server), 15.1.4 (the tools), 15.1.5 (plan then
 * confirm; confirm is a flag the agent sets), 15.1.6 and 15.1.16 (the network quote, not the local estimate),
 * 15.1.11 (wait), 6.1 and 6.3 (the screen's estimate, the image re-check).
 */

import type { Scenario } from '../types.ts';
import { hostedNote, KEYS, SPEC_LINES } from './shared.ts';
import { webSpec } from './specs.ts';

const NAME = 'my-web-server';

/** The flaw: a floating tag. `lintSpec` raises IMAGE_LATEST for it. */
export const FLAWED_IMAGE = 'nginx:latest';
/** The fix the learner asks for. */
export const FIXED_IMAGE = 'nginx:1.27';

export const deployNginx: Scenario = {
  id: 'deploy-nginx',
  card: {
    title: 'Deploy a web server',
    teaches:
      'Plan first, then confirm. The agent sets the confirm flag, so your client policy is the {{term:confirm-gate}}.',
    summary: 'You asked for a small web server. The agent prices it, asks for a plan, then wants to pay.',
  },
  server: 'flux-cloud',
  connection: 'hosted',
  start: 'ask',
  request: 'Run a small web server for me for one month.',
  showLint: ['IMAGE_LATEST'],
  specs: () => ({
    main: {
      spec: webSpec({
        name: NAME,
        description: 'A small web server for one month',
        image: FLAWED_IMAGE,
        componentName: 'web',
        componentDescription: 'nginx web server',
        port: 31080,
      }),
      expectLint: ['IMAGE_LATEST'],
    },
    fixed: {
      spec: webSpec({
        name: NAME,
        description: 'A small web server for one month',
        image: FIXED_IMAGE,
        componentName: 'web',
        componentDescription: 'nginx web server',
        port: 31080,
      }),
      expectLint: [],
    },
  }),
  beats: {
    ask: {
      id: 'ask',
      kind: 'say',
      who: 'user',
      text: 'Run a small web server for me for one month.',
      next: 'hello',
    },
    hello: {
      id: 'hello',
      kind: 'say',
      who: 'agent',
      text: 'I will check which identity and balance I have, then price the job.',
      next: 'identity',
    },
    identity: {
      id: 'identity',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_get_identity',
      args: KEYS,
      why: 'To see which Flux ID will own the app and whether the payment address can pay.',
      result: [
        { k: 'Flux ID', v: 'the address of your dedicated Flux ID key' },
        { k: 'Payment address', v: 'the address of your dedicated payment key' },
        { k: 'Spendable', v: 'enough for this job and the network fee (a simulated balance)', kind: 'ok' },
      ],
      next: 'hosted-note',
    },
    'hosted-note': hostedNote('hosted-note', 'rates-say'),
    'rates-say': {
      id: 'rates-say',
      kind: 'say',
      who: 'agent',
      text: 'Now the rate card, so I size it sensibly.',
      next: 'pricing',
    },
    pricing: {
      id: 'pricing',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_get_pricing',
      args: [],
      why: 'To read the rates before choosing a size.',
      result: [
        { k: 'Rate card', v: 'CPU, RAM and disk rates in USD, and the FLUX price' },
        { k: 'Example sizes', v: 'priced by a local estimate, not by the network', kind: 'warn' },
        { k: 'Use instead', v: 'flux_quote_app, for the price you will pay' },
      ],
      next: 'build-say',
    },
    'build-say': {
      id: 'build-say',
      kind: 'say',
      who: 'agent',
      text: 'A small nginx server is enough. I will build the specification locally.',
      next: 'build',
    },
    build: {
      id: 'build',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_build_spec',
      args: [
        { name: 'name', value: '{app}' },
        {
          name: 'components',
          value: '1 component',
          lines: ['image: {image}', 'size: {size}', 'container port: 80'],
        },
        { name: 'instances', value: '{instanceCount}' },
        { name: 'months', value: '{termMonths}' },
      ],
      why: 'To turn the description into a complete version 8 specification.',
      result: [{ v: '@spec' }, { k: 'Local errors', v: 'none', kind: 'ok' }],
      next: 'validate',
    },
    validate: {
      id: 'validate',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_validate_spec',
      args: [
        { name: 'spec', value: 'the specification from flux_build_spec' },
        { name: 'network', value: 'true' },
      ],
      why: 'To have a FluxOS node check the specification as it would at registration.',
      result: [
        { k: 'Local checks', v: 'passed', kind: 'ok' },
        { k: 'Node check', v: 'a FluxOS node verified it; nothing was registered', kind: 'ok' },
      ],
      next: 'quote',
    },
    quote: {
      id: 'quote',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_quote_app',
      args: [{ name: 'spec', value: 'the specification from flux_build_spec' }],
      why: 'To get the network price before anything is signed.',
      result: [
        { k: 'Price', v: '{usd} for {term}' },
        { k: 'FLUX to pay', v: '{flux}, at the baked FLUX price of {pricingDate}' },
        { v: "This is the number the academy's quote() gives for this specification." },
      ],
      next: 'plan-say',
    },
    'plan-say': {
      id: 'plan-say',
      kind: 'say',
      who: 'agent',
      text: 'The price is {usd} for {term}. I will ask for the plan first. Without the confirm flag nothing is signed or paid.',
      next: 'plan',
    },
    plan: {
      id: 'plan',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_deploy_app',
      args: [
        { name: 'spec', value: 'the specification', lines: SPEC_LINES },
        {
          name: 'confirm',
          value: 'not set',
          note: 'Without it the call returns the plan and spends nothing.',
        },
        ...KEYS,
      ],
      why: 'To get the plan, the price and the balance check before anything is paid.',
      result: [
        { k: 'executed', v: 'false: nothing was signed, broadcast or paid' },
        { k: 'plan', v: '{image}, {size}, {instances}, {term}' },
        { k: 'price', v: '{usd} ({flux})' },
        { k: 'payer', v: 'funded', kind: 'ok' },
        { k: 'next', v: 'Call again with confirm=true to deploy.' },
      ],
      next: 'confirm-say',
      refuseReasons: [
        {
          id: 'pin-tag',
          label: 'The image tag is not pinned. Pin a version and plan again.',
          next: 'pin-say',
        },
        { id: 'stop', label: 'Stop here. Do not plan or deploy.', next: 'stopped-say' },
      ],
    },
    'confirm-say': {
      id: 'confirm-say',
      kind: 'say',
      who: 'agent',
      text: 'The plan matches the quote and the payer is funded. I will deploy now with confirm set to true.',
      next: 'confirm',
    },
    confirm: {
      id: 'confirm',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_deploy_app',
      args: [
        { name: 'spec', value: 'the specification', lines: SPEC_LINES },
        {
          name: 'confirm',
          value: 'true',
          emphasis: 'confirm',
          note: 'The agent set this flag. It signs the message and pays {usd}.',
        },
        ...KEYS,
      ],
      why: 'To sign the specification with your Flux ID and pay the quoted amount.',
      result: [
        { k: 'executed', v: 'true', kind: 'ok' },
        { k: 'paid', v: '{usd} ({flux})' },
        { k: 'message', v: 'signed and sent to a node; its hash is in the result' },
        { k: 'transaction', v: 'the payment transaction id is in the result' },
        { k: 'next', v: 'Call flux_wait_for_app with the transaction id.' },
      ],
      effects: [
        { kind: 'spend', label: 'Deployment payment for {app}', amount: 'quote', needed: true },
        { kind: 'register', text: '{app} was registered for {term} on {instances}, running {image}.' },
      ],
      next: 'paid-say',
      refuseReasons: [
        {
          id: 'pin-tag',
          label: 'The image tag is not pinned. Pin a version and plan again.',
          next: 'pin-say',
        },
        { id: 'stop', label: 'Stop here. Do not deploy.', next: 'stopped-say' },
      ],
    },
    // ---- the fix path ------------------------------------------------------------------------------
    'pin-say': {
      id: 'pin-say',
      kind: 'say',
      who: 'agent',
      text: 'Understood. A tag like latest can point at a different image tomorrow, so I will pin a version and build the specification again.',
      effects: [{ kind: 'use-spec', key: 'fixed' }],
      next: 'build2',
    },
    build2: {
      id: 'build2',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_build_spec',
      args: [
        { name: 'name', value: '{app}' },
        {
          name: 'components',
          value: '1 component',
          lines: ['image: {image}', 'size: {size}', 'container port: 80'],
        },
        { name: 'instances', value: '{instanceCount}' },
        { name: 'months', value: '{termMonths}' },
      ],
      why: 'To rebuild the specification with a pinned image.',
      result: [{ v: '@spec' }, { k: 'Local errors', v: 'none', kind: 'ok' }],
      next: 'quote2',
    },
    quote2: {
      id: 'quote2',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_quote_app',
      args: [{ name: 'spec', value: 'the new specification' }],
      why: 'To check the price has not changed.',
      result: [
        { k: 'Price', v: '{usd} for {term}' },
        { k: 'FLUX to pay', v: '{flux}, at the baked FLUX price of {pricingDate}' },
        { v: 'The tag does not change the price: the size and the term are the same.' },
      ],
      next: 'plan2-say',
    },
    'plan2-say': {
      id: 'plan2-say',
      kind: 'say',
      who: 'agent',
      text: 'Same price. Asking for the plan again, without confirm.',
      next: 'plan2',
    },
    plan2: {
      id: 'plan2',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_deploy_app',
      args: [
        { name: 'spec', value: 'the specification', lines: SPEC_LINES },
        {
          name: 'confirm',
          value: 'not set',
          note: 'Without it the call returns the plan and spends nothing.',
        },
        ...KEYS,
      ],
      why: 'To get the plan for the pinned specification.',
      result: [
        { k: 'executed', v: 'false: nothing was signed, broadcast or paid' },
        { k: 'plan', v: '{image}, {size}, {instances}, {term}' },
        { k: 'price', v: '{usd} ({flux})' },
        { k: 'payer', v: 'funded', kind: 'ok' },
        { k: 'next', v: 'Call again with confirm=true to deploy.' },
      ],
      next: 'confirm2-say',
      refused: 'stopped-say',
    },
    'confirm2-say': {
      id: 'confirm2-say',
      kind: 'say',
      who: 'agent',
      text: 'The plan names a pinned version. I will deploy now with confirm set to true.',
      next: 'confirm2',
    },
    confirm2: {
      id: 'confirm2',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_deploy_app',
      args: [
        { name: 'spec', value: 'the specification', lines: SPEC_LINES },
        {
          name: 'confirm',
          value: 'true',
          emphasis: 'confirm',
          note: 'The agent set this flag. It signs the message and pays {usd}.',
        },
        ...KEYS,
      ],
      why: 'To sign the pinned specification and pay the quoted amount.',
      result: [
        { k: 'executed', v: 'true', kind: 'ok' },
        { k: 'paid', v: '{usd} ({flux})' },
        { k: 'message', v: 'signed and sent to a node; its hash is in the result' },
        { k: 'transaction', v: 'the payment transaction id is in the result' },
        { k: 'next', v: 'Call flux_wait_for_app with the transaction id.' },
      ],
      effects: [
        { kind: 'spend', label: 'Deployment payment for {app}', amount: 'quote', needed: true },
        { kind: 'register', text: '{app} was registered for {term} on {instances}, running {image}.' },
      ],
      next: 'paid-say',
      refused: 'stopped-say',
    },
    // ---- the tail ----------------------------------------------------------------------------------
    'paid-say': {
      id: 'paid-say',
      kind: 'say',
      who: 'agent',
      text: 'Paid. Now I wait for the app to be published and its copies to start.',
      next: 'wait',
    },
    wait: {
      id: 'wait',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_wait_for_app',
      args: [
        { name: 'name', value: '{app}' },
        { name: 'txid', value: 'the payment transaction id from the last call' },
      ],
      why: 'To know when the app is published and its instances are located.',
      result: [
        { k: 'done', v: 'true', kind: 'ok' },
        { k: 'payment', v: 'confirmed' },
        { k: 'published', v: 'yes' },
        { k: 'running', v: '{instanceCount} of {instanceCount} instances located' },
        {
          k: 'simulation',
          v: 'Here the wait ends at once. On the network it takes minutes, and the FluxCloud screen says up to {deployEstimate} after payment: an estimate, not a promise.',
        },
      ],
      next: 'get',
    },
    get: {
      id: 'get',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_get_app',
      args: [{ name: 'name', value: '{app}' }],
      why: 'To read back what is published and where it runs.',
      result: [
        { k: 'address', v: '{url}' },
        { k: 'image', v: '{image}' },
        { k: 'term', v: '{term}' },
        { k: 'running', v: '{instanceCount} instances located' },
      ],
      next: 'done-say',
    },
    'done-say': {
      id: 'done-say',
      kind: 'say',
      who: 'agent',
      text: 'Done. Your web server is running at {url}.',
      next: 'tail',
    },
    tail: { id: 'tail', kind: 'branch', spec: 'fixed', match: 'end-pinned', otherwise: 'end-floating' },
    'end-pinned': { id: 'end-pinned', kind: 'end', ending: 'deployed-pinned' },
    'end-floating': { id: 'end-floating', kind: 'end', ending: 'deployed-floating' },
    'stopped-say': {
      id: 'stopped-say',
      kind: 'say',
      who: 'agent',
      text: 'Understood. I have signed nothing and paid nothing.',
      next: 'end-declined',
    },
    'end-declined': { id: 'end-declined', kind: 'end', ending: 'declined' },
  },
  endings: {
    'deployed-pinned': {
      id: 'deployed-pinned',
      title: 'Deployed with a pinned image',
      verdict: 'good',
      goal: true,
      summary:
        'The plan named a floating tag. You refused, asked for a pinned version, read the new plan and approved it. The price was the quote you had already seen.',
      takeaway:
        'Read the plan before the confirm call. It is the one moment the details of the payment are in front of you.',
    },
    'deployed-floating': {
      id: 'deployed-floating',
      title: 'Deployed with a floating tag',
      verdict: 'flawed',
      goal: false,
      summary:
        'The plan used {image}, a tag that can point at a different image tomorrow. The app runs and the price was the quote, but the flaw went through. The validator accepted it, because a floating tag is allowed.',
      takeaway:
        'A validator checks that a specification is allowed, not that it is wise. Reading the plan is your part of the work.',
      silent: {
        tools: ['flux_deploy_app'],
        takeaway:
          'No prompt appeared, so the plan and the payment ran back to back and nobody read the plan. The agent sets the confirm flag: your policy is the only gate.',
      },
    },
    declined: {
      id: 'declined',
      title: 'Stopped before the payment',
      verdict: 'stopped',
      goal: false,
      summary: 'Nothing was signed, broadcast or paid, and the app was not deployed.',
      takeaway:
        'Refusing costs nothing. Say what to change and the agent plans again, so a refusal is the start of a fix, not the end of the job.',
    },
  },
  facts: [
    {
      text: 'Without confirm, flux_deploy_app returns the plan and spends nothing. With confirm set to true it signs the message, sends it to a node and pays.',
      ref: '15.1.5',
      basis: 'verified',
    },
    {
      text: 'confirm is a flag the agent sets, not a question to a person. The server cannot tell whether anyone agreed; only your client and the agent following its instructions put a person in the loop.',
      ref: '15.1.5',
      basis: 'verified',
    },
    {
      text: 'flux_quote_app and the plan use the network calculator, the price FluxCloud shows. flux_get_pricing example sizes are a local estimate and can differ.',
      ref: '15.1.16',
      basis: 'verified',
    },
    {
      text: 'On the hosted server the two private keys are arguments of the calls that need them. They pass through your AI vendor and the chat history. Run the server on your machine and they stay in its process.',
      ref: '15.1.3',
      basis: 'verified',
    },
    {
      text: 'Nodes compare the image behind a tag about every {imageRecheck} and redeploy when it changed, so a floating tag can change under a running app. Read from the source, not observed live.',
      ref: '6.3',
      basis: 'verified',
    },
    {
      text: 'The FluxCloud screen says up to {deployEstimate} after payment. That is a fixed string, an estimate and not a promise.',
      ref: '6.1',
      basis: 'verified',
    },
  ],
};
