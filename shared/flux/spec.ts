/**
 * The Flux app specification: constants, limits, defaults, normalisation and derived names.
 *
 * Every limit below carries its source. Source tags:
 *   `FluxOS` = https://github.com/RunOnFlux/flux v8.20.0 (commit 3ca1ab9, 2026-09-25), paths under
 *              `ZelBack/` (config is `ZelBack/config/default.js`, validator is
 *              `ZelBack/src/services/appRequirements/appValidator.js`).
 *   `FACTS`  = docs/research/FACTS.md section number.
 *   `FDM`    = https://github.com/RunOnFlux/flux-domain-manager
 *   `// UNVERIFIED` marks a guess; the matching lint rules are warnings.
 *
 * Pure and framework-free. No Node built-ins, no DOM.
 */

import { DEFAULT_EXPIRE_BLOCKS } from './blocks.ts';
import type { FluxAppSpec, FluxComponentSpec } from './types.ts';

/** The only spec version the network accepts for new work. FluxOS config.fluxapps.latestSupportedSpecVersion; FACTS 3.1. */
export const SPEC_VERSION = 8;

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export interface PortRange {
  from: number;
  to: number;
}

/** Banned public ports. FluxOS config.fluxapps.bannedPorts; FACTS 3.4. */
export const BANNED_PORT_RANGES: readonly PortRange[] = [
  { from: 16100, to: 16299 },
  { from: 26100, to: 26299 },
  { from: 30000, to: 30099 },
  { from: 8384, to: 8384 },
  { from: 27017, to: 27017 },
  { from: 22, to: 22 },
  { from: 23, to: 23 },
  { from: 25, to: 25 },
  { from: 3389, to: 3389 },
  { from: 5900, to: 5900 },
  { from: 5800, to: 5800 },
  { from: 161, to: 161 },
  { from: 512, to: 512 },
  { from: 513, to: 513 },
  { from: 5901, to: 5901 },
  { from: 3388, to: 3388 },
  { from: 4444, to: 4444 },
  { from: 123, to: 123 },
  { from: 53, to: 53 },
];

