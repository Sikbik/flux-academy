# The diorama: the Bench

An isometric hex map of the Flux network (Canvas 2D, hand-rolled pseudo-3D), a deterministic headless
simulation under it, and a small React component around both. One figure serves seven scenes, the lesson
`diorama` stage, the Network Lab and the Failover Lab, and the 2D fallback of the home hero.

```tsx
import Diorama from '@/diorama';

<Diorama scene="failover" instances={3} controls={['kill', 'revive', 'request']} />
```

Everything the figure shows is either a labelled object (a pillar, a ring, a gate) or a mechanic. It never
carries a claim: lesson prose does that. Sample worlds are marked SIMULATION; real data carries LIVE or
CACHED (`FreshnessChip`) and never invents geography.

## Where things live

| Path                      | What                                                                              | Imports                     |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------------- |
| `model/`                  | The bench: hex grid, land mask, sample world, live clusters. Pure, no DOM.         | `@/diorama/model`           |
| `sim/`                    | The simulation: placement, health, routing, volumes, deploy. Seeded, pure, no DOM. | `@/diorama/sim`             |
| `sim/rules.ts`            | Every rule, each marked REAL (with its FACTS section) or SIM, each adjustable.     | `@/diorama/sim/rules`       |
| `render/`                 | The Canvas 2D engine, scene specs and annotation drawing.                          | `@/diorama/render/engine`   |
| `Diorama.tsx`             | The component: props, controls, node list, live region, handle.                    | `@/diorama`                 |
| `narrate.ts`, `nodes.ts`  | Live region sentences and the focusable node list (pure, tested).                  | `@/diorama`                 |
| `place.ts`, `breakRegion.ts`, `taskEvents.ts` | The stage's `volume` mapping and chip words, the continent "Break region" takes offline, and the distinct-node kill tally a lesson step keeps (pure, tested). | `@/diorama` |
| `lab/`, `../../diorama-lab.html` | Development harness, not part of the production build.                      | dev server only             |

Headless parts never import React or the DOM, so the home hero, the scenes agent and tests use the same
bench and the same simulation as the lessons.

## Props

| Prop            | Type                                  | Notes                                                                                     |
| --------------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `scene`         | `SceneId`                             | `tiers placement failover traffic sync deploy network`                                    |
| `instances`     | `number`                              | Applied on mount and whenever it changes. Default 0 for `tiers` and `network`, else 3.    |
| `controls`      | `('instances' 'kill' 'kill-region' 'revive' 'request' 'region' 'replay')[]` | Built-in bar under the figure. Omit for an illustration. See Controls. |
| `live`, `geo`, `geoMeta`, `network` | | `live` plus a `geo` snapshot builds the bench from real clusters; `geoMeta` feeds the chip. |
| `annotate`      | `string[]`                            | Named annotations (below). Omit for the scene's defaults; unknown names are ignored.       |
| `region`        | `'NA' 'SA' 'EU' 'AF' 'AS' 'OC'`      | Frames that continent; in placement scenes also restricts instances to it.                 |
| `highlight`     | `string[]`                            | ISO alpha-2 codes to light up; every other pillar dims.                                    |
| `tier`, `onTierChange` | `'all' Tier`                   | Controlled tier filter of the census scenes. Uncontrolled when `tier` is omitted.          |
| `seed`          | `number`                              | Same seed, same placement and failures. Default 1.                                         |
| `place`         | `PlaceOptions`                        | `regions countries denyRegions spread appSize waitedMin volume`.                           |
| `volume`        | `'local' 'replicated' 'primary-standby'` | The volume model of the app's data (FACTS 7). Default is what each scene does: `primary-standby` in `sync`, `local` elsewhere. Choosing one shows the volume chip and, in `failover` with `local`, turns on `lost-data`. Wins over `place.volume`. See Volume modes. |
| `requestRate`   | `number`                              | Ambient requests per second (default 0.9 in `failover`, none elsewhere).                   |
| `bare`          | `boolean`                             | No built-in chips or bar; the handle and callbacks still work.                             |
| `hideFreshness` | `boolean`                             | Hides the SIMULATION or LIVE chip when the frame already says it.                          |
| `resetKey`      | `string \| number`                    | Re-applies `instances` when it changes (a lesson step restating its starting count).       |
| `domain`, `ports` | `string`, `{external, container}`   | Text of the `domain` and `ports` annotations.                                              |
| `maxInstances`  | `number`                              | Upper bound of the slider (default 12, never above 100).                                   |
| `reducedMotion`, `paused`, `aspect`, `label`, `className`, `resolution`, `autoDeploy` | | See `types.ts`.                       |
| `onInstances`   | `(n) => void`                         | Slider commits and `handle.setInstances`.                                                  |
| `onNodeKilled`  | `({nodeId, label, region, slots, distinct, source})` | Every single-node kill; `distinct` counts distinct nodes since the last reset. A region break is one `region-down` (and a `node-down` per node) on `onEvent`. |
| `onRequest`     | `({packet, count})`                   | Requests the visitor sent (never ambient traffic).                                         |
| `onPromoted`    | `({nodeId, label, gapMs})`            | A standby became primary.                                                                  |
| `onHoverNode`   | `(HoverNodeInfo \| null)`             | Pointer hover and keyboard focus of the node list.                                         |
| `onEvent`       | `(SimEvent)`                          | Every simulation event.                                                                    |
| `onReady`       | `(handle)`                            | The handle, once the simulation exists.                                                    |
| `ref`           | `Ref<DioramaHandle>`                  | The imperative handle.                                                                     |

