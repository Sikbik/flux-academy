// Adapted from fluxcommunity/server/src/main.ts
import { ConfigError, loadConfig } from './config.ts';
import { createLogger } from './core/log.ts';
import { startServer } from './server.ts';

let config: ReturnType<typeof loadConfig>;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
  throw err;
}

const log = createLogger(config.logLevel);

let running: Awaited<ReturnType<typeof startServer>>;
try {
  running = await startServer(config, log);
} catch (err) {
  log.error('failed to start', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
}

// A half-registered API is worse than no deploy: the container platform should see the failure.
if (running.routeErrors.length > 0 && process.env.NODE_ENV === 'production') {
  log.error('route modules failed, refusing to serve a partial API', { errors: running.routeErrors });
  await running.stop();
  process.exit(1);
}

log.info('listening', {
  host: config.host,
  port: running.port,
  mode: running.ctx.service.mode,
  webDist: config.webDist,
  node: process.version,
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('shutting down', { signal });
  const hard = setTimeout(() => process.exit(0), 10_000);
  hard.unref();
  await running.stop();
  log.info('stopped');
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  log.error('unhandled rejection', { err: reason instanceof Error ? reason.message : String(reason) });
});
process.on('uncaughtException', (err) => {
  log.error('uncaught exception', { err: err.message });
  process.exit(1);
});
