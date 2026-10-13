# Flux Academy v2: design direction

Status: v1.0, the brief for the ground-up rewrite. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for contracts and
ownership and [CONTENT.md](./CONTENT.md) for pedagogy and the lesson contract. This document is the art
direction: what the Academy looks, moves and feels like, page by page, with the numbers to hit.

Academy v1 was a Tailwind template with a gradient headline. Nothing from it survives except the URL, the
deploy slot and the subject matter. The bar for v2 is a product people would screenshot.

## 0. Look targets and references

Open these before you design anything. Generated frames are **look targets, not shippable assets**.

| File | What it is | Use it for |
| --- | --- | --- |
| `docs/design/refs/ref-bench.webp` | Academy concept: an isometric hex world with tier-coloured pillars and a specimen cell launching onto three of them | The network diorama and the hero scene |
| `docs/design/refs/ref-specimen.webp` | Academy concept: the app cell, a glass hex prism with layered slabs and gauge arcs | The cell, every stage that shows "your app" |
| `docs/design/refs/ref-blueprint-ui.webp` | Academy concept: chamfered glass panels with ticks, crosshairs, dimension lines and callout markers | The UI material and the annotation language |
| `docs/design/refs/ref-constellation.webp` | Academy concept: a three-band skill constellation of hex nodes | The course map |
| `/home/stache/Projects/fluxcommunity/docs/design/refs/*.webp` | The sibling Flux Community portal's look targets | Family resemblance |

Read-only sibling code to learn techniques from (do not copy a layout; reimplement in the Academy's own
terms, and port framework-free utilities only with a provenance comment):

- `/home/stache/Projects/fluxcommunity/`: `docs/DESIGN.md` (the system this one is a sibling of),
  `web/src/ui/` (primitives), `web/src/stage/` (a three.js stage with quality governor, hex grid, tiers),
  `web/src/system/` (WebAudio synth), `web/src/palette/` (command deck), `web/src/ambient/`,
  `web/src/styles/tokens.css`.
- `/home/stache/Projects/Flux_Atlas/docs/design/`: `tokens.css`, `design-direction.md`,
  `motion-language.md` (large; skim for rules of motion and glyphs).
- `/home/stache/Projects/stachetech/src/`: `portals.tsx` (route-like transitions), `bootScreen.tsx`,
  `commandPalette.tsx`, `achievements.tsx`, `screensaver.tsx`, `blackHoleScene.ts` (raw WebGL).
- Brand: `/home/stache/Downloads/media-logos-master/` and `web/public/brand/` (already curated, read-only).
  The brand book (`Flux_Brand_Book.pdf`) rules: Blue Wave `#2B61D1`, shades `#4F7AD4` and `#86A1DA`,
  black, graphite `#2D2D2D`, gray `#717171`, white. Montserrat leads, Open Sans supports, Lora accents. The
  mark is never recoloured outside blue, white, black or gray, never distorted, and keeps its clear space.

---

## 1. The idea: the Lab

Flux Community is a vista: a lattice horizon and a monumental symbol. The Academy is the opposite
register: **a teaching lab built inside the network**. The camera comes down from the horizon to a
bench. Where Community says "look how big this is", the Academy says "here, touch it".

Four things live in the Lab, and every page is built from them:

1. **The specimen.** A glass hexagonal prism, *the cell*: one app. Inside it you can see its layers; on
   its side three gauge arcs show CPU, RAM and disk. Everything the Academy teaches is something you do to
   the specimen: configure it, price it, expose it, replicate it, break it.
2. **The bench.** An isometric field of small hex pillars, the network. Short pillars are cumulus
   (cyan), mid are nimbus (violet), tall are stratus (amber). Clusters read as continents. Real data
   lights real places. This is where the specimen is *placed*, where nodes fail and where traffic finds a
   way.
3. **The annotation layer.** Blueprint language: hairlines, tick rulers, crosshairs, numbered callout
   markers on leader lines, dimension lines, "FIG. 3.2" captions. It is how the Lab *explains*. It draws
   itself in, step by step, beside the thing it describes. This is what makes the site feel educational
   rather than merely decorative.
4. **The instruments.** Odometers, hex gauges, meters, sparklines, the live block beat. Numbers are
   never static: they roll, they say how fresh they are, and they come from the real network.

Why this idea:

- It is native to the brand (the mark is four hex shards, the tiers are the three skill levels) and
  distinct from Community (horizon, symbol), Atlas (globe) and stachetech (OS desktop), while sharing
  their craft: dark glass, hairlines, precision, a live pulse.
- It gives *learning* a physical metaphor: observe the specimen, configure it, deploy it onto the bench,
  break it, fix it. Every lesson is that loop.
- One motif scales from the full-screen hero, to the material of every panel, to the course map, to the
  glyph set, to the generated art.

Three feelings to hit, in this order: **awe** in the first three seconds (a world of light you can
touch), **orientation** in the next ten (what is Flux, what do I do here, where do I click), then
**mastery** that keeps rewarding practice (things respond, you can always see why, you get better and the
site visibly knows it).

## 2. Principles

1. **Learn by touching.** Every concept has something to drag, type, click or break within ten seconds
   of meeting it. Reading is the fallback, never the default.
2. **Alive, not busy.** Constant subtle motion, rare big motion. At most two things compete for
   attention. The bench is ambient; the lesson is the foreground.
