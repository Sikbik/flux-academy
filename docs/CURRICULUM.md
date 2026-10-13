# Flux Academy v2: lesson blueprints

One blueprint per lesson in `shared/curriculum.ts`, written from the verified facts in
[research/FACTS.md](./research/FACTS.md). A blueprint fixes the **arc, the stage story, the planted failure and
the challenges**; the author turns it into a `Lesson` (see [CONTENT.md](./CONTENT.md) and
`web/src/learn/types.ts`) and adds the words, the exact specs and the explanations. Where a blueprint and FACTS
disagree, FACTS wins; where FACTS is silent or marks something UNVERIFIED, do not state it as a fact.

Shared rules for every lesson:

- Facts carry `// fact: FACTS <section>` comments. Quote live numbers (node counts, FLUX price, block height)
  from stages or props, never hard-coded in prose; where prose must quote a snapshot, say "at the time of
  writing".
- Prices come from the pricing engine (`shared/flux`), never from memory. The numbers in a blueprint are
  checks for you, not copy to paste.
- The hello-world spec every lesson starts from is the v8 shape in FACTS 3.9 (required keys: `contacts`,
  `geolocation`, `expire`, `nodes`, `staticip`, `enterprise`; no `tiered`, no `secrets`; minimum instances is
  1; component names have no hyphens). Use `shared/flux` fixtures once they land.
- Honest simulation: every simulated surface says so; offer the real FluxCloud link (`cloud.runonflux.com`).
- Use the stage kinds and ids that exist: stages `diorama`, `spec`, `terminal`, `diagram`, `code`, `compare`,
  `widget`; diagrams and widgets as in CONTENT.md sections 4 and 5.
- Each lesson has a planted failure (a broken spec, a mismatch, a dead node) and a doing challenge.

## Track 1: Cumulus (foundations)

### 1. `what-is-flux`: Thousands of machines, one cloud (7 min, concept)
Arc: who runs the machines, what the tiers are, why your app is not "on a server".
1. *A map of strangers' computers.* Stage `diorama` scene `network`, `live: true`. Read-only. Prose never
   hard-codes counts (FACTS Snapshot).
2. *Every node is a small server.* Diagram `flux-layers` beats 0 and 1 (independent node owners, hosting
   providers, FluxOS). FACTS 1, 6.2.
3. *Three sizes.* Stage `diorama` `tiers` live plus diagram `tier-ladder` (collateral 1,000 / 12,500 / 40,000
   FLUX; hardware from FACTS 2). Task: hover each tier. Callout `wild`: where small apps usually land and why
   (FACTS 6.2: bigger nodes defer small apps).
4. *Collateral and blocks.* Diagram `block-clock` beat 0 (30 s blocks, Proof of Node, FACTS 1.4 and 5.1); one
   node of each tier is paid per block.
5. *No central scheduler.* Diagram `flux-layers` beat 2 and 3: each node decides which apps to run (FACTS 6.2).
6. *What it means for you.* `compare` stage: "a data center" versus "Flux", honest trade-offs (independent
   machines that can share a hosting provider, node failure is normal, you buy redundancy with instances).
Planted failure: the common belief "Flux placement is guaranteed to spread across continents" (it is not).
Checkpoint: `match` tier to collateral; `choice` why small apps land on Cumulus nodes; `order` the layers
bottom to top. Terms: flux, fluxnode, cumulus, nimbus, stratus, collateral, fluxos, block, proof-of-node.

### 2. `how-apps-run`: From spec to running app (8 min, concept)
Arc: the thirteen-step reality (FACTS 6.1) compressed into seven beats of one story.
1. *A spec you sign.* `spec` stage, read-only, three focus notes (name, instances, compose).
2. *Price and validate.* Diagram `lifecycle` beat 1; the calculator and the validator are separate (FACTS 3.10).
3. *Register and the hash.* Beat 2: the signed message is hashed; the hash is what your payment points at.
4. *Pay, then one block.* Beat 3; the clocks (FACTS 6.6): "30 minutes remaining" is screen text, the node keeps
   the registration for 3,600 s from receipt, and "up to 45 min" is a label. Pay the full quoted amount.
