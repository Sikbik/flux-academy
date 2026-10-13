import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_DEPTH, type MarkupNode, parseMarkup, stripMarkup } from './parse';

/** A compact, readable serialisation of a tree (for assertions only; not markup). */
function show(nodes: readonly MarkupNode[]): string {
  return nodes
    .map((n): string => {
      switch (n.type) {
        case 'text':
          return n.text;
        case 'strong':
          return `<b>${show(n.children)}</b>`;
        case 'em':
          return `<i>${show(n.children)}</i>`;
        case 'code':
          return `<c>${n.text}</c>`;
        case 'link':
          return `<a ${n.href}>${show(n.children)}</a>`;
        case 'term':
          return `<term ${n.id}>`;
        case 'lesson':
          return `<lesson ${n.id}>`;
        case 'lab':
          return `<lab ${n.id}>`;
        case 'kbd':
          return `<kbd ${n.combo}>`;
        default:
          return '';
      }
    })
    .join('');
}

const p = (s: string) => show(parseMarkup(s));

function depth(nodes: readonly MarkupNode[]): number {
  let max = 0;
  const stack: Array<{ list: readonly MarkupNode[]; d: number }> = [{ list: nodes, d: 0 }];
  while (stack.length) {
    const { list, d } = stack.pop() as { list: readonly MarkupNode[]; d: number };
    max = Math.max(max, d);
    for (const n of list) {
      if (n.type === 'strong' || n.type === 'em' || n.type === 'link')
        stack.push({ list: n.children, d: d + 1 });
    }
  }
  return max;
}

function timed<T>(fn: () => T): { value: T; ms: number } {
  const t = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t };
}

describe('parseMarkup: basics', () => {
  it('returns nothing for empty input', () => {
    expect(parseMarkup('')).toEqual([]);
  });

  it('returns plain text as one text node', () => {
    expect(parseMarkup('Just words, nothing else.')).toEqual([
      { type: 'text', text: 'Just words, nothing else.' },
    ]);
  });

  it('parses bold, italic and code', () => {
    expect(p('a **b** c')).toBe('a <b>b</b> c');
    expect(p('a *b* c')).toBe('a <i>b</i> c');
    expect(p('a `b` c')).toBe('a <c>b</c> c');
  });

  it('parses links', () => {
    expect(p('see [the docs](https://docs.runonflux.com) now')).toBe(
      'see <a https://docs.runonflux.com>the docs</a> now',
    );
    expect(p('[home](/learn)')).toBe('<a /learn>home</a>');
    expect(p('[jump](#step-2)')).toBe('<a #step-2>jump</a>');
    expect(p('[mail](mailto:team@example.com)')).toBe('<a mailto:team@example.com>mail</a>');
  });

  it('parses tokens', () => {
    expect(p('a {{term:fdm}} b')).toBe('a <term fdm> b');
    expect(p('{{lesson:first-deploy}}')).toBe('<lesson first-deploy>');
    expect(p('{{lab:spec-forge}}')).toBe('<lab spec-forge>');
    expect(p('press {{kbd:Ctrl+K}} now')).toBe('press <kbd Ctrl+K> now');
  });

  it('treats spaces around a plus in a key combo as decoration', () => {
    expect(p('{{kbd:Ctrl + Shift + P}}')).toBe('<kbd Ctrl+Shift+P>');
  });

  it('keeps a key sequence as a sequence', () => {
    expect(p('{{kbd:g o}}')).toBe('<kbd g o>');
  });

  it('merges adjacent text', () => {
    const nodes = parseMarkup('a \\* b \\* c');
    expect(nodes).toEqual([{ type: 'text', text: 'a * b * c' }]);
  });
});

