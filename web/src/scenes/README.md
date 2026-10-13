# Scenes

The cinematic part of the site: the WebGL hero scene ("Deploy and break"), the ambient screensaver scene,
and the 2D scene both fall back to. The page never imports three.js and the scenes never import page code.
The only coupling is the bus, `src/scenes/bus.ts`.

| Import | What it is |
| --- | --- |
| `@/scenes` (default export `HeroScene`) | The hero scene. Light module: React, the bus, a WebGL probe. Also re-exports `useSceneBus`, the bus types and the pure `storyPlan`. |
| `@/scenes/ambient` (default export `AmbientScene`) | The same bench as a screensaver. No controls, reads the bus, never writes it. |
| `@/scenes/bus` (`useSceneBus` and types) | The contract. Safe to import anywhere; it has no three.js. |

Both components fill their parent (`position: relative; width: 100%; height: 100%`), render an
`aria-hidden` canvas, and take optional `className`, `style` and `forceFallback` props. Mount them lazily:

```tsx
const HeroScene = lazy(() => import('@/scenes'));
<Suspense fallback={null}><HeroScene /></Suspense>
```

three.js, the simulation and the engine load after mount in their own chunk (`engine/engine.ts`). The 2D
scene (`fallback.tsx`) is another lazy chunk.

## The scenes

| Name | Mounted as | Renderer | Writes `scene` slice | Pointer |
| --- | --- | --- | --- | --- |
| hero | `<HeroScene />` | WebGL, or the 2D scene | yes | parallax, hover, click rings |
| ambient | `<AmbientScene />` | WebGL, or the 2D scene | no | none |
| 2D scene | swapped in by the host (never mounted by the page) | Canvas 2D on `@/diorama` | same as its host | hover |

Camera presets (`lib/camera.ts`, `PresetId`), chosen from `section` and `chapter` by `presetFor`:

| Preset | When | What it frames |
| --- | --- | --- |
| `hero` | `section: 'hero'` | The whole bench in the page's free area, the cell above it. |
| `describe`, `register`, `place`, `run` | `section: 'story'`, `chapter` 0..3 | The cell forming; the chain strip and the hash; copies landing; a node failing and the app staying up. |
| `backdrop` | every other section | A calm, dim, wide view. The sim keeps running. |
| `ambient` | `AmbientScene` | A slow flyover, a pure function of time. |

## The bus

Read in a render loop with `useSceneBus.getState()`; subscribe in React with
`useSceneBus((s) => s.scene.up)`. Actions are on the store (`setChapter`, `requestBreak`, ...).
Names under "Written by" are what writes the field today.

### The page writes

| Field | Type | Written by | Read by | Meaning |
| --- | --- | --- | --- | --- |
| `visible` | boolean | home (`useSceneSync`) | all scenes | The stage is on screen and the tab is visible. Rendering stops when false. |
| `paused` | boolean | shell (`sceneBridge`: deck or shortcuts open) | all scenes | Hard pause. The scene stops drawing and resumes where it was. |
| `reducedMotion` | boolean | shell (`sceneBridge`) | all scenes | A calm still: everything settled, nothing moves, hover off. Controls still work and the still follows them at once. |
| `accent` | `'flux' \| 'cumulus' \| 'nimbus' \| 'stratus'` | shell (`sceneBridge`) | all scenes | Page accent. The scene tweens to it. |
| `quality` | `0..3 \| null` | shell (`sceneBridge`: `?q=` or a preference) | host, all scenes | Forced tier, applied live. `0` is the 2D scene: set after mount it switches at once, leaving `0` takes effect on the next mount. `null` lets the governor decide. |
| `section` | `'hero' \| 'story' \| 'path' \| 'labs' \| 'live' \| 'build' \| 'close' \| 'backdrop'` | home (`useSceneSync`) | hero and 2D scenes | Which section holds the viewport. Only `hero` and `story` have their own camera. |
| `chapter` | `0 \| 1 \| 2 \| 3` | home (`useSceneSync`) | hero and 2D scenes | Story chapter: describe, register, place, run. Only read while `section === 'story'`. |
| `chapterProgress` | `0..1` | home (`useSceneSync`) | hero and 2D scenes | Progress through the chapter. |
| `pointer` | `{x, y} \| null` | home (`useSceneSync`) | hero scene | Viewport normalised, -1..1, y up. Parallax only; the hero also listens to the pointer itself. |
| `deploy.instances` | `1..12` | home (console slider) | hero and 2D scenes | How many copies to place. |
| `deploy.breakNonce` | counter | home (Break) | hero and 2D scenes | Increment to break one running instance's node. |
| `deploy.reviveNonce` | counter | home | hero and 2D scenes | Increment to revive every broken node. |
| `deploy.resetNonce` | counter | home (Reset) | hero and 2D scenes | Increment to remove everything; the wanted copies are placed again in the same pass. |
| `deploy.region` | `string \| null` | home | hero and 2D scenes | Preferred continent code (`NA`, `EU`, ...) for placement. |
| `tierFocus` | `'cumulus' \| 'nimbus' \| 'stratus' \| null` | home (track cards) | hero scene | Dims the other tiers on the bench. |
| `geo` | `GeoSnapshot \| null` | shell (`sceneBridge`, real API data only) | all scenes | Real geo data. `null` means the built-in sample bench. Never write the baked sample here. |
| `chain` | `{height, lastBlockAt, intervalMs, live}` | shell (`sceneBridge`) | all scenes | The chain clock. `live` must be true only for real observations. |
| `insets` | `{left, right, top, bottom}` | home (`useSceneSync`) | hero and 2D scenes | Fractions (0..1) of the viewport-sized stage the page covers. The bench is framed in the rest. |
| `pulses` | ring buffer | shell (`pulse('block')`), hero (`click`) | all scenes | Written by `pulse(kind, {x?, y?, strength?})`; do not write directly. |