5. *Nodes decide.* `diorama` `deploy` (select and defer phases). Callout `gotcha`: tier deferral (57 to 117
   min), so "up to 45 minutes" is FluxCloud's estimate, not a guarantee (FACTS 6.1).
6. *Install and announce.* Beat 5: image pull dominates; location records last about 125 minutes (FACTS 6.1).
7. *Your URL.* Diagram `request-path` and `diorama` `traffic` (FDM, FACTS 6.4).
Planted failure: pay after the node's hour (the screen says 30 minutes); the registration is gone and the app
never installs (FACTS 6.6, 11 row 22).
Checkpoint: `order` the lifecycle; `estimate` blocks in 30 minutes (60); `choice` what links a payment to a
spec (the hash). Terms: spec, registration-message, hash, op-return, spawner, location, fdm.

### 3. `containers-101`: Containers in ten minutes (10 min, hands-on)
1. *Image and container.* Diagram `container-layers` beats 0 and 1.
2. *A tiny Dockerfile.* `code` stage (Dockerfile and a 6-line server that binds `0.0.0.0`).
3. *Build.* `terminal` stage; goal `build`. Planted failure: build on Apple silicon makes an arm64 image;
   the terminal shows the platform warning; fix with `--platform linux/amd64` (FACTS 11 row 4: a public
   app registers but starves, an enterprise app is refused).
4. *Name and push.* Diagram `repotag-anatomy`; goal `push`; lower case and no `docker.io/` prefix (FluxOS
   refuses capitals, the prefix fails the lookup, FACTS 3.3); why `latest` bites (each node compares the digest
   about every 6 hours and soft-redeploys, read from source, FACTS 6.3, 11 row 19).
5. *What Flux needs.* `compare`: a good image versus a bad one (private without enterprise, arm64 only,
   which registers but starves, over 5 GB).
Checkpoint: `terminal` (build then push); `spec-fix` a bad `repotag`; `choice` image size limit.
Terms: container, image, registry, repotag, dockerfile, amd64.

### 4. `your-toolkit`: Your toolkit (6 min, hands-on)
1. *What you need.* `widget readiness-checklist` (public image, optional local Docker, FluxCloud login,
   payment, FLUX or card).
2. *Login.* `compare`: SSO (signs for you) versus a wallet (ZelCore, SSP, MetaMask, WalletConnect), FACTS 9.2.
3. *Paying.* FLUX is 5 percent cheaper (`fluxmultiplier`, FACTS 4.4); card and PayPal exist; minimum USD 0.99.
4. *The clock.* "Payment window: 30 minutes remaining" is screen text and the node keeps the registration for
   an hour; FluxCloud's "up to 45 min" is a label, and a copy can take about two hours (FACTS 6.6, 6.1). Pay
   the full quoted amount: a payment below the network's floor is dropped, and the card relay needs 98 percent.
Checkpoint: `choice` who signs for an SSO user; `choice` the payment window; `multi` what you must have
before registering. Terms: zelid, sso, ssp, zelcore, fluxcloud.

## Track 2: Nimbus (build and ship)

### 5. `first-deploy`: Deploy your first app (15 min, project)
1. *The plan.* Diagram `lifecycle` (beats 0 to 5 as a map of the lesson).
2. *Containerise.* `code` stage: `server.js` (listens on 3000, `0.0.0.0`) and Dockerfile.
3. *Build and push.* `terminal`, goals `build`, `push`.
4. *The spec.* `spec` stage, editable `name`, `compose[0].repotag`, `compose[0].ports`,
   `compose[0].containerPorts`. Planted failure: `containerPorts` is 80 but the app listens on 3000 (task
   check: `containerPorts` includes 3000; FACTS 11 row 1).
5. *The price.* Price chip visible. Task: reach the per-month figure the engine gives for 3 small instances.
6. *Register.* `widget fluxcloud-sim` flow `register`: Register New App, Simple or Advanced, Review and
   Validate, Sign Message, Test Application Installation, pay, deploy (FACTS 9.4). Labelled simulation.
7. *Find it.* `diorama` `placement` and the generated URL `<name>.app.runonflux.io` (FACTS 6.4).
Checkpoint: `spec-fix` (name starts with `flux`, component name has a hyphen, port 22 is banned: FACTS 3.6, 3.4);
`spec-build` (a three-instance hello app with a stated budget); `estimate` the monthly price.
Terms: component, instance, repotag, ports, containerports, expire.

