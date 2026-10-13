import { beforeEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENT_IDS } from '@/content/catalog';
import {
  ACHIEVEMENTS,
  achievementById,
  detectSpecAchievements,
  FRESH_WATCH,
  isAchievementId,
  medalSrc,
  setAchievementNotifier,
  syncTrackAchievements,
  trackAchievementId,
  unlock,
} from './achievements';
import { useLearner } from './store';

beforeEach(() => {
  useLearner.getState().reset();
});

describe('the catalogue of medals', () => {
  it('has exactly the twelve ids of the content catalog, each with a rule and a medal art id', () => {
    expect(ACHIEVEMENTS.map((a) => a.id).sort()).toEqual([...ACHIEVEMENT_IDS].sort());
    for (const a of ACHIEVEMENTS) {
      expect(a.rule.length).toBeGreaterThan(10);
      expect(a.title.length).toBeGreaterThan(2);
      expect(a.medal).toBe(`medal-${a.id}`);
      expect(['cumulus', 'nimbus', 'stratus']).toContain(a.tier);
      expect(a.rule).not.toContain('—');
      expect(a.rule).not.toContain('!');
    }
    expect(medalSrc('first-light')).toBe('/art/medal-first-light.webp');
    expect(achievementById('explorer')?.title).toBe('Explorer');
    expect(isAchievementId('nope')).toBe(false);
  });
});

describe('unlock', () => {
  it('is idempotent and toasts once', () => {
    const said: string[] = [];
    const prev = setAchievementNotifier((m) => said.push(m));
    try {
      expect(unlock('first-light')).toBe(true);
      expect(unlock('first-light')).toBe(false);
      expect(said).toEqual(['Achievement unlocked: First light (1 of 12)']);
      expect(useLearner.getState().achievements['first-light']).toBeTruthy();
    } finally {
      setAchievementNotifier(prev);
    }
  });

  it('ignores ids that are not medals', () => {
    expect(unlock('not-a-medal')).toBe(false);
    expect(useLearner.getState().achievements['not-a-medal']).toBeUndefined();
  });
});

describe('track medals', () => {
  it('maps tracks to medals', () => {
    expect(trackAchievementId('cumulus')).toBe('cumulus-operator');
    expect(trackAchievementId('nimbus')).toBe('nimbus-engineer');
    expect(trackAchievementId('stratus')).toBe('stratus-architect');
  });

  it('grants a track medal when every lesson of the track is complete', () => {
    const prev = setAchievementNotifier(() => {});
    try {
      expect(syncTrackAchievements(useLearner.getState().lessons)).toEqual([]);
      for (const id of ['what-is-flux', 'how-apps-run', 'containers-101', 'your-toolkit']) {
        useLearner.getState().startLesson(id);
        useLearner.getState().completeLesson(id);
      }
      expect(syncTrackAchievements(useLearner.getState().lessons)).toEqual(['cumulus-operator']);
      expect(syncTrackAchievements(useLearner.getState().lessons)).toEqual([]);
    } finally {
      setAchievementNotifier(prev);
    }
  });
});

describe('spec medals', () => {
  const ok = { errors: 0, valid: true, instances: 3, cpu: 1, ramMb: 2000, usdPerMonth: 2.49 };

  it('spec whisperer needs three errors seen, then none', () => {
    let w = FRESH_WATCH;
    let r = detectSpecAchievements({ ...ok, errors: 2, valid: false }, w);
    expect(r.grant).toEqual([]);
    w = r.watch;
    r = detectSpecAchievements({ ...ok, errors: 3, valid: false }, w);
    w = r.watch;
    expect(w.maxErrors).toBe(3);
    r = detectSpecAchievements({ ...ok, errors: 0, valid: true, instances: 1 }, w);
    expect(r.grant).toEqual(['spec-whisperer']);
  });

  it('penny pincher needs three instances, a core, 2 GB, valid, under $3', () => {
    expect(detectSpecAchievements(ok, FRESH_WATCH).grant).toEqual(['penny-pincher']);
    expect(detectSpecAchievements({ ...ok, instances: 2 }, FRESH_WATCH).grant).toEqual([]);
    expect(detectSpecAchievements({ ...ok, cpu: 0.5 }, FRESH_WATCH).grant).toEqual([]);
    expect(detectSpecAchievements({ ...ok, ramMb: 1500 }, FRESH_WATCH).grant).toEqual([]);
    expect(detectSpecAchievements({ ...ok, usdPerMonth: 3 }, FRESH_WATCH).grant).toEqual([]);
    expect(detectSpecAchievements({ ...ok, usdPerMonth: null }, FRESH_WATCH).grant).toEqual([]);
    expect(detectSpecAchievements({ ...ok, valid: false }, FRESH_WATCH).grant).toEqual([]);
  });
});