### The handle

`setInstances(n, place?)`, `killRandom()`, `killPrimary()`, `kill(nodeId)`, `killRegion(region)`,
`revive(nodeId)`, `reviveAll()`, `send(from?)`, `setRequestRate(perSecond)`, `reset(seed?)`, `replay()`,
`startDeploy({instances?})`, `beat()`, `on(type | '*', fn)`, `state()`, `sim`, `bench`, `stats()`.

Methods are stable, safe before the figure is ready, and work with `bare`. `on` subscribers survive the
simulation being rebuilt (live data arriving swaps the bench).

### Headless use

```ts
import { buildSampleBench } from '@/diorama/model';
import { createSim } from '@/diorama/sim';

const sim = createSim({ bench: buildSampleBench(1), seed: 7, place: { waitedMin: 120 } });
sim.setInstances(3);
sim.tick(8000);                 // ms of simulated time; deterministic for a seed and call sequence
sim.on('*', (e) => console.log(e.type));
sim.killRandomInstanceNode();
sim.settle();                   // run to the end state (tests, reduced motion jumps)
```

## Controls

The built-in bar under the figure, chosen with `controls`. Every control is a real button, slider or select
and is announced through the live region.

| Control       | What it does                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `instances`   | The slider. Reports through `onInstances` when committed.                                              |
| `kill`        | "Take a node offline": the node of one running instance (the primary, in `sync`).                       |
| `kill-region` | "Break region", next to the region chooser: every node of one continent goes offline at once.           |
| `revive`      | "Bring nodes back": every node comes back, and instances that found no node start.                      |
| `request`     | "Send a request" from the next user spot.                                                               |
| `region`      | The continent chooser: frames that continent and restricts instances to it (an `ac<CONT>` allow list).  |
| `replay`      | Starts the figure over.                                                                                |

**Break region** takes the chosen continent offline while it still has a node that is up; with the chooser
on "Everywhere" it takes the continent holding the most running instances (ties go to display order). The
button is disabled when there is nothing left to break. It is one `region-down` event after one
`node-down` (`scope: 'region'`) per node; a lesson stage counts those nodes toward its `node-killed` event
once (see `taskEvents.ts`). `onNodeKilled` is unchanged: it still reports single kills only.

## Volume modes

`volume` (`'local' | 'replicated' | 'primary-standby'`, FACTS 7) is the model of the app's data, mapped to
`PlaceOptions.volume`. Without it each scene does what it always did: `primary-standby` in `sync`, a plain
`local` volume everywhere else.

| Mode              | Prefix | A replacement after its node is lost                                                     |
| ----------------- | :----: | ---------------------------------------------------------------------------------------- |
| `local`           | none   | Starts on another node with an empty volume (the old one was a file on the lost node).    |
| `replicated`      | `r:`   | Starts from a copy while another instance holds one; empty only when the last copy went.  |
| `primary-standby` | `g:`   | The same, and only the elected primary runs the `g:` component. FDM sends every port to it; failover takes minutes there and is compressed here (the figure says so). |

- **The chip.** Choosing a mode (or being the `sync` scene) names it in a small chip at the far end of the
  chip row: "Volume: local, on one node", "Volume: replicated to all", "Volume: primary and standby". A
  lesson that never chooses one never sees it. `bare` hides it with the others.
