import { BAKED_PRICING, FIXTURES, quote } from '@shared/flux';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DIAGRAM_BEAT_COUNTS } from '@/content/catalog';
import type { DiagramProps } from '@/learn/stage-api';
import { WidthOverride } from './_kit/Diagram';
import { CATALOG_ORDER, type DiagramModule } from './_kit/registry';

// Every diagram is a file in this folder; the test files and `_`-folders are not.
const found = import.meta.glob('./*.tsx', { eager: true }) as Record<string, DiagramModule>;
const modules = new Map<string, DiagramModule>();
for (const [path, mod] of Object.entries(found)) {
  const m = /\.\/([^/]+)\.tsx$/.exec(path);
  if (m?.[1] && !m[1].endsWith('.test')) modules.set(m[1], mod);
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
/** An em dash, an en dash, or two hyphens standing in for one. Built from a string so no dash is typed here. */
const DASHES = /\u2014|\u2013| -- /;

function html(mod: DiagramModule, p: Partial<DiagramProps> & { beat: number }, width?: number): string {
  const el = createElement(mod.default, { reducedMotion: true, props: p.props, beat: p.beat });
  return renderToStaticMarkup(
    width === undefined ? el : createElement(WidthOverride.Provider, { value: width }, el),
  );
}

/** The widths a figure meets: a phone, a tablet, the lesson stage on laptops, and a wide article column. */
const WIDTHS = [288, 320, 360, 400, 440, 479, 480, 520, 559, 560, 599, 600, 640, 680, 720, 760, 840, 920];

describe('the catalogue', () => {
  it('ships exactly the diagrams the lessons are written against', () => {
    expect([...modules.keys()].sort()).toEqual([...CATALOG_ORDER].sort());
  });

  for (const id of CATALOG_ORDER) {
    describe(id, () => {
      const mod = modules.get(id) as DiagramModule;

      it('exports its meta and a component', () => {
        expect(typeof mod.default).toBe('function');
        expect(mod.meta.id).toBe(id);
        expect(mod.meta.title.length).toBeGreaterThan(3);
        expect(mod.meta.alt.length).toBeGreaterThan(40);
      });

      it('has the beats the catalogue declares', () => {
        expect(mod.meta.beats).toHaveLength(DIAGRAM_BEAT_COUNTS[id as keyof typeof DIAGRAM_BEAT_COUNTS]);
      });

      it('words its captions as plain sentences', () => {
        for (const caption of [...mod.meta.beats, mod.meta.alt, mod.meta.title]) {
          expect(caption, caption).not.toMatch(DASHES);
          expect(caption, caption).not.toMatch(EMOJI);
          expect(caption, caption).toBe(caption.trim());
        }
        expect(mod.meta.title.length).toBeLessThanOrEqual(48);
        expect(mod.meta.alt.length).toBeLessThanOrEqual(700);
        for (const caption of mod.meta.beats) {
          expect(caption, caption).toMatch(/[.]$/);
          expect(caption.length, caption).toBeLessThanOrEqual(140);
        }
      });

      it('renders every beat as an accessible svg without broken numbers', () => {
        mod.meta.beats.forEach((_, beat) => {
          const out = html(mod, { beat });
          expect(out, `beat ${beat}`).toContain('<svg');
          expect(out).toContain('role="img"');
          expect(out).toContain('<title');
          expect(out).toContain('<desc');
          expect(out).toContain(`data-beat="${beat}"`);
          expect(out, `beat ${beat}`).not.toMatch(/NaN|undefined|Infinity|\[object/);
        });
      });

      it('survives props of the wrong type', () => {
        const hostile = {
          counts: 'many',
          collateral: [1, 2],
          payout: null,
          basis: 7,
          quote: 42,
          fixture: { id: 1 },
          app: {},
          components: 7,
          repotag: ['x'],
          port: 'eighty',
          containerPort: -4,
          appPort: Number.NaN,
          blockSec: -5,
          expire: 'many',
          dockerfile: 12,
          domain: false,
        };
        for (const beat of [0, mod.meta.beats.length - 1]) {
          const out = html(mod, { beat, props: hostile });
          expect(out).toContain('<svg');
          expect(out).not.toMatch(/NaN|undefined|Infinity/);
        }
      });

      it('clamps a beat that is out of range', () => {
        const last = mod.meta.beats.length - 1;
        expect(html(mod, { beat: 99 })).toContain(`data-beat="${last}"`);
        expect(html(mod, { beat: -3 })).toContain('data-beat="0"');
        expect(html(mod, { beat: Number.NaN })).toContain('data-beat="0"');
      });
    });
  }
});

describe('layout at every width', () => {
  // Text a layout cannot fit ends in "..." (see wrapClamp) instead of vanishing. The two allowed cases are
  // the owner address in a spec, which is shortened on purpose, and clipped Dockerfile arguments.
  const ELLIPSIS_OK = /1hjy4bCYBJ\.\.\./g;

  for (const id of CATALOG_ORDER) {
    it(`${id} lays out every beat at every width without cutting text short`, () => {
      const mod = modules.get(id) as DiagramModule;
      for (const width of WIDTHS) {
        mod.meta.beats.forEach((_, beat) => {
          const out = html(mod, { beat }, width);
          expect(out, `${id} w${width} beat ${beat}`).toContain(`data-w="${width}"`);
          expect(out, `${id} w${width} beat ${beat}`).not.toMatch(/NaN|undefined|Infinity/);
          const text = out.replace(ELLIPSIS_OK, '');
          expect(text.includes('...'), `${id} w${width} beat ${beat} cuts a sentence short`).toBe(false);
        });
      }
    });
  }
});

describe('data driven figures', () => {
  const get = (id: string) => modules.get(id) as DiagramModule;

  it('tier-ladder shows the counts it is given and says where they came from', () => {
    const out = html(get('tier-ladder'), {
      beat: 0,
      props: { counts: { cumulus: 1111, nimbus: 2222, stratus: 3333 }, basis: 'live' },
    });
    expect(out).toContain('1,111');
    expect(out).toContain('2,222');
    expect(out).toContain('3,333');
    expect(out).toContain('LIVE COUNTS');
    expect(html(get('tier-ladder'), { beat: 0 })).toContain('SAMPLE COUNTS');
  });

  it('block-clock follows blockSec and expire', () => {
    const base = html(get('block-clock'), { beat: 3 });
    const longer = html(get('block-clock'), { beat: 3, props: { expire: 264_000 } });
    expect(base).toContain('88,000');
    expect(longer).toContain('264,000');
    const slow = html(get('block-clock'), { beat: 1, props: { blockSec: 60 } });
    expect(slow).toContain('1,440');
  });

  it('internal-dns builds the names from the app and its components', () => {
    const out = html(get('internal-dns'), {
      beat: 1,
      props: { app: 'shop', components: ['front', 'orders', 'pg'] },
    });
    expect(out).toContain('fluxfront_shop');
    expect(out).toContain('fluxorders_shop');
    expect(out).toContain('fluxpg_shop');
    expect(out).toContain('fluxDockerNetwork_shop');
  });

  it('repotag-anatomy splits the tag it is given', () => {
    const out = html(get('repotag-anatomy'), {
      beat: 3,
      props: { repotag: 'ghcr.io/acme/web-app:2.4.1' },
    });
    expect(out).toContain('ghcr.io');
    expect(out).toContain('acme');
    expect(out).toContain('web-app');
    expect(out).toContain('2.4.1');
  });

  it('port-mapping writes the numbers into the spec lines', () => {
    const out = html(get('port-mapping'), { beat: 1, props: { port: 31777, containerPort: 8123 } });
    expect(out).toContain('31777');
    expect(out).toContain('8123');
  });

  it('price-waterfall draws the quote it is given, to the cent', () => {
    for (const fx of FIXTURES) {
      const q = quote(fx.spec, BAKED_PRICING.params, { fluxUsd: 0.085 });
      const out = html(get('price-waterfall'), { beat: 6, props: { quote: q } });
      expect(out, fx.id).toContain(`$${q.usdPerMonth.toFixed(2)}`);
      expect(out, fx.id).not.toMatch(/NaN|undefined/);
    }
  });

  it('spec-anatomy lists the fields of the fixture it is given', () => {
    const fx = FIXTURES.find((f) => f.id !== 'hello-world') ?? FIXTURES[0];
    if (!fx) throw new Error('no fixtures');
    const out = html(get('spec-anatomy'), { beat: 2, props: { fixture: fx.id } });
    expect(out).toContain(fx.spec.name);
  });
});
