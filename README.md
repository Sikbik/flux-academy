# Flux Academy

An interactive school for deploying on [Flux](https://runonflux.com), the decentralized cloud. Learn by
doing: break a node in a simulation and watch traffic route around it, build a real v8 app specification
and see what it costs, and run Docker, DNS and API commands in a simulated terminal. The lessons and labs
deploy nothing: you build and price a spec here and register it in FluxCloud yourself. Network numbers are
read from the public Flux API and carry a chip that says how fresh they are.

Site: <https://academy.app.runonflux.io>, the address the site is built for. `deploy/flux_app_spec.json` is
the spec for running it on Flux; whether a given deployment is up is not something this repository can say.

## What is in it

- **The course**: 20 lessons in three tracks named after the node tiers (Cumulus, Nimbus, Stratus), each
  with diagrams, hands-on stages, checks and a checkpoint challenge.
- **Six labs**: Spec Forge (an app spec editor with live lint and a price waterfall), Network (node,
  country and block data from the Flux API, explained), Failover (a simulation: place, break, watch
  traffic reroute), Terminal (a simulated shell), Explorer (where does a real app run, as the API
  reports it) and Agent Desk (a simulated session with an AI agent: you approve or refuse each tool call
  and see what it would have cost).
- **Reference**: the app spec, networking, Docker tips, the public API, Orbit and Git deploys, and agents
  and MCP, written from the FluxOS source and, for the last two, from the vendor's pages and packages, with
  the date they were read.
- **Glossary and troubleshooting**, a command deck (`Ctrl+K`), progress, ranks and a certificate, all kept in
  your browser. There are no accounts.

Everything is honest about what is real: data from the network is labelled LIVE, CACHED or BAKED with its
age, and anything simulated is labelled SIMULATION.

The course also covers the newer ways to deploy, and keeps one idea in front: an assistant or an agent
changes who types the spec, not what the network does. One Nimbus lesson points Orbit at a Git repository,
picks a plan and reads the spec it generates; another takes the FluxCloud assistant's draft from a sentence
to your signature. A Stratus lesson and the Agent Desk teach what an agent connected to the FluxCloud or
Orbit MCP server can read, change, spend and delete, and which of its calls to approve. Plans and tools come
from dated catalogues (`shared/flux/orbit.ts`, `shared/flux/agents.ts`) and are shown as BAKED, never as
LIVE. Nothing in the Academy calls Orbit, the assistant or an MCP server: those sessions are simulations.

## Quick start

Requires Node 24 or newer.

```bash
npm run install:all     # installs web/ and server/ dependencies
npm run dev             # API on :42069, web on :5180 (open the web port)
```

Open <http://127.0.0.1:5180>. Useful flags: `?demo=1` uses built-in fixtures instead of the API (stable
screenshots), `?q=none|low|medium|high` forces a quality tier, `?intro=0` skips the intro.

`FIXTURES=1 npm run dev` runs the API fully offline with simulated data. Set `PORT` and `WEB_PORT` to run
beside other dev servers.

## Commands

| Task | Command |
| --- | --- |
| Dev (API + web) | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Lint (Biome) | `npm run lint` (fix: `npx biome check --write .` inside `web/` or `server/`) |
| Tests | `npm test` (Vitest in `web/`; `node:test` in `server/` and `shared/`) |
| Content checks | `npm --prefix web run content:check` |
| Production build | `npm run build`, then `npm start` |
| Rebuild the offline fallback data | `npm --prefix server run bake` |
| Screenshot and console audit | `node web/scripts/shot.mjs --url http://127.0.0.1:5180/ --out shot.png` |
| Bundle and speed budgets | `npm --prefix web run budgets` (sizes); add `-- --base <url> --vitals` for per-route JS and throttled FCP/LCP/CLS |
| Walk every lesson to its end | `npm --prefix web run crawl -- --base <url>` (add `--mobile`) |
| Accessibility audit (axe-core) | `npm --prefix web run a11y -- --base <url>` (add `--mobile`) |
| Painted-output smoke test (the odometers, in Chromium and Firefox) | `npm --prefix web run visual -- --base <url>` (add `--engine chromium` or `firefox`) |

