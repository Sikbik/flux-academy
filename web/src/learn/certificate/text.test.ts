import { LESSONS, TRACKS } from '@shared/curriculum';
import { describe, expect, it } from 'vitest';
import {
  buildCertificate,
  cleanName,
  completedTracks,
  DISCLAIMER,
  DISCLAIMER_DETAIL,
  EYEBROW,
  EYEBROW_SAMPLE,
  fileSlug,
  formatCertificateDate,
  MAX_NAME,
  NAME_PLACEHOLDER,
} from './text';

const NOW = new Date('2026-10-12T12:00:00Z');

/** Every lesson of the given tracks finished on `iso` (later lessons a minute later). */
function finished(trackIds: string[], iso = '2026-09-30T10:00:00.000Z') {
  const out: Record<string, { completedAt: string | null }> = {};
  const base = Date.parse(iso);
  LESSONS.filter((l) => trackIds.includes(l.track)).forEach((l, i) => {
    out[l.id] = { completedAt: new Date(base + i * 60_000).toISOString() };
  });
  return out;
}

describe('cleanName', () => {
  it('trims and collapses white space', () => {
    expect(cleanName('  Alex   Rivera \n')).toBe('Alex Rivera');
  });

  it('removes control, zero width and direction-changing characters', () => {
    expect(cleanName('Al​ex‮ Rivera\u0000')).toBe('Al ex Rivera');
    expect(cleanName('⁦Alex⁩')).toBe('Alex');
  });

  it('cuts to the maximum without splitting a character', () => {
    const long = `${'a'.repeat(MAX_NAME - 1)}\u{1F600}\u{1F600}\u{1F600}`;
    const cut = cleanName(long);
    expect(Array.from(cut).length).toBeLessThanOrEqual(MAX_NAME);
    expect(cut.endsWith('\u{1F600}')).toBe(true);
    expect(cleanName('b'.repeat(200))).toHaveLength(MAX_NAME);
  });

  it('keeps ordinary international names', () => {
    expect(cleanName('Zoë Müller-Çelik')).toBe('Zoë Müller-Çelik');
    expect(cleanName('李小龍')).toBe('李小龍');
  });

  it('turns nothing into an empty string', () => {
    expect(cleanName('')).toBe('');
    expect(cleanName('   \t ')).toBe('');
  });
});

describe('fileSlug', () => {
  it('makes a safe lowercase file name part', () => {
    expect(fileSlug('Alex Rivera')).toBe('alex-rivera');
    expect(fileSlug('Zoë Müller-Çelik')).toBe('zoe-muller-celik');
    expect(fileSlug('../../etc/passwd')).toBe('etc-passwd');
  });

  it('never returns an empty part', () => {
    expect(fileSlug('')).toBe('learner');
    expect(fileSlug('李小龍')).toBe('learner');
    expect(fileSlug('***')).toBe('learner');
  });

  it('is short enough for any file system', () => {
    expect(fileSlug('x'.repeat(100)).length).toBeLessThanOrEqual(32);
  });
});

describe('formatCertificateDate', () => {
  it('writes day, month name and year', () => {
    expect(formatCertificateDate(new Date(2026, 9, 12))).toBe('12 October 2026');
    expect(formatCertificateDate(new Date(2027, 0, 3))).toBe('3 January 2027');
  });

  it('gives an empty string for an invalid date', () => {
    expect(formatCertificateDate(new Date('nope'))).toBe('');
  });
});

describe('completedTracks', () => {
  it('is empty with no progress and for a partly finished track', () => {
    expect(completedTracks({})).toEqual([]);
    const almost = finished(['cumulus']);
    const firstOfTrack = LESSONS.find((l) => l.track === 'cumulus');
    if (firstOfTrack) almost[firstOfTrack.id] = { completedAt: null };
    expect(completedTracks(almost)).toEqual([]);
  });

  it('lists finished tracks in curriculum order with their lesson count and last finish time', () => {
    const done = completedTracks({
      ...finished(['stratus']),
      ...finished(['cumulus'], '2026-09-01T09:00:00.000Z'),
    });
    expect(done.map((t) => t.id)).toEqual(['cumulus', 'stratus']);
    expect(done[0]?.lessons).toBe(LESSONS.filter((l) => l.track === 'cumulus').length);
    const cumulusLast =
      Date.parse('2026-09-01T09:00:00.000Z') + (done[0]?.lessons ?? 0 - 1) * 60_000 - 60_000;
    expect(Date.parse(done[0]?.completedAt ?? '')).toBe(cumulusLast);
  });
});

