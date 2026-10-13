/**
 * Support data for lesson 10, `ai-assisted-deploy`: the two example drafts an assistant "returned", the
 * repaired states between the passes, and everything the lesson derives from the engine about them.
 *
 * The drafts are EXAMPLES, written by hand for the lesson with mistakes put in on purpose. They are not the
 * output of a live assistant and say nothing about how good real drafts are (FACTS 15.2.11: not measured).
 * Each is a complete `FluxAppSpec`, so `ai-assisted-deploy.test.ts` can parse, lint and price it and pin
 * the codes it is meant to carry.
 *
 * Which mistakes, and why those
 *   - the page corrects names, a missing tag, sizes and malformed lines before a draft reaches the form
 *     (FACTS 15.2.5), so no draft here carries a component name or a placement code the page would have
 *     repaired. What survives is what the page cannot know: a tag it added (`latest`), a secret the model
 *     copied from the sentence, one instance, a guessed size, a container port that is not the one the
 *     sentence named, a registry prefix, a data folder that is not the image's, a polarity slip in a
 *     placement entry.
 *   - two of them have no lint code at all (they are wrong against the SENTENCE), so the first pass of the
 *     lesson cannot be handed to the linter.
 *
 * What is derived, not typed
 *   - which lines of draft B are wrong (the key of the "find the lines" challenge): `flaggedLines` reads a
 *     `lintSpec` report and compares the draft with what the sentence asked;
 *   - every price (`priceOf`, `quote()` at the baked rate card, one month).
 *
 * Facts: docs/research/FACTS.md. Section 11 rows 1, 13, 18, 19 and 3.3 (`docker.io/` fails the lookup) for
 * the mistakes; 15.2.2, 15.2.3 and 15.2.5 for what the console assistant does and corrects.
 */

import type { FluxAppSpec, FluxComponentSpec, LintIssue, LintReport } from '@shared/flux';
import { BAKED_PRICING, blocksToMonths, defaultComponent, defaultSpec, lintSpec, quote } from '@shared/flux';

/** What the Spec Forge writes into `enterprise`: FluxCloud makes the real ciphertext when you register. */
export const SEALED = 'ENCRYPTED_BY_FLUXCLOUD_PLACEHOLDER';

// ---------------------------------------------------------------------------
// Engine helpers
// ---------------------------------------------------------------------------

/** The lint every lesson check uses: the teaching lint over the spec. */
export function lintOf(spec: FluxAppSpec): LintReport {
  return lintSpec(spec, { teaching: true });
}

/** Monthly USD at the baked rate card (the card the lesson text and the lesson checks use). */
export function priceOf(spec: FluxAppSpec): number {
  return quote(spec, BAKED_PRICING.params, { months: 1 }).usdPerMonth;
}

/** The lint codes of a report, in report order, without repeats. */
export function codesOf(report: LintReport): string[] {
  return [...new Set(report.issues.map((i) => i.code))];
}

/** The date of the rate card every price in the lesson is worked out at. */
export const RATES_DATE = BAKED_PRICING.capturedAt;

/** USD with two decimals and the currency written out, as the other lessons do. */
export const usd = (n: number): string => `USD ${n.toFixed(2)}`;

/** The highest monthly price that is still under `dollars`: one cent less, in whole cents. */
const justUnder = (dollars: number): number => Math.round(dollars * 100 - 1) / 100;

/** A copy of a spec whose first component has `patch` applied. */
function withComponent(spec: FluxAppSpec, patch: Partial<FluxComponentSpec>): FluxAppSpec {
  const [first, ...rest] = spec.compose;
  if (!first) throw new Error('ai-assisted-deploy drafts: a draft needs a component');
  return { ...spec, compose: [{ ...first, ...patch }, ...rest] };
}

// ---------------------------------------------------------------------------
// Draft A: the walkthrough (the quotes API)
// ---------------------------------------------------------------------------

/** The budget the person gave in the sentence. */
export const BUDGET_DOLLARS = 5;
/** The highest monthly price that is still under it. */
export const BUDGET_A = justUnder(BUDGET_DOLLARS);

