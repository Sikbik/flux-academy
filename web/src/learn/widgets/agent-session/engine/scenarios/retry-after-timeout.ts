/**
 * Scenario `retry-after-timeout` (FluxCloud MCP server, hosted): a wait that timed out after a confirmed
 * deploy.
 *
 * What it teaches: `flux_wait_for_app` timing out means the answer is not in yet, not that the deployment
 * failed. The scripted agent misreads it and proposes the confirmed deploy again, which signs a new message
 * and pays the whole quote a second time. The right move is to read the app (`flux_get_app`) and wait again,
 * both reads. If the second payment goes through, the agent then reaches for `flux_cancel_app` as an undo,
 * which ends the one app there is and refunds nothing.
 *
 * Facts: FACTS 15.1.5 and 15.1.6 (each confirmed call signs a fresh message and pays), 15.1.7 (a payment is
 * recorded against one message hash; a second payment for it is ignored; an underpaid message is not
 * stored), 15.1.8 (cancel: about an hour, nothing refunded, data removed), 15.1.11 (wait: timedOut, safe to
 * repeat), 6.6 (the message lives one hour on each node). What the network does with a second signed message
 * for a name that is already registered or pending is NOT in FACTS: the scenario says so and gives guidance.
 */

import type { Scenario } from '../types.ts';
import { hostedNote, KEYS, SPEC_LINES } from './shared.ts';
import { webSpec } from './specs.ts';

