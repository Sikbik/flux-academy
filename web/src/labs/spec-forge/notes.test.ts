import { defaultSpec } from '@shared/flux/spec';
import { describe, expect, it } from 'vitest';
import { priceSpec } from '@/forge/model';
import { specNotes, teachNotes } from './notes';

describe('teach notes', () => {
  const spec = defaultSpec();
  const quote = priceSpec(spec);

  it('speak about the spec on screen first', () => {
    const notes = teachNotes(spec, quote);
    expect(notes[0]).toContain('This spec.');
    expect(notes[0]).toContain(`$${quote.usdPerMonth.toFixed(2)}`);
    expect(notes.length).toBeGreaterThan(specNotes(spec, quote).length);
  });

  it('say what one instance means, and what many mean', () => {
    const one = specNotes({ ...spec, instances: 1 }, priceSpec({ ...spec, instances: 1 }));
    expect(one.join(' ')).toMatch(/one instance/i);
    const five = specNotes({ ...spec, instances: 5 }, priceSpec({ ...spec, instances: 5 }));
    expect(five.join(' ')).toMatch(/5 instances/);
  });

  it('say when no tier has room', () => {
    const c = spec.compose[0];
    if (!c) throw new Error('no component');
    const huge = {
      ...spec,
      compose: [
        { ...c, cpu: 15, ram: 59000, hdd: 820 },
        { ...c, name: 'two', cpu: 15 },
      ],
    };
    expect(specNotes(huge, priceSpec(huge)).join(' ')).toMatch(/larger than any single node tier/);
  });

  it('use plain words: no dashes in prose and no emoji', () => {
    const text = teachNotes(spec, quote).join('\n');
    expect(text).not.toMatch(/[–—]/);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
