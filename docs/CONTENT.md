# Flux Academy v2: content and pedagogy

How the Academy teaches, the lesson contract in prose, and the catalogs (stages, diagrams, widgets,
achievements) that authors and builders share. The machine-readable contract is
`web/src/learn/types.ts` and `stage-api.ts`; the list of what exists is `shared/curriculum.ts`. Facts come
from `docs/research/FACTS.md` and nowhere else.

## 1. Pedagogy

The loop in every lesson is **observe, configure, deploy, break, fix**. The learner always has something
to touch within ten seconds. Concepts arrive in the order a deployer needs them, each one *used* before
the next arrives.

Rules:

1. **One idea per step.** If a step needs the word "and" in its title, split it.
2. **Show, then name.** Let the learner see the thing (a stage that already works) before the term.
   Introduce the term with `{{term:id}}` on first use only.
3. **Use before you explain.** Prefer "drag the slider and watch" before "this is called a replica".
4. **Concrete numbers.** Real values, real limits, real prices from the pricing engine. Never "a few",
   never "cheap".
5. **Mistakes are material.** Every lesson includes a planted failure (a broken spec, a port mismatch, a
   dead node) the learner finds and fixes. Hints teach the cause, not the answer.
6. **Honest simulation.** If it is not the real network, say so in the stage frame and in the prose
   ("In the simulator, ..." and "On the real network, ..."). Offer the real thing as a deep link.
7. **Cost is part of correctness.** Wherever resources change, the price chip is in view.
8. **Retrieval, not recall.** Checkpoints ask the learner to *do* (fix, build, estimate, order), not to
   recognise vocabulary. At most one multiple-choice question per two challenges.
9. **No dead ends.** Every step has a way forward: do it, `Show me`, or `Skip`.
10. **Respect time.** A 10 minute lesson is 10 minutes for a first-time learner, measured by walking it.

## 2. Voice

Plain, confident, a little dry, like a good senior engineer who likes teaching. Second person. Sentence
case. Short sentences; paragraphs of 25 to 90 words; no walls of text. No em dashes (use commas, periods,
colons, parentheses). No emoji. No exclamation marks in instructional text. No hype words ("powerful",
"seamless", "revolutionary", "unleash"). Prefer verbs: *place*, *register*, *expose*, *size*, *break*.

Good: "One instance is a single point of failure. With three, one node can fail and two keep serving."
Bad: "Flux's powerful redundancy features ensure your app is always on!"

When a number could change, take it from the live data or the pricing engine, never hard-code it in prose.
Use a prop or a stage that shows it. Where prose must quote a snapshot, say "at the time of writing".

## 3. Anatomy of a lesson

A lesson is a `Lesson` in `web/src/content/lessons/<id>.ts` (default export), with `id` matching
`shared/curriculum.ts`.

- **`hook`**: one or two sentences. Why this matters and what you will have at the end.
- **`objectives`**: two to four "You will be able to ..." statements, each testable by a challenge.
- **`steps`**: four to nine. Each step: `title`, `body` (one to three short paragraphs), optional
  `callouts`, a `stage`, and at most one `task`.
- **`checkpoint`**: two to five challenges. At least one must be a `spec-fix`, `spec-build`,
  `terminal` or `estimate` (a doing challenge) unless the lesson is purely conceptual, in which case use
  `order` and `match` with scenario prompts.
- **`recap`**: three to five takeaways, imperative or declarative, one line each.
- **`further`**: one to four links, preferring `docs.runonflux.com`.
- **`terms`**: glossary ids first introduced in this lesson. Each must exist.

**Stage continuity.** A stage persists across steps until a step sets another. Use that to tell a story
on one diorama or one spec: step 1 shows an empty bench, step 2 places one instance, step 3 asks for three.
Changing `kind` or `scene` swaps the stage; otherwise props update in place.

**Stage kinds.** The list is `STAGE_KINDS` in `web/src/content/catalog.ts`; each kind is one file in
`web/src/learn/stages/`. The fields are in `web/src/learn/types.ts`.

