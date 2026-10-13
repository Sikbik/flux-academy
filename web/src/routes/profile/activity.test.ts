import { describe, expect, it } from 'vitest';
import { buildActivity, dateKey, describeActivity, formatDay, parseKey } from './activity';

// Wednesday 14 October 2026, local noon.
const TODAY = new Date(2026, 9, 14, 12);
const key = (offset: number) => dateKey(new Date(2026, 9, 14 + offset));

describe('dateKey and parseKey', () => {
  it('round-trip local calendar days', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dateKey(parseKey('2026-02-28') as Date)).toBe('2026-02-28');
  });

  it('rejects things that are not a calendar day', () => {
    expect(parseKey('2026-02-30')).toBeNull();
    expect(parseKey('2026-13-01')).toBeNull();
    expect(parseKey('yesterday')).toBeNull();
    expect(parseKey('2026-1-5')).toBeNull();
  });
});

describe('buildActivity', () => {
  it('is twelve whole weeks of seven days, Monday first, the last containing today', () => {
    const a = buildActivity([], TODAY);
    expect(a.cells).toHaveLength(84);
    expect(a.cells.slice(0, 7).map((c) => c.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(a.cells[0]?.week).toBe(0);
    expect(a.cells[83]?.week).toBe(11);
    // Wednesday 14 Oct: that week's Monday is the 12th, so the first cell is 11 weeks earlier (27 Jul).
    expect(a.cells[0]?.date).toBe('2026-07-27');
    expect(a.cells.find((c) => c.today)?.date).toBe('2026-10-14');
    expect(a.cells[83]?.date).toBe('2026-10-18');
  });

  it('marks the rest of this week as future and does not count it', () => {
    const a = buildActivity([key(1), key(2)], TODAY);
    const future = a.cells.filter((c) => c.future);
    expect(future.map((c) => c.date)).toEqual(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    expect(future.every((c) => !c.active)).toBe(true);
    expect(a.activeCount).toBe(0);
    expect(a.windowDays).toBe(80);
  });

  it('counts active days inside the window and ignores older ones and junk', () => {
    const a = buildActivity([key(0), key(-1), key(-30), '2025-01-01', 'garbage', '2026-02-30'], TODAY);
    expect(a.activeCount).toBe(3);
    expect(a.activeDates).toEqual([key(-30), key(-1), key(0)]);
  });

  it('computes the current streak, which stays alive until the day is over', () => {
    expect(buildActivity([key(0), key(-1), key(-2), key(-4)], TODAY).currentStreak).toBe(3);
    // Nothing today yet, but yesterday and the day before: the streak is still 2.
    expect(buildActivity([key(-1), key(-2)], TODAY).currentStreak).toBe(2);
    // A gap of a whole day breaks it.
    expect(buildActivity([key(-2), key(-3)], TODAY).currentStreak).toBe(0);
  });

  it('computes the longest streak from all the data, across month ends', () => {
    const run = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03'];
    const a = buildActivity([...run, key(0), key(-1)], TODAY);
    expect(a.longestStreak).toBe(5);
    expect(a.currentStreak).toBe(2);
  });

  it('reports the last active day', () => {
    expect(buildActivity([key(-9), key(-3)], TODAY).lastActive).toBe(key(-3));
    expect(buildActivity([], TODAY).lastActive).toBeNull();
  });

  it('does not count days after today, even when the data has them', () => {
    const a = buildActivity([key(3)], TODAY);
    expect(a.activeCount).toBe(0);
    expect(a.lastActive).toBeNull();
  });

  it('handles a week count other than twelve', () => {
    expect(buildActivity([], TODAY, 4).cells).toHaveLength(28);
  });
});

describe('describeActivity', () => {
  it('invites the first day when there is none', () => {
    expect(describeActivity(buildActivity([], TODAY), TODAY)).toMatch(/^No active days in the last 12 weeks/);
  });

  it('says how many days, the streaks and the last day', () => {
    const text = describeActivity(buildActivity([key(0), key(-1), key(-2), key(-20)], TODAY), TODAY);
    expect(text).toBe(
      'Active on 4 of the last 80 days, current streak 3 days, longest streak 3 days, last active Wed 14 Oct.',
    );
  });

  it('uses the singular and leaves out a one day "longest streak"', () => {
    const text = describeActivity(buildActivity([key(0)], TODAY), TODAY);
    expect(text).toContain('current streak 1 day,');
    expect(text).not.toContain('longest');
  });

  it('has no em dash', () => {
    expect(describeActivity(buildActivity([key(0)], TODAY), TODAY)).not.toContain('—');
  });
});

describe('formatDay', () => {
  it('shows the weekday, day and month, and the year only when it differs', () => {
    expect(formatDay('2026-10-12', TODAY)).toBe('Mon 12 Oct');
    expect(formatDay('2025-12-31', TODAY)).toBe('Wed 31 Dec 2025');
  });
});
