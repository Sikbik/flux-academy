import { LABS, LESSONS } from '@shared/curriculum';
import { describe, expect, it } from 'vitest';
import { ART, labArt } from '@/content/art';
import type { LessonProgress } from '@/learn/store';
import { buildCopy, CHAPTERS, EXAMPLES, LAB_TAGS, labsCopy, SIMULATION_TAG } from './copy';
import {
  approxDuration,
  asOfLine,
  BENTO,
  bentoCells,
  cadence,
  chapterAtProbe,
  deployChip,
  describeChange,
  dominantSection,
  figureProgress,
  groupHex,
  INTRO_SAME_VISIT_MS,
  insetsForFree,
  litSegments,
  priceText,
  quantise,
  resumeTarget,
  sameInsets,
  shouldPlayIntro,
  tierShares,
  topCountries,
  totalMinutes,
  trackEntry,
  trackProgress,
  typedCount,
} from './logic';
import { capitalise, joinNames, numberWord } from './words';

function progress(over: Partial<LessonProgress> = {}): LessonProgress {
  return {
    step: 0,
    stepsDone: [],
    challenges: {},
    startedAt: '2026-10-12T10:00:00.000Z',
    completedAt: null,
    ...over,
  };
}

describe('resumeTarget', () => {
  it('sends a new learner to the first lesson', () => {
    const t = resumeTarget({});
    expect(t.kind).toBe('start');
    expect(t.href).toBe('/learn/what-is-flux');
  });

  it('continues the most recently started lesson that is not finished', () => {
    const t = resumeTarget({
      'what-is-flux': progress({ completedAt: '2026-10-12T10:30:00.000Z' }),
      'containers-101': progress({ startedAt: '2026-10-12T11:00:00.000Z' }),
      'how-apps-run': progress({ startedAt: '2026-10-12T12:00:00.000Z' }),
    });
    expect(t.kind).toBe('continue');
    expect(t.lessonId).toBe('how-apps-run');
    expect(t.title).toBe('From spec to running app');
  });

  it('falls back to the first unfinished lesson in path order when nothing is in progress', () => {
    const t = resumeTarget({
      'what-is-flux': progress({ completedAt: '2026-10-12T10:30:00.000Z' }),
      'how-apps-run': progress({ completedAt: '2026-10-12T10:40:00.000Z' }),
    });
    expect(t.kind).toBe('continue');
    expect(t.lessonId).toBe('containers-101');
  });

  it('points a learner who finished everything at the course map', () => {
    const all: Record<string, LessonProgress> = {};
    for (const l of LESSONS) all[l.id] = progress({ completedAt: '2026-10-12T10:30:00.000Z' });
    const t = resumeTarget(all);
    expect(t.kind).toBe('done');
    expect(t.href).toBe('/learn');
    expect(t.lessonId).toBeNull();
  });

  it('ignores lesson ids the curriculum no longer has', () => {
    const t = resumeTarget({ 'removed-lesson': progress() });
    expect(t.kind).toBe('start');
  });
});

describe('track helpers', () => {
  it('counts finished lessons per track', () => {
    const lessons = { 'what-is-flux': progress({ completedAt: '2026-10-12T10:30:00.000Z' }) };
    expect(trackProgress('cumulus', lessons)).toEqual({ done: 1, total: 4, started: true });
    expect(trackProgress('stratus', lessons)).toEqual({ done: 0, total: 8, started: false });
  });

  it('enters a track at its first unfinished lesson', () => {
    expect(trackEntry('cumulus', {})).toBe('what-is-flux');
    const lessons = {
      'what-is-flux': progress({ completedAt: 'x' }),
      'how-apps-run': progress({ completedAt: 'x' }),
    };
    expect(trackEntry('cumulus', lessons)).toBe('containers-101');
  });

  it('adds up the course length', () => {
    expect(totalMinutes()).toBe(LESSONS.reduce((s, l) => s + l.minutes, 0));
    expect(approxDuration(177)).toBe('about 3 hours');
    expect(approxDuration(45)).toBe('45 minutes');
    expect(approxDuration(0)).toBe('');
  });
});

