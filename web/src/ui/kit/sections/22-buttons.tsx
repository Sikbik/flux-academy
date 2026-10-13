import { useState } from 'react';
import { Button, IconButton, LinkButton } from '../..';
import { Col, Grid, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'buttons', title: 'Buttons', order: 22 };

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const;
const STATES = [
  ['rest', undefined],
  ['hover', 'hover'],
  ['pressed', 'press'],
  ['focus-visible', 'focus'],
] as const;

export default function Buttons() {
  const [busy, setBusy] = useState(false);
  return (
    <Group
      id="buttons"
      title="Buttons"
      lead="Chamfered, luminous, physical. Primary is magnetic (up to 6 px within 80 px, fine pointers only). Presses compress with a snap on release; keyboard focus sweeps a white-hot rim once around the chamfer. Targets are 44 px (the small size grows on touch)."
    >
      <Sub>Variants and states</Sub>
      <Grid min={190}>
        {VARIANTS.map((v) => (
          <Col key={v} gap={14}>
            <span className="t-label">{v}</span>
            {STATES.map(([name, force]) => (
              <Spec key={name} label={name}>
                <Row>
                  <Button variant={v} data-force={force} magnetic={false}>
                    {v === 'primary'
                      ? 'Start the course'
                      : v === 'danger'
                        ? 'Reset progress'
                        : 'Open the forge'}
                  </Button>
                </Row>
              </Spec>
            ))}
            <Spec label="disabled">
              <Row>
                <Button variant={v} disabled>
                  Disabled
                </Button>
              </Row>
            </Spec>
            <Spec label="loading">
              <Row>
                <Button variant={v} loading>
                  Deploying
                </Button>
              </Row>
            </Spec>
          </Col>
        ))}
      </Grid>

      <Sub>Sizes, icons, widths</Sub>
      <Row>
        <Button size="sm" variant="secondary">
          Small 36
        </Button>
        <Button size="md" variant="secondary">
          Medium 44
        </Button>
        <Button size="lg" variant="primary" iconEnd="arrow-right">
          Large 52
        </Button>
        <Button variant="secondary" icon="copy">
          Copy JSON
        </Button>
        <Button variant="ghost" icon="download">
          Download
        </Button>
        <Button
          variant="primary"
          loading={busy}
          onClick={() => {
            setBusy(true);
            window.setTimeout(() => setBusy(false), 1600);
          }}
        >
          Click to load
        </Button>
      </Row>
      <div style={{ maxInlineSize: 420, marginBlockStart: 16 }}>
        <Button variant="secondary" fullWidth iconEnd="chevron-right">
          Full width
        </Button>
      </div>

      <Sub>Links that look like buttons</Sub>
      <Row>
        <LinkButton href="https://docs.runonflux.com" variant="secondary" iconEnd="external">
          Flux docs
        </LinkButton>
        <LinkButton href="#buttons" variant="ghost">
          Internal link
        </LinkButton>
        <LinkButton href="#buttons" variant="primary" aria-disabled>
          Disabled link
        </LinkButton>
      </Row>

      <Sub>Icon buttons (a label is required; it is the tooltip)</Sub>
      <Row>
        <IconButton icon="copy" label="Copy JSON" shortcut="mod+shift+c" />
        <IconButton icon="download" label="Download" variant="ghost" />
        <IconButton icon="restart" label="Restart" shape="hex" />
        <IconButton icon="play" label="Run" variant="primary" shape="hex" />
        <IconButton icon="menu" label="Menu" size="sm" />
        <IconButton icon="reset" label="Reset" variant="danger" />
        <IconButton icon="search" label="Search" data-force="hover" />
        <IconButton icon="share" label="Share" data-force="focus" />
        <IconButton icon="lock" label="Locked" disabled />
      </Row>
    </Group>
  );
}
