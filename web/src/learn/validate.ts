/**
 * The lesson validator: everything that can be proven about a lesson without running the UI.
 *
 * `validateLesson(lesson, deps)` is pure: it returns a list of problems and never throws. The content test
 * (`web/src/content/content.test.ts`, `npm run content:check`) runs it over every lesson file; the lesson
 * route runs it in development and prints problems in the console.
 *
 * Severity
 *   error    the lesson is broken or breaks a hard rule of docs/CONTENT.md; the test fails
 *   warning  probably a mistake or a missed teaching opportunity; the test prints it
 *   info     context (for example "not verified because the lint engine is missing")
 *
 * Rules (code in brackets)
 *   Identity    id is in the curriculum [id-unknown]; step and challenge ids are unique and kebab-case
 *               [id-format, id-duplicate]
 *   Shape       4 to 9 steps [steps-count]; 2 to 5 challenges [challenges-count]; 2 to 4 objectives
 *               [objectives-count]; 3 to 5 recap [recap-count]; 1 to 4 https links [further-count,
 *               further-url]; 1 to 3 paragraphs and at most 2 callouts per step; the first step has a stage
 *   Doing       at least 2 non-read tasks [tasks-count]; at least 1 doing challenge, or order/match in a
 *               concept lesson [doing-challenge]; at most one multiple-choice question per two challenges
 *   References  {{term:}} in the glossary [term-unknown]; {{lesson:}} and {{lab:}} in the curriculum
 *               [lesson-unknown, lab-unknown]; a link inside the Academy (`/reference/orbit#plans`) names a
 *               page `shared/site.ts` knows [link-route], any other link is https [link-url]; `terms` exist; stage kind, diagram id, widget id in the
 *               catalog [stage-kind, diagram-unknown, widget-unknown]; diagram beat in range [diagram-beat]
 *   Specs       every spec normalises [spec-normalize]; every `solution` satisfies its check or
 *               requirements and every starting spec of a fix or build fails it [solution-fails-check,
 *               start-passes-check]; check paths exist on the spec shape [check-path]; lint codes exist
 *               [check-lint-code]; tasks match the stage in force [task-stage]
 *   Terminal    goals named by tasks exist [task-goal]; patterns compile [command-regex]; every goal is
 *               reachable [goal-unreachable]; examples reach their command [command-shadowed]
 *   Text        balanced markup, well-formed `{{directives}}` and term modifiers (`{{term:id|lower}}`,
 *               `{{term:id|Cap}}`) [markup]; no em dash [em-dash]; no emoji [emoji]; no exclamation mark
 *               [exclamation]; paragraphs at most 90 words [paragraph-length]; hook at most 2 sentences
 *               [hook-length]
 *
 * Glossary rules (`validateGlossary`) are listed at that function. Markup problems come from the one
 * parser, `markup.ts`, so a string the validator accepts is a string every renderer understands.
 */

import type { FluxAppSpec } from '@shared/flux/types';
import { routeMeta } from '@shared/site';
import {
  CALLOUT_KINDS,
  CHALLENGE_KINDS,
  CODE_LANGS,
  DIAGRAM_BEAT_COUNTS,
  DIAGRAM_IDS,
  DIORAMA_CONTROLS,
  DIORAMA_SCENES,
  DOING_CHALLENGE_KINDS,
  STAGE_KINDS,
  WIDGET_IDS,
} from '@/content/catalog';
import {
  type CheckContext,
  type CheckResult,
  checkLintCodes,
  checkPaths,
  checkUsesLint,
  compileRegex,
  describeCheck,
  evaluateCheck,
  leafChecks,
} from './checks';
import { type SpecFacts, specFacts } from './engine';
import { estimateTruth } from './grade';
import { markupRefs } from './markup';
import { applySolution, composeLength, mergeSpecPatch } from './specs';
import type {
  Challenge,
  Check,
  CodeStage,
  CompareStage,
  DeepPartial,
  DioramaStage,
  GlossaryTerm,
  Lesson,
  SpecStage,
  Stage,
  Step,
  Task,
  TerminalScript,
} from './types';
import { Collector, type Problem, type ValidateDeps } from './validate-core';
import { changedPaths, coveredByEditable, specPathVerdict } from './validate-spec';
import { validateScript } from './validate-terminal';
import { checkCharacters, checkProse, collectProse } from './validate-text';

export type { Problem, Severity, ValidateDeps } from './validate-core';
export { countBySeverity, formatProblem, formatProblems, hasErrors } from './validate-core';

/** Visit each item of an optional list. A callback may return a value; it is ignored. */
function each<T>(list: readonly T[] | undefined, fn: (item: T, index: number) => unknown): void {
  if (!list) return;
  for (const [i, x] of list.entries()) fn(x, i);
}

/**
 * The page a link points at when it stays inside the Academy: one leading slash, then a path
 * (`/reference/orbit#plans`, `/troubleshoot`). A `#anchor` or `?query` is not part of the page. Null for
 * every other link, which must then be an https URL.
 */
