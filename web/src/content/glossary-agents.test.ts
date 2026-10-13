/**
 * Pins the glossary entries about AI agents, MCP and Git deploys to the engine they describe.
 *
 * `glossary/agents.ts` imports nothing from `@shared/flux` at run time. The glossary is statically imported by
 * almost every route, and the agents and orbit catalogues are not tree-shaken, so importing them there would
 * carry about 26 KB of data into all of those routes. What the entries say about the engine is therefore typed
 * as plain text in that file, and this file is what stops the text from drifting: every tool name, the tools
 * that carry a `confirm` argument, the kinds of tool call, the Deploy to Flux button's URL parameters, the
 * plan ids and the webhook port are compared with `MCP_TOOLS`, `hasConfirmArg`, `riskLabel`,
 * `deployToFluxUrl`, `ORBIT_PLAN_IDS` and `ORBIT_WEBHOOK_PORT`. The checks read the text a learner sees (the
 * `short` and `why` of each entry, through the markup parser), not the internals of the module.
 *
 * A second group guards the bundle itself: no glossary file may import the `@shared/flux` barrel, `agents` or
 * `orbit` at run time.
 *
 * Why this file is not in `content/glossary/`: `learn/glossary.ts` builds the registry with
 * `import.meta.glob('../content/glossary/*.ts')`, which would bundle a `.test.ts` placed there into the app
 * (and run it inside every test file that imports the registry). Lesson tests sit one level up for the same
 * reason, for example `agents-and-mcp.test.ts`.
 *
 * The generic glossary rules (ids, word limits, references) are `content.test.ts`; this file is only what is
 * specific to these entries and cheap to break by editing the catalogue.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasConfirmArg,
  MCP_SERVER_IDS,
  MCP_SERVERS,
  type McpServerId,
  riskLabel,
  TOOL_RISK_ORDER,
  toolByName,
  toolsOf,
} from '@shared/flux/agents';
import {
  deployToFluxUrl,
  ORBIT_BUILD_VARIABLES,
  ORBIT_CUSTOM,
  ORBIT_IMAGE,
  ORBIT_PLAN_IDS,
  ORBIT_PLANS,
  ORBIT_WEBHOOK_PORT,
  OrbitUrlError,
} from '@shared/flux/orbit';
import { describe, expect, it } from 'vitest';
import { parseMarkup, walkMarkup } from '@/learn/markup';
import type { GlossaryTerm } from '@/learn/types';
import agentsTerms from './glossary/agents';
import opsTerms from './glossary/ops';

const GLOSSARY_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'glossary');

/** The entries in `glossary/agents.ts`, and `flux-orbit` from `glossary/ops.ts`, which states plan facts. */
const byId = new Map<string, GlossaryTerm>([...agentsTerms, ...opsTerms].map((t) => [t.id, t]));

function term(id: string): GlossaryTerm {
  const found = byId.get(id);
  if (!found) throw new Error(`no glossary term "${id}" in glossary/agents.ts or glossary/ops.ts`);
  return found;
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(what);
  return value;
}

/** Every code span of a markup string, in order. */
function codeSpans(markup: string): string[] {
  const spans: string[] = [];
  walkMarkup(parseMarkup(markup).nodes, (n) => {
    if (n.type === 'code') spans.push(n.text);
  });
  return spans;
}

/** Every code span in the short definition and the "why" of the given entries. */
const spansOf = (list: readonly GlossaryTerm[]): string[] =>
  list.flatMap((t) => [...codeSpans(t.short), ...codeSpans(t.why)]);

const code = (s: string): string => `\`${s}\``;
const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

