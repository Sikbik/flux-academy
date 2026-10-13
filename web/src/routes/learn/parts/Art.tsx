import type { CSSProperties } from 'react';
import { type ArtId, art } from '@/content/art';

export interface ArtProps {
  id: ArtId;
  /** The square the lit part of the art is fitted into, px. */
  size: number;
  className?: string;
  /** Describe it when the art stands alone; leave empty beside its own visible name. */
  alt?: string;
}

/**
 * Generated emissive art (light on pure black) fitted so its lit content fills a square of `size`.
 * Drawn with `mix-blend-mode: screen`, so there is no box; the glow is allowed to spill.
 */
export function Art({ id, size, className, alt = '' }: ArtProps) {
  const a = art(id);
  const [l, t, r, b] = a.box;
  const lit = Math.max(r - l, b - t, 0.05);
  const k = 1 / lit;
  const img = size * k;
  const style: CSSProperties = {
    position: 'absolute',
    inlineSize: img,
    blockSize: img,
    maxInlineSize: 'none',
    insetInlineStart: size / 2 - ((l + r) / 2) * img,
    insetBlockStart: size / 2 - ((t + b) / 2) * img,
    mixBlendMode: a.blend === 'screen' ? 'screen' : undefined,
    pointerEvents: 'none',
    userSelect: 'none',
  };
  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'inline-block',
        inlineSize: size,
        blockSize: size,
        flex: 'none',
      }}
      aria-hidden={alt ? undefined : true}
    >
      <picture>
        {a.avif ? <source srcSet={a.avif} type="image/avif" /> : null}
        <img
          src={a.src}
          alt={alt}
          width={a.width}
          height={a.height}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={style}
        />
      </picture>
    </span>
  );
}
