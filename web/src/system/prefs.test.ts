import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  effectiveAccent,
  isAccentUnlocked,
  sanitizePrefs,
  type TrackCompletion,
  unlockRule,
} from './prefs';

const none: TrackCompletion = {
  cumulus: { complete: false },
  nimbus: { complete: false },
  stratus: { complete: false },
};
const cumulusDone: TrackCompletion = { ...none, cumulus: { complete: true } };

describe('sanitizePrefs', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs('x')).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs([1])).toEqual(DEFAULT_PREFS);
  });

  it('keeps valid values and drops invalid ones field by field', () => {
    const p = sanitizePrefs({
      accent: 'nimbus',
      sound: 'yes',
      motion: 'full',
      quality: 'ultra',
      ambient: false,
    });
    expect(p).toMatchObject({
      accent: 'nimbus',
      sound: false,
      motion: 'full',
      quality: 'auto',
      ambient: false,
    });
  });

  it('is off, system and auto by default and ambient is on', () => {
    expect(DEFAULT_PREFS).toMatchObject({ sound: false, motion: 'system', quality: 'auto', ambient: true });
  });
});

describe('accent unlock rules', () => {
  it('flux is always available and tiers need their track', () => {
    expect(isAccentUnlocked('flux', none)).toBe(true);
    expect(isAccentUnlocked('cumulus', none)).toBe(false);
    expect(isAccentUnlocked('cumulus', cumulusDone)).toBe(true);
    expect(isAccentUnlocked('nimbus', cumulusDone)).toBe(false);
  });

  it('falls back to flux for a locked stored accent, never trapping anyone', () => {
    expect(effectiveAccent('stratus', none)).toBe('flux');
    expect(effectiveAccent('cumulus', cumulusDone)).toBe('cumulus');
  });

  it('says the rule in a sentence', () => {
    expect(unlockRule('nimbus')).toBe('Finish the Nimbus track to unlock this accent.');
    expect(unlockRule('flux')).toBe('Always available.');
  });
});
