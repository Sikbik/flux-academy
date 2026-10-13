/**
 * The deck's real sources of Reference and troubleshooting answers. Each is a dynamic `import()` of the
 * module the page itself uses, so the content is a separate chunk that is fetched once, on demand, and
 * shared with the pages (a visitor who has read the Reference already has it).
 *
 * This file holds only the glue: the matching is `searchReference` and the troubleshooting `search`, and
 * `deep.ts` places their hits on the deck's scale.
 */

import {
  createDeepSearch,
  type DeepLoaders,
  type DeepSearch,
  type FixMatch,
  type ReferenceMatch,
} from './deep';

/** True on a metered connection (the Save-Data header and the Data Saver setting). */
export function saveDataOn(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

export const defaultLoaders: DeepLoaders = {
  async reference() {
    const m = await import('@/content/reference');
    const nameOf = (id: string): string => m.topicById(id as Parameters<typeof m.topicById>[0])?.name ?? id;
    return {
      search(query, limit) {
        return m.searchReference(m.REFERENCE_INDEX, query, { limit }).map(
          ({ entry, score }): ReferenceMatch => ({
            id: entry.id,
            kind: entry.kind,
            topic: entry.topic,
            topicName: nameOf(entry.topic),
            title: entry.title,
            summary: entry.summary,
            group: entry.group,
            path: entry.path,
            score,
            unverified: entry.prov?.includes('unverified') === true,
          }),
        );
      },
    };
  },

  async fix() {
    // The page's own search module: it brings the troubleshooting content with it.
    const model = await import('@/routes/troubleshoot/model');
    return {
      search(query) {
        const out: FixMatch[] = [];
        const seen = new Set<string>();
        const push = (m: FixMatch): void => {
          if (seen.has(m.id)) return;
          seen.add(m.id);
          out.push(m);
        };

        // An address fragment typed as it is (`app-stuck-installing`, `code-PORT_FEE`): the page's own parser.
        const view = model.parseHash(query);
        if (view.kind === 'symptom') {
          const s = view.symptom;
          push({
            kind: 'symptom',
            id: s.id,
            title: s.title,
            summary: s.summary,
            meta: model.stageTitle(s.stage),
            path: model.hrefOf.symptom(s.id),
            score: 0,
            exact: true,
          });
        } else if (view.kind === 'messages' && view.id) {
          const m = model.messageById(view.id);
          if (m) push(messageMatch(m, true, 0, model.hrefOf.message));
        } else if (view.kind === 'codes' && view.code) {
          const c = model.codeMeta(view.code);
          if (c) push(codeMatch(c, true, 0, model.hrefOf.code));
        }

        const r = model.search(query);
        for (const b of r.best) {
          if (b.type === 'code') push(codeMatch(b.meta, true, b.score, model.hrefOf.code));
          else push(messageMatch(b.message, true, b.score, model.hrefOf.message));
        }
        for (const h of r.symptoms) {
          push({
            kind: 'symptom',
            id: h.symptom.id,
            title: h.symptom.title,
            summary: h.symptom.summary,
            meta: model.stageTitle(h.symptom.stage),
            path: model.hrefOf.symptom(h.symptom.id),
            score: h.score,
            exact: false,
          });
        }
        for (const h of r.messages) push(messageMatch(h.message, false, h.score, model.hrefOf.message));
        for (const h of r.codes) push(codeMatch(h.meta, false, h.score, model.hrefOf.code));
        return out;
      },
    };
  },
};

type Hrefs = (id: string) => string;

function messageMatch(
  m: { id: string; text: string; where: string },
  exact: boolean,
  score: number,
  href: Hrefs,
): FixMatch {
  return {
    kind: 'message',
    id: `message-${m.id}`,
    title: m.text,
    summary: m.where,
    meta: 'Error message',
    path: href(m.id),
    score,
    exact,
  };
}

function codeMatch(c: { code: string; title: string }, exact: boolean, score: number, href: Hrefs): FixMatch {
  return {
    kind: 'code',
    id: `code-${c.code}`,
    title: c.code,
    summary: c.title,
    meta: 'Lint code',
    path: href(c.code),
    score,
    exact,
  };
}

/** The deck's search over the Reference and troubleshooting, shared by every opening of the deck. */
export const deepSearch: DeepSearch = createDeepSearch(defaultLoaders, { saveData: saveDataOn });
