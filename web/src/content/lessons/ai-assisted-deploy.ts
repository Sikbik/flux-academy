/**
 * Lesson 10, ai-assisted-deploy: describe it, review it, sign it. What the FluxCloud assistant does (it drafts
 * a specification, checks things and fills in the deploy form) and what only you do (sign and pay), and how
 * to review a draft in three passes: against your sentence, through the linter, against the price.
 *
 * Planted failures: a draft that dropped the placement and changed the container port (no lint code, wrong
 * against the sentence), a moving tag, a token copied into a public spec, one instance and a size nobody
 * measured (steps 2 to 4); a second draft with a polarity slip in its placement, a registry prefix, a data
 * folder that is not the image's and too little memory (checkpoint).
 *
 * Facts: docs/research/FACTS.md 15.2 (the assistant: its tools, the hand off, what the page corrects, what
 * has no backing), 6.6 (the clocks), 4.3 and 4.4 (the price and the scope fee), 11 (mistakes). The drafts and
 * everything derived from them live in `content/drafts/ai-assisted-deploy.ts` and are pinned by its test.
 * Prices and durations come from the engine at module load: the baked rate card and `shared/flux/timing.ts`.
 *
 * The console's own tool list is not in the engine (`shared/flux/agents.ts` holds the two MCP servers), so the
 * one tool name used here carries its FACTS row. The drafts are examples written for the lesson; nothing here
 * claims how good a real draft is (FACTS 15.2.11).
 */

import {
  BAKED_PRICING,
  BUNDLE_INSTANCES,
  HW_DISCOUNT_MAX_INSTANCES,
  HW_DISCOUNTS,
  IMAGE_RECHECK_HOURS,
  INSTALL_START_USUAL_MIN,
  PAYMENT_WINDOW_MIN,
  priceStages,
  REGISTRATION_DEADLINE_MIN,
  SPAWN_DEFERRAL_RANGE_MIN,
  TARGET_BLOCK_SEC,
  UI_WATCHER_MIN,
} from '@shared/flux';
import type { Lesson } from '@/learn/types';
import {
  BUDGET_A,
  BUDGET_B,
  BUDGET_DOLLARS,
  DRAFT_A,
  DRAFT_A_FOUR,
  DRAFT_A_LINTED,
  DRAFT_A_READ,
  DRAFT_B,
  DRAFT_B_FIX,
  DRAFT_B_LINES,
  exampleSession,
  flaggedLines,
  lintOf,
  PEAK,
  PINNED_TAG,
  PRICE,
  PROMPT_B,
  RATES_DATE,
  SEALED,
  SIZED,
  usd,
} from '../drafts/ai-assisted-deploy.ts';

// ---------------------------------------------------------------------------
// Numbers and words from the engine
// ---------------------------------------------------------------------------

const P = BAKED_PRICING.params;
/** The encryption fee after the division by three: about this much per instance, before discounts. */
const SCOPE_EACH = P.scope / BUNDLE_INSTANCES;
/** What sealing the token adds to the sized app, three copies, at the baked rates. */
const SEALING_FROM = PRICE.aSizedPublic;
const SEALING_TO = PRICE.aSized;

/** The small app discount that ends at the fourth copy, with the working at four. */
const SMALL = HW_DISCOUNTS[0] ?? { maxCpu: 3, maxRam: 6000, maxHdd: 150, factor: 0.8, label: '20 percent' };
const CLIFF_AT = HW_DISCOUNT_MAX_INSTANCES + 1;
const NUMBER_WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const CLIFF_WORD = NUMBER_WORD[CLIFF_AT] ?? String(CLIFF_AT);
const FOUR = priceStages(DRAFT_A_FOUR, BAKED_PRICING.params);

/** The clocks, in words, from `shared/flux/timing.ts`. */
const INSTALL_USUAL = `${INSTALL_START_USUAL_MIN.from} to ${INSTALL_START_USUAL_MIN.to} minutes`;
const BIG_NODE_WAIT = `${SPAWN_DEFERRAL_RANGE_MIN.min} to ${SPAWN_DEFERRAL_RANGE_MIN.max} minutes`;