describe('parseMarkup: nesting', () => {
  it('lets bold hold italic, code, terms and keys', () => {
    expect(p('**a *b* c**')).toBe('<b>a <i>b</i> c</b>');
    expect(p('**run `npm ci` first**')).toBe('<b>run <c>npm ci</c> first</b>');
    expect(p('**the {{term:fdm}} way**')).toBe('<b>the <term fdm> way</b>');
    expect(p('**press {{kbd:Esc}}**')).toBe('<b>press <kbd Esc></b>');
  });

  it('lets italic hold code and terms', () => {
    expect(p('*see `docker ps`*')).toBe('<i>see <c>docker ps</c></i>');
    expect(p('*a {{term:node}} b*')).toBe('<i>a <term node> b</i>');
  });

  it('handles bold and italic together', () => {
    expect(p('***both***')).toBe('<i><b>both</b></i>');
    expect(p('**bold *and italic***')).toBe('<b>bold <i>and italic</i></b>');
    expect(p('*italic **and bold***')).toBe('<i>italic <b>and bold</b></i>');
    expect(p('**a** and *b*')).toBe('<b>a</b> and <i>b</i>');
  });

  it('allows bold and italic inside a link label', () => {
    expect(p('[**bold** and *italic*](/x)')).toBe('<a /x><b>bold</b> and <i>italic</i></a>');
  });

  it('allows a link inside bold and italic', () => {
    expect(p('**[docs](/docs)**')).toBe('<b><a /docs>docs</a></b>');
    expect(p('*read [this](https://example.com) first*')).toBe(
      '<i>read <a https://example.com>this</a> first</i>',
    );
  });

  it('keeps a link label plain: no code, tokens or links', () => {
    expect(p('[`code`](/x)')).toBe('<a /x>`code`</a>');
    expect(p('[{{term:fdm}}](/x)')).toBe('<a /x>{{term:fdm}}</a>');
    expect(p('[a [b](/y) c](/x)')).toBe('[a <a /y>b</a> c](/x)');
  });

  it('keeps code literal', () => {
    expect(p('`**not bold**`')).toBe('<c>**not bold**</c>');
    expect(p('`{{term:fdm}}`')).toBe('<c>{{term:fdm}}</c>');
    expect(p('`[a](/b)`')).toBe('<c>[a](/b)</c>');
    expect(p('`*a*` and *b*')).toBe('<c>*a*</c> and <i>b</i>');
  });

  it('caps nesting depth', () => {
    const nodes = parseMarkup(`${'*'.repeat(200)}deep${'*'.repeat(200)}`);
    expect(depth(nodes)).toBeLessThanOrEqual(MAX_DEPTH);
    expect(stripMarkup(`${'*'.repeat(200)}deep${'*'.repeat(200)}`)).toContain('deep');
  });
});

describe('parseMarkup: escapes', () => {
  it('escapes the markup characters', () => {
    expect(p('\\*not italic\\*')).toBe('*not italic*');
    expect(p('\\`not code\\`')).toBe('`not code`');
    expect(p('\\[not a link\\](/x)')).toBe('[not a link](/x)');
    expect(p('\\{\\{term:fdm\\}\\}')).toBe('{{term:fdm}}');
    expect(p('back\\\\slash')).toBe('back\\slash');
    expect(p('a \\_ b')).toBe('a _ b');
  });

  it('leaves other backslashes alone', () => {
    expect(p('C:\\Users\\me')).toBe('C:\\Users\\me');
    expect(p('trailing\\')).toBe('trailing\\');
  });

  it('lets an escaped star sit next to real emphasis', () => {
    expect(p('\\**a**')).toBe('*<i>a</i>*');
  });

  it('does not take escapes inside code', () => {
    expect(p('`a\\*b`')).toBe('<c>a\\*b</c>');
  });

  it('escapes brackets inside a label', () => {
    expect(p('[a\\]b](/x)')).toBe('<a /x>a]b</a>');
  });
});

describe('parseMarkup: unterminated and unknown stay literal', () => {
  it.each([
    ['**bold'],
    ['*italic'],
    ['bold**'],
    ['`code'],
    ['[label](/x'],
    ['[label](/x y)'],
    ['[label]'],
    ['[label] (/x)'],
    ['{{term:fdm'],
    ['{{term:}}'],
    ['{{term:a b}}'],
    ['{{unknown:x}}'],
    ['{{kbd:}}'],
    ['{{}}'],
    ['{{'],
    ['}}'],
    ['[](/x)'],
    ['a * b * c'],
    ['2 * 3 = 6'],
    ['snake_case_name and __init__'],
  ])('keeps %j as written', (src) => {
    expect(p(src)).toBe(src);
  });

  it('keeps only the dangling part literal', () => {
    expect(p('**a** and **b')).toBe('<b>a</b> and **b');
    expect(p('`a` and `b')).toBe('<c>a</c> and `b');
  });
});