| kind | What it shows | Fields an author sets | Task events it reports |
| --- | --- | --- | --- |
| `diorama` | The Bench: an isometric map of nodes with a simulation under it (`web/src/diorama/README.md`) | `scene` (`tiers`, `placement`, `failover`, `traffic`, `sync`, `deploy`, `network`), `instances`, `controls` (`instances`, `kill`, `kill-region`, `revive`, `request`, `region`, `replay`), `volume` (`local`, `replicated`, `primary-standby`), `annotate`, `region`, `live` | `instances`; `node-killed` (distinct nodes since the step began: one at a time, or every node of a continent with `kill-region`); `request-sent` |
| `spec` | The Spec Forge editor: form, JSON, price and lint | `spec`, `editable`, `focus`, `show`, `reset` | `spec`; `instances` |
| `terminal` | A simulated terminal | `script` | `terminal-goal` |
| `diagram` | An animated diagram from section 4 | `id`, `beat`, `props` | none |
| `code` | Source files with syntax colour and line highlights | `files` | none |
| `compare` | Two panels side by side | `left`, `right` | none |
| `widget` | A registered widget from section 5 | `id`, `props` | `widget-done` |

On a `diorama` stage, `volume` names the model of the app's data in a chip and, with `failover` and
`local`, tags a replacement that started on an empty disk (`lost-data`, EMPTY DISK). `kill-region` adds a
"Break region" button next to the continent chooser. Both show what a mechanic does; the prose carries the
claim and states that the simulator compresses time (a replacement on the real network takes about two
hours after a node dies, 125 minutes plus the image pull, FACTS 6.3 and 6.5).

**Links in prose.** `{{lesson:id}}` and `{{lab:id}}` link to lessons and labs, `{{term:id}}` to the glossary. `[label](https://...)` is an external link (a new tab, spoken as such). `[label](/reference/orbit#plans)` is a page of the Academy: it opens in the same tab through the router, and the validator (`link-route`) requires the path to be a route in `shared/site.ts`. Use it to point from a lesson at the reference page or at `/troubleshoot`, not for lessons and labs.

**Callouts** are marginalia, at most two per step: `why` (why it matters), `gotcha` (a trap and how to
avoid it), `tip`, `wild` (what real deployments do), `cost` (a price consequence).

**Tasks** gate Continue. Choose the lightest one that proves understanding. A `read` step has no task.
`prompt` is one imperative sentence ("Drag instances to 3."). The engine shows feedback; do not write it.

**Checks** are declarative (`Check` in types.ts). Compose with `all` and `any`. Prefer lint-based checks
(`{ lint: 'absent', codes: ['PORT_MISMATCH'] }`) because the lint message is then the teaching. Write a
`message` on a check when the failing reason is not obvious.

**Challenges** each have `explain` (shown on success, one or two sentences of *why*) and `hint` (shown on
failure, teaches the cause). Every `spec-fix` and `spec-build` carries a `solution`; the test suite proves
the solution satisfies the check and that the starting spec does not.

## 4. Diagram catalog

Animated SVG diagrams in `web/src/learn/diagrams/<id>.tsx`. A diagram has one beat per caption, draws in
(never fades in) and is readable at 320 px. Authors move `beat` between steps to animate a story.
Captions are the figure captions (`FIG n.m`) and the alt text is whole-diagram.

