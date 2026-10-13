import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { routePreloadsPlugin } from './vite-plugins/route-preloads.ts';

/** Every module under `shared/` (the engine, curriculum and site data), as the bundler sees its path. */
const SHARED_DIR = new RegExp(
  `^${fileURLToPath(new URL('../shared/', import.meta.url)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
);

// The API server (server/) listens on 42069 by default, the same port the deployed container uses.
// Override with API_ORIGIN=http://host:port, the dev server port with WEB_PORT and the cache with VITE_CACHE_DIR.
// The web dev server defaults to 5180 (5173 and 5301-5307 are commonly taken on this machine).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_ORIGIN || 'http://127.0.0.1:42069';
  const proxy = {
    '/api': { target, changeOrigin: false },
    '/healthz': { target, changeOrigin: false },
  };
  return {
    plugins: [react(), routePreloadsPlugin()],
    // Parallel dev servers can each use their own cache: VITE_CACHE_DIR=/tmp/vite-cache-<name>.
    cacheDir: env.VITE_CACHE_DIR || 'node_modules/.vite',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: Number(env.WEB_PORT || 5180),
      proxy,
      fs: { allow: ['..'] },
    },
    preview: {
      host: '127.0.0.1',
      port: Number(env.WEB_PORT || 4180),
      proxy,
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rolldownOptions: {
        // `shared/` is data and pure functions (erasable TypeScript, nothing that acts when it loads), so a
        // module that a route does not use is dropped instead of riding along with the one it does use.
        // Without this the `@shared/flux` barrel kept the MCP and Orbit catalogues, the fixtures and the
        // other engine modules together in one chunk that every lesson and the glossary loaded.
        treeshake: { moduleSideEffects: [{ test: SHARED_DIR, sideEffects: false }] },
        output: {
          // The default split gave the entry 36 tiny shared chunks (one per UI atom), which the browser
          // must fetch before it can paint: a request each on HTTP/1.1, a round trip each behind a slow
          // proxy. Everything the entry imports statically is needed before first paint anyway, so merge
          // it: one stable vendor chunk (React, the router) and one app chunk. Lazy routes, stages and
          // the WebGL engine are not initial and keep their own chunks.
          codeSplitting: {
            groups: [
              { name: 'vendor', tags: ['$initial'], test: /node_modules/, priority: 2 },
              { name: 'app', tags: ['$initial'], priority: 1 },
            ],
          },
        },
      },
    },
  };
});
