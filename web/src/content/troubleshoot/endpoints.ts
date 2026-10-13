/**
 * The read-only public API calls the troubleshooting page may point at.
 *
 * Every entry is a GET that was verified live on 2026-10-12: FACTS section 10 lists each of them with its
 * size and date (10.10), and 9.5.1 holds the one call to the payment bridge. Nothing here needs a login
 * and nothing here changes anything on the network.
 * `{app}` is replaced with the visitor's app name when they have typed one.
 *
 * Why not call these from the page? The Academy's server proxies only what its own labs need; this page
 * hands the visitor the exact URL instead, so they see the real thing and the page stays honest about what
 * it did and did not check.
 */

export interface Endpoint {
  id: string;
  /** What it returns, in a few words. */
  title: string;
  /** Full URL template. `{app}` is the app name. */
  url: string;
  /** Where it is described in docs/research/FACTS.md. */
  facts: string;
  /** True when the URL has an `{app}` placeholder, so "Open" needs a name. */
  needsApp: boolean;
  /** Something to keep in mind whenever this address is used, shown with it. */
  caveat?: string;
}

/** The date FACTS verified these calls. */
export const ENDPOINTS_VERIFIED = '2026-10-12';

const API = 'https://api.runonflux.io';

function endpoint(id: string, title: string, url: string, facts: string, caveat?: string): Endpoint {
  return { id, title, url, facts, needsApp: url.includes('{app}'), ...(caveat ? { caveat } : {}) };
}

export const ENDPOINTS: readonly Endpoint[] = [
  endpoint(
    'appspec',
    'The current spec of one app',
    `${API}/apps/appspecifications/{app}`,
    '10.6.3 E15',
    'An Enterprise app answers with `compose` and `contacts` empty, because they are encrypted. Read the spec in your own project instead.',
  ),
  endpoint('location', 'The running instances of one app', `${API}/apps/location/{app}`, '10.6.4 E24'),
  endpoint(
    'installing',
    'Nodes that are installing one app right now',
    `${API}/apps/installinglocation/{app}`,
    '10.6.4 E26',
  ),
  endpoint(
    'install-errors',
    'Recent install failures of one app',
    `${API}/apps/installingerrorslocation/{app}`,
    '10.6.4 E26',
  ),
  endpoint(
    'messages',
    'On-chain register and update messages of one app',
    `${API}/apps/permanentmessages?appname={app}`,
    '10.6.3 E19',
  ),
  endpoint(
    'pending',
    'App messages this node holds for the next hour',
    `${API}/apps/temporarymessages`,
    '10.6.3 E20',
  ),
  endpoint(
    'deploy-info',
    'Deployment rules: banned ports, fee ports, image limit, payment address',
    `${API}/apps/deploymentinformation`,
    '10.6.2 E8',
  ),
  endpoint('price-table', 'The USD price table', `${API}/apps/getappspecsusdprice`, '10.6.2 E9'),
  endpoint(
    'limits',
    'The network limits, as a raw configuration dump',
    `${API}/apps/registrationinformation`,
    '10.6.2 E10',
  ),
  endpoint(
    'placement',
    'Nodes and fault domains per continent and country',
    `${API}/apps/placementlocations`,
    '10.6.2 E12',
    'This is a cached table: `tableGenerated` in the answer says how old it is.',
  ),
  endpoint('height', 'The current block height', `${API}/daemon/getblockcount`, '10.6.1 E1'),
  endpoint(
    'spec-version',
    'The newest spec version the network accepts',
    `${API}/apps/latestspecificationversion`,
    '10.6.2 E11',
  ),
  endpoint(
    'fiat-status',
    'Whether the card and PayPal gateways are up',
    'https://fiatpaymentsbridge.runonflux.io/api/v1/gateway/status',
    '9.5.1',
  ),
  endpoint(
    'policy',
    'The signed network policy: blocked repositories and the blocklist',
    'https://raw.githubusercontent.com/RunOnFlux/fluxos-network-policy/signed/policy-signed.json',
    '10.8',
  ),
];

const BY_ID = new Map(ENDPOINTS.map((e) => [e.id, e]));

export function endpointById(id: string): Endpoint | undefined {
  return BY_ID.get(id);
}

/** An app name as the network accepts it: letters, digits and inner hyphens. Anything else is dropped. */
export function cleanApp(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** A domain name: letters, digits, dots and hyphens. Anything else is dropped. */
export function cleanDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.-]/g, '')
    .slice(0, 253);
}

/**
 * Replace `{app}` and `{domain}` in a template with already cleaned values. A missing value leaves the
 * placeholder in place so the reader can see what goes there.
 */
export function fillTemplate(template: string, values: { app?: string; domain?: string }): string {
  return template
    .replace(/\{app\}/g, values.app ? values.app : '{app}')
    .replace(/\{domain\}/g, values.domain ? values.domain : '{domain}');
}