export const LIMITS = {
  /** FluxOS appSpecsEnforcementHeights[8]; FACTS 3.1. */
  version: SPEC_VERSION,

  name: {
    /** v8 allows 63 characters (RFC 1035 label). FluxOS appValidator.js verifyRestrictionCorrectnessOfApp. */
    maxLength: 63,
    /** v8 app name: letters, digits and inner hyphens. FluxOS appConstants.js APP_NAME_REGEX. */
    pattern: /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/,
    /** Reserved prefixes, case sensitive. FluxOS appValidator.js ("can not start with zel/flux"). The sources give no reason. */
    reservedPrefixes: ['zel', 'flux'] as readonly string[],
    /** Reserved names, any case. FluxOS appValidator.js ("conflicting with another application"). The sources give no reason. */
    reservedNames: ['watchtower'] as readonly string[],
  },

  component: {
    /** Component name is letters and digits only, even in v8. FluxOS appConstants.js APP_NAME_REGEX_LEGACY. */
    namePattern: /^[a-zA-Z0-9]+$/,
    nameMaxLength: 63,
    reservedPrefixes: ['zel', 'flux'] as readonly string[],
    /** 1 to 10 components (5 before block 1300000). FluxOS appValidator.js. */
    min: 1,
    max: 10,
  },

  /** FluxOS appValidator.js: "Maximum of 256 characters" for app and component description. */
  descriptionMaxLength: 256,

  owner: {
    /** Flux ID: starts with 1, 25 to 34 base58 characters, valid checksum. FluxOS signatureVerifier.js isValidSigningIdentity. */
    fluxIdMinLength: 25,
    fluxIdMaxLength: 34,
    /** Or an Ethereum address, `0x` and 40 hex characters. */
    ethereumPattern: /^0x[a-fA-F0-9]{40}$/,
  },

  instances: {
    /** v8 minimum since block 2176519 (config.fluxapps.minimumInstancesV8). FACTS 3.2. */
    min: 1,
    /** v3 to v7 minimum. */
    legacyMin: 3,
    /** FluxOS config.fluxapps.maximumInstances. */
    max: 100,
    /** The instance count at which the small app discount stops. FluxOS appSpecHelpers.js (`instances < 4`). */
    smallAppDiscountBelow: 4,
  },

  ports: {
    /** FluxOS config.fluxapps.portMin / portMax (after block 1420000). */
    min: 1,
    max: 65535,
    /** Per component. FluxOS appValidator.js ("Maximum of 5 allowed"). */
    perComponentMax: 5,
    banned: BANNED_PORT_RANGES,
    /**
     * Priced as "enterprise ports": 0-1023, 8080, 8081, 8443, 6667. FluxOS config.fluxapps.enterprisePorts.
     * This is the node's own table. Port 0 is below `min`, so the validator refuses it and the range a
     * deployer can actually use is 1 to 1023: text built from these ranges clamps the start to `min`.
     */
    surchargeRanges: [
      { from: 0, to: 1023 },
      { from: 8080, to: 8080 },
      { from: 8081, to: 8081 },
      { from: 8443, to: 8443 },
      { from: 6667, to: 6667 },
    ] as readonly PortRange[],
    /** Container ports: 0 to 65535. FluxOS appValidator.js. */
    containerMin: 0,
    containerMax: 65535,
    /** Ports below this need root inside most images or a capability; not enforced by Flux. Docker semantics. */
    privilegedBelow: 1024,
  },

  domains: {
    /** Per entry. FluxOS appValidator.js ("Maximum of 253 characters"). */
    maxLength: 253,
  },

  environment: {
    /** FluxOS appValidator.js ("Maximum of 20 environment variables"). */
    maxCount: 20,
    maxLength: 400,
  },

  commands: {
    maxCount: 20,
    maxLength: 400,
  },

  containerData: {
    /** FluxOS appValidator.js ("container data folder not specified. If no data folder is whished, use /tmp"). */
    minLength: 2,
    maxLength: 200,
    /** Sync flag letters on the primary mount. FluxOS utils/mountParser.js parseMountFlags. */
    syncFlags: ['r', 'g', 's'] as readonly string[],
    /** Prefixes of additional mounts. FluxOS utils/mountParser.js parseMountDefinition. */
    mountPrefixes: ['m', 'ml', 'f', 'c', 'cf'] as readonly string[],
    /** Names that cannot be used as `m:`, `ml:` or `f:` subdirectory or file names. mountParser.js, volumeReservedNames.js. */
    reservedNames: [
      'appdata',
      'backup',
      '.',
      '..',
      '.stfolder',
      '.stignore',
      'lost+found',
      '.flux-op',
    ] as readonly string[],
    /** `ml:` names may not contain pattern characters. volumeReservedNames.js UNSAFE_IGNORE_NAME. */
    subdirMaxLength: 255,
  },

  repotag: {
    maxLength: 200, // FluxOS appValidator.js
    /** FluxOS utils/imageVerifier.js: `[HOST[:PORT]/][NAMESPACE/]REPOSITORY[:TAG]`, tag `[\w][\w.-]{0,127}`. */
    tagPattern: /^[\w][\w.-]{0,127}$/,
    /** Compressed layer size, bytes. FluxOS config.fluxapps.maxImageSize; FACTS 3.3. */
    maxImageBytes: 5_000_000_000,
    /** FluxOS utils/appConstants.js supportedArchitectures. */
    architectures: ['amd64', 'arm64'] as readonly string[],
  },

  repoauth: {
    /** FluxOS appValidator.js ("Maximum length of repoauth is 15000"). */
    maxLength: 15000,
  },

  contacts: {
    maxCount: 5, // FluxOS appValidator.js
    maxLength: 75,
  },

  geolocation: {
    maxCount: 10, // FluxOS appValidator.js
    maxLength: 50,
    /** FluxOS appPlacement/placementFeasibility.js CONTINENT_CODES. */
    continents: ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA'] as readonly string[],
  },

  nodes: {
    maxCount: 120, // FluxOS appValidator.js ("Maximum number of selecteed nodes is 120")
    maxLength: 70, // 64 for txhash, a colon, up to 5 for the index
  },

  expire: {
    /** FluxOS config.fluxapps.cancel1BlockMinBlocksAllowance. */
    min: 1,
    /** FluxOS config.fluxapps.postPonMaxBlocksAllowance. */
    max: 1_056_000,
    default: DEFAULT_EXPIRE_BLOCKS,
  },

  /** Sums over all components. FluxOS appValidator.js checkComposeHWParameters with config.fluxSpecifics. FACTS 3.3. */
  totals: {
    cpu: 15,
    ram: 59_000,
    hdd: 820,
  },

  /**
   * What a nominal node of each tier offers an app. FluxOS config.fluxSpecifics and
   * config.lockedSystemResources (1 core, 2000 MB, 60 GB, plus 20 GB disk margin). FACTS 2.3.
   *
   * `hdd` is the disk a nominal node really has at runtime (0.95 x SSD - 80 = 129, 338, 756 GB). The
   * validator ceiling is higher (`hddCeiling`: 160, 380, 820 GB, nominal SSD minus 60), so a spec can pass
   * the validator and still be unplaceable on a nominal node. Nodes can exceed their tier, so these are
   * "about" figures. The lint rules SIZE_EXCLUDES_CUMULUS and SIZE_NEEDS_STRATUS compare against `hdd`.
   *
   * These are not the size classes of the pricing discount or of the spawn delays (under 3 cores, 6000 MB,
   * 150 GB and under 7 cores, 29000 MB, 370 GB, FACTS 2.4 and 4.3). Those are `HW_DISCOUNTS` in pricing.ts.
   * `tiers.ts` carries the same figures per tier, and a test keeps the two in step.
   */
  tierCapacity: {
    cumulus: { cpu: 3, ram: 5000, hdd: 129, hddCeiling: 160 },
    nimbus: { cpu: 7, ram: 28000, hdd: 338, hddCeiling: 380 },
    stratus: { cpu: 15, ram: 59000, hdd: 756, hddCeiling: 820 },
  },

  /** FluxOS utils/enterpriseHelper.js / appValidator.js. */
  enterprise: {
    /** v8 enterprise apps must publish amd64 for every component ("Arcane nodes are amd64-only"). */
    requiredArchitectures: ['amd64'] as readonly string[],
  },

  /** `description` may carry `networkWith:[a,b]`. FluxOS appLifecycle/appNetworkLinker.js; FACTS 8.2. */
  networkWithPattern: /networkWith:\[([^\]]*)\]/,

  /** Spec keys the v8 validator accepts. FluxOS appValidator.js verifyObjectKeysCorrectnessOfApp. */
  appKeys: [
    'version',
    'name',
    'description',
    'owner',
    'compose',
    'instances',
    'contacts',
    'geolocation',
    'expire',
    'nodes',
    'staticip',
    'datacenter',
    'enterprise',
  ] as readonly string[],
  componentKeys: [
    'name',
    'description',
    'repotag',
    'ports',
    'containerPorts',
    'environmentParameters',
    'commands',
    'containerData',
    'domains',
    'repoauth',
    'cpu',
    'ram',
    'hdd',
  ] as readonly string[],

  /** Domain suffix of generated app names. FDM src/services/domain/index.js; FACTS 6.4. */
  appDomainSuffix: 'app.runonflux.io',
} as const;

