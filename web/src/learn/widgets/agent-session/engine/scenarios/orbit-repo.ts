/**
 * Scenario `orbit-repo` (Orbit MCP server, signed in as your account): "deploy my repository".
 *
 * What it teaches: the Orbit server has a different identity model from the FluxCloud one. The agent acts as
 * your signed-in Orbit account and holds no private key. Registering is a tool call your client can gate,
 * and paying is a checkout page that only the person can complete, so even a client that asks for nothing
 * cannot make the agent pay.
 *
 * Orbit tool arguments are not published (FACTS 15.4.9), so every call here shows the tool name and the
 * documented summary only. Nothing is invented: results say what the guide says the tool reports. Prices are
 * `orbitPlanQuoteUsd(plan)`. The generated app is a plain version 8 spec (FACTS 15.3.1).
 *
 * Facts: FACTS 15.4.2 (identity), 15.4.3 (the tools, the five to confirm), 15.4.4 (the safe workflow), 15.4.6
 * (do not repeat a mutating call after a timeout), 15.4.7 and 15.4.8 (payment, contrast), 15.3.1 and 15.3.11
 * (the app is a plain spec, the plan prices equal quote()).
 */

import type { Scenario } from '../types.ts';
import { orbitSpec } from './specs.ts';

/** The five tools the Orbit guide asks you to confirm (FACTS 15.4.3, "Tools to confirm in the client"). */
export const ORBIT_CONFIRM_TOOLS = [
  'deploy_app',
  'trigger_build',
  'control_instance',
  'update_app',
  'renew_app',
] as const;