### 6. `resources-pricing`: Resources and price (10 min, hands-on)
1. *Price anatomy.* Diagram `price-waterfall` (driven by a real `Quote`).
2. *CPU, RAM, disk.* `widget cost-reactor` with sliders; show the `Quote.lines` notes.
3. *Instances.* Same widget: price is close to linear in instances (FACTS 4.4, 4.6 curve table).
4. *The cliff.* A small app goes from 3 to 4 instances and the price doubles (FACTS 4.4 "Small app cliff").
   Task: find the instance count where it jumps, then explain it. Callout `cost`.
5. *The port tax.* Ports 1-1023, 8080, 8081, 8443, 6667 each add USD 2 to the bundle before the divide by 3,
   so about USD 0.67 per instance and more with more instances (FACTS 3.4, 4.4, 11 row 28). Task: change
   8080 to 31001 and watch the price fall.
6. *Time.* `widget block-converter`: months, blocks, duration discounts (3, 6, 12 percent), the 0.99 floor and
   the .49 or .99 rounding (FACTS 4.3, 5.1).
Checkpoint: `estimate` USD for a given spec; `spec-build` under a budget with minimum resources; `choice`
why 4 instances cost more than 3. Terms: fluxmultiplier, quote, expire, block.

### 7. `ports-and-domains`: Ports and traffic (10 min, hands-on)
1. *Two ports.* Diagram `port-mapping` beats 0 and 1 (external versus container; TCP and UDP both published).
2. *Bind 0.0.0.0.* Beats 3 and 4 with `compare` (127.0.0.1 versus 0.0.0.0): FACTS 11 row 2.
3. *Your free URL.* `<name>.app.runonflux.io` and `<name>_<externalPort>.app.runonflux.io` (FACTS 6.4,
   11 row 3). Task: choose the right URL for port 31001.
4. *One request, many instances.* `diorama traffic`: round robin, the `FDMSERVERID` cookie keeps a client on one
   instance up to 8 hours, a dead instance is ejected in about 6 s (FACTS 6.4). Task: send 10 requests, then
   kill the instance you were pinned to.
5. *Not everything is HTTP.* Raw TCP and UDP: connect to node IP and port from `/apps/location/<name>`
   (FACTS 8.1, 11 row 30). The exception is an app with a `g:` component: FDM serves every port of it in TCP
   mode and sends all of them to the one primary (FACTS 6.4); test a given port, production was not probed.
Checkpoint: `spec-fix` (mismatched array lengths, a banned port, a duplicate port across components);
`choice` the URL for a given port; `match` problem to cause. Terms: ports, containerports, fdm, app-domain.

### 8. `env-and-secrets`: Environment, commands and private images (8 min, hands-on)
1. *Environment variables.* `spec` stage (`environmentParameters` shape `KEY=value`); FluxOS injects
   `FLUX_APP_NAME` and `FLUX_NODE_HOST_IP` (FACTS 8.3).
2. *Commands.* `commands` is the container CMD array, not a shell script (FACTS 8.3, 11 row 21).
3. *The spec is public.* Show the real read-only `GET /apps/appspecifications/<name>` result for a public app
   (stage `terminal` with a fixture of a real response): anyone can read env vars (FACTS 8.3, 11 row 18).
4. *Enterprise.* What it is, what it needs (ArcaneOS nodes, amd64 images, `contacts` and `compose` encrypted),
   and what it adds (USD 4 scope in the bundle before the divide by 3, FACTS 3.7, 4.4). Not the same as the
   "enterprise network".
5. *Private images.* `repoauth` only works with enterprise (FACTS 3.3, 11 row 6).
Planted failure: `DB_PASSWORD` in `environmentParameters` of a public spec.
Checkpoint: `spec-fix` (move to enterprise); `multi` who can read env vars; `choice` where private images
work. Terms: enterprise, arcaneos, repoauth, environmentparameters.

