/**
 * How the design system's `Markup` talks to the Academy: which glossary entry a `{{term:id}}` is, where a
 * `{{lesson:id}}` or `{{lab:id}}` points, and that a plain click on a site link goes through the router
 * (so the hex iris plays and nothing reloads).
 *
 * Deliberately not mounted at the root: it pulls the whole glossary in, and the entry chunk stays small
 * by leaving that to the pages that render terms. `InlineMarkup` passes `APP_MARKUP` as `context`, so it
 * works anywhere; a page that renders the design system's `Markup` directly wraps itself in
 * `AppMarkupProvider`.
 */

import { labById, lessonById } from '@shared/curriculum';
import type { ReactNode } from 'react';
import { getTerm } from '@/learn/glossary';
import { type MarkupContext, MarkupProvider } from '@/ui';
import { appNavigate } from './navigation';

export const APP_MARKUP: MarkupContext = {
  term: (id) => {
    const t = getTerm(id);
    // `proper` travels with the name: the renderers decide how it reads in a sentence (`termText`).
    return t
      ? { id: t.id, term: t.term, proper: t.proper, short: t.short, why: t.why, href: `/glossary#${t.id}` }
      : undefined;
  },
  lesson: (id) => {
    const l = lessonById(id);
    return l ? { title: l.title, href: `/learn/${l.id}` } : undefined;
  },
  lab: (id) => {
    const l = labById(id);
    return l ? { title: l.title, href: `/labs/${l.id}` } : undefined;
  },
  navigate: (href) => appNavigate(href),
};

export function AppMarkupProvider({ children }: { children: ReactNode }) {
  return <MarkupProvider value={APP_MARKUP}>{children}</MarkupProvider>;
}