describe('glossary entries on agents, MCP and Git deploys, against the engine', () => {
  it('names only tools that exist, on the server the name belongs to', () => {
    // A code span that is one snake_case word is a tool name. A `flux_` name is a FluxCloud tool and only
    // that; any other is an Orbit tool. The two servers are never blurred.
    const toolLike = [
      ...new Set(spansOf(agentsTerms).filter((s) => /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(s))),
    ];
    expect(toolLike.length, 'no tool names were found, so the extraction is broken').toBeGreaterThan(0);
    const unknown: string[] = [];
    for (const name of toolLike) {
      const server: McpServerId = name.startsWith('flux_') ? 'flux-cloud' : 'orbit';
      if (!toolByName(server, name)) unknown.push(`${name} is not a tool of the ${server} MCP server`);
    }
    expect(unknown).toEqual([]);
  });

  it('puts the confirm gate on the two tools that carry a confirm argument, and not on flux_control_app', () => {
    const gate = term('confirm-gate');
    const fluxTools = (markup: string): string[] => codeSpans(markup).filter((s) => s.startsWith('flux_'));
    const gated = fluxTools(gate.short);
    const ungated = fluxTools(gate.why);
    expect(gated).toEqual(['flux_deploy_app', 'flux_cancel_app']);
    expect(ungated).toEqual(['flux_control_app']);
    for (const name of gated) {
      const tool = must(toolByName('flux-cloud', name), `${name} is not a FluxCloud MCP tool`);
      expect(hasConfirmArg(tool), `${name} should carry a confirm argument`).toBe(true);
    }
    for (const name of ungated) {
      const tool = must(toolByName('flux-cloud', name), `${name} is not a FluxCloud MCP tool`);
      expect(hasConfirmArg(tool), `${name} should have no confirm argument`).toBe(false);
      expect(tool.risk, `${name} is the call that can delete data and has no gate of its own`).toBe(
        'destroys',
      );
    }
    // "Both tools" is complete: the engine has no third FluxCloud tool with a confirm argument.
    const carriers = toolsOf('flux-cloud')
      .filter((t) => hasConfirmArg(t))
      .map((t) => t.name);
    expect([...carriers].sort()).toEqual([...gated].sort());
  });

  it('lists the kinds of tool call the way the engine words them', () => {
    const kinds = TOOL_RISK_ORDER.map((risk) => lowerFirst(riskLabel(risk)));
    const last = kinds.at(-1) ?? '';
    const sentence = `${kinds.slice(0, -1).join(', ')} or ${last}`;
    expect(term('tool-call').why).toContain(`a call ${sentence}.`);
  });

  it('writes the Deploy to Flux parameters and plan values as the URL builder does', () => {
    const params = [
      ...new URL(
        deployToFluxUrl({
          repo: 'https://github.com/owner/repository',
          branch: 'main',
          projectPath: 'apps/web',
          plan: ORBIT_PLAN_IDS[0] ?? 'starter',
        }),
      ).searchParams.keys(),
    ];
    const button = term('deploy-button');
    expect(codeSpans(button.short)).toEqual(params);

    // `repo` is the only required parameter, and `plan` takes the plan ids.
    expect(() => deployToFluxUrl({ repo: 'https://github.com/owner/repository' })).not.toThrow();
    expect(() => deployToFluxUrl({} as never)).toThrow(OrbitUrlError);
    expect(params).toContain('repo');
    expect(params).toContain('plan');
    expect(codeSpans(button.why)).toEqual(['repo', 'plan', ...ORBIT_PLAN_IDS]);

    // The monorepo entry names the build variable and the button's parameter for the same thing.
    const monorepo = term('monorepo');
    const projectPath = must(
      params.find((p) => p.toLowerCase() === 'projectpath'),
      'the URL builder has no project path parameter',
    );
    expect(codeSpans(monorepo.short)).toEqual(['PROJECT_PATH', projectPath]);
    expect(monorepo.aka).toContain(projectPath);
    expect(ORBIT_BUILD_VARIABLES.map((v) => v.name)).toContain('PROJECT_PATH');
  });

  it('writes only build variables that exist', () => {
    const known = new Set(ORBIT_BUILD_VARIABLES.map((v) => v.name));
    const named = spansOf([...agentsTerms, term('flux-orbit')]).filter((s) =>
      /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(s),
    );
    expect(named.length, 'no build variables were found, so the extraction is broken').toBeGreaterThan(0);
    expect(named.filter((s) => !known.has(s))).toEqual([]);
  });

  it('states the webhook port the engine has', () => {
    expect(term('webhook').why).toContain(`(${ORBIT_WEBHOOK_PORT} by default)`);
  });

  it('describes the two servers as the engine does', () => {
    const cloud = MCP_SERVERS['flux-cloud'];
    const orbit = MCP_SERVERS.orbit;
    const server = term('mcp-server');
    // "Flux has two": the FluxCloud server and the Orbit server, by the engine's names.
    expect(MCP_SERVER_IDS).toHaveLength(2);
    expect(server.short).toContain(cloud.name);
    expect(server.short).toContain(orbit.name);
    // The npm package of the FluxCloud server.
    expect(cloud.package).not.toBeNull();
    expect(codeSpans(server.why)).toContain(cloud.package);
    expect(server.aka).toContain(cloud.package);
    // "Works with two keys and can pay in FLUX" against "works with your signed-in Orbit account and sends you
    // to a Stripe checkout".
    expect(cloud.kind).toBe('keys');
    expect(toolsOf('flux-cloud').some((t) => t.spends === 'with-confirm')).toBe(true);
    expect(orbit.kind).toBe('account');
    expect(toolsOf('orbit').some((t) => t.spends === 'via-checkout')).toBe(true);
    expect(toolByName('orbit', 'create_stripe_checkout')).toBeDefined();
  });

  it('gives Orbit the plans and the image the engine has, and states no price', () => {
    const orbitEntry = term('flux-orbit');
    // "Starter (one instance), Standard and Pro (two each), and Custom": the instance counts are the engine's,
    // and there is no Free plan.
    const plan = (id: string) =>
      must(
        ORBIT_PLANS.find((p) => p.id === id),
        `no ${id} plan in ORBIT_PLANS`,
      );
    const [starter, standard, pro] = [plan('starter'), plan('standard'), plan('pro')];
    const words = (n: number): string => must(['zero', 'one', 'two', 'three', 'four'][n], `no word for ${n}`);
    expect(standard.instances, 'the entry says "Standard and Pro (two each)"').toBe(pro.instances);
    expect(orbitEntry.why).toContain(`${starter.name} (${words(starter.instances)} instance)`);
    expect(orbitEntry.why).toContain(`${standard.name} and ${pro.name} (${words(standard.instances)} each)`);
    expect(orbitEntry.why).toContain(`and ${ORBIT_CUSTOM.name}.`);
    expect(ORBIT_PLANS.map((p) => p.id)).toEqual(['starter', 'standard', 'pro']);
    expect(ORBIT_PLAN_IDS).not.toContain('free');
    expect(orbitEntry.short).toContain(code(ORBIT_IMAGE));

    // Prices live in the plan data and on the reference page, never in the glossary.
    const prices = ORBIT_PLANS.map((p) => String(p.usd));
    for (const t of [...agentsTerms, orbitEntry]) {
      for (const text of [t.short, t.why]) {
        expect(text, `${t.id} should state no price`).not.toMatch(/\$\s?\d|USD\s?\d/);
        for (const price of prices) expect(text, `${t.id} should not repeat ${price}`).not.toContain(price);
      }
    }
  });
});

