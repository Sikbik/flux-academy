import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ART,
  ART_IDS,
  type ArtAsset,
  type ArtId,
  art,
  isArtId,
  labArt,
  medalArt,
  moduleArt,
  TRACK_ART,
} from './art.ts';

const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url));
const BUILD_MANIFEST = fileURLToPath(new URL('../../../assets-src/art-manifest.json', import.meta.url));

/** Budgets from docs/DESIGN.md section 10 (each file 120 KB, sprites 60 KB, total art 1.4 MB). */
const EACH_KB = 120;
const SPRITE_KB = 60;
const TOTAL_KB = 1.4 * 1024;

/** The art ids other agents reference (docs/DESIGN.md section 9 and docs/CONTENT.md section 6). */
const REQUIRED: ArtId[] = [
  'track-cumulus',
  'track-nimbus',
  'track-stratus',
  'mod-network',
  'mod-containers',
  'mod-setup',
  'mod-deploy',
  'mod-traffic',
  'mod-projects',
  'mod-operate',
  'mod-resilience',
  'mod-state',
  'mod-architecture',
  'lab-spec-forge',
  'lab-network',
  'lab-failover',
  'lab-terminal',
  'lab-explorer',
  'lab-agent-desk',
  'bg-bench',
  'sprite-bokeh',
  'sprite-streak',
  'sprite-dirt',
  'medal-first-light',
  'medal-three-is-company',
  'medal-first-blood',
  'medal-spec-whisperer',
  'medal-penny-pincher',
  'medal-block-watcher',
  'medal-globetrotter',
  'medal-shell-shocked',
  'medal-explorer',
  'medal-cumulus-operator',
  'medal-nimbus-engineer',
  'medal-stratus-architect',
  'certificate-backdrop',
];

const ACHIEVEMENTS = [
  'first-light',
  'three-is-company',
  'first-blood',
  'spec-whisperer',
  'penny-pincher',
  'block-watcher',
  'globetrotter',
  'shell-shocked',
  'explorer',
  'cumulus-operator',
  'nimbus-engineer',
  'stratus-architect',
];

const publicFile = (url: string) => `${PUBLIC_DIR}${url}`;
const kb = (path: string) => statSync(path).size / 1024;
const files = (a: ArtAsset) => [a.src, ...(a.avif ? [a.avif] : [])];
const limitKb = (id: ArtId) => (ART[id].sprite ? SPRITE_KB : EACH_KB);

/** Pixel size from a WebP header (VP8, VP8L or VP8X), so the manifest cannot drift from the file. */
function webpSize(path: string): { width: number; height: number } {
  const b = readFileSync(path);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') {
    return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  }
  throw new Error(`not a WebP file: ${path}`);
}

