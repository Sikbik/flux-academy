/**
 * Terminal script for the custom-domains checkpoint: the same scenario as custom-domains-dig, broken.
 * The CNAME at the DNS provider ends in `.com` where Flux app addresses end in `.io`, so the chain
 * stops at a name that does not resolve: `*.app.runonflux.com` was checked on 2026-10-13 and is NXDOMAIN
 * (FACTS Snapshot re-read), while `*.app.runonflux.io` resolves to the FDM load balancer hosts.
 *
 * Simulation. Every address is a documentation address and every name is made up. The mechanism is real:
 * a custom domain has to be a CNAME to exactly `<app>.app.runonflux.io` (FACTS 6.4, 11 row 27).
 */

import type { TerminalScript } from '@/learn/types';
import {
  APP_DOMAIN,
  CHAIN_HEALTHY,
  CUSTOM,
  curlBody,
  digFull,
  digPattern,
  FDM_ADDRESS,
  FDM_HOST,
  rr,
} from './custom-domains-dig.ts';

const TYPO = 'lanternshop.app.runonflux.com';

/** Any `curl` flags, verbose or not: this scenario answers them all alike. */
const curlAny = (host: string): string => `^(?:${curlBody(host, true)}|${curlBody(host, false)})$`;

const RECORD = rr(CUSTOM, 'CNAME', `${TYPO}.`);

export const customDomainsDiagnose: TerminalScript = {
  id: 'custom-domains-diagnose',
  prompt: '$',
  cwd: '~/lanternshop',
  files: {
    'app.json': [
      '{',
      '  "name": "lanternshop",',
      '  "compose": [',
      '    {',
      '      "name": "web",',
      '      "ports": [31600],',
      '      "containerPorts": [3000],',
      '      "domains": ["shop.example.com"]',
      '    }',
      '  ]',
      '}',
      '',
    ].join('\n'),
  },
  intro: [
    '[dim] Simulation. The names are made up and the addresses are documentation addresses.',
    '[dim] The app lanternshop lists shop.example.com in its domains (cat app.json). Customers say shop.example.com does not load, while the free address of the app does.',
    '[dim] Reproduce the problem, read the record the domain really has, then look up the address it should have pointed at.',
  ],
  commands: [
    {
      match: curlAny(CUSTOM),
      output: ['curl: (6) Could not resolve host: shop.example.com'],
      goal: 'symptom',
      explain:
        'The name does not resolve at all, so the browser never reaches Flux. That points at DNS, not at the spec or the app.',
      example: 'curl -sI https://shop.example.com',
    },
    {
      match: curlAny(APP_DOMAIN),
      output: ['HTTP/2 200', '[ok] The app itself is healthy at its free address.'],
      explain:
        'The app answers at its generated address, so the containers, the ports and the load balancer are fine.',
      example: `curl -sI https://${APP_DOMAIN}`,
    },
    {
      match: digPattern(CUSTOM, true),
      output: [`${TYPO}.`],
      goal: 'record',
      explain:
        'The record is a CNAME, as it should be, but read its target character by character against the free address of the app.',
      example: `dig +short ${CUSTOM}`,
    },
    {
      // fact: FACTS 6.4 and 11 row 27 (the CNAME has to name <name>.app.runonflux.io)
      match: digPattern(CUSTOM, false),
      output: digFull(CUSTOM, 'NXDOMAIN', [RECORD]),
      goal: 'record',
      explain:
        'The status is NXDOMAIN: the CNAME points at a name that does not exist, so nothing resolves. Flux app addresses end in .io, and this one ends in .com.',
      example: `dig ${CUSTOM}`,
    },
    {
      match: digPattern(TYPO, true),
      output: [],
      explain: 'No answer: that name does not exist, which is what the browser runs into.',
    },
    {
      match: digPattern(TYPO, false),
      output: digFull(TYPO, 'NXDOMAIN', []),
      explain:
        'NXDOMAIN with an empty answer: the target of the record does not exist. The record has to name the real free address of the app.',
    },
    {
      match: digPattern(APP_DOMAIN, true),
      output: [`${FDM_HOST}.`, FDM_ADDRESS],
      goal: 'target',
      explain:
        'This is the name the record should have pointed at. It resolves, through an alias, to the load balancer address.',
      example: `dig +short ${APP_DOMAIN}`,
    },
    {
      match: digPattern(APP_DOMAIN, false),
      output: digFull(APP_DOMAIN, 'NOERROR', [CHAIN_HEALTHY[1] ?? '', CHAIN_HEALTHY[2] ?? '']),
      goal: 'target',
      explain:
        'The real free address resolves. Change the CNAME target at the DNS provider to this exact name, with .io at the end, and the chain is complete.',
      example: `dig ${APP_DOMAIN}`,
    },
    {
      match: '^dig (?:\\+short )?(?:(?:A|CNAME) )?(\\S+)(?: (?:A|CNAME))?(?: \\+short)?$',
      output: [
        '[warn] This simulation knows three names: shop.example.com, lanternshop.app.runonflux.com and lanternshop.app.runonflux.io.',
        '[dim] Nothing is listed for {1}.',
      ],
      explain: 'The scenario only has records for the names that matter to the problem.',
    },
  ],
  goals: [
    { id: 'symptom', label: 'Reproduce the problem with curl' },
    { id: 'record', label: 'Look up what shop.example.com points at' },
    { id: 'target', label: 'Look up the real free address of the app' },
  ],
  notFound:
    '[warn] {input}: not part of this exercise. You need curl and dig, and cat app.json shows the spec. Type help to see the shell.',
};

export default customDomainsDiagnose;
