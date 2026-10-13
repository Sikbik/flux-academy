/**
 * The teachable linter for Flux app specs.
 *
 * `lintSpec` normalises whatever it is given, then runs the rule catalogue in `lint-catalogue.ts`. The
 * contract that matters: an `error` issue means the network would reject the spec (FluxOS 8.20.0
 * `appValidator.js` and friends); everything else is a warning or an info. It never throws and never
 * mutates its input.
 *
 * Pure and framework-free. No Node built-ins, no DOM.
 */

import { BLOCKS_PER_MONTH } from './blocks.ts';
import { LINT_CODES } from './lint-catalogue.ts';
import {
  DATABASE_PORTS,
  HEAVY_IMAGE_PATTERNS,
  knownImage,
  PLACEHOLDER_VALUE,
  SECRET_ENV_KEY,
} from './lint-data.ts';
import {
  BAKED_PRICING,
  EXTRA_INSTANCE_FLOOR_USD,
  marketplaceMultiplier,
  priceStages,
  quote,
} from './pricing.ts';
import {
  checkOwner,
  isBannedPort,
  isSurchargePort,
  LIMITS,
  normalizeSpec,
  parseContainerData,
  parseEnv,
  parseGeolocationEntry,
  parseRepotag,
} from './spec.ts';
import type { FluxAppSpec, FluxComponentSpec, LintIssue, LintReport, LintSeverity } from './types.ts';

export type { LintBasis, LintCategory, LintCodeMeta } from './lint-catalogue.ts';
export { LINT_CODES, lintBasis } from './lint-catalogue.ts';

export interface LintContext {
  /** App names already registered on the network (any case). Enables NAME_TAKEN. */
  takenNames?: readonly string[] | ReadonlySet<string>;
  /** How many nodes the geolocation leaves eligible, from the geo snapshot. Enables INSTANCES_EXCEED_NODES. */
  eligibleNodes?: number;
  /** Include teaching-only infos (health checks, implicit registry, privileged container ports). */
  teaching?: boolean;
  /** Marketplace multipliers to check names against (default: the baked list). */
  marketplace?: readonly { name: string; multiplier: number }[];
}

const SEVERITY_ORDER: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 };

interface Extra {
  why?: string;
  fix?: string;
  suggestion?: unknown;
  severity?: LintSeverity;
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(n: number): boolean {
  return Number.isInteger(n);
}

function fmt(n: number): string {
  return String(Number(n.toFixed(6)));
}

function sanitiseName(name: string): string {
  const s = name
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, LIMITS.name.maxLength) || 'my-app';
}

function sanitiseComponentName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, '').slice(0, LIMITS.component.nameMaxLength) || 'web';
}

const PORT_ENV_KEYS = /^(PORT|HTTP_PORT|APP_PORT|SERVER_PORT|LISTEN_PORT|WEB_PORT|NODE_PORT)$/i;
const BIND_ENV_KEYS = /(HOST|BIND|ADDR|LISTEN|INTERFACE)/i;
const LOOPBACK_VALUE = /^(127\.0\.0\.1|localhost|::1|\[::1\])(:\d+)?$/i;
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z]{2,63}$/i;
const NODE_OUTPOINT = /^[0-9a-fA-F]{64}:\d+$/;
const NODE_ADDRESS = /^(\d{1,3}(\.\d{1,3}){3}|\[[0-9a-fA-F:]+\])(:\d{1,5})?$/;
const SECOND_LEVEL = ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'];

function isFluxStorageUrl(link: string): boolean {
  try {
    const u = new URL(link);
    return (
      u.protocol === 'https:' &&
      u.hostname === 'storage.runonflux.io' &&
      u.port === '' &&
      u.username === '' &&
      u.password === ''
    );
  } catch {
    return false;
  }
}

/**
 * Lint a spec. `input` may be anything: a spec, a partial spec, a JSON string, garbage.
 * The report is sorted errors first, then warnings, then infos, each in spec order.
 */
export function lintSpec(input: unknown, ctx: LintContext = {}): LintReport {
  const issues: LintIssue[] = [];
  let spec: FluxAppSpec;
  let norm: ReturnType<typeof normalizeSpec>;
  try {
    norm = normalizeSpec(input);
    spec = norm.spec;
  } catch {
    // normalizeSpec never throws; this is belt and braces for the "never throws" promise.
    norm = { spec: normalizeSpec(undefined).spec, defaulted: [], notes: [], coerced: [], dropped: [] };
    spec = norm.spec;
  }

  const add = (code: string, path: string, message: string, extra: Extra = {}) => {
    const meta = LINT_CODES[code];
    if (!meta) throw new Error(`unknown lint code ${code}`);
    const issue: LintIssue = {
      code,
      severity: extra.severity ?? meta.severity,
      path,
      message,
      why: extra.why ?? meta.why,
      fix: extra.fix ?? meta.fix,
    };
    if (extra.suggestion !== undefined) issue.suggestion = extra.suggestion;
    if (meta.docs) issue.docs = meta.docs;
    issues.push(issue);
  };

  try {
    run(spec, norm, input, ctx, add);
  } catch {
    // A bug in a rule must not take the page down; the report just carries what was found so far.
  }

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;
  return { valid: errors === 0, errors, warnings, infos, issues };
}

type Add = (code: string, path: string, message: string, extra?: Extra) => void;

