/**
 * The built-in sample world: what the app shows when the API has never answered, and in `?demo=1`.
 *
 * Every payload built here is tagged `meta.source: 'fallback'` and dated `BAKED_AS_OF`, so the UI can
 * only ever present it as "offline, as of <date>". It is never used as live data and it never drives
 * the chain clock or a block pulse. Lessons and labs still work against it.
 *
 * Numbers are real values captured from the public Flux API on the bake date (the same capture the
 * server serves as its own fallback, trimmed to the 150 largest geo clusters and the last 60 blocks).
 * Pricing parameters are the official rates verified on the same date
 * (docs/research/samples/price-verification-80-cases.json). They are a stand-in, not a record: nothing
 * here should be copied elsewhere as fact.
 *
 * To refresh: take `BAKED` from `server/src/data/baked.ts`, keep the 150 largest geo points by node
 * count and the last 60 blocks, and replace the tables below.
 */

import type {
  BlocksSnapshot,
  GeoCountry,
  GeoPoint,
  GeoSnapshot,
  Meta,
  NetworkSnapshot,
  PricingSnapshot,
} from '@shared/api';

/** When these numbers were captured. The UI shows this as "as of <date>". */
export const BAKED_AS_OF = '2026-10-12T20:21:28.753Z';
export const BAKED_HEIGHT = 3031465;
export const BAKED_TIP_SEC = 1791836434;
const TARGET_BLOCK_SEC = 30;
const REDUCTION_HEIGHT = 3_071_200;

export interface BakedSet {
  network: NetworkSnapshot;
  geo: GeoSnapshot;
  blocks: BlocksSnapshot;
  pricing: PricingSnapshot;
  /** The meta every baked payload carries (`source: 'fallback'`, `asOf: BAKED_AS_OF`). */
  meta: Meta;
}

/** The meta every baked payload carries. `stale` is true because it is, by definition, old. */
export function bakedMeta(): Meta {
  return { generatedAt: BAKED_AS_OF, asOf: BAKED_AS_OF, ageMs: 0, stale: true, source: 'fallback' };
}

// biome-ignore format: generated data
const NODES = { total: 7105, cumulus: 3584, nimbus: 1692, stratus: 1829 } as const;
// biome-ignore format: generated data
const CAPACITY = {"cores":57555,"ramTb":193.2,"ssdTb":3389.8,"reporting":6963} as const;
// biome-ignore format: generated data
const APPS = {"registered":2078,"running":1982} as const;
// biome-ignore format: generated data
const VERSIONS = {"fluxos":"8.20.0","daemon":"9.1.0"} as const;

/** [code, name, cumulus, nimbus, stratus] */
// biome-ignore format: generated data
const COUNTRIES: ReadonlyArray<readonly [string, string, number, number, number]> = [["DE","Germany",689,298,531],["US","United States",624,363,216],["FI","Finland",315,170,513],["FR","France",442,186,137],["DK","Denmark",451,60,9],["CA","Canada",173,157,40],["PL","Poland",31,54,148],["RU","Russia",118,52,21],["GB","United Kingdom",49,31,36],["NL","The Netherlands",64,23,17],["NO","Norway",33,29,30],["UA","Ukraine",21,41,8],["ES","Spain",5,7,57],["AE","United Arab Emirates",51,0,10],["JP","Japan",42,11,0],["BH","Bahrain",42,7,0],["CH","Switzerland",26,16,7],["AU","Australia",29,14,0],["CL","Chile",41,1,0],["LV","Latvia",39,2,1],["SE","Sweden",21,13,6],["SG","Singapore",27,9,0],["RO","Romania",11,11,13],["IT","Italy",16,15,2],["PT","Portugal",10,16,0],["SK","Slovakia",9,12,0],["BG","Bulgaria",15,2,1],["ZA","South Africa",10,1,7],["AR","Argentina",11,6,0],["HU","Hungary",11,4,1],["BE","Belgium",11,0,3],["MY","Malaysia",0,10,0],["CZ","Czechia",4,5,0],["IL","Israel",0,8,1],["DM","Dominica",1,7,0],["EE","Estonia",8,0,0],["HK","Hong Kong",4,2,2],["LT","Lithuania",8,0,0],["DZ","Algeria",7,0,0],["BR","Brazil",2,4,0],["GR","Greece",3,3,0],["LU","Luxembourg",6,0,0],["TR","Türkiye",0,3,3],["VN","Vietnam",6,0,0],["TH","Thailand",2,1,2],["IE","Ireland",4,0,0],["MD","Moldova",0,4,0],["AT","Austria",1,1,1],["PF","French Polynesia",2,0,0],["RS","Serbia",1,1,0],["IN","India",1,0,0],["KR","South Korea",1,0,0],["MX","Mexico",1,0,0],["NZ","New Zealand",0,0,1],["SI","Slovenia",1,0,0],["TW","Taiwan",0,0,1]];

