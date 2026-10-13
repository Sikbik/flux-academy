import {
  Children,
  type CSSProperties,
  cloneElement,
  type ElementType,
  Fragment,
  isValidElement,
  type ReactNode,
  type Ref,
  useLayoutEffect,
  useRef,
} from 'react';
import { useReveal } from '../hooks/useReveal';
import { cn } from '../internal/cn';
import { mergeRefs } from '../internal/refs';
import styles from './SplitReveal.module.css';

export interface SplitRevealProps {
  /** Element to render. Default `span`; use `h1`, `h2`, `p`. */
  as?: ElementType;
  /** `word` staggers each word; `line` staggers each visual line (measured, reflows on resize). */
  by?: 'word' | 'line';
  /** Delay before the first word, ms. */
  delay?: number;
  /** Stagger between words (or lines), ms. Default 40 for words, 110 for lines. */
  stagger?: number;
  /** Reveal on mount rather than on entering the viewport. */
  immediate?: boolean;
  /** Hold the reveal (until an intro is done, say). */
  hold?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Text, with inline elements allowed: `Built by the <b>community</b>.` */
  children: ReactNode;
  ref?: Ref<HTMLElement>;
  id?: string;
}

/** Splits string children into word spans, recursing through inline elements. */
function split(node: ReactNode, counter: { n: number }): ReactNode {
  if (typeof node === 'number') return split(String(node), counter);
  if (typeof node === 'string') {
    const parts = node.split(/(\s+)/).filter((p) => p !== '');
    return (
      <>
        {parts.map((part, i) => {
          if (/^\s+$/.test(part)) return part;
          const index = counter.n++;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: parts of one string are static and ordered
            <span key={i} className={styles.word} data-w="">
              <span className={styles.inner} style={{ '--i': index } as CSSProperties}>
                {part}
              </span>
            </span>
          );
        })}
      </>
    );
  }
  if (Array.isArray(node)) {
    return Children.toArray(node).map((child, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: children are static and ordered
      <Fragment key={i}>{split(child, counter)}</Fragment>
    ));
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    if (node.props.children === undefined) return node;
    return cloneElement(node, undefined, split(node.props.children, counter));
  }
  return node;
}

/**
 * Headline reveal: words (or lines) rise out of their line box in sequence. The words are
 * plain spans, so assistive tech reads the sentence normally; under reduced motion they
 * fade in together. `<b>` keeps its weight and the `.t-grad` gradient.
 *
 *   <SplitReveal as="h2" className="t-h2">What you will <b>build</b>.</SplitReveal>
 */
export function SplitReveal({
  as,
  by = 'word',
  delay = 0,
  stagger,
  immediate = false,
  hold = false,
  className,
  style,
  children,
  ref,
  ...rest
}: SplitRevealProps) {
  const Tag: ElementType = as ?? 'span';
  const local = useRef<HTMLElement | null>(null);
  const shown = useReveal(local, { immediate, hold });
  const step = stagger ?? (by === 'line' ? 110 : 40);

  // Line mode: give every word on the same visual line the same index.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `children` re-measures the lines when the text changes
  useLayoutEffect(() => {
    const root = local.current;
    if (!root || by !== 'line') return;
    const apply = () => {
      const words = Array.from(root.querySelectorAll<HTMLElement>('[data-w]'));
      let line = -1;
      let top = Number.NEGATIVE_INFINITY;
      for (const w of words) {
        const y = w.offsetTop;
        if (Math.abs(y - top) > 4) {
          line++;
          top = y;
        }
        (w.firstElementChild as HTMLElement | null)?.style.setProperty('--i', String(line));
      }
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(root);
    return () => ro.disconnect();
  }, [by, children]);

  const counter = { n: 0 };
  return (
    <Tag
      ref={mergeRefs(local, ref)}
      className={cn(styles.root, className)}
      data-shown={shown ? 'true' : 'false'}
      style={{ ...style, '--split-step': `${step}ms`, '--split-delay': `${delay}ms` } as CSSProperties}
      {...rest}
    >
      {split(children, counter)}
    </Tag>
  );
}