/** A size in a line of prose. */
const sizeOf = (c: { cpu: number; ram: number; hdd: number }): string =>
  `${c.cpu} ${c.cpu === 1 ? 'core' : 'cores'}, ${c.ram} MB of memory and ${c.hdd} GB of disk`;

// ---------------------------------------------------------------------------
// The example session of step 1, built from the draft so it cannot drift from it
// ---------------------------------------------------------------------------

const SESSION = exampleSession();

// ---------------------------------------------------------------------------
// The checkpoint's key, derived from the linter and the sentence
// ---------------------------------------------------------------------------

/** The budget as the sentence says it: "under USD 1.50", one cent above the highest price that passes. */
const BUDGET_B_SAID = usd(BUDGET_B + 0.01);

const FLAGGED_B = flaggedLines(DRAFT_B_LINES, DRAFT_B, lintOf(DRAFT_B));
const FLAGGED_B_IDS = FLAGGED_B.map((f) => f.id);
/** The codes the linter gave a line, as code spans ("`IMAGE_LATEST` and `IMAGE_DOCKER_IO_HOST`"). */
const codesOfLine = (id: string): string => {
  const codes = (FLAGGED_B.find((f) => f.id === id)?.codes ?? []).map((c) => `\`${c}\``);
  return codes.length < 2
    ? codes.join('')
    : `${codes.slice(0, -1).join(', ')} and ${codes[codes.length - 1]}`;
};