3. **Show the mechanism.** Diagrams show the real moving parts and animate the cause, not decoration.
   When something changes (a price, a placement, a lint result) the learner sees *why*.
4. **Light is the material.** Surfaces are dark glass; information and affordance are emissive. White-hot
   marks "this matters now". Blue is structure. Tier colours are for tiers and tracks only.
5. **Precision.** Hairlines, tick marks, tabular mono numerals, exact alignment, consistent chamfers.
6. **Honest.** Live data says it is live, stale data says so, simulations say they are simulations, and
   nothing fake is dressed as real. A simulated terminal never claims to have touched the network.
7. **Kind to errors.** Mistakes are the lesson. A failed lint explains why the network cares and how to
   fix it. Nothing scolds; nothing is a dead end; every task has "show me".
8. **Fast and calm.** Content paints immediately; the 3D arrives when ready; low-end devices, reduced
   motion and no WebGL get a calm, complete experience, not a broken one.

## 3. Visual language

### 3.1 Colour

Dark only. Elevation is lightness (`--ink-0` to `--ink-5`), not drop shadow. Surfaces carry a 4 to 6
percent Blue Wave cast so panels share a colour space with the accent.

| Role | Rule |
| --- | --- |
| Void | `#000` behind everything |
| Surfaces | `--ink-0..5` with the blue cast |
| Structure | Flux Blue scale `--accent-300..700` (default accent `#2B61D1`, `#4F7AD4`, `#86A1DA`); hairlines `--line-1..3` |
| Blueprint | `--blueprint` = accent-400 at 30 to 45 percent: annotation lines, dimension lines, ticks |
| Attention | White-hot `#fff` and `--hot-2`: focus rims, active edges, beam heads, success flashes |
| Tiers and tracks | Cumulus `#36D3FF`, Nimbus `#C77DFF`, Stratus `#FFC857`. Only for tiers, tracks, ranks |
| Status | ok `#3FDC95`, warn `#FF9A3D`, crit `#FF5470`, off `#717171`; always with an icon and a word |

**Accent switching** (`html[data-accent="flux|cumulus|nimbus|stratus"]`) re-points `--accent-*` and the
scene glow. The Flux symbol and logo never change colour. A tier accent **unlocks when the learner
finishes that track** (switcher shows locked ones dim with a lock glyph and the rule); `flux` is always
available. Contrast stays AA on every accent.

### 3.2 Type

Montserrat (variable) for display and headings, Open Sans (variable) for text, IBM Plex Mono for data,
labels, kbd, hashes, code, terminal and the instrument voice, Lora (variable, italic) as the accent: at
most one editorial line per page (the "why this matters" pull-quote). All self-hosted via `@fontsource*`,
latin subset.

- Display: `clamp(2.75rem, 7.5vw, 7rem)`, 700 on key words and 300 on the rest, tracking `-0.04em`,
  line-height 0.95. Mixed weights in one headline are the signature.
- H2: `clamp(1.875rem, 4vw, 3.5rem)`, 600, tracking `-0.03em`. H3 1.25 to 1.5rem 600.
- Body: 1rem to 1.0625rem, 1.65, `--text-2`. **Measure max 62ch** in lessons. Lesson body is 1.0625rem.
- Labels: mono 11 to 12 px, uppercase, tracking `0.12em`, `--text-3`. Eyebrows read `03 / DEPLOY` with a
  hex bullet; figure captions read `FIG 3.2  PLACEMENT OF THREE INSTANCES`.
- Numbers: always `font-variant-numeric: tabular-nums`; big stats are Montserrat 300 to 600.
- Code: mono 0.875rem, 1.6, with a copy button, optional line numbers and line highlights.

### 3.3 Shape and material

- **Chamfer, not radius.** Panels have two diagonal cuts (top-right and bottom-left, `--chamfer` 14 px;
  large panels 22 px; inputs and chips 8 px). No pills except the nav and toggles.
- **Glass slab** (see `ref-blueprint-ui.webp`): `--ink-0` at about 62 percent, `backdrop-filter:
  blur(18px) saturate(1.4)`, a 1 px gradient edge (brighter on one cut corner), faint hex pattern and
  grain, corner crosshairs, an edge tick ruler on one side, an inner top highlight. Hover adds a
  cursor-following spotlight and raises edge luminance; press compresses 2 percent.
- **Hexagon bullets, rings and gauges** instead of dots and circles wherever it reads well.
- **Blueprint furniture** as structural decoration at 4 to 8 percent opacity: hairline grid, tick rulers,
  crosshairs. Decoration never carries information and never fights text.
- Depth by layering and gentle parallax (up to about 8 percent), not by blur soup.

### 3.4 Iconography

A custom glyph set (SVG, 1.5 px stroke at 24 px, square caps, hex-derived geometry) for tracks, lesson
kinds, labs, status and actions. Lucide is allowed for generic UI controls only (close, chevrons,
search). No emoji anywhere. The Flux symbol is only ever the official asset in `web/public/brand/`.

### 3.5 Imagery

- Real Flux marks from `web/public/brand/`.
- Generated art (section 9): emissive objects on pure black, composited with `mix-blend-mode: screen`
  or additively in WebGL, so they sit inside the dark UI with no boxes. Never trace the look targets.
- Procedural: the bench, the cell, the diagrams, the gauges. Prefer procedural for anything that must
  animate or respond; use generated art for emblems, atmosphere and textures.

### 3.6 Light and post