function run(
  spec: FluxAppSpec,
  norm: ReturnType<typeof normalizeSpec>,
  raw: unknown,
  ctx: LintContext,
  add: Add,
): void {
  const enterprise = Boolean(spec.enterprise);
  const compose = spec.compose;

  // ---- shape: what normalisation had to do ----------------------------------------------------------
  if (isRec(raw) && raw.version !== undefined && Number(raw.version) !== LIMITS.version) {
    add(
      'VERSION_CHANGED',
      'version',
      `The spec says version ${String(raw.version)}; it was read as version 8.`,
      {
        suggestion: 8,
      },
    );
  }
  for (const p of norm.defaulted) {
    add(
      'FIELD_MISSING',
      p,
      `${p} is missing, so a default was used here. The network would refuse the spec as written.`,
    );
  }
  for (const p of norm.coerced) {
    add('FIELD_COERCED', p, `${p} was written as the wrong type and was converted.`);
  }
  for (const p of norm.dropped) {
    const key = p.split('.').pop() ?? p;
    let extra: Extra = {};
    if (key === 'tiered' || /^(cpu|ram|hdd)(basic|super|bamf)$/.test(key)) {
      extra = {
        why: 'Version 8 has no tiers: every instance gets the same cpu, ram and hdd on every node, and the formatter drops the tier keys, so they have no effect.',
        fix: 'Delete the key and set one cpu, ram and hdd per component.',
      };
    } else if (key === 'secrets') {
      extra = {
        why: 'Component secrets were removed in version 8; the whole component list is encrypted instead when the app is enterprise.',
        fix: 'Delete secrets and make the app enterprise if values must stay private.',
      };
    }
    add('UNKNOWN_FIELD', p, `The key "${key}" is not part of a version 8 spec and is ignored.`, extra);
  }

  // ---- identity -----------------------------------------------------------------------------------
  const name = spec.name;
  if (name.length === 0) {
    add('NAME_MISSING', 'name', 'The app name is empty.');
  } else {
    if (name.length > LIMITS.name.maxLength) {
      add(
        'NAME_TOO_LONG',
        'name',
        `The name has ${name.length} characters; the limit is ${LIMITS.name.maxLength}.`,
        {
          suggestion: name.slice(0, LIMITS.name.maxLength),
        },
      );
    }
    if (!LIMITS.name.pattern.test(name)) {
      add('NAME_FORMAT', 'name', `The name "${name}" has characters that are not allowed.`, {
        suggestion: sanitiseName(name),
      });
    }
    if (LIMITS.name.reservedPrefixes.some((p) => name.startsWith(p))) {
      add('NAME_RESERVED_PREFIX', 'name', `The name starts with a reserved prefix (zel or flux).`, {
        suggestion: `my-${name}`,
      });
    }
    if (LIMITS.name.reservedNames.includes(name.toLowerCase())) {
      add('NAME_RESERVED', 'name', `The name "${name}" is reserved.`);
    }
    if (name !== name.toLowerCase() && LIMITS.name.pattern.test(name)) {
      add(
        'NAME_UPPERCASE',
        'name',
        `The name has capital letters, but the web address will be "${name.toLowerCase()}".`,
        {
          suggestion: name.toLowerCase(),
        },
      );
    }
    const mult = marketplaceMultiplier(name, ctx.marketplace);
    if (mult > 1) {
      add(
        'NAME_MARKETPLACE_PREFIX',
        'name',
        `The name starts with a marketplace app name, which multiplies the price by ${mult}.`,
      );
    }
    if (ctx.takenNames) {
      const taken =
        ctx.takenNames instanceof Set ? ctx.takenNames : new Set(ctx.takenNames as readonly string[]);
      const lower = name.toLowerCase();
      for (const t of taken) {
        if (String(t).toLowerCase() === lower) {
          add('NAME_TAKEN', 'name', `An app called "${name}" is already registered.`);
          break;
        }
      }
    }
  }
  if (spec.description.length === 0) {
    add('DESCRIPTION_MISSING', 'description', 'The description is empty.');
  } else if (spec.description.length > LIMITS.descriptionMaxLength) {
    add(
      'DESCRIPTION_TOO_LONG',
      'description',
      `The description has ${spec.description.length} characters; the limit is ${LIMITS.descriptionMaxLength}.`,
      { suggestion: spec.description.slice(0, LIMITS.descriptionMaxLength) },
    );
  }
  if (/networkWith/i.test(spec.description) && !LIMITS.networkWithPattern.test(spec.description)) {
    add(
      'NETWORK_WITH_FORMAT',
      'description',
      'networkWith is present but not in the form networkWith:[appA,appB].',
    );
  }
  const ownerCheck = checkOwner(spec.owner);
  if (ownerCheck === 'empty') add('OWNER_MISSING', 'owner', 'The owner is empty.');
  else if (ownerCheck === 'shape') {
    add(
      'OWNER_INVALID',
      'owner',
      'The owner is not shaped like a Flux ID (an address starting with 1) or an Ethereum address (0x and 40 hex characters).',
    );
  } else if (ownerCheck === 'checksum') {
    add(
      'OWNER_INVALID',
      'owner',
      'The owner looks like a Flux ID but its checksum is wrong, so it has a typo.',
    );
  }

  // ---- components list ------------------------------------------------------------------------------
  if (compose.length === 0) {
    if (enterprise) {
      add(
        'ENTERPRISE_OPAQUE',
        'compose',
        'The components are empty because they are encrypted inside the enterprise value.',
      );
    } else {
      add('COMPOSE_EMPTY', 'compose', 'The app has no components.');
    }
  } else if (compose.length > LIMITS.component.max) {
    add(
      'COMPOSE_TOO_MANY',
      'compose',
      `The app has ${compose.length} components; the limit is ${LIMITS.component.max}.`,
    );
  }
  if (enterprise && compose.length > 0) {
    add(
      'ENTERPRISE_PLAIN_COMPOSE',
      'compose',
      'The components are written in the clear next to the enterprise value.',
    );
  }

  // ---- instances ------------------------------------------------------------------------------------
  const inst = spec.instances;
  let instancesOk = false;
  if (!isInt(inst)) {
    add('INSTANCES_FRACTIONAL', 'instances', `instances is ${fmt(inst)}, which is not a whole number.`, {
      suggestion: Math.max(1, Math.round(inst)),
    });
  } else if (inst < LIMITS.instances.min) {
    add('INSTANCES_LOW', 'instances', `instances is ${inst}; the minimum is ${LIMITS.instances.min}.`, {
      suggestion: 3,
    });
  } else if (inst > LIMITS.instances.max) {
    add('INSTANCES_HIGH', 'instances', `instances is ${inst}; the maximum is ${LIMITS.instances.max}.`, {
      suggestion: LIMITS.instances.max,
    });
  } else {
    instancesOk = true;
  }
  if (instancesOk) {
    if (inst === 1) {
      add(
        'INSTANCES_ONE',
        'instances',
        'The app has a single instance, so it is down whenever its node is.',
        {
          suggestion: 3,
        },
      );
    }
    if (inst < LIMITS.instances.smallAppDiscountBelow) {
      const st = priceStages(spec, BAKED_PRICING.params);
      if (st.hwFactor !== 1 && inst === 3) {
        const at3 = quote(spec, BAKED_PRICING.params).usdTotal ?? 0;
        const at4 = quote({ ...spec, instances: 4 }, BAKED_PRICING.params).usdTotal ?? 0;
        if (at4 > at3) {
          add(
            'INSTANCES_PRICE_CLIFF',
            'instances',
            `At 3 instances this app costs $${at3.toFixed(2)} a month and at 4 it costs $${at4.toFixed(2)}, because the small app discount stops at 4${
              st.perInstanceUsd < EXTRA_INSTANCE_FLOOR_USD
                ? ` and one instance costs under $${EXTRA_INSTANCE_FLOOR_USD.toFixed(2)}, so each instance after the first is then a flat $${EXTRA_INSTANCE_FLOOR_USD.toFixed(2)}`
                : ''
            }.`,
          );
        }
      }
    }
    if (
      typeof ctx.eligibleNodes === 'number' &&
      Number.isFinite(ctx.eligibleNodes) &&
      inst > ctx.eligibleNodes
    ) {
      add(
        'INSTANCES_EXCEED_NODES',
        'instances',
        `The app asks for ${inst} instances but only ${ctx.eligibleNodes} nodes are eligible for its geolocation.`,
        { suggestion: Math.max(1, ctx.eligibleNodes) },
      );
    }
    if (spec.nodes.length > 0 && spec.nodes.length < inst) {
      add(
        'NODES_FEWER_THAN_INSTANCES',
        'nodes',
        `The app asks for ${inst} instances but names only ${spec.nodes.length} node${spec.nodes.length === 1 ? '' : 's'}.`,
      );
    }
  }

  // ---- per component ----------------------------------------------------------------------------------
  const seenNames = new Map<string, number>();
  const publicPorts = new Map<number, string>();
  let totalCpu = 0;
  let totalRam = 0;
  let totalHdd = 0;
  let anyPublicPort = false;

  compose.forEach((c, ci) => {
    const p = `compose[${ci}]`;
    lintComponent(c, ci, p, spec, ctx, add, seenNames, publicPorts);
    totalCpu += c.cpu;
    totalRam += c.ram;
    totalHdd += c.hdd;
    if (c.ports.length > 0) anyPublicPort = true;
  });

  // ---- totals -----------------------------------------------------------------------------------------
  const cpuTotal = Math.round(totalCpu * 1e6) / 1e6;
  let over = false;
  if (cpuTotal > LIMITS.totals.cpu + 1e-9) {
    over = true;
    add(
      'TOTAL_CPU_EXCEEDED',
      '',
      `The components add up to ${fmt(cpuTotal)} cores; the limit is ${LIMITS.totals.cpu}.`,
    );
  }
  if (totalRam > LIMITS.totals.ram) {
    over = true;
    add(
      'TOTAL_RAM_EXCEEDED',
      '',
      `The components add up to ${fmt(totalRam)} MB of RAM; the limit is ${LIMITS.totals.ram}.`,
    );
  }
  if (totalHdd > LIMITS.totals.hdd) {
    over = true;
    add(
      'TOTAL_HDD_EXCEEDED',
      '',
      `The components add up to ${fmt(totalHdd)} GB of disk; the limit is ${LIMITS.totals.hdd}.`,
    );
  }
  if (!over && compose.length > 0) {
    // `hdd` is the disk a nominal node really has (129, 338, 756 GB), not the validator ceiling (FACTS 2.3).
    const cum = LIMITS.tierCapacity.cumulus;
    const nim = LIMITS.tierCapacity.nimbus;
    const str = LIMITS.tierCapacity.stratus;
    if (cpuTotal > nim.cpu || totalRam > nim.ram || totalHdd > nim.hdd) {
      const tight =
        totalHdd > str.hdd
          ? ` A nominal Stratus node has about ${str.hdd} GB of disk for apps, so even Stratus may not have room.`
          : '';
      add(
        'SIZE_NEEDS_STRATUS',
        '',
        `${fmt(cpuTotal)} cores, ${fmt(totalRam)} MB and ${fmt(totalHdd)} GB is more than a nominal Nimbus node offers (${nim.cpu} cores, ${nim.ram} MB, about ${nim.hdd} GB of disk), so only Stratus nodes have room and fewer nodes can host it.${tight}`,
      );
    } else if (cpuTotal > cum.cpu || totalRam > cum.ram || totalHdd > cum.hdd) {
      add(
        'SIZE_EXCLUDES_CUMULUS',
        '',
        `${fmt(cpuTotal)} cores, ${fmt(totalRam)} MB and ${fmt(totalHdd)} GB is more than a nominal Cumulus node offers (${cum.cpu} cores, ${cum.ram} MB, about ${cum.hdd} GB of disk), so only Nimbus and Stratus nodes have room.`,
      );
    }
  }

  // ---- public ports ----------------------------------------------------------------------------------
  if (compose.length > 0 && !anyPublicPort) {
    add(
      'NO_PUBLIC_PORT',
      'compose',
      'No component publishes a port, so nothing outside the app can reach it.',
    );
  }

  // ---- geolocation -----------------------------------------------------------------------------------
  const geo = spec.geolocation;
  if (geo.length > LIMITS.geolocation.maxCount) {
    add(
      'GEO_TOO_MANY',
      'geolocation',
      `There are ${geo.length} geolocation entries; the limit is ${LIMITS.geolocation.maxCount}.`,
    );
  }
  const parsedGeo = geo.map((g, i) => {
    const e = parseGeolocationEntry(g);
    const gp = `geolocation[${i}]`;
    if (g.length > LIMITS.geolocation.maxLength) {
      add(
        'GEO_TOO_LONG',
        gp,
        `The entry has ${g.length} characters; the limit is ${LIMITS.geolocation.maxLength}.`,
      );
    }
    if (e.problems.length) {
      add('GEO_SYNTAX', gp, `"${g}": ${e.problems.join('; ')}.`);
    }
    if (e.kind === 'legacy-continent' || e.kind === 'legacy-country') {
      add(
        'GEO_LEGACY',
        gp,
        `"${g}" is the old style; the current form is ${e.kind === 'legacy-continent' ? `ac${e.continent}` : `a country entry such as acEU_${e.country}`}.`,
      );
    }
    return e;
  });
  const allows = parsedGeo.filter((e) => e.kind.startsWith('allow-'));
  const denies = parsedGeo.filter((e) => e.kind.startsWith('deny-') && e.problems.length === 0);
  if (allows.length > 0 && denies.length > 0 && !allows.some((a) => a.kind === 'allow-all')) {
    const covered = (a: (typeof allows)[number]) =>
      denies.some((d) => {
        if (d.kind === 'deny-continent') return a.continent === d.continent;
        if (d.kind === 'deny-country')
          return a.country !== null && a.country === d.country && a.continent === d.continent;
        if (d.kind === 'deny-region') {
          return a.kind === 'allow-region' && a.country === d.country && a.region === d.region;
        }
        return false;
      });
    if (allows.every(covered)) {
      add(
        'GEO_CONFLICT',
        'geolocation',
        'Every place the app is allowed to run is also denied, so no node qualifies. Registration accepts it, but nothing is promised to run.',
      );
    }
  }
  if (
    parsedGeo.length > 0 &&
    allows.length > 0 &&
    allows.every((a) => a.kind === 'allow-country' || a.kind === 'allow-region') &&
    new Set(allows.map((a) => a.country)).size === 1 &&
    spec.instances >= 3
  ) {
    add(
      'GEO_ONE_REGION',
      'geolocation',
      `Every instance is limited to ${allows[0]?.country ?? 'one country'}.`,
    );
  }

  // ---- staticip, nodes, datacenter ---------------------------------------------------------------
  if (spec.staticip)
    add(
      'STATICIP_COST',
      'staticip',
      'A static IP adds a fee to the monthly bundle, which is divided by 3 and billed per instance, and limits which nodes can run the app.',
    );
  if (spec.nodes.length > LIMITS.nodes.maxCount) {
    add(
      'NODES_TOO_MANY',
      'nodes',
      `${spec.nodes.length} nodes are pinned; the limit is ${LIMITS.nodes.maxCount}.`,
    );
  }
  const seenNodes = new Set<string>();
  spec.nodes.forEach((n, i) => {
    const np = `nodes[${i}]`;
    if (n.length > LIMITS.nodes.maxLength) {
      add(
        'NODE_ENTRY_TOO_LONG',
        np,
        `The entry has ${n.length} characters; the limit is ${LIMITS.nodes.maxLength}.`,
      );
    } else if (!NODE_OUTPOINT.test(n) && !NODE_ADDRESS.test(n)) {
      add('NODES_FORMAT', np, `"${n}" is neither a txhash:index outpoint nor an ip:port address.`);
    }
    if (seenNodes.has(n)) add('NODES_DUPLICATE', np, `"${n}" is listed more than once.`);
    seenNodes.add(n);
  });
  if (spec.nodes.length > 0) {
    if (!enterprise) {
      add('NODES_NEED_ENTERPRISE', 'nodes', 'The app pins nodes but is not an enterprise app.');
    }
    add(
      'NODES_OWNER_PRIVILEGE',
      'nodes',
      "Pinning to nodes is only accepted from owners on the network's enterprise list.",
    );
  }
  if (spec.datacenter === true) {
    add(
      'DATACENTER_PRIVILEGE',
      'datacenter',
      'datacenter is true, which only owners on the enterprise list may set.',
    );
  }

  // ---- expire ----------------------------------------------------------------------------------------
  const ex = spec.expire;
  if (!isInt(ex)) {
    add('EXPIRE_FRACTIONAL', 'expire', `expire is ${fmt(ex)}, which is not a whole number of blocks.`, {
      suggestion: Math.max(1, Math.round(ex)),
    });
  } else if (ex < LIMITS.expire.min) {
    add('EXPIRE_LOW', 'expire', `expire is ${ex}; the minimum is ${LIMITS.expire.min} block.`, {
      suggestion: BLOCKS_PER_MONTH,
    });
  } else if (ex > LIMITS.expire.max) {
    add('EXPIRE_HIGH', 'expire', `expire is ${ex}; the maximum is ${LIMITS.expire.max} blocks.`, {
      suggestion: LIMITS.expire.max,
    });
  } else if (ex === 1) {
    add('EXPIRE_ONE_BLOCK', 'expire', 'expire is 1 block, which cancels the app.', {
      suggestion: BLOCKS_PER_MONTH,
    });
  } else if (ex < 20160) {
    add('EXPIRE_SHORT', 'expire', `expire is ${ex} blocks, less than a week.`, {
      suggestion: BLOCKS_PER_MONTH,
    });
  }

  // ---- contacts ---------------------------------------------------------------------------------------
  if (spec.contacts.length > LIMITS.contacts.maxCount) {
    add(
      'CONTACTS_TOO_MANY',
      'contacts',
      `There are ${spec.contacts.length} contacts; the limit is ${LIMITS.contacts.maxCount}.`,
    );
  }
  spec.contacts.forEach((c, i) => {
    if (c.length > LIMITS.contacts.maxLength) {
      add(
        'CONTACT_TOO_LONG',
        `contacts[${i}]`,
        `The contact has ${c.length} characters; the limit is ${LIMITS.contacts.maxLength}.`,
      );
    }
  });
  if (spec.contacts.length > 0 && !enterprise) {
    add('CONTACTS_PUBLIC', 'contacts', 'The contacts are published with the spec for anyone to read.');
  }

  // ---- enterprise --------------------------------------------------------------------------------------
  if (enterprise) {
    if (spec.enterprise.length < 300 || !/^[A-Za-z0-9+/=\s]+$/.test(spec.enterprise)) {
      add(
        'ENTERPRISE_BLOB_FORMAT',
        'enterprise',
        'The enterprise value is too short or not base64, so it is not an encrypted blob.',
      );
    }
    add('ENTERPRISE_AMD64', 'enterprise', 'Every image of an enterprise app needs a linux/amd64 build.');
  }

  // ---- teaching --------------------------------------------------------------------------------------
  if (ctx.teaching && compose.length > 0) {
    add(
      'HEALTH_NOT_CHECKED',
      'compose',
      'Flux restarts a container that exits but does not read Docker health checks.',
    );
  }
}