/** What the person typed. The token in it is the lesson's planted trap (FACTS 15.2.4 privacy note, 11 row 18). */
export const PROMPT_A = `Host my quotes API, the image yourname/quotes. It listens on 8000. The admin token is tk_7f3a91. Europe only, under USD ${BUDGET_DOLLARS} a month.`;

/** What a test run of the image showed. The floor of the sizing task: never go below what it used. */
export const PEAK = { cpu: 0.3, ram: 300, hdd: 1 } as const;

/**
 * Draft A as the example assistant returned it.
 *
 * Wrong against the SENTENCE (no lint code): the placement is empty although the sentence said Europe only,
 * and the container port is 8080 although the sentence said it listens on 8000.
 * Wrong against the RULES (lint): `latest` (the page adds it to an image given without a tag, FACTS 15.2.5),
 * the token in a public spec (ENV_SECRET_PUBLIC), one instance (INSTANCES_ONE).
 * Wrong against the PRICE: 4 cores, 8000 MB and 80 GB for an API that peaks at a fraction of that.
 */
export const DRAFT_A: FluxAppSpec = {
  ...defaultSpec(),
  name: 'quotes',
  description: 'Quotes API',
  instances: 1,
  geolocation: [],
  compose: [
    defaultComponent({
      name: 'api',
      description: 'Quotes API',
      repotag: 'yourname/quotes:latest',
      ports: [31001],
      containerPorts: [8080],
      domains: [''],
      environmentParameters: ['ADMIN_TOKEN=tk_7f3a91'],
      commands: [],
      containerData: '/tmp',
      repoauth: '',
      cpu: 4,
      ram: 8000,
      hdd: 80,
    }),
  ],
};

/** What the sentence asked for, as path to value. A draft that differs at one of these is wrong whatever the linter says. */
export const ASKED_A: Readonly<Record<string, unknown>> = {
  geolocation: ['acEU'],
  'compose[0].containerPorts': [8000],
};

/** Pass one fixed: what the sentence asked for is back (Europe, the port the app listens on). */
export const DRAFT_A_READ: FluxAppSpec = withComponent(
  { ...DRAFT_A, geolocation: ['acEU'] },
  { containerPorts: [8000] },
);

/** The tag the repaired draft pins. An example value, not a claim about a real image. */
export const PINNED_TAG = 'yourname/quotes:1.2.0';

/** Pass two fixed: a pinned tag, the token sealed, three copies. */
export const DRAFT_A_LINTED: FluxAppSpec = withComponent(
  { ...DRAFT_A_READ, instances: 3, enterprise: SEALED },
  { repotag: PINNED_TAG },
);

/** Pass three fixed: a size that follows the test run, with room above it (the "Show me" of the sizing task). */
export const SIZED = { cpu: 0.5, ram: 500, hdd: 5 } as const;

export const DRAFT_A_SIZED: FluxAppSpec = withComponent(DRAFT_A_LINTED, { ...SIZED });

/** The same app with the token left in the open: what sealing costs is the difference. */
export const DRAFT_A_SIZED_PUBLIC: FluxAppSpec = { ...DRAFT_A_SIZED, enterprise: '' };

/** One more copy "to be safe": the estimate challenge. */
export const DRAFT_A_FOUR: FluxAppSpec = { ...DRAFT_A_SIZED, instances: 4 };

// ---------------------------------------------------------------------------
// The example session of step 1: the sentence and the review card the page shows
// ---------------------------------------------------------------------------

/**
 * What the page says on a review card: the English strings of the shipped console (`deployAgent.*` in its
 * `en-*.js`, read from the captured bundle 2026-10-13), so the lesson says "at the time of writing" wherever it
 * quotes one (DOCS-ONLY). FACTS 15.2.3 quotes the heading, the two notes and the buttons and 15.2.5 names the
 * `fix.*` family; the four field labels and the sentence for a missing tag are read from the bundle and are not
 * quoted in FACTS. The layout around the strings is approximate: the real
 * card is a grid with the component rows under it, and it formats the memory its own way (the formatter lives
 * in a shared chunk that was not read), so the example calls itself "a card like this".
 *
 * Order on the real card, from the source: heading, the four summary fields, one row per component (name,
 * image, size, `public→container` ports, the environment), the environment warning, "Corrected before it
 * reached the form" with one line per change, the note, then the four buttons.
 */