- **Lost data.** The simulation marks a replacement that started empty (`Instance.dataLost`, the `placed`
  event's `dataLost`). The `lost-data` annotation draws it: an EMPTY DISK tag hung under the instance's own
  label (or at its node when that label is not drawn), in the warning colour with a hollow disk in the
  marker. It stays while that incarnation runs and is gone on reset. It is on by default in `failover`
  when the stage chose `local` (and otherwise only when listed in `annotate`); it never fires for a volume
  that kept its data.
- **The same words, heard and read.** Whenever `lost-data` is drawn, the live region says "Instance 2
  restarted in Frankfurt, Germany with an empty disk.", the node list says "restarted with an empty disk"
  and the hover probe adds an EMPTY DISK line. Where it is not drawn, none of them say it.
- **Changing the mode in place.** A stage that changes `volume` re-applies it to the running figure; the
  history of the old model (`dataLost`) starts over. A scene change returns to that scene's own mode.

## Scenes

Each scene is one drawing routine plus a few switches (`render/scenes.ts`). `annotate` picks from the
scene's names; without it the defaults (first column) are drawn. Every annotation draws itself in (lines
grow, rings sweep, text is wiped in; nothing fades) and draws again if it leaves and comes back.

### `tiers`

Pillars coloured and sized by tier. No app. Tier filter chips; hover a pillar for its tier card.

| Name      | Default | What it draws                                                                    |
| --------- | :-----: | -------------------------------------------------------------------------------- |
| `tiers`   | yes     | One leader per tier to a representative pillar: CUMULUS, NIMBUS, STRATUS.        |
| `height`  |         | A dimension line beside a Stratus pillar: TIER CLASS (NODES, LOG SCALE when live). |
| `frame`   |         | Corner brackets and a tick ruler around the land.                                 |
| `regions` |         | The six continent names, at the centre of each.                                   |

### `placement`

The specimen (your app) above the bench; light arcs land on distinct nodes with a lock ring. Controls:
`instances`, `region`, `replay`.

| Name        | Default | What it draws                                                              |
| ----------- | :-----: | -------------------------------------------------------------------------- |
| `specimen`  | yes     | A leader to the cell: YOUR APP.                                            |
| `instances` | yes     | A numbered leader per instance (first eight; five on a phone) with its place. |
| `span`      |         | A dimension line under the map across the instances: N INSTANCES.          |
| `lost-data` |         | As in `failover`.                                                          |
| `frame`, `regions` |  | As above.                                                                  |

### `failover`

Placement plus nodes you can kill and revive, request packets, the proxy gate and user spots. Controls:
`kill`, `kill-region`, `revive`, `request`, `instances`, `region`. Ambient traffic at 0.9 requests per
second.

| Name        | Default | What it draws                                                                   |
| ----------- | :-----: | ------------------------------------------------------------------------------- |
| `instances` | yes     | As in `placement`.                                                              |
| `down`      | yes     | An `!` leader on an instance whose node is offline: OFFLINE.                    |
| `reroute`   | yes     | For three seconds after a redirect, a leader on the node that answered: REROUTED. |
| `lost-data` | with `volume: 'local'` | A tag hung under the label of each instance that restarted on an empty volume: EMPTY DISK (a hollow disk in a warning ring). See Volume modes. |
| `specimen`, `span`, `proxy`, `user`, `frame`, `regions` | | As in `placement` and `traffic`.             |

### `traffic`

The path of a request: a user spot, the proxy gate, a node. Controls: `request`, `instances`.

| Name        | Default | What it draws                                                                  |
| ----------- | :-----: | ------------------------------------------------------------------------------ |
| `user`      | yes     | A leader on the spot the latest request came from.                             |
| `domain`    | yes     | A leader on the gate with the `domain` prop (default `myapp.app.runonflux.io`). |
| `proxy`     | yes     | A leader on the gate: PROXY.                                                    |
| `ports`     | yes     | Two leaders on the first instance: PUBLIC PORT and CONTAINER PORT, with numbers when `ports` is given. |
| `instances` | yes     | As in `placement`.                                                              |
| `down`, `reroute`, `lost-data`, `specimen`, `frame`, `regions` | | As in `failover`.                  |

### `sync`

A volume with a primary and standbys (`volume: 'primary-standby'`). Controls: `kill` (takes the primary
offline), `revive`.