/** [lat, lon, cumulus, nimbus, stratus, cc], the 150 largest clusters. */
// biome-ignore format: generated data
const POINTS: ReadonlyArray<readonly [number, number, number, number, number, string]> = [[60.17,24.93,306,165,513,"FI"],[50.48,12.36,100,101,348,"DE"],[50.16,8.49,497,38,0,"DE"],[55.68,12.52,415,46,0,"DK"],[49.4,11.1,28,146,173,"DE"],[48.86,2.35,199,64,14,"FR"],[35.78,-78.64,156,34,64,"US"],[50.59,3.15,81,16,103,"FR"],[52.23,21.01,10,45,138,"PL"],[49.25,-123.12,0,105,23,"CA"],[45.49,-73.56,85,24,5,"CA"],[37.21,-93.29,1,50,55,"US"],[47.22,38.92,91,2,2,"RU"],[43.08,-89.4,83,2,0,"US"],[51.83,4.61,62,15,1,"NL"],[35.53,-81.25,60,1,12,"US"],[45.2,5,45,23,2,"FR"],[51.06,30.97,21,41,7,"UA"],[59.94,30.33,15,33,19,"RU"],[25.03,55.36,51,0,10,"AE"],[40.84,-73.67,39,22,0,"US"],[38.98,-77.27,29,22,8,"US"],[40.47,-3.66,1,4,54,"ES"],[26.12,50.56,42,7,0,"BH"],[37.43,-84.03,0,47,0,"US"],[43.69,-79.44,27,15,3,"CA"],[55.82,11.5,28,6,9,"DK"],[-33.45,-70.66,41,1,0,"CL"],[48.12,-96.18,2,8,32,"US"],[56.95,24.1,39,2,1,"LV"],[51.03,7.22,26,8,7,"DE"],[59.44,5.27,15,16,8,"NO"],[52.67,13.34,34,4,0,"DE"],[46.99,-1.47,24,9,4,"FR"],[1.36,103.8,27,9,0,"SG"],[41.86,-87.78,23,11,2,"US"],[42.41,-83.16,7,26,0,"US"],[48.58,7.25,18,7,8,"FR"],[41.81,-88.33,0,31,1,"US"],[53.46,-2.24,0,9,22,"GB"],[35.69,139.72,19,11,0,"JP"],[43.46,5.22,17,12,0,"FR"],[51.54,-0.63,14,12,3,"GB"],[47.28,8.6,14,6,7,"CH"],[32.85,-96.85,23,1,2,"US"],[52.34,4.9,2,8,16,"NL"],[27.43,-82.5,19,5,1,"US"],[-37.79,145,16,8,0,"AU"],[59.76,10.57,14,2,8,"NO"],[46.55,6.83,12,10,0,"CH"],[48.71,-0.82,10,12,0,"FR"],[51.35,0.21,13,7,2,"GB"],[40.41,-74.91,11,7,3,"US"],[39.25,-84.43,8,12,0,"US"],[48.25,17.3,9,11,0,"SK"],[28.16,-82.6,16,2,1,"US"],[44.63,25.74,1,6,12,"RO"],[48.97,8.19,10,8,0,"FR"],[58.17,7.8,1,9,8,"NO"],[-34.59,-58.61,11,6,0,"AR"],[42.64,23.22,14,2,1,"BG"],[45.35,-75.77,12,2,3,"CA"],[52.19,-0.82,8,1,8,"GB"],[35.18,-83.39,8,3,5,"US"],[38.78,-9.18,0,16,0,"PT"],[48.84,-67.53,13,3,0,"CA"],[49.21,-124.02,14,2,0,"CA"],[49.32,1.44,6,9,1,"FR"],[58.39,13.85,10,6,0,"SE"],[45.48,9.19,6,8,0,"IT"],[45.51,-122.77,5,6,3,"US"],[50.31,18.77,14,0,0,"PL"],[63.1,22.74,9,5,0,"FI"],[34.14,-117.05,13,0,0,"US"],[44.45,26.19,10,2,1,"RO"],[50.87,4.35,10,0,3,"BE"],[39.9,-75.11,7,5,0,"US"],[41.72,-91.66,6,6,0,"US"],[-26.23,28.06,3,1,7,"ZA"],[26.58,-80.31,11,0,0,"US"],[51,-113.81,10,0,1,"CA"],[37.37,-77.36,4,2,4,"US"],[40.27,-76.86,2,8,0,"US"],[41.17,-8.62,10,0,0,"PT"],[42.27,-71.11,4,0,6,"US"],[47.73,-122.24,9,0,1,"US"],[50.92,20.67,0,0,10,"PL"],[-27.48,153.02,5,4,0,"AU"],[33.14,-95.6,9,0,0,"US"],[34.71,135.52,9,0,0,"JP"],[43.11,131.87,0,9,0,"RU"],[43.44,6.19,9,0,0,"FR"],[48.42,-71.07,7,2,0,"CA"],[59.28,18.1,3,2,4,"SE"],[-38.14,145.12,8,0,0,"AU"],[1.56,103.76,0,8,0,"MY"],[15.29,-61.38,1,7,0,"DM"],[22.37,114.14,4,2,2,"HK"],[26.25,127.71,8,0,0,"JP"],[38.96,-94.73,7,1,0,"US"],[40.16,-83.08,8,0,0,"US"],[41.2,-95.96,3,5,0,"US"],[41.48,-81.02,4,4,0,"US"],[42.97,-85.65,8,0,0,"US"],[43.43,1.45,2,4,2,"FR"],[43.5,-0.47,0,8,0,"FR"],[44.45,-89.28,0,1,7,"US"],[47.39,21.61,7,1,0,"HU"],[47.47,18.99,4,3,1,"HU"],[50.05,14.46,4,4,0,"CZ"],[51.13,17.06,0,8,0,"PL"],[54.69,25.28,8,0,0,"LT"],[55.5,8.91,0,8,0,"DK"],[56.15,10.2,8,0,0,"DK"],[56.82,60.62,0,8,0,"RU"],[56.83,13.94,6,2,0,"SE"],[59.44,24.74,8,0,0,"EE"],[-33.91,18.41,7,0,0,"ZA"],[31.87,34.73,0,6,1,"IL"],[35.23,-111.58,2,5,0,"US"],[36.74,3.12,7,0,0,"DZ"],[37.57,-83.71,0,7,0,"US"],[38.37,-0.49,4,2,1,"ES"],[44.36,11.71,6,1,0,"IT"],[46.43,4.94,6,1,0,"FR"],[46.8,-96.83,6,1,0,"US"],[54.98,82.9,7,0,0,"RU"],[55.47,-4.63,6,1,0,"GB"],[29.89,-98.69,0,4,2,"US"],[30.29,-81.64,0,4,2,"US"],[31.97,-102.14,0,6,0,"US"],[35.19,136.91,6,0,0,"JP"],[40.64,22.94,3,3,0,"GR"],[41.01,28.95,0,3,3,"TR"],[41.71,-85.98,6,0,0,"US"],[41.89,12.51,1,4,1,"IT"],[43.07,-86.23,6,0,0,"US"],[49.58,6.11,6,0,0,"LU"],[63.43,10.4,0,0,6,"NO"],[13.75,100.52,2,1,2,"TH"],[38.62,-90.24,0,5,0,"US"],[40.61,-79.7,4,0,1,"US"],[41.08,16.78,2,2,1,"IT"],[43.56,3.95,5,0,0,"FR"],[46.35,48.04,5,0,0,"RU"],[47.9,7.25,5,0,0,"FR"],[30.19,-95.54,1,2,1,"US"],[37.27,-121.85,3,1,0,"US"],[42.33,-82.94,1,3,0,"CA"],[45.57,2.94,0,4,0,"FR"]];