// ---------------------------------------------------------------------------
// Small parsers (used by lint, by tests and by the web app)
// ---------------------------------------------------------------------------

function inRanges(n: number, ranges: readonly PortRange[]): boolean {
  for (const r of ranges) if (n >= r.from && n <= r.to) return true;
  return false;
}

/** True when a public port is on the banned list. */
export function isBannedPort(port: number): boolean {
  return inRanges(port, BANNED_PORT_RANGES);
}

/** True when a public port carries the "enterprise port" surcharge (1-1023 in practice, 8080, 8081, 8443, 6667). */
export function isSurchargePort(port: number): boolean {
  return inRanges(port, LIMITS.ports.surchargeRanges);
}

/** Parsed `geolocation` entry. */
export type GeoKind =
  | 'allow-all'
  | 'allow-continent'
  | 'allow-country'
  | 'allow-region'
  | 'deny-continent'
  | 'deny-country'
  | 'deny-region'
  | 'legacy-continent'
  | 'legacy-country'
  | 'unknown';

export interface GeoEntry {
  raw: string;
  kind: GeoKind;
  continent: string | null;
  country: string | null;
  region: string | null;
  /** Plain-language problems with the entry. Empty when it is well formed. */
  problems: string[];
}

/**
 * Parse one geolocation entry. Grammar from FluxOS appPlacement/geolocationRule.js and
 * appRequirements/hwRequirements.js (FACTS 3.5): `acALL`, `ac<CONT>`, `ac<CONT>_ALL`, `ac<CONT>_<CC>`,
 * `ac<CONT>_<CC>_<REGION>`, the same with `a!c` to deny, and the legacy `a<CONT>` and `b<CC>`.
 */
export function parseGeolocationEntry(raw: string): GeoEntry {
  const entry: GeoEntry = {
    raw,
    kind: 'unknown',
    continent: null,
    country: null,
    region: null,
    problems: [],
  };
  const checkContinent = (c: string) => {
    if (!LIMITS.geolocation.continents.includes(c)) {
      entry.problems.push(`"${c}" is not a continent code (use AF, AN, AS, EU, NA, OC or SA)`);
    }
  };
  const checkCountry = (c: string) => {
    if (!/^[A-Z]{2}$/.test(c)) entry.problems.push(`"${c}" is not a two-letter country code`);
  };
  const checkRegion = (country: string | null, r: string) => {
    if (/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(r)) {
      if (country && r.slice(0, 2) !== country) {
        entry.problems.push(`region ${r} does not belong to country ${country}`);
      }
    }
  };

  if (raw.startsWith('a!c')) {
    const parts = raw.slice(3).split('_');
    entry.continent = parts[0] ?? null;
    if (parts.length === 1) {
      entry.kind = 'deny-continent';
      if (entry.continent === 'ALL') entry.problems.push('"ALL" cannot be denied: this entry bans nothing');
      else checkContinent(parts[0] ?? '');
    } else if (parts.length === 2) {
      entry.kind = 'deny-country';
      entry.country = parts[1] ?? null;
      checkContinent(parts[0] ?? '');
      if (parts[1] === 'ALL' || parts[1] === 'NONE') {
        entry.problems.push(`"${parts[1]}" cannot be denied: this entry bans nothing`);
      } else checkCountry(parts[1] ?? '');
    } else {
      entry.kind = 'deny-region';
      entry.country = parts[1] ?? null;
      entry.region = parts.slice(2).join('_');
      checkContinent(parts[0] ?? '');
      checkCountry(parts[1] ?? '');
      checkRegion(entry.country, entry.region);
    }
    return entry;
  }
  if (raw.startsWith('ac')) {
    const body = raw.slice(2);
    if (body === 'ALL') {
      entry.kind = 'allow-all';
      return entry;
    }
    const parts = body.split('_');
    entry.continent = parts[0] ?? null;
    if (parts.length === 1 || (parts.length === 2 && parts[1] === 'ALL')) {
      entry.kind = 'allow-continent';
      checkContinent(parts[0] ?? '');
    } else if (parts.length === 2) {
      entry.kind = 'allow-country';
      entry.country = parts[1] ?? null;
      checkContinent(parts[0] ?? '');
      checkCountry(parts[1] ?? '');
    } else {
      entry.kind = 'allow-region';
      entry.country = parts[1] ?? null;
      entry.region = parts.slice(2).join('_');
      checkContinent(parts[0] ?? '');
      checkCountry(parts[1] ?? '');
      checkRegion(entry.country, entry.region);
    }
    return entry;
  }
  if (raw.startsWith('b') && raw.length > 1) {
    entry.kind = 'legacy-country';
    entry.country = raw.slice(1);
    checkCountry(entry.country);
    return entry;
  }
  if (raw.startsWith('a') && raw.length > 1) {
    entry.kind = 'legacy-continent';
    entry.continent = raw.slice(1);
    checkContinent(entry.continent);
    return entry;
  }
  entry.problems.push('does not start with ac, a!c, a or b, so the network ignores it');
  return entry;
}

export type MountKind =
  | 'primary'
  | 'directory'
  | 'local-directory'
  | 'file'
  | 'component-primary'
  | 'component-directory'
  | 'component-file';

