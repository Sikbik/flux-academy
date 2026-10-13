/**
 * What the certificate says. Pure: no canvas, no DOM, no clock (the caller passes `now`).
 *
 * The certificate is a keepsake generated in the browser from local progress. It must never read as proof
 * of anything: the line `DISCLAIMER` is part of the picture and cannot be switched off, and nothing in
 * here says "verified", "official" or "accredited".
 */

import { LESSONS, TRACKS, type Track, type TrackId } from '@shared/curriculum';

/** The longest name shown on the certificate (the field enforces the same limit). */
export const MAX_NAME = 48;

/** Shown in place of a name until one is typed. */
export const NAME_PLACEHOLDER = 'Your name';

/** The small heading of a certificate that has been earned. */
export const EYEBROW = 'CERTIFICATE OF COMPLETION';

/** The small heading of the sample shown before any track is finished: a screenshot of it proves nothing. */
export const EYEBROW_SAMPLE = 'SAMPLE: FINISH A TRACK TO EARN THIS';

/** The line printed on every certificate. Fixed wording. */
export const DISCLAIMER = 'Completed in Flux Academy. This is not a blockchain credential.';

/** The second, smaller line. */
export const DISCLAIMER_DETAIL = "Progress is saved in the learner's own browser and has not been verified.";

/** The part of the learner store the certificate reads. */
export type LessonRecords = Readonly<Record<string, { completedAt: string | null } | undefined>>;

export interface CompletedTrack {
  id: TrackId;
  name: string;
  /** The rank the track gives its name to, for example "Cumulus Operator". */
  rank: string;
  lessons: number;
  /** ISO time the last lesson of the track was finished, or null when no lesson carries one. */
  completedAt: string | null;
}

export interface CertificateModel {
  /** True when at least one track is finished. False: the picture is a sample of what finishing gives. */
  earned: boolean;
  /** The cleaned name, or '' when there is none. */
  name: string;
  /** What is drawn: the name, or `NAME_PLACEHOLDER`. */
  nameShown: string;
  /** The tier whose colour the rank line takes: the highest finished track (the first one for a sample). */
  tier: TrackId;
  /** The small line above the name: "CERTIFICATE OF COMPLETION", or a plain "sample" notice. */
  eyebrow: string;
  /** "completed the Cumulus track". */
  sentence: string;
  /** "Cumulus Operator". */
  rank: string;
  /** "4 lessons". */
  facts: string;
  /** "12 October 2026". */
  date: string;
  disclaimer: string;
  disclaimerDetail: string;
  /** "flux-academy-certificate-alex-rivera.png". */
  fileName: string;
  /** A description of the picture for assistive technology. */
  altText: string;
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/**
 * Code point ranges that never belong in a name drawn on a certificate: control characters, the soft hyphen,
 * zero width and joiner characters, the line and paragraph separators, and every bidirectional override
 * and isolate (which could flip the order of what is drawn). Listed as numbers, not as a pattern, so the
 * source holds no invisible characters.
 */
const INVISIBLE_RANGES: readonly (readonly [number, number])[] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x00ad, 0x00ad],
  [0x061c, 0x061c],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
];

function isInvisible(codePoint: number): boolean {
  return INVISIBLE_RANGES.some(([lo, hi]) => codePoint >= lo && codePoint <= hi);
}

/**
 * A display name made safe to draw: invisible and direction-changing characters removed, runs of white space
 * collapsed, trimmed, and cut to `MAX_NAME` characters (never in the middle of a surrogate pair).
 */
export function cleanName(raw: string): string {
  const visible = Array.from(String(raw ?? ''))
    .map((ch) => (isInvisible(ch.codePointAt(0) ?? 0) ? ' ' : ch))
    .join('');
  const collapsed = visible.replace(/\s+/g, ' ').trim();
  const chars = Array.from(collapsed);
  return chars.length > MAX_NAME ? chars.slice(0, MAX_NAME).join('').trimEnd() : collapsed;
}

/** `Alex Rivera` becomes `alex-rivera`; anything without a letter or digit becomes `learner`. */
export function fileSlug(name: string): string {
  const ascii = cleanName(name)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
  return ascii || 'learner';
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** "12 October 2026", in the reader's time zone. */
export function formatCertificateDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

/** The tracks whose every lesson is finished, in curriculum order. */
export function completedTracks(lessons: LessonRecords): CompletedTrack[] {
  const out: CompletedTrack[] = [];
  for (const t of TRACKS) {
    const inTrack = LESSONS.filter((l) => l.track === t.id);
    if (inTrack.length === 0) continue;
    const times = inTrack.map((l) => lessons[l.id]?.completedAt ?? null);
    if (times.some((c) => c === null)) continue;
    const latest = (times as string[]).reduce<string | null>((best, c) => {
      const ms = Date.parse(c);
      if (Number.isNaN(ms)) return best;
      return best === null || ms > Date.parse(best) ? c : best;
    }, null);
    out.push({ id: t.id, name: t.name, rank: t.rank, lessons: inTrack.length, completedAt: latest });
  }
  return out;
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function lessonCount(n: number): string {
  return n === 1 ? '1 lesson' : `${n} lessons`;
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

export interface CertificateInput {
  /** The display name as typed or stored. */
  name: string;
  /** The learner's lessons (`useLearner().lessons`). */
  lessons: LessonRecords;
  /** The current time: the date of a certificate that has no completion time. */
  now: Date;
}

/**
 * Everything the certificate draws, as plain strings. With no finished track the model is a sample of the
 * first track (`earned` is false) so the learner sees what finishing gives.
 */
export function buildCertificate(input: CertificateInput): CertificateModel {
  const name = cleanName(input.name);
  const done = completedTracks(input.lessons);
  const earned = done.length > 0;
  const first: Track | undefined = TRACKS[0];

  let tier: TrackId;
  let rank: string;
  let sentence: string;
  let facts: string;
  let when: Date;

  if (earned) {
    const top = done[done.length - 1] as CompletedTrack;
    tier = top.id;
    rank = top.rank;
    const names = done.map((t) => t.name);
    sentence = `completed the ${joinNames(names)} ${done.length === 1 ? 'track' : 'tracks'}`;
    facts = lessonCount(done.reduce((n, t) => n + t.lessons, 0));
    const ms = Date.parse(top.completedAt ?? '');
    when = Number.isNaN(ms) ? input.now : new Date(ms);
  } else {
    tier = first?.id ?? 'cumulus';
    rank = first?.rank ?? 'Cumulus Operator';
    sentence = `completed the ${first?.name ?? 'Cumulus'} track`;
    facts = lessonCount(LESSONS.filter((l) => l.track === tier).length);
    when = input.now;
  }

  const nameShown = name || NAME_PLACEHOLDER;
  const date = formatCertificateDate(when);

  return {
    earned,
    name,
    nameShown,
    tier,
    eyebrow: earned ? EYEBROW : EYEBROW_SAMPLE,
    sentence,
    rank,
    facts,
    date,
    disclaimer: DISCLAIMER,
    disclaimerDetail: DISCLAIMER_DETAIL,
    fileName: `flux-academy-certificate-${fileSlug(name)}.png`,
    altText: `${earned ? 'Certificate of completion' : 'Sample certificate, not yet earned'} from Flux Academy. ${nameShown} ${sentence} and holds the rank ${rank}. ${facts}. ${date}. ${DISCLAIMER}`,
  };
}
