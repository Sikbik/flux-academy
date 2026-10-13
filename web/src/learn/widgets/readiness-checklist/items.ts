/**
 * The catalogue of the readiness checklist: what a first deployer needs before registering an app on
 * FluxCloud, in the order they meet it. Copy is plain and every claim has a source in
 * docs/research/FACTS.md (section numbers in the comments). Nothing here is a computed price: the one
 * figure the checklist shows (the smallest app) comes from the pricing engine in the component, never from
 * this file. The durations (30 and 45 minutes, the watcher) come from `@shared/flux/timing`. They are
 * FluxCloud's own on-screen text or the node's clock (FACTS 6.6), and the copy says which is which.
 *
 * Pure data. No React, no DOM.
 */

import {
  DEPLOY_ESTIMATE_MIN,
  INSTALL_START_USUAL_MIN,
  PAYMENT_WINDOW_MIN,
  UI_WATCHER_MIN,
} from '@shared/flux/timing';

export type ItemId = 'login' | 'registry' | 'image' | 'payment' | 'funds' | 'window' | 'domain';

/** One external link. Only URLs that FACTS names (9.1, 9.2) or the plain Docker Hub site are used. */
export interface ItemLink {
  label: string;
  href: string;
}

/** A link to a lesson in the Academy, shown as "Learn it". The lesson id is permanent. */
export interface LessonLink {
  label: string;
  lessonId: string;
}

export interface ChecklistItem {
  id: ItemId;
  /** The short name of the thing, as a noun phrase. */
  title: string;
  /** One line under the title. */
  summary: string;
  /** Needed before a first registration. Optional items never block "You are ready". */
  required: boolean;
  /** "What this is", one or two short paragraphs. */
  what: string[];
  /** "Why you need it", one or two short paragraphs. */
  why: string[];
  /** The real place to get it. */
  link?: ItemLink;
  /** The Academy lesson that teaches it. */
  lesson?: LessonLink;
}

export const FLUXCLOUD_URL = 'https://cloud.runonflux.com';
export const DOCKER_HUB_URL = 'https://hub.docker.com';

