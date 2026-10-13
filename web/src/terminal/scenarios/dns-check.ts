/**
 * Scenario 4: DNS check.
 *
 * "I pointed my domain at my Flux app and nothing happens." The learner reads DNS the way FDM
 * does. Three things are taught, each by a lookup:
 *
 *   1. what the world sees is the CNAME target (a typo'd target is NXDOMAIN, not a Flux problem);
 *   2. your resolver may still hold the old answer: the DNS provider's own server is the truth, and
 *      the TTL is how long the old answer lives;
 *   3. a proxy in front of the domain hides the target, so FDM sees "not pointed" and requests no
 *      certificate (FACTS 6.4).
 *
 * The world is a toy: example.com names, documentation addresses (fixtures/dns.ts). dig and
 * nslookup output is trimmed to the parts that matter.
 */

import { seeded } from '../engine/stream';
import type { ScriptedCommand, ScriptWithRequires } from '../engine/types';
import {
  APP_DOMAIN_SUFFIX,
  DEMO_APP,
  DEMO_DOMAIN,
  FDM_LB_HOST,
  FDM_TOY_ADDRESS,
  NS_HOST,
  NS_TOY_ADDRESS,
  PROXY_TOY_ADDRESSES,
  RESOLVER_ADDRESS,
} from '../fixtures/dns';
import { SIM_INTRO } from './helpers';

const APP = DEMO_APP;
const GOOD_TARGET = `${APP}.${APP_DOMAIN_SUFFIX}`;
const TYPO_TARGET = `${APP}.runonflux.io`;

// ---- the toy zone -------------------------------------------------------------------------------

interface Rec {
  name: string;
  ttl: number;
  type: 'CNAME' | 'A';
  data: string;
}

interface Answer {
  status: 'NOERROR' | 'NXDOMAIN';
  records: Rec[];
}

type Where = 'resolver' | 'provider';

const fdmChain = (name: string): Rec[] => [
  { name, ttl: 300, type: 'CNAME', data: FDM_LB_HOST },
  { name: FDM_LB_HOST, ttl: 60, type: 'A', data: FDM_TOY_ADDRESS },
];

/** What each server says. The resolver still holds the typo'd answer; the provider has the fix. */
const ZONE: Record<string, Partial<Record<Where, Answer>>> = {
  'shop.example.com': {
    resolver: {
      status: 'NXDOMAIN',
      records: [{ name: 'shop.example.com', ttl: 300, type: 'CNAME', data: TYPO_TARGET }],
    },
    provider: {
      status: 'NOERROR',
      records: [{ name: 'shop.example.com', ttl: 300, type: 'CNAME', data: GOOD_TARGET }],
    },
  },
  [TYPO_TARGET]: { resolver: { status: 'NXDOMAIN', records: [] } },
  [GOOD_TARGET]: { resolver: { status: 'NOERROR', records: fdmChain(GOOD_TARGET) } },
  'blog.example.com': {
    resolver: {
      status: 'NOERROR',
      records: PROXY_TOY_ADDRESSES.map((ip) => ({
        name: 'blog.example.com',
        ttl: 300,
        type: 'A' as const,
        data: ip,
      })),
    },
  },
};

const fqdn = (s: string): string => (s.endsWith('.') ? s : `${s}.`);

function answerFor(name: string, where: Where): Answer {
  const a = ZONE[name]?.[where];
  if (!a) throw new Error(`dns-check: no toy answer for ${name} at ${where}`);
  return a;
}

// ---- output -------------------------------------------------------------------------------------

function recLine(r: Rec, tail = ''): string {
  const data = r.type === 'CNAME' ? fqdn(r.data) : r.data;
  return `${fqdn(r.name)}\t${r.ttl}\tIN\t${r.type}\t${data}${tail}`;
}

