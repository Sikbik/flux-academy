/**
 * Renders the Academy's inline markup (**bold**, *italic*, `code`, [label](url), {{term:id}},
 * {{lesson:id}}, {{lab:id}}, {{kbd:Ctrl+K}}) for the shell's own surfaces: lab notes, the command deck's
 * term card, the footer's blurbs.
 *
 * It is the design system's `Markup` with the Academy's resolvers attached, so a term, a lesson link or a
 * key reads exactly as it does in a lesson (one parser, `learn/markup.ts`, and one rule for how a term's
 * name reads in a sentence). `depth` above 0 turns the term cards off (a definition never opens another
 * definition: that way lies a tooltip maze).
 */

import { Markup } from '@/ui';
import { APP_MARKUP } from './markupContext';

/**
 * One paragraph's worth of markup, inline. Wrap it in your own `<p>`. Pass `heading` when the text is a
 * heading or a title, so a term keeps its glossary spelling instead of reading as mid-sentence prose.
 */
export function InlineMarkup({
  text,
  depth = 0,
  heading = false,
}: {
  text: string;
  depth?: number;
  heading?: boolean;
}) {
  return <Markup text={text} inline={depth > 0} heading={heading} context={APP_MARKUP} />;
}
