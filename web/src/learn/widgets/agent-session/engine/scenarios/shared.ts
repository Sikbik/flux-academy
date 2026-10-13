/**
 * Pieces the two hosted FluxCloud scenarios share: the key arguments (placeholders, never a key), the summary
 * lines of a specification, and the one note that says what hosted mode means for keys.
 *
 * Facts: FACTS 15.1.3 (on the hosted server the two keys are arguments of every call that needs them, so they
 * pass through the AI vendor and the chat history), 15.1.15 (use a dedicated pair with a small balance, or run
 * the server on your machine).
 */

import type { ExampleArg, NoteBeat } from '../types.ts';

/** The two key arguments of a hosted FluxCloud call. The values are placeholders. */
export const KEYS: ExampleArg[] = [
  {
    name: 'fluxIdPrivateKey',
    value: 'YOUR_FLUX_ID_KEY',
    key: true,
    note: 'A placeholder. A real call carries the key itself here.',
  },
  { name: 'paymentPrivateKey', value: 'YOUR_PAYMENT_KEY', key: true },
];

/** The lines that stand for a specification in a call's arguments. */
export const SPEC_LINES = [
  'name: {app}',
  'image: {image}',
  'size: {size}',
  'instances: {instanceCount}',
  'term: {term}',
];

/** The hosted-mode note: shown once per session, at the first call that carries keys. */
export function hostedNote(id: string, next: string): NoteBeat {
  return {
    id,
    kind: 'note',
    tone: 'gotcha',
    title: 'This is the hosted server: your keys are arguments',
    text: 'On the hosted {{term:mcp-server}} the two keys travel as arguments of every call that needs them, so they pass through your AI vendor and stay in the chat history. Use a dedicated pair, fund it with only what a deployment needs, or run the server on your own machine, where the keys stay in its process. The values on this page are placeholders: no key appears anywhere in this simulation.',
    next,
  };
}
