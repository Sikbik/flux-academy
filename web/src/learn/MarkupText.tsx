/**
 * Renders lesson markup (types.ts `Markup`) to React elements. It never produces HTML from content: the
 * parser (`markup.ts`) yields a small node tree and this file maps each node to an element, so content
 * cannot inject anything.
 *
 *   <MarkupText text="Run **docker build** and read {{term:image}}." />
 *   <MarkupText text={paragraph} reveal baseDelay={120} />   words rise in, 14 ms apart
 *
 * Inline pieces
 *   **bold**, *italic*, `code`
 *   [label](https://...)   an external link: new tab, `rel="noopener noreferrer"`, spoken "Opens in a new tab"
 *   [label](/reference/x)  a page of the Academy: through the router, same tab (the validator checks that
 *                          the page exists in `shared/site.ts`)
 *   {{term:id}}            a dotted underline; hover or focus opens the definition card. It shows the
 *                          term's name as prose wants it (see `termText`): "your only instance", not
 *                          "your only Instance", unless the term is a proper noun or opens a sentence.
 *                          `{{term:id|lower}}` and `{{term:id|Cap}}` force the first letter.
 *   {{lesson:id}}          a link to a lesson, showing its title
 *   {{lab:id}}             a link to a lab, showing its title
 *   {{kbd:Ctrl+K}}         a keycap
 *
 * The parser is `markup.ts`, shared with the design system's `Markup`, `InlineMarkup` and the validator.
 * A term's name keeps its glossary spelling inside a heading (an `h1` to `h6` above it, or `heading`).
 */

import { labById, lessonById } from '@shared/curriculum';
import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router';
import { Glyph, Kbd, Popover, TermCard } from '@/ui';
import { getTerm } from './glossary';
import styles from './MarkupText.module.css';
import { comboFor, idWords, type MarkupNode, parseMarkup, termText } from './markup';
import type { GlossaryTerm } from './types';

export interface MarkupTextProps {
  text: string;
  /** Wrap words so they can rise in one after another (the step body reveal). */
  reveal?: boolean;
  /** Delay before the first word, in ms (with `reveal`). */
  baseDelay?: number;
  className?: string;
  /** Render without links and cards (inside another link or a button). */
  plain?: boolean;
  /**
   * The text is a heading or a title, so a term keeps its glossary spelling. Default: found from the
   * element's ancestors (an `h1` to `h6`).
   */
  heading?: boolean;
}

/** A link that stays inside the Academy: one leading slash, then a path, perhaps with a `#anchor`. */
function siteHref(href: string): string | null {
  return href.startsWith('/') && !href.startsWith('//') ? href : null;
}

/** Only https URLs become external links; anything else is shown as text. */
function safeHref(href: string): string | null {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

interface Ctx {
  reveal: boolean;
  plain: boolean;
  heading: boolean;
  /** Next word index, shared across the whole string so the stagger runs through it. */
  n: { i: number };
}

const MAX_STAGGER_WORDS = 70;

function wordStyle(ctx: Ctx): CSSProperties {
  const i = Math.min(ctx.n.i, MAX_STAGGER_WORDS);
  ctx.n.i += 1;
  return { '--i': i } as CSSProperties;
}

function renderText(text: string, ctx: Ctx, key: string): ReactNode {
  if (!ctx.reveal) return text;
  // Split on whitespace but keep it, so layout and wrapping are unchanged.
  const parts = text.split(/(\s+)/);
  return parts.map((part, i) => {
    if (part === '') return null;
    if (/^\s+$/.test(part)) return part;
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: a static ordered split of one string
      <span key={`${key}.${i}`} className={styles.word} style={wordStyle(ctx)}>
        {part}
      </span>
    );
  });
}

function unit(node: ReactNode, ctx: Ctx, key: string): ReactNode {
  if (!ctx.reveal) return <Fragment key={key}>{node}</Fragment>;
  return (
    <span key={key} className={styles.word} style={wordStyle(ctx)}>
      {node}
    </span>
  );
}

/** The card a term opens: the one shared card, with this renderer's text and the router's links. */
function TermPopover({ term }: { term: GlossaryTerm }) {
  return (
    <TermCard
      showTitle={false}
      term={{
        id: term.id,
        name: term.term,
        short: <MarkupText text={term.short} plain />,
        why: <MarkupText text={term.why} plain />,
        href: `/glossary#${term.id}`,
      }}
      renderLink={({ href, className, children, onClick }) => (
        <Link className={className} to={href} onClick={onClick}>
          {children}
        </Link>
      )}
    />
  );
}