/** [height, unix seconds, seconds since the previous block], oldest first. */
// biome-ignore format: generated data
const BLOCKS: ReadonlyArray<readonly [number, number, number | null]> = [[3031406,1791834664,null],[3031407,1791834694,30],[3031408,1791834724,30],[3031409,1791834754,30],[3031410,1791834784,30],[3031411,1791834814,30],[3031412,1791834845,31],[3031413,1791834878,33],[3031414,1791834904,26],[3031415,1791834934,30],[3031416,1791834964,30],[3031417,1791834994,30],[3031418,1791835024,30],[3031419,1791835054,30],[3031420,1791835084,30],[3031421,1791835114,30],[3031422,1791835144,30],[3031423,1791835174,30],[3031424,1791835208,34],[3031425,1791835234,26],[3031426,1791835264,30],[3031427,1791835294,30],[3031428,1791835324,30],[3031429,1791835354,30],[3031430,1791835384,30],[3031431,1791835414,30],[3031432,1791835444,30],[3031433,1791835474,30],[3031434,1791835504,30],[3031435,1791835534,30],[3031436,1791835564,30],[3031437,1791835594,30],[3031438,1791835624,30],[3031439,1791835654,30],[3031440,1791835684,30],[3031441,1791835714,30],[3031442,1791835744,30],[3031443,1791835774,30],[3031444,1791835804,30],[3031445,1791835834,30],[3031446,1791835864,30],[3031447,1791835894,30],[3031448,1791835924,30],[3031449,1791835954,30],[3031450,1791835984,30],[3031451,1791836018,34],[3031452,1791836044,26],[3031453,1791836074,30],[3031454,1791836104,30],[3031455,1791836134,30],[3031456,1791836164,30],[3031457,1791836194,30],[3031458,1791836224,30],[3031459,1791836254,30],[3031460,1791836284,30],[3031461,1791836314,30],[3031462,1791836344,30],[3031463,1791836378,34],[3031464,1791836404,26],[3031465,1791836434,30]];

