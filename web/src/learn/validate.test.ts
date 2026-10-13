import { LABS, LESSONS } from '@shared/curriculum';
import * as blocksMod from '@shared/flux/blocks';
import * as lintMod from '@shared/flux/lint';
import * as pricingMod from '@shared/flux/pricing';
import * as specMod from '@shared/flux/spec';
import { LIMITS } from '@shared/flux/spec';
import { describe, expect, it } from 'vitest';
import { conceptLesson, conceptMeta } from './__fixtures__/concept';
import { tourLesson, tourMeta } from './__fixtures__/tour';
import { buildEngine, type LessonEngine } from './engine';
import type { Challenge, Lesson, Step } from './types';
import { formatProblems, type Problem, validateGlossary, validateLesson } from './validate';
import { APP_SHAPE, COMPONENT_SHAPE, specPathVerdict } from './validate-spec';

const asRecord = (m: unknown) => m as Record<string, unknown>;

const engine: LessonEngine = buildEngine({
  spec: asRecord(specMod),
  pricing: asRecord(pricingMod),
  blocks: asRecord(blocksMod),
  lint: asRecord(lintMod),
  catalogue: asRecord(lintMod),
});

const deps = {
  lessons: [...LESSONS, tourMeta, conceptMeta],
  labs: LABS,
  glossary: new Set(['fluxnode', 'repotag', 'instance']),
  engine,
};

const clone = <T>(v: T): T => structuredClone(v);
const run = (l: Lesson): Problem[] => validateLesson(l, deps);
const codes = (l: Lesson): string[] => run(l).map((p) => p.code);
const errors = (l: Lesson): Problem[] => run(l).filter((p) => p.severity === 'error');
const step = (l: Lesson, id: string): Step => {
  const s = l.steps.find((x) => x.id === id);
  if (!s) throw new Error(`no step ${id}`);
  return s;
};
const chal = <T extends Challenge['kind']>(
  l: Lesson,
  id: string,
  kind: T,
): Extract<Challenge, { kind: T }> => {
  const c = l.checkpoint.find((x) => x.id === id);
  if (!c || c.kind !== kind) throw new Error(`no ${kind} challenge ${id}`);
  return c as Extract<Challenge, { kind: T }>;
};

describe('the spec path table', () => {
  it('matches the engine key lists so it cannot drift', () => {
    expect(Object.keys(APP_SHAPE).sort()).toEqual([...LIMITS.appKeys].sort());
    expect(Object.keys(COMPONENT_SHAPE).sort()).toEqual([...LIMITS.componentKeys].sort());
  });

  it('accepts real paths and rejects invented ones', () => {
    for (const ok of [
      'name',
      'instances',
      'compose[0].ports[1]',
      'compose[*].containerPorts',
      'compose.length',
      'geolocation[0]',
      'name.length',
    ]) {
      expect(specPathVerdict(ok).ok, ok).toBe(true);
    }
    for (const bad of [
      'tiered',
      'compose[0].secrets',
      'compose.name',
      'instances[0]',
      'compose[0].cpu.x',
      'a..b',
    ]) {
      expect(specPathVerdict(bad).ok, bad).toBe(false);
    }
  });
});

describe('good lessons', () => {
  it('the tour fixture has no errors and no warnings', () => {
    const problems = run(tourLesson);
    expect(formatProblems(problems.filter((p) => p.severity !== 'info'))).toBe('');
  });

  it('the concept fixture has no errors and no warnings', () => {
    const problems = run(conceptLesson);
    expect(formatProblems(problems.filter((p) => p.severity !== 'info'))).toBe('');
  });
});