export const retryAfterTimeout: Scenario = {
  id: 'retry-after-timeout',
  card: {
    title: 'A wait that timed out',
    teaches: 'A timeout is not a failure. Paying again, or cancelling, does not undo anything.',
    summary:
      'A confirmed deploy is waiting on the network. The wait runs out of time and the agent wants to pay again.',
  },
  server: 'flux-cloud',
  connection: 'hosted',
  start: 'ask',
  request: 'Deploy my small site and tell me when it is live.',
  specs: () => ({
    main: {
      spec: webSpec({
        name: 'my-site',
        description: 'A small site',
        image: 'nginx:1.27',
        componentName: 'site',
        componentDescription: 'nginx serving a site',
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
      text: 'Deploy my small site and tell me when it is live.',
      next: 'earlier-note',
    },
    'earlier-note': {
      id: 'earlier-note',
      kind: 'note',
      title: 'Earlier in this session',
      text: 'You approved the plan and then the confirmed deploy a little earlier. This is what happened next.',
      next: 'e-quote',
    },
    'e-quote': {
      id: 'e-quote',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_quote_app',
      args: [{ name: 'spec', value: 'the specification' }],
      why: 'To get the network price.',
      result: [{ k: 'Price', v: '{usd} for {term}' }],
      earlier: true,
      next: 'e-plan',
    },
    'e-plan': {
      id: 'e-plan',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_deploy_app',
      args: [
        { name: 'spec', value: 'the specification', lines: SPEC_LINES },
        { name: 'confirm', value: 'not set' },
        ...KEYS,
      ],
      why: 'To get the plan.',
      result: [
        { k: 'executed', v: 'false' },
        { k: 'price', v: '{usd} ({flux})' },
      ],
      earlier: true,
      next: 'hosted-note',
    },
    'hosted-note': hostedNote('hosted-note', 'e-confirm'),
    'e-confirm': {
      id: 'e-confirm',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_deploy_app',
      args: [
        { name: 'spec', value: 'the specification', lines: SPEC_LINES },
        { name: 'confirm', value: 'true', emphasis: 'confirm' },
        ...KEYS,
      ],
      why: 'To sign the specification and pay the quoted amount.',
      result: [
        { k: 'executed', v: 'true', kind: 'ok' },
        { k: 'paid', v: '{usd} ({flux})' },
        { k: 'transaction', v: 'the payment transaction id is in the result' },
      ],
      effects: [
        { kind: 'spend', label: 'First deployment payment for {app}', amount: 'quote', needed: true },
        { kind: 'register', text: '{app} was sent for registration, {term} on {instances}.' },
      ],
      earlier: true,
      next: 'paid-say',
    },
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
        { name: 'txid', value: 'the payment transaction id from the confirmed deploy' },
      ],
      why: 'To know when the app is published and its instances are located.',
      result: [
        { k: 'timedOut', v: 'true', kind: 'warn' },
        { k: 'payment', v: 'not confirmed yet' },
        { k: 'published', v: 'not yet' },
        { k: 'running', v: '0 of {instanceCount} instances located so far' },
        { k: 'next', v: 'Call again to keep waiting.' },
      ],
      next: 'wrong-say',
    },
    'wrong-say': {
      id: 'wrong-say',
      kind: 'say',
      who: 'agent',
      text: 'The wait timed out and no copy is running, so the deployment must have failed. I will run the confirmed deployment again.',
      next: 'again',
    },
    again: {
      id: 'again',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_deploy_app',
      args: [
        { name: 'spec', value: 'the specification', lines: SPEC_LINES },
        {
          name: 'confirm',
          value: 'true',
          emphasis: 'confirm',
          note: 'The agent set this flag again. It signs a new message and pays {usd} again.',
        },
        ...KEYS,
      ],
      why: 'Because the wait timed out and no copy is running yet.',
      result: [
        { k: 'executed', v: 'true', kind: 'ok' },
        { k: 'paid', v: '{usd} ({flux})', kind: 'warn' },
        { k: 'message', v: 'a new message, signed again; its hash is in the result' },
        { k: 'transaction', v: 'a new payment transaction id is in the result' },
      ],
      effects: [
        { kind: 'spend', label: 'Second deployment payment for {app}', amount: 'quote', needed: false },
      ],
      next: 'wait2',
      refused: 'checking-say',
    },
    // ---- the careful path --------------------------------------------------------------------------
    'checking-say': {
      id: 'checking-say',
      kind: 'say',
      who: 'agent',
      text: 'Understood. I will look at the app before doing anything else.',
      next: 'check',
    },
    check: {
      id: 'check',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_get_app',
      args: [{ name: 'name', value: '{app}' }],
      why: 'To see what is published before touching anything.',
      result: [
        { k: 'published', v: 'yes', kind: 'ok' },
        { k: 'term', v: '{term}' },
        { k: 'running', v: 'instances are being located' },
      ],
      next: 'found-say',
    },
    'found-say': {
      id: 'found-say',
      kind: 'say',
      who: 'agent',
      text: 'It is registered, so the first payment worked. The wait only ran out of time. I will wait again.',
      next: 'wait3',
    },
    wait3: {
      id: 'wait3',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_wait_for_app',
      args: [
        { name: 'name', value: '{app}' },
        { name: 'txid', value: 'the payment transaction id from the confirmed deploy' },
      ],
      why: 'Waiting again is safe: the tool only reads.',
      result: [
        { k: 'done', v: 'true', kind: 'ok' },
        { k: 'payment', v: 'confirmed' },
        { k: 'published', v: 'yes' },
        { k: 'running', v: '{instanceCount} of {instanceCount} instances located' },
        {
          k: 'simulation',
          v: 'Here the wait ends at once. On the network it takes minutes, and the FluxCloud screen says up to {deployEstimate} after payment.',
        },
      ],
      next: 'live-say',
    },
    'live-say': {
      id: 'live-say',
      kind: 'say',
      who: 'agent',
      text: 'It is live at {url}. One payment, as planned.',
      next: 'end-checked',
    },
    'end-checked': { id: 'end-checked', kind: 'end', ending: 'checked-first' },
    // ---- the costly path ---------------------------------------------------------------------------
    wait2: {
      id: 'wait2',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_wait_for_app',
      args: [
        { name: 'name', value: '{app}' },
        { name: 'txid', value: 'the new payment transaction id' },
      ],
      why: 'To wait for the app to be published.',
      result: [
        { k: 'done', v: 'true', kind: 'ok' },
        { k: 'published', v: 'yes' },
        { k: 'running', v: '{instanceCount} of {instanceCount} instances located' },
      ],
      next: 'cancel-say',
    },
    'cancel-say': {
      id: 'cancel-say',
      kind: 'say',
      who: 'agent',
      text: 'The app is live, but I paid twice. I will cancel the extra deployment.',
      next: 'cancel',
    },
    cancel: {
      id: 'cancel',
      kind: 'call',
      server: 'flux-cloud',
      tool: 'flux_cancel_app',
      args: [
        { name: 'name', value: '{app}' },
        {
          name: 'confirm',
          value: 'true',
          emphasis: 'confirm',
          note: 'There is one app under this name. A cancel ends that app.',
        },
        ...KEYS,
      ],
      why: 'To undo the second payment.',
      result: [
        { k: 'executed', v: 'true' },
        { k: 'term', v: 'shortened to {cancelTerm}', kind: 'warn' },
        { k: 'result', v: 'the nodes remove the app everywhere when it ends', kind: 'crit' },
        { k: 'refund', v: 'none', kind: 'crit' },
      ],
      effects: [
        { kind: 'spend', label: 'Network fee for the cancel', amount: 'minimum', needed: false },
        {
          kind: 'end-app',
          text: '{app} was set to end within {cancelTerm}. Its data goes with it and nothing is refunded.',
        },
      ],
      next: 'cancelled-say',
      refused: 'end-twice-say',
    },
    'cancelled-say': {
      id: 'cancelled-say',
      kind: 'say',
      who: 'agent',
      text: 'Cancelled. The extra deployment is gone.',
      next: 'end-ended',
    },
    'end-ended': { id: 'end-ended', kind: 'end', ending: 'app-ended' },
    'end-twice-say': {
      id: 'end-twice-say',
      kind: 'say',
      who: 'agent',
      text: 'Understood. I will leave the app as it is.',
      next: 'end-twice',
    },
    'end-twice': { id: 'end-twice', kind: 'end', ending: 'paid-twice' },
  },
  endings: {
    'checked-first': {
      id: 'checked-first',
      title: 'Checked first, paid once',
      verdict: 'good',
      goal: true,
      summary:
        'The wait ran out of time, which is not the same as failing. You refused the second payment, the agent read the app and found it registered, and waiting again finished the job.',
      takeaway: 'A timeout means the answer is not in yet. Read the state, wait again, and pay once.',
    },
    'paid-twice': {
      id: 'paid-twice',
      title: 'Paid twice for one app',
      verdict: 'costly',
      goal: false,
      summary:
        'The first payment was already on its way. The agent signed a new message and paid the quote again, then wanted to cancel. You refused the cancel, so the app runs with one payment too many.',
      takeaway:
        'Do not repeat a confirmed call after a timeout. The server pays the quote each time it is told to.',
    },
    'app-ended': {
      id: 'app-ended',
      title: 'Paid twice, then ended the app',
      verdict: 'harmful',
      goal: false,
      summary:
        'The second payment was not needed, and the cancel meant to undo it ended the one app there was. Its term is cut to about {cancelTerm} and nothing is refunded.',
      takeaway:
        'Cancel is not an undo. It ends the app and refunds nothing, so an agent that reaches for it to fix a mistake makes the mistake bigger.',
      silent: {
        tools: ['flux_cancel_app'],
        takeaway:
          'No prompt appeared for the second payment or for the cancel, so a timeout turned into two payments and an ended app with nobody asked. Only a policy that asks, and a person who reads, stops it.',
      },
    },
  },
  facts: [
    {
      text: 'flux_wait_for_app returns timedOut with the progress so far. It is safe to call again until done is true.',
      ref: '15.1.11',
      basis: 'verified',
    },
    {
      text: 'done means the spec is published and as many instances are located as were asked for. A timeout only says that had not happened yet.',
      ref: '15.1.11',
      basis: 'verified',
    },
    {
      text: 'A call with confirm set to true runs the whole sequence: it signs the message, sends it to a node, then builds and broadcasts the payment. Calling it again runs the sequence again.',
      ref: '15.1.5',
      basis: 'verified',
    },
    {
      text: 'The registration message lives {messageLife} on each node, counted from when that node received it. A payment that confirms after that finds no message to link.',
      ref: '6.6',
      basis: 'verified',
    },
    {
      text: 'A payment is recorded against one message hash, and a second payment for the same hash is ignored. An underpaid message is not stored and the payment is not returned, so a short payment cannot be topped up.',
      ref: '15.1.7',
      basis: 'verified',
    },
    {
      text: 'What the network does with a second signed message for an app name that is already registered or pending is not recorded. Treat the second payment as spent and not returned.',
      ref: '15.1.7',
      basis: 'guidance',
    },
    {
      text: 'flux_cancel_app shortens the term to about {cancelTerm}, after which the nodes remove the app everywhere and its data goes. Nothing is refunded.',
      ref: '15.1.8',
      basis: 'verified',
    },
  ],
};
