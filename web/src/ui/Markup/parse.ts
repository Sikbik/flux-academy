/**
 * The design system's view of the inline markup parser. There is one parser, `learn/markup.ts`: this file
 * is the adapter that hands `Markup` its tree and `stripMarkup` its text, so the lesson player, the deck,
 * the reference pages and the validator can never read a string two ways. The grammar and its rules are
 * documented there.
 *
 *   **bold**   *italic*   `code`   [label](url)
 *   {{term:id}}   {{lesson:id}}   {{lab:id}}   {{kbd:Ctrl+K}}   {{term:id|lower}}   {{term:id|Cap}}
 *   \* \` \[ \] \( \) \{ \} \_ \\   escapes
 *
 * What a renderer may rely on: the tree holds only the node types of `MarkupNode`, a link never carries
 * an unsafe target (it is unwrapped to its label), nesting is capped at `MAX_DEPTH`, and parsing never
 * throws and is linear in the input.
 */
import { parseTree, plainText, type TreeNode } from '../../learn/markup';

export type MarkupNode = TreeNode;
export type { TermCase, TermTextOptions } from '../../learn/markup';
export { comboFor, MAX_DEPTH, termText } from '../../learn/markup';

/**
 * Parses inline markup into a tree of text, strong, em, code, link and token nodes.
 * Total: any string returns a result, never throws, and never contains markup of its own.
 */
export function parseMarkup(text: string): MarkupNode[] {
  return parseTree(text, { report: false }).nodes;
}

/** The text a reader would see, with markup removed (tokens read as their ids). */
export function stripMarkup(text: string): string {
  return plainText(text);
}
