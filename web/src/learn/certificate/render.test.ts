import { describe, expect, it } from 'vitest';
import { CERT_HEIGHT, CERT_WIDTH, ROWS, safeRect } from './layout';
import { COLORS, drawCertificate } from './render';
import { buildCertificate } from './text';

interface TextCall {
  text: string;
  x: number;
  y: number;
  font: string;
  fill: string;
  align: string;
}

/** A canvas context that records what is drawn and measures text as 0.56 em per character. */
function recorder() {
  const texts: TextCall[] = [];
  const images: { w: number; h: number; x: number; y: number }[] = [];
  const state = { font: '10px sans-serif', fillStyle: '' as unknown, textAlign: 'start' };
  const noop = () => undefined;
  const ctx = {
    save: noop,
    restore: noop,
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    fill: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
    drawImage: (_i: unknown, x: number, y: number, w: number, h: number) => images.push({ x, y, w, h }),
    fillText: (text: string, x: number, y: number) =>
      texts.push({ text, x, y, font: state.font, fill: String(state.fillStyle), align: state.textAlign }),
    measureText: (t: string) => {
      const size = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? '10');
      return { width: Array.from(t).length * size * 0.56 };
    },
    set font(v: string) {
      state.font = v;
    },
    get font() {
      return state.font;
    },
    set fillStyle(v: unknown) {
      state.fillStyle = v;
    },
    get fillStyle() {
      return state.fillStyle;
    },
    set textAlign(v: string) {
      state.textAlign = v;
    },
    get textAlign() {
      return state.textAlign;
    },
    strokeStyle: '',
    lineWidth: 1,
    textBaseline: 'alphabetic',
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, images };
}

const ASSETS = { backdrop: {} as CanvasImageSource, lockup: {} as CanvasImageSource };
const NOW = new Date('2026-10-12T12:00:00Z');

describe('drawCertificate', () => {
  it('draws the backdrop across the whole plate and the lockup in the safe zone', () => {
    const { ctx, images } = recorder();
    drawCertificate(ctx, buildCertificate({ name: 'Alex Rivera', lessons: {}, now: NOW }), ASSETS);
    const [plate, lockup] = images;
    expect(plate).toEqual({ x: 0, y: 0, w: CERT_WIDTH, h: CERT_HEIGHT });
    const r = safeRect();
    expect(lockup?.y).toBeGreaterThanOrEqual(r.y);
    expect((lockup?.x ?? 0) + (lockup?.w ?? 0)).toBeLessThanOrEqual(r.x + r.width);
    expect(lockup?.x).toBeGreaterThanOrEqual(r.x);
    expect(lockup?.h).toBe(ROWS.lockupHeight);
  });

  it('prints the name, the rank, the date and both disclaimer lines', () => {
    const { ctx, texts } = recorder();
    const model = buildCertificate({ name: 'Alex Rivera', lessons: {}, now: NOW });
    drawCertificate(ctx, model, ASSETS);
    const all = texts.map((t) => t.text).join('');
    expect(all).toContain('Alex Rivera');
    expect(all).toContain(model.rank);
    expect(all).toContain(model.disclaimer);
    expect(all).toContain(model.disclaimerDetail);
    expect(all.replace(/\s+/g, '')).toContain(model.date.toUpperCase().replace(/\s+/g, ''));
  });

  it('keeps every full-width line inside the safe zone, even for a very long name', () => {
    const r = safeRect();
    for (const name of ['Al', 'Maximilian Alexander von Hohenzollern-Sigmaringen the Third of Wherever']) {
      const { ctx, texts } = recorder();
      drawCertificate(ctx, buildCertificate({ name, lessons: {}, now: NOW }), ASSETS);
      for (const t of texts) {
        const size = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(t.font)?.[1] ?? '10');
        // Tracked rows are drawn one glyph at a time (align left): check the whole row instead.
        if (t.align === 'left') continue;
        const width = Array.from(t.text).length * size * 0.56;
        expect(t.x - width / 2, `${t.text} left`).toBeGreaterThanOrEqual(r.x - 1);
        expect(t.x + width / 2, `${t.text} right`).toBeLessThanOrEqual(r.x + r.width + 1);
        expect(t.y).toBeGreaterThan(r.y);
        expect(t.y).toBeLessThan(r.y + r.height);
      }
    }
  });

  it('draws tracked rows inside the safe zone too', () => {
    const r = safeRect();
    const { ctx, texts } = recorder();
    drawCertificate(ctx, buildCertificate({ name: 'Alex', lessons: {}, now: NOW }), ASSETS);
    const tracked = texts.filter((t) => t.align === 'left');
    expect(tracked.length).toBeGreaterThan(0);
    for (const t of tracked) {
      expect(t.x).toBeGreaterThanOrEqual(r.x);
      expect(t.x).toBeLessThanOrEqual(r.x + r.width);
    }
  });

  it('colours the rank with the colour of its tier', () => {
    const { ctx, texts } = recorder();
    drawCertificate(ctx, buildCertificate({ name: 'A', lessons: {}, now: NOW }), ASSETS);
    const rank = texts.find((t) => t.text === 'Cumulus Operator');
    expect(rank?.fill).toBe(COLORS.tier.cumulus);
  });

  it('is deterministic', () => {
    const model = buildCertificate({ name: 'Alex Rivera', lessons: {}, now: NOW });
    const a = recorder();
    const b = recorder();
    drawCertificate(a.ctx, model, ASSETS);
    drawCertificate(b.ctx, model, ASSETS);
    expect(a.texts).toEqual(b.texts);
    expect(a.images).toEqual(b.images);
  });
});
