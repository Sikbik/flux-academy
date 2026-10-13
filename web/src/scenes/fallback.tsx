// The 2D scene: what the stage shows when WebGL is unavailable, forced off, lost for good or too slow.
// It is the diorama's own Canvas 2D renderer on the same bench model and the same simulation, bound to
// the same bus controls (instances, break, revive, reset, the story chapters, accent, reduced motion),
// so the page above it never needs to know which renderer is on screen.
//
// It sizes to its host box and keeps the picture in the page's free area (the bus `insets`) inside that box
// (see lib/insets.ts: a host the page already inset is not inset twice). `scene.hover` is reported like the
// WebGL scene reports it: pointer position in pixels of the host box.

import { useEffect, useRef } from 'react';
import { buildLiveBench, buildSampleBench, REGIONS, type Region } from '@/diorama/model';
import { createEngine } from '@/diorama/render/engine';
import { createSim, type SimEvent } from '@/diorama/sim';
import { type SceneSlice, useSceneBus } from './bus';
import { onCoverChange, stageCovered } from './cover';
import type { EngineMode } from './engine/engine';
import { type Box, remainingInsets } from './lib/insets';
import { narrate, statusLine } from './lib/narrate';
import { heroSeed } from './lib/spread';
import { storyPlan } from './lib/story';

const isRegion = (s: string | null): s is Region => s !== null && (REGIONS as readonly string[]).includes(s);

