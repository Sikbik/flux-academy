/**
 * The "Why this step exists" annotations of the simulator, one per screen and per review row. Plain
 * language, facts only from docs/research/FACTS.md (the section is named in the comment above each). Durations come from `@shared/flux`.
 */

import { TARGET_BLOCK_SEC, UI_WATCHER_MIN } from '@shared/flux';

export interface Why {
  /** The name of the step, bold in front of the text. */
  step: string;
  body: string;
}

export type WhyKey =
  | 'register.entry'
  | 'register.simple'
  | 'register.advanced'
  | 'review.validate'
  | 'review.cost'
  | 'review.expiry'
  | 'review.signature'
  | 'review.registered'
  | 'review.test'
  | 'review.payment'
  | 'register.deploy'
  | 'register.deployed'
  | 'manage.list'
  | 'tab.specifications'
  | 'tab.information'
  | 'tab.file-changes'
  | 'tab.monitoring'
  | 'tab.logs'
  | 'tab.secure-shell'
  | 'tab.control'
  | 'tab.backup'
  | 'tab.instances'
  | 'tab.subscription'
  | 'sub.renewal'
  | 'sub.update'
  | 'sub.cancel'
  | 'update.cost'
  | 'update.confirmed'
  | 'cancel.done';

const WHY: Record<WhyKey, Why> = {
  // FACTS 9.4.1
  'register.entry': {
    step: 'Two ways in.',
    body: 'Git deployment builds a repository for you and opens Flux Orbit on another site. Docker deployment runs an image you already pushed, which is the route this course takes. The Docker card lists any image, private registries, several containers, full resource control and Enterprise features.',
  },
  // FACTS 9.4.2
  'register.simple': {
    step: 'One page, one container.',
    body: 'Everything the network needs to place an app is on this page: an image, a name, the port it listens on, how much it may use, how many copies and how long you pay for. Simple mode fills in the rest of the spec itself: it copies the name into the description, takes the owner from your signed-in ID and picks the public port for you.',
  },
  // FACTS 9.4.3
  'register.advanced': {
    step: 'The whole spec, in tabs.',
    body: 'Advanced mode shows what Simple mode cannot say: several containers, custom domains, commands, a static IP and location rules down to the country. These are the same fields you edited as JSON in the spec editor.',
  },
  // FACTS 6.1 step 3, 9.4.4
  'review.validate': {
    step: 'Validate App Spec.',
    body: 'This is the check the network runs when it receives your registration, so a spec that fails here would fail there. Nothing has been signed or paid yet, so a failure costs nothing: fix it and go on.',
  },
  // FACTS 5.4, 9.5.3
  'review.cost': {
    step: 'Total Cost.',
    body: 'The quote covers the whole subscription and is paid up front. Apps are not charged per block as they run. Paying in FLUX is 5 percent cheaper than the card price.',
  },
  // FACTS 5.2, 5.4
  'review.expiry': {
    step: 'Expiry.',
    body: `A subscription is counted in blocks, from the block your message lands in. 88,000 blocks is one month at ${TARGET_BLOCK_SEC} seconds a block. When it ends the app is removed within minutes to a few hours, and there is no grace period.`,
  },
  // FACTS 9.2, 6.1 step 4
  'review.signature': {
    step: 'Signature.',
    body: 'Registering is a message signed with the owner key. The signature is how the network knows the spec came from you. An SSO account holds no key, so FluxCloud signs for you; a wallet user signs in the wallet.',
  },
  // FACTS 6.1 step 5, 6.6
  'review.registered': {
    step: 'Registered.',
    body: 'The signed message is broadcast to the network as a temporary message. It is not an app yet: nothing runs until the payment lands. Each node keeps its copy for an hour from the moment it receives it, so a payment confirmed after that hour finds nothing to link. That clock starts here, at registration, not at signing.',
  },
  // FACTS 6.1 step 6
  'review.test': {
    step: 'Test Application Installation.',
    body: 'Before you pay, nodes test-install the app and report back. A spec that cannot run fails here, while it still costs nothing. The test uses a 2 GB disk whatever you asked for.',
  },
  // FACTS 4.7, 6.6, 9.5.1, 11
  'review.payment': {
    step: 'Payment.',
    body: 'Pay the quoted amount: FluxCloud asks for it, and the card relay refuses less than 98 percent of it. The network\'s own floor is lower, and a payment below that floor is dropped as underpaid, so the app stays registered and never installs. "Payment window: 30 minutes remaining" is a fixed line of text, not a counter. The node-side deadline is an hour after registration, so pay promptly. Paying in FLUX needs the message (the registration hash) in the same transaction.',
  },
  // FACTS 6.1 steps 7 to 13, 6.2, 6.6
  'register.deploy': {
    step: 'Nodes choose themselves.',
    body: 'Nobody assigns your app to nodes. Each node reads the public list of apps, finds ones short of copies and takes one at random if it fits. FluxCloud shows "usually takes 1-3 minutes" for a node to start installing and "Up to 45 min after payment" for the deployment. Both are fixed labels with no timer behind them. Then the Flux Domain Manager puts the running copies behind your domains.',
  },
  // FACTS 6.6
  'register.deployed': {
    step: 'Deployment Successful.',
    body: `FluxCloud shows "Deployment Successful!" as soon as ONE copy is listed as running. It does not wait for the other copies or for the domains. If no copy appears within ${UI_WATCHER_MIN} minutes of polling, it shows "Payment monitoring timed out. Please check your application status." and stops watching, and the deployment carries on. From here on the app is yours to operate: the Manage page is where logs, restarts, updates and renewals live.`,
  },
  // FACTS 9.6, 5.4
  'manage.list': {
    step: 'My Applications.',
    body: 'Every app your account owns. Active apps have a Manage button. An expired app can only be redeployed, which is a fresh registration: its old data does not come back.',
  },
  // FACTS 9.6
  'tab.specifications': {
    step: 'Specifications.',
    body: 'Local is what this node runs, Global is what the network has registered. After an update the two can differ for a moment while it spreads.',
  },
  'tab.information': {
    step: 'Information.',
    body: 'A docker inspect style view of each container on this node: status, uptime, image, ports, environment, limits and mounts.',
  },
  'tab.file-changes': {
    step: 'File Changes.',
    body: 'A diff of the container filesystem against its image. What is listed lives only in this container: an update or a redeploy replaces the container, and the change goes with it unless it was on a volume.',
  },
  'tab.monitoring': {
    step: 'Monitoring.',
    body: 'Charts for one container on one node. Use them to find which resource is the limit before you resize the app.',
  },
  'tab.logs': {
    step: 'Logs.',
    body: 'Read the log before you change anything. It is what the app itself says, one node at a time, so a problem on one copy can be invisible on another.',
  },
  'tab.secure-shell': {
    step: 'Secure Shell.',
    body: "A terminal inside the container and a browser for its volume. Use it to look. A change to the container's own filesystem is not part of the spec and is lost when the container is recreated; files on the volume stay through a soft redeploy.",
  },
  'tab.control': {
    step: 'Control.',
    body: 'The mode decides how far an action reaches: Manual picks addresses, Local the selected node, Global all of them. Soft Reinstall keeps the data and Hard Reinstall deletes it. Pause Application freezes the container and does not pause billing.',
  },
  // FACTS 7.4, 9.6
  'tab.backup': {
    step: 'Backup & Restore.',
    body: "Backups are per component. The tab says weekly backups are made automatically, but the FluxOS source read has no weekly scheduler, so make one by hand before anything risky, such as a hard redeploy. A local backup is a file inside the component's own volume on this node: it is not replicated, it counts against the disk size and it goes with the node, a hard redeploy, a cancel or an expiry. Download it or send it to FluxDrive to keep it.",
  },
  'tab.instances': {
    step: 'Instances.',
    body: 'Where the copies actually run. Nobody picked these nodes: each one chose the app on its own. In practice each copy runs on a different node, and no live app has two copies on one host. Different nodes can still sit with the same hosting provider.',
  },
  'tab.subscription': {
    step: 'Subscription.',
    body: 'The one tab about money and time. Renewal adds time, Update changes the spec, and Cancel ends the app and loses its data.',
  },
  // FACTS 9.5.4, 4.5
  'sub.renewal': {
    step: 'Renewal.',
    body: 'A renewal is an update message with a longer expire, so it is priced as the new total minus a credit for the time you have not used. In practice you pay for what you add. The total may not pass one year.',
  },
  'sub.update': {
    step: 'Update.',
    body: 'An update replaces the whole spec, so it is validated, priced, signed and paid like a registration. Change the image or the environment and the nodes recreate the containers and keep the data. Rename a component or change a disk size and they remove everything first.',
  },
  'sub.cancel': {
    step: 'Cancel.',
    body: 'Cancelling is permanent. There is no charge and no refund, the app is removed from the network and its data is lost. Refunds are not automatic.',
  },
  'update.cost': {
    step: 'Total Cost.',
    body: "The price is the new spec for the time that is left, minus a credit for the unused part of the old subscription at the old spec's price. The credit is why an update rarely costs what a registration would.",
  },
  'update.confirmed': {
    step: 'Update registered.',
    body: 'The update is an ordinary message on the chain, the same kind a renewal is. Nodes pick it up the way they pick up registrations, and apply it soft or hard depending on what changed.',
  },
  'cancel.done': {
    step: 'Cancelled.',
    body: 'A cancellation is an update that sets expire to 1 block, so the network removes the app at once. The name becomes free again, and registering it again starts from nothing.',
  },
};

export function whyFor(key: WhyKey): Why {
  return WHY[key];
}

export const WHY_KEYS = Object.keys(WHY) as WhyKey[];
