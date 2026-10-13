/**
 * The toy DNS world of the "DNS check" scenario and the DNS record builder widget.
 *
 * Names are RFC 2606 reserved (`example.com`) and addresses are RFC 5737 documentation addresses
 * (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24): none of them is real, so nothing here can point
 * at a real machine. The FDM load balancer HOST name below is a recorded fact (FACTS 6.4: a DoH lookup
 * of an app domain returned a CNAME to `fdm-lb-1-2.runonflux.io`); its ADDRESS is a toy value. The
 * real addresses are not published as a stable contract, so the Academy never shows them.
 */

/** The suffix every Flux app gets: `<name>.app.runonflux.io` (FACTS 6.4). */
export const APP_DOMAIN_SUFFIX = 'app.runonflux.io';

/** The load balancer host an app domain is a CNAME to (recorded, FACTS 6.4). */
export const FDM_LB_HOST = 'fdm-lb-1-2.runonflux.io';

/**
 * Toy address of the FDM load balancer. Documentation range 203.0.113.0/24. The DNS record builder widget
 * (learn/widgets/dns-record-builder) answers with the same address, so a learner who meets both sees one world.
 */
export const FDM_TOY_ADDRESS = '203.0.113.40';

/** Toy addresses a CDN proxy would answer with. Documentation range 198.51.100.0/24 (same as the widget). */
export const PROXY_TOY_ADDRESSES = ['198.51.100.21', '198.51.100.22'] as const;

/** Toy authoritative name server of the learner's DNS provider. Documentation range 192.0.2.0/24. */
export const NS_HOST = 'ns1.example-dns.net';
export const NS_TOY_ADDRESS = '192.0.2.53';

/** The example app and domain every DNS example uses (the widget's defaults too). */
export const DEMO_APP = 'lanternshop';
export const DEMO_DOMAIN = 'shop.example.com';

/** The local stub resolver address most Linux machines show. */
export const RESOLVER_ADDRESS = '127.0.0.53';

/** The default Flux domain of an app: `<name lower cased>.app.runonflux.io`. */
export function appHost(appName: string): string {
  return `${appName.trim().toLowerCase()}.${APP_DOMAIN_SUFFIX}`;
}
