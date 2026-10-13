import { type CSSProperties, type ElementType, type ReactNode, type Ref, useRef } from 'react';
import { useReveal } from '../hooks/useReveal';
import { cn } from '../internal/cn';
import { mergeRefs } from '../internal/refs';
import styles from './Reveal.module.css';

export interface RevealProps {
  /** Element to render. Default `div`. */
  as?: ElementType;
  /** Extra delay in ms. */
  delay?: number;
  /** Position in a staggered group: adds `index * 60 ms` to the delay. */
  index?: number;
  /** Where it travels from. Default `up`. */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  /** Animate the 8 px blur too. Default true. */
  blur?: boolean;
  /** Reveal on mount, for above-the-fold content. Default false (on entering the viewport). */
  immediate?: boolean;
  /** Reveal again whenever it re-enters. Default false. */
  repeat?: boolean;
  /** Hold the reveal (until an intro is done, say). */
  hold?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
  id?: string;
}

const STAGGER_MS = 60;

/**
 * Entrance: opacity 0 to 1, rise 24 px, un-blur 8 px, once, when it scrolls into view, with
 * a 60 ms stagger per `index`. Reduced motion collapses distance and blur to zero through the
 * tokens, leaving an opacity fade. Do not nest reveals and do not reveal more than a dozen
 * items individually (reveal the grid instead).
 *
 *   <Reveal><Panel>...</Panel></Reveal>
 *   {items.map((it, i) => <Reveal key={it.id} index={i}>...</Reveal>)}
 */
export function Reveal({
  as,
  delay = 0,
  index = 0,
  direction = 'up',
  blur = true,
  immediate = false,
  repeat = false,
  hold = false,
  className,
  style,
  children,
  ref,
  ...rest
}: RevealProps) {
  const Tag: ElementType = as ?? 'div';
  const local = useRef<HTMLElement | null>(null);
  const shown = useReveal(local, { immediate, repeat, hold });
  const total = delay + index * STAGGER_MS;
  return (
    <Tag
      ref={mergeRefs(local, ref)}
      className={cn(styles.reveal, className)}
      data-shown={shown ? 'true' : 'false'}
      data-dir={direction}
      data-blur={blur ? undefined : 'false'}
      style={total > 0 ? ({ ...style, '--rd': `${total}ms` } as CSSProperties) : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
