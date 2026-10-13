/**
 * Pins the lesson `deploy-from-git` to the engine it teaches from: the plan prices it quotes are what the
 * formula gives, the estimate is graded on the baked rate card and the explanation says the same figure, the
 * link the builder asks for is valid and the planted link is refused in exactly the fields the lesson says,
 * every variable name in the prose is in the catalogue, and the copy keeps clear of what FACTS 15.3.16 says a
 * lesson must not claim.
 *
 * The generic rules (shape, ids, markup, references) are `content.test.ts`; this file is only what is
 * specific to this lesson and cheap to break by editing the catalogue.
 */

import { LABS, LESSONS } from '@shared/curriculum';
import {
  BAKED_PRICING,
  deployToFluxUrl,
  ORBIT_BUILD_VARIABLES,
  ORBIT_FACTS,
  ORBIT_PLANS,
  ORBIT_READ_ON,
  orbitPlanById,
  orbitPlanQuoteUsd,
} from '@shared/flux';
import * as blocksMod from '@shared/flux/blocks';
import * as lintMod from '@shared/flux/lint';
import * as pricingMod from '@shared/flux/pricing';
import * as specMod from '@shared/flux/spec';
import { describe, expect, it } from 'vitest';
import { buildEngine } from '@/learn/engine';
import { allTerms } from '@/learn/glossary';
import { estimateTruth, gradeEstimate } from '@/learn/grade';
import { parseMarkup, walkMarkup } from '@/learn/markup';
import type { Lesson } from '@/learn/types';
import { formatProblem, validateLesson } from '@/learn/validate';
import { collectProse } from '@/learn/validate-text';
import {
  buttonMatches,
  customGoalMet,
  draftOf,
  evaluateButton,
  readProps,
  sizeOf,
  solveCustom,
} from '@/learn/widgets/orbit-planner/logic';
import lessonModule from './lessons/deploy-from-git';

const lesson: Lesson = lessonModule;

const engine = buildEngine({
  spec: specMod as unknown as Record<string, unknown>,
  pricing: pricingMod as unknown as Record<string, unknown>,
  blocks: blocksMod as unknown as Record<string, unknown>,
  lint: lintMod as unknown as Record<string, unknown>,
  catalogue: lintMod as unknown as Record<string, unknown>,
});

const standard = orbitPlanById('standard');
if (!standard) throw new Error('the Standard plan is in ORBIT_PLANS');

const text = (): string =>
  collectProse(lesson)
    .map((p) => p.text)
    .join('\n');