function digFull(args: string, name: string, where: Where): string[] {
  const a = answerFor(name, where);
  const rnd = seeded(name.length * 977 + (where === 'provider' ? 11 : 3));
  const id = 10000 + Math.floor(rnd() * 50000);
  const ms = where === 'provider' ? 21 + Math.floor(rnd() * 20) : 31 + Math.floor(rnd() * 30);
  const server =
    where === 'provider' ? `${NS_HOST}#53(${NS_TOY_ADDRESS})` : `${RESOLVER_ADDRESS}#53(${RESOLVER_ADDRESS})`;
  const flags = where === 'provider' ? 'qr aa rd' : 'qr rd ra';
  const status = a.status === 'NXDOMAIN' ? '[hi]NXDOMAIN[/]' : a.status;
  const lines = [
    `; <<>> DiG 9.18.28 <<>> ${args}`,
    ';; global options: +cmd',
    ';; Got answer:',
    `;; ->>HEADER<<- opcode: QUERY, status: ${status}, id: ${id}`,
    `;; flags: ${flags}; QUERY: 1, ANSWER: ${a.records.length}, AUTHORITY: 0, ADDITIONAL: 1`,
    '',
    ';; QUESTION SECTION:',
    `;${fqdn(name)}\t\tIN\tA`,
    '',
  ];
  if (a.records.length > 0) {
    lines.push(';; ANSWER SECTION:');
    for (const r of a.records) {
      lines.push(recLine(r).replace(/\t([^\t]+)$/, (_m, data: string) => `\t[hi]${data}[/]`));
    }
    lines.push('');
  }
  lines.push(`;; Query time: ${ms} msec`, `;; SERVER: ${server} (UDP)`);
  return lines;
}

function digShort(name: string, where: Where): string[] {
  const a = answerFor(name, where);
  return a.records.map((r) => (r.type === 'CNAME' ? fqdn(r.data) : r.data));
}

function nslookup(name: string, where: Where): string[] {
  const a = answerFor(name, where);
  const head =
    where === 'provider'
      ? [`Server:\t\t${NS_HOST}`, `Address:\t${NS_TOY_ADDRESS}#53`, '']
      : [
          `Server:\t\t${RESOLVER_ADDRESS}`,
          `Address:\t${RESOLVER_ADDRESS}#53`,
          '',
          ...(a.records.length > 0 ? ['Non-authoritative answer:'] : []),
        ];
  const body: string[] = [];
  for (const r of a.records) {
    if (r.type === 'CNAME') body.push(`${r.name}\tcanonical name = [hi]${fqdn(r.data)}[/]`);
  }
  const addresses = a.records.filter((r) => r.type === 'A');
  const names = [...new Set(addresses.map((r) => r.name))];
  for (const n of names) {
    body.push(`Name:\t${n}`);
    for (const r of addresses.filter((x) => x.name === n)) body.push(`Address: [hi]${r.data}[/]`);
  }
  if (a.status === 'NXDOMAIN') {
    const last = a.records[a.records.length - 1];
    body.push('', `** server can't find ${last ? last.data : name}: [hi]NXDOMAIN[/]`);
  }
  return [...head, ...body];
}

// ---- entries ------------------------------------------------------------------------------------

const dots = (s: string): string => s.replace(/\./g, '\\.');

interface Spec {
  name: string;
  where: Where;
  goal?: string;
  /** Example line for the goal (the short dig form). */
  example?: string;
  explain: string;
  notes?: string[];
  /** Extra remark for the short form, which prints nothing at all for an NXDOMAIN without records. */
  shortNote?: string;
}

function entries(s: Spec): ScriptedCommand[] {
  const n = dots(s.name);
  const at = s.where === 'provider' ? ` @${dots(NS_HOST)}` : '';
  const atRaw = s.where === 'provider' ? ` @${NS_HOST}` : '';
  const notes = (s.notes ?? []).map((t) => `[note]${t}`);
  const trimmed = '[note]dig output is trimmed to the lines that matter.';
  const goal = s.goal ? { goal: s.goal } : {};
  const out: ScriptedCommand[] = [
    {
      match: `^dig \\+short ${n}(?: A| CNAME)?${at}$`,
      output: [...digShort(s.name, s.where), ...(s.shortNote ? [`[note]${s.shortNote}`] : []), ...notes],
      stream: 90,
      explain: s.explain,
      ...goal,
      ...(s.example ? { example: s.example } : {}),
    },
    {
      match: `^dig ${n}(?: A| CNAME)?${at}$`,
      output: [...digFull(`${s.name}${atRaw}`, s.name, s.where), trimmed, ...notes],
      stream: 60,
      explain: s.explain,
      ...goal,
    },
    {
      match: `^nslookup ${n}${s.where === 'provider' ? ` ${dots(NS_HOST)}` : ''}$`,
      output: [...nslookup(s.name, s.where), ...notes],
      stream: 70,
      explain: s.explain,
      ...goal,
    },
  ];
  return out;
}

