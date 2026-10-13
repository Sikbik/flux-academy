/**
 * The pure half of the block converter: reading the lesson's `case`, the linked units, the answer a case
 * expects and how a typed answer is graded. No React, no DOM. Every number comes from `@shared/flux`
 * (FACTS 5.1 and 5.3: 30 s blocks, 88,000 blocks to a pricing month, 1,056,000 at most; FACTS 4.4: the
 * duration discounts), so nothing here is typed in by hand.
 */

import {
  BLOCKS_PER_MONTH,
  blocksPerDay,
  blocksToDays,
  blocksToMonths,
  blocksToSeconds,
  DURATION_DISCOUNTS,
  daysToBlocks,
  durationDiscount,
  expiryHeight,
  humanDuration,
  MAX_EXPIRE_BLOCKS,
  monthsToBlocks,
  secondsToBlocks,
  TARGET_BLOCK_SEC,
} from '@shared/flux';

export type CaseKind = 'months-to-blocks' | 'blocks-to-days' | 'expiry-height';
export type Field = 'months' | 'days' | 'hours' | 'blocks';

export interface ConverterCase {
  kind: CaseKind;
  /** Months, blocks, or the subscription length in blocks, by kind. */
  value: number;
  /** For `expiry-height`: the block the app was registered or last updated at. */
  startHeight?: number;
}

export interface ConverterConfig {
  case: ConverterCase | null;
  /** Without a case: the number of blocks the learner should reach. */
  target: number | null;
}

/** A registration height used when a lesson names none: the chain at the time the facts were checked. */
// source: docs/research/FACTS.md (live chain checked 2026-10-12, block height about 3,031,000)
export const SAMPLE_START_HEIGHT = 3_030_000;

export const FIELDS: readonly Field[] = ['months', 'days', 'hours', 'blocks'];

/** The longest subscription an app may be registered or updated with, in blocks. */
export const LONGEST_BLOCKS = MAX_EXPIRE_BLOCKS;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function positive(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function isKind(v: unknown): v is CaseKind {
  return v === 'months-to-blocks' || v === 'blocks-to-days' || v === 'expiry-height';
}

/**
 * `{ case: { kind: 'months-to-blocks', value: 6 } }`,
 * `{ case: { kind: 'expiry-height', value: 264000, startHeight: 3030000 } }` or `{ target: 264000 }`.
 */
export function readConfig(props: Record<string, unknown> | undefined): ConverterConfig {
  const raw = props?.case;
  let parsed: ConverterCase | null = null;
  if (isRecord(raw) && isKind(raw.kind)) {
    const value = positive(raw.value);
    if (value !== null) {
      parsed = { kind: raw.kind, value };
      if (raw.kind === 'expiry-height') {
        const start = positive(raw.startHeight);
        parsed.startHeight = start === null ? SAMPLE_START_HEIGHT : Math.round(start);
      }
    }
  }
  return { case: parsed, target: parsed ? null : positive(props?.target) };
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/** Blocks for a value in a unit. Months are pricing months (88,000 blocks), not calendar months. */
export function toBlocks(field: Field, n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  switch (field) {
    case 'months':
      return monthsToBlocks(n);
    case 'days':
      return daysToBlocks(n);
    case 'hours':
      return secondsToBlocks(n * 3600);
    case 'blocks':
      return Math.round(n);
  }
}

/** The value of a number of blocks in a unit. */
export function fromBlocks(field: Field, blocks: number): number {
  switch (field) {
    case 'months':
      return blocksToMonths(blocks);
    case 'days':
      return blocksToDays(blocks);
    case 'hours':
      return blocksToSeconds(blocks) / 3600;
    case 'blocks':
      return blocks;
  }
}

const DECIMALS: Record<Field, number> = { months: 2, days: 2, hours: 1, blocks: 0 };

/** A number for display in its field: grouped, with as few decimals as it needs. */
export function formatField(field: Field, n: number): string {
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: DECIMALS[field] }).format(n);
}

export const grouped = (n: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n));