### 9. `deploy-from-git`: Deploy from a Git repository (17 min, hands-on)
Arc: what Orbit registers, plans as sizes, what one instance means, the button, build settings, a push, Orbit or
your own spec. Orbit is a Flux product that builds a repository and registers an ordinary version 8 spec, so
nothing about the network is different (FACTS 15.3.1).
1. *What Orbit registers.* `spec` stage (`orbitPlanSpec`, editable `containerPorts`). Task: the server listens
   on 8080, so fix `containerPorts` and keep 9001 (lint `PORT_ENV_MISMATCH`). Callout `wild` with the dated
   `ORBIT_FACTS` sample. FACTS 15.3.1, 15.3.2, 15.3.4.
2. *Four plans, one formula.* `widget orbit-planner` (`view: plans`): plan cards priced by `orbitPlanQuoteUsd`
   with a BAKED chip that carries both dates; shrink a Custom size until the formula prices it below
   Standard. Callouts: features by plan; the encrypted price (the reconciliation is UNVERIFIED). FACTS 15.3.9,
   15.3.10, 15.3.11, 15.3.13.
3. *What one instance means.* `diorama failover`, 1 instance, `kill-nodes` 1. Links `redundancy-failover`;
   rollback is not failover. No network-wide percentage is quoted. FACTS 15.3.7, 15.3.10, 15.3.13, 6.3, 6.5.
4. *The Deploy to Flux button.* `widget orbit-planner` (`view: button`): fix a pasted link (an SSH address, an
   absolute folder, `plan=free`) with the refusal messages of `tryDeployToFluxUrl`. FACTS 15.3.9, 15.3.12.
5. *Build settings are variables.* `spec` stage. Task: add `PROJECT_PATH` and `BUILD_COMMAND` to a monorepo spec.
   FACTS 15.3.6, 15.3.6.1.
6. *A push becomes a version.* `compare`: a push that deploys against a build that fails (a labelled
   illustration). FACTS 15.3.4, 15.3.5, 15.3.7, 9.8.1.
7. *Orbit or your own spec.* `compare`. A callout names the Orbit MCP server and links `agents-and-mcp`.
   FACTS 15.3.1, 15.3.10, 15.3.14, 15.4.1, 15.4.3, 15.4.8.
Planted failures: a port mismatch (step 1); a single instance down with its node (3); an SSH repository URL, an
absolute folder and `plan=free` (4); a monorepo built at its root (5); a token in a plain spec (checkpoint).
Checkpoint: `choice` plan fit; `estimate` the Standard size on 3 instances (baked card, date said); `spec-fix`
seal the token; `match` four failure messages to causes; `choice` which team starts with Orbit.
Terms: git-deploy, nixpacks, webhook, deploy-button, monorepo, rollback, preview-deploy.