Bloom (soft, high threshold), restrained chromatic aberration toward the edges, fine grain, a vignette
that keeps corners dark, depth fog toward the horizon. Glows are accent-tinted and low alpha; avoid grey,
muddy halos. Scenes dim themselves behind dense content so text always has contrast.

## 4. Motion language

Native scrolling, always (no scroll hijacking). Everything is interruptible. Everything has a
reduced-motion twin that is calm but complete (opacity fades, no parallax, no camera moves).

| Token | Value | Use |
| --- | --- | --- |
| `--dur-1` | 120 ms | hover colour, focus rings |
| `--dur-2` | 220 ms | small UI transitions |
| `--dur-3` | 380 ms | panels, drawers, tooltips |
| `--dur-4` | 700 ms | section reveals, count-ups, step changes |
| `--dur-5` | 1200 ms | camera moves, hero beats |
| `--ease-out` | `cubic-bezier(.16, 1, .3, 1)` | default entrance |
| `--ease-in-out` | `cubic-bezier(.65, 0, .35, 1)` | movement across the screen |
| `--ease-snap` | `cubic-bezier(.2, .9, .2, 1.15)` | small overshoot on press release |

Shared patterns (build each once as a primitive and reuse):

- **Reveal:** opacity 0 to 1, translateY 24 px to 0, blur 8 px to 0, stagger 60 ms, once, on entering
  the viewport. Headlines reveal by word or line.
- **Count and odometer:** numbers count up the first time they appear and roll digit by digit on change.
- **Draw:** hex outlines, rules, leader lines and dimension lines draw themselves
  (`stroke-dashoffset` or `scaleX`). The annotation layer always *draws in*, it never fades in.
- **Magnetic:** primary buttons drift up to 6 px toward the pointer within an 80 px field (fine
  pointers only).
- **Tilt and spotlight:** cards tilt up to 5 degrees toward the pointer with a moving specular
  highlight and a radial spotlight under the cursor.
- **Focus beam:** keyboard focus draws a white-hot rim that sweeps around the chamfer.
- **The Beat:** every real block (about 30 s) fires one soft pulse: tick marks flare, the block counter
  rolls, hairlines brighten and the bench sends a ring outward. It is the site's heartbeat. If the API
  is offline there is **no** simulated beat; the UI shows an "offline" state instead.

Academy-specific patterns:

- **Hex iris:** route changes reveal the new page through a growing hexagon (`clip-path: polygon` on the
  View Transitions API, centred on the activating element or the viewport centre, 420 ms, `--ease-out`).
  Browsers without view transitions get a 160 ms fade. Reduced motion gets none. Focus moves to the new
  page's `h1`.
- **Launch:** deploying the specimen: the cell lifts, splits into N copies that arc to distinct pillars
  along bezier paths with a light trail, and each landing fires a ring and a short "lock" tick. 900 to
  1400 ms total, staggered 90 ms.
- **Break and heal:** a failing node flickers (3 quick on/off cycles), desaturates, a crack line draws
  across its top face and its beams cut. Packets that were heading there curve to the nearest survivor.
  Reviving ignites it from the centre outward with a ring. Traffic dots are small, fast and honest: they
  go where the router would send them.
- **Scan:** when lint runs, a thin accent line sweeps the editor top to bottom (240 ms); each issue
  then draws its underline and its marker, 40 ms stagger.
- **Land:** completing a step ticks its segment in the progress rail with a snap and a tiny ring;
  completing a lesson rolls XP up in an odometer, sends a ring through the bench, and slots a hex shard
  into the track badge. Ranking up washes the viewport with the tier colour for 600 ms (opacity 0.18) and
  swaps the accent if unlocked.
- **Probe:** over the bench or a diagram the pointer becomes a thin crosshair reticle with a mono
  readout of what is under it. (This is local to the figure; the OS cursor is never hidden or replaced.)

Sound is optional and **off by default**: a tiny WebAudio synth (no assets) for hover ticks, a block
chime, confirm and error blips, and a rank-up sting. Never autoplays; honours reduced motion as "off".

## 5. Information architecture and pages

Real URLs (History API), code-split by route. Page transitions use the hex iris. The shell is a header
(sticky, glass), the page, and a footer.

| Route | Page | Job |
| --- | --- | --- |
| `/` | Home | Awe, then orientation: what Flux is, what you will learn, one live toy |
| `/learn` | Course map | The whole curriculum as a constellation; where am I, what is next |
| `/learn/:lessonId` | Lesson | The lesson player: steps, stage, tasks, checkpoint, recap |
| `/labs` | Labs index | Every lab as a lit instrument |
| `/labs/spec-forge` | Spec Forge | Build and price a spec with a teaching layer |
| `/labs/network` | Network Lab | The live network, explained |
| `/labs/failover` | Failover Lab | Place, break, heal |
| `/labs/terminal` | Terminal | Sandbox shell with challenges |
| `/labs/explorer` | App Explorer | Where a real app runs right now |
| `/labs/agent-desk` | Agent Desk | A simulated MCP session: approve or refuse each tool call |
| `/reference`, `/reference/{spec,networking,docker,api,orbit,agents}` | Reference | Look things up, field by field |
| `/glossary` | Glossary | Terms, searchable, each with "why it matters" |
| `/troubleshoot` | Troubleshoot | Symptom to cause to fix, as an interactive tree |
| `/profile` | Profile | Rank, XP, achievements, certificate, preferences, data |
| `*` | Not found | A friendly dead end with the command deck and three useful links |