const lesson: Lesson = {
  id: 'ai-assisted-deploy',
  hook: "The assistant in FluxCloud turns a sentence into a draft spec, and you decide whether to sign it. You will review two drafts against what you asked, against the linter and against the price, and see where the assistant's job ends and yours begins.",
  objectives: [
    'Say what the FluxCloud assistant does (drafts, checks, looks things up, fills in the deploy form) and what only you do: sign and pay.',
    'Review a draft in three passes: against your sentence, through the linter and against the price.',
    "Repair the mistakes a draft can carry: a moving tag, a secret in a public spec, one copy, a size nobody measured and a data folder that is not the image's.",
    'Say what happens between signing and a running app, and which clocks are running.',
  ],
  steps: [
    {
      id: 'proposes',
      title: 'A sentence in, a draft out',
      body: [
        // fact: FACTS 15.2.2 (16 tools: navigation, one proposal tool, three checks, four reference reads, five reads of your own apps; nothing that deploys, signs, pays, cancels or controls an app)
        'The {{term:ai-assistant}} in {{term:fluxcloud}} turns a sentence into a draft {{term:app-spec}}. To do that it can look up a template, check that an image tag exists, ask a node to validate the spec and ask the network for a price. It cannot deploy, sign or pay, because none of the tools it is given does any of those. The [agents reference](/reference/agents#console-assistant) lists what it can do.',
        // fact: FACTS 15.2.2 (ui_prefill_deploy, description verbatim), 15.2.3 (the review card, its note and the hand off; the strings are DOCS-ONLY, so "at the time of writing")
        'It hands the draft to the page with one tool, `ui_prefill_deploy`, whose own description ends with "you never deploy or pay". The page shows the draft as a review card. At the time of writing the card says that nothing has been deployed and that the assistant cannot sign or spend. You sign and pay in the ordinary deploy form.',
      ],
      callouts: [
        {
          kind: 'why',
          // fact: FACTS 15.2.3 (review then sign: the normal deploy form), 15.2.1 (price line), 15.2.2 (flux_quote_app asks the network)
          body: "An assistant changes who types the spec, not what the network does. A draft goes through the same deploy form, is priced by the network's own formula and is registered with a message that you sign.",
        },
        {
          kind: 'gotcha',
          // fact: FACTS 15.2.4 (privacy note, DOCS-ONLY: conversations help improve the model, never paste keys, seed phrases or passwords)
          title: 'The sentence has a token in it',
          body: 'The token is an example value, put there on purpose. At the time of writing the console warns that conversations help improve its model, so never paste a real key, seed phrase or password into the box.',
        },
      ],
      stage: {
        kind: 'code',
        files: [
          { name: 'example-session.txt', lang: 'text', code: SESSION.code, highlight: SESSION.highlight },
        ],
      },
    },
    {
      id: 'read-it',
      title: 'Read it against your sentence',
      body: [
        'The card is a summary, and a draft can be valid and still not be what you asked for. Your sentence said "Europe only" and "it listens on 8000". Two lines of the draft say something else. Find them and change them. The other findings are for the next pass.',
        // fact: FACTS 3.5 (an empty geolocation allows everywhere; ac allows and a!c forbids), 3.3 and 11 row 1 (the container port is where the traffic is delivered)
        'No checker does this pass for you. The linter has never seen your sentence, so an empty {{term:geolocation}} (anywhere on the network) and a container port of 8080 are both valid. A placement entry starts with `ac` to allow a place and `a!c` to forbid it, so `acNA` means North America only and `a!cNA` means anywhere but North America. The lesson {{lesson:geo-placement}} has the whole syntax.',
      ],
      callouts: [
        {
          kind: 'tip',
          // fact: FACTS 15.2.5 (what the page corrects before a proposal reaches the form, and the list it shows; DOCS-ONLY string)
          body: 'At the time of writing the page repairs a few things before the draft reaches the form and lists each change under "Corrected before it reached the form": names are reduced to lower case letters and digits, an image with no tag gets `latest`, sizes are clamped and malformed environment lines are dropped. Read that list first.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: DRAFT_A,
        editable: ['geolocation', 'compose[0].ports', 'compose[0].containerPorts'],
        focus: [
          {
            path: 'geolocation',
            note: 'Where the app may run. An empty list means anywhere on the network.',
          },
          {
            path: 'compose[0].ports',
            note: 'The public port: the number visitors reach.',
          },
          {
            path: 'compose[0].containerPorts',
            note: 'The port the app listens on inside its container, paired with the public port by position.',
          },
        ],
        show: ['form', 'json'],
      },
      task: {
        kind: 'spec',
        prompt: 'Make the draft say what your sentence said.',
        hint: 'Placement is `geolocation`: an empty list allows anywhere, and the form has a button for each continent. The port the app listens on is the one inside the container, so look at `containerPorts`, not at the public port.',
        check: {
          all: [
            {
              path: 'geolocation',
              op: 'includes',
              value: 'acEU',
              message:
                'The sentence said Europe only. An empty list allows anywhere: add the entry that allows Europe.',
            },
            {
              path: 'compose[0].containerPorts',
              op: 'includes',
              value: 8000,
              message:
                'The sentence said the app listens on 8000. That is the container port, where the traffic is delivered inside the container.',
            },
          ],
        },
        solution: { geolocation: ['acEU'], compose: [{ containerPorts: [8000] }] },
      },
    },
    {
      id: 'lint-it',
      title: 'Let the linter read it',
      body: [
        'Now the mechanical pass. The linter from the {{lab:spec-forge}} reads this draft too, and the issues panel lists what it found: three warnings. Open one to see its code, such as `IMAGE_LATEST`, why it matters and what to do about it.',
        // fact: FACTS 6.3 (the six-hourly digest comparison, read from source and not observed live), 15.2.5 (a missing tag becomes latest), 11 rows 18 and 19, 3.7 (enterprise encrypts the components)
        `The sentence gave no tag, so the page added \`latest\`. FluxOS is set to compare an image with its registry about every ${IMAGE_RECHECK_HOURS} hours and to redeploy it when it changed, so \`latest\` can change under a running app (read from the source, not observed live). The token is the other trap: {{lesson:env-and-secrets}} covers why a public spec publishes every variable and how an {{term:enterprise-app}} encrypts them.`,
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 3.10 (the image, its size and architecture, and placement feasibility are checked on live submission only)
          body: 'A clean report is not an acceptance. The network checks the image, its size and architecture, and whether enough nodes can host the placement again when you register.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: DRAFT_A_READ,
        editable: ['compose[0].repotag', 'instances', 'enterprise', 'compose[0].environmentParameters'],
        focus: [
          {
            path: 'compose[0].repotag',
            note: 'A tag names one build. `latest` is whichever build the registry calls latest today.',
          },
          { path: 'instances', note: 'One copy is down whenever its node is.' },
          {
            path: 'compose[0].environmentParameters',
            note: 'The card warned that the model wrote these. A public spec publishes every variable in it, to anyone.',
          },
          {
            path: 'enterprise',
            note: 'Turn this on to encrypt the components of the app.',
          },
        ],
        show: ['form', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Clear all three warnings, and keep the token in the app.',
        hint: 'Each warning has a fix in the issues panel. A tag such as `1.2.0` names a version. The secret-looking variable name is what the linter reacts to, and the switch that encrypts the components is `enterprise`.',
        check: {
          all: [
            {
              lint: 'absent',
              codes: ['IMAGE_LATEST', 'IMAGE_UNTAGGED', 'INSTANCES_ONE', 'ENV_SECRET_PUBLIC'],
              message: 'A warning is still open. The issues panel lists it with its fix.',
            },
            {
              path: 'enterprise',
              op: 'exists',
              message: 'Turn Enterprise on: it encrypts the spec, so the token is no longer published.',
            },
            {
              path: 'compose[0].environmentParameters',
              op: 'matches',
              value: '^ADMIN_TOKEN=',
              message:
                'Keep `ADMIN_TOKEN`: the app still needs it. Encrypting the spec hides it, deleting it breaks the app.',
            },
          ],
        },
        solution: { instances: 3, enterprise: SEALED, compose: [{ repotag: PINNED_TAG }] },
      },
    },
    {
      id: 'size-it',
      title: 'Price it, then size it',
      body: [
        // fact: FACTS 4.3 (the formula) and 4.4 (the scope fee). Every number is the engine's, at the baked rate card.
        `At the rates read on ${RATES_DATE}, the draft as returned prices at ${usd(PRICE.aReturned)} a month: one copy of a ${DRAFT_A.compose[0]?.cpu} core app with the token in the open. The repairs of the last step, three copies and an encrypted spec, bring the same size to ${usd(PRICE.aLinted)}. The first number was for a draft you would not sign.`,
        // fact: FACTS 4.3 (the price follows what the spec reserves, not what the app uses)
        `Size the app from a measurement, not from what sounds safe. In this example a test run of the image peaked at ${PEAK.cpu} of a core, ${PEAK.ram} MB of memory and ${PEAK.hdd} GB of disk, and the sentence said under USD ${BUDGET_DOLLARS} a month. You pay for what the spec reserves, so bring each line down to what the app needs, with some room above it, and watch the price.`,
      ],
      callouts: [
        {
          kind: 'cost',
          // fact: FACTS 4.3 and 4.4 (the scope fee is added to the bundle before the division by three, claim family 2)
          body: `Encryption is priced per app, not per secret. The scope fee of ${usd(P.scope)} goes into the bundle before the division by three, about ${usd(SCOPE_EACH)} per instance, so it grows with the number of copies. For ${sizeOf(SIZED)} with three copies, sealing the token takes the price from ${usd(SEALING_FROM)}, the network minimum, to ${usd(SEALING_TO)}.`,
        },
      ],
      stage: {
        kind: 'spec',
        spec: DRAFT_A_LINTED,
        editable: ['compose[0].cpu', 'compose[0].ram', 'compose[0].hdd'],
        focus: [
          { path: 'compose[0].cpu', note: `The test run peaked at ${PEAK.cpu} of a core.` },
          { path: 'compose[0].ram', note: `The test run peaked at ${PEAK.ram} MB.` },
          { path: 'compose[0].hdd', note: `The test run used ${PEAK.hdd} GB.` },
        ],
        show: ['form', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: `Bring the price under USD ${BUDGET_DOLLARS} a month with three copies and the token sealed, without going below what the test run used.`,
        hint: 'The price panel shows which resource costs the most. Cores cost the most per unit and memory is next, and the encryption fee does not shrink with the size. Lower the three resources, but keep each at or above what the test run used.',
        check: {
          all: [
            {
              price: 'max',
              usd: BUDGET_A,
              message: `Still over USD ${BUDGET_DOLLARS}. The cores cost the most per unit, then the memory.`,
            },
            {
              path: 'compose[0].cpu',
              op: 'gte',
              value: PEAK.cpu,
              message: `The test run used ${PEAK.cpu} of a core at its busiest. Do not size below what it used.`,
            },
            {
              path: 'compose[0].ram',
              op: 'gte',
              value: PEAK.ram,
              message: `The test run used ${PEAK.ram} MB at its busiest. Do not size below what it used.`,
            },
            {
              path: 'compose[0].hdd',
              op: 'gte',
              value: PEAK.hdd,
              message: `The test run used ${PEAK.hdd} GB. Do not size below what it used.`,
            },
          ],
        },
        solution: { compose: [{ ...SIZED }] },
      },
    },
    {
      id: 'sign-it',
      title: 'Sign, then pay inside the clocks',
      body: [
        // fact: FACTS 15.2.3 (Review spec and deploy applies the draft to the normal deploy form; the assistant is not involved in signing), 6.6 (the message lives MESSAGE_TTL_SEC on each node from receipt)
        `The button "Review spec and deploy" applies the draft to the ordinary deploy form: the quote, the specification you are signing, then your signature and your payment. The assistant takes no part in any of that. Registering sends a message that each node keeps for ${REGISTRATION_DEADLINE_MIN} minutes from the moment it receives it, so a payment that confirms later finds nothing to link.`,
        // fact: FACTS 6.6 (the 30 minute window is the page's text, the node-side limit is the hour; the watcher only reports), 4.7 (pay the full quote), 15.2.1 (the new console shows a 30 minute window and a watcher)
        `The page gives a payment window of ${PAYMENT_WINDOW_MIN} minutes. The limit on the nodes is the hour above, so ${PAYMENT_WINDOW_MIN} minutes is the cautious figure to work to. Pay the full quoted amount. The page's watcher stops waiting after ${UI_WATCHER_MIN} minutes. That only stops the page reporting: check the app's status, because a confirmed payment keeps deploying.`,
        // fact: FACTS 6.1 rows 7 to 10 and 6.6 (block time, the usual wait for an install to start, the deferral of bigger nodes), 15.2.8 (the deploy page's own "a few minutes"; DOCS-ONLY)
        `After payment the wait belongs to the network. A block takes ${TARGET_BLOCK_SEC} seconds, and FluxCloud says a node usually starts installing within ${INSTALL_USUAL}. At the time of writing the deploy page says a few minutes after the payment lands. Those are estimates: a bigger node waits ${BIG_NODE_WAIT} before it takes a small app, so a copy can take about two hours.`,
      ],
      stage: { kind: 'diagram', id: 'lifecycle', beat: 1 },
    },
    {
      id: 'promises',
      title: 'What the page says and what holds',
      body: [
        // fact: FACTS 15.2.8 (the landing claims are DOCS-ONLY and not backed; the balance page says each deployment is paid for on its own today), 5.4 (no grace period), 15.2.13 items 7 and 8
        "A page is not a specification. At the time of writing the console says that a deployment is live in about 30 seconds, that a balance pays for the first day and that a grace period follows. Nothing verifiable backs a balance that pays for a deployment or a grace period, and the console's own balance page says each deployment is paid for on its own today.",
        // fact: FACTS 15.2.13 item 1 (an agent can sign and pay only when it sets confirm, with the keys it was given), 15.1.5
        'Keep the habit this lesson built: read the draft against your sentence, lint it, price it, size it, then sign. It does not depend on who typed the spec. An {{term:ai-agent}} outside the console can sign and pay by itself when it holds the keys, so it needs limits on what it may do without asking you. {{lesson:agents-and-mcp}} and the {{lab:agent-desk}} are where you practise that.',
      ],
      stage: {
        kind: 'compare',
        left: {
          label: 'Page claims with no backing',
          tone: 'bad',
          // fact: FACTS 15.2.1 (headline), 15.2.8 (balance, first day, grace period; DOCS-ONLY strings)
          body: 'Live in about 30 seconds. Paid from a balance you fund. A grace period before deployments stop.',
        },
        right: {
          label: 'What holds',
          tone: 'good',
          // fact: FACTS 6.1, 6.6 (block time and install waits), 15.2.8 (each deployment is paid for on its own), 5.4 (removal at the expiry block, no grace)
          body: `A block takes ${TARGET_BLOCK_SEC} seconds and a running copy takes minutes, up to about two hours. Each deployment is paid for on its own. An app is removed soon after its last block, with no grace, so download your data first.`,
        },
      },
    },
  ],
  checkpoint: [
    {
      id: 'find-the-lines',
      kind: 'multi',
      prompt: `You asked: "${PROMPT_B}" The assistant returned the lines below. Pick every line you would change before you sign.`,
      options: DRAFT_B_LINES.map((line) => ({
        id: line.id,
        label: line.label,
        ...(line.fine && !FLAGGED_B_IDS.includes(line.id) ? { why: line.fine } : {}),
      })),
      answers: FLAGGED_B_IDS,
      // fact: FACTS 3.5 (a forbid entry), 3.3 and 11 row 19 (docker.io prefix, latest), 7.2 (the data folder), lint RAM_TOO_SMALL_FOR_IMAGE (image documentation, UNVERIFIED as exact numbers)
      explain: `Four lines are wrong. \`a!cEU\` forbids the continent you asked for, and no lint code says so: only the sentence does. The image has a registry prefix and a moving tag (${codesOfLine('image')}), the data folder is not the one the linter lists for Nextcloud (${codesOfLine('data')}) and 300 MB is under the memory it lists (${codesOfLine('size')}). Those two come from the linter's notes on well known images, not from Flux, so check the image's own documentation. Two copies is what you asked for, and port 80 behind a free public port is fine.`,
      hint: 'Read each line against the sentence first, then against the rules of the image: does it allow or forbid, is the tag a version, is the data folder the one this image uses, is there enough memory?',
    },
    {
      id: 'repair-the-draft',
      kind: 'spec-fix',
      prompt: `Repair the draft so it does what the sentence asked and nothing more: "${PROMPT_B}" Keep what was right.`,
      spec: DRAFT_B,
      check: {
        all: [
          {
            lint: 'absent',
            codes: [
              'IMAGE_LATEST',
              'IMAGE_UNTAGGED',
              'IMAGE_DOCKER_IO_HOST',
              'STATEFUL_NO_VOLUME',
              'STATEFUL_NOT_SYNCED',
              'RAM_TOO_SMALL_FOR_IMAGE',
              'RAM_STEP',
              'GEO_SYNTAX',
              'GEO_CONFLICT',
            ],
            message: 'A warning is still open. The issues panel names the line and its fix.',
          },
          {
            path: 'geolocation',
            op: 'includes',
            value: 'acEU',
            message: 'The sentence asked for Europe only. `acEU` allows Europe and `a!cEU` forbids it.',
          },
          {
            path: 'compose[0].containerData',
            op: 'matches',
            value: '^g:/var/www/html',
            message:
              'Keep the primary and standby mount: it was right, because one copy runs and writes while the other holds a synced copy. Only the folder was wrong.',
          },
          {
            path: 'instances',
            op: 'eq',
            value: 2,
            message: 'The sentence asked for two copies. Keep two.',
          },
          {
            price: 'max',
            usd: BUDGET_B,
            message: `Still over the budget in the sentence, under ${BUDGET_B_SAID} a month. More memory than the image needs is the usual cause: raise it only as far as the warning asks.`,
          },
        ],
      },
      solution: DRAFT_B_FIX,
      explain: `The sentence decided the placement, the linter found the image, the data folder and the memory, and the price check kept the repair from overshooting. At ${usd(PRICE.bRepaired)} the repair costs what the draft did, and raising the memory to 4000 MB to be safe would have cost ${usd(PRICE.bOversized)}.`,
      hint: 'Fix the four lines the last challenge named. The memory has to clear what the warning gives, and the budget rules out a repair that overshoots it by a wide margin. A suggested value can raise a warning of its own, so read the issues panel again after you accept one.',
    },
    {
      id: 'one-more-copy',
      kind: 'estimate',
      prompt: `The repaired quotes API runs ${DRAFT_A_LINTED.instances} copies, with the token sealed, at ${sizeOf(SIZED)}. You ask the assistant for one more copy "to be safe". About how much a month is it with ${CLIFF_WORD} copies?`,
      spec: DRAFT_A_FOUR,
      quantity: 'usd-per-month',
      tolerance: 0.1,
      unit: 'USD',
      // fact: FACTS 4.3 steps A, D and E (a share per instance, the small app discount ends at four) and 4.4
      explain: `The ${SMALL.label} small app discount ends at ${CLIFF_WORD} copies, so ${CLIFF_WORD} shares of ${usd(FOUR.perInstanceUsd)} come to ${usd(FOUR.afterHwUsd)} and round up to ${usd(PRICE.aFour)}, against ${usd(PRICE.aSized)} at three. The linter notes the jump already at three copies, with \`INSTANCES_PRICE_CLIFF\`.`,
      hint: `Work out one share: the three resource lines plus the encryption fee, divided by three. Then ask whether the discount for small apps still applies at ${CLIFF_WORD} copies.`,
    },
    {
      id: 'what-it-cannot-do',
      kind: 'multi',
      prompt: 'Which of these can the assistant in FluxCloud do? Pick every one that applies.',
      options: [
        {
          id: 'sign',
          label: 'Sign the registration once you answer yes',
          // fact: FACTS 15.2.2 (no tool signs), 15.2.3 (you sign in the deploy form)
          why: 'It has no tool that signs. After you apply the draft, the registration is signed in the deploy form, by you.',
        },
        {
          id: 'form',
          label: 'Fill in the deploy form with its draft, for you to review and change',
        },
        {
          id: 'seconds',
          label: `Have the app running about ${TARGET_BLOCK_SEC} seconds after you pay`,
          // fact: FACTS 6.1 rows 7 to 10, 6.6, 15.2.13 item 8
          why: `A block takes ${TARGET_BLOCK_SEC} seconds, but the payment has to confirm and a node has to start installing, which FluxCloud says usually takes ${INSTALL_USUAL}. A bigger node waits ${BIG_NODE_WAIT} before it takes a small app, so a copy can take about two hours.`,
        },
        {
          id: 'logs',
          label: 'Read the logs of your own apps when you are signed in',
        },
        {
          id: 'lookup',
          label: 'Get a price from the network and check that an image tag exists',
        },
        {
          id: 'balance',
          label: 'Pay the first day from a balance you have funded',
          // fact: FACTS 15.2.8 (the balance page says each deployment is paid for on its own today; DOCS-ONLY), 15.2.13 item 7
          why: "It cannot pay, and at the time of writing the console's own balance page says each deployment is paid for on its own, so there is no deployment balance to spend.",
        },
      ],
      // fact: FACTS 15.2.2 (the tool list: the form hand off, validate, check image, quote, and reads of your own apps when signed in)
      answers: ['form', 'logs', 'lookup'],
      explain:
        'The assistant drafts, checks and looks things up, and it can read your own apps when you are signed in. Signing and paying are yours, and a running copy takes minutes after a confirmed payment.',
      hint: 'Look for a tool that changes something. The assistant has tools that read, check and propose, and none that signs, pays or deploys.',
    },
  ],
  recap: [
    'The assistant drafts, checks and looks things up, then hands the draft to the deploy form. It has no tool that deploys, signs or pays: you sign and you pay.',
    'Review a draft in three passes: against your sentence, through the linter, against the price. A clean lint report does not prove that the draft says what you asked.',
    `Every repair moves the price. Three copies and an encrypted spec took the draft from ${usd(PRICE.aReturned)} to ${usd(PRICE.aLinted)}, and a size taken from a test run brought it to ${usd(PRICE.aSized)}.`,
    `Pay the full quote inside the window. The registration lives ${REGISTRATION_DEADLINE_MIN} minutes on each node, and a running copy takes minutes, not ${TARGET_BLOCK_SEC} seconds.`,
    'The habit does not depend on who typed the spec. An outside agent can sign and pay on its own, so it needs limits: that is a later lesson.',
  ],
  further: [
    {
      label: 'FluxCloud docs: deploy with AI agents (MCP)',
      url: 'https://docs.runonflux.com/fluxcloud/ai-agents-mcp',
    },
    {
      label: 'FluxCloud docs: the cost calculator',
      url: 'https://docs.runonflux.com/fluxcloud/cost-calculator',
    },
    {
      label: 'FluxCloud docs: components, ports and resources',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
    },
  ],
  terms: ['ai-assistant', 'ai-agent'],
};

export default lesson;