describe('parseMarkup: delimiter precedence', () => {
  it('prefers ** over * where both fit', () => {
    expect(p('**a**')).toBe('<b>a</b>');
    expect(p('*a*')).toBe('<i>a</i>');
  });

  it('matches a short closer against a long opener', () => {
    expect(p('**a*')).toBe('*<i>a</i>');
    expect(p('*a**')).toBe('<i>a</i>*');
  });

  it('keeps adjacent runs apart', () => {
    expect(p('**a** **b**')).toBe('<b>a</b> <b>b</b>');
    expect(p('**a***b*')).toBe('<b>a</b><i>b</i>');
    expect(p('*a*,*b*')).toBe('<i>a</i>,<i>b</i>');
  });

  it('follows the rule of three like CommonMark', () => {
    expect(p('**a****b**')).toBe('<b>a****b</b>');
    expect(p('*a**b*')).toBe('<i>a**b</i>');
  });

  it('treats a star with spaces on both sides as a star', () => {
    expect(p('a * b')).toBe('a * b');
    expect(p('* item')).toBe('* item');
  });

  it('does not span a word boundary the wrong way', () => {
    expect(p('**a **b**')).toBe('**a <b>b</b>');
  });
});

describe('parseMarkup: adjacency', () => {
  it('handles tokens back to back', () => {
    expect(p('{{kbd:Ctrl}}{{kbd:K}}')).toBe('<kbd Ctrl><kbd K>');
    expect(p('{{term:a}}{{term:b}}')).toBe('<term a><term b>');
  });

  it('handles emphasis against tokens and code', () => {
    expect(p('**{{term:fdm}}**')).toBe('<b><term fdm></b>');
    expect(p('*`x`*')).toBe('<i><c>x</c></i>');
    expect(p('`a``b`')).toBe('<c>a``b</c>');
  });

  it('handles links back to back', () => {
    expect(p('[a](/a)[b](/b)')).toBe('<a /a>a</a><a /b>b</a>');
  });

  it('uses the longest matching backtick run', () => {
    expect(p('``a`b``')).toBe('<c>a`b</c>');
    expect(p('` a `')).toBe('<c>a</c>');
    expect(p('`  `')).toBe('<c>  </c>');
  });
});