### 10. `ai-assisted-deploy`: Describe it, review it, sign it (15 min, hands-on)
Arc: an assistant changes who types the spec, not what the network does, so the review skills the learner
already has are what make a draft safe. Two example drafts, three review passes, then the clocks around signing.
1. *A sentence in, a draft out.* `code` stage: a labelled EXAMPLE session (the sentence, then a card built from
   the draft, the page's own notes highlighted). Read-only. Callouts: `why` (changes who types the spec) and
   `gotcha` (a token typed into the sentence). FACTS 15.2.2, 15.2.3, 15.2.4, 15.2.5.
2. *Read it against your sentence.* `spec` stage, draft A, only placement and ports editable. Planted: an empty
   `geolocation` (the sentence said Europe only) and container port 8080 (the sentence said 8000): valid, and no
   lint code says so.
3. *Let the linter read it.* `spec` stage with issues. Planted: `IMAGE_LATEST` (the page adds `latest`),
   `ENV_SECRET_PUBLIC`, `INSTANCES_ONE`. Task: clear all three and keep the token (enterprise). Callout: a clean
   report is not an acceptance. FACTS 15.2.5, 6.3, 11 rows 13, 18 and 19, 3.10.
4. *Price it, then size it.* `spec` stage with price: as returned, repaired, sized, all from `quote()` on the
   baked rates with their date. Task: stay under USD 5 from a stated test run, not below what it used.
   FACTS 4.3, 4.4.
5. *Sign, then pay inside the clocks.* Diagram `lifecycle`, beat 1. FACTS 6.6, 4.7, 6.1, 15.2.1, 15.2.3.
6. *What the page says and what holds.* `compare`: the page's unbacked claims against what holds; hand-off to
   `agents-and-mcp` and the Agent Desk lab. FACTS 15.2.8, 15.2.13.
Planted failures: draft A (steps 2 to 4); draft B (`a!cEU` forbids what the sentence asked for, a `docker.io/`
prefix and `latest`, the wrong data folder, 300 MB for Nextcloud).
Checkpoint: `multi` the wrong lines of draft B (the key is derived from the linter and the sentence); `spec-fix`
repair it lint-clean under USD 1.50 (graded by `quote()`); `estimate` one more copy (the price cliff, baked date
shown); `multi` what the assistant can and cannot do (FACTS 15.2).
Terms: ai-assistant, ai-agent.

### 11. `minecraft-server`: Project: a Minecraft server (12 min, project)
Facts to take from FACTS 9 (marketplace games) and 8.1 (non-HTTP): connect by node IP and port; 25565 is above
1024 so it carries no port fee; the world needs persistence.
1. *The brief.* Requirements card (players, RAM, a world that survives).
2. *Size it.* `spec` with `cost-reactor` feel; RAM is the driver.
3. *Expose it.* Port 25565, which is above 1023 and carries no port fee. An ordinary app domain carries
   HTTP and HTTPS; an app with a `g:` component gets a TCP listener on its port at the load balancer, routed
   to the primary (FACTS 6.4, 8.1; production reachability not probed, so test it).
4. *Persist the world.* Compare plain, `r:` and `g:` for a single-writer server (FACTS 7.2): choose `g:`
   and say why; note a standby needs at least two instances.
5. *Connect.* `terminal`: fetch `/apps/location/<name>` (fixture) and read the IP and port.
6. *Price it.* Engine quote with and without `g:` instances.
Checkpoint: `spec-build` to the brief; `terminal` find the address; `choice` data fate of a plain volume
on node loss. Terms: containerdata, primary-standby, syncthing.

### 12. `operate-your-app`: Operate your app (10 min, concept)
1. *My Applications.* `widget fluxcloud-sim` flow `manage` (FACTS 9.5 to 9.7, real labels).
2. *Look inside.* Logs and the terminal tab; reading a crash loop's restart spacing 30 s, 5, 15, 30 min
   (FACTS 6.3, 11 row 21).
3. *Soft versus hard.* Soft redeploy keeps data; hard recreates volumes; a structure change escalates
   (FACTS 7.3, 11 row 17). Planted failure: an update that renames a component.
4. *Updates cost nothing sometimes.* The "free update" rule and rate limits (FACTS 4.5).
5. *Time and renewal.* `widget block-converter`: expiry height, no grace, renewal credit (FACTS 5.2 to 5.4).
6. *Where is it running?* `diorama network` with the App Explorer lab link (FACTS 10).
Checkpoint: `order` an update flow; `estimate` blocks left; `choice` what a hard redeploy does to data.
Terms: soft-redeploy, hard-redeploy, renewal, expire, location.

## Track 3: Stratus (scale and harden)

### 13. `redundancy-failover`: Instances and failure (10 min, hands-on)
1. *One instance.* `diorama failover`, instances 1, kill: the app is down. Callout: a dated sample from
   `ORBIT_FACTS` (every single-instance app that was not a blocklisted Orbit deployment had a running copy
   on 2026-10-13; FACTS 15.3.3), said to be a snapshot and not a failure rate. No percentage is quoted.
2. *Three instances.* Kill one: traffic reroutes in about 6 s (FACTS 6.4).
3. *Detect versus replace.* Ejecting is seconds; respawning can take about two hours after the node dies, 125
   minutes plus the image pull (FACTS 6.5): plan for N-1, not for the replacement. A `g:` app is different:
   moving to a standby takes minutes (FACTS 6.4).
4. *Spread is not guaranteed.* In practice instances are on distinct nodes; `geolocation` filters which
   nodes qualify but does not spread copies (FACTS 6.2). Task: kill every node in one region.
5. *The arithmetic.* `widget uptime-calculator` (state the independence assumption).
Checkpoint: `spec-build` (instances and geolocation to survive a stated failure); `estimate` combined
availability; `choice` why more instances cost more than linear at 3 to 4 (cross-link to lesson 6).
Terms: instance, instances, failover.

### 14. `geo-placement`: Where your app runs (8 min, concept)
1. *The grammar.* `widget geo-picker` builds `geolocation` (FACTS 3.5: `acEU`, `acEU_DE`, `a!cNA`).
2. *Allow versus deny.* Deny wins; a node must match an allow (when there are any) and no deny. Entries the
   network does not understand are skipped (FACTS 3.5).
3. *Pin nodes.* `nodes` only for enterprise-listed owners in v8; adds the scope fee (FACTS 3.2, 4.4).
4. *Static IP.* USD 2 in the bundle before the divide by 3, and fewer eligible nodes (FACTS 4.4, 11 row 26).
5. *What it does to placement.* `diorama network` with eligible counts from live geo.
Planted failure: geolocation so narrow that fewer nodes qualify than instances (registration is refused with
"only M eligible nodes"); a list that leaves no node at all is accepted and nothing is promised to run
(FACTS 3.5).
Checkpoint: `spec-build` ("Europe only, not Russia"); `match` entries to meanings; `choice` effect of `staticip`.
Terms: geolocation, staticip, nodes.

### 15. `persistent-storage`: Persistent storage (12 min, hands-on)
1. *A volume is a file.* `hdd` is a pre-allocated ext4 image on one node (FACTS 7.3).
2. *What a plain path guarantees.* `diorama sync` with a plain volume: survives restart, lost on node loss
   (FACTS 7.2). Task: kill the node.
3. *`r:` replicates.* Every instance writes; eventually consistent; not a database cluster (FACTS 7.2, 11 row 15).
4. *`g:` elects.* One primary runs, the others hold a synced copy, FDM routes only to the primary
   (FACTS 6.4, 7.2). Task: kill the primary and watch promotion (minutes on the network, compressed in the
   figure, which says so). Only the `g:` component is started and stopped; every port follows the primary.
5. *Space and backups.* Out of space is ENOSPC; update with more `hdd` causes a hard redeploy so back up first
   (FACTS 11 row 16, 7.4). A local backup sits inside the volume, is not replicated and goes with the node:
   download it.
Checkpoint: `choice` which prefix for a database; `spec-fix` (stateful image with a plain `/tmp`); `order`
what survives what. Terms: containerdata, syncthing, primary-standby.

### 16. `shared-database`: A database that follows your app (12 min, project)
Source: FACTS 7 and the Marketplace and docs notes in FACTS 6.5, 8.2 (component naming), 11 rows 14 and 15.
1. *Two components.* App and database; database not in `ports`; app reaches it as `flux<component>_<app>`.
2. *Data on `g:`.* Single writer with standbys.
3. *Wire it.* Env var for the host name derived with `derivedNames`.
4. *Break it.* Failover scene: primary dies; the app's connection must retry (state the downtime honestly:
   "a delay of minutes", FACTS 7.2).