export interface Mount {
  raw: string;
  kind: MountKind;
  /** Sync flags (primary mount only). */
  flags: string[];
  /** Subdirectory or file name for `m:`, `ml:`, `f:`, `c:` and `cf:`. */
  name: string | null;
  /** Component index for `<n>:`, `c:` and `cf:`. */
  component: number | null;
  /** Path inside the container. */
  path: string;
}

export interface ParsedContainerData {
  mounts: Mount[];
  /** Problems the network would hit when it installs the component. Empty when valid. */
  errors: string[];
  /** Sync mode of the primary mount, `g` winning over `r` over `s`, as FluxOS does. */
  syncMode: 'g' | 'r' | 's' | null;
}

function checkMountName(name: string, errors: string[]): void {
  if (!name) errors.push('a subdirectory or file name is empty');
  else if (name.includes('/') || name.includes('..'))
    errors.push(`name "${name}" must not contain "/" or ".."`);
  else if (LIMITS.containerData.reservedNames.includes(name)) errors.push(`name "${name}" is reserved`);
  else if (/[<>:"|?*\0]/.test(name)) errors.push(`name "${name}" contains characters that are not allowed`);
  else if (name.length > LIMITS.containerData.subdirMaxLength) errors.push(`name "${name}" is too long`);
}

function checkMountPath(path: string, errors: string[]): void {
  if (!path) errors.push('a container path is empty');
  else if (path.includes('..')) errors.push(`path "${path}" must not contain ".."`);
  else if (!path.startsWith('/')) errors.push(`path "${path}" must start with "/"`);
  else if (path.includes('\0')) errors.push('a path contains a null byte');
}

/**
 * Parse `containerData` the way FluxOS `utils/mountParser.js` does (FACTS section 7.1).
 * Never throws. `errors` lists everything the node's parser would refuse at install time.
 */
export function parseContainerData(value: string): ParsedContainerData {
  const result: ParsedContainerData = { mounts: [], errors: [], syncMode: null };
  if (typeof value !== 'string' || value.length === 0) {
    result.errors.push('containerData is empty; use /tmp when no data folder is wanted');
    return result;
  }
  const defs = value.split('|');
  defs.forEach((def, index) => {
    const parts = def.split(':');
    if (index === 0) {
      const first = parts[0] ?? '';
      if (/^[rgs]+$/.test(first)) {
        if (parts.length !== 2) {
          result.errors.push(`primary mount "${def}" must look like r:/path`);
          return;
        }
        const flags = LIMITS.containerData.syncFlags.filter((f) => first.includes(f));
        const path = parts[1] ?? '';
        checkMountPath(path, result.errors);
        result.mounts.push({ raw: def, kind: 'primary', flags, name: null, component: null, path });
      } else if (parts.length === 1) {
        checkMountPath(first, result.errors);
        result.mounts.push({
          raw: def,
          kind: 'primary',
          flags: [],
          name: null,
          component: null,
          path: first,
        });
      } else {
        result.errors.push(`primary mount "${def}" is not a path or flags and a path`);
      }
      return;
    }
    const prefix = parts[0] ?? '';
    if (/^\d+$/.test(prefix)) {
      if (parts.length !== 2) {
        result.errors.push(`component reference "${def}" must look like 0:/path`);
        return;
      }
      checkMountPath(parts[1] ?? '', result.errors);
      result.mounts.push({
        raw: def,
        kind: 'component-primary',
        flags: [],
        name: null,
        component: Number.parseInt(prefix, 10),
        path: parts[1] ?? '',
      });
      return;
    }
    if (prefix === 'm' || prefix === 'ml' || prefix === 'f') {
      if (parts.length !== 3) {
        result.errors.push(`mount "${def}" must look like ${prefix}:<name>:/path`);
        return;
      }
      checkMountName(parts[1] ?? '', result.errors);
      checkMountPath(parts[2] ?? '', result.errors);
      if (prefix === 'ml' && /[*?[\]{}\\]/.test(parts[1] ?? '')) {
        result.errors.push(`local directory name "${parts[1]}" may not contain * ? [ ] { } or \\`);
      }
      result.mounts.push({
        raw: def,
        kind: prefix === 'm' ? 'directory' : prefix === 'ml' ? 'local-directory' : 'file',
        flags: [],
        name: parts[1] ?? '',
        component: null,
        path: parts[2] ?? '',
      });
      return;
    }
    if (prefix === 'c' || prefix === 'cf') {
      if (parts.length !== 4) {
        result.errors.push(`mount "${def}" must look like ${prefix}:<n>:<name>:/path`);
        return;
      }
      const n = Number.parseInt(parts[1] ?? '', 10);
      if (Number.isNaN(n)) result.errors.push(`component index in "${def}" is not a number`);
      checkMountName(parts[2] ?? '', result.errors);
      checkMountPath(parts[3] ?? '', result.errors);
      result.mounts.push({
        raw: def,
        kind: prefix === 'c' ? 'component-directory' : 'component-file',
        flags: [],
        name: parts[2] ?? '',
        component: Number.isNaN(n) ? null : n,
        path: parts[3] ?? '',
      });
      return;
    }
    result.errors.push(`unknown mount type in "${def}"`);
  });
  const paths = result.mounts.map((m) => m.path);
  const dupPaths = paths.filter((p, i) => paths.indexOf(p) !== i);
  if (dupPaths.length) result.errors.push(`container path used twice: ${[...new Set(dupPaths)].join(', ')}`);
  const names = result.mounts
    .filter((m) => m.kind === 'directory' || m.kind === 'local-directory' || m.kind === 'file')
    .map((m) => m.name);
  const dupNames = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupNames.length)
    result.errors.push(`subdirectory or file name used twice: ${[...new Set(dupNames)].join(', ')}`);
  const flags = result.mounts[0]?.flags ?? [];
  if (result.errors.length === 0 || result.mounts[0]) {
    result.syncMode = flags.includes('g')
      ? 'g'
      : flags.includes('r')
        ? 'r'
        : flags.includes('s')
          ? 's'
          : null;
  }
  return result;
}

export interface ParsedRepotag {
  /** The full string as given. */
  raw: string;
  /** Registry host, or null when the image comes from Docker Hub. */
  registry: string | null;
  /** Namespace (user or organisation), null for an official library image such as `nginx`. */
  namespace: string | null;
  repository: string;
  /** Tag, or null when none was given. */
  tag: string | null;
  /** `@sha256:...` digest when pinned that way. */
  digest: string | null;
  problems: string[];
}

/**
 * Parse an image reference. The network's own grammar is the pattern in FluxOS `utils/imageVerifier.js`
 * (`[HOST[:PORT]/][NAMESPACE/]REPOSITORY[:TAG]`); this is a stricter, easier to read version that agrees with
 * it on everything the network accepts.
 */
export function parseRepotag(raw: string): ParsedRepotag {
  const out: ParsedRepotag = {
    raw,
    registry: null,
    namespace: null,
    repository: '',
    tag: null,
    digest: null,
    problems: [],
  };
  if (typeof raw !== 'string' || raw.length === 0) {
    out.problems.push('the image is empty');
    return out;
  }
  if (/\s/.test(raw)) out.problems.push('the image contains a space');
  if (raw.startsWith('/') || raw.endsWith('/')) out.problems.push('the image starts or ends with "/"');
  let rest = raw;
  const at = rest.indexOf('@');
  if (at >= 0) {
    out.digest = rest.slice(at + 1);
    rest = rest.slice(0, at);
  }
  const segments = rest.split('/');
  // A first segment with a dot or colon, or "localhost", is a registry host.
  const first = segments[0] ?? '';
  if (segments.length > 1 && (first.includes('.') || first.includes(':') || first === 'localhost')) {
    out.registry = first;
    segments.shift();
  }
  const last = segments.pop() ?? '';
  const colon = last.lastIndexOf(':');
  if (colon >= 0) {
    out.repository = last.slice(0, colon);
    out.tag = last.slice(colon + 1);
  } else {
    out.repository = last;
  }
  out.namespace = segments.length ? segments.join('/') : null;
  if (!out.repository) out.problems.push('the image name is missing');
  if (colon >= 0 && !LIMITS.repotag.tagPattern.test(out.tag ?? '')) {
    out.problems.push(`the tag "${out.tag}" is not a valid tag`);
  }
  if (/[A-Z]/.test(out.repository) || segments.some((s) => /[A-Z]/.test(s))) {
    out.problems.push('image names must be lowercase');
  }
  if (out.repository && !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i.test(out.repository)) {
    out.problems.push(`"${out.repository}" is not a valid image name`);
  }
  return out;
}

/** Split an environment variable string at the first `=`. Returns null when there is none. */
export function parseEnv(value: string): { key: string; value: string } | null {
  if (typeof value !== 'string') return null;
  const i = value.indexOf('=');
  if (i <= 0) return null;
  return { key: value.slice(0, i), value: value.slice(i + 1) };
}

// SHA-256, compact, for the Flux ID checksum. Public domain algorithm.
const SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
];