/**
 * The module specifiers a source file imports at run time: every `import` that is not `import type`. (An
 * `import { type A } from 'x'` still counts, because with `verbatimModuleSyntax` it leaves an import of `x`.)
 */
function runtimeImports(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/^import\s+(type\s+)?[^;]*?\s+from\s+['"]([^'"]+)['"]\s*;/gm)) {
    if (m[1] === undefined && m[2] !== undefined) found.push(m[2]);
  }
  return found;
}

/**
 * The `@shared/flux` barrel (it re-exports every catalogue), its `index`, and the `agents` and `orbit` modules,
 * by alias or by a relative path, with or without `.ts`.
 */
function isHeavy(specifier: string): boolean {
  return /(?:^|\/)@?shared\/flux(?:\/(?:index|agents|orbit))?$/.test(specifier.replace(/\.ts$/, ''));
}

describe('glossary files and the shared engine barrel', () => {
  it('finds a run-time import and ignores a type import (the scanner itself)', () => {
    const source = [
      "import type { GlossaryTerm } from '@/learn/types';",
      "import { BLOCKS_PER_MONTH, TARGET_BLOCK_SEC } from '@shared/flux/blocks';",
      'import {',
      '  deployToFluxUrl,',
      '  ORBIT_PLAN_IDS,',
      "} from '@shared/flux';",
      "import { riskLabel } from '../../../shared/flux/agents.ts';",
      "import './glossary.css';",
    ].join('\n');
    expect(runtimeImports(source)).toEqual([
      '@shared/flux/blocks',
      '@shared/flux',
      '../../../shared/flux/agents.ts',
    ]);
    expect(runtimeImports(source).filter(isHeavy)).toEqual([
      '@shared/flux',
      '../../../shared/flux/agents.ts',
    ]);
    for (const light of ['blocks', 'pricing', 'spec', 'tiers', 'timing']) {
      expect(isHeavy(`@shared/flux/${light}`), light).toBe(false);
    }
    for (const heavy of [
      '@shared/flux',
      '@shared/flux/index',
      '@shared/flux/agents',
      '@shared/flux/orbit.ts',
    ]) {
      expect(isHeavy(heavy), heavy).toBe(true);
    }
  });

  const files = readdirSync(GLOSSARY_DIR)
    .filter((f) => f.endsWith('.ts') && !/\.test\.tsx?$/.test(f))
    .sort();

  it('finds the glossary files and the per-module imports of core.ts (so the scan is not vacuous)', () => {
    expect(files).toEqual(expect.arrayContaining(['agents.ts', 'core.ts', 'ops.ts', 'extra-nimbus.ts']));
    const core = runtimeImports(readFileSync(join(GLOSSARY_DIR, 'core.ts'), 'utf8'));
    expect(core).toEqual(expect.arrayContaining(['@shared/flux/blocks', '@shared/flux/pricing']));
  });

  it.each(files)('%s imports no catalogue of the shared engine at run time', (file) => {
    const heavy = runtimeImports(readFileSync(join(GLOSSARY_DIR, file), 'utf8')).filter(isHeavy);
    expect(
      heavy,
      `${file} imports ${heavy.join(', ')}. Import the module you need (for example '@shared/flux/pricing') ` +
        'instead: the barrel carries the agents and orbit catalogues into the glossary chunk, which almost ' +
        'every route loads. Keep what an entry says about the engine as text and check it in this file.',
    ).toEqual([]);
  });
});
