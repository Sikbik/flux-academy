import { Col, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'type', title: 'Type', order: 11 };

export default function Type() {
  return (
    <Group
      id="type"
      title="Type"
      lead="Montserrat leads, Open Sans carries the text, IBM Plex Mono is the instrument voice, Lora is the accent (one editorial line per page). Mixed weights in a headline are the signature; numbers are always tabular."
    >
      <Col gap={28}>
        <Spec label="Display  clamp(2.75rem, 7.5vw, 7rem)  300 and 700, tracking -0.04em, line 0.95">
          <div className="t-display">
            Learn to run apps on <b className="t-grad">7,105</b> machines nobody owns.
          </div>
        </Spec>
        <Spec label="H2  clamp(1.875rem, 4vw, 3.5rem)  600, tracking -0.03em">
          <h2 className="t-h2">Place it, break it, heal it.</h2>
        </Spec>
        <Spec label="H3  1.25 to 1.5rem  600">
          <h3 className="t-h3">Three instances is the floor</h3>
        </Spec>
        <Spec label="H4  1.0625rem  600">
          <h4 className="t-h4">Why the network cares</h4>
        </Spec>
        <Spec label="Lead  1.0625 to 1.3125rem">
          <p className="t-lead">
            A FluxNode is an independent machine that runs your container and is paid for it every block.
          </p>
        </Spec>
        <Spec label="Lesson body  1.0625rem, 1.65, measure 62ch, text-2">
          <p className="t-lesson">
            A spec is a JSON file that says what to run and how big it should be. You register it on the
            chain, nodes see it in the next block, and the network places the instances. Nothing else is
            needed: no servers to rent, no accounts to open with a cloud provider.
          </p>
        </Spec>
        <Row align="start">
          <Spec label="Label  mono 12, uppercase, tracking 0.12em, text-3">
            <span className="t-label">03 / Deploy</span>
          </Spec>
          <Spec label="Figure caption">
            <span className="t-label">FIG 3.2 &nbsp; Placement of three instances</span>
          </Spec>
          <Spec label="Mono, tabular">
            <span className="t-mono t-1">1,284,017 &nbsp; 0.5 vCPU &nbsp; 2.00 GB</span>
          </Spec>
        </Row>
        <Row align="start">
          <Spec label="Stat  Montserrat 300, tabular">
            <span className="t-stat">$4.20</span>
          </Spec>
          <Spec label="Accent  Lora italic, one per page">
            <span className="t-accent" style={{ fontSize: '1.25rem' }}>
              Every app is a small bet on the network.
            </span>
          </Spec>
          <Spec label="Small / caption">
            <span className="t-small">Prices come from the pricing engine and always show their basis.</span>
          </Spec>
        </Row>
      </Col>

      <Sub>Inline</Sub>
      <p className="t-lesson">
        This is body text with <strong>strong emphasis</strong>, <em>italic</em>, <code>inline code</code>, a{' '}
        <a className="link" href="#type">
          text link
        </a>{' '}
        and a <span style={{ borderBlockEnd: '1px dotted var(--accent-text)' }}>dotted term</span>.
      </p>
    </Group>
  );
}