function sha256(bytes: number[]): number[] {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const msg = bytes.slice();
  const bitLen = bytes.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 7; i >= 0; i--) msg.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < msg.length; off += 64) {
    const w = new Array<number>(64).fill(0);
    for (let i = 0; i < 16; i++) {
      w[i] =
        ((msg[off + i * 4] ?? 0) << 24) |
        ((msg[off + i * 4 + 1] ?? 0) << 16) |
        ((msg[off + i * 4 + 2] ?? 0) << 8) |
        (msg[off + i * 4 + 3] ?? 0);
    }
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15] ?? 0;
      const b = w[i - 2] ?? 0;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (SHA_K[i] ?? 0) + (w[i] ?? 0)) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = ((h[0] ?? 0) + a) | 0;
    h[1] = ((h[1] ?? 0) + b) | 0;
    h[2] = ((h[2] ?? 0) + c) | 0;
    h[3] = ((h[3] ?? 0) + d) | 0;
    h[4] = ((h[4] ?? 0) + e) | 0;
    h[5] = ((h[5] ?? 0) + f) | 0;
    h[6] = ((h[6] ?? 0) + g) | 0;
    h[7] = ((h[7] ?? 0) + hh) | 0;
  }
  const out: number[] = [];
  for (const v of h) out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
  return out;
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(s: string): number[] | null {
  const bytes: number[] = [0];
  for (const ch of s) {
    const v = B58.indexOf(ch);
    if (v < 0) return null;
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      carry += (bytes[i] ?? 0) * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const ch of s) {
    if (ch === '1') bytes.push(0);
    else break;
  }
  return bytes.reverse();
}

export type OwnerCheck = 'ok' | 'empty' | 'shape' | 'checksum';

/**
 * Whether a string is an owner the network accepts: a Flux ID (starts with 1, 25 to 34 base58 characters,
 * valid base58check with a 21 byte payload) or an Ethereum address. FluxOS signatureVerifier.js.
 */