5. *Limits.* What this is not (not a multi-master cluster).
Checkpoint: `spec-build` app plus database to a brief; `spec-fix` (database published publicly, plain volume);
`choice` correct host name. Terms: component, primary-standby.

### 17. `multi-component`: Several containers, one app (14 min, project)
1. *One app, many components.* Diagram `internal-dns`.
2. *Naming.* No hyphens in component names; ports unique across the app; max 5 ports per component and 10
   components (FACTS 3.3).
3. *Wiring.* `widget wiring-board`: frontend to api to cache; only the frontend is exposed.
4. *Totals.* Resource sums are app-wide (cap 15 cores, 59,000 MB, 820 GB, FACTS 3.3) and so is price.
5. *Ship a three-tier app.* Spec stage with a template.
Checkpoint: `spec-build` three components to a brief; `spec-fix` (hyphen, duplicate port, over-cap);
`match` component to host name. Terms: compose, internal-dns, component.

### 18. `custom-domains`: Your own domain (10 min, hands-on)
1. *Two steps, not one.* Put the domain in `domains[i]` AND point DNS (FACTS 6.4, 11 row 27).
2. *The record.* `widget dns-record-builder`: a subdomain gets a CNAME to `<name>.app.runonflux.io`; the apex
   needs flattening or an A record (FACTS 6.4).