export const CARD_TEXT = {
  heading: 'Proposed specification',
  fields: { name: 'Name', instances: 'Instances', term: 'Term', size: 'Total' },
  envWarning:
    'The environment variables were written by the model. Check every one against the image before you sign.',
  corrected: 'Corrected before it reached the form',
  /** `deployAgent.fix.tag` with the component and the image filled in, as the page's code fills them. */
  tagFixed: (component: string, image: string): string =>
    `${component}: the image had no tag, so ${image} was used.`,
  note: 'Nothing has been deployed. Apply it to the form, check it, then sign and pay there. The assistant cannot sign or spend.',
  buttons: ['Review spec and deploy', 'Change size', 'Show the JSON', 'Discard'],
} as const;

/** Break `text` into lines of at most `width` characters, on spaces. */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line !== '' && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line === '' ? word : `${line} ${word}`;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** The longest line of the example session, so it reads on a phone without scrolling sideways. */
export const SESSION_WIDTH = 38;

/**
 * The example session as the code stage shows it: the sentence, then the card built from `DRAFT_A` (so the
 * name, size, image, ports and variable cannot drift from the draft the steps work on). `highlight` holds the
 * 1-based lines of the two notes the page prints under the proposal: the warning about the environment
 * variables and the note that nothing has been deployed.
 */
export function exampleSession(): { code: string; highlight: number[] } {
  const c = DRAFT_A.compose[0] as FluxComponentSpec;
  const months = blocksToMonths(DRAFT_A.expire);
  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
  const f = CARD_TEXT.fields;
  const rows: string[] = [];
  const marked: number[] = [];
  const push = (lines: readonly string[], mark = false): void => {
    for (const l of lines) {
      rows.push(l);
      if (mark) marked.push(rows.length);
    }
  };
  const inner = SESSION_WIDTH - 2;
  const indent = (lines: readonly string[]): string[] => lines.map((l) => `  ${l}`);
  push([
    'EXAMPLE, not a real session.',
    'You type:',
    ...indent(wrapText(PROMPT_A, inner)),
    '',
    'The page shows a card like this:',
    `  ${CARD_TEXT.heading}`,
    `    ${f.name.padEnd(9)}  ${DRAFT_A.name}`,
    `    ${f.instances.padEnd(9)}  ${DRAFT_A.instances}`,
    `    ${f.term.padEnd(9)}  ${plural(months, 'month')}`,
    `    ${f.size.padEnd(9)}  ${c.cpu} vCPU, ${c.ram} MB, ${c.hdd} GB`,
    `    ${c.name}  ${c.repotag}`,
    `    ${c.ports[0]}\u2192${c.containerPorts[0]}`,
    ...c.environmentParameters.map((e) => `    ${e}`),
  ]);
  push(indent(wrapText(CARD_TEXT.envWarning, inner)), true);
  push([`  ${CARD_TEXT.corrected}`]);
  push(indent(wrapText(CARD_TEXT.tagFixed(c.name, c.repotag), inner - 2)).map((l) => `  ${l}`));
  push(indent(wrapText(CARD_TEXT.note, inner)), true);
  push([
    `  [ ${CARD_TEXT.buttons[0]} ]`,
    `  [ ${CARD_TEXT.buttons[1]} ] [ ${CARD_TEXT.buttons[2]} ]`,
    `  [ ${CARD_TEXT.buttons[3]} ]`,
  ]);
  return { code: rows.join('\n'), highlight: marked };
}

// ---------------------------------------------------------------------------
// Draft B: the checkpoint (Nextcloud)
// ---------------------------------------------------------------------------

/** The highest monthly price for draft B: the network minimum plus fifty cents of headroom, as in first-deploy. */
export const BUDGET_B = Math.round((BAKED_PRICING.params.minUSDPrice + 0.5) * 100) / 100;