/**
 * The first lookup is a goal with its own example: the long form of dig, because reading the
 * header and the answer section is the skill. `dig +short` follows and credits it too.
 */
const LOOKUP_ENTRIES: ScriptedCommand[] = [
  {
    match: '^dig shop\\.example\\.com(?: A| CNAME)?$',
    output: [
      ...digFull('shop.example.com', 'shop.example.com', 'resolver'),
      '[note]dig output is trimmed to the lines that matter.',
    ],
    stream: 60,
    goal: 'lookup',
    example: 'dig shop.example.com',
    explain: `Read the ANSWER SECTION: \`${DEMO_DOMAIN}\` is a CNAME, an alias, and it points at \`${TYPO_TARGET}\`. The status is \`NXDOMAIN\`: in this toy zone that target does not exist. Flux apps live under \`app.runonflux.io\`, so a record that leaves out \`.app\` does not point at your app.`,
  },
  {
    match: '^dig \\+short shop\\.example\\.com(?: A| CNAME)?$',
    output: [...digShort('shop.example.com', 'resolver')],
    stream: 90,
    goal: 'lookup',
    explain: `\`+short\` prints only the answer. The CNAME points at \`${TYPO_TARGET}\`, which does not exist in this toy zone: Flux apps live under \`app.runonflux.io\`.`,
  },
  {
    match: '^nslookup shop\\.example\\.com$',
    output: nslookup('shop.example.com', 'resolver'),
    stream: 70,
    goal: 'nslookup',
    example: 'nslookup shop.example.com',
    explain:
      'The same lookup with another tool: the same answer. `canonical name` is a CNAME and the last line says the target does not exist. Use whichever you have; `dig` shows more.',
  },
];

const TARGET = entries({
  name: GOOD_TARGET,
  where: 'resolver',
  goal: 'target',
  example: `dig +short ${GOOD_TARGET}`,
  explain:
    'This is what a correct Flux domain looks like: the app name under `app.runonflux.io` is a CNAME to an FDM load balancer, which has an address. The addresses here are documentation examples, not the real ones.',
});

const TYPO = entries({
  name: TYPO_TARGET,
  where: 'resolver',
  explain: `No such name in this toy zone: nothing is registered at \`${TYPO_TARGET}\`. Flux app domains are \`<app>.app.runonflux.io\`.`,
  shortNote: 'No answer: that name does not exist.',
});

const PROVIDER = entries({
  name: 'shop.example.com',
  where: 'provider',
  goal: 'provider',
  example: `dig +short shop.example.com @${NS_HOST}`,
  explain: `Your DNS provider's own server holds the record as you set it now, and it is right: a CNAME to \`${GOOD_TARGET}\`. Your resolver still serves the old answer from its cache until the TTL (300 seconds) runs out. Wait, or ask the provider to see the truth.`,
});

const PROXY = entries({
  name: 'blog.example.com',
  where: 'resolver',
  goal: 'proxy',
  example: 'dig +short blog.example.com',
  explain:
    "The answer is two addresses that are not FDM's. A proxy sits in front of this domain and answers for it, which hides where it really points. FDM looks at what the domain resolves to, sees addresses that are not its own and treats it as not pointed, so it requests no certificate; the proxy's certificate serves visitors instead.",
});

export const dnsCheck: ScriptWithRequires = {
  id: 'dns-check',
  cwd: '~',
  intro: [
    SIM_INTRO,
    `Your Flux app is called ${APP}. You pointed shop.example.com at it with a CNAME, then corrected the record at your DNS provider a few minutes ago. The site still does not load.`,
    `These are toy names: example.com domains and documentation addresses. Your DNS provider's name server is ${NS_HOST}.`,
    'Start with: dig shop.example.com',
  ],
  notFound:
    '[err]sandbox: no toy answer for `{input}`. The sandbox only knows shop.example.com, blog.example.com and the Flux names around them.',
  commands: [...LOOKUP_ENTRIES, ...TARGET, ...PROVIDER, ...PROXY, ...TYPO],
  goals: [
    { id: 'lookup', label: 'Look up shop.example.com with dig' },
    { id: 'nslookup', label: 'Look it up with nslookup' },
    { id: 'target', label: 'Check that the Flux name resolves' },
    { id: 'provider', label: "Ask your DNS provider's server" },
    { id: 'proxy', label: 'Check blog.example.com: why other addresses?' },
  ],
};
