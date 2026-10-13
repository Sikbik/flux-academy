import { describe, expect, it } from 'vitest';
import { parseMarkup as parseTreeOfDesignSystem, stripMarkup } from '@/ui/Markup/parse';
import {
  comboFor,
  countSentences,
  countWords,
  idWords,
  type MarkupNode,
  markupRefs,
  parseMarkup,
  parseTree,
  plainText,
  proseOnly,
  type TermResolver,
  termText,
  walkMarkup,
} from './markup';

describe('parseMarkup', () => {
  it('parses text, bold, italic and code', () => {
    const { nodes, problems } = parseMarkup('a **b** and *c* with `d`');
    expect(problems).toEqual([]);
    expect(nodes.map((n) => n.type)).toEqual(['text', 'bold', 'text', 'italic', 'text', 'code']);
  });

  it('parses directives and links', () => {
    const { nodes, problems } = parseMarkup(
      'See {{term:fdm}}, {{lesson:first-deploy}}, {{lab:spec-forge}}, {{kbd:Ctrl+K}} and [docs](https://docs.runonflux.com).',
    );
    expect(problems).toEqual([]);
    const types = nodes.map((n) => n.type);
    expect(types).toContain('term');
    expect(types).toContain('lesson');
    expect(types).toContain('lab');
    expect(types).toContain('kbd');
    expect(types).toContain('link');
    const kbd = nodes.find((n) => n.type === 'kbd');
    expect(kbd && 'keys' in kbd ? kbd.keys : null).toEqual(['Ctrl', 'K']);
  });

  it('keeps asterisks and braces inside code literal', () => {
    const { nodes, problems } = parseMarkup('use `a * b` and `{{x}}`');
    expect(problems).toEqual([]);
    expect(nodes.filter((n) => n.type === 'code')).toHaveLength(2);
  });

  it('reports unbalanced markers and unknown directives without throwing', () => {
    const kinds = (s: string) => parseMarkup(s).problems.map((p) => p.kind);
    expect(kinds('a **b')).toEqual(['unbalanced-bold']);
    expect(kinds('a *b')).toEqual(['unbalanced-italic']);
    expect(kinds('a `b')).toEqual(['unbalanced-code']);
    expect(kinds('a {{term:x')).toEqual(['unclosed-directive']);
    expect(kinds('a {{nope:x}}')).toEqual(['unknown-directive']);
    expect(kinds('a {{term:}}')).toEqual(['empty-directive']);
    expect(kinds('a }} b')).toEqual(['stray-close']);
  });

  it('treats a lone bracket as text', () => {
    const { nodes, problems } = parseMarkup('array[0] is fine');
    expect(problems).toEqual([]);
    expect(nodes).toEqual([{ type: 'text', text: 'array[0] is fine' }]);
  });
});

describe('statistics', () => {
  it('counts words with code and directives as words', () => {
    expect(countWords('Run `docker build` now and see {{term:fdm}}.')).toBe(7);
  });

  it('counts sentences, ignoring decimals, domains and abbreviations', () => {
    expect(countSentences('One. Two.')).toBe(2);
    expect(countSentences('It costs $0.99 a month at docs.runonflux.com.')).toBe(1);
    expect(countSentences('Use a tag, e.g. 1.0. Then push.')).toBe(2);
    expect(countSentences('Why? Because. Done!')).toBe(3);
  });

  it('extracts references', () => {
    const r = markupRefs('{{term:a}} {{term:b}} {{lesson:c}} {{lab:d}} [x](https://e.com)');
    expect(r.terms).toEqual(['a', 'b']);
    expect(r.lessons).toEqual(['c']);
    expect(r.labs).toEqual(['d']);
    expect(r.links).toEqual([{ label: 'x', href: 'https://e.com' }]);
  });

  it('plainText and proseOnly drop markers; proseOnly drops code', () => {
    expect(plainText('a **b** `c`')).toBe('a b c');
    expect(proseOnly('a != b `x!=y` ok')).toBe('a != b  ok');
  });
});

/** The term nodes of a string, in order. */
function terms(src: string): Extract<MarkupNode, { type: 'term' }>[] {
  const out: Extract<MarkupNode, { type: 'term' }>[] = [];
  walkMarkup(parseMarkup(src).nodes, (n) => {
    if (n.type === 'term') out.push(n);
  });
  return out;
}