/** What the person typed for draft B. "Under USD 1.50" is the highest price, 1.49, plus a cent. */
export const PROMPT_B = `Nextcloud for my family, Europe only, two copies, under USD ${(BUDGET_B + 0.01).toFixed(2)} a month.`;

/**
 * Draft B as the example assistant returned it. Four lines are wrong:
 *   geolocation   `a!cEU` bans Europe; the sentence asked for it (no lint code: it is valid syntax)
 *   repotag       a `docker.io/` prefix fails the registry lookup (FACTS 3.3) and `latest` moves (6.3, 11 row 19)
 *   containerData the volume is synced, but `/data` is not where Nextcloud keeps its files (STATEFUL_NO_VOLUME)
 *   ram           300 MB is under what Nextcloud needs (RAM_TOO_SMALL_FOR_IMAGE)
 * Two lines look odd and are fine: two instances (the sentence asked for two) and a container port of 80
 * behind a free public port (the image default; the linter only notes it).
 */
export const DRAFT_B: FluxAppSpec = {
  ...defaultSpec(),
  name: 'familycloud',
  description: 'Nextcloud for the family',
  instances: 2,
  geolocation: ['a!cEU'],
  compose: [
    defaultComponent({
      name: 'nextcloud',
      description: 'Nextcloud',
      repotag: 'docker.io/library/nextcloud:latest',
      ports: [31001],
      containerPorts: [80],
      domains: [''],
      environmentParameters: [],
      commands: [],
      containerData: 'g:/data',
      repoauth: '',
      cpu: 1,
      ram: 300,
      hdd: 20,
    }),
  ],
};

/** What the sentence asked for in draft B. */
export const ASKED_B: Readonly<Record<string, unknown>> = {
  geolocation: ['acEU'],
  instances: 2,
};

/**
 * The repair the lesson's "Show me" applies: Europe allowed, a version tag without a host prefix, the data
 * folder where the image keeps it (the sync mode was right and stays), and memory above the image's need.
 * `nextcloud:35.0.1` is a tag that exists on Docker Hub at the time of writing (read 2026-10-13).
 */
export const DRAFT_B_FIX: { geolocation: string[]; compose: Partial<FluxComponentSpec>[] } = {
  geolocation: ['acEU'],
  compose: [{ repotag: 'nextcloud:35.0.1', containerData: 'g:/var/www/html', ram: 600 }],
};

export const DRAFT_B_REPAIRED: FluxAppSpec = withComponent(
  { ...DRAFT_B, geolocation: [...DRAFT_B_FIX.geolocation] },
  { ...DRAFT_B_FIX.compose[0] },
);

/** The repair with the memory raised "to be safe": the budget's guard. */
export const DRAFT_B_OVERSIZED: FluxAppSpec = withComponent(DRAFT_B_REPAIRED, { ram: 4000 });

// ---------------------------------------------------------------------------
// The lines of draft B and which of them are wrong
// ---------------------------------------------------------------------------

export interface DraftLine {
  id: string;
  /** Markup: the line as it sits in the draft. */
  label: string;
  /** JSON paths the line covers. An error or a warning at one of them (or below) flags the line. */
  paths: readonly string[];
  /** A path of this line and the value the sentence asked for there. A line that differs is flagged. */
  asked?: { path: string; value: unknown };
  /** Said to a learner who picks the line although nothing is wrong with it. */
  fine?: string;
}