let memo: BakedSet | null = null;

function buildNetwork(): NetworkSnapshot {
  const tipMs = BAKED_TIP_SEC * 1000;
  const blocksAway = Math.max(0, REDUCTION_HEIGHT - BAKED_HEIGHT);
  return {
    chain: {
      height: BAKED_HEIGHT,
      tipTime: new Date(tipMs).toISOString(),
      targetBlockSec: TARGET_BLOCK_SEC,
      measuredBlockSec: null,
      consensus: 'Proof of Node',
    },
    rewards: {
      perBlock: 14,
      perTier: { cumulus: 1, nimbus: 3.5, stratus: 9 },
      devFund: 0.5,
      nextReduction: {
        height: REDUCTION_HEIGHT,
        blocksAway,
        etaIso: new Date(tipMs + blocksAway * TARGET_BLOCK_SEC * 1000).toISOString(),
        fraction: 0.1,
        perBlockAfter: 12.6,
        epochStartHeight: 2_020_000,
        epochBlocks: 1_051_200,
        index: 1,
        of: 20,
      },
    },
    nodes: {
      total: NODES.total,
      tiers: { cumulus: NODES.cumulus, nimbus: NODES.nimbus, stratus: NODES.stratus },
      collateral: { cumulus: 1000, nimbus: 12_500, stratus: 40_000 },
      countries: COUNTRIES.length,
    },
    capacity: { ...CAPACITY },
    apps: { ...APPS },
    // A months-old price would mislead, so the sample carries none.
    market: null,
    versions: { ...VERSIONS },
    freshness: { chain: null, nodes: null, capacity: null, apps: null, market: null },
  };
}

function buildGeo(): GeoSnapshot {
  const countries: GeoCountry[] = COUNTRIES.map(([code, name, c, n, s]) => ({
    code,
    name,
    nodes: c + n + s,
    tiers: { cumulus: c, nimbus: n, stratus: s },
  }));
  const points: GeoPoint[] = POINTS.map(([lat, lon, c, n, s, cc]) => {
    const p: GeoPoint = { lat, lon, n: c + n + s, t: [c, n, s] };
    if (cc) p.cc = cc;
    return p;
  });
  const located = countries.reduce((sum, c) => sum + c.nodes, 0);
  return { located, total: NODES.total, countries, points };
}

function buildBlocks(): BlocksSnapshot {
  return {
    blocks: BLOCKS.map(([height, sec, interval]) => ({
      height,
      time: new Date(sec * 1000).toISOString(),
      intervalSec: interval,
      txCount: null,
    })),
  };
}

function buildPricing(): PricingSnapshot {
  return {
    params: {
      height: -1,
      cpu: 0.15,
      ram: 0.05,
      hdd: 0.02,
      minPrice: 0.99,
      port: 2,
      scope: 4,
      staticip: 2,
      fluxmultiplier: 0.95,
      multiplier: 1,
      minUSDPrice: 0.99,
    },
    // No FLUX price is baked: a stale price is worse than none. Quotes then show USD only.
    fluxUsd: null,
    paramsSource: 'baked',
  };
}

/** The baked sample set. Built once on first use, never at import time. */
export function getBaked(): BakedSet {
  if (!memo) {
    memo = {
      network: buildNetwork(),
      geo: buildGeo(),
      blocks: buildBlocks(),
      pricing: buildPricing(),
      meta: bakedMeta(),
    };
  }
  return memo;
}