describe('parseMarkup: unsafe targets', () => {
  it.each([
    ['[click](javascript:alert(1))', 'click'],
    ['[click](JaVaScRiPt:alert(1))', 'click'],
    ['[click](data:text/html;base64,PHNjcmlwdD4=)', 'click'],
    ['[click](vbscript:msgbox(1))', 'click'],
    ['[click](//evil.example/x)', 'click'],
    ['[click](file:///etc/passwd)', 'click'],
    ['[click](tel:+15551234)', 'click'],
    ['[click]()', 'click'],
    ['[**click**](javascript:void(0))', '<b>click</b>'],
  ])('drops the target of %j', (src, expected) => {
    expect(p(src)).toBe(expected);
  });

  it('never returns a link with an unsafe href', () => {
    const hostile = [
      'javascript:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '//example.com',
      '\\\\server\\share',
    ];
    for (const href of hostile) {
      const stack = [parseMarkup(`[x](${href}) and [y](${href.replaceAll(' ', '')})`)];
      while (stack.length) {
        for (const n of stack.pop() as MarkupNode[]) {
          if (n.type === 'link') {
            expect(/^(?:\/(?!\/)|#|\.\.?\/|\?|https?:\/\/|mailto:)/i.test(n.href)).toBe(true);
            stack.push(n.children);
          } else if (n.type === 'strong' || n.type === 'em') stack.push(n.children);
        }
      }
    }
  });
});

describe('parseMarkup: no HTML', () => {
  it('keeps tags as text', () => {
    expect(p('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
    expect(p('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
    expect(p('a &amp; b &lt;')).toBe('a &amp; b &lt;');
  });

  it('only ever returns the known node types', () => {
    const known = new Set(['text', 'strong', 'em', 'code', 'link', 'term', 'lesson', 'lab', 'kbd']);
    const stack = [parseMarkup('**a** *b* `c` [d](/e) {{term:f}} {{lesson:g}} {{lab:h}} {{kbd:I}} <b>j</b>')];
    while (stack.length) {
      for (const n of stack.pop() as MarkupNode[]) {
        expect(known.has(n.type)).toBe(true);
        if ('children' in n) stack.push(n.children);
      }
    }
  });

  it('is rendered without innerHTML', () => {
    for (const file of ['./Markup.tsx', './parse.ts']) {
      const src = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(src).not.toMatch(/dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML/);
    }
  });
});

describe('parseMarkup: Unicode', () => {
  it('flanks on Unicode whitespace and punctuation', () => {
    expect(p('*日本語*')).toBe('<i>日本語</i>');
    expect(p('«*quoted*»')).toBe('«<i>quoted</i>»');
    expect(p('a\u00a0*b*\u00a0c')).toBe('a\u00a0<i>b</i>\u00a0c');
    expect(p('*😀*')).toBe('<i>😀</i>');
  });
});

describe('parseMarkup: linear time', () => {
  const N = 100_000;
  const budget = 2500;
  const cases: Array<[string, string]> = [
    ['many unmatched openers', '*a '.repeat(N)],
    ['many unmatched closers', 'a* '.repeat(N)],
    ['a long star run', '*'.repeat(N * 2)],
    ['a long star run around a word', `${'*'.repeat(N)}a${'*'.repeat(N)}`],
    ['matched pairs', '*a* '.repeat(N)],
    ['alternating bold and italic', '**a *b '.repeat(N / 2)],
    ['open brackets', '['.repeat(N)],
    ['bracket then paren', '[a](x'.repeat(N / 4)],
    ['bracket pairs without targets', '[a] '.repeat(N)],
    ['backticks', '`'.repeat(N)],
    [
      'backtick runs of growing length',
      Array.from({ length: 400 }, (_, i) => `${'`'.repeat(i + 1)} x `).join(''),
    ],
    ['lone backticks', 'a ` '.repeat(N)],
    ['open braces', '{{'.repeat(N)],
    ['unterminated tokens', '{{term:a '.repeat(N / 4)],
    ['escapes', '\\*'.repeat(N)],
    ['one very long word', 'a'.repeat(N * 5)],
    ['emphasis with links', '*[a](/b)* '.repeat(N / 4)],
    ['nested openers then closers', `${'*a '.repeat(N / 2)}${'a* '.repeat(N / 2)}`],
  ];

  it.each(cases)('stays fast on %s', (_name, src) => {
    const { value, ms } = timed(() => parseMarkup(src));
    expect(ms).toBeLessThan(budget);
    expect(depth(value)).toBeLessThanOrEqual(MAX_DEPTH + 1);
  });

  it('stays fast on stripMarkup of a large document', () => {
    const src = '**bold** and *italic* with `code` and [a link](/x) and {{term:fdm}}. '.repeat(5000);
    const { ms } = timed(() => stripMarkup(src));
    expect(ms).toBeLessThan(budget);
  });
});

describe('parseMarkup: fuzz', () => {
  // A seeded generator, so a failure is reproducible.
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }
  const PIECES = [
    '*',
    '**',
    '***',
    '`',
    '``',
    '[',
    ']',
    '(',
    ')',
    '{{',
    '}}',
    'term:',
    'kbd:',
    'a',
    'b ',
    ' ',
    '\\',
    '/x',
    'https://a.b',
    'javascript:',
    '#',
    '\n',
    '<b>',
    '_',
  ];

  it('never throws and always returns a bounded, safe tree', () => {
    const next = rng(0xf1ac);
    for (let round = 0; round < 400; round++) {
      let s = '';
      const len = 1 + Math.floor(next() * 40);
      for (let i = 0; i < len; i++) s += PIECES[Math.floor(next() * PIECES.length)];
      const nodes = parseMarkup(s);
      expect(depth(nodes)).toBeLessThanOrEqual(MAX_DEPTH + 1);
      const stack = [nodes];
      while (stack.length) {
        for (const n of stack.pop() as MarkupNode[]) {
          if (n.type === 'link') {
            expect(/^(?:\/(?!\/)|#|\.\.?\/|\?|https?:\/\/|mailto:)/i.test(n.href)).toBe(true);
            expect(n.children.length).toBeGreaterThan(0);
            stack.push(n.children);
          } else if (n.type === 'strong' || n.type === 'em') {
            expect(n.children.length).toBeGreaterThan(0);
            stack.push(n.children);
          } else if (n.type === 'text') {
            expect(n.text).not.toBe('');
          }
        }
      }
      expect(typeof stripMarkup(s)).toBe('string');
    }
  });
});

describe('stripMarkup', () => {
  it('returns what a reader sees', () => {
    expect(stripMarkup('**Bold** and *italic* with `code`, [a link](/x) and {{kbd:Ctrl+K}}.')).toBe(
      'Bold and italic with code, a link and Ctrl+K.',
    );
  });

  it('reads tokens as their ids', () => {
    expect(stripMarkup('the {{term:flux-node}} and {{lesson:first-deploy}}')).toBe(
      'the flux node and first deploy',
    );
  });
});
