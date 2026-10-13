# Flux Academy v2: architecture

This is the contract every contributor and agent builds against. Read it fully, then read
[DESIGN.md](./DESIGN.md) (what it looks and moves like), [CONTENT.md](./CONTENT.md) (how it teaches) and
[CURRICULUM.md](./CURRICULUM.md) (what each lesson contains).
Where this file and your instincts disagree, this file wins; where it is silent, use judgement and say what
you decided in your report.

Flux Academy is an interactive school for deploying on Flux (runonflux.com). It is a ground-up rewrite of
the old Next.js and Tailwind tutorial site and has nothing in common with it except the URL
(`academy.app.runonflux.io`), the deploy slot and the subject. The old source is on `main` and, for
reference, in the orchestrator's scratchpad; mine it for *topics*, never for facts (it is outdated).
Verified facts live in `docs/research/FACTS.md` (read its "Read this first" before writing anything about Flux: several things the docs and the old site say are wrong).

## 1. Shape of the system

```
browser                                          one container (Node, port 42069)
 web/  (Vite + React 19 + TS + three.js)  <-->    server/  (Node 24+, TypeScript, zero runtime deps)
   static bundle served by server                   /api/v1/*   JSON + SSE, cached, rate limited
   same-origin API only, no third parties           per-route <head> injection, sitemap, redirects
                                                    static files from web/dist
                                                    upstream: api.runonflux.io, stats.runonflux.io, price API
shared/  erasable TS: API contract, Flux spec + pricing + lint engine, curriculum, site metadata
```

- One container, one port (42069, the port the existing Flux deployment already maps).
- The browser only talks to its own origin. Upstream aggregation, caching, pricing and read-only lookups
  live in `server/`. This keeps the CSP at `connect-src 'self'`, keeps payloads tiny and keeps the site up
  when an upstream is down.
- No analytics, trackers, third-party fonts or scripts. Fonts are self-hosted via `@fontsource*`.
- **Everything works offline of the network.** If the API is unreachable the web app still renders every
  lesson and lab using a baked sample world and baked pricing, and labels live numbers as fallback. It must
  never present fallback numbers as live.
- The **pricing and lint engine is shared code** (`shared/flux/`). The browser runs it instantly for
  feedback; the server runs the same code for `/quote` and `/lint` and may confirm with Flux's own
  calculator. One implementation, so the lesson never disagrees with the API.

## 2. Repository map