describe('deploy-from-git, against the engine', () => {
  it('validates with no errors, no warnings and no notes', () => {
    const problems = validateLesson(lesson, {
      lessons: LESSONS,
      labs: LABS,
      glossary: new Set(allTerms().map((t) => t.id)),
      engine,
    });
    expect(problems.map((p) => formatProblem(p, 'deploy-from-git')).join('\n')).toBe('');
  });

  it('lists only terms it links, and every one of them exists', () => {
    const known = new Set(allTerms().map((t) => t.id));
    const used = new Set<string>();
    for (const item of collectProse(lesson)) {
      walkMarkup(parseMarkup(item.text).nodes, (n) => {
        if (n.type === 'term') used.add(n.id);
      });
    }
    for (const id of lesson.terms) {
      expect(known.has(id), `${id} is in the glossary`).toBe(true);
      expect(used.has(id), `${id} is linked in the text`).toBe(true);
    }
  });

  it('quotes the three published prices, and the formula agrees with each of them', () => {
    expect(ORBIT_PLANS).toHaveLength(3);
    const plans = lesson.steps.find((s) => s.id === 'plans');
    const body = (plans?.body ?? []).join('\n');
    for (const p of ORBIT_PLANS) {
      expect(orbitPlanQuoteUsd(p, BAKED_PRICING.params)).toBe(p.usd);
      expect(body).toContain(`USD ${p.usd.toFixed(2)}`);
    }
    expect(body).toContain(ORBIT_READ_ON);
    expect(body).toContain(BAKED_PRICING.capturedAt);
  });

  it('grades the estimate on the baked card, says its date, and explains with the same figure', () => {
    const c = lesson.checkpoint.find((x) => x.id === 'standard-plus-one');
    expect(c?.kind).toBe('estimate');
    if (c?.kind !== 'estimate') return;
    const truth = estimateTruth(c, engine);
    expect(truth).toBe(orbitPlanQuoteUsd(standard, BAKED_PRICING.params, { instances: 3 }));
    expect(c.prompt).toContain(BAKED_PRICING.capturedAt);
    expect(c.explain).toContain(`USD ${(truth ?? 0).toFixed(2)}`);
    // The tolerance accepts adding one more share and refuses the two lazy answers: doubling, and no change.
    expect(gradeEstimate(c, standard.usd + standard.usd / 2, truth ?? 0).correct).toBe(true);
    expect(gradeEstimate(c, standard.usd * 2, truth ?? 0).correct).toBe(false);
    expect(gradeEstimate(c, standard.usd, truth ?? 0).correct).toBe(false);
  });

  it('answers the plan question with the smallest plan that has all three things, from the catalogue', () => {
    const c = lesson.checkpoint.find((x) => x.id === 'which-plan');
    expect(c?.kind).toBe('choice');
    if (c?.kind !== 'choice') return;
    // Two instances, a persistent folder and RAM for a 3 to 4 GB build: the brief's three needs.
    const fits = ORBIT_PLANS.filter((p) => p.instances >= 2 && p.persistentFolders && p.ramMb >= 3000);
    const cheapest = [...fits].sort(
      (a, b) => orbitPlanQuoteUsd(a, BAKED_PRICING.params) - orbitPlanQuoteUsd(b, BAKED_PRICING.params),
    )[0];
    expect(cheapest?.id).toBe(c.answer);
    // Every wrong option says why it is wrong, with a number from the catalogue where it quotes one.
    for (const o of c.options) {
      if (o.id !== c.answer) expect(o.why, `${o.id} has a reason`).toBeTruthy();
    }
  });

  it('sets a Custom goal the planner can reach from the Standard size', () => {
    const step = lesson.steps.find((s) => s.id === 'plans');
    expect(step?.stage?.kind).toBe('widget');
    if (step?.stage?.kind !== 'widget') return;
    const props = readProps(step.stage.props);
    expect(props.view).toBe('plans');
    expect(props.goal?.kind).toBe('custom');
    if (props.goal?.kind !== 'custom') return;
    // The step starts on Standard's own size, which does not meet the goal (equal is not below).
    expect(customGoalMet(props.goal, sizeOf(standard))).toBe(false);
    const solved = solveCustom(props.goal, sizeOf(standard));
    expect(solved).not.toBeNull();
    if (solved) expect(customGoalMet(props.goal, solved)).toBe(true);
    expect(step.task?.kind).toBe('widget');
  });

  it('asks for a valid link and plants three refused values in the starting one', () => {
    const step = lesson.steps.find((s) => s.id === 'button');
    expect(step?.stage?.kind).toBe('widget');
    if (step?.stage?.kind !== 'widget') return;
    const props = readProps(step.stage.props);
    expect(props.view).toBe('button');
    expect(props.goal?.kind).toBe('url');
    if (props.goal?.kind !== 'url') return;
    const want = props.goal.expected;

    // The asked-for link is one the builder accepts, and it is the link the engine builds.
    const accepted = evaluateButton(draftOf(want));
    expect(accepted.ok).toBe(true);
    expect(accepted.url).toBe(deployToFluxUrl(want));
    expect(buttonMatches(draftOf(want), want)).toBe(true);

    // The planted draft is refused in exactly the three fields the lesson teaches, and is not the goal.
    const planted = evaluateButton(props.draft);
    expect(planted.ok).toBe(false);
    expect(Object.keys(planted.errors).sort()).toEqual(['plan', 'projectPath', 'repo']);
    expect(buttonMatches(props.draft, want)).toBe(false);

    // The prompt names every value the link must carry, so it can be done from the text alone.
    const prompt = step.task?.kind === 'widget' ? step.task.prompt : '';
    expect(prompt).toContain('acme/shop');
    expect(prompt).toContain(want.branch ?? '');
    expect(prompt).toContain(want.projectPath ?? '');
    expect(prompt.toLowerCase()).toContain(want.plan ?? '');
  });

  it('writes only variable names that are in ORBIT_BUILD_VARIABLES', () => {
    const names = new Set(ORBIT_BUILD_VARIABLES.map((x) => x.name));
    const spans = new Set<string>();
    for (const item of collectProse(lesson)) {
      walkMarkup(parseMarkup(item.text).nodes, (n) => {
        if (n.type !== 'code') return;
        // A bare upper-case snake name, or NAME=value, is a variable. Anything else is not.
        const name = /^([A-Z][A-Z0-9_]+)(?:=.*)?$/.exec(n.text)?.[1];
        if (name) spans.add(name);
      });
    }
    expect(spans.size).toBeGreaterThan(5);
    // `NAME=value` is the generic shape, not a variable.
    const unknown = [...spans].filter((s) => s !== 'NAME' && !names.has(s));
    expect(unknown).toEqual([]);
  });

  it('carries a date beside every live count it quotes', () => {
    for (const item of collectProse(lesson)) {
      for (const fact of Object.values(ORBIT_FACTS)) {
        if (typeof fact !== 'object' || fact === null || !('value' in fact)) continue;
        // A count as a whole word, so a price such as 2.35 or a year does not trip it.
        const re = new RegExp(`(?<![\\d.,])${fact.value}(?![\\d.,])`);
        if (re.test(item.text)) {
          expect(item.text, `${item.path} quotes ${fact.value} (${fact.what})`).toContain(fact.readOn);
        }
      }
    }
  });

  it('keeps clear of what FACTS 15.3.16 says a lesson must not claim', () => {
    const all = text();
    expect(all).not.toMatch(/\b(beta|coming soon)\b/i);
    expect(all).not.toMatch(/\bfree (plan|tier|forever)\b/i);
    expect(all).not.toMatch(/\bis free\b/i);
    expect(all).not.toMatch(/\b3\+ nodes\b|three or more nodes|runs on 3 or more/i);
    expect(all).not.toMatch(/\binstantly\b|\bin 2 minutes\b|\bin two minutes\b/i);
    expect(all).not.toMatch(/\buses Nixpacks\b/i);
    // A rate, a share or a percentage of single-instance apps that are down: never (stale-claims.test.ts).
    expect(all).not.toMatch(/(percent|%) of (the )?(one|single)[- ]instance/i);
    // The preview host of the new console is never written.
    expect(all).not.toMatch(/runonflux\.[a-z]+\/[^\s)]*preview/i);
  });

  it('keeps tokens out of the prose: only the placeholder text appears, and only in specs', () => {
    // The placeholder value is in the spec of the checkpoint, not in the prose a learner reads as advice.
    expect(text()).not.toMatch(/EXAMPLE_TOKEN/);
    const c = lesson.checkpoint.find((x) => x.id === 'seal-the-token');
    expect(c?.kind).toBe('spec-fix');
    if (c?.kind !== 'spec-fix') return;
    const env = (c.spec as { compose?: { environmentParameters?: string[] }[] }).compose?.[0]
      ?.environmentParameters;
    expect(env?.some((e) => /^GIT_TOKEN=EXAMPLE_TOKEN_NOT_REAL$/.test(e))).toBe(true);
  });
});