| id | Shows | Beats |
| --- | --- | --- |
| `flux-layers` | The stack from hardware to your app | 1 independent operators run nodes; 2 FluxOS makes each node a cloud server; 3 the chain keeps everyone in agreement; 4 your containers run on top |
| `tier-ladder` | The three node tiers side by side | 1 Cumulus; 2 Nimbus; 3 Stratus; 4 one of each tier is paid every block. Takes `props.counts`, `props.collateral` from live data |
| `lifecycle` | One deployment, start to finish | 1 spec written; 2 registered on chain; 3 confirmed in a block; 4 nodes see it; 5 instances install; 6 app is live; 7 the domain routes traffic |
| `request-path` | A request from browser to container | 1 browser asks DNS; 2 the domain points at the Flux edge; 3 a healthy instance is chosen; 4 the node forwards to the container port; 5 the container answers |
| `container-layers` | Dockerfile to running image | 1 the Dockerfile; 2 each instruction is a layer; 3 the image gets a tag; 4 it is pushed to a registry; 5 nodes pull it |
| `repotag-anatomy` | `registry/namespace/image:tag` | 1 registry; 2 namespace; 3 image; 4 tag; 5 why `latest` bites |
| `port-mapping` | Public port, container port, the app | 1 the public port; 2 the container port; 3 the app must listen on 0.0.0.0; 4 the mismatch bug; 5 the localhost bug and its fix |
| `internal-dns` | Components reaching each other by name | 1 three components; 2 their internal names; 3 frontend calls api; 4 api calls db; 5 only the frontend is public |
| `dns-cname` | A custom domain pointed at an app | 1 your domain; 2 the CNAME record; 3 TLS; 4 propagation; 5 the apex-domain trap |
| `spec-anatomy` | The spec as a labelled object | 1 app-level fields; 2 the compose array; 3 a component; 4 resources; 5 ports; 6 storage |
| `volume-prefixes` | Local, `r:`, `g:` volumes | 1 local only; 2 replicated read-write; 3 primary and standby; 4 a node moves; 5 the primary fails |
| `block-clock` | Blocks, days and subscription length | 1 a block roughly every 30 s; 2 blocks per day; 3 a month in blocks; 4 renewal and expiry |
| `price-waterfall` | How a monthly price is built | 1 CPU; 2 RAM; 3 disk; 4 instances; 5 add-ons; 6 the floor; 7 the total. Driven by a `Quote` in `props` |
| `failure-modes` | What can fail and who heals it | 1 a container crashes; 2 a node goes offline; 3 a region goes dark; 4 a subscription expires; 5 an update rolls out |

Exact node names, port ranges, DNS patterns and numbers come from FACTS.md. If FACTS does not support a
beat, change the beat, do not invent.

## 5. Widget catalog

Interactive widgets in `web/src/learn/widgets/<id>/index.tsx`, used with `stage: { kind: 'widget', id }`.
Each reports `widget-done` when its own condition is met and registers a solver for "Show me".

| id | Used in | What it is | Done when |
| --- | --- | --- | --- |
| `readiness-checklist` | your-toolkit | The pre-deploy checklist (accounts, Docker, login, payment, FLUX) with a readiness meter and the real link for each item | Every item is ticked or marked "I will do this later" |
| `cost-reactor` | resources-pricing, forge | Sliders for CPU, RAM, disk, instances over a live price waterfall; `props.target` sets a goal ("under $3") | The price satisfies `props.target` |
| `fluxcloud-sim` | first-deploy, operate-your-app | A faithful simulation of the FluxCloud flows (`props.flow`: `register`, `manage`, `update`), labelled Simulation, mirroring the real labels and order from FACTS | The flow's last step is confirmed |
| `uptime-calculator` | redundancy-failover | Instance count and per-node availability to combined availability and downtime per month, stating the independence assumption | The learner meets `props.target` availability |
| `geo-picker` | geo-placement | A hex world where clicking regions builds the `geolocation` array, with the eligible node count from live geo data | At least two regions selected, or `props.target` met |
| `wiring-board` | multi-component | Drag connections between components; shows the internal names and env vars that result; flags exposed-by-mistake | The graph matches `props.goal` |
| `dns-record-builder` | custom-domains | Build the DNS record for a subdomain or an apex, with provider quirks | The record is correct for `props.case` |
| `block-converter` | operate-your-app, resources-pricing | Months, days and blocks with real constants; renewal date arithmetic | The learner converts `props.case` correctly |
| `orbit-planner` | deploy-from-git | The Orbit plans as sizes priced by the formula (a BAKED plan table that says both dates), the spec Orbit registers, and the Deploy to Flux link builder with live validation (`props.view`: `plans` or `button`, `props.goal`, `props.draft`) | A Custom size with at least `goal.minInstances` instances is priced below `goal.cheaperThan`, or the link equals `goal.expected` |
| `agent-session` | agents-and-mcp, the Agent Desk lab | A SIMULATION of an AI agent proposing tool calls to a Flux MCP server while the learner approves or refuses each one under a client policy, then reads a debrief (cost, what left their hands, a call by call policy table). The agent is a script; nothing is sent, signed or paid. Props: `scenario` (`deploy-nginx`, `poisoned-log`, `retry-after-timeout`, `orbit-repo`), `policy` (`ask-all`, `ask-spends`, `allow-all`; omit it and the learner chooses), `plan` (Orbit plan for `orbit-repo`), `goal` (`finish` or `safe`) | The session ends and the debrief is up (`goal: 'finish'`), or it ends the way the scenario teaches (`goal: 'safe'`); also reports an `agent-session-outcome` event |

