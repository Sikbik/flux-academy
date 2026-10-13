// Adapted from fluxcommunity/server/src/services/runtime.ts
import type { BlockEvent, BlocksSnapshot, GeoSnapshot, NetworkSnapshot } from '../../../shared/api.ts';
import type { Config } from '../config.ts';
import { type Clock, systemClock } from '../core/clock.ts';
import type { BlocksReader, MarketReader, Served } from '../core/context.ts';
import type { Logger } from '../core/log.ts';
import type { UpstreamClient } from '../core/upstream.ts';
import { buildFallback } from '../data/fallback.ts';
import { AppsApi } from '../flux/apps.ts';
import { DaemonApi } from '../flux/daemon.ts';
import { MarketApi } from '../flux/market.ts';
import { COLLATERAL, computeRewards, TARGET_BLOCK_SEC } from '../flux/rewards.ts';
import { StatsApi } from '../flux/stats.ts';
import { BlockWatcher } from './blocks.ts';
import { NetworkService } from './network.ts';

/** The wired-up data side of the server: live (upstream backed) or fixtures (offline simulation). */
export interface Runtime {
  mode: 'live' | 'fixtures';
  network: { snapshot(): Served<NetworkSnapshot> };
  geo: { snapshot(): Served<GeoSnapshot> };
  blocks: BlocksReader;
  market: MarketReader;
  start(): void;
  stop(): Promise<void>;
  onBlock(fn: (e: BlockEvent) => void): () => void;
  onNetwork(fn: (s: NetworkSnapshot) => void): () => void;
}

/** A block summary is `live` for this long after the last poll that reached upstream. */
const BLOCKS_WINDOW_MS = 90_000;

export function createLiveRuntime(
  config: Config,
  log: Logger,
  client: UpstreamClient,
  clock: Clock = systemClock,
): Runtime {
  const api = config.upstream.fluxApi;
  const daemon = new DaemonApi(client, api);
  const blocks = new BlockWatcher({
    source: daemon,
    log,
    clock,
    fastMs: config.intervals.blockFastMs,
    slowMs: config.intervals.blockSlowMs,
  });
  const fallback = buildFallback();
  const network = new NetworkService({
    daemon,
    stats: new StatsApi(client, config.upstream.stats),
    apps: new AppsApi(client, api[0] as string),
    market: new MarketApi(client, config.upstream.market, config.upstream.marketFallback),
    blocks,
    config: config.intervals,
    fallback,
    clock,
    log,
  });

  let blocksVersion = -1;
  let blocksCached: BlocksSnapshot = { blocks: [] };

  const blocksReader: BlocksReader = {
    snapshot(): Served<BlocksSnapshot> {
      if (blocks.version !== blocksVersion) {
        blocksVersion = blocks.version;
        blocksCached = blocks.snapshot();
      }
      const at = blocks.lastPollOkAt;
      if (blocksCached.blocks.length === 0 || at === null) {
        return {
          data: fallback.blocks,
          asOfMs: fallback.asOfMs,
          source: 'fallback',
          windowMs: BLOCKS_WINDOW_MS,
        };
      }
      return {
        data: blocksCached,
        asOfMs: at,
        source: clock.now() - at <= BLOCKS_WINDOW_MS ? 'live' : 'cache',
        windowMs: BLOCKS_WINDOW_MS,
      };
    },
    tip: () => {
      const t = blocks.tip();
      return t ? { height: t.height, timeMs: t.timeMs, txCount: t.txCount } : null;
    },
    measuredBlockSec: () => blocks.measuredBlockSec(),
  };

  const market: MarketReader = {
    fluxUsd() {
      const r = network.market.peek();
      if (r.value === null || r.fetchedAt === null) {
        return { value: null, asOf: null, asOfMs: null, source: 'fallback' };
      }
      return {
        value: r.value.priceUsd,
        asOf: new Date(r.fetchedAt).toISOString(),
        asOfMs: r.fetchedAt,
        source: r.fresh ? 'live' : 'cache',
      };
    },
  };

  return {
    mode: 'live',
    network: { snapshot: () => network.network() },
    geo: { snapshot: () => network.geo() },
    blocks: blocksReader,
    market,
    start() {
      blocks.start();
      network.start();
    },
    async stop() {
      network.stop();
      await blocks.stop();
    },
    onBlock: (fn) => blocks.onBlock(fn),
    onNetwork: (fn) => network.onChange(fn),
  };
}

