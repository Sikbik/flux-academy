/**
 * Pins the lesson `agents-and-mcp` to the engine it teaches from: every tool name it writes exists in
 * `MCP_TOOLS`, the tool sort is graded against the engine's own risk labels, the price in the estimate's
 * explanation is the one `quote()` gives at the baked rate card, the sessions use only the scenarios and
 * policies the `agent-session` widget documents, the gate table of step 5 is what the widget's policy engine
 * does, and the copy keeps clear of release-stage wording.
 *
 * The generic rules (shape, ids, markup, references) are `content.test.ts`; this file is only what is
 * specific to this lesson and cheap to break by editing the catalogue.
 */

import { MCP_TOOLS, toolByName, toolRiskLabel, toolsByRisk, toolsOf } from '@shared/flux';
import * as blocksMod from '@shared/flux/blocks';
import * as lintMod from '@shared/flux/lint';
import * as pricingMod from '@shared/flux/pricing';
import * as specMod from '@shared/flux/spec';
import { describe, expect, it } from 'vitest';
import { buildEngine } from '@/learn/engine';
import { estimateTruth } from '@/learn/grade';
import { parseMarkup, walkMarkup } from '@/learn/markup';
import type { Lesson } from '@/learn/types';
import { collectProse } from '@/learn/validate-text';
import { asks } from '@/learn/widgets/agent-session/engine/policy.ts';
import lessonModule from './lessons/agents-and-mcp';

const lesson: Lesson = lessonModule;

const engine = buildEngine({
  spec: specMod as unknown as Record<string, unknown>,
  pricing: pricingMod as unknown as Record<string, unknown>,
  blocks: blocksMod as unknown as Record<string, unknown>,
  lint: lintMod as unknown as Record<string, unknown>,
  catalogue: lintMod as unknown as Record<string, unknown>,
});

/** Every code span in the lesson's prose that is a single snake_case word, as a tool name would be. */
function toolLikeSpans(): string[] {
  const found = new Set<string>();
  for (const item of collectProse(lesson)) {
    walkMarkup(parseMarkup(item.text).nodes, (n) => {
      if (n.type === 'code' && /^[a-z]+(?:_[a-z]+)+$/.test(n.text)) found.add(n.text);
    });
  }
  return [...found].sort();
}