export function checkOwner(owner: string): OwnerCheck {
  if (typeof owner !== 'string' || owner.length === 0) return 'empty';
  if (owner.startsWith('0x')) return LIMITS.owner.ethereumPattern.test(owner) ? 'ok' : 'shape';
  if (
    owner[0] !== '1' ||
    owner.length < LIMITS.owner.fluxIdMinLength ||
    owner.length > LIMITS.owner.fluxIdMaxLength ||
    !/^[1-9a-km-zA-HJ-NP-Z]+$/.test(owner)
  ) {
    return 'shape';
  }
  const raw = base58Decode(owner);
  if (!raw || raw.length < 5) return 'checksum';
  const payload = raw.slice(0, -4);
  const check = raw.slice(-4);
  const hash = sha256(sha256(payload));
  for (let i = 0; i < 4; i++) if (hash[i] !== check[i]) return 'checksum';
  return payload.length === 21 ? 'ok' : 'shape';
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** The Flux team's public ID, used as a stand-in owner in examples and fixtures. FACTS 3.9. */
export const EXAMPLE_OWNER = '1hjy4bCYBJr4mny4zCE85J94RXa8W6q37';

/** A component with the smallest sensible resources, ready to edit. */
export function defaultComponent(overrides: Partial<FluxComponentSpec> = {}): FluxComponentSpec {
  return {
    name: 'web',
    description: 'Web server',
    repotag: 'nginx:1.27',
    repoauth: '',
    ports: [31001],
    containerPorts: [80],
    domains: [''],
    environmentParameters: [],
    commands: [],
    containerData: '/tmp',
    cpu: 0.1,
    ram: 100,
    hdd: 1,
    ...overrides,
  };
}

/**
 * A valid hello-world spec: one nginx container on a free port, three instances, one month.
 * It passes `lintSpec` without errors and costs USD 0.99 a month.
 */
export function defaultSpec(): FluxAppSpec {
  return {
    version: SPEC_VERSION,
    name: 'hello-flux',
    description: 'Hello world demo',
    owner: EXAMPLE_OWNER,
    instances: 3,
    staticip: false,
    enterprise: '',
    contacts: [],
    geolocation: [],
    expire: DEFAULT_EXPIRE_BLOCKS,
    nodes: [],
    compose: [defaultComponent()],
  };
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

export interface NormalizeResult {
  spec: FluxAppSpec;
  /** Paths that were missing or unusable and were filled with a default. */
  defaulted: string[];
  /** Plain-language notes about conversions (legacy keys, strings parsed as numbers, truncation). */
  notes: string[];
  /** Paths whose value was coerced from another type (for example `"3"` to `3`). */
  coerced: string[];
  /** Keys outside the v8 key set. The network's formatter drops them (FACTS 3.2 correction), and so does normalisation. */
  dropped: string[];
}

const MAX_STRING = 20_000;
const MAX_ARRAY = 200;
const MAX_COMPOSE = 50;

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class Norm {
  defaulted: string[] = [];
  notes: string[] = [];
  coerced: string[] = [];
  dropped: string[] = [];

  str(v: unknown, path: string, fallback: string, opts: { silent?: boolean } = {}): string {
    if (typeof v === 'string') return v.length > MAX_STRING ? this.truncate(v, path) : v;
    if (typeof v === 'number' && Number.isFinite(v)) {
      this.coerced.push(path);
      return String(v);
    }
    if (typeof v === 'boolean') {
      this.coerced.push(path);
      return String(v);
    }
    if (!opts.silent) this.defaulted.push(path);
    return fallback;
  }

  truncate(v: string, path: string): string {
    this.notes.push(`${path} was longer than ${MAX_STRING} characters and was cut.`);
    return v.slice(0, MAX_STRING);
  }

  num(v: unknown, path: string, fallback: number): number {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
      this.coerced.push(path);
      return Number(v);
    }
    this.defaulted.push(path);
    return fallback;
  }

  bool(v: unknown, path: string, fallback: boolean): boolean {
    if (typeof v === 'boolean') return v;
    if (v === 'true' || v === 'false') {
      this.coerced.push(path);
      return v === 'true';
    }
    this.defaulted.push(path);
    return fallback;
  }

  strArray(v: unknown, path: string, fallback: string[]): string[] {
    if (!Array.isArray(v)) {
      if (typeof v === 'string' && v !== '') {
        this.coerced.push(path);
        return [v];
      }
      this.defaulted.push(path);
      return fallback.slice();
    }
    if (v.length > MAX_ARRAY)
      this.notes.push(`${path} had more than ${MAX_ARRAY} entries; the rest were cut.`);
    return v.slice(0, MAX_ARRAY).map((x, i) => this.str(x, `${path}[${i}]`, ''));
  }

  numArray(v: unknown, path: string, fallback: number[]): number[] {
    if (!Array.isArray(v)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        this.coerced.push(path);
        return [v];
      }
      this.defaulted.push(path);
      return fallback.slice();
    }
    if (v.length > MAX_ARRAY)
      this.notes.push(`${path} had more than ${MAX_ARRAY} entries; the rest were cut.`);
    const out: number[] = [];
    v.slice(0, MAX_ARRAY).forEach((x, i) => {
      if (typeof x === 'number' && Number.isFinite(x)) out.push(x);
      else if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) {
        this.coerced.push(`${path}[${i}]`);
        out.push(Number(x));
      } else {
        this.notes.push(`${path}[${i}] was not a number and was removed.`);
      }
    });
    return out;
  }
}

function pick(obj: Rec, ...keys: string[]): unknown {
  for (const k of keys) if (k in obj && obj[k] !== undefined) return obj[k];
  return undefined;
}

