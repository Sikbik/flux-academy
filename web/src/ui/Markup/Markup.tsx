import { type MouseEvent, type ReactNode, useContext, useMemo } from 'react';
import { Glyph } from '../Glyph/Glyph';
import { type GlyphName, isGlyphName } from '../Glyph/glyphs';
import { cn } from '../internal/cn';
import { EXTERNAL_REL, isExternalHref } from '../internal/links';
import { Kbd } from '../Kbd/Kbd';
import { Popover } from '../Popover/Popover';
import {
  EMPTY_CONTEXT,
  type MarkupContext,
  MarkupCtx,
  type MarkupTarget,
  type MarkupTerm,
  useMarkupContext,
} from './context';
import styles from './Markup.module.css';
import { comboFor, type MarkupNode, parseMarkup, termText } from './parse';
import { TermCard } from './TermCard';

export type { MarkupContext, MarkupTarget, MarkupTerm } from './context';
export { useMarkupContext } from './context';
export { type MarkupNode, parseMarkup, stripMarkup } from './parse';
export {
  TermCard,
  type TermCardLinkProps,
  type TermCardProps,
  type TermCardTerm,
} from './TermCard';

export interface MarkupProps {
  /** The markup string. Or pass it as `children`. */
  text?: string;
  children?: string;
  /** Overrides the provider, member by member. */
  context?: MarkupContext;
  /** Render as a paragraph in the lesson voice (1.0625rem, 1.65, 62ch). */
  block?: boolean;
  /**
   * Phrasing content for sitting inside other text (a title, a label, a card). Term cards are
   * off: a term reads as a dotted word, so cards never nest and nothing interactive hides in
   * a heading.
   */
  inline?: boolean;
  /**
   * The text is a heading or a title: a glossary term keeps its display name as the glossary writes it
   * instead of being lower-cased mid-sentence ("Instance", not "instance").
   */
  heading?: boolean;
  className?: string;
}

/**
 * Provides how terms, lessons and labs resolve and how links navigate, to every `Markup`
 * below. Providers nest: an inner one overrides the members it sets.
 *
 *   <MarkupProvider value={{ term: glossary.lookup, navigate: router.push }}>...</MarkupProvider>
 */
export function MarkupProvider({ value, children }: { value: MarkupContext; children: ReactNode }) {
  const parent = useContext(MarkupCtx);
  const merged = useMemo<MarkupContext>(() => ({ ...parent, ...value }), [parent, value]);
  return <MarkupCtx.Provider value={merged}>{children}</MarkupCtx.Provider>;
}

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------

function words(id: string): string {
  return id.replace(/[-_]+/g, ' ');
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pickGlyph(...names: string[]): GlyphName {
  for (const n of names) if (isGlyphName(n)) return n;
  return 'link';
}

const LESSON_GLYPH = pickGlyph('book', 'kind-concept', 'file');
const LAB_GLYPH = pickGlyph('kind-hands-on', 'lab-terminal', 'terminal');

/** Plain left-click on a site-relative link: hand it to the app's router instead of reloading. */
function interceptable(href: string): boolean {
  return /^\/(?!\/)/.test(href) || /^\.\.?\//.test(href) || href.startsWith('?');
}

function onNavigate(
  e: MouseEvent<HTMLAnchorElement>,
  href: string,
  navigate: ((href: string) => void) | undefined,
): void {
  if (!navigate || e.defaultPrevented || !interceptable(href)) return;
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(href);
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Anchor({
  href,
  navigate,
  className,
  children,
}: {
  href: string;
  navigate?: (href: string) => void;
  className?: string;
  children: ReactNode;
}) {
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel={EXTERNAL_REL} className={cn(styles.link, className)}>
        {children}
        <span className={styles.sr}> (Opens in a new tab)</span>
        {'⁠'}
        <Glyph name="arrow-up-right" size={12} className={styles.ext} />
      </a>
    );
  }
  return (
    <a href={href} className={cn(styles.link, className)} onClick={(e) => onNavigate(e, href, navigate)}>
      {children}
    </a>
  );
}

/**
 * The card a term opens: the shared `TermCard`, with the text drawn by this renderer and links through the
 * app's navigate hook. The popover already shows the name, so the card leaves it out.
 */
function TermPopover({ entry, ctx }: { entry: MarkupTerm; ctx: MarkupContext }) {
  return (
    <TermCard
      showTitle={false}
      term={{
        id: entry.id ?? entry.term,
        name: entry.term,
        short: <Markup inline text={entry.short} context={ctx} />,
        why: entry.why ? <Markup inline text={entry.why} context={ctx} /> : undefined,
        href: entry.href,
      }}
      renderLink={({ href, className, children, onClick }) => (
        <a
          href={href}
          className={className}
          onClick={(e) => {
            onClick?.();
            onNavigate(e, href, ctx.navigate);
          }}
        >
          {children}
        </a>
      )}
    />
  );
}

