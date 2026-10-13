/**
 * The home page's words and the small amounts of authored data behind them. Plain, concrete, no hype,
 * no dashes, no emoji (docs/DESIGN.md section 12). Claims about Flux are checked against
 * docs/research/FACTS.md; the section that backs each one is noted beside it.
 */

import type { LabMeta, TrackId } from '@shared/curriculum';
import { TARGET_BLOCK_SEC } from '@shared/flux/blocks';
import { FDM_EJECT_SEC, FDM_TIMING, PAYMENT_CONFIRMATION_BLOCKS } from '@shared/flux/timing';
import type { ArtId } from '@/content/art';
import { capitalise, joinNames, numberWord as word } from './words';

/** "1 to 3 blocks, about 30 seconds each": a payment is seen this soon once sent (FACTS 6.1 row 7). */
export const BLOCKS_RANGE = `${PAYMENT_CONFIRMATION_BLOCKS.min} to ${PAYMENT_CONFIRMATION_BLOCKS.max} blocks`;

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export const HERO = {
  eyebrow: 'Flux Academy / The decentralized cloud, explained by doing',
  eyebrowShort: 'Flux Academy / Learn by doing',
  subhead:
    'Describe an app, place it across the network and break it on purpose, in short lessons and labs that run in your browser.',
  caption: 'This is a simulation of how Flux places an app. Real network data lights real locations.',
  captionSample:
    'This is a simulation of how Flux places an app. The map is a built-in sample, not the live network.',
} as const;

// ---------------------------------------------------------------------------
// How it works (FACTS 6.1, 6.2, 6.4)
// ---------------------------------------------------------------------------

export interface Chapter {
  id: 'describe' | 'register' | 'place' | 'run';
  number: string;
  name: string;
  /** About forty words. */
  text: string;
  /** The lesson that goes deeper. */
  lesson: string;
  /** A short caption for the figure beside the text (`FIG 2.n`). */
  figure: string;
}

/** The sentences the "Place" and "Run" figures say as the count of copies and the break change. */
export const PLACE_LINES = [
  'No copies yet. Every node reads the app list and decides for itself.',
  'One node with room took a copy.',
  'A second node took a copy.',
  'Three different nodes hold the app. Visitors can be sent to any of them.',
] as const;

export const RUN_LINES = {
  healthy: `A health check runs every ${FDM_TIMING.healthIntervalSec} seconds. Visitors go to whichever copies answer.`,
  broken: `A node went dark. After ${word(FDM_TIMING.ejectAfterFailures)} missed checks, about ${FDM_EJECT_SEC} seconds, visitors stop going to it.`,
  healed:
    'The other copies carried the traffic. Replacing a lost copy elsewhere takes much longer, so plan for one fewer.',
} as const;

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'describe',
    number: '01',
    name: 'Describe',
    // fact: FACTS 15.2.1 and 15.2.3 (the assistant drafts a spec and the owner reviews and signs it), 15.3.1
    // (Orbit registers an ordinary v8 spec, there is no special object type) and 15.1.1 (nothing in the
    // network changes because an agent deploys). The one idea of the AI additions: who writes the spec
    // changes, what the network receives does not.
    text: 'An app starts as a spec: a small JSON file naming its image, resources, ports and number of copies. You can type it, have the FluxCloud assistant draft it from a sentence, or have Orbit generate it from a Git repository. However it is written, the network receives an ordinary spec signed by its owner.',
    lesson: 'first-deploy',
    figure: 'A spec is the whole contract',
  },
  {
    id: 'register',
    number: '02',
    name: 'Register',
    text: `The signed spec is hashed and broadcast, and you pay with that hash attached to the payment. Once the payment is sent, nodes usually match it to the spec within ${BLOCKS_RANGE}, about ${TARGET_BLOCK_SEC} seconds each.`,
    lesson: 'how-apps-run',
    figure: 'The hash links payment to spec',
  },
  {
    id: 'place',
    number: '03',
    name: 'Place',
    text: 'There is no central scheduler. Each node reads the public app list and decides for itself: if your app is short of copies and the node has room, it installs one. Small apps tend to land on Cumulus nodes first.',
    lesson: 'what-is-flux',
    figure: 'Each node decides for itself',
  },
  {
    id: 'run',
    number: '04',
    name: 'Run',
    text: `A load balancer checks every instance and sends visitors to the ones that answer. When a node goes dark it is dropped in about ${FDM_EJECT_SEC} seconds and traffic moves to the rest. With one instance there is nothing to move to.`,
    lesson: 'redundancy-failover',
    figure: 'One node drops, the app stays up',
  },
] as const;

/** The spec that types itself in the first chapter: an abridged v8 spec (FACTS 3.9), real field names. */
export const STORY_SPEC = `{
  "version": 8,
  "name": "hello-flux",
  "compose": [{
    "repotag": "nginx:1.27",
    "ports": [31001],
    "containerPorts": [80],
    "cpu": 0.5, "ram": 500, "hdd": 5
  }],
  "instances": 3,
  "expire": 88000
}`;

// ---------------------------------------------------------------------------
// The path (tracks come from shared/curriculum.ts)
// ---------------------------------------------------------------------------

/** Heights of the three towers: the lit part of each emblem as a fraction of its frame (art manifest). */
export const TOWER_TOP: Record<TrackId, number> = {
  cumulus: 0.35,
  nimbus: 0.21,
  stratus: 0.06,
};

// ---------------------------------------------------------------------------
// Live network annotations (FACTS 2.4, 6.1, 3.5)
// ---------------------------------------------------------------------------

