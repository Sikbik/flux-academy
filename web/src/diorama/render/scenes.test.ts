import { describe, expect, it } from 'vitest';
import { defaultAnnotations, resolveAnnotations, SCENE_IDS, SCENES } from './scenes';

describe('scenes', () => {
  it('defines the seven documented scenes', () => {
    expect([...SCENE_IDS].sort()).toEqual(
      ['deploy', 'failover', 'network', 'placement', 'sync', 'tiers', 'traffic'].sort(),
    );
    for (const id of SCENE_IDS) expect(SCENES[id].id).toBe(id);
  });

  it('only defaults to annotations the scene can draw', () => {
    for (const id of SCENE_IDS) {
      const s = SCENES[id];
      for (const name of s.annotations) expect(s.names).toContain(name);
    }
  });

  it('ignores unknown annotation names and keeps the author order', () => {
    expect(resolveAnnotations('placement', ['instances', 'nonsense', 'specimen'])).toEqual([
      'instances',
      'specimen',
    ]);
    expect(resolveAnnotations('placement', undefined)).toEqual([...SCENES.placement.annotations]);
    expect(resolveAnnotations('tiers', [])).toEqual([]);
  });

  it('only the scenes with an app show a specimen, and only census scenes filter by tier', () => {
    expect(SCENES.tiers.specimen).toBe(false);
    expect(SCENES.network.specimen).toBe(false);
    expect(SCENES.tiers.census && SCENES.network.census).toBe(true);
    expect(SCENES.failover.census).toBe(false);
    expect(SCENES.deploy.pipeline).toBe(true);
    expect(SCENES.sync.roles).toBe(true);
    expect(SCENES.traffic.proxy && SCENES.traffic.users).toBe(true);
  });

  describe('the lost-data annotation', () => {
    it('can be asked for in every scene that shows instances, and in none of the census scenes', () => {
      for (const id of ['placement', 'failover', 'traffic', 'sync'] as const) {
        expect(SCENES[id].names).toContain('lost-data');
      }
      for (const id of ['tiers', 'network', 'deploy'] as const) {
        expect(SCENES[id].names).not.toContain('lost-data');
      }
    });

    it('is on by default in failover only when the stage chose a local volume', () => {
      expect(defaultAnnotations('failover')).toEqual([...SCENES.failover.annotations]);
      expect(defaultAnnotations('failover', 'local')).toEqual([...SCENES.failover.annotations, 'lost-data']);
      expect(defaultAnnotations('failover', 'replicated')).toEqual([...SCENES.failover.annotations]);
      expect(defaultAnnotations('failover', 'primary-standby')).toEqual([...SCENES.failover.annotations]);
      expect(resolveAnnotations('failover', undefined, 'local')).toContain('lost-data');
      expect(resolveAnnotations('failover', undefined)).not.toContain('lost-data');
    });

    it('is not added to the other scenes by a volume choice alone', () => {
      for (const id of ['placement', 'traffic', 'sync', 'deploy', 'tiers', 'network'] as const) {
        expect(defaultAnnotations(id, 'local')).toEqual([...SCENES[id].annotations]);
      }
    });

    it('is drawn when a lesson lists it, whatever the volume, and ignored where the scene has no use', () => {
      expect(resolveAnnotations('failover', ['instances', 'lost-data'])).toEqual(['instances', 'lost-data']);
      expect(resolveAnnotations('sync', ['primary', 'lost-data'], 'primary-standby')).toEqual([
        'primary',
        'lost-data',
      ]);
      expect(resolveAnnotations('network', ['regions', 'lost-data'])).toEqual(['regions']);
      // An explicit list is the lesson's word: the volume does not add to it.
      expect(resolveAnnotations('failover', ['instances'], 'local')).toEqual(['instances']);
    });
  });
});
