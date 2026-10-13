/**
 * Glossary, part 2 of 3: accounts and wallets, the registration message, and running an app (18 terms).
 *
 * The other two files are `core.ts` (network, money and the spec) and `docker.ts` (images and registries).
 * Term ids are the canonical ones other lessons link with `{{term:id}}`; they are permanent.
 *
 * Every definition restates FACTS.md and carries a `// fact:` tag. Behaviour that FACTS marks UNVERIFIED
 * (what the `s:` flag does, how `<n>:` mounts are ordered) is deliberately not described here.
 */

import { PAYMENT_WINDOW_MIN } from '@shared/flux/timing';
import type { GlossaryTerm } from '@/learn/types';

const terms: GlossaryTerm[] = [
  {
    id: 'fluxcloud',
    term: 'FluxCloud',
    proper: true,
    short:
      'The web dashboard at cloud.runonflux.com for registering, paying for and managing apps, and for browsing the network.',
    why: 'It is the interface you will use for almost everything. The older home.runonflux.io dashboard now redirects to it.',
    // fact: FACTS 1.2 (FluxCloud row), 9.1 (redirects)
    category: 'ops',
    related: ['zelid', 'sso', 'marketplace', 'flux'],
    lessons: ['your-toolkit', 'how-apps-run'],
    docs: 'https://docs.runonflux.com/fluxcloud/introduction',
  },
  {
    id: 'zelid',
    term: 'ZelID',
    proper: true,
    aka: ['Flux ID', 'FluxID', 'owner'],
    short:
      'The wallet address that signs registrations and updates for an app, a ZelID or an Ethereum address. It goes in the spec as `owner`.',
    why: 'Whoever controls the key controls the app. Lose the key and you lose control of the app.',
    // fact: FACTS 3.2 (owner: a Flux ID or an Ethereum address), 12 seed 33 (lose the key, lose control)
    category: 'ops',
    related: ['sso', 'zelcore', 'ssp', 'app-update'],
    lessons: ['your-toolkit'],
  },
  {
    id: 'sso',
    term: 'SSO',
    proper: true,
    aka: ['single sign-on', 'email login'],
    short:
      'Email, Google or Apple login in FluxCloud. A signing service signs for you, so you hold no key and need no wallet.',
    why: 'It is the fastest way to start. The trade is control: only the service signs your messages, and the contact email is filled in from the account.',
    // fact: FACTS 9.2 (login options; SSO users hold no key, the UI sends the message to a signing service)
    category: 'ops',
    related: ['zelid', 'zelcore', 'ssp', 'fluxcloud'],
    lessons: ['your-toolkit'],
  },
  {
    id: 'ssp',
    term: 'SSP Wallet',
    proper: true,
    aka: ['SSP'],
    short: 'A self-custody wallet that can log you in to FluxCloud, sign messages and send FLUX.',
    why: 'Choose a wallet when you want to hold your own key. The payment step in FluxCloud also offers SSP as a one-click way to send FLUX.',
    // fact: FACTS 9.2 (wallet login tiles), 9.5.1 (Pay with FLUX offers Zelcore and SSP buttons)
    category: 'ops',
    related: ['zelcore', 'zelid', 'sso'],
    lessons: ['your-toolkit'],
  },
  {
    id: 'zelcore',
    term: 'ZelCore',
    proper: true,
    aka: ['Zelcore'],
    short:
      'A wallet from the Flux ecosystem that can log you in to FluxCloud, sign registrations and send FLUX.',
    why: 'Choose a wallet when you want to hold your own key. The payment step in FluxCloud also offers ZelCore as a one-click way to send FLUX.',
    // fact: FACTS 1.2 (wallets row), 9.2, 9.5.1
    category: 'ops',
    related: ['ssp', 'zelid', 'sso'],
    lessons: ['your-toolkit'],
  },
  {
    id: 'registration-message',
    term: 'registration message',
    short:
      'The signed JSON that creates an app. A node broadcasts it as a temporary message, and a payment that carries its hash confirms it on the chain.',
    why: `Its hash links your payment to your spec. A message waits about an hour for money, though FluxCloud shows a ${PAYMENT_WINDOW_MIN} minute payment link. After that the app has to be registered again.`,
    // fact: FACTS 6.1 rows 4 and 5, 4.7 (message life 3,600 s)
    category: 'ops',
    related: ['message-hash', 'op-return', 'payment-address', 'zelid'],
    lessons: ['how-apps-run'],
  },
  {
    id: 'message-hash',
    term: 'message hash',
    aka: ['hash'],
    short:
      "The SHA-256 fingerprint of the signed registration message. It is what you put in the payment's OP_RETURN field.",
    why: 'A payment is linked to an app only by this hash. A wrong or missing hash means the payment is ignored and the app never installs.',
    // fact: FACTS 6.1 rows 5 and 7, 4.7, 11 row 22
    category: 'ops',
    related: ['registration-message', 'op-return', 'payment-address'],
    lessons: ['how-apps-run'],
  },
  {
    id: 'app-update',
    term: 'app update',
    aka: ['update'],
    short:
      "A signed change to a live app's spec, sent as a new message. It is free only if instances stay the same and nothing gets bigger or longer.",
    why: 'Some updates trigger a hard redeploy that deletes volume data, such as a changed disk size or renamed components. Back up first.',
    // fact: FACTS 4.5 and 9.5.4 (free only with the same instances, static IP, node count and component count; no more cpu, ram, hdd or fee ports; at most 8 extra blocks), 11 row 17
    category: 'ops',
    related: ['soft-redeploy', 'hard-redeploy', 'renewal', 'zelid'],
    lessons: ['operate-your-app'],
    docs: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/subscription',
  },
  {
    id: 'soft-redeploy',
    term: 'soft redeploy',
    aka: ['soft reinstall'],
    short:
      "Reinstalling an app's containers on a node while keeping the data in its volume. The other option, a hard redeploy, recreates the volume.",
    why: "Volume data survives, but data in the container's own file system does not. A change to the app's structure, such as a renamed component, escalates it to a hard redeploy.",
    // fact: FACTS 7.3 (soft versus hard redeploy), 7.2
    category: 'ops',
    related: ['hard-redeploy', 'app-update', 'container-data'],
    lessons: ['operate-your-app', 'persistent-storage'],
    docs: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/control',
  },
  {
    id: 'hard-redeploy',
    term: 'hard redeploy',
    aka: ['hard reinstall'],
    short:
      'A reinstall that recreates the volume from scratch and deletes its data. Some updates trigger it, for example a changed disk size.',
    why: 'Back up before any update that warns of it. The data is gone once it runs, and plain volumes are not replicated anywhere.',
    // fact: FACTS 7.3, 9.5.4 (hard redeploy warnings), 11 rows 16 and 17
    category: 'ops',
    related: ['soft-redeploy', 'app-update', 'container-data', 'volume'],
    lessons: ['operate-your-app', 'persistent-storage'],
    docs: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/control',
  },
  {
    id: 'syncthing',
    term: 'Syncthing',
    proper: true,
    short:
      'The open source file sync tool that FluxOS uses to replicate volumes between instances. It powers `r:` and `g:` data.',
    why: 'It is file replication, not a database cluster. Two instances writing the same database files can conflict, so a single-writer mode such as `g:` is the safer choice. That is design advice, not a documented rule.',
    // fact: FACTS 7.2 (r: and g:), 11 rows 14 and 15 (g: for databases is design inference, UNVERIFIED)
    category: 'ops',
    related: ['container-data', 'primary-standby', 'fault-domain'],
    lessons: ['persistent-storage', 'shared-database'],
  },
  {
    id: 'primary-standby',
    term: 'Primary and standby',
    aka: ['g:', 'primary/standby'],
    short:
      'A `g:` volume mode. One elected instance runs the app while the others hold synced copies and wait to take over.',
    why: 'It suits single-writer apps such as databases. FDM sends all traffic to the primary, and a standby is elected after a delay of minutes. Only the g: component stops on a standby; the other components keep running.',
    // fact: FACTS 7.2 (g: component only; non-g siblings keep running, read from source not observed live), 6.4 (FDM sends every port to the primary; failover takes minutes)
    category: 'ops',
    related: ['container-data', 'syncthing', 'failover'],
    lessons: ['persistent-storage', 'shared-database'],
  },
  {
    id: 'failover',
    term: 'failover',
    short:
      'What happens when an instance or its node dies. The load balancer stops sending traffic to it within seconds, and any other instances keep serving.',
    why: 'Rerouting is quick but replacing the lost copy is not: about two hours after the node dies, plus the image pull, and longer for synced-storage apps. Run enough instances that the survivors can carry the load.',
    // fact: FACTS 6.4 (about 6 s to eject), 6.5 (125 min plus install time), 6.3 (up to about 27 min more for synced apps)
    category: 'ops',
    related: ['instance', 'haproxy', 'location', 'primary-standby'],
    lessons: ['redundancy-failover'],
    docs: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/instances',
  },
  {
    id: 'flux-orbit',
    term: 'Flux Orbit',
    proper: true,
    aka: ['Orbit', 'Deploy with Git', 'Deploy from Git'],
    short:
      "Flux's {{term:git-deploy}} product. You connect a repository, and Orbit builds it and registers an ordinary version 8 spec whose component runs the image `runonflux/orbit:latest`.",
    why: 'An alternative to writing a spec, with its own {{term:mcp-server}}. At the time of writing the plans are Starter (one instance), Standard and Pro (two each), and Custom. The old Free plan is closed to new apps.',
    // fact: FACTS 1.2 (Flux Orbit row), 15.3.1 (an ordinary v8 spec, image runonflux/orbit:latest), 15.3.10 (plans; the old Free plan is closed to new apps, plan prices are left to the plan data), 15.3.16 (Starter is one instance), 15.4 (its own MCP server), 9.0 row 9 (docs and the live page differ)
    category: 'ops',
    related: ['git-deploy', 'webhook', 'deploy-button', 'mcp-server', 'marketplace', 'fluxcloud'],
    lessons: ['your-toolkit', 'deploy-from-git'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-git/introduction',
  },
  {
    id: 'marketplace',
    term: 'Marketplace',
    proper: true,
    aka: ['App Marketplace'],
    short:
      'A catalogue of one-click app and game templates in FluxCloud, each with its spec already filled in.',
    why: 'It is the fastest way to a running server. The template fixes the spec, so check what you are paying for before you register.',
    // fact: FACTS 1.2 (Marketplace row), 9.9
    category: 'ops',
    related: ['fluxcloud', 'flux-orbit'],
    lessons: ['your-toolkit', 'minecraft-server'],
    docs: 'https://docs.runonflux.com/fluxcloud/marketplace/',
  },
  {
    id: 'fluxdrive',
    term: 'FluxDrive',
    proper: true,
    short:
      'A storage service in FluxCloud, backed by IPFS. It is one of the places a backup can be restored from.',
    why: 'The docs say backups are deleted with the app, so keep a copy somewhere that outlives it, such as FluxDrive, before you cancel or let a subscription lapse.',
    // fact: FACTS 1.2 (FluxDrive row), 7.4 (restore sources; backups are deleted with the app)
    category: 'ops',
    related: ['hard-redeploy', 'container-data'],
    lessons: ['operate-your-app', 'persistent-storage'],
    docs: 'https://docs.runonflux.com/fluxcloud/fluxdrive/',
  },
  {
    id: 'fluxedge',
    term: 'FluxEdge',
    proper: true,
    short: 'A separate GPU rental marketplace on Flux. It is not where regular container apps run.',
    why: 'If a guide talks about renting GPUs or machines through FluxEdge, that is a different product from FluxCloud app hosting.',
    // fact: FACTS 1.2 (FluxEdge row)
    category: 'ops',
    related: ['fluxcloud', 'flux'],
    lessons: ['what-is-flux'],
    docs: 'https://docs.runonflux.com/fluxedge/overview',
  },
  {
    id: 'flux-xdao',
    term: 'Flux XDAO',
    proper: true,
    short:
      'A governance app in the FluxCloud dashboard where node operators can submit proposals, discuss initiatives and vote.',
    why: 'You do not need it to deploy an app. It matters if you run nodes or want to follow how the network is governed.',
    // fact: FACTS 1.2 (Flux XDAO row: UI strings only; mechanics UNVERIFIED, so none are described)
    category: 'ops',
    related: ['fluxcloud', 'fluxnode'],
    lessons: ['what-is-flux'],
  },
];

export default terms;
