/**
 * Terminal script for the custom-domains lesson, step "Check it": a healthy custom domain, read with dig
 * and curl.
 *
 * Simulation. Every address is a documentation address (203.0.113.0/24, 192.0.2.0/24) and every name is
 * made up (`example.com` is reserved for documentation). What is real is the shape of the chain: a
 * custom domain is a CNAME to `<app>.app.runonflux.io`, which is itself a CNAME to an FDM load balancer
 * host (FACTS 6.4: a DoH lookup of an app domain returned a CNAME to fdm-lb-1-2.runonflux.io), and FDM
 * obtains a Let's Encrypt certificate once the domain resolves to it (FACTS 6.4).
 *
 * The broken twin of this scenario lives in custom-domains-diagnose.ts and reuses the helpers below.
 */

import type { TerminalScript } from '@/learn/types';

export const APP = 'lanternshop';
export const APP_DOMAIN = `${APP}.app.runonflux.io`;
export const CUSTOM = 'shop.example.com';
export const FDM_HOST = 'fdm-lb-1-2.runonflux.io';
export const FDM_ADDRESS = '203.0.113.40';
export const RESOLVER = '192.0.2.53';

/** A line of dig output, column spaced the way dig prints it (always at least one space after the name). */
export function rr(name: string, type: 'CNAME' | 'A', data: string): string {
  const owner = `${name}.`;
  return `${owner.padEnd(Math.max(30, owner.length + 1))}300  IN  ${type.padEnd(6)}${data}`;
}

export const CHAIN_HEALTHY = [
  rr(CUSTOM, 'CNAME', `${APP_DOMAIN}.`),
  rr(APP_DOMAIN, 'CNAME', `${FDM_HOST}.`),
  rr(FDM_HOST, 'A', FDM_ADDRESS),
];

export const SHORT_HEALTHY = [`${APP_DOMAIN}.`, `${FDM_HOST}.`, FDM_ADDRESS];

/** A full dig answer. `answers` are record lines, `status` NOERROR or NXDOMAIN. */
export function digFull(name: string, status: 'NOERROR' | 'NXDOMAIN', answers: string[]): string[] {
  return [
    `; <<>> DiG 9.18 <<>> ${name}`,
    ';; global options: +cmd',
    ';; Got answer:',
    `;; ->>HEADER<<- opcode: QUERY, status: ${status}`,
    `;; flags: qr rd ra; QUERY: 1, ANSWER: ${answers.length}, AUTHORITY: 0, ADDITIONAL: 1`,
    '',
    ';; QUESTION SECTION:',
    `;${`${name}.`.padEnd(Math.max(29, name.length + 2))}IN  A`,
    '',
    ...(answers.length > 0 ? [';; ANSWER SECTION:', ...answers, ''] : []),
    `;; SERVER: ${RESOLVER}#53(${RESOLVER})`,
  ];
}

/**
 * The body of a `curl` pattern: any ordinary flags in front of an http or https URL. `verbose` true needs
 * a flag group that contains `v` (the certificate output); false matches every other combination, so
 * `-I`, `-sI` and a bare `curl <url>` all work and a learner is never told off for a harmless spelling.
 */
export function curlBody(host: string, verbose: boolean): string {
  const h = host.replace(/\./g, '\\.');
  return verbose
    ? `curl(?: -[A-Za-z]+)*(?: -[A-Za-z]*v[A-Za-z]*)(?: -[A-Za-z]+)* https?://${h}/?`
    : `curl(?: -[A-Za-uw-z]+)* https?://${h}/?`;
}

/** An anchored command pattern for `curlBody`. */
export function curlPattern(host: string, verbose: boolean): string {
  return `^${curlBody(host, verbose)}$`;
}

/** `dig [+short] <name> [A|CNAME]`, with the optional pieces in any ordinary order. */
export function digPattern(name: string, short: boolean): string {
  const n = name.replace(/\./g, '\\.');
  const type = '(?:A|CNAME)';
  return short
    ? `^dig (?:\\+short ${n}(?: ${type})?|${n}(?: ${type})? \\+short|${type} \\+short ${n}|\\+short ${type} ${n})$`
    : `^dig (?:${type} )?${n}(?: ${type})?$`;
}

