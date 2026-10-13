import type { ReactNode } from 'react';
import styles from './Frame.module.css';

/**
 * The frame around the map: a chamfered slab with a hairline edge and corner marks.
 *
 * It is not a `Panel` on purpose. A Panel puts its content in its own stacking context, and generated art
 * is composited with `mix-blend-mode: screen`: a blend only reaches what is in the same stacking context,
 * so art inside a Panel would show its black square. Here the slab is drawn by siblings of the content, so
 * the art and its dark backdrop are in one context and the black disappears.
 */
export function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`chamfer ${styles.frame} ${className ?? ''}`}>
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.fill} aria-hidden="true" />
      <span className={styles.marks} aria-hidden="true" />
      {children}
    </div>
  );
}