describe('shape and identity', () => {
  it('rejects an id that is not in the curriculum', () => {
    const l = clone(tourLesson);
    l.id = 'not-a-lesson';
    expect(codes(l)).toContain('id-unknown');
  });

  it('enforces step, challenge, objective, recap and further counts', () => {
    const l = clone(tourLesson);
    l.steps = l.steps.slice(0, 3);
    l.checkpoint = l.checkpoint.slice(0, 1);
    l.recap = ['one'];
    l.further = [];
    l.objectives = ['one'];
    const c = codes(l);
    for (const code of [
      'steps-count',
      'challenges-count',
      'recap-count',
      'further-count',
      'objectives-count',
    ]) {
      expect(c, code).toContain(code);
    }
  });

  it('rejects duplicate and badly formatted ids', () => {
    const l = clone(tourLesson);
    l.steps[1]!.id = l.steps[0]!.id;
    l.steps[2]!.id = 'Bad Id';
    l.checkpoint[0]!.id = l.steps[3]!.id;
    const c = codes(l);
    expect(c).toContain('id-duplicate');
    expect(c).toContain('id-format');
  });

  it('requires https further links', () => {
    const l = clone(tourLesson);
    l.further = [{ label: 'x', url: 'http://docs.runonflux.com' }];
    expect(codes(l)).toContain('further-url');
    l.further = [{ label: 'x', url: 'not a url' }];
    expect(codes(l)).toContain('further-url');
  });

  it('requires two non-read tasks', () => {
    const l = clone(tourLesson);
    for (const s of l.steps) delete s.task;
    expect(codes(l)).toContain('tasks-count');
  });

  it('requires a doing challenge, except order or match in a concept lesson', () => {
    const l = clone(tourLesson);
    l.checkpoint = [
      {
        id: 'c1',
        kind: 'choice',
        prompt: 'p',
        options: [
          { id: 'a', label: 'a' },
          { id: 'b', label: 'b' },
        ],
        answer: 'a',
        explain: 'e',
      },
      {
        id: 'c2',
        kind: 'order',
        prompt: 'p',
        items: [
          { id: 'a', label: 'a' },
          { id: 'b', label: 'b' },
          { id: 'c', label: 'c' },
        ],
        explain: 'e',
        hint: 'h',
      },
    ];
    expect(codes(l)).toContain('doing-challenge');
    const concept = clone(conceptLesson);
    expect(codes(concept)).not.toContain('doing-challenge');
    concept.checkpoint = concept.checkpoint.filter((c) => c.kind === 'choice' || c.kind === 'multi');
    expect(codes(concept)).toContain('doing-challenge');
  });

  it('the first step must set a stage', () => {
    const l = clone(tourLesson);
    delete step(l, 'layers').stage;
    expect(codes(l)).toContain('first-stage');
  });
});

describe('references', () => {
  it('resolves terms, lessons and labs', () => {
    const l = clone(tourLesson);
    step(l, 'layers').body[0] = 'See {{term:nope}}, {{lesson:nope}} and {{lab:nope}}.';
    const c = codes(l);
    expect(c).toContain('term-unknown');
    expect(c).toContain('lesson-unknown');
    expect(c).toContain('lab-unknown');
  });

  it('lets a link stay inside the Academy when it names a page, and refuses a page that is not there', () => {
    const l = clone(tourLesson);
    const body = (text: string) => {
      step(l, 'layers').body[0] = text;
      return codes(l);
    };
    expect(body('See [the plans](/reference/orbit#plans) and [stuck?](/troubleshoot).')).not.toContain(
      'link-route',
    );
    expect(body('See [a page](/reference/nope).')).toContain('link-route');
    // A protocol-relative address is an external one, and external links must be https.
    expect(body('See [a site](//example.com/page).')).toContain('link-url');
    expect(body('See [a site](http://example.com/page).')).toContain('link-url');
  });

  it('rejects unknown stage kinds, diagrams and widgets', () => {
    const l = clone(tourLesson);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed content
    (step(l, 'layers') as any).stage = { kind: 'hologram' };
    step(l, 'server').stage = { kind: 'diagram', id: 'nope' };
    step(l, 'register').stage = { kind: 'widget', id: 'nope' };
    const c = codes(l);
    expect(c).toContain('stage-kind');
    expect(c).toContain('diagram-unknown');
    expect(c).toContain('widget-unknown');
  });

  it('checks diagram beats against the catalog table', () => {
    const l = clone(tourLesson);
    step(l, 'layers').stage = { kind: 'diagram', id: 'flux-layers', beat: 4 };
    expect(codes(l)).toContain('diagram-beat');
    step(l, 'layers').stage = { kind: 'diagram', id: 'flux-layers', beat: 3 };
    expect(codes(l)).not.toContain('diagram-beat');
  });

  it('prefers the diagram module beats when given', () => {
    const l = clone(tourLesson);
    step(l, 'layers').stage = { kind: 'diagram', id: 'flux-layers', beat: 3 };
    const p = validateLesson(l, { ...deps, diagramBeats: { 'flux-layers': 3 } });
    expect(p.map((x) => x.code)).toContain('diagram-beat');
  });

  it('lists terms that are never linked', () => {
    const l = clone(tourLesson);
    l.terms = ['fluxnode', 'repotag'];
    expect(codes(l)).toContain('term-unused');
  });
});

