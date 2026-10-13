/**
 * Glossary terms the Stratus track introduces that the canonical base list does not define.
 *
 * Only terms with no entry elsewhere belong here. Every definition is general vocabulary or restates a
 * FACTS row; the row is cited on the entry. Nothing in this file is a Flux claim that FACTS does not make.
 */

import type { GlossaryTerm } from '@/learn/types';

const terms: GlossaryTerm[] = [
  {
    id: 'availability',
    term: 'Availability',
    short: 'The share of time an app answers requests, written as a percentage such as 99.9 percent.',
    why: 'It turns "always on" into a number you can plan and price. Each extra instance raises it, but only as far as failures really are independent.',
    category: 'ops',
    related: ['instance', 'failover', 'n-minus-1'],
    lessons: ['redundancy-failover'],
  },
  {
    id: 'n-minus-1',
    term: 'N minus 1',
    proper: true,
    aka: ['N-1', 'N-1 planning'],
    short: 'Sizing a service so that the instances left after one failure can still carry the full load.',
    why: 'A replacement can take about two hours after the node dies, more for synced storage. Plan for the instances left after a failure: each must carry 1/(n-1) of peak, so with 2 instances each needs the whole peak.',
    // fact: FACTS 6.5 (failover cost; provision for N-1 running)
    category: 'ops',
    related: ['failover', 'instances-field', 'location'],
    lessons: ['redundancy-failover', 'production-checklist'],
  },
  {
    id: 'eligible-node',
    term: 'Eligible node',
    short:
      'A node that passes every check for an app: geolocation, static IP, pinned nodes, free resources and ports. Only eligible nodes may install it.',
    why: 'Placement chooses among eligible nodes only. Narrow rules shrink the pool, and a pool smaller than the instances you ask for means the app cannot be fully placed.',
    // fact: FACTS 6.2 (the list of reasons a node refuses an app)
    category: 'network',
    related: ['geolocation', 'static-ip', 'nodes-field', 'spawner'],
    lessons: ['geo-placement'],
  },
  {
    id: 'eventual-consistency',
    term: 'Eventual consistency',
    short:
      'Copies of data that catch up with each other over time instead of changing together. Two copies written at once can conflict.',
    why: 'This is how replicated `r:` volumes behave: a write on one instance reaches the others after a delay. Do not rely on every instance seeing the same bytes at the same moment.',
    // fact: FACTS 7.2 (r: is eventually consistent, conflicts possible)
    category: 'ops',
    related: ['syncthing', 'container-data', 'primary-standby'],
    lessons: ['persistent-storage', 'shared-database'],
  },
  {
    id: 'apex-domain',
    term: 'Apex domain',
    aka: ['root domain', 'bare domain', 'naked domain', 'zone apex'],
    short:
      'The domain with no name in front of it, such as example.com. Standard DNS does not allow a CNAME record there.',
    why: "Pointing a custom domain at your app is a CNAME. A subdomain such as shop.example.com takes one directly. At the apex you need your provider's flattening feature or an A record.",
    category: 'network',
    related: ['cname', 'domains', 'app-domain', 'dns-propagation'],
    lessons: ['custom-domains'],
  },
  {
    id: 'lets-encrypt',
    term: "Let's Encrypt",
    proper: true,
    aka: ['letsencrypt', 'certbot', 'HTTP-01'],
    short:
      "A free certificate authority. FDM asks it for a certificate for your custom domain once the domain's DNS points at Flux.",
    why: 'This is how your own domain gets HTTPS without you managing certificates. It only works while DNS points straight at Flux: a proxy in front blocks the check.',
    // fact: FACTS 6.4 (custom domain TLS: HTTP-01 when the domain resolves to the FDM group)
    category: 'network',
    related: ['fdm', 'domains', 'cname'],
    lessons: ['custom-domains'],
  },
  {
    id: 'dns-propagation',
    term: 'DNS propagation',
    proper: true,
    aka: ['propagation', 'DNS cache', 'TTL'],
    short:
      'The wait before a changed DNS record is seen everywhere, because resolvers keep the old answer until its time to live runs out.',
    why: 'A correct record can still look wrong for a while. Ask a resolver what it returns before you decide that the spec or the record is at fault.',
    category: 'network',
    related: ['cname', 'domains', 'apex-domain'],
    lessons: ['custom-domains'],
  },
  {
    id: 'enospc',
    term: 'ENOSPC',
    proper: true,
    aka: ['no space left on device', 'disk full', 'volume full'],
    short:
      'The error a program sees when its disk is full: "No space left on device". In a Flux container it usually means the volume reached its hdd size.',
    why: 'A volume is a fixed-size image, so a full disk is a hard stop. Growing it needs an update that recreates the volume, so take a backup first.',
    // fact: FACTS 7.3 (hdd is a pre-allocated image, ENOSPC), 11 row 16 (fix is more hdd, hard redeploy)
    category: 'ops',
    related: ['container-data', 'hard-redeploy', 'soft-redeploy'],
    lessons: ['persistent-storage'],
  },
];

export default terms;