// ---------------------------------------------------------------------------
// Fixtures: fully offline, deterministic, always labelled `fallback`
// ---------------------------------------------------------------------------

function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createFixturesRuntime(
  _config: Config,
  log: Logger,
  clock: Clock = systemClock,
  /** Simulated block interval; 30 s like the chain. Tests shorten it. */
  blockMs = 30_000,
): Runtime {
  const fallback = buildFallback();
  const bootMs = Math.floor(clock.now() / 1000) * 1000;
  const startHeight = fallback.network.chain.height;
  const blockList: { height: number; timeMs: number; txCount: number }[] = [];
  for (let i = 119; i >= 0; i--) {
    const height = startHeight - i;
    blockList.push({ height, timeMs: bootMs - i * 30_000, txCount: 5 + (stableHash(`b${height}`) % 14) });
  }
  const blockListeners = new Set<(e: BlockEvent) => void>();
  const networkListeners = new Set<(s: NetworkSnapshot) => void>();
  let timer: NodeJS.Timeout | null = null;
  const windowMs = 90_000;

  const lastBlock = () =>
    blockList[blockList.length - 1] as { height: number; timeMs: number; txCount: number };

  const networkSnapshot = (): NetworkSnapshot => {
    const tip = lastBlock();
    const { rewards } = computeRewards({ height: tip.height, tipTimeMs: tip.timeMs });
    const base = fallback.network;
    return {
      ...base,
      chain: {
        height: tip.height,
        tipTime: new Date(tip.timeMs).toISOString(),
        targetBlockSec: TARGET_BLOCK_SEC,
        measuredBlockSec: 30,
        consensus: 'Proof of Node',
      },
      rewards,
      nodes: { ...base.nodes, collateral: { ...COLLATERAL } },
      market: { priceUsd: 0.085, change24hPct: 3.04, marketCapUsd: 35_900_000 },
      freshness: { chain: null, nodes: null, capacity: null, apps: null, market: null },
    };
  };

  const blocksSnapshot = (): BlocksSnapshot => ({
    blocks: blockList.map((b, i) => ({
      height: b.height,
      time: new Date(b.timeMs).toISOString(),
      intervalSec: i === 0 ? null : (b.timeMs - (blockList[i - 1] as { timeMs: number }).timeMs) / 1000,
      txCount: b.txCount,
    })),
  });

  let networkCached = networkSnapshot();
  let blocksCached = blocksSnapshot();

  return {
    mode: 'fixtures',
    network: {
      snapshot: () => ({ data: networkCached, asOfMs: lastBlock().timeMs, source: 'fallback', windowMs }),
    },
    geo: { snapshot: () => ({ data: fallback.geo, asOfMs: bootMs, source: 'fallback', windowMs: 900_000 }) },
    blocks: {
      snapshot: () => ({ data: blocksCached, asOfMs: lastBlock().timeMs, source: 'fallback', windowMs }),
      tip: () => {
        const t = lastBlock();
        return { height: t.height, timeMs: t.timeMs, txCount: t.txCount };
      },
      measuredBlockSec: () => 30,
    },
    market: {
      fluxUsd: () => ({
        value: 0.085,
        asOf: new Date(bootMs).toISOString(),
        asOfMs: bootMs,
        source: 'fallback',
      }),
    },
    start() {
      log.warn('FIXTURES=1: serving simulated data, upstreams are disabled. Never use in production.');
      timer = setInterval(() => {
        const height = lastBlock().height + 1;
        const timeMs = Math.floor(clock.now() / 1000) * 1000;
        blockList.push({ height, timeMs, txCount: 5 + (stableHash(`b${height}`) % 14) });
        if (blockList.length > 120) blockList.shift();
        blocksCached = blocksSnapshot();
        networkCached = networkSnapshot();
        const ev: BlockEvent = {
          height,
          time: new Date(timeMs).toISOString(),
          txCount: lastBlock().txCount,
        };
        for (const fn of blockListeners) fn(ev);
        for (const fn of networkListeners) fn(networkCached);
      }, blockMs);
      timer.unref();
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    onBlock: (fn) => {
      blockListeners.add(fn);
      return () => blockListeners.delete(fn);
    },
    onNetwork: (fn) => {
      networkListeners.add(fn);
      return () => networkListeners.delete(fn);
    },
  };
}