Old routes redirect (see `shared/site.ts` `REDIRECTS`).

### 5.1 Shell

- **Header:** lockup left (round Flux symbol plus "Flux" 700 "Academy" 300), a pill nav with a sliding
  active indicator (Learn, Labs, Reference, Glossary), and on the right: the **block beat** chip (hex
  glyph plus the block height in an odometer, with freshness dot, `aria-live="off"`), the **rank chip**
  (hex progress ring around the current rank glyph; opens the profile), the command deck button (shows
  `Ctrl K` or the Mac equivalent), the accent switcher (four hex swatches, locked ones dim), the sound
  toggle. It condenses after 120 px of scroll. On phones the nav becomes a bottom sheet from a hex menu
  button and the right cluster collapses to the rank chip and the deck button.
- **Backdrop:** non-home pages sit on a cheap, calm backdrop: a CSS/canvas lattice field, very low
  contrast, slow drift, that dims further behind dense content. It is one component, reused everywhere.
- **Footer:** nav links, the "Running on Flux" badge (this site does), data attributions ("Network data
  from the Flux public API; price from CoinGecko"), links to docs.runonflux.com, cloud.runonflux.com and
  Discord, back-to-top hex. There is no legal or trademark line under the columns.

### 5.2 Home

One long page, native scroll, sections in this order:

1. **Hero.** Left: eyebrow `FLUX ACADEMY / THE DECENTRALIZED CLOUD, EXPLAINED BY
   DOING`; H1 **Learn to deploy on a network of {N} independent machines.** with the node count in an
   odometer (700 weight, accent gradient) and the rest 300, shown only while the network data is LIVE or
   CACHED (a headline number has no freshness chip: with a BAKED sample or offline it reads "thousands of"
   and the strip below carries the dated figure); subhead one sentence; CTAs: primary **Start
   the course** (to `/learn/what-is-flux`, magnetic, glow), secondary **Open the Spec Forge**. Right
   (desktop) or below (mobile): the **stage**, a WebGL bench with the cell above it, three copies of an
   app placed on distinct pillars (live node positions when the geo snapshot is available) and request
   packets flowing to them. It is a picture, not a control: the instance slider and the break button live
   in the Failover Lab, where there is room to explain them (an earlier build put them here and they read
   as confusing next to the headline). A caption under it: "This is a simulation of how Flux places an
   app. Real network data lights real locations." with the SIMULATION chip and the locations chip.
   Live strip along the bottom: block height with a "next block" ring, nodes online, FLUX price with
   24 h change, each with a freshness chip.
2. **How it works (scroll story, `#story`).** A sticky stage with four chapters driven by scroll
   progress: **Describe** (a spec types itself; the cell forms around it), **Register** (the spec's hash
   is stamped into a block; a ring runs along the chain strip), **Place** (instances arc to pillars,
   tiers highlight), **Run** (traffic flows; one node drops; "still up"). Each chapter has about 40 words of
   text and a link to the lesson that goes deeper. Describe runs longer because it is the one place
   that says where a spec comes from: you type it, the FluxCloud assistant drafts it from a sentence, or
   Orbit generates it from a Git repository, and the network receives an ordinary spec signed by its owner
   either way. That is the single idea of the AI additions: an assistant or an agent changes who types the
   spec, not what the network does.
3. **Pick your path.** Three towers (Cumulus short, Nimbus mid, Stratus tall), each a glass slab with its
   emblem, the track name, a one-line promise, lesson count and minutes, the learner's progress ring,
   and the live count of nodes of that tier. Hover isolates the tier on the bench behind. This is the
   course's front door.
4. **The labs.** One instrument card per lab, as a bento: art, name, one line, a tag that says what the
   card shows (Price engine, Network data or Simulation) and a tiny live preview where cheap (the Network
   card carries the node count with its freshness chip). Desktop (1280 px and up) is four columns by two
   rows. The first lab (the Spec Forge, the one the most lessons embed) and the last (the newest, the Agent
   Desk) are two cells wide, with the picture beside the words and on the outer edge of each, so the pair
   sits on a diagonal; the four between them are one cell, picture above the words. Tablet is two columns
   with the wide cards across, phones are one column. The count in the heading and the list label come from
   the curriculum, and the wide cards exist only while the labs fill whole rows (`bentoCells` in
   `routes/home/logic.ts`): any other count falls back to one cell each and wraps.
5. **Live network.** The Pulse strip expanded: tier gauges (count, share, collateral), block cadence
   sparkline, top countries, "what this means for you" under each one-sentence annotation. Honest chips.
6. **What you will build.** A horizontal rail of real examples in course order (a web app, an app from a
   Git repository, a Minecraft server, data that outlives a node, a shop and its database, a
   multi-container app, an agent you supervise), each linking to the lesson that builds it. The rail
   scrolls by touch, by the buttons and by keyboard, and bleeds off the right edge so it reads as a shelf;
   the heading's count comes from the list.
7. **Close.** One line, one CTA, then the footer.

First visit of a session plays a 1.6 s **intro**: black, lattice cells ignite from the centre, the four
shards lock into the symbol, one white flash, the headline reveals. Any key, click or scroll skips it. It
never blocks: text and CTAs are in the DOM from frame one. Skipped for reduced motion, `?intro=0`, and
repeat visits in the same session.

### 5.3 Course map (`/learn`)

A **constellation** (see `ref-constellation.webp`): every lesson (20 at the time of writing) as hex nodes
in three tier-coloured bands left to right, prerequisite edges as luminous lines (advice, not locks). Node state: *untouched*
(dim outline), *in progress* (half ring), *complete* (filled, tier-lit, a shard), *recommended next*
(pulsing white-hot rim and a label "Next"). Hover or focus shows a lesson card (title, minutes, kind
glyph, objectives, progress) and lights its prerequisites. Click opens the lesson. A toggle switches to a
**list view** (also the accessible one: grouped by track, with the same states and keyboard order).
Header of the page: overall progress ring, XP, rank, "Resume" button that goes to the saved step. Pan and
zoom are not needed; the map fits at every width (it rotates to vertical bands on phones).

### 5.4 Lesson player (`/learn/:lessonId`)

The signature page. Desktop: two columns, **narrative (about 40 percent)** and **stage (about 60
percent, sticky)**, with a slim progress rail on top (one segment per step plus one per checkpoint
challenge). Mobile: stage on top at 42 vh (collapsible), narrative below, a fixed bottom bar with
Back, Continue.

- A **step** is one idea, one stage, at most one task. The step body reveals (words, 60 ms stagger).
  Callouts (`why`, `gotcha`, `tip`, `wild`, `cost`) are marginalia with their own glyph and tint.
- The **stage** swaps with a 380 ms crossfade plus a hairline "scan". Stage kinds: diorama, spec, terminal,
  diagram, code, compare, widget (CONTENT.md section 3). The stage keeps its state across steps when the
  stage `kind` and `scene` are unchanged, so a story can *continue* rather than reset.
- **Tasks** gate Continue. Feedback is immediate and specific. After the first failed attempt a `Show me`
  button appears (does it for you, half XP) and `Skip` is allowed. Tasks never time out.
- **Keyboard:** `Right` or `Enter` continue (when allowed), `Left` back, `G` then `O` opens the outline
  drawer, `?` shows shortcuts. Progress and position are saved on every step.
- **Checkpoint:** the challenges render one at a time in the narrative column with the same stage
  area used for spec and terminal challenges. Wrong answers show the `hint` and let you retry; right
  answers show `explain` with a satisfying tick.
- **Completion:** XP roll-up, the recap list, "You can now ..." objectives ticked, the next lesson card,
  related labs, and a share-less "copy completion link" (no server state). If it completes a track, the
  rank-up moment plays.
- **Outline drawer:** all steps listed with state; also the printable article view (`?view=article`)
  that renders every step linearly with static stages. This is also what no-JS crawlers would need; the
  server injects title, description and JSON-LD.

### 5.5 Labs

A shared **lab frame**: title bar (name, one-line purpose, "What is this?" popover), the working area,
a persistent "Teach me" drawer (concept notes for whatever you have selected), and a bottom status
strip (data freshness, simulation notice where relevant, shortcut hints).

- **Spec Forge** (flagship). Three regions: left, a form builder (app level, then one accordion per
  component) with field-level `?` popovers that teach (what it is, the limit, the common mistake, a docs
  link); centre, the live JSON in a real editor with inline lint markers and a line gutter, two-way bound
  with the form; right, the **cost reactor** (hex gauges for CPU, RAM and disk, an odometer for the
  monthly price in USD and FLUX, a waterfall of line items each with a one-sentence "why", and a
  "verify with Flux" button that asks the server to confirm with the official calculator and shows
  `OFFICIAL` or `COMPUTED`) and below it a mini **placement preview** (the diorama, instances landing
  for the chosen geolocation). Top bar: presets (Hello world, Web app, Minecraft, WordPress + MySQL, Redis
  cache, Static site), Import JSON, Copy JSON, Download, Copy share link (spec in the URL hash,
  compressed), Undo and Redo, and **Deploy on FluxCloud** (opens cloud.runonflux.com in a new tab with
  the JSON copied to the clipboard and a toast saying so). Everything reachable by keyboard.
- **Network Lab.** A large live diorama of the real network (clustered geo points on the hex bench),
  tier filter chips, a country list with bars, a block cadence dial, a reward/ tier explainer panel. Each
  number has a "what does this mean?" annotation that draws a leader line to the thing it describes.
- **Failover Lab.** The failover diorama full size: instances slider, region picker, `Break`, `Break
  region`, `Revive all`, a request generator with rate, an uptime meter and a log ("Node 82.14.x.x went
  dark. 3 requests rerouted in 41 ms"). A "scenario" menu loads setups (single instance, three in one
  region, three across regions, ten across regions). Teaches why a single instance is fragile (one node, replaced only after about two hours; FACTS 6.5, with the dated sample of FACTS 15.3.3 and no quoted failure rate), what spread buys you and what a node failure looks like.
- **Terminal.** A glass terminal window with tabs for scenarios (Docker basics, Build and push, Query the
  Flux API, DNS check). A goals tracker on the right ("1. Build the image 2. Tag it ..."), a "What just
  happened" panel under each command, history and tab completion. Banner: "Simulation. Nothing here touches
  your machine or the network."
- **App Explorer.** A search field (type an app name or choose a suggestion; server proxies the real
  read-only Flux API), then the diorama lights the countries where that app's instances run, and a table
  lists specs and instance placement; "The call behind this" shows the exact public API URLs so
  learners see the real thing. Empty and error states are friendly.
- **Agent Desk.** A scripted AI agent works a Flux MCP server and the learner supervises it. Four scenarios
  (deploy a small web server, a log that carries a planted instruction, a retry after a timeout, an Orbit
  repository) use the real tool names of the FluxCloud and Orbit servers (`MCP_TOOLS`). Before a run the
  learner picks the client's approval policy: ask before anything that is not a read, ask only before calls
  that spend, or ask about nothing. A call the policy stops shows the one plain sentence `describeApproval`
  writes and the learner approves or refuses it; reads never prompt. A table lists which calls each policy
  stops, a debrief says what the session changed, exposed and cost (priced through `quote()` and
  `orbitPlanQuoteUsd()`, never typed), and a record of finished runs lets the three policies be compared one
  scenario at a time. The agent is a script, no key appears anywhere, and the lab, every price and every
  deployment carry the SIMULATION chip. Risk classes use the status tokens and a word each: tier colours mean
  tiers and nothing else. The lab and the lesson widget `agent-session` run the same engine and components.

### 5.6 Reference, glossary, troubleshoot

- **Reference** pages are reading pages with sticky in-page nav, live examples (a spec field table where
  each row expands with an example and a "try it in the forge" link), and copy buttons.
- **Glossary:** a searchable two-column list (term, definition, "why it matters", related lessons). Terms
  also appear inline in lessons as dotted-underline hover cards via `{{term:id}}`.
- **Troubleshoot:** a decision tree as a conversational card flow ("What do you see?" options with glyphs;
  each answer narrows; the end card gives *Likely cause*, *Fix*, *How to confirm*, and links to the lesson)
  with a back button and a visible path breadcrumb. Starts from symptoms: app not reachable, stuck
  installing, price surprise, domain not working, data disappeared, image will not pull, spec rejected, a
  Git deploy that will not clone or build, an agent that did more than you asked.

### 5.7 Profile

Rank hero (rank name, tier glyph, XP odometer, progress to next rank), track completion rings,
achievements grid (earned medals lit, unearned dim with the rule visible), activity heat strip (days
active in the last 12 weeks), **certificate** generator (enter a display name, preview, download PNG;
generated client-side, clearly "not a blockchain credential"), preferences (accent, sound, motion,
quality tier, ambient), data (export progress JSON, import, reset with confirmation). Everything local.

## 6. System features

- **Command deck** (`Ctrl/Cmd+K` or `/` outside inputs): glass modal, mono prompt, grouped fuzzy results
  (Lessons, Labs, Reference, Glossary terms, Actions), highlighted matches, arrows, Enter, Esc, recent
  items. Actions: resume, enter ambient mode, switch accent, toggle sound, reduce motion, copy page link,
  show shortcuts. A `>` prefix answers from live data inline: `> block`, `> nodes`, `> price`,
  `> tiers`, `> quote 2 4000 20 3` (cpu ram hdd instances) for a quick price. Glossary results open the
  term card in place.
- **Ambient mode:** after 120 s idle (on by default, toggle in prefs and deck), by `A`, or from the deck.
  The bench full-screen with a slow camera drift; a caption layer cycles through "did you know" facts
  drawn from the curriculum and live numbers, 9 s each; quiet HUD with clock, block height and
  "next block in N s". Any input wakes it. Reduced motion gets a static dim variant.
- **Shortcuts overlay** (`?`), **toasts** (one line, glass, 2.4 s, polite live region), **Konami**
  easter egg (overclock: the bench runs hot and the accent goes stratus gold for 20 s).
- **Preferences** persisted in localStorage (accent, sound, motion override, quality, ambient, intro
  seen, progress), every access in try/catch.
- **Rank and achievements** (CONTENT.md section 6): ranks Initiate, Cumulus Operator, Nimbus Engineer,
  Stratus Architect; 12 achievements; XP.

## 7. The Stage and the Bench (technical art direction)

Two rendering technologies, used where each wins:

- **Hero scene** (three.js, lazy, home and ambient only): instanced hex prisms for the bench (about 6k
  cells at tier 3), the cell, light arcs as camera-facing ribbons, GPU particles for packets and dust,
  bloom, vignette, grain, light chromatic aberration. A **quality governor** adapts tiers (3 high, 2
  medium, 1 low, 0 none) with hysteresis; `?q=` forces a tier. No WebGL or context lost falls back to
  the 2D diorama renderer. Pauses when hidden, off-screen or `paused`.
- **Diorama** (Canvas 2D, everywhere else): an isometric hex map with extruded cells drawn by hand,
  deterministic seeded layout, a headless simulation core (placement, health, routing, replication) with
  unit tests, crisp at DPR 2, 60 fps with 2,000 cells, keyboard reachable through a parallel DOM list of
  nodes and a live region for events. This is what lessons and labs use.

Both read one **bench model** (`web/src/diorama/model`): nodes with position, tier, country and health;
instances; regions. The hero scene may use real geo points; the diorama can too (`live: true`).

## 8. States and data honesty

| Situation | Behaviour |
| --- | --- |
| API live, SSE open | Numbers live; chips `LIVE`; the Beat runs from real blocks |
| SSE failed, polling works | Chips `LIVE` with a `polling` hint |
| Data older than its window | Chips `CACHED` (amber) with age; numbers keep showing |
| API unreachable | Chips `OFFLINE`; last known value or baked fallback labelled "as of <date>"; no Beat; **all lessons and labs still work** (sample world, baked pricing) |
| Quote basis | `OFFICIAL` (Flux calculator confirmed) or `COMPUTED` (local formula, current rates) or `BAKED` (built-in rates), always visible |
| Simulation | Every terminal, FluxCloud simulator, failover scene and agent session says "Simulation" in its frame; money and deployments inside one are labelled too |
| Dated catalogue | Orbit plans and MCP tool lists are typed catalogues with the date they were read: shown `BAKED` with that date, never `LIVE`. A price shown from them is the engine's (`quote()`), which a test holds equal to the published plan price |
| WebGL missing or lost | The 2D diorama replaces the hero scene; nothing else changes |
| Reduced motion | No intro, no parallax, no camera moves, no iris, no marquee; opacity-only reveals; scenes render calm stills with the controls still working |
| Loading | "Syncing with the chain" for live data; skeletons shaped like the final content for code and lessons |

## 9. Generated art (spec for the asset pipeline)

Generated through `scripts/imagegen.mjs` (Codex image generation). Rules:

- **Brand-safe:** never ask for logos, wordmarks, text, UI or people. Generated images do not reproduce
  the Flux symbol faithfully; composite real marks and real text in code.
- **Style prefix** for every prompt: "Dark glass and frosted crystal hexagonal forms with {accent} edge
  light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure
  black (#000000) background, no text, no logos, no UI, no people, no scenery". Accents: flux
  `#2B61D1`, cumulus `#36D3FF`, nimbus `#C77DFF`, stratus `#FFC857`.
- **Subject on pure black** with generous margin so edges fade to true black; composite with
  `mix-blend-mode: screen` or additive blending. Verify corners are really black.
- One accent per piece. Ship WebP (AVIF when smaller) at display size x 2 at most; under 120 KB each.
- Name by use in `web/public/art/`, with a typed manifest `web/src/content/art.ts` (dimensions, average
  colour, alt text).

| Group | Pieces |
| --- | --- |
| Tracks (3) | `track-cumulus` (a small cluster of crystals, cyan), `track-nimbus` (a double-hex tower, violet), `track-stratus` (a tall faceted spire, amber) |
| Modules (10) | `mod-network` (a glass globe of hex cells), `mod-containers` (stacked layered cubes), `mod-setup` (a hex key and plate), `mod-deploy` (a prism launching light arcs), `mod-traffic` (paths through hex gates), `mod-projects` (a build table with assembled forms), `mod-operate` (a console dial cluster), `mod-resilience` (a shield of hex plates absorbing impacts), `mod-state` (a vault crystal with sync rings), `mod-architecture` (linked prisms in a frame) |
| Labs (6) | `lab-spec-forge` (a glowing forge anvil of hex plates), `lab-network` (a map plate with rising pillars), `lab-failover` (a pillar field with one dark and arcs rerouting), `lab-terminal` (a glass slab with a light prompt), `lab-explorer` (a lens over a pillar field), `lab-agent-desk` (a hexagonal glass desk with a ring-shaped gate above it and one bright prism passing through) |
| Atmosphere (4) | `bg-bench` (hero horizon plate), `sprite-bokeh`, `sprite-streak`, `sprite-dirt` (for the scenes) |
| Medals (12) | one hex medal per achievement, tier-tinted |
| Certificate and social (2) | a certificate backdrop, an Open Graph backdrop (composited with the real lockup and text in code) |

Captured or composed in code: favicons, `apple-touch-icon`, `site.webmanifest`, the OG card.

## 10. Budgets and quality tiers

The budgets are ceilings enforced by `web/scripts/check-budgets.mjs` (sizes in CI after `npm run build`;
add `--base <url> --vitals` against a running server for per-route JS and throttled FCP, LCP and CLS). The
first draft of this table (100 KB critical JS, 180 KB before first interaction) was set before anything was
measured and could not be met: React DOM and the router alone are about 86 KB gzipped. The ceilings below
sit just above what the build measured on 2026-10-13, so a regression shows up.

| Budget | Ceiling | Measured 2026-10-13 |
| --- | --- | --- |
| Initial JS: the entry's static graph (`vendor` + `app` + runtime) and the HTML, gzip | 165 KB | 161 KB |
| Hero scene chunk (three.js subset + scene), lazy, gzip | 220 KB | 170 KB |
| Lesson route chunk (the player; stages and widgets are separate chunks), gzip | 76 KB | 73 KB |
| JS fetched before first interaction, per route, excluding the hero chunk (transfer) | `/` 230 KB, `/learn` 185 KB, a lesson (`first-deploy`) 335 KB, `/reference` 270 KB, a reference topic 340 KB (Orbit 365, Agents 362), a lab 360 KB (Agent Desk 250) | 222, 181, 327, 263, 331 (Orbit 355, Agents 351), 353 (Agent Desk 238) KB |
| Fonts a page actually loads (latin subsets) | 150 KB | 101 to 132 KB |
| Each generated art file / all art, one format per image | 120 KB / 1.4 MB | 101 KB / 1.18 MB |
| LCP / CLS (CDP-throttled "fast 4G": 9 Mbps, 170 ms RTT, 2x CPU slowdown) | 2.0 s / 0.02 | LCP 1.3 s (`/learn`) to 3.0 s (Spec Forge); CLS 0.001 to 0.008 |
| INP | 150 ms | not measured by the script |
| Frame rate | 60 fps at tier 2 on an integrated GPU, never below 30 fps on tier 1; diorama 60 fps at 2,000 cells | not measured by the script |

What made the difference, in order:

1. **Merging the initial graph.** The default split gave the entry 36 tiny shared chunks (one per UI atom).
   `build.rolldownOptions.output.codeSplitting` in `web/vite.config.ts` now merges everything the entry
   imports statically into a `vendor` chunk (React, the router) and one `app` chunk. First paint on throttled
   4G went from 1.8 s to 0.7 s. Do not remove it.
2. **Route preloads.** `web/vite-plugins/route-preloads.ts` emits `route-preloads.json` and the server adds
   `modulepreload` hints for the matched route's chunks (and the lab's chunks) to the HTML head, so the page
   chunk downloads in parallel with the entry (see ARCHITECTURE.md, "Route preloading"). LCP improved by
   0.15 to 0.8 s on fast 4G. On slow 4G (1.6 Mbps) the route chunks share a thin link with the entry, so
   first paint is 0.3 to 0.9 s later while LCP is 0.3 to 1 s earlier; removing the JSON from the build
   output turns the feature off.
3. **The home plate.** The hero plate is preloaded with `fetchpriority="high"`; it does not shorten LCP
   (the home chunk executing does) but it removes a layout shift on slow links.

The per-route JS figures are from a production build of the tree on 2026-10-13, after the Orbit and agents
additions (three lessons, a lab, two more reference topics, new glossary terms and the two catalogues in
`shared/flux`) had landed, served against the live upstream APIs. Two runs a few minutes apart differ by up to
4 KB, so the table gives the larger. Three changes kept the additions inside the ceilings:

- **`shared/` is declared free of side effects** (`build.rolldownOptions.treeshake.moduleSideEffects` in
  `web/vite.config.ts`) and the glossary imports engine modules one by one, so the glossary no longer drags
  the MCP and Orbit catalogues into every route. That took about 8 KB off every lesson, the reference and
  the labs.
- **The Reference index and its topic pages are separate routes** (`routes/reference` and
  `routes/reference-topic`), so the index no longer carries the six topic pages: 331 KB before, 260 KB now.
  A topic page carries the four older pages, as before, and loads the Orbit and Agents sections as a lazy
  chunk.
- **The Agent Desk fetches the linter when a session that shows its findings ends** (`debrief-lint.ts`,
  imported by `useAgentSession`), which took 23 KB off the lab.

A reference topic is the heaviest of the routes for what it shows: the topic route statically imports every
topic page so a navigation lands on a finished page with focus on its heading. Loading each topic body
lazily would trim it, but it adds a round trip on a direct link to a topic unless the route preloads learn
about topic pages; that has not been done. Lessons other than `first-deploy` have no ceiling of their own:
the lessons that open on a spec editor or a terminal fetch 380 to 395 KB (`deploy-from-git` is one), the
rest 310 to 365 KB.

Still above the LCP budget at fast 4G: `/` (2.1 to 2.2 s) and the labs (3.0 s for the Spec Forge). The
`first-deploy` lesson sits at 1.9 to 2.0 s. The remaining time is the page chunk executing and its data
fetches, which preloading cannot shorten. Measurements were taken on a busy machine on top of the 2x CPU
throttle, so they are pessimistic.

Quality tiers (governor writes them to the bus): **3 high** (DPR up to 2, about 6k cells, bloom and
aberration and grain), **2 medium** (DPR up to 1.5, about 3.5k cells, half-res bloom), **1 low** (DPR 1,
about 1.5k cells, no post), **0 none** (2D diorama or CSS fallback). Start low on phones, `Save-Data`,
or `deviceMemory <= 4`; adapt with hysteresis; `?q=` forces a tier.

## 11. Accessibility

WCAG 2.2 AA is the floor. One `h1` per page, ordered headings, landmarks, a skip link, visible focus on
every control, 44 px touch targets, no information by colour alone (tier colours always paired with a
name or glyph), descriptive links, `lang`, `aria-live="off"` for per-block counters, focus trap and
`inert` for modal UI, decorative canvases `aria-hidden`, **every canvas interaction has a DOM equivalent**
(instance slider, node list, event log in a polite live region), text and controls operable at 200
percent zoom and 320 px width, `prefers-contrast` and `forced-colors` honoured, reduced motion respected
everywhere, and lesson content readable without any stage (the article view).

## 12. Copy and voice

- Plain, confident, a little dry. Sentences, not slogans. Concrete over abstract; prefer a number to an
  adjective. Address the learner as "you". Sentence case.
- Never: em dashes (use commas, periods, colons, parentheses), emoji, "revolutionary", "next-generation",
  "web3 magic", "seamless", "unleash", exclamation marks in instructional text.
- Explain jargon the first time with `{{term:id}}`; never assume Docker knowledge before the lesson that
  teaches it.
- Errors teach: say what happened, why the network cares, what to do.
- Loading: "Syncing with the chain". Offline: "Showing the last known numbers". Simulation: "Simulation.
  Nothing here touches the network". External link hint (visually hidden): "Opens in a new tab".
- Do not claim prices, uptimes or numbers the data does not back. Prices come from the pricing engine and
  always show their basis.

## 13. Definition of done (design)

A page or component is done when it matches this document and the look targets, has all its states
(loading, live, stale, offline, empty, error, reduced motion, no WebGL), is verified from screenshots at
1440x900, 1920x1080 and 390x844 **that you actually looked at**, is operable by keyboard alone, stays
inside budget, and survives a 30 second interaction soak with no console errors and no runaway CPU.