function TermRef({
  node,
  ctx,
  cards,
  heading,
}: {
  node: Extract<MarkupNode, { type: 'term' }>;
  ctx: MarkupContext;
  cards: boolean;
  heading: boolean;
}) {
  const entry = ctx.term?.(node.id);
  if (!entry) {
    const label = words(node.id);
    return (
      <span className={styles.term} data-plain="true">
        {node.case === 'cap' ? sentenceCase(label) : label}
      </span>
    );
  }
  const shown = termText(entry.term, {
    proper: entry.proper,
    start: node.start,
    heading,
    case: node.case,
  });
  if (!cards) {
    return (
      <span className={styles.term} data-plain="true">
        {shown}
      </span>
    );
  }
  return (
    <Popover
      trigger="hover"
      placement="top"
      title={entry.term}
      content={<TermPopover entry={entry} ctx={ctx} />}
    >
      <button type="button" className={styles.term}>
        {shown}
      </button>
    </Popover>
  );
}

function Xref({
  target,
  glyph,
  navigate,
}: {
  target: MarkupTarget;
  glyph: GlyphName;
  navigate?: (href: string) => void;
}) {
  // The glyph and the first word are one unbreakable unit: a browser allows a line break after an inline
  // SVG even beside a word joiner, which stranded the icon at the end of a line.
  const lead = /^(\S+)([\s\S]*)$/.exec(target.title);
  return (
    <Anchor href={target.href} navigate={navigate} className={styles.xref}>
      <span className={styles.xrefLead}>
        <Glyph name={glyph} size={15} className={styles.xrefGlyph} />
        {lead ? lead[1] : target.title}
      </span>
      {lead ? lead[2] : null}
    </Anchor>
  );
}

// ---------------------------------------------------------------------------
// The renderer: React elements only, built from the parsed tree
// ---------------------------------------------------------------------------

interface Env {
  ctx: MarkupContext;
  cards: boolean;
  heading: boolean;
}

function renderNodes(nodes: readonly MarkupNode[], env: Env, key: { n: number }): ReactNode[] {
  const out: ReactNode[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        out.push(node.text);
        break;
      case 'strong':
        out.push(<strong key={key.n++}>{renderNodes(node.children, env, key)}</strong>);
        break;
      case 'em':
        out.push(
          <em key={key.n++} className={styles.em}>
            {renderNodes(node.children, env, key)}
          </em>,
        );
        break;
      case 'code':
        out.push(
          <code key={key.n++} className={styles.code}>
            {node.text}
          </code>,
        );
        break;
      case 'link':
        out.push(
          <Anchor key={key.n++} href={node.href} navigate={env.ctx.navigate}>
            {renderNodes(node.children, env, key)}
          </Anchor>,
        );
        break;
      case 'term':
        out.push(<TermRef key={key.n++} node={node} ctx={env.ctx} cards={env.cards} heading={env.heading} />);
        break;
      case 'lesson': {
        const target = env.ctx.lesson?.(node.id) ?? {
          title: sentenceCase(words(node.id)),
          href: `/learn/${node.id}`,
        };
        out.push(<Xref key={key.n++} target={target} glyph={LESSON_GLYPH} navigate={env.ctx.navigate} />);
        break;
      }
      case 'lab': {
        const target = env.ctx.lab?.(node.id) ?? {
          title: sentenceCase(words(node.id)),
          href: `/labs/${node.id}`,
        };
        out.push(<Xref key={key.n++} target={target} glyph={LAB_GLYPH} navigate={env.ctx.navigate} />);
        break;
      }
      case 'kbd':
        out.push(
          <span key={key.n++} className={styles.kbd}>
            <Kbd combo={comboFor(node.combo)} size="sm" />
          </span>,
        );
        break;
    }
  }
  return out;
}

/**
 * Renders inline markup (see `parse.ts` for the grammar). It builds React elements from a
 * parsed tree and never touches HTML, so a string from content or a glossary can only ever
 * be text, a link to a safe target, or one of the five tokens.
 *
 *   <Markup block text="Run **docker ps**, then press {{kbd:Ctrl+C}}." />
 *   <Markup inline text={step.title} />
 */
export function Markup({
  text,
  children,
  context,
  block = false,
  inline = false,
  heading = false,
  className,
}: MarkupProps) {
  const provided = useMarkupContext();
  const ctx = useMemo<MarkupContext>(
    () => (context ? { ...provided, ...context } : provided === EMPTY_CONTEXT ? EMPTY_CONTEXT : provided),
    [provided, context],
  );
  const source = text ?? children ?? '';
  const tree = useMemo(() => parseMarkup(source), [source]);
  const content = renderNodes(tree, { ctx, cards: !inline, heading }, { n: 0 });
  if (block) return <p className={cn(styles.block, className)}>{content}</p>;
  if (className) return <span className={className}>{content}</span>;
  return <>{content}</>;
}