## How it is built

One container, one port (42069), no accounts and no database.

- **web/**: Vite, React 19, TypeScript (strict), CSS Modules, react-router, `motion`, `zustand` and `three`.
  A Canvas 2D diorama (the isometric hex bench) is the lessons' network view and the no-WebGL fallback; a
  WebGL hero and ambient scenes sit behind a quality governor that adapts to the device.
- **server/**: Node with TypeScript run directly (type stripping) and **zero runtime dependencies**. It
  serves the built web app, a small same-origin JSON API (`/api/v1/*`, plus an SSE stream), injects per-route
  head tags and JSON-LD, and talks to the public Flux API with caching, circuit breakers and baked fallbacks.
- **shared/**: erasable TypeScript used by both sides: the API contracts, the curriculum, and the Flux
  domain engine (app spec normaliser, pricing engine, linter, block arithmetic, timing, and the dated
  Orbit and MCP catalogues). The pricing engine reproduces the official calculator to the cent on the 80
  recorded quotes in `docs/research/FACTS.md` section 4, and the Spec Forge can ask the official calculator
  to confirm a price.

```
web/        the app (src/routes, src/learn, src/labs, src/ui, src/diorama, src/scenes, src/data, src/app)
server/     API, static serving, head injection, upstream clients
shared/     contracts, curriculum, site metadata, the Flux domain engine
docs/       design, architecture, content and curriculum guides, and researched Flux facts
deploy/     the Flux app specification for registering the site itself
assets-src/ art specifications and prompts (generated art ships from web/public/art)
```

## Docs

| Document | What it covers |
| --- | --- |
| [docs/DESIGN.md](docs/DESIGN.md) | Art direction, tokens, motion language, page specs, budgets, accessibility |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System shape, contracts, registries, conventions, server design, quality gates |
| [docs/CONTENT.md](docs/CONTENT.md) | Pedagogy, voice, lesson anatomy, diagram and widget catalogs, achievements |
| [docs/CURRICULUM.md](docs/CURRICULUM.md) | The lesson blueprints: arc, stage story, planted failure and challenges |
| [docs/research/FACTS.md](docs/research/FACTS.md) | Verified facts about Flux with sources. The only source of Flux facts for the content |

## Adding things

The site is organised so that adding something is adding a file; nothing needs an edit to a central list.

| To add | Add this file |
| --- | --- |
| A page | `web/src/routes/<name>/route.ts` (path, meta) and `index.tsx` |
| A lesson | `web/src/content/lessons/<id>.ts` (declarative data, validated by the content tests) |
| A glossary term | `web/src/content/glossary/<id>.ts` |
| A lesson stage kind | `web/src/learn/stages/<kind>.tsx` |
| An interactive widget | `web/src/learn/widgets/<id>/index.tsx` |
| An animated diagram | `web/src/learn/diagrams/<id>.tsx` |
| A lab | `web/src/labs/<id>/index.tsx` and `lab.ts` |
| An API route | `server/src/routes/<name>.ts` |

Read `docs/CONTENT.md` before writing lessons and `docs/research/FACTS.md` before stating anything about Flux.
Run `npm --prefix web run content:check` after changing content: it prices and lints every spec in every
lesson with the real engine.

## Deploy

```bash
docker build -t littlestache/flux-academy:latest .
docker run --rm -p 42069:42069 littlestache/flux-academy:latest   # then open /healthz
```

`deploy/flux_app_spec.json` is the v8 app specification of the live site on Flux (owner and contacts left as
placeholders), and `deploy/README.md` walks through pricing, registering, publishing the image and renewing.
CI (`.github/workflows/ci.yml`) typechecks, lints, tests and builds the image.

## License

MIT. Flux and the Flux logos are trademarks of their owners; the brand assets in `web/public/brand` are used
as published in the official Flux media kit.