/** Parse what a learner typed: commas, spaces and underscores are ignored, one decimal point is allowed. */
export function parseNumber(text: string): number | null {
  const t = text.replace(/[\s,_]/g, '');
  if (t === '' || !/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Constants and discounts
// ---------------------------------------------------------------------------

export interface Constant {
  label: string;
  value: string;
}

/** The constants a conversion rests on, worded for the panel. */
export function constants(): Constant[] {
  return [
    { label: 'One block', value: `about ${TARGET_BLOCK_SEC} seconds` },
    { label: 'One hour', value: `${grouped(secondsToBlocks(3600))} blocks` },
    { label: 'One day', value: `${grouped(blocksPerDay())} blocks` },
    {
      label: 'One subscription month',
      value: `${grouped(BLOCKS_PER_MONTH)} blocks, about ${humanDuration(blocksToSeconds(BLOCKS_PER_MONTH))}`,
    },
    {
      label: 'The longest subscription',
      value: `${grouped(MAX_EXPIRE_BLOCKS)} blocks, ${grouped(blocksToMonths(MAX_EXPIRE_BLOCKS))} months`,
    },
  ];
}

export interface DiscountBand {
  fromMonths: number;
  toMonths: number;
  label: string;
}

/** The duration discount bands from 0 to the longest subscription, lowest first, including "none". */
export function discountBands(): DiscountBand[] {
  const max = blocksToMonths(MAX_EXPIRE_BLOCKS);
  const asc = [...DURATION_DISCOUNTS].sort((a, b) => a.minMonths - b.minMonths);
  const first = asc[0]?.minMonths ?? max;
  const bands: DiscountBand[] = [{ fromMonths: 0, toMonths: first, label: 'none' }];
  asc.forEach((d, i) => {
    bands.push({ fromMonths: d.minMonths, toMonths: asc[i + 1]?.minMonths ?? max, label: d.label });
  });
  return bands;
}

/** The discount label for a number of blocks, or null below the first band. */
export function discountFor(blocks: number): string | null {
  return durationDiscount(blocksToMonths(blocks))?.label ?? null;
}

/** Where a number of blocks sits on the 0 to 12 months bar, 0 to 1. */
export function barPosition(blocks: number): number {
  if (!Number.isFinite(blocks) || blocks <= 0) return 0;
  return Math.min(1, blocks / MAX_EXPIRE_BLOCKS);
}

// ---------------------------------------------------------------------------
// Cases: the question, the expected answer, the grading
// ---------------------------------------------------------------------------

export interface Question {
  /** The task, as a sentence. */
  prompt: string;
  /** The unit the answer is in, for the field's suffix. */
  unit: string;
  /** The expected answer. */
  answer: number;
  /** A field the learner can use to compute it. */
  tool: string;
}

function monthsText(n: number): string {
  const t = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  return `${t} ${n === 1 ? 'month' : 'months'}`;
}

export function questionFor(c: ConverterCase): Question {
  switch (c.kind) {
    case 'months-to-blocks':
      return {
        prompt: `Convert ${monthsText(c.value)} into blocks.`,
        unit: 'blocks',
        answer: monthsToBlocks(c.value),
        tool: 'Set the months field and read the blocks.',
      };
    case 'blocks-to-days':
      return {
        prompt: `How many days is ${grouped(c.value)} blocks?`,
        unit: 'days',
        answer: blocksToDays(c.value),
        tool: 'Set the blocks field and read the days.',
      };
    case 'expiry-height': {
      const start = c.startHeight ?? SAMPLE_START_HEIGHT;
      return {
        prompt: `An app registered at block ${grouped(start)} has a subscription of ${grouped(c.value)} blocks. At which block height does it end?`,
        unit: 'block height',
        answer: expiryHeight(start, c.value),
        tool: 'Add the length to the registration height below.',
      };
    }
  }
}

export interface Grade {
  ok: boolean;
  /** What was read from the text, or null when it was not a number. */
  value: number | null;
  /** Feedback for a wrong answer; never the answer itself. */
  hint: string;
}

/** Tolerance of a numeric answer: exact for blocks and heights, a rounded decimal for days. */
function within(c: ConverterCase, value: number, expected: number): boolean {
  if (c.kind === 'blocks-to-days') return Math.abs(value - expected) <= Math.max(0.05, expected * 0.002);
  return Math.round(value) === expected && Math.abs(value - expected) < 0.5;
}

export function gradeAnswer(c: ConverterCase, text: string): Grade {
  const q = questionFor(c);
  const value = parseNumber(text);
  if (value === null) {
    return { ok: false, value: null, hint: 'Type a number. Commas and spaces are fine.' };
  }
  if (within(c, value, q.answer)) return { ok: true, value, hint: '' };

  const near = (a: number) => Math.abs(value - a) < 0.5;
  switch (c.kind) {
    case 'months-to-blocks': {
      if (near(c.value)) {
        return {
          ok: false,
          value,
          hint: 'That is the number of months. Multiply it by the blocks in one month.',
        };
      }
      if (near(c.value * 30 * blocksPerDay())) {
        return {
          ok: false,
          value,
          hint: 'That counts 30 calendar days of blocks. A subscription month is a little longer: see the constants.',
        };
      }
      return {
        ok: false,
        value,
        hint: 'Not yet. Find the blocks in one month, then scale it by the months.',
      };
    }
    case 'blocks-to-days': {
      const hours = c.value / secondsToBlocks(3600);
      if (Math.abs(value - hours) <= Math.max(0.05, hours * 0.002)) {
        return { ok: false, value, hint: 'That is hours. A day is 24 hours.' };
      }
      if (Math.abs(value - blocksToSeconds(c.value) / 60) < 0.5) {
        return { ok: false, value, hint: 'That is minutes. Convert to days.' };
      }
      return { ok: false, value, hint: 'Not yet. A day holds a fixed number of blocks: see the constants.' };
    }
    case 'expiry-height': {
      const start = c.startHeight ?? SAMPLE_START_HEIGHT;
      if (near(c.value)) {
        return {
          ok: false,
          value,
          hint: 'That is the length. The end is the registration height plus the length.',
        };
      }
      if (near(start)) {
        return { ok: false, value, hint: 'That is where it starts. Add the length of the subscription.' };
      }
      return {
        ok: false,
        value,
        hint: 'Not yet. Add the subscription length, in blocks, to the registration height.',
      };
    }
  }
}

/** The answer as the field would show it: what "Show me" types. */
export function answerText(c: ConverterCase): string {
  const q = questionFor(c);
  if (c.kind === 'blocks-to-days') return String(Math.round(q.answer * 10) / 10);
  return String(q.answer);
}

// ---------------------------------------------------------------------------
// The expiry calculator
// ---------------------------------------------------------------------------

export interface Expiry {
  /** The height the subscription ends at. */
  height: number;
  /** Blocks from the current tip to that height, or null when the tip is not known. */
  fromNow: number | null;
  /** True when the end height is at or below the tip. */
  past: boolean;
  /** Time left at the target block interval, in words, or null. */
  inWords: string | null;
}

export function expiryFor(start: number, length: number, tip: number | null): Expiry {
  const height = expiryHeight(start, length);
  if (tip === null) return { height, fromNow: null, past: false, inWords: null };
  const fromNow = height - Math.round(tip);
  return {
    height,
    fromNow,
    past: fromNow <= 0,
    inWords: fromNow > 0 ? humanDuration(blocksToSeconds(fromNow)) : null,
  };
}
