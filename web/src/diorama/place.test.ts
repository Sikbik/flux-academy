import { describe, expect, it } from 'vitest';
import { buildSampleBench } from './model';
import { chosenVolume, defaultVolume, placeFor, showsVolumeChip, volumeChipText } from './place';
import { SCENE_IDS, type SceneId } from './render/scenes';
import { createSim } from './sim';

const bench = buildSampleBench(2);

describe('the volume mode a stage asks for', () => {
  it('defaults to what each scene does on its own', () => {
    for (const id of SCENE_IDS) {
      expect(defaultVolume(id)).toBe(id === 'sync' ? 'primary-standby' : 'local');
    }
  });

  it('takes the volume prop first, then place.volume, else nothing', () => {
    expect(chosenVolume('replicated', { volume: 'local' })).toBe('replicated');
    expect(chosenVolume(undefined, { volume: 'primary-standby' })).toBe('primary-standby');
    expect(chosenVolume(undefined, undefined)).toBeUndefined();
    expect(chosenVolume(undefined, { spread: 'random' })).toBeUndefined();
  });

  it('maps to the placement options of a scene, keeping the teaching layout', () => {
    expect(placeFor('failover', undefined)).toEqual({ waitedMin: 120, spread: 'regions', volume: 'local' });
    expect(placeFor('sync', undefined).volume).toBe('primary-standby');
    expect(placeFor('placement', undefined, 'replicated').volume).toBe('replicated');
    expect(placeFor('traffic', undefined, 'primary-standby').volume).toBe('primary-standby');
    // The caller's own options still apply.
    expect(placeFor('failover', { spread: 'random', waitedMin: 0 }, 'local')).toMatchObject({
      spread: 'random',
      waitedMin: 0,
      volume: 'local',
    });
  });

  it('lets the volume prop win over place.volume, and place.volume win over the scene', () => {
    expect(placeFor('failover', { volume: 'replicated' }).volume).toBe('replicated');
    expect(placeFor('failover', { volume: 'replicated' }, 'primary-standby').volume).toBe('primary-standby');
    expect(placeFor('sync', { volume: 'local' }).volume).toBe('local');
  });

  it('is what the simulation runs, and a scene change returns it to the scene default', () => {
    const sim = createSim({ bench, seed: 3, place: placeFor('failover', undefined, 'replicated') });
    sim.setInstances(3);
    expect(sim.state().volume.mode).toBe('replicated');
    expect(sim.state().instances.map((i) => i.role)).toEqual(['active', 'active', 'active']);
    // The component re-applies the scene's own volume when a stage stops choosing one.
    sim.configure(placeFor('failover', undefined));
    expect(sim.state().volume.mode).toBe('local');
    expect(sim.state().instances.map((i) => i.role)).toEqual(['local', 'local', 'local']);
    sim.configure(placeFor('sync', undefined));
    expect(sim.state().volume.mode).toBe('primary-standby');
  });
});

describe('the volume chip', () => {
  it('names the model in plain words', () => {
    expect(volumeChipText('local')).toBe('Volume: local, on one node');
    expect(volumeChipText('replicated')).toBe('Volume: replicated to all');
    expect(volumeChipText('primary-standby')).toBe('Volume: primary and standby');
  });

  it('shows only when a stage chose a volume, and always in the sync scene', () => {
    const withApp: SceneId[] = ['placement', 'failover', 'traffic', 'sync', 'deploy'];
    for (const id of withApp) {
      expect(showsVolumeChip(id, 'local')).toBe(true);
      expect(showsVolumeChip(id, undefined)).toBe(id === 'sync');
    }
    // A lesson that never talks about volumes never sees it.
    expect(showsVolumeChip('failover', undefined)).toBe(false);
    // The census scenes have no app at all.
    expect(showsVolumeChip('tiers', 'local')).toBe(false);
    expect(showsVolumeChip('network', 'replicated')).toBe(false);
  });
});
