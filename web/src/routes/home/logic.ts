/**
 * Pure logic for the home page. No React, no DOM, no clock reads: every time-dependent helper takes its
 * inputs, so each one is tested in node (logic.test.ts).
 */

import type { BlockSummary, GeoCountry, TierCounts } from '@shared/api';
import { LESSONS, type TrackId } from '@shared/curriculum';
import type { LessonProgress } from '@/learn/store';
import { formatDateShort } from '@/lib/format';
import type { SceneSection } from '@/scenes/bus';

// ---------------------------------------------------------------------------
// Where "Start the course" goes
// ---------------------------------------------------------------------------

export const FIRST_LESSON = 'what-is-flux';

export interface ResumeTarget {
  /** `start` nothing done yet, `continue` there is a next lesson, `done` every lesson is complete. */
  kind: 'start' | 'continue' | 'done';
  href: string;
  /** The lesson the button leads to (null when the whole course is done). */
  lessonId: string | null;
  title: string | null;
}

function orderedLessons() {
  return [...LESSONS].sort((a, b) => a.order - b.order);
}

/**
 * Where the primary call to action should go. A lesson that was started and not finished wins (the most
 * recently started one); otherwise the first unfinished lesson in the recommended path; a brand new
 * learner starts at the first lesson; a learner who finished everything is sent to the course map.
 */
