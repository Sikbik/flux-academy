/**
 * A synthetic concept lesson: no spec, no terminal, a checkpoint of choice, multi, order and match.
 * Served at `/learn/fixture-concept` in development. Test data, not content.
 */

import type { LessonMeta } from '@shared/curriculum';
import type { Lesson } from '../types';

export const conceptMeta: LessonMeta = {
  id: 'fixture-concept',
  track: 'cumulus',
  module: 'Fixtures',
  title: 'Fixture concept: tiers and blocks',
  summary: 'A synthetic concept lesson with a checkpoint of choice, multi, order and match.',
  minutes: 4,
  kind: 'concept',
  prerequisites: [],
  labs: ['network'],
  order: 98,
};

export const conceptLesson: Lesson = {
  id: 'fixture-concept',
  hook: 'Learn what the three node tiers are and how often the chain ticks. You can then say why a small app lands where it does.',
  objectives: ['Name the three node tiers.', 'Say how long a block takes.'],
  steps: [
    {
      id: 'tiers',
      title: 'Three sizes of node',
      body: [
        'Every {{term:fluxnode}} belongs to one of three tiers: Cumulus, Nimbus and Stratus. The tier is set by the collateral the operator locks and by the hardware the node must have.',
      ],
      callouts: [
        {
          kind: 'wild',
          body: 'Small apps usually land on Cumulus nodes because there are the most of them.',
        },
      ],
      stage: { kind: 'diagram', id: 'tier-ladder', beat: 0 },
    },
    {
      id: 'blocks',
      title: 'A block every 30 seconds',
      body: [
        'The chain adds a block about every 30 seconds. A subscription is counted in blocks, so a month is 88,000 of them.',
      ],
      stage: { kind: 'diagram', id: 'block-clock', beat: 0 },
      task: {
        kind: 'confirm',
        label: 'I can say how long a block takes',
        prompt: 'Confirm when you are ready.',
      },
    },
    {
      id: 'collateral',
      title: 'Collateral and trust',
      body: [
        'Collateral is FLUX the operator locks to run a node. It is the stake that makes a node costly to abandon.',
        'The amounts are fixed per tier, from 1,000 FLUX for Cumulus to 40,000 FLUX for Stratus.',
      ],
      stage: { kind: 'diagram', id: 'tier-ladder', beat: 3 },
    },
    {
      id: 'placement',
      title: 'Nobody schedules your app',
      body: [
        'There is no central scheduler. Each node decides for itself which apps to run, and bigger nodes wait a little longer before they take small ones.',
      ],
      stage: { kind: 'diagram', id: 'flux-layers', beat: 2 },
      task: {
        kind: 'confirm',
        label: 'I understand nobody assigns apps to nodes',
        prompt: 'Confirm when you are ready.',
      },
    },
  ],
  checkpoint: [
    {
      id: 'blocks-time',
      kind: 'choice',
      prompt: 'About how long is one block?',
      options: [
        { id: 'a', label: '2 seconds', why: 'That is far faster than the chain runs.' },
        { id: 'b', label: '30 seconds' },
        { id: 'c', label: '2 minutes', why: 'That was the old block time, before Proof of Node.' },
      ],
      answer: 'b',
      explain: 'Blocks arrive about every 30 seconds, which is 2,880 a day.',
    },
    {
      id: 'tier-members',
      kind: 'multi',
      prompt: 'Which of these are node tiers?',
      options: [
        { id: 'cumulus', label: 'Cumulus' },
        { id: 'nimbus', label: 'Nimbus' },
        { id: 'cirrus', label: 'Cirrus', why: 'A real cloud type, not a Flux tier.' },
        { id: 'stratus', label: 'Stratus' },
      ],
      answers: ['cumulus', 'nimbus', 'stratus'],
      explain: 'Flux has exactly three tiers, named after cloud layers.',
      hint: 'Three of the four are tiers. One is a cloud type that Flux does not use.',
    },
    {
      id: 'tier-order',
      kind: 'order',
      prompt: 'Order the tiers from the smallest collateral to the largest.',
      items: [
        { id: 'cumulus', label: 'Cumulus' },
        { id: 'nimbus', label: 'Nimbus' },
        { id: 'stratus', label: 'Stratus' },
      ],
      explain: 'Collateral grows with the tier: 1,000, 12,500 and 40,000 FLUX.',
      hint: 'The names run from low cloud to high cloud.',
    },
    {
      id: 'tier-match',
      kind: 'match',
      prompt: 'Match each tier to its collateral.',
      pairs: [
        { id: 'cumulus', left: 'Cumulus', right: '1,000 FLUX' },
        { id: 'nimbus', left: 'Nimbus', right: '12,500 FLUX' },
        { id: 'stratus', left: 'Stratus', right: '40,000 FLUX' },
      ],
      explain:
        'The collateral differs by roughly an order of magnitude from the smallest tier to the largest.',
      hint: 'The largest tier asks for the most FLUX.',
    },
  ],
  recap: [
    'There are three tiers: Cumulus, Nimbus and Stratus.',
    'A block takes about 30 seconds.',
    'No central scheduler assigns apps: nodes pick them.',
  ],
  further: [{ label: 'What is a FluxNode', url: 'https://docs.runonflux.com' }],
  terms: ['fluxnode'],
};

/** The loader (`learn/loader.ts`) finds a fixture by these two exports. */
export { conceptLesson as lesson, conceptMeta as meta };