```
flux-academy/
  package.json            root scripts only (no dependencies)
  biome.json              lint/format for shared/, scripts/, server/, deploy/
  Dockerfile              multi-stage: build web, ship server + shared + web/dist
  .github/workflows/      CI: typecheck, lint, test, build, container smoke, publish
  deploy/                 Flux app spec (flux_app_spec.json) and deploy notes
  docs/                   ARCHITECTURE.md, DESIGN.md, CONTENT.md, research/FACTS.md, design/refs
  scripts/                dev.mjs (runs both dev servers), imagegen.mjs (Codex image generation)
  assets-src/             prompts, raw generated art (raw/ is git-ignored), art manifest, art scripts
  shared/                 ERASABLE TS used by BOTH sides (see section 4)
    api.ts                the HTTP contract (paths, payload types)
    chain.ts              block-time helpers
    curriculum.ts         tracks, lessons, labs (metadata)
    site.ts               site metadata, route table for head tags and sitemap, REDIRECTS
    flux/                 spec types, limits, defaults, pricing, lint, timing, dated Orbit and MCP catalogues
  server/                 the API + static server
    src/main.ts           entry
    src/routes/           one module per endpoint group
    src/core, http, flux, services, data/   infrastructure, upstream clients, pollers
    test/                 node:test
  web/                    the web app
    index.html
    public/brand/         official Flux marks, lockups, badges (curated from the media kit, read-only)
    public/art/           generated art (webp/avif), see DESIGN.md section 9
    public/og/            social cards
    scripts/              shot.mjs (screenshots), art scripts
    vite-plugins/         build-only Vite plugins (route-preloads.ts, see section 8)
    src/
      main.tsx            entry
      app/                shell: providers, router, header, footer, transitions, error boundary
      routes/<name>/      one folder per route: route.ts (path + meta) and index.tsx (page)
      styles/             tokens.css, fonts.css, base.css, utilities.css (the only global CSS)
      ui/                 design-system primitives (ui/README.md lists them and their props)
      lib/                small framework-free helpers (math, rng, hex, format, storage, easing)
      data/               API client, SSE stream, zustand stores, fixtures, hooks
      system/             prefs, sound, hotkeys, toasts, focus helpers, quality governor
      palette/            command deck
      ambient/            ambient (screensaver) overlay
      scenes/             the hero/ambient WebGL scenes and their bus
      diorama/            the Canvas 2D network diorama and its headless simulation
      forge/              Spec Forge components (editor, form, json, cost reactor, issues)
      terminal/           the sandbox terminal engine and view
      learn/              lesson engine: types, store, stage plug-ins, widgets, diagrams, checks
        stages/           one file per stage kind
        widgets/<id>/     interactive widgets
        diagrams/<id>.tsx animated SVG diagrams
      labs/<id>/          lab pages (hosted by routes/labs)
      content/            authored data: lessons/, glossary/, troubleshoot, reference, art manifest, copy
        drafts/           data a lesson builds on that is not itself a lesson (the `ai-assisted-deploy` drafts and their test);
                          the lesson loader globs `lessons/*.ts` only, so support files live beside it, not in it
```

## 3. Commands and ports

| Task | Command (from repo root) |
| --- | --- |
| Install | `npm run install:all` (or `npm --prefix web ci`, `npm --prefix server ci`) |
| Run everything | `npm run dev` (API on 42069, web on 5180, `/api` proxied) |
| Web only | `npm --prefix web run dev` (set `WEB_PORT`, `API_ORIGIN`) |
| Server only | `npm --prefix server run dev` (set `PORT`; `FIXTURES=1` for offline simulated data) |
| Typecheck | `npm run typecheck` |
| Lint (Biome) | `npm run lint`; fix with `npx biome check --write .` inside `web/` or `server/` |
| Test | `npm test` (Vitest for `web/`; `node:test` for `server/` and for `shared/`) |
| Production build | `npm run build`, then `npm start` serves `web/dist` and the API |
| Screenshots and console audit | `node web/scripts/shot.mjs --url http://127.0.0.1:<port>/ --out <file>` |

Parallel agents share one machine. **Always run your own servers on your own ports** and kill everything you
start before you finish. Port blocks (the web dev server `WEB_PORT`, the API `PORT`):

| Owner | `WEB_PORT` | `PORT` (API) |
| --- | --- | --- |
| orchestrator | 5180 | 42069 |
| server core | n/a | 42110 to 42119 |
| flux domain | n/a | 42120 to 42129 |
| design system | 5410 to 5419 | 42130 |
| app platform | 5420 to 5429 | 42140 |
| scenes | 5430 to 5439 | 42150 |
| diorama | 5440 to 5449 | 42160 |
| art | 5450 | n/a |
| home | 5510 to 5519 | 42170 |
| lesson engine, course map | 5520 to 5529 | 42171 |
| spec forge | 5530 to 5539 | 42172 |
| network labs | 5540 to 5549 | 42173 |
| terminal | 5550 to 5559 | 42174 |
| diagrams | 5560 to 5569 | 42175 |
| widgets | 5570 to 5579 | 42176 |
| reference pages | 5580 to 5589 | 42177 |
| content authors | 5590 to 5599 | 42178 |
| QA and fixes | 5600 to 5699 | 42180 to 42189 |

Give each dev server its own Vite cache: `VITE_CACHE_DIR=/tmp/vite-cache-<name>`. The machine also runs
other projects' dev servers (5173, 5301 to 5307 and others): never kill a process you did not start.

## 4. Contracts

### 4.1 `shared/api.ts`: the HTTP API

Endpoint paths and every payload type are defined there and imported by both sides.

- Changes are additive (new optional fields, new endpoints). Never rename or remove a field.
- Erasable TypeScript only: no enums, namespaces, parameter properties or runtime package imports. Node
  runs the file with type stripping and Vite bundles it unchanged. Relative imports use `.ts`.
- Every response is `Envelope<T> = { data, meta }`; `meta.source` is `live | cache | fallback` and the UI
  must reflect it.
- `GET /api/v1/network`, `/geo`, `/blocks`, `/pricing`, `/info`, `GET /api/v1/stream` (SSE),
  `POST /api/v1/quote`, `POST /api/v1/lint`, `GET /api/v1/explore/app?name=`,
  `GET /api/v1/explore/search?q=`, `GET /healthz`.

### 4.2 `shared/flux/`: the domain engine

Pure, framework-free, tested. The only place the rules of a Flux spec and its price live.

- `types.ts`: `FluxAppSpec`, `FluxComponentSpec`, `PricingParams`, `Quote`, `LintReport`, `LintIssue`.
- `spec.ts`: `SPEC_VERSION`, `LIMITS` (every verified limit with its source), `defaultSpec()`,
  `normalizeSpec(unknown)` (coerce a loose object to a full spec and report what was defaulted),
  `derivedNames(spec)` (internal DNS names, generated domains).
- `pricing.ts`: `BAKED_PRICING` (the snapshot used offline), `quote(spec, params, { fluxUsd?, months? })`
  returning a `Quote` whose `lines` explain every contribution.
- `lint.ts`: `lintSpec(spec, ctx?)` returning a `LintReport` with teachable issues (`why`, `fix`).
- `blocks.ts`: block and time conversions (blocks per day, month, subscription length).
- `tiers.ts`: node tier facts and `tiersThatFit(totals)`.
- `timing.ts`: every duration of the deployment pipeline (spawn deferrals, the registration message hour,
  the UI's 30 and 45 minute strings, location records, restart ladder, the 6 hour image re-check, FDM health
  and `g:` failover timing), each tagged with the kind of clock it is (`TIMING_KIND`). Prose, the lab and the
  diorama's simulation quote these instead of typing a number.
- `orbit.ts` and `agents.ts`: **dated catalogues**, not network facts. Each export carries its read date and a
  `basis` (`live`, `source`, `docs`, `inference`) and says so in the UI (BAKED, never LIVE).
  - `orbit.ts`: `ORBIT_PLANS` (the published Starter, Standard and Pro prices and sizes), `ORBIT_CUSTOM`,
    `orbitPlanSpec` and `orbitPlanQuoteUsd` (the plan as a spec, priced by `quote()`; the test fails when a
    published price and the engine disagree), `deployToFluxUrl` (validates and encodes the button URL),
    `ORBIT_BUILD_VARIABLES`, `ORBIT_APP_MARKERS` and `isOrbitSpec` (an inference, not a protocol field), and
    `ORBIT_FACTS` (dated live counts: a fallback only; the product fetches live counts).
  - `agents.ts`: `MCP_TOOLS` for the FluxCloud MCP server (15 tools) and the Orbit MCP server (15 tools) with
    `risk`, `spends`, key needs and `basis`; `MCP_SERVERS`; `describeApproval(tool)`, the sentence a client
    shows before a call. `agents.ts` stores no price: what a call would spend is priced by `quote()`.
  - Refresh `orbit.ts` from `https://runonflux.com/apps/orbit` (plan table, Custom ranges, footnotes), its Deploy
    to Flux page and the docs environment reference; then `ORBIT_READ_ON`, `ORBIT_FACTS` (global specs and
    locations) and the marker counts. Refresh `agents.ts` from the hosted server's `tools/list` (no credentials)
    and the npm package for FluxCloud, and from the Orbit MCP guide's tool table for Orbit. Orbit argument names
    stay empty until `tools/list` has been read with credentials. Update `readOn`, run the shared tests.
- Every module has a `*.test.ts` next to it, written with `node:test` and `node:assert/strict` (framework-free;
  run by the server package's `npm test`, which also globs `../shared/**/*.test.ts`).

### 4.3 `shared/curriculum.ts` and `shared/site.ts`

What exists and in what order (tracks, lessons, labs), the route table used for head tags and the sitemap,
and `REDIRECTS` from the old site's URLs. Lesson ids are permanent (they are URLs and progress keys).

### 4.4 Lesson content: `web/src/learn/types.ts` and `stage-api.ts`

Lessons are declarative data (`Lesson`, `Step`, `Stage`, `Task`, `Check`, `Challenge`, `TerminalScript`).
Stage kinds are rendered by plug-in components found by glob. Read both files; they are the contract between
the engine, the stage builders and the content authors.

### 4.5 Registries by glob (no shared-file edits)

To let many agents add things without editing the same file, registries are built with
`import.meta.glob`. **Adding a thing is adding a file**:

| Registry | Glob | Default export |
| --- | --- | --- |
| Routes | `web/src/routes/*/route.ts` | `{ path, meta? }` plus `index.tsx` default-exporting the page |
| Lessons | `web/src/content/lessons/*.ts` | `Lesson` |
| Glossary | `web/src/content/glossary/*.ts` | `GlossaryTerm[]` |
| Stages | `web/src/learn/stages/*.tsx` | `StageComponent` |
| Widgets | `web/src/learn/widgets/*/index.tsx` | `WidgetComponent` |
| Diagrams | `web/src/learn/diagrams/*.tsx` | `DiagramComponent` and `export const meta: DiagramMeta` |
| Labs | `web/src/labs/*/index.tsx` | the lab's component; `lab.ts` exports `{ id }` matching `LABS` |
| Server routes | `server/src/routes/*.ts` | `(ctx) => RouteDef[]` (see `server/src/routes/README.md`) |

### 4.6 The scene bus

`web/src/scenes/bus.ts` (owned by the scenes agent) is a zustand store and the **only** coupling between
DOM sections and the WebGL scene: the page writes `section`, `progress`, `accent`, `paused`,
`reducedMotion`, `quality`, deploy controls (`instances`, `breakRequest`, `reset`), chapter and one-shot
pulses; the scene reads every frame and writes only its own slice. Sections never import three.js; the
scene never imports section code. `web/src/scenes/index.tsx` default-exports the lazy hero scene and
`web/src/scenes/ambient.tsx` the ambient one.

### 4.7 The diorama

`web/src/diorama/index.ts` exports `Diorama` (React component), the headless `createSim` (placement,
health, routing, replication; seeded and deterministic), `buildBench` (the node model) and types.
Props mirror `DioramaStage`. Events (`instances`, `node-killed`, `request-sent`, `sync-promoted`) are
callbacks. The README in that folder lists scenes and their annotation names.

### 4.8 URL state

Real paths (History API). `?step=<id>` deep-links a lesson step; `?view=article` is the linear lesson
view; the Spec Forge keeps its spec compressed in `#s=...`. Dev and QA flags: `?kit=1` design-system
gallery (route `/kit`, development only), `?q=low|medium|high` force a quality tier, `?ambient=1` start in
ambient mode, `?intro=0` skip the intro, `?demo=1` use built-in fixtures instead of the API,
`?stage=debug` scene stats overlay.

## 5. Ownership and coordination (parallel work)

Several agents work at once in one working tree. To keep that safe:

1. **Stay inside your owned paths** (listed in your brief). Read anything; write only what you own.
2. **Do not run git commands that change state** (no commit, checkout, switch, stash, reset, rebase, add,
   clean). `git status`, `git diff` and `git log` are fine. The orchestrator handles version control.
3. **Dependencies are pinned by the orchestrator.** `web/package.json` and `server/package.json` already
   contain what the plan needs (React 19, react-router, three, motion, zustand, lucide-react, fonts,
   Vitest, Biome, Playwright core). Do not add a dependency; if the work is impossible without one, say so
   in your report and work around it with a small in-house module meanwhile. Never run `npm install`.
4. **Type errors in files you do not own are not yours to fix** while others are mid-edit. Filter output to
   your paths, for example `npx tsc --noEmit -p tsconfig.json | grep '^src/diorama'`.
5. **Shared files** (`shared/*`, `web/src/learn/types.ts`, `stage-api.ts`, `store.ts`, `web/src/styles/tokens.css`)
   are additive only, and any change is called out in your final report.
6. **Scratch work** goes in your scratchpad directory, not in `/tmp` or the repo.
7. **Finish clean:** stop every server you started, delete temp files, and report what you built, what you
   verified (with the commands you ran), what is rough, and anything the next person needs.
8. Never read or print files that hold secrets (any file named `elevenlabs-api`, `.env*`, keys).

### Ownership map

| Workstream | Owns | Notes |
| --- | --- | --- |
| **server core** (opus-high) | `server/**` except the route modules below, `Dockerfile`, `.github/**`, `deploy/**`, `scripts/dev.mjs`, `server/README.md` | Adapts the community server's infrastructure |
| **flux domain** (opus-high) | `shared/flux/**`, `server/src/routes/{pricing,quote,lint,explore}.ts`, `server/src/services/{pricing,explore}.ts`, their tests | Verified spec, pricing and lint engine |
| **design system** (sonnet-max) | `web/src/styles/**`, `web/src/ui/**` (including glyphs), `/kit` gallery | The material and components |
| **app platform** (sonnet-max) | `web/src/main.tsx`, `app/**`, `data/**`, `system/**`, `palette/**`, `ambient/**`, `routes/labs/**`, `routes/not-found/**`, `lib/**` except `lib/quality.ts` (shared, stable, orchestrator) | Shell, router, data layer, command deck |
| **scenes** (sonnet-max) | `web/src/scenes/**` | Hero and ambient WebGL scenes, the bus, the 2D fallback |
| **diorama** (sonnet-max) | `web/src/diorama/**`, `web/src/learn/stages/diorama.tsx` | Canvas 2D network diorama and simulation |
| **art** (sonnet-max) | `assets-src/**` (except `raw/`), `web/public/art/**`, `web/public/og/**`, `web/src/content/art.ts`, favicons | Generated art via Codex |
| **home** (sonnet-max) | `web/src/routes/home/**` | Wave 2 |
| **lesson engine** (sonnet-max) | `web/src/learn/*` (except stages, widgets, diagrams owned elsewhere), `routes/lesson/**`, `learn/stages/{code,compare,widget}.tsx`, the content validation test | Wave 2: loader, player, tasks, checks, challenges, outline and article view |
| **course map and profile** (sonnet-max) | `routes/learn/**`, `routes/profile/**`, `learn/certificate/**` | Wave 2: constellation map, rank and achievements UI, certificate (the achievement runtime `learn/achievements.ts` belongs to the lesson engine) |
| **spec forge** (sonnet-max) | `web/src/forge/**`, `labs/spec-forge/**`, `learn/stages/spec.tsx`, `learn/widgets/cost-reactor/**` | Wave 2 |
| **network labs** (sonnet-max) | `labs/{network,failover,explorer}/**`, `learn/widgets/{uptime-calculator,geo-picker}/**` | Wave 2 |
| **terminal** (sonnet-max) | `web/src/terminal/**`, `labs/terminal/**`, `learn/stages/terminal.tsx`, `learn/widgets/dns-record-builder/**` | Wave 2 |
| **diagrams** (sonnet-max) | `learn/diagrams/**`, `learn/stages/diagram.tsx`, `learn/widgets/{wiring-board,block-converter}/**` | Wave 2 |
| **widgets** (sonnet-max) | `learn/widgets/{fluxcloud-sim,readiness-checklist}/**` | Wave 2 |
| **reference pages** (sonnet-max) | `routes/{reference,glossary,troubleshoot}/**`, `content/reference/**`, `content/troubleshoot.ts` | Wave 2 |
| **content authors** (sonnet-max) | `content/lessons/**`, `content/glossary/**` | Wave 2, split by track |
| **AI deployments and agents** (opus-high for data and engine, sonnet-max for UI and content) | `shared/flux/{orbit,agents}.ts` and their tests, `labs/agent-desk/**`, `learn/widgets/{agent-session,orbit-planner}/**`, the lessons `deploy-from-git`, `ai-assisted-deploy` and `agents-and-mcp`, `content/glossary/agents.ts`, the `git` and `agents` stages of `content/troubleshoot/`, the `orbit` and `agents` reference topics | Added 2026-10-13 |

## 6. Conventions

**TypeScript.** Strict. `verbatimModuleSyntax` is on, so use `import type`. Path aliases: `@/` is
`web/src/`, `@shared/` is `shared/`. Prefer small modules with a clear name over big files. No `any`; use
`unknown` and narrow. Pure logic goes in framework-free modules with Vitest tests next to them
(`*.test.ts`).

**Formatting and lint.** Biome: 2 spaces, single quotes, semicolons, trailing commas, 110 columns. Run
`npx biome check --write .` in `web/` (or `server/`) before you report.

**CSS.** Plain modern CSS with custom properties, no Tailwind, no CSS-in-JS. Global CSS is only `styles/`
(tokens, fonts, base, utilities). Components and routes use CSS Modules (`Thing.module.css`) so parallel
work cannot collide. Use `@layer` (`reset, tokens, base, ui, route, utility`) and the tokens in
`styles/tokens.css`; never hard-code a colour, spacing or duration that a token covers. Use logical
properties where it helps, container queries for components and `clamp()` for fluid type and spacing.
Support `prefers-reduced-motion`, `prefers-contrast` and `forced-colors`.

**React.** Function components and hooks only. React 19 (`use`, `useOptimistic`, `ref` as a prop where
they fit). Keep render pure; do imperative work (canvas, observers, rAF) in effects with proper cleanup.
Never run a `requestAnimationFrame` loop without a way to stop it and without checking `paused` and
reduced motion. Heavy modules (the hero scene, the diorama, the forge, the terminal) load lazily by route.

**Motion.** Use the `motion` package (`motion/react`, `motion/mini`, `motion`) for springs and
orchestration, and CSS for simple transitions. Animate `transform` and `opacity` first. Everything is
interruptible and has a reduced-motion variant that is calm but complete.

**State.** zustand for cross-component state; local state otherwise. Server data lives in `web/src/data/`
and is read through hooks; components never call `fetch`.

**Accessibility.** Semantic landmarks and headings (one `h1` per page), visible focus, keyboard parity for
every pointer interaction, real `button` and `a` elements, labelled controls, 4.5:1 text contrast, no
information by colour alone, `aria-live="off"` for per-block counters, `inert` or a focus trap behind
modal UI. Canvas stages have a DOM equivalent.

**Copy.** Plain, concrete, confident. Sentence case. No emoji. **No em dashes anywhere** (use commas,
periods, parentheses or colons). No marketing superlatives and no claims the data cannot back.

**Assets.** Original generated art lives in `assets-src/` and ships as optimised `webp` and `avif` in
`web/public/art/`. Official Flux marks come from `web/public/brand/` and are never redrawn, recoloured
outside blue, white, black or gray, or distorted. Respect clear space.

**Provenance.** The sibling projects are the same owner's and MIT licensed. You may read them for
technique. Port framework-free, tested utilities (hex maths, seeded RNG, governors, SWR caches) when that
saves real time, with a one-line `// Adapted from fluxcommunity/<path>` comment. Do not port layouts,
section designs or copy; the Academy has its own art direction.

## 7. Data flow

```
server  upstream pollers (blocks 3-5 s, network ~10 s, geo ~5 min, price ~60 s, pricing params ~10 min)
   |        single-flight, TTL + stale-while-revalidate, timeouts, backoff, circuit breaker
   v
 in-memory snapshots ---- GET /api/v1/{network,geo,blocks,pricing}
   |
   +--- SSE hub ----------- GET /api/v1/stream  (hello, block, network, ping)

web   data/stream.ts  EventSource (auto-reconnect) with polling fallback
        v                         v
   data/store.ts (zustand)   scenes bus: chain clock + block pulses
        v
   hooks: useNetwork(), useChain(), usePricing(), useGeo(), useBlocks(), useQuote(spec)
```

Connection states exposed to the UI: `connecting`, `live` (SSE open), `polling`, `offline` (nothing works;
showing baked fallback). Each number that can be stale carries its `meta` (source, ageMs).

## 8. Server design

- **Zero runtime dependencies.** Node 24+ runs the TypeScript directly (type stripping); the image ships
  sources. Use `node:http`, `node:zlib`, `node:fs`, `node:test`, `fetch`.
- **Layout.** `core/` (log, clock, singleflight, swr cache, upstream client with timeout, retry and
  breaker, loop), `http/` (static, security headers, compress, rate limit, client IP, respond), `flux/`
  (typed upstream readers), `services/` (network, blocks, hub, runtime, pricing, explore), `routes/`
  (endpoint groups), `data/` (baked fallbacks).
- **Static serving.** Immutable cache for hashed assets, `no-cache` for HTML, ETag and `If-None-Match`,
  precompressed or on-the-fly br/gzip with size floors, range requests for media, SPA fallback to
  `index.html` for any extensionless path that is not `/api` or `/healthz`.
- **Head injection.** For HTML responses the server rewrites `<title>`, description, canonical, Open Graph
  and Twitter tags and appends JSON-LD (`Course` for the course map, `LearningResource` for lessons,
  `BreadcrumbList`) from `shared/site.ts` and `shared/curriculum.ts`, so links unfurl and crawlers see real
  metadata without running JS. Unknown routes get the 404 meta and a 404 status with the SPA shell.
- **Redirects.** `REDIRECTS` from `shared/site.ts` answer 301, query preserved.
- **`/sitemap.xml` and `/robots.txt`** are generated from the same route table.
- **Security.** CSP exactly: `default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src
  'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; frame-ancestors
  'self'; base-uri 'none'; form-action 'none'; object-src 'none'`, plus HSTS, `nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, a minimal `Permissions-Policy`, COOP/CORP as appropriate. Rate limit
  per IP (token bucket; the build files a page loads have a much larger bucket than pages and the API, so a
  first visit from a shared address does not get a 429 on a script), body size limit (64 KB), content-type checks, no reflected input, SSRF-proof
  explore (allow-listed upstream hosts and paths, app name validated against Flux's name rule).
- **Resilience.** Single-flight upstream calls, stale-while-revalidate, jittered backoff, circuit breaker,
  baked fallbacks for everything (network, geo, pricing). `FIXTURES=1` runs fully offline with simulated
  data labelled `fallback`. Multiple instances run in production, so no instance-local state may matter.
- **Ops.** Structured one-line JSON logs (level via `LOG_LEVEL`), graceful shutdown on SIGTERM
  (drain SSE), `/healthz`, `/api/v1/info` with upstream status and SSE client count.

### Keeping routes light

The budgets in `docs/DESIGN.md` section 10 count the JavaScript a route fetches before the first interaction.
Three habits keep that number down:

- **`shared/` is declared free of side effects** (`treeshake.moduleSideEffects` in `web/vite.config.ts`), so a
  module that a route does not use drops out of the chunk of one it does use. Without the rule the
  `@shared/flux` barrel kept the MCP and Orbit catalogues, the fixtures and the other engine modules together
  in one chunk that every lesson and the glossary loaded.
- **Code that loads on almost every route imports engine modules one by one.** The glossary does
  (`@shared/flux/pricing`, never the barrel, `agents` or `orbit`). It states what an entry says about an
  engine as text and pins that text in a unit test; `web/src/content/glossary-agents.test.ts` is the model,
  and it also fails when a glossary file imports the barrel at run time.
- **Code that only matters after an interaction loads then.** The Agent Desk debrief takes the validator's
  lines from `debrief-lint.ts`, which `useAgentSession` imports when a session that shows them ends. The
  linter is about 23 KB of the lab's JavaScript once compressed, and nobody needs it before the end.

### Route preloading

Every route page is a lazy chunk, so without help the browser learns about it only after the entry has
executed and then walks its imports. The build and the server close that gap:

- **Build.** `web/vite-plugins/route-preloads.ts` (a build-only Vite plugin) runs in `generateBundle`. For
  each `src/routes/<folder>/` it reads the path patterns out of `route.ts` (which must stay the literal
  `export default { path: '/x' | ['/x', '/x/:y'], ... }`; any other shape fails the build), finds the page
  chunk (the dynamic entry for `index.tsx`) and collects its transitive static imports, minus the entry's
  initial graph, with their CSS (`viteMetadata.importedCss`). The labs route also gets one entry per
  `src/labs/<id>/index.tsx` (`/labs/spec-forge`) holding the labs chunks plus that lab's, because the lab
  module is only discovered after the labs page runs. The result is `route-preloads.json` in the build
  output. The not-found route (`*`) is left out.
- **Server.** `server/src/http/preloads.ts` loads that file (validated: plain `/assets/...` URLs only, a bad
  file preloads nothing) and `static.ts` re-reads it whenever `index.html` or the file changes, so a rebuilt
  dist is picked up without a restart. For a known route the matched entry is chosen with the client's
  `folderForPath` rule (fewer params, then the longer pattern), and `applyHead` adds
  `<link rel="modulepreload" crossorigin>` per chunk and `<link rel="preload" as="style" crossorigin
  fetchpriority="low">` per stylesheet, each marked `data-route-preload` so a second pass replaces them.
  The home route also gets `<link rel="preload" as="image" href="/art/bg-bench.avif" fetchpriority="high">`
  (`HOME_HERO_AVIF`, checked by a test against `ART['bg-bench'].avif`). Unknown paths get the fixed 404
  head and no hints. No request input is reflected; hashed URLs come only from the JSON.
- **Dev.** There is no `route-preloads.json` (Vite serves modules itself), so the server adds nothing.
  The same is true of a dist built before the plugin existed.
- **Cost.** Stylesheets are low priority on purpose: at the default priority they compete with the
  entry's render-blocking CSS and delayed first paint by 0.3 to 0.5 s. Script hints still share bandwidth
  with the entry, so on a slow link first paint moves later in exchange for an earlier LCP. Measured on
  the production server with throttling: fast 4G (9 Mbps, 170 ms RTT, 2x CPU) LCP 0.15 to 0.65 s earlier
  and FCP unchanged; slow 4G (1.6 Mbps, 4x CPU) LCP 0.5 to 1.0 s earlier and FCP 0.3 to 0.9 s later.
  Deleting `route-preloads.json` from the dist turns the feature off.

## 9. Quality gates

A piece of work is done when all of these hold for the paths you own:

- `npm run build`, `npm run typecheck`, `npm run lint` and `npm test` pass for your paths.
- No console errors or warnings at runtime in Chromium (WebGL on, and with `?q=low`).
- Looks right at 1440x900, 1920x1080 and 390x844, verified from real screenshots you looked at.
- Keyboard-only use works; `prefers-reduced-motion` is calm; with the API server stopped the page still
  renders and labels its data honestly.
- Budgets in DESIGN.md section 10 are met or the miss is stated in your report.
- No em dashes and no emoji in any user-facing string.

## 10. Security and privacy posture

- Strict CSP set by the server (section 8). Outbound links use `rel="noopener noreferrer"`.
- No visitor data leaves the browser. Progress, name and preferences live in `localStorage` (try/catch on
  every access) and can be exported, imported and erased from the profile page.
- The explore proxy is read-only, allow-listed, rate limited and cached. It never forwards cookies or
  headers and never returns node ports.
- The certificate is generated client-side and says it is not a blockchain credential.
- The simulations (terminal, FluxCloud simulator, failover, the agent session and the Agent Desk) never
  contact Flux, Docker, Orbit or an MCP server. The agent in a session is a script, not a model: it uses the
  real tool names, its prices come from `quote()`, no key appears anywhere, and the frame says so.

## 11. Deployment

Docker image `littlestache/flux-academy:latest`, built by GitHub Actions on pushes to `main`, runs the Node
server as an unprivileged user on 42069 with a `/healthz` check, and is deployed to Flux with
`deploy/flux_app_spec.json`, which mirrors the live `academy` app (two instances, 1 CPU, 2000 MB, 5 GB, an
empty `environmentParameters`, so the image carries every default; the design tolerates per-instance caches).
`owner` and `contacts` in the spec are placeholders: the operator supplies them at deploy time and they are
never committed.

## 12. Decisions made on purpose

Short records of choices a newcomer might otherwise reopen.

- **Vite SPA plus a small Node server, not Next.js.** The site needs no SSR; the server injects head tags
  and answers the API; one container, one port, zero runtime deps, matching the owner's other Flux apps.
- **`react-router` for real URLs and view transitions.** Lessons deserve deep links and a back button.
- **Lessons are data.** Declarative content is lintable, testable, and cannot ship executable surprises;
  rich behaviour lives in stage and widget plug-ins.
- **Two renderers.** three.js for the cinematic hero; Canvas 2D for the diorama that lessons and labs use.
  The diorama is the accessible, always-available path and the WebGL fallback.
- **Track = tier.** The three node tiers double as skill levels (Cumulus, Nimbus, Stratus) and keep their
  colours. Tier colours mean only tiers and tracks.
- **Dark only.** Tokens are semantic so a light theme could be added later; it is out of scope for v2.
- **No accounts, no backend state.** Progress is local, exportable and private by construction.
- **One spec, three authors.** The FluxCloud assistant, Orbit and an agent on an MCP server change who
  writes the spec, not what the network receives: an Orbit app registers as an ordinary version 8 spec with
  one component, and an assistant's draft is a form prefilled for the owner to review and sign. So the
  lessons, the lint and the price engine are the same for all three, there is no second pricing path, and
  `isOrbitSpec` is an inference used to explain a spec, never a gate.
- **Catalogues are dated data, not network facts.** Orbit plans and MCP tools live in `shared/flux/orbit.ts`
  and `agents.ts` with a read date and a basis, are shown as BAKED and never as LIVE, and are refreshed by
  hand from the sources named in section 4.2. The published plan prices in `orbit.ts` are held equal to
  `quote()` by a test, and `agents.ts` stores no price at all.
- **No custom cursor chrome.** Pointer-reactive light on panels and figures is welcome; an element that
  replaces or trails the operating system cursor is not. The probe reticle is local to a figure.
