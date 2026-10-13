# Flux Academy FACTS.md

Fact base for the ground-up rewrite of Flux Academy. Compiled 2026-10-12; section 15 added 2026-10-13. Every claim ends with a tag `[src: ... | VERIFIED-LIVE | VERIFIED-SOURCE | DOCS-ONLY | UNVERIFIED]`. When docs and source disagree, source and live behaviour win and the row says so. Numbers that change over time are collected in "Snapshot 2026-10-12" (fetch them live in the product). No em dashes are used in this file; a pipe inside a source tag may appear as `\|`.

## Read this first (the corrections that matter most)

1. The current app spec is **v8** (`latestspecificationversion` = 8). v8 has NO `tiered`, `cpubasic` or `secrets` keys, REQUIRES `contacts`, `geolocation`, `expire`, `nodes`, `staticip` and `enterprise`, and old tutorial specs are rejected. Minimum instances is **1** (was 3), maximum 100. Section 3.
2. Price per month = (cpu x 0.15 x 10 + ram/100 x 0.05 + hdd x 0.02 + 4 if enterprise or pinned nodes + 2 if static IP + 2 per fee port) / 3, times instances, with a 20% (under 3 cores, 6 GB, 150 GB) or 10% discount only when instances < 4, floor USD 0.99, duration discounts 3/6/12%, and the total is rounded UP to .49 or .99. Reproduced 80 of 80 live quotes. Section 4.
3. Paying in FLUX is 5% cheaper (`fluxmultiplier` 0.95). Prices are USD based, FLUX is derived at about 0.0852 USD per FLUX today. Docs quoting "$0.40 static IP" and "$0.80 enterprise" are wrong: USD 2 and USD 4.
4. Blocks are **30 seconds** since Proof of Node (height 2,020,000, 2025-10-25). A "month" is 88000 blocks, a year is 1,056,000 blocks. There is no mining any more. Sections 1.4 and 5.
5. `expire` counts blocks from the latest register or update message; minimum 1 block, maximum 1,056,000. Min price is USD 0.99 whatever the length. At expiry the app and its data are removed within minutes to hours, with no grace. Section 5.
6. Domains are `<name>.app.runonflux.io` and `<name>_<externalPort>.app.runonflux.io` (production zone `app`, staging `app2`). Custom domains need a CNAME AND an entry in the component `domains` array. The legacy site invented other patterns. Section 6.4.
7. Plain `containerData` (`/data`) is a real volume on one node: it survives restarts and soft redeploys but is not replicated and is lost on node failure, hard redeploy, cancel and expiry. `g:` is primary/standby, `r:` and `s:` replicate. A "20% discount for g:" does not exist. Section 7.
8. "Enterprise" in v8 means the spec's `contacts` and `compose` are encrypted so only ArcaneOS nodes read them (needed for secrets and private images, amd64 only). It is not the same as the allowlisted "enterprise network". Env vars and commands are public otherwise. Sections 3.7 and 8.3.
9. Ports: 1 to 65535 except a banned list (22, 25, 53, 3389, 27017, 16100-16299, 30000-30099, ...); max 5 per component, 10 components, unique across the app; ports 1-1023 (config writes the range `0-1023`, but port 0 is refused), 8080, 8081, 8443, 6667 are accepted but cost USD 2 each. Both TCP and UDP are published. Section 3.4.
10. Tiers: Cumulus 1,000 / Nimbus 12,500 / Stratus 40,000 FLUX collateral; 7,105 nodes (3,585 / 1,691 / 1,829); apps up to 15 cores, 59,000 MB, 820 GB in total. Placement across tiers is soft (spawn delay timers of 57 to 117 minutes), not a hard rule. Sections 2 and 6.2.
11. FluxCloud is the old FluxOS dashboard: home.runonflux.io and .com 301 to cloud.runonflux.com. Real flow: Register New App (Simple or Advanced), Review & Validate, Sign Message, Test Application Installation, pay within 30 minutes, deployment up to 45 minutes. Section 9.
12. The price calculator POST hangs (504) with `Content-Type: application/json`; use `text/plain` or form encoding. FluxOS applies no HTTP rate limit (gateway or Cloudflare limits were not found) and the API sends CORS `*`. Section 10.
13. Not true or not shipped: "Flux Gravity" product, "PNR 80/20" revenue sharing to nodes, a fixed 440M or 560M supply cap, 37.5 FLUX block rewards, FluxCore mining FLUX, an image whitelist. Sections 0 and 1.
14. The legacy academy is wrong or outdated almost everywhere that is quantitative (about 190 verdict rows). Section 13.
15. There is no central scheduler: each node picks apps itself; a 1 instance app is installed but sits on one node, so a node failure means downtime of up to about 125 minutes. The older figure "22% of live 1-instance apps have no running copy" is WRONG as a statement about fragility: the 78 apps behind it are Orbit deployments whose owners are on the signed blocklist, and every single-instance app from a non-blocklisted owner has a running copy (0 of 122 without, 2026-10-13). Sections 6 and 15.3.3.
16. Orbit (Deploy with Git) is not a separate network object and has no free plan: a managed Orbit app is a plain v8 spec with one component, image `runonflux/orbit:latest`, owned by an ordinary Flux ID. The plans Starter 0.99, Standard 2.49 and Pro 3.99 equal `quote()` for their sizes (no builder fee), Starter is ONE instance (not "3+ nodes"), and the old Free plan is closed. Sections 15.3.1, 15.3.10 and 15.3.11.
17. The AI surfaces are not interchangeable, and some of their words have no backing (section 15):
    - (a) The console assistant never deploys or pays: it has no deploy, sign, pay, cancel, control or key tool. `ui_prefill_deploy` only fills the deploy form and the human signs there. 15.2.2, 15.2.3.
    - (b) The Flux Cloud MCP server signs and pays only when the agent sets `confirm=true`, a boolean and not a human prompt. `flux_control_app` has no plan step and `hard=true` or `remove` deletes data; `flux_cancel_app` refunds nothing. 15.1.5, 15.1.8, 15.1.9.
    - (c) In hosted mode private keys are tool-call arguments, and the hosted server reports version 0.2.2, not the 0.2.7 on npm. 15.1.1, 15.1.3.
    - (d) The server's pricing guide and `flux_get_pricing` apply a g: 20% discount that does not exist; the console copy's "API token with a daily limit", balance, per-day billing, 3-day grace and "live in 30 seconds" have no backing. 15.1.16, 15.2.7, 15.2.8.
    - (e) Orbit MCP is described, by the Orbit guide only (DOCS-ONLY), as signing in as an Orbit account and sending a person to a Stripe checkout; Flux Cloud MCP uses two keys and pays itself (VERIFIED-SOURCE). 15.4.8.

## Source key

Source tags use short paths. `ZelBack/...`, `config/...`, `docs/...` are in the FluxOS repo; other prefixes map as follows.

| Prefix in tags | Repo or URL | State read |
|---|---|---|
| `ZelBack/...` , `src/flux/...` , `BE/...` , `flux:` | https://github.com/RunOnFlux/flux (FluxOS) | v8.20.0, commit 3ca1ab9, 2026-09-25. Config is `ZelBack/config/default.js` |
| `src/fluxd/...` | https://github.com/RunOnFlux/fluxd | HEAD 8a60ee6, 2026-09-08 |
| `flux-docs/docs/...` , `src/flux-docs/...` , `DOCS/...` , `docs:` | https://github.com/RunOnFlux/flux-docs (source of docs.runonflux.com, Docusaurus) | commit 1053188, 2026-10-07 |
| `src/runonflux-docs`, `olddocs:` | https://github.com/RunOnFlux/runonflux-docs (old GitBook) | Nov 2025, stale |
| `fluxos-frontend/...` , `FE/...` , `fe:` | https://github.com/RunOnFlux/fluxos-frontend (FluxCloud and node dashboard UI, package flux-gravity 3.20.9) | 2026-10-12 |
| `flux-domain-manager/...` , `fdm:` | https://github.com/RunOnFlux/flux-domain-manager | a30f379, 2026-10-05 |
| `fluxos-network-policy/...` | https://github.com/RunOnFlux/fluxos-network-policy | 1307c8a, 2026-10-04 |
| `fluxdocs/fluxapi.yaml` | https://github.com/RunOnFlux/fluxdocs (OpenAPI, 339 paths) | 7eb033d |
| `src/fluxwhitepaper/...` | https://github.com/RunOnFlux/fluxwhitepaper | 6869738, 2026-09-08 |
| `legacy:` | previous academy, local Next.js project | n/a |
| `https://api.runonflux.io/...` , `https://stats.runonflux.io/...` | live endpoints | fetched 2026-10-12 and 2026-10-13 (section 15 counts at 2026-10-13 04:28Z, height 3,032,438) |
| `product page`, `guide` (section 15) | https://runonflux.com/apps/orbit (Orbit product page: plans, FAQ, pricing footnotes), `/apps/orbit/mcp-server` (the Orbit MCP guide), `/apps/orbit/deploy-to-flux` (the button page), `/apps/.well-known/oauth-protected-resource` | footer `v1.1.101`, read and re-fetched byte-identical 2026-10-13. Vendor text is DOCS-ONLY; a `curl` result is VERIFIED-LIVE |
| `docs deploy-with-git/<page>` (section 15) | https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-git/... (introduction, quick start, environment reference, GitHub webhooks, webhook API, deployment hooks, troubleshooting, Node.js guide) as published | read 2026-10-13. Differs from the `flux-docs/docs/...` row (a repository commit) only in being the published page; DOCS-ONLY |
| `policy-signed.json` | https://raw.githubusercontent.com/RunOnFlux/fluxos-network-policy/signed/policy-signed.json: the signed network policy bundle (`blocklist`, `blockedrepositories`, `vettedrepositories`, `tamperingblockednodes`, `enterprisenodes`) | seq 5, issued 2026-10-04T09:12:10Z, payload decoded, signature not verified by the academy |
| `mcp@0.2.7 dist/...` , `flux-cloud-mcp/...` | npm package `@runonflux/flux-cloud-mcp` 0.2.7 (https://www.npmjs.com/package/@runonflux/flux-cloud-mcp, source https://github.com/RunOnFlux/flux-cloud-mcp, MIT), unpacked tarball `dist/*.js`. Git head `e10d2ad`, the commit GitHub `master` ends on | npm time 2026-09-13T07:13Z; read 2026-10-13 |
| `mcp@0.2.2 dist/...` | the same package at 0.2.2, the version the hosted server reports; diffed file by file against 0.2.7 | npm time 2026-09-12T01:37Z |
| `hosted initialize`, `hosted tools/list`, `hosted resources`, `hosted prompt`, `hosted /healthz` | read-only JSON-RPC calls and GETs to the hosted Flux Cloud MCP server `https://mcp.runonflux.com/mcp` and `https://mcp.runonflux.io/mcp` (no tool was called) | 2026-10-13 04:20 to 04:30 UTC; `/healthz` re-read by the integrator |
| `docs:ai-agents-mcp` | https://docs.runonflux.com/fluxcloud/ai-agents-mcp (DOCS-ONLY) | read 2026-10-13 |
| `console useAgentRun-*.js`, `console agents-*.js`, `console AssistantPanel-*.js`, `console deploy-*.js`, `console en-*.js`, `console git-*.js` | chunks of the shipped bundle of the new FluxCloud console front end, cited by chunk name only, read as text and never executed. `en-*.js` holds the UI strings, `git-*.js` the Git deploy card, `useAgentRun-*.js` the assistant. Strings are DOCS-ONLY; what the code does is VERIFIED-SOURCE. Tags in 15.3 write `chunk git-*.js` and `chunk en-*.js` for the same files | build served 2026-10-12 10:58 GMT, read 2026-10-13 |
| `fluxos:...` | FluxOS repo, same state as the first row of this table (v8.20.0, commit 3ca1ab9) | 2026-09-25 |

Saved artefacts (this repo): `docs/research/samples/*.json` are trimmed real responses (44 files from the API catalog) and `docs/research/samples/price-verification-80-cases.json` holds 80 specs with the official price and the formula's answer for unit tests.

## Snapshot 2026-10-12 (volatile numbers, fetch live)

| Item | Value | Fetch from | Source tag |
|---|---|---|---|
| Chain height | about 3,031,4xx (3,031,422 at 19:59Z) | GET /daemon/getblockcount | [VERIFIED-LIVE] |
| Block spacing | 30.07 s measured (2880 blocks in 86,610 s) | GET /daemon/getblock/<h>/1 | [VERIFIED-LIVE] |
| Next subsidy reduction | height 3,071,200 (about 2026-10-26), 14 to 12.6 FLUX | derived | [VERIFIED-SOURCE] |
| FluxOS version | 8.20.0 (6,972 of 7,106 node rows) | GET /flux/version ; stats /fluxversions | [VERIFIED-LIVE] |
| Latest spec version | 8 | GET /apps/latestspecificationversion | [VERIFIED-LIVE] |
| Nodes confirmed | 7,105 (Cumulus 3,585, Nimbus 1,691, Stratus 1,829) | GET /daemon/getfluxnodecount | [VERIFIED-LIVE] |
| ArcaneOS nodes | 6,612 of 7,106 records (93%) | stats /fluxinfo | [VERIFIED-LIVE] |
| USD price table | cpu 0.15, ram 0.05, hdd 0.02, port 2, scope 4, staticip 2, fluxmultiplier 0.95, multiplier 1, minUSDPrice 0.99 | GET /apps/getappspecsusdprice | [VERIFIED-LIVE] |
| FLUX in USD | about 0.0852 | GET https://viprates.runonflux.io/rates | [VERIFIED-LIVE] |
| Apps on chain | 2078 (v8 1777, v7 198, v6 61, v3 27, v4 11, v5 2, v2 2); 1122 v8 apps encrypted (enterprise) | GET /apps/globalappsspecifications | [VERIFIED-LIVE] |
| Requested instances | 2: 1140 apps, 3: 434, 1: 352, 100: 25, 30: 24 | same | [VERIFIED-LIVE] |
| Running location rows | 8,770 | GET /apps/locations | [VERIFIED-LIVE] |
| Apps below requested instances | 151 of 2078 (96 with none). On 2026-10-13, 78 of the apps with none are blocklisted Orbit deployments (15.3.3) | globalappsspecifications + locations | [VERIFIED-LIVE] |
| Common `expire` values | 88000 (377 apps), 1056000 (125), 20160 (105), 264000 (34), 528000 (34) | same | [VERIFIED-LIVE] |
| Primary mount types | plain 644, g: 312, r: 111, s: 27 components | same | [VERIFIED-LIVE] |
| Blocklist | 311 entries (kind owner 186, hash 85, image 21, org 19; 149 of the owner entries are Orbit deployments added 2026-09-30, 15.3.3), 292 blocked repositories, `enterprisenodes` with 2 node keys and 3 owner addresses | fluxos-network-policy signed bundle | [VERIFIED-LIVE] |
| Marketplace API | 195 records, 97 visible | GET https://stats.runonflux.io/marketplace/listapps | [VERIFIED-LIVE] (via section 9) |
| Sample quote | 0.5 core / 500 MB / 5 GB, 3 instances, port 31001, 88000 blocks: usd 0.99, flux about 11.0 | POST /apps/calculatefiatandfluxprice | [VERIFIED-LIVE] |

More volatile tables: section 1 "Snapshot (part 1)", section 2 "Snapshot (part 2)", section 9.15, section 10.5 and the Orbit tables of 15.3.2 and 15.3.10.

### Re-read 2026-10-13 01:14 UTC (about 13 hours later; figures lessons cite "at the time of writing")

Read by the FACTS owner with plain GETs (and the read-only calculator POSTs of 4.2) on 2026-10-13 between 01:13 and 01:25 UTC. Where a number is also in the 2026-10-12 tables above, this table is the later reading and the network had moved a little. The node count itself drifts by dozens a day, so always say "at the time of writing" or give the date. All rows [VERIFIED-LIVE 2026-10-13].

| Item | Value on 2026-10-13 | Earlier reading | Call and how it was counted |
|---|---|---|---|
| Nodes (daemon) | 7,075 (Cumulus 3,584, Nimbus 1,664, Stratus 1,827) | 7,105 on 2026-10-12 | GET api /daemon/getfluxnodecount |
| Node rows in stats | 7,078 (Cumulus 3,585, Nimbus 1,666, Stratus 1,827) | 7,106 | GET stats /fluxinfo?projection=ip,tier,geolocation,node,benchmark,flux, one row per node. Every "of 7,078" below counts these rows |
| Nodes in Europe | 5,033 of 7,078 (71.1 percent). Other continents: North America 1,590, Asia 244, South America 65, Oceania 46, Africa 25, no continent resolved 75 | 5,016 of 7,081 | rows with `geolocation.continentCode` = EU. `geolocation` is the network's IP-location record (ip-api), not a node-reported value |
| Nodes filed under EU_RU | 202 (the location record puts Russia in the EU continent bucket, so the deny entry that matches them is `a!cEU_RU`) | 195 | rows with `continentCode` EU and `countryCode` RU. The placement table `/apps/placementlocations` showed 204 nodes in 10 fault domains for EU / RU (its own, older snapshot of 7,063 nodes) |
| Nodes with `staticIp` true | 2,145 of 7,078 (30.3 percent); Cumulus 592, Nimbus 255, Stratus 1,298 | 2,145 of 7,081 (592 / 256 / 1,301 by tier on 2026-10-12) | rows with `flux.staticIp` true. This is the node's own verdict (`geolocationService.isStaticIP()`, reported as `info.flux.staticIp`): STATIC once its address has stayed the same for about 10 days. Do not confuse with `geolocation.static` (3,458 rows), which is a different flag in the IP-location record [src: ZelBack/src/services/geolocationService.js:L38-L46,L453-L466 \| VERIFIED-SOURCE] |
| Nodes flagged data centre | 3,237 of 7,078 | 3,238 of 7,105 | rows with `geolocation.dataCenter` true |
| arm64 nodes | 7 of 7,078 (Cumulus 4, Nimbus 2, Stratus 1). 6,994 rows report amd64 and 77 rows report no architecture | 7 | `benchmark.bench.architecture` in the same /fluxinfo call. None of the 7 reports an `arcaneVersion`. 77 rows report no architecture (75 of them also carry no FluxOS version), so the stats service has no benchmark for them |
| ArcaneOS nodes | 6,640 of 7,078 (Cumulus 3,290, Nimbus 1,594, Stratus 1,756) | 6,612 of 7,106 | rows with `flux.arcaneVersion` |
| Apps on chain | 2,084 (v8 1,783 of which 1,125 encrypted; v7 198; v6 61; v3 27; v4 11; v5 2; v2 2) | 2,078 (v8 1,777, 1,122 encrypted) | GET api /apps/globalappsspecifications, count of entries |
| Requested instances | 2: 1,147 apps, 3: 434, 1: 351, 100: 25, 30: 24, 6: 25 | 2: 1,140, 3: 434, 1: 352 | same |
| Primary mount types | plain 643, `g:` 316, `r:` 111, `s:` 27 of 1,097 visible components (186 components carry more than one mount) | plain 644, `g:` 312, `r:` 111, `s:` 27 of 1,094 | same call; first definition of each component's `containerData`; encrypted apps hide theirs, so this counts only the plain-spec apps |
| Running location rows | 8,792 rows, 2,009 distinct app names, 4,199 distinct `ip:port` | 8,770 | GET api /apps/locations |
| The `explorer` app | spec v7, `instances` 40, `geolocation` `[]`, 40 running copies: 34 on nodes filed in Europe, 6 in North America. 32 of the 40 copies run on nodes with `staticIp` true | 40 rows | GET api /apps/appspecifications/explorer and /apps/location/explorer; each copy's continent from the /fluxinfo row with the same host. An empty `geolocation` is "anywhere", and the split simply mirrors where the nodes are (71 percent Europe) |
| Calculator FLUX figure for USD 0.99 | 11.62 FLUX (implied USD 0.0809 per FLUX after the 5 percent discount) | 11.04 on 2026-10-12 | POST api /apps/calculatefiatandfluxprice; the FLUX figure moves with the rate, the USD figure does not. viprates read 0.0828 USD per FLUX at the same time, so the node's cached rate lags |
| `*.app.runonflux.com` | does not resolve (name not found) | not tested | system resolver and Node `dns.resolve4`; `lanternshop.app.runonflux.com` and `app.runonflux.com` both NXDOMAIN. `*.app.runonflux.io` and `*.app2.runonflux.io` resolve to FDM load-balancer hosts (`fdm-lb-*.runonflux.io`); the bare `app.runonflux.io` has no address record |

### Re-read 2026-10-13 04:28 UTC (the Orbit read of section 15)

Read once by the Orbit researcher and re-run by the FACTS integrator the same day; counts are exact for that moment and drift. The apps-on-chain figure differs from the 01:14 table by one app because the network moved in between. All rows [VERIFIED-LIVE 2026-10-13] unless the tag says otherwise.

| Item | Value | Call and how it was counted |
|---|---|---|
| Chain height | 3,032,438 | block count at the time of the read |
| Apps on chain | 2,083 (1,123 encrypted v8 specs) | GET api /apps/globalappsspecifications |
| Running location rows | 8,784 to 8,785, 2,008 distinct app names | GET api /apps/locations (two fetches) |
| Orbit deployments in plain specs | 235: all v8, one component, image `runonflux/orbit:latest`; 229 with 1 instance, 5 with 2, 1 with 3 (15.3.1, 15.3.2) | component `repotag` starts with `runonflux/orbit` |
| Single-instance apps without a running copy | 78 of 351, all Orbit deployments of blocklisted owners; 0 of the 122 non-Orbit single-instance apps (15.3.3). Of all 94 apps with no location, 78 are these | specs joined to locations by app name |
| Blocklist | seq 5, 311 entries, 149 owner entries with Orbit wording, added 2026-09-30 | decoded `documents.blocklist` |
| Orbit product page | footer `v1.1.101`; plans Starter 0.99, Standard 2.49, Pro 3.99, Custom from 0.99 (15.3.10) [DOCS-ONLY] | GET https://runonflux.com/apps/orbit |
| Orbit MCP endpoint | `https://runonflux.com/apps/mcp` answers 401 without credentials; 15 tools in the guide (15.4) [DOCS-ONLY for the tools] | unauthenticated POST `initialize` and GET |

## Contents

0. Docs that disagree with source (overview, tiers, token)
1. What Flux is today
2. Node tiers
3. The application specification
4. Pricing
5. Blocks, time and subscriptions
6. How deployment really works end to end
7. Persistence
8. Networking
9. FluxCloud and the FluxOS dashboard
10. Read-only HTTP API
11. Common mistakes and failure modes
12. Glossary seeds
13. Legacy claim audit
14. Open questions
15. AI deployments, Orbit and agents (15.1 the Flux Cloud MCP server, 15.2 the console assistant, 15.3 Orbit and Deploy with Git, 15.4 the Orbit MCP server)

## 0. Docs that disagree with source (overview, tiers, token)

When docs and source disagree, source wins. Items below must not be taught as fact.

| # | Claim in docs / website | What source or live data says | Verdict |
|---|---|---|---|
| C1 | Nodes earn "50% of block rewards (37.5 FLUX per block)" [src: src/flux-docs/docs/home/flux-ecosystem.md:L35 \| DOCS-ONLY] | Since height 2,020,000 each block is 14 FLUX and 13.5 FLUX (96.4%) goes to the three node payees, 0.5 FLUX to the dev fund address. 37.5 FLUX was the frozen PoW-era subsidy. [src: src/fluxd/src/main.cpp:L2886-L2939 \| VERIFIED-SOURCE] Live coinbase of block 3031400: 0.5 / 1 / 3.5 / 9 [src: https://api.runonflux.io/daemon/getblock/3031400/2 \| VERIFIED-LIVE] | docs stale |
| C2 | "Progressive Node Rewards: 80% of FluxCloud app revenue is shared among ArcaneOS node operators, 20% to hosts" presented as live [src: src/flux-docs/docs/fluxnodes/what-are-fluxnodes.md:L64-L69 \| DOCS-ONLY] | No PNR code exists in fluxd or FluxOS (grep for "PNR" and "progressive" over `src/fluxd/src` and `src/flux/ZelBack/src` returns nothing). The whitepaper states "every satoshi a node operator earns is newly issued" and "PNR is the planned change" [src: src/fluxwhitepaper/paper/sections/07-pnr.tex:L4-L9 \| DOCS-ONLY]. The public roadmap lists "PNR v2: App fees burn + pay operators" under H1 2027 [src: https://runonflux.com/timeline/ \| VERIFIED-LIVE]. | PNR is PLANNED, not live |
| C3 | Max supply 440,000,000 FLUX, "fixed" [src: https://runonflux.com/flux-token-mica-whitepaper/ \| DOCS-ONLY]; "FLUX asset cap of 560 million" [src: https://runonflux.com/fluxnodes/ \| DOCS-ONLY] | Two incompatible caps are published. Consensus has no total-supply cap: `MAX_MONEY = 440000000 * COIN` is only a per-output sanity bound; PON emission continues forever at about 1.79M FLUX per year after 20 reductions. [src: src/fluxd/src/amount.h:L31 and src/fluxd/src/main.cpp:L2799-L2816 \| VERIFIED-SOURCE] The roadmap lists "Supply proposal: Cap, freeze, or tail" for Q4 2026 [src: https://runonflux.com/timeline/ \| VERIFIED-LIVE]. | Treat both numbers as marketing; there is no enforced cap today |
| C4 | Node count "10,000+" nodes, "66 countries", "560 providers" [src: src/flux-docs/docs/index.md:L11 \| DOCS-ONLY]; "13,000+ nodes" [src: https://runonflux.com/flux-vs-aws/ \| DOCS-ONLY] | Live: 7,105 nodes, 56 countries, 358 distinct org strings (see Snapshot) [src: https://api.runonflux.io/daemon/getfluxnodecount \| VERIFIED-LIVE] | stale marketing |
| C5 | Nimbus 16 GB RAM / Stratus 32 GB in the legacy guide [src: src/flux-docs/docs/fluxnodes/legacy-fluxnode/step-by-step-guide/step-2-choose-your-hosting-setup/README.md:L21-L22 \| DOCS-ONLY] vs 32 GB / 64 GB in the overview [src: src/flux-docs/docs/fluxnodes/what-are-fluxnodes.md:L32-L33 \| DOCS-ONLY] | FluxOS nominal tier RAM is 7000 / 30000 / 61000 MB [src: src/flux/ZelBack/config/default.js:L660-L664 \| VERIFIED-SOURCE]; benchmark thresholds per whitepaper are 7 / 30 / 61 GB (see 2.2). The 8 / 32 / 64 GB figures are VM sizing advice, not minimums. | use 7 / 30 / 61 GB |
| C6 | Docs say a deployment "runs across three or more FluxNodes" [src: src/flux-docs/docs/fluxcloud/introduction.md:L24 \| DOCS-ONLY] | `minimumInstances: 3`, but `minimumInstancesV8: 1` applies to v8+ specs from block 2,176,519 (long passed; tip is 3.03M). [src: src/flux/ZelBack/config/default.js:L413-L415 \| VERIFIED-SOURCE] Note the live `/apps/deploymentinformation` still reports `minimumInstances: 3` [src: https://api.runonflux.io/apps/deploymentinformation \| VERIFIED-LIVE]. | v8 apps may have 1 instance. The Orbit docs introduction and the console's Git card repeat "3+ nodes"; live Orbit specs run 229 of 235 on 1 instance (15.3.4) |
| C7 | "All enterprise nodes must be on the Stratus tier" [src: src/flux-docs/docs/fluxcloud/register-new-app/deploy-with-docker/priority-nodes.md:L40 \| DOCS-ONLY] | No tier check in `enterpriseNodesService.js` scoring or `enterpriseNetwork.js`; Stratus simply scores highest (30 collateral points vs 15 / 2). [src: src/flux/ZelBack/src/services/enterpriseNodesService.js:L73-L79 \| VERIFIED-SOURCE] | not enforced in code read; UNVERIFIED for policy list |
| C8 | FluxCore "native FLUX mining" / "continue mining FLUX" [src: src/flux-docs/docs/fluxcore/mining/auto-switch.md:L60 \| DOCS-ONLY] | From height 2,020,000 mainnet rejects PoW blocks ("not-pon-block"); there is no hashing reward on the main chain. [src: src/fluxd/src/main.cpp:L5516-L5537 \| VERIFIED-SOURCE] The website itself says PoUW v2 "eliminated wasteful GPU mining" [src: https://runonflux.com/fluxnodes/ \| DOCS-ONLY]. Whatever FluxCore mines, it is not FLUX block rewards. | docs stale / UNVERIFIED what is mined |
| C9 | Parallel asset claim page: "10% of node reward (about 3.75 FLUX worth)" per asset, 9 assets, about 33.75 FLUX total [src: src/flux-docs/docs/fluxnodes/claim-parallel-assets.md:L10-L11 \| DOCS-ONLY] vs overview page: ten assets, about 1.35 FLUX each [src: src/flux-docs/docs/fluxnodes/what-are-fluxnodes.md:L54 \| DOCS-ONLY] | Pages disagree with each other. The rule is a flat 10% per chain of the node's coinbase payout, computed off-chain by Fusion [src: src/fluxwhitepaper/paper/sections/06-parallel-assets.tex:L186-L192 \| DOCS-ONLY]. Under PON the tier payouts are 1 / 3.5 / 9 FLUX, so 10% is 0.1 / 0.35 / 0.9 FLUX-equivalent per asset per payout. Ergo is shut down (after 2026-09-21), leaving 9 active assets. [src: src/flux-docs/docs/fluxnodes/claim-parallel-assets.md:L34 \| DOCS-ONLY] | numbers derived, pages stale |
| C10 | Website reward chart: Stratus 64.5%, Nimbus 25%, Cumulus 7%, Foundation 3.5% [src: https://runonflux.com/fluxnodes/ \| DOCS-ONLY] | Exact shares of 14 FLUX: 64.29% / 25.00% / 7.14% / 3.57% (9 / 3.5 / 1 / 0.5 of 14). [src: src/fluxd/src/main.cpp:L2892-L2895 \| VERIFIED-SOURCE] | rounding on site |

---------------------------------------------------------------------

## 1. What Flux is today

### 1.1 Positioning

- Flux (company: InFlux Technologies, formerly Zel Technologies) markets itself as a decentralized, node-operated cloud: "Build and deploy scalable applications on Flux, a global, decentralized cloud computing network". [src: https://runonflux.com/ | VERIFIED-LIVE]
- Practical meaning for a deployer: you submit a Docker-based app spec (CPU, RAM, SSD, ports, image, instances, duration), pay for it in FLUX or fiat, and independent FluxNode operators run `N` instances of it. There is no central scheduler; each node decides on its own whether to install an app (see 2.4). [src: src/flux/ZelBack/src/services/appLifecycle/appSpawner.js:L816-L910 | VERIFIED-SOURCE]
- Pricing positioning on the marketing site: "2 vCPU, 8 GB, 100 GB storage: FluxCloud $2.29/month vs AWS $79.92" and "Zero egress fees". These are marketing claims, not verified here. [src: https://runonflux.com/fluxcloud/ | DOCS-ONLY]
- Company facts from docs: InFlux Technologies (UK), founded under Zel in 2018, rebranded to InFlux in late 2022, CEO Daniel Keller; "Stratus Award for Cloud Computing" 2024. [src: src/flux-docs/docs/home/influx-technologies.md:L15-L27 | DOCS-ONLY]
- Copyright line on the live site: "Copyright 2026 InFlux Technologies". [src: https://runonflux.com/ | VERIFIED-LIVE]

### 1.2 Product pillars (status as of 2026-10-12)

| Pillar | What it is | Entry point | Status / notes |
|---|---|---|---|
| FluxCloud | Container hosting on FluxNodes. Dashboard: Register New App, App Marketplace, Games, FluxDrive, Cost Calculator, Dashboards (Overview, Resources, Map, Rewards), Flux XDAO [src: https://cloud.runonflux.com/ \| VERIFIED-LIVE (nav parsed from served HTML)] | cloud.runonflux.com | LIVE. Pays: FLUX or card/PayPal (see 1.5). |
| FluxNodes | The operator side: servers that run FluxOS and host FluxCloud apps; three tiers (Cumulus, Nimbus, Stratus). | runonflux.com/fluxnodes/, docs "FluxNodes" | LIVE, 7,105 nodes (Snapshot). |
| FluxEdge | GPU rental marketplace ("P2P compute marketplace for dedicated GPU resources", Kubernetes based) [src: https://runonflux.com/fluxedge/ \| VERIFIED-LIVE] | runonflux.com/fluxedge/, FluxEdge Console | LIVE. Roadmap says "FluxCloud + FluxEdge: merged, one account" planned for Q4 2026 [src: https://runonflux.com/timeline/ \| VERIFIED-LIVE]. |
| FluxCore | Desktop app that lets a machine rent GPU/CPU to FluxEdge [src: src/flux-docs/docs/fluxcore/overview.md:L3 \| DOCS-ONLY] | docs "FluxCore" | LIVE per docs; "native FLUX mining" claims are stale (C8). |
| FluxAI | Suite: FluxINTEL, Flux LLM Hub (OpenAI-compatible endpoint), FluxGPT, FluxONE, FluxAI API, FluxGrader, Beaver, VoiceDesk [src: https://runonflux.com/flux-ai/ \| VERIFIED-LIVE]. Roadmap: "FluxAI refocused: sellable inference, not chat" [src: https://runonflux.com/timeline/ \| VERIFIED-LIVE] | ai.runonflux.com | LIVE. Not a hosting pillar for deployers. The new FluxCloud console front end uses a FluxAI model (`fluxai:tiny` behind a gateway) as an authoring aid that drafts deployments for the user to review and sign (15.2.4); whether that is the same product as the Flux LLM Hub is UNVERIFIED. |
| Flux Orbit (Deploy with Git) | Git-to-deploy portal: paste a GitHub/GitLab/Bitbucket repo, framework auto-detect, builds, deploys on Flux. Own portal with the plans Starter, Standard, Pro and Custom; the old Free plan is closed to new apps [src: https://runonflux.com/apps/orbit, footer `v1.1.101` on 2026-10-13 \| DOCS-ONLY]. The docs quick start still says "a free tier and paid plans" (older text, superseded by 15.3.10) [src: src/flux-docs/docs/fluxcloud/register-new-app/deploy-with-git/getting-started/quick-start.md:L11 \| DOCS-ONLY]. The image `runonflux/orbit:latest` is the registration image of the managed product itself, not only a demo: 235 live apps use it (15.3.1) [src: src/flux-docs/.../quick-start.md:L35 \| DOCS-ONLY; GET /apps/globalappsspecifications 2026-10-13 \| VERIFIED-LIVE] | runonflux.com/apps/orbit (orbit.runonflux.com answers 301 to it) | LIVE. Page text: "global deployment across 7,000+ Flux nodes" [src: https://runonflux.com/apps/orbit \| VERIFIED-LIVE (via web/live/orbit.txt)]. Roadmap lists "Deploy from Git: push, build, live" under Q4 2026 platform consolidation, so UI may change. |
| FluxDrive | IPFS-backed storage with web UI and API; plans 10 GB / 50 GB / 100 GB at $0.50 / $2.50 / $5.00 per month [src: src/flux-docs/docs/fluxcloud/fluxdrive/README.md:L23-L26 \| DOCS-ONLY] | cloud.runonflux.com/flux-drive (nav item verified live) | LIVE. |
| Marketplace | One-click templates: games, blockchain nodes, productivity, front-ends; several have their own portals (minecraft, palworld, enshrouded, rust, windrose, wordpress, n8n, openclaw `.runonflux.com`) [src: src/flux-docs/docs/fluxcloud/marketplace/README.md:L11-L32 \| DOCS-ONLY] | cloud.runonflux.com/marketplace | LIVE. |
| Games | Game server hosting built on Marketplace templates; live price list starts at "from $1.99/mo" (Minecraft) up to "$12.49/mo" (FiveM) [src: https://runonflux.com/games/ \| VERIFIED-LIVE (via web/live/games_index.txt)] | runonflux.com/games, cloud.runonflux.com/marketplace/games | LIVE. The FluxCloud page brands this "FluxPlay" [src: https://runonflux.com/fluxcloud/ \| VERIFIED-LIVE]. |
| WordPress | Managed Web3 WordPress hosting, three redundant instances, first week free for new users, pay by Stripe, PayPal or FLUX [src: https://runonflux.com/apps/wordpress \| VERIFIED-LIVE (web/live/apps_wordpress.txt)], [src: src/flux-docs/docs/fluxcloud/wordpress/registration-steps.md:L27 \| DOCS-ONLY] | wordpress.runonflux.com | LIVE. |
| FluxOS | The node software (Node.js backend `ZelBack`, Vue frontend, Docker, Syncthing, MongoDB). Current backend v8.20.0 [src: https://api.github.com/repos/RunOnFlux/flux/releases/latest \| VERIFIED-LIVE]; 6,972 of 7,106 nodes report 8.20.0 [src: https://stats.runonflux.io/fluxinfo?projection=tier,benchmark,flux \| VERIFIED-LIVE] | api.runonflux.io, home.runonflux.io | LIVE. |
| ArcaneOS | Hardened node OS: Ubuntu 24 based live installer, encrypted disks, TPM 2.0 + UEFI Secure Boot, closed-source System Attestation Service; launched 2025-03-31 [src: src/flux-docs/docs/fluxnodes/arcaneos-fluxnode/README.md:L15-L22 \| DOCS-ONLY]. Latest build "jolly wombat" 1775071308, 2026-04-07 [src: https://api.github.com/repos/RunOnFlux/arcaneos-releases/releases \| VERIFIED-LIVE] | docs "ArcaneOS FluxNode" | LIVE, 6,612 of 7,106 nodes (93.0%) report an `arcaneVersion` (Snapshot). |
| Flux Gravity | See 1.3. | n/a | UI label only. |
| Flux XDAO | On-chain governance app inside the FluxCloud dashboard: "FluxNode operators can submit proposals, discuss initiatives, and vote"; proposals carry a registration fee and optional grant amount [src: src/fluxos-frontend/src/plugins/i18n/locales/en.json:L4877-L4881 \| VERIFIED-SOURCE]. Nav item `Flux XDAO -> /xdao-app` present on live site [src: https://cloud.runonflux.com/ \| VERIFIED-LIVE]. | cloud.runonflux.com/xdao-app | LIVE. No docs page exists in `src/flux-docs` (grep). Proposal mechanics UNVERIFIED. |
| Flux Foundation | Community-governed entity that "receives a fixed portion of block rewards" [src: https://runonflux.com/ \| VERIFIED-LIVE]. In code that fixed portion is the dev-fund remainder (0.5 FLUX of 14) paid to `t3hPu1YDeGUCp8m7BQCnnNUmRMJBa5RadyA`; code calls it "DevFund" [src: src/fluxd/src/chainparams.cpp:L306 \| VERIFIED-SOURCE]. Also posts price messages as a multisig [src: src/fluxwhitepaper/paper/sections/16-paying-for-capacity.tex:L55-L58 \| DOCS-ONLY]. | fluxfoundation.io (TLS connection failed from this host, so UNVERIFIED) | Roadmap: "Flux Foundation: Ecosystem funding and governance" under "Shipping now" [src: https://runonflux.com/timeline/ \| VERIFIED-LIVE]. |
| InFlux Technologies | Operating company behind Flux (UK); sells managed services and enterprise services (influxtechnologies.com/enterprise-services/) [src: https://runonflux.com/ \| VERIFIED-LIVE] | n/a | n/a |
| Wallets and extras | Zelcore (wallet), SSP Wallet, Fusion (cross-chain swap and parallel-asset claims), CumulusVPN ("135 gateways, 23 countries", live per roadmap), Flux Console ("enterprise control plane", live per roadmap) [src: https://runonflux.com/timeline/ \| VERIFIED-LIVE] | | outside deployer scope |

### 1.3 "Flux Gravity": exists, but only as a UI string

- The strings "Flux Gravity is operational and synced with the Flux network." appear in the served HTML of cloud.runonflux.com and home.runonflux.io (identical 205,151-byte pages). [src: https://cloud.runonflux.com/ | VERIFIED-LIVE]
- In the FluxOS frontend source the English locale has 18 lines with "Gravity" and zero with "FluxOS". The admin page is titled "Manage Flux Gravity", the update button says "Update Flux Gravity", and the API port tooltip says "Configure the port number for Flux Gravity API service. Default is 16127." [src: src/fluxos-frontend/src/plugins/i18n/locales/en.json:L306,L1679,L2632,L2644-L2670 | VERIFIED-SOURCE]
- Port 16127 is the FluxOS API port (FluxOS), so "Flux Gravity" in the UI refers to the node software that docs call FluxOS. [src: src/flux/ZelBack/config/default.js:L30 and src/fluxos-frontend/src/plugins/i18n/locales/en.json:L2662 | VERIFIED-SOURCE]
- It is not mentioned anywhere in `src/flux-docs`, `src/runonflux-docs`, the whitepaper, runonflux.com home, FluxCloud, FluxNodes, FluxEdge, Flux AI or timeline pages (grep). Not deprecated, not documented as a product.
- Teaching recommendation: do not present "Flux Gravity" as a product pillar. If a screenshot shows it, say "the dashboard labels the node software 'Flux Gravity'; docs call it FluxOS". Whether this is a rename in progress is UNVERIFIED.

### 1.4 Consensus: from Proof of Work to Proof of Node

#### Eras

| Era | Heights | Algorithm | Block spacing | Source |
|---|---|---|---|---|
| Genesis PoW | 0 to 125,099 | Equihash 200,9 | 120 s | [src: src/fluxd/src/chainparams.cpp:L101,L120 and src/fluxd/src/chainparams.h:L34 \| VERIFIED-SOURCE] |
| PoW epoch 2 | 125,100 to 372,499 | Equihash 144,5 | 120 s | [src: src/fluxd/src/chainparams.cpp:L120,L128 and src/fluxd/src/chainparams.h:L35 \| VERIFIED-SOURCE] |
| PoW epoch 3 ("ZelHash") | 372,500 to 2,019,999 | Equihash 125,4 (`zelHash = {125,4,52}`) | 120 s (target) | [src: src/fluxd/src/chainparams.h:L36 and src/fluxd/src/chainparams.cpp:L128,L165 \| VERIFIED-SOURCE] |
| Proof of Node (PON) | 2,020,000 onward | no hashing; sortition among confirmed FluxNodes | 30 s slots (`nPonTargetSpacing = 30`) | [src: src/fluxd/src/chainparams.cpp:L105,L153 \| VERIFIED-SOURCE] |

Other upgrade heights: Flux rebrand fork 835,554 (about 2021-04-10); node tier collateral transition 1,076,532 to 1,097,412; P2SH nodes 1,549,500. [src: src/fluxd/src/chainparams.cpp:L138,L143,L148,L308-L315 | VERIFIED-SOURCE]

Live confirmation of the switch: block 2,019,999 is `POW` version 4 at unix time 1761415068; block 2,020,000 is `PON` version 100 at unix time 1761415235 (2025-10-25 18:00:35 UTC). [src: https://api.runonflux.io/daemon/getblockheader/<hash of 2020000> | VERIFIED-LIVE] The daemon reports upgrade "PON, activationheight 2020000, status active, Proof of Node activation". [src: https://api.runonflux.io/daemon/getblockchaininfo | VERIFIED-LIVE]

Naming: fluxd README calls it "PoUW v2 (Proof of Useful Work)", "also known as PON (Proof of Nodes)". [src: src/fluxd/README.md:L9 | VERIFIED-SOURCE] The website says "PoUW v2". The whitepaper and code say Proof of Node. There is no hashing; "useful work" is branding.

#### How blocks are produced now

1. Time is cut into 30 s slots: `slot = floor((blockTime - genesisTime) / 30)`. [src: src/fluxd/src/pon/pon.cpp:L88-L93 | VERIFIED-SOURCE]
2. Every confirmed FluxNode of ANY tier computes `hash(collateralOutpoint, prevBlockHash, slot)`. If the hash is at or below the current difficulty target, the node is eligible for that slot. [src: src/fluxd/src/pon/pon.cpp:L26-L61,L63-L86 | VERIFIED-SOURCE]
3. Eligible nodes are ranked by hash (lowest first). Rank `r` waits `r * 4` seconds before building a block, and skips if another block arrived. Ranking is coordination only, not consensus; the chain accepts the first valid block. [src: src/fluxd/src/pon/pon-minter.cpp:L225-L250 | VERIFIED-SOURCE]
4. The block header carries the producer's collateral outpoint and a signature by the node key, which every other node verifies. Header version is 100. [src: src/fluxd/src/pon/pon.cpp:L223-L330 and src/fluxd/src/primitives/block.h:L31 | VERIFIED-SOURCE]
5. Difficulty retargets every block over a 30-block window, clamped to 80% to 125% of the target timespan, with a floor difficulty of about "1 in 16 per node" (`ponLimit = 0x0fff...`). [src: src/fluxd/src/pon/pon.cpp:L95-L195 and src/fluxd/src/chainparams.cpp:L103-L106 | VERIFIED-SOURCE]
6. Measured: average spacing since activation is 30.08 s (tip 3,031,426 at 2026-10-12 20:01:04 UTC; activation block at 1761415235). [src: https://api.runonflux.io/daemon/getblockheader | VERIFIED-LIVE]
7. Producing a block pays the producer nothing extra. The coinbase's first output goes to the hard-coded dev fund address (0.5 FLUX plus any transaction fees), and consensus rejects blocks that do not pay it. [src: src/fluxd/src/pon/pon-minter.cpp:L289-L299; src/fluxd/src/main.cpp:L1232-L1247; src/fluxd/src/fluxnode/fluxnode.cpp:L839-L875 | VERIFIED-SOURCE]
8. Payees are separate from producers. For each tier there is a FIFO queue of confirmed nodes; the front node of each tier receives that tier's payout and goes to the back. So each tier pays exactly one node per block, in rotation. [src: src/fluxd/src/fluxnode/fluxnode.cpp:L713-L772 and L892-L936 | VERIFIED-SOURCE]
9. Keeping a node in the queue requires an on-chain confirmation transaction: allowed after 500 blocks since last confirm and required within 640 blocks (about 4.2 h and 5.3 h at 30 s). Collateral must be 100 blocks deep. [src: src/fluxd/src/fluxnode/fluxnode.h:L20,L34,L39 | VERIFIED-SOURCE]
10. Emergency path: a block flagged with a special all-1s collateral hash can be created with 2-of-4 signatures from hard-coded keys if the network fails to produce blocks. [src: src/fluxd/src/chainparams.cpp:L244-L253 | VERIFIED-SOURCE]
11. The daemon still reports `networkhashps`/`networksolps` (about 3.67e10) in `getmininginfo`; these are legacy statistics and meaningless under PON. `ponminter: true` is the relevant flag. [src: https://api.runonflux.io/daemon/getmininginfo | VERIFIED-LIVE]

#### Block subsidy under PON

| Item | Value | Source |
|---|---|---|
| Initial subsidy | 14 FLUX per block | [src: src/fluxd/src/chainparams.cpp:L156 \| VERIFIED-SOURCE] |
| Reduction | x 0.9 once per 1,051,200 blocks (about one year), applied as integer truncation per step, at most 20 times | [src: src/fluxd/src/chainparams.cpp:L157-L158 and src/fluxd/src/main.cpp:L2799-L2816 \| VERIFIED-SOURCE] |
| Floor after 20 reductions | about 1.702 FLUX per block, forever (about 1.79M FLUX per year) | [src: src/fluxwhitepaper/paper/sections/05-monetary-policy.tex:L208-L219 \| DOCS-ONLY] (derived from the loop above) |
| First reduction height | 2,020,000 + 1,051,200 = 3,071,200, to 12.6 FLUX; at current 30.08 s spacing that is about 2026-10-26 | derived: [src: src/fluxd/src/main.cpp:L2808-L2813 \| VERIFIED-SOURCE] |
| Split of each 14 FLUX | Stratus 9.0, Nimbus 3.5, Cumulus 1.0, dev fund 0.5 (scaled with the reduced subsidy: ratios x/14) | [src: src/fluxd/src/main.cpp:L2889-L2930 \| VERIFIED-SOURCE] |
| Live check | `getblocksubsidy` returns `{"miner":14}`; block 3,031,400 coinbase pays 0.5 / 1 / 3.5 / 9 | [src: https://api.runonflux.io/daemon/getblocksubsidy \| VERIFIED-LIVE] |
| Pre-PON PoW subsidy for reference | 150 FLUX, halved at 655,350-block intervals but frozen at 37.5 FLUX (`halvings >= 2 -> >>= 2`) | [src: src/fluxd/src/main.cpp:L2845-L2848 \| VERIFIED-SOURCE] |
| Pre-PON tier shares | Cumulus 7.5%, Nimbus 12.5%, Stratus 30% of the block (V1 percentages 3.75 / 6.25 / 15 doubled after the rebrand fork) | [src: src/fluxd/src/fluxnode/fluxnode.h:L72-L74 and src/fluxd/src/main.cpp:L2926-L2938 \| VERIFIED-SOURCE] |

### 1.5 FLUX token facts that matter to a deployer

#### What you pay with, and where it goes

| Question | Answer | Source |
|---|---|---|
| Native payment | FLUX, sent in a normal transparent transaction to one hard-coded app payment address with an `OP_RETURN` carrying the hash of the app message. Payment is recognised on-chain by every node, no ledger or account. | [src: src/flux/ZelBack/src/services/explorerService.js:L325-L340 and src/fluxwhitepaper/paper/sections/16-paying-for-capacity.tex:L4-L12 \| VERIFIED-SOURCE / DOCS-ONLY] |
| Payment address | `t3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX` (a multisig P2SH address; older `t3aGJvdtd8NR6GrnqnRuVEzH6MbrXuJFLUX` and legacy `t1LUs6quf7TB2zVZmexqPQdnqmrFMGZGjV6` are also recognised) | [src: src/flux/ZelBack/config/default.js:L397-L399 \| VERIFIED-SOURCE] and [src: https://api.runonflux.io/apps/deploymentinformation \| VERIFIED-LIVE] |
| Fiat | Docs list Stripe (card) and PayPal as alternatives on the registration review step. The whitepaper describes the card path as an InFlux-operated custodial "facilitator" that signs and pays the chain on the user's behalf; the chain does not know it exists. | [src: src/flux-docs/docs/fluxcloud/register-new-app/deploy-with-docker/review.md:L50-L51 \| DOCS-ONLY]; [src: src/fluxwhitepaper/paper/sections/16-paying-for-capacity.tex:L4-L22 \| DOCS-ONLY] |
| FLUX discount | Prices are USD-denominated; paying in FLUX applies `fluxmultiplier` 0.95 (5% off). Minimum price `minUSDPrice` 0.99 USD. | [src: https://stats.runonflux.io/apps/getappspecsusdprice \| VERIFIED-LIVE]; [src: src/flux-docs/docs/fluxcloud/cost-calculator.md:L21-L36 \| DOCS-ONLY] |
| Is the payment burned? | No. Today nothing is burned at protocol level and there is no consensus split. Everything lands at one transparent multisig (P2SH) address by policy; the whitepaper calls this a centralization surface and does not say who spends from it (UNVERIFIED). | [src: src/fluxwhitepaper/paper/sections/07-pnr.tex:L4-L9 and 16-paying-for-capacity.tex:L178-L186 \| DOCS-ONLY]; grep for burn/split logic over src/fluxd/src and src/flux/ZelBack/src found none [src: src/fluxd/src, src/flux/ZelBack/src \| VERIFIED-SOURCE] |
| Are nodes paid from it? | No, not by the protocol. Node operators are paid only from newly issued block subsidy (1 / 3.5 / 9 FLUX per block, section 1.4). | [src: src/fluxd/src/fluxnode/fluxnode.cpp:L892-L936 \| VERIFIED-SOURCE] |
| What changes next | Roadmap H1 2027: "PNR v2: App fees burn + pay operators"; H2 2027: "Parallel-mining retirement, only after PNR v2 pays". The whitepaper models PNR activation at height 3,787,502 (about 2027-07-01) with a consensus-enforced split. All PLANNED. | [src: https://runonflux.com/timeline/ \| VERIFIED-LIVE]; [src: src/fluxwhitepaper/paper/sections/07-pnr.tex:L1418-L1440 \| DOCS-ONLY] |
| Refunds | Whitepaper found no code path that returns FLUX or fiat to a user once paid; the site promises a 30-day money-back guarantee handled by support ticket. | [src: src/fluxwhitepaper/paper/sections/16-paying-for-capacity.tex:L639-L643 \| DOCS-ONLY]; [src: https://runonflux.com/fluxcloud/ \| DOCS-ONLY] |

#### Supply

| Fact | Value | Source |
|---|---|---|
| Premine / one-offs | 13,020,000 at height 1; exchange fund 7,500,000 (height 836,274); foundation fund 2,500,000 (height 836,994); swap pool 10 tranches of 22,000,000 every 21,600 blocks from 837,714 | [src: src/fluxd/src/main.cpp:L2820-L2822 and src/fluxd/src/chainparams.cpp:L294-L304 \| VERIFIED-SOURCE] |
| Issued transparent supply now | 431,040,155 FLUX (`total_amount`), plus shielded pools sprout 19,291 and sapling 77,189, so about 431.14M total | [src: https://api.runonflux.io/daemon/gettxoutsetinfo and /daemon/getblockchaininfo \| VERIFIED-LIVE] |
| Hard cap | None in consensus (see C3). Emission today: 14 x 2,880 blocks/day = 40,320 FLUX/day, 14.72M in PON year 1, then x0.9 per year to a floor of about 1.79M/year. | [src: src/fluxd/src/main.cpp:L2799-L2816 \| VERIFIED-SOURCE] |
| Whitepaper projection | Cumulative supply crosses 440M at about height 3,730,295 (about 2027-06-11); about 548M at the start of the flat tail (about 2046) | [src: src/fluxwhitepaper/paper/sections/05-monetary-policy.tex:L226-L246 \| DOCS-ONLY] |

#### FLUX on other chains ("parallel assets" / wrapped FLUX)

- FLUX tokens exist on Ethereum (ERC-20), BNB Chain (BEP-20), Polygon, Avalanche C-Chain, Base, Solana (SPL), Algorand (ASA), Tron (TRC-20), Kadena (`runonflux.flux`); Ergo was shut down after 2026-09-21. Contract addresses are listed in the docs claim page; they match the whitepaper inventory but were not checked on-chain here. [src: src/flux-docs/docs/fluxnodes/claim-parallel-assets.md:L22-L32 | DOCS-ONLY]
- These are custodial: Fusion (operated by the team) holds one hot key per chain; swaps and claims are team-mediated. The whitepaper plans a mint-and-burn bridge (roadmap Q4 2026, "Audited, proof of reserve"). [src: src/fluxwhitepaper/paper/sections/06-parallel-assets.tex:L143-L200 | DOCS-ONLY]; [src: https://runonflux.com/timeline/ | VERIFIED-LIVE]
- "Parallel assets claim" means: node operators accrue 10% of their payout value per active chain, claimed manually in Zelcore's Fusion app ("Parallel Mining Claim"); claims cost a network fee. Not relevant to paying for hosting. [src: src/flux-docs/docs/fluxnodes/claim-parallel-assets.md:L8-L13 | DOCS-ONLY]
- Deployers pay in native FLUX (or fiat); wrapped FLUX cannot pay for an app registration directly. Inference from the payment detection code, which only reads outputs to the Flux main-chain sink address. [src: src/flux/ZelBack/src/services/explorerService.js:L325-L340 | VERIFIED-SOURCE]

### Snapshot 2026-10-12 (part 1)

| Value | Number | Fetch URL |
|---|---|---|
| Chain height (tip) | 3,031,425 to 3,031,426 | https://api.runonflux.io/daemon/getblockcount |
| Tip block time | 2026-10-12 20:01:04 UTC, type PON, version 100 | https://api.runonflux.io/daemon/getbestblockhash then /daemon/getblockheader/<hash> |
| Average block spacing since PON | 30.08 s | derived from getblockheader of heights 2,020,000 and tip |
| Current block subsidy | 14 FLUX (12.6 FLUX from height 3,071,200, about 2026-10-26) | https://api.runonflux.io/daemon/getblocksubsidy |
| Protocol version / daemon | 170021 / 9010050 (v9.1.0 line) | https://api.runonflux.io/daemon/getinfo |
| Transparent supply | 431,040,155 FLUX | https://api.runonflux.io/daemon/gettxoutsetinfo |
| Shielded pools | sprout 19,291; sapling 77,189 | https://api.runonflux.io/daemon/getblockchaininfo |
| Node count (total) | 7,105 | https://api.runonflux.io/daemon/getfluxnodecount |
| Countries / org strings | 56 / 358 (node IP geolocation) | https://stats.runonflux.io/fluxlocationsnow |
| Nodes flagged `dataCenter` by ip-api | 3,238 of 7,105 | https://stats.runonflux.io/fluxlocationsnow |
| FluxOS version on nodes | 8.20.0 on 6,972 nodes; 127 nodes report no data | https://stats.runonflux.io/fluxinfo?projection=tier,benchmark,flux |
| Next PON reduction | block 3,071,200 | derived from consensus constants |

---------------------------------------------------------------------

## 2. Node tiers

### 2.1 Tier definitions (stable)

API names: the daemon counts use `basic / super / bamf` (also aliased `cumulus / nimbus / stratus`); FluxOS app specs use `basic / super / bamf` suffixes (`cpubasic`, `ramsuper`, `hddbamf`); tier display names are Cumulus, Nimbus, Stratus. [src: https://api.runonflux.io/daemon/getfluxnodecount | VERIFIED-LIVE]; [src: src/flux/ZelBack/src/services/generalService.js:L77-L91 | VERIFIED-SOURCE]

| Tier | API / spec name | Collateral now (V2) | Legacy V1 collateral (no longer accepted by consensus after transition) | PON payout per block | Share of 14 FLUX |
|---|---|---|---|---|---|
| Cumulus | basic (spec fields `cpubasic`, `rambasic`, `hddbasic`) | 1,000 FLUX | 10,000 | 1.0 FLUX | 7.14% |
| Nimbus | super (`cpusuper`, ...) | 12,500 FLUX | 25,000 | 3.5 FLUX | 25.00% |
| Stratus | bamf (`cpubamf`, ...) | 40,000 FLUX | 100,000 | 9.0 FLUX | 64.29% |
| (dev fund) | n/a | n/a | n/a | 0.5 FLUX | 3.57% |

- Collateral constants: [src: src/fluxd/src/fluxnode/fluxnode.h:L57-L62 | VERIFIED-SOURCE]. Transition windows ended at heights 1,086,612 (Cumulus), 1,092,372 (Nimbus), 1,097,412 (Stratus); since then only V2 amounts are valid. [src: src/fluxd/src/chainparams.cpp:L308-L315 and src/fluxd/src/coins.cpp:L774-L809 | VERIFIED-SOURCE]
- FluxOS derives the tier from the collateral output value and still recognises the old amounts: 1000 or 10000 is basic, 12500 or 25000 is super, 40000 or 100000 is bamf. [src: src/flux/ZelBack/src/services/generalService.js:L77-L91 | VERIFIED-SOURCE]
- All three tiers confirm the same way (100 blocks of collateral depth). Rewards are paid per tier queue: each tier pays exactly one node per block, so a tier with more nodes means a longer wait per node while the tier's per-block total stays fixed. [src: src/fluxd/src/fluxnode/fluxnode.h:L20 | VERIFIED-SOURCE]
- The tier ratios are chosen so that two Nimbus earn less than one Stratus, three more. [src: src/fluxwhitepaper/paper/sections/05-monetary-policy.tex:L100-L108 | DOCS-ONLY]

### 2.2 Minimum hardware (what benchmark must show)

The benchmark daemon (`fluxbenchd`) is closed source; its repo is not public (404 under github.com/RunOnFlux for fluxbench, fluxbenchmark, fluxbenchd). Thresholds below come from the whitepaper, which cites `fluxbench/src/fluxnode/benchmarks.h:58-84`, and are cross-checked against FluxOS config and live node data.

| Tier | Cores / threads | RAM (min) | Storage | EPS (sysbench events/s) | Disk write | Up / down bandwidth | Source |
|---|---|---|---|---|---|---|---|
| Cumulus | 2 / 4 | 7 GB (3 GB on Jetson boards) | 220 GB | 240 | 180 MB/s | 25 / 25 Mbit/s | [src: src/fluxwhitepaper/paper/sections/04-consensus.tex:L420-L434 \| DOCS-ONLY] |
| Nimbus | 4 / 8 | 30 GB | 440 GB | 640 | 180 MB/s | 50 / 50 Mbit/s | same; site confirms Nimbus "4 V-CORES, 8 THREADS, 32GB RAM, 440 GB SSD, 180 MB/S DWS, 640 EPS, 50 MBIT" [src: https://runonflux.com/fluxnodes/ \| VERIFIED-LIVE] |
| Stratus | 8 / 16 | 61 GB | 880 GB | 1,520 | 400 MB/s | 100 / 100 Mbit/s | same |

- Measured bandwidth gets an additive tolerance of +2 / +4 / +9 Mbit/s before the threshold test. [src: src/fluxwhitepaper/paper/sections/04-consensus.tex:L435-L438 | DOCS-ONLY]
- FluxOS nominal tier sizes (what the app validator and docs build on): CPU 4 / 8 / 16 threads (`cpu: 40 / 80 / 160` in tenths of a core), RAM 7000 / 30000 / 61000 MB, SSD 220 / 440 / 880 GB. [src: src/flux/ZelBack/config/default.js:L654-L669 | VERIFIED-SOURCE]
- Docs (VM sizing guidance): 220 / 440 / 880 GB disk, 2C4T / 4C8T / 8C16T, 8 / 32 / 64 GB RAM, public IP required, about 97% uptime, UEFI + TPM 2.0 for ArcaneOS. [src: src/flux-docs/docs/fluxnodes/arcaneos-fluxnode/step-by-step-guide/1.-create-a-virtual-machine.md:L8,L24-L27 and src/flux-docs/docs/fluxnodes/what-are-fluxnodes.md:L31-L33 | DOCS-ONLY]
- Live fleet agrees with the thresholds. Benchmark `cores` field counts threads. Median / 10th percentile: Cumulus 4 / 4 threads, 7.7 / 7 GB RAM, 220 GB SSD; Nimbus 8 / 8, 31 / 30, 440; Stratus 16 / 16, 62 / 61, 880. [src: https://stats.runonflux.io/fluxinfo?projection=tier,benchmark,flux | VERIFIED-LIVE]
- Only one FluxNode per VPS is allowed. [src: src/flux-docs/docs/fluxnodes/legacy-fluxnode/step-by-step-guide/step-2-choose-your-hosting-setup/README.md:L32 | DOCS-ONLY]
- The whitepaper notes the benchmark signature does not cryptographically bind hardware to tier ("benchmark-gating bypass, not tier forgery"); collateral alone fixes tier. Nodes can therefore exceed their tier; some do. [src: src/fluxwhitepaper/paper/sections/04-consensus.tex:L450-L469 | DOCS-ONLY]

### 2.3 What a deployer actually gets from a node

Locked system reservation (taken off every node before apps): 1 core, 2,000 MB RAM, 60 GB SSD, plus 20 GB extra SSD margin. App disk budget is `0.95 x total SSD - 60 - 20`. [src: src/flux/ZelBack/config/default.js:L648-L653 and src/flux/ZelBack/src/services/appRequirements/hwRequirements.js:L481 | VERIFIED-SOURCE]

| Tier (nominal node) | Usable CPU for apps | Usable RAM for apps | Usable SSD for apps (runtime formula) | Per-app validator ceiling (`tiered` field per tier, spec v1-v7) CPU / RAM / SSD |
|---|---|---|---|---|
| Cumulus (4 threads, 7000 MB, 220 GB) | 3.0 cores | 5,000 MB | 0.95 x 220 - 80 = 129 GB | 3.0 / 5,000 MB / 160 GB |
| Nimbus (8, 30000, 440) | 7.0 cores | 28,000 MB | 0.95 x 440 - 80 = 338 GB | 7.0 / 28,000 MB / 380 GB |
| Stratus (16, 61000, 880) | 15.0 cores | 59,000 MB | 0.95 x 880 - 80 = 756 GB | 15.0 / 59,000 MB / 820 GB |

- Ceiling derivation: validator rejects `cpu*10 > fluxSpecifics.cpu.<tier> - 10`, `ram > fluxSpecifics.ram.<tier> - 2000`, `hdd > fluxSpecifics.hdd.<tier> - 60`. [src: src/flux/ZelBack/src/services/appRequirements/appValidator.js:L1090-L1131 | VERIFIED-SOURCE] Same checks exist in `hwRequirements.js:L328-L374`. [VERIFIED-SOURCE]
- Config comments claim "180 / 400 / 840 GB available for apps"; the arithmetic in the validator gives 160 / 380 / 820 GB and the runtime formula gives 129 / 338 / 756 GB. Source wins: a spec can validate at 160 GB for Cumulus and still be unplaceable on a 220 GB node. [src: src/flux/ZelBack/config/default.js:L654-L669 vs L648-L653 | VERIFIED-SOURCE]
- Absolute ceiling for any app spec (all components summed, not per tier): 15.0 cores, 59,000 MB RAM, 820 GB SSD, i.e. Stratus size. [src: src/flux/ZelBack/src/services/appRequirements/appValidator.js:L1139-L1178 | VERIFIED-SOURCE]
- Per-component minimums and steps (CORRECTED 2026-10-13, settles the 3.3 versus 2.3 conflict): the rule "CPU in 0.1 steps (min 0.1), RAM in multiples of 100 MB (min 100), SSD in whole GB (min 1)" lives in `checkHWParameters` (appValidator.js:L1090-L1100), and `verifyObjectKeysCorrectness`/`verifyAppSpecifications` call it only for spec versions 1 to 3 (appValidator.js:L1385-L1391). Specs of version 4 and later, which is every spec you can register today, go through `checkComposeHWParameters`, which only compares the SUM over components with the ceiling above, plus a check of at most 8 decimals and a numeric type. So the validator enforces no per-component minimum and no step for v8. The 0.1 core / 100 MB / 1 GB minimums and steps are the FluxCloud form's sliders (9.4.3). Live: a v8 spec with `cpu` 0.15, `ram` 150 and `hdd` 5.5 was accepted by `/apps/verifyappregistrationspecifications` (and so was `cpu` 0), and the formatted spec came back unchanged. Do not teach the fractional values as good practice, only as "the form steps in 0.1 core, 100 MB and 1 GB". [src: appValidator.js:L457-L465,L1090-L1100,L1139-L1180,L1385-L1391 ; POST https://api.runonflux.io/apps/verifyappregistrationspecifications, read-only, 2026-10-13 | VERIFIED-SOURCE and VERIFIED-LIVE]
- Two different RAM numbers for a nominal Cumulus node (settles 11 row 26 "under 6 GB" versus 5,000 MB): 5,000 MB is what a nominal Cumulus node (7,000 MB, minus the 2,000 MB lock) has free for apps, so an app over 5,000 MB cannot land on a nominal Cumulus node. 6,000 MB (with 3 cores and 150 GB) is only the threshold below which a Nimbus or Stratus node counts the app as "small" and waits 57 to 117 minutes before taking it (2.4). The first is capacity, the second is a deferral rule; an app of 5,500 MB fits no nominal Cumulus node but is still deferred by bigger nodes. Real nodes often exceed their tier (median Cumulus 7.7 GB), so say "most Cumulus nodes". [src: ZelBack/config/default.js:L648-L669 ; appSpawner.js:L865-L905 | VERIFIED-SOURCE]
- Runtime usable disk, confirmed 2026-10-13 (the `usableHddGb` 129 / 338 / 756 in shared/flux): the spawner's capacity check is `useableSpaceOnNode = totalSpaceOnNode * 0.95 - lockedSystemResources.hdd (60) - lockedSystemResources.extrahdd (20)`, then it subtracts the `hdd` already locked by installed apps, and refuses with "Insufficient space on Flux Node" when the app's total `hdd` is larger than what is left. `totalSpaceOnNode` is the node's OWN benchmark `ssd` figure (`getNodeSpecs()`), not the tier's nominal number. Plugging in the nominal 220 / 440 / 880 GB gives 0.95 x 220 - 80 = 129.0, 0.95 x 440 - 80 = 338.0 and 0.95 x 880 - 80 = 756.0. So 129 / 338 / 756 are NOMINAL-tier results (what a node of exactly the nominal size offers, with nothing installed yet); the validator ceilings 160 / 380 / 820 are a different, larger set of numbers that only the registration check uses. What real nodes report (stats `/fluxinfo` benchmark `ssd`, 2026-10-13, 7,078 rows): Cumulus median 220 GB (10th percentile 220, 90th percentile 250, maximum 12,000), which is about 129 GB usable at the median and 158 GB at the 90th percentile; Nimbus median 440 GB (338 GB usable); Stratus median 880 GB (756 GB usable, maximum 6,896 GB). 98 percent of Cumulus nodes report 7 GB of RAM or more (median 7.7 GB, so about 5,700 MB free after the 2,000 MB lock) and 98 percent report 220 GB or more of SSD. So "about 129 GB in practice on a Cumulus node" is exactly right as the typical case; it is a median, not a guarantee, and a node already full of apps offers less. [src: ZelBack/src/services/appRequirements/hwRequirements.js:L481-L485 ; config/default.js:L648-L653 ; GET https://stats.runonflux.io/fluxinfo?projection=...,benchmark | VERIFIED-SOURCE and VERIFIED-LIVE 2026-10-13]
- Placement uses real node specs, not nominal ones: CPU = `os.cpus().length` threads, RAM = `os.totalmem()`, SSD = benchmark `ssd`. An app fits if it is within the node's remaining unlocked capacity after already-installed apps. [src: src/flux/ZelBack/src/services/appRequirements/hwRequirements.js:L23-L53,L466-L513 | VERIFIED-SOURCE]
- Enterprise-node extra rule: an enterprise node refuses an app if it would leave 4 or fewer free vCores (burst headroom). [src: src/flux/ZelBack/src/services/appRequirements/hwRequirements.js:L519-L535 and src/flux/ZelBack/src/services/appLifecycle/appSpawner.js:L616-L617 | VERIFIED-SOURCE]
- CPU burst: enterprise app owners on cgroups-v2 hosts can burst up to 2x their base CPU, bounded by host cores minus 1. [src: src/flux/ZelBack/config/default.js:L724-L735 | VERIFIED-SOURCE]
- Fleet reality (not a guarantee): median Stratus node reports 16 threads / 62 GB / 880 GB, but a few have far more (max 32 threads, 6.9 TB). [src: https://stats.runonflux.io/fluxinfo?projection=tier,benchmark,flux | VERIFIED-LIVE]

### 2.4 How instances land on tiers

- There is no central scheduler. Each node, on its own timer, reads the global app list, picks apps with fewer running instances than requested and tries to install if it passes the requirement checks. [src: src/flux/ZelBack/src/services/appLifecycle/appSpawner.js:L122-L500 | VERIFIED-SOURCE]
- The tier a node belongs to is its collateral tier (section 2.1). [src: src/flux/ZelBack/src/services/generalService.js:L53-L93 | VERIFIED-SOURCE]
- `tiered: true` (spec versions 1 to 7 only) lets a spec give separate `cpubasic/rambasic/hddbasic`, `cpusuper/...`, `cpubamf/...`; a node of that tier applies its tier's numbers (falling back to the base `cpu/ram/hdd` if absent). For compose apps the per-component values are summed. [src: src/flux/ZelBack/src/services/appRequirements/hwRequirements.js:L76-L111 | VERIFIED-SOURCE]
- Spec v8 (the current `latestAppSpecification`) removed the tiered fields entirely: v8 components accept only `cpu`, `ram`, `hdd`. Every instance gets the same resources on every tier. [src: src/flux/ZelBack/config/default.js:L510 and src/flux/ZelBack/src/services/appRequirements/appValidator.js:L1045-L1056 | VERIFIED-SOURCE] Do not teach `tiered` as a normal current option.
- Price scales with resources, not with tier; the small / medium discount thresholds in the cost calculator (under 3 cores, 6 GB, 150 GB; under 7 cores, 29 GB, 370 GB) equal the spawner's "Cumulus-sized" and "Nimbus-sized" cut-offs. [src: src/flux-docs/docs/fluxcloud/cost-calculator.md:L31-L32 | DOCS-ONLY]; [src: src/flux/ZelBack/src/services/appLifecycle/appSpawner.js:L865,L879,L893 | VERIFIED-SOURCE]
- Soft tier preference, implemented as install delays so that small apps tend to land on small nodes (when `nodes` is empty, i.e. not pinned):

| Node tier | App size (CPU / RAM / SSD) | Standard delay before the node tries again | Enterprise delay | Config key |
|---|---|---|---|---|
| Stratus | under 3 cores, 6,000 MB, 150 GB | 117 min (7,020,000 ms) | 30 min | `capacityGap.largeMs` |
| Stratus | under 7 cores, 29,000 MB, 370 GB | 87 min (5,220,000 ms) | 21 min | `capacityGap.mediumMs` |
| Nimbus | under 3 cores, 6,000 MB, 150 GB | 57 min (3,420,000 ms) | 12 min | `capacityGap.smallMs` |

  [src: src/flux/ZelBack/config/default.js:L607-L614 and src/flux/ZelBack/src/services/appLifecycle/appSpawner.js:L865-L910 | VERIFIED-SOURCE] The same file adds delays on static-IP nodes (57 min) and data-center nodes (57 min) for apps that do not need them (L607-L609), and a 2 minute delay on ArcaneOS nodes for non-enterprise apps (`nonEnterpriseSpawnDelayMs: 120000`, L569, spawner L821-L831). [VERIFIED-SOURCE]
- Practical reading: a tiny app is first picked up by Cumulus nodes (no delay); if it is still short of instances an hour later, Nimbus joins; after about two hours Stratus joins. A big app (over 7 cores or 29 GB) can only be placed on nodes with enough real capacity, which in practice means Stratus. This is node-side logic, not a guarantee.
- Placement also respects geolocation, `nodes` pinning (enterprise owners only), `staticip` and `datacenter` flags and a fault-domain feasibility check. [src: src/flux/ZelBack/src/services/appRequirements/hwRequirements.js:L119-L320 and src/flux/ZelBack/src/services/appPlacement/placementFeasibility.js:L1-L25 | VERIFIED-SOURCE] (details belong to the deploy-spec fragment)
- Existing apps are removed from a node if cumulative app resources exceed capacity; oldest apps (by block height) win. [src: src/flux/ZelBack/src/services/appLifecycle/hardwareValidationService.js:L81-L110 | VERIFIED-SOURCE]

### 2.5 Enterprise nodes and enterprise apps

Two different "enterprise" lists exist; do not conflate them.

1. Policy list (what the spawner uses today): `enterprisenodes.json` in the `fluxos-network-policy` repo maps a node public key to the app-owner addresses allowed to install on it. Every FluxOS node refetches it every 6 hours. At the clone date it lists 2 node public keys with 2 and 1 owner addresses. A node is an "enterprise node" iff its own pubkey is in the map. [src: src/fluxos-network-policy/enterprisenodes.json and src/fluxos-network-policy/README.md:L18,L79-L83 | VERIFIED-SOURCE]; [src: src/flux/ZelBack/src/services/utils/enterpriseNetwork.js:L28-L29,L57-L70 | VERIFIED-SOURCE]
2. Priority-node picker (UI helper for v7 apps with `nodes[]`): a score per node = collateral points (Cumulus 2, Nimbus 15, Stratus 30) + maturity (up to 500 for collateral older than one year) + same-pubkey collateral (up to 200 FLUX-thousand x 2.5 = 500) + 2,000 for pubkeys in `config.enterprisePublicKeys` (16 whitelisted keys), reduced 25% per enterprise app already pinned to the node; IPv4 only. [src: src/flux/ZelBack/src/services/enterpriseNodesService.js:L13-L118 and src/flux/ZelBack/config/default.js:L706-L722 | VERIFIED-SOURCE]

Requirements stated or enforced:

| Requirement | Detail | Source |
|---|---|---|
| ArcaneOS | Decrypting enterprise (v8+) app specs throws "can only be validated on a node running Arcane OS" on non-Arcane nodes. `isArcane` = env `FLUXOS_PATH` set. | [src: src/flux/ZelBack/src/services/utils/enterpriseHelper.js:L7,L20-L23 \| VERIFIED-SOURCE] |
| amd64 only | Enterprise v8 apps must support all `enterpriseRequiredArchitectures` on every component because "Arcane nodes are amd64-only". 7 arm64 nodes exist, none on Arcane. | [src: src/flux/ZelBack/src/services/appRequirements/appValidator.js:L1450-L1463 \| VERIFIED-SOURCE]; [src: https://stats.runonflux.io/fluxinfo?projection=tier,benchmark,flux \| VERIFIED-LIVE] |
| Owner allow-list | Pinning an app to specific nodes, and the `datacenter` flag, are only allowed for owners that appear in the enterprise owners union. | [src: src/flux/ZelBack/src/services/appRequirements/appValidator.js:L1302-L1362 \| VERIFIED-SOURCE] |
| Burst headroom | More than 4 free vCores must remain after install. | see 2.3 |
| Trust points | KYC'd or publicly known operators get the 2,000 point bonus (config comment: "Most trusted node operators that are publicly known, kyc. Eg Flux team members, Titan."). | [src: src/flux/ZelBack/config/default.js:L706 \| VERIFIED-SOURCE] |
| Tier | Docs say Stratus only; not enforced in code read (C7). | |
| Price | Scoped / enterprise deployments add a fixed fee (4 USD in the cost calculator). | [src: src/flux-docs/docs/fluxcloud/cost-calculator.md:L25 \| DOCS-ONLY] |

### 2.6 ArcaneOS vs legacy nodes

| Aspect | Legacy FluxNode | ArcaneOS node | Source |
|---|---|---|---|
| Install | Manual on Ubuntu 22.04+ (Multitoolbox script), operator is root | Live ISO installer on Ubuntu 24 base, UEFI + TPM 2.0 + Secure Boot (Flux platform key enrolled), encrypted disk partitions, auto-updates; operator has no root on app data | [src: src/flux-docs/docs/fluxnodes/arcaneos-fluxnode/README.md:L15-L51 \| DOCS-ONLY] |
| Integrity | None beyond FluxOS checks | Closed-source System Attestation Service (file attestation, hardware-bound encryption, memory protection) | same |
| Enterprise (v8) apps | Cannot host or decrypt | Required | [src: src/flux/ZelBack/src/services/utils/enterpriseHelper.js:L20-L23 \| VERIFIED-SOURCE] |
| Architecture | amd64 and arm64 (Pi, Jetson) | amd64 only | [src: src/flux/ZelBack/src/services/appRequirements/appValidator.js:L1450-L1463 \| VERIFIED-SOURCE] |
| Block and parallel rewards | Same | Same | [src: src/fluxd/src/fluxnode/fluxnode.cpp:L892-L936 \| VERIFIED-SOURCE] |
| "Progressive Node Rewards" (80% / 20% app revenue) | Docs: not eligible | Docs: only eligible | PLANNED, not implemented (C2) |
| Spawn timing | Takes non-enterprise apps immediately | 2 minute delay for non-enterprise apps on non-enterprise Arcane nodes | [src: src/flux/ZelBack/src/services/appLifecycle/appSpawner.js:L821-L831 \| VERIFIED-SOURCE] |
| Fleet share | 367 nodes report a FluxOS version without `arcaneVersion` | 6,612 nodes report `arcaneVersion` 1775071308 ("jolly wombat") | [src: https://stats.runonflux.io/fluxinfo?projection=tier,benchmark,flux \| VERIFIED-LIVE] |

### 2.7 Titan staking and managed nodes (one-liners)

- Titan: stake 50 to 100,000 FLUX per stake (max 400,000 per FluxID) at titan.runonflux.io; InFlux runs the node on partner enterprise hardware (docs name Lumen and OVH); lockups 3 / 6 / 12 months; native FLUX only (no parallel assets); payouts twice a week; collateral sent to a multisig address; non-custodial in docs wording. [src: src/flux-docs/docs/fluxnodes/titan-node-staking.md:L3-L18,L57 | DOCS-ONLY] Titan nodes count toward enterprise trust (config comment). Not relevant to hosting an app.
- Managed FluxNode service: third-party providers host a node for the operator who keeps the collateral in their own wallet; providers are community-curated, not endorsed; fees can exceed rewards on low tiers. [src: src/flux-docs/docs/fluxnodes/managed-fluxnode-service.md:L1-L40 | DOCS-ONLY]
- Neither changes how apps are placed or priced.

### 2.8 Reward estimates (derived, not published)

Derived from consensus constants and the live node counts; excludes parallel assets, assumes constant node counts and the unreduced 14 FLUX subsidy (it drops 10% at height 3,071,200). 2,880 blocks per day, 1,051,200 per year.

| Tier | Nodes | Payout per block | Expected FLUX per node per year | Yield on collateral | Mean interval between payouts |
|---|---|---|---|---|---|
| Cumulus | 3,585 | 1.0 | 293 | 29.3% | 1.24 days |
| Nimbus | 1,691 | 3.5 | 2,176 | 17.4% | 0.59 days |
| Stratus | 1,829 | 9.0 | 5,173 | 12.9% | 0.64 days |

[src: derived from src/fluxd/src/main.cpp:L2889-L2930 and https://api.runonflux.io/daemon/getfluxnodecount | VERIFIED-SOURCE + VERIFIED-LIVE]. The whitepaper publishes the same model with 2026-09-03 counts (Cumulus 317.9, Nimbus 2,236.2, Stratus 5,707.7 FLUX per node for calendar 2026). [src: src/fluxwhitepaper/paper/data/tier_income.dat:L13 | DOCS-ONLY] Official calculator: https://home.runonflux.io/dashboard/rewards (not fetched; UNVERIFIED).

### Snapshot 2026-10-12 (part 2)

| Value | Number | Fetch URL |
|---|---|---|
| Nodes total / stable | 7,105 / 7,105 | https://api.runonflux.io/daemon/getfluxnodecount |
| Cumulus (basic) | 3,585 | same (`basic-enabled`, `cumulus-enabled`) |
| Nimbus (super) | 1,691 | same (`super-enabled`, `nimbus-enabled`) |
| Stratus (bamf) | 1,829 | same (`bamf-enabled`, `stratus-enabled`) |
| `ipv4` field | 2,516 (meaning unclear; whitepaper saw 2,322 on 2026-09-03) | same |
| Locked collateral (derived) | 97,882,500 FLUX (3,585 x 1,000 + 1,691 x 12,500 + 1,829 x 40,000) | derived |
| ArcaneOS / legacy / no data | 6,612 / 367 / 127 (of 7,106 records) | https://stats.runonflux.io/fluxinfo?projection=tier,benchmark,flux |
| ArcaneOS by tier | Cumulus 3,270; Nimbus 1,586; Stratus 1,756 | same |
| Legacy (FluxOS but no Arcane) by tier | Cumulus 227; Nimbus 70; Stratus 70 | same |
| `staticIp` true by tier | Cumulus 592; Nimbus 256; Stratus 1,301 | same |
| arm64 nodes | 7 | same |
| Latest ArcaneOS build | 1775071308 "jolly wombat", 2026-04-07 | https://api.github.com/repos/RunOnFlux/arcaneos-releases/releases |
| Latest FluxOS / fluxd release | v8.20.0 (2026-09-25) / v9.1.0 (2026-05-19) | https://api.github.com/repos/RunOnFlux/flux/releases/latest ; .../fluxd/releases/latest |
| Enterprise node pubkeys in policy | 2 (at repo HEAD 2026-10-04) | https://github.com/RunOnFlux/fluxos-network-policy (enterprisenodes.json) |
| Live minimum instances | 3 (endpoint) vs 1 for v8 (source) | https://api.runonflux.io/apps/deploymentinformation |

---------------------------------------------------------------------

### 2.9 What could not be verified (sections 1 and 2)

- fluxbench source (benchmark thresholds): repo is not public; thresholds are whitepaper citations plus consistency with FluxOS config and live nodes. Only the Nimbus row is also on the live website (the other tier tabs render client-side).
- fluxfoundation.io: TLS handshake fails from this host; Foundation facts come from runonflux.com and whitepaper.
- Flux XDAO proposal mechanics, fees and quorum: UI strings only, no docs page and no backend in the cloned repos.
- "Flux Gravity" intent (rename or branding experiment): no explanation found anywhere.
- Parallel-asset contract addresses on-chain, and the exact reward rate per asset: not checked on those chains.
- home.runonflux.io/dashboard/rewards calculator: not fetched.
- Docs claim "all enterprise nodes must be Stratus": enforced policy list contents are only two pubkeys with no tier data in the file.
- Titan and managed-service payout numbers: docs only.
- Future items (PNR v2, supply proposal, FluxCloud + FluxEdge merge, mint-and-burn bridge, spec v9): all roadmap statements, none shipped.

## 3. The application specification

Paths below are relative to the FluxOS clone (RunOnFlux/flux, v8.20.0, commit 3ca1ab9, 2026-09-25) unless stated. "Validator" means `ZelBack/src/services/appRequirements/appValidator.js`.

### 3.1 Versions

- The current and only version new apps may use is **v8**. `latestSupportedSpecVersion: 8`, and an update that changes version must target 8. [src: ZelBack/config/default.js:134 ; ZelBack/src/services/appRequirements/appValidator.js:1614-1622 | VERIFIED-SOURCE]
- Live check: `GET https://api.runonflux.io/apps/latestspecificationversion` returns `8`. [src: https://api.runonflux.io/apps/latestspecificationversion fetched 2026-10-12 | VERIFIED-LIVE]
- v8 became enforceable at block 1,932,380 (the comment in config says "around June 23th", 2025). [src: ZelBack/config/default.js:387 | VERIFIED-SOURCE]
- Versions 1 to 8 are all still accepted by the validator for replay; only v8 is accepted for an update that changes version. Of 2078 apps in the global list: 1777 are v8, 198 v7, 61 v6, 27 v3, 11 v4, 2 v5, 2 v2. [src: https://api.runonflux.io/apps/globalappsspecifications fetched 2026-10-12 | VERIFIED-LIVE]

| Version | Enforced from block | What it added | Source |
|---|---|---|---|
| 1 | 0 | single container; `port`, `containerPort`; deprecated, cannot be registered | ZelBack/config/default.js:380-381 |
| 2 | 0 | `ports[]`, `containerPorts[]`, `domains[]` | ZelBack/config/default.js:381 |
| 3 | 983000 | `instances` | ZelBack/config/default.js:382 |
| 4 | 1004000 | `compose[]` (multi component) | ZelBack/config/default.js:383 |
| 5 | 1142000 | `contacts[]`, `geolocation[]` | ZelBack/config/default.js:384 |
| 6 | 1300000 | `expire` | ZelBack/config/default.js:385 |
| 7 | 1420000 | `nodes[]`, `staticip`, component `secrets`, `repoauth` | ZelBack/config/default.js:386 |
| 8 | 1932380 | `enterprise` (encrypted contacts+compose), `datacenter`, hyphens in app names, 63 char names, 1 instance minimum; REMOVED `tiered` and the `cpubasic/rambasic/...` tier fields and `secrets` | ZelBack/config/default.js:387 ; appValidator.js:1045-1053 |

All rows [VERIFIED-SOURCE].

### 3.2 v8 top level fields

The allowed key set for v8 is exactly: `version, name, description, owner, compose, instances, contacts, geolocation, expire, nodes, staticip, datacenter, enterprise`. Keys outside this set are NOT rejected on the registration and calculator paths: they are silently dropped before validation (see the correction below). The validator's own "Unsupported parameter for v8 app specifications" error exists, but it only fires for an object that reaches it unformatted. [src: ZelBack/src/services/appRequirements/appValidator.js:1045-1063 ; ZelBack/src/services/utils/appUtilities.js:399-447 | VERIFIED-SOURCE]

> **Correction (flux-domain agent, 2026-10-12; confirmed live and in source by the FACTS owner 2026-10-13):** in the registration path `specificationFormatter` runs BEFORE the validator and silently drops keys outside the allowed set, so a stray key (a typo, `hash`, `height`) is ignored rather than rejected: the setting just does nothing. Teach it as "ignored, so it has no effect", never as "rejected". This is also true inside a component: the formatter rebuilds each component from the known keys only, so `tiered`, `secrets` and `cpubasic` in a v8 component vanish too. Live proof: `POST /apps/verifyappregistrationspecifications` (read-only) with `foo`, `hash`, and a component carrying `tiered`, `secrets`, `cpubasic` answered `success` and returned the formatted spec without any of them. The Academy linter reports `UNKNOWN_FIELD` as a warning, and `normalizeSpec` ignores `hash` and `height`. One consequence worth knowing: the owner's signature is checked against `type + version + JSON.stringify(formatted spec) + timestamp`, so the text a wallet signs must be the formatted spec the node returned (same keys, same key order), not the author's raw JSON. [src: ZelBack/src/services/utils/appUtilities.js:L399-L447,L649-L760 ; appValidator.js:L1511-L1525,L1744-L1770 ; appMessaging/messageVerifier.js:L145-L152 | VERIFIED-SOURCE; POST https://api.runonflux.io/apps/verifyappregistrationspecifications 2026-10-13 | VERIFIED-LIVE]

| Field | Type | Required | Default (FluxOS UI new app) | Limits and rules | What it does |
|---|---|---|---|---|---|
| `version` | number | yes | 8 | integer, 1 to 8 allowed; must be 8 on update-with-version-change | Selects the schema. [appValidator.js:75-80,563-565,1614-1622] |
| `name` | string | yes | none | v8: 1 to 63 chars, regex `^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$` (letters, digits, inner hyphens); v1-7: max 32, `^[a-zA-Z0-9]+$`. Must not start with `zel` or `flux` (case sensitive). Must not equal `watchtower` (any case). Unique across the network, matched case-insensitively. [appValidator.js:566-591 ; ZelBack/src/services/utils/appConstants.js:36-37 ; ZelBack/src/services/appDatabase/registryManager.js:1184] | Global unique id. Also the DNS label in `<name>.app.runonflux.io` and part of every container name. |
| `description` | string | yes | none | max 256 chars. No length minimum in the validator, but the formatter refuses a falsy description: an empty string `""` and an absent key both fail with "Missing Flux App specification parameter name and/or description and/or owner" (an ERROR, not a warning), while a single space `" "` passes. Live 2026-10-13: `""` and absent gave that message, `" "` was accepted. A component `description` of `""` is accepted. [appUtilities.js:435 (`!name \|\| !description \|\| !owner`) ; appValidator.js:592-594 ; POST /apps/verifyappregistrationspecifications \| VERIFIED-SOURCE and VERIFIED-LIVE] | Free text. Also carries the optional `networkWith:[appA,appB]` token (section 8). |
| `owner` | string | yes | wallet address | must be a Flux ID or an Ethereum address for a live submission. A Flux ID (ZelID) is a base58check P2PKH address that STARTS WITH `1`, 25 to 34 characters, with a valid checksum; an Ethereum address is `0x` plus 40 hex characters. (The `t1...` form is a transparent payment address, not an owner: live, an owner starting `t1` was refused with "Invalid Flux App owner. Must be a Flux ID or an Ethereum address".) [appValidator.js:1272-1274 ; signatureVerifier.js:L21-L45 ; POST /apps/verifyappregistrationspecifications 2026-10-13 \| VERIFIED-SOURCE and VERIFIED-LIVE] | Public key identity whose signature authorises registration and every later update. |
| `compose` | array of component | yes | 1 component | 1 to 10 components (5 before block `appSpecsEnforcementHeights[6]` = 1300000). [appValidator.js:672-681] | The containers. |
| `instances` | integer | yes | UI default 1 | 1 to 100 for v8 (min 3 for v3 to v7). Min of 1 applies from block 2,176,519 (long passed). Max 100. [ZelBack/config/default.js:413-416 ; appValidator.js:803-813 ; utils/appUtilities.js:782-792] | How many nodes should run a copy. |
| `contacts` | array of string | yes (can be `[]`) | `[]` | max 5 entries, each max 75 chars. Inside the encrypted blob when `enterprise` is set. [appValidator.js:815-822] | Contact emails FluxOS/FluxCloud may use for expiry notices. Public unless enterprise. |
| `geolocation` | array of string | yes (can be `[]`) | `[]` | max 10 entries, each max 50 chars. Syntax in 3.5. [appValidator.js:824-832] | Allow and deny list of continents, countries, regions. |
| `expire` | integer (blocks) | yes, non-zero | UI 88000 | min 1, max 1,056,000 (post PON). Not a multiple requirement since block 1625000. See 5. [appValidator.js:835-859 ; config/default.js:488-498] | Lifetime in blocks counted from the block height of the latest register or update message. |
| `nodes` | array of string | yes (can be `[]`) | `[]` | max 120 entries, each max 70 chars (`txhash:outidx` or ip[:port]). v8: only usable on enterprise (`enterprise` truthy) specs, and live submissions with a non-empty list are only accepted from owners listed in the network policy. [appValidator.js:383-385,861-870,1314-1343] | Pins the app to named nodes. |
| `staticip` | boolean | yes | `false` | boolean only. [appValidator.js:538-540] | Only run on nodes the network classifies as static IP (directly connected public address). Costs extra. |
| `datacenter` | boolean | no | omitted | undefined, true or false. `true` only accepted for enterprise-owner allowlisted owners (or if the previous spec already had it). [appValidator.js:543-548,1345-1364] | Only run on nodes classified as datacenter. |
| `enterprise` | string or empty | yes (v8) | `''` | must not be null/undefined. `''` or false = public app. Otherwise a base64 blob (see 3.7). [appValidator.js:380-385 ; utils/appUtilities.js:862-873] | Encrypts `contacts` and `compose` so only the target Arcane nodes can read them. |

All rows [VERIFIED-SOURCE] unless marked. "UI default" values are from `fluxos-frontend/src/pages/apps/register/configure.vue:210-243` [VERIFIED-SOURCE].

### 3.3 v8 component fields

Allowed component keys in v8: `name, description, repotag, ports, containerPorts, environmentParameters, commands, containerData, domains, repoauth, cpu, ram, hdd`. Anything else (including `tiered`, `secrets`, `cpubasic`...) is silently dropped by the formatter on the registration and calculator paths, so it has no effect (same correction as 3.2); the validator's "Unsupported parameter ... in component" error only applies to an unformatted object. [src: ZelBack/src/services/appRequirements/appValidator.js:1050-1078 ; ZelBack/src/services/utils/appUtilities.js:L649-L760 | VERIFIED-SOURCE; live 2026-10-13 | VERIFIED-LIVE]

| Field | Type | Required | UI default | Limits and rules | What it does |
|---|---|---|---|---|---|
| `name` | string | yes | none | max 63 chars (32 before v8); regex `^[a-zA-Z0-9]+$` ONLY, so NO hyphens in component names even in v8; must not start with `zel` or `flux`; unique within the app. [appValidator.js:692-713 ; appConstants.js:37] | Used in the container name `flux<component>_<app>`. |
| `description` | string | yes | none | max 256. [appValidator.js:714-716] | Free text. |
| `repotag` | string | yes | none | max 200 chars. Docker reference `[HOST[:PORT]/][NAMESPACE/]REPOSITORY[:TAG]`, no whitespace, tag charset `[\w][\w.-]{0,127}`. Image must exist and be pullable (checked by a live registry lookup on live submission), have `amd64` or `arm64`, and total layer size at most 5,000,000,000 bytes. Live 2026-10-13 (read-only `verifyappregistrationspecifications`): an uppercase repository such as `Nginx:1.27` is refused by FluxOS itself with "Image tag: Nginx:1.27 is not in valid format [HOST[:PORT_NUMBER]/][NAMESPACE/]REPOSITORY[:TAG]" (the pattern only accepts lowercase), `library/NGINX:1.27` fails at the registry lookup with "Authentication failed: library/NGINX:1.27 not available or doesn't exist", and a `docker.io/` prefix fails with "Unsupported schemaVersion: undefined for: docker.io/library/nginx:1.27" (FluxOS calls `https://docker.io/v2/`; use no host for Docker Hub). [appValidator.js:727-729 ; utils/imageVerifier.js:9-12,170-196,391-407 ; config/default.js:412 \| VERIFIED-SOURCE and VERIFIED-LIVE] | Container image. |
| `ports` | array of number | yes (can be `[]`) | `[]` | max 5 per component; each integer 1 to 65535; unique across ALL components of the app; none in the banned list (3.4). [appValidator.js:717-726,766-768 ; appNetwork/portManager.js:55-83] | External (host) ports on the node. |
| `containerPorts` | array of number | yes | `[]` | same length as `ports`, each 0 to 65535. `containerPorts[i]` is published on `ports[i]`. [appValidator.js:754-762] | Port the process listens on inside the container. |
| `domains` | array of string | yes | `[]` | same length as `ports`; each max 253 chars. A string may hold comma separated domains. [appValidator.js:749-753,763-765 ; flux-domain-manager/src/services/domain/index.js:35-70] | Custom domain(s) for the port, served by FDM. |
| `environmentParameters` | array of string | yes | `[]` | max 20 entries, each max 400 chars, form `KEY=value`. [appValidator.js:733-740] | Environment variables. Public in the spec unless `enterprise`. |
| `commands` | array of string | yes | `[]` | max 20 entries, each max 400 chars. [appValidator.js:741-748] | Container CMD arguments (appended as Cmd array). |
| `containerData` | string | yes | `''` (must be at least 2 chars: `/tmp` if no data wanted) | max 200 chars; grammar in section 7. [appValidator.js:730-732,770-772] | Persistent volume mount definitions. |
| `repoauth` | string | yes (can be `''`) | `''` | non-empty only allowed when `enterprise` set; max 15000 chars. Formats: `user:token` or `aws-ecr://...`, `azure-acr://...`, `google-gar://...`. [appValidator.js:791-799 ; docs/registry-auth/REPOAUTH_STRING_FORMAT.md:10-80] | Credentials for a private registry. |
| `cpu` | number (cores) | yes | 1 | number, at most 8 decimals; sum over components must be at most 15 cores; no per-component minimum or step is enforced by the backend for v4+ (the 0.1 minimum and step belong to v1-v3 `checkHWParameters`; see 2.3). UI step 0.1. [appValidator.js:457-465,1139-1180,1385-1391] | CPU limit (Docker NanoCPUs). |
| `ram` | number (MB) | yes | 2000 | sum over components at most 59000 MB. [appValidator.js:1175-1177] | Memory limit (Docker Memory). Swap limit is ram + 2000 MB. |
| `hdd` | number (GB) | yes | 20 | sum over components at most 820 GB (880 - 60). [appValidator.js:1178-1180 ; config/default.js:654-678] | Size of the component's persistent volume image. |

All rows [VERIFIED-SOURCE].

Total resource caps (sum of all components, v8 has no tiers): cpu 15 cores (160 - 10 locked, in 0.1 units), ram 59000 MB (61000 - 2000), hdd 820 GB (880 - 60). The comments in config say "150 available", "59000", "840 for apps"; the arithmetic gives 820 for hdd. [src: ZelBack/config/default.js:648-678 ; appValidator.js:1172-1180 | VERIFIED-SOURCE]. Per tier numbers (used for v1-7 tiered apps and as node capacity reference): cumulus cpu 40, ram 7000, hdd 220; nimbus cpu 80, ram 30000, hdd 440; stratus cpu 160, ram 61000, hdd 880, with the same locked amounts subtracted. [src: ZelBack/config/default.js:654-669 | VERIFIED-SOURCE]

A node that is asked to run the app also checks live free capacity: disk uses 95% of total minus 60 GB locked minus 20 GB extra, cpu uses cores minus 1, ram uses total minus 2000 MB. [src: ZelBack/src/services/appRequirements/hwRequirements.js:445-480 ; config/default.js:648-653 | VERIFIED-SOURCE]

### 3.4 Ports

| Rule | Value | Source |
|---|---|---|
| Allowed range (after block 1,420,000, in force) | 1 to 65535 | ZelBack/config/default.js:404-408 [VERIFIED-SOURCE] |
| Banned ports | 16100-16299, 26100-26299, 30000-30099, 8384, 27017, 22, 23, 25, 3389, 5900, 5800, 161, 512, 513, 5901, 3388, 4444, 123, 53 | ZelBack/config/default.js:409 [VERIFIED-SOURCE]; same list live at https://api.runonflux.io/apps/deploymentinformation [VERIFIED-LIVE] |
| "Enterprise ports" (priced at USD 2 each) | 0-1023, 8080, 8081, 8443, 6667. The fee range is written `0-1023` in config, but port 0 is outside the allowed range 1 to 65535 and is refused (live 2026-10-13: "Assigned port 0 is not within Flux Apps range 1-65535"), so in practice the fee ports a spec can use are 1 to 1023, 8080, 8081, 8443 and 6667 | ZelBack/config/default.js:410 [VERIFIED-SOURCE]; POST /apps/verifyappregistrationspecifications [VERIFIED-LIVE] |
| Max ports per component | 5 | appValidator.js:766-768 [VERIFIED-SOURCE] |
| Uniqueness | across all components of one app | appNetwork/portManager.js:55-83 [VERIFIED-SOURCE] |
| Container port range | 0 to 65535 | appValidator.js:754-759 [VERIFIED-SOURCE] |
| Protocols | every `ports[i]` is published for BOTH tcp and udp | ZelBack/src/services/dockerService.js:985-1004 [VERIFIED-SOURCE] |
| FluxOS node own ports (must not collide) | API 16127 family (16127..16197 step 10), 16100-16299 banned | ZelBack/config/default.js:29-30,409 [VERIFIED-SOURCE] |

Caveat on "enterprise ports": the validator does NOT require an enterprise app to use a port below 1024. A normal public app may use 80, it is only priced as an enterprise port (+USD 2). The FluxCloud docs page says exposed ports "must be between 1024-65535"; this is a UI recommendation, not backend rule. [src: appValidator.js:717-726 ; flux-docs/docs/fluxcloud/register-new-app/deploy-with-docker/components.md | VERIFIED-SOURCE and DOCS-ONLY]. The docs list of banned ports also differs from source (docs lists 3889 and omits 3389 and 53). [src: same | VERIFIED-SOURCE vs DOCS-ONLY]

### 3.5 Geolocation syntax and semantics

An empty array means no restriction. Each entry is a string with a prefix. [src: ZelBack/src/services/appPlacement/geolocationRule.js:155-189 ; ZelBack/src/services/appRequirements/hwRequirements.js:162-250 | VERIFIED-SOURCE]

| Entry | Meaning |
|---|---|
| `acALL` | allow every location |
| `ac<CONT>` or `ac<CONT>_ALL` | allow a continent |
| `ac<CONT>_<CC>` | allow a country |
| `ac<CONT>_<CC>_<REGION>` | allow a region (ISO 3166-2 code, for example `acEU_DE_BY`; legacy ip-api region names also resolve) |
| `a!c<CONT>` | deny a continent |
| `a!c<CONT>_<CC>` | deny a country |
| `a!c<CONT>_<CC>_<REGION>` | deny a region |
| `a<CONT>` (legacy) | allow only that continent (first one wins) |
| `b<CC>` (legacy) | allow only that country (first one wins) |

- Continent codes: AF, AN, AS, EU, NA, OC, SA. [src: appPlacement/placementFeasibility.js:44 | VERIFIED-SOURCE]
- A node must satisfy: not matched by any deny entry, and (if any allow entries exist) matched by at least one allow entry. [src: hwRequirements.js:218-246 | VERIFIED-SOURCE]
- `a!c<CONT>_ALL` or `a!cALL` bans nothing (the matching deny is compared whole). Do not teach it. [src: geolocationRule.js:14-18,121-129 | VERIFIED-SOURCE]
- Region pins are matched on proof only: a node whose region the IP table cannot resolve satisfies no region allow and is caught by no region deny. [src: geolocationRule.js:10-14 | VERIFIED-SOURCE]
- The spec geolocation is not available for enterprise apps in the FluxCloud UI (docs: "Geolocation targeting is not supported when Enterprise Application is enabled"). The backend validator has no such rule; of live apps, `batchlog` is an enterprise v8 app with `a!c...` entries. [src: flux-docs/docs/fluxcloud/register-new-app/deploy-with-docker/general.md ; https://api.runonflux.io/apps/globalappsspecifications | DOCS-ONLY (UI claim) and VERIFIED-LIVE (counter example)]
- Registration is refused if the network provably cannot place the instances (placement feasibility), and accepted with a warning when diversity constrained. [src: appValidator.js:1526-1529 ; appPlacement/placementFeasibility.js:1-20,436 | VERIFIED-SOURCE] What that check actually does (read 2026-10-13, FluxOS v8.20.0, and exercised with read-only `verifyappregistrationspecifications` calls):
  - It counts "candidates": every node in the confirmed node list that the geolocation rule does not rule out. Tier is not a filter. A node whose country or continent the location table cannot resolve is counted as a candidate for every rule, because only proven ineligibility excludes a node. [src: placementFeasibility.js:L175-L240 ; geolocationRule.js:L220-L233 | VERIFIED-SOURCE]
  - REFUSED ("requests N instances but only M eligible nodes exist for its geolocation and tier requirements. Widen the allowed locations or lower the instance count."): candidates M are fewer than the requested instances N but more than zero. Live: 100 instances with `["acAF"]` was refused with M = 82, a figure larger than the 25 nodes filed in Africa because unresolved nodes are counted. [src: placementFeasibility.js:L403-L433 ; live POST | VERIFIED-SOURCE and VERIFIED-LIVE]
  - ACCEPTED even when zero nodes match: a geo-restricted spec with zero candidates is allowed (the source logs "the location table may not cover it, so the registration is allowed"), unless EVERY allow entry is a region pin in the table's own vocabulary. In practice the unresolved nodes are still counted, so the count is rarely zero. Live: `["acEU","a!cEU"]` (allow Europe and deny Europe) and a deny of all seven continents were both ACCEPTED. A contradictory list therefore is not caught at registration; whether any node would then install it was not tested (each node decides at install time from its own location report), so say "nothing is promised to run" and do not say "it is refused". [src: placementFeasibility.js:L403-L433 ; live POST | VERIFIED-SOURCE and VERIFIED-LIVE]
  - ACCEPTED with only a log warning on the node: instances reachable but, for an app with a synced (`r:`, `g:`, `s:`) component, more instances than fault domains ("synced instances will co-locate up to N per domain"). Non-synced apps are never in this category. The warning is not part of the API answer. [src: placementFeasibility.js:L310-L316,L435-L437 | VERIFIED-SOURCE]
  - A pinned (`nodes`) spec is judged against the named nodes only. [src: placementFeasibility.js:L139-L145 | VERIFIED-SOURCE]
  - Entry semantics: a deny beats an allow. Entries that start with neither `ac`, `a!c`, `a` nor `b` (for example `hello`) are skipped and restrict nothing (live: `["hello"]` was accepted). A deny whose region part neither vocabulary resolves, `a!cALL` and `a!c<CONT>_ALL` ban nothing. An allow whose region part cannot be resolved admits the whole country. A region pin or region deny matches only nodes whose region is known. [src: geolocationRule.js:L103-L180 | VERIFIED-SOURCE]
  - Geolocation is therefore a placement filter over the network's IP-location data, not a compliance control.
- 1449 of 2078 live apps carry a non-empty `geolocation`. [src: https://api.runonflux.io/apps/globalappsspecifications | VERIFIED-LIVE]

### 3.6 Reserved and forbidden values

| Item | Rule | Source |
|---|---|---|
| App name prefixes | `zel`, `flux` rejected (app and component) | appValidator.js:583-591,700-705 [VERIFIED-SOURCE] |
| App name | `watchtower` rejected | appValidator.js:586-588 [VERIFIED-SOURCE] |
| Blocked names, owners, hashes, images, registry namespaces | enforced network wide via the signed policy `blocklist.json` (311 entries 2026-10-04) | fluxos-network-policy README.md ; https://raw.githubusercontent.com/RunOnFlux/fluxos-network-policy/signed/policy-signed.json [VERIFIED-SOURCE and VERIFIED-LIVE] |
| Image whitelist | none. The old `whitelistedrepositories` endpoint always returns `[]`. | fluxos-network-policy README.md ("There is no image whitelist here") ; ZelBack/src/routes.js:510 [VERIFIED-SOURCE] |
| Reserved env markers | `F_S_ENV=` and `F_S_CMD=` (Flux Storage links, must be https to storage.runonflux.io), `LOG=SEND` / `LOG=COLLECT` (log shipping between components) | utils/fluxStorage.js:19 ; appValidator.js:1230-1242 ; dockerService.js:1075-1090 [VERIFIED-SOURCE] |
| `--privileged` command | silently stripped from commands | dockerService.js:1073-1077 [VERIFIED-SOURCE] |
| Volume names | `appdata`, `backup`, `.`, `..` and syncthing/staging names are reserved for `m:`/`f:` subdirs | utils/mountParser.js:105-120 [VERIFIED-SOURCE] |
| Injected env vars | FluxOS appends `FLUX_NODE_HOST_IP` and `FLUX_APP_NAME` (wins over a same name var) | dockerService.js:1297-1312 [VERIFIED-SOURCE] |
| Container naming | `flux<component>_<app>` (v4+), `flux<app>` (v1-3); docker network `fluxDockerNetwork_<app>`; hostname = component name | dockerService.js:48-57,1192,1218 [VERIFIED-SOURCE] |

### 3.7 Enterprise (encrypted) specs, who can run them

- In v8 an app with a truthy `enterprise` field stores its `contacts` and `compose` encrypted. On chain the plain spec has `contacts: []` and `compose: []`. Live: 1122 of 1777 v8 apps are of this kind. [src: ZelBack/src/services/appRequirements/appValidator.js:1544-1547 ; https://api.runonflux.io/apps/globalappsspecifications | VERIFIED-SOURCE and VERIFIED-LIVE]
- The blob is base64 of: 256 bytes RSA-encrypted AES key, then 12 byte nonce, AES-256-GCM ciphertext, 16 byte tag. Plaintext is JSON `{contacts, compose}`. [src: ZelBack/src/services/utils/enterpriseHelper.js:101-141 ; utils/enterpriseEncryption.js:1-70 | VERIFIED-SOURCE]
- The RSA key is held by ArcaneOS nodes (decryption goes through the node's benchmark/secure module). Validation and pricing of an enterprise spec only work when the receiving node runs ArcaneOS ("Application Specifications can only be validated on a node running Arcane OS"). Non-Arcane nodes skip enterprise apps. [src: utils/enterpriseHelper.js:21-32 ; appLifecycle/appSpawner.js:525-529 | VERIFIED-SOURCE]
- Enterprise apps must have an `amd64` image for ALL components ("Arcane nodes are amd64-only"). Non-enterprise apps need at least one architecture common to all components (amd64 or arm64). [src: appValidator.js:1449-1480 ; utils/appConstants.js:58-61 | VERIFIED-SOURCE]
- Private images (`repoauth`) are only allowed with `enterprise`. [src: appValidator.js:791-799 | VERIFIED-SOURCE]
- Do not confuse two things: (1) "enterprise" app = encrypted spec, runs on public ArcaneOS nodes; (2) the "enterprise network", a signed list mapping a few node public keys to a few owner addresses (`enterprisenodes.json`: 2 node keys, 3 owner addresses on 2026-10-12). Apps of listed owners run ONLY on their listed nodes; all other nodes never host those owners' apps. Only listed owners may pin `nodes[]` (v8) or set `datacenter: true`. [src: ZelBack/src/services/utils/enterpriseNetwork.js:160-182 ; utils/enterpriseConfig.js:35-96 ; fluxos-network-policy/enterprisenodes.json | VERIFIED-SOURCE]
- Docs (older) claim "All enterprise nodes must be on the Stratus tier" for the Priority Nodes tab. Source: the node list score only gives tier points, no tier requirement. [src: flux-docs/docs/fluxcloud/register-new-app/deploy-with-docker/priority-nodes.md vs ZelBack/src/services/enterpriseNodesService.js:84-100 | DOCS-ONLY vs VERIFIED-SOURCE]
- Enterprise apps get automatic CPU burst on nodes that support it, reserving more than 4 vCores of headroom. [src: appRequirements/hwRequirements.js:482-505 ; utils/cpuBurstHelper.js | VERIFIED-SOURCE (reservation); burst behaviour not live tested]

### 3.8 Name and DNS rules

- App name: case-insensitive unique; v8 allows inner hyphens. `foo-bar` becomes `foo-bar.app.runonflux.io` and per port `foo-bar_31000.app.runonflux.io`. [src: appUtilities/appConstants.js:36 ; flux-domain-manager/src/services/domain/index.js:9-30 | VERIFIED-SOURCE]
- Component names are stricter than app names: letters and digits only (no hyphen), at most 63, not starting with `flux` or `zel`. An agent tool that names a single component after a hyphenated app name (the Flux Cloud MCP server's `flux_build_spec`) produces a spec the node rejects; the network validation step catches it before payment (15.1.16). The new console's assistant is stricter than the network for app names: 3 to 32 letters and digits, hyphens removed (15.2.5). [src: ZelBack/src/services/appRequirements/appValidator.js:L696-L712; mcp@0.2.7 dist/spec.js; console useAgentRun-*.js | VERIFIED-SOURCE]
- FDM lower-cases the name for domains. [src: flux-domain-manager/src/services/domain/index.js:11 | VERIFIED-SOURCE]
- Inside the app (docker network `fluxDockerNetwork_<app>`), components reach each other by container name `flux<component>_<app>`, for example `fluxmysql_mysql01`. [src: ZelBack/src/services/dockerService.js:48-57,1192-1226 ; flux-docs/docs/fluxcloud/shared-database/component.md:156 | VERIFIED-SOURCE and DOCS-ONLY]
- The container's own hostname is the bare component name. [src: dockerService.js:1192 | VERIFIED-SOURCE]
- A name is released when the app expires; registering the name of an expired app does not inherit its old privileges. [src: appValidator.js:1282-1286 | VERIFIED-SOURCE]

### 3.9 Example minimal v8 spec (valid shape, verified against the price calculator 2026-10-12)

```json
{
  "version": 8,
  "name": "hello-flux",
  "description": "Hello world demo",
  "owner": "1hjy4bCYBJr4mny4zCE85J94RXa8W6q37",
  "compose": [
    {
      "name": "web",
      "description": "nginx web",
      "repotag": "nginx:1.27",
      "ports": [31001],
      "containerPorts": [80],
      "domains": [""],
      "environmentParameters": [],
      "commands": [],
      "containerData": "/tmp",
      "cpu": 0.5,
      "ram": 500,
      "hdd": 5,
      "repoauth": ""
    }
  ],
  "instances": 3,
  "contacts": [],
  "geolocation": [],
  "expire": 88000,
  "nodes": [],
  "staticip": false,
  "enterprise": ""
}
```

[src: shape accepted by POST https://api.runonflux.io/apps/calculatefiatandfluxprice 2026-10-12 (the owner is the public Flux team ID from config, used only for pricing) | VERIFIED-LIVE]. The calculator does NOT run the full validator (name rules, image check, banned ports); `verifyappregistrationspecifications` does and was not called because it is part of the registration workflow.

### 3.10 What the calculator and validator actually check

| Check | Where | Note |
|---|---|---|
| Formatting and types (`specificationFormatter`) | calculatefiatandfluxprice, calculateprice, register | Throws "Minimum number of instances is 3" for v7 with 1 instance and "Maximum number of instances is 100" for 101 [VERIFIED-LIVE 2026-10-12] |
| Full restriction checks (names, lengths, ports, geolocation, expire) | `verifyAppSpecifications` on live submission | not exposed by a read-only calculator |
| Image existence, size, architecture | live submission only (`liveSubmission=true`) | [appValidator.js:1394-1482 VERIFIED-SOURCE] |
| Placement feasibility | live registration and update | [appValidator.js:1529,1630 VERIFIED-SOURCE] |

## 4. Pricing (exact formula, verified against the live calculator)

Verification result: the pseudocode in 4.3 reproduced the official `POST /apps/calculatefiatandfluxprice` USD answer for **80 of 80** specs on 2026-10-12 (20 hand built, 60 random: 1 to 3 components, 1 to 100 instances, 1 hour to 12 months, static IP on/off, with and without enterprise ports). All 80 inputs and answers are in `docs/research/samples/price-verification-80-cases.json`. The FLUX figure agreed to within rate rounding (about 0.1 percent) because the node caches the FLUX/USD rate. [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice 2026-10-12 vs ZelBack/src/services/utils/appUtilities.js:23-139 and appSpecHelpers.js:307-541 | VERIFIED-LIVE and VERIFIED-SOURCE]

### 4.1 Where the numbers come from

| Input | Value (2026-10-12) | Source |
|---|---|---|
| USD price table | `cpu 0.15` per 0.1 core, `ram 0.05` per 100 MB, `hdd 0.02` per GB, `port 2` per enterprise port, `scope 4` (enterprise or pinned nodes), `staticip 2`, `fluxmultiplier 0.95`, `multiplier 1`, `minUSDPrice 0.99`, `minPrice 0.01` | `GET https://api.runonflux.io/apps/getappspecsusdprice` (also at stats.runonflux.io, cached 30 min) [VERIFIED-LIVE]; fallback copy at ZelBack/config/default.js:339-351 [VERIFIED-SOURCE] |
| Default subscription length | `blocksLasting 22000` x 4 after the PON fork = **88000 blocks** (about 30.6 days at 30 s blocks) | ZelBack/config/default.js:488,496 ; appSpecHelpers.js:373-376 [VERIFIED-SOURCE] |
| FLUX per USD | `viprates.runonflux.io/rates`: USD rate x FLUX/BTC (about 0.0852 USD per FLUX on 2026-10-12); fallback CoinGecko `zelcash`; last resort 0.6 | appSpecHelpers.js:493-521 ; https://viprates.runonflux.io/rates [VERIFIED-SOURCE and VERIFIED-LIVE] |
| On-chain FLUX price table (consensus floor) | last fork at height 1,597,156: `cpu 0.03, ram 0.01, hdd 0.004, minPrice 0.01, port 0.4, scope 0.8, staticip 0.4` (FLUX units) | ZelBack/config/default.js:327-336 ; https://api.runonflux.io/apps/deploymentinformation [VERIFIED-SOURCE and VERIFIED-LIVE] |

Warning: the FluxCloud docs quote "Static IP additional cost: $0.40" and "Enterprise: $0.80 + $0.40 per enterprise port". Those are the old on-chain FLUX table values (`staticip 0.4`, `scope 0.8`, `port 0.4`) shown as dollars. The USD prices are staticip 2, scope 4, port 2. [src: flux-docs/docs/fluxcloud/register-new-app/deploy-with-docker/general.md vs ZelBack/config/default.js:339-351 | DOCS-ONLY (wrong) vs VERIFIED-SOURCE]

Warning: `GET /apps/deploymentinformation` still reports `minimumInstances 3`, `minBlocksAllowance 5000`, `blocksLasting 22000`, `maxBlocksAllowance 1056000`. They are legacy config fallbacks; the validator uses 1 instance minimum for v8, 1 block minimum expire, 88000 blocks per month. [src: https://api.runonflux.io/apps/deploymentinformation ; appValidator.js:803-813,835-859 | VERIFIED-LIVE vs VERIFIED-SOURCE]

### 4.2 Request shape for the read-only calculators

- `POST https://api.runonflux.io/apps/calculatefiatandfluxprice` (and the identical `/apps/calculateprice`, which just calls the same function). Body: the full v8 spec as JSON text. Response: `{"status":"success","data":{"usd":2.99,"flux":33.34,"fluxDiscount":5}}`. [src: ZelBack/src/routes.js:506-511 ; appSpecHelpers.js:549-551 | VERIFIED-SOURCE]
- The `Content-Type` must NOT be `application/json`. With `application/json` the request is never answered by the node: the gateway gives up with a 504 after its 30 s server timeout; `application/x-www-form-urlencoded` (what the FluxCloud UI sends) and `text/plain` both work. [src: https://api.runonflux.io/apps/calculatefiatandfluxprice tested 2026-10-12 (504 with json; 200 with x-www-form-urlencoded and text/plain) | VERIFIED-LIVE]. Reconciliation of the two observations in this file: the 504 after about 30 s is what the gateway returns (its sticky API backend has `timeout server 30s`, and the calculator path falls on that backend because its round-robin ACL is mistyped, see 10.1); the "no response in 12 s" in 10.6.2 E14 was a curl `--max-time 12` client limit that stopped waiting before the gateway's 504. They are one behaviour, not two. [src: flux-domain-manager/src/services/haproxyTemplate.js:L356,L422 | VERIFIED-SOURCE]
- A spec whose `name` already exists on the network is quoted as an update (the unused term of the old spec is credited), so it comes out lower than a registration. Checked read-only 2026-10-13 with the Flux Cloud MCP server's reference sizes (3 instances, one month): an unused name quoted 1.99, 4.99 and 10.99 while the existing name `hello-flux` quoted 1.49, 4.49 and 10.49 for the same specs. Use a fresh app name for every quote comparison. [src: POST api /apps/calculatefiatandfluxprice 2026-10-13 \| VERIFIED-LIVE]; the update credit [src: 4.5 \| VERIFIED-SOURCE]
- Sending a priceUSD field makes the node validate and echo it; do not do that for quotes. [src: appSpecHelpers.js:449-456 | VERIFIED-SOURCE]
- The call needs no login. Enterprise specs (non-empty `enterprise`) can only be priced when the spec decrypts on an Arcane node, which needs the owner's public key flow (`/apps/getpublickey`, login required). Enterprise pricing was therefore verified in source and via the `nodes` branch (same code path), not with a fresh encrypted blob. [src: appSpecHelpers.js:328 ; utils/enterpriseHelper.js:21-32 | VERIFIED-SOURCE]

### 4.3 The formula (pseudocode)

```
CONSTANTS (fetch live from getappspecsusdprice):
  P = { cpu: 0.15, ram: 0.05, hdd: 0.02, port: 2, scope: 4, staticip: 2,
        multiplier: 1, minUSDPrice: 0.99, fluxmultiplier: 0.95 }
  MONTH = 88000                       # blocks, post PON
  ENTERPRISE_PORT(p) = p in 0..1023 or p in {8080, 8081, 8443, 6667}

# Step A. Base monthly price (appPricePerMonth, v4+)
cpu  = sum(component.cpu)       # cores
ram  = sum(component.ram)       # MB
hdd  = sum(component.hdd)       # GB
entPorts = count of ports over all components with ENTERPRISE_PORT(port)

total = cpu * P.cpu * 10  +  ram * P.ram / 100  +  hdd * P.hdd
if enterprise or nodes.length > 0:  total += P.scope
if staticip:                        total += P.staticip
total += entPorts * P.port

perInstance = ceil_cents(total / 3)         # the table is "per 3 instances"
extra = instances - 1
if extra > 0:
    if perInstance < 0.50 and extra > 2:
        app = perInstance + extra * 0.50    # cheap apps: 0.50 per additional instance
    else:
        app = (ceil(perInstance*extra*100) + ceil(perInstance*100)) / 100   # perInstance * instances
else:
    app = perInstance
if app < P.minUSDPrice: app = P.minUSDPrice

# Step B. Subscription length (linear in blocks)
expire = spec.expire or MONTH
usd = toFixed2(app * expire / MONTH)

# Step C. Existing app (update or renewal only)
if an app with this name exists on chain:
    prevMonthly = same Step A on the stored spec with CURRENT prices, scaled by prev.expire / prevDefault
    elapsedBlocks = currentHeight - prev.height   (pre-PON blocks count x4)
    remaining = (prev.expire - elapsedBlocks) / prev.expire
    if remaining > 0: usd -= remaining * prevMonthly
    # (and if the update is "free", see 4.5, the answer is 0)

# Step D. Small app discount (only for instances < 4)
need = totals at the largest tier (cpu cores, ram MB, hdd GB)
if instances < 4:
    if need.cpu < 3 and need.ram < 6000 and need.hdd < 150: usd *= 0.8
    elif need.cpu < 7 and need.ram < 29000 and need.hdd < 370: usd *= 0.9

# Step E. Multipliers and floor
usd = toFixed2(usd * marketplaceMultiplier(name) * P.multiplier)   # marketplace multiplier is 1 unless the name starts with a listed marketplace app that has one > 1
if usd < P.minUSDPrice: usd = P.minUSDPrice

# Step F. Duration discount
months = expire / MONTH
if   months >= 9: usd *= 0.88      # 12 percent
elif months >= 6: usd *= 0.94      # 6 percent
elif months >= 3: usd *= 0.97      # 3 percent
usd = toFixed2(usd)
if usd < P.minUSDPrice: usd = P.minUSDPrice

# Step G. Charm rounding (since FluxOS PR #1818, 2026-09-25)
cents = round(usd * 100)
usd   = floor(cents/100) + (0.49 if cents % 100 <= 49 else 0.99)

# Step H. FLUX
fluxFromUsd = usd / fluxUsdRate * P.fluxmultiplier       # 0.95 means 5 percent off when paying in FLUX
fluxOnChain = on-chain table price (Step A-D with the 1,597,156 FLUX table, same shape)
flux = max(fluxOnChain, fluxFromUsd)
```

All steps [src: ZelBack/src/services/utils/appUtilities.js:89-139 ; ZelBack/src/services/utils/appSpecHelpers.js:24-37,44-129,371-527 | VERIFIED-SOURCE]. Python implementation that reproduces 80/80 live answers: `docs/research/samples/price-verification-80-cases.json` holds inputs and expected outputs for unit tests.

### 4.4 Rules worth stating plainly

| Rule | Detail | Source |
|---|---|---|
| Base is "per 3 instances" | the resource sum is divided by 3 to get a per instance price | appUtilities.js:122 [VERIFIED-SOURCE] |
| Cheap apps pay at least 0.50 per extra instance | when per instance price is under 0.50 and more than 2 extra instances | appUtilities.js:126-127 [VERIFIED-SOURCE] |
| Minimum price | USD 0.99 for any subscription (after every discount) | appSpecHelpers.js:464-466,481-483 [VERIFIED-SOURCE]; live: a 1 block `expire` quotes 0.99 [VERIFIED-LIVE] |
| Price ends in .49 or .99 | whole order is rounded up to the next .49/.99 as the very last step | appSpecHelpers.js:30-37,489-491 [VERIFIED-SOURCE]; every one of 80 live answers ends in .49 or .99 [VERIFIED-LIVE] |
| Free instances | there is no free tier. One instance costs the same base per instance price, then the 0.99 floor applies. (Orbit's old "Free plan" was a product plan, not a network feature, and is closed to new apps: 15.3.10) | appUtilities.js:134-136 [VERIFIED-SOURCE] |
| Small app cliff | going from 3 to 4 instances changes TWO things, and a small app jumps from 0.99 to 1.99: (1) the 20 percent small app discount is only applied below 4 instances, and (2) when one instance costs under USD 0.50 and there are more than 2 extra instances, every extra instance is billed a flat USD 0.50 instead of the instance price (4.3 step A). Worked example, 0.5 core / 500 MB / 5 GB, port 31001: bundle 0.75 + 0.25 + 0.10 = 1.10, per instance 0.37. 3 instances: 3 x 0.37 = 1.11, x 0.8 = 0.89, lifted to the 0.99 minimum, so 0.99. 4 instances: the flat rule gives 0.37 + 3 x 0.50 = 1.87, no discount, charm-rounded up to 1.99. The discount ending alone (4 x 0.37 = 1.48, rounded to 1.49) would only account for half of the jump. Note that "the minimum hides the base" is about the 0.89 being lifted to 0.99 at three instances, not about the sum being under the minimum before the discount (1.11 is above it). | appUtilities.js:L126-L127 ; appSpecHelpers.js:433-440 [VERIFIED-SOURCE]; table in 4.6 [VERIFIED-LIVE]; reproduced by `quote()` in shared/flux, 2026-10-13 |
| Longer terms and charm rounding | the duration discount (3 / 6 / 12 percent) comes off BEFORE the last step, and the last step rounds the total UP to .49 or .99 (cents 0-49 go to .49, 50-99 go to .99). So a term can cost more per month than a shorter one, and 3 months can cost more than 3 x the 1 month price. The saving is only real when you compare totals. Worked numbers, read from the live calculator on 2026-10-13 and equal to `quote()` in shared/flux: (a) 0.5 core / 500 MB / 5 GB, 3 instances: 1 month USD 0.99 (floor), 3 months USD 2.99 (3 x 0.99 = 2.97, so 3 months costs USD 0.02 MORE), 6 months 5.49, 12 months 9.49. Steps for 3 months: 3 x 1.11 = 3.33, x 0.8 = 2.66, x 0.97 = 2.58, rounded up to 2.99. (b) two components 0.5 core / 500 MB / 5 GB and 0.3 core / 300 MB / 1 GB, 3 instances: 1 month USD 1.49, 3 months USD 4.49 (3 x 1.49 = 4.47), 9 months 11.49 (9 x 1.49 = 13.41), 12 months 14.99. Steps for 1 month: 3 x 0.58 = 1.74, x 0.8 = 1.39, rounded up to 1.49 (a gain of 0.10). Steps for 3 months: 3 x 1.74 = 5.22, x 0.8 = 4.18, x 0.97 = 4.05, rounded up to 4.49 (a gain of 0.44). | appSpecHelpers.js:L30-L37,L469-L491 [VERIFIED-SOURCE]; POST /apps/calculatefiatandfluxprice 2026-10-13 [VERIFIED-LIVE] |
| Enterprise (`enterprise` set) and pinned nodes | USD 4 added to the base before the divide by 3 (so about +1.33 per instance) | appUtilities.js:114-116 [VERIFIED-SOURCE]; `nodes` branch VERIFIED-LIVE (case T below) |
| Static IP | USD 2 added to the base before the divide by 3 | appUtilities.js:117-119 [VERIFIED-SOURCE and VERIFIED-LIVE (case D)] |
| Enterprise ports | USD 2 per port in 0-1023, 8080, 8081, 8443, 6667, added before the divide by 3 | appUtilities.js:104-120 [VERIFIED-SOURCE and VERIFIED-LIVE (cases A vs J)] |
| Tier prices | v8 has no tiers; one price for the total of all components. v7 tiered apps average the three tier values per component | appUtilities.js:94-103 [VERIFIED-SOURCE] |
| Volume discounts | duration only: 3 months 3 percent, 6 months 6 percent, 9 months or more 12 percent (UI offers 1, 3, 6, 12 months) | appSpecHelpers.js:469-478 [VERIFIED-SOURCE]; InstallDialog.vue:2091-2121 [VERIFIED-SOURCE]; live 3 month quote 7.49 vs 3x2.99 [VERIFIED-LIVE] |
| `fluxmultiplier` | 0.95: paying in FLUX is 5 percent cheaper than the USD figure converted at market | https://api.runonflux.io/apps/getappspecsusdprice [VERIFIED-LIVE]; every quote has `fluxDiscount: 5` [VERIFIED-LIVE] |
| `multiplier` | 1 (global USD scale knob) | same [VERIFIED-LIVE] |
| Max subscription | 1,056,000 blocks (12 months, about 366 days) | appValidator.js:848-853 [VERIFIED-SOURCE] |
| Marketplace multiplier | `https://stats.runonflux.io/marketplace/listapps` entries can carry `multiplier`; applied when the app name starts with the listed name | appSpecHelpers.js:441-463 [VERIFIED-SOURCE] |

### 4.5 Updates, renewal, extension

- **Renewal and update are the same message type** (`fluxappupdate`). Renewal is an update that raises `expire`. In FluxCloud the "Renewal" toggle ON adds the chosen period on top of the current expiry; OFF keeps the original expiry. [src: flux-docs/docs/fluxcloud/applications/management/manage-app/subscription.md | DOCS-ONLY]
- `expire` of an update counts from the block height of the update message, and the quote subtracts the unused fraction of the previous subscription at the previous spec's price: `usd = priceNew(expireNew) - remainingFraction * pricePrev`. [src: appSpecHelpers.js:384-431 ; explorerService/registryManager.js:1488-1512 | VERIFIED-SOURCE]
- Consensus check on an update uses `0.9 * (priceNew - remaining * pricePrev)` in FLUX table units, so nodes accept a 10 percent lower on-chain amount than the formula. [src: appMessaging/messageVerifier.js:833-862 | VERIFIED-SOURCE]
- **Free updates**: when the new spec has the same instances, staticip, nodes count and compose length, no component gets more cpu/ram/hdd or enterprise ports, and the update does not extend expiry by more than 8 blocks, the quote is `usd 0, flux 0`. Rate limit: at most 5 updates in 720 blocks, 8 in 1440, 10 in 3600 blocks (these windows are in pre-PON block units in code). [src: appSpecHelpers.js:147-256 | VERIFIED-SOURCE]
- The `usersToExtend` address list can send expire-only extension updates on behalf of owners. [src: ZelBack/config/default.js:377 | VERIFIED-SOURCE]
- Changing owner is an update signed by the old owner. [src: flux-docs subscription.md ("You can change the owner field") | DOCS-ONLY]
- Cancellation: a 1 block `expire` update (allowed since block 1,964,447) is how the OLD FluxCloud UI (the Vue front end at `cloud.runonflux.com`) cancels. The new console front end signs an update with `expire` 100 blocks and the Flux Cloud MCP server one with `expire` 120 blocks, so the app goes after about an hour and nothing is refunded; 1 block is still accepted by the node (15.1.8, 15.2.8). [src: ZelBack/config/default.js:492-493 ; appValidator.js:844-846 | VERIFIED-SOURCE]; [src: mcp@0.2.7 dist/server.js flux_cancel_app; console deploy-*.js | VERIFIED-SOURCE]

### 4.6 Verification table (first 20 of 80)

Cases A to T: version 8, one component, ports as listed, `enterprise: ""`, `geolocation: []`, API = answer of `POST /apps/calculatefiatandfluxprice`, Formula = section 4.3. Cases A to K and others use port 8080, which is an enterprise port (+USD 2) and explains why 3 small instances quote 2.99 not 0.99.

| Case | Components (cpu / ram / hdd, ports) | Instances | expire (blocks) | Extra | API usd | API flux | Formula usd |
|---|---|---|---|---|---|---|---|
| A | 0.5 / 500 MB / 5 GB, 8080 | 3 | 88000 | none | 2.99 | 33.34 | 2.99 |
| B | same | 5 | 88000 | none | 5.49 | 61.22 | 5.49 |
| C | same | 10 | 88000 | none | 10.49 | 116.98 | 10.49 |
| D | same | 3 | 88000 | static IP | 4.49 | 50.07 | 4.49 |
| E | 1/1000/10 p8080; 1/2000/20 p8081; 0.5/500/5 p9000 | 3 | 88000 | 3 components | 8.49 | 94.67 | 8.49 |
| F | 4 / 8000 / 100, 8080 | 3 | 88000 | none | 12.99 | 144.85 | 12.99 |
| G | 0.5/500/5, 8080 | 1 | 88000 | none | 0.99 | 11.04 | 0.99 |
| H | same | 2 | 88000 | none | 1.99 | 22.19 | 1.99 |
| I | 0.1 / 100 / 1, 8080 | 3 | 88000 | none | 1.99 | 22.19 | 1.99 |
| J | 0.5/500/5, 80 | 3 | 88000 | none | 2.99 | 33.34 | 2.99 |
| K | 0.5/500/5, 8080 | 3 | 528000 (6 months) | 6% discount | 14.49 | 161.58 | 14.49 |
| L | same | 3 | 1056000 (12 months) | 12% discount | 26.49 | 295.39 | 26.49 |
| M | 2 / 4000 / 40, 8080 | 3 | 88000 | none | 6.49 | 72.37 | 6.49 |
| N | same | 5 | 88000 | none | 13.49 | 150.43 | 13.49 |
| O | 6 / 16000 / 200, 8080 | 4 | 88000 | none | 30.99 | 345.57 | 30.99 |
| P | 0.5/500/5, 8080 | 4 | 88000 | none | 4.49 | 50.07 | 4.49 |
| Q | same | 3 | 264000 (3 months) | 3% discount | 7.49 | 83.52 | 7.49 |
| R | same | 3 | 792000 (9 months) | 12% discount | 19.99 | 222.91 | 19.99 |
| S | same | 3 | 1000 | short | 0.99 | 11.04 | 0.99 |
| T | same | 3 | 88000 | `nodes` has 1 entry | 5.99 | 66.8 | 5.99 |

[src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice 2026-10-12 | VERIFIED-LIVE]

A price curve with a NON enterprise port (31001), the number an author of a calculator will want:

| Spec | 1 inst | 2 | 3 | 4 | 5 | 10 | 20 | 100 |
|---|---|---|---|---|---|---|---|---|
| small 0.5 core, 500 MB, 5 GB | 0.99 | 0.99 | 0.99 | 1.99 | 2.49 | 4.99 | 9.99 | 49.99 |
| medium 2 core, 4000 MB, 40 GB | 1.99 | 3.49 | 4.99 | 7.99 | 9.99 | 19.49 | 38.99 | 194.49 |
| large 4 core, 8000 MB, 100 GB | 3.99 | 7.49 | 10.99 | 16.49 | 20.49 | 40.49 | 80.49 | 400.49 |

All USD per 88000 blocks. FLUX quotes were 11.01, 22.13, 44.37 for 1 instance of small, medium, large and about 11.1 FLUX per USD of price (rate 0.0852 x 0.95 discount). [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice 2026-10-12 | VERIFIED-LIVE] Why 11.01 here and 11.04 elsewhere in this file (Snapshot, 9.5.3, E14): the FLUX figure is USD / rate x 0.95 and the rate is a moving market price that the node caches, so the same 0.99 quote read at different times of 2026-10-12 gave 11.01 and 11.04 (rates 0.0854 and 0.0852). It is not a different formula. A third reading on 2026-10-13 was 11.62 FLUX (rate 0.0809). The USD figures are the stable ones; never type a FLUX figure into a lesson.

### 4.7 FLUX payment details

- You pay `flux` from the quote to a single network address with the message hash in OP_RETURN; the address is `t3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX` (multisig) in `deploymentinformation`. [src: https://api.runonflux.io/apps/deploymentinformation ; ZelBack/config/default.js:397-399 | VERIFIED-LIVE and VERIFIED-SOURCE]
- Consensus acceptance floor is the on-chain FLUX table (0.03/0.01/0.004...), which is about 60 times below the quote for a typical app. The quote is policy, not protocol minimum; teach users to pay the quoted amount (an underpaid message is dropped with a log "is underpaid" and the app never installs). [src: appMessaging/messageVerifier.js:752-787 | VERIFIED-SOURCE]
- Settled 2026-10-13 (was open question 14.20): the node compares the amount paid to the output with the on-chain table price only (`valueSat >= appPrice * 1e8`, where `appPrice` comes from the on-chain table interval, times expire / default expire, ceiled to a cent, with no duration or small-app discount). No USD quote is consulted in that path. So a payment between the on-chain price and the FluxCloud quote is accepted by node code and the app is installed, and a payment below the on-chain price is logged "is underpaid" and the app is not stored. Not tested by paying. The teaching rule stays "pay the full quoted amount": that is what FluxCloud asks for, the card relay refuses below 98 percent of the quote, and nothing is gained by paying less. Never write "must pay at least the quote" or "a payment under the quote is dropped". A second payment for a hash already on file is ignored. [src: appMessaging/messageVerifier.js:L654-L660,L764-L790,L828-L860 ; explorerService.js:L353 ; utils/appUtilities.js:L100-L140 | VERIFIED-SOURCE]
- The Flux Cloud MCP server agrees with this: it pays `max(quote, on-chain floor)` and uses the on-chain price only as a floor, which for a typical app is about 50 times below the quote, so the guard is a no-op in practice. An underpaid FLUX payment is not "burned": it goes to the deployment address and is not refunded, and a second payment for the same hash is ignored (15.1.7). [src: mcp@0.2.7 dist/deploy.js, dist/pricing.js | VERIFIED-SOURCE]
- Fiat path: card and PayPal go through a payment relay that requires at least 98 percent of the quote ("invalid price supplied"). Minimum USD for card/PayPal is `minUSDPrice` 0.99. [src: ZelBack/src/services/paymentRelayService.js ; fluxos-frontend/src/utils/networkPrice.js:7-12 | VERIFIED-SOURCE]
- Payment must land while the temporary message is alive: message TTL is 3600 s, registration messages older than 1 hour are refused, and the UI payment link says 30 minutes. [src: config/default.js:535 ; appValidator.js:1721-1727 ; flux-docs/docs/fluxcloud/register-new-app/deploy-with-docker/review.md | VERIFIED-SOURCE and DOCS-ONLY] When each of those clocks starts is settled in 6.6.

## 5. Blocks, time and subscriptions

### 5.1 Block time

| Fact | Value | Source |
|---|---|---|
| Block spacing since Proof of Node (height 2,020,000, 2025-10-25 18:00:35 UTC) | 30 s target, measured average 30.07 s (2880 blocks from 3028120 to 3031000 took 86,610 s) | ZelBack/config/default.js:496 ; https://api.runonflux.io/daemon/getblock/3028120/1 and /3031000/1 [VERIFIED-SOURCE and VERIFIED-LIVE] |
| Blocks per day | about 2873 observed, 2880 nominal | derived [VERIFIED-LIVE] |
| Blocks per 30 days | about 86,200 observed, 86,400 nominal | derived [VERIFIED-LIVE] |
| FluxOS "month" | 88000 blocks (22000 x 4) which is 30.6 days nominal | appSpecHelpers.js:373-376 [VERIFIED-SOURCE] |
| Before the fork | 120 s blocks, 720 blocks per day, month = 22000 blocks | ZelBack/config/default.js:488 ; fluxos-frontend/src/pages/dashboards/rewards.vue:457 [VERIFIED-SOURCE] |
| Old apps registered before height 2,020,000 | blocks after the fork count 4x faster for expiry: nodes convert the remaining pre-fork block count (`blocksAfterFork * 4`) | registryManager.js:1496-1508 [VERIFIED-SOURCE] |

Convenient conversions for authors (30 s blocks, nominal): 1 hour = 120 blocks; 1 day = 2880; 1 week = 20,160; 2 weeks = 40,320; 1 month (FluxOS) = 88,000; 3 months = 264,000; 6 months = 528,000; 1 year = 1,056,000. Live apps use exactly these: 88000 (377 apps), 1056000 (125), 20160 (105), 264000 (34), 528000 (34). [src: https://api.runonflux.io/apps/globalappsspecifications 2026-10-12 | VERIFIED-LIVE]

### 5.2 What `expire` means

- `expire` is a number of blocks of life, counted from the block height at which the latest register or update message was mined. Absolute expiry height = `message height + expire` (with the fork adjustment for older apps). [src: ZelBack/src/services/appDatabase/registryManager.js:1488-1512 | VERIFIED-SOURCE]
- Omitted or 0 in old specs means the default 22000 (88000 after the fork); v6+ requires a non-zero integer. [src: appValidator.js:509-522 ; appSpecHelpers.js:68-72 | VERIFIED-SOURCE]
- An update message restarts the clock at the new message height. Pricing compensates by crediting the unused part of the old subscription (section 4.5), so a normal config update with unchanged `expire` effectively resets the lifetime to `expire` blocks from the update. Free updates (section 4.5) subtract the extension so they do not lengthen life. [src: appSpecHelpers.js:174-244 | VERIFIED-SOURCE]
- Remaining life is shown in the UI as "Current subscription until" and "Time left". [src: flux-docs/docs/fluxcloud/applications/management/manage-app/subscription.md | DOCS-ONLY]

### 5.3 Limits

| Limit | Value | Source |
|---|---|---|
| Minimum `expire` | 1 block (since block 1,964,447; used for cancellation). Before that 100 (from 1,630,040), before that 5000 | ZelBack/config/default.js:489-493 ; appValidator.js:835-846 [VERIFIED-SOURCE] |
| Minimum price | USD 0.99 regardless of duration (a 1 block subscription quotes 0.99) | [VERIFIED-LIVE, see 4.4] |
| Maximum `expire` | 1,056,000 blocks (about 366 days) | ZelBack/config/default.js:495 ; appValidator.js:848-853 [VERIFIED-SOURCE] |
| Multiples of 1000 | no longer required (rule removed at block 1,625,000) | ZelBack/config/default.js:497-498 ; appValidator.js:854-858 [VERIFIED-SOURCE] |
| UI choices | Simple mode: 1 week, 2 weeks, 1 month, 3 months (-3%), 6 months (-6%), 1 year (-12%). Total may not exceed 1 year | [src: SimpleDeploy.vue:829 ; SubscriptionManager.vue:4897-4901 (see section 9.5) \| VERIFIED-SOURCE] |
| Duration discounts | 3 months or more 3%, 6 months or more 6%, 9 months or more 12% (the UI maps 12 months to the 12% tier) | appSpecHelpers.js:469-478 [VERIFIED-SOURCE] |

### 5.4 Renewal, extension, expiry

- Renewal: Subscription tab, "Renewal", choose period, sign, pay. It sends an update message with a higher `expire`; the price is new total minus pro rata credit. Maximum total life is 1 year. [src: section 9.7 ; appSpecHelpers.js:384-431 | VERIFIED-SOURCE]
- Stripe auto-renewal exists for card payments (1 week, 2 weeks, 1, 3, 6, 12 months). [src: fluxos-frontend i18n (see section 9.4) | VERIFIED-SOURCE]
- At expiry: every confirmed block whose height is a multiple of 8 (2 x 4 post fork) runs `expireGlobalApplications`, which deletes the app from the global spec database when `height + expire < explorerHeight`. Nodes then see the app is no longer in the list and uninstall it (containers, volumes and data are removed). [src: ZelBack/src/services/explorerService.js:609-650 ; registryManager.js:1460-1520 | VERIFIED-SOURCE]
- So after the expiry block the app is gone within minutes to a few hours, with no grace period. Data is lost unless backed up. The name becomes free again. [src: registryManager.js:1510-1520 ; flux-docs control.md ("Remove Application ... deletes all associated data") | VERIFIED-SOURCE and DOCS-ONLY]
- An expired app can be "Redeployed" from My Expired Apps; this is a fresh registration, and data from the previous instance is not restored. [src: flux-docs/docs/fluxcloud/applications/management/README.md | DOCS-ONLY]
- Cancelling sets `expire` to 1 block in the old FluxCloud UI; the app is removed immediately network wide and data is lost. The new console signs 100 blocks and the Flux Cloud MCP server 120 blocks (about an hour, nothing refunded; 4.5, 15.1.8). [src: flux-docs subscription.md ("immediately removed", "data will be lost permanently") ; ZelBack/config/default.js:492 | DOCS-ONLY and VERIFIED-SOURCE]
- Apps are NOT paid per block. You pre-pay the whole period. There is no refund by protocol; support handles the "30-day money back" by ticket. [src: section 1.5 ; section 9.0 row 7 | DOCS-ONLY]

## 6. How deployment really works end to end

### 6.1 Sequence

| # | Step | What happens | Typical time | Source |
|---|---|---|---|---|
| 1 | Compose spec | You (or the FluxCloud form) build the v8 JSON. | n/a | section 3 |
| 2 | Price | `POST /apps/calculatefiatandfluxprice`. Read-only. | under 1 s | section 4 |
| 3 | Validate | `POST /apps/verifyappregistrationspecifications`: format, ports, image exists and fits 5 GB, architecture, placement feasibility. Returns the formatted spec. | seconds (registry lookup) | appValidator.js:1493-1563 [VERIFIED-SOURCE] |
| 4 | Sign | You sign `type + version + JSON.stringify(spec) + timestamp` with the owner key (ZelID wallet message signature, or an Ethereum signature). Timestamp must be within -1 h to +5 min of node time. | seconds | messageVerifier.js:144-152 ; appValidator.js:1721-1727 [VERIFIED-SOURCE] |
| 5 | Register message | `POST /apps/appregister` with `{type:'fluxappregister', version:1, appSpecification, timestamp, signature}`. The node re-validates, hashes `type+version+spec+timestamp+signature` (SHA-256) and broadcasts a temporary message to peers. Response is the message hash. | about 5 to 10 s | appValidator.js:1674-1830 [VERIFIED-SOURCE] |
| 6 | Test install | Optional but done by the UI: temporary message makes nodes test-install the app (hdd forced to 2 GB) and report. | 1 to a few minutes | appInstaller.js:578-590 ; section 9.4.4 [VERIFIED-SOURCE] |
| 7 | Payment | Send the quoted FLUX to the payment address with the hash as `OP_RETURN` message, or pay by card (a relay pays for you). Temporary messages live 3600 s; UI window 30 min. | 1 to 3 blocks (30 to 90 s) once sent | explorerService.js:325-340 ; config/default.js:535 [VERIFIED-SOURCE] |
| 8 | Chain confirmation | Every FluxOS node scans each block; a transaction paying the app address with a known hash links the temporary message to the block. Payment amount must be at least the on-chain table price. The spec is inserted into the global app database at that height. | next block, about 30 s | messageVerifier.js:752-787 [VERIFIED-SOURCE] |
| 9 | Node selection | Each node runs its own spawn loop. It lists apps with fewer running+installing instances than `instances`, filters by blocklist, geolocation, pinned nodes, enterprise ownership, HW and port availability, picks one at random, and announces "installing". Config: `installation.delay` 120 s; the loop runs every 30 s on enterprise-network nodes and every 60 s to 30 min on others depending on how many apps are installable. | 1 to 3 min typical | appSpawner.js:107-160, 335-515, 540-912 ; config/default.js:476-479 [VERIFIED-SOURCE]; UI text "usually starts installing within 1 to 3 minutes" (section 9.5) |
| 10 | Deferrals | Nodes that are "too big" for a small app wait: Stratus nodes wait 117 min, Nimbus 57 min before taking an app with under 3 cores, 6000 MB, 150 GB; Stratus wait 87 min for apps under 7 cores, 29000 MB, 370 GB. Non-static-IP-needing apps are deferred on static IP nodes 57 min; non-enterprise apps are deferred 2 min on ArcaneOS nodes. | up to about 2 h in the worst case | appSpawner.js:821-905 ; config/default.js:607-615 [VERIFIED-SOURCE] |
| 11 | Install | Docker image pull (the dominant cost for big images), network `fluxDockerNetwork_<app>`, volumes (`fallocate` image of `hdd` GB, ext4), containers `flux<component>_<app>`. | seconds to tens of minutes | appInstaller.js ; dockerService.js:1040-1262 [VERIFIED-SOURCE] |
| 12 | Announce | Node broadcasts a signed "app running" message. Location records last 7500 s and are refreshed every 3600 s. `GET /apps/location/<name>` lists them. | seconds | appConstants.js:100-150 [VERIFIED-SOURCE] |
| 13 | FDM publishes | Flux Domain Manager polls `/apps/locations` and the global spec list, adds the new IPs to HAProxy backends, DNS wildcard already resolves. An app with no running location row gets no backend yet. Poll interval read 2026-10-13: the fetch loops sleep the server's cache max-age, 30 s by default (5 s when the origin says the data may be stale), the g: pass waits at least 25 s between passes, and one non-g pass was measured at several minutes on a loaded FDM (a code comment cites 479 s). So the floor is tens of seconds after the first copy announces itself and it can be minutes. | tens of seconds to minutes | flux-domain-manager/src/services/flux/dataFetcher.js:L55-L90,L505-L545 ; domainService.js:L120-L145 [VERIFIED-SOURCE (mechanism and intervals); end-to-end delay UNVERIFIED, not timed live] |

Overall the UI says "Deployment time: Up to 45 min after payment". That is a static text label (i18n `core.subscriptionManager.deploymentTimeEstimate` and `upToFortyFiveMinutes`), an estimate: no code computes it or enforces it, and the same table lets a copy wait up to about 2 h (step 10). Never present it as a promise or a guarantee. [src: fluxos-frontend/src/plugins/i18n/locales/en.json:L1482,L1549 ; src/@core/components/SubscriptionManager.vue:L2920,L2938 | VERIFIED-SOURCE]

### 6.2 Who decides where instances go

- There is no central scheduler. Each node decides alone, using the same public data, and publishes a claim. Competing claims are ranked by an ordering function (`utils/instanceOrdering.js`, `compareInstallingClaims`); the exact tie-break rule was not read in detail (UNVERIFIED), and nodes over the instance count remove surplus copies every `removeFluxAppsPeriod` blocks. [src: ZelBack/src/services/appLifecycle/appSpawner.js:25-26,335-515 ; utils/instanceOrdering.js | VERIFIED-SOURCE]
- A node refuses an app when: it is blocked by the signed blocklist; the app is pinned to other nodes; geolocation does not match; HW is insufficient (CPU, RAM, 95% of disk minus locked); the app's external ports are already taken or fail the port test; static IP / datacenter / enterprise rules do not match; the same fault domain already holds its share. [src: appSpawner.js:335-515 ; hwRequirements.js:445-480 ; appPlacement/placementFeasibility.js | VERIFIED-SOURCE] Live example of the first reason, 2026-10-13: 78 single-instance Orbit apps whose owners are on the blocklist are registered but have no running copy (15.3.3). The chain accepts the registration; the nodes decline to run it.
- Fault domains: for apps with synced storage (`r:`, `g:`, `s:`), the spawner limits instances per fault domain (hosting organisation, else allocation block, else /16 network) to `ceil(instances / domains)` or higher as needed. [src: placementFeasibility.js:146-163 ; appSpawner.js:735-760 | VERIFIED-SOURCE]
- No two instances of one app run on the same node IP. Live check: 0 apps have two location rows on one host. [src: https://api.runonflux.io/apps/locations 2026-10-12 | VERIFIED-LIVE] Re-checked 2026-10-13 over 8,792 rows: still 0 apps with a repeated `ip:port` and 0 app-and-host pairs with more than one port. This is an observed outcome, not a rule found in the sources read, and it says nothing about distinct nodes run by one organisation: the 7,078 stats rows carry only 358 distinct `geolocation.org` strings (the two Hetzner spellings alone cover 1,639 nodes), so one hosting organisation or operator runs many nodes, and two copies of an app can share an organisation (fault domains only limit this for synced apps). [src: https://api.runonflux.io/apps/locations ; https://stats.runonflux.io/fluxinfo | VERIFIED-LIVE]
- A node can host up to `maxAppsPerNode: 200` apps. [src: ZelBack/config/default.js:417 | VERIFIED-SOURCE]
- Tier is a soft preference, not a rule: FluxOS no longer has per tier specs for v8; small apps simply land mostly on Cumulus because bigger nodes wait 57 to 117 minutes first. [src: appSpawner.js:866-905 | VERIFIED-SOURCE]

### 6.3 Health and restart

- FluxOS sets Docker restart policy `no` and manages restarts itself (crash backoff ladder 0, 30 s, 5 min, 15 min, 30 min; stable run 10 min resets; 5 automatic restarts in 5 min count as a crash). [src: dockerService.js:1215-1217 ; ZelBack/config/default.js:137-154 | VERIFIED-SOURCE]
- FluxOS does not read Docker `HEALTHCHECK`. A container counts as healthy when it is running; FDM adds an external TCP connect check per port. [src: grep State.Health over ZelBack/src returns only syncthing monitor ; flux-domain-manager/src/services/application/custom.js:5-20 | VERIFIED-SOURCE]
- Nodes test each other's published ports (hourly), and apps whose ports are not reachable make the node enter a DOS state and removal of those apps. [src: appMonitoring/availabilityChecker.js:55-70 | VERIFIED-SOURCE (hourly default 3,600,000 ms; DOS consequence read in dosState usage, not live tested)]
- If a node disappears, its location rows expire at most 7500 s later (125 min); missing instances are then re-spawned elsewhere (up to about 27 min extra wait for synced apps whose peers look unreachable). Clean shutdowns announce themselves and peers drop the rows after 420 s. [src: ZelBack/config/default.js:522-528 ; appSpawner.js:760-805 | VERIFIED-SOURCE]
- Image updates: nodes check for newer images of the same tag every 6 hours and redeploy. So `:latest` can change under you. Read in source 2026-10-13: every `imageUpdateCheckIntervalMs` = 21,600,000 ms each node compares the digest of the image its container runs with the manifest digest the registry returns for the same tag, and when they differ it calls `softRedeploy` (a soft redeploy keeps volume data, 7.3). The first check comes 10 to 30 minutes after the node starts and apps are walked 5 s apart, so nodes do not all redeploy at once. It was not observed live. [src: ZelBack/config/default.js:639-644 ; services/imageUpdateService.js:L13-L21,L209-L250,L321-L340 | VERIFIED-SOURCE (loop, digest comparison, redeploy call); no live observation]

### 6.4 FDM (Flux Domain Manager) and domains

| Item | Fact | Source |
|---|---|---|
| What it is | An HAProxy configurator plus DNS and certificate manager run by the Flux team. Gives every app a domain and load balances to the app's instances. | flux-domain-manager/README.md:5-11 [VERIFIED-SOURCE] |
| Default domain | `<name>.app.runonflux.io` (name lower cased). Staging fleet uses `app2`. DNS for both is a CNAME to an FDM load balancer host. | flux-domain-manager/deployment/fdm_setup.yml:148 ; src/services/domain/index.js:9-30 ; DoH lookup of helloworldparams.app.runonflux.io = CNAME fdm-lb-1-2.runonflux.io [VERIFIED-SOURCE and VERIFIED-LIVE] |
| Per port domain | `<name>_<port>.app.runonflux.io` where `<port>` is the EXTERNAL (published) port, one per port of every component. `<name>.app...` is an alias for the first port. | src/services/domain/index.js:12-29 [VERIFIED-SOURCE] |
| Hyphen pattern | docs also show `your-app-9001.app.runonflux.io` for Orbit webhook payloads (in the Deploy with Git quick start, `https://your-app-9001.app.runonflux.io/webhook`, and the GitHub webhooks page, `https://YOUR-APP-9001.app.runonflux.io/webhook`, as well as deploying-go.md); FDM source only generates underscore patterns. Treat the hyphen form as UNVERIFIED. | flux-docs deploying-go.md:319 vs domain/index.js [DOCS-ONLY vs VERIFIED-SOURCE] |
| Ports it serves | HTTP on 80 (redirects to HTTPS) and HTTPS on 443 for apps in http mode. TCP mode apps (g: synced apps, listed game and chain apps) get a dedicated TCP frontend per port. Port 80/443 are never forwarded as TCP apps. See the next two rows for exactly which apps are in TCP mode and how a TCP port is routed. | src/services/haproxyTemplate.js:140-190 [VERIFIED-SOURCE] |
| Which apps are in TCP mode | (a) every app where ANY component's `containerData` contains `g:` (the check is `containerData.includes('g:')`); then EVERY port of EVERY component of that app is TCP mode and the HAProxy health check is off; (b) by name: names containing `bittensor` or `devstack`, names starting `kaspanode` or `kaspatestnet`, and a short hard-coded list of `<port>.<component>.<app>` entries for a few Bitcoin, OpenVPN, pgbouncer, OnlyOffice, MeshCentral and AdGuard apps. Anything else is http mode. An app can be in both worlds: the TCP front door is added to, not instead of, the HTTP backend on `<name>.app.runonflux.io` (80/443), except for apps whose name matches the Minecraft rule (`mcf`, `*minecraft*`), which get the TCP side only. | flux-domain-manager/src/services/flux/dataFetcher.js:L216-L220 ; services/application/custom.js:L1-L60,L99-L115 ; services/haproxyTemplate.js:L496-L540 ; config/appsConfig.js:L8 [VERIFIED-SOURCE] |
| How a TCP port is routed (read 2026-10-13) | For each public port of a TCP-mode app FDM writes `frontend tcp_app_<port>` listening on `0.0.0.0:<port>` in `mode tcp` (not on 80 or 443). Several apps can share one number, because FluxOS only keeps ports unique on a node, so FDM merges them per port, and the first app (in FDM's list order) whose ACL matches gets the connection. Each app contributes three kinds of ACL: (1) the TLS SNI host name equals the app's domain (`req.ssl_sni`); (2) a Minecraft handshake host name: on port 25565 only, a Lua script (`lua.mc_handshake`) parses the handshake into `txn.mc_host`; on every other port there is no Lua, but byte-offset ACLs (`req.payload(...) -m sub <name>.` at offsets 1 to 8) look for the app name or full domain near the start of the first packet; (3) if nothing matches, `default_backend` is the FIRST app registered on that port. The frontend waits up to 5 s (`tcp-request inspect-delay 5s`) for the client's first bytes, so a protocol where the server speaks first (many database and mail protocols) waits those 5 s and then lands on the default backend. So a g: app on a public port other than 25565 DOES get a TCP front door on that same port number of the FDM load balancer, reachable as `<name>.app.runonflux.io:<port>`, and it is routed to the elected primary; it is routed correctly among several apps on that port only when the client sends a TLS ClientHello with the name or a Minecraft handshake carrying the name. Not probed live: whether the production load balancers accept connections on every such port was not tested (only the template was read). | flux-domain-manager/src/services/haproxyTemplate.js:L156-L184,L299-L316,L508-L540 ; deployment/haproxy_minecraft.lua [VERIFIED-SOURCE; production reachability UNVERIFIED] |
| TLS | Wildcard certificate for app domains; HAProxy terminates TLS and speaks plain HTTP to the node unless a custom config says `ssl`. | domain/cert.js:20-24 ; haproxyTemplate.js:276-290 [VERIFIED-SOURCE] |
| Load balancing | `balance roundrobin`; with more than one instance, a cookie `FDMSERVERID` pins a client to one instance for up to 8 hours; `retries 3`, `option redispatch`. | haproxyTemplate.js:214-228,272 [VERIFIED-SOURCE] |
| Health check | TCP connect check to the instance port every 3 s, down after 2 failures, up after 2 successes (about 6 s to eject, 6 s to return). | haproxyTemplate.js:289 ; application/custom.js:5-20 [VERIFIED-SOURCE] |
| Timeouts | request 15 s, server 25 s (20 s for synced apps), client 120 s, connect 10 s | haproxyTemplate.js:64-66,260-270 [VERIFIED-SOURCE] |
| Primary/standby (`g:`) apps | The app's backend lists exactly ONE server, the elected primary (the `selectGPrimaries` pass keeps one IP per g: app and `addConfigurations` is called with that single IP); standby nodes are not in the backend at all (the `backup` marking is for the `runonflux/shared-db` case, `isRdata`, not for g:). The primary is the node that is actually running the app's container, found by asking nodes what they run. FDM keeps the previous primary (sticky) and moves away only after at least 3 consecutive failed checks AND 90 s of unhealthiness; passes are at least 25 s apart. Node side, the g: election runs every 30 s, and a standby at list position i waits about i x 3 minutes before it may start an empty primary. So a failover is "minutes", not seconds. | domainService.js:L36-L41,L120-L142,L831-L1000,L1802 ; advancedWorkflows.js:L4838-L4840,L4975-L5530 ; config/default.js:L645-L646 [VERIFIED-SOURCE; timing not measured live] |
| Custom domains | Put the domain (comma separated allowed) into the component `domains[i]` matching `ports[i]`. FDM also adds `www.<domain>` and `test.<domain>`. It strips `http(s)://`. Domains ending in the FDM app domain are ignored. | domain/index.js:35-70 [VERIFIED-SOURCE] |
| Custom domain DNS | Create a CNAME from your domain to `<name>.app.runonflux.io` (an A record to FDM IPs also works; FDM looks at the domain's A answer). | flux-docs custom-domain-setup.md ; domain/cert.js:78-92 [DOCS-ONLY and VERIFIED-SOURCE] |
| Custom domain TLS | FDM requests a Let's Encrypt certificate with certbot HTTP-01 when the domain resolves to the FDM group IPs; otherwise it skips with a back-off ("dns not pointed"). Renews when under 30 days left. | domain/cert.js:51-190 [VERIFIED-SOURCE] |
| Cloudflare proxy | Docs tell users to enable the orange cloud. With the proxy on, the domain resolves to Cloudflare IPs, so FDM sees "not pointed" and issues no certificate; Cloudflare's edge certificate serves visitors and HAProxy only needs to accept the Host header. Port 80 on FDM redirects to HTTPS, so Cloudflare SSL mode "Flexible" can loop; use "Full". This last point is inference. | domain/cert.js:78-92,160-175 ; haproxyTemplate.js:92-99 ; docs custom-domain-setup.md \| VERIFIED-SOURCE for FDM logic; inference UNVERIFIED for Cloudflare mode |
| CORS | FDM adds `Access-Control-Allow-Origin: *` when the app did not. | haproxyTemplate.js:80-81,94-95 [VERIFIED-SOURCE] |
| WebSocket | HAProxy `timeout tunnel` is not set on app backends, so long idle websockets fall back to client/server timeout (120 s). UNVERIFIED in practice. | haproxyTemplate.js:64-66 [VERIFIED-SOURCE (config); behaviour UNVERIFIED] |

### 6.5 How many instances are "enough"

- Minimum is 1 for v8 (3 for v7 and older). [src: appValidator.js:803-813 | VERIFIED-SOURCE]
- Price is nearly linear in instances (section 4), so redundancy is a straight cost choice.
- Live evidence (snapshot 2026-10-12, includes apps still being deployed): apps requesting 1 instance have 78 of 352 (22%) with zero running copies; apps requesting 2 have 7 of 1140 (0.6%) with zero; apps requesting 3 have 8 of 436 (1.8%). Overall 151 of 2078 apps run fewer copies than requested, 96 run none. [src: https://api.runonflux.io/apps/globalappsspecifications and /apps/locations 2026-10-12 | VERIFIED-LIVE] Re-read 2026-10-13: 1 instance 78 of 351 (22 percent) with no running copy, 2 instances 5 of 1,147, 3 instances 8 of 434; 142 of 2,084 apps below their requested count and 94 with none. [src: same calls | VERIFIED-LIVE] CORRECTED 2026-10-13 (15.3.3): the 78 single-instance apps with no copy are ALL Orbit deployments of the Starter size whose owners are on the signed blocklist, so the nodes refuse them; the other 122 single-instance apps have 0 without a running copy. The 22 percent is therefore not a measure of how fragile one instance is. Do not quote it. [src: same calls; policy-signed.json 2026-10-13 | VERIFIED-LIVE]
- Distribution of requested instances: 2 instances 1140 apps, 3 instances 434, 1 instance 352, 100 instances 25, 30 instances 24. [src: same | VERIFIED-LIVE]
- Failover cost: the load balancer drops a dead instance in about 6 s; replacement spawning can take up to 125 min (location TTL) plus install time. Therefore capacity must be provisioned for N-1 running, not for the replacement. [src: haproxyTemplate.js:289 ; config/default.js:522 | VERIFIED-SOURCE]
- Guidance supported by the above (author judgement, labelled as such): hobby or stateless demo 1 to 2 instances; anything customers rely on 3 or more across different geolocations; synced data apps (`r:`, `g:`) at least 2 (primary and standby), as the Marketplace templates do (Nextcloud 2, n8n 3 for etcd quorum). The reason for 2 or more is the failover cost above (a single node is a single point of downtime), not a measured failure rate of 1-instance apps. [src: flux-docs nextcloud.md:20 ; n8n.md:412 | DOCS-ONLY for templates; recommendation is a guess]

### 6.6 The clocks around payment and deployment (settled 2026-10-13)

Several different clocks get confused. They do not share a start and most of them are not counted by the protocol.

| Clock | Value | Where it starts and what it does | Kind | Source |
|---|---|---|---|---|
| Signature timestamp window | at most 1 h old, at most 5 min in the future, measured by the node that receives `/apps/appregister` | The timestamp is the one in the message you signed. Outside the window the node answers "Message timestamp is over 1 hour old" or "from future". It only gates the registration call. | protocol | appValidator.js:L1712-L1722 |
| Temporary message lifetime | 3,600 s (`tempMsgTtlS`; the stored record also carries `expireAt` = received + 60 min) | Starts on EACH node when that node receives the registration message, which is within seconds of the registration call (step 5 "Registered"), not at signing and not when the payment screen appears. A node deletes its copy after that hour; a payment confirmed after that finds no message to link. The node asks its peers for the message twice, 60 s apart, and then gives up; peers hold their temporary copies for the same hour, so in the code read there is no later recovery (not tested live). | protocol | messageStore.js:L202-L213 ; serviceManager.js:L351-L356 ; messageVerifier.js:L654-L660,L800-L815 |
| UI "Payment window: 30 minutes remaining" (and the marketplace "valid for the next 30 minutes") | 30 min | A fixed text string in the Review step's payment card (`paymentWindowTime`), shown once the optional test install has finished without error. It is not a counter and nothing in the front end ties it to the 3,600 s message lifetime. The marketplace dialog computes "now + 30 minutes" when the payment step is first drawn. So the real deadline is 60 min after registration; 30 min is the UI's conservative promise. | UI text | SubscriptionManager.vue:L2860,L2920 ; InstallDialog.vue:L2858-L2862 ; en.json:L1478-L1479,L1548 |
| UI payment and deployment watcher | 30 min, polling every 30 s | Starts when you click pay with Stripe, PayPal, ZelCore or SSP (and immediately for a free update). It walks three phases: the chain shows an app spec whose hash equals your registration hash (payment confirmed), a node reports it is installing, and `/apps/location/<name>` returns at least one running copy. At the third phase it shows "Deployment Successful!", so that label means ONE copy is running, not all of them. If 30 minutes pass first it shows "Payment monitoring timed out. Please check your application status." and stops watching; the deployment itself continues. | UI behaviour | SubscriptionManager.vue:L10515-L10690 |
| UI "Deployment time: Up to 45 min after payment" | 45 min | A static text string (`deploymentTimeEstimate`). No timer, no code that enforces it. An estimate, not a guarantee; see 6.1 steps 9 to 11 for why a copy can take about 2 h. | UI text, estimate | en.json:L1482,L1549 |
| UI "usually takes 1-3 minutes" | 1 to 3 min | Static text for the wait until a node starts installing (`installationStartTime`). | UI text, estimate | en.json:L1568 |
| FluxCloud payment link validity (fiat) | 30 min | Text only in the sources read ("valid for the next 30 minutes"); what the card bridge itself enforces was not observed. | UI text; enforcement UNVERIFIED | InstallDialog.vue:L1040 |
| Location record lifetime | 7,500 s, announce roughly every 3,600 s | Per running copy; see 6.1 step 12 and 6.5. | protocol | config/default.js:L522 |

Plain reading for a lesson: register, then pay quickly. 30 minutes is what the screen says, 60 minutes after registration is where the node-side clock ends, and the "up to 45 minutes" is a hope about what happens after payment.

## 7. Persistence (`containerData`)

### 7.1 Grammar

`containerData` is a string of mount definitions separated by `|`. The first definition is the PRIMARY mount, and only it may carry sync flags. Max 200 characters, at least 2 (use `/tmp` when no data is wanted). [src: ZelBack/src/services/utils/mountParser.js:1-18,155-189,370-409 ; appValidator.js:730-732,770-772 | VERIFIED-SOURCE]

| Form | Meaning | Notes |
|---|---|---|
| `/path` | primary mount, no sync (local volume on that node) | path must be absolute, no `..`, no NUL |
| `r:/path` | primary mount, synced with Syncthing between instances, container is started under sync supervision (run after readiness) | flag letters are `r`, `g`, `s`; combinations like `rg` parse but have no documented meaning (UNVERIFIED) |
| `g:/path` | primary mount in primary/standby mode: one elected instance runs, the others hold a synced copy | FDM routes only to the primary |
| `s:/path` | primary mount synced by Syncthing with no election and no readiness gating by the sync state machine | meaning inferred from code, not documented (UNVERIFIED) |
| `m:<subdir>:<path>` | extra directory on the same volume, sibling of `appdata` | subdir has no `/`, `..`; reserved names refused |
| `ml:<subdir>:<path>` | extra directory that is never replicated (asserted in `.stignore`) | for caches, game downloads |
| `f:<file>:<path>` | single file mount, created empty | app must initialise it |
| `<n>:<path>` | another component's primary mount (component index `n`) | only lower indices |
| `c:<n>:<subdir>:<path>` | another component's directory | |
| `cf:<n>:<file>:<path>` | another component's file | |

Example from source: `r:/data|m:logs:/var/log|f:config.yaml:/etc/app.yaml`. Duplicate container paths or duplicate subdir/file names are rejected. [src: mountParser.js:388-402 ; ZelBack docs docs/multiple-mounts-guide.md:56-200 | VERIFIED-SOURCE]

Sync flags on the primary apply to the whole component folder: `appdata/` and every `m:` and `f:` sibling are replicated (except `ml:`). [src: docs/multiple-mounts-guide.md:`Syncthing Flags Apply to Entire Component Folder` ; mountParser.js:236-269 | VERIFIED-SOURCE]

Live usage: of the 1094 components visible in plain specs (encrypted apps hide theirs), primary mounts are plain 644, `g:` 312, `r:` 111, `s:` 27; 184 components use more than one mount. [src: https://api.runonflux.io/apps/globalappsspecifications 2026-10-12 | VERIFIED-LIVE]

### 7.2 What each prefix guarantees

| Prefix | Data lives | Survives container restart | Survives node loss | Consistency model | Source |
|---|---|---|---|---|---|
| none | one ext4 volume image on that node only | yes | no. The replacement instance starts empty on another node | each instance has independent data; instances diverge | [mountParser.js:155-189 ; volumeService.js:51-110 VERIFIED-SOURCE] |
| `r:` | volume on every instance, replicated by Syncthing (all instances active) | yes | yes if at least one instance with current data remains | eventually consistent. Every instance writes; conflicts possible. First instance (leader) starts with its own data; later ones start receive-only, sync to 100%, then become send-receive | [syncthingFolderStateMachine.js:1395-1425 ; syncthingMonitorHelpers.js:264-277 ; syncthingMonitor.js:334 ; docs/syncthing-health-monitor.md:305-322 VERIFIED-SOURCE] |
| `g:` | volume on every instance, only the primary runs the `g:` component's container (other components of the same app are NOT stopped on standby nodes; see the note below) | yes | yes after re-election (FDM and nodes elect a new primary after a delay of minutes: FDM waits for 3 failed checks and 90 s, a standby waits about 3 minutes per place in the election order) | single writer, standby copies receive-only | [advancedWorkflows.js:2325-2346 ; domainService.js:640-830 ; config/default.js:645-646 VERIFIED-SOURCE]; Nextcloud doc: "one of the standby instances automatically takes over ... after a short delay" [DOCS-ONLY] |
| `s:` | volume on every instance, synced | yes | yes | same as `r:` without the start gating | [syncthingMonitorHelpers.js:264-268 VERIFIED-SOURCE; semantics UNVERIFIED] |

Multi-component apps with a `g:` component (read 2026-10-13, settles the "what happens to the other components" question): the node-side election works per `g:` component. It starts and stops only that component's container, and the source says so in a comment ("Stop only the g: component on this standby node. Non-g siblings (e.g. a DB cluster component that needs all instances running) must keep running"). Only the first `g:` component of an app is the election subject. FDM, however, is app-wide: if ANY component has `g:`, FDM sends EVERY public port of EVERY component to the one primary node (6.4). So the other components keep running on all instances but only the primary node's copy of them receives traffic through the app domain. What a non-`g:` component does with its own data on a standby (its volume is plain and local) is just the plain-mount rule. [src: ZelBack/src/services/appLifecycle/advancedWorkflows.js:L5094-L5120,L5470-L5490 ; flux-domain-manager/src/services/application/custom.js:L41-L44 ; services/domainService.js:L1795-L1803 | VERIFIED-SOURCE; behaviour not observed live]

A plain mount, including `/tmp`, is a local volume: `/tmp` is not special in the validator or the volume code. It is bound from `/apps/flux<component>_<app>/appdata` like any other path, so it survives a container restart and a soft redeploy and is lost with the node, a hard redeploy, cancel and expiry. "Use /tmp when no data is wanted" is the validator's own wording for "I have no data folder" (the message is "Flux App container data folder not specified ... If no data folder is whished, use /tmp"), and the FluxCloud Simple form puts `/tmp` there when "This app stores data" is off. So "/tmp is not persistent" is a convention about what to put there, not a property of the mount. [src: appValidator.js:L647,L771 ; utils/volumeConstructor.js:L100-L135 ; fluxos-frontend/src/@core/components/SimpleDeploy.vue:L640-L672 | VERIFIED-SOURCE]

The FluxCloud docs call plain volumes "non-persistent". That is misleading: the data survives restarts and soft redeploys on the same node, it is just not replicated. It is destroyed by Remove, Hard Reinstall, expiry and cancel. [src: flux-docs components.md ("These are non-persistent and not synchronized") vs flux-docs control.md (Soft vs Hard Reinstall) | DOCS-ONLY]

### 7.3 Limits and mechanics

| Item | Fact | Source |
|---|---|---|
| Size | `hdd` GB per component; implemented as a pre-allocated file (`fallocate -l <hdd>G`) formatted ext4 and loop mounted at `/apps/flux<component>_<app>/` (`appdata/` plus siblings). All mounts of the component share that size. Out of space shows as ENOSPC inside the container. | utils/volumeService.js:51-110 ; utils/appUtilities.js:166-195 ; docs/multiple-mounts-guide.md:`Usage Metrics and Storage` [VERIFIED-SOURCE] |
| Container root filesystem | Docker rootfs capped at 10 GB (`hddFileSystemMinimum`) when the node's Docker uses XFS with project quota; layers beyond that are not guaranteed. Not part of `hdd`. | dockerService.js:1240-1252 ; config/default.js:506 [VERIFIED-SOURCE; node dependent] |
| Memory | `ram` MB limit plus 2000 MB swap | dockerService.js:1203-1204 [VERIFIED-SOURCE] |
| Log size | json-file driver, 4 files, about 20 MB total unless log shipping is configured | dockerService.js:1139-1158 [VERIFIED-SOURCE] |
| Soft vs hard redeploy | Soft preserves volume data; hard recreates it from scratch (new `fallocate`+`mke2fs`). A structure change to a v8 spec escalates soft to hard. | advancedWorkflows.js:1449-1500 ; containerHealthMonitor.js:20-40 ; flux-docs control.md [VERIFIED-SOURCE and DOCS-ONLY] |
| Sync scope control | `.stignore` is derived from the spec so all nodes agree | mountParser.js:236-269,489-525 [VERIFIED-SOURCE] |
| Large synced volumes | initial sync must reach 100 percent before a new instance serves; stalled syncs are nudged after 3 min and removed after 20 min of evidence | config/default.js:697-700 [VERIFIED-SOURCE] |
| Permissions | Fixed to the container's expected owner by `fixAppdataPermissions` before a node becomes sync leader. Images that run as a non-root user may still need their own `chown` on start (symptom: "permission denied" on `/data`). | syncthingFolderStateMachine.js:1397-1398 [VERIFIED-SOURCE; user-level behaviour UNVERIFIED] |
| Flux Storage links | `F_S_ENV=<url>` / `F_S_CMD=<url>` env or command entries load env or commands from `storage.runonflux.io` over https | utils/fluxStorage.js:19 ; config/default.js:396 [VERIFIED-SOURCE] |

### 7.4 Backups and restore

- Manual backup per component from the app's Backup & Restore tab: create, list (component, created, expires, size), download, remove. Backups are made without stopping the app. [src: flux-docs/docs/fluxcloud/applications/management/manage-app/backup-and-restore.md | DOCS-ONLY]
- Restore sources: FluxDrive, remote URL, uploaded file. Restore overwrites current state. [src: same | DOCS-ONLY]
- Automatic weekly backups are created and maintained while the app is active (UI text); the docs page says only manual backups exist. UI i18n wins over the docs page. [src: fluxos-frontend i18n core.backupAndRestore.backupListDescription (see section 9.7) | VERIFIED-SOURCE] BUT (2026-10-13): no weekly or other scheduler for backups exists in the FluxOS v8.20.0 source read (searched for weekly, automatic, schedule, interval, cron near the backup code), so the "automatic weekly" sentence is UI text that this clone does not back up. Treat it as unverified and keep telling people to take their own backup.
- Where backups live (settled 2026-10-13): a local backup is `<volume>/backup/local/backup_<component>.tar.gz` inside the component's own volume on the node (the volume root is also the component's Syncthing folder, and `/backup` is on the Syncthing ignore list, so it is NOT replicated to other instances). So a backup held on a node is lost with that node, with the volume (hard redeploy, cancel, expiry) and it counts against the component's `hdd`. Keeping one elsewhere means download it or upload it to FluxDrive. [src: ZelBack/src/services/backupRestoreService.js:L69-L123 ; services/appSystem/volumeReservedNames.js:L103-L128 ; services/appLifecycle/advancedWorkflows.js:L2813-L2828 | VERIFIED-SOURCE]
- Code: `backupRestoreService.js` implements backup and restore on the node. [src: ZelBack/src/services/backupRestoreService.js | VERIFIED-SOURCE (existence); API details in section 10 fragment of OpenAPI]
- Backups are deleted with the app. Download before cancel or expiry. [src: backup-and-restore.md | DOCS-ONLY]

## 8. Networking

### 8.1 Ports

| Topic | Fact | Source |
|---|---|---|
| Mapping | `ports[i]` (host, external) maps to `containerPorts[i]` (inside container). Both TCP and UDP are published. | dockerService.js:985-1004 [VERIFIED-SOURCE] |
| Range | 1 to 65535 minus banned list (section 3.4); max 5 ports per component; unique across the app and, on a node, free | [VERIFIED-SOURCE] |
| Privileged and "enterprise" ports | 1-1023, 8080, 8081, 8443, 6667 are accepted but cost USD 2 each (config writes the fee range as `0-1023`, but port 0 is refused: ports must be 1 to 65535, see 3.4). They are not restricted to enterprise specs. Port 80/443 on the app itself are not special. | config/default.js:410 ; appUtilities.js:104-120 [VERIFIED-SOURCE]; port 0 refusal [VERIFIED-LIVE 2026-10-13] |
| Binding inside the container | The process must listen on `0.0.0.0` (all interfaces) on the container port; Docker forwards from the host port to the container's bridge IP, so a process bound to `127.0.0.1` is unreachable. | Docker port publishing semantics; PortBindings in dockerService.js:994-1004 [VERIFIED-SOURCE (publishing) ; consequence is standard Docker behaviour] |
| Node reachability | Each node tests its apps' ports from other nodes; failing ports lead to DOS state and removal of the instance | appMonitoring/availabilityChecker.js [VERIFIED-SOURCE] |
| UPnP nodes | `upnpBannedPorts: []` (no extra restrictions) | config/default.js:411 [VERIFIED-SOURCE] |
| Domains per port | `domains[i]` is a comma separated list of custom domains for `ports[i]` | section 6.4 |
| Reaching your instances directly | `http://<node-ip>:<external-port>` for any instance listed by `GET /apps/location/<name>` | [VERIFIED-SOURCE (ports published on node)]; location endpoint [VERIFIED-LIVE] |
| FDM and non-HTTP | FDM front doors are 80 and 443 (HTTP/S). Raw TCP/UDP apps (game servers, nodes) are used by node IP and port. Apps FDM puts in TCP mode (every app with a `g:` component, and a short list of names, 6.4) also get a TCP listener on their own public port number at the FDM load balancer, routed to the elected primary; there is no UDP listener. | haproxyTemplate.js:140-190,488-540 ; application/custom.js:1-60 [VERIFIED-SOURCE] |

### 8.2 Between components (and apps)

- Each app gets its own docker bridge network `fluxDockerNetwork_<app>`; components are attached with an automatically assigned static IP inside it. [src: dockerService.js:772-830,1218-1232 | VERIFIED-SOURCE]
- Components resolve each other by container name `flux<component>_<app>` (Docker DNS). Example: `fluxmysql_mysql01`. The bare component name is only the container's own hostname and is NOT a documented way to reach another component. [src: dockerService.js:48-57,1192 ; flux-docs shared-database/component.md:156 | VERIFIED-SOURCE and DOCS-ONLY]
- Use the container port (not the external port) between components, over the internal network; there is no need to expose it in `ports`. A database that is not exposed in `ports` is unreachable from outside the app. [src: dockerService.js:994-1004 | VERIFIED-SOURCE (published ports are the only ones exposed); the "not needed" advice is Docker semantics]
- Cross-app linking: put `networkWith:[appA,appB]` in the app `description` (brackets required, comma separated). Before install the node verifies every named app is installed on the same node with the same owner, then attaches the app's containers to those apps' networks so they can reach `flux<component>_<linkedApp>`. Install fails if a linked app is not local. Purely local node feature; no spec field. [src: ZelBack/src/services/appLifecycle/appNetworkLinker.js:1-80 | VERIFIED-SOURCE]
- Outbound internet from containers works normally (NAT through the bridge). UNVERIFIED in a live deployment; no outbound firewall code was seen in dockerService.
- Host service: containers have `fluxnode.service` mapped to `169.254.43.43`, and `http://fluxnode.service:16101/hostinfo` returns the host public IP, collateral based host id, geolocation, benchmark data and the calling app's name. Only reachable from Flux app containers. [src: dockerService.js:1220 ; ZelBack/config/default.js:31 ; docs/flux-node-service.md:14-60 | VERIFIED-SOURCE]

### 8.3 Environment variables

| Item | Fact | Source |
|---|---|---|
| Format | `KEY=value` strings, max 20 per component, 400 chars each | appValidator.js:733-740 [VERIFIED-SOURCE] |
| Injected by Flux | `FLUX_APP_NAME=<app name>` and `FLUX_NODE_HOST_IP=<node public ip>` (appended last, override same names) | dockerService.js:1297-1312 [VERIFIED-SOURCE] |
| Visibility | In a non-enterprise app, env vars and commands are PUBLIC: anyone can read them from `GET /apps/appspecifications/<name>`. Use `enterprise` for secrets | flux-docs components.md ; https://api.runonflux.io/apps/appspecifications/<name> [DOCS-ONLY and VERIFIED-LIVE (spec is public)] |
| Secrets in v7 | `secrets` field PGP encrypted to chosen nodes; REMOVED in v8 (whole `compose` is encrypted instead) | appValidator.js:369-377,1045-1053 [VERIFIED-SOURCE] |
| Log shipping | `LOG=COLLECT` on one component and `LOG=SEND` on others ship container logs (GELF) to the collector inside the app | dockerService.js:1078-1100,1130-1158 [VERIFIED-SOURCE] |
| External storage | `F_S_ENV` / `F_S_CMD` | section 3.6 |
| Not injected | no node id, no instance index, no port map. Use `/hostinfo` if you need node data | [VERIFIED-SOURCE by absence] |
| Docker env semantics | `commands` becomes the container `Cmd` array (arguments after the image ENTRYPOINT), not a shell script | dockerService.js:1197 [VERIFIED-SOURCE] |

### 8.4 Enterprise port rules

- Pricing: USD 2 per port in the enterprise port set, regardless of enterprise flag. [src: appUtilities.js:104-120 | VERIFIED-SOURCE]
- Placement: the spawner does not restrict by port range; the port test must pass on the node. [src: appSpawner.js:640-700 | VERIFIED-SOURCE (no range filter seen)]
- Enterprise (encrypted) apps hide ports inside the encrypted blob; node port conflict checks decrypt the spec first. [src: appNetwork/portManager.js:85-115 | VERIFIED-SOURCE]

## 9. FluxCloud (cloud.runonflux.com) and the older FluxOS dashboard (home.runonflux.io)

Path shorthands used in source tags:
- `FE` = the fluxos-frontend repo (clone `src/fluxos-frontend`) (Flux Gravity web UI, last merge Oct 12 2026 15:22 +0100)
- `DOCS` = flux-docs repo, `docs/fluxcloud`
- `BE` = the flux (FluxOS) repo (FluxOS backend v8.20.0)
- `i18n` = `FE/src/plugins/i18n/locales/en.json` (exact on-screen English strings)
- Raw downloads were kept outside this repo.
- Inside tables a literal pipe in a source tag is written `\|`.

> Reading note: sections 9, 10 and 13 were researched as separate work packages. Their internal cross references ("section 4.4", "section 0 row 2") use their own local numbering; inside this file prefix them with 9., 10. or 13. respectively.

### 9.0 The ten things most likely to be wrong in old lesson content

| # | Old belief or what docs say | What source and live site show today | Tag |
|---|---|---|---|
| 1 | home.runonflux.io is a separate "FluxOS dashboard" | home.runonflux.io and home.runonflux.com both answer `301` to `https://cloud.runonflux.com/` and keep the path (`/apps/management` goes to `https://cloud.runonflux.com/apps/management`). FluxCloud IS the old dashboard UI, one codebase. | [src: curl -I https://home.runonflux.io, https://home.runonflux.io/apps/management, https://home.runonflux.com/marketplace \| VERIFIED-LIVE] |
| 2 | Minimum instances is 3 (docs `general.md`, calculator FAQ) | Spec v8 apps may run 1 instance (backend `minimumInstancesV8: 1` from block 2176519; chain height today 3,031,428). Simple mode default is 1 copy, the calculator allows 1 to 100, updates of legacy (v<8) apps stay at 3. | [src: BE/ZelBack/config/default.js:413-415; BE/ZelBack/src/services/appRequirements/appValidator.js:804-809; FE/src/@core/components/SubscriptionManager.vue:4509-4523 \| VERIFIED-SOURCE] |
| 3 | Wizard = General, Geolocation, Priority Nodes, Components, Review | Default entry is a new **Simple** mode (one page "Deploy an app", button "Review & deploy"). The tab wizard is **Advanced** mode: General, Geolocation, (Enterprise/Priority Nodes, only for some users), Components, then Review & Validate. | [src: FE/src/pages/apps/register/configure.vue; FE/src/@core/components/SimpleDeploy.vue; FE/src/@core/components/SubscriptionManager.vue:4254-4280 \| VERIFIED-SOURCE] |
| 4 | App name "min 3 chars, alphanumeric only"; description "min 10 chars" | Neither minimum exists in current source. Backend: v8 names up to 63 chars, letters, digits and inner hyphens; v<8 up to 32, letters and digits; cannot start with `zel` or `flux`; description max 256. Component names: letters and digits only, max 63. | [src: BE/ZelBack/src/services/appRequirements/appValidator.js:564-593, 690-716; BE/ZelBack/src/services/utils/appConstants.js:36 \| VERIFIED-SOURCE] |
| 5 | File Changes "Kind: 0 = Directory, 1 = File" | The UI itself says `Kind: 0 = Modified, Kind: 1 = Added, Kind: 2 = Deleted`. Docs are wrong, source wins. | [src: i18n pages.apps.manage.messages.fileChangesDescription \| VERIFIED-SOURCE] |
| 6 | Static IP $0.40, Enterprise $0.80 (+$0.40 per enterprise port) in `general.md` | Live rate card: static IP 2, enterprise scope 4, enterprise port 2 (USD per month before the divide by 3). The docs `cost-calculator.md` already says $2.00 / $4.00 / $2.00. `general.md` is stale. | [src: https://stats.runonflux.io/apps/getappspecsusdprice \| VERIFIED-LIVE] |
| 7 | "Prepaid, non-refundable" (docs) | Mixed. Subscription tab: "Refunds are not automatic. If you believe you are entitled to a refund, you must open a support ticket to request one." Marketing pages (register landing, WordPress, FluxDrive, Orbit, game hub) advertise a "30-Day Money-Back Guarantee" on the first paid period. Quote both, never promise automatic refunds. Orbit's guarantee covers "your first paid month" (15.3.10; confirmed 2026-10-13). | [src: i18n core.subscriptionManager.cancelRefundNotice, pages.apps.register.landing.benefits.guarantee; https://runonflux.com/apps/orbit \| VERIFIED-LIVE] |
| 8 | Hosting portals live at minecraft.runonflux.com, orbit.runonflux.com, wordpress.runonflux.com | Those subdomains now `301` to `https://runonflux.com/games/<game>` and `https://runonflux.com/apps/<app>`. Marketplace tiles carry a `redirectUrl` to those pages. Re-checked 2026-10-13: `orbit.runonflux.com` still answers 301 to `https://runonflux.com/apps/orbit`; `https://orbit.app.runonflux.io` still serves an older copy of the page (HTTP 200, `last-modified` 2026-09-11, "Free forever tier"), which must not be linked (15.3.1). | [src: curl -I https://orbit.runonflux.com, https://minecraft.runonflux.com, https://wordpress.runonflux.com; https://api.marketplace.runonflux.io/api/v1/marketplace/apps \| VERIFIED-LIVE] |
| 9 | Orbit = a Docker image you configure with env vars, runtime installs, `config.json` | Docs still say that. The live Orbit page describes a managed service: connect a GitHub/GitLab/Bitbucket repo, Nixpacks detection, container build, webhook redeploy, rollback, MCP server, plans Starter/Standard/Pro/Custom. The `runonflux/orbit` image still exists (updated 2026-09-28), so the docs flow can still work. SETTLED 2026-10-13 (15.3.1): both statements describe the same thing, because the managed product registers that image with the same environment variable names; 235 live apps do. | [src: https://runonflux.com/apps/orbit; https://hub.docker.com/v2/repositories/runonflux/orbit \| VERIFIED-LIVE] |
| 10 | Game servers are only the 16 titles in docs | The marketplace API lists 28 "NewGames" templates plus 21 legacy size-variant "Games"; the runonflux.com games hub lists 20 titles. Docs omit ARK, 7 Days to Die, Hytale, Arma Reforger, RuneScape Dragonwilds, Core Keeper, Euro/American Truck Simulator, Team Fortress 2, The Isle, tModLoader. | [src: https://api.marketplace.runonflux.io/api/v1/marketplace/apps; https://runonflux.com/games/ \| VERIFIED-LIVE] |

---

### 9.1 Where things live (domains and redirects)

| Host | Status 2026-10-12 | Notes | Tag |
|---|---|---|---|
| https://cloud.runonflux.com | 200, Cloudflare, SPA (Vue 3 + Vuetify). Title "FluxCloud - Decentralized Web3 Cloud Infrastructure" | Canonical UI. `last-modified: Mon, 12 Oct 2026 15:28:31 GMT` | [src: curl -I https://cloud.runonflux.com \| VERIFIED-LIVE] |
| https://cloud.runonflux.io | `301` to https://cloud.runonflux.com/ | | [src: curl -I https://cloud.runonflux.io \| VERIFIED-LIVE] |
| https://home.runonflux.io and https://home.runonflux.com | `301` to https://cloud.runonflux.com/ (path preserved) | The "old FluxOS dashboard" domain no longer serves its own UI | [src: curl -I \| VERIFIED-LIVE] |
| each FluxNode `http://<ip>:16126` | Same frontend, served from the node's `CloudUI/` folder (downloaded from `RunOnFlux/fluxos-frontend` releases). UI port is API port minus 1 | This is where the operator "Administration" menu matters | [src: BE/scripts/update-cloudui.sh:1-30; BE/ZelBack/config/default.js:30 \| VERIFIED-SOURCE] |
| https://runonflux.com/apps/* and /games/* | 200, separate React site ("Flux Apps" / "Games" hub) with own checkout and dashboards | Orbit, WordPress, n8n, OpenClaw, Hermes and all game portals. Footer `v1.1.101` on 2026-10-13 (`v1.1.100` on 2026-10-12; a build label, not a fact) | [src: https://runonflux.com/apps/orbit, https://runonflux.com/games/ \| VERIFIED-LIVE] |
| https://mcp.runonflux.com/mcp and https://mcp.runonflux.io/mcp | Hosted Flux Cloud MCP server: stateless, no authentication, GET returns 405, POST only; reports version 0.2.2 on 2026-10-13 (15.1.1, 15.1.2) | Not the Orbit MCP server (`https://runonflux.com/apps/mcp`, 15.4) | [src: curl -I; GET /healthz on both hostnames 2026-10-13 \| VERIFIED-LIVE] |

In-app client redirects: `/fluxdrive` to `/flux-drive`, `/cost_calculator` to `/cost-calculator`, `/dashboards/home` to `/`. | [src: FE/src/plugins/1.router/additional-routes.js \| VERIFIED-SOURCE]

Current routes (for linking): `/apps/register`, `/apps/register/configure`, `/apps/management`, `/apps/manage/<appName>`, `/marketplace`, `/marketplace/games`, `/cost-calculator`, `/flux-drive`, `/dashboards/overview`, `/dashboards/resources`, `/dashboards/locations` (menu label "Map"), `/dashboards/rewards`, `/dashboards/list` (Node List page exists but has no menu entry), `/xdao-app`. Old docs paths like `home.runonflux.io/dashboard/map` are not routes any more. | [src: FE/src/pages/**; FE/src/navigation/vertical/*.js \| VERIFIED-SOURCE]

Note: the SPA answers `200` for any unknown path (client-side 404), so a 200 from curl does not prove a route exists.

---

### 9.2 Login options

The "Login" button (left menu, or the "Login Required" panel on protected pages) opens a split screen with the login form on the right. | [src: FE/src/layouts/components/DefaultLayoutWithVerticalNav.vue:278-330; i18n menu.application.signIn \| VERIFIED-SOURCE]

| Option (exact label) | What it is | Tag |
|---|---|---|
| "Google" | Firebase Google sign-in (an SSO account) | [src: FE/src/@core/components/LoginModal.vue:81-98; i18n core.login.googleLogin \| VERIFIED-SOURCE] |
| "Apple ID" | Firebase Apple sign-in (SSO account) | [src: FE/src/@core/components/LoginModal.vue:100-113; i18n core.login.appleLogin \| VERIFIED-SOURCE] |
| "Email" + "Password" + "Login" / "Sign Up" ("Create SSO Account", "Confirm Password") | Email/password SSO account. Password at least 8 characters ("Password must be at least 8 characters"). Verification step "Check your email". Also "Forgot your password?" reset | [src: i18n core.login.* \| VERIFIED-SOURCE] |
| "Wallets" ("Login using your crypto wallet") then tiles `ZelCore`, `SSP`, `WalletConnect`, `MetaMask` | Four wallet options. Tooltips: "Login with Zelcore", "Login with SSP", "Login with WalletConnect", "Login with Metamask" | [src: FE/src/@core/components/LoginModal.vue:251-326 \| VERIFIED-SOURCE] |
| "Manual" | "Get new login phrase" / "Copy login phrase", sign it in any wallet, paste "Address" and "Signature". Hidden in the compact dialog (`hideManualLogin`) | [src: FE/src/@core/components/LoginModal.vue:327-390; FE/src/components/shared/LoginDialog.vue \| VERIFIED-SOURCE] |

Notes:
- The home page FAQ only mentions "email through single sign-on (SSO), or by connecting a self-custodial wallet, SSP or Zelcore". Source offers more (Google, Apple, WalletConnect, MetaMask). Source wins. | [src: https://cloud.runonflux.com (FAQ "How do I sign in to FluxCloud?"); LoginModal.vue \| VERIFIED-LIVE]
- SSO users hold no key: when a signature is needed the UI sends the message plus the Firebase token to `service.fluxcore.ai/api/signMessage` and receives the signature, so signing is automatic and the "Sign Message" button is hidden. Wallet users sign in the wallet (ZelCore via WebSocket, SSP, MetaMask, WalletConnect) or through the "Manual Signing" dialog ("Copy the message below, sign it externally, then paste the signature."). | [src: FE/src/@core/components/SubscriptionManager.vue:10872-10900; i18n core.manualSignDialog \| VERIFIED-SOURCE]
- The new console front end offers SSP, Zelcore, MetaMask or any EVM wallet, WalletConnect, manual signature, and email, Google and Apple accounts whose key Flux holds (15.2.10). | [src: console en-*.js auth.* \| DOCS-ONLY]
- SSO accounts auto-fill and lock the contact email ("Using your account email. Notifications go here."). | [src: i18n core.simpleDeploy.contactSsoHint \| VERIFIED-SOURCE]
- Docs wording: "Email Login: Flux SSO/Email button" and "Web3 Wallet (Zelcore, MetaMask, SSP)"; FluxDrive docs say "sign in with your FluxID (Zelcore wallet)". Any login method works in the current UI. | [src: DOCS/applications/management/manage-app/subscription.md; DOCS/fluxdrive/README.md \| DOCS-ONLY]

---

### 9.3 Left menu (what exists now)

Order: Applications block, FluxDrive, Cost Calculator, Administration (operators only), Flux Network, Help. | [src: FE/src/navigation/vertical/index.js \| VERIFIED-SOURCE]

| Menu item (exact) | Goes to | Visible to | Tag |
|---|---|---|---|
| My Applications | `/apps/management` | everyone (login prompt if signed out) | [src: FE/src/navigation/vertical/apps.js \| VERIFIED-SOURCE] |
| Register New App | `/apps/register` | everyone | same |
| App Marketplace | `/marketplace` | everyone | same |
| Games | `/marketplace/games` | everyone | same |
| WordPress | external https://runonflux.com/apps/wordpress | everyone | same |
| FluxDrive | `/flux-drive` | everyone | [src: FE/src/navigation/vertical/fluxdrive.js \| VERIFIED-SOURCE] |
| Cost Calculator | `/cost-calculator` | everyone | [src: FE/src/navigation/vertical/xdao.js \| VERIFIED-SOURCE] |
| Administration: Manage Flux Gravity, Manage Users, FluxShare, Information, Global Apps, Local Apps | `/administration/*`, `/apps/global`, `/apps/local` | privilege `admin` or `fluxteam` only (an operator signed in to their own node). FluxShare is `admin` only, Global Apps `fluxteam` only | [src: FE/src/navigation/vertical/fluxadmin.js \| VERIFIED-SOURCE] |
| Flux Network: Overview, Resources, Map, Rewards, Flux XDAO | `/dashboards/*`, `/xdao-app` | everyone | [src: FE/src/navigation/vertical/dashboard.js \| VERIFIED-SOURCE] |
| Help | https://docs.runonflux.com/flux/fluxcloud/introduction (new tab) | everyone | [src: FE/src/navigation/vertical/xdao.js \| VERIFIED-SOURCE] |

Header extras on the live page: "Ask FluxAI" (chat assistant, footer "May be wrong, check the sources"), "AI Agents" (MCP popover), "Hide status bar", status text "Up to date" and "Flux Gravity is operational and synced with the Flux network." (Ask FluxAI is an embedded widget and AI Agents a popover to the MCP docs, the repository and the hosted URL: 15.2.9; the new console front end has its own `/agents` page: 15.2.6) | [src: https://cloud.runonflux.com prerendered HTML; i18n components.agentMcpToggler, core.statusBar \| VERIFIED-LIVE]

#### FluxCloud only vs old FluxOS node dashboard

| Feature | Where it exists | Tag |
|---|---|---|
| Simple deploy mode, Marketplace with redirects to runonflux.com portals, FluxDrive page, Cost Calculator page, Ask FluxAI, AI Agents (MCP), Stripe auto-renewal UI, Stripe/PayPal checkout, Audit tabs | FluxCloud (and any node serving the same build) | [src: FE/src/pages/**; FE/src/components/** \| VERIFIED-SOURCE] |
| Administration menu: Manage Flux Gravity, Manage Users, FluxShare, Information (system info), Local Apps, Global Apps (Docker Events page exists, menu entry commented out) | Only appears for privilege `admin` or `fluxteam`, i.e. an operator logged in to a node. A normal user on cloud.runonflux.com never sees it | [src: FE/src/navigation/vertical/fluxadmin.js \| VERIFIED-SOURCE] |
| Separate legacy FluxOS UI (old Apps tabs, Daemon and Benchmark management pages) | Not a separate product any more. Locale keys `manageDaemon`, `manageBenchmark`, `loggedSessions` exist but no menu entries | [src: i18n menu.administration.*; fluxadmin.js \| VERIFIED-SOURCE] |

---

### 9.4 Register New App: the real wizard

#### 9.4.1 Entry page `/apps/register` ("Deploy Your App on FluxCloud")

Section "How would you like to deploy?" with two cards: | [src: i18n pages.apps.register.orbit.choice.*; FE/src/components/OrbitDeploymentChoice.vue \| VERIFIED-SOURCE]

| Card | Subtitle | Bullets | Button | Behaviour |
|---|---|---|---|---|
| Git | "Git-based Deployment" | "No Docker knowledge needed", "Auto-detect 100+ frameworks", "Built-in CI/CD pipeline", "Automatic rollbacks", "GitHub/GitLab/Bitbucket support" | "Deploy with Git" | Opens https://runonflux.com/apps/orbit in a new tab (code comment: Git deployments moved from orbit.runonflux.com to the Flux Apps hub). Confirmed 2026-10-13: the card text matches the product page and its bullets are the older ones (15.3.14) |
| Docker | "Container-based Deployment" | "Any Docker image", "Private registries", "Multi-container compose", "Full resource control", "Enterprise features" | "Deploy with Docker" | Goes to `/apps/register/configure` |

Locale has badges `NEW` and `BETA`; I did not confirm which card renders which. If signed out, `/apps/register/configure` shows "Login Required" with bullets "Deploy distributed apps", "Manage resources", "Monitor performance", "Scale globally" and buttons "Login" / "Learn More". | [src: FE/src/pages/apps/register/configure.vue:12-80; i18n menu.application.* \| VERIFIED-SOURCE]

#### 9.4.2 Simple mode (default): page "Deploy an app"

Header "Deploy an app" with subtitle "Your container, live on the Flux network in a few clicks". Segmented toggle "Simple | Advanced". Line "Already have a docker-compose or a Flux spec? Import it". "Back to deployment options" link. | [src: i18n core.simpleDeploy; FE/src/@core/components/SimpleDeploy.vue:1-27 \| VERIFIED-SOURCE]

New-app seed values (these are the on-screen defaults): spec version 8, instances 1, expire 88000 blocks, component cpu 1, ram 2000 MB, hdd 20 GB, container data `/tmp`. | [src: FE/src/pages/apps/register/configure.vue:212-243; SimpleDeploy.vue (loadStorage) \| VERIFIED-SOURCE]

| Card / field (exact label) | Required | Default | Limits and behaviour | Exact hint or message | Tag |
|---|---|---|---|---|---|
| Container > "Docker image" | yes | empty (placeholder `ghcr.io/acme/web-api:latest`) | any registry; backend max 200 chars | "The image to run. From Docker Hub, GHCR, or any registry." | [src: SimpleDeploy.vue:35-50; appValidator.js:653 \| VERIFIED-SOURCE] |
| "This image is private" (switch) | no | off | reveals "Repository Authentication" (`username:password`; the help popover also shows `aws://region=...&accessKeyId=...&secretAccessKey=...` and says "also azure:// and google://"). Turning it on registers the app as Enterprise (encrypted). NOTE the scheme names: the FluxOS v8.20.0 source registers only `aws-ecr://`, `azure-acr://` and `google-gar://` (plus basic `user:password`), so `aws://` would be parsed as an unknown provider and fail with "Failed to create authentication provider for type: aws". The popover text and the backend source disagree; teach the three names from the source and the FluxOS format document, and say the Simple form's hint uses shorter names that the source read does not accept (a newer node release was not checked). [src: ZelBack/src/services/registryAuth/services/authProviderFactory.js:L320-L345,L414-L440 ; utils/repoAuthParser.js:L26-L45,L187-L194 ; utils/registryCredentialHelper.js:L75-L110 ; docs/registry-auth/REPOAUTH_STRING_FORMAT.md \| VERIFIED-SOURCE] | "Because your image is private, the app will be registered as Enterprise ... Enterprise apps cost slightly more." | [src: SimpleDeploy.vue:52-110; i18n core.simpleDeploy.privateImage* \| VERIFIED-SOURCE] |
| "App name" | yes | empty (placeholder `myappname`) | lowercased and stripped to `a-z0-9` (no hyphens in Simple mode). Shows free domain `https://<name>.app.runonflux.io`. Unique network-wide | "Choose a unique name (letters and numbers). It creates the free domain your app is reached at:" | [src: SimpleDeploy.vue (slugify, freeDomain) \| VERIFIED-SOURCE] |
| "Contact email" | yes, valid email | SSO email, locked | regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` | "For deployment and expiration notifications. Required." | [src: SimpleDeploy.vue (isValidEmail, isContactLocked) \| VERIFIED-SOURCE] |
| Networking > "Port your app listens on" | yes, at least one | one empty row (placeholder `8080`) | integer 1 to 65535. Public port is assigned for you: mirrored if allowed, else random 30000 to 39999. Domains: first port `<name>.app.runonflux.io`, others `<name>_<exposedPort>.app.runonflux.io`. Button "Add another port" | error "Enter a valid port (1-65535)." (contains an en dash) | [src: SimpleDeploy.vue:545-640, 570; FE/src/utils/fluxPorts.js \| VERIFIED-SOURCE] |
| "Environment variables" (optional) | no | none | KEY / value rows, button "Add variable". Names matching secret, pass, token, api key, access key, private key, credential, auth, key, seed, mnemonic trigger the Enterprise notice | "We detected values that look like secrets ({keys}). Your app will be registered as Enterprise ..." | [src: FE/src/utils/detectSecrets.js:11-26; i18n core.simpleDeploy.secretsDetected \| VERIFIED-SOURCE] |
| Power > "CPU" | n/a | 1 vCPU | slider 0.5 to 15, step 0.5, tag "per copy" | "Good for a small API or website with moderate traffic." / "Comfortable for a busy backend, small database, or app server." / "Plenty for heavy workloads, large databases, or high traffic." | [src: SimpleDeploy.vue:255 \| VERIFIED-SOURCE] |
| "Memory" | n/a | 2 GB (2000 MB) | slider 500 to 59000 MB, step 500, shown in GB (1 GB = 1000 MB) | | [src: SimpleDeploy.vue:264 \| VERIFIED-SOURCE] |
| "Disk" | n/a | 20 GB (seed) | slider 1 to 820 GB, step 1 | | [src: SimpleDeploy.vue:273 \| VERIFIED-SOURCE] |
| Storage > "This app stores data" | no | off (data path `/tmp`; the on-screen hint is "Keep files across restarts - databases, uploads, config, etc.", and the code comment calls `/tmp` "scratch, valid". "Not persistent" is NOT an on-screen string. Mechanism: `/tmp` is a plain local volume, 7.2) | when on, "Folder to keep" required (text default `/data`). Switch "Keep it safe across node failures" writes `r:<path>` and forces at least 2 copies | "Replicated storage runs on at least 2 instances - set to {count}." | [src: SimpleDeploy.vue:640-700 \| VERIFIED-SOURCE] |
| Reliability > "Copies of your app" | n/a | 1 | stepper "Fewer copies" / "More copies", min 1 (2 when replicating), max 100 | one copy: "A single copy. If its node reboots, your app may briefly go offline."; many: "Runs on {count} independent nodes. If one goes offline, your app stays up." | [src: SimpleDeploy.vue:648, 762 \| VERIFIED-SOURCE] |
| Location > "Run only in specific regions" | no | off (anywhere) | six continent buttons: Europe, North America, South America, Asia, Africa, Oceania (stored as `acEU` etc). Countries, regions and forbidden rules only in Advanced | "Restricting to fewer regions reduces the available nodes." | [src: SimpleDeploy.vue (CONTINENTS, loadGeolocation) \| VERIFIED-SOURCE] |
| "Subscription period" | n/a | 1 month (88000 blocks) | buttons "1 week", "2 weeks", "1 month", "3 months" (-3%), "6 months" (-6%), "1 year" (-12%) | | [src: SimpleDeploy.vue:829 \| VERIFIED-SOURCE] |
| "Estimated cost" | n/a | live | `$<usd> / subscription period`, chip "Live estimate", sub text "{count} copies · pay in FLUX or by card · cancel anytime" (middle dots) | | [src: i18n core.simpleDeploy.priceSub \| VERIFIED-SOURCE] |
| Checkbox "I accept the Terms & Conditions" | yes | unchecked (remembered in sessionStorage key `flux-tos-accepted`) | opens dialog "Flux Terms of Service" with "I Agree" / "I Disagree" | | [src: SimpleDeploy.vue (tosAccepted) \| VERIFIED-SOURCE] |
| Button "Review & deploy" | | disabled until image set, name set, ports valid, email valid, data path set (if storing data) and ToS accepted | hands off to the Advanced Review step. Under it: "Need multiple containers, custom domains, commands, a static IP, or country-level location rules? Open Advanced settings" | | [src: SimpleDeploy.vue:447, 884 \| VERIFIED-SOURCE] |

Simple mode fills `description` with the app name and sets `owner` from the signed-in Flux ID. | [src: SimpleDeploy.vue (onDeploy) \| VERIFIED-SOURCE]

#### 9.4.3 Advanced mode: title "Register New Application"

Header buttons: "Import compose / spec" (disabled until ToS accepted) and "Simple mode" (back). A Terms of Service panel gates the form: "Terms of Service Agreement", checkbox "I have read and accept the Terms of Service", error "Please read and accept the Terms of Service before proceeding to other tabs." | [src: i18n core.subscriptionManager.tos.*; SubscriptionManager.vue:4111, 560-600 \| VERIFIED-SOURCE]

| Tab | Shown when | Tag |
|---|---|---|
| General | always | [src: SubscriptionManager.vue:4254 \| VERIFIED-SOURCE] |
| Geolocation | spec v5+ (always for new apps) | same |
| Enterprise Nodes (v7) or Priority Nodes (v8) | spec v7+ AND app is private/Enterprise AND (v7, or v8 with an owner on the node's enterprise-owner allowlist, or an existing app that already has nodes). For ordinary v8 users the tab is hidden and nodes are auto-selected | [src: SubscriptionManager.vue:4370-4385; FE/src/composables/useEnterpriseOwners.js \| VERIFIED-SOURCE] |
| Components | always | same |
| Review & Validate | after the spec is complete (button "Review") | [src: i18n core.subscriptionManager.reviewAndValidate \| VERIFIED-SOURCE] |

Docs say the Priority Nodes tab appears whenever "Enterprise" is on and that enterprise nodes must be Stratus. The allowlist gate is not mentioned in the docs. | [src: DOCS/register-new-app/deploy-with-docker/priority-nodes.md \| DOCS-ONLY]

##### General tab

| Field (exact label) | Default | Limits | Notes and messages | Tag |
|---|---|---|---|---|
| "Application Name" | empty | v8: max 63 chars, `[A-Za-z0-9]` with inner hyphens, auto-lowercased on new apps; cannot start with `zel` or `flux`; `watchtower` reserved | "Flux App name contains special characters. Only a-z, A-Z, 0-9 and hyphens are allowed (hyphens cannot be first or last character)" | [src: appValidator.js:564-590; SubscriptionManager.vue:540-548 \| VERIFIED-SOURCE] |
| "Description" | empty | max 256 chars | "Description is too long. Maximum of 256 characters is allowed" | [src: appValidator.js:592 \| VERIFIED-SOURCE] |
| "Owner" | your Flux ID, read-only | | | [src: i18n core.subscriptionManager.owner \| VERIFIED-SOURCE] |
| "Specification Version" (existing apps) | | | "Using latest specification version" or "Older specification version - consider upgrading" | [src: i18n \| VERIFIED-SOURCE] |
| "Contact *" | SSO email for SSO users | max 5 contacts, each max 75 chars | "At least one contact email is required". A Flux Storage upload button hides the value from the public API | [src: appValidator.js:815-826; i18n contactRequired \| VERIFIED-SOURCE] |
| "Instances" slider | 1 (from the seed) | min 1 (2 if any volume uses `r:`, `g:` or `s:` sync; 3 for updates of spec v<8), max 100 | "The minimum recommended for a decentralized network is 3 instances."; with 1 instance: "... your app may experience some minutes of downtime if the node running the app is rebooted or shutdown."; with sync: "The minimum instances for apps with decentralized persistent storage is 2. To use fewer instances, disable data synchronization in the volume path settings." Shows "~$X (estimate)" | [src: SubscriptionManager.vue:4509-4523, 765; i18n \| VERIFIED-SOURCE] |
| "Period" slider | 1 month | 1 week, 2 weeks, 1 month, 3 months (3% off), 6 months (6% off), 1 year (12% off). Total subscription capped at 1 year (1,056,000 blocks) | "Maximum subscription duration is 1 year. Renewal options are adjusted based on your current remaining time." | [src: SubscriptionManager.vue:4897-4901, 5885-5895; i18n maxSubscriptionInfo \| VERIFIED-SOURCE] |
| "Additional Options" > "Static IP" | off | | tooltip "Enable static IP address for your application" | [src: i18n core.subscriptionManager.staticIp* \| VERIFIED-SOURCE] |
| "Enterprise" | off; auto-on when env var names look like secrets or a private repo is used | | "Enterprise mode enabled - your app specification will be encrypted." Turning it off with secrets present raises a "Registering as a public app" dialog with "Continue as public" / "Continue with Enterprise" | [src: i18n core.subscriptionManager.publicWarning*, secretsAutoEnabledBanner \| VERIFIED-SOURCE] |

Docs claim "Instances: Minimum 3, Maximum 100" and "Period 1 week to 1 year". Max 100 and the period range are right, the minimum is stale (section 0 row 2). | [src: DOCS/register-new-app/deploy-with-docker/general.md \| DOCS-ONLY]

##### Geolocation tab ("Allowed Geolocation" and "Forbidden Geolocation")

Drop-downs "Continent", "Country", "Region" and buttons "Add Allowed Location" / "Add Forbidden Location". Default is none (anywhere). Errors: "Please select a continent or remove this row", "Duplicate location - already added", "This location is both allowed and forbidden", "Please fix geolocation errors before validating". Backend: max 10 geolocation entries, each max 50 chars. The Review step can also refuse a spec the network cannot place: title "The network cannot place this app" with button "Open Geolocation". | [src: i18n core.subscriptionManager.geolocation*, placement*; appValidator.js:826-837 \| VERIFIED-SOURCE]

##### Components tab (one card per container; "+" adds, red x removes)

Max 10 components per app. Add button text in docs: "Add Component to Application Composition". | [src: appValidator.js:672-686; DOCS/shared-database/component.md \| VERIFIED-SOURCE]

| Field (exact label) | Default | Limits | Tag |
|---|---|---|---|
| "Name" | empty | letters and digits only, max 63 (v8), unique inside the app, cannot start with `zel` or `flux`. "Flux App component name contains special characters. Only a-z, A-Z and 0-9 are allowed" | [src: appValidator.js:690-715 \| VERIFIED-SOURCE] |
| "Description" | empty | max 256 | [src: appValidator.js:714 \| VERIFIED-SOURCE] |
| "Repository Tag" | empty | `namespace/repo:tag`, max 200 chars; max image size 5,000,000,000 bytes network-wide. Marketplace-only images are blocked: `"{repotag}" must be purchased from marketplace.` | [src: appValidator.js:728; https://api.runonflux.io/apps/deploymentinformation (maxImageSize); i18n marketplaceAppRestricted \| VERIFIED-LIVE] |
| "Repository Authentication" | empty | needs Enterprise on; placeholder "Docker authentication username:apikey" | [src: i18n core.subscriptionManager.dockerAuthPlaceholder, enterpriseFeatureTooltip \| VERIFIED-SOURCE] |
| "Secrets" | empty | needs Enterprise on; placeholder "Enter secrets (will be encrypted)" | [src: i18n \| VERIFIED-SOURCE] |
| "Container Data Path" / "Data Path Builder" | `/tmp` via Simple mode | max 200 chars, at least 2 chars. Error "Flux App container data folder not specified ... If no data folder is whished, use /tmp". Prefix `r:` replicated, `g:` primary/standby, none = local only | [src: appValidator.js:731, 770-772; DOCS/.../components.md \| VERIFIED-SOURCE] |
| "Environment Variables" | none | max 20 per component, each max 400 chars. Buttons "Add Variable", "Import from JSON", "Upload environment variables to Flux Storage". Errors "Variable name is required", `Duplicate key "{key}"`, "Key and value are required." | [src: appValidator.js:734-740; i18n \| VERIFIED-SOURCE] |
| "Commands" | none | max 20, each max 400. Button "Add Command". Tooltip "Not for environment variables or setup instructions!". Error "Command cannot be empty." | [src: appValidator.js:742-748; i18n \| VERIFIED-SOURCE] |
| "Port Bindings": "Exposed Port" and "Container Port" (button "Add Port Mapping") | none | exposed port 1 to 65535; max 5 mappings per component; banned list below. Messages "Port must be a number between 1 and 65535.", "Port {port} is already used in another component.", "Invalid or duplicate port values." | [src: appValidator.js:716-721, 765-768; i18n \| VERIFIED-SOURCE] |
| "Custom Domains" ("Port & Domain Configuration", "Enter domain for this port") | empty per port | each domain max 253 chars | [src: appValidator.js:749-753 \| VERIFIED-SOURCE] |
| "Hardware Resource": "CPU" (vCore), "RAM" (MB), "SSD/NVMe" (GB) | seed 1 vCore / 2000 MB / 20 GB | CPU 0.1 to 15 step 0.1; RAM 100 to 59000 step 100; SSD 1 to 820 step 1 | [src: SubscriptionManager.vue:1932-2010; cost-calculator range strings \| VERIFIED-SOURCE] |

Banned exposed ports (live from the network, source wins over docs): `16100-16299`, `26100-26299`, `30000-30099`, `8384`, `27017`, `22`, `23`, `25`, `3389`, `5900`, `5800`, `161`, `512`, `513`, `5901`, `3388`, `4444`, `123`, `53`. Docs list `3889` and omit `3389` and `53`. "Enterprise ports" (extra fee): `0-1023`, `8080`, `8081`, `8443`, `6667`. | [src: https://api.runonflux.io/apps/deploymentinformation; BE/ZelBack/config/default.js:408-411 \| VERIFIED-LIVE]

Docs say "Exposed Port must be between 1024 and 65535". Backend allows 1 to 65535; ports below 1024 just incur the enterprise-port fee. The frontend Simple mode never auto-exposes `0-1023`, `8080`, `8081`, `8443`, `6667`. | [src: DOCS/.../components.md; FE/src/utils/fluxPorts.js:5-37 \| VERIFIED-SOURCE]

#### 9.4.4 Review & Validate (the registration steps)

Opened by the green "Review" button. Rows appear in this order, each with spinner then green tick: | [src: SubscriptionManager.vue:2329-2740; DOCS/register-new-app/deploy-with-docker/review.md \| VERIFIED-SOURCE]

| # | Row label (exact) | What happens |
|---|---|---|
| 0 | (conditional warnings) | "This update will trigger a hard redeploy" (updates only), "Resource requirements increased", placement panel "Deployment Locations" |
| 1 | "Validate App Spec" | node call `/apps/verifyappregistrationspecifications`; failure shows "Validation Error:" plus the backend message |
| 2 | "Total Cost" | `/apps/calculatefiatandfluxprice`; USD and FLUX with a 5% discount chip; shows "Free update" when the price is 0 |
| 3 | "Expiry" | date the subscription will run until |
| 4 | "Signature" | button "Sign Message" for wallet users, automatic for SSO. Recovery buttons "Retry Signing", "Cancel Signing", "Sign In Again" ("Your session has expired. Please sign in again.") |
| 5 | "Registered" | the signed message is propagated on the Flux network |
| 6 | "Test Application Installation" | "Test your application install/launch to ensure your specifications work correctly." Buttons "Test & Pay" / "Test Installation". On failure: "Test failed! Check logs below and fix your specifications before paying." plus "Enable Payment Anyway" |
| 7 | "Payment", heading "Select payment method" | see section 5 |
| 8 | "Registration Successful!" then "Deployment Successful!" | "Payment window: 30 minutes remaining", "Deployment time: Up to 45 min after payment", button "Manage Application" |

Docs list the same steps as "Validate App Specs, Verify Total Cost, Expiry, Signature, Registration, Application Test, Pay for Your Application"; labels differ slightly from the UI. For redeploy of expired apps the docs list "Agree to the Terms of Service, Compute Registration Message, Register Application, Test Application Installation, Send Payment" (older wording); the UI reuses the same Review & Validate screen with the spec pre-filled. | [src: DOCS/.../review.md; DOCS/applications/management/README.md; FE/src/views/apps/management/redeploy.vue \| DOCS-ONLY]

#### 9.4.5 Backend validation messages worth quoting

| Message (exact) | When | Tag |
|---|---|---|
| `Minimum number of instances is {n}` and `Maximum number of instances is 100` | instances out of range (n = 1 for v8 after block 2176519, else 3) | [src: appValidator.js:804-812 \| VERIFIED-SOURCE] |
| `Flux App name is too long. Maximum 63 characters allowed` (32 for v<8) | name length | [src: appValidator.js:568-570 \| VERIFIED-SOURCE] |
| `Flux App name can not start with zel` and `... start with flux` | reserved prefixes | [src: appValidator.js:583-591 \| VERIFIED-SOURCE] |
| `Assigned port {p} is not allowed for Flux Apps` | banned port | [src: appValidator.js:604, 619 \| VERIFIED-SOURCE] |
| `Too many ports defined. Maximum of 5 allowed.` | more than 5 ports | [src: appValidator.js:635 \| VERIFIED-SOURCE] |
| `Maximum of 20 environment variables allowed.` and `... Maximum of 400 characters is allowed` | env limits | [src: appValidator.js:656-661 \| VERIFIED-SOURCE] |
| `Private repositories are only allowed for Enterprise Applications` | repoauth without Enterprise | [src: appValidator.js (v8 branch, repoauth check) \| VERIFIED-SOURCE] |
| `Flux App has too many components` | more than 10 components | [src: appValidator.js:679 \| VERIFIED-SOURCE] |

---

### 9.5 Payment options, fiat path and costs

#### 9.5.1 What the "Payment" step offers

Heading "Select payment method" with two big options: | [src: SubscriptionManager.vue:3095-3380; i18n core.subscriptionManager.payWithCard, payWithFlux \| VERIFIED-SOURCE]

| Option | Sub-options | Notes | Tag |
|---|---|---|---|
| "Pay with Card" ("Secure & instant payment") | Stripe, PayPal (each shown only if the payment bridge reports the gateway up) | Price shown as "${price} USD + VAT". "Secure payment processing", "Instant payment confirmation", "Multiple currency support". If both are down: "Fiat payment gateways are temporarily unavailable". Checkout opens in a popup; if blocked: "Popup Blocked" with an open button | [src: SubscriptionManager.vue:3120-3300; i18n \| VERIFIED-SOURCE] |
| "Pay with FLUX" ("Cryptocurrency payment") | "Zelcore" button, "SSP" button, or manual: "Send to" (deployment address) and "Message" (registration hash) with "Copy Address" / "Copy Message" | A 5% FLUX discount chip shows when `fluxDiscount > 0`. The message (memo) is mandatory | [src: SubscriptionManager.vue:3330-3440 \| VERIFIED-SOURCE] |
| Marketplace dialog wording | "Pay with Credit Card", "Pay with PayPal", "Pay with FLUX", "Payment Address", "Payment Message", "ZelCore Payment Instructions", "SSP Payment Instructions". Signing step wallet icons: Flux ID (ZelCore), SSP, MetaMask, WalletConnect | Same engine | [src: i18n components.marketplace.installDialog.* \| VERIFIED-SOURCE] |

| Fact | Value | Tag |
|---|---|---|
| Payment link validity | 30 minutes ("Everything is ready, your payment option links, both for fiat and flux, are valid for the next 30 minutes.") | [src: i18n components.marketplace.installDialog.paymentLinksValid \| VERIFIED-SOURCE] |
| Deployment after payment | "Up to 45 min after payment"; a node usually starts installing within 1 to 3 minutes | [src: i18n core.subscriptionManager.upToFortyFiveMinutes, installationStartTime \| VERIFIED-SOURCE] |
| FLUX must be sent on the Flux main chain, not an EVM token, and not from an exchange (no memo, may miss the window) | game guide warning | [src: DOCS/marketplace/games/minecraft.md:92-100 \| DOCS-ONLY] |
| Deployment address for FLUX payments | `t3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX` | [src: https://api.runonflux.io/apps/deploymentinformation \| VERIFIED-LIVE] |
| Fiat bridge | `https://fiatpaymentsbridge.runonflux.io`; status endpoint returned `{"stripe":true,"paypal":true}` | [src: curl https://fiatpaymentsbridge.runonflux.io/api/v1/gateway/status \| VERIFIED-LIVE] |
| Bridge price check | the bridge refuses a price below 98% of the network quote ("invalid price supplied") | [src: FE/src/utils/networkPrice.js:1-12 \| VERIFIED-SOURCE] |

#### 9.5.2 How the fiat path works

1. The wizard has already signed and registered the spec on the network and holds a registration hash. | [src: SubscriptionManager.vue:2700-2740 \| VERIFIED-SOURCE]
2. Clicking Stripe or PayPal makes the browser POST `{zelid, signature, loginPhrase, details:{name, description, hash, price, productName, success_url, cancel_url, kpi}}` to the payment bridge (`/api/v1/stripe/checkout/create`, `/api/v1/stripe/subscription/create`, `/api/v1/paypal/checkout/create`) and opens the returned URL. | [src: FE/src/components/Marketplace/InstallDialog.vue:4670-4720, 4770-4800, 4850-4890 \| VERIFIED-SOURCE]
3. The UI then polls the chain until the app shows as paid and installing ("Checking for payment confirmation on the blockchain.", "This can take a few minutes."). `/successcheckout` tells the user the payment was processed and the tab can be closed. | [src: i18n core.subscriptionManager.checkingPaymentOnBlockchain, pages.successCheckout \| VERIFIED-SOURCE]
4. The card price equals the network USD price (rounded, see 5.3) and is shown plus VAT. Paying with FLUX takes 5% off that USD figure. | [src: https://api.runonflux.io/apps/calculatefiatandfluxprice (fluxDiscount 5); SubscriptionManager.vue:3140-3160 \| VERIFIED-LIVE]

Stripe auto-renewal: switch "Enable auto-renewal" ("Automatically renew your app subscription via Stripe at the selected interval"). Only with Stripe ("Auto-renewal is only available with Stripe payments") and only for 1 week, 2 weeks, 1, 3, 6 or 12 months. Billing: "Manage Billing" opens the Stripe portal; app rows show "Auto-renewing" or "Payment issue". Cancelling the app also cancels the Stripe subscription. | [src: i18n core.subscriptionManager.enableAutoRenewal, autoRenewalOnlyStripe, autoRenewalEligiblePeriods, cancelActiveSubscriptionWarning, manageBilling \| VERIFIED-SOURCE]

#### 9.5.3 Price rules the UI quotes (checked against the live calculator)

Per month, per app: `cpu*rate*10 + ram*rate/100 + hdd*rate`, plus enterprise scope fee if Enterprise or node-scoped, plus static IP fee, plus enterprise-port fee per port. Divide by 3 for the per-instance price; each extra instance adds one per-instance price (rounded up to cents); minimum $0.99; then the duration discount; then the total is rounded UP to the next price ending in .49 or .99 (since FluxOS PR #1818, 2026-09-25); FLUX price = USD / FLUX rate x 0.95. | [src: BE/ZelBack/src/services/utils/appUtilities.js:113-141; BE/ZelBack/src/services/utils/appSpecHelpers.js (calculateFiatAndFluxPrice handler, roundUpToCharmPrice lines 30-39) \| VERIFIED-SOURCE]

Live rate card (USD): | [src: https://stats.runonflux.io/apps/getappspecsusdprice \| VERIFIED-LIVE]

| cpu (per 0.1 core) | ram (per 100 MB) | hdd (per GB) | port (enterprise) | scope (enterprise) | staticip | fluxmultiplier | minUSDPrice |
|---|---|---|---|---|---|---|---|
| 0.15 | 0.05 | 0.02 | 2 | 4 | 2 | 0.95 | 0.99 |

Duration discounts in the backend: 3 months 3%, 6 months 6%, 9 months or more 12% (the UI offers 12 months only). Hardware discount: 20% when total cpu < 3, ram < 6000 MB, hdd < 150 GB; 10% when cpu < 7, ram < 29000 MB, hdd < 370 GB; applied only when instances < 4. | [src: BE/ZelBack/src/services/utils/appSpecHelpers.js (calculateFiatAndFluxPrice handler) \| VERIFIED-SOURCE]

Calculator spot checks run today (POST `/apps/calculatefiatandfluxprice`, read-only; spec v8, 3 instances and 1 month unless noted): | [src: https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE]

| Config | usd | flux (5% off) |
|---|---|---|
| 0.1 cpu, 100 MB, 1 GB | 0.99 | 11.04 |
| 0.5 cpu, 500 MB, 5 GB | 0.99 | 11.04 |
| same plus static IP | 2.99 | 33.32 |
| same plus enterprise port 443 | 2.99 | 33.32 |
| 1 cpu, 2000 MB, 20 GB, 1 instance | 0.99 | 11.04 |
| 1 cpu, 2000 MB, 20 GB, 5 instances | 4.99 | 55.61 |
| 4 cpu, 8000 MB, 100 GB | 10.99 | 122.47 |
| 2 cpu, 4000 MB, 20 GB, 3 months | 12.99 | 144.85 |

#### 9.5.4 What update, renew and remove cost

| Action | Cost rule | Tag |
|---|---|---|
| Renewal (Subscription tab, "Renewal") | New price for (remaining time plus chosen extension) minus a pro-rata credit for the unused time at the old spec price, so in practice you pay for the added period. Total may not exceed 1 year. Same payment step (Card or FLUX) | [src: BE/ZelBack/src/services/utils/appSpecHelpers.js (previousSpecsPrice credit block); FE SubscriptionManager.vue:6026-6070 \| VERIFIED-SOURCE] |
| Update (Subscription tab, "Update") | Same formula with the new spec, credit for the unused part of the old spec. FREE ("Free update", "Free updates on the network are offered by Influx Technologies") when: no extension beyond 8 blocks, instances unchanged, static IP unchanged, node list size unchanged, no component's cpu, ram or hdd increased, enterprise-port count not increased. Lowering resources or changing image, env, commands is free | [src: BE/ZelBack/src/services/utils/appSpecHelpers.js:147-215; i18n core.subscriptionManager.freeUpdate, freeUpdateSponsoredBy \| VERIFIED-SOURCE] |
| Update warnings | "This update will trigger a hard redeploy" when spec version is upgraded, components are added/removed/renamed, or a component's disk size changes: container data is deleted. "Resource requirements increased": if current nodes cannot hold the larger spec, the app is reinstalled elsewhere and data is lost | [src: i18n core.subscriptionManager.hardRedeploy*, resourceIncrease* \| VERIFIED-SOURCE] |
| Cancel (Subscription tab, "Cancel": "Cancel Subscription" then "Cancel Application") | No charge, no refund. App removed from the network and data lost: "After expiration, your app is permanently removed from the Flux network. The same app cannot be restored - to use it again you will need to register a new app." Needs a signature | [src: i18n core.subscriptionManager.cancel*, afterExpirationNotAccessible \| VERIFIED-SOURCE] |
| "Remove Application" (Control tab) | Not billing. Removes the app from the selected node(s) so another node picks it up; the subscription continues | [src: DOCS/.../control.md; i18n core.appControl.buttons.removeApplication \| DOCS-ONLY] |
| Redeploy expired app | My Expired Apps, "Redeploy": Register screen pre-filled, pay as for a new registration | [src: DOCS/applications/management/README.md \| DOCS-ONLY] |

---

### 9.6 Managing a running app (Manage page)

Path: left menu "My Applications", tabs "My Active Apps" / "My Expired Apps", row button "Manage" (also "Visit"; tooltips Manage, Install, Remove, Visit, Clone). A backend selector (FluxNode IP drop-down plus reload) picks which instance the local tabs talk to. | [src: i18n menu.application.myActiveApps, myExpiredApps, pages.apps.manage.tooltips; DOCS/.../manage-app/README.md \| VERIFIED-SOURCE]

Active Apps table: App Name, Expiry Date, App Specification (CPU cores, RAM MB, Storage GB, Instances), expand arrow (details, components, locations/IPs), buttons Manage and Visit. Filters: "Per Page", "Filter" ("Type to Search"), advanced filter ("App Type": All / Marketplace / Marketplace Excluded; "Version"; "Min HDD (GB)", "Min RAM (MB)", "Min CPU (Cores)", "Min Instances"; "Repotags"; "Clear All Filters"). | [src: i18n pages.apps.table.*; DOCS/applications/management/README.md \| VERIFIED-SOURCE]

Manage page tabs, exact labels in order: "Specifications", "Information", "File Changes", "Monitoring", "Logs", "Secure Shell", "Control", "Backup & Restore", "Instances", "Subscription", then "Audit" and "Audit Stats". | [src: i18n pages.apps.manage.tabs.* \| VERIFIED-SOURCE]

| Tab | What you can do | Exact UI strings and details | Tag |
|---|---|---|---|
| Specifications | Compare "Local Specification" (this node) with "Global Specification" (network). Enterprise apps show "Components are encrypted. Only this app's owner can decrypt its component configuration." | | [src: i18n pages.apps.manage.specification, encryptedComposition \| VERIFIED-SOURCE] |
| Information | Docker inspect style data: status, uptime, image, ports, env, limits, mounts | | [src: DOCS/.../information.md \| DOCS-ONLY] |
| File Changes | Docker filesystem diff | "File changes inside Docker container (Kind: 0 = Modified, Kind: 1 = Added, Kind: 2 = Deleted)" | [src: i18n pages.apps.manage.messages.fileChangesDescription \| VERIFIED-SOURCE] |
| Monitoring | Live charts and Processes | Time ranges Last 15 Minutes, 30 Minutes, 1 Hour, 2 Hours, 3 Hours, 5 Hours, 1 Day, 2 Days, 3 Days, 7 Days. Charts "CPU Utilization (%)", "Memory Utilization (%)", "RX on eth0", "TX on eth0", "Read", "Write", "File System (RootFS)", "Persistent Storage". Toggle "History Statistics", selectors "Refresh Rate", "Points". "Start Monitoring" / "Stop Monitoring" / "Stop & Delete Data" are in Control | [src: i18n pages.apps.manage.timeRange, charts, labels; core.appControl.buttons \| VERIFIED-SOURCE] |
| Logs | "Log Viewer" | "Select Component", "Line Count", "Logs Since", "Filter Logs" ("Enter keywords..."), "Advanced Options": "Auto Refresh", "Display All Logs", "Display Timestamp", "Line Selection Mode", "Auto Scroll"; buttons "Copy", "Download". Notices "earlier logs rolled over on this node and are no longer available", "the live stream ended; the pane restarts from the most recent lines" | [src: i18n core.logViewer.* \| VERIFIED-SOURCE] |
| Secure Shell | Terminal plus Volume Browser | "Select Component", "Select Command" (Linux default, `/bin/bash`, `/bin/ash`, `/bin/sh`, Other, Custom), toggles "User" (user, user:group, uid, uid:gid) and "Environment" (`VAR1=value1,VAR2=value2`), buttons "Connect", "Disconnect", "New Terminal", "Pin all terminals to manager" (Terminal Manager layouts Grid, Horizontal Split, Vertical Split). Errors "Please select a container", "Command {cmd} is not supported by this container", "Connection timeout". Volume Browser: browse, upload files (zip folders first), create folder, download, rename, edit, delete, usage bar `used / allocated GB` | [src: i18n core.terminal.*, core.volumeBrowser; DOCS/.../secure-shell.md \| VERIFIED-SOURCE] |
| Control | Modes "Manual" (pick IPs), "Local" (selected node), "Global" (all nodes) | Buttons "Start Application", "Stop Application", "Restart Application", "Pause Application", "Unpause Application", "Remove Application", "Soft Reinstall", "Hard Reinstall"; per component "Start Component", "Stop Component", "Restart Component", "Pause Component", "Unpause Component"; "Start Monitoring", "Stop Monitoring", "Stop & Delete Data". Soft reinstall "will redeploy the application while keeping existing data." Hard reinstall "will completely remove and redeploy the application. All application data will be deleted. This action cannot be undone." | [src: i18n core.appControl.* \| VERIFIED-SOURCE] |
| Backup & Restore | Sub-tabs "Backup" and "Restore" | Backup: "Select component(s) to backup", "Create Backup", table "Available Local Backups" (Component, Created, Expires, Size, Actions), "Download selected", "Download all", "Remove all backup files". Text: "Automatic weekly backups are created and maintained while your app is active. The latest backup is always preserved until app expiration. You can also create manual backups anytime." Upload to FluxDrive: "Free FluxDrive backups! Up to 10 GB total to use per user". Restore methods "FluxDrive", "Upload File", "Remote URL" (must end `.tar.gz`: "Please enter a valid URL ending with .tar.gz") | [src: i18n core.backupAndRestore.* \| VERIFIED-SOURCE] |
| Instances | World map and table: IP Address, Continent, Country, Region; buttons "App" and "FluxNode"; shows the Primary IP for `g:` apps | While electing: "Defining New Primary In Progress" | [src: DOCS/.../instances.md; i18n pages.apps.manage.messages.definingNewPrimary \| VERIFIED-SOURCE] |
| Subscription | Switch "Management Action": "Renewal", "Update", "Cancel" (Cancel only for spec with `expire`, v6+). Renewal slider labels "1 Week" to "1 Year" with "(3% off)" style suffixes | "Current subscription until:", "Time left:", "After renewal subscription until:". If under a week: "Expires in under a week. Renewal subscription to update." | [src: i18n core.subscriptionManager.*; SubscriptionManager.vue:96-124 \| VERIFIED-SOURCE] |
| Audit, Audit Stats | Newer tabs, not in docs | | [src: i18n pages.apps.manage.tabs.audit \| VERIFIED-SOURCE] |

Docs' Backup FAQ says "only manual backups are supported via the UI", which conflicts with the UI text about automatic weekly backups. Source wins. | [src: DOCS/.../backup-and-restore.md vs i18n core.backupAndRestore.backupListDescription \| VERIFIED-SOURCE]

Docs' Subscription FAQ "Can I pause instead of canceling? No" is about billing; the Control tab "Pause Application" only freezes the container. | [src: DOCS/.../subscription.md; i18n core.appControl \| DOCS-ONLY]

---

### 9.7 Custom domain

Default free domain: `<appname>.app.runonflux.io`; extra ports `<appname>_<exposedPort>.app.runonflux.io`. Shown in the Simple-mode name hint and in "App Details". | [src: SimpleDeploy.vue (freeDomain, domainForPort) \| VERIFIED-SOURCE]

Custom domain (docs): enter the domain in the component "Custom Domains" field for that port; at the DNS provider (Cloudflare recommended) add a `CNAME`: Name `@` or a subdomain, Target = the FluxCloud generated domain, proxy status enabled. | [src: DOCS/register-new-app/custom-domain-setup.md \| DOCS-ONLY]

Orbit FAQ: "Create a CNAME record pointing to your Flux deployment domain and SSL is handled automatically through the Flux reverse proxy network" (all Orbit plans, Starter included; the console's Git card disagrees, 15.3.8). | [src: https://runonflux.com/apps/orbit \| VERIFIED-LIVE]

---

### 9.8 Flux Orbit (Deploy with Git)

Two things share the name. Keep them apart in lessons.

#### 9.8.1 Orbit as a product (runonflux.com/apps/orbit, live today)

| Fact | Value | Tag |
|---|---|---|
| How it works | Paste a GitHub, GitLab or Bitbucket URL (public or private). Orbit detects framework, install step, build command and start command with Nixpacks, builds a container, deploys to the Flux nodes you pick (or worldwide). Every push to the chosen branch triggers a rebuild through a webhook, with streaming build logs. "Nixpacks" is the page's word; the docs describe their own file-based detection and the specs show neither, so say "the page says" (15.3.4) | [src: https://runonflux.com/apps/orbit ("How it works") \| VERIFIED-LIVE] |
| Rollback | A failed build never replaces a working deployment; the last good release stays live | [src: same page FAQ "What happens if a build fails?" \| VERIFIED-LIVE] |
| Polling and previews | "A polling mode is also available if you cannot install a webhook." Pull requests and branches can create preview deployments | [src: same page FAQ \| VERIFIED-LIVE] |
| Monorepo | `PROJECT_PATH` selects the subfolder | [src: same page FAQ \| VERIFIED-LIVE] |
| Deploy button | "Deploy to Flux" README button with repo, branch, project path and plan prefilled | [src: same page \| VERIFIED-LIVE] |
| Secrets and private repos | "Private repositories, database add-ons and secret variables are deployed encrypted, running only on ArcaneOS nodes, and the network's encryption fee is included in the price shown at checkout." | [src: same page pricing footnote \| VERIFIED-LIVE] |
| Agent access | Orbit MCP server: sign in, open "Connect an agent" in the dashboard, generate a connection config (short-lived credential). Extended 2026-10-13 in 15.4: endpoint `https://runonflux.com/apps/mcp`, 15 named tools, wallet-only sessions cannot connect, and the guide and the live sign-in challenge describe different routes | [src: same page FAQ \| VERIFIED-LIVE] |
| Payment | Card via Stripe, or FLUX via ZelCore or SSP. "You never need to own any crypto" | [src: same page FAQ \| VERIFIED-LIVE] |
| Trial and refund | "First week free for new users" (one per account, no card, ends after 7 days). Old Free plan closed to new apps. 30-day money-back on the first paid month | [src: same page pricing footnote \| VERIFIED-LIVE] |

Plans (also in the snapshot table): Starter $0.99 (0.5 vCore, 1 GB, 5 GB, single instance, no persistent folders), Standard $2.49 (1.5 vCores, 4 GB, 15 GB, 2 instances, persistent folders, second port), Pro $3.99 (2 vCores, 6 GB, 20 GB, 2 instances), Custom from $0.99 (0.1 to 15 vCores, up to 59 GB, 1 to 820 GB, 1 to 3 instances). | [src: https://runonflux.com/apps/orbit \| VERIFIED-LIVE]

Re-read 2026-10-13 (footer `v1.1.101`, text unchanged): the three plan prices are exactly `quote()` for their sizes, one month, unencrypted, with no builder fee (15.3.11), and the plan sizes are the live tuples seen in the 235 Orbit specs (15.3.2). Read the whole of 15.3 before writing an Orbit lesson; it extends and in places corrects this subsection.

#### 9.8.2 Orbit as a Docker image (what the docs describe: `runonflux/orbit:latest`)

The docs flow is a normal "Deploy with Docker" registration with image `runonflux/orbit:latest` plus env vars. This is also what the managed product registers on chain (15.3.1): the two are one thing seen from two doors. Docker Hub confirms the image: description "Git → Flux in seconds. Auto-detects your stack, builds, deploys, and keeps it running.", last updated 2026-09-28, 261,924 pulls. The GitHub repo `runonflux/orbit` linked in docs returned 404 to an anonymous API call (private or moved). | [src: https://hub.docker.com/v2/repositories/runonflux/orbit; https://api.github.com/repos/runonflux/orbit \| VERIFIED-LIVE]

| Item | Value as documented | Tag |
|---|---|---|
| Ports | app port (`APP_PORT`) plus `9001` for webhook and status API (`WEBHOOK_PORT` configurable) | [src: DOCS/register-new-app/deploy-with-git/api/webhook-api.md:9-18; getting-started/quick-start.md \| DOCS-ONLY] |
| Required env | `GIT_REPO_URL`, `APP_PORT` | [src: DOCS/register-new-app/deploy-with-git/configuration/environment-reference.md \| DOCS-ONLY] |
| Common env | `GIT_BRANCH` (default `main`), `GIT_TOKEN` (private repo), `PROJECT_PATH`, `PROJECT_TYPE` (`auto`, `node`, `python`, `ruby`, `go`, `bun`, `rust`, `java`, `dotnet`, `php`), `BUILD_COMMAND`, `RUN_COMMAND`, `FORCE_INSTALL`, runtime versions `NODE_VERSION`, `PYTHON_VERSION`, `RUBY_VERSION`, `GO_VERSION`, `JAVA_VERSION`, `DOTNET_VERSION`, `BUN_VERSION`, `RUST_VERSION`, `PHP_VERSION`, `PHP_EXTENSIONS`, `CGO_ENABLED`, `NODE_OPTIONS`, `JAVA_OPTS`, `ASPNETCORE_ENVIRONMENT` | same |
| CI/CD env | `WEBHOOK_SECRET`, `API_KEY` (protects `/status` and `/logs/:id`), `POLLING_INTERVAL` (0 disabled, 60 to 86400 s) | same |
| Health and safety | `HEALTH_CHECK_RETRIES` (1 to 10, default 3), `HEALTH_CHECK_DELAY` (5 to 60 s, default 10), `SKIP_HEALTH_CHECK`, `DEPLOYMENT_TIMEOUT` (300 to 7200 s, default 1800), `SKIP_HOOKS`, `HOOK_TIMEOUT` (60 to 3600, default 300). Custom health script `.flux-pod/health-check` | same |
| Files named in docs | repo root: `pre-deploy.sh` (after dependencies, before build/start; failure rolls back), `post-deploy.sh` (after start; failure only logged). In container: `/app/config.json`, `/app/.env_setup`, `/app/logs/app.log`, `setup.log`, `webhook.log`, `update.log`, `hooks.log`. Example env file `flux-orbit.env`. Supervisor dashboard on 9001 (`admin`/`admin` in the docs example) | [src: DOCS/.../getting-started/first-deployment.md; hooks/deployment-hooks.md; configuration/environment-reference.md \| DOCS-ONLY] |
| HTTP endpoints on 9001 | `POST /webhook`, `GET /status`, `GET /health` (public), `GET /logs/:id`. "Public" for `/health` is the Webhook API page's claim; the environment reference says `API_KEY` also covers `/health`. Which is right is UNVERIFIED (15.3.6.1) | [src: DOCS/.../api/webhook-api.md:15-22 \| DOCS-ONLY] |
| Webhook setup | GitHub: Settings, Webhooks, Add webhook; Payload URL `https://<app>-9001.app.runonflux.io/webhook` (docs spelling), Content type `application/json`, Secret = `WEBHOOK_SECRET`, event "push". GitLab: Settings, Webhooks, Secret Token, Push events. Bitbucket: Settings, Webhooks, Title `Flux-Orbit Deploy`, Trigger "Repository push" | [src: DOCS/.../ci-cd/github-webhooks.md, gitlab-integration.md, bitbucket-setup.md \| DOCS-ONLY] |
| Polling | `POLLING_INTERVAL=300` checks every 5 minutes, no webhook needed | [src: DOCS/.../ci-cd/github-webhooks.md \| DOCS-ONLY] |
| PR previews | static sites only; `PR_PREVIEW_ENABLED`, `PR_PREVIEW_MAX_AGE` (86400), `PR_PREVIEW_MAX_COUNT` (10), `PR_PREVIEW_CLEANUP_INTERVAL` (3600); base path `/flux-pr-{number}/` | [src: DOCS/.../guides/pr-preview-deployments.md:265-300 \| DOCS-ONLY] |
| Stateless warning | "designed for stateless applications ... persistent data must be stored externally"; do not run databases or local file storage | [src: DOCS/.../getting-started/deployment-guidelines.md \| DOCS-ONLY] |
| GPU | `GPU_ENABLED=true`, `AI_FRAMEWORK` | [src: DOCS/.../guides/gpu-ai-applications.md \| DOCS-ONLY] |

I found no `orbit.json`, `.orbit.yml` or similar repo-level config file anywhere; the only repo files named are `pre-deploy.sh`, `post-deploy.sh` and `.flux-pod/health-check`. Same finding on 2026-10-13 (15.3.13). | [src: grep over DOCS/register-new-app/deploy-with-git \| UNVERIFIED]

---

### 9.9 Marketplace

#### 9.9.1 Browsing and install flow

Page "Flux Application Marketplace" (`/marketplace`); games at `/marketplace/games` ("Game Server Hosting"). Category filters and search. Product page: price, "Minimum Requirements" (vCores, Memory, Storage), button "Buy Now" (generic) or "Install {name}" (games), "Back to Games". Banner: "List Your App on the FluxCloud Marketplace ... earn up to 25% in shared revenue from every deployment." | [src: i18n pages.marketplace.hero, detail, games.detail \| VERIFIED-SOURCE]

Install dialog is a 7-step stepper for new apps: | [src: FE/src/components/Marketplace/InstallDialog.vue:3095-3115 \| VERIFIED-SOURCE]

| Step (label) | What you do | Exact strings |
|---|---|---|
| Config | pick the configuration and duration (buttons "1 Month", "3 Months", "6 Months", "12 Months"), see "Hardware Requirements", instances, "Estimated Pricing", tick "I agree to the Terms of Use" | "Terms Acceptance Required: Please scroll down and accept the Terms of Use to continue with the installation." |
| Params | app parameters ("Configuration parameter"), toggle "Show Advanced" | "All Set!" "No additional configuration required" when none |
| Location | "Deployment Location": "Global (All Continents)" or "Allowed Locations" / "Forbidden Locations" (continent, country) with "Add Allowed" / "Add Forbidden" | "No geographic restrictions (recommended for best availability)" |
| Alerts | "Email Notifications": "Enter your email for notifications (optional)" or "(required)" | launch finished, primary server changed, expiry approaching |
| Sign | "Launching Application": "Your application needs to be signed and registered on the Flux network." Button "Sign and Register". SSO users are signed automatically | "No compatible wallets detected. Please install ZelCore, SSP, MetaMask, ensure you're logged in via SSO, or login manually." |
| Payment | "Payment Information", "Choose Payment Method": "Pay with Credit Card", "Pay with PayPal", "Pay with FLUX"; links valid 30 minutes | |
| Deploy | "Deploying your application...", then "Deployment Summary" (Payment Type Crypto or Fiat, Total Paid, Subscription Valid Until) and button "Manage Application" | |

Source for the strings above: | [src: i18n components.marketplace.installDialog.* \| VERIFIED-SOURCE]

Docs describe the same flow for games in older words: "View Details", "Install Now", "Choose Subscription" (accept Terms and Privacy, blue Continue arrow), "Choose Server Type" (Minecraft: Vanilla, Paper, Forge, NeoForge, Fabric; "Show Advanced"), "Deployment Location" (Global (Recommended) or Custom), email, "Sign and Register", payment (Fiat: Stripe or PayPal; Crypto: FLUX, 5% discount). | [src: DOCS/marketplace/games/minecraft.md:26-95 \| DOCS-ONLY]

Finding a game IP: Applications, Management, the app, "Instances" tab, Primary IP; or use the app domain `<name>.app.runonflux.io` which survives primary changes. Game apps run Primary/Standby (`g:`), three instances in docs, one active. | [src: DOCS/marketplace/games/minecraft.md:101-135 \| DOCS-ONLY]

#### 9.9.2 Catalog today (live marketplace API)

Total 195 records, 97 with `visible && enabled`. Source: `GET https://api.marketplace.runonflux.io/api/v1/marketplace/apps` (the call the web UI itself makes). Categories: Blockchain, Hosting, Productivity, Front-end, Blockbook, Games, RPC Node, Masternode, NewGames. Prices are the listed one-month USD `price`. "Auto-Ent" = `isAutoEnterprise` (registered encrypted). CPU/RAM/disk are sums over components, then instance count. | [src: https://api.marketplace.runonflux.io/api/v1/marketplace/apps, /api/v1/marketplace/categories \| VERIFIED-LIVE]

A second, older list at `https://stats.runonflux.io/marketplace/listapps` (106 records, 84 visible) is what the backend uses for price multipliers; its USD figures differ from the marketplace API (for example Minecraft2GB 2.49 vs 2.99). The backend charges its computed price times the app `multiplier` unless the spec carries a `priceUSD`. | [src: https://stats.runonflux.io/marketplace/listapps; BE/ZelBack/src/services/utils/appSpecHelpers.js (marketPlaceApp multiplier block) \| VERIFIED-LIVE]

##### Productivity, hosting and AI one-click apps

| Name | One line | cpu / RAM MB / disk GB / instances | $/month | Auto-Ent |
|---|---|---|---|---|
| Hermes Agent | Nous Research self-improving AI agent, dashboard behind a password | 2 / 4000 / 20 / 2 | 5.49 | yes |
| Hermes Agent Pro | same, bigger | 4 / 8000 / 80 / 2 | 9.49 | yes |
| OpenClaw AI Assistant | personal AI assistant with messaging channels and a control UI | 2 / 4000 / 20 / 2 | 5.49 | yes |
| OpenClaw AI Assistant Pro | higher specs | 4 / 8000 / 80 / 2 | 9.49 | yes |
| n8n Starter | workflow automation on an HA PostgreSQL cluster (2 components, 3 instances) | 2 / 2000 / 15 / 3 | 6.99 | yes |
| n8n Standard | same | 2.5 / 3000 / 25 / 3 | 7.99 | yes |
| n8n Pro | same | 4 / 6000 / 35 / 3 | 12.49 | yes |
| Nextcloud Lite | private cloud for one user | 1 / 2000 / 25 / 2 | 3.99 | yes |
| Nextcloud Personal | private cloud for up to 5 users | 2.5 / 4000 / 100 / 2 | 6.49 | yes |
| Vaultwarden | Bitwarden-compatible password server | 1 / 500 / 10 / 2 | 3.49 | yes |
| SimpleX SMP Server | public SimpleX messaging relay with Tor address | 1 / 2500 / 21 / 2 | 3.99 | yes |
| Private SimpleX SMP Server | password-protected relay | 1 / 2500 / 21 / 2 | 3.99 | yes |
| SimpleX xFTP Server | file-transfer relay with 40 GB quota | 0.9 / 2000 / 40 / 2 | 3.99 | yes |
| Teamspeak | 16-slot TeamSpeak 3 | 1 / 2000 / 10 / 2 | 1.49 | no |
| Teamspeak6 | 32-slot TeamSpeak 6 | 2 / 4000 / 40 / 2 | 3.49 | no |
| UptimeKuma | self-hosted uptime monitoring | 0.5 / 800 / 10 / 3 | 1.49 | no |
| Folding@Home | Folding@home client (proof of useful work) | 1 / 700 / 3 / 3 | 1.99 | no |

Source for this table: [src: https://api.marketplace.runonflux.io/api/v1/marketplace/apps \| VERIFIED-LIVE]

Docs also carry install guides for Hermes, OpenClaw, n8n, Nextcloud, SimpleX, Vaultwarden and Kaspa nodes. Notable warnings: do not use `$` in passwords (n8n, Nextcloud, Vaultwarden), n8n's two database passwords must match, Vaultwarden's `ADMIN_TOKEN` must be the argon2 hash. | [src: DOCS/marketplace/n8n.md:111-175; DOCS/marketplace/vaultwarden.md:234-262 \| DOCS-ONLY]

##### Blockchain, masternode, front-end

| Group | Names with $/month | Tag |
|---|---|---|
| Blockchain nodes (19) | AlephiumNode 3.49, BittensorFN 14.99, Cyberfly 2.49, DesoNode 27.99, DogecoinNode 4.49, FACTOR Node 7.99, IronFishNode 9.99, Kadena Chainweb Node 8.99, Kaspa Node 16GB 27.49, Kaspa Node 24GB 31.49, Kaspa Testnet Node 16GB 27.49, Kaspa Testnet Node 24GB 31.49, KusamaNode 2.49, PreSearch Node 1.69, PreSearch Node Legacy 1.69, RavenNode 4.49, Streamr Node 9.99, Timpi Collector 3.49, Timpi Geocore 3.49 | [src: marketplace API \| VERIFIED-LIVE] |
| Masternodes (7) | BLOCX Node 3.49, DashNode 3.49, Firo Node 8.99, Neoxa 3.49, PIVX Node 4.99, PirateCash Node 3.49, Raptoreum Node 3.49 | same |
| Front-end (5) | Dopex, Gmx, Pangolin, Sushiswap, Yearn (DeFi front-ends, 1 vCPU, 1 GB, 5 GB) at 1.99 each | same |
| Blockbook and RPC Node | exist in the API (12 Blockbook, 6 RPC) but none is `visible && enabled` today | same |

##### Game server templates

Two generations exist in the API.

(a) "NewGames" templates (28). Many redirect to `https://runonflux.com/games/<game>`; their `price` field is 1 because the real price lives in the hub. Specs below are the smallest default. | [src: https://api.marketplace.runonflux.io/api/v1/marketplace/apps \| VERIFIED-LIVE]

| Game | cpu / RAM MB / disk GB / instances | Auto-Ent | Hub page |
|---|---|---|---|
| 7 Days to Die | 3 / 8000 / 40 / 2 | no | /games/7-days-to-die |
| American Truck Simulator | 1 / 1500 / 8 / 2 | no | none |
| ARK: Survival Ascended | 4 / 16000 / 60 / 2 | yes | /games/ark |
| Arma Reforger | 3 / 6000 / 30 / 2 | yes | /games/arma-reforger |
| Core Keeper | 1.5 / 3000 / 10 / 2 | no | none |
| Don't Starve Together | 2 / 4000 / 15 / 2 | yes | /games/dont-starve-together |
| RuneScape: Dragonwilds | 4 / 8000 / 40 / 2 | yes | /games/dragonwilds |
| Enshrouded | 2 / 5000 / 50 / 2 | no | /games/enshrouded |
| Euro Truck Simulator 2 | 1 / 1500 / 8 / 2 | no | none |
| Factorio | 2 / 2000 / 15 / 2 | no | /games/factorio |
| FiveM | 3.5 / 8000 / 25 / 3 (3 components: FiveM, MySQL, Shared-DB) | yes | /games/fivem |
| Garry's Mod | 2 / 3000 / 20 / 2 | yes | /games/garrys-mod |
| Hytale | 2 / 4000 / 15 / 2 | no | /games/hytale |
| Minecraft (Java) | 1.5 / 2000 / 40 / 2 | no | /games/minecraft |
| Minecraft Bedrock | 1.5 / 2000 / 40 / 2 | no | /games/minecraft |
| Palworld | 2 / 5000 / 30 / 2 | no | /games/palworld |
| Project Zomboid | 3 / 6000 / 20 / 2 | yes | /games/zomboid |
| Rust (vanilla) | 2.5 / 8000 / 15 / 2 | yes | /games/rust |
| Rust - Modded | 2.5 / 8000 / 15 / 2 | yes | /games/rust |
| Satisfactory | 2 / 8000 / 60 / 2 | no | /games/satisfactory |
| Team Fortress 2 | 2 / 3000 / 30 / 2 | yes | none |
| Terraria | 1 / 1000 / 5 / 2 | no | /games/terraria |
| tModLoader (modded Terraria) | 1.5 / 3000 / 15 / 2 | no | none |
| The Isle: Evrima | 2 / 6000 / 15 / 2 | no | none |
| Unturned | 1.5 / 2500 / 15 / 2 | yes | /games/unturned |
| V Rising | 2 / 8000 / 10 / 2 | yes | /games/vrising |
| Valheim | 2 / 4000 / 10 / 2 | yes | /games/valheim |
| Windrose | 2 / 8000 / 35 / 2 | no | /games/windrose |

(b) Legacy "Games" size variants still visible in the FluxCloud marketplace (21), all 3 instances: | [src: https://api.marketplace.runonflux.io/api/v1/marketplace/apps \| VERIFIED-LIVE]

| Family | Sizes (cpu / RAM / disk, $/month) |
|---|---|
| Enshrouded 4/8/16 Slots | 2 CPU, 4 GB, 50 GB, 4.99; 3 CPU, 6 GB, 60 GB, 7.99; 4 CPU, 8 GB, 65 GB, 10.49 |
| Minecraft Java 1/2/5/9/16/32/48 GB and Minecraft Bedrock same sizes | 1 GB 1.4 CPU 15 GB 2.49; 2 GB 1.5 CPU 20 GB 2.99; 5 GB 2 CPU 30 GB 4.99; 9 GB 2 CPU 60 GB 7.99; 16 GB 2 CPU 75 GB 11.49; 32 GB 2 CPU 100 GB 21.49; 48 GB 2 CPU 150 GB 30.49 |
| Palworld 4/8/16/32 Slots | 2 CPU, 5 GB, 12 GB, 4.99; 2.5 CPU, 6.3 GB, 15 GB, 6.49; 4 CPU, 10 GB, 20 GB, 10.49; 6 CPU, 14 GB, 35 GB, 15.49 |

Per-game tier tables printed in the docs (RAM / CPU / SSD per plan): | [src: DOCS/marketplace/games/*.md (lines ~27-45 of each file) \| DOCS-ONLY]

| Game | Tiers documented |
|---|---|
| Garry's Mod | 16 slots 2 GB / 1.5 CPU / 10 GB; 32 slots 4 GB / 2.5 / 15 GB; 64 slots 6 GB / 4 / 20 GB |
| Terraria | 8 slots 1 GB / 1 / 5 GB; 16 slots 2 GB / 2 / 5 GB; 32 slots 4 GB / 4 / 10 GB |
| Project Zomboid (Build 41) | 8 slots 4 GB / 2 / 15 GB; 16 slots 6 GB / 2.5 / 20 GB; 32 slots 10 GB / 4 / 30 GB |
| Satisfactory | 4 slots 8 GB / 2 / 60 GB; 8 slots 12 GB / 4 / 80 GB; 16 slots 16 GB / 6 / 90 GB |
| Unturned | 12 slots 2 GB / 1 / 8 GB; 24 slots 3 GB / 2 / 10 GB; 32 slots 4 GB / 2.5 / 10 GB |
| Rust and Rust Modded | 50 slots 8 GB / 2.5 / 15 GB; 100 slots 12 GB / 4 / 25 GB; 200 slots 24 GB / 6 / 50 GB |
| V Rising | 20 slots 4 GB / 2 / 10 GB; 30 slots 6 GB / 3 / 15 GB; 40 slots 8 GB / 4 / 20 GB |
| Valheim | 4 GB / 2 / 10 GB; 6 GB / 2.5 / 15 GB; 8 GB / 4 / 20 GB |
| Windrose | 2 slots 8 GB / 2 / 35 GB; 4 slots 12 GB / 2 / 35 GB; 10 slots 16 GB / 2 / 40 GB |
| Don't Starve Together | DST 1.5 GB (about 4 players), 2 GB (about 8), 4 GB (about 16); CPU and disk not tabulated |
| FiveM | 32 slots: FiveM 6 GB + MySQL 1 GB + Shared-DB 1 GB, 3.5 CPU, 25 GB; 48 slots 8+2+1 GB, 5.5 CPU, 35 GB; 64 slots 12+2+2 GB, 6.5 CPU, 50 GB |
| Minecraft Java, Bedrock, Palworld, Enshrouded, Factorio | no tier table in the docs page (use the API lists above) |

Docs "Games" README lists 16 titles; the marketplace and hub list more (section 0, row 10). The runonflux.com hub shows plan prices that are NOT the same as the FluxCloud marketplace API: for Minecraft 2GB $1.99, 4GB $2.99, 8GB $4.99, 16GB $7.99, 32GB $14.49, 48GB $20.49 (RAM, vCores 1.5/2, storage 20/30/50/75/100/150 GB, unlimited bandwidth). Its checkout is separate; "player slots are not sold" (counts are guidance). | [src: https://runonflux.com/games/minecraft, https://runonflux.com/games/ \| VERIFIED-LIVE]

#### 9.9.3 WordPress

Plans from the marketplace bridge `GET /api/v1/wordpress/plans` (3 components each, 3 instances), matching the public page https://runonflux.com/apps/wordpress: | [src: https://api.marketplace.runonflux.io/api/v1/wordpress/plans; https://runonflux.com/apps/wordpress \| VERIFIED-LIVE]

| Plan | $/month | cpu per component | RAM MB per component | SSD GB per component | Totals shown on page |
|---|---|---|---|---|---|
| Basic | 2.99 | 0.8 / 0.2 / 0.2 | 1000 / 1000 / 700 | 17 / 3 / 3 | 1.2 vCores, 2.7 GB RAM, 23 GB |
| Standard (default) | 7.99 | 2 / 1 / 0.5 | 2000 / 2000 / 800 | 37 / 3 / 4 | 3.5 vCores, 4.8 GB, 44 GB |
| Pro | 12.99 | 3.5 / 1.5 / 1 | 3500 / 2500 / 1000 | 75 / 5 / 5 | 6 vCores, 7 GB, 85 GB |
| Ultra | 21.99 | 5 / 3 / 1.5 | 5000 / 3000 / 1500 | 110 / 10 / 10 | 9.5 vCores, 9.5 GB, 130 GB |
| Enterprise | 34.99 | 8 / 4 / 2 | 10000 / 6000 / 2000 | 180 / 20 / 20 | 14 vCores, 18 GB, 220 GB |

FluxCloud WordPress configure page labels: "WordPress Dapp Name" (tooltip "Display name for your WordPress site. A unique Flux app name will be generated automatically."), "Email Address", "Domain Name" (optional), "Subscription" (1, 2, 3, 6 or 12 Months), "Whitelist IP for Backup/Restore (Optional)", "Performance Plan", "Deployment Location" (Global, North America, Europe, Asia, South America, Oceania, Africa), "Order Summary", button "Install WordPress", gate "Please log in to install WordPress". Setup note: "Allow up to 2 hours after registering for Propagation". After deploy: open the domain, pick language, enter "Site Title", "Username", "Password", "Email", click "Install WordPress". "Error establishing a database connection" means instances are still spawning (10 to 30 minutes). | [src: i18n pages.marketplace.wordpress.form.*, summary.*, setup.*; DOCS/wordpress/*.md \| VERIFIED-SOURCE]

Differences: docs call the smallest plan "Basic" and the API and public page agree; one i18n key still says `Free`. Docs WordPress registration page says payment must confirm "within 10 minutes"; the shared wizard text says 30 minutes. Public page FAQ: pay by card or USDC via Stripe, or FLUX from ZelCore or SSP. | [src: i18n pages.marketplace.wordpress.form.planDescriptions; DOCS/wordpress/registration-steps.md; https://runonflux.com/apps/wordpress \| VERIFIED-LIVE]

#### 9.9.4 Shared database (Flux Shared DB)

Not a one-click tile in the current marketplace list. It is a manual "Deploy with Docker" registration with two components. | [src: marketplace API (no shared-db app); DOCS/shared-database/*.md \| DOCS-ONLY]

| Item | Value | Tag |
|---|---|---|
| Engines | MySQL supported; MongoDB and PostgreSQL "in progress" | [src: DOCS/shared-database/README.md \| DOCS-ONLY] |
| Instances | 3 to 100 per docs (v8 now allows fewer, treat as guidance) | [src: DOCS/shared-database/general.md \| DOCS-ONLY] |
| Component 1 (engine) | name e.g. `mysql`; repository `mysql:latest`; ports, domains, container ports empty; env `MYSQL_ROOT_PASSWORD=...`, `MYSQL_ROOT_HOST=172.0.0.0/255.0.0.0`; commands `["--disable-log-bin"]`; container data `/var/lib/mysql` | [src: DOCS/shared-database/component.md \| DOCS-ONLY] |
| Component 2 (operator) | name `operator`; repository `runonflux/shared-db:latest`; 3 public ports e.g. `[31000,31001,31002]`; domains `["","",""]`; container ports `[3307,7071,8008]`; container data `r:/app/dumps`; recommended 1 core, 1 GB, 2 GB SSD; env `DB_COMPONENT_NAME=flux<engineComponent>_<appName>`, `DB_INIT_PASS`, `CLIENT_APPNAME`, `DB_APPNAME`, `DB_PORT`, `API_PORT`, `WHITELIST`; optional `INIT_DB_NAME`, `DB_USER` | same |
| Clients connect on | port 3307 (master-slave cluster, writes ordered by the master) | [src: DOCS/shared-database/README.md \| DOCS-ONLY] |
| Tab names | docs say "Details / Component / Review"; real tabs are General, Geolocation, Components, Review & Validate | [src: DOCS/shared-database/README.md vs i18n core.subscriptionManager.tab* \| VERIFIED-SOURCE] |

---

### 9.10 FluxDrive

| Item | Value | Tag |
|---|---|---|
| URL | https://cloud.runonflux.com/flux-drive (menu "FluxDrive"; `/fluxdrive` redirects) | [src: FE/src/pages/flux-drive.vue; additional-routes.js \| VERIFIED-SOURCE] |
| What | Decentralized IPFS storage; public link form `https://fluxdrive.runonflux.io/ipfs/<CID>` | [src: DOCS/fluxdrive/README.md; live config `ipfs.publicHost` \| VERIFIED-LIVE] |
| Plans (live `GET /api/v1/config`) | starter 10 GB $0.50, standard 50 GB $2.50, pro 100 GB $5.00 (UI name "Elite"); custom "FluxDrive Pro" by contacting support | [src: https://api.fluxdrive.runonflux.io/api/v1/config; FE/src/composables/useFluxDrive.js:576-620 \| VERIFIED-LIVE] |
| Payment gateways | Flux Pay (FLUX), Stripe, Crypto.com, all `enabled: true` | [src: https://api.fluxdrive.runonflux.io/api/v1/config \| VERIFIED-LIVE] |
| Docs say | payment "FLUX" or "Crypto.com" only; sign in with FluxID (Zelcore) | [src: DOCS/fluxdrive/README.md \| DOCS-ONLY] |
| Upload limit | 5 GiB per upload (5,368,709,120 bytes) | [src: https://api.fluxdrive.runonflux.io/api/v1/config \| VERIFIED-LIVE] |
| Feature flags | folderUpload, versioning, thumbnails, apiKeyScopes all true | same |
| Web UI actions | "+ New" (folder, upload file, upload folder), list/tile switch, storage meter, search; file actions open, rename, move, download, "Add new version", copy link, delete; "Upgrade Plan" | [src: DOCS/fluxdrive/README.md \| DOCS-ONLY] |
| API | base `https://api.fluxdrive.runonflux.io`; `/api/v0/status`, `ls`, `put`, `putfolder`, `cat`, `get`, `rm`, `thumb`; API keys created in the "API Keys" panel with scopes | [src: DOCS/fluxdrive/api-reference.md:103-400 \| DOCS-ONLY] |
| App integration | Backup & Restore can upload backups to FluxDrive, free up to 10 GB per user | [src: i18n core.backupAndRestore.freeFluxDriveInfo \| VERIFIED-SOURCE] |

---

### 9.11 Cost Calculator (`/cost-calculator`)

Title "App Hosting Cost Calculator" with subtitle "Affordable decentralized hosting starting at $0.99/month - Calculate your exact costs". No login needed (the Enterprise toggle needs HTTPS because it encrypts a dummy spec). Button "Calculate Price"; after edits the page says "Settings have changed. Click Calculate Price to update." | [src: i18n pages.costCalculator.*; FE/src/pages/cost-calculator.vue \| VERIFIED-SOURCE]

| Control (exact) | Default | Range | Tag |
|---|---|---|---|
| "How many instances will you be running?" (hint "(min 1 / max 100) 1 Instance = 1 Node") | 3 | 1 to 100; min 2 when the sync switch is on ("Minimum 2 instances required when data synchronization is enabled") | [src: i18n; cost-calculator.vue:882-905 \| VERIFIED-SOURCE] |
| "Renewal period" ("(Manual renewal required)") | 30 days | 1 Week (7), 2 Weeks (14), 1 Month (30), 3 Months (3% off, 90), 6 Months (6% off, 180), 12 Months (12% off, 360); converted to blocks as `days/30 * 88000` | [src: cost-calculator.vue:1036-1043, 1163 \| VERIFIED-SOURCE] |
| "How many cores do you require?" | 0.1 | 0.1 to 15.0 | [src: i18n costCalculator.cpuRange \| VERIFIED-SOURCE] |
| "How much memory will your app need?" | 100 MB | 100 to 59000 MB | same |
| "How much storage would you like?" | 1 GB | 1 to 820 GB | same |
| "Exposed Ports" (button "Add Exposed Port", Enter to add) | none | enterprise ports flagged "Additional fees apply for ports 0-1023, 8080, 8081, 8443, 6667" | same |
| "Enterprise Application" | off | "run on Arcane OS with enhanced privacy protection" | same |
| "Static IP Address" | off | | same |
| "Synchronize data across instances" | off | adds a `g:/data` volume to the dummy spec | [src: cost-calculator.vue:917-933 \| VERIFIED-SOURCE] |
| Result "Estimated Deployment Cost" | | FLUX and USD, "with {discount}% discount"; footer "*Estimated 1 Flux = ${rate} USD" | [src: i18n \| VERIFIED-SOURCE] |
| "Preset Configurations" (nodes / cpu / ram GB / ssd GB) | | 3/0.1/0.1/1, 3/5/5/50, 3/15/59/840 (over the 820 slider max, sic), 10/10/10/100, 50/5/10/100, 100/10/40/500, 100/15/59/840; "Select" fills the form | [src: cost-calculator.vue:1048-1112 \| VERIFIED-SOURCE] |

Behaviour: posts a dummy spec (name `costcalc`, image `runonflux/jetpack2:latest`) to `/apps/calculatefiatandfluxprice` and shows the answer; retries up to 3 times on network errors. It prices a NEW app (no pro-rata credit). Enterprise pricing falls back to standard if no ArcaneOS public key is available ("Enterprise cost calculation requires Arcane OS node. Showing standard pricing instead."). | [src: cost-calculator.vue:1163-1330 \| VERIFIED-SOURCE]

One in-app help answer still says "Minimum 3 instances required" while the input allows 1. The docs link `https://cloud.runonflux.io/cost_calculator` works through two redirects (`.io` to `.com`, then SPA redirect to `/cost-calculator`). | [src: i18n pages.costCalculator.help.instanceAnswer; additional-routes.js; curl -I https://cloud.runonflux.io \| VERIFIED-LIVE]

---

### 9.12 AI agents (MCP)

This subsection records how the FluxCloud front end at `cloud.runonflux.com` presents the Flux Cloud MCP server. The server itself (versions, the three ways to connect, keys, the 15 tools, plan and confirm, cost of a cancel, stale guides) is 15.1; the assistant in the new console front end is 15.2; the Orbit MCP server is a different product (15.4). Where a row below and 15.1 differ, 15.1 wins. Rows rewritten 2026-10-13.

| Item | Value | Tag |
|---|---|---|
| UI | header button "AI Agents" (tooltip "Let AI agents deploy on Flux Cloud through the official MCP server"); popover "Deploy with AI agents" with "Hosted server" (URL to paste) and "Local server" (needs Node.js); note "The agent creates a dedicated Flux ID and payment address for you. Fund that address with only what a deployment needs and never share the keys of a wallet you use elsewhere." Confirmed 2026-10-13 (15.2.9). The new console front end has its own `/agents` page (15.2.6) and its hosted config is a bare URL with no header (15.1.2) | [src: i18n components.agentMcpToggler.* \| VERIFIED-SOURCE] |
| Hosted endpoint | `https://mcp.runonflux.com/mcp` and `https://mcp.runonflux.io/mcp`. Both answer `initialize` with the same stateless server; no authentication is asked for; `GET /mcp` is 405 and only POST works. The hosted server reports version 0.2.2 (`/healthz` and `serverInfo`), not the 0.2.7 that npm lists as latest (15.1.1, 15.1.2) | [src: curl -I https://mcp.runonflux.com/mcp (405 on GET); GET /healthz on both hostnames 2026-10-13; hosted initialize \| VERIFIED-LIVE]; "stores nothing and holds no keys" is the docs' statement [src: docs:ai-agents-mcp \| DOCS-ONLY] |
| Local | `npx -y @runonflux/flux-cloud-mcp` over stdio; keys in the process environment (`FLUX_ID_PRIVATE_KEY`, `FLUX_PAYMENT_PRIVATE_KEY`, WIF). npm `latest` is 0.2.7 (published 2026-09-13), Node 20+, MIT, two bins (`flux-cloud-mcp`, `flux-cloud-mcp-http`). More variables in 15.1.14 | [src: mcp@0.2.7 package.json, dist/config.js; `npm view` 2026-10-13 \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| Identity | Two keys, no account: a Flux ID key (address starts `1`, owns apps and signs, never needs funds) and a payment key (`t1...`, holds FLUX). The owner must be a `1...` Flux ID: an Ethereum or SSO-owned app cannot be operated by this server. In hosted mode the private keys are tool-call arguments (`fluxIdPrivateKey`, `paymentPrivateKey`), so they pass through the AI vendor and the chat history; local stdio mode keeps them in the process (15.1.3) | [src: mcp@0.2.7 dist/keys.js, dist/spec.js, dist/server.js \| VERIFIED-SOURCE] |
| Tools (15) | `flux_get_identity`, `flux_generate_keys`, `flux_get_pricing`, `flux_build_spec`, `flux_validate_spec`, `flux_quote_app`, `flux_deploy_app`, `flux_wait_for_app`, `flux_get_app`, `flux_list_my_apps`, `flux_get_app_logs`, `flux_get_app_stats`, `flux_control_app`, `flux_cancel_app`, `flux_get_network_info`. The same 15 names are in package 0.2.7, the hosted `tools/list` and the console `/agents` page. Only `flux_deploy_app` and `flux_cancel_app` can spend, and only with `confirm=true`, a boolean the agent sets (not a human prompt). `flux_control_app` has no plan step, does not pay, and `hard=true` or `remove` deletes data (15.1.4, 15.1.5, 15.1.9) | [src: mcp@0.2.7 dist/server.js; hosted tools/list; console agents-*.js \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| Pricing | `flux_quote_app` and `flux_deploy_app` use the network calculator, so the USD price is the one FluxCloud charges, converted to FLUX with the 5% FLUX discount. CORRECTED 2026-10-13: `flux_get_pricing` and the hosted pricing guide are a local estimate that applies a "g: 20 percent" discount that does not exist and stops at the cent without the .49/.99 rounding (examples 1.78, 4.66, 10.80 against live quotes 1.99, 4.99, 10.99). Use `flux_quote_app` (15.1.7, 15.1.16) | [src: mcp@0.2.7 dist/pricing.js, dist/deploy.js; POST api /apps/calculatefiatandfluxprice 2026-10-13 \| VERIFIED-SOURCE and VERIFIED-LIVE]; the "same price as the UI" sentence [src: docs:ai-agents-mcp \| DOCS-ONLY] |

---

### 9.13 Network dashboards ("Flux Network" menu)

| Page | Exact section titles | Tag |
|---|---|---|
| Overview | "Total Nodes" (Cumulus, Nimbus, Stratus), "Node History", "Locked Supply", "FLUX Supply" (Max Supply, Circulating Supply), "Version Breakdown", "Tier Breakdown" | [src: i18n pages.dashboard.overview \| VERIFIED-SOURCE] |
| Resources | "Total vCores", "Total RAM", "Total SSD/NVMe", "Total HDD", "CPU History", "RAM History", "Storage History" | [src: i18n pages.dashboard.resources \| VERIFIED-SOURCE] |
| Map (`/dashboards/locations`) | "Geographic Locations", "Providers" | [src: i18n pages.dashboard.locations \| VERIFIED-SOURCE] |
| Rewards | "FluxNode Operator Rewards", "FLUX Collateral", "Per Day", "Per Week", "Per Month", "Historical Price Chart" | [src: i18n pages.dashboard.rewards \| VERIFIED-SOURCE] |
| Node List (no menu entry) | columns "IP Address", "Address", "Country", "Provider", "Last Paid", "Tier" | [src: i18n pages.dashboard.list.columns \| VERIFIED-SOURCE] |

Collateral in node config: Cumulus 1000, Nimbus 12500, Stratus 40000 FLUX (matches docs). | [src: BE/ZelBack/config/default.js:668-672 \| VERIFIED-SOURCE]

---

### 9.14 UI strings lesson authors can quote (copy exactly)

All read from `i18n` (en.json) unless noted. Strings containing an en dash or a middle dot are flagged. Docs-only phrases are listed at the end so nobody quotes them as on-screen text.

Navigation: "My Applications", "Register New App", "App Marketplace", "Games", "WordPress", "FluxDrive", "Cost Calculator", "Flux Network", "Overview", "Resources", "Map", "Rewards", "Flux XDAO", "Help", "Login", "Learn More".

Landing and choice: "Deploy Your App on FluxCloud", "How would you like to deploy?", "Deploy with Git", "Deploy with Docker", "Git-based Deployment", "Container-based Deployment", "Back to deployment options", "Configure Your Deployment".

Simple mode: "Deploy an app", "Simple", "Advanced", "Container", "Docker image", "This image is private", "App name", "Contact email", "Networking", "Port your app listens on", "Add another port", "Environment variables", "Add variable", "Power", "per copy", "CPU", "Memory", "Disk", "Storage", "This app stores data", "Folder to keep", "Keep it safe across node failures", "Reliability", "Copies of your app", "Location", "Run only in specific regions", "Subscription period", "Estimated cost", "Live estimate", "I accept the Terms & Conditions", "Review & deploy", "Open Advanced settings".

Advanced mode: "Register New Application", "Import compose / spec", "General", "Geolocation", "Components", "Priority Nodes", "Enterprise Nodes", "Application Name", "Description", "Owner", "Contact", "Instances", "Period", "Renewal", "Static IP", "Enterprise", "Allowed Geolocation", "Forbidden Geolocation", "Add Allowed Location", "Add Forbidden Location", "Repository Tag", "Repository Authentication", "Secrets", "Container Data Path", "Data Path Builder", "Environment Variables", "Commands", "Port Bindings", "Add Port Mapping", "Exposed Port", "Container Port", "Custom Domains", "Hardware Resource", "SSD/NVMe", "Review", "Review & Validate", "Validate App Spec", "Total Cost", "Expiry", "Signature", "Sign Message", "Registered", "Test Application Installation", "Test & Pay", "Select payment method", "Pay with Card", "Pay with FLUX", "Registration Successful!", "Deployment Successful!", "Manage Application", "Free update".

Payment words: "Stripe", "PayPal", "Zelcore", "SSP", "Send to", "Message", "Copy Address", "Copy Message", "Payment window:", "30 minutes remaining", "Deployment time:", "Up to 45 min after payment", "Enable auto-renewal", "Manage Billing", "Auto-renewing", "Payment issue".

Manage page: "My Active Apps", "My Expired Apps", "Manage", "Visit", "Specifications", "Information", "File Changes", "Monitoring", "Logs", "Secure Shell", "Control", "Backup & Restore", "Instances", "Subscription", "Local", "Global", "Manual", "Start Application", "Stop Application", "Restart Application", "Pause Application", "Unpause Application", "Remove Application", "Soft Reinstall", "Hard Reinstall", "Start Monitoring", "Stop Monitoring", "Stop & Delete Data", "Create Backup", "Download all", "Remove all backup files", "FluxDrive", "Upload File", "Remote URL", "Connect", "Disconnect", "New Terminal", "Log Viewer", "Line Count", "Logs Since", "Filter Logs", "Auto Refresh", "Display Timestamp", "Renewal", "Update", "Cancel", "Cancel Subscription", "Cancel Application".

Marketplace: "Flux Application Marketplace", "Buy Now", "Install {name}", "Minimum Requirements", stepper "Config", "Params", "Location", "Alerts", "Sign", "Payment", "Deploy", "Sign and Register", "Pay with Credit Card", "Pay with PayPal", "Deployment Summary", "Install WordPress", "WordPress Dapp Name", "Performance Plan".

Cost calculator: "App Hosting Cost Calculator", "Calculate Price", "Estimated Deployment Cost", "Preset Configurations", "Enterprise Application", "Static IP Address", "Synchronize data across instances".

Login: "Google", "Apple ID", "Wallets", "ZelCore", "SSP", "WalletConnect", "MetaMask", "Manual", "Create SSO Account", "Get new login phrase", "Check your email".

Strings with special punctuation: "Enter a valid port (1-65535)." (en dash); "{count} copies · pay in FLUX or by card · cancel anytime" (middle dots).

Docs-only wording that is NOT on screen today: the Shared DB tab "Details", "Validate App Specs", "Verify Total Cost", "Application Test", "Pay for Your Application", "Registration" (as a step name), "Priority Nodes tab appears whenever Enterprise is on", "Kind: 0 Directory / 1 File".

---

### 9.15 Snapshot 2026-10-12 (numbers that change)

| Item | Value | Tag |
|---|---|---|
| Flux chain height | 3,031,428 | [src: https://api.runonflux.io/daemon/getblockcount \| VERIFIED-LIVE] |
| FLUX/USD implied by calculator | about $0.0852 (0.99 x 0.95 / 11.04 FLUX) | [src: https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| Minimum app price | $0.99 per month, 11.04 FLUX | same |
| Frontend version | `flux-gravity` 3.20.9 (source and live bundle agree) | [src: FE/package.json; https://cloud.runonflux.com/assets/index-DgMIkB-Z.js \| VERIFIED-LIVE] |
| Marketplace records | 195 total; 97 visible and enabled (NewGames 28, Games 21, Blockchain 19, Productivity 12, Masternode 7, Front-end 5, Hosting 5) | [src: https://api.marketplace.runonflux.io/api/v1/marketplace/apps \| VERIFIED-LIVE] |
| WordPress plans | Basic 2.99, Standard 7.99, Pro 12.99, Ultra 21.99, Enterprise 34.99 | [src: https://api.marketplace.runonflux.io/api/v1/wordpress/plans \| VERIFIED-LIVE] |
| FluxDrive plans | 10 GB 0.50, 50 GB 2.50, 100 GB 5.00 | [src: https://api.fluxdrive.runonflux.io/api/v1/config \| VERIFIED-LIVE] |
| Orbit plans | Starter 0.99, Standard 2.49, Pro 3.99, Custom from 0.99; first week free for new accounts (a promotion, not a plan; the old Free plan is closed). Unchanged on 2026-10-13, footer `v1.1.101`; 15.3.10 | [src: https://runonflux.com/apps/orbit \| VERIFIED-LIVE] |
| Game hub "from" prices | Terraria 1.49, Minecraft 1.99, Factorio 2.49, Hytale 2.99, Enshrouded 3.49, Palworld 3.49, Unturned 4.49, Don't Starve Together 4.49, Valheim 4.99, Windrose 4.99, Project Zomboid 4.99, Satisfactory 4.99, Garry's Mod 4.99, Dragonwilds 5.49, 7 Days to Die 5.99, V Rising 6.99, Rust 7.49, Arma Reforger 7.49, ARK 11.99, FiveM 12.49 | [src: https://runonflux.com/games/ \| VERIFIED-LIVE] |
| Hub network claim | 7,120 servers in 57 countries (marketing figure on runonflux.com) | [src: https://runonflux.com/games/ \| VERIFIED-LIVE] |
| Docker Hub `runonflux/orbit` | updated 2026-09-28, 261,924 pulls | [src: https://hub.docker.com/v2/repositories/runonflux/orbit \| VERIFIED-LIVE] |
| `@runonflux/flux-cloud-mcp` | 0.2.7 on npm (published 2026-09-13T07:13Z, `latest`); the hosted server `mcp.runonflux.com` and `.io` reports 0.2.2 at the time of writing (15.1.1) | [src: flux-cloud-mcp/package.json; `npm view` and GET /healthz 2026-10-13 \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| Rate card (USD) | cpu 0.15, ram 0.05, hdd 0.02, port 2, scope 4, staticip 2, fluxmultiplier 0.95, minUSDPrice 0.99 | [src: https://stats.runonflux.io/apps/getappspecsusdprice \| VERIFIED-LIVE] |

---

### 9.16 What I could not verify

- The rendered logged-in DOM of Advanced mode (no login allowed). Labels come from the same 3.20.9 build the site serves, via i18n and component source.
- Whether Advanced mode opens with Instances 1 or 3 for a brand-new spec: the seed is 1 and the component re-seeds from the spec (fallback 3 only if the spec lacks a value, `SubscriptionManager.vue:5246`), so 1 is expected. | [src: SubscriptionManager.vue:4286, 5246 \| UNVERIFIED]
- Orbit repo-level config file names for the new managed product: none documented (confirmed again 2026-10-13, 15.3.13). Whether the Docker-image flow in the docs is still the recommended route: SETTLED 2026-10-13 (15.3.1), it is the layer the managed product itself registers, so "deploy with Git on Orbit" and "deploy the `runonflux/orbit` image yourself" are two doors into one image.
- Game hub checkout steps on runonflux.com/games/*: only public plan pages were read.
- Final checkout price of marketplace one-click apps through FluxCloud (backend applies `multiplier` and rounding at checkout): only generic specs were checked through the calculator.
- Which card (Git or Docker) renders the `NEW` and `BETA` badges.
- Updated 2026-10-13: the meaning of "Deployment Successful!", the 30 minute payment watcher and the static "Payment window" label are now read from `SubscriptionManager.vue` and recorded in 6.6. Still not observed: the card bridge's own link expiry, who sends the deployment and expiry emails, and whether the weekly automatic backup exists (see 14.2).

## 10. Read-only HTTP API worth teaching (verified 2026-10-12)

Scope: public, unauthenticated, read-only endpoints of the FluxOS node API (served through `https://api.runonflux.io`) and of `https://stats.runonflux.io`, tested live on 2026-10-12 with `curl -s -m 20`, at most 2 requests per second, GET only (plus 2 POSTs to read-only price calculators). FluxOS source is v8.20.0 (commit 3ca1ab9). Samples are real responses, trimmed (arrays cut to 1 to 3 items, long strings shortened, enterprise ciphertext replaced by a placeholder). Full-size raw captures are not kept in the repo; trimmed samples live in `frag/samples/<name>.json`.

Tag legend: `VERIFIED-LIVE` observed today, `VERIFIED-SOURCE` read in source, `DOCS-ONLY`, `UNVERIFIED`. Source paths are relative to the FluxOS clone (`ZelBack/...`) unless a full prefix is given.

### 10.1 Where requests go

| Target | What it is | Notes |
|---|---|---|
| `https://api.runonflux.io` | HAProxy gateway in front of confirmed FluxNodes, which forwards to a node's FluxOS API (port 16127 family). | Sticky by client IP for most paths, round-robin for a few. Every response carries a `fluxnode: serverNN_<ip>` header naming the node that answered. [src: https://api.runonflux.io/daemon/getblockcount response header `fluxnode: server24_188.40.127.18` \| VERIFIED-LIVE] |
| `https://stats.runonflux.io` | Separate stats service (fluxstats), behind Cloudflare. | Response headers show `server: cloudflare`, `cf-ray`. Not a FluxOS node. [src: https://stats.runonflux.io/apps/multiplier response headers \| VERIFIED-LIVE] |
| `https://<ip-with-dashes>-<port>.node.api.runonflux.io` | HTTPS wrapper for one specific node, for example `https://176-9-51-187-16127.node.api.runonflux.io/flux/version`. | Answered 200 with `access-control-allow-origin: *` and the same body as the node. Used by the FluxOS web UI (`fluxos-frontend/src/utils/stickyBackend.js:27`). [src: https://176-9-51-187-16127.node.api.runonflux.io/flux/version \| VERIFIED-LIVE] |
| `http://<node-ip>:16127` | A single node directly (plain HTTP). | Answered 200 with `access-control-allow-origin: *`. A browser page served over HTTPS cannot call it (mixed content), so use the `node.api.runonflux.io` wrapper from web pages. [src: http://176.9.51.187:16127/flux/version \| VERIFIED-LIVE] |

Node API ports: the allowed API ports are 16127, 16137, 16147, 16157, 16167, 16177, 16187, 16197; the default is 16127. [src: ZelBack/config/default.js:29-30 | VERIFIED-SOURCE] Live location rows use all eight ports (counts over 8765 rows: 16127 = 4956, 16137 = 725, 16147 = 626, 16157 = 554, 16197 = 496, 16167 = 482, 16177 = 464, 16187 = 462). [src: https://api.runonflux.io/apps/locations | VERIFIED-LIVE]

Gateway routing (FluxDomain Manager HAProxy template):

- API backend uses `balance source`, so one client IP keeps landing on the same node. [src: flux-domain-manager/src/services/haproxyTemplate.js:342 | VERIFIED-SOURCE]
- A separate round-robin backend adds `X-Flux-Mode: Roundrobin` and serves paths beginning with `/apps/location`, `/apps/temporarymessages`, `/apps/testappinstall`, `/apps/appregister`, `/apps/appupdate`, `/apps/verifyappregistrationspecifications`, `/apps/verifyappupdatespecifications`. [src: flux-domain-manager/src/services/haproxyTemplate.js:365-369,421-429 | VERIFIED-SOURCE] Live: `x-flux-mode: Roundrobin` appeared on `/apps/location/explorer`, `/apps/locations`, `/apps/temporarymessages`. [src: https://api.runonflux.io/apps/locations | VERIFIED-LIVE]
- Source quirk: the first round-robin ACL is written `apps/calculatefiatandfluxprice` with no leading slash, and a request path always starts with `/`, so it would never match. Live: the calculator response had `fluxnode` but no `x-flux-mode` header. [src: flux-domain-manager/src/services/haproxyTemplate.js:422 ; POST https://api.runonflux.io/apps/calculatefiatandfluxprice | VERIFIED-SOURCE and VERIFIED-LIVE]
- `path_beg /apps/location` is a prefix match, so `/apps/locations` is round-robin too.
- Per-server `maxconn 100`, 3 retries with redispatch, server timeout 30 s on the sticky backend (line 356) and 120 s on the round-robin backend (line 380). [src: flux-domain-manager/src/services/haproxyTemplate.js:338-386 | VERIFIED-SOURCE]

Gateway versus single node. Use the gateway for network-wide data (chain height, node counts, global app specs, locations, prices). Use a specific node for anything about that machine (its benchmark, tier, installed apps, running containers, logs). Via the gateway these node-local calls return whichever node the gateway picked, so the answer is not about "the network". [src: fluxdocs/fluxapi.yaml:316-334 "Node-Scoped vs Network-Scoped Calls" | DOCS-ONLY; consistent with live: `/apps/fluxusage` returned `totalApps: 6` for the node `188.40.127.18`, not a network total | VERIFIED-LIVE]

### 10.2 Response envelope and errors

Every handler answers HTTP 200 and puts the outcome in the body.

```json
{ "status": "success", "data": <anything> }
{ "status": "error",   "data": { "code": <optional FluxOS code>, "name": "Error", "message": "..." } }
```

- `createDataMessage` builds `{status:'success', data}`; `createErrorMessage` builds `{status:'error', data:{code, name, message}}`. A third shape `{status:'warning', ...}` exists. [src: ZelBack/src/services/messageHelper.js:41-110 | VERIFIED-SOURCE]
- Live error samples carry only `name` and `message` (`code` is undefined and JSON drops it). They arrive at HTTP 200. [src: https://api.runonflux.io/apps/appspecifications/doesnotexist123 | VERIFIED-LIVE]
- The check that matters is `body.status === 'success'`, never `response.ok`. [src: fluxdocs/fluxapi.yaml "Response Envelope & Error Handling" | DOCS-ONLY, matches source and live]
- Wire statuses are only used before a handler runs: 403 (HTTPS-only endpoint over HTTP), 503 and 400 (route guards), 413 (body too large), 404 (unknown resource), 202 (long operation). [src: ZelBack/src/services/messageHelper.js:1-31 ; ZelBack/src/services/utils/routeGuards.js:12-90,116-126 | VERIFIED-SOURCE]
- An unknown path is an Express HTML 404, not JSON: `HTTP/2 404`, `content-type: text/html`, body `Cannot GET /apps/doesnotexist`. Always parse JSON defensively. [src: https://api.runonflux.io/apps/doesnotexist | VERIFIED-LIVE]
- `/apps/permanentmessages/abc` (hash matches nothing) is not an error: `{"status":"success","data":[]}`. A filter that matches nothing is an empty array. [src: https://api.runonflux.io/apps/permanentmessages/abc | VERIFIED-LIVE]
- Errors are never cached: `cache()` refuses to remember a response whose payload `status` is `error`; live error responses carried `cache-control: no-cache, no-store, must-revalidate`. [src: ZelBack/src/services/utils/routeGuards.js:139-199 ; https://api.runonflux.io/apps/location | VERIFIED-SOURCE and VERIFIED-LIVE]

Error sample, missing parameter:

```json
{"status": "error", "data": {"name": "Error", "message": "No Flux App name specified"}}
```

Error sample, app not found:

```json
{"status": "error", "data": {"name": "Error", "message": "Application: doesnotexist123 not found"}}
```

Name matching: app names are case-insensitive. `/apps/appspecifications/Explorer` returned the app named `explorer`, and `/apps/location/EXPLORER` returned the same 11316-byte body as `/apps/location/explorer`. [src: https://api.runonflux.io/apps/appspecifications/Explorer ; https://api.runonflux.io/apps/location/EXPLORER | VERIFIED-LIVE] Source: `/apps/location/:appname` builds `new RegExp('^<appname>$','i')` from the raw path segment, so regex characters are interpreted. Do not rely on that; pass plain names. [src: ZelBack/src/services/appDatabase/registryManager.js:72-78 | VERIFIED-SOURCE]

Path or query: handlers accept either a path segment or a query-string parameter of the same name (for example `/apps/location?appname=explorer` and `/apps/location/explorer` are equivalent; the globalappsspecifications handler reads `hash`, `owner`, `appname` from either). [src: ZelBack/src/services/appDatabase/registryManager.js:628-634,1099-1118 | VERIFIED-SOURCE]

### 10.3 CORS, caching, rate limits, compression

| Topic | Fact |
|---|---|
| CORS on `api.runonflux.io` | Every tested GET answered `access-control-allow-origin: *` and `access-control-expose-headers: *`. The node mounts `cors()` with defaults; HAProxy also adds both headers when missing. [src: ZelBack/src/lib/fluxServer.js:30 ; flux-domain-manager/src/services/haproxyTemplate.js:80-81,94-95 ; all captures under live checks \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| CORS on `stats.runonflux.io` and `viprates.runonflux.io` | `access-control-allow-origin: *` observed on all tested GETs. [src: https://stats.runonflux.io/fluxinfo?projection=ip,tier,geolocation ; https://viprates.runonflux.io/rates \| VERIFIED-LIVE] |
| CORS preflight | Not tested (OPTIONS was out of scope). Plain GETs with no custom headers and `Content-Type: text/plain` POSTs are "simple" requests that need no preflight. Sending a `zelidauth` header or `application/json` would trigger one. [src: UNVERIFIED for OPTIONS, tried: not attempted because only GET/POST allowed by the task rules] |
| Browser test | Header-level only (curl). No in-browser fetch was run today. [UNVERIFIED in a real browser] |
| Server-side cache | Most public GETs are wrapped in `apicache` for 5 s to 30 min (per route in tables below). The cache keys on full URL. Only HTTP 200 and non-error bodies are cached. [src: ZelBack/src/routes.js:385-536 ; ZelBack/src/services/utils/routeGuards.js:149,185-199 \| VERIFIED-SOURCE] |
| Client cache headers | Responses carry `cache-control: max-age=N` where N is the remaining server cache life (so `/daemon/getblockcount` showed `max-age=7` although its route cache is 30 s). Uncached handlers (for example `/apps/appspecifications`) send no `cache-control` and an `etag`. [src: https://api.runonflux.io/daemon/getblockcount ; https://api.runonflux.io/apps/appspecifications/explorer \| VERIFIED-LIVE] |
| Rate limits, FluxOS | None on HTTP GET routes. The route table says so in a comment: "the API has no rate limiting". [src: ZelBack/src/routes.js:393-394 ; fluxdocs/fluxapi.yaml:332 \| VERIFIED-SOURCE] |
| What `rateLimit.js` is | `lruRateLimit(ip, limitPerSecond=20)` is a one-second token bucket. It is used only for (a) websocket peer messages, 120 per second per `ip:port` (`FluxPeerSocket.js:430`) and (b) `POST /id/...payment relay` requests, 5 per second per IP plus at most 10 pending per IP, answered `429` with `Too many payment requests` (`paymentRelayService.js:42,48,68-70`). It is not applied to the read endpoints in this document. [src: ZelBack/src/services/utils/rateLimit.js:1-55 ; ZelBack/src/services/utils/FluxPeerSocket.js:430 ; ZelBack/src/services/paymentRelayService.js:42-70 \| VERIFIED-SOURCE] |
| Rate limits, gateway | No `stick-table`, `rate`, or `deny` rule in the HAProxy template apart from a 403 backend for forbidden hosts. No `x-ratelimit-*`, `ratelimit-*`, or `retry-after` header appeared on any of about 70 captured responses. [src: flux-domain-manager/src/services/haproxyTemplate.js ; headers of all captures \| VERIFIED-SOURCE and VERIFIED-LIVE] The gateway may add limits outside the repo (the OpenAPI text says "may apply its own limits"). [src: fluxdocs/fluxapi.yaml:332-333 \| DOCS-ONLY] Actual throttling thresholds were not probed (task rule: max 2 req/s, no loops). [UNVERIFIED] |
| Rate limits, stats | Behind Cloudflare; no rate-limit headers observed on any of about 10 responses. Thresholds unknown. [src: https://stats.runonflux.io/* \| VERIFIED-LIVE for headers, UNVERIFIED for limits] |
| Compression | Server compresses with `compression()`; `content-encoding: br` was returned when the client sent `Accept-Encoding` (curl `--compressed`). Without it responses are plain. Wire sizes below are brotli. [src: ZelBack/src/lib/fluxServer.js:27 ; https://api.runonflux.io/apps/globalappsspecifications \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| Latency | Small responses 0.25 to 0.45 s from this machine; 1 to 3 MB responses 1.0 to 1.4 s total. Time to first byte on the big ones: 0.30 s (`/apps/hashes`), 0.36 s (`/apps/globalappsspecifications`), 0.55 s (`/apps/locations`), 0.80 s (`/daemon/listfluxnodes`). [src: all captures, curl `time_total` \| VERIFIED-LIVE] |
| Request timeout at gateway | Sticky backend `timeout server 30s`. A heavy query that exceeds that gets cut. [src: flux-domain-manager/src/services/haproxyTemplate.js:356 \| VERIFIED-SOURCE] |

Practical rule for a static site: fetch big lists once per page load, cache in memory or `sessionStorage`, and never poll faster than the server cache window (5 to 30 s).

Content Security Policy: the legacy academy `next.config.mjs` allowed only `connect-src 'self' https://api.runonflux.io https://vipbrates.zelcore.io`. The new site must also list `https://stats.runonflux.io`, `https://viprates.runonflux.io` and, if used, `https://*.node.api.runonflux.io` and `https://raw.githubusercontent.com`. [src: legacy/next.config.mjs:42 | VERIFIED-SOURCE (legacy repo)]

### 10.4 What needs authentication (excluded from this catalog)

Auth is a `zelidauth` header holding a URL-encoded query string `zelid=<addr>&signature=<urlencoded>&loginPhrase=<phrase>`. [src: ZelBack/src/services/utils/privileges.js:53 ; fluxdocs/fluxapi.yaml "Configure API Headers" | VERIFIED-SOURCE] Excluded:

- Anything under `/id/*` and `/zelid/*` that is not just a phrase generator (`loggedsessions`, `logoutcurrentsession`, `logoutallsessions`, `loggedusers`, `activeloginphrases`, `logoutallusers`). `/id/loginphrase` and `/id/emergencyphrase` are public GETs, but `loginphrase` inserts a row (valid 15 minutes) into the node's database on every call, so they are part of a login flow and not a read API. [src: ZelBack/src/routes.js:241-250,577-592,700-715 ; ZelBack/src/services/idService.js:287-311 | VERIFIED-SOURCE]
- App control and inspection on a node: `appstart`, `appstop`, `apprestart`, `appkill`, `appremove`, `redeploy`, `applog`, `appinspect`, `apptop`, `appstats`, `appmonitor`, `appchanges`, `installapplocally`, `testappinstall`, file and volume routes (`getfolderinfo`, `downloadfile`, `fluxshare/*`, `createfolder`, `renameobject`, `removeobject`). Several answer 503 with `Retry-After` during boot (`requireBootSettled`, `requirePolicyReady`). [src: ZelBack/src/routes.js:947-1033,1227-1302 ; ZelBack/src/services/utils/routeGuards.js:12-90 | VERIFIED-SOURCE]
- Node admin: `/flux/*` update, restart, log, peer and port-mapping routes, `/benchmark/start|restart|stop`, `/daemon/*` that stop, ban or sign, and `/explorer/reindex|rescan|restart|stop`. [src: ZelBack/src/routes.js:719-930 | VERIFIED-SOURCE]
- `/apps/listappsimages`, `/apps/appcomponentnames`, `/apps/updatetolatestspecs` (flux team or owner). [src: ZelBack/src/routes.js:428,464,473 | VERIFIED-SOURCE]
- `/apps/appspecifications/:name?decrypt=true` (app owner only, needs an `enterprise-key` header). Without credentials: `"Header with enterpriseKey is mandatory for enterprise Apps."` [src: ZelBack/src/services/appDatabase/registryManager.js:920-957 ; https://api.runonflux.io/apps/appspecifications/Fluxtracker?decrypt=true | VERIFIED-SOURCE and VERIFIED-LIVE]
- Registration and update: `POST /apps/appregister`, `/apps/appupdate`, `/apps/verifyappregistrationspecifications`, `/apps/verifyappupdatespecifications` and the like. State-changing or part of the registration workflow, not read-only. Not called.
- Mixed or partial: `/daemon/getinfo` is public but omits `balance` unless the caller is the node operator. [src: ZelBack/src/services/daemonService/daemonServiceControlRpcs.js:32-46 | VERIFIED-SOURCE]
- `GET /daemon/sendrawtransaction/...`, `/daemon/createrawtransaction/...`, `/daemon/createmultisig` are wired as GET routes with no cache and are not educational reads. Not called. [src: ZelBack/src/routes.js:186-218 | VERIFIED-SOURCE]

### 10.5 Snapshot 2026-10-12 (values that change)

| Item | Value | Source |
|---|---|---|
| Chain height (`/daemon/getblockcount`) | 3031422 at 19:59:43Z (`/daemon/getinfo` later showed 3031426) | [src: https://api.runonflux.io/daemon/getblockcount \| VERIFIED-LIVE] |
| FluxOS version on gateway nodes | 8.20.0 | [src: https://api.runonflux.io/flux/version \| VERIFIED-LIVE] |
| Daemon version | 9010050 (reported by `/daemon/getinfo`) | [src: https://api.runonflux.io/daemon/getinfo \| VERIFIED-LIVE] |
| Total confirmed nodes | 7105 (stable 7105) | [src: https://api.runonflux.io/daemon/getfluxnodecount \| VERIFIED-LIVE] |
| Nodes by tier | CUMULUS 3585, NIMBUS 1691, STRATUS 1829 | [src: https://api.runonflux.io/daemon/getfluxnodecount ; https://api.runonflux.io/daemon/listfluxnodes \| VERIFIED-LIVE] |
| Collateral per tier (`amount` in list) | CUMULUS 1000.00, NIMBUS 12500.00, STRATUS 40000.00 FLUX | [src: https://api.runonflux.io/daemon/listfluxnodes \| VERIFIED-LIVE] |
| FluxOS versions across nodes (stats) | 8.20.0 on 6972 of 7106 rows, 127 empty, 3 on 8.19.0, 3 on 8.18.0 | [src: https://stats.runonflux.io/fluxversions \| VERIFIED-LIVE] |
| Global app specs | 2076 apps (v8: 1775, v7: 198, v6: 61, v3: 27, v4: 11, v5: 2, v2: 2); 1121 have an encrypted `enterprise` field and an empty `compose` | [src: https://api.runonflux.io/apps/globalappsspecifications \| VERIFIED-LIVE] |
| Running location rows | 8765 rows, 4192 distinct `ip:port`, 2000 distinct app names | [src: https://api.runonflux.io/apps/locations \| VERIFIED-LIVE] |
| App hash records | 73519 | [src: https://api.runonflux.io/apps/hashes \| VERIFIED-LIVE] |
| USD price table | cpu 0.15 per 0.1 core, ram 0.05 per 100 MB, hdd 0.02 per GB, port 2, scope 4, staticip 2, fluxmultiplier 0.95, multiplier 1, minUSDPrice 0.99 | [src: https://api.runonflux.io/apps/getappspecsusdprice ; https://stats.runonflux.io/apps/getappspecsusdprice \| VERIFIED-LIVE] |
| FLUX in USD (rates service) | about 0.0852 (BTC/USD 81956.23 times FLUX/BTC 1.04e-06) | [src: https://viprates.runonflux.io/rates \| VERIFIED-LIVE] |
| Calculator quote for a 3-instance 0.5 CPU / 500 MB / 5 GB app, 88000 blocks | usd 0.99, flux 11.04, fluxDiscount 5 | [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| Latest app spec version | 8 | [src: https://api.runonflux.io/apps/latestspecificationversion \| VERIFIED-LIVE] |
| Policy bundle | seq 5, issued 2026-10-04T09:12:10Z; 292 blocked repositories, 311 blocklist entries, 14 tampering-blocked nodes, 0 vetted repositories | [src: https://raw.githubusercontent.com/RunOnFlux/fluxos-network-policy/signed/policy-signed.json \| VERIFIED-LIVE] |

### 10.6 Catalog

Format per entry: URL, parameters, return, fields, size and caching, CORS, sample. "CORS" below means the `access-control-allow-origin: *` header was present on the live GET. Size is decoded JSON bytes unless "wire" is stated (brotli).

#### 10.6.1 Chain and network state

##### E1. `GET /daemon/getblockcount`

- Returns the chain height as a bare integer in `data`. Passthrough of the daemon RPC `getBlockCount`. [src: ZelBack/src/services/daemonService/daemonServiceBlockchainRpcs.js:64-70 | VERIFIED-SOURCE]
- Params: none. Size 35 bytes. Route cache 30 s. CORS yes. 0.27 s. [src: ZelBack/src/routes.js:108 ; https://api.runonflux.io/daemon/getblockcount | VERIFIED-SOURCE and VERIFIED-LIVE]
- Teaching use: app registration height and expiry are expressed in blocks, so this is the clock for "how long until my app expires".

```json
{"status": "success", "data": 3031422}
```

##### E2. `GET /daemon/getfluxnodecount`

- Returns counts of confirmed nodes. `total` and `stable` are node totals; `<name>-enabled` pairs give counts per tier under both the old names (`basic`, `super`, `bamf`) and the current names (`cumulus`, `nimbus`, `stratus`). `ipv4`, `ipv6`, `onion` are network-type counters; `ipv4` (2516) does not equal `total` (7105), so do not read it as "number of IPv4 nodes" without checking the daemon source (UNVERIFIED meaning). [src: ZelBack/src/services/daemonService/daemonServiceFluxnodeRpcs.js:110-116 ; https://api.runonflux.io/daemon/getfluxnodecount | VERIFIED-SOURCE and VERIFIED-LIVE]
- Tier counts match the `tier` field distribution of `/daemon/listfluxnodes` (3585 / 1691 / 1829). [src: https://api.runonflux.io/daemon/listfluxnodes | VERIFIED-LIVE]
- 217 bytes, route cache 30 s, CORS yes, 0.26 s. [src: ZelBack/src/routes.js:84 | VERIFIED-SOURCE]

```json
{
  "status": "success",
  "data": {
    "total": 7105,
    "stable": 7105,
    "basic-enabled": 3585,
    "super-enabled": 1691,
    "bamf-enabled": 1829,
    "cumulus-enabled": 3585,
    "nimbus-enabled": 1691,
    "stratus-enabled": 1829,
    "ipv4": 2516,
    "ipv6": 0,
    "onion": 0
  }
}
```

##### E3. `GET /daemon/listfluxnodes[/:filter]`  (also `?filter=` and `?limit=N`)

- Returns the deterministic node list. Fields: `collateral`, `txhash`, `outidx`, `ip` (observed: host only for a node on port 16127, `host:port` for other ports), `network`, `added_height`, `confirmed_height`, `last_confirmed_height`, `last_paid_height`, `tier`, `payment_address`, `pubkey`, `activesince`, `lastpaid` (unix seconds as strings), `amount` (collateral), `rank`. [src: https://api.runonflux.io/daemon/listfluxnodes | VERIFIED-LIVE]
- `filter` is forwarded to the daemon RPC; `/daemon/listfluxnodes/176.9.51.187` returned that single node. `?limit=2` returned 2 rows; `limit` must match `^[1-9]\d{0,6}$`. [src: ZelBack/src/services/daemonService/daemonServiceFluxnodeRpcs.js:33-58 ; https://api.runonflux.io/daemon/listfluxnodes/176.9.51.187 ; https://api.runonflux.io/daemon/listfluxnodes?limit=2 | VERIFIED-SOURCE and VERIFIED-LIVE]
- Size warning: 7105 rows, 4,407,730 bytes decoded, 577,634 bytes brotli, 1.35 s. Prefer `?limit=` or a filter, or use stats `/fluxinfo` with a projection for geography. Route cache 30 s. CORS yes. [src: ZelBack/src/routes.js:72 ; https://api.runonflux.io/daemon/listfluxnodes | VERIFIED-SOURCE and VERIFIED-LIVE]
- Same data, older name: `/daemon/viewdeterministicfluxnodelist`, `/daemon/listzelnodes` (deprecated alias). [src: ZelBack/src/routes.js:72-82 | VERIFIED-SOURCE]

```json
{
  "status": "success",
  "data": [
    {
      "collateral": "COutPoint(72dc25bd297c9af594c2ce2f69bd282da3df4cbc50f0c2f4202b8b8761cc36c6, 0)",
      "txhash": "72dc25bd297c9af594c2ce2f69bd282da3df4cbc50f0c2f4202b8b8761cc36c6",
      "outidx": "0",
      "ip": "198.58.241.193:16147",
      "network": "ipv4",
      "added_height": 3010486,
      "confirmed_height": 3010491,
      "last_confirmed_height": 3031168,
      "last_paid_height": 3027868,
      "tier": "CUMULUS",
      "payment_address": "t1YEbcPvaw9AvMXJTWbx7BpKeq1DvEQ5GPh",
      "pubkey": "04ddd3488f2e474b11c1aa09810ee7e52e1dec37010ba3b923f0bb6f490117182eae6ca9633df...",
      "activesince": "1791205084",
      "lastpaid": "1791728074",
      "amount": "1000.00",
      "rank": 0
    }
  ]
}
```

##### E4. `GET /daemon/getblockchaininfo` and E5. `GET /daemon/getdoslist`

- `getblockchaininfo`: chain name, `blocks`, `headers`, `bestblockhash`, `difficulty`, `verificationprogress`, `chainwork`, `size_on_disk`, `valuePools`, `softforks`, `upgrades`. 1254 bytes; route cache 30 s; CORS yes. [src: ZelBack/src/routes.js:105 ; https://api.runonflux.io/daemon/getblockchaininfo | VERIFIED-SOURCE and VERIFIED-LIVE]
- `getdoslist`: nodes currently in the daemon's DOS list. Each entry has `collateral`, `added_height`, `payment_address`, `eligible_in` and `amount`; the unit of `eligible_in` (blocks) and exact meaning are inferred from the field names, not from the daemon docs (UNVERIFIED). 241 bytes with 1 entry. [src: ZelBack/src/routes.js:90 ; https://api.runonflux.io/daemon/getdoslist | VERIFIED-SOURCE and VERIFIED-LIVE]

```json
{
  "status": "success",
  "data": {
    "chain": "main",
    "blocks": 3031426,
    "headers": 3031426,
    "bestblockhash": "4bcf30897ff61a7ccd9ea18b182d94139de004336c5800d0ee5faa9a57725d74",
    "difficulty": 0.05212247006388069,
    "verificationprogress": 0.9999997623123246,
    "chainwork": "0000000000000000000000000000000000000000000000000f704aefdead3c2f",
    "pruned": false,
    "size_on_disk": 35564066739,
    "commitments": 815736,
    "valuePools": [
      {"id": "sprout", "monitored": true, "chainValue": 19291.17735041, "chainValueZat": 1929117735041},
      {"id": "sapling", "monitored": true, "chainValue": 77188.75921324, "chainValueZat": 7718875921324}
    ],
    "softforks": [
      {
        "id": "bip34",
        "version": 2,
        "enforce": {"status": true, "found": 4000, "required": 750, "window": 4000},
        "reject": {"status": true, "found": 4000, "required": 950, "window": 4000}
      },
      {
        "id": "bip66",
        "version": 3,
        "enforce": {"status": true, "found": 4000, "required": 750, "window": 4000},
        "reject": {"status": true, "found": 4000, "required": 950, "window": 4000}
      }
    ],
    "upgrades": {
      "76b809bb": {"name": "PON", "activationheight": 2020000, "status": "active", "info": "Proof of Node activation"}
    },
    "consensus": {"chaintip": "76b809bb", "nextblock": "76b809bb"}
  }
}
```

```json
{
  "status": "success",
  "data": [
    {
      "collateral": "COutPoint(4a8d43cb2f4857ef1d59d1856980df8a2e2ba43e2ce9ce73a05ddcfabf6dfc77, 0)",
      "added_height": 3030873,
      "payment_address": "t1cQY3J9KtSdJ2sk7WfCZhgJcSccmnzTUuR",
      "eligible_in": 161,
      "amount": "1000.00"
    }
  ]
}
```

##### E6. `GET /explorer/scannedheight` and `GET /explorer/issynced`

- `scannedheight` returns `{generalScannedHeight}`, the height the node's explorer has indexed. `issynced` returns a bare boolean. Both route cache 30 s, CORS yes, under 100 bytes. [src: ZelBack/src/routes.js:559,1305 ; https://api.runonflux.io/explorer/scannedheight ; https://api.runonflux.io/explorer/issynced | VERIFIED-SOURCE and VERIFIED-LIVE]
- These describe one node's indexer, so via the gateway they reflect an arbitrary node. Compare with `/daemon/getblockcount` to detect a lagging node.

```json
{"status": "success", "data": {"generalScannedHeight": 3031426}}
```

##### E7. `GET /flux/version`

- Returns the FluxOS version string of the node that answered. Gateway nodes were all on `8.20.0`. 36 bytes, route cache 30 s, CORS yes. [src: ZelBack/src/routes.js:263 ; https://api.runonflux.io/flux/version | VERIFIED-SOURCE and VERIFIED-LIVE]
- For fleet-wide version distribution use stats `/fluxversions` (section 6.6).

```json
{"status": "success", "data": "8.20.0"}
```

#### 10.6.2 Deployment parameters and prices

##### E8. `GET /apps/deploymentinformation`

- The best single call for "what are the current deployment rules and legacy price table". Returns: `price` (the on-chain FLUX-denominated price schedule by block height; the last entry whose height is below the current height applies, and it acts as the floor for FLUX quotes), `appSpecsEnforcementHeights` (block at which each spec version became enforced), `address` (the address to pay for registration or update, chosen by height: base, multisig, or multisigB), `portMin`, `portMax`, `enterprisePorts`, `bannedPorts`, `maxImageSize` (bytes), `minimumInstances`, `maximumInstances`, `blocksLasting`, `minBlocksAllowance`, `maxBlocksAllowance`, `blocksAllowanceInterval`. [src: ZelBack/src/services/appQuery/deploymentInfoService.js:13-48 ; https://api.runonflux.io/apps/deploymentinformation | VERIFIED-SOURCE and VERIFIED-LIVE]
- `address` is the payment address to use: `t3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX` (multisigB, selected after block `multisigAddressChange` 1670000). Do not take it from `/apps/registrationinformation`, whose `address` is the old base address `t1LUs6...` (see E10). [src: ZelBack/src/services/appQuery/deploymentInfoService.js:18-24 ; https://api.runonflux.io/apps/deploymentinformation | VERIFIED-SOURCE and VERIFIED-LIVE]
- `maxBlocksAllowance` is 1,056,000 (the post-PoN value, selected when height is at or above `daemonPONFork` 2020000). `minimumInstances` shows 3 here although version 8 specs may use 1 instance since block 2176519 (see E10, `minimumInstancesV8`); this endpoint does not expose the v8 value. [src: ZelBack/src/services/appQuery/deploymentInfoService.js:29-31,32-48 ; ZelBack/config/default.js:413-416 | VERIFIED-SOURCE]
- 1173 bytes, route cache 30 s, CORS yes, 0.29 s. [src: ZelBack/src/routes.js:527 | VERIFIED-SOURCE]

```json
{
  "status": "success",
  "data": {
    "price": [
      {"height": -1, "cpu": 3, "ram": 1, "hdd": 0.5, "minPrice": 1, "port": 2, "scope": 6, "staticip": 3},
      {
        "height": 983000,
        "cpu": 0.3,
        "ram": 0.1,
        "hdd": 0.05,
        "minPrice": 0.1,
        "port": 2,
        "scope": 6,
        "staticip": 3
      }
    ],
    "appSpecsEnforcementHeights": {"1": 0, "2": 0, "3": 983000, "4": 1004000, "5": 1142000, "6": 1300000, "7": 1420000, "8": 1932380},
    "address": "t3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX",
    "portMin": 1,
    "portMax": 65535,
    "enterprisePorts": ["0-1023", 8080],
    "bannedPorts": ["16100-16299", "26100-26299"],
    "maxImageSize": 5000000000,
    "minimumInstances": 3,
    "maximumInstances": 100,
    "blocksLasting": 22000,
    "minBlocksAllowance": 5000,
    "maxBlocksAllowance": 1056000,
    "blocksAllowanceInterval": 1000
  }
}
```

##### E9. `GET /apps/getappspecsusdprice` (on `api.runonflux.io` and on `stats.runonflux.io`)

- Returns the USD price table used for quotes: `cpu` per 0.1 core, `ram` per 100 MB, `hdd` per GB (all per month, USD), `port` per enterprise port, `scope` surcharge for node-targeted deployment, `staticip` surcharge, `minPrice`, `fluxmultiplier` (0.95 means 5 percent off when paying in FLUX), `multiplier` (global price multiplier), `minUSDPrice` (minimum quote), `height` (valid from; -1 means always). [src: ZelBack/config/default.js:339-351 ; https://api.runonflux.io/apps/getappspecsusdprice | VERIFIED-SOURCE and VERIFIED-LIVE]
- Both hosts returned an identical body on 2026-10-12. Source of truth differs: the node returns its own `config.fluxapps.usdprice`; stats fetches `appSpecsUSDPrices.json` from the fluxstats GitHub repo. The node's price calculator itself asks stats first and falls back to its config. [src: ZelBack/src/services/appQuery/deploymentInfoService.js:67-76 ; fluxstats/src/services/fluxService.js:1344-1355 ; ZelBack/src/services/utils/appSpecHelpers.js:355-372 | VERIFIED-SOURCE]
- For the cost calculator, `stats.runonflux.io/apps/getappspecsusdprice` is the more authoritative host, and the docs point to it. [src: flux-docs/docs/fluxcloud/cost-calculator.md:42-44 | DOCS-ONLY]
- 178 bytes. Node route cache 30 minutes (`max-age=1425` observed); stats `max-age=475`. CORS yes on both. [src: ZelBack/src/routes.js:533 ; https://stats.runonflux.io/apps/getappspecsusdprice | VERIFIED-SOURCE and VERIFIED-LIVE]
- This is the price table only. It does not include the duration discounts, the small-app hardware discount, the `.49/.99` rounding, or the FLUX exchange rate; those are applied by the calculator (E14).

```json
{
  "status": "success",
  "data": {
    "height": -1,
    "cpu": 0.15,
    "ram": 0.05,
    "hdd": 0.02,
    "minPrice": 0.01,
    "port": 2,
    "scope": 4,
    "staticip": 2,
    "fluxmultiplier": 0.95,
    "multiplier": 1,
    "minUSDPrice": 0.99
  }
}
```

##### E10. `GET /apps/registrationinformation`

- Returns the node's whole `config.fluxapps` object (6527 bytes today, 147 top-level keys). Useful for limits and thresholds in one place: `latestSupportedSpecVersion`, `minimumInstances`, `minimumInstancesV8` and `minimumInstancesV8Block`, `maximumInstances`, `maxAppsPerNode`, `portMin`/`portMax`, `bannedPorts`, `enterprisePorts`, `maxImageSize`, `blocksLasting`, `minBlocksAllowance`, `newMinBlocksAllowance`, `maxBlocksAllowance`, `postPonMaxBlocksAllowance`, `daemonPONFork`, `blocksAllowanceInterval`, `appSpecsEnforcementHeights`, `price`, `usdprice`, plus many internal timing constants. [src: ZelBack/src/services/appDatabase/registryManager.js:1415-1420 ; https://api.runonflux.io/apps/registrationinformation | VERIFIED-SOURCE and VERIFIED-LIVE]
- It is a raw config dump: keys are not a stable API and are added or removed between FluxOS releases. Pick named fields defensively. Several values are not the live value: `fluxUSDRate: 0.6` is only the fallback rate in config (the live rate is about 0.0852, see section 8) and `address` is the legacy base address (use E8). [src: ZelBack/config/default.js:338 ; https://api.runonflux.io/apps/registrationinformation | VERIFIED-SOURCE and VERIFIED-LIVE]
- Values seen: `minimumInstances` 3, `minimumInstancesV8` 1 from block 2176519, `maximumInstances` 100, `maxAppsPerNode` 200, `maxImageSize` 5000000000, `blocksLasting` 22000, `daemonPONFork` 2020000, `postPonMaxBlocksAllowance` 1056000, `latestSupportedSpecVersion` 8. [src: https://api.runonflux.io/apps/registrationinformation | VERIFIED-LIVE]
- Route cache 30 s. CORS yes. The sample below keeps 22 of the keys.

```json
{
  "status": "success",
  "data": {
    "latestSupportedSpecVersion": 8,
    "price": [
      {"height": -1, "cpu": 3, "ram": 1, "hdd": 0.5, "minPrice": 1, "port": 2, "scope": 6, "staticip": 3},
      {"height": 983000, "cpu": 0.3, "ram": 0.1, "hdd": 0.05, "minPrice": 0.1, "port": 2, "scope": 6, "staticip": 3}
    ],
    "fluxUSDRate": 0.6,
    "usdprice": {"height": -1, "cpu": 0.15, "ram": 0.05, "hdd": 0.02, "minPrice": 0.01, "port": 2, "scope": 4, "staticip": 2, "fluxmultiplier": 0.95, "multiplier": 1, "minUSDPrice": 0.99},
    "appSpecsEnforcementHeights": {"1": 0, "2": 0, "3": 983000, "4": 1004000, "5": 1142000, "6": 1300000, "7": 1420000, "8": 1932380},
    "address": "t1LUs6quf7TB2zVZmexqPQdnqmrFMGZGjV6",
    "addressMultisigB": "t3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX",
    "portMin": 1,
    "portMax": 65535,
    "bannedPorts": ["16100-16299", "26100-26299"],
    "enterprisePorts": ["0-1023", 8080],
    "maxImageSize": 5000000000,
    "minimumInstances": 3,
    "minimumInstancesV8": 1,
    "minimumInstancesV8Block": 2176519,
    "maximumInstances": 100,
    "blocksLasting": 22000,
    "minBlocksAllowance": 5000,
    "maxBlocksAllowance": 264000,
    "postPonMaxBlocksAllowance": 1056000,
    "daemonPONFork": 2020000,
    "blocksAllowanceInterval": 1000
  }
}
```

##### E11. `GET /apps/latestspecificationversion`

- Returns the newest app specification version as an integer (`8` today). 29 bytes, route cache 5 minutes, CORS yes. [src: ZelBack/src/services/appQuery/appQueryService.js:479-485 ; ZelBack/src/routes.js:455 ; https://api.runonflux.io/apps/latestspecificationversion | VERIFIED-SOURCE and VERIFIED-LIVE]
- Mirrored on stats as `GET /apps/multiplier`, which returns the hard-coded literal `8` in fluxstats and is named misleadingly. It is not a price multiplier. Do not use it. [src: fluxstats/src/services/fluxService.js:1332-1342 ; https://stats.runonflux.io/apps/multiplier | VERIFIED-SOURCE and VERIFIED-LIVE]

```json
{"status": "success", "data": 8}
```

##### E12. `GET /apps/placementlocations`

- Returns node, fault-domain ("domains") and tier counts per continent and country, built from a cached placement table (`tableGenerated` was 2026-10-02T13:03:05Z, ten days old at test time). Top level: `tableAvailable`, `tableGenerated`, `total{nodes,domains}`, `unresolved`, `continents{<code>{nodes,domains,tiers{},countries{<code>{nodes,domains,tiers{}}}}}`. Useful for a "where can my app run" explainer. [src: ZelBack/src/routes.js:524 ; https://api.runonflux.io/apps/placementlocations | VERIFIED-SOURCE and VERIFIED-LIVE]
- Rejects any query string with a 400 (`rejectQueryParameters`). 4455 bytes, cache 30 s, CORS yes. [src: ZelBack/src/routes.js:524 ; ZelBack/src/services/utils/routeGuards.js:94-103 | VERIFIED-SOURCE]
- The sample is trimmed to 4 top-level keys and 1 item per list; the real payload has more continents.

```json
{"status": "success", "data": {"tableAvailable": true, "tableGenerated": "2026-10-02T13:03:05.957Z", "total": {"nodes": 7093, "domains": 272}, "unresolved": 35}}
```

##### E13. `GET /apps/enterprisenodes`

- Returns the scored node list the priority-node picker uses (not a capability list: any ArcaneOS node can host an enterprise app, 3.7). It holds every confirmed node whose address has no explicit port, i.e. on the default API port, with scoring: `tier`, `payment_address`, `txhash`, `outidx`, `pubkey` (the node's public key), `ip`, and point fields (`collateralPoints`, `maturityPoints`, `pubKeyPoints`, `enterprisePoints`, `enterpriseApps`, `score`). The OpenAPI text says encrypted app fields are "accessible to selected Enterprise Nodes only"; how scores drive selection was not traced. [src: https://api.runonflux.io/apps/enterprisenodes ; ZelBack/src/services/enterpriseNodesService.js:136-150 ; fluxdocs/fluxapi.yaml (calculatefiatandfluxprice `secrets` description) | VERIFIED-LIVE, VERIFIED-SOURCE, DOCS-ONLY]
- Size warning: 1,070,249 bytes today (about 1 MB). Cache 30 s. CORS yes, 0.97 s.

```json
{
  "status": "success",
  "data": [
    {
      "tier": "STRATUS",
      "payment_address": "t3TRUNKvgywghL1vU5bsGQqs9eVC17XcUnV",
      "txhash": "d775bf5c887da123039e71b2abf7754131a20d31f7c7f3ca1fd5c5150e88d624",
      "outidx": "0",
      "pubkey": "03cf1d8b708ca7f5979accb4d0dba35a90391e3dfc4422cf12670c929bb58d16ac",
      "ip": "176.9.25.184",
      "collateralPoints": 30,
      "maturityPoints": 500,
      "pubKeyPoints": 500,
      "enterprisePoints": 2000,
      "enterpriseApps": 0,
      "score": 3030
    },
    {
      "tier": "STRATUS",
      "payment_address": "t3TRUNKvgywghL1vU5bsGQqs9eVC17XcUnV",
      "txhash": "87bf3914b8348a835fb6579e3cd2096c9bfcd219dcc9ecca268ce7c105680c42",
      "outidx": "0",
      "pubkey": "03cf1d8b708ca7f5979accb4d0dba35a90391e3dfc4422cf12670c929bb58d16ac",
      "ip": "176.9.25.176",
      "collateralPoints": 30,
      "maturityPoints": 500,
      "pubKeyPoints": 500,
      "enterprisePoints": 2000,
      "enterpriseApps": 0,
      "score": 3030
    }
  ]
}
```

##### E14. POST calculators: `POST /apps/calculatefiatandfluxprice` and `POST /apps/calculateprice`

These are POST, but they only read. The handler computes a quote from the posted spec, the price table, the marketplace list and the FLUX rate; it writes nothing. `/apps/calculateprice` is a thin wrapper that calls the same function. [src: ZelBack/src/services/utils/appSpecHelpers.js:307-540,549-551 ; ZelBack/src/routes.js:506-511 | VERIFIED-SOURCE]

- Request: the app specification JSON as the raw body. Send `Content-Type: text/plain`. With `Content-Type: application/json` the request hangs and is never answered by the node (tested: curl with `--max-time 12` gave no response in 12 s, which was the client limit; the gateway itself answers 504 after about 30 s, see 4.2), because the JSON body parser consumes the stream before the handler reads it. A `text/plain` POST is also a CORS "simple request" (no preflight). [src: ZelBack/src/services/messageHelper.js:1-31 ; ZelBack/src/lib/fluxServer.js:29 ; fluxdocs/fluxapi.yaml:237-290 "Request bodies" ; POST https://api.runonflux.io/apps/calculatefiatandfluxprice | VERIFIED-SOURCE and VERIFIED-LIVE]
- Request used today (v8, one component, `expire` 88000 blocks):

```json
{"version":8,"name":"pricecheck","description":"price check","owner":"1XcNTEsgVND4eb3bsVa2bjktnZZSruVct",
 "compose":[{"name":"web","description":"web","repotag":"nginx:latest","ports":[38382],"domains":[""],
 "environmentParameters":[],"commands":[],"containerPorts":[80],"containerData":"/data","cpu":0.5,"ram":500,"hdd":5,"repoauth":""}],
 "instances":3,"contacts":[],"geolocation":[],"expire":88000,"nodes":[],"staticip":false}
```

- Response `data`: `usd` (price, number), `flux` (price in FLUX), `fluxDiscount` (percent discount for paying in FLUX, or the string `Not possible to define discount` when the on-chain minimum applies). [src: ZelBack/src/services/utils/appSpecHelpers.js:522-532 ; POST https://api.runonflux.io/apps/calculatefiatandfluxprice | VERIFIED-SOURCE and VERIFIED-LIVE]
- Rules visible in the function (use as a cross-check for the pricing fragment, not re-derived here): duration discount 3 percent at 3 months or more, 6 percent at 6 months, 12 percent at 9 months (`expire / defaultExpire`, default expire is `blocksLasting` times 4 after the PoN fork, so 88000 blocks); hardware discount 20 percent or 10 percent when instances are fewer than 4 (or spec version 3 or below); final USD price rounded up to a ".49 or .99" figure; minimum `minUSDPrice`; FLUX price is USD divided by FLUX rate times `fluxmultiplier`, but never below the on-chain minimum. [src: ZelBack/src/services/utils/appSpecHelpers.js:376-532 | VERIFIED-SOURCE]
- Errors are in-band: `{"status":"error","data":{"name":"Error","message":"Missing Flux App specification parameter name and/or description and/or owner"}}` (HTTP 200). [src: POST https://api.runonflux.io/apps/calculateprice with `{"version":8}` | VERIFIED-LIVE]
- The calculator calls external services (stats marketplace list, a FLUX rates service). It needs the node's daemon to be synced, otherwise answers `Daemon not yet synced.` [src: ZelBack/src/services/utils/appSpecHelpers.js:323-326 | VERIFIED-SOURCE]
- CORS yes (`access-control-allow-origin: *`). 0.54 s. Do not hammer it: it performs outbound HTTP per uncached call.

```json
{"status": "success", "data": {"usd": 0.99, "flux": 11.04, "fluxDiscount": 5}}
```

#### 10.6.3 App registry (the "global" view, same for every node)

##### E15. `GET /apps/appspecifications/:appname`

- Returns the current specification of one registered app. Param `appname` (case-insensitive). Optional `decrypt` is for owners only (excluded). [src: ZelBack/src/services/appDatabase/registryManager.js:884-967 | VERIFIED-SOURCE]
- Fields for v4+ (see sample): `version`, `name`, `description`, `owner` (FluxID, the owner's address), `compose[]` (components: `name`, `description`, `repotag`, `ports` (public ports), `domains`, `environmentParameters`, `commands`, `containerPorts`, `containerData`, `cpu`, `ram` (MB), `hdd` (GB), `tiered`, `repoauth`, `secrets`), `instances`, `contacts`, `geolocation`, `expire` (blocks), `nodes`, `staticip`, `hash` (the registration/update message hash), `height` (block where this version was registered or last updated). Enterprise (v8 with `enterprise` set): `compose` and `contacts` come back empty and an encrypted `enterprise` string holds the real data. [src: ZelBack/src/services/appDatabase/registryManager.js:909-920 ; https://api.runonflux.io/apps/appspecifications/Fluxtracker | VERIFIED-SOURCE and VERIFIED-LIVE]
- Expiry: an app expires when `height + expire` is below the explorer height (default `expire` is `blocksLasting` times 4 = 88000 for apps registered at or after block 2020000). Apps registered before the fork get the part after the fork multiplied by 4. [src: ZelBack/src/services/appDatabase/registryManager.js:1489-1511 | VERIFIED-SOURCE]
- Not found: HTTP 200 with `status: error`, message `Application: <name> not found`. Requires a synced daemon (`Daemon not yet synced.` otherwise). [src: ZelBack/src/services/appDatabase/registryManager.js:886-908 ; https://api.runonflux.io/apps/appspecifications/doesnotexist123 | VERIFIED-SOURCE and VERIFIED-LIVE]
- Size: about 1 KB for a 2-component app. No server cache (no `cache-control`, only `etag`). CORS yes, 0.3 s. [src: ZelBack/src/routes.js:467 ; https://api.runonflux.io/apps/appspecifications/explorer | VERIFIED-SOURCE and VERIFIED-LIVE]
- Older spec versions (v1 to v3) have a flat shape (`repotag`, `ports`, `cpu`, `ram`, `hdd` directly on the app, no `compose`); `/apps/globalappsspecifications?owner=196GJW...` returned such entries (`BitcoinWhitepaper` v3). [src: https://api.runonflux.io/apps/globalappsspecifications?owner=196GJWyLxzAw3MirTT7Bqs2iGpUQio29GH | VERIFIED-LIVE]

```json
{
  "status": "success",
  "data": {
    "version": 7,
    "name": "explorer",
    "description": "Official Flux Explorer explorer.runonflux.io",
    "owner": "196GJWyLxzAw3MirTT7Bqs2iGpUQio29GH",
    "compose": [
      {
        "name": "mongodb",
        "description": "db component",
        "repotag": "mvertes/alpine-mongo:latest",
        "ports": [],
        "domains": [],
        "environmentParameters": [],
        "commands": [],
        "containerPorts": [],
        "containerData": "/db",
        "cpu": 1,
        "ram": 2000,
        "hdd": 45,
        "tiered": false,
        "repoauth": "",
        "secrets": ""
      }
    ],
    "instances": 40,
    "contacts": [],
    "geolocation": [],
    "expire": 88000,
    "nodes": [],
    "staticip": false,
    "hash": "cfe8a3158c58a0b7438f81d5f314182f177ae68198bcfabcddc1ecfb635345a7",
    "height": 3004517
  }
}
```

Enterprise app (compose and contacts emptied, ciphertext in `enterprise`):

```json
{
  "status": "success",
  "data": {
    "version": 8,
    "name": "Fluxtracker",
    "description": "Tracks flux stats",
    "owner": "17CgKMG6SETpDv9GS17F1KxHCAD4uxsftW",
    "compose": [],
    "instances": 3,
    "contacts": [],
    "geolocation": [],
    "expire": 774628,
    "nodes": [],
    "staticip": false,
    "enterprise": "<base64 ciphertext, 1316 chars>",
    "height": 2969042,
    "hash": "1e633893fa3b32125973e2a1fdbff8197497eff2140208d379e177af47af77de"
  }
}
```

##### E16. `GET /apps/globalappsspecifications[/:hash/:owner/:appname]`  (or `?hash=&owner=&appname=`)

- Returns an array of specs, optionally filtered. Same entry shape as E15, but each entry is a stored record (includes `hash` and `height`) and there is no decryption path. Filters AND together. Filter by name: `?appname=explorer`; by hash: `/apps/globalappsspecifications/<hash>`; by owner: `?owner=<FluxID>`. All three were tested and worked (hash in the first path position). [src: ZelBack/src/services/appDatabase/registryManager.js:1099-1131 ; https://api.runonflux.io/apps/globalappsspecifications?appname=explorer ; https://api.runonflux.io/apps/globalappsspecifications/cfe8a3158c58a0b7438f81d5f314182f177ae68198bcfabcddc1ecfb635345a7 ; https://api.runonflux.io/apps/globalappsspecifications?owner=196GJWyLxzAw3MirTT7Bqs2iGpUQio29GH | VERIFIED-SOURCE and VERIFIED-LIVE]
- Note the `appname` filter here is an exact, case-sensitive match on `name` (`{ name: appname }`), unlike `/apps/location`. [src: ZelBack/src/services/appDatabase/registryManager.js:1115-1117 | VERIFIED-SOURCE]
- SIZE WARNING, unfiltered: 2076 entries, 2,922,251 bytes decoded, 1,491,107 bytes brotli, 1.0 s. Filtering by one owner (the Flux team owner `196GJW...`) still returned 211,952 bytes. Server cache 30 s, CORS yes. Prefer `?appname=` or `/:hash`. [src: https://api.runonflux.io/apps/globalappsspecifications | VERIFIED-LIVE]
- Enterprise apps appear with `compose: []` and a ciphertext `enterprise` string (1121 of 2076 today), so you cannot read their images or resources from public data. [src: https://api.runonflux.io/apps/globalappsspecifications | VERIFIED-LIVE]
- A related `GET /apps/availableapps` returns the same global list merged with this node's local app list, 2,929,125 bytes today. Prefer E16. [src: ZelBack/src/services/appDatabase/registryManager.js:1139-1165 ; https://api.runonflux.io/apps/availableapps | VERIFIED-SOURCE and VERIFIED-LIVE]

```json
{
  "status": "success",
  "data": [
    {
      "version": 7,
      "name": "explorer",
      "description": "Official Flux Explorer explorer.runonflux.io",
      "owner": "196GJWyLxzAw3MirTT7Bqs2iGpUQio29GH",
      "compose": [
        {
          "name": "mongodb",
          "description": "db component",
          "repotag": "mvertes/alpine-mongo:latest",
          "ports": [],
          "domains": [],
          "environmentParameters": [],
          "commands": [],
          "containerPorts": [],
          "containerData": "/db",
          "cpu": 1,
          "ram": 2000,
          "hdd": 45,
          "tiered": false,
          "repoauth": "",
          "secrets": ""
        }
      ],
      "instances": 40,
      "contacts": [],
      "geolocation": [],
      "expire": 88000,
      "nodes": [],
      "staticip": false,
      "hash": "cfe8a3158c58a0b7438f81d5f314182f177ae68198bcfabcddc1ecfb635345a7",
      "height": 3004517
    }
  ]
}
```

##### E17. `GET /apps/appowner/:appname` and E18. `GET /apps/apporiginalowner/:appname`

- `appowner`: current owner FluxID (string) of the app; error `Application not found` if absent. `apporiginalowner`: owner in the app's first `fluxappregister` message (the original registrant), which differs after an ownership transfer. Both 64 bytes, cache 30 s, CORS yes. [src: ZelBack/src/services/appDatabase/registryManager.js:987-1004 ; ZelBack/src/services/appQuery/appQueryService.js:492-520 ; https://api.runonflux.io/apps/appowner/explorer | VERIFIED-SOURCE and VERIFIED-LIVE]

```json
{"status": "success", "data": "196GJWyLxzAw3MirTT7Bqs2iGpUQio29GH"}
```

##### E19. `GET /apps/permanentmessages[/:hash/:owner/:appname]`

- Returns the on-chain app messages (history). Each item: `type` (`fluxappregister` or `fluxappupdate`), `version` (message version), `appSpecifications` (the spec at that time), `hash`, `timestamp`, `signature`, `txid`, `height`, `valueSat` (payment, apparently in 1e-8 FLUX units: `1600000000` would be 16 FLUX; inferred, not confirmed in source). Filters: `hash`, `owner` (matches `appSpecifications.owner`), `appname` (`appSpecifications.name`). [src: ZelBack/src/services/appMessaging/messageVerifier.js:610-643 ; https://api.runonflux.io/apps/permanentmessages?appname=explorer | VERIFIED-SOURCE and VERIFIED-LIVE]
- `explorer` has 61 messages (73,126 bytes), from register at height 1009733 through successive updates. Useful for "how do app updates look on chain". Route cache 2 minutes. CORS yes. [src: https://api.runonflux.io/apps/permanentmessages?appname=explorer ; ZelBack/src/routes.js:449 | VERIFIED-LIVE and VERIFIED-SOURCE]
- Do not call unfiltered. `/apps/hashes` lists 73,519 messages, so the unfiltered body is at least tens of MB (not fetched; UNVERIFIED size). [src: https://api.runonflux.io/apps/hashes | VERIFIED-LIVE for the hash count]

```json
{
  "status": "success",
  "data": [
    {
      "type": "fluxappregister",
      "version": 1,
      "appSpecifications": {
        "version": 4,
        "name": "explorer",
        "description": "Flux explorer ran on Flux",
        "owner": "196GJWyLxzAw3MirTT7Bqs2iGpUQio29GH",
        "compose": [
          {
            "name": "mongodb",
            "description": "db component",
            "repotag": "mvertes/alpine-mongo:latest",
            "ports": [],
            "domains": [],
            "environmentParameters": [],
            "commands": [],
            "containerPorts": [],
            "containerData": "/db",
            "cpu": 1,
            "ram": 2000,
            "hdd": 10,
            "tiered": false
          }
        ],
        "instances": 10
      },
      "hash": "7d7a6e336ef2c3545226b03a697cc6f420b636dec2421203a252429b351a954e",
      "timestamp": 1639125854536,
      "signature": "H4OQgpLOXYEFhVJ+sKemBLWPRqE6KOSzi1Q7GT68GuS6GBIRPgTTwy44HyyDXnNFPqO4/JxnkzIXUQCIQ19f0Ww=",
      "txid": "4c0af5dffabadf6f4c5b197ca90d133351d08c6441e3088cb87d099cd03b21bf",
      "height": 1009733,
      "valueSat": 1600000000
    }
  ]
}
```

##### E20. `GET /apps/temporarymessages[/:hash]`

- Returns the node's temporary store of recently received app messages (`expireAt` is one hour after `receivedAt`). Item: `appSpecifications`, `type`, `version`, `hash`, `timestamp`, `signature`, `receivedAt`, `expireAt`, `arcaneSender`. Today 9 items, 15,633 bytes. Route cache 5 s, round-robin at the gateway, CORS yes. [src: ZelBack/src/services/appMessaging/messageVerifier.js:579-603 ; https://api.runonflux.io/apps/temporarymessages | VERIFIED-SOURCE and VERIFIED-LIVE]
- Each node holds its own temporary store, so the gateway routes this path round-robin; two calls can differ. [src: flux-domain-manager/src/services/haproxyTemplate.js:427 | VERIFIED-SOURCE]

```json
{
  "status": "success",
  "data": [
    {
      "appSpecifications": {
        "version": 8,
        "name": "valheim1790521593341",
        "description": "Valheim on Flux Decentralized Cloud",
        "owner": "1HdxNMgpoh4WQy21xwLgG1buUseUK9H5fu",
        "compose": [],
        "instances": 2,
        "contacts": [],
        "geolocation": ["acNA_CA"],
        "expire": 64650,
        "nodes": [],
        "staticip": false,
        "enterprise": "<base64 ciphertext, 1496 chars>"
      },
      "type": "fluxappupdate",
      "version": 1,
      "hash": "d7ebcbf67cee7455028c32abd568df43106119dc78daf8a90861b9d486491376",
      "timestamp": 1791831855948,
      "signature": "Hxmd3TlrELEsM0uPTZXkxqA/SWUaqNy6iM6SwN3EnilccwePtdAOCPxxSsGemQGCq+bHLvkLsUTPKLe5GL41Yks=",
      "receivedAt": "2026-10-12T19:04:19.290Z",
      "expireAt": "2026-10-12T20:04:19.290Z",
      "arcaneSender": true
    }
  ]
}
```

##### E21. `GET /apps/hashes`

- Returns every app message hash the node knows from the chain: `txid`, `hash`, `height`, `value` (payment, apparently in 1e-8 FLUX units; inferred), `message` (true if the node holds the message body), `messageNotFound`. [src: ZelBack/src/services/appDatabase/registryManager.js:37-60 ; https://api.runonflux.io/apps/hashes | VERIFIED-SOURCE and VERIFIED-LIVE]
- SIZE WARNING: 73,519 rows, 16,452,516 bytes decoded, 5,582,888 bytes brotli, 1.2 s. Not suitable for a browser page; use only for tools. Cache 30 s. CORS yes. [src: https://api.runonflux.io/apps/hashes | VERIFIED-LIVE]

```json
{
  "status": "success",
  "data": [
    {
      "txid": "0baf7088590cf9ead3df723b6ab94dd69897f8895560f24d30bf8b7509b22c0e",
      "height": 694307,
      "hash": "5501c7dd6516c3fc2e68dee8d4fdd20d92f57f8cfcdc7b4fcbad46499e43ed6f",
      "value": 2000000000,
      "message": true,
      "messageNotFound": false
    },
    {
      "txid": "ee7145033891c471a7036df84e36b0cbc87468274dd080ab6df43b050d1d4d81",
      "height": 694314,
      "hash": "93053054009d6e2f20b5d329f1ceccf245e0b598f65a4d1adf85da7a37dab3c8",
      "value": 500000000,
      "message": true,
      "messageNotFound": false
    },
    {
      "txid": "aa1ebb4199cd08ec96ea38c87ff097d11ffbb6691f65cbea6f205e3f0238051b",
      "height": 699420,
      "hash": "1095512c05827830b16f701d2db9e073bfe1dc4292d3140ce030595b06e98664",
      "value": 450000000,
      "message": true,
      "messageNotFound": false
    }
  ]
}
```

##### E22. `GET /apps/messagescount/:appowner`

- Returns the number of permanent messages whose `appSpecifications.owner` equals the FluxID, as an integer (11655 for the Flux team owner). Missing owner gives an error `No Application Owner specified`. 33 bytes. [src: ZelBack/src/services/appQuery/appQueryService.js:552-575 ; https://api.runonflux.io/apps/messagescount/196GJWyLxzAw3MirTT7Bqs2iGpUQio29GH | VERIFIED-SOURCE and VERIFIED-LIVE]

##### E23. `GET /apps/whitelistedrepositories` (deprecated)

- Always returns `{"status":"success","data":[]}`. The whitelist was retired. Do not teach it as a way to find allowed images. [src: ZelBack/src/services/generalService.js:223-226 ; https://api.runonflux.io/apps/whitelistedrepositories | VERIFIED-SOURCE and VERIFIED-LIVE]
- Blocked images are now a signed policy bundle, see section 8.

```json
{"status": "success", "data": []}
```

#### 10.6.4 Where apps run

##### E24. `GET /apps/location/:appname`

- Returns the running instances of one app. Item fields: `ip` (`host:port` of the node's API port, always includes the port), `name`, `hash` (the spec hash that instance runs), `broadcastedAt` (last "I am running" broadcast), `expireAt` (when this record lapses if not renewed, about 125 minutes after broadcast), `osUptime` (seconds), `staticIp`, `runningSince`. [src: ZelBack/src/services/appDatabase/registryManager.js:72-94 ; https://api.runonflux.io/apps/location/explorer | VERIFIED-SOURCE and VERIFIED-LIVE]
- `explorer` has 40 instances and 40 location rows (spec `instances: 40`). 11,316 bytes. Cache 30 s, round-robin at the gateway (so repeated calls may hit different nodes and differ slightly), CORS yes. [src: https://api.runonflux.io/apps/location/explorer ; https://api.runonflux.io/apps/appspecifications/explorer | VERIFIED-LIVE]
- Missing name: error `No Flux App name specified`, never cached. [src: ZelBack/src/services/appDatabase/registryManager.js:628-635 ; https://api.runonflux.io/apps/location | VERIFIED-SOURCE and VERIFIED-LIVE]
- Use: build `https://<ip-with-dashes>-<port>.node.api.runonflux.io` links, or count instances by `ip` to show redundancy.
- `locationTtlS` in the registration info is 7500 s (125 min), matching the `expireAt - broadcastedAt` window in the sample. [src: https://api.runonflux.io/apps/registrationinformation | VERIFIED-LIVE]

```json
{
  "status": "success",
  "data": [
    {
      "ip": "74.103.5.187:16177",
      "name": "explorer",
      "hash": "cfe8a3158c58a0b7438f81d5f314182f177ae68198bcfabcddc1ecfb635345a7",
      "broadcastedAt": "2026-10-12T19:02:34.918Z",
      "expireAt": "2026-10-12T21:07:34.918Z",
      "osUptime": 12074456.45,
      "staticIp": false,
      "runningSince": "2026-06-04T11:18:15.381Z"
    },
    {
      "ip": "176.9.51.187:16127",
      "name": "explorer",
      "hash": "cfe8a3158c58a0b7438f81d5f314182f177ae68198bcfabcddc1ecfb635345a7",
      "broadcastedAt": "2026-10-12T18:59:52.665Z",
      "expireAt": "2026-10-12T21:04:52.665Z",
      "osUptime": 16050349.98,
      "staticIp": true,
      "runningSince": "2026-09-08T14:22:41.622Z"
    }
  ]
}
```

##### E25. `GET /apps/locations`

- All running instances of all apps in one array, same item shape as E24. SIZE WARNING: 8765 rows, 2,552,445 bytes decoded, 341,196 bytes brotli (very compressible), 1.2 s. Cache 30 s, round-robin, CORS yes. [src: ZelBack/src/services/appDatabase/registryManager.js:607-620 ; https://api.runonflux.io/apps/locations | VERIFIED-SOURCE and VERIFIED-LIVE]
- Aggregations seen today: 4192 distinct node `ip:port`, 2000 distinct app names, max 100 rows for a single app name. [src: https://api.runonflux.io/apps/locations | VERIFIED-LIVE]

```json
{
  "status": "success",
  "data": [
    {
      "ip": "144.76.98.48:16197",
      "name": "FoldingAtRunOnFlux25",
      "hash": "3bd44ecad2364dbcc1d0eb1447ed4b453a0b3e7c68d942e9e48a43b19f850f46",
      "broadcastedAt": "2026-10-12T19:29:15.376Z",
      "expireAt": "2026-10-12T21:34:15.376Z",
      "osUptime": 16128215.16,
      "staticIp": false,
      "runningSince": "2026-03-26T14:59:19.296Z"
    },
    {
      "name": "TimpiCollector1762287368786",
      "ip": "66.103.162.196:16137",
      "hash": "8d6789d58416b1285f5eaa20de37677f728869ecc65f43d0c2bde3a2b7d0e648",
      "broadcastedAt": "2026-10-12T19:32:25.576Z",
      "expireAt": "2026-10-12T21:37:25.576Z",
      "osUptime": 15124920.52,
      "staticIp": false,
      "runningSince": "2026-05-20T16:53:54.534Z"
    },
    {
      "ip": "66.103.162.196:16137",
      "name": "probeamericas",
      "hash": "ab1d4dcac794a9ba9e3046114a024b65a029e35bc0d89c4193f7d789367b3014",
      "broadcastedAt": "2026-10-12T19:32:25.576Z",
      "expireAt": "2026-10-12T21:37:25.576Z",
      "osUptime": 15124920.52,
      "staticIp": false,
      "runningSince": "2026-05-28T08:36:52.616Z"
    }
  ]
}
```

##### E26. Install progress: `/apps/installinglocation[/:appname]`, `/apps/installinglocations`, `/apps/installingerrorslocation[/:appname]`, `/apps/installingerrorslocations`

- Installing: nodes that are currently installing an app (empty array today). Errors: recent install failures with `hash`, `ip`, `name`, `broadcastedAt`, `error` (a JSON string with the failure reason, for example "Insufficient space on Flux Node"). Today the errors list had 38,522 bytes. Cache 30 s, CORS yes. [src: ZelBack/src/routes.js:494-503 ; https://api.runonflux.io/apps/installingerrorslocations ; https://api.runonflux.io/apps/installinglocations | VERIFIED-SOURCE and VERIFIED-LIVE]
- Teaching use: the "why won't my app start" troubleshooting lesson (what failure reasons look like at network level).

```json
{
  "status": "success",
  "data": [
    {
      "hash": "42fd8fd1bfc1df22e03a44f20b73452b4090d9d7b3f285085565b59b558d6926",
      "ip": "149.154.176.33",
      "name": "KaspaNode24GB1760888581380",
      "broadcastedAt": "2026-05-22T14:01:22.427Z",
      "error": "{\"status\":\"error\",\"data\":{\"name\":\"Error\",\"message\":\"Insufficient space on Flux Node. Space is already assig..."
    },
    {
      "hash": "42fd8fd1bfc1df22e03a44f20b73452b4090d9d7b3f285085565b59b558d6926",
      "ip": "149.154.176.18",
      "name": "KaspaNode24GB1760888581380",
      "broadcastedAt": "2026-05-22T14:01:34.034Z",
      "error": "{\"status\":\"error\",\"data\":{\"name\":\"Error\",\"message\":\"Insufficient space on Flux Node. Space is already assig..."
    }
  ]
}
```

#### 10.6.5 Node-local reads (use a specific node, not the gateway)

These work and are public, but the answer describes the node that served the request. Through `api.runonflux.io` they are a random node. They are good for a "what does my own node report" lesson against `https://<ip>-<port>.node.api.runonflux.io`.

| Endpoint | Returns | Size today | Cache | Source |
|---|---|---|---|---|
| `GET /daemon/getinfo` | daemon version, `blocks`, `connections`, `difficulty`, `relayfee`; `balance` removed unless operator | 294 B | none | [src: ZelBack/src/routes.js:63 ; https://api.runonflux.io/daemon/getinfo \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /flux/info` | daemon info, node status (`CONFIRMED`, collateral, `ip`, tier), benchmark summary, flux version | 3458 B | 60 s | [src: ZelBack/src/routes.js:257 ; https://api.runonflux.io/flux/info \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /flux/nodetier` | tier string, observed `stratus_new` | 41 B | 30 s | [src: ZelBack/src/routes.js:254 ; https://api.runonflux.io/flux/nodetier \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /benchmark/getstatus` | `status`, `benchmarking` tier, `flux` connection state, `systemsecure` | 111 B | 30 s | [src: ZelBack/src/routes.js:596 ; https://api.runonflux.io/benchmark/getstatus \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /daemon/getbenchmarks` | benchmark JSON as a string (`cores`, `ram`, `ssd`, `ddwrite`, `eps`, ...) | 759 B | 30 s | [src: ZelBack/src/routes.js:155 ; https://api.runonflux.io/daemon/getbenchmarks \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /apps/listrunningapps` | docker `{Names, State, Status}` per running container on that node | 573 B (6 apps) | 15 s | [src: ZelBack/src/routes.js:390 ; https://api.runonflux.io/apps/listrunningapps \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /apps/fluxusage` | `totalApps`, `runningApps`, `stoppedApps`, `nodeSpecs{cpuCores,ram,ssdStorage}` of that node | 141 B | 30 s | [src: ZelBack/src/routes.js:437 ; https://api.runonflux.io/apps/fluxusage \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /apps/tamperingevents[/:appname]` | tampering-detection events on that node (empty today) | 30 B | 30 s | [src: ZelBack/src/routes.js:536 ; https://api.runonflux.io/apps/tamperingevents \| VERIFIED-SOURCE and VERIFIED-LIVE] |

Note the `/flux/info` and `/daemon/getbenchmarks` answers include that node's IP and collateral transaction hash; both are public on chain anyway.

#### 10.6.6 stats.runonflux.io

Separate service, cached by its own routes (cache seconds in the table). Not FluxOS; envelope is the same `{status, data}`. [src: fluxstats/src/routes.js:17-122 | VERIFIED-SOURCE]

| Endpoint | Returns | Size today | Server cache | Source |
|---|---|---|---|---|
| `GET /fluxinfo?projection=ip,tier,geolocation` | one record per node; `projection` is a comma list of fields (`ip`, `tier`, `geolocation`, `benchmark`, `node`, `flux`, `apps`, `connectionsOut`, ...) | 7106 rows, 2,800,194 B decoded, 87,515 B brotli | 10 min | [src: fluxstats/src/routes.js:24 ; fluxstats/test/ui/fluxUIEndpointsTest.js:21-147 ; https://stats.runonflux.io/fluxinfo?projection=ip,tier,geolocation \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /fluxversions` | `[{ip, daemon, benchmark, flux}]` for all nodes | 577,452 B | 5 min | [src: fluxstats/src/routes.js:30 ; https://stats.runonflux.io/fluxversions \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /fluxhistorystats` | time series object keyed by unix-millis: `{cumulus, nimbus, stratus}` counts; 2534 points from 1789239833465 to 1791828979546 | 157,137 B | 15 min | [src: fluxstats/src/routes.js:43 ; https://stats.runonflux.io/fluxhistorystats \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /fluxlocation/:ip` | geolocation of one node (`ip:port` accepted) | 210 B | 5 min | [src: fluxstats/src/routes.js:20 ; https://stats.runonflux.io/fluxlocation/176.9.51.187:16127 \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /getmodulesminimumversions` | minimum supported `syncthing` and `docker` versions: `2.0.10`, `26.1.2` | 68 B | 10 min | [src: fluxstats/src/routes.js:71 ; https://stats.runonflux.io/getmodulesminimumversions \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /marketplace/listapps` | marketplace app templates (name, category, `priceUSD`, `instances`, `lockedValues`, `compose` with `userEnvironmentParameters`) | 74,845 B decoded, 12,310 B brotli | 1 min | [src: fluxstats/src/routes.js:104 ; https://stats.runonflux.io/marketplace/listapps \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `GET /apps/getappspecsusdprice` | same as E9 | 178 B | 10 min | see E9 |
| `GET /apps/multiplier` | literal `8` (not a price multiplier; see E11) | 29 B | 1 min | see E11 |

CORS yes on all (observed). Cloudflare `cf-cache-status: DYNAMIC` means Cloudflare did not cache; the origin cache still applies.

```json
{
  "status": "success",
  "data": [
    {
      "geolocation": {
        "ip": "91.51.243.197",
        "continent": "Europe",
        "continentCode": "EU",
        "country": "Germany",
        "countryCode": "DE",
        "region": "BY",
        "regionName": "Bavaria",
        "lat": 49.7173,
        "lon": 11.0506,
        "org": "Deutsche Telekom AG",
        "isp": "Deutsche Telekom AG",
        "asn": "AS3320 Deutsche Telekom AG",
        "mobile": false,
        "proxy": false,
        "hosting": false,
        "static": false,
        "dataCenter": false
      },
      "ip": "91.51.243.197",
      "tier": "CUMULUS"
    }
  ]
}
```

```json
{
  "status": "success",
  "data": {
    "1791828979546": {"cumulus": 3585, "nimbus": 1692, "stratus": 1830},
    "1791828032924": {"cumulus": 3584, "nimbus": 1692, "stratus": 1830},
    "1791827178380": {"cumulus": 3584, "nimbus": 1692, "stratus": 1830}
  }
}
```

```json
{
  "status": "success",
  "data": [
    {
      "description": "A simple hello world app with parameterized content",
      "priceUSD": 0.99,
      "category": "Hosting",
      "version": 4,
      "name": "HelloWorldParams",
      "instances": 3,
      "lockedValues": ["instances"],
      "compose": [
        {
          "name": "helloworldparams",
          "description": "Parameters are PAGE_TITLE and PAGE_CONTENT",
          "repotag": "jeffvaderflux/helloworld_params:latest",
          "containerPorts": [80],
          "domains": [""],
          "environmentParameters": ["VALUE=1"],
          "commands": [],
          "containerData": "/tmp",
          "tiered": false,
          "cpu": 0.1,
          "ram": 100,
          "hdd": 1,
          "ports": [37185],
          "userEnvironmentParameters": [{"name": "PAGE_TITLE", "description": "The title of the page", "placeholder": "Page Title"}]
        }
      ],
      "visible": true,
      "enabled": true
    }
  ]
}
```

### 10.7 Per-endpoint request budget guidance

| Pattern | Advice |
|---|---|
| Counters on a landing page (E1, E2, E7) | One fetch per page view is fine. Cache 30 to 60 s client side. |
| App lookup by name (E15, E24) | Per-user action. Lowercase is not required. Debounce typing; do not fetch per keystroke. |
| Whole-network lists (E3, E16, E21, E25, `/fluxinfo`) | Fetch only with a user action or at build time. Use `Accept-Encoding` so the browser gets brotli (1.5 MB instead of 2.9 MB for E16, 5.6 MB instead of 16 MB for E21). Prefer filters. |
| Price quote (E14) | POST only on a user action. `text/plain`. |

### 10.8 Related public endpoints outside the two Flux hosts

- FLUX rate: `GET https://viprates.runonflux.io/rates` returns `[ [ {code,name,rate}, ... fiat per BTC ], { <ticker>: <BTC price> }, ... ]`. FLUX in USD = `USD.rate * FLUX`. 20,551 bytes, `access-control-allow-origin: *`, `max-age` 10 to 15, via Cloudflare. This is what the node uses (`config.pricing.fluxRatesBaseUrl`). The legacy academy used the mirror `https://vipbrates.zelcore.io/rates`; today both returned the same ETag and body (FLUX 1.04e-06 BTC, USD about 0.0852). [src: ZelBack/config/default.js:847-851 ; ZelBack/src/services/utils/appSpecHelpers.js:494-519 ; https://viprates.runonflux.io/rates ; https://vipbrates.zelcore.io/rates | VERIFIED-SOURCE and VERIFIED-LIVE]
- Blocked repositories and node blocklists: not a node API endpoint any more. The network policy is a signed JSON bundle fetched from GitHub: `https://raw.githubusercontent.com/RunOnFlux/fluxos-network-policy/signed/policy-signed.json` (117,673 bytes, `access-control-allow-origin: *`, `content-type: text/plain`, `max-age=300`). Shape: `{payload_b64, sig_b64}`; `payload_b64` decodes to `{seq, issued_at, documents:{blocklist, blockedrepositories, vettedrepositories, tamperingblockednodes, enterprisenodes}, artifacts}`. Today: `blockedrepositories` 292 strings (for example `pengdocker`, `tornadocash`), `blocklist` 311 entries of `{kind: owner|hash|image|org, value, reason, added}` (owner 186, hash 85, image 21, org 19), `vettedrepositories` 0. Verification uses ed25519 keys in `config.policy.publicKeys`. [src: ZelBack/config/default.js:777-806 ; ZelBack/src/services/policyStore.js:28-29 ; https://raw.githubusercontent.com/RunOnFlux/fluxos-network-policy/signed/policy-signed.json | VERIFIED-SOURCE and VERIFIED-LIVE]
- The old `/flux/blockedrepositories` and `/flux/blockedports` routes were deleted in FluxOS 8.19.0. [src: fluxdocs/fluxapi.yaml "Deleted in 8.19.0" | DOCS-ONLY]

Decoded policy sample (first items only, decoded locally from the bundle):

```json
{
  "seq": 5, "issued_at": "2026-10-04T09:12:10.095Z",
  "documents": {
    "blockedrepositories": ["pengdocker", "krislululu", "roken120", "tornadocash", "fabreeze"],
    "blocklist": [
      {"kind": "org", "value": "pengdocker", "reason": "Blocked by \"Seed the network policy documents\"; ...", "added": "2026-07-30"},
      {"kind": "image", "value": "pengdocker", "reason": "...", "added": "2026-07-30"}
    ],
    "vettedrepositories": [],
    "tamperingblockednodes": ["2593e8d8b2a4...", "fe1dd1570f18..."]
  }
}
```

### 10.9 Removed, changed, or misleading versus older material

| Item | Status | Source |
|---|---|---|
| `/apps/whitelistedrepositories` | Still routed, always `[]`. Whitelist retired. | [src: ZelBack/src/services/generalService.js:223-226 ; https://api.runonflux.io/apps/whitelistedrepositories \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `/flux/blockedrepositories`, `/flux/blockedports` and their `adjust...` routes | Deleted in 8.19.0; replaced by the signed policy bundle (section 8). | [src: fluxdocs/fluxapi.yaml "Deleted in 8.19.0" \| DOCS-ONLY] |
| `/apps/apppause`, `/apps/appunpause`, `/apps/appmonitorstream`, `/apps/startmonitoring`, `/apps/stopmonitoring` | Removed: answer HTTP 200 with `data.code: 410`. | [src: fluxdocs/fluxapi.yaml "Deprecated & Removed Endpoints" ; ZelBack/src/routes.js:1022-1033 \| DOCS-ONLY and VERIFIED-SOURCE] |
| `/flux/cruxid`, `/flux/adjustcruxid`, `/flux/rebuildhome`, `/explorer/fluxtxs`, `/apps/installtemporarylocalapp`, `POST /apps/fluxshare/upload` | No longer routed. `/flux/rebuildhome` is now `/flux/rebuildui`. | [src: fluxdocs/fluxapi.yaml "Deleted" row \| DOCS-ONLY] |
| `/explorer/allutxos`, `/explorer/alladdresses`, `/explorer/alladdresseswithtransactions`, `/explorer/fusion/coinbase/all` | Commented out in routes (not served). | [src: ZelBack/src/routes.js:540-565 \| VERIFIED-SOURCE] |
| `/zelid/*`, `/daemon/*zelnode*`, `/flux/zelid` | Aliases of `/id/*`, `/daemon/*fluxnode*`, `/flux/id`. Use the new names. | [src: ZelBack/src/routes.js:75-87,247-250,278 ; fluxdocs/fluxapi.yaml "Aliases" \| VERIFIED-SOURCE] |
| `minimumInstances` in `/apps/deploymentinformation` | 3, but v8 specs may use 1 since block 2176519 (see `/apps/registrationinformation`). Docs elsewhere still say "minimum of three instances". Source wins. | [src: ZelBack/config/default.js:413-415 ; flux-docs/docs/fluxcloud/cost-calculator.md:52 \| VERIFIED-SOURCE (source), DOCS-ONLY (docs)] |
| `/apps/registrationinformation` `fluxUSDRate: 0.6` and `address` | Config fallback values, not the live rate or the current payment address. | [src: ZelBack/config/default.js:338 ; https://api.runonflux.io/apps/registrationinformation \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| `stats.runonflux.io/apps/multiplier` | Hard-coded `8`, unrelated to prices. | [src: fluxstats/src/services/fluxService.js:1332-1342 \| VERIFIED-SOURCE] |
| Legacy academy price fetch | `https://api.runonflux.io/apps/getappspecsusdprice` still works and returns the same fields as before. The `vipbrates.zelcore.io` rates mirror still works; the node itself uses `viprates.runonflux.io`. | [src: legacy/components/interactive/SpecBuilder.tsx:82-101 ; https://api.runonflux.io/apps/getappspecsusdprice \| VERIFIED-SOURCE (legacy) and VERIFIED-LIVE] |
| Old GitBook docs (`runonflux-docs`) and current docs site | Neither lists endpoint URLs apart from one link to `stats.runonflux.io/apps/getappspecsusdprice` in the cost calculator page. The OpenAPI file (339 paths) is the only complete list. Every OpenAPI path except `/hostinfo` appears in `routes.js`; `/hostinfo` is served by a separate listener at `169.254.43.43:16101` that only app containers on that node can reach. The only `routes.js` paths missing from OpenAPI are the 4 commented-out explorer routes in the row above. | [src: fluxdocs/fluxapi.yaml ; ZelBack/src/routes.js ; ZelBack/src/services/fluxNodeService.js:121 \| VERIFIED-SOURCE] |

### 10.10 Final table

All rows verified on 2026-10-12. "CORS ok" means `access-control-allow-origin: *` was present on a live GET (header check, not run from a browser page). Sizes are decoded JSON bytes; "wire" is brotli.

| Endpoint | Purpose | CORS ok from browser | Size | Verified date |
|---|---|---|---|---|
| `GET api/daemon/getblockcount` | chain height | yes | 35 B | 2026-10-12 |
| `GET api/daemon/getfluxnodecount` | node totals by tier | yes | 217 B | 2026-10-12 |
| `GET api/daemon/listfluxnodes[/filter][?limit=]` | node list | yes | 4.4 MB (578 KB wire) | 2026-10-12 |
| `GET api/daemon/getblockchaininfo` | chain info | yes | 1.3 KB | 2026-10-12 |
| `GET api/daemon/getdoslist` | nodes in DOS list | yes | 241 B | 2026-10-12 |
| `GET api/explorer/scannedheight`, `/explorer/issynced` | explorer indexing state (per node) | yes | under 100 B | 2026-10-12 |
| `GET api/flux/version` | FluxOS version (per node) | yes | 36 B | 2026-10-12 |
| `GET api/apps/deploymentinformation` | limits, payment address, price history | yes | 1.2 KB | 2026-10-12 |
| `GET api/apps/getappspecsusdprice` | USD price table | yes | 178 B | 2026-10-12 |
| `GET api/apps/registrationinformation` | raw fluxapps config (limits) | yes | 6.5 KB | 2026-10-12 |
| `GET api/apps/latestspecificationversion` | newest spec version | yes | 29 B | 2026-10-12 |
| `GET api/apps/placementlocations` | node, domain, tier counts by geography | yes | 4.5 KB | 2026-10-12 |
| `GET api/apps/enterprisenodes` | the scored node list behind the FluxCloud priority-node picker (every confirmed node listed on its default API port, with trust points). It is NOT the list of nodes that can run an enterprise app: any ArcaneOS node can (2.5, 3.7) | yes | 1.07 MB | 2026-10-12 |
| `POST api/apps/calculatefiatandfluxprice` (and `/apps/calculateprice`) | read-only price quote, `text/plain` body | yes (response header; simple request) | 70 B | 2026-10-12 |
| `GET api/apps/appspecifications/:name` | current spec of one app | yes | about 1 KB | 2026-10-12 |
| `GET api/apps/globalappsspecifications[?appname=\|owner=\|hash=]` | specs, filtered | yes | 1 KB filtered, 2.9 MB (1.5 MB wire) unfiltered | 2026-10-12 |
| `GET api/apps/appowner/:name` | current owner | yes | 64 B | 2026-10-12 |
| `GET api/apps/apporiginalowner/:name` | original registrant | yes | 64 B | 2026-10-12 |
| `GET api/apps/permanentmessages[?appname=\|owner=\|hash=]` | on-chain message history | yes | 73 KB for `explorer`; unfiltered not fetched | 2026-10-12 |
| `GET api/apps/temporarymessages[/hash]` | pending messages | yes | 15.6 KB | 2026-10-12 |
| `GET api/apps/hashes` | all app message hashes | yes | 16.5 MB (5.6 MB wire) | 2026-10-12 |
| `GET api/apps/messagescount/:owner` | message count per owner | yes | 33 B | 2026-10-12 |
| `GET api/apps/whitelistedrepositories` | deprecated, always `[]` | yes | 30 B | 2026-10-12 |
| `GET api/apps/location/:name` | instances of one app | yes | 11 KB (40 rows) | 2026-10-12 |
| `GET api/apps/locations` | instances of all apps | yes | 2.55 MB (341 KB wire) | 2026-10-12 |
| `GET api/apps/installinglocation[s]`, `installingerrorslocation[s]` | install progress and failures | yes | 30 B to 38 KB | 2026-10-12 |
| `GET api/apps/listrunningapps`, `/apps/fluxusage`, `/flux/info`, `/daemon/getinfo`, `/benchmark/getstatus` | node-local state | yes | 0.1 to 3.5 KB | 2026-10-12 |
| `GET stats/fluxinfo?projection=...` | per-node attributes and geolocation | yes | 2.8 MB (88 KB wire) with 3 fields | 2026-10-12 |
| `GET stats/fluxversions` | per-node versions | yes | 577 KB | 2026-10-12 |
| `GET stats/fluxhistorystats` | tier count history | yes | 157 KB | 2026-10-12 |
| `GET stats/fluxlocation/:ip` | node geolocation | yes | 210 B | 2026-10-12 |
| `GET stats/getmodulesminimumversions` | min docker and syncthing | yes | 68 B | 2026-10-12 |
| `GET stats/marketplace/listapps` | marketplace templates | yes | 75 KB (12 KB wire) | 2026-10-12 |
| `GET stats/apps/getappspecsusdprice` | USD price table (preferred host) | yes | 178 B | 2026-10-12 |
| `GET viprates.runonflux.io/rates` | FLUX and fiat rates | yes | 20.5 KB | 2026-10-12 |
| `GET raw.githubusercontent.com/RunOnFlux/fluxos-network-policy/signed/policy-signed.json` | blocked repos and blocklist | yes | 118 KB | 2026-10-12 |

### 10.11 Not verified, and why

- Rate-limit thresholds at the gateway or Cloudflare: not probed (task rules: no loops, 2 req/s). Only absence of headers and of source rules was established.
- CORS preflight (OPTIONS) and a real browser fetch: not performed.
- Size of unfiltered `/apps/permanentmessages` and `/apps/appspecifications` for many apps: not fetched.
- Meaning of `ipv4`, `ipv6`, `onion` in `/daemon/getfluxnodecount`: daemon RPC output, not documented in the repo clones. Read the daemon source or docs before teaching it.
- Whether the live HAProxy config is exactly the template in the repo: the template matches observed `fluxnode`, `x-flux-mode` and CORS headers, but the production file was not inspected.
- Every endpoint's behaviour on failure modes (node booting, daemon not synced) was read in source, not provoked live.
- Updated 2026-10-13: the 504 versus "no answer in 12 s" difference for the calculator is a client timeout against the gateway's 30 s timeout (4.2). The list of settled and still-open items from the FACTS-owner pass is in 14.1 and 14.2.

## 11. Common mistakes and failure modes

Each row is a troubleshooting tree node or quiz distractor seed. "Error text" is the exact backend string where one exists (quote it in simulators). Source tags apply to the cause; the fix is the consequence.

| # | Mistake | Symptom (what the user sees) | Cause | Fix | Source |
|---|---|---|---|---|---|
| 1 | Container port does not match the port the process listens on | App registers and runs, the `.app.runonflux.io` URL answers 502/503 or resets | `containerPorts[i]` is where Docker forwards traffic; the process listens elsewhere | Set `containerPorts` to the real listening port, `ports` to any free external port | dockerService.js:994-1004 [VERIFIED-SOURCE] |
| 2 | Server binds `127.0.0.1` or `localhost` inside the container | Works in `docker run` on the same host with host networking, dead on Flux; connection refused or empty reply | Published ports reach the container's bridge interface, not loopback | Bind `0.0.0.0` (for example `--host 0.0.0.0`, `HOST=0.0.0.0`) | Docker port publishing semantics; dockerService.js:1218 (bridge network) [VERIFIED-SOURCE (network); behaviour standard Docker] |
| 3 | Using the container port in the public URL | `name_80.app.runonflux.io` does not resolve to the app | Per port domains use the EXTERNAL port: `<name>_<ports[i]>` | Use `<name>_<external port>.app.runonflux.io` or the plain `<name>.app.runonflux.io` (first port) | flux-domain-manager/src/services/domain/index.js:12-29 [VERIFIED-SOURCE] |
| 4 | Image is arm64 only (Apple silicon build) | A non-enterprise app VALIDATES and registers (arm64 is an accepted architecture), then stays short of running instances because almost no node can run it (7 arm64 nodes at the 2026-10-12 snapshot, none on ArcaneOS; re-counted 7 of 7,078 stats rows on 2026-10-13, 77 rows report no architecture, see the Snapshot re-read). An enterprise app is refused because it needs amd64 for ALL components. The message "Docker image: X does not have a valid architecture" is for an image with neither amd64 nor arm64, and "components share no architecture" is for components with no common one | Almost every node is amd64 (all ArcaneOS nodes are); the arm64 pool is tiny | Build `--platform linux/amd64` or a multi-arch image. Teach "registers but starves", never "refused", for the non-enterprise case | imageVerifier.js:424-438 ; appValidator.js:1449-1480 [VERIFIED-SOURCE]; correction by the Cumulus lesson author 2026-10-12 |
| 5 | Image bigger than 5 GB (compressed layers) | "Docker image: X size is over Flux limit" | `maxImageSize` 5,000,000,000 bytes summed over layers | Slim the image, multi stage build, move data to a volume or download at start | imageVerifier.js:391-407 ; config/default.js:412 [VERIFIED-SOURCE] |
| 6 | Private image without Enterprise | "Private repositories are only allowed for Enterprise Applications" | `repoauth` only allowed when `enterprise` is set | Enable Enterprise (encrypted spec) and give `user:token` or provider URI | appValidator.js:791-799 [VERIFIED-SOURCE] |
| 7 | Image or app on the blocklist | Validation or install refused with a policy reason; app never installs | Signed network blocklist matches name, owner, image or registry namespace | Use a different image/namespace; blocklist is public (`fluxos-network-policy`) | imageManager.js:430-465 ; fluxos-network-policy/blocklist.json [VERIFIED-SOURCE]. Worked example 2026-10-13: 78 Orbit deployments are registered on chain and listed by the explorer but never run, because their owners are on the blocklist (15.3.3) |
| 8 | Banned or clashing port | "Assigned port 22 is not allowed for Flux Apps"; "must have unique ports specified accross all composition" | Banned list (16100-16299, 22, 25, 53, 27017, ...); one port used twice | Pick another external port; give every component distinct external ports | appValidator.js:717-726 ; portManager.js:55-83 [VERIFIED-SOURCE] |
| 9 | Name starts with `flux` or `zel`, is `watchtower`, or already exists | "Flux App name can not start with flux"; "already registered. Flux App has to be registered under different name" | Reserved prefixes; global case-insensitive uniqueness | Rename; add a suffix. Component names: letters and digits only (no hyphen) | appValidator.js:583-591,700-709 ; registryManager.js:1184-1211 [VERIFIED-SOURCE] |
| 10 | Component name with a hyphen in v8 | "Flux App component name contains special characters. Only a-z, A-Z and 0-9 are allowed" | Hyphens allowed only in the APP name, not component names | Use `webserver`, not `web-server` | appValidator.js:707-709 [VERIFIED-SOURCE] |
| 11 | Wrong spec shape (old tutorials) | "Missing Flux App specification parameter contacts and/or geolocation" (a required key is absent). A leftover `tiered`, `secrets` or `cpubasic` raises NO error: it is silently dropped, so it simply has no effect | v8 requires `contacts`, `geolocation`, `expire`, `nodes`, `staticip`, `enterprise`; keys it does not know are dropped by the formatter before validation (3.2 correction), they are not rejected | Start from the v8 shape in 3.9 | utils/appUtilities.js:796-799 ; appValidator.js:1045-1078 [VERIFIED-SOURCE]; dropped keys [VERIFIED-LIVE 2026-10-13] |
| 12 | Wrong content type to the price calculator | request hangs, gateway 504 after about 30 s (a client with a shorter timeout sees no answer at all; see 4.2) | JSON content type is consumed by the body parser so the handler never sees `end` | Send `text/plain` or `application/x-www-form-urlencoded` | tested live 2026-10-12 [VERIFIED-LIVE] |
| 13 | Only 1 instance for something customers use | App down for up to 125 min when its node dies (the old "22% of live 1-instance apps have no running copy" was blocklisted Orbit deployments, not fragility: corrected in 6.5 and 15.3.3) | One node, location TTL 7500 s, respawn delay | 2 to 3 instances in different geolocations; synced storage if stateful | section 6.5 [VERIFIED-LIVE] |
| 14 | Storing data without a synced volume | Data gone after node change, or each instance has different data | Plain `containerData` is local to one node and one instance | Use `g:` (single writer, standby copies) for databases and `r:` only for data that tolerates replication conflicts | section 7 [VERIFIED-SOURCE]; r: vs g: recommendation is design inference (UNVERIFIED) |
| 15 | Putting a multi writer database on `r:` | Corrupt or conflicting database files after failover | `r:` runs every instance writing; Syncthing is file replication, not a database cluster | `g:` primary/standby for single instance DBs, or run a real cluster (see Marketplace n8n/etcd) | syncthingMonitorHelpers.js:264-277 ; flux-docs n8n.md:412 [VERIFIED-SOURCE and DOCS-ONLY]; guidance UNVERIFIED. The Flux Cloud MCP server's `flux_build_spec` and its overview guide default every data path to `r:` (15.1.16): choose `g:` for a single writer database |
| 16 | Volume full | App errors with "No space left on device" | `hdd` is a fixed size image (`fallocate`) shared by all mounts of the component | Update with more `hdd` (UI warns it triggers a hard redeploy, so back up first) | volumeService.js:84-90 ; section 9.4.4 [VERIFIED-SOURCE] |
| 17 | Update that changes component structure loses data | After update the volume is empty | Structural changes escalate a soft redeploy to a hard redeploy (volume recreated) | Back up first (Backup & Restore), then update; avoid renaming or reordering components | advancedWorkflows.js:1480-1500 [VERIFIED-SOURCE] |
| 18 | Secrets in plain env vars | Anyone can read `DB_PASSWORD` at `/apps/appspecifications/<name>` | Spec is public unless `enterprise` | Use Enterprise (encrypted spec) | flux-docs components.md ; spec endpoint [DOCS-ONLY and VERIFIED-LIVE] |
| 19 | `:latest` surprises | Different instances run different builds; behaviour changes without an update | FluxOS checks the registry for the same tag every 6 h (21,600,000 ms; the first check comes 10 to 30 minutes after the node starts, and apps are checked 5 s apart) and soft redeploys on a new digest, so nodes do it at different moments | Pin an immutable tag or digest | imageUpdateService.js:L13-L21,L209-L250,L321-L340 ; config/default.js:L639-L643 [VERIFIED-SOURCE: the loop, the digest comparison and the `softRedeploy` call were read in v8.20.0; a redeploy was not observed live] The console assistant adds `:latest` to an untagged image (15.2.5); the Flux Cloud MCP server's local validator refuses an image without an explicit tag (15.1.16). |
| 20 | Expecting Docker `HEALTHCHECK` or `restart: always` | Unhealthy but running container is not replaced | FluxOS ignores HEALTHCHECK; restart policy is `no`, FluxOS restarts exited containers with back off | Make the process exit when unhealthy; or add instances | dockerService.js:1215-1217 ; config/default.js:137-154 [VERIFIED-SOURCE] |
| 21 | Crash loop at start | Instance "Restarting"; log shows quick exits; restarts spaced 30 s, 5, 15, 30 min | Container exits (missing env, bad `commands`, port clash) | Read Logs tab, fix, redeploy. Remember `commands` replaces CMD args, not a shell | config/default.js:137-154 ; dockerService.js:1197 [VERIFIED-SOURCE] |
| 22 | Paying late or too little | The UI says registered but the app never installs; node logs show "is underpaid" | A node keeps the temporary message 3600 s from the moment it received it (registration), and the UI's "30 minutes" is a label, not a protocol clock (6.6). A payment below the on-chain table price is "underpaid" and dropped. Between the table price and the quote, node code accepts it (4.7), but FluxCloud asks for the quote and the card relay needs 98 percent of it | Pay the quoted FLUX with the exact hash message, well inside 30 minutes; re-register if the message expired | messageVerifier.js:770-790 ; messageStore.js:L202-L213 ; config/default.js:535 [VERIFIED-SOURCE] |
| 23 | Clock skew / stale sign | "Message timestamp is over 1 hour old" or "from future" | Timestamp must be within -1 h and +5 min of the node | Fix the computer clock, restart registration | appValidator.js:1721-1727 [VERIFIED-SOURCE] |
| 24 | Wrong signing identity | "Invalid Flux App owner. Must be a Flux ID or an Ethereum address"; signature check fails | `owner` must be the address that signs; ZelID or Ethereum | Sign with the wallet whose address is in `owner` (SSO signs for you) | appValidator.js:1272-1274 ; messageVerifier.js:144-152 [VERIFIED-SOURCE] |
| 25 | Forgot the subscription | App disappears, data gone, name free | No grace after expiry; nodes remove at the expiry block | Renew early (UI warns under 1 week), enable Stripe auto-renew, back up | registryManager.js:1510-1520 [VERIFIED-SOURCE] The new console's landing copy mentions a balance, a daily rate and a "3-day grace period"; none exists for app deployments in the network or in what the console's own balance page says today (15.2.8). |
| 26 | Static IP or big spec starves placement | "Installing" for hours; fewer instances than requested | Only a subset of nodes qualify; others defer 57 to 117 min; large apps fit only Nimbus/Stratus | Drop `staticip` unless needed; keep CPU under 3 cores, RAM under 5,000 MB (what a nominal Cumulus node has free; 6,000 MB is only the point where bigger nodes stop deferring, see 2.3) and disk under about 129 GB to use Cumulus capacity; widen geolocation | appSpawner.js:821-905 [VERIFIED-SOURCE] |
| 27 | Custom domain not in spec or proxied wrongly | HTTPS error or certificate warning on the custom domain | Domain must be in the component `domains[i]` and point (CNAME) to the app domain; FDM only issues a cert when DNS points to FDM | Add domain to `domains`, CNAME to `<name>.app.runonflux.io`; with Cloudflare proxy use SSL "Full" (inference) | domain/index.js:35-70 ; cert.js:78-190 [VERIFIED-SOURCE; Cloudflare mode UNVERIFIED] |
| 28 | Low ports cost extra unexpectedly | Quote is USD 2 higher per port than expected | Ports 0-1023, 8080, 8081, 8443, 6667 are priced as enterprise ports | Use ports above 1024 and not 8080/8081/8443; map with `containerPorts` | config/default.js:410 [VERIFIED-SOURCE] |
| 29 | Four instances cost double three | Small app jumps from 0.99 to 1.99 | Two rules meet: the 20% small app discount applies only below 4 instances (the 0.99 minimum lifts the discounted 0.89 at three instances), and when one instance costs under USD 0.50 each extra instance after the second is a flat USD 0.50 (0.37 + 3 x 0.50 = 1.87, charm-rounded to 1.99). The discount ending alone would give 1.49 | Choose 3 or accept price; check calculator at each count | appUtilities.js:126-127 ; appSpecHelpers.js:433-440 [VERIFIED-SOURCE] (worked numbers in 4.4) |
| 30 | Non-HTTP service via the app domain | TCP/UDP game or database protocol fails on `name.app.runonflux.io` | FDM serves HTTP/S on 80/443. A TCP front door on the app's own public port exists only for apps FDM puts in TCP mode: every app with a `g:` component, plus a short hard-coded list of chain and tool apps by name (6.4). HAProxy `mode tcp` is TCP only, so UDP does not go through FDM. An ordinary app with a plain or `r:` volume gets no TCP front door | Connect to a node IP and the external port (`/apps/location/<name>`) | haproxyTemplate.js:140-190,488-540 ; application/custom.js:1-60 [VERIFIED-SOURCE] |
| 31 | Volume path permission denied | App cannot write `/data` | Image runs as a non-root user and the volume root is owned by root | Run as root or `chown` in the entrypoint | UNVERIFIED (user-level behaviour) |
| 32 | Port test failure | Instance removed shortly after install; node enters DOS | Node-to-node port reachability check fails (firewall/NAT) on the node, not your spec | Nothing to fix in the spec; instance respawns elsewhere | availabilityChecker.js [VERIFIED-SOURCE (mechanism)] |

## 12. Glossary seeds

Definitions are at most 28 words. "Why a deployer cares" is one line.

| # | Term | Definition | Why a deployer cares |
|---|---|---|---|
| 1 | Flux | Decentralized cloud network of independently operated nodes, run by InFlux Technologies tooling and the FLUX blockchain. | It is where your containers run and what you pay. |
| 2 | FLUX | The network's token. Used to pay for apps (5% off) and to collateralize nodes and reward them. | Paying in FLUX is cheaper than card. |
| 3 | FluxCloud | The web dashboard at cloud.runonflux.com to register, pay for and manage apps. | The main UI for deployers. |
| 4 | FluxOS | Node software that runs apps, talks to the chain and serves the API on port 16127. | Every API endpoint you call is FluxOS. |
| 5 | FluxNode | A server that holds collateral and runs FluxOS, hosting app instances and earning block rewards. | Instances of your app run on them. |
| 6 | Cumulus | Smallest node tier, 1,000 FLUX collateral, about 4 cores, 7 GB RAM, 220 GB SSD. API name `basic`. | Where small apps mostly land. |
| 7 | Nimbus | Middle node tier, 12,500 FLUX collateral, about 8 cores, 30 GB RAM, 440 GB SSD. API name `super`. | Hosts mid sized apps. |
| 8 | Stratus | Largest node tier, 40,000 FLUX collateral, about 16 cores, 61 GB RAM, 880 GB SSD. API name `bamf`. | Needed for the biggest specs. |
| 9 | Collateral | FLUX locked on chain by a node operator to run a node of a tier. | Makes nodes costly to abuse. |
| 10 | ArcaneOS | Hardened node operating system with encrypted disks and attestation; hosts encrypted enterprise apps. | Required for Enterprise apps. |
| 11 | Proof of Node (PON) | Consensus since block 2,020,000: confirmed nodes win 30 second slots by hash lottery; no mining. | Explains 30 second blocks and 88000 blocks per month. |
| 12 | Block height | The sequence number of the latest block, about 3.03 million now. | Subscriptions are measured in blocks. |
| 13 | Block | A unit of chain data produced about every 30 seconds. | Your payment is confirmed in one. |
| 14 | App specification (spec) | The JSON document describing an app: components, resources, ports, instances, duration. | The thing you sign, price and pay. |
| 15 | Spec version | The schema number of a spec; current is 8. | Old tutorials use incompatible versions. |
| 16 | Component | One container definition inside an app spec's `compose` array. | Multi service apps need one per service. |
| 17 | Compose | Array holding up to 10 components of one app. | Counts toward one price and one name. |
| 18 | Instance | One running copy of your app on one node. | Redundancy is instance count. |
| 19 | Instances (field) | Number of nodes that should run your app, 1 to 100 in v8. | Main driver of price and availability. |
| 20 | repotag | The Docker image reference, `[registry/]namespace/name:tag`. | Must be public, amd64 and under 5 GB. |
| 21 | repoauth | Credentials for a private registry, `user:token` or a cloud provider URI. | Enterprise only. |
| 22 | ports | Array of external node ports published for a component. | Public entry points and cost drivers. |
| 23 | containerPorts | Array of ports the process listens on inside the container, matched to `ports` by index. | Mismatch is the top misconfiguration. |
| 24 | domains | Per port list of custom domains served by FDM. | How to attach your own hostname. |
| 25 | containerData | Mount definition string for persistent volumes, with `r:`, `g:`, `s:` prefixes. | Decides whether data survives. |
| 26 | environmentParameters | `KEY=value` environment variables for a component. | Public unless Enterprise. |
| 27 | commands | Arguments passed as the container's CMD array. | Not a shell script. |
| 28 | expire | Subscription length in blocks counted from the last register or update. | Minimum 1, maximum 1,056,000 blocks. |
| 29 | geolocation | Allow and deny list of continents, countries and regions (`acEU_DE`, `a!cNA`). | Controls where instances may run. |
| 30 | nodes (field) | Allow list pinning an app to specific nodes. | Only for enterprise owners. |
| 31 | staticip | Flag restricting an app to nodes with a fixed, directly reachable IP address. | Costs USD 2 and narrows placement. |
| 32 | Enterprise app | A v8 spec whose contacts and compose are encrypted so only ArcaneOS nodes can read them. | Needed for secrets and private images. |
| 33 | Owner / ZelID | The wallet address that signs registrations and updates for an app. | Lose the key, lose control. |
| 34 | Registration message | The signed JSON broadcast to the network that creates an app. | Its hash links your payment to your spec. |
| 35 | Hash (message hash) | SHA-256 of the signed registration message, placed in the payment's OP_RETURN. | Wrong hash means the payment is ignored. |
| 36 | OP_RETURN | A blockchain transaction output carrying a short message. | How payment is tied to an app. |
| 37 | Payment address | The single multisig address that receives app payments. | Only pay the address FluxCloud shows. |
| 38 | Price quote | USD and FLUX amount from `/apps/calculatefiatandfluxprice`. | Pay this amount. The chain's own floor is the on-chain table price (far lower); FluxCloud asks for the quote and the card relay needs at least 98 percent of it (4.7). |
| 39 | fluxmultiplier | The 0.95 factor giving 5% off when paying in FLUX. | Explains the discount chip. |
| 40 | Renewal | An update message that raises `expire` and pays the new period. | Prevents expiry. |
| 41 | Update | A signed change to a live app's spec; may be free if it changes no resources or length. | May trigger a hard redeploy. |
| 42 | Soft redeploy | Reinstall of an app's containers on a node that keeps volume data. | Safe way to restart changes. |
| 43 | Hard redeploy | Reinstall that recreates volumes and deletes data. | Backup before using. |
| 44 | Syncthing | Open source file sync tool FluxOS uses to replicate volumes between instances. | Powers `r:`, `g:` and `s:` data. |
| 45 | Primary / standby (`g:`) | Mode where one elected instance runs and others hold synced copies. | Failover for single writer apps. |
| 46 | FDM (Flux Domain Manager) | HAProxy and DNS service that gives apps domains, TLS and load balancing. | Provides `<name>.app.runonflux.io`. |
| 47 | HAProxy | The load balancer FDM configures; round robin with 3 s health checks. | Detects dead instances in seconds. |
| 48 | App domain | `<name>.app.runonflux.io` or `<name>_<port>.app.runonflux.io`. | Your free public URL. |
| 49 | Spawner | FluxOS loop on each node that picks apps missing instances and installs them. | Why placement takes minutes. |
| 50 | Fault domain | Group of nodes sharing a hosting organisation or network block. | Synced apps are spread across them. |
| 51 | Network policy | Signed documents (blocklist, enterprise nodes) every node enforces. | Can block names, owners, images. |
| 52 | Location | A record that a node runs an app, refreshed hourly, valid 125 minutes. | `/apps/location/<name>` lists instances. |
| 53 | Flux Orbit | Git push to deploy service that builds your repo and deploys it on Flux. | Alternative to writing a spec. |
| 54 | Marketplace | Catalogue of one click app and game templates in FluxCloud. | Fastest start, fixed specs. |
| 55 | FluxDrive | IPFS backed storage service with plans from 10 GB. | Backup and restore source. |
| 56 | FluxEdge | GPU rental marketplace, separate from FluxCloud app hosting. | Not where regular apps run. |
| 57 | Flux XDAO | Governance app in the dashboard where operators propose and vote. | Not needed to deploy. |
| 58 | SSP / Zelcore | Wallets that sign Flux messages and send FLUX. | Login and payment options. |
| 59 | SSO | Email, Google or Apple login in FluxCloud that signs for you. | No wallet needed. |
| 60 | Flux Gravity | The UI label for the node software also called FluxOS; not a separate product. | Seen on the status bar only. |

[src: definitions derive from sections 1 to 9 and their cited sources | VERIFIED-SOURCE and DOCS-ONLY as tagged there]

Seeds added 2026-10-13 from section 15 (same limit of 28 words; `id` is the glossary term id; seed 53 "Flux Orbit" keeps id `flux-orbit`). Each definition says only what the cited section backs.

| # | id | Term | Definition | Pointer |
|---|---|---|---|---|
| 61 | mcp | MCP (Model Context Protocol) | A common protocol that lets an AI program discover and call named tools on another service. | 15.1.1 |
| 62 | mcp-server | MCP server | A service that offers a list of tools to AI programs over MCP. Flux has two: the Flux Cloud MCP server and the Orbit MCP server. | 15.1, 15.4 |
| 63 | ai-agent | AI agent | An AI program that takes steps on its own by calling tools such as quote or deploy, instead of only answering questions. | 15.1.5 |
| 64 | ai-assistant | AI assistant | In the new FluxCloud console, a chat helper that drafts a deployment and fills the deploy form. You review the price, sign and pay yourself. | 15.2.2, 15.2.3 |
| 65 | tool-call | Tool call | One request from an AI program to a named tool with arguments, such as `flux_quote_app` with a spec. The tool returns a result. | 15.1.4 |
| 66 | confirm-gate | Confirm gate | The plan then confirm step of `flux_deploy_app`: it returns a plan until the agent sets `confirm=true`, which signs and pays. The agent sets it, not a human prompt. | 15.1.5 |
| 67 | prompt-injection | Prompt injection | Text in a page, README or log that tells an AI agent to do something its user did not ask for, such as deploying or cancelling. | 15.1.15 |
| 68 | nixpacks | Nixpacks | The detection and build tool the Orbit product page names. The docs describe their own file based detection, so say "the page says". | 15.3.4 |
| 69 | git-deploy | Deploy with Git | A service clones your repository, builds it and registers an ordinary Flux app. The Flux product for this is Orbit. | 15.3.1 |
| 70 | webhook | Webhook | A call from GitHub, GitLab or Bitbucket to the app's webhook port when you push, telling Orbit to rebuild. Polling is the fallback. | 15.3.5 |
| 71 | preview-deploy | Preview deployment | A temporary deployment for a branch or pull request. The docs say static sites only; how previews are billed is not stated. | 15.3.5 |
| 72 | rollback | Rollback | Keeping the last working release live when a build or health check fails. Orbit keeps the last 3 releases. | 15.3.7 |
| 73 | monorepo | Monorepo | One repository holding several projects. Orbit's `PROJECT_PATH` picks the sub folder to build. | 15.3.6 |
| 74 | deploy-button | Deploy to Flux button | A README button that opens the Orbit wizard with repo, branch, project path and plan filled in. It does not deploy on its own. | 15.3.12 |

## 13. Legacy claim audit (old Next.js Flux Academy vs FluxOS 8.20.0)

### Worst errors (read this first)

1. The price formula is wrong on every page and in the SpecBuilder. Real: (cpu x 10 x 0.15 + ram/100 x 0.05 + hdd x 0.02 + $4 if enterprise + $2 if static IP + $2 per enterprise port) / 3 gives the per-instance price, which is multiplied by the instance count, then discounts, then rounded UP to the next .49 or .99. Legacy numbers are 4 to 25 percent too low (10 instances: $13.87 legacy vs $17.49 live).
2. The "g:/ gives 20% discount" claim (6 places, including every Minecraft price) is false. Live API returns the identical price with and without g:/. The OpenAPI text says synced apps pay the full price.
3. Every spec the site generates or shows is rejected by the network: no `contacts`, `geolocation`, `expire`, `nodes`; `enterprise: "enabled"` is invalid (v8 enterprise is an encrypted blob); `tiered` is not a v8 key; `YOUR_ZELID_HERE` is not a Flux ID. Live validator answer: "Missing Flux App specification parameter contacts and/or geolocation".
4. Domain patterns are invented: `{component}-{app}.app.runonflux.io`, `{app}-abc123.app.runonflux.io`, `api.app.runonflux.io:3000`. Real: `{app}.app.runonflux.io` and `{app}_{port}.app.runonflux.io`. Custom domains must ALSO be written into the spec `domains` array, and the tip "point an A record at your app IP" is wrong (CNAME only).
5. Port rules are wrong: external ports are 1 to 65535 (not 0), enterprise-fee ports are 0-1023, 8080, 8081, 8443, 6667 (9090 is NOT one; 8081 and 6667 are), they need no "enterprise mode", they just cost $2 each. Max 5 ports per component and 10 components are never mentioned.
6. Minimum instances "3" is outdated: v8 specs accept 1 (since block 2176519, confirmed live with instances 1 and 2). The UI only recommends 3.
7. All UI navigation is stale: home.runonflux.io now 301-redirects to cloud.runonflux.com; "Applications > Management > Register New App", "Deploy App", "Logs Management", "Interactive Terminal", "Import Application Specifications" no longer exist. Current flow: Register New App, Review & Validate, Validate App Spec, Sign Message, registration, Test Application Installation, Pay with Card or FLUX within 30 minutes.
8. Money and lifecycle claims are wrong: subscriptions are prepaid and non-refundable, so "stop the app to save FLUX", "keep a FLUX balance", "removing stops payments" are false; Hard Reinstall deletes app data (legacy says preserved); Docker restart policy is `no` for every container (legacy says unless-stopped); FluxOS does not act on Docker HEALTHCHECK; env vars are publicly readable unless Enterprise (legacy says put secrets there).
9. The Shared DB tutorial config does not match current docs (mysql exposes 3306 publicly, operator ports [3307, 8080] instead of 3 public ports mapped to [3307, 7071, 8008], DB_PORT/API_PORT wrong, s: instead of r: on dumps) and invents a `/cluster` JSON endpoint.
10. Hardcoded fallback FLUX price $0.15 (live $0.0852), `vipbrates.zelcore.io` presented as the official Flux rates host (FluxOS uses viprates.runonflux.io), and no mention of the subscription period/`expire` field, the 3/6/12% duration discounts, card/PayPal payment, SSP/SSO login, or the Simple/Advanced deploy modes.

### Legend and method

Source tag prefixes (all relative to the local clones listed in the Source key): `flux:` = `src/flux` (FluxOS 8.20.0, 3ca1ab9); `docs:` = `src/flux-docs/docs`; `olddocs:` = `src/runonflux-docs`; `fe:` = `src/fluxos-frontend`; `fdm:` = `src/flux-domain-manager`; `fluxapi:` = `src/fluxdocs/fluxapi.yaml`; `docsite:` = `src/flux-docs` (Docusaurus config); `legacy:` = `legacy/`.
Live probes (GET and read-only POST calculators only, 2 req/s max): `/apps/getappspecsusdprice`, `/apps/deploymentinformation`, `/apps/calculatefiatandfluxprice` (body = a v8 spec as text/plain JSON, answer `{status,data:{usd,flux,fluxDiscount}}`), `/apps/verifyappregistrationspecifications` (same body, answer is the formatted spec or an error message; registers nothing).
Verdicts: still true, outdated, wrong, unverifiable. Where docs and source disagree, source and live wins and the row says so. The pipe inside tags is escaped for table safety.

### Snapshot 2026-10-12

| Item | Value | Source |
| --- | --- | --- |
| USD rates (per month, per 3 instances) | cpu 0.15 per 0.1 core, ram 0.05 per 100 MB, hdd 0.02 per GB, port 2, scope (enterprise) 4, staticip 2, fluxmultiplier 0.95, multiplier 1, minUSDPrice 0.99, minPrice 0.01 | [src: GET https://api.runonflux.io/apps/getappspecsusdprice and https://stats.runonflux.io/apps/getappspecsusdprice \| VERIFIED-LIVE] |
| FLUX/USD | about 0.0852 (BTC/USD 81971 x FLUX/BTC 1.04e-06) | [src: GET https://viprates.runonflux.io/rates \| VERIFIED-LIVE] |
| Block height | 3,031,422 (post-PON fork at 2,020,000, about 30 s blocks) | [src: GET https://api.runonflux.io/daemon/getblockcount; flux:ZelBack/config/default.js:L496 \| VERIFIED-LIVE] |
| Month in blocks | 88,000 (22,000 x 4 after PON fork); max subscription 1,056,000 blocks | [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L70-L71; flux:ZelBack/config/default.js:L488,L495 \| VERIFIED-SOURCE] |
| FluxOS version / latest spec version | 8.20.0 / 8 | [src: GET https://api.runonflux.io/flux/version and /apps/latestspecificationversion \| VERIFIED-LIVE] |
| Fluxnodes | 7,106 total (3,585 Cumulus, 1,692 Nimbus, 1,829 Stratus) | [src: GET https://api.runonflux.io/daemon/getfluxnodecount \| VERIFIED-LIVE] |

#### Ground truth used for verdicts (stable facts)

| Fact | Value | Source |
| --- | --- | --- |
| Per-app price | total resources of all components, /3 = per-instance (ceil to cent), x instances; if per-instance < 0.50 and instances >= 4 then per-instance + 0.50 x (instances-1); floor 0.99 | [src: flux:ZelBack/src/services/utils/appUtilities.js:L110-L139 \| VERIFIED-SOURCE] |
| HW discount | x0.8 if cpu<3 and ram<6000 and hdd<150; else x0.9 if cpu<7 and ram<29000 and hdd<370; ONLY when instances < 4 (or spec v<=3) | [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L432-L440 \| VERIFIED-SOURCE] |
| Duration discount | >=3 months 3%, >=6 months 6%, >=9 months 12% | [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L469-L478 \| VERIFIED-SOURCE] |
| Final rounding | USD rounded up to next .49 or .99 (user-supplied priceUSD exempt) | [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L30-L37,L485-L491 \| VERIFIED-SOURCE] |
| FLUX price | usd / FLUX_USD x 0.95 | [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L522 \| VERIFIED-SOURCE] |
| Enterprise-fee ports | 0-1023, 8080, 8081, 8443, 6667 ($2 each) | [src: flux:ZelBack/config/default.js:L410; probe ports 80,443,1023,8080,8081,8443,6667 = +fee, 1024 and 9090 = no fee \| VERIFIED-LIVE] |
| Banned ports | 16100-16299, 26100-26299, 30000-30099, 8384, 27017, 22, 23, 25, 3389, 5900, 5800, 161, 512, 513, 5901, 3388, 4444, 123, 53 | [src: GET https://api.runonflux.io/apps/deploymentinformation \| VERIFIED-LIVE] |
| Limits (v8) | app name <=63 chars, a-zA-Z0-9 and inner hyphens, not starting zel/flux, not "watchtower"; component name alnum only <=63; description <=256; <=10 components; <=5 ports per component; <=20 env vars (<=400 chars each); <=20 commands (<=400); domain <=253; containerData <=200; repotag <=200; contacts <=5 (<=75 chars); instances 1 to 100; image <=5 GB; arch amd64 or arm64 | [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L566-L595,L675-L768,L803-L833; flux:ZelBack/config/default.js:L412-L417 \| VERIFIED-SOURCE] |
| Resource limits (whole app, summed over components) | cpu 0.1 to 15 step 0.1, ram 100 to 59000 MB step 100, hdd 1 to 820 GB | [src: fe:src/@core/components/SubscriptionManager.vue:L1931-L1933,L1965,L2000; flux:ZelBack/src/services/appRequirements/appValidator.js:L1172-L1180; probe cpu 15 ok, 16 rejected; ram 59000 ok, 59100 rejected; hdd 820 ok, 821 rejected \| VERIFIED-LIVE] |
| Container naming | `flux{component}_{app}` (v4+), `flux{app}` (v1 to v3), one Docker network per app | [src: flux:ZelBack/src/services/dockerService.js:L48-L57,L1218 \| VERIFIED-SOURCE] |
| Public domains | `{app}.app.runonflux.io` (alias of first port) and `{app}_{port}.app.runonflux.io`, lower-cased; production zone is `app` (`app2` is staging) | [src: fdm:src/services/domain/index.js:L9-L31; fdm:deployment/fdm_setup.yml:L148 \| VERIFIED-SOURCE] |

### Verdict tables by legacy file

#### components/interactive/SpecBuilder.tsx (+ components/tutorial/LivePrice.tsx, LivePriceAmount.tsx, contexts/FluxPriceContext.tsx)

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| SB-01 | SpecBuilder.tsx:L82 | fetches `https://api.runonflux.io/apps/getappspecsusdprice`, uses `data.cpu/ram/hdd/port/scope/staticip/fluxmultiplier/minUSDPrice` | still true | Endpoint and field names are current. [src: GET https://api.runonflux.io/apps/getappspecsusdprice \| VERIFIED-LIVE] |
| SB-02 | SpecBuilder.tsx:L101, FluxPriceContext.tsx:L199, next.config.mjs:L42 | `vipbrates.zelcore.io/rates` is "the official Flux rates API (used by home.runonflux.io)" | outdated | Host still answers with the same shape, but FluxOS is configured with `viprates.runonflux.io` (coingecko only as fallback). [src: flux:ZelBack/config/default.js:L847-L851 \| VERIFIED-SOURCE] |
| SB-03 | SpecBuilder.tsx:L118-L125 | FLUX/USD = rates[1].FLUX x rates[0] code USD | still true | Same derivation as FluxOS. [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L500-L508 \| VERIFIED-SOURCE] |
| SB-04 | SpecBuilder.tsx:L52,L130; LivePrice.tsx:L168; FluxPriceContext.tsx:L212,L217 | fallback FLUX price $0.15 | outdated | Live 0.0852 USD. FluxOS own fallback constant is 0.6. [src: GET https://viprates.runonflux.io/rates; flux:ZelBack/config/default.js:L338 \| VERIFIED-LIVE] |
| SB-05 | SpecBuilder.tsx:L285-L287 | rates $0.15 per 0.1 CPU, $0.05 per 100 MB, $0.02 per GB | still true | Same rates. Note they are "per 3 instances": cost scales by instances/3. [src: GET https://api.runonflux.io/apps/getappspecsusdprice \| VERIFIED-LIVE] |
| SB-06 | SpecBuilder.tsx:L289 | "EXACT FLUX PRICING FORMULA (from appUtilities.js)" | wrong | Real formula divides the summed total by 3 and multiplies by instances; see ground-truth table. [src: flux:ZelBack/src/services/utils/appUtilities.js:L110-L139 \| VERIFIED-SOURCE] |
| SB-07 | SpecBuilder.tsx:L302-L312 | enterprise adds $4 scope, static IP adds $2, before discounts | still true | Flat add-ons, added to the total before the /3 split. [src: flux:ZelBack/src/services/utils/appUtilities.js:L114-L119 \| VERIFIED-SOURCE] |
| SB-08 | SpecBuilder.tsx:L314-L326 | "Only 8080, 8443, 9090 incur fees. Privileged ports (<1024) do not" | wrong | Fee ports are 0-1023, 8080, 8081, 8443, 6667; 9090 is free. Probe: port 80 = +fee, 1023 = +fee, 1024 = none, 9090 = none. [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| SB-09 | SpecBuilder.tsx:L329-L336 | small <3 CPU/<6000 MB/<150 GB 20%, medium <7/<29000/<370 10% | outdated | Thresholds right, but discount only applies when instances < 4. 10 instances of 2/4000/10 cost $17.49 (no discount) not $13.87. [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L433-L440 \| VERIFIED-SOURCE] |
| SB-10 | SpecBuilder.tsx:L338-L345, LivePrice.tsx:L153-L156, LivePriceAmount.tsx:L58-L61 | `g:/` prefix gives 20% off | wrong | No g: logic exists in the pricing code. Probe 2/4000/10, 3 instances: `/appdata` = $4.49, `g:/appdata` = $4.49. OpenAPI: "Synced (g:) applications pay the full price". [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice; fluxapi:L15327 \| VERIFIED-LIVE] |
| SB-11 | SpecBuilder.tsx:L347-L349 | $0.99 minimum price | still true | `minUSDPrice` 0.99 (checked again after discounts). [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L480-L483 \| VERIFIED-SOURCE] |
| SB-12 | SpecBuilder.tsx:L351-L366, L605 | base covers 3 instances; extra instance = $0.50 if base < $1.50 else base/3 | wrong | Price per instance = total/3; app price = per-instance x instances (0.50 per extra instance only when per-instance < 0.50 and instances >= 4). Probe 1/2000/5: 3 instances $2.49. 10 instances of 2/4000/10 $17.49. [src: flux:ZelBack/src/services/utils/appUtilities.js:L122-L132 \| VERIFIED-SOURCE] |
| SB-13 | SpecBuilder.tsx:L369 | USD ceiled to 2 decimals | outdated | Since FluxOS PR #1818 (2026-09-25) final USD is rounded up to .49 or .99 (1.12 becomes 1.49). Probe 2.08 raw became $2.49. [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L30-L37,L485-L491 \| VERIFIED-SOURCE] |
| SB-14 | SpecBuilder.tsx:L371-L375 | FLUX = USD x 0.95 / price | still true | [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L522 \| VERIFIED-SOURCE] |
| SB-15 | SpecBuilder.tsx:L385-L416 | generated spec (version 8, `enterprise: "enabled"`, `tiered: false`, no contacts/geolocation/expire/nodes) | wrong | Live validator rejects it: "Missing Flux App specification parameter contacts and/or geolocation". v8 needs `contacts`, `geolocation`, `expire`, `nodes`, `staticip`, `datacenter?`, `enterprise`, and each component needs `repoauth` (string). [src: POST https://api.runonflux.io/apps/verifyappregistrationspecifications; flux:ZelBack/src/services/appRequirements/appValidator.js:L379-L548 \| VERIFIED-LIVE] |
| SB-16 | SpecBuilder.tsx:L393, flux-spec:L87,L444,L467, basic:L185 | `enterprise: 'enabled'` or `''` | wrong | v8 `enterprise` is `false`/empty or a base64 blob (RSA-wrapped AES key + AES-256-GCM ciphertext of contacts+compose) built client-side. [src: flux:ZelBack/src/services/utils/enterpriseHelper.js:L76-L140; flux:ZelBack/src/services/appRequirements/appValidator.js:L380 \| VERIFIED-SOURCE] |
| SB-17 | SpecBuilder.tsx:L408 | component `tiered: false` | wrong | `tiered`, `cpubasic` etc. are not allowed keys in v8 (the formatter drops them). [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L1050-L1053 \| VERIFIED-SOURCE] |
| SB-18 | SpecBuilder.tsx:L445 | app name "Only letters and numbers" | outdated | v8: a-zA-Z0-9 plus inner hyphens, max 63, not starting with `zel`/`flux`, not `watchtower`. Component names stay alnum only. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L566-L591,L707-L709 \| VERIFIED-SOURCE] |
| SB-19 | SpecBuilder.tsx:L471 | "ZelID ... required to manage" | outdated | Called Flux ID in docs; accepts a `1...` Flux ID or a `0x` Ethereum address; placeholder is rejected on live submission. [src: flux:ZelBack/src/services/signatureVerifier.js:L21-L45 \| VERIFIED-SOURCE] |
| SB-20 | SpecBuilder.tsx:L490,L512 | static IP / enterprise "increases cost based on resources" | wrong | Flat +$2 and +$4 (scope), not proportional. [src: GET https://api.runonflux.io/apps/getappspecsusdprice \| VERIFIED-LIVE] |
| SB-21 | SpecBuilder.tsx:L512 | Enterprise = ArcaneOS nodes, OS-level encrypted volumes, operators cannot read data, private images, encrypted secrets | still true | Arcane-only is enforced (spec decryption throws on non-Arcane nodes). Operator-cannot-read-data is a vendor claim. [src: flux:ZelBack/src/services/utils/enterpriseHelper.js:L21-L23; docs:fluxnodes/arcaneos-fluxnode/README.md:L29-L30 \| DOCS-ONLY] |
| SB-22 | SpecBuilder.tsx:L611-L620 | instances slider 3 to 100 | outdated | Max 100 right. Min is 1 for v8 since block 2176519; probe instances 1 and 2 validated, 0 and 101 rejected. UI still warns "recommended minimum is 3"; synced (r:/g:) storage needs 2 (UI rule). [src: POST https://api.runonflux.io/apps/verifyappregistrationspecifications; flux:ZelBack/config/default.js:L413-L416; fe:src/plugins/i18n/locales/en.json:L1222-L1223 \| VERIFIED-LIVE] |
| SB-23 | SpecBuilder.tsx:L769 | Public images everywhere; GHCR/GitLab/private require enterprise | still true | v8 `repoauth` only allowed on enterprise apps; any registry (UI: "Docker Hub, GHCR or any registry"). Image <=5 GB, amd64 or arm64. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L791-L799; fe:src/plugins/i18n/locales/en.json:L1124,L1127-L1128 \| VERIFIED-SOURCE] |
| SB-24 | SpecBuilder.tsx:L801-L835 | cpu step 0.1 min 0.1; ram step 100 min 100; hdd step 1 min 1 | still true | Omits maxima: cpu 15, ram 59000, hdd 820 (whole app). [src: fe:src/@core/components/SubscriptionManager.vue:L1931-L1933,L1965,L2000 \| VERIFIED-SOURCE] |
| SB-25 | SpecBuilder.tsx:L856,L877,L889 | external port "0-65535" | wrong | External 1 to 65535 (port 0 rejected live), minus banned list; container port 0 to 65535. [src: flux:ZelBack/config/default.js:L407-L409; POST .../verifyappregistrationspecifications port 0 = "not within Flux Apps range 1-65535" \| VERIFIED-LIVE] |
| SB-26 | SpecBuilder.tsx:L228-L242,L141-L160 | unlimited ports and components via "+ Add Port" / "Add Component" | wrong | Max 5 ports per component, 10 components. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L679-L681,L766-L768 \| VERIFIED-SOURCE] |
| SB-27 | SpecBuilder.tsx:L934 | custom domain: "Point your DNS A record to your app's IP" | wrong | CNAME to `{app}.app.runonflux.io` (or `{app}_{port}...`), and the domain must be listed in the port's spec `domains` entry; node IPs change on failover. [src: docs:fluxcloud/register-new-app/custom-domain-setup.md:L36-L44; fdm:src/services/domain/index.js:L35-L70 \| DOCS-ONLY] |
| SB-28 | SpecBuilder.tsx:L1009 | commands "run in sequence, e.g. npm install, npm start" | wrong | `commands` is passed as the container `Cmd` argv array (one process), not a command list. [src: flux:ZelBack/src/services/dockerService.js:L1073-L1078,L1196 \| VERIFIED-SOURCE] |
| SB-29 | SpecBuilder.tsx:L743 | internal DNS `flux{componentname}_{appname}` | still true | [src: flux:ZelBack/src/services/dockerService.js:L48-L57 \| VERIFIED-SOURCE] |
| SB-30 | LivePrice.tsx:L132-L159 | formula without min price, instances, enterprise ports unless enterprise | wrong | Internally inconsistent with LivePriceAmount and SpecBuilder; both wrong (SB-06). [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L307-L541 \| VERIFIED-SOURCE] |

Worked comparison (legacy formula at FLUX 0.0852, 3 instances unless stated, 1 month = 88000 blocks):

| Config | Legacy | Live API | Source |
| --- | --- | --- | --- |
| 1 CPU / 2000 MB / 5 GB | $2.08, 23.2 FLUX | $2.49, 27.75 FLUX | [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| 2 / 4000 / 10 (SpecBuilder default) | $4.16, 46.4 FLUX | $4.49, 50.07 FLUX | same |
| 2 / 3000 / 10 with g: (Minecraft small) | $3.01, 33.5 FLUX | $3.99, 44.46 FLUX | same |
| 3 / 4000 / 20 with g: (Minecraft medium) | $4.97, 55.4 FLUX | $6.49, 72.32 FLUX | same |
| 4 / 6000 / 30 with g: (Minecraft large) | $6.92, 77.1 FLUX | $8.99, 100.18 FLUX | same |
| 2.5 / 5000 / 35 + one 8080 port | $7.16, 79.8 FLUX | $7.49, 83.47 FLUX | same |
| 2 / 4000 / 10, 10 instances | $13.87, 154.6 FLUX | $17.49, 195.03 FLUX | same |
| 2 / 4000 / 20 (app-management page claims "~150 FLUX"; its own formula gives $4.32, 48.1 FLUX) | claims ~150 FLUX | $4.49, 50.07 FLUX | same |

#### app/getting-started/page.tsx and app/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| GS-01 | getting-started:L30-L33 | wallet = Zelcore only | outdated | Login options: Zelcore, SSP, WalletConnect, MetaMask, Google, Apple, email/password SSO, manual signature. [src: fe:src/plugins/i18n/locales/en.json:L788-L813 \| VERIFIED-SOURCE] |
| GS-02 | getting-started:L36-L37 | "Purchase FLUX tokens for deployment costs" | outdated | Payment options: Stripe card, PayPal, or FLUX (5% off). 30 minute payment window. [src: docs:fluxcloud/register-new-app/deploy-with-docker/review.md:L38-L52; fe:src/plugins/i18n/locales/en.json:L1393-L1395 \| DOCS-ONLY] |
| GS-03 | getting-started:L25 | "push images to a public registry" | still true | Public by default; private needs Enterprise. Registry can be Docker Hub, GHCR or other. [src: fe:src/plugins/i18n/locales/en.json:L1124,L1127-L1128 \| VERIFIED-SOURCE] |
| GS-04 | getting-started:L98-L116 | Cumulus 2 cores/4 threads, 8 GB, 220 GB; Nimbus 4/8, 32, 440; Stratus 8/16, 64, 880 | still true | Collateral (not stated by legacy): 1000 / 12500 / 40000 FLUX. [src: docs:fluxnodes/what-are-fluxnodes.md:L31-L33; flux:ZelBack/config/default.js:L670-L677 \| DOCS-ONLY] |
| GS-05 | getting-started:L99-L116 | tier "descriptions": Nimbus "recommended for most applications" | unverifiable | v8 apps have no tier selection (tiered keys removed); placement is by free capacity and geography. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L1050-L1053 \| VERIFIED-SOURCE] |
| GS-06 | getting-started:L90 | "thousands of FluxNodes" | still true | 7,106 today. [src: GET https://api.runonflux.io/daemon/getfluxnodecount \| VERIFIED-LIVE] |
| GS-07 | getting-started:L128-L148 | internal DNS pattern and examples | still true | [src: flux:ZelBack/src/services/dockerService.js:L48-L57 \| VERIFIED-SOURCE] |
| GS-08 | getting-started:L171-L183,L189 | LivePrice table, "includes tier discounts and 5% FLUX discount" | wrong | 5% FLUX discount is right; amounts use the wrong formula (see worked comparison). [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| GS-09 | page.tsx:L54 | "estimate deployment costs before you commit your FLUX" | outdated | Cards and PayPal are also accepted; official calculator is `cloud.runonflux.com/cost-calculator` (menu "Cost Calculator"). [src: fe:src/navigation/vertical/xdao.js:L1-L6 \| VERIFIED-SOURCE] |

#### app/playground/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| PG-01 | playground:L26 | "All ports must be between 0 and 65535" | wrong | External 1 to 65535 minus banned ports; max 5 per component. [src: fe:src/plugins/i18n/locales/en.json:L1504 \| VERIFIED-SOURCE] |
| PG-02 | playground:L28,L66 | deploy via home.runonflux.io | outdated | 301 redirects to `https://cloud.runonflux.com/`. [src: curl -I https://home.runonflux.io, 2026-10-12 \| VERIFIED-LIVE] |
| PG-03 | playground:L47 | paste JSON into "Import Application Specifications" dialog on "Register New App" | outdated | Register New App is now a landing page (Docker vs Git), then a Simple/Advanced form; import button is "Import compose / spec" (or "Import Specification"), dialog title "Import {type}". [src: fe:src/plugins/i18n/locales/en.json:L1117-L1120,L1199,L1318 \| VERIFIED-SOURCE] |
| PG-04 | playground:L55-L61 | step "Click Copy" | unverifiable | SpecBuilder only has a "Download" button and a CodeBlock; whether CodeBlock copies is not a Flux fact. [src: legacy:components/interactive/SpecBuilder.tsx:L672-L678 \| UNVERIFIED] |

#### app/reference/flux-spec/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| FS-01 | L15-L42 | "Complete Spec Example (Version 8)" | wrong | Missing `contacts`, `geolocation`, `expire`, `nodes`, `datacenter`; has invalid `tiered`, `enterprise:""` is ok. A valid minimal v8: version, name, description, owner, instances, contacts, geolocation, expire, nodes, staticip, enterprise, compose[{name, description, repotag, ports, containerPorts, domains, environmentParameters, commands, containerData, cpu, ram, hdd, repoauth}]. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L1045-L1053; POST https://api.runonflux.io/apps/verifyappregistrationspecifications \| VERIFIED-LIVE] |
| FS-02 | L55 | "Use 8 for latest features (instances, staticip, enterprise)" | outdated | instances arrived in v3, geolocation/contacts v5, expire v6, nodes/staticip/secrets v7, enterprise/datacenter v8. [src: flux:ZelBack/config/default.js:L379-L388 \| VERIFIED-SOURCE] |
| FS-03 | L63,L441 | name: alnum only, no hyphens | outdated | See SB-18. Name must be unique among registered apps (released after expiry). [src: flux:ZelBack/src/services/utils/appConstants.js:L36-L37; POST .../verifyappregistrationspecifications `my-academy-probe` valid, `fluxacademyprobe` rejected \| VERIFIED-LIVE] |
| FS-04 | L71,L443 | instances minimum is 3 | outdated | Min 1 on v8 (SB-22). [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L803-L809 \| VERIFIED-SOURCE] |
| FS-05 | L79 | static IP cost "based on resources" | wrong | Flat $2 (SB-20). [src: GET https://api.runonflux.io/apps/getappspecsusdprice \| VERIFIED-LIVE] |
| FS-06 | L121 | component DNS `flux{name}_{appname}` | still true | Component name: alnum only, <=63 (v8), not starting zel/flux. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L696-L709 \| VERIFIED-SOURCE] |
| FS-07 | L129,L450 | repotag "Must be publicly accessible" | outdated | Private only via Enterprise `repoauth` (username:password or token; cloud registries use azure:// or google:// schemes in the UI). [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L791-L799; fe:src/plugins/i18n/locales/en.json:L1127-L1128 \| VERIFIED-SOURCE] |
| FS-08 | L137,L446 | "Ports <1024, 8080, 8443, or 9090 require enterprise mode and add $2/port" | wrong | No mode requirement; fee ports are 0-1023, 8080, 8081, 8443, 6667 at $2 each; 9090 is free. Probe: port 80 validated for a non-enterprise v8 spec. [src: POST https://api.runonflux.io/apps/verifyappregistrationspecifications; flux:ZelBack/config/default.js:L410 \| VERIFIED-LIVE] |
| FS-09 | L137 vs L451 | ports "0-65535" and later "1-65535" | wrong | Internally inconsistent; 1 to 65535 is correct. [src: flux:ZelBack/config/default.js:L407-L408 \| VERIFIED-SOURCE] |
| FS-10 | L145,L445 | containerPorts 0-65535, arrays must match length | still true | [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L755-L765 \| VERIFIED-SOURCE] |
| FS-11 | L153 | domains: empty strings use Flux-assigned domains | still true | Real hostnames are `{app}.app.runonflux.io` and `{app}_{port}.app.runonflux.io`; domain string max 253 chars, comma-separated list per port is split by FDM. [src: fdm:src/services/domainService.js:L1150-L1185 \| VERIFIED-SOURCE] |
| FS-12 | L161 | cpu "Minimum 0.5, increment by 0.5" | wrong | 0.1 minimum and step (contradicts L447 on the same page). [src: fe:src/@core/components/SubscriptionManager.vue:L1931-L1933 \| VERIFIED-SOURCE] |
| FS-13 | L169,L171 | ram "Minimum 512", example 4096 | wrong | Min 100, step 100; 4096 would be rounded by the UI. Compose validator itself only checks totals. [src: fe:src/@core/components/SubscriptionManager.vue:L1965,L1982; flux:ZelBack/src/services/appRequirements/appValidator.js:L1172-L1180 \| VERIFIED-SOURCE] |
| FS-14 | L177 | hdd minimum 1 GB | still true | Max 820. [src: fe:src/@core/components/SubscriptionManager.vue:L2000 \| VERIFIED-SOURCE] |
| FS-15 | L183 | env vars KEY=value | still true | <=20 vars, <=400 chars each; publicly readable unless Enterprise. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L733-L740; docs:fluxcloud/register-new-app/deploy-with-docker/components.md:L70 \| VERIFIED-SOURCE] |
| FS-16 | L199 | commands "Override container CMD" | still true | Passed as Docker `Cmd`. [src: flux:ZelBack/src/services/dockerService.js:L1196 \| VERIFIED-SOURCE] |
| FS-17 | L207 | `tiered`: "allow deployment on different node tiers" | wrong | Not a v8 key; per-tier `cpubasic/cpusuper/cpubamf` was for v1 to v7. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L1050-L1053 \| VERIFIED-SOURCE] |
| FS-18 | L245-L264,L406 | `g:/` primary/standby, one writer, standby replicas, failover | still true | Standby containers are not running (reconciler holds them); election cycle 30 s, 180 s stagger per place. [src: flux:ZelBack/src/services/appMonitoring/appReconciler.js:L382-L387; flux:ZelBack/config/default.js:L645-L646 \| VERIFIED-SOURCE] |
| FS-19 | L254,L278,L300,L356 | auto-restart "No (restart policy no)" for g/r, "Yes (unless-stopped)" for s: and no prefix | wrong | Every container is created with Docker `RestartPolicy: no`; FluxOS reconciler restarts crashed containers itself ("always" behaviour), but holds g:/r: ones until the sync controller allows. [src: flux:ZelBack/src/services/dockerService.js:L1215-L1217; flux:ZelBack/src/services/appMonitoring/appReconciler.js:L192-L198,L382-L387 \| VERIFIED-SOURCE] |
| FS-20 | L255,L410,L426,L385 | g:/ "20% discount on base price" | wrong | See SB-10. [src: fluxapi:L15327 \| VERIFIED-LIVE] |
| FS-21 | L269-L285 | `r:/` bidirectional, all instances write, conflict handling by Syncthing | still true | r: and g: folders start receive-only and are promoted after first sync; s: skips that gate. [src: flux:ZelBack/src/services/appMonitoring/syncthingMonitor.js:L334 \| VERIFIED-SOURCE] |
| FS-22 | L292-L306 | `s:/` "Standard Syncthing" | outdated | Valid third flag meaning plain Syncthing folder; names in current docs only cover `r:` and `g:`. [src: flux:ZelBack/src/services/utils/mountParser.js:L40,L1-L17; docs:fluxcloud/register-new-app/deploy-with-docker/components.md:L50-L55 \| VERIFIED-SOURCE] |
| FS-23 | L313-L342 | `0:/ 1:/` mount other component, v4+, lower index only, `\|` separator | still true | Also available: `m:subdir:path`, `ml:` (never synced), `f:file:path`, `c:N:subdir:path`, `cf:N:file:path`; total containerData <=200 chars. [src: flux:ZelBack/src/services/utils/volumeConstructor.js:L74-L79; flux:ZelBack/src/services/utils/mountParser.js:L1-L17 \| VERIFIED-SOURCE] |
| FS-24 | L348-L365 | no prefix: independent, lost if instance destroyed | still true | Per-node volume; survives restarts, not migration. [src: docs:fluxcloud/register-new-app/deploy-with-docker/components.md:L54-L55 \| DOCS-ONLY] |
| FS-25 | L464,L467 | enterprise runs only on ArcaneOS nodes | still true | [src: flux:ZelBack/src/services/utils/enterpriseHelper.js:L21-L23 \| VERIFIED-SOURCE] |
| FS-26 | L489-L504 | "environment secrets are encrypted" | outdated | In Enterprise mode the entire spec (compose, contacts) is encrypted; without it env/commands are public through the API. [src: fe:src/plugins/i18n/locales/en.json:L1148; docs:fluxcloud/register-new-app/deploy-with-docker/components.md:L70,L83 \| DOCS-ONLY] |
| FS-27 | L542 | enterprise for GDPR, HIPAA, SOC 2 compliance | unverifiable | No Flux source claims any compliance certification. [src: docs:fluxnodes/arcaneos-fluxnode/README.md \| UNVERIFIED] |
| FS-28 | L560-L576 | pricing section: base formula, additional instances, tier discounts | wrong | See SB-06, SB-09, SB-12 and duration discount (3/6/12%). [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L469-L478 \| VERIFIED-SOURCE] |
| FS-29 | whole page | (omission) `expire` / subscription period | wrong | `expire` is required from v6, in blocks (88,000 per month post-PON, max 1,056,000), UI periods 1 week, 2 weeks, 1/3/6/12 months. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L835-L858; fe:src/plugins/i18n/locales/en.json:L1619 \| VERIFIED-SOURCE] |
| FS-30 | whole page | (omission) enterprise node pinning | wrong | `nodes[]` pinning on v8 is allowed only for owners on the enterprise-owner policy list; UI hides the Priority/Enterprise Nodes tab otherwise. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L1314-L1342; fe:src/@core/components/SubscriptionManager.vue:L4360,L4370-L4385 \| VERIFIED-SOURCE] |

#### app/reference/networking/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| NW-01 | L60,L88-L104 | `flux{component}_{app}:port` internal DNS | still true | [src: flux:ZelBack/src/services/dockerService.js:L48-L57 \| VERIFIED-SOURCE] |
| NW-02 | L149-L150 | components reach each other on any port; only exposed ports are public | still true | One bridge network per app; each `ports` entry is bound on the host for both tcp and udp. [src: flux:ZelBack/src/services/dockerService.js:L964-L1004,L1218 \| VERIFIED-SOURCE] |
| NW-03 | L158-L189,L583-L591 | spec JSON with singular `port` / `containerPort` and no version | wrong | v8 uses arrays `ports`/`containerPorts`; singular keys are v1. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L1050-L1053 \| VERIFIED-SOURCE] |
| NW-04 | L169,L187 | "Flux exposes it at `api.app.runonflux.io:3000` / `web.app.runonflux.io:80`" | wrong | Hostnames are `{app}.app.runonflux.io` (first port) and `{app}_{port}.app.runonflux.io`; no `{component}.app` host and no `:port` suffix. [src: fdm:src/services/domain/index.js:L9-L31 \| VERIFIED-SOURCE] |
| NW-05 | L196 | standard ports 80/443 | outdated | 80 and 443 are in 0-1023, so each costs $2. Probe port 80 and 443 both +fee. [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| NW-06 | L217-L223 | `{appname}.app.runonflux.io` | still true | Lower-cased. [src: fdm:src/services/domain/index.js:L29 \| VERIFIED-SOURCE] |
| NW-07 | L233-L277 | CNAME via CloudFlare, subdomain or `@` | still true | Needs domain in spec `domains` as well (not mentioned). [src: docs:fluxcloud/register-new-app/custom-domain-setup.md:L36-L44; fdm:src/services/domain/index.js:L35-L70 \| DOCS-ONLY] |
| NW-08 | L288-L296,L541,L546 | `frontend-webapp.app.runonflux.io` per component | wrong | Per port: `webapp_3000.app.runonflux.io`. [src: fdm:src/services/domain/index.js:L18-L26 \| VERIFIED-SOURCE] |
| NW-09 | L320 | `https://api-myapp.app.runonflux.io/users` | wrong | `https://myapp_3000.app.runonflux.io/users`. [src: fdm:src/services/domain/index.js:L23 \| VERIFIED-SOURCE] |
| NW-10 | L343-L397 | full stack "version 4" spec with singular ports, no instances | wrong | v4 needs `instances` and arrays; whole example is not registrable as written. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L262-L378,L473-L486 \| VERIFIED-SOURCE] |
| NW-11 | L414-L419,L487 | all Flux domains get automatic TLS, app serves plain HTTP | still true | HAProxy terminates TLS (`bind *:443 ssl`). [src: fdm:src/services/haproxyTemplate.js:L113 \| VERIFIED-SOURCE] |
| NW-12 | L430-L456 | Cloudflare "Full" mode, Always Use HTTPS | unverifiable | Third-party settings; Flux docs only say proxy enabled. [src: docs:fluxcloud/register-new-app/custom-domain-setup.md:L44 \| UNVERIFIED] |
| NW-13 | L563-L575 | Postgres reachable with `ports` exposure "private" | wrong | Any value in `ports` is a public host binding; database components should leave `ports: []`. [src: flux:ZelBack/src/services/dockerService.js:L964-L1004; docs:fluxcloud/shared-database/component.md:L23,L59-L64 \| VERIFIED-SOURCE] |
| NW-14 | L360 | postgres `containerData: "s:/var/lib/postgresql/data"` as sensible default | unverifiable | s: is not gated on sync like r:/g:; no Flux source recommends it for databases. [src: flux:ZelBack/src/services/appMonitoring/syncthingMonitor.js:L334 \| UNVERIFIED] |

#### app/reference/docker-tips/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| DT-01 | L371 | HEALTHCHECK lets "Flux monitor your application and restart it if unhealthy" | wrong | FluxOS has no Docker healthcheck handling; restarts follow container exit via its reconciler. [src: flux:ZelBack/src/services/appMonitoring/appReconciler.js:L192-L215 (grep for healthcheck over ZelBack/src returns only unrelated files) \| VERIFIED-SOURCE] |
| DT-02 | L487 | "Always pass secrets via env vars in the deployment spec" | wrong | Env vars and commands are public through the API unless Enterprise is on; secrets-looking vars auto-switch the UI to Enterprise. [src: docs:fluxcloud/register-new-app/deploy-with-docker/components.md:L70; fe:src/plugins/i18n/locales/en.json:L1148 \| DOCS-ONLY] |
| DT-03 | L472 | `DB_HOST=fluxpostgres_myapp` | still true | [src: flux:ZelBack/src/services/dockerService.js:L48-L57 \| VERIFIED-SOURCE] |
| DT-04 | whole page | (omission) image limits | wrong | Image <= 5 GB, must be amd64 or arm64 (enterprise: amd64), all components need a common arch. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L1450-L1480; flux:ZelBack/src/services/utils/appConstants.js:L58-L61; flux:ZelBack/config/default.js:L412 \| VERIFIED-SOURCE] |
| DT-05 | L70-L78,L155-L179 | image sizes (500MB, 900MB, 40MB), node:18 | unverifiable | Not Flux facts; node:18 is end-of-life upstream (not checked against a local source). [src: none \| UNVERIFIED] |
| DT-06 | L342 | `docker scan` | unverifiable | Docker tooling claim, not a Flux fact; not checked. [src: none \| UNVERIFIED] |

#### app/troubleshooting/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| TS-01 | L49 | "Flux cannot pull private images without credentials" | outdated | Private images work with Enterprise `repoauth`. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L791-L799 \| VERIFIED-SOURCE] |
| TS-02 | L72-L73 | required fields: version, name, repotag, cpu, ram, hdd; compose needs v4+ | wrong | Required set is much larger (see FS-01). v4 is correct for compose. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L66-L548 \| VERIFIED-SOURCE] |
| TS-03 | L85-L86,L93-L117 | `port`/`containerPort`, range 0-65535 | wrong | Arrays; external 1 to 65535. Error text seen live: "Assigned port 0 is not within Flux Apps range 1-65535". [src: POST https://api.runonflux.io/apps/verifyappregistrationspecifications \| VERIFIED-LIVE] |
| TS-04 | L148 | "Applications > Management > (app) > Logs Management" | outdated | My Applications > app > "Logs" tab (tabs: Specifications, Information, File Changes, Monitoring, Logs, Secure Shell, Control, Backup & Restore, Instances, Subscription, Audit, Audit Stats). [src: fe:src/plugins/i18n/locales/en.json:L2856-L2868 \| VERIFIED-SOURCE] |
| TS-05 | L221 | wait "2-5 minutes" for DNS | unverifiable | UI says domain access "should be available in a few minutes". [src: fe:src/plugins/i18n/locales/en.json:L1551 (appAccessDomainAvailable) \| UNVERIFIED] |
| TS-06 | L224 | multi-component domain `componentname-appname.app.runonflux.io` | wrong | `{app}_{port}.app.runonflux.io`. [src: fdm:src/services/domain/index.js:L18-L26 \| VERIFIED-SOURCE] |
| TS-07 | L225,L328 | "access with port number / domain:port" | wrong | Use the `{app}_{port}` host over HTTPS, or node `IP:port`. [src: fdm:src/services/domain/index.js:L18-L26 \| VERIFIED-SOURCE] |
| TS-08 | L240 | CNAME target must be `appname.app.runonflux.io` | still true | [src: docs:fluxcloud/register-new-app/custom-domain-setup.md:L43 \| DOCS-ONLY] |
| TS-09 | L281-L289 | external domain for DB fails, use internal DNS | still true | [src: flux:ZelBack/src/services/dockerService.js:L1218 \| VERIFIED-SOURCE] |
| TS-10 | L352-L366 | multiple ports `[80, 9090, 9100]` | still true | Limit 5 ports; port 80 costs $2. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L766-L768 \| VERIFIED-SOURCE] |
| TS-11 | L428 | "s:/ single node, r:/ replicated, g:/ geo-distributed with 20% discount" | wrong | r: replicated on all instances; g: primary/standby; s: Syncthing folder; none is "geo-distributed", no discount. [src: flux:ZelBack/src/services/utils/mountParser.js:L1-L17; docs:fluxcloud/register-new-app/deploy-with-docker/components.md:L50-L55 \| VERIFIED-SOURCE] |
| TS-12 | L545 | `discord.com/invite/runonflux` | still true | Invite resolves to "Flux \| Decentralized Cloud Computing". [src: GET https://discord.com/api/v9/invites/runonflux \| VERIFIED-LIVE] |
| TS-13 | L559 | docs at `docs.runonflux.io` | outdated | Docs site is `docs.runonflux.com` (host still answers 200). [src: docsite:docusaurus.config.ts:L18 \| VERIFIED-SOURCE] |

#### app/tutorials/basic-deployment/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| BD-01 | L48,L231 | "~N FLUX" for 1/2000/5 | wrong | $2.49, 27.75 FLUX today (legacy formula gives 23). [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| BD-02 | L147-L176 | tutorial spec | wrong | Not registrable (SB-15). [src: POST https://api.runonflux.io/apps/verifyappregistrationspecifications \| VERIFIED-LIVE] |
| BD-03 | L184 | static IP "$2/month" | still true | About $2 at 3 instances before the small-app discount, scales with instances. [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice (2/4000/10: 4.49 to 5.99) \| VERIFIED-LIVE] |
| BD-04 | L207,L272 | `home.runonflux.io`, URL `hello-flux-abc123.app.runonflux.io` | wrong | Redirects to cloud.runonflux.com; URL is `helloflux.app.runonflux.io` or `helloflux_3000.app.runonflux.io`. [src: fdm:src/services/domain/index.js:L9-L31 \| VERIFIED-SOURCE] |
| BD-05 | L213 | "Login with Zelcore wallet" | outdated | One of several (GS-01). [src: fe:src/plugins/i18n/locales/en.json:L810-L813 \| VERIFIED-SOURCE] |
| BD-06 | L219 | "Applications > Management > Register New App" | outdated | Sidebar: My Applications, Register New App, App Marketplace (Games, WordPress). [src: fe:src/navigation/vertical/apps.js:L1-L20 \| VERIFIED-SOURCE] |
| BD-07 | L237 | 'Click "Deploy App" and approve in Zelcore' | wrong | Review & Validate, "Validate App Spec", "Sign Message", registration, "Test Application Installation", "Pay with Card" or "Pay with FLUX" (30 minute window, up to 45 min to deploy after payment). [src: fe:src/plugins/i18n/locales/en.json:L1356-L1395,L1420,L1479,L1491 \| VERIFIED-SOURCE] |
| BD-08 | L254-L263 | stages Pending / Starting / Running | unverifiable | Not UI labels found in source. [src: none \| UNVERIFIED] |
| BD-09 | L269 | deployment "typically 5-10 minutes" | unverifiable | UI: install "usually 1-3 minutes", payment confirmation "a few minutes", up to 45 min. [src: fe:src/plugins/i18n/locales/en.json:L1491,L1568 \| UNVERIFIED] |

#### app/tutorials/app-management/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| AM-01 | L81 | "Applications > Management", tabs "My Active Apps" and "My Expired Apps" | outdated | Entry is "My Applications"; tabs "My Active Apps"/"My Expired Apps" still exist. [src: fe:src/plugins/i18n/locales/en.json:L246,L293-L295 \| VERIFIED-SOURCE] |
| AM-02 | L157 | "Logs Management" sidebar section | outdated | "Logs" tab. [src: fe:src/plugins/i18n/locales/en.json:L2856-L2868 \| VERIFIED-SOURCE] |
| AM-03 | L225-L289 | monitoring graphs CPU, memory, network, IO, storage, rootfs, processes | still true | Monitoring tab, network is RX/TX on eth0, history up to 7 days. [src: fe:src/plugins/i18n/locales/en.json (pages.apps.manage.charts, timeRange) \| VERIFIED-SOURCE] |
| AM-04 | L313-L426 | control buttons Start, Stop, Restart, Pause, Unpause, Soft Reinstall, Hard Reinstall, Remove | still true | Tab is now "Control" (title "Application Control"), buttons exist per component and per application. [src: fe:src/plugins/i18n/locales/en.json:L882-L938 \| VERIFIED-SOURCE] |
| AM-05 | L343 | Stop "stops FLUX payments for compute" | wrong | Subscription is prepaid and non-refundable; stopping saves nothing. [src: docs:fluxcloud/register-new-app/deploy-with-docker/general.md:L34-L39 \| DOCS-ONLY] |
| AM-06 | L406 | Hard Reinstall "preserves containerData" | wrong | UI: "completely remove and redeploy ... All application data will be deleted." [src: fe:src/plugins/i18n/locales/en.json:L938; flux:ZelBack/src/services/appLifecycle/advancedWorkflows.js:L1599-L1621 \| VERIFIED-SOURCE] |
| AM-07 | L423,L690 | Remove stops FLUX payments / "don't let FLUX balance run to zero" | wrong | No wallet balance is debited; registrations are paid up front and simply expire. Cancellation is done via Subscription tab ("Cancel Subscription"). [src: fe:src/plugins/i18n/locales/en.json:L1235-L1243 (cancelSubscription, cancelAppWillExpire, afterExpirationNotAccessible) \| VERIFIED-SOURCE] |
| AM-08 | L452 | shell types sh, bash, ash | wrong | Dropdown: `/bin/bash`, `/bin/sh`, Custom; tab named "Secure Shell". [src: fe:src/@core/components/Terminal.vue:L68 \| VERIFIED-SOURCE] |
| AM-09 | L462-L478 | Backup and Restore | still true | Tab "Backup & Restore". [src: fe:src/plugins/i18n/locales/en.json:L2863 \| VERIFIED-SOURCE] |
| AM-10 | L483 | "Running Instances Map" | outdated | "Instances" tab (primary IP, geolocation). [src: docs:fluxcloud/marketplace/games/minecraft.md:L97-L106 \| DOCS-ONLY] |
| AM-11 | L563 | "Monthly Cost ~150 FLUX" for 2 CPU/4000/20 | wrong | About 50 FLUX (4.49 USD). [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| AM-12 | L609,L641 | "wait 2-3 minutes", update "App will restart" | unverifiable | Updates trigger redeploy on each node; timing not documented. Free/non-extending updates exist but rate limited (see Omissions). [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L147-L256 \| VERIFIED-SOURCE] |
| AM-13 | L82-L92 | only the connected Zelcore wallet can manage | still true | Ownership is by Flux ID or ETH address, whichever login. [src: flux:ZelBack/src/services/signatureVerifier.js:L21-L45 \| VERIFIED-SOURCE] |

#### app/tutorials/minecraft-server/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| MC-01 | L37,L61,L194-L208,L215 | prices with "20% discount from g:/" | wrong | No such discount (SB-10); worked values in comparison table. [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| MC-02 | L74,L124 | `itzg/minecraft-server`, port 25565, `g:/data` | still true | Matches official template (3 instances, primary/standby). [src: docs:fluxcloud/marketplace/games/minecraft.md:L5,L97 \| DOCS-ONLY] |
| MC-03 | L111-L150 | tutorial spec | wrong | Not registrable (SB-15). [src: POST https://api.runonflux.io/apps/verifyappregistrationspecifications \| VERIFIED-LIVE] |
| MC-04 | L229-L260 | home.runonflux.io, Applications > Management, "Deploy App" | wrong | See BD-04, BD-06, BD-07. Docs now also point to the dedicated portal `minecraft.runonflux.com`. [src: docs:fluxcloud/marketplace/games/minecraft.md:L11 \| DOCS-ONLY] |
| MC-05 | L279-L283 | find IP under "Running Instances" | outdated | "Instances" tab shows primary IP; better to use the app domain `{app}.app.runonflux.io` with no port so failover keeps working. [src: docs:fluxcloud/marketplace/games/minecraft.md:L97-L127,L178 \| DOCS-ONLY] |
| MC-06 | L384 | primary/standby prevents simultaneous-write corruption | still true | [src: flux:ZelBack/src/services/appMonitoring/appReconciler.js:L382-L387 \| VERIFIED-SOURCE] |
| MC-07 | L267,L428 | first deploy 10-15 minutes | unverifiable | Not documented. [src: none \| UNVERIFIED] |
| MC-08 | L123-L141,L322-L351 | itzg env var names (TYPE, VERSION, MEMORY, ...) | unverifiable | Third-party image behaviour; not a Flux fact. [src: docs:fluxcloud/marketplace/games/minecraft.md:L5 \| DOCS-ONLY] |

#### app/tutorials/multi-component/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| MCP-01 | L59-L61 | `fluxdatabase_mystack:5432` etc. | still true | [src: flux:ZelBack/src/services/dockerService.js:L48-L57 \| VERIFIED-SOURCE] |
| MCP-02 | L321 | React frontend env `REACT_APP_API_URL=http://fluxapi_mystack:3000` | wrong | Browser code cannot resolve per-app Docker DNS; browser must call the public `{app}_{port}.app.runonflux.io` host. (Contradicts networking page L125-L129.) [src: flux:ZelBack/src/services/dockerService.js:L1218 \| VERIFIED-SOURCE] |
| MCP-03 | L277-L279 | DB component `ports: [5432]` and "Flux handles hiding database ports automatically" (L411) | wrong | `ports` entries are bound on the node public IP; leave them empty for internal-only components. [src: flux:ZelBack/src/services/dockerService.js:L964-L1004 \| VERIFIED-SOURCE] |
| MCP-04 | L39,L366 | "~N FLUX" for 2.5/5000/35 +1 enterprise port | wrong | $7.49, 83.47 FLUX (legacy 79.8). Port 8080 is a fee port. [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| MCP-05 | L264-L331 | spec | wrong | Not registrable (SB-15). [src: POST https://api.runonflux.io/apps/verifyappregistrationspecifications \| VERIFIED-LIVE] |
| MCP-06 | L372 | "wait 5-10 minutes" | unverifiable | See BD-09. [src: none \| UNVERIFIED] |
| MCP-07 | L380 | `mystack-api-abc123.app.runonflux.io` | wrong | `mystack_3000.app.runonflux.io`. [src: fdm:src/services/domain/index.js:L23 \| VERIFIED-SOURCE] |
| MCP-08 | L427 | "start components in order database, backend, frontend" | unverifiable | No ordering mechanism in the spec; components start independently. [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L379-L471 \| UNVERIFIED] |
| MCP-09 | L443 | links FluxIndexer tutorial under Minecraft href | wrong | Card text and href mismatch (content bug, not a Flux fact). [src: legacy:app/tutorials/multi-component/page.tsx:L439-L445 \| VERIFIED-SOURCE] |

#### app/tutorials/custom-domain/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| CD-01 | L26,L94,L300,L346 | Flux domains look like `yourapp-abc123.app.runonflux.io` and `yourapp-componentname-abc123...` | wrong | `{app}.app.runonflux.io` or `{app}_{port}.app.runonflux.io`. [src: fdm:src/services/domain/index.js:L9-L31 \| VERIFIED-SOURCE] |
| CD-02 | L286-L303 | find domain at Applications > Management > app | outdated | My Applications > app > Information tab (docs also say "App Details"). [src: docs:fluxcloud/marketplace/games/minecraft.md:L122; docs:fluxcloud/register-new-app/custom-domain-setup.md:L43 \| DOCS-ONLY] |
| CD-03 | L306-L310 | "each component gets its own domain" | wrong | One domain per exposed port; component names never appear. [src: fdm:src/services/domain/index.js:L18-L26 \| VERIFIED-SOURCE] |
| CD-04 | whole page | (omission) the custom hostname must be written into the spec port's `domains` entry | wrong | FDM only builds backends for hostnames present in `domains`. [src: fdm:src/services/domain/index.js:L35-L70; fdm:src/services/domainService.js:L1170-L1195 \| VERIFIED-SOURCE] |
| CD-05 | L230-L231,L318-L357 | CNAME in Cloudflare, proxy on (orange cloud), `@` for root | still true | [src: docs:fluxcloud/register-new-app/custom-domain-setup.md:L36-L44 \| DOCS-ONLY] |
| CD-06 | L423-L475,L601-L624 | Cloudflare SSL modes (Flexible, Full, Strict), redirect loop causes | unverifiable | Third-party behaviour; Flux docs state only "proxy enabled". [src: docs:fluxcloud/register-new-app/custom-domain-setup.md:L44 \| UNVERIFIED] |
| CD-07 | L242,L265 | DNS propagation up to 48 hours | unverifiable | Generic DNS folklore. [src: none \| UNVERIFIED] |

#### app/tutorials/shared-db/page.tsx

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| SD-01 | L74-L90 | three interfaces: DB proxy 3307, internal API, UI API | still true | Internal API 7071, UI/API 8008. [src: olddocs:fluxcloud/home/applications/shared-database/developer-notes.md:L36-L38 \| DOCS-ONLY] |
| SD-02 | L124-L125 | MySQL component `ports: [3306]` | wrong | Leave ports, domains, containerPorts empty on the engine. [src: docs:fluxcloud/shared-database/component.md:L23,L59-L64 \| DOCS-ONLY] |
| SD-03 | L132 | MySQL `containerData: "s:/var/lib/mysql"` | wrong | `/var/lib/mysql` with no prefix (operator replicates). [src: docs:fluxcloud/shared-database/component.md:L26,L81-L83 \| DOCS-ONLY] |
| SD-04 | L142-L143 | operator `ports [3307, 8080]`, `containerPorts [3307, 8080]` | wrong | Three public ports 1024+ (e.g. 31000,31001,31002) mapped to containerPorts [3307, 7071, 8008]; domains ["","",""]. [src: docs:fluxcloud/shared-database/component.md:L31-L33,L113-L127 \| DOCS-ONLY] |
| SD-05 | L146-L153 | env: DB_PORT=3307, API_PORT=8080, no WHITELIST | wrong | `DB_PORT` = first public port, `API_PORT` = second public port; `WHITELIST` listed among required values; `DB_COMPONENT_NAME=flux<engine>_<app>` is right. [src: docs:fluxcloud/shared-database/component.md:L135-L162,L174-L176 \| DOCS-ONLY] |
| SD-06 | L156,L519 | operator `containerData: "s:/app/dumps"` | wrong | Current docs: `r:/app/dumps`. Old GitBook docs say `s:/app/dumps`; current docs win. [src: docs:fluxcloud/shared-database/component.md:L36,L184-L186; olddocs:fluxcloud/home/applications/shared-database/developer-notes.md:L8,L113 \| DOCS-ONLY] |
| SD-07 | L170,L336 | app connects to `fluxoperator_<app>:3307` | still true | Component named `operator`. [src: docs:fluxcloud/shared-database/component.md:L28-L29 \| DOCS-ONLY] |
| SD-08 | L405-L415 | `GET :8080/cluster` returns master and replicas JSON | unverifiable | No such endpoint is documented. [src: olddocs:fluxcloud/home/applications/shared-database/developer-notes.md:L38 ("Detailed API documentation is not yet published") \| UNVERIFIED] |
| SD-09 | L530-L541 | MySQL supported; PostgreSQL/MongoDB coming | still true | [src: docs:fluxcloud/shared-database/README.md:L27-L30 \| DOCS-ONLY] |
| SD-10 | L63,L303 | LivePriceAmount with `s:/` | wrong | s: has no price effect; amounts use wrong formula. [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| SD-11 | L309,L319,L500 | cluster formation "10-15 minutes", "Cluster formed" log | unverifiable | Not documented. [src: none \| UNVERIFIED] |
| SD-12 | L450-L451 | `WHITELIST`, `authMasterOnly` options | still true | Present in old docs security section. [src: olddocs:fluxcloud/home/applications/shared-database/developer-notes.md:L23-L24 \| DOCS-ONLY] |

#### Other files (README, layout, nav, contexts)

| ID | Legacy loc | Claim | Verdict | Correction and source |
| --- | --- | --- | --- | --- |
| OT-01 | README.md:L26 | deploy at `home.runonflux.io/apps/registernewapp` | outdated | Host redirects; route is `/apps/register` (page `apps-register`). [src: fe:src/navigation/vertical/apps.js:L10; curl -I https://home.runonflux.io \| VERIFIED-LIVE] |
| OT-02 | README.md:L28-L49 | import-ready spec | wrong | Missing required fields (SB-15). [src: POST https://api.runonflux.io/apps/verifyappregistrationspecifications \| VERIFIED-LIVE] |
| OT-03 | next.config.mjs:L42 | CSP allows only `api.runonflux.io` and `vipbrates.zelcore.io` | outdated | If price source changes to `viprates.runonflux.io` or `stats.runonflux.io` the CSP must change. [src: flux:ZelBack/config/default.js:L844-L851 \| VERIFIED-SOURCE] |
| OT-04 | ProgressContext.tsx, DarkModeContext.tsx, Navigation.tsx | local progress and theme only | n/a | No Flux claims; localStorage key `flux-academy-progress`. [src: legacy:contexts/ProgressContext.tsx:L30-L44 \| VERIFIED-SOURCE] |

### Current docs that conflict with source or live API (source wins; flag when writing lessons)

| Docs statement | Source or live reality | Source |
| --- | --- | --- |
| cost-calculator.md: "Primary/standby storage (g:): 20% off" | No g: discount; identical live price | [src: docs:fluxcloud/cost-calculator.md:L33; fluxapi:L15327; POST https://api.runonflux.io/apps/calculatefiatandfluxprice \| VERIFIED-LIVE] |
| general.md: "Static IP additional cost $0.40", "Enterprise $0.80 + $0.40 per enterprise port" | Those are the on-chain minimum table (soft fork 2); the USD price table is $2, $4, $2 | [src: flux:ZelBack/config/default.js:L327-L336,L339-L351; docs:fluxcloud/register-new-app/deploy-with-docker/general.md:L41-L54 \| VERIFIED-SOURCE] |
| general.md and cost-calculator.md: minimum 3 instances | v8 minimum is 1 (after block 2176519); the API still advertises `minimumInstances: 3` in deploymentinformation (v1 to v7 value) | [src: flux:ZelBack/config/default.js:L413-L416; GET https://api.runonflux.io/apps/deploymentinformation \| VERIFIED-LIVE] |
| components.md: exposed port "must be 1024-65535"; restricted list has 3889, lacks 3389 and 53 | Port range 1-65535, below 1024 is allowed at $2; banned list has 3389 and 53, no 3889 | [src: flux:ZelBack/config/default.js:L407-L409; docs:fluxcloud/register-new-app/deploy-with-docker/components.md:L94-L96 \| VERIFIED-SOURCE] |
| general.md and components.md: name at least 3 chars, description at least 10 chars | Not enforced by the validator (probe: name `ab`, description `x` accepted); maximums are 63/256 | [src: POST https://api.runonflux.io/apps/verifyappregistrationspecifications; flux:ZelBack/src/services/appRequirements/appValidator.js:L566-L594 \| VERIFIED-LIVE] |
| components.md: no prefix volumes "non-persistent" | A no-prefix mount is a plain per-app host folder `/apps/flux{component}_{app}/appdata` (so a container restart keeps it); it is not synced to other nodes. Whether it survives every redeploy type was not tested (Hard Reinstall deletes it) | [src: flux:docs/multiple-mounts-guide.md:L52,L73-L78 \| VERIFIED-SOURCE] |
| docs domains `*.app.runonflux.io` vs FDM default `app2` | Production FDM is deployed with `appSubDomain: app`; `app2` is staging (both wildcard names resolve today) | [src: fdm:deployment/fdm_setup.yml:L148; fdm:config/default.js:L59 \| VERIFIED-SOURCE] |
| shared-database/component.md `r:/app/dumps` vs old GitBook `s:/app/dumps` | Current docs say `r:`; keep `r:` unless the operator image repo says otherwise | [src: docs:fluxcloud/shared-database/component.md:L186; olddocs:fluxcloud/home/applications/shared-database/developer-notes.md:L113 \| DOCS-ONLY] |

### Omissions that matter (facts the legacy site never states)

| Topic | Fact | Source |
| --- | --- | --- |
| Subscription | Prepaid, non-refundable; periods 1 week to 1 year; `expire` in blocks (88,000 per month); min expire 1 block (cancel); max 1,056,000 | [src: flux:ZelBack/src/services/appRequirements/appValidator.js:L835-L858; docs:fluxcloud/register-new-app/deploy-with-docker/general.md:L34-L39 \| VERIFIED-SOURCE] |
| Duration discounts | 3 months 3%, 6 months 6%, 9 months and over 12% | [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L469-L478 \| VERIFIED-SOURCE] |
| Free updates | An update that raises no cpu/ram/hdd/enterprise-port count, keeps instances/staticip/nodes and extends the term by at most 8 blocks is free, provided fewer than 11 update messages in 3600 blocks, fewer than 9 in 1440 and fewer than 6 in 720 (source comment says 5 days/2 days/1 day, written for 2-minute blocks; at 30 s blocks the windows are 30 h/12 h/6 h) | [src: flux:ZelBack/src/services/utils/appSpecHelpers.js:L147-L256 \| VERIFIED-SOURCE] |
| Min price after discounts | Floor $0.99 applies to the final figure, so tiny apps always cost $0.99 for a month | [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice (0.5/500/5 = 0.99) \| VERIFIED-LIVE] |
| Simple mode | Register New App has Simple and Advanced modes; contact email required; private image or secret-looking env auto-enables Enterprise | [src: fe:src/plugins/i18n/locales/en.json:L1117-L1148,L1218 \| VERIFIED-SOURCE] |
| Placement | Registration is refused when allowed locations cannot host the instance count | [src: fe:src/plugins/i18n/locales/en.json (placementRefusedShort) \| VERIFIED-SOURCE] |
| Docker/Git | Two deploy methods: Docker, or Git via Flux-Orbit | [src: docs:fluxcloud/register-new-app/README.md \| DOCS-ONLY] |

### Claims that cannot be verified from local sources (do not reuse without a source)

- Timings: 5-10 min deploy, 10-15 min Minecraft first start, 10-15 min Shared DB cluster formation, 2-5 min DNS, 2-3 min update, 30-60 s restart downtime.
- Marketing: "Nimbus recommended for most applications", compliance (GDPR, HIPAA, SOC 2), "censorship resistant" framing.
- Stage names Pending/Starting/Running, usage thresholds (80% CPU, 90% RAM, under 20% disk free).
- Cloudflare SSL mode behaviour, DNS propagation windows, Docker image size figures, `docker scan`, node:18 lifecycle.
- Shared DB `/cluster` endpoint, MySQL 5.7 support, replication-lag guidance.
- itzg/minecraft-server env var semantics.

### What the legacy site did well (interactive concepts worth keeping)

- Live pricing driven from the real rate endpoint, with a visible "using live pricing / fallback" status and a refresh button. Keep, but call `/apps/calculatefiatandfluxprice` for the authoritative number and show per-instance vs total.
- Spec builder with component cards, per-port rows (external, container, domain), env var and command lists, and a live JSON preview with download.
- Inline tooltips on every field (the `?` pattern), and a toggle for Static IP and Enterprise that reveals dependent fields (repoauth only when Enterprise).
- Instance slider with a base/extra breakdown of cost; resource totals panel across components.
- Tutorial scaffolding: numbered StepByStep blocks, copy-paste command boxes, checklists, per-tutorial completion badges stored locally.
- Side-by-side "bad vs good" blocks in troubleshooting and Docker tips, and a symptoms/solutions card layout.
- Volume-prefix comparison table (prefix, sync mode, restart behaviour) as a quick reference, once the values are corrected.

## 14. Open questions (could not verify, with best guesses labelled)

| # | Question | What was tried | Best guess (GUESS, do not state as fact) |
|---|---|---|---|
| 1 | Exact semantics of the `s:` volume flag versus `r:` | Read mountParser, syncthingMonitorHelpers, state machine, docs; no doc defines `s:` | `s:` = synced like `r:` but every instance runs immediately with no leader/readiness gating, so conflicts are likelier |
| 2 | Combined flags such as `rg` or `gs` | Parser accepts any letters from r, g, s | Not meant to be used; teach single flags only |
| 3 | Enterprise pricing with a real encrypted blob | Needs `/apps/getpublickey` (login). Verified via the `nodes` branch which shares the `scope` code path, and by reading source | Enterprise adds USD 4 before the divide by 3, same as pinned nodes |
| 4 | Whether the tie-break between two nodes claiming the same install is "older claim wins" | Only imports and names read in `utils/instanceOrdering.js` | Lower rank / earlier announcement wins |
| 5 | How often FDM polls the app list and how long until a new instance is behind the load balancer | Mechanism read; 2026-10-13 poll interval read: fetch loops sleep the server cache max-age (30 s default, 5 s retry), g: pass at least 25 s apart, one non-g pass cited at 479 s in a code comment | SETTLED for the intervals (6.1 step 13); the end-to-end delay from payment to a working domain was not timed live and stays "tens of seconds to minutes" |
| 6 | Cloudflare SSL mode that works with a proxied custom domain | FDM logic read; no live test | "Full" works; "Flexible" loops because port 80 redirects to HTTPS |
| 7 | WebSocket idle behaviour through FDM | App backend timeouts read, no tunnel timeout seen | Idle sockets drop around the 120 s client/server timeout unless the app sends keepalives |
| 8 | Gateway/Cloudflare rate-limit thresholds for api.runonflux.io and stats.runonflux.io | No headers seen on about 80 responses; FluxOS has no HTTP limiter | A burst limiter probably exists at the edge; stay under 2 req/s |
| 9 | CORS preflight and real browser fetch | Only header checks via curl | Simple GETs work from a browser; `application/json` POSTs would need preflight and are not required |
| 10 | Why `ipv4` in `/daemon/getfluxnodecount` is 2516 of 7105 | Not documented in clones | A daemon counter of nodes with plain IPv4 address type; do not teach |
| 11 | Real hardware minimums for benchmark thresholds (fluxbench is closed source) | Whitepaper plus FluxOS config plus live node data agree on 4/8/16 threads, 7/30/61 GB RAM, 220/440/880 GB SSD | Those numbers are right |
| 12 | Whether the docs claim "enterprise nodes must be Stratus" is policy | Policy file lists 2 pubkeys with no tier data | Not enforced by code; the two listed nodes may be Stratus |
| 13 | Meaning of "Flux Gravity" | Only a UI label | Legacy name for the node software, still in UI strings |
| 14 | What FluxCore mines after PON | Docs say "mining FLUX"; code rejects PoW blocks | Not FLUX block rewards; likely PoUW or external coins |
| 15 | Refund policy | UI says refunds are not automatic; marketing says 30-day money back | Both are true: guarantee exists via support ticket |
| 16 | Logged-in Advanced mode DOM, Orbit repo config file names, game hub checkout | Login not allowed | Labels in section 9 come from the same build served live. Orbit repo config file names: still none found after the 2026-10-13 read (15.3.13) |
| 17 | Timing claims in legacy tutorials (5 to 10 min deploys, DNS minutes, restart downtime) | No local source | Treat all as unverified; use "up to 45 minutes" from the UI text |
| 18 | Permission errors on volumes for non-root images | Not reproducible without deploying | Common Docker behaviour; image should chown or run as root |
| 19 | Whether `docker HEALTHCHECK` is read at all by any FluxOS component | grep of `State.Health`, `Healthcheck` shows only syncthing health | Not used for restarts |
| 20 | Exact minimum chain payment versus quote | Source says on-chain table (about 0.5 FLUX for a small app) but UI always asks the quote | SETTLED in source 2026-10-13 (4.7): node code accepts any payment at or above the on-chain table price, so a payment between that and the quote is accepted by the node; below it is "underpaid". Not tested by paying. Teaching rule unchanged: pay the quote |
| 21 | Parallel asset claim amounts, XDAO proposal mechanics, Titan and managed node payouts | Docs only | n/a |
| 22 | Whether `docs.runonflux.io` or `.com` hosts the same OpenAPI | fluxdocs README says docs.runonflux.io | Same spec, different host |
| 23 | Whether any live `app2.runonflux.io` records for production apps exist | DoH shows wildcards on both `app` and `app2` | `app2` is the staging fleet, same wildcard behaviour |

### 14.1 Settled on 2026-10-13 (the FACTS-owner pass over the four fact-checker reports)

| Question | Answer | Where recorded |
|---|---|---|
| Are unknown spec keys rejected or dropped? | Dropped silently by the formatter, for top-level and component keys; confirmed live | 3.2, 3.3, 11 row 11 |
| Per-component minimum and step for cpu, ram, hdd (v8)? | None enforced by the validator; 0.1 / 100 / 1 are form steps and v1-v3 rules | 2.3, 3.3 |
| Is an empty `description` accepted? | No: `""` and an absent key both fail with "Missing Flux App specification parameter name and/or description and/or owner"; `" "` passes; a component description of `""` passes | 3.2 |
| What does an owner look like? | `1...` base58check Flux ID (25 to 34 chars) or `0x` + 40 hex; `t1...` refused | 3.2 |
| Uppercase repotag? | Refused by FluxOS (pattern is lowercase only); `docker.io/` prefix fails | 3.3 |
| Do repoauth schemes `aws://` work? | Source registers only `aws-ecr://`, `azure-acr://`, `google-gar://`; the Simple form hint disagrees | 9.4.2 |
| Is a contradictory or malformed geolocation list refused? | No (accepted live); refusal needs 0 < candidates < instances | 3.5 |
| Does `*.app.runonflux.com` resolve? | No (NXDOMAIN); `*.app.runonflux.io` does | Snapshot re-read |
| 6-hourly image re-check and what it redeploys on | digest comparison for the same tag every 6 h, then `softRedeploy` | 6.3 |
| Payment between on-chain price and quote | accepted by node code | 4.7 |
| When do the 30 min and 3,600 s clocks start | 30 min is UI text and a UI watcher; 3,600 s starts on each node at registration | 6.6 |
| "Deployment Successful!" meaning | first running copy seen in `/apps/location/<name>`, or UI gave up after 30 min | 6.6 |
| FDM poll interval | see 6.1 step 13 | 6.1 |
| Where weekly backups are stored | local backups sit in the component volume under `backup/local`, not replicated; no weekly scheduler found in source | 7.4 |
| Do expiry notices reach `contacts`? | Not settled: FluxOS, FDM and the front-end sources read contain no mail sender; the UI says notices go to the contact email, so the sender (if any) is outside the clones | 14.2 |
| Which components move on `g:` failover? | only the `g:` component's container is started and stopped; FDM sends all ports to the primary | 7.2, 6.4 |
| TCP front door for a `g:` app on a port other than 25565? | yes, TCP listener on that port; Lua only for 25565, otherwise SNI and payload ACLs, then first app on the port | 6.4 |
| Does a wrong `containerPorts` trip the node port test? | Not by the source read: the test is FluxOS's own temporary HTTP listener on the node, tested from another node, so it checks the node's reachability, not your process | 14.2 |
| Does `mcp.runonflux.io` serve the Flux Cloud MCP server, and which version do the hosted servers run? (added by the 15.1 pass) | Yes, the same server on both hostnames, stateless, no authentication; both report 0.2.2 while npm `latest` is 0.2.7 | 15.1.1, 15.1.2 |
| What does `confirm` do in `flux_deploy_app`, and who answers it? | Without it the call returns a plan and spends nothing; with `confirm=true` it signs and pays. It is a boolean the agent sets, not a human prompt | 15.1.5 |
| Can the console assistant deploy or pay? | No: it has no deploy, sign, pay, cancel, control or key tool; `ui_prefill_deploy` fills the deploy form and the user signs | 15.2.2, 15.2.3 |
| Is the managed Orbit product still the Docker-image flow? (added by the 15.3 pass) | Yes at the registration level: managed apps are plain v8 specs with image `runonflux/orbit:latest` and the docs' environment names; what runs inside the image is not visible | 15.3.1 |
| What does a managed Orbit app look like in the global specs? | One component, `cloudgit` name, `containerData` `/app`, two public ports with `9001` last, a Starter size `(0.5, 1000, 5, 1)` in 214 of 235, 232 distinct owners over 235 apps | 15.3.2 |
| Why do 78 single-instance apps have no running copy? | All 78 are Orbit deployments whose owners are on the signed blocklist; healthy single-instance apps all run | 15.3.3, 6.5 |
| Do Orbit plan prices include a builder fee? Is there a free plan? | No fee visible: the three plans equal `quote()` for their size. The old Free plan is closed to new apps | 15.3.10, 15.3.11 |

### 14.2 Still unverified after the 2026-10-13 pass, and the check that would settle each

- Whether the production FDM load balancers accept TCP connections on every app port (the template was read, not probed). Settle: open a TCP connection to `<g-app>.app.runonflux.io:<its public port>` for a known g: app and see whether HAProxy answers. Not done because only HTTP GETs to four named hosts and DNS were in scope.
- Whether a node release newer than v8.20.0 accepts `aws://`, `azure://`, `google://`. Settle: read the repoauth factory of the current FluxOS release, or register an enterprise test spec with `aws://` (needs login and a payment, out of scope).
- Whether a contradictory geolocation list (allow and deny the same continent) ever installs. Settle: register one on a test app, or read `hwRequirements.js` install-time branch against a node's own `geolocation` report.
- Who sends deployment and expiry emails to `contacts`. Settle: the FluxCloud back end that handles `service.fluxcore.ai` or the marketplace alert service, neither of which is in the cloned repos; or register a throwaway app with a mailbox you control and watch it expire.
- Whether the weekly automatic backup exists. Settle: an app that has run over a week, check its Backup & Restore list for an automatic entry, or find the scheduler in a FluxOS release other than v8.20.0.
- Whether the card bridge enforces the "30 minutes" payment link validity. Settle: open a Stripe link after 30 minutes (needs an account and a real registration).
- Whether a payment between the on-chain price and the quote really installs the app. Settle: pay a 1-block-`expire` test registration with exactly the on-chain table price (a real, tiny payment); the source says it installs.
- Whether Orbit ever involves a user-signed spec. PARTLY SETTLED 2026-10-13 (15.3.1): the spec on chain is an ordinary owner-signed v8 spec, almost always a different owner per app (232 distinct owners over 235 apps), and the learner does not sign in a wallet; who holds the private key behind the derived Flux ID (the user, FluxCore or a custodian) is not stated anywhere read. Settle: ask the vendor, or read the Orbit back end (no public repository was found).
- Whether the deployed hosted Flux Cloud MCP instance (0.2.2) or its gateway logs or stores tool arguments, or has `FLUX_*` keys in its environment. Settle: the vendor, or read the deployed image; not checkable from outside (15.1.3, 15.1.18).
- Whether the console assistant's gateway keeps conversations, for how long and on which nodes the model runs; the UI says conversations help improve the model (15.2.4, 15.2.11).
- Whether the "API token with a daily limit", the prepaid balance, the 3-day grace period and nightly backups the console landing copy describes ever ship. Today nothing in the MCP server or the console code backs them (15.2.7, 15.2.8).
- End-to-end time from payment to a working `<name>.app.runonflux.io`. Settle: time it for a test app.
- Cloudflare SSL mode that works with a proxied custom domain (14 #6), CORS preflight from a real browser (14 #9), `s:` semantics (14 #1), Docker Hub default visibility of a pushed repository (an account setting, not a Flux fact), and the third-party image facts (Grafana, Postgres, MariaDB, Redis, itzg/minecraft-server paths and variables): unchanged, see 13 and 14.

---------------------------------------------------------------------

## 15. AI deployments, Orbit and agents (read 2026-10-13)

This section covers the 2026-10-13 read of the products that let software, not a person at a form, drive a Flux deployment, and of Orbit, the Git based deployment product that sits on top of the same network. 15.1 is the Flux Cloud MCP server (the `@runonflux/flux-cloud-mcp` package and the hosted endpoint, with the deployment path, the keys and the cost of a cancel), 15.2 is the assistant and the agents page of the new FluxCloud console front end, 15.3 is Orbit and Deploy with Git, and 15.4 is the Orbit MCP server. Where this section disagrees with an earlier section, the earlier row carries a 15.x pointer or has been corrected in place; the tables in 15.1.0 and 15.3.14 list every row that changed. Vendor product pages, docs pages and UI strings are DOCS-ONLY; counts from the live API are VERIFIED-LIVE and drift daily.

### 15.1 The Flux Cloud MCP server

Read 2026-10-13. Every row ends in a tag. Tags in this part: VERIFIED-SOURCE (read in the package, the console bundle or FluxOS source, file and function named), VERIFIED-LIVE (returned by a live endpoint on 2026-10-13), DOCS-ONLY (a docs page or a UI string says it and nothing verifiable backs it) and UNVERIFIED (could not be checked). The tag prefixes `mcp@0.2.7`, `mcp@0.2.2`, `hosted ...`, `docs:ai-agents-mcp`, `console ...-*.js` and `fluxos:` are explained in the Source key at the top of this file. Orbit and the Orbit MCP server are 15.3 and 15.4.

How we know: the package was unpacked and read file by file, then 0.2.2 (what the hosted server reports) was unpacked and diffed against it. The hosted endpoint was asked only `initialize`, `tools/list`, `resources/list`, `prompts/list`, `resources/read` and `prompts/get`; the integrator re-read `GET /healthz` on both hostnames and `npm view` on 2026-10-13 (version 0.2.2 hosted, 0.2.7 latest on npm). Pricing claims were checked by hand transcription of the package estimator and by read-only POSTs to `/apps/calculatefiatandfluxprice`. The console bundle was read as text. Nothing was signed, paid, registered or deployed, no key was used, and the client key embedded in the console bundle was not used and is not reproduced here.

#### 15.1.0 Supersedes / confirms (existing rows of this file, for 15.1 and 15.2)

Each row below has been applied in place to the earlier row it names (a correction, or a "15.x" pointer next to it); section 9.12 was rewritten to agree with 15.1.

| Existing row | New section | What changed |
|---|---|---|
| 9.12 "UI" row (header button "AI Agents", popover) and 9.3 "Header extras" | 15.2.9 | Confirmed as a feature of the Vue front end at `cloud.runonflux.com` (flux-gravity). The new console front end has its own `/agents` page (15.2.6). Not repeated here. |
| 9.12 "Hosted endpoint" and 9.1 row `mcp.runonflux.com/mcp` | 15.1.2 | Tightened. `https://mcp.runonflux.io/mcp` is no longer "per docs": it answers `initialize` with the same server (VERIFIED-LIVE). The hosted server is stateless, takes no authentication, and reports version 0.2.2, not 0.2.7. |
| 9.12 "Local" row | 15.1.2, 15.1.14 | Confirmed (`npx -y @runonflux/flux-cloud-mcp`, Node 20+, MIT). Added: two bins, `FLUX_API_URL`, `FLUX_NODE_URL`, `FLUX_EXPLORER_URLS`, `FLUX_STATS_URL`, `FLUX_RATES_URL` and the undocumented `FLUX_REQUEST_TIMEOUT_MS`. |
| 9.12 "Identity" row (tagged DOCS-ONLY) | 15.1.3 | Upgraded to VERIFIED-SOURCE and extended: the Flux ID must be a `1...` address, an Ethereum or SSO owner cannot be used; one WIF can be read as either role; what leaves the machine in each mode. |
| 9.12 "Tools (15)" row (tagged VERIFIED-SOURCE from `src` registrations) | 15.1.4 | Confirmed: same 15 names in package 0.2.7, in the hosted `tools/list` (0.2.2) and in the console `/agents` page. Added arguments, which need keys, which spend, which destroy. `flux_control_app` is NOT flagged "spends" and does not pay, but it can delete data. |
| 9.12 "Pricing" row (DOCS-ONLY: "same USD price as the UI") | 15.1.7, 15.1.15 | Confirmed for `flux_quote_app` and `flux_deploy_app` (they use the network calculator). Corrected for `flux_get_pricing` and the hosted pricing guide: the local estimator and the guide still state a g: 20 percent discount that does not exist and predate the .49/.99 rounding (15.1.16). |
| 9.15 snapshot row `@runonflux/flux-cloud-mcp` 0.2.7 | 15.1.1 | Confirmed. Added publish dates and that the hosted server runs 0.2.2. |
| 4.5 "Cancellation: a 1 block expire update ... is how the UI cancels" | 15.1.8, 15.2.8 | Superseded for the new console and the MCP server: both shorten the term to about an hour (MCP: `expire` 120 blocks; console: 100 blocks), not 1 block. 1 block is still accepted by the node. |
| 4.7 and 6.6 (underpayment, clocks) | 15.1.7 | Consistent. The package's "guard" is a floor under the network quote and is a no-op in practice. Its comment that underpaying "burns" FLUX is right in effect (not refunded, a hash cannot be paid twice) but the FLUX goes to the deployment address, it is not destroyed. |
| 1.2 "FluxAI" row (line ~145: Flux LLM Hub OpenAI-compatible endpoint) | 15.2.4 | Not contradicted. The console assistant calls an OpenAI-style `/v1/chat/completions` gateway on `llm.runonflux.com` with model id `fluxai:tiny`. Whether this is the same product as "Flux LLM Hub" is UNVERIFIED. |
| 9.2 "Login options" | 15.2.10 | Confirmed and extended: the new console offers SSP, Zelcore, MetaMask or any EVM wallet, WalletConnect, manual signature, and email, Google and Apple accounts where Flux holds the key. |

#### 15.1.1 What it is, versions and dates

| Fact | Value | Source tag |
|---|---|---|
| What it is | A Model Context Protocol server that lets an AI agent quote, validate, deploy, pay for, inspect, update and cancel apps on Flux, using the same network endpoints as FluxCloud. It is a client of the public API, not a new protocol. Nothing in the network changes because an agent deploys | [src: mcp@0.2.7 README.md, dist/server.js header and tool bodies \| VERIFIED-SOURCE] |
| Package | `@runonflux/flux-cloud-mcp`, MIT, `type: module`, Node `>=20`, bins `flux-cloud-mcp` (stdio, `dist/index.js`) and `flux-cloud-mcp-http` (`dist/http.js`). Runtime dependencies `@modelcontextprotocol/sdk` 1.30.0, `@runonflux/utxo-lib` 1.0.5, `bitcoinjs-message` 2.2.0, `zod` 4.6.2 | [src: mcp@0.2.7 package.json \| VERIFIED-SOURCE] |
| npm versions | 0.1.0 (2026-09-11 13:25Z), 0.2.0 to 0.2.1 (2026-09-11), 0.2.2 (2026-09-12 01:37Z), 0.2.3 and 0.2.4 (2026-09-12), 0.2.5 to 0.2.7 (2026-09-13, 0.2.7 at 07:13Z). `latest` is 0.2.7. Created 2026-09-11, so the package is about a month old at the time of writing | [src: `npm view @runonflux/flux-cloud-mcp --json` 2026-10-13 \| VERIFIED-LIVE] |
| Repository | `github.com/RunOnFlux/flux-cloud-mcp`, MIT, default branch `master`. The last commit is `e10d2ad` "Discover private app components through the owner-authenticated decrypted spec (0.2.7)", 2026-09-13; `package.json` on `master` says 0.2.7. Tags `v0.2.3` to `v0.2.7` exist | [src: api.github.com commits, tags, raw package.json 2026-10-13 \| VERIFIED-LIVE] |
| Hosted server version | `serverInfo.version` `0.2.2` and `GET /healthz` `{"status":"ok","version":"0.2.2"}`, on both `mcp.runonflux.com` and `mcp.runonflux.io`, at 04:20 and 04:30 UTC on 2026-10-13, about 30 days after 0.2.7 was published. So what the hosted server does is the 0.2.2 behaviour in 15.1.16, not the package README | [src: hosted initialize, GET /healthz, GET / \| VERIFIED-LIVE] |
| Protocol | MCP protocol version `2025-06-18`; capabilities `tools`, `resources`, `prompts`, each with `listChanged: true`; server name `flux-cloud` | [src: hosted initialize \| VERIFIED-LIVE]; `SERVER_NAME` [src: mcp@0.2.7 dist/server.js:L19 \| VERIFIED-SOURCE] |
| What 0.2.3 to 0.2.7 added over 0.2.2 | `flux_get_app` reachability diagnostics and a `ports` argument; owner-authenticated decryption of private app components for `flux_get_app`, `flux_get_app_logs` and `flux_get_app_stats`; a `flux_wait_for_app` that no longer overshoots its timeout by up to one poll; the `.io` hostname; an image on GHCR. Every other file (`chain`, `config`, `docs`, `http`, `index`, `keys`, `pricing`, `spec`) is byte identical between 0.2.2 and 0.2.7 | [src: file-by-file diff of mcp@0.2.2 against mcp@0.2.7 dist; git log \| VERIFIED-SOURCE] |

#### 15.1.2 The three ways to connect

| Way | Transport and how | Where the keys live | Source tag |
|---|---|---|---|
| Local, on your machine | stdio. `npx -y @runonflux/flux-cloud-mcp` or a global install, started by the MCP host. Keys come from the environment of that process (`FLUX_ID_PRIVATE_KEY`, `FLUX_PAYMENT_PRIVATE_KEY`). Startup line on stderr is `flux-cloud-mcp ready (api <url>, keys configured)` when both keys are set and `flux-cloud-mcp ready (api <url>, keys missing)` otherwise (`dist/index.js` line 10) | In the local process only. The host (Claude Code, Claude Desktop, Cursor, Windsurf, OpenCode) puts them into the server's environment | [src: mcp@0.2.7 dist/index.js, dist/config.js loadConfig \| VERIFIED-SOURCE] |
| Hosted by Flux | Streamable HTTP, stateless, `POST https://mcp.runonflux.com/mcp` (also `https://mcp.runonflux.io/mcp`). `GET /mcp` answers 405 "this server is stateless, use POST". CORS `*`. No authentication of any kind is asked for. The agent passes `fluxIdPrivateKey` and `paymentPrivateKey` as arguments of each tool call that needs them | Nowhere on the server in the design: the keys are call arguments, used in memory for that call. Read-only tools need none | [src: mcp@0.2.7 dist/http.js handleMcp(), dist/server.js KeysShape and withKeys() \| VERIFIED-SOURCE]; 405 on GET and no auth header needed for `initialize` and `tools/list` [src: hosted \| VERIFIED-LIVE]; "stores nothing and holds no keys; it runs on Flux Cloud itself" [src: docs:ai-agents-mcp \| DOCS-ONLY] |
| Your own hosted copy | The same `dist/http.js` in a container, `PORT` default 3000, `GET /healthz`, `GET /` plain-text landing page. The docs name the image `ghcr.io/runonflux/flux-cloud-mcp`. The package README says `docker run -p 3000:3000 runonflux/flux-cloud-mcp`, but that Docker Hub repository returns "object not found" on 2026-10-13 | Same as hosted: call arguments, plus any `FLUX_*` keys you put in the container environment (see 15.1.15) | [src: mcp@0.2.7 dist/http.js \| VERIFIED-SOURCE]; image name [src: docs:ai-agents-mcp; git commit "publish the image to GHCR" 2026-09-12 \| DOCS-ONLY]; Docker Hub 404 [src: hub.docker.com/v2/repositories/runonflux/flux-cloud-mcp \| VERIFIED-LIVE] |

| Fact | Value | Source tag |
|---|---|---|
| Hosted server is stateless | Every `POST /mcp` builds a fresh `McpServer` and a `StreamableHTTPServerTransport` without a session id generator, then closes both when the response closes. So any instance behind a load balancer can answer any request and no state lives between calls (no `Mcp-Session-Id`) | [src: mcp@0.2.7 dist/http.js handleMcp() \| VERIFIED-SOURCE] |
| SSE keepalive | Responses stream as SSE (`event: message`, `data: {...}`) with a 10 s keepalive so Flux's domain gateway (25 s inactivity timeout) does not cut long calls. The 25 s figure agrees with the FDM HAProxy server timeout in 6.4 | [src: mcp@0.2.7 dist/http.js header comment, `keepAliveMs: 10000` \| VERIFIED-SOURCE]; response is `text/event-stream` and a client must send `Accept: application/json, text/event-stream` [src: hosted \| VERIFIED-LIVE] |
| The hosted endpoint sits behind Flux's own gateway | Responses carry an `FDMSERVERID` cookie (the FDM HAProxy sticky cookie) and Cloudflare headers, consistent with "runs on Flux Cloud itself" | [src: hosted response headers \| VERIFIED-LIVE]; the claim as such [src: docs:ai-agents-mcp \| DOCS-ONLY] |
| Console `/agents` page shows the hosted config as `{"mcpServers":{"flux-cloud":{"url":"https://mcp.runonflux.com/mcp"}}}` | A bare URL, no header, no token. The same page's body text says "sign in with a token"; nothing in the server or in the 15 tool schemas accepts a token (15.2.7) | [src: console agents-*.js; console en-*.js `agents.hostedBody` \| VERIFIED-SOURCE for the config, DOCS-ONLY for the sentence] |
| Client config for a local server, JSON hosts | The package README (and the docs page) give one JSON wrapper for Claude Desktop, Cursor and Windsurf: a top level `mcpServers` object; inside it one entry named `flux-cloud`; inside that, `command` set to `npx`, `args` set to the list `-y` and `@runonflux/flux-cloud-mcp`, and `env` holding two entries whose names are `FLUX_ID_PRIVATE_KEY` and `FLUX_PAYMENT_PRIVATE_KEY`. The README's placeholders for the two values are the text `<wif of the Flux ID>` and `<wif of the payment address>`. So the private keys sit as plain text inside the client's config file. The README adds: "Keys are optional. Without them every read-only tool works, and `flux_generate_keys` will create a pair to put into the config." | [src: mcp@0.2.7 README.md "Claude Desktop, Cursor, Windsurf (JSON config)"; docs:ai-agents-mcp \| VERIFIED-SOURCE for the README, DOCS-ONLY for the docs page] |
| Other client shapes | Claude Code: `claude mcp add flux-cloud -s user -e FLUX_ID_PRIVATE_KEY=<wif> -e FLUX_PAYMENT_PRIVATE_KEY=<wif> -- npx -y @runonflux/flux-cloud-mcp`. OpenCode: a top level `mcp` object, entry `flux-cloud` with `type` `local`, `command` as one list (`npx`, `-y`, `@runonflux/flux-cloud-mcp`) and `environment` (not `env`) holding the same two names | [src: mcp@0.2.7 README.md "Claude Code", "OpenCode" \| VERIFIED-SOURCE] |
| MCP clients the vendor names | The docs page: "Any AI agent that speaks MCP, such as Claude, ChatGPT, Cursor, Windsurf or OpenCode". The npm README gives setup for Claude Code, Claude Desktop, Cursor, Windsurf and OpenCode, and (line 152) says the hosted server is for "hosts that cannot start a local process (claude.ai connectors, ChatGPT, browser and mobile agents)". These are the vendor's statements about clients; none was tested by the academy, so lessons say "the docs name ... as clients" | [src: docs:ai-agents-mcp; mcp@0.2.7 README.md \| DOCS-ONLY] |
| Does the README say how to protect the config file? | No. Neither the README nor the docs page says anything about the config file's permissions, keeping it out of version control, or treating it like a password. What they say about keys: the README's Security notes ("Private keys stay in the server process. No tool ever returns a configured key", "Use a dedicated payment address holding only what you intend to spend") and the docs page ("Keep the balance small", a dedicated pair, "never the keys of a wallet you use elsewhere", run the local server for larger budgets). Advice to protect the config file is the academy's inference from the keys being stored as plain text there, not a vendor statement: phrase it as guidance | [src: mcp@0.2.7 README.md Security notes; docs:ai-agents-mcp \| VERIFIED-SOURCE and DOCS-ONLY for what is said; the absence of any file-protection advice \| UNVERIFIED beyond these two texts] |

#### 15.1.3 Identity model: two keys, no account

| Fact | Value | Source tag |
|---|---|---|
| Flux ID key | A secp256k1 key in WIF whose Bitcoin-style P2PKH address (starts `1`) is the app `owner`. It signs the specification message and the API session phrase. It never needs to hold funds. Env `FLUX_ID_PRIVATE_KEY`; hosted argument `fluxIdPrivateKey` | [src: mcp@0.2.7 dist/keys.js identityFromWif(), signMessage(), createSession(); dist/config.js \| VERIFIED-SOURCE] |
| Payment key | A second WIF whose Flux transparent address (`t1...`) holds FLUX and pays the registration or update fee on chain. It is independent of the owner: nodes pair the payment with the message by the hash in the OP_RETURN only, and nothing about the payer is consulted. Env `FLUX_PAYMENT_PRIVATE_KEY`; hosted argument `paymentPrivateKey` | [src: mcp@0.2.7 dist/chain.js header comment and buildPayment() \| VERIFIED-SOURCE] |
| One WIF reads as either address | Both roles use WIF version byte 0x80, so the same key string yields a `1...` address (Bitcoin network) and a `t1...` address (Flux network). The role is decided by which variable it is in. Using one key for both works, but then the owner key also holds the funds, which defeats the separation | [src: mcp@0.2.7 dist/keys.js header comment, identityFromWif() \| VERIFIED-SOURCE] |
| Only `1...` owners | The local validator requires `owner` to match `^1[...]{25,34}$`. A spec owned by an Ethereum (`0x...`) address or by an SSO account cannot be built, signed or managed by this server, because it can only produce a Bitcoin-style signed message with a WIF | [src: mcp@0.2.7 dist/spec.js validateSpecification() \| VERIFIED-SOURCE] |
| Generated pair | `flux_generate_keys` makes two fresh keys with `ECPair.makeRandom` (compressed, Flux network) and returns both WIFs and addresses in the tool result. Nothing is stored or sent anywhere by the tool. The keys cannot be recovered if the user does not save them | [src: mcp@0.2.7 dist/server.js flux_generate_keys, dist/keys.js generateIdentity() \| VERIFIED-SOURCE] |
| No tool returns a configured key | `flux_get_identity` returns addresses, balance and a `configured` flag only. Only `flux_generate_keys` returns private keys, and only the ones it just made | [src: mcp@0.2.7 dist/server.js flux_get_identity \| VERIFIED-SOURCE]; same claim [src: README.md Security notes \| DOCS-ONLY] |
| Which key each tool needs | Keys are optional for the read-only tools. `flux_deploy_app` and `flux_cancel_app` need BOTH keys even for the plan (without `confirm`), because `plan()` builds the wallet first and reads the payer balance. `flux_get_app_logs`, `flux_get_app_stats` and `flux_control_app` need the Flux ID key. `flux_get_app` needs it only to decrypt a private app. Full matrix in 15.1.4 | [src: mcp@0.2.7 dist/deploy.js walletFromConfig(), plan(); dist/server.js requireOwnerWif() \| VERIFIED-SOURCE] |
| What leaves the machine, local stdio mode | Private keys do not leave the process. Sent out: the public specification (signed), the signed login phrase in a `zelidauth` header (zelid, signature, loginPhrase: public values), the raw signed payment transaction, the payment address (to ask the explorers for its UTXOs), and in `flux_get_app` probe traffic to the app's own domain, its nodes and the domain gateway node. Calls go to `api.runonflux.io`, `stats.runonflux.io`, `viprates.runonflux.io`, two Insight explorers (`explorer.runonflux.io`, `flux-explorer.sspwallet.io`) and individual FluxNodes | [src: mcp@0.2.7 dist/fluxapi.js, dist/chain.js, dist/config.js, dist/server.js reachability() \| VERIFIED-SOURCE] |
| What leaves the machine, hosted mode | The private keys themselves, as tool arguments. They pass through the AI vendor's API and the chat history of the host, the MCP host process, TLS termination at Cloudflare and Flux's gateway, and the memory of the hosted process. The server instructions and the docs both tell the agent to create a dedicated pair with `flux_generate_keys`, fund only what a deployment needs, and never ask for a wallet used elsewhere. Anything typed into a chat is in the vendor's and the host's history | [src: mcp@0.2.7 dist/server.js HOSTED_INSTRUCTIONS; hosted initialize `instructions` \| VERIFIED-SOURCE and VERIFIED-LIVE]; the vendor and history warning [src: README.md; docs:ai-agents-mcp \| DOCS-ONLY] |
| "never logged or stored" | The package code does not log tool arguments (`http.js` writes only startup and error lines to stderr). Whether the deployed 0.2.2 instance, its gateway or any intermediary logs request bodies cannot be checked from outside | [src: mcp@0.2.7 dist/http.js \| VERIFIED-SOURCE] for the package; deployed instance and path [src: README.md \| UNVERIFIED] |
| Hosted mode merges env keys under call keys | `withKeys()` uses the call argument and falls back to the process environment (`ownerWif: args.fluxIdPrivateKey?.trim() \|\| base.ownerWif`). A shared hosted copy that has `FLUX_*` set in its environment would sign and pay for every caller who omits keys | [src: mcp@0.2.7 dist/server.js withKeys() \| VERIFIED-SOURCE] |

#### 15.1.4 The 15 tools

All names are verbatim. "Keys" lists what the call needs: none, owner (Flux ID), both. In hosted mode every tool also accepts the two optional key arguments. Descriptions are in `tool-catalogue-flux-cloud-mcp.json` verbatim from the hosted `tools/list`.

| Tool | What it does | Arguments (required in bold) | Keys | Spends | Changes or destroys | Source tag |
|---|---|---|---|---|---|---|
| `flux_get_identity` | Shows the Flux ID, the payment address, its spendable FLUX and USD value, and what to configure if a key is missing. Balance counts only UTXOs with at least 1 confirmation and mature coinbase, so FLUX sent seconds ago does not show as spendable | none | none (shows what is configured) | no | no | [src: mcp@0.2.7 dist/server.js flux_get_identity; dist/chain.js selectSpendable() \| VERIFIED-SOURCE] |
| `flux_generate_keys` | Makes a fresh Flux ID key and a fresh payment key; returns WIFs, addresses, env names and next steps | none | none | no | no (returns secrets into the chat) | [src: mcp@0.2.7 dist/server.js flux_generate_keys \| VERIFIED-SOURCE] |
| `flux_get_pricing` | Returns the USD rate card (from `stats.runonflux.io/apps/getappspecsusdprice`, bundled fallback if unreachable), the FLUX/USD rate, discounts and four reference sizes. The four examples and the "discounts" block come from the LOCAL estimator, not the network (15.1.16) | none | none | no | no | [src: mcp@0.2.7 dist/server.js flux_get_pricing; dist/pricing.js fetchUsdRates(), estimateQuote() \| VERIFIED-SOURCE] |
| `flux_build_spec` | Turns a plain description into a complete v8 specification: auto-picks public ports in 31000 to 39999 by hash, defaults `instances` 3, `months` 1, data path `/data` replicated as `r:/data`. Returns spec, local errors, warnings, summary. Local only, no network call | **name**, **components** (image, cpu, ram, hdd required; ports, env, commands, dataPath, replicateData, repoauth), description, instances, months, expireBlocks, contacts, geolocation, nodes, staticip, owner | owner address (argument or key) | no | no | [src: mcp@0.2.7 dist/server.js flux_build_spec; dist/spec.js buildSpecification() \| VERIFIED-SOURCE] |
| `flux_validate_spec` | Local rule checks, then asks a node to verify the spec "exactly as at registration" (`/apps/verifyappregistrationspecifications`, or `/apps/verifyappupdatespecifications` if the name already exists). Fails early if the name is owned by someone else. Does not register | **spec**, network (default true) | owner address | no | no | [src: mcp@0.2.7 dist/server.js flux_validate_spec \| VERIFIED-SOURCE] |
| `flux_quote_app` | USD price and FLUX to pay from `POST /apps/calculatefiatandfluxprice`, for a registration, or for an update when the name already exists (unused term credited). Never uses the local estimator | **spec** | owner address | no | no | [src: mcp@0.2.7 dist/server.js flux_quote_app; dist/pricing.js quoteFromNetwork() \| VERIFIED-SOURCE] |
| `flux_deploy_app` | Validates on a node, quotes, checks the payer balance. Without `confirm` returns the plan and spends nothing. With `confirm=true` signs, broadcasts the message and pays. Registers a new name or updates an existing app of the same owner. Accepts `enterprise` for a private app | **spec**, enterprise, confirm (default false) | both, even for the plan | yes, only with `confirm=true` | An update replaces the whole spec including `expire` and may redeploy (15.1.8) | [src: mcp@0.2.7 dist/server.js flux_deploy_app; dist/deploy.js plan(), execute() \| VERIFIED-SOURCE] |
| `flux_wait_for_app` | Polls every 20 s for up to `timeoutSeconds` (default 45, min 10, max 600) until the spec is published and as many instances are located as requested. Returns payment confirmations, acceptance height, running and wanted instances, URLs | **name**, txid, previousHash, timeoutSeconds | none | no | no | [src: mcp@0.2.7 dist/server.js flux_wait_for_app; dist/deploy.js waitForApp() \| VERIFIED-SOURCE] |
| `flux_get_app` | Looks up any app by name: published spec, expiry, `blocksLeft`, `daysLeft`, running nodes, URLs. In 0.2.7 also probes reachability (15.1.9). For a private app returns sanitized component fields if the owner key is present | **name**, ports (0.2.7 only) | owner only for private apps | no | no | [src: mcp@0.2.7 dist/server.js flux_get_app \| VERIFIED-SOURCE] |
| `flux_list_my_apps` | Lists apps of the owner (or any given Flux ID) with instances running and wanted, `blocksLeft`, `daysLeft`, a component summary and URL. Reads `/apps/globalappsspecifications?owner=` and the whole `/apps/locations` list | owner, nameContains | owner address | no | no | [src: mcp@0.2.7 dist/server.js flux_list_my_apps \| VERIFIED-SOURCE] |
| `flux_get_app_logs` | Last N lines (1 to 2000, default 200) of a container from one running node (`GET /apps/applog/<component>_<app>/<lines>` with the owner session). Component is auto-picked when there is exactly one. The 0.2.7 tool description adds "(private apps are decrypted with the owner key)"; the hosted 0.2.2 `tools/list` text does not ("Fetches the last N log lines of an app (or one component of it) from one of the nodes running it. Requires the owner key.") and the hosted build cannot decrypt (15.1.10) | **name**, component, lines, nodeIp | owner | no | no (reads private data) | [src: mcp@0.2.7 dist/server.js flux_get_app_logs, resolveContainer() \| VERIFIED-SOURCE]; node enforces owner-or-Flux-team [src: fluxos:ZelBack/src/services/appManagement/appInspector.js appLog() \| VERIFIED-SOURCE] |
| `flux_get_app_stats` | CPU, memory and network of the containers on one node (`/apps/appstats/<container>`) | **name**, component, nodeIp | owner | no | no | [src: mcp@0.2.7 dist/server.js flux_get_app_stats; fluxos:appInspector.js appStats() \| VERIFIED-SOURCE] |
| `flux_control_app` | `restart`, `redeploy` (pull again and recreate; `hard=true` also wipes data) or `remove` (uninstall). Scope one node or `global` | **name**, **action**, scope (default global), nodeIp, hard | owner | no (pays nothing) | restart and soft redeploy change; hard redeploy and remove delete data (15.1.9) | [src: mcp@0.2.7 dist/server.js flux_control_app \| VERIFIED-SOURCE] |
| `flux_cancel_app` | Ends an app early by updating it with `expire` 120 blocks. Without `confirm` returns the plan. With `confirm=true` signs and pays that update. Refuses private apps (use `flux_deploy_app` with a short `expire`) | **name**, confirm (default false) | both | yes, only with `confirm=true`, a small amount (15.1.8) | destroys: the app and its data are removed everywhere after about an hour, nothing is refunded | [src: mcp@0.2.7 dist/server.js flux_cancel_app \| VERIFIED-SOURCE] |
| `flux_get_network_info` | Node totals by tier (`getzelnodecount`), block height, FLUX/USD rate, deployment address | none | none | no | no | [src: mcp@0.2.7 dist/server.js flux_get_network_info \| VERIFIED-SOURCE]; the endpoint returns `total`, `stable`, `cumulus-enabled`, `nimbus-enabled`, `stratus-enabled` [src: https://api.runonflux.io/daemon/getzelnodecount 2026-10-13 \| VERIFIED-LIVE] |

| Fact | Value | Source tag |
|---|---|---|
| The set of 15 names | Identical in package 0.2.7, in the hosted `tools/list` (15 tools) and in the console `/agents` page table. The console page flags only `flux_deploy_app` and `flux_cancel_app` as "spends" | [src: mcp@0.2.7 dist/server.js; hosted tools/list; console agents-*.js \| VERIFIED-SOURCE and VERIFIED-LIVE] |
| Tools that can never spend | 13 of 15. Only `flux_deploy_app` and `flux_cancel_app` reach `execute()`, and only when `confirm` is true. The "spends" flag exists only on the console `/agents` page (15.2.6); the hosted `tools/list` carries no annotations, so a host cannot learn from the protocol which tools spend or destroy, and a host that guards only tools it believes spend will let `flux_control_app` through (see the next row). The academy's own risk classes in `shared/flux/agents.ts` (11 reads, 1 that handles keys, 1 that spends, 2 that destroy) are a different cut of the same 15 tools, not a different count of what can spend | [src: mcp@0.2.7 dist/server.js, grep of `execute(` \| VERIFIED-SOURCE] |
| Tools that are not read-only without paying | `flux_control_app` (restart, redeploy, remove) is not behind a `confirm` flag and not behind a plan step. A host that only guards "spends" tools will let an agent remove an app or hard-redeploy it (wiping data) with one call | [src: mcp@0.2.7 dist/server.js flux_control_app \| VERIFIED-SOURCE] |
| No `readOnlyHint`, `destructiveHint` or other tool annotations | The hosted `tools/list` entries carry no `annotations`. A host cannot learn from the protocol which tools are safe | [src: hosted tools/list \| VERIFIED-LIVE] |
| Client defaults | No row in this file records how common MCP clients treat read-only or spending tools (which ask for approval, which remember an answer, which allow all). The academy writes nothing about client defaults or "most clients"; it says only that the host's approval is the human check and that the server asks nobody (15.1.5) | [src: this file \| UNVERIFIED] |
| Errors | A failing tool returns `isError: true` with a JSON `{error}` text. `flux_deploy_app` also returns the step log it had collected | [src: mcp@0.2.7 dist/server.js fail(), flux_deploy_app catch \| VERIFIED-SOURCE] |

#### 15.1.5 Plan then confirm: what `confirm` does and does not do

| Fact | Value | Source tag |
|---|---|---|
| Default | `confirm` defaults to `false`. A call without it runs `plan()` and returns `executed: false`, the summary, the quote, the payer balance, `requiredFlux`, `funded`, warnings and a `next` sentence ("Call again with confirm=true to deploy." or "Fund ... with at least N FLUX."). It signs nothing, broadcasts nothing and spends nothing | [src: mcp@0.2.7 dist/server.js flux_deploy_app; dist/deploy.js plan() \| VERIFIED-SOURCE] |
| What `plan()` still does without confirm | It does real network work: calls a node's `verifyapp*specifications`, the price calculator, `deploymentinformation`, `getinfo`, and reads the payer balance from an explorer. For a private app it also asks a node for the app public key through the owner session (needs the owner key) and encrypts the components | [src: mcp@0.2.7 dist/deploy.js plan(); dist/enterprise.js encryptEnterprise() \| VERIFIED-SOURCE] |
| With `confirm=true` | `execute()` runs: refuse if `funded` is false (nothing signed), sign the message, POST it to a node, re-read the price table, check the deployment address did not change, build and broadcast the payment. The result carries `messageHash`, `txid`, `paidFlux`, `paidUsd`, `feeFlux`, `deploymentAddress` and `messageExpiresAt` | [src: mcp@0.2.7 dist/deploy.js execute() \| VERIFIED-SOURCE] |
| `confirm` is a flag the agent sets, not a user prompt | The server cannot know whether a human agreed. The only protections are the server `instructions` ("Always show the user the USD quote from flux_quote_app and get their agreement before calling flux_deploy_app with confirm=true"), the `deploy_on_flux` prompt text, and a host that asks before tool calls. README: "good hosts ask you before that call" | [src: mcp@0.2.7 dist/server.js LOCAL_INSTRUCTIONS, deploy_on_flux; docs:ai-agents-mcp \| VERIFIED-SOURCE and DOCS-ONLY] |
| Nothing spends if the payer is unfunded | `execute()` throws "Payer ... holds X FLUX spendable but needs about Y FLUX. Fund the address and try again." before signing anything. The funded test is spendable balance at least `quote.flux` plus 0.001 FLUX (100000 sat) | [src: mcp@0.2.7 dist/deploy.js plan() `FEE_ALLOWANCE_SAT`, execute() \| VERIFIED-SOURCE] |
| Failure after the message is accepted | If the deployment address changed between quote and payment the call throws "nothing was paid" but the signed message is already stored on nodes; it expires with the temporary store after one hour and nothing is owed. If the payment broadcast itself fails, the same applies | [src: mcp@0.2.7 dist/deploy.js execute(), header comment \| VERIFIED-SOURCE] |

#### 15.1.6 How one deployment runs, end to end, in the code

Steps of `flux_deploy_app` with `confirm=true` for a new public app (function names are in `dist/deploy.js` unless stated).

| Step | What happens | Source tag |
|---|---|---|
| 1. Format and local check | `formatSpecification()` reproduces `specificationFormatter()` byte for byte (key order is part of what is signed); `validateSpecification()` mirrors node rules (name, ports, banned ports, cpu 0.1 to 15, ram 100 to 59000 in 100 steps, hdd 1 to 820, 20 env, 20 commands, 5 contacts, 10 geolocation rules, 1 to 100 instances, `expire` 1 to 1,056,000, owner is a Flux ID). Errors stop here | [src: mcp@0.2.7 dist/spec.js; dist/deploy.js plan() \| VERIFIED-SOURCE] |
| 2. Validate on a node | `POST /apps/verifyappregistrationspecifications` (or `verifyappupdatespecifications` when `/apps/appspecifications/<name>` already exists with this owner; another owner's name is an error). The load balancer `api.runonflux.io` is tried first; on a node-side failure (Unavailable, still reconciling, ECONNRESET, timeout, HTTP 5xx) up to 3 healthy nodes are probed (at least 8 outgoing and 4 incoming peers, max 240 probes) and tried in turn. A validation error is final. Private apps skip the balancer and use only ArcaneOS nodes | [src: mcp@0.2.7 dist/deploy.js selectNodes(), plan(), isNodeSideFailure(); dist/fluxapi.js findHealthyNodes() \| VERIFIED-SOURCE]; the peer minimums equal FluxOS `minOutgoing: 8`, `minIncoming: 4` [src: fluxos:ZelBack/config/default.js:L418-L420 \| VERIFIED-SOURCE] |
| 3. Quote | `POST /apps/calculatefiatandfluxprice` with the formatted (and, for private, encrypted) spec, body sent as `text/plain` because `application/json` hangs (see 4.2). The answer `{usd, flux, fluxDiscount}` is the plan's price | [src: mcp@0.2.7 dist/pricing.js quoteFromNetwork(); dist/fluxapi.js header comment \| VERIFIED-SOURCE] |
| 4. Balance | Payer UTXOs from an Insight explorer, only those with 1 or more confirmations (coinbase 100). `requiredFlux` = `quote.flux` + 0.001 FLUX | [src: mcp@0.2.7 dist/chain.js selectSpendable(); dist/deploy.js plan() \| VERIFIED-SOURCE] |
| 5. Sign | Timestamp is `Date.now()`; the signed string is `fluxappregister` or `fluxappupdate` + message version `1` + `JSON.stringify(formattedSpec)` + timestamp, signed with the Flux ID key as a Bitcoin signed message, base64. The message hash is computed by the node, not by the package: `verifyAppHash()` hashes `message.type + message.version + JSON.stringify(specifications) + message.timestamp + message.signature`. So a second confirmed call (a new timestamp from `Date.now()` and therefore a new signature) gives a new hash and its own payment; repeating a call never reuses the first payment | [src: mcp@0.2.7 dist/spec.js signablePayload(); dist/keys.js signMessage(); dist/deploy.js execute() (`const timestamp = Date.now()`); fluxos:ZelBack/src/services/appMessaging/messageVerifier.js verifyAppHash() L70-L83 (`let messToHash = message.type + message.version + JSON.stringify(specifications) + message.timestamp + message.signature;`), fetched from raw.githubusercontent.com master 2026-10-13 \| VERIFIED-SOURCE] |
| 6. Broadcast the message | `POST /apps/appregister` (or `/apps/appupdate`) to the validating node with the owner session in `zelidauth`; body `{type, version, appSpecification, timestamp, signature}`; timeout 180 s. The node answers a 64 character message hash. Anything else is an error | [src: mcp@0.2.7 dist/deploy.js execute() \| VERIFIED-SOURCE] |
| 7. Re-check, then pay | Re-reads `deploymentinformation` and `getinfo`; fails with "nothing was paid" if the deployment address changed; computes the consensus floor (15.1.7); pays `max(quote.flux, floor)`. The transaction is Sapling v4, one output of that amount to `t3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX` (the address read live, not hard coded), a change output when at least 546 sat, and a 0 value OP_RETURN with the hash as UTF-8 text. Fee 1 sat per byte, refuses a fee over 0.01 FLUX (1,000,000 sat), expiry height is current height plus 30 blocks | [src: mcp@0.2.7 dist/deploy.js execute(); dist/chain.js buildPayment(), selectInputs() \| VERIFIED-SOURCE]; address [src: https://api.runonflux.io/apps/deploymentinformation 2026-10-13 \| VERIFIED-LIVE] |
| 8. Broadcast the payment | `POST /api/tx/send` on the first explorer that answers (`explorer.runonflux.io`, then `flux-explorer.sspwallet.io`). Returns `txid` | [src: mcp@0.2.7 dist/chain.js Explorer.broadcast(); dist/config.js \| VERIFIED-SOURCE] |
| 9. Wait | The agent calls `flux_wait_for_app` (15.1.11). Nodes index the payment, pair it with the stored message, check the amount (4.7), publish the app globally, then instances spawn and pull the image | [src: mcp@0.2.7 README.md "How a deployment works"; fluxos:messageVerifier.js \| VERIFIED-SOURCE and DOCS-ONLY] |
| Time the whole call takes | The tool itself returns after the payment broadcast. Acceptance "usually takes 2-10 minutes" in the tool's own `next` text and the gotchas guide, then image pull time. That is the author's estimate; it is not measured and FACTS 6.6 and 6.1 apply (a copy can take up to about 2 h) | [src: mcp@0.2.7 dist/server.js, dist/docs.js GOTCHAS \| DOCS-ONLY] |

#### 15.1.7 The underpayment guard, and how it fits 4.7 and 6.6

| Fact | Value | Source tag |
|---|---|---|
| What the package pays | `payFlux = max(quote.flux, consensusMinimumFlux)`. The quote is the network's USD price converted at the node's FLUX rate with the 5 percent FLUX discount. So the server always pays at least what FluxCloud asks for | [src: mcp@0.2.7 dist/deploy.js execute() \| VERIFIED-SOURCE] |
| What the guard computes | `consensusMinimumFlux(spec, deployment.price, height + 5)`: take the last on-chain price interval whose `height` is below the given height, compute the per-month price with that interval's rates (same shape as 4.3 steps A: cpu x 10, ram / 100, hdd, scope, staticip, enterprise ports, divide by 3, the cheap-app and instance rules), multiply by `expire / 88000`, round up to a cent, and take at least the interval's `minPrice`. No USD floor, no discounts | [src: mcp@0.2.7 dist/pricing.js chainInterval(), chainPerMonth(), consensusMinimumFlux() \| VERIFIED-SOURCE] |
| What it re-checks and when | After the signed message has been accepted by a node and immediately before the payment is built, it re-fetches `/apps/deploymentinformation` (address and the on-chain price table) and `/daemon/getinfo` (height). It does NOT re-fetch the quote. The `+ 5` is a margin so the interval is the one in force where the payment CONFIRMS, which is where consensus applies it | [src: mcp@0.2.7 dist/deploy.js execute() comment "consensus enforces the interval in force where the payment CONFIRMS" \| VERIFIED-SOURCE]; consensus picks `intervals.filter(interval.height < height)` of the payment's height [src: fluxos:ZelBack/src/services/appMessaging/messageVerifier.js:L776-L778 \| VERIFIED-SOURCE] |
| Why it exists | An underpaid message is not stored, and a payment of at least the interval `minPrice` (0.01 FLUX) is recorded against the hash, so a second payment for the same hash is ignored ("Hash ... already exists. Not adding"). Paying too little therefore costs the FLUX and the registration | [src: mcp@0.2.7 dist/deploy.js header comment, README.md \| VERIFIED-SOURCE]; hash recorded once, [src: fluxos:ZelBack/src/services/explorerService.js:L353-L382 \| VERIFIED-SOURCE]; underpaid is logged, not stored [src: fluxos:messageVerifier.js:L812, L870 \| VERIFIED-SOURCE] |
| Reconciling with 4.7 | 4.7 says the node compares the amount only with the on-chain table price, so the real floor is far under the quote, and FluxCloud asks for the quote anyway. The package agrees: it pays the quote and uses the on-chain price only as a floor. The README's "several times lower" understates it. At the table in force at the time of writing (interval from height 1,597,156: cpu 0.03, ram 0.01, hdd 0.004, port 0.4, scope 0.8, staticip 0.4, minPrice 0.01) a 1 core, 1000 MB, 10 GB, 3 instance app has an on-chain floor of 0.45 FLUX (hand transcription of `chainPerMonth()`), while the live quote for it is USD 1.99 or 22.93 FLUX, about 50 times more | [src: https://api.runonflux.io/apps/deploymentinformation; POST https://api.runonflux.io/apps/calculatefiatandfluxprice 2026-10-13 \| VERIFIED-LIVE]; transcription [src: mcp@0.2.7 dist/pricing.js chainPerMonth() \| VERIFIED-SOURCE] |
| So in practice the guard never raises the amount | The only case is a quote below the on-chain floor, which the 0.99 USD minimum makes unreachable for registrations. For a free update the quote is 0 and the guard does raise it to the floor (15.1.8). The server warns "the payment will be raised to N FLUX" when it happens | [src: mcp@0.2.7 dist/deploy.js plan() warning text \| VERIFIED-SOURCE] |
| Reconciling with 6.6 clocks | The server signs and pays in one tool call, a few seconds apart, so neither the one hour signature window nor the one hour temporary message lifetime is at risk, and the UI "30 minutes" label does not apply. `messageExpiresAt` in the result is the signing timestamp plus 3,600 s, not the node's receive time, so it can be slightly earlier than the real deadline | [src: mcp@0.2.7 dist/deploy.js `TEMP_MESSAGE_TTL_MS`, execute() \| VERIFIED-SOURCE]; clocks [src: 6.6 \| VERIFIED-SOURCE] |
| Wording to use | "Underpaid" in the package means below the on-chain price. Never say the network "burns" FLUX: the FLUX goes to the deployment address and is not refunded | [src: mcp@0.2.7 dist/docs.js GOTCHAS; fluxos:messageVerifier.js \| VERIFIED-SOURCE] |

#### 15.1.8 Updates, `expire` and `flux_cancel_app`

| Fact | Value | Source tag |
|---|---|---|
| An update is the same call | `flux_deploy_app` on a name that exists and has the same owner sends `fluxappupdate`. The network credits the unused part of the old term at the old spec's price (4.5). The tool shows the previous hash, height and expire in `previous` | [src: mcp@0.2.7 dist/server.js flux_deploy_app; dist/deploy.js plan() \| VERIFIED-SOURCE] |
| `expire` is NOT carried over | `SpecSchema` defaults `expire` to 88000 and `flux_build_spec` defaults `months` to 1. An update replaces the whole spec, and `expire` counts from the update's block (4.5). An agent that updates an app with 5 months left without setting `expire` shortens it to 1 month, with no refund. It must read `blocksLeft` from `flux_get_app` and set `expire` to remaining plus any extension. The console's own update flow does this for you | [src: mcp@0.2.7 dist/server.js SpecSchema; dist/spec.js expireOf() \| VERIFIED-SOURCE]; console [src: console deploy-*.js gn() \| VERIFIED-SOURCE] |
| Waiting for an update needs `previousHash` | `flux_wait_for_app` treats "accepted" as "a published spec exists whose hash differs from `previousHash`". Without `previousHash` the old spec counts as accepted and the call returns `done: true` at once. The deploy result does not echo the previous hash in `next`; read `previous.hash` from the plan | [src: mcp@0.2.7 dist/deploy.js waitForApp() \| VERIFIED-SOURCE] |
| Structural changes may hard redeploy | An update can change component structure and escalate to a hard redeploy that recreates volumes (11, row 17). The tool warns only about node-local `containerData` (`durabilityWarnings()`), not about this | [src: mcp@0.2.7 dist/spec.js durabilityWarnings(); fluxos:advancedWorkflows.js \| VERIFIED-SOURCE] |
| `flux_cancel_app` | Takes the published spec through `normalizePublished()` with `expire: 120` and runs `plan()`. 120 blocks x 30 s = 3,600 s, one hour counted from the update's block, then nodes uninstall the app everywhere. Without `confirm` it returns the price and `funded`. Private apps are refused with "must be cancelled with flux_deploy_app: resend the components with a short expire". The owner must match | [src: mcp@0.2.7 dist/server.js flux_cancel_app; dist/spec.js normalizePublished() \| VERIFIED-SOURCE] |
| What a cancel costs | The quote for an update that changes nothing but shortens the term is the "free update" case: `usd 0, flux 0` while the app has had fewer than 6 updates in 720 blocks, 9 in 1,440 and 11 in 3,600 (4.5). The server then pays the consensus floor, which at the table in force is the interval `minPrice` of 0.01 FLUX (the node requires `valueSat >= max(actualPriceToPay, minPrice)` for an update), plus a network fee of about 0.001 FLUX. If the free-update limits are exceeded the quote is the update price, which for a 120 block term floors at the USD 0.99 minimum. So a cancel costs between about 0.01 FLUX and one minimum quote | [src: fluxos:ZelBack/src/services/utils/appSpecHelpers.js checkFreeAppUpdate() L147-L256, getAppFiatAndFluxPrice() L300-L440; messageVerifier.js:L833-L865; mcp@0.2.7 dist/deploy.js execute() \| VERIFIED-SOURCE]; the free-update outcome for a cancel was not exercised live with a real app [src: this file \| UNVERIFIED] |
| What is refunded | Nothing. The unused part of the old term is not returned (the quote is clamped, the node never pays out), and the console says so: "the term is shortened to about an hour, instances stop, and nothing is refunded" | [src: console en-*.js `deployments.cancelConfirm`, `deploy.cancelLede` \| DOCS-ONLY]; no refund path in node code [src: fluxos:messageVerifier.js:L833-L865 \| VERIFIED-SOURCE] |
| What happens to data | Gone: the app is uninstalled everywhere and plain, `r:`, `g:` and `s:` data go with it (7.2). Back up first | [src: 7.2, 7.4 \| VERIFIED-SOURCE] |
| Minimum term accepted | Since block 1,964,447 the node accepts `expire` of 1 block (`cancel1BlockMinBlocksAllowance`); 120 and 100 are fine | [src: fluxos:ZelBack/src/services/appRequirements/appValidator.js:L836-L846; config/default.js:L489-L493 \| VERIFIED-SOURCE] |

#### 15.1.9 `flux_control_app`, and `flux_get_app` reachability

| Fact | Value | Source tag |
|---|---|---|
| Routes | `restart` calls `GET /apps/apprestart/<name>/<global>`, `redeploy` calls `GET /apps/redeploy/<name>/<hard>/<global>`, `remove` calls `GET /apps/appremove/<name>/true/<global>`, all on one running node's API with the owner session; timeout 120 s. If `nodeIp` is omitted the first running instance is used | [src: mcp@0.2.7 dist/server.js flux_control_app \| VERIFIED-SOURCE] |
| Who may call them | The node requires `appownerorfluxteam`: only the owner (or Flux team and support). A node operator who merely hosts the app cannot | [src: fluxos:ZelBack/src/services/appLifecycle/appUninstaller.js removeAppLocallyApi(); advancedWorkflows.js redeployAPI() \| VERIFIED-SOURCE] |
| `redeploy` soft and hard | `hard=false` (the default) is the soft redeploy; `hard=true` is the hard one, which unmounts the component volume and deletes it on that node, so the data there is gone | [src: fluxos:advancedWorkflows.js redeployAPI() comment and `force` handling \| VERIFIED-SOURCE] |
| `remove` | Runs the node's `removeAppLocally` (hard uninstall: container, volume unmounted and its path cleaned, image removed) and broadcasts `fluxappremoved`. `force=true` here only skips the "another removal or install in progress" guards. The registration stays on chain, so nodes bring the app back elsewhere: the tool description says so and says to use `flux_cancel_app` to stop paying | [src: fluxos:appUninstaller.js removeAppLocally(), hardUninstallApplication(); mcp@0.2.7 dist/server.js flux_control_app \| VERIFIED-SOURCE] |
| `global` is fire and forget | A global command is sent to the other nodes and the call returns at once with "queried for global ..." (the success text for `appremove` even says "reinstallation"); the result is not the outcome | [src: fluxos:appUninstaller.js removeAppLocallyApi(), advancedWorkflows.js redeployAPI() \| VERIFIED-SOURCE] |
| Reachability probes (0.2.7 only) | `flux_get_app` fetches `https://<app>.app.runonflux.io/`, resolves its CNAME to the domain gateway node (`fdm-...`) and asks that node's port 16130 `/appips/<name>`, and for every running node and public port tries a TCP connect and an HTTP GET from the MCP server's machine. It explains a 503 (gateway not configured vs no listener vs non-HTTP service). Private apps need `ports` passed because their ports are encrypted. The hosted server (0.2.2) does none of this | [src: mcp@0.2.7 dist/server.js gatewayStatus(), reachability(), flux_get_app \| VERIFIED-SOURCE] |
| Meaning of the 503 note | The shared domain serves HTTP over TCP only. A UDP game server, a worker with no listener, or a service on a non-HTTP port is healthy and still answers 503 on the shared domain. Agrees with 6.4 and 11 row 30 | [src: mcp@0.2.7 dist/server.js reachability() comment; 6.4 \| VERIFIED-SOURCE] |

#### 15.1.10 Private (enterprise) apps through the server

| Fact | Value | Source tag |
|---|---|---|
| How to make one | Pass `enterprise: {compose, contacts}` to `flux_deploy_app`, with `spec.compose` `[]` and `spec.enterprise` `""`. The server asks a node for the app public key (`POST /apps/getpublickey` with the owner session), then encrypts `{contacts, compose}` as base64 of RSA-OAEP-SHA256 over the base64 text of a fresh AES-256 key (256 bytes), then nonce (12), AES-256-GCM ciphertext and tag (16). Public spec then has `compose: []`, `contacts: []` and the blob in `enterprise` | [src: mcp@0.2.7 dist/enterprise.js buildEnterpriseBlob(), encryptEnterprise() \| VERIFIED-SOURCE] |
| Only ArcaneOS nodes | Validation and registration of a private spec skip the load balancer and use nodes whose `/flux/info` reports an `arcaneVersion` (they alone hold the private key). Matches 2.5, 3.7 | [src: mcp@0.2.7 dist/deploy.js selectNodes({arcane:true}); dist/fluxapi.js findHealthyNodes() \| VERIFIED-SOURCE] |
| What is never returned | `flux_get_app`, `flux_get_app_logs` and `flux_get_app_stats` decrypt the owner's spec only for the owner key (the node checks the session is the owner and re-encrypts for a one-off AES key). What the tool then exposes per component is `name`, `image`, `ports`, `containerPorts`, `cpu`, `ramMb`, `hddGb`. Environment variables, commands and registry credentials (`repoauth`) never leave the server process | [src: mcp@0.2.7 dist/enterprise.js fetchPrivateSpec(), sanitizeComponent(); dist/server.js componentsFor() \| VERIFIED-SOURCE] |
| Without the owner key | A private app shows `components.source: "unavailable"` with a note; log and stats calls need `component` passed explicitly. A key that is not the app owner gets "cannot decrypt it" | [src: mcp@0.2.7 dist/server.js componentsFor(), resolveContainer() \| VERIFIED-SOURCE] |
| Hosted server (0.2.2) cannot do this | The hosted build does not send the `enterprise-key` header and does not decrypt. For a private app `flux_get_app_logs` without an explicit `component` fails ("has 0 components; pass component"), and `flux_get_app` shows no components | [src: mcp@0.2.2 dist/server.js resolveContainer(); dist/fluxapi.js; diff against 0.2.7 \| VERIFIED-SOURCE] |
| Price | Private apps add the USD 4 scope charge (4.4). The quote request goes to the load balancer with the encrypted spec, and pricing an encrypted spec needs an ArcaneOS node (4.2). Whether the balancer always routes it to one was not exercised | [src: mcp@0.2.7 dist/deploy.js plan(); 4.2 \| VERIFIED-SOURCE]; routing [src: this file \| UNVERIFIED] |
| Secrets in a log | Logs of a running container are returned as they are. Nothing filters what the app prints | [src: mcp@0.2.7 dist/server.js flux_get_app_logs \| VERIFIED-SOURCE] |

#### 15.1.11 `flux_wait_for_app`

| Fact | Value | Source tag |
|---|---|---|
| Timeouts | `timeoutSeconds` integer 10 to 600, default 45 "to fit hosts with a 60 s tool timeout". Poll every 20 s | [src: mcp@0.2.7 dist/server.js flux_wait_for_app; dist/deploy.js waitForApp() `pollMs = 20000` \| VERIFIED-SOURCE]; description text [src: hosted tools/list \| VERIFIED-LIVE] |
| Done means | `done = accepted && running locations >= wanted instances`. Accepted is "the published spec exists" (and differs from `previousHash` if given), which is not the same as payment confirmed. Payment confirmations are reported only if `txid` is passed, and only until 1 is seen | [src: mcp@0.2.7 dist/deploy.js waitForApp() \| VERIFIED-SOURCE] |
| On timeout | Returns `timedOut: true` with partial progress, `next: "Call again to keep waiting."`. Safe to repeat | [src: mcp@0.2.7 dist/server.js \| VERIFIED-SOURCE] |
| Hosted build overshoots | In 0.2.2 the loop sleeps a full 20 s after each check and tests the deadline only on wake-up, so a 45 s wait can return near 60 s. 0.2.7 caps the sleep at the time left and stops within 1 s of the deadline (0.2.3 "keep waits inside host timeouts") | [src: mcp@0.2.2 vs mcp@0.2.7 dist/deploy.js waitForApp() diff; git log \| VERIFIED-SOURCE] |
| What "running" means | Location rows from `/apps/location/<name>` (6.1 step 12), not a health check. A copy can be located and still answer 503 (15.1.9) | [src: mcp@0.2.7 dist/deploy.js appLocations() \| VERIFIED-SOURCE] |

#### 15.1.12 Sessions

| Fact | Value | Source tag |
|---|---|---|
| MCP transport | None kept. Stateless Streamable HTTP in hosted mode (15.1.2); stdio in local mode | [src: mcp@0.2.7 dist/http.js \| VERIFIED-SOURCE] |
| FluxOS API session | Self-issued. The server creates a login phrase of the current time in milliseconds (13 digits) plus 32 random hex characters, signs it with the Flux ID key, and sends `{zelid, signature, loginPhrase}` JSON in the `zelidauth` header. FluxOS accepts a phrase it never issued if it starts with a 13 digit millisecond timestamp not older than 16 hours and not in the future, is 40 to 70 characters, and the signature is valid for that Flux ID. So one signed phrase works on every node, with no login call | [src: mcp@0.2.7 dist/keys.js createSession(); fluxos:ZelBack/src/services/verificationHelperUtils.js verifyUserSession() L107-L145 \| VERIFIED-SOURCE] |
| How long the server keeps one | One session per process, re-issued after 8 hours (`SESSION_TTL_MS`), well inside the node's 16 hour window. The README says "valid for a few hours" | [src: mcp@0.2.7 dist/keys.js currentSession() \| VERIFIED-SOURCE] |
| In hosted mode | The cache is per process, keyed by the key string, so a new session is made after a restart or on another instance. Nothing is stored | [src: mcp@0.2.7 dist/keys.js, dist/http.js \| VERIFIED-SOURCE] |
| What a session can do | The owner session is what lets `flux_get_app_logs`, `flux_get_app_stats`, `flux_control_app` and the registration POST reach node endpoints that require `appownerorfluxteam` or a logged user | [src: fluxos:appInspector.js, advancedWorkflows.js \| VERIFIED-SOURCE] |

#### 15.1.13 Resources, prompt and server instructions

| Fact | Value | Source tag |
|---|---|---|
| Resources (4, `text/markdown`) | `flux://guide/overview` ("Flux Cloud overview for agents"), `flux://guide/spec-format` ("Flux v8 app specification"), `flux://guide/pricing` ("Flux Cloud pricing"), `flux://guide/gotchas` ("Flux Cloud gotchas") | [src: hosted resources/list; mcp@0.2.7 dist/server.js guides \| VERIFIED-LIVE and VERIFIED-SOURCE] |
| Guide texts | The four texts served by the hosted server are the same as `dist/docs.js` in 0.2.7 (the file is identical in 0.2.2). Their wrong or stale claims are in 15.1.16 | [src: hosted resources/read vs mcp@0.2.7 dist/docs.js \| VERIFIED-LIVE and VERIFIED-SOURCE] |
| Prompt (1) | `deploy_on_flux` with one required argument `app` ("What to deploy, in plain words."). It returns one user message with five steps: identity, build and validate, quote and show the USD price and FLUX, "only after I agree" call `flux_deploy_app` with `confirm=true`, then `flux_wait_for_app` and give the URLs; if underfunded, say the address and the amount | [src: hosted prompts/get; mcp@0.2.7 dist/server.js deploy_on_flux \| VERIFIED-LIVE and VERIFIED-SOURCE] |
| Instructions, local | "Deploy and manage apps on Flux Cloud, the decentralized cloud. Read the flux://guide/overview resource first. All prices are Flux Cloud USD prices (converted to FLUX for payment). Always show the user the USD quote from flux_quote_app and get their agreement before calling flux_deploy_app with confirm=true, which spends FLUX." | [src: mcp@0.2.7 dist/server.js LOCAL_INSTRUCTIONS \| VERIFIED-SOURCE] |
| Instructions, hosted | The local text plus: "This is the hosted server: it stores no keys. Read-only tools need none. Tools that sign or pay take fluxIdPrivateKey and paymentPrivateKey as arguments, used only for that call. NEVER ask the user for the keys of a wallet they use elsewhere: call flux_generate_keys to create a dedicated pair, tell the user to fund the payment address with only the amount needed, and reuse that pair in later calls. Remind the user to save the keys." | [src: hosted initialize; mcp@0.2.7 dist/server.js HOSTED_INSTRUCTIONS \| VERIFIED-LIVE and VERIFIED-SOURCE] |

#### 15.1.14 Configuration

| Variable | Default | Purpose | Source tag |
|---|---|---|---|
| `FLUX_ID_PRIVATE_KEY` | none | WIF of the Flux ID (owner) | [src: mcp@0.2.7 dist/config.js loadConfig() \| VERIFIED-SOURCE] |
| `FLUX_PAYMENT_PRIVATE_KEY` | none | WIF of the paying address | same |
| `FLUX_API_URL` | `https://api.runonflux.io` | Load balanced FluxOS API for reads, quotes, validation | same |
| `FLUX_NODE_URL` | none (auto) | Pin one FluxOS node for registrations; used alone | same; [src: dist/deploy.js selectNodes() \| VERIFIED-SOURCE] |
| `FLUX_EXPLORER_URLS` | `https://explorer.runonflux.io,https://flux-explorer.sspwallet.io` | Comma separated Insight explorers for UTXOs, broadcast, tx lookup (README lists them without scheme) | [src: dist/config.js \| VERIFIED-SOURCE] |
| `FLUX_STATS_URL` | `https://stats.runonflux.io` | USD rate card (`/apps/getappspecsusdprice`) | same |
| `FLUX_RATES_URL` | `https://viprates.runonflux.io` | FLUX market rate (`/rates`: USD rate times FLUX in BTC) | [src: dist/config.js; dist/pricing.js fetchFluxUsdRate() \| VERIFIED-SOURCE] |
| `FLUX_REQUEST_TIMEOUT_MS` | `60000` | Default per request timeout; not in the README table | [src: dist/config.js \| VERIFIED-SOURCE] |
| `PORT` | `3000` | Listening port of `flux-cloud-mcp-http` | [src: dist/http.js \| VERIFIED-SOURCE] |

#### 15.1.15 Security notes

| Fact | Value | Source tag |
|---|---|---|
| Use a dedicated payment address | Fund only what you intend to spend. A deployment can spend the whole `max(quote, floor)` plus fee per call, and the cap on a single transaction fee is 0.01 FLUX. There is no per-call or per-day spending limit in the server | [src: mcp@0.2.7 dist/chain.js buildPayment(), dist/deploy.js \| VERIFIED-SOURCE] |
| No spending cap, no allow list | The server has no configuration for a maximum price, an allowed set of names or images, or an approval step. The user's protection is the host's tool-call approval and the funded balance | [src: mcp@0.2.7 dist/config.js, dist/server.js \| VERIFIED-SOURCE] |
| Prompt injection is a real route | A page, a README or a log that an agent reads can tell it to call `flux_deploy_app` with `confirm=true` or `flux_cancel_app`. Keep tool approvals on for those two and for `flux_control_app` | [src: mcp@0.2.7 dist/server.js tool set \| VERIFIED-SOURCE (the tools exist)]; the attack as such [src: this file \| UNVERIFIED (no incident observed)] |
| Hosted keys travel through the AI vendor | See 15.1.3. For larger budgets the docs recommend the local server | [src: docs:ai-agents-mcp \| DOCS-ONLY] |
| Public spec leaks | Environment variables and commands of a non-private app are public on chain; the server does not move secrets to private mode for you, it only warns about node-local data. The console does look for secret-like keys (15.2.5); the MCP server does not | [src: mcp@0.2.7 dist/spec.js durabilityWarnings() \| VERIFIED-SOURCE] |
| Apps are probed from the server's address | `flux_get_app` (0.2.7) makes TCP and HTTP requests to the app and its nodes from wherever the MCP server runs (your machine or the hosted server) | [src: mcp@0.2.7 dist/server.js reachability() \| VERIFIED-SOURCE] |

#### 15.1.16 Where the server's own guides and local estimator are wrong or stale

All five rows are in the text the hosted server serves today. Do not copy them.

| Statement in the server | What source and the live calculator show | Source tag |
|---|---|---|
| Pricing guide and `flux_get_pricing` "discounts": "primary/standby ("g:") storage 20 percent off" | No such discount. The live calculator returns identical prices for `r:/data`, `g:/data` and plain `/data` (USD 1.99 for 1 core, 1000 MB, 10 GB, 3 instances). The local estimator applies a 0.8 factor when any component contains `g:` | [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice 2026-10-13 \| VERIFIED-LIVE]; [src: mcp@0.2.7 dist/pricing.js estimateUsd(), dist/docs.js PRICING \| VERIFIED-SOURCE] |
| `flux_get_pricing` reference examples | They are local estimates ("local-estimate"). The estimator stops at the cent and does not apply the .49 or .99 rounding (4.3 step G, FluxOS PR #1818, 2026-09-25, after the package was published). Hand transcribed values for tiny, small, medium, large (3 instances, 1 month): 0.99, 1.78, 4.66, 10.80. Live quotes for the same four: 0.99, 1.99, 4.99, 10.99 | [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice 2026-10-13 \| VERIFIED-LIVE]; [src: mcp@0.2.7 dist/pricing.js estimateUsd() \| VERIFIED-SOURCE] |
| Overview guide: "One network month is 88000 blocks (about 30.5 days)" | 88,000 x 30 s = 30.56 days; this file uses 30.6 days (5.1) | [src: 5.1 \| VERIFIED-SOURCE] |
| Overview guide: "Persisted paths must be prefixed `r:` (replicated) to survive instance moves", and `flux_build_spec` makes every data path `r:` | `g:` and `s:` also replicate. `r:` runs every instance writing, which is wrong for a database (11, row 15; 7.2). Choose `g:` for single writer databases | [src: mcp@0.2.7 dist/spec.js buildSpecification() `replicate = c.replicateData ?? true`; 7.2 \| VERIFIED-SOURCE] |
| Overview guide: "Names: 1-63 chars, letters/digits/inner hyphens" and `flux_build_spec` names a single component after the app | That is the app name rule. Component names allow only letters and digits, so an app called `my-site` gives a component `my-site` that the node rejects ("component name contains special characters") although the local validator accepts it. `flux_validate_spec` and the `flux_deploy_app` plan catch it before anything is signed; set component `name` yourself | [src: fluxos:ZelBack/src/services/appRequirements/appValidator.js:L696-L712; mcp@0.2.7 dist/spec.js validateSpecification(), formatSpecification() \| VERIFIED-SOURCE] |
| README and docs example "$0.99 for 1 month, pay 19.24 FLUX" and "balance 50 FLUX ($2.57)" | Illustrative figures at an older FLUX price; the quote for the same app was 11.41 FLUX on 2026-10-13 at about 04:30 UTC. Never copy them | [src: POST https://api.runonflux.io/apps/calculatefiatandfluxprice 2026-10-13 \| VERIFIED-LIVE]; example [src: README.md, docs:ai-agents-mcp \| DOCS-ONLY] |
| README and pricing comment: price is "the same one home.runonflux.io charges" | `home.runonflux.io` is a 301 to `cloud.runonflux.com` (9.1). Say FluxCloud | [src: 9.1 \| VERIFIED-LIVE] |
| README: nodes need ">= 3 instances" never appears; default `instances` is 3 | Right to default 3, but a v8 app may have 1. The tool accepts 1 to 100 | [src: mcp@0.2.7 dist/spec.js; 3.2 \| VERIFIED-SOURCE] |

What the guides get right (checked): the rate card (cpu 0.15, ram 0.05, hdd 0.02, enterprise ports and scope 2 and 4, static IP 2, USD 0.99 minimum, FLUX multiplier 0.95), the 20 and 10 percent hardware discounts with the "fewer than 4 instances" condition, the 3, 6 and 12 percent term discounts, the worked 0.5 core, 500 MB, 5 GB example (0.37 per instance, 1.11, 0.89, floored to 0.99), ports 31000 to 39999 as the free pick, "Flux sets only the container Cmd, never Entrypoint" (matches 8.3), "the shared domain times out at 25 s" (matches 6.4), the one hour message life, and the banned port list (the package list equals `bannedPorts` returned by `/apps/deploymentinformation`).

#### 15.1.17 Differences from the Orbit MCP server (pointer only)

| Fact | Value | Source tag |
|---|---|---|
| Different server, different identity | The Flux Cloud MCP server has no account and uses a Flux ID key and a payment key. FACTS 9.8 records that the Orbit MCP server is reached by signing in to Orbit and generating a connection config with a short-lived credential. They are separate products; do not describe one with the other's rules. The Orbit MCP server is covered in 15.4 | [src: 9.8 "Agent access" row \| VERIFIED-LIVE (page FAQ)]; no Orbit code was read for this section [src: this file \| UNVERIFIED] |

#### 15.1.18 What could not be verified (Flux Cloud MCP server)

- Whether the deployed hosted instance logs or stores tool arguments, or has `FLUX_*` set in its environment. The claims "holds no keys" and "never logged or stored" are the vendor's.
- That `ghcr.io/runonflux/flux-cloud-mcp` exists and is current (`ghcr.io` returned 401 for the tag list without a token). The README's Docker Hub name does not exist.
- A real `flux_deploy_app confirm=true`, `flux_cancel_app confirm=true` or `flux_control_app` call: none was made (the rules forbid it). The cancel cost in 15.1.8 is derived from node source and the live calculator, not observed.
- Whether quoting an encrypted spec through the balancer always works (15.1.10).
- How the hosted server behaves under 0.2.7 features (not deployed).

### 15.2 The assistant and agents surface of the new FluxCloud console

Scope: the new FluxCloud console front end (the shipped bundle chunks `index-*.js`, `en-*.js`, `useAgentRun-*.js`, `AssistantPanel-*.js`, `agents-*.js`, `deploy-*.js`). Two different assistants live in it: the deploy agent in `useAgentRun-*.js` (it drafts specifications and reads your apps) and a documentation question panel in `AssistantPanel-*.js`. Strings quoted below are the English strings of the bundle.

#### 15.2.1 What the landing and deploy pages say the assistant does

| Fact | Value | Source tag |
|---|---|---|
| Headline | "Tell it what to run. It deploys it." and "Instant deploy, live in about 30 seconds. The assistant sizes it, prices it and deploys it across a decentralized, permissionless cloud. Censorship-resistant, load balanced for 100 % uptime, from $0.99 a month, paid from a balance you fund with crypto." | [src: console en-*.js `home.title1`, `home.title2`, `home.lede` \| DOCS-ONLY] |
| How it works | "The assistant turns a sentence into a full deployment spec: size, placement, backups, domain. You see the cost per day before anything happens. One signature with your key registers it and pays the first day from your balance. Live in about 30 seconds." | [src: console en-*.js `home.how.body` \| DOCS-ONLY] |
| Sample exchange on the landing page | User: "A Minecraft server for 20 friends in Europe, with nightly backups". Assistant: "Minecraft for 20 players fits 4 vCPU · 8 GB · 40 GB. I placed it on 3 servers in the EU behind a load balancer, with a nightly backup to Storage. $0.48 / day, about $14.40 / month. Want a custom domain?", then "yes, mc.example.com" and "Added mc.example.com with a managed certificate. The spec is ready." The figures are typed marketing copy, not computed. Do not reuse them | [src: console en-*.js `home.how.u1`, `home.how.a1`, `home.how.u2`, `home.how.a2` \| DOCS-ONLY] |
| "No sign-up" line | "No sign-up. You approve every step with your key. Nothing is deployed until you say so." | [src: console en-*.js `home.noSignup` \| DOCS-ONLY] |
| Deploy page lede | "Describe it or compose it. The network prices it, your key signs it, the network runs it." Steps shown: Compose, Sign, Pay, Live | [src: console en-*.js `deploy.lede`, `deploy.steps.*` \| DOCS-ONLY] |
| Price line | "The price comes from the network's own formula for these resources, instances and duration. Nothing is deployed until you sign." | [src: console en-*.js `deploy.priceNote` \| DOCS-ONLY] |
| The real flow after the assistant | Sign the specification with your wallet (registers it on the network), then pay: send the amount to the address with the hash as the message (SSP Wallet, Zelcore, or card through Stripe), "your deployment starts within minutes"; optional test install on a node; a 30 minute payment window; a watcher that reports no confirmation "after 30 minutes". This is the registration and payment of 6.1 and 6.6, not a debit from a balance | [src: console en-*.js `deploy.signBody`, `deploy.payBody`, `deploy.paySsp`, `deploy.payZelcore`, `deploy.payCard`, `deploy.paymentWindowValue`, `deploy.phase.timeout`, `deploy.testInstallHint` \| DOCS-ONLY]; the real flow [src: 6.1, 6.6 \| VERIFIED-SOURCE] |
| A stale note on the deploy form | The deploy form still shows a line that known workloads and Docker images become an editable draft and that "the full assistant arrives with the Flux LLM gateway", while the same chunk calls the gateway. Treat it as out of date copy; do not quote it | [src: console en-*.js `deploy.assistantNote`; console deploy-*.js (renders it next to the agent) \| VERIFIED-SOURCE] |

#### 15.2.2 What the deploy agent can do (the tool list it is given)

Sixteen tools, exactly these names, are sent to the model on every call and are the only ones the page will run (`He()` rejects any other name with "unknown tool").

| Group | Tools | What they do | Source tag |
|---|---|---|---|
| Navigation (3) | `ui_navigate`, `ui_open_app`, `ui_open_template` | Move the user to one of 26 fixed pages (`/`, `/deploy`, `/deploy/git`, `/templates`, `/templates/games`, `/templates/wordpress`, `/deployments`, `/apps`, `/account`, `/balance`, `/drive`, `/storage`, `/gpu`, `/agents`, `/network`, `/network/nodes`, `/node`, `/node/apps`, `/node/logs`, `/node/sessions`, `/node/share`, `/node/system`, `/governance`, `/compare`, `/cost-calculator`, `/help`), open one of the user's apps, or open a marketplace template by slug | [src: console useAgentRun-*.js `Ue` tool list, `z` page enum, `ot()` \| VERIFIED-SOURCE] |
| The only "proposal" tool (1) | `ui_prefill_deploy` | "Open the deploy page with the form filled in from this specification. The user reviews the quote and signs; you never deploy or pay." Takes `name`, `components`, `instances`, `months`, `contacts`, `geolocation`, `description` | [src: console useAgentRun-*.js `Ue`, `ot()` case `ui_prefill_deploy` \| VERIFIED-SOURCE] |
| Checks before a proposal (3) | `flux_validate_spec`, `flux_check_image`, `flux_quote_app` | Node verification of the spec, image tag and `linux/amd64` check through a node's registration verifier, and a network price (`agentpricequote` as a throwaway name) in USD and FLUX per term | [src: console useAgentRun-*.js `ot()` \| VERIFIED-SOURCE] |
| Reference reads (4) | `flux_get_template`, `flux_get_pricing`, `flux_get_network_info`, `flux_search_docs` | Exact marketplace template spec, rate card and FLUX/USD, node counts and height, and a documentation search (3 results, with the facts documents boosted) | [src: console useAgentRun-*.js `ot()`, `qe()`, `Qe()` \| VERIFIED-SOURCE] |
| Reads about your own apps (5), signed in only | `flux_list_my_apps`, `flux_get_app`, `flux_get_app_logs`, `flux_get_app_stats`, `flux_diagnose_app` | List with days left, public spec and running IPs, log lines (10 to 500, default 100), live CPU, memory and network, and a diagnosis (last restart and reason, peak memory against its limit, disk, last 30 log lines). Without a signed in owner each returns `{error: "not signed in"}`. The only check in `ot()` for `flux_get_app`, `flux_get_app_logs` and `flux_get_app_stats` is that a user is signed in; none compares the named app's owner with that user (`flux_get_app` reads the app's public specification, which anyone can read). Ownership of the logs is enforced by the node, not by the page (15.1.4); whether the stats and diagnosis calls are refused for another owner's app was not read | [src: console useAgentRun-*.js `ot()`, `q`, `nt()`, `tt()` \| VERIFIED-SOURCE] |
| Not available | Anything that deploys, pays, signs, cancels, updates, restarts, redeploys, removes, controls an app, generates keys or reads keys | There is no such tool in the list. The model has no `flux_deploy_app`, `flux_cancel_app`, `flux_control_app` or `flux_generate_keys`, and no way to call the network write endpoints | [src: console useAgentRun-*.js `Ve` \| VERIFIED-SOURCE] |

Differences from the Flux Cloud MCP server: 16 tools versus 15; 8 names are shared (`flux_validate_spec`, `flux_quote_app`, `flux_get_pricing`, `flux_get_network_info`, `flux_list_my_apps`, `flux_get_app`, `flux_get_app_logs`, `flux_get_app_stats`), some with different argument shapes (the console `flux_quote_app` takes `components`, `instances`, `months`; the MCP one takes a v8 `spec`); the console has no `flux_deploy_app`, `flux_cancel_app`, `flux_control_app`, `flux_build_spec`, `flux_wait_for_app`, `flux_generate_keys` or `flux_get_identity`. [src: console useAgentRun-*.js; mcp@0.2.7 dist/server.js \| VERIFIED-SOURCE]

#### 15.2.3 "You never deploy or pay": how the hand off works

| Fact | Value | Source tag |
|---|---|---|
| System prompt (verbatim) | "You are Flux AI, the assistant inside Flux Cloud. You help people run apps on the Flux decentralized cloud with the tools. Prices are USD per term. Get a quote with flux_quote_app and show it before you propose a deployment. You cannot deploy, sign or spend: hand the specification to the page with ui_prefill_deploy, and the user reviews it, signs it with their own key and pays for it there. The user is signed in: never ask for keys, wallets, seed phrases or addresses. Read every figure from a tool result rather than guessing it. Be brief." | [src: console useAgentRun-*.js `Ae` \| VERIFIED-SOURCE] |
| What `ui_prefill_deploy` does | The page sanitises the proposal (15.2.5), stores it as a `proposal` on the turn and shows a review card with "Proposed specification", the name, instances, term in months, total size and each component with its ports and environment. Buttons: "Review spec and deploy" (applies it to the deploy form), "Change size", "Show the JSON", "Discard". The tool result says `awaiting_user_review: true` and "It is not deployed." | [src: console useAgentRun-*.js `ot()`, `vt()`; en-*.js `deployAgent.reviewTitle`, `deployAgent.apply` \| VERIFIED-SOURCE] |
| What the card tells the user | "Nothing has been deployed. Apply it to the form, check it, then sign and pay there. The assistant cannot sign or spend." and, when the draft has environment variables: "The environment variables were written by the model. Check every one against the image before you sign." | [src: console en-*.js `deployAgent.reviewNote`, `deployAgent.envWarning` \| DOCS-ONLY] |
| The card, label by label (read 2026-10-13) | Title `Proposed specification`. Then four labelled fields in this order: `Name` (the app name), `Instances` (a number), `Term` (the term in months, printed "{{count}} month" for one and "{{count}} months" otherwise) and `Total` (printed as "<cpu> vCPU · <memory> · <hdd> GB", the same pattern the page uses for each component). Whether `Total` is the sum over components of one instance or is multiplied by the instance count is computed by a shared function that was not captured: UNVERIFIED | [src: console useAgentRun-*.js vt() (the card), $() (one label and value); console en-*.js `deployAgent.reviewTitle`, `deployAgent.name`, `deployAgent.instances`, `deployAgent.term`, `deployAgent.size`, `deployAgent.months_one`, `deployAgent.months_other` \| VERIFIED-SOURCE] |
| The card, order of its parts as rendered | 1. the title; 2. the four fields; 3. one box per component: its name, its image (`repotag`, or a dash when empty), its size on the right as "<cpu> vCPU · <memory> · <hdd> GB", its ports as "<public>→<container>" pairs, and its environment lines in a code block; 4. the environment warning, only when any component has environment text; 5. `Corrected before it reached the form` with one line per correction, only when there are corrections; 6. `Still to finish in the editor` with the remaining items, only when there are any; 7. the review note ("Nothing has been deployed. ..."); 8. four buttons in this order: `Review spec and deploy`, `Change size`, `Show the JSON`, `Discard`; 9. the JSON of the draft, only after `Show the JSON` is pressed. `Change size` does not edit anything: it sends the text "Change the size" to the assistant as a new message | [src: console useAgentRun-*.js vt(); console en-*.js `deployAgent.*` (`changeSizeAsk` is `Change the size`) \| VERIFIED-SOURCE] |
| The missing-tag correction | When a component's image string contains no colon, the page appends `:latest` and lists one correction with the key `tag`. The English text is `{{component}}: the image had no tag, so {{to}} was used.` The second placeholder is `{{to}}`, not an image placeholder, and it is filled with the whole new image string (for example the image with `:latest` added). Because the test is "contains a colon", an image whose registry host carries a port but no tag also counts as tagged and is not corrected | [src: console useAgentRun-*.js (the tag branch of the proposal sanitiser, `f.includes(":")`) and bt() (`case "tag"`); console en-*.js `deployAgent.fix.tag` \| VERIFIED-SOURCE] |
| The other correction lines, exact English | `Renamed “{{from}}” to “{{to}}”: an app name is 3–32 letters or digits.` / `No name was given, so “{{to}}” was generated.` / `Component “{{from}}” renamed to “{{to}}”.` / `{{component}}: dropped the unknown field “{{name}}”.` / `Dropped the unknown field “{{name}}”.` / `{{component}}: {{field}} {{from}} is outside the allowed range, so {{to}} was used.` / `{{component}}: dropped the port {{from}}.` / `Instances {{from}} became {{to}}.` / `Term {{from}} months became {{to}}.` / `Dropped the placement code “{{value}}”.` / `{{from}} components were proposed; the first 10 were kept.` / `{{component}}: the data path “{{value}}” is not valid, so the default was used.` / `Dropped the contact “{{value}}”: it is not an email address.` The environment line correction is `{{component}}: dropped the environment line “{{line}}”` followed by a dash and `it is not KEY=value.` (the bundle uses a long dash there, which this file does not reproduce) | [src: console en-*.js `deployAgent.fix.*` \| VERIFIED-SOURCE (strings)]; behaviour [src: 15.2.5 \| VERIFIED-SOURCE] |
| How the card prints memory | The card calls a shared formatter, imported from a chunk named `appModel-*.js`, on the component's memory value (stored in MB, as in a spec). That chunk was not captured, so the exact output (for example whether 1000 MB prints as "1000 MB", "1 GB" or "1 000 MB") is UNVERIFIED. The deploy form's "Per instance" line imports the same formatter. Strings that do show a format: the landing sample "4 vCPU · 8 GB · 40 GB" (typed copy, not computed) and the account page's "{{cpu}} vCPU · {{ram}} MB · {{hdd}} GB". A lesson should not quote the formatted memory text | [src: console useAgentRun-*.js and deploy-*.js imports of `appModel-*.js`; console en-*.js `n.how.a1`, `a.team.resources` \| VERIFIED-SOURCE for where it lives; UNVERIFIED for its output] |
| Review then sign | After "Review spec and deploy" the user is on the normal deploy form: quote, "Specification you are signing", sign with their wallet (or the SSO key service), pay, watch. The assistant is not involved in signing | [src: console deploy-*.js; en-*.js `deploy.review`, `deploy.signTitle` \| VERIFIED-SOURCE and DOCS-ONLY] |
| Side panel footer | "The assistant cannot sign or spend. Anything it proposes becomes a draft you approve with your key." | [src: console en-*.js `assistant.footer` \| DOCS-ONLY] |
| The agent runs in the browser | The loop, the tool execution and the reads all run in the page, with the signed in user's session toward nodes and the API. The model sits behind a gateway (15.2.4) and only sees what the page sends it as messages and tool results | [src: console useAgentRun-*.js `ct()`, `ot()` \| VERIFIED-SOURCE] |

#### 15.2.4 The loop, the budget and the gateway

| Fact | Value | Source tag |
|---|---|---|
| Rounds | At most 5 model calls per user message. On the 5th round (`e===4`), and in any round that starts more than 45 seconds after the message was sent (`Date.now()-o>45e3`), the model is called with NO tools, so it must answer in text. If a round calls `ui_prefill_deploy`, the loop returns after that round's tool results are applied | [src: console useAgentRun-*.js `ct()` \| VERIFIED-SOURCE] |
| Gateway | `POST https://llm.runonflux.com/v1/chat/completions`, streaming, body `{model: "fluxai:tiny", stream: true, messages, tools, tool_choice: "auto", user: <conversation id>}` with a `Bearer` client key embedded in the bundle (scoped, by its own payload, to an application name, a list of 4 allowed origins and the one model; the key is not reproduced here). A 429 shows "The assistant is busy just now. Try again in a minute."; any other failure shows "The assistant is unavailable." | [src: console useAgentRun-*.js `ke()`, `De`, `Ee` \| VERIFIED-SOURCE] |
| The gateway needs authentication | An unauthenticated `GET /v1/models` answers 401 with `WWW-Authenticate: Bearer`, from behind Flux's own domain gateway. The embedded key was not used | [src: https://llm.runonflux.com/v1/models 2026-10-13 \| VERIFIED-LIVE] |
| Model id | `fluxai:tiny` (UI: "powered by FluxAI, our own fine-tuned model") | [src: console useAgentRun-*.js `Ee`; en-*.js `deployAgent.privacyNote` \| VERIFIED-SOURCE and DOCS-ONLY] |
| Feedback | Thumbs up or down posts `{conversation, rating}` to `https://ownllmmetrics.app.runonflux.io/feedback` | [src: console useAgentRun-*.js `ht()` \| VERIFIED-SOURCE] |
| What the model sees | The system prompt, the user's messages, and every tool result as JSON. That includes app specs (public fields only), up to 500 raw log lines from `flux_get_app_logs`, and diagnosis output. Logs are not filtered (see 15.2.5). Everything is sent to the gateway | [src: console useAgentRun-*.js `ct()`, `ot()` \| VERIFIED-SOURCE] |
| Privacy note shown to the user | "Fully decentralized: runs entirely on Flux Cloud, powered by FluxAI, our own fine-tuned model. Conversations help us improve it, so never paste keys, seed phrases or passwords." So conversations are kept and used for training, per the UI | [src: console en-*.js `deployAgent.privacyNote` \| DOCS-ONLY] |
| Where the model runs | The "runs entirely on Flux Cloud" claim is a UI string. That the gateway sits behind Flux's domain gateway is seen in the `FDMSERVERID` cookie; which nodes serve the model is not visible | [src: console en-*.js; https://llm.runonflux.com response headers \| DOCS-ONLY and VERIFIED-LIVE] |
| A non-AI path exists | If the model returns nothing in the first round and the prompt looks like a deploy request, the page builds a draft itself from the prompt text. On the deploy form, a prompt that matches a known workload fills the editor at once and the assistant is asked as well; a prompt that is a git repository sends the user to `/deploy/git`. The keyword matcher lives in a shared chunk not read here | [src: console useAgentRun-*.js `ct()`; deploy-*.js form `onSubmit` \| VERIFIED-SOURCE]; matcher internals [src: this file \| UNVERIFIED] |
| What it says when it does not recognise a workload | "Not a workload I recognise yet. Enter a Docker image with a tag, or start from a template." (deploy page) and "That is not a workload I know yet, so the editor is empty. Enter a Docker image, or pick a template." (landing), and in the agent panel when it gives no answer: "I did not catch that one. Try naming what to run and roughly how big, for example "a WordPress site with 2 GB of memory" or "nginx:alpine on port 80"." | [src: console en-*.js `deploy.promptUnknown`, `home.promptUnknown`, `deployAgent.noAnswer` \| DOCS-ONLY] |
| Documentation search | `flux_search_docs` POSTs `{query, k: 3}` to a `/search` endpoint of a docs service and returns the top 3, boosting results from "facts" documents. Which host that is lives in a shared chunk not read | [src: console useAgentRun-*.js `Je()`, `Qe()` \| VERIFIED-SOURCE]; host [src: this file \| UNVERIFIED] |

#### 15.2.5 What the page filters, corrects and warns about

| Fact | Value | Source tag |
|---|---|---|
| Secrets filtered from what it reads | Only in `flux_diagnose_app`: environment lines of a component are dropped when they match `/KEY\|PASS\|TOKEN\|SECRET\|PRIV\|AUTH\|MNEMONIC\|SEED/i` anywhere in the line; the log tail is cut to the last 30 lines, ANSI codes stripped, 300 characters per line. `flux_get_app` returns image, ports and sizes, not environment. `flux_get_app_logs` returns lines raw, unfiltered | [src: console useAgentRun-*.js `tt()`, `ot()` case `flux_get_app_logs` \| VERIFIED-SOURCE] |
| Corrections before a proposal reaches the form | App name lowercased to letters and digits, 3 to 32 characters (hyphens are removed), prefixed `my` if it starts with `flux` or `zel`; component names the same, de-duplicated; missing image tag becomes `:latest`; cpu, ram, hdd clamped to the allowed range; environment lines that are not `KEY=value` dropped; unknown fields dropped; ports not integers 1 to 65535 dropped and public ports assigned; invalid `containerData` replaced by the default; `geolocation` codes must match `a!?c[A-Z]{2}(_...){0,2}`; contacts must look like email addresses; at most 10 components; instances clamped to at least a minimum and at most 100 (the code is `Math.min(100, Math.max(minimum, Math.round(requested)))` with the minimum computed by a function in a shared chunk, `client-*.js`, which was never captured, so the rule for that minimum is UNVERIFIED; the deploy form's minimum selects the hint "Synced volumes need at least 2 copies" when it is above 1, so it likely depends on synced volumes rather than on size, UNVERIFIED); months snapped to the nearest term the form offers. Each change is listed on the card under "Corrected before it reached the form" | [src: console useAgentRun-*.js `Re()`, `ze()`, `L()`; en-*.js `deployAgent.fix.*` \| VERIFIED-SOURCE] |
| Tag handling differs from the MCP server | The console adds `:latest` for an untagged image; the MCP server's local validator refuses an image without an explicit tag. FACTS 11 row 19 (`:latest` surprises) applies to the console path | [src: console useAgentRun-*.js `Re()`; mcp@0.2.7 dist/spec.js validateSpecification() \| VERIFIED-SOURCE] |
| Name rule is stricter than the network | 3 to 32 letters and digits. The network allows 1 to 63 with inner hyphens in v8 (3.8). A name an assistant shows is not the longest the network accepts | [src: console useAgentRun-*.js `L()`; 3.8 \| VERIFIED-SOURCE] |
| Public environment warning | The deploy form looks for secret-like keys: "Environment keys that look like secrets: ... Consider a private app", and switches the app to private when you continue ("Private app enabled: ... look like secrets"). Private apps "cost a little more" | [src: console en-*.js `deploy.secretsFound`, `deploy.public.*`, `deploy.privateAppHint` \| DOCS-ONLY] |
| Private registries | The form says "Public image with a tag. Private registries come with the next release." while the same form has a Private app switch and a `repoauth` hint (`user:password` for Docker Hub). The two lines disagree | [src: console en-*.js `deploy.imageHint`, `deploy.privateApp`, `deploy.repoauthHint` \| DOCS-ONLY] |
| Quote placeholder owner | Before sign in, quotes and validations are made with a fixed placeholder owner address; they are not tied to anyone | [src: console useAgentRun-*.js `ot()` \| VERIFIED-SOURCE] |

#### 15.2.6 The `/agents` page

| Fact | Value | Source tag |
|---|---|---|
| Title and lede | "Your agent gets the whole product, not a demo." "The Flux Cloud MCP server exposes quoting, deploying, paying, watching, logs, updates and cancelling to any MCP host. Prices are the same USD prices this app charges, converted to FLUX with the 5 % bonus." | [src: console en-*.js `agents.title`, `agents.lede` \| DOCS-ONLY] |
| Three points | "Two keys, no account": "A Flux ID owns the apps and signs; a payment address holds FLUX. The server can generate both. Or use an agent token from your account with a daily limit." "Quotes from the network": every price is the network's own formula, "including the $0.99 minimum and term discounts". "Plan first, spend on confirm": "Deploy and cancel run as a plan by default. Only an explicit confirm signs, broadcasts and pays." | [src: console en-*.js `agents.point.*` \| DOCS-ONLY]; the plan and confirm part is true to code (15.1.5) |
| Hosted card | "No install: point the MCP host at the hosted endpoint and sign in with a token." with the config `{"mcpServers": {"flux-cloud": {"url": "https://mcp.runonflux.com/mcp"}}}` | [src: console agents-*.js; en-*.js `agents.hostedBody` \| VERIFIED-SOURCE for the config, DOCS-ONLY for the sentence] |
| Claude Code and JSON cards | `claude mcp add flux-cloud -s user -e FLUX_ID_PRIVATE_KEY=<wif> -e FLUX_PAYMENT_PRIVATE_KEY=<wif> -- npx -y @runonflux/flux-cloud-mcp`, and the standard `mcpServers` JSON for Claude Desktop, Cursor, Windsurf and OpenCode ("Keys are optional; without them every read-only tool still works.") | [src: console agents-*.js \| VERIFIED-SOURCE] |
| Tool table | The 15 names with a one line meaning each; a "spends" pill on `flux_deploy_app` and `flux_cancel_app` only. `flux_control_app` is not flagged although it can delete data (15.1.4) | [src: console agents-*.js `a` array \| VERIFIED-SOURCE] |
| Links | GitHub `RunOnFlux/flux-cloud-mcp` and npm. The "Issue an agent token" button key (`agents.tokenCta`) exists in the strings but the button is compiled out of the page (`!1` in its place) | [src: console agents-*.js; en-*.js `agents.tokenCta` \| VERIFIED-SOURCE] |
| Landing section | "For AI agents. Your agent can deploy here too. The Flux Cloud MCP server gives Claude, Cursor, Windsurf or any MCP host the same product: quote in USD, deploy, pay, watch, update, cancel. No account. Two keys, or an API token with a daily limit." Button "Set up in 2 minutes", links "Docs · GitHub · npm". FAQ: "Can an AI agent deploy for me? Yes. The Flux Cloud MCP server exposes the same product to any agent. Give it an API token with a daily limit instead of a private key." | [src: console en-*.js `home.agents.*`, `home.faq.q5`, `home.faq.a5` \| DOCS-ONLY] |

#### 15.2.7 "An API token with a daily limit"

| Fact | Value | Source tag |
|---|---|---|
| Where it is said | Landing section, landing FAQ, `/agents` page point, and the sign in dialog ("Agents can do the same with an API token funded from your balance.") | [src: console en-*.js `home.agents.body`, `home.faq.a5`, `agents.point.keysBody`, `auth.b3` \| DOCS-ONLY] |
| What backs it | Nothing verifiable. No token issuing, no token argument, no daily limit exists in package 0.2.7 or in the hosted 0.2.2 tool schemas (only `fluxIdPrivateKey` and `paymentPrivateKey`); the console bundle has no code that creates or stores a token (no endpoint, no "daily" or "token" logic beyond the strings), and the "Issue an agent token" button is compiled out. A token "funded from your balance" also depends on a balance that does not exist yet (15.2.8) | [src: mcp@0.2.7 dist/server.js KeysShape; hosted tools/list; console agents-*.js, index-*.js \| VERIFIED-SOURCE and VERIFIED-LIVE (absence)]; the feature [src: this file \| UNVERIFIED] |
| Wording rule | State it as something the console says is planned or available elsewhere, never as how the MCP server works today. Today an agent uses two keys | [src: this file \| VERIFIED-SOURCE] |

#### 15.2.8 Balance, billing and "cost per day"

| Fact | Value | Source tag |
|---|---|---|
| The landing claims | A "balance you fund with crypto" that pays "the first day" of a deployment; "You see the cost per day before anything happens"; "$0.48 / day, about $14.40 / month"; alerts "at 7 days and a 3-day grace period before deployments stop"; "One prepaid balance in USD pays for every deployment, GPU hour and gigabyte. Nothing expires while it is funded."; top up with SSP Wallet, Zelcore or any wallet in FLUX "for 5 % more credit", or a card; "Auto top-up by card" adding $50; "Credits are prepaid and non-refundable". | [src: console en-*.js `home.how.body`, `home.faq.a3`, `balance.lede`, `balance.*`, `balance.autoTopUpNote`, `balance.rules` \| DOCS-ONLY] |
| What the page itself says today | The balance page (`balance.today.*`) says: "Each deployment is paid for on its own today: when you register it, and again when you extend it. There is no balance to top up yet." and "One prepaid balance for every deployment, GPU hour and gigabyte is on the way. This page will hold it." Its three steps: the price for the chosen term in USD and FLUX; pay in FLUX from SSP Wallet, Zelcore or any wallet with the memo shown, or by card; "An app runs until its term ends. Extend it from its page before then; nothing is charged automatically." | [src: console en-*.js `balance.today.*` \| DOCS-ONLY] |
| A balance for GPU rentals does exist | The same balance page (keys `i.lede`, `i.edgeTitle`, `i.edgeNote` in the bundle's string table) says: "One prepaid balance in USD pays for every deployment, GPU hour and gigabyte. Nothing expires while it is funded." and, under the heading "Flux Edge balance": "GPU rentals draw from this balance today. It merges into the one above with billing v1." So a prepaid balance is described as live for GPU rentals (Flux Edge) while deployments are paid one by one. Any academy sentence that says "there is no balance" must be scoped to app deployments (the network itself, 5.4, has no balance for apps). What the Flux Edge balance holds, and how it is funded, was not read | [src: console en.js and en-all.tsv `i.lede`, `i.edgeTitle`, `i.edgeNote` \| DOCS-ONLY] |
| How to treat it | The balance that would pay for app deployments, the per-day figure, the 7 day alert, the 3 day grace period and auto top-up are UI claims that are not backed by anything verifiable and that the console's own balance page says are not live for deployments. The network has no balance for apps: an app is prepaid for `expire` blocks and at the end of the term it and its data are removed within minutes to hours with no grace (5.4). The only grace in the system is a UI promise. Do not teach a deployment balance, a daily rate or a grace period; the separate Flux Edge balance for GPU rentals is in the row above | [src: console en-*.js; 5.4, 11 row 25 \| DOCS-ONLY and VERIFIED-SOURCE] |
| Deploy form line | "Prepaid. Extend any time from the deployment page." (term field hint) | [src: console en-*.js `deploy.monthsHint` \| DOCS-ONLY] |
| "Live in about 30 seconds" | A marketing figure. 6.6 records "a few minutes after the payment lands" on the page itself (`deploy.deploymentTimeValue`), the older FluxCloud "up to 45 min", and about 2 h for a slow copy (6.1). Block time alone is 30 s and a payment needs a confirmation | [src: console en-*.js `home.lede`, `deploy.deploymentTimeValue`; 6.1, 6.6 \| DOCS-ONLY and VERIFIED-SOURCE] |
| Cancel in the console | "End this app? The term is shortened to about an hour, instances stop, and nothing is refunded." The page signs an update with `expire` 100 blocks (about 50 minutes), while the MCP tool uses 120 blocks (one hour). Both are inside the 1 block minimum | [src: console en-*.js `deployments.cancelConfirm`, `deploy.cancelLede`; console deploy-*.js `gn()` \| DOCS-ONLY and VERIFIED-SOURCE] |
| Console update keeps the term | When you change an app the form computes `expire` from the blocks left plus any months you add, capped at the 12 month maximum. The MCP server does not (15.1.8) | [src: console deploy-*.js `gn()` \| VERIFIED-SOURCE] |

#### 15.2.9 The documentation question panel and the "Ask FluxAI" widget

| Fact | Value | Source tag |
|---|---|---|
| Side panel | `AssistantPanel-*.js`: "Flux assistant", "on Flux AI"; intro "Ask anything about deploying on Flux. Answers come from the documentation and the live network, with sources. When you describe something to run, you can open it in the deploy editor." Four suggested questions (cost, deploying a Docker image with a custom domain, resource limits per tier, updating an app). Numbered sources with links. If the question matches `deploy`, `run`, `host`, `server`, `spin up`, `set up` or `launch`, an "Open in deploy editor" button hands the question to the deploy form | [src: console AssistantPanel-*.js; en-*.js `assistant.*` \| VERIFIED-SOURCE and DOCS-ONLY] |
| What drives it | Its store and transport are in a chunk not captured. Which tools it has, if any, and which host answers are UNVERIFIED | [src: this file \| UNVERIFIED] |
| The "Ask FluxAI" button of the Vue front end at `cloud.runonflux.com` | A different thing: an embedded widget script loaded from `https://ownllmrouter.app.runonflux.io/widget.js` with title "Ask Flux AI", subject "Flux" and four suggested questions; it answers questions, it does not draft or deploy. The "AI Agents" popover on the same page links to the MCP docs, the GitHub repository and the hosted URL | [src: https://cloud.runonflux.com assets `FluxAIToggler-*.js`, `AgentMcpToggler-*.js` 2026-10-13 \| VERIFIED-LIVE] |

#### 15.2.10 Sign in options

| Fact | Value | Source tag |
|---|---|---|
| Headline | "Your key is your account." "Sign in with a wallet you control and nothing is stored about you but a public address. Or use email if you would rather Flux hold the key for you." | [src: console en-*.js `auth.headline`, `auth.lede` \| DOCS-ONLY] |
| Key options | SSP Wallet ("Two-of-two: browser extension plus your phone. Recommended."), Zelcore ("Approve the sign-in request in the Zelcore app."), MetaMask or any Ethereum wallet ("Sign a message with your EVM key."), WalletConnect (scan a QR code), and "Sign manually": sign the login phrase in any wallet and paste address and signature, accepting a Flux ID or a `0x` address | [src: console en-*.js `auth.*` \| DOCS-ONLY] |
| Email, Google, Apple | "Email, Google and Apple accounts get a key that Flux holds for you. You can attach a wallet later and keep the same balance." So these accounts are custodial: Flux holds the signing key. Matches the SSO signing service in 9.2 | [src: console en-*.js `auth.custodialNote`, `auth.orCustodial`; 9.2 \| DOCS-ONLY and VERIFIED-SOURCE] |
| EVM owners and the MCP server | An app owned through an EVM or SSO identity cannot be operated by the Flux Cloud MCP server (it signs only with a Flux ID WIF, 15.1.3) | [src: mcp@0.2.7 dist/spec.js; dist/keys.js \| VERIFIED-SOURCE] |
| "You approve every step with your key" | True for deploy and pay when the user signs; for custodial accounts the "approval" is a click that Flux's service signs for you | [src: 9.2 note on SSO signing \| VERIFIED-SOURCE] |

#### 15.2.11 What could not be verified (console)

- The bundle read is the build served 2026-10-12 10:58 GMT; strings and chunk names change with each build. The Vue "flux-gravity" front end at `cloud.runonflux.com` (9.1) is a different code base with its own "Ask FluxAI" and "AI Agents" buttons. Statements in 15.2 describe the new console front end only.
- The docs search service host, the side panel's tool set, the keyword matcher for known workloads, the price probe (`agentpricequote`), and the shared client chunk were not captured or not read.
- No sign in was made, so no logged in behaviour (the read tools, "your apps") was run. All of it is read from code.
- Whether the gateway retains conversations (UI says yes), how long, or on which nodes the model runs.
- All "balance", "grace", "token", "backups" and "managed certificate" claims (15.2.6, 15.2.8).

#### 15.2.12 Contradictions with the rest of FACTS.md (for 15.1 and 15.2)

| # | Existing text | What the new sources say | Which wins and why |
|---|---|---|---|
| 1 | 4.5 "Cancellation: a 1 block `expire` update ... is how the UI cancels" | The new console signs `expire` 100 blocks and the MCP server `expire` 120 blocks; both text strings say "about an hour". The old FluxCloud UI is not the only canceller. | The new rows win for the new console and the MCP server (code read). 4.5 stays true for the Vue front end at `cloud.runonflux.com`. |
| 2 | 9.12 "Pricing: same USD price as the UI" (DOCS-ONLY) | True for quotes and payments (the server uses the network calculator). Not true for `flux_get_pricing` examples and for the pricing guide: they predate the .49/.99 rounding and state a g: 20 percent discount. | Network calculator wins (live). The server's own estimator and guide are stale. |
| 3 | 3.8 "v8 allows inner hyphens" (app names) and 3.x component names | The package guide says names "letters/digits/inner hyphens" without separating component names; the console strips hyphens and limits to 32. | 3.8 and appValidator.js win: app 1 to 63 with inner hyphens, component letters and digits only. |
| 4 | 11 row 15 (`r:` on a multi writer database corrupts) | `flux_build_spec` defaults to `r:` and the guide says to prefix `r:`. | 11 row 15 and 7.2 win. The tool default is wrong for databases. |
| 5 | 9.12 "Hosted endpoint ... also .io per docs" | `.io` answers with the same server (initialize and health) | New row 15.1.1 wins (now VERIFIED-LIVE). |
| 6 | 9.12 "Identity ... no account" (DOCS-ONLY) | Confirmed by code; additionally owner must be a `1...` Flux ID. | 15.1.3 extends. No conflict. |
| 7 | 4.7 "a payment between the on-chain price and the FluxCloud quote is accepted by node code" | The package never pays under the quote; its guard is a floor that matches the node's check. | No conflict. 4.7 describes the node, 15.1.7 the client. |
| 8 | 1.2 FluxAI row says "FluxAI ... Not a hosting pillar for deployers" | The new console's deploy assistant is a FluxAI model behind `llm.runonflux.com` used to draft deployments. | 1.2 still true that FluxAI is not hosting; add that the console uses it as an authoring aid. |
| 9 | Landing page: "pays the first day from your balance", "3-day grace period", "100 % uptime" | 5.4 (no grace, removal at the expiry block), 6.5 (1 instance apps visibly fragile, no uptime guarantee), 4.5 (apps are prepaid per term). The balance page itself says there is no balance yet. | FACTS 4, 5, 6 win. These are UI claims only. |

#### 15.2.13 Things a lesson must not say (for 15.1 and 15.2)

1. Do not say the assistant or an agent "deploys for you". The console assistant cannot deploy, sign or pay; it hands a draft to the deploy form and the user signs and pays. The MCP server can sign and pay only when the agent sets `confirm=true` with the keys it was given.
2. Do not say `confirm` asks the human. It is a boolean the agent sets. The human check is the host's tool approval and the agent following the instructions.
3. Do not say only two tools can cost you something. `flux_control_app` can wipe data with `hard=true` or `remove`, and `flux_cancel_app` ends the app, with nothing refunded.
4. Do not teach the hosted server as keyless or "private". Its keys are call arguments and travel through the AI vendor and the chat history. Local stdio mode is the one where keys stay in the process. Do not say hosted "stores nothing" as a verified fact; that is the vendor's statement.
5. Do not say the hosted server runs the same code as npm 0.2.7. At the time of writing it reports 0.2.2 (2026-10-13).
6. Do not give a price, FLUX amount or term from the README, the docs page, `flux_get_pricing` examples or the landing sample ("19.24 FLUX", "$0.48 / day"). Use `shared/flux` and label it a quote at the time of writing.
7. Do not teach a g: discount, a balance that pays for app deployments, a daily rate, a grace period or an "API token with a daily limit". None is backed by code or the live network (15.1.16, 15.2.7, 15.2.8). The console does describe a separate Flux Edge balance that GPU rentals draw from (15.2.8), so scope every sentence about a balance to app deployments.
8. Do not say "live in about 30 seconds". Say the payment needs a confirmation, then nodes install; a few minutes is typical for a fast node, up to 45 minutes is the old UI's figure, and a copy can take about two hours (6.1, 6.6).
9. Do not say an update keeps the remaining term. With the MCP server it replaces `expire`; set `expire` to the blocks left plus any extension, and pass `previousHash` to `flux_wait_for_app`.
10. Do not say Ethereum or email accounts can be driven by the MCP server. It needs a Flux ID key.
11. Do not say the assistant filters secrets from everything it reads. Only environment lines in its diagnosis are filtered; logs go to the model raw.
12. Do not attach a release-stage label to the console front end, do not link any host other than the public ones listed in the brief, and do not describe the embedded client key.
13. Do not say "burns FLUX". Underpaid FLUX goes to the deployment address and is not refunded.

### 15.3 Orbit and Deploy with Git

Read 2026-10-13 between 04:25 and 04:35 UTC. Orbit is the Git-based deployment product from Flux. This section EXTENDS section 9.8 (which holds the first read of the product page and the Docker-image docs) and settles its open questions. A table at the end of 15.3 lists every earlier row that this section confirms, tightens or corrects.

Sources used, in order of strength: the live Global app specification list (`GET https://api.runonflux.io/apps/globalappsspecifications`, 2,083 apps at height 3,032,438; 2,082 at a later fetch, see 15.3.17) and `GET /apps/locations` (8,784 rows, 2,008 app names; 8,785 at a later fetch); the signed network policy bundle (`policy-signed.json`, seq 5, issued 2026-10-04T09:12Z); the live product page `https://runonflux.com/apps/orbit` (footer `v1.1.101`), its guide pages `/apps/orbit/mcp-server` and `/apps/orbit/deploy-to-flux`; `https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-git/...` (introduction, quick start, environment reference, GitHub webhooks, webhook API, deployment hooks, troubleshooting, Node.js guide); and the bundle of the new FluxCloud console front end (chunks `git-*.js`, `deploy-*.js`, `en-*.js`). Marketing numbers on the product page are DOCS-ONLY and are not network facts: the academy quotes node counts from the API.

#### 15.3.1 What Orbit is and where it runs

| Fact | Value | Source tag |
|---|---|---|
| What it is | A service that takes a Git repository, builds it, and registers it as an ordinary Flux app. Tagline: "Deploy from Git. Live in minutes." The same product is called "Deploy with Git" in the docs and in the FluxCloud "How would you like to deploy?" card | [src: https://runonflux.com/apps/orbit; docs deploy-with-git/introduction \| DOCS-ONLY] |
| It is an ordinary Flux app on the network | Every Orbit app that is visible in the Global app specifications is a plain version 8 spec with ONE component whose image is `runonflux/orbit:latest`. 235 of 2,083 specs on 2026-10-13: all v8, all one component, all with an empty `enterprise` field, `staticip` false, `nodes` empty. There is no special Orbit object type in the protocol | [src: GET /apps/globalappsspecifications 2026-10-13 04:28Z, filtered on component `repotag` starting `runonflux/orbit` \| VERIFIED-LIVE] |
| Answer to 9.8 open question "is the managed product still the Docker-image flow" | Yes, at the registration level: the product's apps are registered with the same image and the same environment variable names the docs describe for the Docker-image flow (`GIT_REPO_URL`, `APP_PORT`, `GIT_BRANCH`, `POLLING_INTERVAL`, `BUILD_COMMAND`, `RUN_COMMAND`, `PROJECT_PATH`) plus runtime hints `ORBIT_RUNTIME` and `ORBIT_RUNTIME_VERSION`. The build runs inside that container on the node, not on an Orbit build farm that pushes a finished image: no spec references a per-app image tag. Whether Nixpacks does the detection inside the image, as the product page says, is not visible from a spec | [src: same call; environment names counted over the 235 specs \| VERIFIED-LIVE for the registration shape; UNVERIFIED for what runs inside the image] |
| How an Orbit app is recognised in the explorer | Image `runonflux/orbit:latest`; component name `cloudgit` (232 of 235; the other three use the app's own name); component description equal to the component name (235 of 235; only 232 equal the literal `cloudgit`, and in the other three the component name, the description and the app name are all the app's own name, for example `devtoolkit`); app description starting `Orbit deployment` (176) or equal to the app name (58); `containerData` `/app` (233); two public ports, with `9001` as the last container port (234 of 235); an empty `domains` entry per port | [src: same call \| VERIFIED-LIVE]. The name `cloudgit` as the marker of the managed product is an inference (UNVERIFIED): it fits 232 of 235 and every `Orbit deployment` description |
| Private-repository apps are not visible | The page says private repositories and secrets are deployed encrypted. Encrypted v8 specs show an `enterprise` blob and an empty `compose`. 1,123 v8 specs are encrypted at the time of reading, and nothing in them says which are Orbit's | [src: same call; product page pricing footnote \| VERIFIED-LIVE and DOCS-ONLY] |
| Orbit's own site is a Flux app | App `orbit` (v8, 3 instances, one component, image `runonflux/website-orbit:latest`, domain `orbit.runonflux.com`). Another copy of the old Orbit page is still served at `https://orbit.app.runonflux.io` (HTTP 200, Express, `last-modified` 2026-09-11) and shows an older price copy ("Free forever tier", custom domains on paid plans only). `https://orbit.runonflux.com` answers `301` to `https://runonflux.com/apps/orbit` | [src: global specs; curl -I https://orbit.runonflux.com and https://orbit.app.runonflux.io 2026-10-13 \| VERIFIED-LIVE] |
| Who owns an Orbit app on chain | Almost every app has its own Flux ID: 232 distinct `owner` values over 235 apps. The owner is not one shared Orbit ID. The MCP guide says the user's Flux identity is derived through FluxCore from the Firebase account and requests are signed through Firebase SSO | [src: global specs; docs mcp-server 'Authentication, ownership, and data storage' \| VERIFIED-LIVE for the owner spread; DOCS-ONLY for the derivation] |
| Answer to 9.16 open question "does Orbit involve a user-signed spec" | The spec that reaches the chain is signed by the owner's Flux ID like any other (the network accepts nothing else). The learner is not asked to sign in a wallet: sign-in is Google, email, or the wallet portals, and the signing step happens on Orbit's side. Who holds the private key behind the derived Flux ID (the user, FluxCore, or a custodian) is not stated anywhere read. Lessons say "Orbit signs the registration for you after you sign in"; they do not say the user "holds" or "does not hold" the key | [src: global specs owner spread; docs mcp-server; product page \| DOCS-ONLY and UNVERIFIED for custody] |
| Contacts | Specs carry `contacts` as one entry `F_S_CONTACTS=<storage.runonflux.io URL>`: the contact data is stored off-chain in Flux storage, one record per app (a form not covered elsewhere in this file. Re-checked 2026-10-13: 674 of the 2,083 specs on the chain carry a `F_S_CONTACTS=` entry, so it is a general form and not an Orbit marker) | [src: global specs \| VERIFIED-LIVE] |

#### 15.3.2 What a managed app looks like on chain (settles "what a managed app looks like in the global specs")

Counted over the 235 specs on 2026-10-13.

| Item | Observed | Source tag |
|---|---|---|
| Registered | First `Orbit deployment` spec at height 2,734,416 (about 2026-07-01 at 30 s blocks); newest at height 3,031,252 | [src: same call; block arithmetic from tip 3,032,438 \| VERIFIED-LIVE] |
| Instances | 1 instance: 229; 2: 5; 3: 1 | same |
| Size tuples (cpu, ram MB, hdd GB, instances) | `(0.5, 1000, 5, 1)` 214; `(1, 2000, 10, 1)` 12; `(1.5, 4000, 15, 2)` 3; `(1.5, 6000, 15, 2)` 1; `(2, 6000, 20, 2)` 1; three one-off `1100` MB sizes; `(0.5, 1000, 5, 3)` 1. The three plan sizes on the product page are therefore exactly the live tuples, and the page's GB are decimal thousands of MB | same |
| The `(1, 2000, 10, 1)` size | 12 apps match no plan on today's page. Possibly the closed Free plan or an earlier plan shape: UNVERIFIED | same |
| Ports | Two public ports per app in 232 apps (the app and the webhook port) and three in 3 apps. Container ports: the app's own port first (3000 in 100, 2053 in 77, 8080/8000/5000 in 7 each, 80 in 6), then `9001` | same |
| Storage | `containerData` is `/app` in 233; `g:/app\|m:data:/data` in 1 (a Standard-size app, 2 instances); `r:/app` in 1 (a 3-instance app). So "persistent folders" shows up as a `g:` or `r:` mount, in the rare apps that use them | same |
| Term (`expire`) | 182 specs have `expire` between 108,000 and 108,200 (88,000 for a month plus 20,160 for 7 days is 108,160; the spread is the blocks that have already passed since the registration message); 24 have 1,056,000 (12 months); 4 have exactly 88,000 | same. The reading "a month plus the free week" is an inference, UNVERIFIED |
| Polling | `POLLING_INTERVAL` in 131 specs: 86400 (113), 300 (8), 1800 (3), 3600 (3), 7200 (1), 60 (1), 16400 (1), 21600 (1). The managed default looks like a daily poll, with the webhook for speed | same |
| Geolocation | 98 of 235 specs pin a region (for example `acEU_DE`); the rest are empty (anywhere) | same |
| Source host | `github.com` 243, `gitlab.com` 1 | same |
| Secrets visible in plain specs | Plain specs carry env values in the clear. 3 name `GIT_TOKEN`; others name `ADMIN_TOKEN`, `*_API_KEY`, bot tokens. Do not show values in a lesson | same |
| Commands | `commands` is empty in 234; one spec uses it for a build chain | same |

#### 15.3.3 A correction to Read-first item 15 (single-instance apps with no running copy)

| Fact | Value | Source tag |
|---|---|---|
| What it said | "22% of live 1-instance apps currently have no running copy" | FACTS Read-first 15 |
| What the data shows on 2026-10-13 | 78 of 351 single-instance apps have no running location. All 78 are Orbit deployments of the Starter size `(0.5, 1000, 5, 1)`. Of the other 122 single-instance apps, 0 lack a running copy. Of the 151 Orbit single-instance apps that do run, none is in the 78 | [src: global specs and /apps/locations 2026-10-13 \| VERIFIED-LIVE] |
| Why they do not run | All 78 were registered between heights 3,005,707 and 3,007,124 (about 2026-10-03 22:00Z to 2026-10-04 09:30Z), each with a different owner. All 78 owners are on the network's signed blocklist (`kind: owner`, `added 2026-09-30`, policy seq 5). The reason text for these entries reads "Owner of the Orbit deployment <name>, registered en masse and run on the network for free". 149 blocklist entries in total carry that wording. The entries are dated before these registrations, so the apps were refused from the start; the chain accepts a registration from any owner, and it is the nodes that decline to run it (FACTS 6, the list of reasons a node refuses an app). The reason text also says each entry replaces an earlier per-app `hash` entry of 2026-09-11 | [src: https://raw.githubusercontent.com/RunOnFlux/fluxos-network-policy/signed/policy-signed.json, `documents.blocklist`; global specs; /apps/locations \| VERIFIED-LIVE] |
| What it does not show | That the free plan was closed because of this is plausible and UNVERIFIED: the product page only says the old Free plan "is closed to new apps". The cause of the mass registration (a script, a promotion, a template) is not in any source read | [UNVERIFIED] |
| Lesson consequence | "Listed on chain" is not "running": use `/apps/locations`. A genuine single-instance app on a healthy owner is installed (122 of 122 single-instance non-Orbit apps have a copy). The explorer lesson can use this as a worked example of the blocklist (FACTS 6, the list of reasons a node refuses an app) without naming any owner | |

#### 15.3.4 The build pipeline as documented

| Stage | What the docs and the page say | Source tag |
|---|---|---|
| Clone | The app clones `GIT_REPO_URL` at `GIT_BRANCH` (default `main`) under `/app` (the troubleshooting page shows sources in `/app/src`). A private repo needs `GIT_TOKEN` | [src: docs environment-reference; quick-start \| DOCS-ONLY] |
| Detect | By files: `package.json` plus a lock file for Node.js; `.nvmrc`; `requirements.txt` or `pyproject.toml` for Python; `Gemfile`; `go.mod`; `Cargo.toml`; `pom.xml` or `build.gradle`; `global.json` or `.csproj`; `composer.json`; Bun files. Runtimes named: Node.js, Python, Ruby, Go, Rust, PHP, .NET, Java, Bun. The product page adds Elixir, Erlang and Dart and says "Nixpacks" does the detection; the docs never mention Nixpacks | [src: docs introduction, Node.js guide; product page 'How it works' \| DOCS-ONLY]. The two descriptions have not been reconciled: UNVERIFIED |
| Runtime version | Env var, then version file (`.nvmrc`, `.python-version`, `go.mod`, `rust-toolchain.toml` ...), then a documented fallback (Node LTS, Python 3.11, Ruby 3.0, Go 1.22.0, Java 17, .NET 8.0, PHP 8.2, Rust stable, Bun latest) | [src: docs environment-reference \| DOCS-ONLY] |
| Install | Package manager chosen from the lock file (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`); skipped when lock files are unchanged (30 to 180 s saved, per the docs) | [src: docs Node.js guide, environment-reference \| DOCS-ONLY] |
| Pre-deploy hook | `pre-deploy.sh` runs after install, before build and start (the hooks page: "After dependencies install, before build"; its sequence lists the hook before the build step). CONTRADICTION: the environment reference says "pre-deploy.sh - Runs after build, before app starts (e.g., migrations)". The lessons follow the hooks page ("after the install"); which page is right is UNVERIFIED, so say "before the app starts" when the order against the build matters little. The hooks page's sequence also labels the health-check step "(60s)", which does not match the environment reference's retries times delay (3 times 10 s by default); see the Health check row | [src: docs deployment-hooks; docs environment-reference (Deployment Hooks section) \| DOCS-ONLY] |
| Build | Detected command (for Node.js, the `build` script) or `BUILD_COMMAND` | same |
| Start | `start` script, main file or `RUN_COMMAND`; the app must listen on `APP_PORT` | same |
| Health check | HTTP GET `/` on `APP_PORT` expecting 2xx or 3xx, 3 tries 10 s apart; or `.flux-pod/health-check`. The hook page says 60 s | [src: docs environment-reference, deployment-hooks \| DOCS-ONLY]; the two figures differ and are not reconciled From the environment reference's "Health Check Behavior": a custom script `.flux-pod/health-check` runs if it exists and is executable; otherwise the check requests `http://localhost:${APP_PORT}/` for a 2xx or 3xx, tries `HEALTH_CHECK_RETRIES` times with `HEALTH_CHECK_DELAY` seconds between attempts, and rolls the deployment back if all fail. The hooks page's sequence labels the step "Health check (60s)"; the two figures are not reconciled. The inference that a server bound to 127.0.0.1 can pass this check while the public address fails is UNVERIFIED. [src: docs environment-reference; docs deployment-hooks \| DOCS-ONLY] |
| Post-deploy hook | `post-deploy.sh` after a healthy start; failure only logged | [src: docs deployment-hooks \| DOCS-ONLY] |
| Release layout | Last 3 releases kept under `/app/production/releases/`, a `current` symlink; build log per release | [src: docs troubleshooting, webhook-api \| DOCS-ONLY] |
| Timeout | Whole deployment limited by `DEPLOYMENT_TIMEOUT`, default 1800 s, 300 to 7200 s | [src: docs environment-reference \| DOCS-ONLY] |
| Port to the world | The app's public address is `<name>.app.runonflux.io`; the webhook port 9001 is a second public port | [src: docs quick-start; FACTS 8 for the address forms \| DOCS-ONLY] |
| Number of nodes | Docs say "Running on 3+ nodes for high availability"; the console's Git page says "deployed to three or more nodes from $0.99 a month"; the product page says Starter runs on 1 instance, Standard and Pro on 2, Custom 1 to 3. Live specs: 229 of 235 run on 1 | [src: docs introduction; chunk git-*.js / en-*.js; product page; global specs \| DOCS-ONLY and VERIFIED-LIVE]. The live specs and the product page agree; the docs and the console copy are older |

#### 15.3.5 Triggers: webhooks, polling, branches, previews

| Fact | Value | Source tag |
|---|---|---|
| Webhook | Provider calls `POST /webhook` on the app's webhook port (9001). Payloads for GitHub push and release events, GitLab push, Bitbucket push. Secret: GitHub HMAC-SHA256 in `X-Hub-Signature-256` (listed as "optional, for verification"); GitLab token in `X-Gitlab-Token`. Signature checking is off by default (`WEBHOOK_SIGNATURE_VERIFY` false, 15.3.6.1). Response `{"status":"success","message":"Deployment queued","delivery_id":...}`; 400 body `{"status":"error","message":"Invalid payload"}`; 401 (verification fails) body `{"status":"error","message":"Webhook signature verification failed"}` | [src: docs webhook-api, github-webhooks \| DOCS-ONLY] |
| Queue | One pending slot; pushes within 5 s debounce; newest commit wins; deployments never run concurrently; 10 requests per minute per IP, then 429 | [src: docs webhook-api \| DOCS-ONLY] |
| Polling | `POLLING_INTERVAL` 60 to 86400 s, 0 disabled. The product page: "A polling mode is also available if you cannot install a webhook" | [src: docs environment-reference; product page FAQ \| DOCS-ONLY] |
| Both | "Webhooks + polling backup" is a documented option | [src: docs introduction \| DOCS-ONLY] |
| Status API | `GET /status` (state, stage, `progress_percent`, releases), `GET /health`, `GET /logs/:id` (text or JSON, `tail`), optional `API_KEY` | [src: docs webhook-api \| DOCS-ONLY] |
| `/status` JSON | Idle: `status` (`idle` or `deploying`), `current_release`, `last_deployment` {`commit`, `commit_full`, `updated_at`, `build_duration_seconds`, `build_status`}, `releases` (id, commit, commit_message, build_duration_seconds, deployed_at). After a failure also `last_failed_deployment` {`commit`, `commit_full`, `failed_at`, `reason`, example `build_failed`} and `failed_commits_count`. While deploying: `status` `deploying`, `stage`, `commit`, `commit_full`, `rollback_commit`, `started_at`, `duration_seconds`, `timeout_seconds` (example 1800), `progress_percent`. Examples on the page are illustrative values | [src: docs Webhook API page, GET /status \| DOCS-ONLY] |
| `/health` JSON | `healthy` (true or false), `app_status` (`running` or `not_responding`), `app_port`, `supervisor_status` (`RUNNING` or `STOPPED`), `deployment_in_progress`, `deployment_stage` (`none` during idle, for example `building` during a deploy). The page calls it always public; the environment reference disagrees (15.3.6.1) | [src: docs Webhook API page, GET /health \| DOCS-ONLY] |
| Stages | `starting`, `git_pull`, `installing_dependencies`, `stopping_app`, `building`, `starting_app`, `health_check`, `completed` | same |
| One branch per app | Staging and production are two apps with different `GIT_BRANCH` | [src: docs github-webhooks \| DOCS-ONLY] |
| Previews | Product page: "Automatic preview deployments for branches and pull requests" and "Pull requests and branches can generate preview deployments". Docs: "Deploy with Git supports automatic preview deployments for pull requests on static sites"; "PR preview deployments are only supported for static sites" (Node.js servers and Python apps are not); limitations "Previews share the same domain (subpath routing)", "No custom domain support for previews", base path `/flux-pr-{number}/` (9.8.2) | [src: product page; https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-git/guides/pr-preview-deployments/ (HTTP 200, fetched read-only 2026-10-13); FACTS 9.8.2 \| DOCS-ONLY]. How previews bill (a second app?) is not stated: UNVERIFIED |

#### 15.3.6 Environment variables and secrets

The full variable table is 15.3.6.1 and the build and run failures are 15.3.18. What matters for facts:

| Fact | Value | Source tag |
|---|---|---|
| Where they live | Orbit product page: "Environment variables and secrets are set per app and injected at runtime rather than baked into the image". In the Docker-image flow they are the component's `environmentParameters` | [src: product page; global specs \| DOCS-ONLY and VERIFIED-LIVE] |
| Plain versus encrypted | In a plain spec every value is public (FACTS 3.7). The page says secret variables, private repos and database add-ons are deployed encrypted, running only on ArcaneOS nodes | [src: product page footnote \| DOCS-ONLY]; FACTS 3.7 for the mechanism |
| Required | `GIT_REPO_URL`, `APP_PORT` | [src: docs environment-reference \| DOCS-ONLY] |
| Monorepo | `PROJECT_PATH` (17 live specs use it) | [src: docs; global specs \| DOCS-ONLY and VERIFIED-LIVE] |
| Names that exist in live specs but in no docs page read | `ORBIT_RUNTIME` (values python, node, go, rust, php), `ORBIT_RUNTIME_VERSION` | [src: global specs \| VERIFIED-LIVE]; meaning UNVERIFIED |
| Names in docs examples but not in the reference page | `INSTALL_COMMAND` (also in 15 live specs), `PRE_BUILD_COMMAND`, `POST_BUILD_COMMAND`, `HEALTH_CHECK_INTERVAL`, `HEALTH_CHECK_PATH`, `MAX_OLD_SPACE_SIZE`, `WEB_CONCURRENCY` | [src: docs Node.js guide, troubleshooting \| DOCS-ONLY] |

#### 15.3.6.1 The build and run variables (36, read 2026-10-13)

Source: docs.runonflux.com `fluxcloud/register-new-app/deploy-with-git/configuration/environment-reference` (which lists them as settings of the `runonflux/orbit` image) and the Deploy with Git guides; every "What it does", "Default" and "Example" cell is DOCS-ONLY. The "Seen in live specs" column is VERIFIED-LIVE: the number of the 235 plain v8 specs whose component image is `runonflux/orbit:latest` that name the variable in `environmentParameters`, in `GET https://api.runonflux.io/apps/globalappsspecifications` on 2026-10-13 (the counts were reproduced by the integrator; they drift). A learner who deploys through the Orbit dashboard sets these as environment variables in the app's settings; a learner who deploys the image through FluxCloud sets them as the component's `environmentParameters` (`NAME=value` strings). In a plain spec every value is public (3.7). The typed catalogue of these 36 names is `ORBIT_BUILD_VARIABLES` in `shared/flux/orbit.ts`; both lists hold the same 36 names.

| Name | What it does | Default | Example | Required or secret | Seen in live specs (2026-10-13) | Source tag |
|---|---|---|---|---|---|---|
| `GIT_REPO_URL` | Repository to build and run. Required. https URL; a trailing `.git` is optional; the scheme is required | none | `https://github.com/username/repository` | REQUIRED | 235 of 235 specs (244 entries; a few specs repeat it) | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `APP_PORT` | Port the app listens on inside the container. Required. Must match the container port in the spec | none | `3000`, `8000`, `8080` | REQUIRED | 235 of 235 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `GIT_BRANCH` | Branch to deploy | `main` | `production` | no | 189 (main 165, master 16, 8 other branch names) | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `GIT_TOKEN` | Access token for a private repository. Never commit it | none | (a personal access token with repo scope) | SECRET (encrypted settings only) | 3 plain specs name it | [src: docs quick start, environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `PROJECT_PATH` | Sub-folder of a monorepo to build and run (default: the repository root). The hook lookup order, the sub-folder first and then the repository root as a fallback, is from the deployment hooks page ("Monorepo Support"), not the environment reference | repository root | `apps/web` | no | 17 | [src: docs environment reference (default, meaning); docs deployment-hooks (hook lookup) \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `PROJECT_TYPE` | Force the runtime instead of detection: `auto`, `node`, `python`, `ruby`, `go`, `bun`, `rust`, `java`, `dotnet`, `php` | `auto` | `node` | no | 0 (not seen; see `ORBIT_RUNTIME` below) | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `BUILD_COMMAND` | Replace the detected build command | detected | `npm run build:production` | no | 13 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `RUN_COMMAND` | Replace the detected start command | detected | `node server.js` | no | 30 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `INSTALL_COMMAND` | Replace the install step. Appears in the Node.js guide and the troubleshooting page, NOT in the environment reference | detected | `npm ci` | no | 15 | [src: docs Node.js guide and troubleshooting page (not in the environment reference) \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `NODE_VERSION` | Node.js version. Priority: this variable, then `.nvmrc`, then `engines.node` in `package.json`, then latest LTS | LTS | `20.11.0`, `lts/iron`, `18` | no | 1 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `PYTHON_VERSION` | Python version | detected from `.python-version` or `pyproject.toml`, else 3.11 | `3.12` | no | 1 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `RUBY_VERSION` | Ruby version | detected, else 3.0 | `3.1.4` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `GO_VERSION` | Go version | detected from `go.mod`, else 1.22.0 | `1.22.5` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `JAVA_VERSION` | Java version (8, 11, 17, 21) | detected, else 17 | `21` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `DOTNET_VERSION` | .NET SDK version (6.0 to 9.0) | detected, else 8.0 | `8.0` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `BUN_VERSION` | Bun version | detected, else latest | `1.0.25` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `RUST_VERSION` | Rust channel or version | detected, else stable | `stable` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `PHP_VERSION` | PHP version (7.4 to 8.3) | detected from `composer.json`, else 8.2 | `8.3` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `PHP_EXTENSIONS` | Extra PHP extensions on top of a default set | none | `imagick,memcached` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `CGO_ENABLED` | Go: allow C libraries (`1`) or build a static binary (`0`) | `0` | `1` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `NODE_OPTIONS` | Node flags; the image sets `--max-old-space-size` to 75 percent of container RAM (minimum 1024 MB, maximum 8192 MB) | auto | `--max-old-space-size=5120` | no | 1 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `JAVA_OPTS` | JVM flags; heap is set to 75 percent of container RAM (512 MB to 8192 MB) | auto | `-Xmx4g` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `ASPNETCORE_ENVIRONMENT` | ASP.NET Core environment | `Production` | `Staging` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `WEBHOOK_SECRET` | Secret that signs and checks incoming webhooks (GitHub HMAC-SHA256, GitLab token). Checking is OFF by default: `WEBHOOK_SIGNATURE_VERIFY` is `false` and the Webhook API page lists the signature as "optional" for `POST /webhook`. The GitHub webhooks page nevertheless says "Always set WEBHOOK_SECRET to prevent unauthorized deployments" | empty | a long random string | SECRET (encrypted settings only) | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `WEBHOOK_SIGNATURE_VERIFY` | Turn on signature checking; default `false`, so a webhook is accepted without a valid signature until it is set to `true`. Documented only on the Webhook API page ("WEBHOOK_SIGNATURE_VERIFY false Enable signature verification") | `false` | `true` | no | 0 | [src: docs Webhook API page only \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `API_KEY` | Bearer key that protects `GET /status` and `GET /logs/:id`. Independent of `WEBHOOK_SECRET`. The pages disagree about `/health`: the Webhook API page says it "is always public (no authentication required)"; the environment reference says that when `API_KEY` is set "the /status and /health endpoints require authentication" (and lists `/status`, `/health` as the endpoints `API_KEY` covers), and does not mention `/logs/:id`. Which is right is UNVERIFIED; teach `/status` and `/logs/:id` and do not promise anything about `/health` | empty (open) | a long random string | SECRET (encrypted settings only) | 0 | [src: docs environment reference, Webhook API page \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `POLLING_INTERVAL` | Seconds between checks of the repository. `0` disables; allowed 60 to 86400 | `0` | `300` | no | 131 (86400 on 113, 300 on 8, 1800 and 3600 on 3 each, 7200, 60, 16400 and 21600 on 1 each) | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `HEALTH_CHECK_RETRIES` | Health attempts before a deploy counts as failed (1 to 10) | `3` | `5` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `HEALTH_CHECK_DELAY` | Seconds between attempts (5 to 60) | `10` | `15` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `SKIP_HEALTH_CHECK` | Skip health checks. Testing only | `false` | `true` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `DEPLOYMENT_TIMEOUT` | Seconds a deployment may take before an automatic rollback (300 to 7200) | `1800` | `3600` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `FORCE_INSTALL` | Reinstall dependencies and ignore the lock-file cache | `false` | `true` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `SKIP_HOOKS` | Do not run `pre-deploy.sh` and `post-deploy.sh` this time | `false` | `true` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `HOOK_TIMEOUT` | Seconds a hook may run (60 to 3600) | `300` | `900` | no | 0 | [src: docs environment reference \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `WEBHOOK_PORT` | Port of the webhook and status listener | `9001` | `9001` | no | not set (9001 is a container port in 234 of 235 specs) | [src: docs environment reference, Webhook API page \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |
| `DEBOUNCE_DELAY` | Seconds to wait and collapse pushes (0 disables) | `5` | `10` | no | 0 | [src: docs Webhook API page \| DOCS-ONLY]; seen column [VERIFIED-LIVE] |

Seen in live specs but in no docs page read: `ORBIT_RUNTIME` (26 specs; values `python` 13, `node` 9, `go` 2, `rust` 1, `php` 1) and `ORBIT_RUNTIME_VERSION` (6 specs, for example `3.12`, `20`). They look like the managed product's way of passing the detected runtime to the image (the same job as `PROJECT_TYPE` and the `*_VERSION` variables); what they do is UNVERIFIED. A lesson may say "the specs of Orbit apps carry runtime hints such as `ORBIT_RUNTIME`" and no more. `PORT` (5 specs on the integrator's count, 7 on the researcher's) is set by the app owner, not by Orbit. [src: GET /apps/globalappsspecifications 2026-10-13 \| VERIFIED-LIVE]

Names in docs guides that the reference page does not list: `HEALTH_CHECK_INTERVAL`, `HEALTH_CHECK_PATH`, `PRE_BUILD_COMMAND`, `POST_BUILD_COMMAND`, `MAX_OLD_SPACE_SIZE`, `WEB_CONCURRENCY`, `NPM_TOKEN`. They appear in examples only; do not teach them as supported (UNVERIFIED). The documented way to run steps around a deploy is the hook scripts `pre-deploy.sh` and `post-deploy.sh` (15.3.4). [src: docs Node.js guide, troubleshooting \| DOCS-ONLY]

Secrets in plain specs: among the 235 plain Orbit specs, three name `GIT_TOKEN` and others name secret-looking keys such as `ADMIN_TOKEN`, `GEMINI_API_KEY`, `CF_API_TOKEN` and `TELEGRAM_BOT_TOKEN` (82 distinct variable names in all, 40 of them one-off app settings); none names `WEBHOOK_SECRET` or `API_KEY`. The product page says private repositories, database add-ons and secret variables are deployed encrypted (the spec's `enterprise` field carries an encrypted blob and `compose` is empty), so a plain spec with a token in it was not created by the encrypted path. Lessons show variable NAMES only and never print a value copied from the network. [src: GET /apps/globalappsspecifications 2026-10-13; product page footnote \| VERIFIED-LIVE and DOCS-ONLY]

#### 15.3.7 Rollback and health

| Fact | Value | Source tag |
|---|---|---|
| Automatic | "A failed build never replaces a working deployment. Orbit keeps the last known-good version live and automatically rolls back." Triggers listed in the docs: failed build, failed `pre-deploy.sh`, health check failure, timeout | [src: product page FAQ; docs deployment-hooks, environment-reference \| DOCS-ONLY] |
| Manual | `flux-rollback`, `--list`, a release id, `--force`; last 3 releases; does not run hooks. Needs a shell in the container, which the dashboard does not give | [src: docs troubleshooting \| DOCS-ONLY] |
| Health monitoring | "Built-in health checks and process supervision" (supervisor inside the container); non-root user `appuser`, log rotation | [src: product page; docs deployment-hooks \| DOCS-ONLY] |
| What rollback is not | Not protection against a node going away. A single-instance app is down when its node is down until another node picks it up; the network re-spawns it (FACTS 6) | [src: product page footnote 'Starter runs on a single instance' \| DOCS-ONLY]; FACTS 6 |

#### 15.3.8 Domains and TLS

| Fact | Value | Source tag |
|---|---|---|
| Default address | `<name>.app.runonflux.io` for the first port; FACTS 6.4 and 8 for the forms | [src: docs quick-start \| DOCS-ONLY]; FACTS |
| Custom domain | "Custom domains are available on every plan, Starter included. Create a CNAME record pointing to your Flux deployment domain and SSL is handled automatically through the Flux reverse proxy network." The network still requires the domain in the component's `domains` entry (FACTS 6.4); the product's dashboard is the place that writes it | [src: product page FAQ \| DOCS-ONLY]; FACTS 6.4 |
| Conflict | The console's Git page says custom domains are in Standard ("Private repos, more build minutes, custom domains"); the older page copy said "Paid plans also include custom domains" | [src: chunk en-*.js (git namespace); https://orbit.app.runonflux.io \| VERIFIED-SOURCE and VERIFIED-LIVE]. The current product page wins |

#### 15.3.9 Privacy and encryption

| Fact | Value | Source tag |
|---|---|---|
| Private repositories | Supported on every plan: "Paste your GitHub, GitLab, or Bitbucket URL. Public or private repos supported." Docs: a personal access token with `repo` scope in `GIT_TOKEN` | [src: product page; docs quick-start \| DOCS-ONLY] |
| Encryption | "Private repositories, database add-ons and secret variables are deployed encrypted, running only on ArcaneOS nodes". "Enterprise apps run inside ArcaneOS ... all data is encrypted at rest" | [src: product page footnote and FAQ 'How is my data kept secure?' \| DOCS-ONLY]. The mechanism (spec fields encrypted to ArcaneOS node keys, amd64 only) is FACTS 3.7 and 8.3 |
| Fee | "the network's encryption fee is included in the price shown at checkout" | [src: product page \| DOCS-ONLY]; see the quote check in 15.3.11 for what the engine says |
| Console copy | "Private repos" listed under Standard in the console's Git page | [src: chunk en-*.js \| VERIFIED-SOURCE]; out of step with the product page |

#### 15.3.10 Plans, payment, trial

Read 2026-10-13, footer v1.1.101. All DOCS-ONLY: they are a vendor's published prices and may change.

| Plan | USD per month | vCores | RAM | Storage | Instances | Persistent folders | Second app port |
|---|---|---|---|---|---|---|---|
| Starter | 0.99 | 0.5 | 1 GB | 5 GB | 1 | no | no |
| Standard (Recommended) | 2.49 | 1.5 | 4 GB | 15 GB | 2, "with failover" | yes | yes |
| Pro | 3.99 | 2 | 6 GB | 20 GB | 2, "with failover" | yes | yes |
| Custom | from 0.99 | 0.1 to 15 | up to 59 GB | 1 to 820 GB | 1 to 3 | only with 2 or more instances | yes |

| Fact | Value | Source tag |
|---|---|---|
| Included on every plan | Unlimited builds, free HTTPS address, database and Redis add-ons, unlimited bandwidth, custom domains, "no contract and no egress billing" | [src: product page \| DOCS-ONLY] |
| Payment | Stripe card, or FLUX through ZelCore or SSP. "A card works for every plan" | [src: product page FAQ \| DOCS-ONLY] |
| Free week | One per account for customers new to Flux Cloud, no card, ends after 7 days. VOLATILE promotion, "if you've deployed any app on Flux before, standard pricing applies" | [src: product page footnote \| DOCS-ONLY]. Lessons leave it out |
| Money back | 30 days on the first paid month | [src: same \| DOCS-ONLY]; FACTS 9 row 7 for the console's different statement |
| Free plan | "The old Free plan is closed to new apps; apps already running on it keep renewing for free." | [src: product page FAQ \| DOCS-ONLY] |
| Console list | The new console front end's Git page lists `Free` ($0, badge NEW), `Standard` ($2.49, badge BETA), `Pro` ($3.99) and no Starter | [src: chunk git-*.js \| VERIFIED-SOURCE]; stale against the product page |
| Product page marketing | 7,106 active servers, 57 countries, 99.9% uptime, "7,000+ global nodes", competitor prices (Vercel Pro $20, Netlify Pro $19, Render Standard $25, Railway Hobby $5, "accurate as of July 2026") | [src: product page \| DOCS-ONLY]. NOT network facts. Live API on 2026-10-13: 7,075 nodes (FACTS snapshot) |

#### 15.3.11 Plan prices versus the academy's quote engine

Engine: `quote()` from `shared/flux` with the parameters captured 2026-10-12 (cpu 0.15 per 0.1 core on a three-instance bundle, ram 0.05 per 100 MB, hdd 0.02 per GB, port 2, scope 4, static IP 2, `fluxmultiplier` 0.95, minimum 0.99, one month = 88,000 blocks). Spec shape: v8, one component, two public ports (app and webhook), not encrypted, no static IP, 88,000 blocks. Each plain result was also sent to the live read-only calculator (`POST /apps/calculatefiatandfluxprice`, `Content-Type: text/plain`) on 2026-10-13 04:31Z and agreed to the cent. RAM: the page says GB; live specs hold 1000, 4000 and 6000 MB, so 1 GB = 1000 MB was used (1024, 4096 and 6144 give the same prices). [src: shared/flux quote(); POST api /apps/calculatefiatandfluxprice \| VERIFIED-SOURCE and VERIFIED-LIVE]

| Plan | Tuple (cpu, MB, GB, instances) | Engine USD | Live calculator | Published | Reproduced |
|---|---|---|---|---|---|
| Starter | 0.5, 1000, 5, 1 | 0.99 | 0.99 | 0.99 | yes (the 0.99 floor; 2 instances also 0.99, 3 give 1.49) |
| Standard | 1.5, 4000, 15, 2 | 2.49 | 2.49 | 2.49 | yes, only with 2 instances (1 gives 1.49, 3 give 3.99) |
| Pro | 2, 6000, 20, 2 | 3.99 | 3.99 | 3.99 | yes, only with 2 instances (1 gives 1.99, 3 give 5.99) |
| Custom minimum | 0.1, 100, 1, 1 | 0.99 | 0.99 | "from 0.99" | yes (the floor) |

So the three plan prices are the network price for the plan's size, for one month, unencrypted. Nothing is added for Orbit itself: no builder fee is visible. [DOCS-ONLY for the published column; VERIFIED-LIVE for the calculator; VERIFIED-SOURCE for the engine]

What could not be reproduced:

| Number | Why |
|---|---|
| "Encryption fee is included in the price shown at checkout" | For the same sizes the engine adds USD 4 to the three-instance bundle (scope) and prices Starter at 1.49, Standard at 4.99 and Pro at 6.49 per month when the spec is encrypted. The surcharge is therefore NOT a flat USD 4: the 4 goes into the bundle before the per-instance share and the result is rounded up to .49 or .99 (4.3, 4.4). Recomputed 2026-10-13 with `quote()` from `shared/flux` (plain to encrypted, USD per month, difference): at the plan's own instance count Starter (1 instance) 0.99 to 1.49 (+0.50, the floor hides most of it), Standard (2) 2.49 to 4.99 (+2.50), Pro (2) 3.99 to 6.49 (+2.50). At other instance counts: Starter 2 instances 0.99 to 2.99 (+2.00), 3 instances 1.49 to 4.49 (+3.00); Standard 1 instance 1.49 to 2.49 (+1.00), 3 instances 3.99 to 6.99 (+3.00); Pro 1 instance 1.99 to 3.49 (+1.50), 3 instances 5.99 to 9.49 (+3.50). (An earlier message said +2.00 for 3 instances; the engine gives +3.00 for Starter and Standard and +3.50 for Pro there, and +2.00 only for Starter on 2 instances.) [src: shared/flux quote() \| VERIFIED-SOURCE] A fake encrypted blob cannot be sent to the calculator (it answers "Error decrypting AES key"), so these three are engine results only. The page gives no reconciliation: either Orbit pays the difference, or the plan price applies to plain apps and the checkout adds the fee for private repos. UNVERIFIED |
| Custom prices | The page names no Custom price above 0.99. The engine gives 22.99 (15 vCores, 59,000 MB, 820 GB, 1 instance) and 68.49 (the same, 3 instances) per month, plain. Those are engine numbers, not Orbit's |
| First free week | Not a network feature. A 7-day term (20,160 blocks) quotes the 0.99 minimum. Orbit specs with `expire` near 108,160 fit "month plus week"; how the week is granted is not visible |
| Persistent folders, second port | Carry no price line: ports in the normal range are free in the formula (FACTS 4.4) |
| 7,106 servers, 57 countries, 99.9% uptime | Marketing figures, not reproducible from the API. Not used |

#### 15.3.12 The Deploy to Flux button

| Fact | Value | Source tag |
|---|---|---|
| URL | `https://runonflux.com/apps/orbit?repo=<https repo URL>&branch=<branch>&projectPath=<folder>&plan=<plan>`. Example on the page: `https://runonflux.com/apps/orbit?repo=https://github.com/RunOnFlux/deploy-with-git-samples&branch=master&projectPath=express&plan=standard` (HTTP 200) | [src: https://runonflux.com/apps/orbit/deploy-to-flux; curl 2026-10-13 \| DOCS-ONLY for the format; VERIFIED-LIVE for the 200] |
| Parameters | `repo` (full HTTPS URL, required), `branch`, `projectPath`, `plan` (`starter`, `standard` or `pro`). Older buttons with `plan=free` open Starter. Custom sizes are set in the dashboard after the deploy | same |
| Markdown | `[![Deploy to Flux](https://runonflux.com/apps/orbit/deploytoflux.png)](<url>)`. The image URL answers `301` to `/apps/apps/orbit/deploytoflux.png` (the path prefix is doubled) | [src: same page; curl -I 2026-10-13 \| DOCS-ONLY and VERIFIED-LIVE] |
| What it does | Opens the deployment wizard with the fields filled in. It does not deploy on its own | [src: same page \| DOCS-ONLY] |
| Docs name | The docs say `GIT_REPO_URL` etc. for the image flow; the button uses the shorter names above. They are two different vocabularies | [src: docs; button page \| DOCS-ONLY] |

#### 15.3.13 Limits and what Orbit does not do

| Statement | Source tag |
|---|---|
| Not serverless. "Your app runs as a full long-running container rather than a serverless function": background workers and persistent processes work | [src: product page \| DOCS-ONLY] |
| Static sites and SPAs are supported ("builds the production output, and serves it from the Flux network"); there is no separate static hosting tier or CDN claim. The docs' React example serves a build with `npx serve` | [src: product page FAQ; docs Node.js guide \| DOCS-ONLY] |
| Stateless by design in the image docs (9.8.2): persistent data belongs outside the container. The product lists persistent folders only on Standard, Pro and Custom with 2 or more instances | [src: FACTS 9.8.2; product page \| DOCS-ONLY] |
| Resource ceiling is the network's: 15 vCores, 59 GB RAM, 820 GB, 3 instances in Custom | [src: product page \| DOCS-ONLY]; FACTS 3 for the app-level limits |
| Starter downtime: "brief downtime may occur if its node restarts" | [src: product page \| DOCS-ONLY] |
| One deploy slot per app: pushes are queued and collapsed; no parallel builds | [src: docs webhook-api \| DOCS-ONLY] |
| No repo-level config file was found beyond `pre-deploy.sh`, `post-deploy.sh` and `.flux-pod/health-check` | [src: grep of docs pages 2026-10-13 \| UNVERIFIED] |

#### 15.3.14 Supersedes and confirms (earlier rows of this file)

| Earlier row | Status | What changed |
|---|---|---|
| Read-first item 15 (no central scheduler; "22 percent of live 1-instance apps have no running copy") | CORRECTED | The 78 single-instance apps with no copy are all blocklisted Orbit deployments (15.3.3). The scheduler statement stands; the fragility figure does not. A healthy single instance is installed (0 of 122 non-Orbit single-instance apps lack a copy) |
| Section 1.2 row "Flux Orbit (Deploy with Git)" | TIGHTENED | The live page text is now `v1.1.101`; "free tier" is gone (Free plan closed); Starter, Standard, Pro and Custom are the plans; image `runonflux/orbit:latest` is the managed product's registration image, not only a demo |
| Section 9 row 7 refund statement | CONFIRMED | Orbit's 30-day guarantee covers "your first paid month"; the console's "not automatic, open a ticket" is unchanged |
| Section 9 row 8 portals | CONFIRMED and EXTENDED | `orbit.runonflux.com` still `301`s to `/apps/orbit`; `orbit.app.runonflux.io` still serves an older copy of the page (HTTP 200, 2026-09-11) |
| Section 9 row 9 "Orbit = a Docker image you configure" | SETTLED | Both statements are true of the same thing: the managed product registers the same image with the same variables (15.3.1) |
| Section 9.3 portals table, footer `v1.1.100` | CORRECTED | Footer reads `v1.1.101` on 2026-10-13 04:28Z (page text byte-identical on re-fetch). The earlier read was a slightly older build |
| Section 9.4.1 Git card | CONFIRMED | The card text matches the product page; its bullets are the old bullets |
| Section 9 custom domain FAQ | CONFIRMED | Stated for every plan, Starter included. Conflicts with the console's Git page (15.3.8) |
| Section 9.8.1 table | CONFIRMED, EXTENDED | Adds: no builder fee in the plan prices (15.3.11), the `Orbit deployment` marker and size tuples (15.3.2), button parameters (15.3.12) |
| Section 9.8.1 "Agent access" row | EXTENDED | See 15.4: the 15 tool names, the endpoint, and a mismatch between the guide and the live sign-in challenge |
| Section 9.8.2 table (image, env, hooks, webhooks) | CONFIRMED | Adds `ORBIT_RUNTIME*`, `INSTALL_COMMAND`, `WEBHOOK_SIGNATURE_VERIFY`, `WEBHOOK_PORT`, `WEBHOOK_PATH`, `WEBHOOK_TIMEOUT`, `WEBHOOK_RATE_LIMIT`, `DEBOUNCE_DELAY`, the stage names and the status JSON shape |
| Section 9.8.2 closing line "I found no repo-level config file" | CONFIRMED | Same finding on 2026-10-13 |
| Section 9.9 snapshot row "Orbit plans" and Docker Hub pulls | CONFIRMED | Same prices; first week free is volatile |
| Section 9.16 "Whether the Docker-image flow in the docs is still the recommended route" | SETTLED | It is not a separate route: it is the layer the dashboard uses. For a lesson, "deploy with Git on Orbit" and "deploy the `runonflux/orbit` image yourself" are two doors into the same image |
| Section 9.16 and 14.2 "Whether Orbit ever involves a user-signed spec" | PARTLY SETTLED | A normal owner-signed v8 spec lands on chain, with 232 distinct owners over 235 apps; who holds the key is UNVERIFIED (15.3.1) |
| Section 6.4 row "Hyphen pattern" | UNCHANGED | `https://<app>-9001.app.runonflux.io/webhook` is still the docs spelling; the underscore form is the FDM form. Treat the hyphen form as UNVERIFIED |

#### 15.3.15 Contradictions with the rest of FACTS.md

1. Read-first item 15 (22 percent of single-instance apps without a running copy) is explained by 78 blocklisted Orbit deployments, not by general fragility. See 15.3.3. Section 6's "single instance apps are fragile" advice is still sound as guidance, but the number must not be quoted.
2. "Orbit has a free tier" (FACTS 1.2 row before the 2026-10-13 pass, docs quick start: "a free tier and paid plans") versus the product page "old Free plan is closed to new apps" and the console Git page "Free $0 NEW". Closed is the only statement backed by the live product page and by the blocklist history. The "first week free" is a promotion, not a plan.
3. "Runs on 3+ nodes" (docs introduction, console copy) versus Starter 1 instance, Standard and Pro 2 (page, and 229 of 235 live specs with 1).
4. Plan inclusions: console Git page puts private repos and custom domains under Standard, product page puts both on every plan.
5. The console's Git page says Standard is "BETA"; the product page says "Recommended". The word "beta" must not appear in lessons for either.
6. Docs' "Pay only Flux Network rates - No additional fees" and "Typical costs: Small app ~$3-10/month" versus the three plans at 0.99, 2.49 and 3.99 (the same network rates). The "$3-10" figure is stale.
7. Docs describe a `config.json` and `/app/.env_setup` and `admin`/`admin` supervisor login on 9001 (FACTS 9.8.2). None can be checked from outside; the managed product does not expose them. Lessons do not teach them.
8. FACTS 3.7 says `contacts` and `compose` encrypted are "enterprise". The Orbit page says "Enterprise apps run inside ArcaneOS". Same meaning. The page's "Enterprise" is not a separate plan name.

#### 15.3.16 Things a lesson must not say

- That Orbit builds on a "special" Orbit network, or that an Orbit app is a different object from a Flux app: it is a plain v8 spec with the `runonflux/orbit:latest` image.
- That Orbit is free, or that there is a free plan. There is a first-week promotion for new accounts. Do not quote the week as a feature.
- That Starter has failover, or that any plan runs on "3+ nodes".
- A price for a Custom size, or an "Orbit price" that is not `quote()` output with the date. The three plan prices are catalogue data with the read date 2026-10-13.
- That the encryption fee is zero. The page says it is "included in the price shown at checkout"; the engine says it costs USD 4 on the bundle price.
- That a push is deployed "instantly" or "in 2 minutes": the docs say "about 2 minutes" for a webhook flow; builds depend on the project. Say "when the webhook arrives and the build finishes".
- That Orbit uses Nixpacks, as a certainty. The product page says so; the docs describe their own detection; the specs show neither. Phrase as "the page says".
- Any value copied from a plain Orbit spec (tokens, passwords). Names only.
- That the `Orbit deployment` apps listed in the explorer are all running. 78 are refused by the network (15.3.3).
- That the Orbit MCP server and the Flux Cloud MCP server are the same thing (15.4.8).

#### 15.3.17 How we know

Global specs and locations were fetched once each at 04:28Z on 2026-10-13 (2.9 MB and 2.6 MB) and analysed offline with fixed scripts; counts are exact for that moment and drift. Drift note: a fetch at 06:24Z the same day returned 2,082 global specs (04:28Z: 2,083) and 8,785 location rows (04:28Z: 8,784; a third fetch at about 06:55Z gave 2,081 specs and 8,780 location rows, and a fact-checker's later fetch reported 8,779, so drift within hours reaches about 5 rows, not only 1 or 2; a fact-checker's later fetch reported 8,783, which the integrator did not reproduce); the dated values elsewhere stay as read. The policy bundle was fetched from the repository's `signed` branch and its payload decoded; the signature was not verified here. The product and guide pages were re-fetched twice and were byte-identical to the first capture. Docs pages are as published on 2026-10-13. Nothing was called that signs, pays, registers or changes anything. The calculator POSTs are the read-only ones used in FACTS 4.2.

Integrator re-check, 2026-10-13: the specs, locations and policy bundle were fetched again by the FACTS integrator and the load-bearing counts reproduced: 235 Orbit specs (all v8, one component, 229 with 1 instance), 351 single-instance apps of which 78 have no location (all 78 Orbit, all 78 owners on the blocklist), 0 of the other 122 without a location, 149 owner entries added 2026-09-30 whose reason names an Orbit deployment, 1,123 encrypted v8 specs. Location rows read 8,785 in the second fetch against 8,784 in the first (drift).

#### 15.3.18 Common build and run failures

Read 2026-10-13. Each row is "symptom, likely cause, how to tell, fix". Every row is DOCS-ONLY: it is what the Deploy with Git docs say (the page, or the pages, where the key phrase of the row occurs in the saved copies is named per row; the wording of the symptom, cause and fix is the researcher's condensation). None was reproduced by deploying, so no row is VERIFIED-LIVE. Where a command mentions `docker exec`, that is for the image flow with node access; a managed-product user reads the same logs in the dashboard. Variable names are in 15.3.6.1; the stages and the rollback triggers are in 15.3.4 and 15.3.7. Rows 18 to 20 were added later from the same troubleshooting page and carry its wording only.

| # | Message or symptom | Likely cause | How to tell | Fix | Source page and tag |
|---|---|---|---|---|---|
| 1 | App starts but nothing answers on its address | `APP_PORT` does not match the port the app really listens on | Log shows the app listening on another port; health check fails | Set `APP_PORT` to the real port (the container port in the spec must match) | [src: docs deploy-with-git, troubleshooting page (APP_PORT) \| DOCS-ONLY] |
| 2 | "Build Failed", or the app serves old code | Build command is not `npm run build` for this project | Setup log shows the failing command | Set `BUILD_COMMAND` (for example `npm run build:production`) | [src: docs deploy-with-git, troubleshooting page and quick start ("Build Failed") \| DOCS-ONLY] |
| 3 | Supervisor shows `FATAL` or `BACKOFF`; process exits at once; container restarts every few seconds | No start script, or the wrong start command | `app.log` ends within seconds of start | Set `RUN_COMMAND` (for example `node server.js`) | [src: docs deploy-with-git, troubleshooting page (FATAL, BACKOFF) \| DOCS-ONLY] |
| 4 | `Cannot find module ...` | Dependencies were not installed cleanly | Error names a package that is in `package.json` | Set `FORCE_INSTALL=true`, or `INSTALL_COMMAND=npm ci` | [src: docs deploy-with-git, Node.js guide ("Cannot find module") \| DOCS-ONLY] |
| 5 | `FATAL ERROR: Ineffective mark-compacts near heap limit` or `JavaScript heap out of memory` during build | Container RAM too small for the build | Build log shows heap errors | Pick a plan or custom size with more RAM (guide: small apps 2 to 3 GB, Next.js 3 to 4 GB, large 6 to 8 GB). `NODE_OPTIONS` follows RAM automatically | [src: docs deploy-with-git, troubleshooting page (heap errors, "Insufficient Memory") \| DOCS-ONLY] |
| 6 | "Failed to clone repository", "Repository not found", "Authentication failed" | Wrong URL (missing `https://`), or a private repo without a token | Setup log, first lines | Fix `GIT_REPO_URL`; add `GIT_TOKEN` with repo scope for a private repo | [src: docs deploy-with-git, troubleshooting page ("Failed to clone", "Repository not found") \| DOCS-ONLY] |
| 7 | Wrong runtime version, syntax errors on a new language feature | Detection chose a different version | Log prints the installed version | Set `NODE_VERSION`, `PYTHON_VERSION` and friends, or add `.nvmrc` | [src: docs deploy-with-git, environment reference, Node.js guide (version priority) \| DOCS-ONLY] |
| 8 | Wrong folder built in a monorepo | `PROJECT_PATH` unset or wrong | Log shows the repository root files (this symptom is UNVERIFIED: no saved Deploy with Git page says it; the docs only give the default of `PROJECT_PATH` as the repository root) | Set `PROJECT_PATH` to the folder that holds the app's manifest | [src: docs deploy-with-git, environment reference ("Default: Repository root"; "Subdirectory within the repository to deploy (monorepo support)"), quick start \| DOCS-ONLY for the cause and fix; UNVERIFIED for the log symptom] |
| 9 | Webhook shows a red cross on GitHub | Webhook port not published, wrong URL, or wrong secret | GitHub "Recent deliveries" shows status; `curl` the webhook URL | Publish port 9001 in the spec, use the app address for that port; if you set a `WEBHOOK_SECRET`, it must match exactly on both sides | [src: docs deploy-with-git, GitHub webhooks page ("Recent deliveries") \| DOCS-ONLY] |
| 10 | Push did not deploy | Wrong branch, secret mismatch, or the push was collapsed by debounce | Webhook log shows no or rejected delivery; `GIT_BRANCH` differs from the pushed branch | Match `GIT_BRANCH`; check the secret; wait for the running deployment | [src: docs deploy-with-git, GitHub webhooks page, Webhook API page (debounce) \| DOCS-ONLY] |
| 11 | Deployment rolls back with a hook error | `pre-deploy.sh` exited non-zero (migration failed, variable missing) | `hooks.log` shows "Hook failed with exit code" | Fix the script; test with `SKIP_HOOKS=true`; make migrations idempotent. The order of `pre-deploy.sh` against the build differs between two docs pages (15.3.4, UNVERIFIED) | [src: docs deploy-with-git, deployment hooks page ("Hook failed with exit code") \| DOCS-ONLY] |
| 12 | Deployment rolls back after the app started | Health check failed: the app does not return 2xx or 3xx on `/` within 3 tries 10 seconds apart | Status shows `health_check` stage then rollback | Make `/` respond, raise `HEALTH_CHECK_RETRIES` or `HEALTH_CHECK_DELAY`, or add `.flux-pod/health-check` | [src: docs deploy-with-git, environment reference, deployment hooks page (health check) \| DOCS-ONLY] |
| 13 | Deployment stuck, then rolled back | Build or hook exceeded `DEPLOYMENT_TIMEOUT` (default 30 minutes) | Status shows `timeout_seconds` reached | Make the build faster or raise the timeout (up to 7200 s) | [src: docs deploy-with-git, Webhook API page (`timeout_seconds`), environment reference (`DEPLOYMENT_TIMEOUT`) \| DOCS-ONLY] |
| 14 | Native package fails to compile | Missing system build tool | Compiler error in the build log | Use a package with prebuilt binaries, or a different base setup; the image ships `build-essential` only | [src: docs deploy-with-git, troubleshooting page (`build-essential`) \| DOCS-ONLY] |
| 15 | Data written to disk disappears after a deploy or restart | Orbit apps are stateless by design; the app folder is `/app` | The file is gone after a redeploy | Keep state outside the container: a database add-on or an external database; persistent folders exist only on Standard, Pro and Custom with 2 or more instances (page) | [src: docs deploy-with-git, product page and FACTS 9.8.2 "stateless warning" (the deployment guidelines page itself was not saved) \| DOCS-ONLY] |
| 16 | Slow, timeouts | Too little CPU or RAM, or one instance | Resource use near the limit | Move to a bigger plan or custom size; add `WEB_CONCURRENCY` only if your app reads it | [src: docs deploy-with-git, troubleshooting page (`WEB_CONCURRENCY`) \| DOCS-ONLY] |
| 17 | `/status` or `/logs` returns 401 | `API_KEY` is set | JSON body `Valid API key required` | Send `Authorization: Bearer <key>` or `Authorization: Token <key>` | [src: docs deploy-with-git, Webhook API page ("Valid API key required") \| DOCS-ONLY] |
| 18 | Git clone or pull fails with "Can't reach GitHub/GitLab" (network) | The container cannot resolve or reach the Git host | The docs give no log string for it | Check DNS resolution and connectivity from the container to the Git host (the page shows `nslookup` and `ping` run inside the container, which a managed-product user cannot do) | [src: docs deploy-with-git, troubleshooting page, "Network Issues" \| DOCS-ONLY] |
| 19 | Container keeps restarting ("Restarting", a crash loop, restarts every few seconds) | The page lists three causes: the application crashes immediately, the health check fails, or it runs out of memory | Exit code and the last log lines (the page uses `docker ps -a` and `docker logs`) | Fix the application error or set `RUN_COMMAND`; fix or disable the health check (the page's example uses `HEALTH_CHECK_INTERVAL`, which the environment reference does not list); give it more memory | [src: docs deploy-with-git, troubleshooting page, "Container Keeps Restarting" \| DOCS-ONLY] |
| 20 | Deployment not updating (a push does not deploy, the app shows the old version, "Git pull seems to work but code doesn't update") | Not stated by the page | Not stated | Force an update, restart the container, or remove `node_modules` and reinstall (the page's commands need a shell in the container, which the managed product does not give) | [src: docs deploy-with-git, troubleshooting page, "Deployment Not Updating" \| DOCS-ONLY] |

---

### 15.4 The Orbit MCP server

Orbit has its own Model Context Protocol server, separate from the Flux Cloud MCP server in section 15.1 (the `@runonflux/flux-cloud-mcp` package and the hosted `https://mcp.runonflux.com/mcp`). The guide is at `https://runonflux.com/apps/orbit/mcp-server`. Everything below that is not marked VERIFIED-LIVE comes from that guide.

#### 15.4.1 Endpoint and transport

| Fact | Value | Source tag |
|---|---|---|
| Endpoint | `https://runonflux.com/apps/mcp` | [src: guide 'What the Orbit MCP server does' \| DOCS-ONLY]; the endpoint exists and answers: see 15.4.2 [VERIFIED-LIVE] |
| Transport | Streamable HTTP, "stateless HTTP endpoint"; no server-side session or MCP user database; each request is verified and gets a request-scoped session | [src: guide 'Authentication, ownership, and data storage'; FAQ \| DOCS-ONLY] |
| Client requirement | An MCP client that supports Streamable HTTP and custom `Authorization` headers | [src: guide 'Connect your agent' \| DOCS-ONLY] |
| Config shape | `{"mcpServers":{"orbit":{"type":"http","url":"https://runonflux.com/apps/mcp","headers":{"Authorization":"Bearer YOUR_FIREBASE_ID_TOKEN"}}}}` | same |
| Same server, other product | The 401 challenge names the resource "Flux Apps (Orbit and Drop)" and the scopes `orbit` and `drop`: the endpoint is shared with Flux's other app, Drop. The Drop tools are not in the Orbit guide | [src: GET https://runonflux.com/apps/.well-known/oauth-protected-resource 2026-10-13 \| VERIFIED-LIVE] |

#### 15.4.2 Authentication

| Fact | Value | Source tag |
|---|---|---|
| Who can connect | An Orbit account signed in with Google or email. "Wallet-only ZelCore and SSP sessions cannot create an agent connection at this time", because "agent-side request signing depends on Firebase SSO" | [src: guide 'Connect your agent', FAQ \| DOCS-ONLY] |
| How the guide says to connect | Sign in to Orbit, Dashboard, "Connect an agent", "Generate connection config", paste the JSON into the client | [src: guide \| DOCS-ONLY] |
| Credential | A Firebase ID token in an `Authorization: Bearer` header. "Short lived." "The current connection flow does not include refresh credentials, so the agent cannot silently extend access." Its expiry is shown on the Connect an agent page; reconnect with a new configuration afterwards | [src: guide 'Authentication ...', FAQ 'How long does an agent connection last?' \| DOCS-ONLY]. The lifetime is not stated in the guide. Firebase ID tokens are one hour tokens in general; that is Google's behaviour and is not read on the Orbit page, so UNVERIFIED for Orbit |
| What happens on each call | Verify the Firebase bearer credential, derive the user's Flux identity through FluxCore, create a request-scoped session. Firebase, FluxCore, the Flux blockchain and the Stripe payment bridge are the systems of record | [src: guide \| DOCS-ONLY] |
| Ownership check | Orbit checks app ownership before returning details or contacting an assigned node | [src: guide \| DOCS-ONLY] |
| Unauthenticated probe: POST `initialize` | HTTP 401, `content-type: application/json`, body `{"error":"invalid_token","error_description":"Connect your agent using browser sign-in"}`, header `www-authenticate: Bearer resource_metadata="https://runonflux.com/apps/.well-known/oauth-protected-resource", scope="orbit drop"`, `cache-control: no-store`, `access-control-allow-origin: *` | [src: curl -X POST https://runonflux.com/apps/mcp, no credentials, 2026-10-13 04:28Z \| VERIFIED-LIVE] |
| Unauthenticated probe: GET | The same 401 and body (not 405) | same |
| Discovery documents | `GET /apps/.well-known/oauth-protected-resource` returns `{"resource":"https://runonflux.com/apps/mcp","authorization_servers":["https://drop.app.runonflux.io"],"scopes_supported":["orbit","drop"],"bearer_methods_supported":["header"],"resource_name":"Flux Apps (Orbit and Drop)"}`. The authorization server `https://drop.app.runonflux.io/.well-known/oauth-authorization-server` lists `code_challenge_methods_supported ["S256"]`, `grant_types_supported ["authorization_code","refresh_token"]`, a registration endpoint, a token endpoint, a revocation endpoint, `client_id_metadata_document_supported true`, `token_endpoint_auth_methods_supported ["none"]`, and an authorization endpoint at `https://runonflux.com/apps/oauth/authorize` | [src: curl GET of both documents 2026-10-13 \| VERIFIED-LIVE] |

Mismatch to keep visible. The guide (page text identical on re-fetch) describes a pasted, short-lived Firebase token with no refresh. The live server's challenge and discovery documents describe the standard MCP browser sign-in (OAuth authorization code with PKCE, dynamic client registration, refresh tokens). They can both be true (a newer sign-in route next to the older generated config), or the guide is behind the server. Which one a client uses was not tested, because that needs a client registration and a sign-in. Lessons say: "you sign in as the Orbit account; the connection is short lived; reconnect when it expires" and do not say "the token lasts one hour" or "there is no refresh". [UNVERIFIED for which route is current]

#### 15.4.3 The tools

Fifteen, named exactly as the guide's table. Groups are the guide's. The academy's catalogue with notes is `shared/flux/agents.ts`. DOCS-ONLY (the tool list needs credentials; `tools/list` was not called).

| Group | Tool | What it does | Mutates | Can cost money | Needs a Flux transaction ID |
|---|---|---|---|---|---|
| Discovery | `list_plans` | Compare plans | no | no | no |
| Discovery | `analyze_repository` | Inspect a repository with Orbit's compatibility rules (runtime, port, branch, project directory) | no | no | no |
| App inspection | `list_apps` | Owned Orbit apps | no | no | no |
| App inspection | `get_app` | One app's sanitized specification | no | no | no |
| App inspection | `get_instances` | Nodes assigned to an app | no | no | no |
| Status and capacity | `get_deployment_status` | Registration state and live locations | no | no | status can use it (UNVERIFIED) |
| Status and capacity | `get_network_capacity` | Suitable Flux capacity | no | no | no |
| Deployment | `validate_deployment` | Preview the authoritative spec, resources and price; registers nothing | no | no | no |
| Deployment | `deploy_app` | Register and test an approved app | YES | YES (creates the payable operation) | returns one |
| Payments | `create_stripe_checkout` | Stripe checkout from an owned Flux transaction at the server-calculated price | YES (creates a checkout) | YES | takes one |
| Logs and builds | `get_logs` | Bounded log tail | no | no | no |
| Logs and builds | `trigger_build` | Request a new Orbit build | YES | no | no |
| Instance control | `control_instance` | start, stop, restart, pause, unpause, redeploy, remove on one assigned node | YES | no | no |
| Maintenance | `update_app` | Constrained settings change, remaining subscription kept | YES | may change the price | returns one |
| Maintenance | `renew_app` | Extend the subscription by an approved duration | YES | YES | returns one |

Facts that go with the table:

| Fact | Value | Source tag |
|---|---|---|
| Tools to confirm in the client | `deploy_app`, `trigger_build`, `control_instance`, `update_app`, `renew_app` (workflow step 3). The FAQ adds "payments" | [src: guide \| DOCS-ONLY] |
| Marking | "Orbit marks mutating tools as destructive or non-read-only where appropriate" (MCP tool annotations); not read from the wire | [src: guide FAQ \| DOCS-ONLY]; UNVERIFIED |
| No cancel | The guide lists no cancel tool; `remove` is an action of `control_instance` | [src: guide \| DOCS-ONLY] |

#### 15.4.4 The safe workflow the guide recommends

1. `analyze_repository` and have the agent explain runtime, port, branch and project directory.
2. `validate_deployment` to review the generated spec, resources and the authoritative network price. Nothing is registered.
3. Require confirmation in the client for the five mutating tools.
4. Keep the transaction ID returned by a deployment, update or renewal: it identifies the Flux operation and is used for status and checkout.
5. Check the result with deployment status and instances; read a bounded log tail if the app is unhealthy.

[src: guide 'A safe deployment workflow' \| DOCS-ONLY]

#### 15.4.5 What is redacted and what is stored

| Fact | Value | Source tag |
|---|---|---|
| Redacted in results | Repository credentials, management secrets, Enterprise plaintext, credential-bearing URLs, and "known secret environment variables" | [src: guide 'Authentication ...', FAQ \| DOCS-ONLY] |
| Accepted but never returned | Private repository credentials supplied as secret inputs | same |
| Stored | Nothing new: "Orbit does not create a separate MCP user database or store a long-lived agent session." Systems of record: Firebase, FluxCore, the Flux chain, the Stripe bridge | same |
| What redaction does not cover | Free text the app itself prints into its logs. The server cannot know it is a secret | inference from "known secret environment variables"; UNVERIFIED |

#### 15.4.6 Troubleshooting list (from the guide)

| Message or symptom | Meaning and fix |
|---|---|
| Unauthorized | Generate a new configuration, check the whole `Authorization` header was copied, make sure the account signs in with Google or email |
| Tool not found | Reconnect so the client performs tool discovery against the current server version |
| App not listed | The app must belong to the Flux identity linked to the signed-in account and be an Orbit deployment |
| Repository cannot be analyzed | Check URL, branch, subdirectory and private repository credential |
| Payment required | Use the transaction ID from the mutating call to create a Stripe checkout |
| Timeout | Retry a read-only call once. Do not repeat a mutating call before checking its transaction ID or deployment status |

[src: guide 'Troubleshooting' \| DOCS-ONLY]

#### 15.4.7 Prices and payment through the MCP server

The MCP server prices with the same network rules: `validate_deployment` returns "authoritative network price" and `create_stripe_checkout` uses a "server-calculated price". Payment is, per the guide, by Stripe checkout (`create_stripe_checkout` "creates a Stripe checkout" and the client should gate payments). That the person completes the checkout and that an agent cannot is an INFERENCE from the word "checkout", not a statement of the guide (UNVERIFIED); an agent never needing a wallet key is likewise inferred. [src: guide \| DOCS-ONLY: the tool list needs credentials and was not called]. Compare the Flux Cloud MCP server (15.1), which prices in USD through the network calculator and pays in FLUX on chain from a payment key the agent holds, but only when the agent sets `confirm=true` (15.1.5); there the person is never sent to a checkout.

#### 15.4.8 Orbit MCP versus the Flux Cloud MCP server (contrast only)

| | Orbit MCP (15.4) | Flux Cloud MCP (15.1) |
|---|---|---|
| Endpoint | `https://runonflux.com/apps/mcp` | `https://mcp.runonflux.com/mcp` (also `.io`), or local `npx -y @runonflux/flux-cloud-mcp` |
| Identity | A signed-in Orbit account (Google or email); the Flux identity is derived by FluxCore. No private key is given to the agent (all of this Orbit cell: the guide, DOCS-ONLY) | Two private keys, no account: a Flux ID key (signs, owns) and a payment key (holds FLUX). The agent holds them: local mode in its process environment, hosted mode as arguments of each tool call |
| What the agent can spend | Nothing by itself, per the guide (DOCS-ONLY). `deploy_app` registers an app and returns a payable operation; payment is a Stripe checkout (`create_stripe_checkout`); that the person completes it and an agent cannot is an inference, UNVERIFIED | `flux_deploy_app` and `flux_cancel_app` sign and pay FLUX on chain, only with `confirm=true`. There is no spending cap |
| Human check | The client's tool approval for the five mutating tools (the guide recommends it) and, by inference (UNVERIFIED), the person at the Stripe checkout (guide, DOCS-ONLY) | A boolean the agent sets (`confirm`), then the host's tool approval. Not a human prompt, and nothing in the server asks one |
| Destructive tools | `control_instance` (includes `remove`); no cancel tool | `flux_control_app` (no plan step; `hard=true` and `remove` delete data) and `flux_cancel_app` (nothing refunded) |
| Scope | Apps deployed through Orbit: Git built apps, Orbit plans | Any Flux app: images, ports, resources, terms; owner must be a `1...` Flux ID |
| Credential lifetime | Short lived, reconnect (route unsettled, 15.4.2) | The keys, until you rotate them |
| Who holds secrets | Orbit and FluxCore sit between you and the chain (vendor statement) | Local: keys stay on your machine (VERIFIED-SOURCE). Hosted: "holds no keys, stores nothing" is the vendor's statement and DOCS-ONLY; the keys still pass through the hosted process, the AI vendor and the chat history |
| Hosted version | Not published (the endpoint answers 401 to `initialize`, so nothing was observed) | Reports 0.2.2 on 2026-10-13, while npm `latest` is 0.2.7 (15.1.1) |

[src: Orbit column: guide \| DOCS-ONLY, endpoint and 401 challenge VERIFIED-LIVE; Flux Cloud column: mcp@0.2.7 dist/server.js, dist/deploy.js, dist/http.js \| VERIFIED-SOURCE; hosted version \| VERIFIED-LIVE]. The right choice for a Git project that should keep deploying on push is Orbit; for a Docker image with exact resources and a FLUX payment, the Flux Cloud server. They are separate products: do not describe one with the other's rules.

#### 15.4.9 UNVERIFIED items for 15.4

- Argument names and result shapes of the 15 tools (needs `tools/list` with credentials).
- Which sign-in route is current (generated Firebase config or browser OAuth) and the real token lifetime.
- Whether `get_deployment_status` takes the transaction ID.
- How `create_stripe_checkout` treats the encryption fee for private repos.
- What the `drop` scope exposes.

#### 15.4.10 Things a lesson must not say

- That an agent can deploy without you: the client's approval policy decides, and Orbit marks mutating tools.
- That the connection is permanent or that the token is "valid for N hours".
- That wallet sign-in (ZelCore, SSP) works for the agent connection.
- That an agent can cancel an Orbit subscription.
- That the agent holds your private key. Per the guide (DOCS-ONLY) it holds a short-lived account credential.
- That every Orbit MCP result is free of secrets: redaction covers known patterns only.
