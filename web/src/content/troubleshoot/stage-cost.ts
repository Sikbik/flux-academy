/**
 * Stage 6: cost and renewal. Why a price is what it is, what an update costs, what expiry does.
 *
 * The formula and the quotes below are FACTS section 4, verified against the official calculator on
 * 2026-10-12 (80 of 80 quotes reproduced). Dollar figures are the price table of that date: it is read
 * from the network and can change, so each figure in the copy says so. The structure (a divide by 3, the
 * 0.50 floor per extra instance, the discount thresholds and the .49 or .99 rounding) is read from code.
 */

import { api, both, cmd, docs, fix, fixJson, forge, live, look, src } from './build';
import { FIGURES as F, FEE_PORTS_TEXT } from './figures';
import type { Symptom } from './types';

export const COST_SYMPTOMS: Symptom[] = [
  {
    id: 'price-higher-than-expected',
    stage: 'cost',
    title: 'My price is higher than I expected',
    summary: 'The quote is larger than the number you worked out, or it jumps when you change one setting.',
    seen: [
      'Quote is higher than expected',
      'Price doubled',
      'A port fee line in the quote',
      'Estimated cost',
    ],
    keywords: [
      'price',
      'cost',
      'bill',
      'quote',
      'expensive',
      'higher than expected',
      'surprise',
      'estimated cost',
      'calculator',
      'monthly',
      'why so much',
      'total',
    ],
    quick:
      'Six things move a quote that people miss: a fee port, a fourth instance, a static IP, Enterprise, the whole-period total and the rounding up to .49 or .99. Open the spec in the forge and read the line items.',
    causes: [
      {
        id: 'fee-port',
        title: 'A public port is a fee port',
        why: `Public ports ${FEE_PORTS_TEXT} are fee ports. Each adds ${F.portFee} to the monthly bundle (at the rates read on ${F.ratesDate}), which is then divided by ${F.bundle} and billed per instance. So a fee port costs about ${F.portFeePerInstance} per instance per month before discounts, and grows with the instance count. At those rates three small instances quote ${F.small3} on port 31001 and ${F.small3Port8080} on port 8080.`,
        likelihood: 'usual',
        checks: [
          forge(
            'Open a spec on port 8080 and read the line items',
            {
              fixture: 'hello-world',
              patch: { compose: [{ ports: [8080], containerPorts: [8080] }] },
              shows: ['PORT_FEE'],
            },
            'A line called ports or port fee carries the fee.',
          ),
          api('price-table', '`port` is the fee per fee port, in USD.'),
        ],
        fixes: [
          fixJson(
            'Keep the container port and change only the public port.',
            '"ports": [31001],\n"containerPorts": [8080]',
          ),
        ],
        proof: both('11 row 28; 3.4; 4.4; 4.6'),
        see: ['port-costs-extra'],
        lint: ['PORT_FEE'],
        lessons: ['resources-pricing'],
        terms: ['port-fee'],
      },
      {
        id: 'four-instances',
        title: 'Four or more instances',
        why: `The small-app discount applies only below four instances, and a cheap app is then billed a flat ${F.extraInstanceFloor} for each instance after the first. At the rates read on ${F.ratesDate} a small app that quoted ${F.small3} for three quoted ${F.small4} for four.`,
        likelihood: 'common',
        checks: [forge('Move the instance slider from 3 to 4', { fixture: 'hello-world' })],
        fixes: [fix('Stay at three, or accept the step. Check the price at each count before you sign.')],
        proof: both('11 row 29; 4.4; 4.6'),
        see: ['four-instances-cost-more'],
        lint: ['INSTANCES_PRICE_CLIFF'],
        lessons: ['resources-pricing'],
        terms: ['small-app-discount', 'instances-field'],
      },
      {
        id: 'static-ip',
        title: 'Static IP is on',
        why: `A static IP adds ${F.staticIpFee} to the monthly bundle (at the rates read on ${F.ratesDate}), which is then divided by ${F.bundle} and billed per instance: about ${F.staticIpPerInstance} per instance, growing with the instance count. It also narrows the nodes that may take the app.`,
        likelihood: 'common',
        checks: [
          forge('See the static IP line', {
            fixture: 'hello-world',
            patch: { staticip: true },
            shows: ['STATICIP_COST'],
          }),
        ],
        fixes: [fix('Turn `staticip` off unless a client truly needs a fixed address.')],
        proof: both('9.0 row 6; 4.4; 4.6'),
        lint: ['STATICIP_COST'],
        lessons: ['geo-placement', 'resources-pricing'],
        terms: ['static-ip'],
      },
      {
        id: 'whole-period',
        title: 'The total is for the whole subscription, not per month',
        why: `You pay for the full period up front, so the number is large even when the monthly figure is small. Longer terms take a discount (${F.durationDiscounts}), but the total is then rounded up to a price ending .49 or .99, which for a small app can swallow the saving. Check the total, not the percentage.`,
        likelihood: 'common',
        checks: [look('Look at the period beside the estimate: 1 week, 1 month, 3, 6 or 12 months.')],
        fixes: [
          fix(
            'Pick the shortest period you are comfortable with, or divide the total by the number of months to compare.',
          ),
        ],
        proof: src('4.3; 5.3; 9.5.3'),
        lessons: ['resources-pricing'],
        terms: ['duration-discount', 'expire'],
      },
      {
        id: 'enterprise-scope',
        title: 'Enterprise or pinned nodes add a fee',
        why: `An Enterprise app, or an app pinned to chosen nodes, adds the scope fee (${F.scopeFee} at the rates read on ${F.ratesDate}) to the monthly bundle before the divide by ${F.bundle}: about ${F.scopeFeePerInstance} per instance. FluxCloud turns Enterprise on by itself when a variable looks like a secret or an image is private.`,
        likelihood: 'possible',
        checks: [look('On the review step, check whether Enterprise shows as on.')],
        fixes: [
          fix(
            'Turn it off if you do not need private values or images, and remove any secret-looking names that are not secrets.',
          ),
        ],
        proof: both(
          '4.4; 9.4.2; 14 row 3',
          'The pinned-nodes price was checked live. The enterprise price was read in source and not tried with a real encrypted spec.',
        ),
        lessons: ['env-and-secrets'],
        terms: ['enterprise-app'],
      },
      {
        id: 'rounding-floor',
        title: 'The total is rounded up, and a floor applies',
        why: `Since FluxOS PR 1818 (2026-09-25) the whole total is rounded up to the next price ending in .49 or .99. No quote is below the minimum price, which was ${F.minPrice} at the rates read on ${F.ratesDate}, whatever the size.`,
        likelihood: 'possible',
        checks: [api('price-table', '`minUSDPrice` is the floor.')],
        fixes: [
          fix(
            'Nothing to change. A smaller spec cannot go below the floor, so tiny apps cost the same as small ones.',
          ),
        ],
        proof: both('4.4; 4.3 step G'),
        lessons: ['resources-pricing'],
        terms: ['minimum-price'],
      },
      {
        id: 'unit-slip',
        title: 'A unit is off: RAM is in megabytes, disk in gigabytes',
        why: '`ram` is megabytes (2000 is 2 GB), `hdd` is gigabytes and `cpu` is cores. Typing 20000 for 2 GB of RAM makes the RAM part of the price ten times larger.',
        likelihood: 'possible',
        checks: [forge('Read the resources panel for your spec', { fixture: 'hello-world' })],
        fixes: [
          fixJson('Use megabytes for RAM and gigabytes for disk.', '"cpu": 0.5,\n"ram": 500,\n"hdd": 5'),
        ],
        proof: src('3.3'),
        lessons: ['resources-pricing'],
        terms: ['price-quote'],
      },
      {
        id: 'marketplace-prefix',
        title: 'The name starts with a Marketplace app name',
        why: 'The calculator multiplies the price of any app whose name starts with certain Marketplace app names, so the same spec costs more under that name.',
        likelihood: 'rare',
        checks: [look('Compare the start of your app name with the Marketplace list.')],
        fixes: [fix('Rename the app so it does not start with a Marketplace name.')],
        proof: src('4.4'),
        lint: ['NAME_MARKETPLACE_PREFIX'],
        lessons: ['resources-pricing'],
        terms: ['marketplace'],
      },
    ],
    lessons: ['resources-pricing'],
    labs: ['spec-forge'],
    related: ['port-costs-extra', 'four-instances-cost-more', 'update-costs-money'],
    lint: ['PORT_FEE', 'INSTANCES_PRICE_CLIFF', 'STATICIP_COST'],
  },

  {
    id: 'port-costs-extra',
    stage: 'cost',
    title: 'A port costs extra',
    summary: `The quote is higher than expected by a port fee for each of a few specific ports (${F.portFee} each, added to the monthly bundle, at the rates read on ${F.ratesDate}).`,
    seen: ['A fee for each of these ports', 'Port fee', 'Enterprise port'],
    keywords: [
      'port fee',
      'port cost',
      'port 80',
      'port 443',
      'port 8080',
      'port 8081',
      'port 8443',
      'port 6667',
      'enterprise port',
      'privileged port',
      'extra port cost',
    ],
    quick: `Public ports ${FEE_PORTS_TEXT} carry a port fee: ${F.portFee} added to the monthly bundle, which is divided by ${F.bundle} and billed per instance, so about ${F.portFeePerInstance} per instance at the rates read on ${F.ratesDate}. Use any other public port and keep the container port as it is: the generated address already serves web traffic on 80 and 443.`,
    causes: [
      {
        id: 'in-fee-set',
        title: 'The public port is in the fee set',
        why: 'These ports are priced as "enterprise ports" whether or not the app is Enterprise. The network accepts them. They only cost more.',
        likelihood: 'usual',
        checks: [
          forge('See PORT_FEE on port 8080', {
            fixture: 'hello-world',
            patch: { compose: [{ ports: [8080], containerPorts: [8080] }] },
            shows: ['PORT_FEE'],
          }),
          api('deploy-info', '`enterprisePorts` lists the ports that carry the fee.'),
        ],
        fixes: [
          fixJson(
            'Change the public port and keep the container port.',
            '"ports": [31001],\n"containerPorts": [8080]',
          ),
        ],
        proof: both('11 row 28; 8.4; 3.4'),
        lint: ['PORT_FEE'],
        lessons: ['resources-pricing', 'ports-and-domains'],
        terms: ['port-fee', 'ports'],
      },
      {
        id: 'standard-port-wanted',
        title: 'You want visitors to use 80 or 443',
        why: 'You do not need a public port 80 for that. The generated address is served by the domain manager on 80 and 443 and forwards to your first public port.',
        likelihood: 'common',
        checks: [
          cmd(
            'Try the generated address without a port',
            'curl -sI https://{app}.app.runonflux.io | head -n 3',
          ),
        ],
        fixes: [fix('Publish a high port, and give visitors the generated address or your own domain.')],
        proof: src('6.4; 11 row 28'),
        lessons: ['ports-and-domains', 'custom-domains'],
        terms: ['app-domain', 'fdm'],
      },
      {
        id: 'simple-mode-picks',
        title: 'You used Advanced mode and chose the port yourself',
        why: 'FluxCloud Simple mode assigns a public port for you and never picks one of the fee ports. Advanced mode uses the number you type.',
        likelihood: 'possible',
        checks: [look('In Advanced mode, check the Exposed Port column of Port Bindings.')],
        fixes: [fix('Type a public port from 1024 up that is not 8080, 8081, 8443 or 6667.')],
        proof: src('9.4.2; 9.4.3'),
        lessons: ['first-deploy'],
      },
    ],
    lessons: ['resources-pricing', 'ports-and-domains'],
    labs: ['spec-forge'],
    related: ['price-higher-than-expected', 'port-rejected'],
    lint: ['PORT_FEE'],
  },

  {
    id: 'four-instances-cost-more',
    stage: 'cost',
    title: 'Four instances cost double three',
    summary: 'Going from three instances to four makes a small app cost much more than one more copy should.',
    seen: [
      `At the rates read on ${F.ratesDate}: ${F.small3} at 3 instances, ${F.small4} at 4`,
      'The price jumps at four',
    ],
    keywords: [
      'four instances',
      '4 instances',
      'price cliff',
      'instance cost',
      'discount',
      'small app discount',
      'price doubled',
      'three vs four',
    ],
    quick: `Two rules change at the same count. The ${F.discountSmallLabel} small-app discount applies only below four instances, and a cheap app is then billed a flat ${F.extraInstanceFloor} for each instance after the first. At the rates read on ${F.ratesDate} a small app costs ${F.small3} at three instances and ${F.small4} at four.`,
    causes: [
      {
        id: 'discount-ends',
        title: 'The small-app discount stops at four instances',
        why: `${F.discountSmall[0]?.toUpperCase()}${F.discountSmall.slice(1)} the discount is ${F.discountSmallLabel}, and ${F.discountMedium} it is ${F.discountMediumLabel}, but only when instances are fewer than four. At three instances the discounted total (${F.small3Discounted}) is under the minimum price and is lifted to ${F.minPrice}.`,
        likelihood: 'usual',
        checks: [
          forge(
            'Compare 3 and 4 instances in the forge',
            { fixture: 'hello-world' },
            'Watch the discount line disappear.',
          ),
        ],
        fixes: [fix('Stay at three instances, or accept the step. Check the price at each count.')],
        proof: both(
          '11 row 29; 4.4; 4.6',
          `Example at the rates read on ${F.ratesDate}: 0.5 core, 500 MB, 5 GB, port 31001: ${F.small1} at 1, 2 and 3 instances, ${F.small4} at 4, ${F.small5} at 5.`,
        ),
        lint: ['INSTANCES_PRICE_CLIFF'],
        lessons: ['resources-pricing'],
        terms: ['small-app-discount'],
      },
      {
        id: 'extra-instance-floor',
        title: `Extra instances of a very cheap app cost a flat ${F.extraInstanceFloor}`,
        why: `When the price of one instance is under ${F.extraInstanceFloor} and there are more than two extra instances (from four instances), each instance after the first is charged a flat ${F.extraInstanceFloor}. For this small app one instance is ${F.smallOneInstance}, so four instances are ${F.smallOneInstance} + 3 x ${F.extraInstanceFloor} = ${F.smallFourBeforeRounding}, rounded up to ${F.small4}. Without that rule four would be ${F.smallFourWithoutFlatFee}.`,
        likelihood: 'usual',
        checks: [forge('Increase instances on a tiny spec and watch the step', { fixture: 'hello-world' })],
        fixes: [fix('Combine tiny services into one component or one app where it makes sense.')],
        proof: src('4.4'),
        lessons: ['resources-pricing'],
      },
      {
        id: 'floor-hides-base',
        title: 'The minimum price hid the step at three',
        why: `No quote is below the minimum price (${F.minPrice} at the rates read on ${F.ratesDate}), so for a very small spec the first three instances all show the same price. One instance of this spec is ${F.smallOneInstance}, and the floor lifts the discounted total, so the step only shows once the discount ends and the flat fee starts.`,
        likelihood: 'common',
        checks: [api('price-table', 'Read `minUSDPrice`.')],
        fixes: [fix('Use the price curve, not a single quote, when you plan instance counts.')],
        proof: both('4.4; 4.6'),
        lessons: ['resources-pricing'],
        terms: ['minimum-price'],
      },
    ],
    lessons: ['resources-pricing', 'redundancy-failover'],
    labs: ['spec-forge'],
    related: ['price-higher-than-expected', 'single-instance-down'],
    lint: ['INSTANCES_PRICE_CLIFF'],
  },

  {
    id: 'app-expired',
    stage: 'cost',
    title: 'My app is gone: it expired',
    summary: 'The app, its data and its address disappeared, or it shows under My Expired Apps.',
    seen: ['My Expired Apps lists it', 'Application not found', 'The name is free again'],
    keywords: [
      'expired',
      'expire',
      'expiry',
      'subscription ended',
      'app deleted',
      'app disappeared',
      'renew',
      'renewal',
      'redeploy expired',
      'cancel',
      'no grace',
    ],
    quick:
      'There is no grace period. At the expiry block the app and its data are removed within minutes to hours and the name becomes free. Re-register to get it back; the docs say the old data is not restored.',
    causes: [
      {
        id: 'subscription-ended',
        title: 'The subscription ran out',
        why: 'The expiry height is the block of your last register or update message plus `expire`. Every 8 blocks the network removes apps past that height, and nodes then uninstall them with their volumes.',
        likelihood: 'usual',
        checks: [
          api(
            'appspec',
            'While the app is still listed, read `height` and `expire`: it ends at height + expire. `Application: {app} not found` means it is already off the list, which fits an expiry or a cancel.',
          ),
          api('height', 'Blocks left = height + expire - this number. Divide by 120 for hours.'),
          cmd(
            'Do the sum',
            'echo $(( HEIGHT + EXPIRE - CURRENT ))',
            'Set HEIGHT, EXPIRE and CURRENT from the two calls above. A negative result means it has expired. The app leaves the list within about 8 blocks of that, so this only works for a short while.',
          ),
        ],
        fixes: [
          fix(
            'Open My Expired Apps and use Redeploy. The docs describe it as a pre-filled form that you pay for as a new registration, and say the data from the old instance is not restored.',
          ),
        ],
        proof: src(
          '11 row 25; 5.2; 5.4',
          'The expiry and the removal are read in source. What Redeploy does, and that the data is not restored, is from the docs only.',
        ),
        lessons: ['operate-your-app', 'production-checklist'],
        terms: ['expire', 'renewal', 'block-height'],
      },
      {
        id: 'short-period',
        title: 'The period you chose was short',
        why: `One week is ${F.blocksPerWeek} blocks, one month is ${F.blocksPerMonth}. A short period expires quickly, and the app does not renew by itself unless you turned on card auto-renewal.`,
        likelihood: 'common',
        checks: [
          forge('Read the subscription length in the forge', {
            fixture: 'hello-world',
            patch: { expire: 14400 },
            shows: ['EXPIRE_SHORT'],
          }),
        ],
        fixes: [
          fix(
            'Renew before the end. The Subscription tab shows "Expires in under a week" when less than a week is left. Choose a longer period next time.',
          ),
        ],
        proof: src('5.1; 5.4; 9.5.2'),
        lint: ['EXPIRE_SHORT', 'EXPIRE_ONE_BLOCK'],
        lessons: ['operate-your-app'],
        terms: ['expire', 'renewal'],
      },
      {
        id: 'cancelled',
        title: 'The subscription was cancelled',
        why: 'Cancel is an update that sets `expire` to one block. The network removes the app within minutes to a few hours (the docs say at once), there is no charge or refund, and the data is lost.',
        likelihood: 'possible',
        checks: [api('messages', 'The last message is an update with a very short `expire`.')],
        fixes: [
          fix(
            'Register again if it was a mistake. Cancelling needs a signature, so check who has access to the owner login.',
          ),
        ],
        proof: src('4.5; 9.5.4; 5.4'),
        lint: ['EXPIRE_ONE_BLOCK'],
        lessons: ['operate-your-app'],
      },
    ],
    lessons: ['operate-your-app', 'production-checklist'],
    labs: ['explorer'],
    related: ['recover-lost-data', 'refund-question'],
    lint: ['EXPIRE_SHORT', 'EXPIRE_ONE_BLOCK'],
  },

  {
    id: 'update-costs-money',
    stage: 'cost',
    title: 'An update asks me to pay when I changed one setting',
    summary: 'You expected a free update and the review step shows a price.',
    seen: ['Free update', 'Total Cost on an update', 'Renewal'],
    keywords: [
      'update cost',
      'free update',
      'update price',
      'renewal credit',
      'pay for update',
      'update rate limit',
      'update fee',
      'upgrade price',
    ],
    quick:
      'An update is free only when nothing that costs money grows: same instances, static IP and node list, no extra CPU, RAM, disk or fee ports, and no longer subscription.',
    causes: [
      {
        id: 'something-grew',
        title: 'Something in the spec grew',
        why: 'An update is free when instances, `staticip`, the node list and the number of components are unchanged, no component asks for more CPU, RAM or disk or more fee ports, and expiry does not move by more than 8 blocks. Lowering resources and changing the image, variables or commands is free, except that a changed disk size recreates the volume.',
        likelihood: 'usual',
        checks: [
          look(
            'Compare the old and new spec, field by field, against the list above. The review step shows Free update when it qualifies.',
          ),
        ],
        fixes: [
          fix(
            'Revert the field that grew, or accept the price, which is the new total minus a credit for the time you have not used.',
          ),
        ],
        proof: src('9.5.4; 4.5'),
        lessons: ['operate-your-app', 'resources-pricing'],
        terms: ['renewal', 'price-quote'],
      },
      {
        id: 'renewal-on',
        title: 'Renewal was switched on',
        why: 'The Renewal toggle adds a period on top of the current expiry. That is what you pay for, minus the credit for unused time at your old spec price. The total may not exceed one year.',
        likelihood: 'common',
        checks: [
          look(
            'On the Subscription tab, check the Management Action and the period shown under "After renewal subscription until".',
          ),
        ],
        fixes: [fix('Switch the action to Update if you only want to change the spec.')],
        proof: src('9.5.4; 5.4'),
        lessons: ['operate-your-app'],
        terms: ['renewal', 'expire'],
      },
      {
        id: 'update-rate',
        title: 'Free updates are limited in number',
        why: `The code allows a free update only while there are ${F.freeUpdateWindows}. At ${F.blockSec} second blocks those windows are ${F.freeUpdateHours}. The source comment says 1, 2 and 5 days, which were right for the older ${F.legacyBlockMin} minute blocks.`,
        likelihood: 'rare',
        checks: [api('messages', 'Count `fluxappupdate` messages in the recent `height` range.')],
        fixes: [fix('Batch changes into one update.')],
        proof: src(
          '4.5; 13 (omissions)',
          'The limits and the block counts are read in source. The hours are our arithmetic at 30 second blocks; the rate limit was not tested live.',
        ),
        lessons: ['operate-your-app'],
      },
    ],
    lessons: ['operate-your-app', 'resources-pricing'],
    related: ['price-higher-than-expected', 'data-gone-after-update'],
  },

  {
    id: 'refund-question',
    stage: 'cost',
    title: 'Can I get my money back?',
    summary: 'You paid for an app you no longer want, or a deployment did not work.',
    seen: ['Refunds are not automatic', '30-Day Money-Back Guarantee', 'Cancel Subscription'],
    keywords: [
      'refund',
      'money back',
      'cancel',
      'cancel subscription',
      'guarantee',
      'support ticket',
      'chargeback',
      'paid by mistake',
    ],
    quick:
      'Refunds are not automatic. The Subscription tab says to open a support ticket, and the marketing pages offer a 30 day money-back guarantee on the first paid period.',
    causes: [
      {
        id: 'not-automatic',
        title: 'Cancelling does not refund by itself',
        why: 'The app is removed from the network at once and its data is lost. The screen says refunds are not automatic and that you must open a support ticket to ask for one.',
        likelihood: 'usual',
        checks: [look('On the Subscription tab, open Cancel and read the notice before you confirm.')],
        fixes: [
          fix('Open a support ticket as the notice says, and give the app name and the payment details.'),
        ],
        proof: src('9.0 row 7; 9.5.4'),
        lessons: ['operate-your-app'],
      },
      {
        id: 'first-period-guarantee',
        title: 'A money-back guarantee applies to the first paid period',
        why: 'Several marketing pages (the registration landing, WordPress, FluxDrive, Orbit and the game hub) advertise a 30 day money-back guarantee on the first paid period. The docs say it is handled through a support ticket.',
        likelihood: 'common',
        checks: [look('Read the terms on the page where you bought, and the date of your first payment.')],
        fixes: [fix('Ask support inside the 30 days, and quote the page you bought from.')],
        proof: live(
          '9.0 row 7; 1.5',
          'The guarantee wording was read on the live pages. That it is handled through a support ticket is from the docs only.',
        ),
        lessons: ['operate-your-app'],
      },
      {
        id: 'no-protocol-path',
        title: 'The network itself has no refund path',
        why: 'The whitepaper found no code path that returns FLUX or fiat once it is paid. The one route we know of is the support ticket that the Subscription tab and the money-back guarantee point to.',
        likelihood: 'possible',
        checks: [look('Nothing to check on the network. The decision is made by support.')],
        fixes: [
          fix(
            'Do not wait for an automatic return. Ask support, and keep your transaction id and registration hash.',
          ),
        ],
        proof: docs(
          '1.5; 5.4',
          'The whitepaper found no code path that returns a payment. What support does in practice was not tested.',
        ),
        lessons: ['your-toolkit'],
      },
    ],
    lessons: ['operate-your-app', 'your-toolkit'],
    related: ['app-expired', 'payment-not-recognised'],
    caveat:
      'Refund handling is a support matter. Quote what the screen and the pages say, and do not count on more.',
  },
];
