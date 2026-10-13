import { useState } from 'react';
import { Chip, FreshnessChip, Kbd, StatusDot } from '../..';
import { Col, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'status', title: 'Status', order: 23 };

export default function Status() {
  const [picked, setPicked] = useState<Set<string>>(new Set(['Beginner']));
  const toggle = (name: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  return (
    <Group
      id="status"
      title="Status and honesty"
      lead="Live data says it is live, stale data says so, simulations say they are simulations. The word is always there, so colour is never the only carrier."
    >
      <Sub>Freshness</Sub>
      <Row>
        <FreshnessChip kind="live" ageMs={3000} />
        <FreshnessChip kind="live" ageMs={900} polling />
        <FreshnessChip kind="cached" ageMs={120_000} />
        <FreshnessChip kind="offline" />
        <FreshnessChip kind="simulation" />
        <FreshnessChip kind="syncing" />
      </Row>
      <Row>
        <FreshnessChip kind="official" />
        <FreshnessChip kind="computed" />
        <FreshnessChip kind="baked" />
        <FreshnessChip source="cache" ageMs={7_200_000} />
        <FreshnessChip source="fallback" />
      </Row>

      <Sub>Status dots</Sub>
      <Row>
        {(['ok', 'pending', 'warn', 'crit', 'off'] as const).map((s) => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <StatusDot status={s} pulse={s === 'ok'} />
            <span className="t-label">{s}</span>
          </span>
        ))}
      </Row>

      <Sub>Chips</Sub>
      <Row>
        <Chip>Label</Chip>
        <Chip tone="accent">Accent</Chip>
        <Chip icon="clock">12 min</Chip>
        <Chip tier="cumulus">Cumulus</Chip>
        <Chip tier="nimbus">Nimbus</Chip>
        <Chip tier="stratus">Stratus</Chip>
        <Chip size="sm" count={17}>
          Lessons
        </Chip>
      </Row>
      <Row>
        {['Beginner', 'Hands-on', 'Project', 'Concept'].map((n, i) => (
          <Chip
            key={n}
            kind="filter"
            selected={picked.has(n)}
            onClick={() => toggle(n)}
            count={[4, 9, 3, 5][i]}
          >
            {n}
          </Chip>
        ))}
        <Chip kind="filter" data-force="focus" onClick={() => {}}>
          Focus
        </Chip>
        <Chip kind="filter" disabled onClick={() => {}}>
          Disabled
        </Chip>
      </Row>

      <Sub>Keys</Sub>
      <Row align="start">
        <Spec label="mod+k">
          <Kbd combo="mod+k" />
        </Spec>
        <Spec label="shift+/">
          <Kbd combo="shift+/" />
        </Spec>
        <Spec label="g o (sequence)">
          <Kbd combo="g o" />
        </Spec>
        <Spec label="single key">
          <Kbd>Esc</Kbd>
        </Spec>
        <Spec label="small">
          <Kbd combo="ctrl+enter" size="sm" />
        </Spec>
      </Row>
      <Col>
        <span className="t-small">
          Press <Kbd combo="mod+k" size="sm" /> to open the command deck, or <Kbd>?</Kbd> for shortcuts.
        </span>
      </Col>
    </Group>
  );
}
