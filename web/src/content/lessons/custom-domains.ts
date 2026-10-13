/**
 * Stratus 6: Your own domain.
 *
 * Arc: a custom domain is two steps in two places; the DNS record for a subdomain and for the bare
 * domain; who issues the certificate and what a proxy changes; check the chain with dig and curl.
 *
 * Facts: FACTS 6.4 (FDM custom domains: domains[i] matches ports[i], www. and test. are added, http(s) is
 * stripped, generated domains are ignored; DNS: CNAME to <name>.app.runonflux.io, an A record also works;
 * TLS: Let's Encrypt HTTP-01 when the domain resolves to FDM, renewed under 30 days; the Cloudflare proxy
 * makes FDM see "not pointed"), 9.7 (docs: CNAME, name @ or a subdomain, proxy enabled), 11 row 27,
 * legacy audit CD-04 (FDM only builds backends for hostnames in domains), CD-06 and CD-07 (SSL modes and
 * propagation times are unverifiable, so this lesson names neither a mode as fact nor a duration).
 * The Cloudflare SSL mode paragraph is labelled inference, as FACTS 6.4 labels it.
 */

import { CUSTOM_CERT_RENEW_BELOW_DAYS } from '@shared/flux';
import type { Lesson } from '@/learn/types';
import { customDomainsDiagnose } from '../terminals/custom-domains-diagnose.ts';
import { customDomainsDig } from '../terminals/custom-domains-dig.ts';

/** The shop component: one public port, no custom domain yet. */
const web = {
  name: 'web',
  description: 'Storefront',
  repotag: 'acme/lantern-shop:1.3.0',
  repoauth: '',
  ports: [31600],
  containerPorts: [3000],
  domains: [''],
  environmentParameters: [],
  commands: [],
  containerData: '/tmp',
  cpu: 0.5,
  ram: 500,
  hdd: 5,
};

