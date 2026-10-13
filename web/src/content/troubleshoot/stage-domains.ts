/**
 * Stage 5: domains and networking. The generated address, your own domain, certificates, proxies,
 * non-HTTP traffic and components that cannot reach each other.
 *
 * Source of truth is FACTS 6.4 (FDM, the Flux Domain Manager) and 8.x. The Cloudflare SSL mode advice is
 * an inference in FACTS and is labelled unverified here.
 */

import { api, both, cmd, docs, fix, fixSh, forge, guess, look, src } from './build';
import type { Symptom } from './types';

export const DOMAIN_SYMPTOMS: Symptom[] = [
  {
    id: 'wrong-app-url',
    stage: 'domains',
    title: 'The generated address does not open the app I expected',
    summary: 'name_80.app.runonflux.io does not open the app, or the plain address shows a different port.',
    seen: ['name_80.app.runonflux.io does not open the app', 'The address shows the wrong service'],
    keywords: [
      'app domain',
      'app.runonflux.io',
      'generated address',
      'free domain',
      'underscore',
      'port in url',
      'second port',
      'which url',
      'name_port',
    ],
    quick:
      'The plain address goes to the first published port. Every port also gets `<name>_<public port>.app.runonflux.io`, built from the public port and never from the container port.',
    causes: [
      {
        id: 'container-port-in-url',
        title: 'The container port is in the address',
        why: 'Per-port addresses use the public port, the entry of `ports`. The container port is only the target inside the container, so `name_80` does not lead to your app unless 80 is a public port.',
        likelihood: 'usual',
        checks: [
          api(
            'appspec',
            'Read `compose[].ports`. Those numbers, not `containerPorts`, go after the underscore.',
          ),
        ],
        fixes: [
          fix(
            'Use `<name>.app.runonflux.io` for the first port and `<name>_<public port>.app.runonflux.io` for the rest.',
          ),
        ],
        proof: src('11 row 3; 6.4'),
        lessons: ['ports-and-domains'],
        terms: ['app-domain', 'ports', 'container-ports'],
      },
      {
        id: 'first-port-only',
        title: 'The plain address is an alias for the first port only',
        why: 'The address without a suffix points at the first published port of the app. A second service on another port needs its own suffixed address.',
        likelihood: 'common',
        checks: [
          look('Check the order of `ports` in the spec: the first entry is what the plain address serves.'),
        ],
        fixes: [fix('Reorder the ports, or use the suffixed address for the other service.')],
        proof: src('6.4; 9.7'),
        lessons: ['ports-and-domains', 'multi-component'],
        terms: ['app-domain', 'fdm'],
      },
      {
        id: 'hyphen-pattern',
        title: 'A guide shows a hyphen pattern such as your-app-9001',
        why: 'Some docs show a hyphenated per-port address for webhooks. The domain manager source generates the underscore form only, so the hyphen form could not be confirmed. The address wildcard resolves every name under `app.runonflux.io`, so a wrong name resolves in DNS and still does not reach your app.',
        likelihood: 'rare',
        checks: [
          cmd(
            'Ask for both and compare the status lines',
            'curl -sI https://{app}_31001.app.runonflux.io | head -n 1\ncurl -sI https://{app}-31001.app.runonflux.io | head -n 1',
            'Replace 31001 with your public port. Only the underscore form is expected to reach your app. DNS alone cannot tell the two apart.',
          ),
        ],
        fixes: [fix('Use the underscore form.')],
        proof: guess(
          '6.4',
          'The domain manager source generates only the underscore pattern, and the wildcard resolves any name. The hyphen pattern is from a docs page and was not tested.',
        ),
        lessons: ['ports-and-domains'],
      },
    ],
    lessons: ['ports-and-domains'],
    related: ['url-502-503', 'custom-domain-not-working'],
  },

  {
    id: 'custom-domain-not-working',
    stage: 'domains',
    title: 'My own domain does not open my app',
    summary: 'Your domain shows an error, a parking page, another site or nothing.',
    seen: ['DNS address could not be found', 'A parking page', 'Another site answers', 'NXDOMAIN'],
    keywords: [
      'custom domain',
      'domain not working',
      'cname',
      'dns',
      'domains array',
      'a record',
      'apex',
      'root domain',
      'www',
      'nxdomain',
      'point domain',
      'propagation',
    ],
    quick:
      'A custom domain needs two things at the same time: the domain listed in `domains` on the right port, and a DNS record that points at your .app.runonflux.io address. Missing either one gives nothing.',
    causes: [
      {
        id: 'not-in-spec',
        title: 'The domain is not in the spec, or sits on the wrong port',
        why: 'The domain manager builds its configuration from the spec. A domain that is not in `domains[i]` for the port that serves it is not routed, whatever your DNS says.',
        likelihood: 'usual',
        checks: [
          api(
            'appspec',
            'Read `compose[].domains` and `compose[].ports` and check that the domain is at the same index as the port.',
          ),
          forge('See the lint for lists of different lengths', {
            fixture: 'static-site',
            patch: { compose: [{ domains: [] }] },
            shows: ['DOMAINS_LENGTH_MISMATCH'],
          }),
        ],
        fixes: [
          fix(
            'Put the domain in `domains` at the same index as its port, then update the app. An update that keeps the instances, components and resources the same is a free update.',
          ),
        ],
        proof: src('11 row 27; 6.4'),
        lint: ['DOMAINS_LENGTH_MISMATCH', 'DOMAIN_FORMAT', 'DOMAIN_IS_GENERATED'],
        lessons: ['custom-domains'],
        terms: ['domains', 'fdm'],
      },
      {
        id: 'dns-not-pointed',
        title: 'DNS does not point at your app address',
        why: 'A subdomain needs a CNAME record to `<name>.app.runonflux.io`. The domain manager also accepts an A record that points at its load balancer addresses.',
        likelihood: 'usual',
        checks: [
          cmd(
            'Ask DNS what your domain points to',
            'dig +short CNAME {domain}',
            'You expect `{app}.app.runonflux.io.` as the answer.',
          ),
          cmd(
            'Check the target itself resolves',
            'dig +short {app}.app.runonflux.io',
            'A CNAME to a Flux load balancer host, then addresses.',
          ),
        ],
        fixes: [
          fix(
            'At your DNS provider, add a CNAME from the subdomain to `<name>.app.runonflux.io`. Leave the proxy off until it works.',
          ),
        ],
        proof: src(
          '6.4',
          'The CNAME instruction comes from the docs; the source confirms the domain manager looks at the answer the domain resolves to.',
        ),
        lessons: ['custom-domains'],
        terms: ['cname', 'app-domain'],
      },
      {
        id: 'apex-domain',
        title: 'You put a CNAME on the bare domain',
        why: 'DNS rules do not allow a CNAME at the apex (example.com with no subdomain). Providers solve that with a flattened record (ALIAS, ANAME or CNAME flattening), or you use an A record.',
        likelihood: 'common',
        checks: [
          forge('See what the linter says about a bare domain', {
            fixture: 'static-site',
            patch: { compose: [{ domains: ['example.com'] }] },
            shows: ['DOMAIN_APEX'],
          }),
        ],
        fixes: [
          fix(
            "Use your provider's CNAME flattening or ALIAS record, or point an A record at the load balancer addresses that `dig +short <name>.app.runonflux.io` shows. A www subdomain with a normal CNAME also works.",
          ),
        ],
        proof: docs(
          '6.4',
          'That an apex cannot hold a CNAME is general DNS behaviour, which we did not test. That the domain manager accepts an A record is read in source. That a flattened CNAME or ALIAS answers the same way is our inference.',
        ),
        lint: ['DOMAIN_APEX'],
        lessons: ['custom-domains'],
        terms: ['apex-domain', 'cname'],
      },
      {
        id: 'propagation',
        title: 'The change has not reached your resolver yet',
        why: 'Resolvers keep an old answer until its time to live runs out. A correct record can look wrong for a while.',
        likelihood: 'possible',
        checks: [
          cmd(
            'Ask two public resolvers',
            'dig @1.1.1.1 +short CNAME {domain}\ndig @8.8.8.8 +short CNAME {domain}',
            'If the answers differ, it is still propagating.',
          ),
        ],
        fixes: [fix('Wait for the record time to live to pass, then test again before changing the spec.')],
        proof: guess(
          '9.7; 14 row 17',
          'The FluxCloud screen says the domain "should be available in a few minutes". No timing was measured.',
        ),
        lessons: ['custom-domains'],
        terms: ['dns-propagation'],
      },
      {
        id: 'www-missing',
        title: 'You expected www to work without a record for it',
        why: 'The domain manager also adds the www and test names of a domain you list. DNS is outside Flux, so those names need their own records to reach it.',
        likelihood: 'possible',
        checks: [cmd('Check the www name', 'dig +short CNAME www.{domain}')],
        fixes: [
          fix(
            'Add a CNAME for `www` to `<name>.app.runonflux.io`, or redirect www to the main name at your provider.',
          ),
        ],
        proof: guess(
          '6.4',
          'The domain manager also adds `www.<domain>` and `test.<domain>`, which is read in source. That they need their own DNS records is our inference.',
        ),
        lessons: ['custom-domains'],
        terms: ['domains', 'cname'],
      },
      {
        id: 'generated-domain-listed',
        title: 'The generated address is in the domains list',
        why: 'The domain manager ignores any domain that ends in the Flux app domain. The generated address works without being listed.',
        likelihood: 'rare',
        checks: [look('Look for `.app.runonflux.io` inside `domains`.')],
        fixes: [fix('Remove it. The generated address works without being listed.')],
        proof: src('6.4'),
        lint: ['DOMAIN_IS_GENERATED'],
        lessons: ['custom-domains'],
      },
    ],
    lessons: ['custom-domains', 'ports-and-domains'],
    labs: ['terminal', 'spec-forge'],
    related: ['certificate-error', 'cloudflare-proxy'],
    lint: ['DOMAINS_LENGTH_MISMATCH', 'DOMAIN_APEX', 'DOMAIN_FORMAT'],
  },

  {
    id: 'certificate-error',
    stage: 'domains',
    title: 'The browser warns about the certificate on my domain',
    summary: 'Your own domain shows a certificate warning, or HTTPS fails while the generated address works.',
    seen: ['Your connection is not private', 'Certificate warning', 'HTTPS error on the custom domain'],
    keywords: [
      'certificate',
      'ssl',
      'tls',
      'https',
      "let's encrypt",
      'not secure',
      'cert',
      'warning',
      'invalid certificate',
      'expired certificate',
    ],
    quick:
      'The domain manager issues a certificate for your domain only when DNS points straight at it. Fix the record, make sure the domain is in the spec, and turn any proxy off while it issues.',
    causes: [
      {
        id: 'dns-not-pointed',
        title: 'DNS does not point at Flux yet, so nothing was issued',
        why: "The domain manager asks Let's Encrypt for a certificate with an HTTP challenge, and only when your domain resolves to its own load balancer addresses. Otherwise it skips the domain and tries again later with a back-off.",
        likelihood: 'usual',
        checks: [
          cmd(
            'See what your domain resolves to',
            'dig +short {domain}',
            'It should resolve to the same addresses as your app address.',
          ),
          cmd(
            'Look at the certificate that is served',
            'curl -svI https://{domain} 2>&1 | grep -i -E "subject|issuer|expire"',
          ),
        ],
        fixes: [
          fix('Point DNS at `<name>.app.runonflux.io` first and give the domain manager time to try again.'),
        ],
        proof: src('6.4 (custom domain TLS)', 'How long the next attempt takes was not read.'),
        see: ['custom-domain-not-working'],
        lessons: ['custom-domains'],
        terms: ['lets-encrypt', 'fdm', 'cname'],
      },
      {
        id: 'domain-not-listed',
        title: 'The domain is not in the spec',
        why: 'The domain manager only requests certificates for domains it knows from the spec.',
        likelihood: 'common',
        checks: [api('appspec', 'Look for your domain in `compose[].domains`.')],
        fixes: [fix('Add it to `domains` on the right port and update the app.')],
        proof: src('11 row 27; 6.4'),
        lessons: ['custom-domains'],
        terms: ['domains'],
      },
      {
        id: 'proxy-in-front',
        title: 'A proxy such as the Cloudflare orange cloud is in front',
        why: 'Behind a proxy your domain resolves to the proxy, not to Flux, so the domain manager sees "not pointed" and issues nothing. Visitors get the proxy\'s certificate instead.',
        likelihood: 'common',
        checks: [
          cmd('See whose addresses answer', 'dig +short {domain}', 'Cloudflare ranges mean the proxy is on.'),
        ],
        fixes: [
          fix(
            'Turn the proxy off (DNS only) until the certificate is issued. See the Cloudflare page for running it on afterwards.',
          ),
        ],
        proof: src('6.4 (Cloudflare proxy)'),
        see: ['cloudflare-proxy'],
        lessons: ['custom-domains'],
      },
      {
        id: 'renewal-failed',
        title: 'The certificate was issued once and did not renew',
        why: 'The domain manager renews when less than 30 days are left. If DNS was moved away or a proxy was switched on later, the renewal cannot pass the challenge.',
        likelihood: 'possible',
        checks: [cmd('Read the expiry date', 'curl -svI https://{domain} 2>&1 | grep -i "expire date"')],
        fixes: [fix('Point DNS back at Flux and keep any proxy off until the new certificate is in place.')],
        proof: src('6.4'),
        lessons: ['custom-domains'],
        terms: ['lets-encrypt'],
      },
    ],
    lessons: ['custom-domains'],
    labs: ['terminal'],
    related: ['cloudflare-proxy', 'custom-domain-not-working'],
  },

  {
    id: 'cloudflare-proxy',
    stage: 'domains',
    title: 'Redirect loops or errors when the Cloudflare proxy is on',
    summary: 'The domain works with DNS only, and fails or loops once the orange cloud is switched on.',
    seen: ['Too many redirects', 'ERR_TOO_MANY_REDIRECTS', 'Error page from the proxy'],
    keywords: [
      'cloudflare',
      'orange cloud',
      'proxy',
      'redirect loop',
      'too many redirects',
      'flexible',
      'full',
      'ssl mode',
      '521',
      '525',
      '526',
    ],
    quick:
      'With the proxy on, Cloudflare terminates TLS for visitors and talks to Flux separately. Flux-side facts are verified. The Cloudflare SSL mode that works was inferred, not tested.',
    causes: [
      {
        id: 'flexible-loop',
        title: 'The SSL mode may be Flexible while the origin redirects to HTTPS',
        why: 'Port 80 on the domain manager redirects to HTTPS (read in its configuration). If Cloudflare reaches the origin over plain HTTP in Flexible mode, it could keep being redirected and the visitor would see a loop. That is an inference: which SSL mode works with a proxied Flux domain is not documented.',
        likelihood: 'common',
        checks: [
          look('In Cloudflare, open SSL/TLS and read the encryption mode. Flexible is the one to suspect.'),
        ],
        fixes: [
          fix(
            'Try the Full mode, which speaks HTTPS to the origin and so should not loop (not tested). Do not choose Full (strict) unless the origin has a certificate for your name.',
          ),
        ],
        proof: guess(
          '6.4; 14 row 6',
          'The redirect on port 80 is verified in the domain manager template. That Flexible loops and Full works is an inference, not a live test.',
        ),
        lessons: ['custom-domains'],
        terms: ['fdm', 'haproxy'],
      },
      {
        id: 'no-origin-cert',
        title: 'The origin has no certificate for your domain',
        why: 'With the proxy on, the domain resolves to Cloudflare, so the domain manager does not issue a certificate for your name. Visitors get the Cloudflare edge certificate, and the origin keeps the wildcard certificate for app addresses.',
        likelihood: 'common',
        checks: [
          cmd(
            'Ask the origin directly for the generated name',
            'curl -sI https://{app}.app.runonflux.io | head -n 3',
            'This should answer normally.',
          ),
        ],
        fixes: [
          fix(
            'Either leave the proxy on with a mode that does not validate the origin name (Full is the inferred choice, not tested), or switch it to DNS only and let the domain manager issue the certificate.',
          ),
        ],
        proof: src(
          '6.4 (Cloudflare proxy)',
          'The issuing logic is verified. Which Cloudflare mode accepts the origin certificate was not tested.',
        ),
        see: ['certificate-error'],
        lessons: ['custom-domains'],
        terms: ['lets-encrypt', 'cname'],
      },
      {
        id: 'docs-recommend-proxy',
        title: 'A guide told you to turn the proxy on',
        why: 'The custom domain guide recommends the orange cloud, while the domain manager logic cannot issue a certificate for a proxied name. Both can be true: the proxy serves visitors and the origin only needs to accept the Host header.',
        likelihood: 'possible',
        checks: [
          look('Check that the domain is in the spec and that an unproxied test (grey cloud) works first.'),
        ],
        fixes: [fix('Get it working with DNS only first. Then turn the proxy on and test again.')],
        proof: guess(
          '6.4',
          'Docs and source were reconciled by reading, not by running a proxied domain end to end.',
        ),
        lessons: ['custom-domains'],
      },
    ],
    lessons: ['custom-domains'],
    related: ['certificate-error', 'custom-domain-not-working'],
    caveat:
      'We have not run a proxied domain end to end. The Cloudflare mode advice is the most likely reading of the Flux configuration, not a tested recipe.',
  },

  {
    id: 'non-http-service',
    stage: 'domains',
    title: 'My game server or database does not work on the app address',
    summary: 'A TCP or UDP service works on a node IP but not through name.app.runonflux.io.',
    seen: ['Game client cannot connect', 'Database client times out', 'Only HTTP works'],
    keywords: [
      'game server',
      'minecraft',
      'tcp',
      'udp',
      'database client',
      'raw tcp',
      'non http',
      'node ip',
      'port 25565',
      'cannot connect to domain',
    ],
    quick:
      'The domain manager fronts HTTP on 80 and HTTPS on 443. For game servers and databases, connect to a node IP and the public port you chose. The exception is an app with a `g:` volume, and some listed game apps: they get a TCP front door on their own port.',
    causes: [
      {
        id: 'http-only-front',
        title: 'The app address only serves HTTP and HTTPS',
        why: 'The generated address goes through a load balancer that terminates web traffic. Other protocols do not pass through it, with the exception of apps the load balancer treats in TCP mode.',
        likelihood: 'usual',
        checks: [
          api('location', 'Each row gives a node `ip`. Use the host part only.'),
          api('appspec', 'Read the public port from `compose[].ports`.'),
        ],
        fixes: [
          fixSh(
            'Connect to a node IP and the public port directly. Both TCP and UDP are published on that port, and the check below tests TCP only. A node IP is one machine and changes when an instance moves, so it does not fail over for you.',
            'nc -vz <node-ip> <public-port>',
          ),
        ],
        proof: src('11 row 30; 8.1; 3.4'),
        lessons: ['minecraft-server', 'ports-and-domains'],
        terms: ['app-domain', 'fdm', 'location'],
      },
      {
        id: 'primary-only',
        title: 'The app has a g: volume, so only the primary answers',
        why: 'For a primary and standby app the load balancer runs in TCP mode and routes only to the elected primary. The standbys hold a copy, are not in the backend of the load balancer and do not serve.',
        likelihood: 'possible',
        checks: [look('Open the Instances tab of the app. For a g: app it shows the Primary IP.')],
        fixes: [
          fix(
            'Connect to the primary. The Minecraft guide in the docs says the app address follows the primary after an election, so it can be used too.',
          ),
        ],
        proof: src(
          '6.4; 7.2; 9.6',
          'That the app address follows the primary after an election is from the Minecraft guide in the docs only.',
        ),
        lessons: ['persistent-storage', 'shared-database'],
        terms: ['primary-standby'],
      },
      {
        id: 'wrong-port-or-ip',
        title: 'The IP or the port is not the right pair',
        why: 'The location list shows the node API port beside the IP. The port your service listens on from outside is the public port in your spec.',
        likelihood: 'common',
        checks: [
          look(
            'Compare the port in your client with `ports` in the spec, and the IP with a row of the location list.',
          ),
        ],
        fixes: [fix('Use the host part of `ip` and the public port from `ports`.')],
        proof: both('10.6.4 E24; 8.1'),
        lessons: ['minecraft-server'],
        terms: ['ports', 'location'],
      },
    ],
    lessons: ['minecraft-server', 'ports-and-domains'],
    labs: ['explorer', 'terminal'],
    related: ['connection-refused'],
  },

  {
    id: 'components-cannot-talk',
    stage: 'domains',
    title: 'One component cannot reach another',
    summary: 'An app cannot connect to its database or cache, which is another component of the same app.',
    seen: ['Connection refused to the database host', 'Could not resolve host', 'Unknown host'],
    keywords: [
      'internal dns',
      'database host',
      'cannot reach database',
      'could not resolve',
      'unknown host',
      'flux component',
      'mysql host',
      'redis host',
      'networkWith',
      'multi component',
    ],
    quick:
      'Components reach each other on the private app network by container name, `flux<component>_<app>`, on the container port. No public port is needed, and the bare component name is not a documented way to do it.',
    causes: [
      {
        id: 'wrong-hostname',
        title: 'The host name is localhost, a public address or the bare component name',
        why: "Each app has its own Docker network and Docker DNS resolves container names. The container name is `flux<component>_<app>`. The bare component name is only a container's own hostname.",
        likelihood: 'usual',
        checks: [
          forge(
            'See the internal names for a two component app',
            { fixture: 'wordpress-mysql' },
            'The forge lists the names each component can be reached by.',
          ),
        ],
        fixes: [
          fix(
            'Set the host to `flux<component>_<app>`, for example `fluxmysql_academy-blog`, and use the container port.',
            {
              snippet: {
                lang: 'text',
                code: 'WORDPRESS_DB_HOST=fluxmysql_academy-blog:3306',
                label: 'Example variable',
              },
            },
          ),
        ],
        proof: src('8.2; 3.8'),
        lessons: ['multi-component', 'shared-database'],
        terms: ['internal-dns', 'component'],
      },
      {
        id: 'external-port',
        title: 'You used the public port between components',
        why: 'Between components, traffic stays on the internal network and goes to the container port. A database that is not in `ports` is not reachable from outside the app at all, which is what you want.',
        likelihood: 'common',
        checks: [
          look('Compare the port in the connection string with `containerPorts` of the target component.'),
        ],
        fixes: [fix('Use the container port, and leave a database out of `ports`.')],
        proof: src('8.2'),
        lessons: ['multi-component'],
        terms: ['container-ports', 'ports'],
      },
      {
        id: 'not-ready-yet',
        title: 'The app starts before the database is ready',
        why: 'Components start independently. An app that connects once at start-up and gives up can fail while the database is still initialising.',
        likelihood: 'possible',
        checks: [
          look('In the Logs tab, look for a connection error at the very start that stops appearing later.'),
        ],
        fixes: [fix('Retry the connection with a short delay instead of exiting.')],
        proof: guess('8.2', 'Start order was not tested; this is general container behaviour.'),
        lessons: ['shared-database', 'multi-component'],
      },
      {
        id: 'other-app',
        title: 'The target is in a different app',
        why: 'Components can reach only their own app network. Linking apps needs a `networkWith` token in the description, both apps on the same node and the same owner.',
        likelihood: 'rare',
        checks: [look('Check whether the service lives in a different app.')],
        fixes: [fix('Put both services in one app, or use the `networkWith` link with the limits above.')],
        proof: src('8.2'),
        lint: ['NETWORK_WITH_FORMAT'],
        lessons: ['multi-component'],
      },
    ],
    lessons: ['multi-component', 'shared-database'],
    labs: ['spec-forge'],
    related: ['container-crash-loop'],
    lint: ['NETWORK_WITH_FORMAT'],
  },
];