describe('buildCertificate', () => {
  it('is a labelled sample before any track is finished', () => {
    const m = buildCertificate({ name: 'Alex Rivera', lessons: {}, now: NOW });
    expect(m.earned).toBe(false);
    expect(m.eyebrow).toBe(EYEBROW_SAMPLE);
    expect(m.eyebrow.toLowerCase()).toContain('sample');
    expect(m.tier).toBe('cumulus');
    expect(m.rank).toBe(TRACKS[0]?.rank);
    expect(m.altText.toLowerCase()).toContain('sample');
  });

  it('describes one finished track', () => {
    const m = buildCertificate({ name: 'Alex Rivera', lessons: finished(['cumulus']), now: NOW });
    expect(m.earned).toBe(true);
    expect(m.eyebrow).toBe(EYEBROW);
    expect(m.sentence).toBe('completed the Cumulus track');
    expect(m.rank).toBe('Cumulus Operator');
    expect(m.tier).toBe('cumulus');
    expect(m.facts).toBe(`${LESSONS.filter((l) => l.track === 'cumulus').length} lessons`);
    expect(m.fileName).toBe('flux-academy-certificate-alex-rivera.png');
  });

  it('names the highest track when several are finished', () => {
    const two = buildCertificate({ name: 'A', lessons: finished(['cumulus', 'nimbus']), now: NOW });
    expect(two.sentence).toBe('completed the Cumulus and Nimbus tracks');
    expect(two.rank).toBe('Nimbus Engineer');
    expect(two.tier).toBe('nimbus');
    const all = buildCertificate({
      name: 'A',
      lessons: finished(['cumulus', 'nimbus', 'stratus']),
      now: NOW,
    });
    expect(all.sentence).toBe('completed the Cumulus, Nimbus and Stratus tracks');
    expect(all.rank).toBe('Stratus Architect');
    expect(all.facts).toBe(`${LESSONS.length} lessons`);
  });

  it('honours a finished track even when an earlier one is not', () => {
    const m = buildCertificate({ name: 'A', lessons: finished(['nimbus']), now: NOW });
    expect(m.earned).toBe(true);
    expect(m.sentence).toBe('completed the Nimbus track');
    expect(m.rank).toBe('Nimbus Engineer');
  });

  it('uses the finish time of the highest track as the date, and now when it has none', () => {
    const lessons = finished(['cumulus'], '2026-03-04T08:00:00.000Z');
    const m = buildCertificate({ name: 'A', lessons, now: NOW });
    expect(m.date).toMatch(/\b2026\b/);
    expect(m.date).toMatch(/March/);
    const without: Record<string, { completedAt: string | null }> = {};
    for (const l of LESSONS.filter((x) => x.track === 'cumulus'))
      without[l.id] = { completedAt: 'not a date' };
    expect(buildCertificate({ name: 'A', lessons: without, now: NOW }).date).toMatch(/October 2026/);
  });

  it('shows a placeholder, not a blank, until there is a name', () => {
    const m = buildCertificate({ name: '   ', lessons: finished(['cumulus']), now: NOW });
    expect(m.name).toBe('');
    expect(m.nameShown).toBe(NAME_PLACEHOLDER);
    expect(m.fileName).toBe('flux-academy-certificate-learner.png');
  });

  it('always carries the fixed disclaimer, and never claims verification', () => {
    for (const lessons of [{}, finished(['cumulus']), finished(['cumulus', 'nimbus', 'stratus'])]) {
      const m = buildCertificate({ name: 'Alex', lessons, now: NOW });
      expect(m.disclaimer).toBe('Completed in Flux Academy. This is not a blockchain credential.');
      expect(m.disclaimer).toBe(DISCLAIMER);
      expect(m.disclaimerDetail).toBe(DISCLAIMER_DETAIL);
      expect(m.altText).toContain(DISCLAIMER);
      const words = `${m.eyebrow} ${m.sentence} ${m.rank} ${m.facts} ${m.disclaimerDetail}`.toLowerCase();
      expect(words).not.toMatch(
        /\bverified by\b|\bofficial\b|\baccredited\b|\bcertified\b|\bon-chain\b|\bnft\b/,
      );
    }
  });

  it('has no em dash and no emoji in anything it prints', () => {
    const m = buildCertificate({ name: 'Alex', lessons: finished(['cumulus', 'nimbus']), now: NOW });
    const all = [
      m.eyebrow,
      m.sentence,
      m.rank,
      m.facts,
      m.date,
      m.disclaimer,
      m.disclaimerDetail,
      m.altText,
    ].join(' ');
    expect(all).not.toMatch(/—/);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('sanitises the name it draws and files under', () => {
    const m = buildCertificate({ name: '  Al‮ex   <b>R</b> ', lessons: finished(['cumulus']), now: NOW });
    expect(m.nameShown).not.toMatch(/[‪-‮]/);
    expect(m.fileName).toMatch(/^flux-academy-certificate-[a-z0-9-]+\.png$/);
  });
});
