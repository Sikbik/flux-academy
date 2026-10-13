// Development harness for the scenes (not part of the production build: only scene-lab.html loads it).
//
//   /scene-lab.html                       the hero scene through the real host, with a control panel
//   ?mode=ambient                         the ambient scene
//   ?manual=1                             the engine on a manual clock: window.__engine.advance(seconds)
//   ?section=story&chapter=2&p=0.4        drive the bus from the URL
//   ?n=5&accent=nimbus&rm=1&q=low&panel=0 instances, accent, reduced motion, quality, no panel
//   ?geo=1                                a synthetic "live" snapshot (labelled synthetic, for the live path)
//   ?insets=0.3,0,0,0                     left,right,top,bottom page insets (fractions)
//   ?stage=debug                          the stats overlay
//   ?overlay=1, or press `a`              the ambient scene as a full-screen overlay over the hero
import '@/styles/index.css';
import type { GeoSnapshot } from '@shared/api';
import { type CSSProperties, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { buildSampleBench } from '@/diorama/model';
import AmbientScene from '../ambient';
import { type Accent, type Chapter, type SceneSection, useSceneBus } from '../bus';
import { SceneEngine } from '../engine/engine';
import HeroScene from '../index';

const params = new URLSearchParams(location.search);
const num = (k: string, d: number): number => {
  const v = params.get(k);
  return v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v);
};

/** A snapshot built from the sample bench, only to exercise the live path. Not real data. */
function syntheticGeo(): GeoSnapshot {
  const bench = buildSampleBench(3, { resolution: 'default' });
  let k = 7;
  const rnd = () => {
    k = (k * 1664525 + 1013904223) >>> 0;
    return k / 4294967296;
  };
  const points = bench.nodes.map((n) => {
    const count = 1 + Math.floor(rnd() ** 3 * 160);
    const t: [number, number, number] = [0, 0, 0];
    t[n.tierIndex] = count;
    return { lat: n.lat, lon: n.lon, n: count, cc: n.cc, t };
  });
  const countries = new Map<
    string,
    { code: string; name: string; nodes: number; tiers: { cumulus: number; nimbus: number; stratus: number } }
  >();
  for (const p of points) {
    if (!p.cc) continue;
    const c = countries.get(p.cc) ?? {
      code: p.cc,
      name: p.cc,
      nodes: 0,
      tiers: { cumulus: 0, nimbus: 0, stratus: 0 },
    };
    c.nodes += p.n;
    c.tiers.cumulus += p.t[0];
    c.tiers.nimbus += p.t[1];
    c.tiers.stratus += p.t[2];
    countries.set(p.cc, c);
  }
  const total = points.reduce((s, p) => s + p.n, 0);
  return { located: total, total, countries: [...countries.values()], points };
}

function applyUrl(): void {
  const s = useSceneBus.getState();
  const n = params.get('n');
  if (n) s.setInstances(Number(n));
  const accent = params.get('accent') as Accent | null;
  if (accent) s.setAccent(accent);
  const section = params.get('section') as SceneSection | null;
  if (section) s.setSection(section);
  const chapter = params.get('chapter');
  if (chapter) s.setChapter(Number(chapter) as Chapter, num('p', 0));
  if (params.get('rm') === '1') s.setReducedMotion(true);
  const region = params.get('region');
  if (region) s.setDeploy({ region });
  const q = params.get('q');
  if (q === 'low') s.setQuality(1);
  if (q === 'medium') s.setQuality(2);
  if (q === 'high') s.setQuality(3);
  if (params.get('geo') === '1') s.setGeo(syntheticGeo());
  const ins = params.get('insets');
  if (ins) {
    const [l, r, t, b] = ins.split(',').map(Number);
    s.setInsets({ left: l ?? 0, right: r ?? 0, top: t ?? 0, bottom: b ?? 0 });
  }
  if (params.get('live') === '1') s.setChain({ live: true, height: 1000, lastBlockAt: Date.now() });
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  right: 10,
  top: 10,
  width: 250,
  padding: 10,
  font: '12px/1.4 ui-monospace, Menlo, monospace',
  color: '#cfe0ff',
  background: 'rgba(3, 8, 20, 0.82)',
  border: '1px solid rgba(110, 150, 255, 0.28)',
  borderRadius: 8,
  zIndex: 20,
  display: 'grid',
  gap: 6,
};