| Name          | Default | What it draws                                                                |
| ------------- | :-----: | ---------------------------------------------------------------------------- |
| `primary`     | yes     | A leader on the primary: PRIMARY (and a double ring on its cap).             |
| `standby`     | yes     | A leader per standby: STANDBY (a ring that sweeps while it syncs).           |
| `replication` | yes     | A leader on the first dashed link from the primary: REPLICATION.             |
| `promotion`   | yes     | For four seconds after a promotion, a leader on the new primary: PROMOTED.   |
| `gap`         | yes     | While there is no primary, a leader on the lost node: NO PRIMARY.            |
| `down`, `lost-data`, `specimen`, `instances`, `frame`, `regions` | | As above.                         |

### `deploy`

The whole pipeline as an animation: spec, register, block, select, install, live. Starts on mount (set
`autoDeploy={false}` to wait for `handle.startDeploy()` or the Replay control).

| Name         | Default | What it draws                                                                      |
| ------------ | :-----: | ---------------------------------------------------------------------------------- |
| `pipeline`   | yes     | A six step strip along the bottom edge; the active step fills as the phase runs.    |
| `block`      | yes     | A short chain at the top right; the spec travels to it and a block is stamped.      |
| `candidates` | yes     | While nodes are being selected, a leader on one of the nodes in play: CONSIDERING.  |
| `specimen`, `instances`, `frame`, `regions` | | As in `placement`.                                      |

### `network`

The whole network. Pillars are real clusters when `live` data is given; tier filter chips; hover a pillar
for its country and cluster size. `handle.beat()` sends one block pulse across the bench (the lesson stage
calls it on every real block).

| Name      | Default | What it draws                                  |
| --------- | :-----: | ---------------------------------------------- |
| `regions` | yes     | The six continent names.                       |
| `tiers`, `height`, `frame` | | As in `tiers`.                          |

## The simulation

All rules are in `sim/rules.ts` and are plain data, so a lesson can show them and a test can change them.
Each is marked REAL (with its section of `docs/research/FACTS.md`) or SIM (compressed so it can be
watched). The renderer and the captions never print a SIM number as a fact.

| Rule                      | Modelled as                                                                                          | Source        |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | ------------- |
| No central scheduler      | Each slot picks among eligible nodes with a seeded random draw; no global optimum                      | FACTS 6.2     |
| Tier preference is soft   | Stratus and Nimbus defer small apps by timers (57 to 117 minutes); later tiers join as the app waits   | FACTS 2.4, 6.1 |
| Distinct nodes, distinct IPs | Two instances never share a node address                                                           | FACTS 6.2     |
| Fault domains             | For synced volumes a hosting organisation may hold only a share of the instances                      | FACTS 6.2     |
| Geolocation allow and deny | `ac<CONT>`, `ac<CONT>_<CC>`, `a!c<CONT>` entries; a deny beats an allow and an entry it does not understand is skipped. The registration check (refused only when some nodes qualify but fewer than the instances) is not modelled: the figure just shows instances that find no node | FACTS 3.5     |
| Instances                 | Minimum 1, maximum 100                                                                                | FACTS 3       |
| Health check              | TCP connect every 3 s; ejected after 2 fails, reinstated after 2 passes (about 6 s). Not compressed; the numbers come from `FDM_TIMING` in `@shared/flux/timing` | FACTS 6.4     |
| Load balancing            | Round robin, sticky per user, `retries 3` with redispatch; connect timeout compressed                  | FACTS 6.4     |
| Replacement               | Real: location records last 125 minutes, then another node installs a replacement (it can take about two hours, more for a synced volume). SIM: 20 s, 375 times faster (`SIM_COMPRESSION.replacement`). An instance that found no node (its continent is dark) starts when nodes come back | FACTS 6.3, 6.5 |
| `g:` failover             | Real: FDM moves away only after at least 3 failed checks and 90 s of unhealthiness, the node election runs every 30 s and a standby at position `i` waits about `i` x 3 minutes, so minutes. SIM: about 15 s from the kill to the promotion, 12 times faster (`SIM_COMPRESSION.failover`), of which the router's 6 s is real. The figure says "time compressed" and the narration says it is compressed for the screen. Only the first standby in line is modelled | FACTS 6.4, 7.2 |
| Which part moves          | The simulation promotes one volume holder. On the network only the `g:` component is started and stopped by the election, while FDM sends every port of the app to the primary node | FACTS 6.4, 7.2 |
| Volumes                   | Plain: one volume on one node, lost with it (the replacement starts empty: `dataLost`). `g:` primary and standby. `r:` and `s:` replicate (Syncthing) | FACTS 7       |
| Claim tie-break, FDM polling interval | Named, adjustable, and never stated as fact in a caption (the tie-break was not read in detail; FDM polls every 30 s by default and a new copy can take minutes to reach the load balancer) | FACTS 6.2, 6.1 row 13 |

