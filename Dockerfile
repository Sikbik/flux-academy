# syntax=docker/dockerfile:1

# ---- Stage 1: build the web bundle ------------------------------------------------------------
# The web app imports ../shared (contracts, curriculum, the spec and pricing engine), so both folders
# are laid out exactly as in the repo.
FROM node:24-alpine AS web
WORKDIR /build
COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci --no-audit --no-fund
COPY shared ./shared
COPY web ./web
RUN npm --prefix web run build

# ---- Stage 2: runtime ------------------------------------------------------------------------
# Zero runtime dependencies: the server is TypeScript run directly by Node (type stripping), so the
# image only needs the server sources, shared/ and the built web bundle.
#
# The live app on Flux (`academy`) registers this image with an empty `environmentParameters`, and changing a
# registered spec costs an update, so the image carries every default the server needs. TRUST_PROXY=1 is for
# Flux's domain manager (HAProxy) in front of the app: one trusted hop, so the rate limits and HSTS use the
# forwarded client address instead of treating every visitor as the proxy. Behind no proxy, run with
# `-e TRUST_PROXY=0`.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=42069 \
    HOST=0.0.0.0 \
    WEB_DIST=/app/web \
    LOG_LEVEL=info \
    TRUST_PROXY=1
WORKDIR /app

# A package.json with "type": "module" at /app makes shared/*.ts load as ES modules.
RUN printf '{"name":"flux-academy","private":true,"type":"module"}\n' > package.json
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY shared ./shared
COPY --from=web /build/web/dist ./web

LABEL org.opencontainers.image.title="Flux Academy" \
      org.opencontainers.image.description="Interactive school for deploying on Flux: web app and API server" \
      org.opencontainers.image.licenses="MIT"

USER node
EXPOSE 42069

# /healthz answers plain "ok"; busybox wget ships with alpine so no extra process start-up cost.
HEALTHCHECK --interval=30s --timeout=4s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1

CMD ["node", "server/src/main.ts"]