describe('art manifest', () => {
  it('has every piece the brief names, and nothing is undocumented', () => {
    for (const id of REQUIRED) expect(isArtId(id), id).toBe(true);
    expect([...ART_IDS].sort()).toEqual([...REQUIRED].sort());
  });

  it('points at files that exist, with the sizes the manifest states', () => {
    for (const id of ART_IDS) {
      const a = art(id);
      expect(a.src, id).toMatch(/^\/art\/[a-z0-9-]+\.webp$/);
      expect(existsSync(publicFile(a.src)), `${id} webp`).toBe(true);
      if (a.avif) {
        expect(a.avif, id).toMatch(/^\/art\/[a-z0-9-]+\.avif$/);
        expect(existsSync(publicFile(a.avif)), `${id} avif`).toBe(true);
      }
      expect(webpSize(publicFile(a.src)), `${id} dimensions`).toEqual({ width: a.width, height: a.height });
    }
  });

  it('keeps every file under its byte budget', () => {
    for (const id of ART_IDS) {
      for (const f of files(art(id))) {
        expect(kb(publicFile(f)), `${f} is ${kb(publicFile(f)).toFixed(1)} KB`).toBeLessThanOrEqual(
          limitKb(id),
        );
      }
    }
  });

  it('keeps the whole set under the total budget (WebP, the format every browser can use)', () => {
    const total = ART_IDS.reduce((sum, id) => sum + kb(publicFile(art(id).src)), 0);
    expect(total, `total ${total.toFixed(0)} KB`).toBeLessThanOrEqual(TOTAL_KB);
  });

  it('only ships an AVIF where it is actually smaller', () => {
    for (const id of ART_IDS) {
      const a = art(id);
      if (a.avif) expect(kb(publicFile(a.avif)), id).toBeLessThan(kb(publicFile(a.src)));
    }
  });

  it('describes every non-decorative piece and silences every decorative one', () => {
    for (const id of ART_IDS) {
      const a = art(id);
      if (a.decorative) {
        expect(a.alt, id).toBe('');
      } else {
        expect(a.alt.length, id).toBeGreaterThan(20);
        expect(a.alt, id).not.toMatch(/[—–]/);
        expect(a.alt, id).not.toMatch(/\b(image|picture|photo) of\b/i);
      }
      expect(a.avg, id).toMatch(/^#[0-9a-f]{6}$/);
      expect(['screen', 'normal']).toContain(a.blend);
      expect(['flux', 'cumulus', 'nimbus', 'stratus']).toContain(a.accent);
      expect(a.box, id).toHaveLength(4);
    }
  });

  it('uses tier colours only for tracks and ranks', () => {
    for (const id of ART_IDS) {
      const a = art(id);
      if (
        a.group === 'tracks' ||
        id.endsWith('-operator') ||
        id.endsWith('-engineer') ||
        id.endsWith('-architect')
      ) {
        continue;
      }
      expect(a.accent, id).toBe('flux');
    }
    expect(art('track-cumulus').accent).toBe('cumulus');
    expect(art('track-nimbus').accent).toBe('nimbus');
    expect(art('track-stratus').accent).toBe('stratus');
    expect(art('medal-cumulus-operator').accent).toBe('cumulus');
    expect(art('medal-nimbus-engineer').accent).toBe('nimbus');
    expect(art('medal-stratus-architect').accent).toBe('stratus');
  });

  it('says how each sprite composites', () => {
    const sprites = ART_IDS.filter((id) => id.startsWith('sprite-'));
    expect(sprites).toHaveLength(3);
    for (const id of sprites) {
      const a = art(id);
      expect(a.decorative, id).toBe(true);
      // Real transparency, or light on pure black for additive (screen) blending: the manifest says which.
      expect(a.sprite === (a.alpha ? 'alpha' : 'additive'), id).toBe(true);
      if (a.sprite === 'additive') expect(a.blend, id).toBe('screen');
    }
  });

  it('resolves art from curriculum ids', () => {
    expect(TRACK_ART.cumulus).toBe('track-cumulus');
    expect(moduleArt('The network')).toBe('mod-network');
    expect(moduleArt('Containers')).toBe('mod-containers');
    expect(moduleArt('Architecture')).toBe('mod-architecture');
    expect(moduleArt('Nonsense')).toBeUndefined();
    expect(labArt('spec-forge')).toBe('lab-spec-forge');
    expect(labArt('explorer')).toBe('lab-explorer');
    expect(labArt('agent-desk')).toBe('lab-agent-desk');
    expect(labArt('nope')).toBeUndefined();
    for (const id of ACHIEVEMENTS) expect(medalArt(id), id).toBe(`medal-${id}`);
    expect(medalArt('nope')).toBeUndefined();
  });

  const build = existsSync(BUILD_MANIFEST)
    ? (JSON.parse(readFileSync(BUILD_MANIFEST, 'utf8')) as {
        art: { id: string; blend: string; cornerMax: number; ringMax: number; group: string }[];
      })
    : null;

  // Measured by web/scripts/optimize-art.mjs on the final pixels: the brightest level (0 to 255) in a 3
  // percent patch at each corner, and on the outer one-pixel ring. 4/255 is invisible under screen blending.
  it.skipIf(!build)('keeps screen-blended art pure black at its corners and edges', () => {
    for (const a of build?.art ?? []) {
      if (a.blend !== 'screen' || a.id === 'sprite-dirt') continue;
      expect(a.cornerMax, `${a.id} corner`).toBeLessThanOrEqual(4);
      expect(a.ringMax, `${a.id} edge ring`).toBeLessThanOrEqual(1);
    }
  });
});
