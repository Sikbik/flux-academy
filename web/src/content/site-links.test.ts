/**
 * Links from content to other pages of the Academy: `[label](/reference/orbit#plans)`.
 *
 * The lesson validator checks that the page exists (`link-route`). It cannot check the `#anchor`, because a
 * reference page's sections live in `content/reference/topics.ts`, so this test does: every content file's
 * site link names a route in `shared/site.ts`, and a link into a reference topic names a section that the
 * topic has. A renamed section then fails here instead of scrolling nowhere.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeMeta } from '@shared/site';
import { describe, expect, it } from 'vitest';
import { topicById } from './reference/topics';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const LINK = /\]\((\/[^)\s]*)\)/g;

/** Every `.ts` file under `content/` that is content (not a test), with its text. */
function contentFiles(dir: string): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...contentFiles(path));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts'))
      out.push({ file: path, text: readFileSync(path, 'utf8') });
  }
  return out;
}

const found: { file: string; href: string }[] = [];
for (const { file, text } of contentFiles(ROOT)) {
  for (const m of text.matchAll(LINK)) found.push({ file: file.slice(ROOT.length), href: m[1] as string });
}

describe('site links in content', () => {
  it('finds the links the new lessons carry (so this test cannot pass by finding none)', () => {
    expect(found.length).toBeGreaterThan(5);
  });

  it('every one names a page of the Academy', () => {
    const bad = found.filter((l) => !routeMeta(l.href.split(/[?#]/, 1)[0] ?? ''));
    expect(bad).toEqual([]);
  });

  it('every link into a reference topic names a section that topic has', () => {
    const bad: { file: string; href: string }[] = [];
    for (const l of found) {
      // The reference pages link to ids inside their own sections (a row, a table); `reference/refs.test.ts`
      // checks those against the rendered pages.
      if (l.file.startsWith('reference/')) continue;
      const m = /^\/reference\/([a-z0-9-]+)#([a-z0-9-]+)$/.exec(l.href);
      if (!m) continue;
      const topic = topicById(m[1] as string);
      if (!topic?.sections.some((s) => s.id === m[2])) bad.push(l);
    }
    expect(bad).toEqual([]);
  });
});
