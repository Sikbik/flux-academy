/**
 * What the form's search box can find: every field of the app and of each component, and the two things
 * the form can do to its structure. Pure, so the ranking is tested without a page.
 *
 *   searchEntries(['web', 'db'])         every entry, in form order
 *   searchResults(entries, 'private')    "Add a private component" first, then fields that mention it
 */

export type SearchAction = 'add-component' | 'add-private';

export interface SearchEntry {
  /** Where "go to the field" lands. Empty for an action. */
  path: string;
  label: string;
  where: string;
  haystack: string;
  /** Set for an entry that does something instead of going somewhere. */
  action?: SearchAction;
}

const APP_FIELDS: readonly { path: string; label: string; words: string }[] = [
  { path: 'name', label: 'App name', words: 'identity domain address' },
  { path: 'description', label: 'Description', words: 'text' },
  { path: 'owner', label: 'Owner', words: 'flux id signer' },
  { path: 'instances', label: 'Instances', words: 'copies replicas nodes redundancy' },
  { path: 'expire', label: 'Subscription', words: 'expire months period duration blocks renew' },
  { path: 'staticip', label: 'Static IP', words: 'address fixed' },
  { path: 'enterprise', label: 'Enterprise', words: 'encrypt private secret' },
  { path: 'contacts', label: 'Contacts', words: 'email notice' },
  { path: 'geolocation', label: 'Where it may run', words: 'region country continent location placement' },
  { path: 'nodes', label: 'Pinned nodes', words: 'priority collateral' },
];

const COMPONENT_FIELDS: readonly { key: string; label: string; words: string }[] = [
  { key: 'name', label: 'Name', words: 'host' },
  { key: 'description', label: 'Description', words: 'text' },
  { key: 'repotag', label: 'Image', words: 'docker repotag registry tag container' },
  { key: 'repoauth', label: 'Registry login', words: 'private token credentials' },
  { key: 'ports', label: 'Ports', words: 'port expose public container domain tcp udp' },
  { key: 'environmentParameters', label: 'Environment', words: 'env variable secret key' },
  { key: 'commands', label: 'Commands', words: 'cmd arguments entrypoint args' },
  { key: 'containerData', label: 'Storage', words: 'volume data folder persist sync replicate path' },
  { key: 'cpu', label: 'CPU', words: 'cores vcpu processor' },
  { key: 'ram', label: 'RAM', words: 'memory mb' },
  { key: 'hdd', label: 'Disk', words: 'ssd gb volume size space' },
];

/** The two ways to grow the app. The words are what somebody types when they mean one of them. */
export const SEARCH_ACTIONS: readonly (SearchEntry & { action: SearchAction })[] = [
  {
    action: 'add-component',
    path: '',
    label: 'Add a component',
    where: 'Components',
    haystack: 'add a component new service container public port web server',
  },
  {
    action: 'add-private',
    path: '',
    label: 'Add a private component',
    where: 'Components',
    haystack:
      'add a private component new database db cache redis postgres internal backend no public port siblings',
  },
];

/** Every entry for an app whose components have these names (`''` for one not named yet). */
export function searchEntries(componentNames: readonly string[]): SearchEntry[] {
  const out: SearchEntry[] = APP_FIELDS.map((f) => ({
    path: f.path,
    label: f.label,
    where: 'App',
    haystack: `${f.label} ${f.words} app`.toLowerCase(),
  }));
  componentNames.forEach((name, i) => {
    if (name === '' && i > 0) return;
    for (const f of COMPONENT_FIELDS) {
      out.push({
        path: `compose[${i}].${f.key}`,
        label: f.label,
        where: name || `Component ${i + 1}`,
        haystack: `${f.label} ${f.words} ${name}`.toLowerCase(),
      });
    }
  });
  out.push(...SEARCH_ACTIONS);
  return out;
}

/**
 * The entries every word of `query` appears in, best first: an entry whose own label has the word comes
 * before one that only has it among its keywords ("private" finds "Add a private component" before the
 * "Registry login" fields that merely mention private images).
 */
export function searchResults(entries: readonly SearchEntry[], query: string, limit = 8): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/);
  const matched = entries.filter((e) => tokens.every((t) => e.haystack.includes(t)));
  const inLabel = (e: SearchEntry) => tokens.every((t) => e.label.toLowerCase().includes(t));
  // Array.prototype.sort is stable: entries of one rank stay in form order.
  return matched.sort((a, b) => Number(inLabel(b)) - Number(inLabel(a))).slice(0, limit);
}