function Panel() {
  const s = useSceneBus();
  const [p, setP] = useState(s.chapterProgress);
  useEffect(() => setP(s.chapterProgress), [s.chapterProgress]);
  const btn: CSSProperties = {
    font: 'inherit',
    color: '#e8f0ff',
    background: 'rgba(60, 100, 220, 0.25)',
    border: '1px solid rgba(110, 150, 255, 0.4)',
    borderRadius: 6,
    padding: '3px 8px',
    cursor: 'pointer',
  };
  const row: CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' };
  return (
    <div style={panelStyle} data-no-stage>
      <div style={row}>
        <label htmlFor="n">instances {s.deploy.instances}</label>
        <input
          id="n"
          type="range"
          min={1}
          max={12}
          value={s.deploy.instances}
          onChange={(e) => s.setInstances(Number(e.target.value))}
        />
      </div>
      <div style={row}>
        <button type="button" style={btn} onClick={() => s.requestBreak()}>
          Break
        </button>
        <button type="button" style={btn} onClick={() => s.requestRevive()}>
          Revive
        </button>
        <button type="button" style={btn} onClick={() => s.requestReset()}>
          Reset
        </button>
      </div>
      <div style={row}>
        {(['block', 'success', 'warn'] as const).map((k) => (
          <button key={k} type="button" style={btn} onClick={() => s.pulse(k)}>
            {k}
          </button>
        ))}
      </div>
      <div style={row}>
        <label htmlFor="accent">accent</label>
        <select id="accent" value={s.accent} onChange={(e) => s.setAccent(e.target.value as Accent)}>
          {(['flux', 'cumulus', 'nimbus', 'stratus'] as const).map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <label htmlFor="sec">section</label>
        <select id="sec" value={s.section} onChange={(e) => s.setSection(e.target.value as SceneSection)}>
          {(['hero', 'story', 'path', 'labs', 'live', 'build', 'close', 'backdrop'] as const).map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>
      <div style={row}>
        <label htmlFor="ch">chapter</label>
        <select id="ch" value={s.chapter} onChange={(e) => s.setChapter(Number(e.target.value) as Chapter)}>
          {[0, 1, 2, 3].map((c) => (
            <option key={c} value={c}>
              {['describe', 'register', 'place', 'run'][c]}
            </option>
          ))}
        </select>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={p}
          onChange={(e) => {
            setP(Number(e.target.value));
            s.setChapterProgress(Number(e.target.value));
          }}
          aria-label="chapter progress"
        />
      </div>
      <div style={row}>
        <label>
          <input
            type="checkbox"
            checked={s.reducedMotion}
            onChange={(e) => s.setReducedMotion(e.target.checked)}
          />{' '}
          reduced
        </label>
        <label>
          <input type="checkbox" checked={s.paused} onChange={(e) => s.setPaused(e.target.checked)} /> paused
        </label>
        <label>
          <input
            type="checkbox"
            checked={s.geo !== null}
            onChange={(e) => s.setGeo(e.target.checked ? syntheticGeo() : null)}
          />{' '}
          synthetic geo
        </label>
      </div>
      <div style={{ opacity: 0.8 }}>
        {s.scene.webgl ? 'webgl' : '2d'} tier {s.scene.tier} {s.scene.fps} fps {s.scene.reason}
      </div>
      <div style={{ opacity: 0.8 }}>{s.scene.status}</div>
      <div style={{ opacity: 0.8, minHeight: 32 }}>{s.scene.lastEvent?.text ?? ''}</div>
    </div>
  );
}

function Lab() {
  const mode = params.get('mode') === 'ambient' ? 'ambient' : 'hero';
  // What the app does with ambient mode: a full-screen overlay over the page. `a` toggles it here, so the
  // hero scene behind it can be checked (it must stop drawing and keep its slice).
  const [overlay, setOverlay] = useState(params.get('overlay') === '1');
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (e.key === 'a' && !t?.closest?.('input,select,textarea')) setOverlay((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      {mode === 'ambient' ? <AmbientScene /> : <HeroScene />}
      {overlay && mode !== 'ambient' ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 30, background: '#000' }}>
          <AmbientScene />
        </div>
      ) : null}
      {params.get('panel') === '0' || mode === 'ambient' ? null : <Panel />}
    </>
  );
}

applyUrl();
// What the app platform does: the document's data-accent follows the accent (the CSS tokens re-point).
const syncAccent = (): void => {
  document.documentElement.dataset.accent = useSceneBus.getState().accent;
};
syncAccent();
useSceneBus.subscribe((s, prev) => {
  if (s.accent !== prev.accent) syncAccent();
});
const rootEl = document.getElementById('root') as HTMLElement;
if (params.get('manual') === '1') {
  // A manual clock for deterministic captures: the engine only moves when advance() is called.
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  host.appendChild(canvas);
  rootEl.appendChild(host);
  const q = params.get('q');
  const tier = q === 'low' ? 1 : q === 'medium' ? 2 : q === 'high' ? 3 : null;
  const engine = new SceneEngine({
    canvas,
    host,
    mode: params.get('mode') === 'ambient' ? 'ambient' : 'hero',
    manual: true,
    debug: params.get('stage') === 'debug',
    tier,
    resolution: (['low', 'default', 'high'] as const).find((r) => r === params.get('res')),
  });
  engine.start();
  const t = num('t', 0);
  if (t > 0) engine.advance(t);
  (window as unknown as Record<string, unknown>).__engine = engine;
} else {
  createRoot(rootEl).render(<Lab />);
}
(window as unknown as Record<string, unknown>).__bus = useSceneBus;