## 6. Ranks, XP and achievements

**XP.** A completed lesson awards `minutes x 10` plus the challenge XP (default 10 each; half when "Show
me" was used). Ranks are by tracks finished, not XP: Initiate, **Cumulus Operator**, **Nimbus Engineer**,
**Stratus Architect**. XP is the odometer on the profile and the lesson-complete moment.

**Achievements** (each has a medal in `web/public/art/medal-<id>.webp`, a one-line rule shown even when
locked, and a `host.unlock(id)` call from the place it happens):

| id | Rule |
| --- | --- |
| `first-light` | Open your first lesson |
| `three-is-company` | Set instances to 3 or more in any scene or in the forge |
| `first-blood` | Kill a node in a failover scene |
| `spec-whisperer` | Take a spec from 3 or more lint errors to none |
| `penny-pincher` | Build a valid 3-instance spec with at least 1 core and 2 GB of RAM for under $3 a month (priced by the engine) |
| `block-watcher` | Be on the site for three real blocks in a row |
| `globetrotter` | Hover 15 different countries in the Network Lab |
| `shell-shocked` | Finish a terminal scenario |
| `explorer` | Look up a real app in the App Explorer |
| `cumulus-operator` | Finish the Cumulus track |
| `nimbus-engineer` | Finish the Nimbus track |
| `stratus-architect` | Finish the Stratus track |

## 7. Glossary

`web/src/content/glossary/*.ts` default-export `GlossaryTerm[]`. Target 60 terms. Each: `short` at most 28
words, `why` at most 40, a category, related ids, the lessons where it matters. Terms are linked inline with
`{{term:id}}`. The glossary page and the command deck search them. Unique ids are enforced by a test.

A term reads as its display name, lower-cased in running text when the name is a capital followed by lower
case ("Primary and standby" reads "primary and standby"), and kept as written at a sentence start, in a
heading, or when the entry sets `proper: true` (names and acronyms such as Docker, FluxOS, Cumulus). Force a
case at one site with `{{term:id|lower}}` or `{{term:id|Cap}}`. `learn/markup.ts` is the only parser; the
design system's `Markup` and the lesson player are thin wrappers, so every surface agrees.

Glossary files load on almost every route, so they import shared engine modules one by one
(`@shared/flux/pricing`) and never the `@shared/flux` barrel, `agents` or `orbit`. State what an entry says
about an engine as text and pin it in a unit test (`web/src/content/glossary-agents.test.ts`).

## 8. Definition of done for a lesson

- Validates against the types and passes the content test: ids match the curriculum, every `{{term:}}`,
  `{{lesson:}}` and `{{lab:}}` resolves, every `solution` satisfies its check and every starting spec fails
  it, every stage `kind`, diagram id and widget id exists, every spec normalises.
- Every fact is traceable: a `// fact: FACTS section N` comment on the data it supports. Numbers that
  change are fetched or quoted "at the time of writing".
- Four to nine steps, at least two non-read tasks, a planted failure, a doing challenge, a recap.
- Walked end to end in the player by the author (screenshots at 1440x900 and 390x844), including "Show me"
  on every task, the wrong-answer paths, and the offline (no API) case.
- Reading level: short sentences, no undefined jargon; no em dashes, no emoji, no hype.

## 9. Claim families and their agreed wording

Four independent fact-check passes (2026-10-13) found the same mistakes recurring across lessons, glossary,
reference, troubleshoot and site copy. These are the families; when a sentence touches one, use this
wording (adapt the grammar, keep the meaning). Each is backed by FACTS.md; do not make any stronger.

1. **Paying.** "Pay the full quoted amount." The chain's own floor is the on-chain table, far below the
   quote: a payment below that floor is dropped as underpaid, and the node code accepts anything at or above
   it. FluxCloud still asks for the quote and the card relay needs at least 98 percent of it. Never "at
   least the quote" or "must pay at least", and never imply any shortfall below the quote is dropped.
   (FACTS 4.7, 14.1)
2. **Fees.** A fee port, a static IP (USD 2 each) and the scope fee (enterprise or pinned nodes, USD 4)
   go into the monthly bundle, which is divided by 3 and billed per instance: USD 2 is about USD 0.67 per
   instance per month before discounts, and equals USD 2 only at 3 instances. (FACTS 4.3, 4.4)
3. **Deploy time.** FluxCloud's screen says "up to 45 minutes after payment": an estimate, not a
   guarantee. Bigger nodes wait 57, 87 or 117 minutes before taking a small app, so a copy can take about
   two hours, and longer when few nodes qualify. Never "promises" or "inside the 45 minutes". (FACTS 6.1)
4. **Replacement time.** About two hours after a node dies (125 minutes plus the image pull), up to about
   27 minutes more for a synced-storage app. Not a ceiling. (FACTS 6.5, 6.3)
5. **Where copies land.** "In practice each copy runs on a different node: no live app has two copies on
   one host. Placement promises nothing beyond that, and many nodes share one hosting provider, so two
   copies on different nodes can still sit in the same data centre." Fault domains are by hosting
   organisation, not by operator. Never "the one guarantee" or "nothing spreads them out". (FACTS 6.2)
6. **Load balancing.** FDM spreads different visitors across running instances and keeps one browser on
   the same instance for up to 8 hours (a cookie); an app with a `g:` component lists exactly one backend,
   the elected primary, and every port of the app goes there; a dead instance leaves rotation in about 6
   seconds, a replacement takes far longer. (FACTS 6.4)
7. **Synced storage.** `r:` and `g:` survive a node loss "as long as a current copy remains"; the newest
   writes may be missing. On a `g:` failover only the `g:` component container is started and stopped by the
   election; the other components keep running on every instance node and FDM sends all ports to the
   primary. Failover takes minutes (3 failed checks and 90 s, a 30 s election cycle, a standby waits about
   3 minutes per place). `s:` is left out (semantics UNVERIFIED). A plain volume, `/tmp` included, lives on
   one node and is lost with it. Local backups sit inside the component volume, are not replicated and go
   with the node; no weekly scheduler was found in the source. (FACTS 6.4, 7.1 to 7.4, 9.6)
8. **Image architecture.** An arm64-only image registers for a public app but starves (7 arm64 nodes on
   2026-10-12, none on ArcaneOS); an enterprise app is refused (amd64 required). (FACTS 3.7, 11 row 4)
9. **Unknown keys.** FluxOS silently drops keys it does not know, so they have no effect: never "rejected".
   (FACTS 3.2)
10. **Reasons FACTS does not give.** App names must not start with `flux` or `zel` (reserved), banned
    ports, the 5 GB image limit, the compose limit: state the rule, never an invented rationale.
11. **Geolocation.** A node counts as a candidate unless the rule proves it ineligible (nodes whose
    location is unresolved count). Registration is refused only when some nodes qualify but fewer than the
    instances asked for ("only M eligible nodes"); a list that leaves none is accepted and nothing is
    promised to run. Malformed entries are skipped. It is a placement filter on IP location data, not a
    compliance certification. (FACTS 3.5)
12. **Tier size.** "Small" for the install wait is under 3 cores, 6,000 MB and 150 GB; a nominal Cumulus
    node typically offers apps about 3 cores, 5,000 MB and 129 GB of disk (validator ceiling 160 GB), less
    if it already runs other apps; real nodes often exceed their tier (median Cumulus disk 220 GB). The
    engine has the numbers (`TIER_FACTS`, `LIMITS.tierCapacity`).
13. **Longer terms.** 3, 6 and 9+ months take 3, 6 and 12 percent off, but the total is then rounded UP to
    .49 or .99, which can swallow the saving for a small app: check the total. (FACTS 4.3 steps F and G)
14. **Registry re-check.** FluxOS compares the image digest about every 6 hours (first check 10 to 30
    minutes after start) and, when it changed under the same tag, soft-redeploys keeping volume data. Read
    from source, not observed live. An uppercase repotag is refused by FluxOS itself ("not in valid
    format"); a `docker.io/` prefix fails the lookup. (FACTS 6.3, 14.1)
15. **Live figures** carry "at the time of writing" or a date; prices typed against the baked rate card say
    "at the rates read on 2026-10-12". Prefer the engine and the data layer to typed numbers.
16. **Uncertain behaviour.** Where FACTS is silent or UNVERIFIED, write "not documented" or "the docs say",
    and in a lesson make it something to test. Never cite a FACTS section that does not contain the claim.