describe('specs and checks', () => {
  it('a solution that does not satisfy its check is an error', () => {
    const l = clone(tourLesson);
    const t = step(l, 'spec').task;
    if (t?.kind !== 'spec') throw new Error('fixture changed');
    t.solution = { compose: [{ containerPorts: [80] }] };
    const p = run(l).find((x) => x.code === 'solution-fails-check');
    expect(p?.severity).toBe('error');
    expect(p?.path).toContain('steps[3 "spec"]');
  });

  it('a starting spec that already passes a fix challenge is an error', () => {
    const l = clone(tourLesson);
    const c = chal(l, 'fix-ports', 'spec-fix');
    c.spec = { name: 'hello-app', compose: [{ name: 'app', ports: [31001], containerPorts: [3000] }] };
    expect(codes(l)).toContain('start-passes-check');
  });

  it('a build challenge whose start already satisfies every requirement is an error', () => {
    const l = clone(tourLesson);
    const c = chal(l, 'build-budget', 'spec-build');
    c.spec = { name: 'budget-api', instances: 3, compose: [{ name: 'app', cpu: 0.5, ram: 500, hdd: 1 }] };
    expect(codes(l)).toContain('start-passes-check');
  });

  it('a build challenge whose solution misses a requirement is an error', () => {
    const l = clone(tourLesson);
    const c = chal(l, 'build-budget', 'spec-build');
    c.solution = { instances: 2 };
    expect(codes(l)).toContain('solution-fails-check');
  });

  it('flags check paths that are not on a spec', () => {
    const l = clone(tourLesson);
    const c = chal(l, 'fix-ports', 'spec-fix');
    c.check = { path: 'compose[0].secrets', op: 'exists' };
    expect(codes(l)).toContain('check-path');
  });

  it('flags an unknown lint code, which would pass silently', () => {
    const l = clone(tourLesson);
    const c = chal(l, 'fix-ports', 'spec-fix');
    c.check = { lint: 'absent', codes: ['PORT_BANNNED'] };
    expect(codes(l)).toContain('check-lint-code');
  });

  it('flags v7 keys in a spec, which normalisation would drop', () => {
    const l = clone(tourLesson);
    const c = chal(l, 'fix-ports', 'spec-fix');
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed content
    (c.spec as any).tiered = true;
    expect(codes(l)).toContain('spec-dropped-key');
  });

  it('warns when a solution removes components', () => {
    const l = clone(tourLesson);
    const c = chal(l, 'fix-ports', 'spec-fix');
    c.spec = {
      name: 'flux-hello',
      compose: [
        { name: 'a-b', ports: [22] },
        { name: 'second', ports: [31002] },
      ],
    };
    c.solution = { name: 'hello-app', compose: [{ name: 'ab', ports: [31001] }] };
    expect(codes(l)).toContain('solution-drops-components');
  });

  it('rejects a task that needs a stage that is not in force', () => {
    const l = clone(tourLesson);
    step(l, 'place').stage = { kind: 'diagram', id: 'flux-layers' };
    expect(codes(l)).toContain('task-stage');
  });

  it('requires the diorama control a task needs', () => {
    const l = clone(tourLesson);
    const s = step(l, 'place').stage;
    if (s?.kind !== 'diorama') throw new Error('fixture changed');
    s.controls = [];
    expect(codes(l)).toContain('task-stage');
  });
});

