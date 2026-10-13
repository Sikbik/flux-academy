import {
  type CSSProperties,
  Fragment,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '../Button/Button';
import { Chip } from '../Chip/Chip';
import { cn } from '../internal/cn';
import { Panel } from '../Panel/Panel';
import styles from './CodeBlock.module.css';
import { writeClipboard } from './clipboard';
import { type CodeLang, copyText, LANG_LABEL, type Token, tokenize } from './tokenize';

export interface CodeBlockProps extends Omit<HTMLAttributes<HTMLElement>, 'title' | 'children' | 'onCopy'> {
  /** The source. A single trailing newline is ignored. */
  code: string;
  /** Syntax rules. Default `text` (no highlighting). */
  lang?: CodeLang;
  /** Shown in the header in the mono voice: `Dockerfile`, `flux-spec.json`. */
  filename?: string;
  /** Header label when there is no file name (a few words, not a path). */
  title?: ReactNode;
  /** A caption under the block. */
  caption?: ReactNode;
  /** Gutter line numbers. Default: on when the block has more than one line. */
  lineNumbers?: boolean;
  /** The number shown on the first line. Default 1; use it for an excerpt of a longer file. */
  startLine?: number;
  /** Line numbers (1-based, as shown in the gutter) to emphasise. */
  highlight?: readonly number[];
  /** A copy button in the header. Default true. */
  copy?: boolean;
  /** Called with the copied text after a successful copy. */
  onCopy?: (text: string) => void;
  /** Wrap long lines instead of scrolling sideways. Default false. */
  wrap?: boolean;
  /** Scroll vertically beyond this height (px, or any CSS length). */
  maxHeight?: number | string;
  /** The accessible name of the scrollable code region. Default `<language> code`. */
  label?: string;
  /** Render a skeleton shaped like code instead of the content. */
  loading?: boolean;
  /** How many placeholder lines the skeleton shows. Default 7. */
  skeletonLines?: number;
}

type CopyState = 'idle' | 'copied' | 'failed';

const SKELETON_WIDTHS = [62, 38, 74, 52, 28, 68, 46, 58, 34, 70];
const FEEDBACK_MS = 1600;

function renderTokens(tokens: readonly Token[]): ReactNode[] {
  const out: ReactNode[] = [];
  let k = 0;
  for (const t of tokens) {
    if (t.type === 'plain') out.push(t.text);
    else
      out.push(
        <span key={k++} className={styles[t.type]}>
          {t.text}
        </span>,
      );
  }
  return out;
}

/**
 * A block of code: a slab with a header (file, language, copy), gutter line numbers, emphasised
 * lines and a keyboard-scrollable screen. Highlighting is in-house (`tokenize.ts`): no
 * highlighter dependency, nothing is evaluated.
 *
 * The code is real text with real newlines (the gutter is generated content), so selecting
 * and copying by hand gives exactly the source.
 *
 *   <CodeBlock lang="dockerfile" filename="Dockerfile" highlight={[3, 4]} code={source} />
 *   <CodeBlock loading skeletonLines={8} code="" />   // while a lesson file loads
 */
export function CodeBlock({
  code,
  lang = 'text',
  filename,
  title,
  caption,
  lineNumbers,
  startLine = 1,
  highlight,
  copy = true,
  onCopy,
  wrap = false,
  maxHeight,
  label,
  loading = false,
  skeletonLines = 7,
  className,
  style,
  ...rest
}: CodeBlockProps) {
  const lines = useMemo(() => tokenize(code, lang), [code, lang]);
  const highlighted = useMemo(() => new Set(highlight ?? []), [highlight]);
  const showNumbers = lineNumbers ?? lines.length > 1;
  const lastNumber = startLine + lines.length - 1;
  const digits = String(Math.max(lastNumber, 1)).length;
  const langLabel = LANG_LABEL[lang];
  const heading = filename ?? title;
  const regionLabel =
    label ??
    (filename && filename.toLowerCase() !== langLabel.toLowerCase()
      ? `${filename}, ${langLabel} code`
      : `${langLabel} code`);

  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopyClick = useCallback(async () => {
    const text = copyText(code, lang);
    const ok = await writeClipboard(text);
    window.clearTimeout(timer.current);
    setState(ok ? 'copied' : 'failed');
    if (ok) onCopy?.(text);
    timer.current = window.setTimeout(() => setState('idle'), FEEDBACK_MS);
  }, [code, lang, onCopy]);

  const vars = {
    '--digits': digits,
    ...(maxHeight !== undefined
      ? { '--max': typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }
      : null),
    ...style,
  } as CSSProperties;

  const copyLabel = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy';
  const copyName =
    state === 'copied' ? 'Copied to clipboard' : state === 'failed' ? 'Copy failed' : 'Copy code';
  const announce =
    state === 'copied'
      ? 'Copied to clipboard'
      : state === 'failed'
        ? 'Copy failed. Select the text and copy it by hand.'
        : '';

  return (
    <figure className={cn(styles.figure, className)} data-lang={lang} style={vars} {...rest}>
      <Panel
        variant="slab"
        padding="none"
        marks={false}
        pattern="none"
        container
        className={styles.panel}
        contentClassName={styles.inner}
      >
        <div className={styles.body}>
          <header className={styles.head}>
            <span className={styles.name}>
              <span className={styles.bullet} aria-hidden="true" />
              <span className={filename ? styles.file : styles.title}>{heading ?? langLabel}</span>
            </span>
            <span className={styles.tools}>
              {heading ? (
                <Chip size="sm" className={styles.lang}>
                  {langLabel}
                </Chip>
              ) : null}
              {copy && !loading ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={state === 'copied' ? 'check' : 'copy'}
                  tone={state === 'copied' ? 'ok' : state === 'failed' ? 'warn' : undefined}
                  className={styles.copy}
                  aria-label={copyName}
                  onClick={onCopyClick}
                >
                  <span className={styles.copyText}>{copyLabel}</span>
                </Button>
              ) : null}
              {copy && !loading ? (
                <span className="sr-only" role="status">
                  {announce}
                </span>
              ) : null}
            </span>
          </header>

          <div className={styles.screen}>
            {loading ? (
              <div className={styles.scroller} role="status" aria-busy="true" aria-label="Loading code">
                <div className={styles.skeleton} data-numbers={showNumbers ? 'true' : undefined}>
                  {Array.from({ length: skeletonLines }, (_, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed run of placeholder lines
                      key={i}
                      className={styles.bar}
                      style={{ '--w': `${SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]}%` } as CSSProperties}
                    />
                  ))}
                </div>
              </div>
            ) : (
              // A scrollable region has to be reachable by keyboard, or its far end cannot be read.
              <section
                className={styles.scroller}
                aria-label={regionLabel}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard reachable
                tabIndex={0}
                data-max={maxHeight !== undefined ? 'true' : undefined}
              >
                <pre
                  className={styles.pre}
                  data-wrap={wrap ? 'true' : undefined}
                  data-numbers={showNumbers ? 'true' : undefined}
                  style={{ counterReset: `line ${startLine - 1}` }}
                >
                  <code className={styles.code}>
                    {lines.map((tokens, i) => {
                      const on = highlighted.has(startLine + i);
                      return (
                        // The newline after each line is real text: it is what the clipboard gets.
                        // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional and never reorder
                        <Fragment key={i}>
                          <span className={styles.line} data-hl={on ? 'true' : undefined}>
                            {on ? <span className={styles.hlLabel}>Highlighted: </span> : null}
                            {renderTokens(tokens)}
                          </span>
                          {i < lines.length - 1 ? '\n' : null}
                        </Fragment>
                      );
                    })}
                  </code>
                </pre>
              </section>
            )}
          </div>
        </div>
      </Panel>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}

/** The placeholder to show while code is loading: same slab, same header, shaped lines. */
export function CodeBlockSkeleton(props: Omit<CodeBlockProps, 'code' | 'loading'>) {
  return <CodeBlock {...props} code="" loading />;
}