const starts = (src: string): boolean[] => terms(src).map((t) => t.start === true);

describe('term modifiers', () => {
  it('reads |lower and |Cap on a term', () => {
    expect(terms('a {{term:instance|lower}} b')[0]).toMatchObject({ id: 'instance', case: 'lower' });
    expect(terms('a {{term:instance|Cap}} b')[0]).toMatchObject({ id: 'instance', case: 'cap' });
    expect(terms('a {{term:instance|CAP}} b')[0]).toMatchObject({ case: 'cap' });
    expect(terms('a {{term:instance}} b')[0]?.case).toBeUndefined();
  });

  it('leaves an unknown modifier as text and reports it', () => {
    const { nodes, problems } = parseMarkup('a {{term:instance|shout}} b');
    expect(problems.map((p) => p.kind)).toEqual(['unknown-modifier']);
    expect(nodes.every((n) => n.type === 'text')).toBe(true);
    expect(plainText('a {{term:instance|shout}} b')).toBe('a {{term:instance|shout}} b');
  });

  it('reports an empty modifier and a modifier on anything but a term', () => {
    expect(parseMarkup('{{term:instance|}}').problems.map((p) => p.kind)).toEqual(['unknown-modifier']);
    expect(parseMarkup('{{lesson:first-deploy|lower}}').problems.map((p) => p.kind)).toEqual([
      'invalid-directive',
    ]);
    expect(parseMarkup('{{term:|lower}}').problems.map((p) => p.kind)).toEqual(['invalid-directive']);
  });

  it('keeps the id clean for the validator and the glossary lookups', () => {
    expect(markupRefs('{{term:instance|lower}} and {{term:renewal|Cap}}').terms).toEqual([
      'instance',
      'renewal',
    ]);
  });

  it('is invisible to plain text, in both views of the text', () => {
    const src = 'Your only {{term:eligible-node|lower}} wins. {{term:eligible-node|Cap}} is next.';
    expect(plainText(src)).toBe('Your only eligible node wins. Eligible node is next.');
    expect(stripMarkup(src)).toBe(plainText(src));
  });
});

describe('where a term opens a sentence', () => {
  it('is true at the start of the text, also inside emphasis and after opening marks', () => {
    expect(starts('{{term:a}} first')).toEqual([true]);
    expect(starts('**{{term:a}}** first')).toEqual([true]);
    expect(starts('  "{{term:a}}" first')).toEqual([true]);
    expect(starts('(**{{term:a}}**) first')).toEqual([true]);
  });

  it('is true after a full stop, a question mark or an exclamation mark and a space', () => {
    expect(starts('Done. {{term:a}} next')).toEqual([true]);
    expect(starts('Done? {{term:a}} next')).toEqual([true]);
    expect(starts('Done! {{term:a}} next')).toEqual([true]);
    expect(starts('Done.  {{term:a}} next')).toEqual([true]);
    expect(starts('He said "stop." {{term:a}} next')).toEqual([true]);
    expect(starts('**Tip.** {{term:a}} next')).toEqual([true]);
    expect(starts('Run `docker ps`. {{term:a}} next')).toEqual([true]);
  });

  it('is true after a newline', () => {
    expect(starts('one\n{{term:a}}')).toEqual([true]);
    expect(starts('one\n  {{term:a}}')).toEqual([true]);
  });

  it('is false in the middle of a sentence', () => {
    expect(starts('your only {{term:a}} here')).toEqual([false]);
    expect(starts('Note: {{term:a}} here')).toEqual([false]);
    expect(starts('(see {{term:a}})')).toEqual([false]);
    expect(starts('Done.{{term:a}}')).toEqual([false]);
    expect(starts('`code` {{term:a}}')).toEqual([false]);
    expect(starts('Press {{kbd:Esc}} then {{term:a}}')).toEqual([false]);
    expect(starts('About 3.5 {{term:a}}')).toEqual([false]);
  });

  it('does not count an abbreviation as the end of a sentence', () => {
    expect(starts('a tag, e.g. {{term:a}}')).toEqual([false]);
    expect(starts('that is, i.e. {{term:a}}')).toEqual([false]);
    expect(starts('Compare vs. {{term:a}}')).toEqual([false]);
  });

  it('follows another term in order', () => {
    expect(starts('{{term:a}} and {{term:b}}')).toEqual([true, false]);
    expect(starts('{{term:a}} {{term:b}}')).toEqual([true, false]);
  });
});

