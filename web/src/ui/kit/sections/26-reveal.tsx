import { useState } from 'react';
import { Button, Panel, Reveal, SplitReveal } from '../..';
import { Group, type KitSectionMeta, Row, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'reveal', title: 'Reveal', order: 26 };

export default function RevealKit() {
  const [run, setRun] = useState(0);
  return (
    <Group
      id="reveal"
      title="Reveal"
      lead="Entrances: opacity, a 24 px rise and an 8 px un-blur, once, with a 60 ms stagger. Headlines rise word by word. Reduced motion keeps an opacity fade and drops the travel."
    >
      <Row>
        <Button variant="secondary" icon="restart" onClick={() => setRun((n) => n + 1)}>
          Replay
        </Button>
      </Row>
      <div key={run}>
        <Sub>SplitReveal</Sub>
        <SplitReveal as="h3" className="t-h2" immediate>
          Place it, <b className="t-grad">break</b> it, heal it.
        </SplitReveal>
        <Sub>Reveal with stagger</Sub>
        <div
          style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
        >
          {['Describe', 'Register', 'Place', 'Run'].map((t, i) => (
            <Reveal key={t} index={i} immediate>
              <Panel size="sm" padding="sm" variant="slab">
                <span className="t-label">
                  {String(i + 1).padStart(2, '0')} / {t}
                </span>
              </Panel>
            </Reveal>
          ))}
        </div>
      </div>
    </Group>
  );
}