function siteRoute(href: string): string | null {
  if (!href.startsWith('/') || href.startsWith('//')) return null;
  return href.split(/[?#]/, 1)[0] ?? '';
}

const ID_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DOING = new Set<string>(DOING_CHALLENGE_KINDS);
const MC = new Set(['choice', 'multi']);

interface Env {
  deps: ValidateDeps;
  out: Collector;
  /** Paths of checks that needed lint while it was unavailable. */
  unverifiedLint: string[];
  /** Terminal script id to its serialised content, to catch two scripts sharing an id. */
  scripts: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function validateLesson(lesson: Lesson, deps: ValidateDeps): Problem[] {
  const out = new Collector();
  const env: Env = { deps, out, unverifiedLint: [], scripts: new Map() };
  try {
    run(lesson, env);
  } catch (e) {
    // The validator itself must never take a test run down with a stack trace nobody can act on.
    out.error('validator-crash', '', `The validator threw: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (env.unverifiedLint.length > 0) {
    out.info(
      'lint-unavailable',
      env.unverifiedLint[0] ?? '',
      `${env.unverifiedLint.length} check(s) use lint and could not be verified because the lint engine ` +
        '(shared/flux/lint.ts) is not available yet. Run the content check again when it lands.',
    );
  }
  const order = { error: 0, warning: 1, info: 2 } as const;
  return out.problems
    .map((p, i) => ({ p, i }))
    .sort((a, b) => order[a.p.severity] - order[b.p.severity] || a.i - b.i)
    .map((x) => x.p);
}

function run(lesson: Lesson, env: Env): void {
  const { deps, out } = env;

  // ---- identity ---------------------------------------------------------------------------------
  const meta = deps.lessons.find((l) => l.id === lesson.id);
  if (!meta) {
    out.error('id-unknown', 'id', `"${lesson.id}" is not a lesson id in shared/curriculum.ts.`);
  }

  // ---- shape ------------------------------------------------------------------------------------
  const steps = Array.isArray(lesson.steps) ? lesson.steps : [];
  const checkpoint = Array.isArray(lesson.checkpoint) ? lesson.checkpoint : [];
  count(out, 'steps-count', 'steps', steps.length, 4, 9, 'steps');
  count(out, 'challenges-count', 'checkpoint', checkpoint.length, 2, 5, 'challenges');
  count(out, 'objectives-count', 'objectives', lesson.objectives?.length ?? 0, 2, 4, 'objectives');
  count(out, 'recap-count', 'recap', lesson.recap?.length ?? 0, 3, 5, 'recap points');
  count(out, 'further-count', 'further', lesson.further?.length ?? 0, 1, 4, 'further links');
  if (typeof lesson.hook !== 'string' || lesson.hook.trim() === '') {
    out.error('hook-missing', 'hook', 'The lesson needs a hook: one or two sentences.');
  }

  (lesson.further ?? []).forEach((f, i) => {
    const p = `further[${i}]`;
    let ok = false;
    try {
      const u = new URL(f.url);
      ok = u.protocol === 'https:' && u.hostname.includes('.');
    } catch {
      ok = false;
    }
    if (!ok) out.error('further-url', `${p}.url`, `"${f.url}" is not an https URL.`);
    if (!f.label || f.label.trim() === '')
      out.error('further-label', `${p}.label`, 'The link needs a label.');
  });

  // ---- ids --------------------------------------------------------------------------------------
  const stepIds = new Set<string>();
  each(steps, (s, i) => {
    const p = `steps[${i}]`;
    if (!s.id || !ID_FORMAT.test(s.id)) {
      out.error(
        'id-format',
        `${p}.id`,
        `Step id "${s.id}" must be lower-case kebab-case (it becomes ?step=<id>).`,
      );
    }
    if (stepIds.has(s.id)) out.error('id-duplicate', `${p}.id`, `Step id "${s.id}" is used more than once.`);
    stepIds.add(s.id);
  });
  const challengeIds = new Set<string>();
  each(checkpoint, (c, i) => {
    const p = `checkpoint[${i}]`;
    if (!c.id || !ID_FORMAT.test(c.id)) {
      out.error('id-format', `${p}.id`, `Challenge id "${c.id}" must be lower-case kebab-case.`);
    }
    if (challengeIds.has(c.id))
      out.error('id-duplicate', `${p}.id`, `Challenge id "${c.id}" is used more than once.`);
    if (stepIds.has(c.id)) {
      out.error(
        'id-duplicate',
        `${p}.id`,
        `Challenge id "${c.id}" is also a step id. Ids share one deep-link space.`,
      );
    }
    challengeIds.add(c.id);
  });

  // ---- doing and non-read tasks -----------------------------------------------------------------
  const taskCount = steps.filter((s) => s.task && s.task.kind !== 'read').length;
  if (taskCount < 2) {
    out.error(
      'tasks-count',
      'steps',
      `${taskCount} step(s) have a task. A lesson needs at least 2 steps where the learner does something.`,
    );
  }
  const doing = checkpoint.filter((c) => DOING.has(c.kind)).length;
  const orderMatch = checkpoint.filter((c) => c.kind === 'order' || c.kind === 'match').length;
  if (meta?.kind === 'concept') {
    if (doing + orderMatch === 0) {
      out.error(
        'doing-challenge',
        'checkpoint',
        'A concept lesson needs at least one order or match challenge (or a spec, terminal or estimate challenge).',
      );
    }
  } else if (doing === 0) {
    out.error(
      'doing-challenge',
      'checkpoint',
      'The checkpoint needs at least one doing challenge: spec-fix, spec-build, terminal or estimate.',
    );
  }
  const mc = checkpoint.filter((c) => MC.has(c.kind)).length;
  if (checkpoint.length > 0 && mc > Math.floor(checkpoint.length / 2)) {
    out.warn(
      'choice-ratio',
      'checkpoint',
      `${mc} of ${checkpoint.length} challenges are multiple choice. Aim for at most one per two: retrieval beats recognition.`,
    );
  }

  // ---- text -------------------------------------------------------------------------------------
  const prose = collectProse(lesson);
  checkCharacters(lesson, out);
  checkProse(prose, 'hook', out);

  // ---- references -------------------------------------------------------------------------------
  const lessonIds = new Set(deps.lessons.map((l) => l.id));
  const labIds = new Set(deps.labs.map((l) => l.id));
  const termUses = new Map<string, number>();
  for (const item of prose) {
    const refs = markupRefs(item.text);
    for (const id of refs.terms) {
      termUses.set(id, (termUses.get(id) ?? 0) + 1);
      if (!deps.glossary.has(id)) {
        out.error(
          'term-unknown',
          item.path,
          `{{term:${id}}} is not in the glossary (content/glossary/*.ts).`,
        );
      }
    }
    for (const id of refs.lessons) {
      if (!lessonIds.has(id)) out.error('lesson-unknown', item.path, `{{lesson:${id}}} is not a lesson id.`);
    }
    for (const id of refs.labs) {
      if (!labIds.has(id)) out.error('lab-unknown', item.path, `{{lab:${id}}} is not a lab id.`);
    }
    for (const l of refs.links) {
      const route = siteRoute(l.href);
      if (route !== null) {
        if (!routeMeta(route)) {
          out.error(
            'link-route',
            item.path,
            `Link "${l.label}" goes to "${l.href}", which is not a page of the Academy (see shared/site.ts).`,
          );
        }
        continue;
      }
      let https = false;
      try {
        https = new URL(l.href).protocol === 'https:';
      } catch {
        https = false;
      }
      if (!https) {
        out.error(
          'link-url',
          item.path,
          `Link "${l.label}" goes to "${l.href}". External links must be https; use {{lesson:id}} for lessons and a path such as /reference/orbit for other pages of the Academy.`,
        );
      }
    }
  }
  for (const [id, n] of termUses) {
    if (n > 3) {
      out.info(
        'term-repeated',
        'steps',
        `{{term:${id}}} is linked ${n} times. Link a term on its first use only.`,
      );
    }
  }
  const declared = new Set<string>();
  (lesson.terms ?? []).forEach((id, i) => {
    if (declared.has(id)) out.error('term-duplicate', `terms[${i}]`, `Term "${id}" is listed twice.`);
    declared.add(id);
    if (!deps.glossary.has(id)) out.error('term-unknown', `terms[${i}]`, `"${id}" is not in the glossary.`);
    else if (!termUses.has(id)) {
      out.warn(
        'term-unused',
        `terms[${i}]`,
        `"${id}" is listed as introduced here but never linked with {{term:${id}}} in the lesson text.`,
      );
    }
  });

  // ---- steps: stages, tasks, the ideal learner path ---------------------------------------------
  const sim: Sim = { stage: null, spec: null, script: null };
  each(steps, (step, i) => checkStep(step, i, i === 0, sim, env));

  // ---- checkpoint -------------------------------------------------------------------------------
  each(checkpoint, (c, i) => checkChallenge(c, i, env));
}

function count(
  out: Collector,
  code: string,
  path: string,
  n: number,
  min: number,
  max: number,
  noun: string,
): void {
  if (n < min || n > max) {
    out.error(code, path, `${n} ${noun}. A lesson has ${min} to ${max}.`);
  }
}

// ---------------------------------------------------------------------------
// Specs and checks
// ---------------------------------------------------------------------------

/** Normalise a partial spec the way a stage does; report keys the network would drop. */
function normalisePartial(
  partial: DeepPartial<FluxAppSpec> | undefined,
  path: string,
  env: Env,
): FluxAppSpec | null {
  const { engine } = env.deps;
  try {
    const merged = mergeSpecPatch(engine.defaultSpec(), partial ?? {});
    const r = engine.normalizeSpec(merged);
    for (const d of r.dropped) {
      env.out.warn(
        'spec-dropped-key',
        path,
        `"${d}" is not part of a v8 spec and is removed by normalisation. Remove it from the lesson.`,
      );
    }
    for (const c of r.coerced) {
      env.out.warn('spec-coerced', path, `"${c}" has the wrong type and was converted. Use the right type.`);
    }
    return r.spec;
  } catch (e) {
    env.out.error(
      'spec-normalize',
      path,
      `normalizeSpec threw on this spec: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}

interface Verdict {
  /** null when the check could not be evaluated (lint missing) */
  result: CheckResult | null;
}

/** Evaluate a check against facts. Lint checks cannot be evaluated without the lint engine. */
function run1(check: Check, facts: SpecFacts, path: string, env: Env): Verdict {
  if (checkUsesLint(check) && !facts.lint) {
    env.unverifiedLint.push(path);
    return { result: null };
  }
  const ctx: CheckContext = { spec: facts.spec, lint: facts.lint, usdPerMonth: facts.usdPerMonth };
  return { result: evaluateCheck(check, ctx) };
}

/** Validate the paths and lint codes a check names. */
function checkShape(check: Check, path: string, env: Env): void {
  const { out, deps } = env;
  const leaves = leafChecks(check);
  if (leaves.length === 0)
    out.error('check-empty', path, 'This check has no conditions (an empty all or any).');
  for (const p of checkPaths(check)) {
    const v = specPathVerdict(p);
    if (!v.ok) out.error('check-path', path, v.reason ?? `"${p}" does not exist on a spec.`);
  }
  const codes = deps.engine.lintCodes;
  for (const code of checkLintCodes(check)) {
    if (codes && !codes.has(code)) {
      out.error(
        'check-lint-code',
        path,
        `Lint code "${code}" is not in the lint catalogue (shared/flux/lint-catalogue.ts). A mistyped code would pass silently.`,
      );
    }
  }
  for (const leaf of leaves) {
    if ('path' in leaf) {
      if (leaf.op === 'matches' && (leaf.value === undefined || !compileRegex(String(leaf.value)))) {
        out.error('check-regex', path, `The pattern for ${leaf.path} does not compile.`);
      }
      const needsValue = leaf.op !== 'exists' && leaf.op !== 'empty';
      if (needsValue && leaf.value === undefined) {
        out.error('check-value', path, `${leaf.path} with op "${leaf.op}" needs a \`value\`.`);
      }
    } else if ('price' in leaf) {
      if (!Number.isFinite(leaf.usd) || leaf.usd <= 0) {
        out.error('check-price', path, 'A price check needs a positive `usd`.');
      }
    } else if ('lint' in leaf && leaf.lint === 'absent' && leaf.codes.length === 0) {
      out.error('check-lint-code', path, 'A lint "absent" check needs at least one code.');
    }
  }
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** The ideal learner's state while walking the steps. */
interface Sim {
  /** The stage in force. */
  stage: Stage | null;
  /** The spec in the editor when the stage in force is a spec stage. */
  spec: FluxAppSpec | null;
  /** The terminal script in force. */
  script: TerminalScript | null;
}

function checkStep(step: Step, index: number, first: boolean, sim: Sim, env: Env): void {
  const { out } = env;
  const p = `steps[${index} "${step.id}"]`;

  if (typeof step.title !== 'string' || step.title.trim() === '') {
    out.error('step-title', `${p}.title`, 'A step needs a title.');
  } else if (step.title.length > 64) {
    out.warn(
      'step-title-long',
      `${p}.title`,
      `${step.title.length} characters. Keep step titles short (up to 64).`,
    );
  }
  const body = Array.isArray(step.body) ? step.body : [];
  if (body.length === 0) out.error('step-body', `${p}.body`, 'A step needs one to three paragraphs.');
  if (body.length > 3)
    out.warn('step-body', `${p}.body`, `${body.length} paragraphs. One to three, please: one idea per step.`);
  if (step.callouts && step.callouts.length > 2) {
    out.error('callouts-count', `${p}.callouts`, `${step.callouts.length} callouts. At most two per step.`);
  }
  each(step.callouts, (c, i) => {
    if (!(CALLOUT_KINDS as readonly string[]).includes(c.kind)) {
      out.error(
        'callout-kind',
        `${p}.callouts[${i}].kind`,
        `"${c.kind}" is not a callout kind (${CALLOUT_KINDS.join(', ')}).`,
      );
    }
  });

  if (step.stage) {
    checkStage(step.stage, `${p}.stage`, sim, env);
  } else if (first) {
    out.error('first-stage', `${p}.stage`, 'The first step must set a stage, or the stage column is empty.');
  }

  if (step.task) checkTask(step.task, `${p}.task`, sim, env);
}

function checkStage(stage: Stage, path: string, sim: Sim, env: Env): void {
  const { out, deps } = env;
  const kinds = deps.stageKinds ?? STAGE_KINDS;
  if (!kinds.includes(stage.kind)) {
    out.error(
      'stage-kind',
      `${path}.kind`,
      `Stage kind "${stage.kind}" is not in the catalog (${kinds.join(', ')}).`,
    );
    sim.stage = stage;
    return;
  }

  const sameKind = sim.stage?.kind === stage.kind;
  switch (stage.kind) {
    case 'diorama':
      checkDiorama(stage, path, out);
      break;
    case 'spec':
      checkSpecStage(stage, path, sim, sameKind, env);
      break;
    case 'terminal':
      checkTerminalStage(stage.script, `${path}.script`, env);
      sim.script = stage.script;
      break;
    case 'diagram': {
      const ids = deps.diagramIds ?? DIAGRAM_IDS;
      if (!ids.includes(stage.id)) {
        out.error(
          'diagram-unknown',
          `${path}.id`,
          `Diagram "${stage.id}" is not in the catalog (${ids.join(', ')}).`,
        );
      } else {
        const beats =
          deps.diagramBeats?.[stage.id] ?? (DIAGRAM_BEAT_COUNTS as Record<string, number>)[stage.id];
        if (stage.beat !== undefined) {
          if (!Number.isInteger(stage.beat) || stage.beat < 0) {
            out.error(
              'diagram-beat',
              `${path}.beat`,
              `beat must be a whole number from 0 (got ${stage.beat}).`,
            );
          } else if (beats !== undefined && stage.beat >= beats) {
            out.error(
              'diagram-beat',
              `${path}.beat`,
              `"${stage.id}" has ${beats} beats (0 to ${beats - 1}); beat ${stage.beat} does not exist.`,
            );
          }
        }
      }
      break;
    }
    case 'code':
      checkCode(stage, path, out);
      break;
    case 'compare':
      checkCompare(stage, path, out);
      break;
    case 'widget': {
      const ids = deps.widgetIds ?? WIDGET_IDS;
      if (!ids.includes(stage.id)) {
        out.error(
          'widget-unknown',
          `${path}.id`,
          `Widget "${stage.id}" is not in the catalog (${ids.join(', ')}).`,
        );
      }
      break;
    }
  }
  if (stage.kind !== 'spec') sim.spec = null;
  if (stage.kind !== 'terminal') sim.script = null;
  sim.stage = stage;
}

function checkDiorama(stage: DioramaStage, path: string, out: Collector): void {
  if (!(DIORAMA_SCENES as readonly string[]).includes(stage.scene)) {
    out.error(
      'diorama-scene',
      `${path}.scene`,
      `Scene "${stage.scene}" is not one of ${DIORAMA_SCENES.join(', ')}.`,
    );
  }
  for (const c of stage.controls ?? []) {
    if (!(DIORAMA_CONTROLS as readonly string[]).includes(c)) {
      out.error(
        'diorama-control',
        `${path}.controls`,
        `Control "${c}" is not one of ${DIORAMA_CONTROLS.join(', ')}.`,
      );
    }
  }
  if (
    stage.instances !== undefined &&
    (!Number.isInteger(stage.instances) || stage.instances < 0 || stage.instances > 100)
  ) {
    out.error(
      'diorama-instances',
      `${path}.instances`,
      `instances must be a whole number from 0 to 100 (got ${stage.instances}).`,
    );
  }
}

function checkSpecStage(stage: SpecStage, path: string, sim: Sim, sameKind: boolean, env: Env): void {
  const { out } = env;
  const built = normalisePartial(stage.spec, `${path}.spec`, env);
  for (const e of stage.editable ?? []) {
    const v = specPathVerdict(e);
    if (!v.ok) out.error('editable-path', `${path}.editable`, v.reason ?? `"${e}" is not a spec path.`);
  }
  each(stage.focus, (f, i) => {
    const v = specPathVerdict(f.path);
    if (!v.ok)
      out.error('focus-path', `${path}.focus[${i}].path`, v.reason ?? `"${f.path}" is not a spec path.`);
  });
  for (const s of stage.show ?? []) {
    if (!['form', 'json', 'price', 'issues'].includes(s)) {
      out.error('spec-show', `${path}.show`, `"${s}" is not a panel (form, json, price, issues).`);
    }
  }
  // The editor keeps the learner's spec across consecutive spec steps only when `reset` is false.
  const keep = sameKind && stage.reset === false && sim.spec !== null;
  if (!keep) sim.spec = built;
}

function checkTerminalStage(script: TerminalScript, path: string, env: Env): void {
  validateScript(script, path, env.out);
  const json = JSON.stringify(script);
  const seen = env.scripts.get(script.id);
  if (seen !== undefined && seen !== json) {
    env.out.warn(
      'script-id-conflict',
      path,
      `Two different terminal scripts share the id "${script.id}". Give each script its own id.`,
    );
  }
  env.scripts.set(script.id, json);
}

function checkCode(stage: CodeStage, path: string, out: Collector): void {
  if (!Array.isArray(stage.files) || stage.files.length === 0) {
    out.error('code-files', `${path}.files`, 'A code stage needs at least one file.');
    return;
  }
  const names = new Set<string>();
  each(stage.files, (f, i) => {
    const p = `${path}.files[${i}]`;
    if (!f.name) out.error('code-name', `${p}.name`, 'A file needs a name.');
    if (names.has(f.name)) out.error('code-name', `${p}.name`, `File name "${f.name}" is used twice.`);
    names.add(f.name);
    if (!(CODE_LANGS as readonly string[]).includes(f.lang)) {
      out.error('code-lang', `${p}.lang`, `"${f.lang}" is not one of ${CODE_LANGS.join(', ')}.`);
    }
    if (typeof f.code !== 'string' || f.code.trim() === '')
      out.error('code-empty', `${p}.code`, 'The file is empty.');
    const lines = typeof f.code === 'string' ? f.code.replace(/\n$/, '').split('\n').length : 0;
    for (const h of f.highlight ?? []) {
      if (!Number.isInteger(h) || h < 1 || h > lines) {
        out.error(
          'code-highlight',
          `${p}.highlight`,
          `Line ${h} does not exist (the file has ${lines} lines).`,
        );
      }
    }
  });
}

function checkCompare(stage: CompareStage, path: string, out: Collector): void {
  for (const side of ['left', 'right'] as const) {
    const s = stage[side];
    const p = `${path}.${side}`;
    if (!s?.label || s.label.trim() === '')
      out.error('compare-label', `${p}.label`, 'Each panel needs a label.');
    if (s && !s.code && !s.body) out.error('compare-content', p, 'Each panel needs `code` or `body`.');
    if (s?.tone && !['good', 'bad', 'neutral'].includes(s.tone)) {
      out.error('compare-tone', `${p}.tone`, `"${s.tone}" is not good, bad or neutral.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

function checkTask(task: Task, path: string, sim: Sim, env: Env): void {
  const { out } = env;
  const stage = sim.stage;

  const needStage = (kind: Stage['kind'], what: string): boolean => {
    if (stage?.kind === kind) return true;
    out.error(
      'task-stage',
      path,
      `A ${what} task needs a ${kind} stage in force, but the stage here is ${stage ? stage.kind : 'missing'}.`,
    );
    return false;
  };

  switch (task.kind) {
    case 'read':
      out.info('task-read', path, 'A read task is the same as no task. Omit it.');
      break;
    case 'set-instances': {
      if (task.exactly === undefined && task.min === undefined && task.max === undefined) {
        out.warn(
          'task-instances',
          path,
          'set-instances with no min, max or exactly is satisfied by any change.',
        );
      }
      if (task.min !== undefined && task.max !== undefined && task.min > task.max) {
        out.error('task-instances', path, `min (${task.min}) is above max (${task.max}).`);
      }
      for (const v of [task.exactly, task.min, task.max]) {
        if (v !== undefined && (!Number.isInteger(v) || v < 1 || v > 100)) {
          out.error('task-instances', path, `${v} is not a possible instance count (1 to 100).`);
        }
      }
      if (stage?.kind === 'diorama') {
        if (!stage.controls?.includes('instances')) {
          out.error(
            'task-stage',
            path,
            'The diorama stage has no `instances` control, so the learner cannot change it.',
          );
        }
      } else if (stage?.kind === 'spec') {
        if (stage.editable && !stage.editable.some((e) => e === 'instances')) {
          out.error('task-stage', path, 'The spec stage does not list `instances` as editable.');
        }
      } else {
        out.error(
          'task-stage',
          path,
          `set-instances needs a diorama or spec stage in force (got ${stage ? stage.kind : 'none'}).`,
        );
      }
      break;
    }
    case 'kill-nodes':
      if (!Number.isInteger(task.count) || task.count < 1) {
        out.error('task-count', path, 'kill-nodes needs a count of at least 1.');
      }
      if (
        needStage('diorama', 'kill-nodes') &&
        stage?.kind === 'diorama' &&
        !stage.controls?.includes('kill')
      ) {
        out.error('task-stage', path, 'The diorama stage has no `kill` control.');
      }
      break;
    case 'send-requests':
      if (!Number.isInteger(task.count) || task.count < 1) {
        out.error('task-count', path, 'send-requests needs a count of at least 1.');
      }
      if (
        needStage('diorama', 'send-requests') &&
        stage?.kind === 'diorama' &&
        !stage.controls?.includes('request')
      ) {
        out.error('task-stage', path, 'The diorama stage has no `request` control.');
      }
      break;
    case 'widget':
      needStage('widget', 'widget');
      break;
    case 'confirm':
      if (!task.label || task.label.trim() === '')
        out.error('task-label', `${path}.label`, 'A confirm task needs a label.');
      break;
    case 'terminal': {
      if (!task.goals || task.goals.length === 0) {
        out.error('task-goal', `${path}.goals`, 'A terminal task needs at least one goal.');
      }
      if (needStage('terminal', 'terminal') && sim.script) {
        const ids = new Set(sim.script.goals.map((g) => g.id));
        for (const g of task.goals ?? []) {
          if (!ids.has(g)) {
            out.error(
              'task-goal',
              `${path}.goals`,
              `Goal "${g}" is not in the script "${sim.script.id}" (${[...ids].join(', ')}).`,
            );
          }
        }
      }
      break;
    }
    case 'spec': {
      checkShape(task.check, `${path}.check`, env);
      if (!needStage('spec', 'spec') || stage?.kind !== 'spec') break;
      if (stage.editable && stage.editable.length === 0) {
        out.error(
          'task-stage',
          path,
          'The spec stage is read-only (`editable: []`), so the learner cannot satisfy the task.',
        );
      }
      if (stage.show && !stage.show.includes('form') && !stage.show.includes('json')) {
        out.error(
          'task-stage',
          path,
          'The spec stage shows neither the form nor the JSON, so nothing can be edited.',
        );
      }
      const start = sim.spec;
      if (!start) break;
      verifySolution({
        env,
        path,
        start,
        solution: task.solution,
        checks: [task.check],
        startMustFail: 'warn',
        editable: stage.editable,
      });
      // The ideal learner finishes the task: the editor now holds the solved spec.
      sim.spec = applySolution(env.deps.engine, start, task.solution);
      break;
    }
  }
}

interface VerifyArgs {
  env: Env;
  path: string;
  start: FluxAppSpec;
  solution: DeepPartial<FluxAppSpec>;
  /** Each must pass on the solved spec. */
  checks: Check[];
  /** What to do when the starting spec already passes everything. */
  startMustFail: 'error' | 'warn';
  editable?: string[];
  /** For requirement lists: the starting spec must fail at least one (not all). */
  requireOneFailing?: boolean;
}

function verifySolution(a: VerifyArgs): void {
  const { env, path, start, solution, checks } = a;
  const { out, deps } = env;
  const engine = deps.engine;
  let solved: FluxAppSpec;
  try {
    const r = engine.normalizeSpec(mergeSpecPatch(start, solution));
    solved = r.spec;
    for (const d of r.dropped) {
      out.warn('spec-dropped-key', `${path}.solution`, `"${d}" is not part of a v8 spec and is removed.`);
    }
  } catch (e) {
    out.error('spec-normalize', `${path}.solution`, `normalizeSpec threw on the solution: ${String(e)}`);
    return;
  }
  const startLen = composeLength(start);
  const solLen = composeLength(solution);
  if (solLen > 0 && solLen < startLen) {
    out.warn(
      'solution-drops-components',
      `${path}.solution.compose`,
      `The solution lists ${solLen} component(s) but the starting spec has ${startLen}. A shorter compose array REMOVES components; add {} placeholders to keep them.`,
    );
  }

  const startFacts = specFacts(engine, start);
  const solvedFacts = specFacts(engine, solved);

  let startFailsAny = false;
  let startPassesAll = true;
  each(checks, (check, i) => {
    const label = checks.length > 1 ? `${path}.requirements[${i}]` : `${path}.check`;
    const onSolved = run1(check, solvedFacts, label, env);
    if (onSolved.result && !onSolved.result.pass) {
      const why = onSolved.result.failed
        .map((f) => f.message ?? (f.check ? describeCheck(f.check) : ''))
        .join('; ');
      out.error(
        'solution-fails-check',
        label,
        `The solution does not satisfy this check: ${why || describeCheck(check)}. Merge semantics are in learn/specs.ts.`,
      );
    }
    const onStart = run1(check, startFacts, label, env);
    if (onStart.result) {
      if (!onStart.result.pass) {
        startFailsAny = true;
        startPassesAll = false;
      }
    } else {
      startPassesAll = false; // unknown: do not claim it passes
      startFailsAny = true;
    }
  });

  const knownStart = checks.every((c) => !(checkUsesLint(c) && !startFacts.lint));
  if (knownStart && startPassesAll) {
    const msg =
      'The starting spec already satisfies this, so there is nothing to fix or build. Plant the failure in the starting spec.';
    if (a.startMustFail === 'error') out.error('start-passes-check', `${path}.spec`, msg);
    else out.warn('start-passes-check', path, msg);
  } else if (a.requireOneFailing && knownStart && !startFailsAny) {
    out.error('start-passes-check', `${path}.spec`, 'The starting spec already satisfies every requirement.');
  }

  if (engine.lintSpec && solvedFacts.report && !solvedFacts.report.valid) {
    const codes = solvedFacts.report.issues.filter((i) => i.severity === 'error').map((i) => i.code);
    out.warn(
      'solution-invalid',
      `${path}.solution`,
      `The solved spec still has lint errors (${[...new Set(codes)].join(', ')}). "Show me" would leave the editor red; fix the solution.`,
    );
  }

  if (a.editable && a.editable.length > 0) {
    const touched = changedPaths(start, solved).filter((p) => !coveredByEditable(p, a.editable ?? []));
    if (touched.length > 0) {
      out.warn(
        'solution-not-editable',
        `${path}.solution`,
        `The solution changes ${touched.slice(0, 4).join(', ')} which the learner cannot edit (stage.editable).`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

function checkChallenge(c: Challenge, index: number, env: Env): void {
  const { out } = env;
  const p = `checkpoint[${index} "${c.id}"]`;

  if (!(CHALLENGE_KINDS as readonly string[]).includes(c.kind)) {
    out.error(
      'challenge-kind',
      `${p}.kind`,
      `"${c.kind}" is not a challenge kind (${CHALLENGE_KINDS.join(', ')}).`,
    );
    return;
  }
  if (c.xp !== undefined && (!Number.isFinite(c.xp) || c.xp < 1 || c.xp > 50)) {
    out.warn('challenge-xp', `${p}.xp`, `xp ${c.xp} is outside 1 to 50. The default is 10.`);
  }
  if (!c.hint && c.kind !== 'choice' && c.kind !== 'multi') {
    out.warn(
      'challenge-hint',
      `${p}.hint`,
      'No hint. A wrong answer then shows nothing that teaches the cause.',
    );
  }

  switch (c.kind) {
    case 'choice':
    case 'multi': {
      const ids = new Set<string>();
      if (c.options.length < 2) out.error('options-count', `${p}.options`, 'Needs at least 2 options.');
      if (c.options.length > 6)
        out.warn('options-count', `${p}.options`, `${c.options.length} options is a lot to read.`);
      each(c.options, (o, i) => {
        if (ids.has(o.id))
          out.error('option-duplicate', `${p}.options[${i}].id`, `Option id "${o.id}" is used twice.`);
        ids.add(o.id);
      });
      if (c.kind === 'choice') {
        if (!ids.has(c.answer))
          out.error('answer-unknown', `${p}.answer`, `Answer "${c.answer}" is not an option id.`);
        if (!c.hint) {
          const bare = c.options.filter((o) => o.id !== c.answer && !o.why);
          if (bare.length > 0) {
            out.warn(
              'wrong-no-why',
              `${p}.options`,
              `${bare.length} wrong option(s) have no \`why\` and the challenge has no \`hint\`: a wrong pick teaches nothing.`,
            );
          }
        }
      } else {
        if (c.answers.length === 0) out.error('answer-unknown', `${p}.answers`, 'Needs at least one answer.');
        for (const a of c.answers) {
          if (!ids.has(a)) out.error('answer-unknown', `${p}.answers`, `Answer "${a}" is not an option id.`);
        }
        if (new Set(c.answers).size !== c.answers.length) {
          out.error('answer-duplicate', `${p}.answers`, 'An answer is listed twice.');
        }
        if (c.answers.length === c.options.length) {
          out.warn('answers-all', `${p}.answers`, 'Every option is an answer: there is nothing to decide.');
        }
        if (!c.hint) out.warn('challenge-hint', `${p}.hint`, 'No hint for a wrong selection.');
      }
      break;
    }
    case 'order': {
      if (c.items.length < 2) out.error('items-count', `${p}.items`, 'Needs at least 2 items.');
      else if (c.items.length < 3)
        out.warn('items-count', `${p}.items`, 'Two items is a coin flip; use three or more.');
      const ids = new Set<string>();
      each(c.items, (it, i) => {
        if (ids.has(it.id))
          out.error('item-duplicate', `${p}.items[${i}].id`, `Item id "${it.id}" is used twice.`);
        ids.add(it.id);
      });
      break;
    }
    case 'match': {
      if (c.pairs.length < 2) out.error('pairs-count', `${p}.pairs`, 'Needs at least 2 pairs.');
      const ids = new Set<string>();
      const rights = new Set<string>();
      const lefts = new Set<string>();
      each(c.pairs, (pr, i) => {
        if (ids.has(pr.id))
          out.error('pair-duplicate', `${p}.pairs[${i}].id`, `Pair id "${pr.id}" is used twice.`);
        ids.add(pr.id);
        if (rights.has(pr.right)) {
          out.error(
            'pair-ambiguous',
            `${p}.pairs[${i}].right`,
            `Two pairs have the same right-hand text ("${pr.right}"): the match is ambiguous.`,
          );
        }
        rights.add(pr.right);
        if (lefts.has(pr.left)) {
          out.error(
            'pair-ambiguous',
            `${p}.pairs[${i}].left`,
            `Two pairs have the same left-hand text ("${pr.left}").`,
          );
        }
        lefts.add(pr.left);
      });
      break;
    }
    case 'spec-fix': {
      checkShape(c.check, `${p}.check`, env);
      const start = normalisePartial(c.spec, `${p}.spec`, env);
      if (!start) break;
      verifySolution({
        env,
        path: p,
        start,
        solution: c.solution,
        checks: [c.check],
        startMustFail: 'error',
      });
      break;
    }
    case 'spec-build': {
      if (c.requirements.length === 0) {
        out.error(
          'requirements-count',
          `${p}.requirements`,
          'A build challenge needs at least one requirement.',
        );
      } else if (c.requirements.length === 1) {
        out.warn(
          'requirements-count',
          `${p}.requirements`,
          'One requirement is a fix, not a build. Use two or more.',
        );
      }
      const ids = new Set<string>();
      each(c.requirements, (r, i) => {
        if (ids.has(r.id))
          out.error(
            'requirement-duplicate',
            `${p}.requirements[${i}].id`,
            `Requirement id "${r.id}" is used twice.`,
          );
        ids.add(r.id);
        checkShape(r.check, `${p}.requirements[${i}].check`, env);
      });
      const start = normalisePartial(c.spec, `${p}.spec`, env);
      if (!start) break;
      verifySolution({
        env,
        path: p,
        start,
        solution: c.solution,
        checks: c.requirements.map((r) => r.check),
        startMustFail: 'error',
        requireOneFailing: true,
      });
      break;
    }
    case 'terminal': {
      validateScript(c.script, `${p}.script`, out);
      if (!c.goals || c.goals.length === 0) out.error('task-goal', `${p}.goals`, 'Needs at least one goal.');
      const ids = new Set(c.script.goals.map((g) => g.id));
      for (const g of c.goals ?? []) {
        if (!ids.has(g))
          out.error('task-goal', `${p}.goals`, `Goal "${g}" is not in the script (${[...ids].join(', ')}).`);
      }
      break;
    }
    case 'estimate': {
      if (!(c.tolerance > 0 && c.tolerance <= 1)) {
        out.error(
          'estimate-tolerance',
          `${p}.tolerance`,
          `tolerance ${c.tolerance} must be above 0 and at most 1.`,
        );
      } else if (c.tolerance < 0.02 || c.tolerance > 0.5) {
        out.warn(
          'estimate-tolerance',
          `${p}.tolerance`,
          `tolerance ${c.tolerance} is very ${c.tolerance < 0.02 ? 'tight' : 'loose'}.`,
        );
      }
      if (c.spec) normalisePartial(c.spec, `${p}.spec`, env);
      if ((c.quantity === 'usd-per-month' || c.quantity === 'flux-per-month') && !c.spec) {
        out.error('estimate-spec', `${p}.spec`, `quantity "${c.quantity}" needs a \`spec\` to price.`);
      }
      if (c.quantity === 'number' && typeof c.value !== 'number') {
        out.error('estimate-value', `${p}.value`, 'quantity "number" needs a numeric `value`.');
      }
      if (c.quantity === 'blocks' && typeof c.value !== 'number' && !c.spec) {
        out.error(
          'estimate-value',
          `${p}.value`,
          'quantity "blocks" needs a numeric `value` (or a spec with `expire`).',
        );
      }
      const truth = estimateTruth(c, env.deps.engine);
      if (truth === null || !(truth > 0)) {
        out.error('estimate-truth', p, 'The true value could not be computed or is not positive.');
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Glossary
// ---------------------------------------------------------------------------

export interface GlossaryDeps {
  /** Every glossary id across every file (for `related`). */
  ids: ReadonlySet<string>;
  /** Lesson ids, for `lessons`. */
  lessonIds: ReadonlySet<string>;
}

const CATEGORIES = ['network', 'app', 'docker', 'money', 'ops'];

/** Rules for one glossary file: ids, word limits, references. Unique ids across files are the test's job. */
export function validateGlossary(terms: readonly GlossaryTerm[], deps: GlossaryDeps): Problem[] {
  const out = new Collector();
  each(terms, (t, i) => {
    const p = `[${i} "${t.id}"]`;
    if (!t.id || !ID_FORMAT.test(t.id))
      out.error('glossary-id', `${p}.id`, `Term id "${t.id}" must be lower-case kebab-case.`);
    if (!t.term || t.term.trim() === '')
      out.error('glossary-term', `${p}.term`, 'A term needs its display text.');
    const short = wordCount(t.short);
    if (short === 0) out.error('glossary-short', `${p}.short`, 'A term needs a short definition.');
    else if (short > 28)
      out.error('glossary-short', `${p}.short`, `${short} words. The short definition is at most 28.`);
    const why = wordCount(t.why);
    if (why === 0) out.error('glossary-why', `${p}.why`, 'A term needs a "why it matters".');
    else if (why > 40) out.error('glossary-why', `${p}.why`, `${why} words. The why is at most 40.`);
    if (!CATEGORIES.includes(t.category)) {
      out.error(
        'glossary-category',
        `${p}.category`,
        `"${t.category}" is not one of ${CATEGORIES.join(', ')}.`,
      );
    }
    for (const r of t.related ?? []) {
      if (!deps.ids.has(r))
        out.error('glossary-related', `${p}.related`, `Related term "${r}" does not exist.`);
      if (r === t.id) out.error('glossary-related', `${p}.related`, 'A term cannot be related to itself.');
    }
    for (const l of t.lessons ?? []) {
      if (!deps.lessonIds.has(l))
        out.error('glossary-lesson', `${p}.lessons`, `Lesson "${l}" does not exist.`);
    }
    if (t.docs !== undefined && !/^https:\/\//.test(t.docs)) {
      out.error('glossary-docs', `${p}.docs`, 'The docs link must be https.');
    }
    if (t.proper !== undefined && typeof t.proper !== 'boolean') {
      out.error(
        'glossary-proper',
        `${p}.proper`,
        '`proper` is true or false: a proper noun or a deliberate capital.',
      );
    }
    for (const [field, text] of [
      ['short', t.short],
      ['why', t.why],
    ] as const) {
      if (typeof text !== 'string') continue;
      if (text.includes('—')) out.error('em-dash', `${p}.${field}`, 'Contains an em dash.');
      if (/\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(text)) {
        out.error('emoji', `${p}.${field}`, 'Contains an emoji.');
      }
      if (text.includes('!')) out.error('exclamation', `${p}.${field}`, 'Contains an exclamation mark.');
    }
  });
  return out.problems;
}

function wordCount(s: string | undefined): number {
  return (s ?? '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