describe('termText', () => {
  it('lower-cases a plain capitalised name in the middle of a sentence', () => {
    expect(termText('Instance')).toBe('instance');
    expect(termText('Eligible node')).toBe('eligible node');
    expect(termText('Primary and standby')).toBe('primary and standby');
    expect(termText('Renewal')).toBe('renewal');
  });

  it('keeps a name that opens a sentence or sits in a heading', () => {
    expect(termText('Instance', { start: true })).toBe('Instance');
    expect(termText('Instance', { heading: true })).toBe('Instance');
  });

  it('keeps a proper noun wherever it stands', () => {
    expect(termText('Flux', { proper: true })).toBe('Flux');
    expect(termText('Docker', { proper: true })).toBe('Docker');
    expect(termText('Cumulus', { proper: true, start: false })).toBe('Cumulus');
  });

  it('keeps acronyms, camel case, names with more capitals and names that are not words', () => {
    for (const name of [
      'FDM',
      'FLUX',
      'ZelID',
      'FluxOS',
      'HAProxy',
      'OP_RETURN',
      'ENOSPC',
      'Internal DNS',
      'DNS propagation',
      "Let's Encrypt",
      'Proof of Node',
      'N minus 1',
      'A record',
      'S3 bucket',
      'port fee',
      'amd64',
      'containerPorts',
      'static IP',
    ]) {
      expect(termText(name), name).toBe(name);
    }
  });

  it('applies an explicit choice over every other rule', () => {
    expect(termText('port fee', { case: 'cap' })).toBe('Port fee');
    expect(termText('Instance', { case: 'lower', start: true })).toBe('instance');
    expect(termText('Flux', { case: 'lower', proper: true })).toBe('flux');
    expect(termText('instance', { case: 'cap', heading: false })).toBe('Instance');
  });

  it('will not lower the first letter of an acronym or a camel-cased name', () => {
    expect(termText('FDM', { case: 'lower' })).toBe('FDM');
    expect(termText('ZelID', { case: 'lower' })).toBe('ZelID');
  });

  it('handles an empty name and a non-latin letter', () => {
    expect(termText('')).toBe('');
    expect(termText('Éclair')).toBe('éclair');
  });
});

describe('plainText with glossary names', () => {
  const names: Record<string, { term: string; proper?: boolean }> = {
    instance: { term: 'Instance' },
    renewal: { term: 'Renewal' },
    flux: { term: 'Flux', proper: true },
    fdm: { term: 'FDM', proper: true },
  };
  const resolve: TermResolver = (id) => names[id];

  it('reads a term as its display name with the same case rules as the renderers', () => {
    expect(plainText('Your only {{term:instance}} runs on {{term:flux}}.', resolve)).toBe(
      'Your only instance runs on Flux.',
    );
    expect(plainText('{{term:renewal}} adds time. A {{term:renewal}} costs.', resolve)).toBe(
      'Renewal adds time. A renewal costs.',
    );
    expect(plainText('Ask the {{term:fdm}}.', resolve)).toBe('Ask the FDM.');
  });

  it('applies the explicit choice', () => {
    expect(plainText('A {{term:instance|Cap}} and {{term:flux|lower}}.', resolve)).toBe(
      'A Instance and flux.',
    );
  });

  it('falls back to the words of the id for a term it does not know', () => {
    expect(plainText('See {{term:eligible-node}} and {{term:zero_x}}.', resolve)).toBe(
      'See eligible node and zero x.',
    );
    expect(plainText('See {{term:eligible-node}}.')).toBe('See eligible node.');
    expect(idWords('a-b_c')).toBe('a b c');
  });
});

