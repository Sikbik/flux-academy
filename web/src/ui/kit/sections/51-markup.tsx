import { useMemo, useState } from 'react';
import { Markup, type MarkupContext, MarkupProvider, type MarkupTerm } from '../..';
import { Col, Grid, Group, type KitSectionMeta, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'markup', title: 'Markup', order: 51 };

const GLOSSARY: Record<string, MarkupTerm> = {
  node: {
    term: 'node',
    short: 'A computer that runs apps for the network. Each one is operated by a different person.',
    why: 'Your app lives on several nodes at once, so one failure does not take it down.',
    href: '/glossary#node',
  },
  instance: {
    term: 'instance',
    short:
      'One running copy of your app on one node. Three instances means three copies on three **different** nodes.',
    href: '/glossary#instance',
  },
  spec: {
    term: 'app spec',
    short:
      'The JSON that describes an app: which image to run, which ports to open and how much CPU and memory to ask for.',
    why: 'Everything the network does for you starts from this file.',
  },
};

const LESSONS: Record<string, { title: string; href: string }> = {
  'first-deploy': { title: 'Your first deploy', href: '/learn/cumulus/first-deploy' },
};

const LABS: Record<string, { title: string; href: string }> = {
  'spec-forge': { title: 'Spec Forge', href: '/labs/spec-forge' },
};

const SAMPLE =
  'Every app starts as an {{term:spec}}. Write it in the **Spec Forge**, check the *price* it asks for, then run `docker ps` to see the {{term:instance}} come up on a {{term:node}}. Press {{kbd:Ctrl+K}} to search, read [the Flux docs](https://docs.runonflux.com) for the long version, or continue with {{lesson:first-deploy}} or open the {{lab:spec-forge}}.';

export default function MarkupSection() {
  const [navigated, setNavigated] = useState<string | null>(null);
  const context = useMemo<MarkupContext>(
    () => ({
      term: (id) => GLOSSARY[id],
      lesson: (id) => LESSONS[id],
      lab: (id) => LABS[id],
      navigate: (href) => setNavigated(href),
    }),
    [],
  );

  return (
    <Group
      id="markup"
      title="Markup"
      lead="The inline voice of lesson prose: bold, italic, code, links, glossary terms, lesson and lab references, key caps. A parser turns the string into a small tree and the renderer builds React elements from it, so no string can ever become HTML. Anything unterminated or unsafe stays plain text."
    >
      <MarkupProvider value={context}>
        <Sub>In a paragraph (lesson voice, 1.0625rem, 62ch)</Sub>
        <Markup block text={SAMPLE} />

        <Sub>Each piece</Sub>
        <Grid min={300}>
          <Spec label="bold, italic, code">
            <Markup
              block
              text="Use **bold** for the one thing to remember, *italic* for stress, and `inline code` for names you type."
            />
          </Spec>
          <Spec
            label="nested"
            note="Bold holds italic, code, terms and keys; a link label takes bold and italic."
          >
            <Markup
              block
              text="**Always run `npm ci` before the *first* build**, then press **{{kbd:Ctrl+Shift+P}}**. See [the **full** guide](/learn)."
            />
          </Spec>
          <Spec
            label="link: external"
            note="Opens in a new tab with rel noopener noreferrer, a hint for screen readers and a small glyph."
          >
            <Markup
              block
              text="Read [the Flux documentation](https://docs.runonflux.com) before you start."
            />
          </Spec>
          <Spec
            label="link: site-relative"
            note={
              navigated
                ? `navigate("${navigated}") was called`
                : 'A plain click calls navigate(); modified clicks keep the browser behaviour.'
            }
          >
            <Markup block text="Back to [the course map](/learn) or jump to [the next step](#step-3)." />
          </Spec>
          <Spec
            label="term, with a card"
            note="Hover or focus opens it; press or Enter opens it and moves focus in. Escape closes."
          >
            <Markup
              block
              text="An {{term:instance}} runs on a {{term:node}}, and both are described by the {{term:spec}}."
            />
          </Spec>
          <Spec label="term, not in the glossary" note="Reads as its id with a dotted underline and no card.">
            <Markup block text="The {{term:flux-daemon-manager}} is not defined here." />
          </Spec>
          <Spec
            label="lesson and lab links"
            note="Titles come from the context; without one the id is prettified."
          >
            <Markup
              block
              text="Next up: {{lesson:first-deploy}}. Try it hands on in {{lab:spec-forge}}. Unknown ids still link: {{lesson:custom-domains}} and {{lab:failover-drill}}."
            />
          </Spec>
          <Spec label="kbd" note="Cmd, Command and Meta mean the platform key; Ctrl stays Ctrl.">
            <Markup
              block
              text="Search with {{kbd:Cmd+K}}, close with {{kbd:Esc}}, jump with {{kbd:g}} then {{kbd:o}}, or {{kbd:g o}} as a sequence."
            />
          </Spec>
          <Spec label="escapes" note="A backslash keeps the next markup character literal.">
            <Markup
              block
              text="Write \*stars\* and \`ticks\` and \[brackets\] literally, and a path like C:\Users\me is untouched."
            />
          </Spec>
          <Spec label="unterminated stays literal" note="No half-formed markup ever swallows the sentence.">
            <Markup
              block
              text="A lone **bold and a stray *star and an open `tick and [a label](/oops stay as written."
            />
          </Spec>
          <Spec
            label="hostile content"
            note="Only http, https, mailto and site-relative targets become links; the rest keep the label as text. Tags are text."
          >
            <Markup
              block
              text="[Click me](javascript:alert(1)) and [this](data:text/html;base64,PHNjcmlwdD4=) and <script>alert(1)</script> and <img src=x onerror=alert(1)>."
            />
          </Spec>
          <Spec
            label="inline mode"
            note="No wrapper, and terms never open cards: for titles, labels and card text."
          >
            <Col gap={10}>
              <span className="t-h4">
                <Markup inline text="Why an {{term:instance}} is not a **server**" />
              </span>
              <span className="t-label">
                <Markup inline text="Step 2 of 6 · {{kbd:Enter}} to continue" />
              </span>
            </Col>
          </Spec>
        </Grid>
      </MarkupProvider>
    </Group>
  );
}