describe('scroll helpers', () => {
  const boxes = [
    { id: 'hero' as const, top: 0, bottom: 800 },
    { id: 'story' as const, top: 800, bottom: 4000 },
    { id: 'path' as const, top: 4200, bottom: 5000 },
  ];

  it('finds the section that holds the probe line', () => {
    expect(dominantSection(boxes, 100)).toBe('hero');
    expect(dominantSection(boxes, 1500)).toBe('story');
    expect(dominantSection(boxes, 4600)).toBe('path');
  });

  it('keeps the section above while the probe is in a gap', () => {
    expect(dominantSection(boxes, 4100)).toBe('story');
  });

  it('falls back to the first section before any begins', () => {
    expect(dominantSection([{ id: 'story', top: 500, bottom: 900 }], 100)).toBe('story');
    expect(dominantSection([], 100)).toBe('hero');
  });

  it('finds the chapter being read and how far through it the probe is', () => {
    const boxes = [
      { top: 100, bottom: 500 },
      { top: 500, bottom: 900 },
      { top: 900, bottom: 1300 },
      { top: 1300, bottom: 1700 },
    ];
    expect(chapterAtProbe(boxes, 0)).toEqual({ chapter: 0, progress: 0 });
    expect(chapterAtProbe(boxes, 300)).toEqual({ chapter: 0, progress: 0.5 });
    expect(chapterAtProbe(boxes, 500)).toEqual({ chapter: 1, progress: 0 });
    expect(chapterAtProbe(boxes, 1100)).toEqual({ chapter: 2, progress: 0.5 });
    expect(chapterAtProbe(boxes, 5000)).toEqual({ chapter: 3, progress: 1 });
    expect(chapterAtProbe([], 100)).toEqual({ chapter: 0, progress: 0 });
  });

  it('holds the earlier chapter, finished, through a gap', () => {
    const boxes = [
      { top: 0, bottom: 400 },
      { top: 600, bottom: 1000 },
    ];
    expect(chapterAtProbe(boxes, 500)).toEqual({ chapter: 0, progress: 1 });
  });

  it('quantises writes', () => {
    expect(quantise(0.5004, 100)).toBe(0.5);
    expect(quantise(2)).toBe(1);
  });
});

describe('insets', () => {
  it('turns a free rect into covered fractions', () => {
    const i = insetsForFree({ left: 720, top: 90, right: 1440, bottom: 630 }, 1440, 900);
    expect(i.left).toBeCloseTo(0.5, 5);
    expect(i.right).toBeCloseTo(0, 5);
    expect(i.top).toBeCloseTo(0.1, 5);
    expect(i.bottom).toBeCloseTo(0.3, 5);
  });

  it('caps what the page may cover and tolerates a zero viewport', () => {
    const i = insetsForFree({ left: 1400, top: 0, right: 1440, bottom: 900 }, 1440, 900);
    expect(i.left).toBe(0.8);
    expect(insetsForFree({ left: 0, top: 0, right: 0, bottom: 0 }, 0, 0)).toEqual({
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    });
  });

  it('compares with a tolerance', () => {
    const a = { left: 0.5, right: 0, top: 0.1, bottom: 0.3 };
    expect(sameInsets(a, { ...a, left: 0.501 })).toBe(true);
    expect(sameInsets(a, { ...a, left: 0.55 })).toBe(false);
  });
});

describe('deployChip', () => {
  it('reads like the brief', () => {
    expect(deployChip(3, 2)).toEqual({ word: 'UP', tone: 'warn', text: 'UP, 3 instances, 2 healthy' });
    expect(deployChip(3, 3).tone).toBe('ok');
    expect(deployChip(1, 1).text).toBe('UP, 1 instance, 1 healthy');
    expect(deployChip(3, 0)).toEqual({ word: 'DOWN', tone: 'crit', text: 'DOWN, 3 instances, 0 healthy' });
    expect(deployChip(0, 0).word).toBe('EMPTY');
    expect(deployChip(2, 9).text).toBe('UP, 2 instances, 2 healthy');
    // Copies in flight are starting, not down.
    expect(deployChip(3, 0, 'Starting. 3 instances placed.')).toEqual({
      word: 'STARTING',
      tone: 'warn',
      text: 'STARTING, 3 instances',
    });
    expect(deployChip(3, 0, 'Down. 3 instances placed, none healthy.').word).toBe('DOWN');
    expect(deployChip(3, 2, 'Starting. 3 instances placed.').word).toBe('UP');
  });
});