describe('one parser for every reader', () => {
  const SAMPLES = [
    'Run **docker build**, then *push* `me/app:1.0`.',
    'Press {{kbd:Ctrl + K}} or {{kbd:g o}}; read [the docs](https://docs.runonflux.com).',
    'See {{term:fdm}}, {{lesson:first-deploy}} and {{lab:spec-forge}}.',
    '**bold *and italic***, \\*escaped\\* and a * b.',
    '[**bold** label](/learn) and [mail](mailto:team@example.com).',
    'Unfinished **bold, a `tick and {{term:x',
  ];

  it('gives the design system and the lesson renderer the same words', () => {
    for (const src of SAMPLES) {
      expect(stripMarkup(src), src).toBe(plainText(src));
    }
  });

  it('hands both trees the same structure', () => {
    for (const src of SAMPLES) {
      const lesson = parseMarkup(src).nodes;
      const ds = parseTreeOfDesignSystem(src);
      const lessonKinds: string[] = [];
      walkMarkup(lesson, (n) => lessonKinds.push(n.type));
      const dsKinds: string[] = [];
      const visit = (list: ReturnType<typeof parseTreeOfDesignSystem>) => {
        for (const n of list) {
          dsKinds.push(n.type === 'strong' ? 'bold' : n.type === 'em' ? 'italic' : n.type);
          if (n.type === 'strong' || n.type === 'em' || n.type === 'link') visit(n.children);
        }
      };
      visit(ds);
      expect(lessonKinds, src).toEqual(dsKinds);
    }
  });

  it('keeps an unsafe link for the validator and drops it for a renderer', () => {
    const src = 'a [click](javascript:alert(1)) b';
    const link = parseMarkup(src).nodes.find((n) => n.type === 'link');
    expect(link).toMatchObject({ type: 'link', label: 'click', href: 'javascript:alert(1)', unsafe: true });
    expect(markupRefs(src).links).toEqual([{ label: 'click', href: 'javascript:alert(1)' }]);
    expect(parseTreeOfDesignSystem(src).some((n) => n.type === 'link')).toBe(false);
    expect(stripMarkup(src)).toBe('a click b');
  });

  it('can skip the bookkeeping without changing the tree', () => {
    const src = 'a **b and {{term:x|lower}} `c';
    expect(parseTree(src, { report: false }).nodes).toEqual(parseTree(src).nodes);
    expect(parseTree(src, { report: false }).problems).toEqual([]);
  });

  it('gives a link label its emphasis and its plain text', () => {
    const link = parseMarkup('[**bold** and *italic*](/x)').nodes[0];
    expect(link).toMatchObject({ type: 'link', label: 'bold and italic', href: '/x' });
    expect(link?.type === 'link' ? link.children?.map((c) => c.type) : []).toEqual([
      'bold',
      'text',
      'italic',
    ]);
  });

  it('maps a key combination to the keycap the same way for everyone', () => {
    expect(comboFor('Cmd+K')).toBe('mod+K');
    expect(comboFor('Ctrl+plus')).toBe('Ctrl+plus');
    expect(comboFor('g o')).toBe('g o');
    const kbd = parseMarkup('{{kbd:Ctrl + Shift + P}}').nodes[0];
    expect(kbd).toMatchObject({ type: 'kbd', keys: ['Ctrl', 'Shift', 'P'], combo: 'Ctrl+Shift+P' });
  });
});

describe('problems', () => {
  const kinds = (s: string) => parseMarkup(s).problems.map((p) => p.kind);

  it('reports where a problem starts', () => {
    expect(parseMarkup('ab **cd').problems[0]).toMatchObject({ kind: 'unbalanced-bold', at: 3 });
    expect(parseMarkup('a {{nope:x}} b').problems[0]).toMatchObject({ kind: 'unknown-directive', at: 2 });
    expect(parseMarkup('a `b').problems[0]).toMatchObject({ kind: 'unbalanced-code', at: 2 });
  });

  it('reports an id that is not an id once, not again as a stray close', () => {
    expect(kinds('a {{term:a b}} c')).toEqual(['invalid-directive']);
    expect(kinds('a {{kbd:{x}} c')).not.toContain('stray-close');
  });

  it('reports a delimiter left unmatched inside a container', () => {
    expect(kinds('**a *b** c')).toEqual(['unbalanced-italic']);
    expect(kinds('*a **b* c')).toEqual(['unbalanced-italic', 'unbalanced-italic']);
    expect(kinds('a **b *c** d')).toEqual(['unbalanced-italic']);
  });

  it('is not troubled by a star with spaces, an escape or a snake_case word', () => {
    expect(kinds('2 * 3 = 6 and \\*not italic\\* and snake_case_name')).toEqual([]);
  });

  it('reports every problem of a string, in order', () => {
    expect(kinds('**a `b {{term:}} }}')).toEqual([
      'unbalanced-bold',
      'unbalanced-code',
      'empty-directive',
      'stray-close',
    ]);
  });

  it('does not take a close brace inside code for a stray one', () => {
    expect(kinds('use `}}` and `{{x}}`')).toEqual([]);
  });
});