3. *Certificates.* FDM issues a Let's Encrypt certificate when DNS points at it; behind a proxy it cannot
   (FACTS 6.4; mark the Cloudflare SSL-mode advice as unverified).
4. *Check it.* `terminal` with `dig` (scripted fixture).
Checkpoint: `terminal` find the problem in a given record; `spec-fix` (`domains` misaligned with `ports`);
`choice` apex versus subdomain. Terms: domains, cname, fdm.

### 19. `agents-and-mcp`: Agents with guard rails (20 min, hands-on)
Arc: an agent changes who types the spec, not what the person must check. The learner approves four scripted
sessions of the `agent-session` widget; the reading between them names what was just seen.
1. *An agent deploys, you approve.* `widget agent-session`, scenario `deploy-nginx`, policy `ask-all`. The first
   plan names `nginx:latest`. FACTS 15.1.4, 15.1.5, 15.1.16.
2. *Two servers, two kinds of identity.* `compare`: the FluxCloud MCP server's config (two keys, no account)
   against the Orbit MCP server's (a signed-in account, a short-lived token). Callouts: the floating tag; Flux ID
   owners only. FACTS 15.1.2, 15.1.3, 15.4.1, 15.4.2, 15.4.8, 6.3, 11 row 19.
3. *What each call can do to money and data.* `code` stage, two tabs: each server's tool sheet grouped by
   `toolRiskLabel`, derived from `MCP_TOOLS`. Callout: the local price estimate is not a quote. FACTS 15.1.4,
   15.1.5, 15.1.9, 15.1.16, 15.4.3.
4. *A client that asks only about money.* `widget agent-session`, `poisoned-log`, policy `ask-spends`; the
   prediction is in prose. FACTS 15.1.9, 15.1.10, 15.1.15.
5. *Tool output is data, and the gate is your client.* `compare` of two policies by call, derived from the
   widget's `asks()`; prompt injection; `confirm` is set by the agent; remove is not a cancel. FACTS 15.1.8,
   15.1.9.
6. *A timeout is not a no.* `widget agent-session`, `retry-after-timeout`, `ask-all`. A payment is recorded
   against the hash and the message lives about an hour; cancel is not an undo. FACTS 15.1.5 to 15.1.8, 15.1.11,
   6.1, 6.6.
7. *The Orbit server: your account, your checkout.* `widget agent-session`, `orbit-repo`, `ask-all`. FACTS 15.4.2
   to 15.4.8 and 15.4.10 (all DOCS-ONLY).
8. *Set it up so a mistake is small.* `compare`: the hosted call shape (keys as arguments) against local. Tip: the
   Agent Desk lab. FACTS 15.1.2, 15.1.3, 15.1.13, 15.1.15.
Planted failures (all inside widget sessions): a floating image tag in the first plan; a removal ordered by a log
line that a spending-only client lets through unasked; a second payment proposed after a timeout, then a cancel
reached for as an undo.
Checkpoint: `match` five tools to risk labels (five classes, one Orbit tool); `choice` the policy that would
have stopped the call; `multi` the log lines that give the agent an order; `estimate` the monthly quote of an
agent-built spec (baked card, `quote()`); `match` situations to setups.
Terms: mcp, mcp-server, ai-agent, tool-call, confirm-gate, prompt-injection.

### 20. `production-checklist`: Production checklist and capstone (15 min, project)
1. *The image.* Multi-stage, small, pinned tag, amd64, runs fine as non-root (permissions: FACTS 7.3
   caveat), exits when unhealthy because FluxOS ignores `HEALTHCHECK` (FACTS 6.3, 11 row 20).
2. *The spec.* Instances, geolocation, resource sizing, no secrets in the clear.
3. *State.* Storage prefix, backups (a backup held on the node is lost with it), soft versus hard.
4. *Time.* Duration, renewal and auto-renew, the no-grace expiry (FACTS 5.4, 11 row 25).
5. *Capstone.* `spec-build` with eight requirements, each a live checklist line with its price effect. Passing
   earns the Stratus Architect rank when the other two tracks are done.
Checkpoint: the capstone is the checkpoint; plus one `order` and one `estimate`.
Terms: all of the above in context.