function normalizeComponent(raw: unknown, index: number, n: Norm, legacyTop?: Rec): FluxComponentSpec {
  const p = `compose[${index}]`;
  const d = defaultComponent({ name: index === 0 ? 'web' : `component${index + 1}` });
  const src: Rec = isRec(raw) ? raw : {};
  if (!isRec(raw)) {
    n.defaulted.push(p);
  }
  if (legacyTop) Object.assign(src, legacyTop);
  const env = pick(src, 'environmentParameters', 'enviromentParameters', 'environment', 'env');
  if ('enviromentParameters' in src && !('environmentParameters' in src)) {
    n.notes.push(
      `${p}.enviromentParameters (old spelling) was read as environmentParameters. The v8 key is environmentParameters.`,
    );
  }
  const ports = n.numArray(
    'ports' in src ? src.ports : 'port' in src ? src.port : undefined,
    `${p}.ports`,
    d.ports,
  );
  if ('port' in src && !('ports' in src)) n.notes.push(`${p}.port (version 1) was read as ports.`);
  const containerPorts = n.numArray(
    'containerPorts' in src ? src.containerPorts : 'containerPort' in src ? src.containerPort : undefined,
    `${p}.containerPorts`,
    ports.slice(),
  );
  let domains: string[];
  if (Array.isArray(src.domains)) domains = n.strArray(src.domains, `${p}.domains`, []);
  else {
    n.defaulted.push(`${p}.domains`);
    domains = ports.map(() => '');
  }
  const out: FluxComponentSpec = {
    name: n.str(src.name, `${p}.name`, d.name),
    description: n.str(src.description, `${p}.description`, d.description),
    repotag: n.str(src.repotag, `${p}.repotag`, d.repotag),
    repoauth: n.str(src.repoauth, `${p}.repoauth`, ''),
    ports,
    containerPorts,
    domains,
    environmentParameters: n.strArray(env, `${p}.environmentParameters`, []),
    commands: n.strArray(src.commands, `${p}.commands`, []),
    containerData: n.str(src.containerData, `${p}.containerData`, d.containerData),
    cpu: n.num(src.cpu, `${p}.cpu`, d.cpu),
    ram: n.num(src.ram, `${p}.ram`, d.ram),
    hdd: n.num(src.hdd, `${p}.hdd`, d.hdd),
  };
  const known = new Set([
    ...LIMITS.componentKeys,
    'enviromentParameters',
    'port',
    'containerPort',
    'environment',
    'env',
  ]);
  for (const k of Object.keys(src)) {
    if (!known.has(k)) {
      n.dropped.push(`${p}.${k}`);
    }
  }
  return out;
}

/**
 * Coerce loose input into a full v8 spec and report what had to change.
 *
 * It never throws and never trusts types: strings that look like numbers are converted, missing keys are
 * filled from `defaultSpec()`, and keys outside the v8 key set are dropped (and listed in `dropped`, so
 * lint can say so). It does NOT clamp values: a spec with `instances: 0` keeps `0` so lint can explain it.
 * Idempotent: normalising its own output changes nothing and reports nothing defaulted.
 */
export function normalizeSpec(input: unknown): NormalizeResult {
  const n = new Norm();
  const base = defaultSpec();
  let src: unknown = input;
  if (typeof src === 'string') {
    try {
      src = JSON.parse(src);
      n.notes.push('The input was a JSON string and was parsed.');
    } catch {
      n.notes.push('The input was text that is not valid JSON, so a default spec was used.');
      src = {};
    }
  }
  let root: Rec;
  if (isRec(src)) root = src;
  else {
    root = {};
    if (src !== undefined && src !== null)
      n.notes.push('The input was not an object, so a default spec was used.');
  }

  const version = pick(root, 'version');
  if (version !== undefined && Number(version) !== SPEC_VERSION) {
    n.notes.push(
      `The spec said version ${String(version)}. Flux Academy works with version ${SPEC_VERSION}, the only one the network accepts for new apps.`,
    );
  }

  // Legacy flat spec (versions 1 to 3 had no compose): lift the top level component fields.
  let composeRaw: unknown[];
  let legacyLift = false;
  if (Array.isArray(root.compose)) {
    composeRaw = root.compose;
  } else if (typeof root.repotag === 'string' || Array.isArray(root.ports) || 'port' in root) {
    legacyLift = true;
    n.notes.push(
      'The spec had no compose array (a version 1 to 3 shape). Its container fields were moved into one component.',
    );
    composeRaw = [
      {
        name: typeof root.name === 'string' ? root.name.replace(/[^a-zA-Z0-9]/g, '') || 'web' : 'web',
        description: root.description,
        repotag: root.repotag,
        repoauth: root.repoauth,
        ports: root.ports ?? root.port,
        containerPorts: root.containerPorts ?? root.containerPort,
        domains: root.domains,
        environmentParameters: root.environmentParameters ?? root.enviromentParameters,
        commands: root.commands,
        containerData: root.containerData,
        cpu: root.cpu,
        ram: root.ram,
        hdd: root.hdd,
      },
    ];
  } else {
    n.defaulted.push('compose');
    composeRaw = [undefined];
  }
  if (composeRaw.length > MAX_COMPOSE) {
    n.notes.push(`compose had more than ${MAX_COMPOSE} components; the rest were cut.`);
    composeRaw = composeRaw.slice(0, MAX_COMPOSE);
  }
  if (composeRaw.length === 0) {
    // an empty array is kept so lint can report it; do not invent a component
  }
  const compose = composeRaw.map((c, i) => normalizeComponent(c, i, n));

  const spec: FluxAppSpec = {
    version: SPEC_VERSION,
    name: n.str(root.name, 'name', base.name),
    description: n.str(root.description, 'description', base.description),
    owner: n.str(root.owner, 'owner', base.owner),
    instances: n.num(root.instances, 'instances', base.instances),
    staticip: n.bool(root.staticip, 'staticip', false),
    enterprise: typeof root.enterprise === 'string' ? root.enterprise : '',
    contacts: n.strArray(root.contacts, 'contacts', []),
    geolocation: n.strArray(root.geolocation, 'geolocation', []),
    expire: n.num(root.expire, 'expire', base.expire),
    nodes: n.strArray(root.nodes, 'nodes', []),
    compose,
  };
  if (root.enterprise === undefined || root.enterprise === null || root.enterprise === false) {
    if (root.enterprise === undefined) n.defaulted.push('enterprise');
  } else if (typeof root.enterprise !== 'string') {
    n.notes.push('enterprise must be a string; it was reset to empty.');
  }
  if (typeof root.datacenter === 'boolean') spec.datacenter = root.datacenter;
  else if (root.datacenter === 'true' || root.datacenter === 'false') {
    n.coerced.push('datacenter');
    spec.datacenter = root.datacenter === 'true';
  }

  const knownTop = new Set([...LIMITS.appKeys, 'enviromentParameters']);
  const legacyTopKeys = new Set([
    'repotag',
    'port',
    'ports',
    'containerPort',
    'containerPorts',
    'domains',
    'environmentParameters',
    'enviromentParameters',
    'commands',
    'containerData',
    'cpu',
    'ram',
    'hdd',
    'repoauth',
    'tiered',
    'cpubasic',
    'rambasic',
    'hddbasic',
    'cpusuper',
    'ramsuper',
    'hddsuper',
    'cpubamf',
    'rambamf',
    'hddbamf',
  ]);
  for (const k of Object.keys(root)) {
    if (knownTop.has(k)) continue;
    // Added by the API when it lists an app; not something a submitter writes.
    if (k === 'hash' || k === 'height') continue;
    if (legacyLift && legacyTopKeys.has(k) && !/^(tiered|cpu|ram|hdd)(basic|super|bamf)?$/.test(k)) continue;
    n.dropped.push(k);
  }
  if (n.dropped.length) {
    n.notes.push(
      `These keys are not part of a v8 spec and were removed: ${n.dropped.slice(0, 8).join(', ')}.`,
    );
  }
  return { spec, defaulted: n.defaulted, notes: n.notes, coerced: n.coerced, dropped: n.dropped };
}