Placement default is honest (`spread: 'random'` among eligible nodes, tier timers as above). The component
passes `spread: 'regions'` and `waitedMin: 120` unless `place` says otherwise: a teaching layout that
spreads instances over continents and lets every tier compete so the picture reads. It is not a network
claim; set `place={{ spread: 'random', waitedMin: 0 }}` for the honest default.

## Accessibility

- The canvas is `aria-hidden`. Its parallel is DOM: the control bar, a status chip, a polite live region,
  and a list of the nodes that matter (the app, its instances, offline nodes, up to a dozen notable
  others). The list is one tab stop with roving arrow keys; Enter takes an instance offline or brings it
  back when the scene has the `kill` control; focus draws a ring on the canvas and fires `onHoverNode`.
- The live region speaks one coalesced paragraph per burst: "Node in Frankfurt, Germany went offline.
  2 requests rerouted." A broken region is one sentence, not one per node: "Europe went offline: 63
  nodes." A replacement that started empty says so: "Instance 2 restarted in Frankfurt, Germany with an
  empty disk." (only where the `lost-data` tag is drawn). Ambient traffic is never announced; requests the
  visitor sent are.
- Reduced motion (the visitor's choice or the OS): no frame loop, no tweens, no particles; every state
  change still draws at once. The simulation runs in real time on a coarse clock only while something is
  in motion, so a timeline (a replacement after twenty seconds) still reads in order.
- The probe reticle is local to the figure and never hides or replaces the OS cursor.

## Performance and quality

Terrain is baked once per size and camera into an offscreen layer; a frame draws that layer, then only
the pillars, effects and annotations. Hit testing uses a spatial grid over pillar capsules. The governor
(`@/lib/quality`) picks the pixel ratio cap, the bloom and the terrain density (`?q=low|medium|high`
locks it).

| Tier | Terrain      | Cells | DPR cap | Bloom                 |
| ---- | ------------ | ----: | ------: | --------------------- |
| 1    | `low` 4.2 deg | 1,255 | 1       | none                  |
| 2    | `default` 3.3 deg | 2,027 | 1.5 | one pass (1/6 scale)  |
| 3    | `high` 2.7 deg | 2,980 | 2      | two passes            |

Frame budget in the dev lab, 1440 by 900, 131 pillars, 40 instances and 20 requests per second:
60 fps at every tier, 2 to 5 ms of draw time. The loop stops when the figure is off screen, the tab is
hidden, `paused` is set or motion is reduced.

The loop is paced. A busy figure draws at up to 60 frames per second (every second refresh on a 120 Hz
display). A figure at rest draws at about 30: no request in flight, nothing installing or syncing, no
camera move and nothing invalidated for 2.8 s (a parked pointer is at rest). Any event, pointer move,
prop change or request wakes it for another 2.8 s. The governor only counts full rate frames, so pacing never reads as a
slow device. `handle.stats()` reports `fps` (frames drawn) and `quiet`.

CPU in the lab (headless Chromium, software rasterisation, tier 3, 1440 by 900, one main thread):
about 9 to 13 percent at rest, 24 percent with ambient traffic in `failover` (0.9 requests per second),
27 percent with 40 instances at 20 requests per second, about 1 percent under reduced motion or off
screen. A 30 second soak of random kills, region kills, revives, requests, slider moves, hovers and key
presses while stepping through all seven scenes produced no console output and a flat heap (about 11 MB
after GC).

## Development lab

`diorama-lab.html` (dev server only; Vite builds `index.html` alone) mounts the component from query
parameters: `scene`, `instances`, `controls` (comma list, including `kill-region`), `region`, `annotate`,
`volume` (`local`, `replicated` or `primary-standby`), `highlight`, `reduced=1`,
`bare=1`, `w`, `rate`, `aspect`, `resolution`, `seed`, `accent`, `cycle` (milliseconds: steps through
every scene on a timer, for soak tests), and `?q=` for the quality tier. The handle is on
`window.__handle`.
