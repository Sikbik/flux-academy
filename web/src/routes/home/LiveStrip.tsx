import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useBeatCount } from '@/app/beat';
import { useChainClock, useFluxPrice, useNetworkSelect, useSectionAge } from '@/data';
import { freshnessKind } from '@/data/chips';
import { formatInt } from '@/lib/format';
import { hexSegments } from '@/lib/hex';
import { Panel, Stat, useReducedMotion } from '@/ui';
import { asOfLine, describeChange, litSegments, RING_SEGMENTS } from './logic';
import styles from './strip.module.css';

const RING = hexSegments(50, 50, 43, RING_SEGMENTS, 0.008);

/**
 * The next-block ring: thirty cells around a hexagon, one per second of the target, filling toward the
 * next real block. It never counts down unless the clock is anchored to a live block: offline there is no
 * beat, so the ring stays dark and says so (docs/DESIGN.md section 4).
 */
function BlockRing({
  lit,
  live,
  flare,
  children,
}: {
  lit: number;
  live: boolean;
  flare: number;
  children: React.ReactNode;
}) {
  return (
    <span
      className={styles.ring}
      data-live={live ? 'true' : 'false'}
      data-flare={flare % 2 === 0 ? 'a' : 'b'}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        {RING.map((d, i) => (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed ring of cells
            key={i}
            d={d}
            className={styles.seg}
            data-lit={i < lit ? '' : undefined}
            data-head={i === lit - 1 ? '' : undefined}
          />
        ))}
      </svg>
      <span className={styles.ringText}>{children}</span>
    </span>
  );
}

function BlockCell() {
  const clock = useChainClock();
  const section = useSectionAge('chain');
  const beat = useBeatCount();
  const reduced = useReducedMotion();
  const [, force] = useState(0);
  const last = useRef(beat);
  useEffect(() => {
    if (last.current !== beat) {
      last.current = beat;
      force((n) => n + 1);
    }
  }, [beat]);

  const live = clock.live && clock.nextBlockInMs !== null;
  const progress = live && clock.nextBlockInMs !== null ? 1 - clock.nextBlockInMs / clock.intervalMs : 0;
  const lit = live ? litSegments(progress) : 0;
  const seconds = live && clock.nextBlockInMs !== null ? Math.ceil(clock.nextBlockInMs / 1000) : null;
  const asOf = asOfLine(section.status, section.asOf);

  return (
    <div className={styles.cell}>
      <Stat
        label="Block height"
        value={clock.height}
        animate="roll"
        freshness={{
          kind: freshnessKind(section.status),
          ageMs: section.ageMs,
          hideAge: section.status === 'fallback',
        }}
        sub={
          live && seconds !== null
            ? `Next block in about ${seconds} s`
            : (asOf ?? 'Waiting for the next block')
        }
        size="md"
      />
      <BlockRing lit={lit} live={live} flare={reduced ? 0 : beat}>
        {seconds !== null ? seconds : '--'}
      </BlockRing>
    </div>
  );
}

function NodesCell() {
  const total = useNetworkSelect((n) => n.nodes.total);
  const countries = useNetworkSelect((n) => n.nodes.countries);
  const section = useSectionAge('nodes');
  const asOf = asOfLine(section.status, section.asOf);
  const bits = ['3 tiers'];
  if (countries !== null && countries > 0) bits.push(`${formatInt(countries)} countries`);
  return (
    <div className={styles.cell}>
      <Stat
        label="Nodes online"
        value={total}
        animate="roll"
        freshness={{
          kind: freshnessKind(section.status),
          ageMs: section.ageMs,
          hideAge: section.status === 'fallback',
        }}
        sub={asOf ? `${bits.join(', ')}. ${asOf}` : bits.join(', ')}
      />
    </div>
  );
}

function PriceCell() {
  const price = useFluxPrice();
  const section = useSectionAge('market');
  const change = describeChange(price.change24hPct);
  const hasPrice = price.usd !== null;
  const asOf = asOfLine(section.status, section.asOf);
  const status = hasPrice ? section.status : price.status;
  return (
    <div className={styles.cell}>
      <Stat
        label="FLUX price"
        value={hasPrice && price.usd !== null ? `$${price.usd.toFixed(price.usd < 1 ? 4 : 2)}` : null}
        freshness={{ kind: freshnessKind(status), ageMs: section.ageMs, hideAge: status === 'fallback' }}
        delta={
          hasPrice && change.direction !== 'none' && price.change24hPct !== null
            ? { value: price.change24hPct, decimals: 2, label: '24 h', good: 'up' }
            : undefined
        }
        sub={hasPrice ? (asOf ?? undefined) : 'No live price right now'}
      />
    </div>
  );
}

/** The live strip along the bottom of the hero: the chain, the machines and the token, each with its age. */
export function LiveStrip() {
  return (
    <Panel
      variant="glass"
      size="md"
      padding="md"
      pattern="tr"
      ruler="top"
      hot="tl"
      className={styles.strip}
      contentClassName={styles.content}
      role="group"
      aria-label="The network right now"
    >
      <div className={styles.cells} style={{ '--cells': 3 } as CSSProperties}>
        <BlockCell />
        <NodesCell />
        <PriceCell />
      </div>
    </Panel>
  );
}
