import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendPulse,
  clamp01,
  clampChapter,
  clampInstances,
  MAX_PULSES,
  newestPulseId,
  useSceneBus,
} from './bus';

describe('bus reducers', () => {
  it('clamps instances to whole numbers from 1 to 12', () => {
    expect(clampInstances(0)).toBe(1);
    expect(clampInstances(-4)).toBe(1);
    expect(clampInstances(3.4)).toBe(3);
    expect(clampInstances(3.6)).toBe(4);
    expect(clampInstances(99)).toBe(12);
    expect(clampInstances(Number.NaN)).toBe(1);
  });

  it('clamps chapters and progress', () => {
    expect(clampChapter(-1)).toBe(0);
    expect(clampChapter(2.2)).toBe(2);
    expect(clampChapter(9)).toBe(3);
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it('keeps only the newest pulses and clamps their position', () => {
    let list: ReturnType<typeof appendPulse> = [];
    for (let i = 1; i <= MAX_PULSES + 5; i++) list = appendPulse(list, 'block', { x: 3, y: -1 }, i * 10, i);
    expect(list).toHaveLength(MAX_PULSES);
    expect(list[0]?.id).toBe(6);
    expect(list.at(-1)?.id).toBe(MAX_PULSES + 5);
    expect(list.at(-1)?.x).toBe(1);
    expect(list.at(-1)?.y).toBe(0);
    expect(newestPulseId({ pulses: list })).toBe(MAX_PULSES + 5);
    const centred = appendPulse([], 'success', undefined, 0, 1);
    expect(centred[0]?.x).toBeNull();
    expect(centred[0]?.strength).toBe(1);
  });
});

describe('bus store', () => {
  beforeEach(() => {
    useSceneBus.getState().reset();
  });

  it('starts with three instances, no pending requests and an honest sample', () => {
    const s = useSceneBus.getState();
    expect(s.deploy.instances).toBe(3);
    expect(s.deploy.breakNonce + s.deploy.reviveNonce + s.deploy.resetNonce).toBe(0);
    expect(s.geo).toBeNull();
    expect(s.scene.dataMode).toBe('sample');
    expect(s.chain.live).toBe(false);
  });

  it('turns requests into nonces and never loses one', () => {
    const s = useSceneBus.getState();
    s.requestBreak();
    s.requestBreak();
    s.requestRevive();
    s.requestReset();
    const d = useSceneBus.getState().deploy;
    expect(d.breakNonce).toBe(2);
    expect(d.reviveNonce).toBe(1);
    expect(d.resetNonce).toBe(1);
  });

  it('clamps deploy writes and keeps the other controls', () => {
    const s = useSceneBus.getState();
    s.setInstances(40);
    expect(useSceneBus.getState().deploy.instances).toBe(12);
    s.setDeploy({ region: 'EU', instances: 0 });
    const d = useSceneBus.getState().deploy;
    expect(d.instances).toBe(1);
    expect(d.region).toBe('EU');
  });

  it('writes chapter and progress together or apart', () => {
    const s = useSceneBus.getState();
    s.setChapter(2, 0.4);
    expect(useSceneBus.getState().chapter).toBe(2);
    expect(useSceneBus.getState().chapterProgress).toBeCloseTo(0.4);
    s.setChapter(3);
    expect(useSceneBus.getState().chapterProgress).toBeCloseTo(0.4);
    s.setChapterProgress(7);
    expect(useSceneBus.getState().chapterProgress).toBe(1);
  });

  it('merges chain and scene patches', () => {
    const s = useSceneBus.getState();
    s.setChain({ live: true, height: 100 });
    s.setChain({ lastBlockAt: 5 });
    expect(useSceneBus.getState().chain).toMatchObject({ live: true, height: 100, lastBlockAt: 5 });
    s.writeScene({ ready: true, tier: 2 });
    s.writeScene({ fps: 59 });
    expect(useSceneBus.getState().scene).toMatchObject({ ready: true, tier: 2, fps: 59 });
  });

  it('fires pulses with increasing ids', () => {
    const s = useSceneBus.getState();
    s.pulse('block');
    s.pulse('click', { x: 0.3, y: 0.6 });
    const p = useSceneBus.getState().pulses;
    expect(p).toHaveLength(2);
    expect(p[1]!.id).toBeGreaterThan(p[0]!.id);
    expect(p[1]).toMatchObject({ kind: 'click', x: 0.3, y: 0.6 });
  });

  it('clamps the pointer', () => {
    useSceneBus.getState().setPointer({ x: 4, y: -9 });
    expect(useSceneBus.getState().pointer).toEqual({ x: 1, y: -1 });
    useSceneBus.getState().setPointer(null);
    expect(useSceneBus.getState().pointer).toBeNull();
  });
});
