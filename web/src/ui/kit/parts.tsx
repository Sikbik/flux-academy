import { type CSSProperties, type ReactNode, useSyncExternalStore } from 'react';
import styles from './kit.module.css';

/** What every gallery section file exports next to its default component. */
export interface KitSectionMeta {
  /** Hash and `?only=` id, kebab-case. */
  id: string;
  /** Heading shown in the gallery and the jump bar. */
  title: string;
  /** Sort key. Foundations 10-19, surfaces 20-29, controls 30-49, overlays 50-59, data 60-79, marks 80-99. */
  order: number;
}

/** A gallery section: an anchor, a heading, a one-line lead and the specimens. */
export function Group({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.group} aria-labelledby={`${id}-t`}>
      <div className={styles.groupHead}>
        <h2 id={`${id}-t`} className={styles.groupTitle}>
          {title}
        </h2>
        {lead ? <p className={styles.groupLead}>{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** An auto-fit grid of specimens. `min` is the smallest column in px. */
export function Grid({ min, children }: { min?: number; children: ReactNode }) {
  return (
    <div className={styles.grid} style={min ? ({ '--min': `${min}px` } as CSSProperties) : undefined}>
      {children}
    </div>
  );
}

/** One labelled specimen: a mono caption, the thing, and an optional note beneath. */
export function Spec({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.spec}>
      <span className={styles.specLabel}>{label}</span>
      {children}
      {note ? <span className={styles.specNote}>{note}</span> : null}
    </div>
  );
}

/** A wrapping row of things. */
export function Row({ children, align }: { children: ReactNode; align?: 'end' | 'baseline' | 'start' }) {
  return (
    <div
      className={styles.row}
      style={
        align
          ? { alignItems: align === 'end' ? 'flex-end' : align === 'start' ? 'flex-start' : 'baseline' }
          : undefined
      }
    >
      {children}
    </div>
  );
}

/** A vertical stack. */
export function Col({ children, gap }: { children: ReactNode; gap?: number }) {
  return (
    <div className={styles.col} style={gap ? ({ '--gap': `${gap}px` } as CSSProperties) : undefined}>
      {children}
    </div>
  );
}

/** A subheading inside a group. */
export function Sub({ children }: { children: ReactNode }) {
  return <h3 className={styles.sub}>{children}</h3>;
}

function subscribeRoot(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true });
  return () => mo.disconnect();
}

/** The computed value of a custom property on <html>, live across accent changes. */
export function useTokenValue(name: string): string {
  return useSyncExternalStore(
    subscribeRoot,
    () => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => '',
  );
}

/** A colour swatch: the token's name, its resolved value, and what it is for. */
export function Swatch({ token, note, border }: { token: string; note?: string; border?: boolean }) {
  const value = useTokenValue(token);
  return (
    <div className={styles.chip}>
      <span
        className={styles.chipColour}
        style={{ background: `var(${token})`, borderColor: border ? 'var(--line-3)' : undefined }}
      />
      <span>{token}</span>
      <span className={styles.mono}>{value}</span>
      {note ? <span className={styles.mono}>{note}</span> : null}
    </div>
  );
}

/** A grid of swatches. */
export function SwatchGrid({ children }: { children: ReactNode }) {
  return <div className={styles.swatchGrid}>{children}</div>;
}