describe('terminal scripts', () => {
  const script = (l: Lesson) => {
    const s = step(l, 'build').stage;
    if (s?.kind !== 'terminal') throw new Error('fixture changed');
    return s.script;
  };

  it('rejects a goal no command completes', () => {
    const l = clone(tourLesson);
    script(l).goals.push({ id: 'deploy', label: 'Deploy' });
    expect(codes(l)).toContain('goal-unreachable');
  });

  it('rejects a task goal that is not in the script', () => {
    const l = clone(tourLesson);
    const t = step(l, 'build').task;
    if (t?.kind !== 'terminal') throw new Error('fixture changed');
    t.goals = ['build', 'ship'];
    expect(codes(l)).toContain('task-goal');
  });

  it('rejects a pattern that does not compile', () => {
    const l = clone(tourLesson);
    script(l).commands[0]!.match = '^docker build (';
    expect(codes(l)).toContain('command-regex');
  });

  it('rejects an example that its own pattern does not accept', () => {
    const l = clone(tourLesson);
    script(l).commands[1]!.example = 'docker pull me/hello:1.0';
    expect(codes(l)).toContain('command-example');
  });

  it('rejects a command shadowed by an earlier one', () => {
    const l = clone(tourLesson);
    script(l).commands.unshift({ match: '^docker .*$', output: ['x'], example: 'docker anything' });
    const c = codes(l);
    expect(c).toContain('command-shadowed');
  });
});

describe('text hygiene', () => {
  const textCases: [string, string, string][] = [
    ['em dash', 'A step — with a dash.', 'em-dash'],
    ['exclamation', 'This is exciting!', 'exclamation'],
    ['emoji', 'Ship it \u{1F680}.', 'emoji'],
    ['unbalanced bold', 'This is **not closed.', 'markup'],
    ['unbalanced code', 'This `is not closed.', 'markup'],
    ['unclosed directive', 'This {{term:fluxnode is not closed.', 'markup'],
    ['html', 'Use <div> here.', 'html'],
  ];

  for (const [name, text, code] of textCases) {
    it(`flags ${name}`, () => {
      const l = clone(tourLesson);
      step(l, 'layers').body[1] = text;
      expect(codes(l)).toContain(code);
    });
  }

  it('accepts the term modifiers and still checks the term exists', () => {
    const l = clone(tourLesson);
    step(l, 'layers').body[1] = 'Your only {{term:instance|lower}} and {{term:fluxnode|Cap}} are fine.';
    expect(codes(l)).not.toContain('markup');
    expect(codes(l)).not.toContain('term-unknown');
    step(l, 'layers').body[1] = 'Your only {{term:nope|lower}} is not in the glossary.';
    expect(codes(l)).toContain('term-unknown');
  });

  it('flags an unknown or empty term modifier', () => {
    for (const text of [
      'Your {{term:instance|shout}} is wrong.',
      'Your {{term:instance|}} is wrong.',
      'Your {{lesson:first-deploy|lower}} is wrong.',
    ]) {
      const l = clone(tourLesson);
      step(l, 'layers').body[1] = text;
      expect(codes(l), text).toContain('markup');
    }
  });

  it('allows an exclamation mark inside code', () => {
    const l = clone(tourLesson);
    step(l, 'layers').body[1] = 'Compare with `a != b` in your shell.';
    expect(codes(l)).not.toContain('exclamation');
  });

  it('flags a paragraph over 90 words', () => {
    const l = clone(tourLesson);
    step(l, 'layers').body[1] = Array.from({ length: 91 }, (_, i) => `word${i}`).join(' ');
    expect(codes(l)).toContain('paragraph-length');
    step(l, 'layers').body[1] = Array.from({ length: 90 }, (_, i) => `word${i}`).join(' ');
    expect(codes(l)).not.toContain('paragraph-length');
  });

  it('flags a hook of three sentences', () => {
    const l = clone(tourLesson);
    l.hook = 'One thing. Two things. Three things.';
    expect(codes(l)).toContain('hook-length');
  });

  it('flags em dashes and emoji in code and terminal output too', () => {
    const l = clone(tourLesson);
    const s = step(l, 'build').stage;
    if (s?.kind !== 'terminal') throw new Error('fixture changed');
    s.script.commands[0]!.output.push('built — done');
    expect(codes(l)).toContain('em-dash');
  });
});