/** Every item, in order. `props.items` picks a subset by id, keeping this order. */
export const ITEMS: readonly ChecklistItem[] = [
  {
    id: 'login',
    title: 'A way to sign in to FluxCloud',
    summary: 'An email, Google or Apple account, or a wallet.',
    required: true,
    // fact: FACTS 9.2 (login options; SSO users hold no key and FluxCloud signs for them)
    what: [
      'FluxCloud is the dashboard at cloud.runonflux.com where you register and manage apps. Its login screen offers two kinds of account. An SSO account uses Google, Apple ID, or an email and password. A wallet account uses ZelCore, SSP, WalletConnect or MetaMask.',
    ],
    why: [
      'Every registration is signed. With an SSO account FluxCloud signs for you, so there is no key to keep and no wallet to install. With a wallet you hold the key and you sign each registration yourself.',
      "FluxCloud's form asks for a contact email, which goes into the spec: an SSO account fills it in from the account, and a wallet account types one. The network itself accepts an empty list, and who sends notices to it is not documented.",
    ],
    // fact: FACTS 9.4.3 ("At least one contact email is required" is the form), 3.2 (contacts are public unless enterprise;
    // the protocol accepts `contacts: []`; who sends deployment or expiry notices is UNVERIFIED)
    link: { label: 'Open FluxCloud', href: FLUXCLOUD_URL },
    lesson: { label: 'Login and signing', lessonId: 'your-toolkit' },
  },
  {
    id: 'registry',
    title: 'A Docker Hub account',
    summary: "A place to publish your own image. Optional for someone else's public image.",
    required: false,
    // fact: FACTS 9.4.2 ("From Docker Hub, GHCR, or any registry"), 3.3 (repotag)
    what: [
      "A registry stores container images and hands them out on request. Docker Hub is the usual one. GitHub's registry and other public registries work too.",
    ],
    why: [
      'Flux nodes pull your image from a registry when they start your app, so your own code has to be pushed to one first. If you deploy an image that someone else already published, you do not need an account.',
    ],
    link: { label: 'Open Docker Hub', href: DOCKER_HUB_URL },
    lesson: { label: 'Containers in ten minutes', lessonId: 'containers-101' },
  },
  {
    id: 'image',
    title: 'A public image, pushed',
    summary: 'Built for linux/amd64, no larger than 5 GB, readable without a password.',
    required: true,
    // fact: FACTS 3.3 (repotag: public, amd64 or arm64, at most 5,000,000,000 bytes), 3.7 and 11 rows 4, 5, 6
    what: [
      'The image is your app packaged: the code, the runtime and the command that starts it. For Flux it has to be public, so that a node can pull it without credentials, and it has to fit in 5 GB.',
      'Build it for linux/amd64. Almost every node is amd64, and an image built on Apple silicon is arm64 unless you say otherwise. An arm64-only image registers, and then almost no node can run it.',
    ],
    why: [
      'The registration check looks your image up and refuses one it cannot pull, one that is too large, or one with no architecture it can run. A private image only works with an enterprise app, which encrypts the spec.',
    ],
    lesson: { label: 'Build and push an image', lessonId: 'containers-101' },
  },
  {
    id: 'payment',
    title: 'A way to pay',
    summary: 'A card, or a wallet that can send FLUX.',
    required: true,
    // fact: FACTS 9.5.1 (Select payment method: Pay with Card via Stripe or PayPal, Pay with FLUX via Zelcore, SSP or
    // manually), 4.7 (the node accepts any payment at or above the on-chain table price; FluxCloud asks for the quote;
    // the card relay refuses below 98 percent of it)
    what: [
      'At the payment step FluxCloud shows two options. Pay with Card uses Stripe or PayPal. Pay with FLUX has buttons for ZelCore and SSP, or you can send manually to the address it shows with the message it gives you.',
    ],
    why: [
      "The payment is what ties your money to your signed spec: the message carries the hash of your registration. Pay the full quoted amount. FluxCloud asks for it, and the card relay needs at least 98 percent of it. A payment below the network's own floor is dropped as underpaid.",
      'FLUX has to be sent on the Flux main chain, and the docs for game templates warn against paying from an exchange, because a withdrawal usually cannot attach the message.',
    ],
    link: { label: 'Open FluxCloud', href: FLUXCLOUD_URL },
    lesson: { label: 'Paying', lessonId: 'your-toolkit' },
  },
  {
    id: 'funds',
    title: 'Enough to cover one period',
    summary: 'The price in USD for a card, or in FLUX, which is 5 percent cheaper.',
    required: true,
    // fact: FACTS 4.4 (fluxmultiplier 0.95, minimum price), 9.5.3; the figure shown is computed by the engine
    what: [
      'FluxCloud quotes every app in USD and in FLUX. A card pays the USD figure plus VAT. Paying in FLUX takes 5 percent off that USD figure. No subscription costs less than the network minimum.',
    ],
    why: [
      'You pay for the whole subscription up front, not per block, and there is no refund by protocol. Check the quote at the Total Cost step before you pay.',
    ],
    link: { label: 'Open FluxCloud', href: FLUXCLOUD_URL },
  },
  {
    id: 'window',
    title: 'A clear half hour',
    summary: `The screen says ${PAYMENT_WINDOW_MIN} minutes to pay. The node's clock is an hour from registering.`,
    required: true,
    // fact: FACTS 6.6 ("Payment window: 30 minutes remaining" is a fixed UI string shown after the test install, not a
    // counter; the registration message lives 3,600 s on each node from receipt; the UI watcher is 30 min and shows
    // "Deployment Successful" when ONE copy runs), 9.5.1 (up to 45 minutes after payment; installing starts within 1 to
    // 3 minutes: static labels), 11 row 22
    what: [
      `At the time of writing, FluxCloud's payment card says "Payment window: 30 minutes remaining" once the install test has passed. After payment it says deployment takes up to ${DEPLOY_ESTIMATE_MIN} minutes. Both are fixed text with no timer behind them, and the second is an estimate, not a guarantee, although a node usually starts installing within ${INSTALL_START_USUAL_MIN.from} to ${INSTALL_START_USUAL_MIN.to} minutes.`,
    ],
    why: [
      "The registration message lives for an hour on each node, counted from when the node receives it, not from when the payment screen appears. A payment that lands after that finds nothing to link, and the app shows as registered and never installs. A payment below the network's floor is dropped too. Start when you can finish.",
      `After you pay, FluxCloud watches for ${UI_WATCHER_MIN} minutes and shows "Deployment Successful" once one copy is running, not all of them. If the watcher times out, the deployment carries on.`,
    ],
  },
  {
    id: 'domain',
    title: 'A domain name',
    summary: 'Optional. Every app already gets a free address.',
    required: false,
    // fact: FACTS 6.4 (default domain <name>.app.runonflux.io; custom domain needs a CNAME and a domains entry), 9.7
    what: [
      'Your app is reachable at its free address, <name>.app.runonflux.io, as soon as it runs. A custom domain is your own name in front of it. You list it in the spec and create a CNAME record at your DNS provider.',
    ],
    why: [
      'You can skip this until the app works on its free address. Registering a domain and editing DNS is a separate task with its own wait for caches to expire.',
    ],
    lesson: { label: 'Your own domain', lessonId: 'custom-domains' },
  },
];

/** The default selection: every item. */
export const ALL_IDS: readonly ItemId[] = ITEMS.map((i) => i.id);

/** Pick items by id from `props.items`. Unknown ids are ignored; an empty or invalid list means all. */
export function selectItems(ids: readonly unknown[] | undefined): ChecklistItem[] {
  if (!Array.isArray(ids) || ids.length === 0) return [...ITEMS];
  const wanted = new Set(ids.filter((x): x is string => typeof x === 'string'));
  const picked = ITEMS.filter((i) => wanted.has(i.id));
  return picked.length > 0 ? [...picked] : [...ITEMS];
}
