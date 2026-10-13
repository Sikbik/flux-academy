import { Callout, type CalloutKind, Markup, MarkupProvider } from '../..';
import { Col, Grid, Group, type KitSectionMeta, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'callout', title: 'Callouts', order: 52 };

const KINDS: Array<{ kind: CalloutKind; body: string }> = [
  {
    kind: 'why',
    body: 'Your app runs on several nodes at once. That is what lets one machine fail while the app keeps answering.',
  },
  {
    kind: 'gotcha',
    body: 'The port your container listens on is not the port the world connects to. Mixing them up is the most common first failure.',
  },
  {
    kind: 'tip',
    body: 'Start with `nginx` and a single instance. Change one thing at a time, so you know what moved.',
  },
  {
    kind: 'wild',
    body: 'Teams use three instances for anything that has to stay up through an update: one can restart while two serve.',
  },
  {
    kind: 'cost',
    body: 'Three instances cost three times one. You pay for each copy, so size the CPU and memory to what the app really uses.',
  },
];

export default function CalloutSection() {
  return (
    <Group
      id="callout"
      title="Callouts"
      lead="Marginalia in a lesson: why it matters, a gotcha, a tip, how it looks in the wild, what it costs. A slim chamfered slab with a tick rail, a glyph in a hex, a mono label and the body in the lesson voice. The tint, the glyph and the words each say the kind, so colour is never the only cue."
    >
      <MarkupProvider value={{}}>
        <Sub>The five kinds</Sub>
        <Grid min={420}>
          {KINDS.map(({ kind, body }) => (
            <Spec key={kind} label={kind}>
              <Callout kind={kind}>
                <Markup block text={body} />
              </Callout>
            </Spec>
          ))}
        </Grid>

        <Sub>Compact</Sub>
        <Grid min={420}>
          {KINDS.map(({ kind, body }) => (
            <Spec key={kind} label={`${kind}, compact`}>
              <Callout kind={kind} compact>
                <Markup inline text={body} />
              </Callout>
            </Spec>
          ))}
        </Grid>

        <Sub>Custom label, rich body, narrow column</Sub>
        <Grid min={320}>
          <Spec
            label="custom title"
            note="Read aloud as the kind first: Gotcha: Ports are not what they seem."
          >
            <Callout kind="gotcha" title="Ports are not what they seem">
              <Markup
                block
                text="A container port and the public port are two different numbers. Set both in the **spec**, then check them with `docker ps`."
              />
            </Callout>
          </Spec>
          <Spec label="two paragraphs and a list">
            <Callout kind="tip">
              <Markup block text="Keep the first spec small." />
              <ul>
                <li>One component</li>
                <li>One instance</li>
                <li>No custom domain yet</li>
              </ul>
            </Callout>
          </Spec>
          <Spec label="no body">
            <Callout kind="why" title="Why this lesson exists" />
          </Spec>
          <Col gap={16}>
            <Spec label="in a 280 px column">
              <div style={{ inlineSize: 280 }}>
                <Callout kind="cost" compact>
                  <Markup inline text="Each **extra instance** adds to the monthly price." />
                </Callout>
              </div>
            </Spec>
          </Col>
        </Grid>
      </MarkupProvider>
    </Group>
  );
}