describe('challenge kinds', () => {
  it('validates choice, multi, order and match structure', () => {
    const l = clone(conceptLesson);
    chal(l, 'blocks-time', 'choice').answer = 'z';
    chal(l, 'tier-members', 'multi').answers = ['cumulus', 'nope'];
    chal(l, 'tier-order', 'order').items[1]!.id = 'cumulus';
    chal(l, 'tier-match', 'match').pairs[1]!.right = '1,000 FLUX';
    const c = codes(l);
    expect(c).toContain('answer-unknown');
    expect(c).toContain('item-duplicate');
    expect(c).toContain('pair-ambiguous');
  });

  it('validates estimate', () => {
    const l = clone(tourLesson);
    const c = chal(l, 'estimate-price', 'estimate');
    c.tolerance = 0;
    expect(codes(l)).toContain('estimate-tolerance');
    c.tolerance = 0.1;
    delete c.spec;
    expect(codes(l)).toContain('estimate-spec');
  });

  it('validates terminal challenge goals', () => {
    const l = clone(tourLesson);
    chal(l, 'terminal-images', 'terminal').goals = ['nope'];
    expect(codes(l)).toContain('task-goal');
  });

  it('warns on too much multiple choice', () => {
    const l = clone(conceptLesson);
    const choice = chal(l, 'blocks-time', 'choice');
    const multi = chal(l, 'tier-members', 'multi');
    const order = chal(l, 'tier-order', 'order');
    const match = chal(l, 'tier-match', 'match');
    l.checkpoint = [choice, order, match];
    expect(codes(l)).not.toContain('choice-ratio');
    l.checkpoint = [choice, multi, order];
    expect(codes(l)).toContain('choice-ratio');
  });
});

describe('glossary validation', () => {
  const ok = {
    id: 'fluxnode',
    term: 'FluxNode',
    short: 'A server run by an independent operator that hosts apps for the network.',
    why: 'Your app runs on these machines, so their failure is normal and planned for.',
    category: 'network' as const,
  };
  const g = { ids: new Set(['fluxnode', 'collateral']), lessonIds: new Set(LESSONS.map((l) => l.id)) };

  it('accepts a good term', () => {
    expect(validateGlossary([ok], g)).toEqual([]);
  });

  it('accepts the proper flag as a boolean only', () => {
    expect(validateGlossary([{ ...ok, proper: true }], g)).toEqual([]);
    const bad = { ...ok, proper: 'yes' } as unknown as typeof ok;
    expect(validateGlossary([bad], g).map((x) => x.code)).toContain('glossary-proper');
  });

  it('enforces word limits and references', () => {
    const long = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ');
    const p = validateGlossary(
      [
        { ...ok, short: long },
        {
          ...ok,
          id: 'x',
          why: Array.from({ length: 41 }, (_, i) => `w${i}`).join(' '),
          related: ['missing'],
          lessons: ['missing'],
        },
        { ...ok, id: 'Bad Id', short: 'Has an em dash — here.' },
      ],
      g,
    ).map((x) => x.code);
    expect(p).toContain('glossary-short');
    expect(p).toContain('glossary-why');
    expect(p).toContain('glossary-related');
    expect(p).toContain('glossary-lesson');
    expect(p).toContain('glossary-id');
    expect(p).toContain('em-dash');
  });
});

describe('validator robustness', () => {
  it('never throws on a mangled lesson', () => {
    const l = clone(tourLesson) as unknown as Record<string, unknown>;
    l.steps = [{ id: 1, body: null, stage: { kind: 'spec' } }];
    expect(() => validateLesson(l as unknown as Lesson, deps)).not.toThrow();
    expect(errors(l as unknown as Lesson).length).toBeGreaterThan(0);
  });
});