export const customDomainsDig: TerminalScript = {
  id: 'custom-domains-dig',
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
    '[dim] The app lanternshop lists shop.example.com in its domains (cat app.json), and a CNAME has been created at the DNS provider.',
    '[dim] Check the whole chain: what DNS returns for the domain, what the app address is, and what a browser would get.',
  ],
  commands: [
    {
      match: digPattern(CUSTOM, true),
      output: SHORT_HEALTHY,
      goal: 'own',
      explain:
        'The short form lists only the answers, in order. The first is your record: an alias for the free app address. Each line after it is the next link in the chain, ending at an address.',
      example: `dig +short ${CUSTOM}`,
    },
    {
      // fact: FACTS 6.4 (custom domain DNS: a CNAME to <name>.app.runonflux.io; the app domain is itself a CNAME to an FDM load balancer host)
      match: digPattern(CUSTOM, false),
      output: digFull(CUSTOM, 'NOERROR', CHAIN_HEALTHY),
      goal: 'own',
      explain:
        'Read the answer section from the top. The first line is your record, a CNAME to the free app address. The next two are Flux own records. A custom domain is one more name on the front of that chain.',
      example: `dig ${CUSTOM}`,
    },
    {
      match: digPattern(APP_DOMAIN, true),
      output: [`${FDM_HOST}.`, FDM_ADDRESS],
      goal: 'flux',
      explain:
        'The free address is itself an alias for a load balancer host that runs FDM. The last line is the address visitors actually connect to.',
      example: `dig +short ${APP_DOMAIN}`,
    },
    {
      match: digPattern(APP_DOMAIN, false),
      output: digFull(APP_DOMAIN, 'NOERROR', [CHAIN_HEALTHY[1] ?? '', CHAIN_HEALTHY[2] ?? '']),
      goal: 'flux',
      explain:
        'This is the target your CNAME has to name: the free app address, `<app>.app.runonflux.io`. It is itself an alias for a load balancer host that runs FDM.',
      example: `dig ${APP_DOMAIN}`,
    },
    {
      // fact: FACTS 6.4 (FDM requests a Let's Encrypt certificate with HTTP-01 when the domain resolves to FDM)
      match: curlPattern(CUSTOM, true),
      output: [
        `* Host ${CUSTOM}:443 was resolved.`,
        `* Connected to ${CUSTOM} (${FDM_ADDRESS}) port 443`,
        '* Server certificate:',
        `*  subject: CN=${CUSTOM}`,
        "*  issuer: C=US; O=Let's Encrypt",
        '*  SSL certificate verify ok.',
        '< HTTP/2 200',
        '[ok] The certificate names your domain, so the browser shows a padlock.',
      ],
      goal: 'https',
      explain:
        "The certificate names your own domain and was issued by Let's Encrypt. FDM asked for it because the domain resolved to FDM, which is exactly what the CNAME arranges.",
      example: `curl -vI https://${CUSTOM}`,
    },
    {
      match: curlPattern(CUSTOM, false),
      output: ['HTTP/2 200', '[ok] The custom domain answers over HTTPS.'],
      goal: 'https',
      explain: 'The page loads on your own domain over HTTPS. Add -v to see the certificate that served it.',
      example: `curl -sI https://${CUSTOM}`,
    },
    {
      match: '^dig (?:\\+short )?(?:(?:A|CNAME) )?(\\S+)(?: (?:A|CNAME))?(?: \\+short)?$',
      output: [
        '[warn] This simulation knows two names: shop.example.com and lanternshop.app.runonflux.io.',
        '[dim] Nothing is listed for {1}.',
      ],
      explain:
        'The scenario only has records for the two names in the lesson, so any other name has no answer here.',
    },
  ],
  goals: [
    { id: 'own', label: 'Look up where shop.example.com points with dig' },
    { id: 'flux', label: 'Look up the free address of the app with dig' },
    { id: 'https', label: 'Fetch the page over HTTPS with curl' },
  ],
  notFound:
    '[warn] {input}: not part of this exercise. You need dig to read DNS and curl to fetch the page. Type help to see the shell.',
};

export default customDomainsDig;