export function resumeTarget(lessons: Record<string, LessonProgress>): ResumeTarget {
  const known = new Set(LESSONS.map((l) => l.id));
  const entries = Object.entries(lessons).filter(([id]) => known.has(id));
  const inProgress = entries
    .filter(([, p]) => !p.completedAt)
    .sort(([, a], [, b]) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const top = inProgress[0];
  if (top) {
    const meta = LESSONS.find((l) => l.id === top[0]);
    return { kind: 'continue', href: `/learn/${top[0]}`, lessonId: top[0], title: meta?.title ?? null };
  }
  const doneCount = entries.filter(([, p]) => p.completedAt).length;
  if (doneCount === 0) {
    const first = LESSONS.find((l) => l.id === FIRST_LESSON);
    return {
      kind: 'start',
      href: `/learn/${FIRST_LESSON}`,
      lessonId: FIRST_LESSON,
      title: first?.title ?? null,
    };
  }
  const next = orderedLessons().find((l) => !lessons[l.id]?.completedAt);
  if (!next) return { kind: 'done', href: '/learn', lessonId: null, title: null };
  return { kind: 'continue', href: `/learn/${next.id}`, lessonId: next.id, title: next.title };
}

/** Lessons finished and the total, for one track. */
export function trackProgress(
  track: TrackId,
  lessons: Record<string, LessonProgress>,
): { done: number; total: number; started: boolean } {
  const ls = LESSONS.filter((l) => l.track === track);
  const done = ls.filter((l) => lessons[l.id]?.completedAt).length;
  const started = ls.some((l) => lessons[l.id] !== undefined);
  return { done, total: ls.length, started };
}

/** The lesson a track card leads to: its first unfinished lesson, or its first lesson when all are done. */
export function trackEntry(track: TrackId, lessons: Record<string, LessonProgress>): string {
  const ls = LESSONS.filter((l) => l.track === track).sort((a, b) => a.order - b.order);
  const next = ls.find((l) => !lessons[l.id]?.completedAt) ?? ls[0];
  return next ? next.id : FIRST_LESSON;
}

/** Total minutes across the whole curriculum. */
export function totalMinutes(): number {
  return LESSONS.reduce((sum, l) => sum + l.minutes, 0);
}

/** "about 3 hours" for 177 minutes; whole minutes under an hour and a half. */
export function approxDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 90) return `${Math.round(minutes)} minutes`;
  const hours = Math.round(minutes / 60);
  return `about ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

// ---------------------------------------------------------------------------
// The labs bento
// ---------------------------------------------------------------------------

/**
 * The shape labs.module.css is composed for: four columns by two rows, eight cells. Six labs fill it when two
 * of them take two cells each. Keep these three in step with the stylesheet.
 */
export const BENTO = { columns: 4, rows: 2, wideCards: 2 } as const;

export interface BentoCell {
  /** A two cell card: the picture beside the words. */
  wide: boolean;
  /** The picture on the right: the last wide card mirrors the first, so the pair sits on a diagonal. */
  flip: boolean;
}

/**
 * Which of `count` labs are wide. The first and the last are, but only when the cells add up to whole rows
 * (`BENTO`); with any other count every card is one cell and the grid simply wraps (at worst the last row is
 * short), so a lab added later shows up and nothing is hidden or stretched out of shape.
 */
export function bentoCells(count: number): BentoCell[] {
  const n = Math.max(0, Math.floor(count));
  const composed = n + BENTO.wideCards === BENTO.columns * BENTO.rows;
  return Array.from({ length: n }, (_, i) => {
    const wide = composed && (i === 0 || i === n - 1);
    return { wide, flip: wide && i === n - 1 };
  });
}

// ---------------------------------------------------------------------------
// Scroll: which section is on screen, and the story's chapter
// ---------------------------------------------------------------------------

export interface SectionBox {
  id: SceneSection;
  top: number;
  bottom: number;
}

/**
 * The section that holds the probe line (viewport y, in px). Between sections the one just above wins, so
 * the answer never flickers through a gap; before the first section it is the first.
 */
export function dominantSection(boxes: readonly SectionBox[], probe: number): SceneSection {
  let found: SceneSection | null = null;
  let above: SceneSection | null = null;
  for (const b of boxes) {
    if (b.top <= probe && probe < b.bottom) found = b.id;
    if (b.top <= probe) above = b.id;
  }
  return found ?? above ?? boxes[0]?.id ?? 'hero';
}

export const clamp01 = (n: number): number => (Number.isFinite(n) ? (n <= 0 ? 0 : n > 1 ? 1 : n) : 0);

export interface ChapterBox {
  top: number;
  bottom: number;
}

export interface ChapterState {
  chapter: 0 | 1 | 2 | 3;
  /** 0 to 1 within the chapter. */
  progress: number;
}

/**
 * The chapter that holds the probe line (viewport y, px) and how far the probe has travelled through it.
 * Above the first chapter it is chapter 0 at 0; below the last it is the last chapter at 1; in a gap
 * between two chapters it is the earlier one, finished. The chapters are the real text blocks, so the
 * scene is always on the chapter that is being read.
 */
export function chapterAtProbe(boxes: readonly ChapterBox[], probe: number): ChapterState {
  const last = Math.min(3, boxes.length - 1);
  if (last < 0) return { chapter: 0, progress: 0 };
  let found = -1;
  for (let i = 0; i <= last; i++) {
    const b = boxes[i];
    if (b && b.top <= probe) found = i;
  }
  if (found < 0) return { chapter: 0, progress: 0 };
  const b = boxes[found] as ChapterBox;
  const h = b.bottom - b.top;
  const progress = h > 0 ? clamp01((probe - b.top) / h) : 1;
  return { chapter: found as 0 | 1 | 2 | 3, progress };
}

/** Snaps a progress value to steps so a scroll does not write the bus on every pixel. */
export function quantise(n: number, steps = 400): number {
  return Math.round(clamp01(n) * steps) / steps;
}

// ---------------------------------------------------------------------------
// Insets: how much of the stage the page covers
// ---------------------------------------------------------------------------

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const ZERO_INSETS: Insets = { left: 0, right: 0, top: 0, bottom: 0 };

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The covered fractions of a viewport-sized stage when the free area is `free` (a rect in viewport
 * coordinates). Everything outside the free rect is "covered by the page".
 */
export function insetsForFree(free: RectLike, vw: number, vh: number): Insets {
  if (!(vw > 0) || !(vh > 0)) return ZERO_INSETS;
  const cap = 0.8;
  const f = (n: number) => Math.min(cap, Math.max(0, n));
  return {
    left: f(free.left / vw),
    right: f(1 - free.right / vw),
    top: f(free.top / vh),
    bottom: f(1 - free.bottom / vh),
  };
}

export function sameInsets(a: Insets, b: Insets, eps = 0.004): boolean {
  return (
    Math.abs(a.left - b.left) < eps &&
    Math.abs(a.right - b.right) < eps &&
    Math.abs(a.top - b.top) < eps &&
    Math.abs(a.bottom - b.bottom) < eps
  );
}

// ---------------------------------------------------------------------------
// The deploy status chip
// ---------------------------------------------------------------------------

export type DeployTone = 'ok' | 'warn' | 'crit' | 'off';

export interface DeployChip {
  word: 'UP' | 'DOWN' | 'EMPTY' | 'STARTING';
  tone: DeployTone;
  /** For example `UP, 3 instances, 2 healthy`. */
  text: string;
}

const noun = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * `UP, 3 instances, 2 healthy`. Amber while up but degraded, red while down, grey with nothing placed.
 * Copies are "in flight" for a moment after they are asked for: the scene says so in its status sentence
 * (`Starting. 3 instances placed.`), and that must not read as an outage, so the sentence is consulted.
 */
export function deployChip(placed: number, healthy: number, status = ''): DeployChip {
  if (placed <= 0) return { word: 'EMPTY', tone: 'off', text: 'EMPTY, no instances placed' };
  const h = Math.max(0, Math.min(placed, healthy));
  if (h === 0 && /^starting\b/i.test(status.trim())) {
    return { word: 'STARTING', tone: 'warn', text: `STARTING, ${noun(placed, 'instance', 'instances')}` };
  }
  if (h === 0)
    return { word: 'DOWN', tone: 'crit', text: `DOWN, ${noun(placed, 'instance', 'instances')}, 0 healthy` };
  return {
    word: 'UP',
    tone: h === placed ? 'ok' : 'warn',
    text: `UP, ${noun(placed, 'instance', 'instances')}, ${h} healthy`,
  };
}

// ---------------------------------------------------------------------------
// The intro
// ---------------------------------------------------------------------------

/** Replays within this window count as the same visit (a re-render, an HMR reload), not a repeat. */
export const INTRO_SAME_VISIT_MS = 5000;

export interface IntroInput {
  reducedMotion: boolean;
  /** `?intro=0` sets this to false. */
  flag: boolean;
  /** Epoch ms stored in sessionStorage when the intro last played in this session, or null. */
  seenAt: number | null;
  now: number;
  /** The quality tier forced to none (`?q=none`): there is no scene to ignite, so there is no intro. */
  noScene?: boolean;
}

export function shouldPlayIntro(i: IntroInput): boolean {
  if (i.reducedMotion || !i.flag || i.noScene) return false;
  if (i.seenAt === null || !Number.isFinite(i.seenAt)) return true;
  return i.now - i.seenAt < INTRO_SAME_VISIT_MS;
}

// ---------------------------------------------------------------------------
// The live network: tier gauges, cadence, countries
// ---------------------------------------------------------------------------

export interface TierShare {
  tier: TrackId;
  count: number;
  /** 0..1 of the total. */
  share: number;
}

export function tierShares(tiers: TierCounts, total?: number): TierShare[] {
  const sum = tiers.cumulus + tiers.nimbus + tiers.stratus;
  const denom = total && total > 0 ? total : sum;
  const order: TrackId[] = ['cumulus', 'nimbus', 'stratus'];
  return order.map((tier) => ({
    tier,
    count: tiers[tier],
    share: denom > 0 ? tiers[tier] / denom : 0,
  }));
}

export interface CountryRow {
  code: string;
  name: string;
  nodes: number;
  tiers: TierCounts;
  /** 0..1 of the nodes with a known location. */
  share: number;
}

/** The `n` countries with the most nodes, with their share of the located nodes. */
export function topCountries(countries: readonly GeoCountry[], n: number, located?: number): CountryRow[] {
  const total = located && located > 0 ? located : countries.reduce((s, c) => s + c.nodes, 0);
  return [...countries]
    .sort((a, b) => b.nodes - a.nodes || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, n))
    .map((c) => ({
      code: c.code,
      name: c.name,
      nodes: c.nodes,
      tiers: c.tiers,
      share: total > 0 ? c.nodes / total : 0,
    }));
}

export interface Cadence {
  /** Seconds between consecutive blocks, oldest first. */
  intervals: number[];
  mean: number | null;
  min: number | null;
  max: number | null;
}

/** The block-to-block intervals the server reported (the oldest block has none), with their mean. */
export function cadence(blocks: readonly BlockSummary[], last = 60): Cadence {
  const intervals: number[] = [];
  for (const b of blocks.slice(-last)) {
    if (b.intervalSec !== null && Number.isFinite(b.intervalSec) && b.intervalSec > 0) {
      intervals.push(b.intervalSec);
    }
  }
  if (intervals.length === 0) return { intervals, mean: null, min: null, max: null };
  const sum = intervals.reduce((s, v) => s + v, 0);
  return {
    intervals,
    mean: sum / intervals.length,
    min: Math.min(...intervals),
    max: Math.max(...intervals),
  };
}

// ---------------------------------------------------------------------------
// The next-block ring and numbers
// ---------------------------------------------------------------------------

/** Cells in the next-block ring: five along each edge of the hexagon, one per second of the target. */
export const RING_SEGMENTS = 30;

/**
 * Ring cells lit for a block interval that is `progress` (0..1) elapsed. The cell being filled counts, so
 * the ring is never empty while a block is in flight, and it holds full while a block is overdue. Zero and
 * unknown are an empty ring.
 */
export function litSegments(progress: number, segments: number = RING_SEGMENTS): number {
  if (!Number.isFinite(progress) || progress <= 0) return 0;
  return Math.min(segments, Math.ceil(clamp01(progress) * segments));
}

export interface ChangeView {
  direction: 'up' | 'down' | 'flat' | 'none';
  /** `+1.95%`, `-0.40%`, `0.00%` or `--`. */
  text: string;
  /** A sentence for assistive tech. */
  spoken: string;
}

/** The 24 h change as a direction and a signed label. Unknown is `none`, never zero. */
export function describeChange(pct: number | null | undefined, digits = 2): ChangeView {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) {
    return { direction: 'none', text: '--', spoken: 'Change over 24 hours unknown' };
  }
  const shown = Number(Math.abs(pct).toFixed(digits));
  if (shown === 0)
    return { direction: 'flat', text: `${(0).toFixed(digits)}%`, spoken: 'Unchanged over 24 hours' };
  const up = pct > 0;
  return {
    direction: up ? 'up' : 'down',
    text: `${up ? '+' : '-'}${shown.toFixed(digits)}%`,
    spoken: `${up ? 'Up' : 'Down'} ${shown.toFixed(digits)} percent over 24 hours`,
  };
}

/** USD with four decimals under a dollar and two above: 0.0852 -> "$0.0852". Null is `--`. */
export function priceText(usd: number | null | undefined): string {
  if (usd === null || usd === undefined || !Number.isFinite(usd)) return '--';
  return `$${usd.toFixed(Math.abs(usd) < 1 ? 4 : 2)}`;
}

// ---------------------------------------------------------------------------
// The status sentence (what the scene writes, and what the calm bench writes)
// ---------------------------------------------------------------------------

/** `Up. 3 instances placed, 2 healthy.` Suitable for a polite live region. */
export function statusSentence(placed: number, healthy: number): string {
  if (placed <= 0) return 'Empty. No instances placed.';
  const h = Math.max(0, Math.min(placed, healthy));
  const word = h === 0 ? 'Down' : 'Up';
  const p = `${placed} ${placed === 1 ? 'instance' : 'instances'} placed`;
  return h === 0 ? `${word}. ${p}, none healthy.` : `${word}. ${p}, ${h} healthy.`;
}

// ---------------------------------------------------------------------------
// Honest labels for numbers that are not live
// ---------------------------------------------------------------------------

/**
 * The "as of" line a fallback or offline number owes the reader, or null when the number is live or
 * cached. `asOf` is the ISO time the numbers were taken.
 */
export function asOfLine(status: string, asOf: string | null): string | null {
  if (status !== 'fallback' && status !== 'offline') return null;
  const d = asOf ? formatDateShort(asOf, '') : '';
  return d ? `As of ${d}, not live` : 'Not live';
}

// ---------------------------------------------------------------------------
// The story figures
// ---------------------------------------------------------------------------

/** How much of a chapter's figure to show: finished chapters are whole, future ones are empty. */
export function figureProgress(chapter: number, active: number, progress: number): number {
  if (active > chapter) return 1;
  if (active < chapter) return 0;
  return clamp01(progress);
}

/** The characters of `text` shown at progress `p` of a typing animation that finishes at `end` (0..1). */
export function typedCount(length: number, p: number, end = 0.9): number {
  if (!(length > 0) || !(end > 0)) return 0;
  return Math.min(length, Math.floor(clamp01(p / end) * length));
}

/** Groups a hex digest for reading: `9f2c41aa 07bed3c1`. */
export function groupHex(hex: string, size = 8, groups = 4): string {
  const out: string[] = [];
  for (let i = 0; i < groups; i++) {
    const g = hex.slice(i * size, (i + 1) * size);
    if (g) out.push(g);
  }
  return out.join(' ');
}