/** In the order they sit in the JSON of a spec. */
export const DRAFT_B_LINES: readonly DraftLine[] = [
  {
    id: 'copies',
    label: '`"instances": 2`',
    paths: ['instances'],
    asked: { path: 'instances', value: ASKED_B.instances },
    fine: 'Two copies is what the sentence asked for, and the linter warns about one copy, not about two.',
  },
  {
    id: 'geo',
    label: '`"geolocation": ["a!cEU"]`',
    paths: ['geolocation'],
    asked: { path: 'geolocation', value: ASKED_B.geolocation },
  },
  {
    id: 'image',
    label: '`"repotag": "docker.io/library/nextcloud:latest"`',
    paths: ['compose[0].repotag'],
  },
  {
    id: 'ports',
    label: '`"ports": [31001], "containerPorts": [80]`',
    paths: ['compose[0].ports', 'compose[0].containerPorts'],
    fine: 'The public port 31001 carries no fee, and port 80 is the default the linter lists for this image. The linter only notes that a container port under 1024 is privileged.',
  },
  {
    id: 'data',
    label: '`"containerData": "g:/data"`',
    paths: ['compose[0].containerData'],
  },
  {
    id: 'size',
    label: '`"cpu": 1, "ram": 300, "hdd": 20`',
    paths: ['compose[0].cpu', 'compose[0].ram', 'compose[0].hdd'],
  },
];

/** The value of a spec at a path such as `compose[0].repotag`. */
export function valueAt(spec: unknown, path: string): unknown {
  let at: unknown = spec;
  for (const part of path.split('.')) {
    const m = /^([A-Za-z_]\w*)(?:\[(\d+)\])?$/.exec(part);
    if (!m || typeof at !== 'object' || at === null) return undefined;
    at = (at as Record<string, unknown>)[m[1] as string];
    if (m[2] !== undefined) at = Array.isArray(at) ? at[Number(m[2])] : undefined;
  }
  return at;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const isFlag = (i: LintIssue): boolean => i.severity === 'error' || i.severity === 'warning';

/** Issues at a path or below it (`geolocation` covers `geolocation[0]`). */
function issuesAt(report: LintReport, paths: readonly string[]): LintIssue[] {
  return report.issues.filter((i) =>
    paths.some((p) => i.path === p || i.path.startsWith(`${p}[`) || i.path.startsWith(`${p}.`)),
  );
}

export interface FlaggedLine {
  id: string;
  /** Distinct error and warning codes at the line, in report order. */
  codes: string[];
  /** The draft differs from what the sentence asked for at this line. */
  drift: boolean;
}

/**
 * The key of the "find the lines" challenge: a line is wrong when the linter reports an error or a warning
 * at it, or when it differs from what the sentence asked. Derived from a lint report and the sentence.
 */
export function flaggedLines(
  lines: readonly DraftLine[],
  draft: FluxAppSpec,
  report: LintReport,
): FlaggedLine[] {
  const out: FlaggedLine[] = [];
  for (const line of lines) {
    const codes = [
      ...new Set(
        issuesAt(report, line.paths)
          .filter(isFlag)
          .map((i) => i.code),
      ),
    ];
    const drift = line.asked ? !same(valueAt(draft, line.asked.path), line.asked.value) : false;
    if (codes.length > 0 || drift) out.push({ id: line.id, codes, drift });
  }
  return out;
}

/** The paths at which a draft differs from what the sentence asked. */
export function driftOf(draft: FluxAppSpec, asked: Readonly<Record<string, unknown>>): string[] {
  return Object.entries(asked)
    .filter(([path, value]) => !same(valueAt(draft, path), value))
    .map(([path]) => path);
}

// ---------------------------------------------------------------------------
// Every price the lesson says, in one place
// ---------------------------------------------------------------------------

export const PRICE = {
  /** Draft A as returned: one copy, public, 4 cores, 8000 MB, 80 GB. */
  aReturned: priceOf(DRAFT_A),
  /** The same size after the repairs: three copies and the token sealed. */
  aLinted: priceOf(DRAFT_A_LINTED),
  /** Sized from the test run, still three copies and sealed. */
  aSized: priceOf(DRAFT_A_SIZED),
  /** Sized, three copies, token left in the open. */
  aSizedPublic: priceOf(DRAFT_A_SIZED_PUBLIC),
  /** Sized, sealed, four copies. */
  aFour: priceOf(DRAFT_A_FOUR),
  /** Draft B as returned. */
  bReturned: priceOf(DRAFT_B),
  /** Draft B repaired. */
  bRepaired: priceOf(DRAFT_B_REPAIRED),
  /** Draft B repaired with 4000 MB. */
  bOversized: priceOf(DRAFT_B_OVERSIZED),
} as const;