export const PULSE_NOTES = {
  tiers:
    'You do not choose a tier. Your price depends on CPU, RAM and disk, and each node decides for itself whether to take your app.',
  blocks: `A block lands about every ${TARGET_BLOCK_SEC} seconds, so a payment for your app usually confirms within ${BLOCKS_RANGE} of being sent.`,
  places:
    'Nodes sit in many countries, and the geolocation field of your spec can allow or exclude places, so you decide where copies may run. It is a filter, not a promise of copies in different places.',
} as const;

// ---------------------------------------------------------------------------
// The labs. Ids, titles and one-line summaries come from shared/curriculum.ts (LABS); only what a card
// says about its own data is authored here.
// ---------------------------------------------------------------------------

/** The tag of a lab that is a simulation: the failover scene, the terminal and the agent session. */
export const SIMULATION_TAG = 'Simulation';

/** What each card says about itself before you open it: which resource it shows, or that it is a simulation. */
export const LAB_TAGS: Readonly<Record<string, readonly string[]>> = {
  'spec-forge': ['Price engine'],
  network: ['Network data'],
  failover: [SIMULATION_TAG],
  terminal: [SIMULATION_TAG],
  explorer: ['Network data'],
  'agent-desk': [SIMULATION_TAG],
};

export interface LabsCopy {
  /** The h2: "Six instruments you can use on their own". */
  title: string;
  /** The accessible name of the list of cards: "The six labs". */
  listLabel: string;
  /** The sentence under the heading, naming the labs that are simulations. */
  lead: string;
}

/**
 * The words of the labs section. Every count is the length of the list it counts and the simulations are
 * the labs tagged `Simulation`, so adding a lab changes the copy and nothing here goes stale.
 */
export function labsCopy(
  labs: readonly Pick<LabMeta, 'id' | 'title'>[],
  tags: Readonly<Record<string, readonly string[]>> = LAB_TAGS,
): LabsCopy {
  const count = word(labs.length);
  const sims = labs.filter((l) => tags[l.id]?.includes(SIMULATION_TAG)).map((l) => `the ${l.title}`);
  const simLine =
    sims.length === 0
      ? ''
      : ` ${capitalise(joinNames(sims))} ${sims.length === 1 ? 'is a simulation and says' : 'are simulations and say'} so.`;
  return {
    title: `${capitalise(count)} instruments you can use on their own`,
    listLabel: `The ${count} labs`,
    lead: `Each lab is a working tool. Lessons use them too, but you can open any of them now, without a lesson.${simLine}`,
  };
}

// ---------------------------------------------------------------------------
// What you will build. Every lesson id is validated against the curriculum in logic.test.ts.
// ---------------------------------------------------------------------------

export interface Example {
  id: string;
  /** What the learner ends up with, as a noun phrase: "A web app". */
  title: string;
  /** One sentence, only what the lesson teaches. */
  blurb: string;
  /** The lesson that builds it. */
  lesson: string;
  art: ArtId;
}

export interface BuildCopy {
  /** The h2: "Seven things to build, one lesson each". */
  title: string;
  /** The sentence under the heading. */
  lead: string;
  /** The accessible name of the rail: "Seven things you will build". */
  listLabel: string;
}

/** The words of the "What you will build" section; the count is the length of the rail it heads. */
export function buildCopy(count: number): BuildCopy {
  const n = capitalise(word(count));
  return {
    title: `${n} things to build, one lesson each`,
    lead: 'Pick the one closest to what you want to do and open its lesson. Nothing in the Academy deploys or spends for you: you build and price specs here and register them yourself in FluxCloud, or point Orbit at a repository.',
    listLabel: `${n} things you will build`,
  };
}

export const EXAMPLES: readonly Example[] = [
  {
    id: 'web-app',
    title: 'A web app',
    blurb:
      'Containerise a small web app, describe it in a spec, price it and walk the registration steps in a simulator.',
    lesson: 'first-deploy',
    art: 'mod-deploy',
  },
  {
    id: 'git-app',
    title: 'An app from a Git repository',
    blurb: 'Point Orbit at a repository, pick a plan, set the build and read the specification it generates.',
    lesson: 'deploy-from-git',
    art: 'mod-traffic',
  },
  {
    id: 'game-server',
    title: 'A Minecraft server',
    blurb: 'Size, expose and persist a game server, then find the node that serves it.',
    lesson: 'minecraft-server',
    art: 'mod-projects',
  },
  {
    id: 'storage',
    title: 'Data that outlives a node',
    blurb: 'Learn what survives a restart, a move and a node failure, and which storage a database needs.',
    lesson: 'persistent-storage',
    art: 'mod-state',
  },
  {
    id: 'shop-database',
    title: 'A shop and its database',
    blurb:
      'Run a web front and its Postgres as two components, with the data on a primary and standby volume.',
    lesson: 'shared-database',
    art: 'mod-containers',
  },
  {
    id: 'multi-container',
    title: 'A multi-container app',
    blurb: 'Wire a frontend, an API and a cache together with component names and internal DNS.',
    lesson: 'multi-component',
    art: 'mod-architecture',
  },
  {
    id: 'agent',
    title: 'An agent you supervise',
    blurb:
      "Approve an agent's calls in simulated sessions, sort its tools by what they can spend or delete, and set it up so a mistake stays small.",
    lesson: 'agents-and-mcp',
    art: 'lab-agent-desk',
  },
] as const;

// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------

export const CLOSE = {
  line: 'Thousands of machines are on the network. Learn how to put your first app on it.',
} as const;
