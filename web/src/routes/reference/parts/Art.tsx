import type { CSSProperties } from 'react';
import { type ArtId, art } from '@/content/art';
import { cn } from '@/lib/cn';
import styles from './parts.module.css';

/**
 * Generated emissive art (light on pure black), fitted so its lit part fills a square of `size` px.
 * Drawn with `mix-blend-mode: screen`, so it has no box. Decorative: the name beside it says what it is.
 */
export function Art({ id, size, className }: { id: ArtId; size: number; className?: string }) {
  const a = art(id);
  const [l, t, r, b] = a.box;
  const lit = Math.max(r - l, b - t, 0.05);
  const img = size / lit;
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
      className={cn(styles.art, className)}
      aria-hidden="true"
      style={{ inlineSize: size, blockSize: size }}
    >
      <picture>
        {a.avif ? <source srcSet={a.avif} type="image/avif" /> : null}
        <img
          src={a.src}
          alt=""
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