describe('intro', () => {
  const base = { reducedMotion: false, flag: true, seenAt: null, now: 1_000_000 };

  it('plays on the first visit of a session', () => {
    expect(shouldPlayIntro(base)).toBe(true);
  });

  it('never plays for reduced motion, ?intro=0 or without a scene', () => {
    expect(shouldPlayIntro({ ...base, reducedMotion: true })).toBe(false);
    expect(shouldPlayIntro({ ...base, flag: false })).toBe(false);
    expect(shouldPlayIntro({ ...base, noScene: true })).toBe(false);
  });

  it('skips a repeat visit but tolerates a re-render of the same visit', () => {
    expect(shouldPlayIntro({ ...base, seenAt: base.now - 60_000 })).toBe(false);
    expect(shouldPlayIntro({ ...base, seenAt: base.now - (INTRO_SAME_VISIT_MS - 100) })).toBe(true);
    expect(shouldPlayIntro({ ...base, seenAt: Number.NaN })).toBe(true);
  });
});

describe('network helpers', () => {
  it('computes tier shares', () => {
    const s = tierShares({ cumulus: 3584, nimbus: 1692, stratus: 1829 });
    expect(s.map((x) => x.tier)).toEqual(['cumulus', 'nimbus', 'stratus']);
    expect(s.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 6);
    expect(s[0]?.share).toBeCloseTo(3584 / 7105, 6);
    expect(tierShares({ cumulus: 0, nimbus: 0, stratus: 0 }).every((x) => x.share === 0)).toBe(true);
  });

  it('ranks countries by node count', () => {
    const rows = topCountries(
      [
        { code: 'FR', name: 'France', nodes: 10, tiers: { cumulus: 5, nimbus: 3, stratus: 2 } },
        { code: 'DE', name: 'Germany', nodes: 30, tiers: { cumulus: 20, nimbus: 5, stratus: 5 } },
        { code: 'AT', name: 'Austria', nodes: 10, tiers: { cumulus: 5, nimbus: 3, stratus: 2 } },
      ],
      2,
    );
    expect(rows.map((r) => r.code)).toEqual(['DE', 'AT']);
    expect(rows[0]?.share).toBeCloseTo(30 / 50, 6);
  });

  it('summarises block cadence and skips the oldest block', () => {
    const c = cadence([
      { height: 1, time: 'a', intervalSec: null, txCount: null },
      { height: 2, time: 'b', intervalSec: 30, txCount: null },
      { height: 3, time: 'c', intervalSec: 34, txCount: null },
      { height: 4, time: 'd', intervalSec: 26, txCount: null },
    ]);
    expect(c.intervals).toEqual([30, 34, 26]);
    expect(c.mean).toBe(30);
    expect(c.min).toBe(26);
    expect(c.max).toBe(34);
    expect(cadence([]).mean).toBeNull();
  });
});

describe('numbers', () => {
  it('lights the block ring from progress', () => {
    expect(litSegments(0)).toBe(0);
    expect(litSegments(Number.NaN)).toBe(0);
    expect(litSegments(0.01)).toBe(1);
    expect(litSegments(0.5)).toBe(15);
    expect(litSegments(1)).toBe(30);
    expect(litSegments(3)).toBe(30);
  });

  it('describes the 24 h change', () => {
    expect(describeChange(1.954)).toMatchObject({ direction: 'up', text: '+1.95%' });
    expect(describeChange(-0.4)).toMatchObject({ direction: 'down', text: '-0.40%' });
    expect(describeChange(0.001).direction).toBe('flat');
    expect(describeChange(null)).toMatchObject({ direction: 'none', text: '--' });
  });

  it('prints a price with enough decimals, and nothing for unknown', () => {
    expect(priceText(0.0852)).toBe('$0.0852');
    expect(priceText(12.5)).toBe('$12.50');
    expect(priceText(null)).toBe('--');
  });
});

