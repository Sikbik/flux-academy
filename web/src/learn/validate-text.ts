/**
 * Text rules of the lesson validator: which strings are prose, markup well-formedness and hygiene
 * (em dashes, emoji, exclamation marks, paragraph length, hook length). Pure.
 */

import { countSentences, countWords, type MarkupNode, parseMarkup, proseOnly, walkMarkup } from './markup';
import type { Challenge, Check, Lesson, Stage, Task, TerminalScript } from './types';
import type { Collector } from './validate-core';

/**
 * `paragraph`  a block of prose: word limit applies
 * `prose`      a sentence or two of markup (a prompt, a label)
 * `title`      a short markup title
 * `plain`      text with no markup (link labels)
 */
/** Visit each item of an optional list. A callback may return a value; it is ignored. */
function each<T>(list: readonly T[] | undefined, fn: (item: T, index: number) => unknown): void {
  if (!list) return;
  for (const [i, x] of list.entries()) fn(x, i);
}

export type ProseRole = 'paragraph' | 'prose' | 'title' | 'plain';

export interface ProseItem {
  path: string;
  text: string;
  role: ProseRole;
}

function checkMessages(check: Check, path: string, out: ProseItem[]): void {
  if ('all' in check) {
    for (const [i, c] of check.all.entries()) checkMessages(c, `${path}.all[${i}]`, out);
  } else if ('any' in check) {
    for (const [i, c] of check.any.entries()) checkMessages(c, `${path}.any[${i}]`, out);
  } else if (check.message) out.push({ path: `${path}.message`, text: check.message, role: 'prose' });
}

function scriptProse(script: TerminalScript, path: string, out: ProseItem[]): void {
  each(script.goals, (g, i) => out.push({ path: `${path}.goals[${i}].label`, text: g.label, role: 'prose' }));
  each(script.commands, (c, i) => {
    if (c.explain) out.push({ path: `${path}.commands[${i}].explain`, text: c.explain, role: 'prose' });
  });
}

function stageProse(stage: Stage, path: string, out: ProseItem[]): void {
  switch (stage.kind) {
    case 'spec':
      each(stage.focus, (f, i) =>
        out.push({ path: `${path}.focus[${i}].note`, text: f.note, role: 'prose' }),
      );
      break;
    case 'terminal':
      scriptProse(stage.script, `${path}.script`, out);
      break;
    case 'compare':
      for (const side of ['left', 'right'] as const) {
        const s = stage[side];
        out.push({ path: `${path}.${side}.label`, text: s.label, role: 'title' });
        if (s.body) out.push({ path: `${path}.${side}.body`, text: s.body, role: 'paragraph' });
      }
      break;
    case 'diorama':
    case 'diagram':
    case 'code':
    case 'widget':
      break;
  }
}

function taskProse(task: Task, path: string, out: ProseItem[]): void {
  switch (task.kind) {
    case 'read':
      break;
    case 'set-instances':
    case 'kill-nodes':
    case 'send-requests':
    case 'widget':
      out.push({ path: `${path}.prompt`, text: task.prompt, role: 'prose' });
      break;
    case 'spec':
      out.push({ path: `${path}.prompt`, text: task.prompt, role: 'prose' });
      if (task.hint) out.push({ path: `${path}.hint`, text: task.hint, role: 'prose' });
      checkMessages(task.check, `${path}.check`, out);
      break;
    case 'terminal':
      out.push({ path: `${path}.prompt`, text: task.prompt, role: 'prose' });
      if (task.hint) out.push({ path: `${path}.hint`, text: task.hint, role: 'prose' });
      break;
    case 'confirm':
      out.push({ path: `${path}.prompt`, text: task.prompt, role: 'prose' });
      out.push({ path: `${path}.label`, text: task.label, role: 'prose' });
      break;
  }
}

function challengeProse(c: Challenge, path: string, out: ProseItem[]): void {
  out.push({ path: `${path}.prompt`, text: c.prompt, role: 'prose' });
  out.push({ path: `${path}.explain`, text: c.explain, role: 'prose' });
  if (c.hint) out.push({ path: `${path}.hint`, text: c.hint, role: 'prose' });
  switch (c.kind) {
    case 'choice':
    case 'multi':
      each(c.options, (o, i) => {
        out.push({ path: `${path}.options[${i}].label`, text: o.label, role: 'prose' });
        if (o.why) out.push({ path: `${path}.options[${i}].why`, text: o.why, role: 'prose' });
      });
      break;
    case 'order':
      each(c.items, (o, i) => out.push({ path: `${path}.items[${i}].label`, text: o.label, role: 'prose' }));
      break;
    case 'match':
      each(c.pairs, (p, i) => {
        out.push({ path: `${path}.pairs[${i}].left`, text: p.left, role: 'prose' });
        out.push({ path: `${path}.pairs[${i}].right`, text: p.right, role: 'prose' });
      });
      break;
    case 'spec-fix':
      checkMessages(c.check, `${path}.check`, out);
      break;
    case 'spec-build':
      each(c.requirements, (r, i) => {
        out.push({ path: `${path}.requirements[${i}].label`, text: r.label, role: 'prose' });
        checkMessages(r.check, `${path}.requirements[${i}].check`, out);
      });
      break;
    case 'terminal':
      scriptProse(c.script, `${path}.script`, out);
      break;
    case 'estimate':
      break;
  }
}