export const orbitRepo: Scenario = {
  id: 'orbit-repo',
  card: {
    title: 'Deploy a Git repository',
    teaches:
      'As its guide describes it, the Orbit server acts as your signed-in account and sends you to a checkout. The agent holds no key, and you complete the payment on that page.',
    summary:
      'You asked the Orbit agent to deploy a repository on a plan. Registering is a call; paying is a checkout page that you complete.',
  },
  server: 'orbit',
  connection: 'account',
  start: 'ask',
  request: 'Deploy my repository {repo} on the {planName} plan.',
  showLint: ['INSTANCES_ONE'],
  specs: (options) => ({
    main: { spec: orbitSpec(options.plan ?? 'standard'), expectLint: ['IMAGE_LATEST'] },
  }),
  beats: {
    ask: {
      id: 'ask',
      kind: 'say',
      who: 'user',
      text: 'Deploy my repository {repo} on the {planName} plan.',
      next: 'hello',
    },
    hello: {
      id: 'hello',
      kind: 'say',
      who: 'agent',
      text: "First I check the repository against Orbit's rules, then I look at the plans.",
      next: 'analyze',
    },
    analyze: {
      id: 'analyze',
      kind: 'call',
      server: 'orbit',
      tool: 'analyze_repository',
      args: [],
      argsUnknown: true,
      why: 'To find out what Orbit would detect: the runtime, the port, the branch and the project folder.',
      result: [
        {
          k: 'documented',
          v: 'reports the detected runtime, port, branch and project directory',
        },
        { v: 'The simulation shows no values: the guide documents what the tool reports, not its output.' },
      ],
      next: 'plans-say',
    },
    'plans-say': {
      id: 'plans-say',
      kind: 'say',
      who: 'agent',
      text: 'Now the plans, so I can compare them.',
      next: 'plans',
    },
    plans: {
      id: 'plans',
      kind: 'call',
      server: 'orbit',
      tool: 'list_plans',
      args: [],
      argsUnknown: true,
      why: 'To compare the plans before choosing.',
      result: [{ v: '@plans' }],
      next: 'validate',
    },
    validate: {
      id: 'validate',
      kind: 'call',
      server: 'orbit',
      tool: 'validate_deployment',
      args: [],
      argsUnknown: true,
      why: 'To see the generated specification and the network price before registering anything.',
      result: [
        { v: '@spec' },
        { k: 'price', v: '{planUsd} for {term}' },
        { k: 'nothing registered', v: 'this tool only previews', kind: 'ok' },
        {
          v: 'The generated app is an ordinary version 8 specification: one component running the Orbit image, owned by an ordinary Flux ID.',
        },
      ],
      next: 'deploy-say',
    },
    'deploy-say': {
      id: 'deploy-say',
      kind: 'say',
      who: 'agent',
      text: 'The plan is {planName}: {planInstances}, {planSize}, {planUsd} for {term}. I will register it now.',
      next: 'deploy',
    },
    deploy: {
      id: 'deploy',
      kind: 'call',
      server: 'orbit',
      tool: 'deploy_app',
      args: [],
      argsUnknown: true,
      why: 'To register the approved app on the network and test the installation.',
      result: [
        { k: 'documented', v: 'registers the app, tests the installation and returns a Flux transaction id' },
        { k: 'payment', v: 'none yet: paying is a checkout that you complete', kind: 'ok' },
      ],
      effects: [
        { kind: 'register', text: 'The app was registered for {term}: {planName}, {planInstances}.' },
      ],
      next: 'checkout-say',
      refused: 'declined-say',
    },
    'checkout-say': {
      id: 'checkout-say',
      kind: 'say',
      who: 'agent',
      text: 'Registered. To pay, I create the checkout for that transaction.',
      next: 'checkout',
    },
    checkout: {
      id: 'checkout',
      kind: 'call',
      server: 'orbit',
      tool: 'create_stripe_checkout',
      args: [],
      argsUnknown: true,
      why: 'To get the payment page at the price the server calculates.',
      result: [
        {
          k: 'documented',
          v: 'creates a Stripe checkout for the transaction at the server-calculated price',
        },
        { k: 'amount', v: '{planUsd} for {term}' },
        { v: 'You pay on that page. The agent cannot press anything on it.' },
      ],
      next: 'human',
      refused: 'unpaid-say',
    },
    human: {
      id: 'human',
      kind: 'human',
      title: 'The checkout page',
      text: 'The agent created a checkout for {planUsd}. Paying is your step: the Orbit guide describes the checkout as a page that you complete.',
      // The safer choice comes first, so it is the one a keyboard lands on.
      choices: [
        { id: 'close', label: 'Close the page without paying', next: 'closed-say' },
        {
          id: 'pay',
          label: 'Pay on the checkout page',
          effects: [{ kind: 'spend', label: 'Orbit {planName} plan, {term}', amount: 'plan', needed: true }],
          next: 'status',
        },
      ],
    },
    status: {
      id: 'status',
      kind: 'call',
      server: 'orbit',
      tool: 'get_deployment_status',
      args: [],
      argsUnknown: true,
      why: 'To check where the deployment is.',
      result: [
        { k: 'documented', v: 'reports the registration state and the live locations' },
        { v: 'Locations appear as nodes finish installing the app.' },
      ],
      next: 'done-say',
    },
    'done-say': {
      id: 'done-say',
      kind: 'say',
      who: 'agent',
      text: 'Your app is registered and paid. It is live when its nodes finish installing it.',
      next: 'end-deployed',
    },
    'end-deployed': { id: 'end-deployed', kind: 'end', ending: 'deployed' },
    'declined-say': {
      id: 'declined-say',
      kind: 'say',
      who: 'agent',
      text: 'Understood. Nothing is registered and nothing is charged.',
      next: 'end-declined',
    },
    'end-declined': { id: 'end-declined', kind: 'end', ending: 'declined' },
    'unpaid-say': {
      id: 'unpaid-say',
      kind: 'say',
      who: 'agent',
      text: 'Understood. I did not create a checkout, so nothing is charged. The app is registered but unpaid.',
      next: 'end-unpaid',
    },
    'end-unpaid': { id: 'end-unpaid', kind: 'end', ending: 'registered-unpaid' },
    'closed-say': {
      id: 'closed-say',
      kind: 'say',
      who: 'agent',
      text: 'The checkout was closed without payment, so nothing was charged.',
      next: 'end-closed',
    },
    'end-closed': { id: 'end-closed', kind: 'end', ending: 'unpaid' },
  },
  endings: {
    deployed: {
      id: 'deployed',
      title: 'Deployed, paid on the checkout page',
      verdict: 'good',
      goal: true,
      summary:
        'The agent previewed the plan, registered the app and created the checkout. You paid on the page yourself, at the price the plan states. The agent never held a key.',
      takeaway:
        'With Orbit, as its guide describes it, the money moves on a checkout page that you complete, so your policy decides what the agent may register, not what it can pay.',
    },
    declined: {
      id: 'declined',
      title: 'Nothing registered',
      verdict: 'stopped',
      goal: false,
      summary: 'You refused the registration, so nothing was registered and nothing was charged.',
      takeaway:
        'Refusing costs nothing. The preview calls ran first, which is how you saw the plan and the price before deciding.',
    },
    'registered-unpaid': {
      id: 'registered-unpaid',
      title: 'Registered, no checkout',
      verdict: 'stopped',
      goal: false,
      summary: 'The app was registered, you refused the checkout, and nothing was charged.',
      takeaway:
        'Registering and paying are separate calls. You can stop between them, and nothing is charged until you complete a checkout.',
    },
    unpaid: {
      id: 'unpaid',
      title: 'Registered, not paid',
      verdict: 'stopped',
      goal: false,
      summary:
        'You closed the checkout page without paying, so nothing was charged and the app will not run.',
      takeaway: 'Nothing moves until you complete the checkout, which is your step.',
    },
  },
  facts: [
    {
      text: 'The Orbit server acts as your signed-in Orbit account, with a short-lived credential. No private key is given to the agent. At the time of writing a wallet-only ZelCore or SSP session cannot connect an agent.',
      ref: '15.4.2',
      basis: 'docs',
    },
    {
      text: 'deploy_app registers the app and returns a Flux transaction id. Paying is a Stripe checkout that you complete.',
      ref: '15.4.7',
      basis: 'docs',
    },
    {
      text: 'The guide asks you to confirm five tools: deploy_app, trigger_build, control_instance, update_app and renew_app. Its FAQ adds payments.',
      ref: '15.4.3',
      basis: 'docs',
    },
    {
      text: 'The FluxCloud MCP server is a different product. Its agent holds two private keys, and a call with confirm set signs and pays FLUX on chain with no checkout page. A rule that holds for one server is not a rule for the other.',
      ref: '15.4.8',
      basis: 'verified',
    },
    {
      text: 'The generated app is a plain version 8 specification with one component running runonflux/orbit:latest. Each plan price equals quote() for its size; no builder fee is visible.',
      ref: '15.3.11',
      basis: 'verified',
    },
    {
      text: 'Tool argument names are not published without an account, so this simulation shows tool names and the documented summary only.',
      ref: '15.4.9',
      basis: 'guidance',
    },
    {
      text: 'After a timeout, retry a read-only call once. Do not repeat a mutating call before checking its transaction id or the deployment status.',
      ref: '15.4.6',
      basis: 'docs',
    },
    {
      text: 'Redaction covers known secret patterns only. Text the app prints into its own logs may not be recognised, so treat logs as sensitive.',
      ref: '15.4.5',
      basis: 'guidance',
    },
  ],
};
