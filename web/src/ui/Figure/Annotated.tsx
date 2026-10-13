import { type ReactNode, useRef } from 'react';
import { useElementSize } from '../hooks/useElementSize';
import { useInView } from '../hooks/useInView';
import { cn } from '../internal/cn';
import styles from './Annotated.module.css';
import { DrawContext } from './draw';
import type { Box } from './geometry';

export interface AnnotatedProps {
  /** The parts. A function receives the measured pixel box so parts can lay out in px. */
  children?: ReactNode | ((box: Box) => ReactNode);
  /**
   * Force the drawn state. By default the layer draws once, the first time it is scrolled
   * into view (and immediately when the page has no IntersectionObserver).
   */
  draw?: boolean;
  /** Fraction of the layer that must be visible to start drawing. Default 0.3. */
  threshold?: number;
  className?: string;
}

/**
 * An `<svg>` overlay that fills its positioned parent and holds annotation parts. It
 * measures itself, so children are laid out in the parent's own pixels (a 1:1 viewBox), and
 * it provides the `DrawContext`: parts draw themselves in, once, when the layer scrolls into
 * view. It is decorative (`aria-hidden`) and never takes pointer events; pair it with the
 * accessible legend that `Figure` renders.
 *
 *   <div style={{ position: 'relative' }}>
 *     <MyDiagram />
 *     <Annotated>{({ width, height }) => <Annotation anchor={{ x: width / 2, y: height / 2 }} n={1} />}</Annotated>
 *   </div>
 */
export function Annotated({ children, draw, threshold = 0.3, className }: AnnotatedProps) {
  const ref = useRef<SVGSVGElement>(null);
  const size = useElementSize(ref);
  const inView = useInView(ref, { once: true, threshold });
  const drawn = draw ?? inView;
  const measured = size.width > 0 && size.height > 0;
  const box: Box = { width: size.width, height: size.height };
  return (
    <svg
      ref={ref}
      className={cn(styles.layer, className)}
      viewBox={measured ? `0 0 ${size.width} ${size.height}` : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <DrawContext.Provider value={drawn}>
        {measured ? (typeof children === 'function' ? children(box) : children) : null}
      </DrawContext.Provider>
    </svg>
  );
}