// ---------------------------------------------------------------------------
// Derived names
// ---------------------------------------------------------------------------

export interface DerivedComponent {
  name: string;
  /** Docker container name and the DNS name other components use: `flux<component>_<app>`. */
  containerName: string;
  /** The container's own hostname (the bare component name). */
  hostname: string;
  /** `containerName:port` for every container port, how another component calls this one. */
  internalAddresses: string[];
  /** Host directory of the component's persistent volume. */
  volumePath: string;
}

export interface DerivedPort {
  component: string;
  /** Public (external) port. */
  port: number;
  containerPort: number;
  /** Generated domain: `<app>_<port>.app.runonflux.io`. */
  generatedDomain: string;
  /** Custom domains, split from the `domains` entry. */
  customDomains: string[];
  /** True for the first port of the app, which `<app>.app.runonflux.io` also reaches. */
  isFirst: boolean;
}

export interface DerivedNames {
  /** `<app>.app.runonflux.io` (lower case), served for the app's first port. */
  appDomain: string;
  /** Internal docker network of the app. */
  network: string;
  components: DerivedComponent[];
  ports: DerivedPort[];
}

/**
 * Internal DNS names and generated domains for a spec. Sources: FluxOS dockerService.js (container names,
 * network, hostname) and FDM src/services/domain/index.js (domains); FACTS sections 3.8, 6.4 and 8.2.
 * Domain labels are lower cased by the domain manager.
 */
export function derivedNames(spec: FluxAppSpec): DerivedNames {
  const app = String(spec?.name ?? '');
  const lower = app.toLowerCase();
  const suffix = LIMITS.appDomainSuffix;
  const components: DerivedComponent[] = [];
  const ports: DerivedPort[] = [];
  let first = true;
  for (const c of Array.isArray(spec?.compose) ? spec.compose : []) {
    const cname = String(c?.name ?? '');
    const prefix = cname.startsWith('flux') || cname.startsWith('zel') ? '' : 'flux';
    const containerName = `${prefix}${cname}_${app}`;
    const cps = Array.isArray(c?.containerPorts) ? c.containerPorts : [];
    components.push({
      name: cname,
      containerName,
      hostname: cname,
      internalAddresses: cps.map((p) => `${containerName}:${p}`),
      volumePath: `/apps/${containerName}/appdata`,
    });
    const ps = Array.isArray(c?.ports) ? c.ports : [];
    ps.forEach((port, i) => {
      const dom = Array.isArray(c?.domains) ? String(c.domains[i] ?? '') : '';
      ports.push({
        component: cname,
        port,
        containerPort: cps[i] ?? port,
        generatedDomain: `${lower}_${port}.${suffix}`,
        customDomains: dom
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isFirst: first,
      });
      first = false;
    });
  }
  return {
    appDomain: `${lower}.${suffix}`,
    network: `fluxDockerNetwork_${app}`,
    components,
    ports,
  };
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isRec(v)) {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/**
 * A stable fingerprint of a spec (keys sorted, FNV-1a twice with different seeds, 16 hex characters).
 * Good for cache keys and "did the spec change" checks. Not a cryptographic hash.
 */
export function specSignature(spec: unknown): string {
  const text = canonical(spec);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0xdeadbeef;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
    h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