function lintComponent(
  c: FluxComponentSpec,
  ci: number,
  p: string,
  spec: FluxAppSpec,
  ctx: LintContext,
  add: Add,
  seenNames: Map<string, number>,
  publicPorts: Map<number, string>,
): void {
  const enterprise = Boolean(spec.enterprise);

  // name
  if (c.name.length === 0) {
    add('COMPONENT_NAME_MISSING', `${p}.name`, 'The component has no name.');
  } else {
    if (c.name.length > LIMITS.component.nameMaxLength) {
      add(
        'COMPONENT_NAME_TOO_LONG',
        `${p}.name`,
        `The name has ${c.name.length} characters; the limit is ${LIMITS.component.nameMaxLength}.`,
      );
    }
    if (!LIMITS.component.namePattern.test(c.name)) {
      add(
        'COMPONENT_NAME_FORMAT',
        `${p}.name`,
        c.name.includes('-')
          ? `The component name "${c.name}" has a hyphen; component names allow letters and digits only.`
          : `The component name "${c.name}" has characters that are not allowed.`,
        { suggestion: sanitiseComponentName(c.name) },
      );
    }
    if (LIMITS.component.reservedPrefixes.some((x) => c.name.startsWith(x))) {
      add(
        'COMPONENT_NAME_RESERVED',
        `${p}.name`,
        'The component name starts with a reserved prefix (zel or flux).',
      );
    }
    if (seenNames.has(c.name)) {
      add(
        'COMPONENT_NAME_DUPLICATE',
        `${p}.name`,
        `The name "${c.name}" is already used by component ${seenNames.get(c.name)}.`,
      );
    } else {
      seenNames.set(c.name, ci);
    }
  }
  if (c.description.length > LIMITS.descriptionMaxLength) {
    add(
      'COMPONENT_DESCRIPTION_TOO_LONG',
      `${p}.description`,
      `The description has ${c.description.length} characters; the limit is ${LIMITS.descriptionMaxLength}.`,
    );
  }

  // image
  const tag = c.repotag;
  const parsed = parseRepotag(tag);
  if (tag.length === 0) {
    add('REPOTAG_EMPTY', `${p}.repotag`, 'The image is empty.');
  } else {
    if (tag.length > LIMITS.repotag.maxLength) {
      add(
        'REPOTAG_TOO_LONG',
        `${p}.repotag`,
        `The image has ${tag.length} characters; the limit is ${LIMITS.repotag.maxLength}.`,
      );
    }
    const upper = parsed.problems.filter((x) => x.includes('lowercase'));
    const other = parsed.problems.filter((x) => !x.includes('lowercase'));
    if (other.length) add('REPOTAG_FORMAT', `${p}.repotag`, `"${tag}": ${other.join('; ')}.`);
    if (upper.length)
      add('IMAGE_UPPERCASE', `${p}.repotag`, `"${tag}" has capital letters.`, {
        suggestion: tag.toLowerCase(),
      });
    if (other.length === 0 && parsed.repository) {
      if (parsed.tag === null && parsed.digest === null) {
        add('IMAGE_UNTAGGED', `${p}.repotag`, `"${tag}" has no tag.`, { suggestion: `${tag}:latest` });
      } else if (parsed.tag === 'latest') {
        add('IMAGE_LATEST', `${p}.repotag`, `"${tag}" uses the latest tag.`);
      }
      if (parsed.registry === 'docker.io' || parsed.registry === 'index.docker.io') {
        add('IMAGE_DOCKER_IO_HOST', `${p}.repotag`, `"${tag}" starts with ${parsed.registry}.`, {
          suggestion: tag.slice(parsed.registry.length + 1),
        });
      }
      if (ctx.teaching && parsed.registry === null && parsed.namespace !== null) {
        add(
          'IMAGE_IMPLICIT_REGISTRY',
          `${p}.repotag`,
          `"${tag}" has no registry host, so it comes from Docker Hub.`,
        );
      }
      const repo = parsed.repository
        ? parsed.namespace
          ? `${parsed.namespace}/${parsed.repository}`
          : parsed.repository
        : '';
      const heavy = HEAVY_IMAGE_PATTERNS.find((h) => h.match.test(repo.toLowerCase()));
      if (heavy)
        add(
          'IMAGE_MAYBE_HUGE',
          `${p}.repotag`,
          `${heavy.label} images are often larger than the 5 GB limit.`,
        );
    }
  }

  // repoauth
  if (c.repoauth.length > 0) {
    if (!enterprise) {
      add(
        'REPOAUTH_NEEDS_ENTERPRISE',
        `${p}.repoauth`,
        'Registry credentials are set but the app is not enterprise.',
      );
    }
    if (c.repoauth.length > LIMITS.repoauth.maxLength) {
      add(
        'REPOAUTH_TOO_LONG',
        `${p}.repoauth`,
        `repoauth has ${c.repoauth.length} characters; the limit is ${LIMITS.repoauth.maxLength}.`,
      );
    }
    if (/^(aws|azure|google):\/\//.test(c.repoauth)) {
      // These look like username:token to the shape check below, so they need their own rule.
      add(
        'REPOAUTH_FORMAT',
        `${p}.repoauth`,
        'repoauth uses a short provider name (aws://, azure://, google://). FluxOS v8.20.0 registers only aws-ecr://, azure-acr:// and google-gar:// and answers "Unknown provider type" for the others.',
      );
    } else if (!/^[^:\s]+:.+/.test(c.repoauth) && !/^(aws-ecr|azure-acr|google-gar):\/\//.test(c.repoauth)) {
      add(
        'REPOAUTH_FORMAT',
        `${p}.repoauth`,
        'repoauth is neither username:token nor a provider URI in a documented form (aws-ecr://, azure-acr://, google-gar://).',
      );
    }
  }

  // resources
  (['cpu', 'ram', 'hdd'] as const).forEach((k) => {
    const v = c[k];
    const path = `${p}.${k}`;
    if (v <= 0) {
      add('RESOURCE_NOT_POSITIVE', path, `${k} is ${fmt(v)}.`, {
        suggestion: k === 'cpu' ? 0.1 : k === 'ram' ? 100 : 1,
      });
      return;
    }
    const decimals = (String(v).split('.')[1] ?? '').length;
    if (decimals > 8) {
      add('RESOURCE_DECIMALS', path, `${k} has ${decimals} decimal places; the limit is 8.`);
      return;
    }
    if (k === 'cpu' && Math.abs(v * 10 - Math.round(v * 10)) > 1e-9) {
      add('CPU_STEP', path, `cpu is ${fmt(v)}, which is not a multiple of 0.1.`, {
        suggestion: Math.max(0.1, Math.round(v * 10) / 10),
      });
    }
    if (k === 'ram' && Math.abs(v / 100 - Math.round(v / 100)) > 1e-9) {
      add('RAM_STEP', path, `ram is ${fmt(v)} MB, which is not a multiple of 100.`, {
        suggestion: Math.max(100, Math.round(v / 100) * 100),
      });
    }
    if (k === 'hdd' && !Number.isInteger(v)) {
      add('HDD_STEP', path, `hdd is ${fmt(v)} GB, which is not a whole number.`, {
        suggestion: Math.max(1, Math.ceil(v)),
      });
    }
  });

  const known = knownImage(c.repotag);
  if (known && c.ram > 0 && c.ram < known.minRamMb) {
    add(
      'RAM_TOO_SMALL_FOR_IMAGE',
      `${p}.ram`,
      `${known.label} usually needs at least ${known.minRamMb} MB and this component has ${fmt(c.ram)} MB.`,
      {
        // The next size the network accepts: ram comes in steps of 100 MB (RAM_STEP), so 512 becomes 600.
        suggestion: Math.ceil(known.minRamMb / 100) * 100,
      },
    );
  }
  if (known && known.kind === 'database' && c.hdd > 0 && c.hdd < 5) {
    add('DISK_SMALL_STATEFUL', `${p}.hdd`, `${known.label} has only ${fmt(c.hdd)} GB of disk.`, {
      suggestion: 5,
    });
  }

  // ports
  if (c.ports.length > LIMITS.ports.perComponentMax) {
    add(
      'PORTS_TOO_MANY',
      `${p}.ports`,
      `The component publishes ${c.ports.length} ports; the limit is ${LIMITS.ports.perComponentMax}.`,
    );
  }
  c.ports.forEach((port, i) => {
    const pp = `${p}.ports[${i}]`;
    if (!isInt(port)) {
      add('PORT_NOT_INTEGER', pp, `${fmt(port)} is not a whole number.`);
      return;
    }
    if (port < LIMITS.ports.min || port > LIMITS.ports.max) {
      add('PORT_RANGE', pp, `${port} is outside ${LIMITS.ports.min} to ${LIMITS.ports.max}.`);
      return;
    }
    if (isBannedPort(port)) add('PORT_BANNED', pp, `Public port ${port} is on the banned list.`);
    if (isSurchargePort(port))
      add(
        'PORT_FEE',
        pp,
        `Public port ${port} is a fee port. Its fee goes into the monthly bundle, which is divided by 3 and billed per instance, so it grows with the instance count.`,
        {
          suggestion: port < 1024 ? port + 31000 : port + 1000,
        },
      );
    const prev = publicPorts.get(port);
    if (prev !== undefined) add('PORT_DUPLICATE', pp, `Public port ${port} is already used by ${prev}.`);
    else publicPorts.set(port, pp);
  });
  c.containerPorts.forEach((port, i) => {
    const pp = `${p}.containerPorts[${i}]`;
    if (!isInt(port)) add('PORT_NOT_INTEGER', pp, `${fmt(port)} is not a whole number.`);
    else if (port < LIMITS.ports.containerMin || port > LIMITS.ports.containerMax) {
      add(
        'CONTAINER_PORT_RANGE',
        pp,
        `${port} is outside ${LIMITS.ports.containerMin} to ${LIMITS.ports.containerMax}.`,
      );
    } else if (ctx.teaching && port > 0 && port < LIMITS.ports.privilegedBelow) {
      add('PORT_PRIVILEGED_CONTAINER', pp, `The container listens on port ${port}, below 1024.`);
    }
  });
  if (c.containerPorts.length !== c.ports.length) {
    add(
      'PORT_LENGTH_MISMATCH',
      `${p}.containerPorts`,
      `ports has ${c.ports.length} entries and containerPorts has ${c.containerPorts.length}.`,
      { suggestion: c.ports.map((x, i) => c.containerPorts[i] ?? x) },
    );
  }
  if (c.domains.length !== c.ports.length) {
    add(
      'DOMAINS_LENGTH_MISMATCH',
      `${p}.domains`,
      `ports has ${c.ports.length} entries and domains has ${c.domains.length}.`,
      {
        suggestion: c.ports.map((_, i) => c.domains[i] ?? ''),
      },
    );
  }

  // database ports exposed
  c.ports.forEach((_, i) => {
    const cp = c.containerPorts[i];
    if (cp !== undefined && DATABASE_PORTS.includes(cp)) {
      add(
        'DATABASE_PORT_PUBLIC',
        `${p}.ports[${i}]`,
        `Container port ${cp} is a database port and it is published publicly.`,
      );
    }
  });

  // domains
  c.domains.forEach((d, i) => {
    const dp = `${p}.domains[${i}]`;
    if (d.length > LIMITS.domains.maxLength) {
      add(
        'DOMAIN_TOO_LONG',
        dp,
        `The domain has ${d.length} characters; the limit is ${LIMITS.domains.maxLength}.`,
      );
      return;
    }
    for (const part of d.split(',')) {
      const host = part.trim().replace(/^https?:\/\//i, '');
      if (!host) continue;
      if (!HOSTNAME.test(host)) {
        add('DOMAIN_FORMAT', dp, `"${host}" does not look like a host name.`);
        continue;
      }
      const lower = host.toLowerCase();
      if (lower.endsWith('.app.runonflux.io') || lower.endsWith('.app2.runonflux.io')) {
        add('DOMAIN_IS_GENERATED', dp, `"${host}" is a Flux generated address.`);
        continue;
      }
      const labels = lower.split('.');
      if (
        labels.length === 2 ||
        (labels.length === 3 && SECOND_LEVEL.includes(labels[1] ?? '') && (labels[2] ?? '').length === 2)
      ) {
        add(
          'DOMAIN_APEX',
          dp,
          `"${host}" is a bare domain, which needs an ALIAS, ANAME or A record instead of a CNAME.`,
        );
      }
    }
  });

  // environment
  if (c.environmentParameters.length > LIMITS.environment.maxCount) {
    add(
      'ENV_TOO_MANY',
      `${p}.environmentParameters`,
      `There are ${c.environmentParameters.length} variables; the limit is ${LIMITS.environment.maxCount}.`,
    );
  }
  let listenPort: number | null = null;
  c.environmentParameters.forEach((e, i) => {
    const ep = `${p}.environmentParameters[${i}]`;
    if (e.length > LIMITS.environment.maxLength) {
      add(
        'ENV_TOO_LONG',
        ep,
        `The entry has ${e.length} characters; the limit is ${LIMITS.environment.maxLength}.`,
      );
    }
    const kv = parseEnv(e);
    if (e.startsWith('F_S_ENV=') || e.startsWith('F_S_CMD=')) {
      const link = e.slice('F_S_ENV='.length);
      if (!isFluxStorageUrl(link)) {
        add('STORAGE_LINK_INVALID', ep, 'The storage link is not an https://storage.runonflux.io address.');
      }
      return;
    }
    if (!kv) {
      add('ENV_FORMAT', ep, `"${e.length > 40 ? `${e.slice(0, 40)}...` : e}" is not KEY=value.`);
      return;
    }
    if (/\s/.test(kv.key) || kv.key !== kv.key.trim() || kv.value !== kv.value.trim()) {
      const clean = `${kv.key.trim()}=${kv.value.trim()}`;
      add(
        'ENV_WHITESPACE',
        ep,
        `The entry has spaces around the name or value, so the variable is "${JSON.stringify(kv.key)}".`,
        {
          suggestion: clean,
        },
      );
    }
    const key = kv.key.trim();
    if (key === 'FLUX_APP_NAME' || key === 'FLUX_NODE_HOST_IP') {
      add('ENV_RESERVED_NAME', ep, `${key} is set by Flux and overrides your value.`);
    }
    if (!enterprise && SECRET_ENV_KEY.test(key) && !PLACEHOLDER_VALUE.test(kv.value.trim())) {
      add('ENV_SECRET_PUBLIC', ep, `${key} looks like a secret and this spec is public.`);
    }
    if (PORT_ENV_KEYS.test(key) && /^\d+$/.test(kv.value.trim())) listenPort = Number(kv.value.trim());
    if (BIND_ENV_KEYS.test(key) && LOOPBACK_VALUE.test(kv.value.trim())) {
      add(
        'BIND_LOCALHOST',
        ep,
        `${key} binds to ${kv.value.trim()}, which is not reachable from outside the container.`,
        {
          suggestion: `${key}=0.0.0.0`,
        },
      );
    }
  });
  if (listenPort !== null && c.containerPorts.length > 0 && !c.containerPorts.includes(listenPort)) {
    add(
      'PORT_ENV_MISMATCH',
      `${p}.containerPorts`,
      `The environment says the app listens on ${listenPort} but containerPorts is ${c.containerPorts.join(', ')}.`,
      { suggestion: c.containerPorts.map((_, i) => (i === 0 ? listenPort : c.containerPorts[i])) },
    );
  } else if (
    known &&
    known.defaultPort !== undefined &&
    listenPort === null &&
    c.containerPorts.length > 0 &&
    !c.containerPorts.includes(known.defaultPort) &&
    !c.containerPorts.some((x) => DATABASE_PORTS.includes(x))
  ) {
    add(
      'CONTAINER_PORT_UNUSUAL',
      `${p}.containerPorts`,
      `${known.label} listens on ${known.defaultPort} by default, not ${c.containerPorts.join(', ')}.`,
    );
  }

  // commands
  if (c.commands.length > LIMITS.commands.maxCount) {
    add(
      'COMMANDS_TOO_MANY',
      `${p}.commands`,
      `There are ${c.commands.length} entries; the limit is ${LIMITS.commands.maxCount}.`,
    );
  }
  c.commands.forEach((cmd, i) => {
    const cp = `${p}.commands[${i}]`;
    if (cmd.length > LIMITS.commands.maxLength) {
      add(
        'COMMAND_TOO_LONG',
        cp,
        `The entry has ${cmd.length} characters; the limit is ${LIMITS.commands.maxLength}.`,
      );
    }
    if (cmd === '--privileged')
      add('COMMAND_PRIVILEGED', cp, '--privileged is removed by Flux, so it has no effect.');
    if (cmd.startsWith('F_S_CMD=') || cmd.startsWith('F_S_ENV=')) {
      if (!isFluxStorageUrl(cmd.slice('F_S_CMD='.length))) {
        add('STORAGE_LINK_INVALID', cp, 'The storage link is not an https://storage.runonflux.io address.');
      }
    }
    if (i === 0 && /^\S+\s+\S/.test(cmd.trim()) && !/^["']/.test(cmd.trim())) {
      add(
        'COMMAND_UNSPLIT',
        cp,
        `"${cmd.length > 50 ? `${cmd.slice(0, 50)}...` : cmd}" is one entry with spaces, so it stays one argument.`,
        {
          suggestion: cmd.trim().split(/\s+/),
        },
      );
    }
    const prev = c.commands[i - 1] ?? '';
    if (
      /(^|=|\s)(127\.0\.0\.1|localhost)(:\d+)?$/.test(cmd) &&
      (/^--?(host|bind|address|listen|hostname)/i.test(prev) ||
        /^--?(host|bind|address|listen|hostname)/i.test(cmd))
    ) {
      add('BIND_LOCALHOST', cp, 'The command binds the app to the loopback address.');
    }
  });

  // containerData
  const cd = c.containerData;
  if (cd.length < LIMITS.containerData.minLength) {
    add('CONTAINER_DATA_TOO_SHORT', `${p}.containerData`, 'containerData is empty or one character.', {
      suggestion: '/tmp',
    });
  } else {
    if (cd.length > LIMITS.containerData.maxLength) {
      add(
        'CONTAINER_DATA_TOO_LONG',
        `${p}.containerData`,
        `containerData has ${cd.length} characters; the limit is ${LIMITS.containerData.maxLength}.`,
      );
    }
    const pd = parseContainerData(cd);
    if (pd.errors.length) {
      add(
        'CONTAINER_DATA_SYNTAX',
        `${p}.containerData`,
        `${pd.errors[0]}${pd.errors.length > 1 ? ` (and ${pd.errors.length - 1} more)` : ''}.`,
      );
    }
    for (const m of pd.mounts) {
      if (m.component !== null) {
        if (m.component < 0 || m.component >= spec.compose.length) {
          add(
            'CONTAINER_DATA_COMPONENT_REF',
            `${p}.containerData`,
            `"${m.raw}" refers to component ${m.component}, which does not exist.`,
          );
        } else if (m.component >= ci) {
          add(
            'CONTAINER_DATA_COMPONENT_REF',
            `${p}.containerData`,
            `"${m.raw}" refers to component ${m.component}, which is not earlier in the list than this one.`,
          );
        }
      }
    }
    const flags = pd.mounts[0]?.flags ?? [];
    if (flags.length > 1 || (flags.length === 1 && flags[0] === 's')) {
      add(
        'CONTAINER_DATA_SYNC_FLAGS',
        `${p}.containerData`,
        flags.length > 1
          ? `The flags "${flags.join('')}" are combined.`
          : 's: has no documented behaviour of its own.',
      );
    }
    if (known?.stateful && known.dataPaths.length > 0 && pd.mounts.length > 0) {
      const hasData = pd.mounts.some((m) => m.component === null && known.dataPaths.includes(m.path));
      if (!hasData) {
        const flagPrefix = flags.length ? `${flags.join('')}:` : '';
        add(
          'STATEFUL_NO_VOLUME',
          `${p}.containerData`,
          `${known.label} keeps its data in ${known.dataPaths[0]}, which is not mounted.`,
          { suggestion: `${flagPrefix}${known.dataPaths[0]}` },
        );
      }
    }
    if (known?.stateful && pd.syncMode === null && pd.mounts.length > 0) {
      add(
        'STATEFUL_NOT_SYNCED',
        `${p}.containerData`,
        `${known.label} data is on a plain volume that lives on one node.`,
        {
          suggestion: known.singleWriterDb ? `g:${known.dataPaths[0] ?? '/data'}` : undefined,
        },
      );
    }
    if (known?.singleWriterDb && pd.syncMode === 'r') {
      add(
        'DB_ON_REPLICATED_MOUNT',
        `${p}.containerData`,
        `${known.label} is on an r: mount, where every instance writes.`,
        {
          suggestion: cd.replace(/^r:/, 'g:'),
        },
      );
    }
    if (pd.syncMode !== null && spec.instances === 1) {
      add(
        'SYNC_SINGLE_INSTANCE',
        `${p}.containerData`,
        `The ${pd.syncMode}: volume has no second instance to copy to.`,
      );
    }
  }
  if (known && known.kind === 'database' && spec.instances === 1 && known.stateful) {
    add('STATEFUL_SINGLE_INSTANCE', `${p}.repotag`, `${known.label} runs as a single instance.`);
  }
}