function renderNodes(nodes: MarkupNode[], ctx: Ctx, prefix: string): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${prefix}.${i}`;
    switch (node.type) {
      case 'text':
        return <span key={key}>{renderText(node.text, ctx, key)}</span>;
      case 'bold':
        return <strong key={key}>{renderNodes(node.children, ctx, key)}</strong>;
      case 'italic':
        return <em key={key}>{renderNodes(node.children, ctx, key)}</em>;
      case 'code':
        return unit(<code className={styles.code}>{node.text}</code>, ctx, key);
      case 'kbd':
        return unit(
          <Kbd combo={comboFor(node.combo ?? node.keys.join('+'))} size="sm" className={styles.kbd} />,
          ctx,
          key,
        );
      case 'link': {
        const site = ctx.plain ? null : siteHref(node.href);
        if (site) {
          return unit(
            <Link className={styles.link} to={site}>
              {node.label}
            </Link>,
            ctx,
            key,
          );
        }
        const href = safeHref(node.href);
        if (!href || ctx.plain) return <span key={key}>{renderText(node.label, ctx, key)}</span>;
        return unit(
          <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
            {node.label}
            <Glyph name="arrow-up-right" size={12} className={styles.ext} />
            <span className="sr-only">. Opens in a new tab</span>
          </a>,
          ctx,
          key,
        );
      }
      case 'lesson': {
        const meta = lessonById(node.id);
        if (!meta) return unit(<span className={styles.missing}>{node.id}</span>, ctx, key);
        if (ctx.plain) return <span key={key}>{meta.title}</span>;
        return unit(
          <Link className={styles.link} to={`/learn/${meta.id}`}>
            {meta.title}
          </Link>,
          ctx,
          key,
        );
      }
      case 'lab': {
        const lab = labById(node.id);
        if (!lab) return unit(<span className={styles.missing}>{node.id}</span>, ctx, key);
        if (ctx.plain) return <span key={key}>{lab.title}</span>;
        return unit(
          <Link className={styles.link} to={`/labs/${lab.id}`}>
            {lab.title}
          </Link>,
          ctx,
          key,
        );
      }
      case 'term': {
        const term = getTerm(node.id);
        if (!term) {
          const words = idWords(node.id);
          return unit(
            <span className={styles.missing} title="This term is not in the glossary yet">
              {node.case === 'cap' ? words.charAt(0).toUpperCase() + words.slice(1) : words}
            </span>,
            ctx,
            key,
          );
        }
        const shown = termText(term.term, {
          proper: term.proper,
          start: node.start,
          heading: ctx.heading,
          case: node.case,
        });
        if (ctx.plain) return <span key={key}>{shown}</span>;
        return unit(
          <Popover
            trigger="hover"
            placement="top"
            width={320}
            title={term.term}
            content={<TermPopover term={term} />}
          >
            <button type="button" className={styles.term}>
              {shown}
            </button>
          </Popover>,
          ctx,
          key,
        );
      }
      default:
        return null;
    }
  });
}

function hasTerm(nodes: readonly MarkupNode[]): boolean {
  return nodes.some(
    (n) => n.type === 'term' || ((n.type === 'bold' || n.type === 'italic') && hasTerm(n.children)),
  );
}

export function MarkupText({
  text,
  reveal = false,
  baseDelay = 0,
  className,
  plain = false,
  heading,
}: MarkupTextProps) {
  const parsed = useMemo(() => parseMarkup(text).nodes, [text]);
  const rootRef = useRef<HTMLSpanElement>(null);

  // A term keeps its glossary spelling inside a heading. The element knows where it sits only once it is
  // in the page, so look before the first paint (and only when there is a term to spell).
  const [inHeading, setInHeading] = useState(false);
  const needsHeading = heading === undefined && hasTerm(parsed);
  useLayoutEffect(() => {
    if (!needsHeading) return;
    const found = rootRef.current?.closest('h1, h2, h3, h4, h5, h6, [role="heading"]') != null;
    setInHeading((prev) => (prev === found ? prev : found));
  }, [needsHeading]);

  const ctx: Ctx = { reveal, plain, heading: heading ?? inHeading, n: { i: 0 } };
  const style = reveal ? ({ '--base': `${baseDelay}ms` } as CSSProperties) : undefined;
  return (
    <span ref={rootRef} className={className} style={style} data-reveal={reveal ? 'true' : undefined}>
      {renderNodes(parsed, ctx, 'm')}
    </span>
  );
}