export default function SceneFallback({ mode }: { mode: EngineMode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const geo = useSceneBus((s) => s.geo);

  useEffect(() => {
    const outer = rootRef.current;
    if (!outer) return;
    // The picture lives in an inner box: the host box minus whatever the page's content still covers.
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;inset:0;';
    outer.appendChild(host);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    // The engine's own pointer probe stays off: the page owns the readout (scene.hover), not the canvas.
    canvas.style.cssText = 'position:absolute;inset:0;display:block;pointer-events:none;';
    host.appendChild(canvas);

    const bus = useSceneBus;
    const s0 = bus.getState();
    // The hero scene owns the `scene` slice; an ambient scene reads the bus and never writes it (host.tsx).
    const write = (patch: Partial<SceneSlice>): void => {
      if (mode === 'hero') bus.getState().writeScene(patch);
    };
    // The 2D scene stops when the page is not on screen, a modal covers it, or an ambient scene covers it.
    const pausedNow = (): boolean => {
      const s = bus.getState();
      return !s.visible || s.paused || (mode === 'hero' && stageCovered());
    };
    const layout = (): void => {
      let inset: Box = { left: 0, top: 0, right: 0, bottom: 0 };
      if (mode === 'hero') {
        inset = remainingInsets(
          bus.getState().insets,
          outer.getBoundingClientRect(),
          window.innerWidth,
          window.innerHeight,
        );
      }
      host.style.inset = `${inset.top}px ${inset.right}px ${inset.bottom}px ${inset.left}px`;
    };
    layout();

    let bench: ReturnType<typeof buildSampleBench>;
    try {
      bench = geo
        ? buildLiveBench(geo, { resolution: 'default' })
        : buildSampleBench(1, { resolution: 'default' });
    } catch {
      bench = buildSampleBench(1, { resolution: 'default' });
    }
    const sim = createSim({
      bench,
      seed: heroSeed(bench, 3),
      place: { waitedMin: 120, spread: 'random' },
    });
    const engine = createEngine({
      canvas,
      host,
      sim,
      scene: 'failover',
      reducedMotion: s0.reducedMotion,
      paused: pausedNow(),
    });

    let seq = 0;
    let wantInstances = -1;
    let wantRegion: Region | null = null;
    let storyBroken = false;
    let seenBreak = s0.deploy.breakNonce;
    let seenRevive = s0.deploy.reviveNonce;
    let seenReset = s0.deploy.resetNonce;
    let traffic = true;
    let lastAccent = s0.accent;
    let ambientStep = 0;
    const ambientStart = performance.now();
    let lastPulse = s0.pulses.reduce((m, p) => Math.max(m, p.id), 0);
    let lastHeight = s0.chain.height;

    const ctx = {
      place: (node: number) => {
        const n = bench.nodes[node];
        return n ? (n.city ? n.label : n.country || 'the network') : 'the network';
      },
      tier: (node: number) => bench.nodes[node]?.tier ?? 'cumulus',
      placed: 0,
      healthy: 0,
    };
    const publishStatus = (): void => {
      const a = sim.state().app;
      ctx.placed = a.total;
      ctx.healthy = a.healthy;
      write({
        instancesPlaced: a.total,
        healthy: a.healthy,
        up: a.healthy > 0,
        status: statusLine(a.status, a.total, a.healthy),
      });
    };
    const off = sim.on('*', (e: SimEvent) => {
      publishStatus();
      const n = narrate(e, ctx);
      if (n) write({ lastEvent: { id: ++seq, kind: n.kind, text: n.text, at: performance.now() } });
    });
    const settleIfReduced = (): void => {
      if (bus.getState().reducedMotion) {
        sim.tick(6500);
        engine.invalidate();
      }
    };

    // Hover: the nearest node cap within a few pixels of the pointer, as the WebGL scene does it.
    const NEAR2 = 22 * 22;
    let ptr: { x: number; y: number } | null = null;
    let hovering = false;
    let pickRaf = 0;
    const clearHover = (): void => {
      if (hovering) {
        hovering = false;
        write({ hover: null });
      }
    };
    const pick = (): void => {
      pickRaf = 0;
      const s = bus.getState();
      const live =
        mode === 'hero' &&
        ptr !== null &&
        !s.reducedMotion &&
        !pausedNow() &&
        (s.section === 'hero' || s.section === 'story');
      if (!live || ptr === null) {
        clearHover();
        return;
      }
      const ob = outer.getBoundingClientRect();
      const ib = host.getBoundingClientRect();
      const mx = ptr.x - ib.left;
      const my = ptr.y - ib.top;
      if (mx < 0 || my < 0 || mx > ib.width || my > ib.height) {
        clearHover();
        return;
      }
      let best = -1;
      let bestD = NEAR2;
      for (let i = 0; i < bench.nodes.length; i++) {
        const p = engine.nodeScreen(i);
        if (!p) continue;
        const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      const node = best >= 0 ? bench.nodes[best] : undefined;
      if (!node) {
        clearHover();
        return;
      }
      const st = sim.state();
      hovering = true;
      write({
        hover: {
          x: Math.round(ptr.x - ob.left),
          y: Math.round(ptr.y - ob.top),
          tier: node.tier,
          cc: node.cc || null,
          nodes: bench.kind === 'live' ? node.count : null,
          hosting: st.instances.some((i) => i.node === best),
          healthy: st.nodeUp[best] === 1,
        },
      });
    };
    const schedulePick = (): void => {
      if (!pickRaf) pickRaf = requestAnimationFrame(pick);
    };
    const onPointerMove = (e: PointerEvent): void => {
      ptr = e.pointerType === 'touch' ? null : { x: e.clientX, y: e.clientY };
      schedulePick();
    };
    const onPointerLeave = (): void => {
      ptr = null;
      schedulePick();
    };
    if (mode === 'hero') {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onPointerLeave);
    }

    const reconcile = (): void => {
      const s = bus.getState();
      engine.setReducedMotion(s.reducedMotion);
      engine.setPaused(pausedNow());
      if (s.accent !== lastAccent) {
        lastAccent = s.accent;
        engine.restyle();
      }
      const ambient = mode === 'ambient';
      let want = s.deploy.instances;
      let region: Region | null = isRegion(s.deploy.region) ? s.deploy.region : null;
      traffic = true;
      if (ambient) {
        const t = (performance.now() - ambientStart) / 1000;
        const local = t % 36;
        want = local >= 2.4 ? 3 : 0;
        region = null;
        if (local < ambientStep) ambientStep = 0;
        if (ambientStep < 1 && local >= 16) {
          ambientStep = 1;
          sim.killRandomInstanceNode();
        }
        if (ambientStep < 2 && local >= 23) {
          ambientStep = 2;
          sim.reviveAll();
        }
      } else if (s.section === 'story') {
        const plan = storyPlan(s.chapter, s.chapterProgress);
        want = plan.instances;
        traffic = plan.traffic;
        if (plan.broken !== storyBroken) {
          storyBroken = plan.broken;
          if (plan.broken) sim.killRandomInstanceNode();
          else sim.reviveAll();
        }
      }
      // A reset request empties the bench first; the wanted copies are placed again just below.
      if (!ambient && s.section !== 'story' && s.deploy.resetNonce !== seenReset) {
        seenReset = s.deploy.resetNonce;
        sim.reset();
        wantInstances = -1;
      }
      if (region !== wantRegion) {
        wantRegion = region;
        sim.configure({ regions: region ? [region] : [] });
      }
      if (want !== wantInstances) {
        wantInstances = want;
        sim.setInstances(want, { regions: region ? [region] : [] });
        publishStatus();
      }
      if (!ambient) {
        const d = s.deploy;
        if (d.breakNonce !== seenBreak) {
          seenBreak = d.breakNonce;
          sim.killRandomInstanceNode();
        }
        if (d.reviveNonce !== seenRevive) {
          seenRevive = d.reviveNonce;
          sim.reviveAll();
        }
      }
      // The Beat: a real block, from a one-shot pulse or from the chain clock moving.
      let beat = false;
      for (const p of s.pulses) {
        if (p.id > lastPulse) {
          lastPulse = p.id;
          if (p.kind === 'block') beat = true;
        }
      }
      if (s.chain.live && s.chain.height !== null && lastHeight !== null && s.chain.height > lastHeight)
        beat = true;
      lastHeight = s.chain.height;
      if (beat && !s.reducedMotion) engine.beat();
      settleIfReduced();
      engine.invalidate();
      if (hovering) schedulePick();
    };

    type Bus = ReturnType<typeof bus.getState>;
    const signature = (s: Bus): string =>
      [
        s.visible,
        s.paused,
        s.reducedMotion,
        s.accent,
        s.section,
        s.chapter,
        s.chapterProgress.toFixed(3),
        s.deploy.instances,
        s.deploy.region,
        s.deploy.breakNonce,
        s.deploy.reviveNonce,
        s.deploy.resetNonce,
        s.pulses.length,
        s.chain.height,
      ].join('|');
    let lastSignature = signature(s0);
    const unsub = bus.subscribe((s) => {
      const sig = signature(s);
      if (sig === lastSignature) return;
      lastSignature = sig;
      reconcile();
    });
    const offCover = onCoverChange(() => {
      engine.setPaused(pausedNow());
      schedulePick();
    });
    // The free area moves with the page's insets and with the host's own size.
    const offInsets = bus.subscribe((s, prev) => {
      if (s.insets !== prev.insets) layout();
    });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(layout);
    ro?.observe(outer);
    window.addEventListener('resize', layout);
    const timer = window.setInterval(() => {
      const s = bus.getState();
      if (!traffic || s.reducedMotion || pausedNow() || document.hidden) return;
      if (sim.state().app.total > 0) sim.send();
      if (mode === 'ambient') reconcile();
    }, 650);

    write({
      ready: true,
      webgl: false,
      tier: 0,
      dataMode: bench.kind === 'live' ? 'live' : 'sample',
    });
    reconcile();

    return () => {
      window.clearInterval(timer);
      offCover();
      offInsets();
      ro?.disconnect();
      window.removeEventListener('resize', layout);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      if (pickRaf) cancelAnimationFrame(pickRaf);
      clearHover();
      unsub();
      off();
      engine.dispose();
      host.remove();
    };
  }, [geo, mode]);

  return <div ref={rootRef} style={{ position: 'absolute', inset: 0 }} />;
}