/** Every markup string of a lesson with its path and role. Code and terminal output are not included. */
export function collectProse(lesson: Lesson): ProseItem[] {
  const out: ProseItem[] = [];
  out.push({ path: 'hook', text: lesson.hook, role: 'prose' });
  each(lesson.objectives, (t, i) => out.push({ path: `objectives[${i}]`, text: t, role: 'prose' }));
  each(lesson.steps, (s, i) => {
    const p = `steps[${i} "${s.id}"]`;
    out.push({ path: `${p}.title`, text: s.title, role: 'title' });
    each(s.body, (t, j) => out.push({ path: `${p}.body[${j}]`, text: t, role: 'paragraph' }));
    each(s.callouts, (c, j) => {
      if (c.title) out.push({ path: `${p}.callouts[${j}].title`, text: c.title, role: 'title' });
      out.push({ path: `${p}.callouts[${j}].body`, text: c.body, role: 'paragraph' });
    });
    if (s.stage) stageProse(s.stage, `${p}.stage`, out);
    if (s.task) taskProse(s.task, `${p}.task`, out);
  });
  each(lesson.checkpoint, (c, i) => challengeProse(c, `checkpoint[${i} "${c.id}"]`, out));
  each(lesson.recap, (t, i) => out.push({ path: `recap[${i}]`, text: t, role: 'prose' }));
  each(lesson.further, (f, i) => out.push({ path: `further[${i}].label`, text: f.label, role: 'plain' }));
  return out;
}

// ---------------------------------------------------------------------------
// Hygiene
// ---------------------------------------------------------------------------

const EM_DASH = '—';

/**
 * Emoji and pictographs. Arrows, the copyright, registered and trade mark signs and ordinary symbols are
 * allowed; anything a platform would draw as a colour picture is not.
 */
const EMOJI = /(?![©®™↔-↙])\p{Extended_Pictographic}|\p{Emoji_Presentation}|️|[\u{1F1E6}-\u{1F1FF}]/u;

/** Walk every string anywhere in a value (keys excluded) with its path. */
export function walkStrings(value: unknown, path: string, visit: (path: string, s: string) => void): void {
  if (typeof value === 'string') {
    visit(path, value);
  } else if (Array.isArray(value)) {
    each(value, (v, i) => walkStrings(v, `${path}[${i}]`, visit));
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) walkStrings(v, path ? `${path}.${k}` : k, visit);
  }
}

/** Em dashes and emoji in any string of the lesson, code and terminal output included. */
export function checkCharacters(lesson: Lesson, out: Collector): void {
  walkStrings(lesson, '', (path, s) => {
    if (s.includes(EM_DASH)) {
      out.error(
        'em-dash',
        path,
        'Contains an em dash (U+2014). Use a comma, a period, a colon or parentheses instead.',
      );
    }
    const m = EMOJI.exec(s);
    if (m) {
      out.error('emoji', path, `Contains an emoji or pictograph (${JSON.stringify(m[0])}). Use words.`);
    }
  });
}

/** Markup well-formedness, exclamation marks, paragraph length, hook length. */
export function checkProse(items: readonly ProseItem[], hookPath: string, out: Collector): void {
  for (const item of items) {
    if (item.role === 'plain') {
      if (item.text.trim() === '') out.error('empty-text', item.path, 'This text is empty.');
      continue;
    }
    if (item.text.trim() === '') {
      out.error('empty-text', item.path, 'This text is empty.');
      continue;
    }
    const parsed = parseMarkup(item.text);
    for (const prob of parsed.problems) {
      out.error('markup', item.path, `${prob.message} (character ${prob.at + 1})`);
    }
    if (proseOnly(item.text).includes('!')) {
      out.error(
        'exclamation',
        item.path,
        'Contains an exclamation mark. Instructional text is calm: use a period.',
      );
    }
    if (/<\/?[a-z][^>]*>/i.test(stripCode(parsed.nodes))) {
      out.error('html', item.path, 'Looks like HTML. Lesson text is plain markup only: no tags.');
    }
    if (item.role === 'paragraph') {
      const words = countWords(item.text);
      if (words > 90) {
        out.error(
          'paragraph-length',
          item.path,
          `${words} words. Keep a paragraph to 90 words or fewer (25 to 90 reads best): split it.`,
        );
      }
    }
    if (item.path === hookPath) {
      const sentences = countSentences(item.text);
      if (sentences > 2) {
        out.error('hook-length', item.path, `The hook has ${sentences} sentences. Use one or two.`);
      }
    }
  }
}

/** The non-code text of a markup tree, for the HTML sniffing above. */
function stripCode(nodes: MarkupNode[]): string {
  const parts: string[] = [];
  walkMarkup(nodes, (n) => {
    if (n.type === 'text') parts.push(n.text);
  });
  return parts.join('');
}