Semantics worth knowing:

- Controls are counters, not booleans. A scene that mounts later adopts the current values and does not
  replay old requests. Switching host (hero to ambient, WebGL to 2D) is therefore safe.
- `pulse('block')` is for a real block that landed: a soft ring from the head of the chain across the
  bench. The scene dedupes it against a `chain.height` or `chain.lastBlockAt` change within one second, so
  writing both is fine. There is no simulated Beat anywhere: offline, nothing pulses.
- `pulse('click' | 'success' | 'warn', {x, y})` takes canvas-normalised coordinates (0..1, origin top left)
  or omits them for the cell. The hero scene fires `click` itself for canvas clicks.
- `insets` moves the bench with a camera lens shift; the canvas stays full bleed. Write it only when it
  changes (the home page quantises it).

### The scene writes (read only for the page)

`useSceneBus.getState().scene`, written by the hero scene only (the ambient scene never writes it, so it
cannot overwrite the hero's counts, status line or announcements):

| Field | Read by | Meaning |
| --- | --- | --- |
| `ready` | home hero, stage host, theme | The first frame is drawn (WebGL) or the 2D scene is mounted. Stays true after unmount: it means "a scene has drawn this session". |
| `webgl` | stage host, hover readout | True while the WebGL scene is what is on screen. |
| `tier` | theme (lite glass) | `0` for the 2D scene, otherwise `1..3` (low, medium, high). |
| `fps` | debug, lab | Smoothed frames per second, updated about twice a second. `0` in a reduced-motion still and in the 2D scene. |
| `reason` | stage host | `ok`, `loading`, `no-webgl`, `context-lost`, `forced-off`, `too-slow`. (`reduced-motion` is reserved and not written: the page already knows.) |
| `dataMode` | console, figures | `'sample'` or `'live'`. `live` only when the bench was built from a real `geo` snapshot. |
| `instancesPlaced`, `healthy`, `up` | console, figures | Counts for the app on the bench. `up` is `healthy > 0`. Under reduced motion they are settled at once (healthy equals placed unless a node was broken). |
| `status` | console (live region) | One plain sentence, for example `Degraded. 3 instances placed, 2 healthy.` |
| `lastEvent` | console (live region) | `{id, kind, text, at}`. `id` increments per event, so a live region announces each once. Kinds: `placed`, `retired`, `node-down`, `node-up`, `ejected`, `rerouted`, `all-down`, `reset`, `block`. `text` is one sentence with no dashes and no emoji. |
| `hover` | hover readout | What the pointer is over: `{x, y, tier, cc, nodes, hosting, healthy}` or `null`. `x`, `y` are the pointer in pixels of the scene's own box (the host element), in both renderers. `nodes` is `null` in a sample. |

The scene never writes anything else to the bus and never touches the page's DOM. Captions are the page's
job: the scene exposes `dataMode` and status strings, it never draws text and never claims data is live
unless `geo` came from the API.

## What the scene does with the page's state

| Page state | Result |
| --- | --- |
| `visible = false`, `paused`, off screen (IntersectionObserver), tab hidden | No rAF. Resumes without a time jump. |
| An ambient scene is mounted (it covers the page) | The hero and 2D scenes stop drawing (`cover.ts`) and resume when it closes, with their slice intact. |
| `reducedMotion` | One still frame: bench settled, copies landed, failures shown, no particles, no traffic, no parallax. It redraws on page writes only, and a break, revive, reset or new instance count settles immediately. Same from the first mount. |
| Context lost | The 2D scene covers the canvas, `webgl: false, reason: 'context-lost'`. On restore the cover goes away and `reason` is `ok`. |
| No WebGL2, `quality = 0`, `forceFallback`, or `too-slow` | The 2D scene replaces the canvas for good. The bus slice keeps the same shape, so the page's controls and status work unchanged. |

The 2D scene sizes to its host box, keeps its picture in the page's free area (`insets`) inside that box,
and reports `hover` in the host box's pixels. A host the page already inset to the free area is not inset a
second time (`lib/insets.ts` computes the remainder from where the host actually sits).

### Quality

Start tier comes from `@/lib/quality` (`initialPlan`): desktop starts at 3, a four-core machine at 2, a phone
or low-memory device at 1 with a ceiling of 2. `Governor` steps down after about two seconds below 45 fps and
up after about six above 58, with hysteresis. A forced tier is locked.

| Tier | Draw | Post |
| --- | --- | --- |
| 3 | DPR up to 2, 4x MSAA HDR target, 4000 dust | Bright pass, 5-level Kawase bloom, lens dirt, restrained aberration, ACES, dither, grain, vignette in one composite |
| 2 | DPR up to 1.5, 2x MSAA, quarter-res bloom, 2000 dust | Same pass, lighter |
| 1 | DPR 1 (see below), canvas MSAA when the engine starts at this tier, 800 dust | None: each material finishes itself |

A small canvas (a phone in portrait) may draw above its tier's DPR cap, up to DPR 2 and 1.4 megapixels
(`lib/resolution.ts`). That extra resolution is the first thing withdrawn if the device holds under 45 fps,
before the tier is touched. At tier 1 on the floor, under 20 fps for five seconds hands over to the 2D
scene (`reason: 'too-slow'`).

## Data and honesty

- The bench is `@/diorama/model` (`buildSampleBench`, or `buildLiveBench(geo)` when `geo` is set). Sample
  nodes are never labelled live. Resolution is fixed at `'low'` (chunky crystals) on every tier.
- The behaviour is the real `@/diorama/sim` (`createSim`): placement, health, routing, ejection and respawn
  are its rules; the director only animates what the sim reports. The sim places each copy on a random
  eligible node, so the hero runs it with a seed that reads well (`lib/spread.ts`, `heroSeed`: among
  consecutive seeds, the one whose real placement fans out best, with different tiers and regions, copies left
  and right of the cell and none under it). The sample bench's answer is pinned as `SAMPLE_HERO_SEED` and
  re-validated by score; a live bench gets a short search. This is a documented presentation choice, not a
  measurement, and nothing is scripted beyond the seed.
- The Beat is real blocks only (see `pulse('block')` above).
- Accent colours are read from the `--accent-*` CSS variables when `document.documentElement.dataset.accent`
  matches the bus accent, else from the built-in palette. Tier colours are exact: cumulus `#36D3FF`,
  nimbus `#C77DFF`, stratus `#FFC857`.

## How to add a scene

A new view of the same bench (say a lesson backdrop with its own framing) is mostly a camera preset:

1. Add the section name to `SceneSection` in `bus.ts` if the page needs to ask for it, and map it in
   `presetFor` (`lib/camera.ts`).
2. Add the preset id to `PresetId` and its framing to `presetShape` (focus points, yaw, elevation, field of
   view, narrowness for portrait). `camera.test.ts` shows how to test a preset: the focus points must project
   inside the free rect for every aspect.
3. Nothing else changes: the engine eases to the new pose and the page writes `section` as before.

A new component (a different surface, like a small inline bench) follows `ambient.tsx`:

1. Add the mode to `EngineMode` in `engine/engine.ts` and branch where `this.mode === 'ambient'` already does
   (camera, script, dim).
2. Add a two-line entry file next to `ambient.tsx` that renders `<SceneHost mode="..." />`.
3. Decide who owns the `scene` slice. Only the hero writes it; any other scene must read the bus and write
   nothing (`write()` in `host.tsx`, `fallback.tsx` and the `mode === 'hero'` guard in `engine.ts`).
4. A scene that covers the page should call `coverStage()` (`cover.ts`) while mounted, so the hero behind it
   stops drawing.
5. Keep the page out of three.js: any new input is a bus field (add it to `bus.ts`, `bus.test.ts` and the
   tables above), never a prop that carries three.js types.

Pure logic goes in `lib/` with a test next to it; nothing under `lib/` may import three.

## Layout

```
bus.ts                    the contract (zustand), pure reducers, tests in bus.test.ts
cover.ts                  "an ambient scene covers the page" (hero scenes stop while it is mounted)
index.tsx, ambient.tsx    entry points; host.tsx owns the canvas, the lazy engine and the fallback switch
fallback.tsx              2D scene on @/diorama/render/engine, bound to the same bus controls
engine/                   three.js: engine.ts (loop, reconcile, camera, picking), terrain, pillars, cell,
                          ribbons, dust, extras (floor, frame lines, chain strip), post, glsl, uniforms, gpu, debug
lib/                      pure, unit tested: director (sim -> visuals), camera, arcs, waves, chain, spread,
                          palette, story, narrate, resolution, insets, math
world/                    bench -> world units, prism meshes
lab/main.tsx              dev harness behind /scene-lab.html (not in the production build)
```

## Dev tools

`/scene-lab.html` (dev server only) drives the real host from the URL:

| Param | Effect |
| --- | --- |
| `mode=ambient` | The ambient scene. |
| `overlay=1`, or press `a` | The ambient scene as a full-screen overlay over the hero (the app's ambient mode). |
| `manual=1`, `t=` | Engine on a manual clock; `window.__engine.advance(seconds)` for reproducible frames. |
| `section=`, `chapter=`, `p=` | Section, story chapter and progress. |
| `n=`, `region=`, `accent=` | Instances, preferred region, accent. |
| `insets=l,r,t,b` | Page insets as fractions. |
| `rm=1` | Reduced motion. |
| `q=low\|medium\|high\|none` | Forced tier (`none` is the 2D scene). `res=low\|default\|high` overrides terrain density for comparison. |
| `geo=1`, `live=1` | A synthetic geo snapshot and a live chain clock, to exercise the live path. Synthetic: never shown to visitors. |
| `panel=0` | Hide the control panel. |
| `stage=debug` | Stats overlay: tier, fps, CPU and GPU ms (when the timer extension exists), canvas size and DPR, draw calls, triangles, counts. Works on any page that mounts a scene. |

In dev builds `window.__scene` is the hero engine and `window.__sceneAmbient` the ambient one (`stats`,
`advance`, `renderOnce`, `projectNode`); the lab exposes `window.__bus`.

Tests: `npx vitest run src/scenes` (pure modules only; nothing needs a GL context).

## Art used

`ART['sprite-bokeh']` (dust sprite) and `ART['sprite-dirt']` (lens dirt) from `@/content/art`. Both are
optional enhancements: if they fail to load the scene uses a procedural sprite and no dirt. Everything else
is procedural.

## Measured

On a desktop GPU (so integrated-GPU numbers are an estimate, not a measurement), 1430x900 CSS pixels:

| Tier | Draw calls | Triangles | GPU ms | CPU ms |
| --- | --- | --- | --- | --- |
| 3 | 22 | 41k | 0.24 | 0.5 |
| 2 | 22 | 41k | 0.19 | 0.6 |
| 1 | 12 | 41k | 0.11 | 0.6 |

1920x1080 at tier 3 is 0.31 ms GPU. Scene chunk about 165 kB gzipped, plus about 6 kB for the simulation
and the 2D scene's own chunk (about 20 kB) only when it is needed.

## Known rough edges

- No measurement on a real integrated GPU or phone; the governor and the resolution boost exist for that.
- Tier 1 on a DPR 1 display is soft and has no bloom by design.
- In tall, narrow free rectangles (some story layouts) the bench is small with empty space above and below.
- The 2D scene in a very tall portrait box stretches its arcs.
- The 2D scene has no canvas click rings (the hero's `click` pulse).
- `geo=1` in the lab is synthetic. Real live data has been seen through the real home page only.
