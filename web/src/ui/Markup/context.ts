import { createContext, useContext } from 'react';

/** What a glossary term resolves to. `short` and `why` are themselves inline markup. */
export interface MarkupTerm {
  /** The entry's id, for the card's `data-term`. */
  id?: string;
  /**
   * The name as the glossary writes it: `Flux node`, `FDM`, `Instance`. In a sentence a name that is a
   * capital followed only by lower case is lower-cased (see `termText` in `learn/markup.ts`), unless
   * `proper` is set.
   */
  term: string;
  /** A proper noun or a name with a deliberate capital: always shown as written. */
  proper?: boolean;
  /** One or two sentences. */
  short: string;
  /** Optional "why it matters" line. */
  why?: string;
  /** The glossary entry; when present the card links to it. */
  href?: string;
}

/** Where a lesson or lab reference points. */
export interface MarkupTarget {
  title: string;
  href: string;
}

/**
 * How the markup talks to the app. Every member is optional; without one the renderer falls
 * back to something readable (a term shows its id, a lesson links to `/learn/<id>`).
 */
export interface MarkupContext {
  term?: (id: string) => MarkupTerm | undefined;
  lesson?: (id: string) => MarkupTarget | undefined;
  lab?: (id: string) => MarkupTarget | undefined;
  /** Called on a plain left-click of a site-relative link. Without it the browser navigates. */
  navigate?: (href: string) => void;
}

export const EMPTY_CONTEXT: MarkupContext = Object.freeze({});

export const MarkupCtx = createContext<MarkupContext>(EMPTY_CONTEXT);

/** The context in scope: from the nearest `MarkupProvider`, or an empty one. */
export function useMarkupContext(): MarkupContext {
  return useContext(MarkupCtx);
}
