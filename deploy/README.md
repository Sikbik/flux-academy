# Deploying Flux Academy on Flux

The site is one container, `littlestache/flux-academy`, serving the web app, the JSON API and the SSE stream
on port 42069. It runs on Flux as the app `academy` (`academy.app.runonflux.io`). This folder holds that
app's specification.

The image is built by `.github/workflows/ci.yml` on every pull request. On a push to `main` the workflow
publishes `:latest` and `:sha-<short>` to Docker Hub when the repository has the `DOCKERHUB_USERNAME` and
`DOCKERHUB_TOKEN` secrets; without them the push step is skipped, and the image is pushed by hand (see
"Publishing the image").

## The spec

`flux_app_spec.json` is the live app's v8 specification, read from
`https://api.runonflux.io/apps/appspecifications/academy` on 2026-10-13 (block height 2988592), with `owner`
and `contacts` left as placeholders. Every other field is identical, so a new image under the same tag runs in
the registered slot without an update message. See `docs/research/FACTS.md` section 3 for every field.

| Field | Value | Notes |
| --- | --- | --- |
| `name` | `academy` | Gives `academy.app.runonflux.io`, the canonical origin in `shared/site.ts`. |
| `description` | `Flux Deployment Academy` | As registered, for the app and for the component. |
| `owner` | `YOUR_ZELID_HERE` | **Placeholder.** The operator's ZelID is supplied at deploy time and is never committed. |
| `contacts` | `[]` | **Placeholder.** The live app lists a FluxShare contacts file; use your own. |
| `instances` | 2 | Any number works: no instance-local state matters (every instance keeps its own cache). More instances means more redundancy and a proportionally higher bill. |
| `expire` | 88000 | Blocks (30 s each) from the latest registration or update, about one FluxOS "month". See Renewal. |
| `compose[0].repotag` | `littlestache/flux-academy:latest` | The image. Pin a `sha-<short>` tag to make a deploy reproducible. |
| `compose[0].ports` / `containerPorts` | `42069` / `42069` | The server listens on 42069. |
| `compose[0].cpu` / `ram` / `hdd` | 1 / 2000 MB / 5 GB | What the app was registered with. The server needs far less: under load it used about 125 MB and a fraction of a core. |
| `compose[0].containerData` | `/appdata` | The server keeps no persistent state and never writes there. |
| `compose[0].environmentParameters` | `[]` | The image carries every default; see below. |

### Environment variables

The live spec sets none, so the defaults live in the image (`ENV` in the `Dockerfile`). Add one to
`environmentParameters` in an update only to override it. They are public in the spec unless the app is
enterprise, so put no secrets there; the server needs none.

| Variable | Image default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | A route module that fails to load stops the process instead of serving a partial API. |
| `PORT` | `42069` | Must match `containerPorts`. |
| `HOST` | `0.0.0.0` | Listen on every interface inside the container. |
| `WEB_DIST` | `/app/web` | Where the image puts the built web app. |
| `LOG_LEVEL` | `info` | JSON lines on stdout. |
| `TRUST_PROXY` | `1` | Flux's domain manager (HAProxy) sits in front of the app. With one trusted hop the server uses the client address the proxy appended for rate limiting and sends HSTS for HTTPS requests. Without it every visitor counts as the proxy and they share one rate limit. If your path has more or fewer proxy hops, set the number; with no proxy at all (a plain `docker run` on an open port) set `TRUST_PROXY=0`. Whether Flux's proxy appends `X-Forwarded-For` was not checked on a live node: if it does not, the server falls back to the socket address, as if the variable were unset. |

Everything else is optional: see `server/.env.example` for the full list (upstream URLs, refresh intervals,
rate limits, stream caps). Do not set `FIXTURES` in production.

## Publishing the image

CI does this on `main` when the Docker Hub secrets exist. By hand, from a clean checkout of `main`:

```
docker build --platform linux/amd64 -t littlestache/flux-academy:latest -t littlestache/flux-academy:sha-$(git rev-parse --short=7 HEAD) .
docker push littlestache/flux-academy:latest
docker push littlestache/flux-academy:sha-$(git rev-parse --short=7 HEAD)
```

The image the live app used before this one was `linux/amd64` only, and so is this one. Before pushing, check
it under the live app's limits: `docker run --cpus 1 --memory 2000m -p 42069:42069 littlestache/flux-academy:latest`
with no `-e` flags, then `node server/scripts/smoke.ts http://127.0.0.1:42069`.

## Register a new app

The `academy` app already exists, so a new `:latest` reaches it through the update timer under Operating it.
These steps are for a fresh registration (a fork or a second environment).

1. Build or pull the image. Check it runs: `docker run --rm -p 42069:42069 littlestache/flux-academy:latest`
   and open `http://127.0.0.1:42069/healthz`.
2. Copy `flux_app_spec.json` and replace `owner` (and `contacts`) with your own. Do not commit the copy.
3. Check the quote before paying. The read-only calculator takes the spec as `text/plain` (it hangs on
   `application/json`):

   ```
   curl -s -X POST -H 'Content-Type: text/plain' --data @my_spec.json \
     https://api.runonflux.io/apps/calculatefiatandfluxprice
   ```

   The answer is USD and FLUX for the term in `expire`; read the figures from the response, not from this
   file. Resources, instance count and `expire` all change the quote. A spec whose `name` already exists on
   the network is quoted as an update, which comes out lower, so use a fresh name when comparing.
4. In FluxCloud (`cloud.runonflux.com`) use Register New App in Advanced mode and enter the same values
   (general tab, then the component tab), Review & Validate, sign the message with the wallet or SSO
   account that matches `owner`, let FluxCloud test the installation, then pay within the window it shows.
   Deployment can take a while after payment (FACTS.md section 9 has the measured flow).
5. Open `https://<name>.app.runonflux.io/healthz`, then `/api/v1/info`: `mode` must be `live` and the
   upstreams `ok`. A `fixtures` mode here means `FIXTURES` leaked into the spec.

## Operating it

- **Health:** `GET /healthz` (plain `ok`) is what the container `HEALTHCHECK` calls. `GET /api/v1/info` shows
  upstream status per source, uptime and connected stream clients.
- **Updating:** publish a new `:latest` (see Publishing the image). Nodes are set to compare the image digest
  of a tag about every 6 hours and redeploy when it changed (read from the FluxOS source, not observed live;
  FACTS.md 6.3), so a moved `:latest` is picked up on that timer at the earliest, not at once; whether an
  update itself re-pulls an unchanged tag was not verified. To roll out sooner or reproducibly, update the
  app in FluxCloud with a `sha-<short>` `repotag`. Instances restart on an update and stream clients
  reconnect on their own.
- **Renewal:** `expire` counts blocks from the latest registration or update message. When it runs out the
  app is removed within minutes to hours, with no grace period. Renew or extend the subscription before the
  end of the term (the app's Subscription tab in FluxCloud has the controls). At 88000 blocks that is
  roughly every 30 days.
- **Logs:** one JSON object per line on stdout; view them from the app's management page in FluxCloud.
- **Shutdown:** the server drains on `SIGTERM` (streams are ended, in-flight requests finish) and exits 0.
- **Without Flux's APIs:** the site keeps answering from its baked fallback and labels everything
  `fallback`. Regenerate the baked data before a release with `npm --prefix server run bake`.

## Checks before a release

```
npm run typecheck && npm run lint && npm test && npm run build
node server/scripts/smoke.ts http://127.0.0.1:42069     # against a running server or container
```