describe('authored content', () => {
  const ids = new Set(LESSONS.map((l) => l.id));

  it('links every chapter and example to a lesson that exists', () => {
    for (const c of CHAPTERS) expect(ids.has(c.lesson), c.lesson).toBe(true);
    for (const e of EXAMPLES) expect(ids.has(e.lesson), e.lesson).toBe(true);
  });

  it('keeps each chapter near forty words', () => {
    for (const c of CHAPTERS) {
      const words = c.text.split(/\s+/).length;
      // The first chapter also names the three ways to write a spec, so it runs a little longer.
      const most = c.id === 'describe' ? 56 : 46;
      expect(words, c.id).toBeGreaterThanOrEqual(34);
      expect(words, c.id).toBeLessThanOrEqual(most);
    }
  });

  it('says in the first chapter that a spec can be typed, drafted or generated', () => {
    const describeChapter = CHAPTERS.find((c) => c.id === 'describe');
    expect(describeChapter?.text).toMatch(/\btype it\b/);
    expect(describeChapter?.text).toMatch(/FluxCloud assistant/);
    expect(describeChapter?.text).toMatch(/Orbit/);
    expect(describeChapter?.text).toMatch(/Git repository/);
    // The one idea: who writes it changes, what the network receives does not.
    expect(describeChapter?.text).toMatch(/network receives an ordinary spec signed by its owner/);
  });

  it('has no dashes or emoji in user-facing copy', () => {
    const text = JSON.stringify([CHAPTERS, EXAMPLES, labsCopy(LABS), buildCopy(EXAMPLES.length)]);
    expect(text).not.toMatch(/[–—]/);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('gives every example its own lesson', () => {
    expect(new Set(EXAMPLES.map((e) => e.lesson)).size).toBe(EXAMPLES.length);
  });

  it('lists the examples in course order, so the shelf reads like the course', () => {
    const order = new Map(LESSONS.map((l) => [l.id, l.order]));
    const orders = EXAMPLES.map((e) => order.get(e.lesson) ?? Number.NaN);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('has an example for a Git repository and for an agent, each tied to its own lesson', () => {
    expect(EXAMPLES.find((e) => e.lesson === 'deploy-from-git')?.blurb).toMatch(/Orbit/);
    expect(EXAMPLES.find((e) => e.lesson === 'agents-and-mcp')?.art).toBe('lab-agent-desk');
  });
});

describe('the labs section', () => {
  it('tags every lab, so every card says what it is before you open it', () => {
    for (const lab of LABS) expect(LAB_TAGS[lab.id]?.length, lab.id).toBeGreaterThan(0);
  });

  it('has a picture for every lab and for every example', () => {
    for (const lab of LABS) expect(labArt(lab.id), lab.id).toBeTruthy();
    for (const e of EXAMPLES) expect(ART[e.art], e.id).toBeDefined();
  });

  it('spells the count of labs from the list and names the simulations from their tags', () => {
    const copy = labsCopy(LABS);
    expect(copy.title).toBe(`${capitalise(numberWord(LABS.length))} instruments you can use on their own`);
    expect(copy.listLabel).toBe(`The ${numberWord(LABS.length)} labs`);
    const sims = LABS.filter((l) => LAB_TAGS[l.id]?.includes(SIMULATION_TAG));
    expect(sims.length).toBeGreaterThan(0);
    for (const lab of sims) expect(copy.lead, lab.id).toContain(lab.title);
    expect(copy.lead).toContain(
      sims.length === 1 ? 'is a simulation and says so.' : 'are simulations and say so.',
    );
  });

  it('follows the list: a lab more or fewer changes the words, and nothing says "five"', () => {
    const base = LABS.map((l) => ({ id: l.id, title: l.title }));
    const fewer = labsCopy(base.slice(0, 5));
    const more = labsCopy([...base, { id: 'extra', title: 'Extra Lab' }]);
    expect(fewer.title).toMatch(/^Five instruments/);
    expect(fewer.listLabel).toBe('The five labs');
    expect(more.title).toMatch(/^Seven instruments/);
    // One simulation reads in the singular.
    const one = labsCopy([{ id: 'failover', title: 'Failover Lab' }], { failover: [SIMULATION_TAG] });
    expect(one.lead).toContain('The Failover Lab is a simulation and says so.');
    // No simulation, no sentence about one.
    expect(labsCopy([{ id: 'x', title: 'X' }], { x: ['Network data'] }).lead).not.toMatch(/simulation/);
  });

  it('makes the first and the last lab wide only when the cells fill whole rows', () => {
    const six = bentoCells(6);
    expect(six.map((c) => c.wide)).toEqual([true, false, false, false, false, true]);
    expect(six.map((c) => c.flip)).toEqual([false, false, false, false, false, true]);
    // Eight cells: six cards, two of them double.
    expect(six.reduce((n, c) => n + (c.wide ? 2 : 1), 0)).toBe(BENTO.columns * BENTO.rows);
    for (const count of [0, 1, 4, 5, 7, 8]) {
      expect(
        bentoCells(count).every((c) => !c.wide && !c.flip),
        String(count),
      ).toBe(true);
    }
    expect(bentoCells(5)).toHaveLength(5);
  });
});

describe('the build section', () => {
  it('spells the count of examples from the list', () => {
    const copy = buildCopy(EXAMPLES.length);
    expect(copy.title).toBe(`${capitalise(numberWord(EXAMPLES.length))} things to build, one lesson each`);
    expect(copy.listLabel).toBe(`${capitalise(numberWord(EXAMPLES.length))} things you will build`);
    expect(buildCopy(5).title).toMatch(/^Five things to build/);
  });

  it('says that nothing in the Academy deploys or spends', () => {
    expect(buildCopy(EXAMPLES.length).lead).toMatch(/Nothing in the Academy deploys or spends for you/);
  });
});

describe('number words', () => {
  it('spells whole numbers up to twenty and leaves the rest as digits', () => {
    expect(numberWord(0)).toBe('no');
    expect(numberWord(6)).toBe('six');
    expect(numberWord(7)).toBe('seven');
    expect(numberWord(20)).toBe('twenty');
    expect(numberWord(21)).toBe('21');
    expect(numberWord(-1)).toBe('-1');
    expect(numberWord(2.5)).toBe('2.5');
  });

  it('capitalises and joins in the house list style', () => {
    expect(capitalise('six')).toBe('Six');
    expect(capitalise('')).toBe('');
    expect(joinNames([])).toBe('');
    expect(joinNames(['a'])).toBe('a');
    expect(joinNames(['a', 'b'])).toBe('a and b');
    expect(joinNames(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('asOfLine', () => {
  it('says nothing for live and cached numbers', () => {
    expect(asOfLine('live', '2026-10-12T10:00:00Z')).toBeNull();
    expect(asOfLine('cache', '2026-10-12T10:00:00Z')).toBeNull();
  });

  it('dates a fallback or offline number, and says so when it cannot', () => {
    expect(asOfLine('fallback', '2026-10-12T10:00:00Z')).toMatch(/^As of .*, not live$/);
    expect(asOfLine('offline', null)).toBe('Not live');
  });
});

describe('story figures', () => {
  it('shows finished chapters whole and future ones empty', () => {
    expect(figureProgress(1, 2, 0.1)).toBe(1);
    expect(figureProgress(1, 0, 0.9)).toBe(0);
    expect(figureProgress(1, 1, 0.4)).toBe(0.4);
  });

  it('counts typed characters', () => {
    expect(typedCount(100, 0)).toBe(0);
    expect(typedCount(100, 0.45)).toBe(50);
    expect(typedCount(100, 1)).toBe(100);
    expect(typedCount(0, 0.5)).toBe(0);
  });

  it('groups a digest', () => {
    expect(groupHex('0123456789abcdef0123456789abcdef', 8, 3)).toBe('01234567 89abcdef 01234567');
    expect(groupHex('abcd', 8, 4)).toBe('abcd');
  });
});