describe('agents-and-mcp, against the engine', () => {
  it('writes only tool names that exist in MCP_TOOLS', () => {
    const flux = new Set(toolsOf('flux-cloud').map((t) => t.name));
    const orbit = new Set(toolsOf('orbit').map((t) => t.name));
    const spans = toolLikeSpans();
    expect(spans.length).toBeGreaterThan(5);
    const unknown = spans.filter((s) => !flux.has(s) && !orbit.has(s));
    expect(unknown).toEqual([]);
    // A `flux_` name is a FluxCloud tool, and only a FluxCloud tool: the two servers are never blurred.
    const orbitWithFluxPrefix = spans.filter((s) => s.startsWith('flux_') && !flux.has(s));
    expect(orbitWithFluxPrefix).toEqual([]);
    // Both catalogues are the size the lesson says they are, and the engine has not lost a tool.
    expect(MCP_TOOLS.length).toBe(flux.size + orbit.size);
  });

  it('grades the tool sort against toolRiskLabel, with five distinct classes', () => {
    const sort = lesson.checkpoint.find((c) => c.id === 'sort-tools');
    expect(sort?.kind).toBe('match');
    if (sort?.kind !== 'match') return;
    expect(sort.pairs).toHaveLength(5);
    const rights = new Set<string>();
    for (const pair of sort.pairs) {
      const name = /`([a-z_]+)`/.exec(pair.left)?.[1] ?? '';
      const server = pair.left.includes('Orbit') ? 'orbit' : 'flux-cloud';
      const tool = toolByName(server, name);
      expect(tool, `${pair.left} is a tool of the ${server} server`).toBeDefined();
      if (!tool) continue;
      expect(pair.right).toBe(toolRiskLabel(tool));
      rights.add(pair.right);
    }
    expect(rights.size).toBe(5);
  });

  it('quotes the estimate the way the player grades it, and says the same figure in the explanation', () => {
    const c = lesson.checkpoint.find((x) => x.id === 'read-the-plan');
    expect(c?.kind).toBe('estimate');
    if (c?.kind !== 'estimate') return;
    const truth = estimateTruth(c, engine);
    expect(truth).not.toBeNull();
    expect(c.explain).toContain(`USD ${(truth ?? 0).toFixed(2)} a month`);
    // The point of the question: the agent's sizes cost well above the network minimum.
    expect(truth ?? 0).toBeGreaterThan(pricingMod.BAKED_PRICING.params.minUSDPrice);
  });

  it('counts the FluxCloud classes from the engine in the recap', () => {
    const by = toolsByRisk('flux-cloud');
    const recap = lesson.recap.join('\n');
    expect(recap).toContain(`${toolsOf('flux-cloud').length} tools, ${by.reads.length} only read`);
    expect(recap).toContain(`${by.keys.length} handles keys`);
    expect(recap).toContain(`${by.spends.length} can spend FLUX`);
    expect(recap).toContain(`${by.destroys.length} can delete data`);
  });

  it('runs the four scenarios of the agent-session widget, and only its documented policies', () => {
    const scenarios = ['deploy-nginx', 'poisoned-log', 'retry-after-timeout', 'orbit-repo'];
    const policies = ['ask-all', 'ask-spends', 'allow-all'];
    const used: string[] = [];
    for (const step of lesson.steps) {
      const stage = step.stage;
      if (stage?.kind !== 'widget' || stage.id !== 'agent-session') continue;
      const props = (stage.props ?? {}) as { scenario?: string; policy?: string };
      expect(scenarios).toContain(props.scenario);
      if (props.policy !== undefined) expect(policies).toContain(props.policy);
      used.push(String(props.scenario));
      // A session is a task, so the step cannot be passed by reading only.
      expect(step.task?.kind).toBe('widget');
    }
    expect([...used].sort()).toEqual([...scenarios].sort());
  });

  it('shows each policy the way the widget engine applies it', () => {
    const step = lesson.steps.find((s) => s.id === 'the-rule');
    expect(step?.stage?.kind).toBe('compare');
    if (step?.stage?.kind !== 'compare') return;
    const sides = [
      { side: step.stage.left, policy: 'ask-spends' as const },
      { side: step.stage.right, policy: 'ask-all' as const },
    ];
    for (const { side, policy } of sides) {
      const rows = (side.code ?? '')
        .split('\n')
        .map((line) => /^([a-z_]+)\s+(runs|asks you)$/.exec(line.trim()))
        .filter((m): m is RegExpExecArray => m !== null);
      expect(rows.length, `${policy} rows`).toBeGreaterThanOrEqual(5);
      for (const [, name, verdict] of rows) {
        const tool = toolByName('flux-cloud', name ?? '');
        expect(tool, `${name} is a FluxCloud tool`).toBeDefined();
        if (!tool) continue;
        expect(verdict === 'asks you', `${name} under ${policy}`).toBe(asks(policy, tool));
      }
    }
    // The gap the step names is real: some call a spending-only policy lets through is stopped by asking
    // before everything that is not a read.
    const left = sides[0]?.side.code ?? '';
    expect(left).toMatch(/flux_control_app\s+runs/);
  });

  it('never attaches a release-stage label or names a host the brief forbids', () => {
    const text = collectProse(lesson)
      .map((p) => p.text)
      .join('\n');
    expect(text).not.toMatch(/\b(preview|beta|coming soon)\b/i);
    expect(text).not.toMatch(/runonflux\.[a-z]+\/[^\s)]*preview/i);
  });

  it('keeps the two servers apart in every step that names an Orbit tool', () => {
    const orbitOnly = toolsOf('orbit')
      .map((t) => t.name)
      .filter((n) => !toolByName('flux-cloud', n));
    // An Orbit tool name next to a FluxCloud key is the blur this lesson exists to prevent.
    for (const step of lesson.steps) {
      const prose = [...step.body, ...(step.callouts ?? []).map((c) => c.body)].join('\n');
      const mentionsOrbitTool = orbitOnly.some((n) => prose.includes(`\`${n}\``));
      if (mentionsOrbitTool) {
        expect(prose, `step ${step.id} must say Orbit where it names an Orbit tool`).toMatch(/Orbit/);
        expect(prose, `step ${step.id} must not describe an Orbit tool with a key`).not.toMatch(
          /Orbit[^.]*(paymentPrivateKey|fluxIdPrivateKey|FLUX_ID_PRIVATE_KEY)/,
        );
      }
    }
  });
});