const lesson: Lesson = {
  id: 'custom-domains',
  hook: 'The free address works the day you deploy, but customers expect your own name. You will wire one up in the two places it has to be wired, learn why the bare domain is awkward, see what a proxy does to certificates, and trace a broken chain with dig.',
  objectives: [
    'List a custom domain against the right public port in the spec, and name the DNS record that completes it.',
    'Choose between a CNAME and an A or ALIAS record for a subdomain and for the bare domain.',
    'Explain where the certificate comes from and what a proxy in front changes.',
    'Read a `dig` answer from your domain down to an address and spot the broken link.',
  ],
  steps: [
    {
      id: 'two-steps',
      title: 'Two steps in two places',
      body: [
        // fact: FACTS 6.4 and CD-04 (FDM builds routes only for hostnames in domains[i], paired with ports[i])
        'A custom domain takes two steps, and they live in different places. In the spec, you write the domain in {{term:domains}}, in the entry that pairs with the public port it should serve: {{term:fdm}} builds routes only for hostnames it finds there. At your DNS provider, you point the name at your app: visitors reach FDM only if DNS sends them there. Miss either and the domain does nothing.',
        // fact: FACTS 6.4 (www. and test. are added; http(s):// is stripped)
        'FDM also sets up `www.` and `test.` versions of every domain you list, and it strips `http://` or `https://` if you paste a whole address. This app has one public port. Put the domain `shop.example.com` on it.',
      ],
      callouts: [
        {
          // fact: FACTS 6.4 (domains ending in the FDM app domain are ignored; several domains may share an entry, comma separated)
          kind: 'gotcha',
          body: 'A name that ends in `.app.runonflux.io` is ignored here: the generated address always works without being listed. Several of your own domains can share one entry, separated by commas.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'lanternshop',
          description: 'Lantern shop',
          instances: 3,
          compose: [web],
        },
        editable: ['compose[0].domains'],
        focus: [
          {
            path: 'compose[0].domains',
            note: 'One entry per public port, in the same order as ports. The empty string means no custom domain.',
          },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'List `shop.example.com` as the custom domain of the public port.',
        hint: 'The domains list pairs with the ports list by position. This component has one public port, so the list has one entry.',
        check: {
          all: [
            {
              path: 'compose[0].domains',
              op: 'includes',
              value: 'shop.example.com',
              message: 'Put shop.example.com in the domains entry of the public port.',
            },
            { lint: 'absent', codes: ['DOMAINS_LENGTH_MISMATCH', 'DOMAIN_FORMAT'] },
          ],
        },
        solution: { compose: [{ domains: ['shop.example.com'] }] },
      },
    },
    {
      id: 'subdomain-record',
      title: 'The record for a subdomain',
      body: [
        // fact: FACTS 6.4 and 9.7 (CNAME from your domain to <name>.app.runonflux.io; Orbit FAQ says the same)
        'At the DNS provider, a subdomain such as `shop.example.com` gets a {{term:cname}} record: the name is `shop`, the type is CNAME and the target is the free address of your app, `<name>.app.runonflux.io`. A CNAME says that one name is an alias of another, so you point at a name and never at addresses.',
        'The target has to be exactly your app address. A slip of one letter, or `.com` where `.io` belongs, saves without complaint and does not point at your app, and nothing at the provider will tell you. Build the record for this app.',
      ],
      callouts: [
        {
          // fact: FACTS 9.7 (Orbit FAQ: create a CNAME to your Flux deployment domain and SSL is handled automatically)
          kind: 'tip',
          body: "Flux's own Orbit FAQ gives the same recipe: create a CNAME to your Flux deployment domain and the certificate is handled for you. The free address of the app is that deployment domain. {{lesson:ports-and-domains}} shows how it is built.",
        },
      ],
      stage: {
        kind: 'widget',
        id: 'dns-record-builder',
        props: { case: 'subdomain', domain: 'shop.example.com', app: 'lanternshop' },
      },
      task: {
        kind: 'widget',
        prompt: 'Build the record that points shop.example.com at the app.',
      },
    },
    {
      id: 'apex-record',
      title: 'The bare domain is awkward',
      body: [
        // fact: FACTS 6.4 (an A record to FDM addresses also works; FDM looks at the domain's A answer); lint DOMAIN_APEX; standard DNS rule, not a Flux rule
        'The bare domain, `example.com`, is the {{term:apex-domain}}. Standard DNS does not allow a CNAME there, because that name also has to carry the zone own records. Providers get around it in two ways: a flattened CNAME or ALIAS record, which looks the target up for you and answers with addresses, or a plain A record that holds the addresses itself.',
        'An A record works because FDM looks at the A answer for your domain; an ALIAS or flattened CNAME answers with addresses too, so it should work the same way. An A record holds addresses, so keeping it current is yours to do if they ever change. Whichever you pick, list the bare domain in `domains` as before, and remember that FDM also sets up `www.` for it, which needs a record of its own.',
      ],
      callouts: [
        {
          kind: 'why',
          body: 'The Academy linter flags a bare domain as a note for the same reason: it is valid, but a plain CNAME is the wrong record for it.',
        },
      ],
      stage: {
        kind: 'widget',
        id: 'dns-record-builder',
        props: { case: 'apex', domain: 'example.com', app: 'lanternshop' },
      },
      task: {
        kind: 'widget',
        prompt: 'Build a correct record for the bare domain example.com.',
      },
    },
    {
      id: 'certificate',
      title: 'Where the certificate comes from',
      body: [
        // fact: FACTS 6.4 (HTTP-01 when the domain resolves to the FDM group; skipped with back-off otherwise; renewed under 30 days)
        `Your domain gets its HTTPS certificate from FDM, which asks {{term:lets-encrypt}} for one by answering a challenge over plain HTTP. That works only while the domain resolves to FDM itself. When it does not yet, FDM skips the request and tries again later, and it renews the certificate when fewer than ${CUSTOM_CERT_RENEW_BELOW_DAYS} days are left.`,
        // fact: FACTS 6.4 and 9.7 (docs tell users to enable the proxy; with it on, FDM sees "not pointed" and Cloudflare's own certificate serves visitors)
        "A proxy in front changes the answer. With Cloudflare's orange cloud on, the domain resolves to Cloudflare addresses, so FDM decides it is not pointed and issues nothing, and visitors are served Cloudflare's own certificate. Flux's docs show the proxy switched on, so this is the documented set-up and not a mistake. Which Cloudflare SSL mode works is not documented.",
      ],
      callouts: [
        {
          // fact: FACTS 6.4 and CD-06 (SSL mode advice is inference, UNVERIFIED)
          kind: 'gotcha',
          title: 'Unverified advice',
          body: "Which Cloudflare SSL mode to choose is not in Flux's docs. It is inferred: FDM redirects port 80 to HTTPS, so 'Flexible' can loop and 'Full' is the one to try. Test before you rely on it.",
        },
      ],
      stage: { kind: 'diagram', id: 'dns-cname', beat: 2 },
    },
    {
      id: 'check-it',
      title: 'Check the chain with dig',
      body: [
        'Two commands do most of the work. `dig` asks DNS what a name resolves to and `curl` fetches the page. Read the answer from your domain down: your CNAME, the free address of the app, a load balancer host, an address. If a link is missing or misspelled, that is the fault. If the Cloudflare proxy is on you will see Cloudflare addresses instead of this chain: switch the record to DNS only to read it.',
        // general DNS behaviour, not a Flux fact (FACTS CD-07 marks duration claims as folklore): no durations are stated
        'DNS answers are cached. After you change a record, some resolvers keep returning the old answer until its time to live runs out, which is called {{term:dns-propagation}}. A stale answer is not proof that the new record is wrong. Flux does not control that clock and publishes no figure for it.',
      ],
      stage: { kind: 'terminal', script: customDomainsDig },
      task: {
        kind: 'terminal',
        goals: ['own', 'flux', 'https'],
        prompt: 'Look up the domain, look up the free address of the app, then fetch the page over HTTPS.',
        hint: '`dig` takes a name. Your domain is `shop.example.com` and the free address of the app is `lanternshop.app.runonflux.io`. `curl -vI` shows the certificate.',
      },
    },
  ],
  checkpoint: [
    {
      id: 'find-the-typo',
      kind: 'terminal',
      prompt:
        'Customers say shop.example.com does not load, but the free address of the app does. Find out why. Reproduce the problem, read the record, then look up the real address.',
      script: customDomainsDiagnose,
      goals: ['symptom', 'record', 'target'],
      explain:
        'The CNAME target ended in .com where Flux app addresses end in .io, so the chain led to a name that does not exist. The spec and the app were fine: only the record at the DNS provider was wrong.',
      hint: '`curl` shows the symptom. `dig` shows what the record points at, and you have to compare that to the real address of lanternshop on `app.runonflux.io`.',
    },
    {
      id: 'domains-misaligned',
      kind: 'spec-fix',
      prompt:
        'The shop is served by public port 31600 and its metrics page by 31601. shop.example.com has to reach the shop and metrics.example.com the metrics page. The draft would be refused. Fix it.',
      spec: {
        name: 'lanternshop',
        description: 'Lantern shop',
        instances: 3,
        compose: [
          {
            ...web,
            ports: [31600, 31601],
            containerPorts: [3000, 9100],
            domains: ['metrics.example.com'],
          },
        ],
      },
      check: {
        all: [
          { path: 'compose[0].domains[0]', op: 'eq', value: 'shop.example.com' },
          { path: 'compose[0].domains[1]', op: 'eq', value: 'metrics.example.com' },
          { lint: 'absent', codes: ['DOMAINS_LENGTH_MISMATCH'] },
        ],
      },
      solution: { compose: [{ domains: ['shop.example.com', 'metrics.example.com'] }] },
      explain:
        'The domains list pairs with the ports list by position and has to be the same length. With one entry it was refused, and the entry it had sat against the shop port.',
      hint: 'There are two public ports, so there are two entries, and the first one belongs to port 31600.',
    },
    {
      id: 'apex-or-subdomain',
      kind: 'choice',
      prompt: 'A customer wants the bare domain example.com to open the app. What is right?',
      options: [
        {
          id: 'both',
          label:
            'List example.com in domains, and create a record your provider allows at the bare name: a flattened CNAME or ALIAS to the app address, or an A record',
        },
        {
          id: 'cname',
          label: 'Create an ordinary CNAME for the bare name, which every provider accepts',
          why: 'Standard DNS does not allow a CNAME at the bare name, because that name also carries other records. Many providers refuse it.',
        },
        {
          id: 'dns-only',
          label: 'Skip domains, because the DNS record alone is enough',
          why: 'FDM builds routes only for hostnames listed in the spec. Without the entry, nothing is set up for that name.',
        },
        {
          id: 'www',
          label: 'Bare domains cannot be used with Flux, so use www only',
          why: 'Flux works with a bare domain. The work is on the DNS side, where the record type has to be one the provider allows.',
        },
      ],
      answer: 'both',
      explain:
        'Both steps are still needed: the name in the spec, and a record at the provider. At the bare name the record is where it differs, because a plain CNAME is not allowed there.',
      hint: 'Two places, as always. The question is which record type the bare name can hold.',
    },
  ],
  recap: [
    'A custom domain needs two things: the name in `domains` against the right public port, and a DNS record that points the name at the app.',
    'A subdomain takes a CNAME to `<name>.app.runonflux.io`. The bare domain cannot hold a plain CNAME, so use a flattened CNAME or ALIAS, or an A record.',
    "FDM gets the certificate from Let's Encrypt only while the domain resolves to it. A proxy in front means the proxy's certificate serves visitors.",
    'The Cloudflare SSL mode advice is inferred and unverified, so test it.',
    '`dig` reads the chain from your domain to an address. DNS caching means a stale answer is not proof of a wrong record.',
  ],
  further: [
    {
      label: 'FluxCloud docs: custom domain setup',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/custom-domain-setup',
    },
    {
      label: 'FluxCloud docs: components, including the custom domains field',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
    },
  ],
  terms: ['domains', 'cname', 'fdm', 'apex-domain', 'lets-encrypt', 'dns-propagation'],
};

export default lesson;
