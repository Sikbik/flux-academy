import { useEffect, useMemo, useState } from 'react';
import { useChainClock, useNetworkSelect, useSectionAge } from '@/data';
import { freshnessKind } from '@/data/chips';
import { formatInt } from '@/lib/format';
import { storyPlan } from '@/scenes/lib/story';
import { Chip, FreshnessChip, tokenizeCode } from '@/ui';
import { BLOCKS_RANGE, PLACE_LINES, RUN_LINES, STORY_SPEC } from './copy';
import styles from './figures.module.css';
import { asOfLine, deployChip, groupHex, typedCount } from './logic';

const LINE_COUNT = STORY_SPEC.split('\n').length;

/** The spec, typed out as the cell forms around it. Highlighted by the lesson code tokenizer. */
export function SpecFigure({ progress }: { progress: number }) {
  const n = typedCount(STORY_SPEC.length, progress, 0.9);
  const lines = useMemo(() => tokenizeCode(STORY_SPEC.slice(0, n), 'json'), [n]);
  const typing = n < STORY_SPEC.length;
  return (
    <div className={styles.code} style={{ '--lines': LINE_COUNT } as React.CSSProperties}>
      <pre className={styles.pre} aria-hidden="true">
        <code>
          {lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines of one fixed text
            <span key={i} className={styles.codeLine}>
              {line.map((t, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: tokens of one fixed line
                <span key={j} data-t={t.type}>
                  {t.text}
                </span>
              ))}
              {typing && i === lines.length - 1 ? <span className={styles.caret} /> : null}
            </span>
          ))}
        </code>
      </pre>
      <pre className="sr-only">{STORY_SPEC}</pre>
    </div>
  );
}

let digest: Promise<string | null> | null = null;

/** SHA-256 of the story spec, computed once in the browser. Null where SubtleCrypto is missing. */
function specHash(): Promise<string | null> {
  if (!digest) {
    const subtle = globalThis.crypto?.subtle;
    digest = subtle
      ? subtle
          .digest('SHA-256', new TextEncoder().encode(STORY_SPEC))
          .then((buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join(''))
          .catch(() => null)
      : Promise.resolve(null);
  }
  return digest;
}

function useSpecHash(): string | null {
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void specHash().then((h) => {
      if (alive) setHash(h);
    });
    return () => {
      alive = false;
    };
  }, []);
  return hash;
}

function Row({ label, on, children }: { label: string; on: boolean; children: React.ReactNode }) {
  return (
    <div className={styles.row} data-on={on ? 'true' : 'false'}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * The register step as four rows that light in the order the scene stamps the chain: the hash, the
 * payment that carries it, the next real block, and the wait for a match.
 */
export function HashFigure({ progress }: { progress: number }) {
  const hash = useSpecHash();
  const clock = useChainClock();
  const sec = useSectionAge('chain');
  const shown = hash ? groupHex(hash.slice(0, typedCount(32, progress, 0.4)), 8, 4) : '';
  const live = clock.live && clock.nextBlockInMs !== null;
  const seconds = live && clock.nextBlockInMs !== null ? Math.ceil(clock.nextBlockInMs / 1000) : null;
  const asOf = asOfLine(sec.status, sec.asOf);
  const next = clock.height === null ? null : clock.height + 1;
  return (
    <dl className={styles.rows}>
      <Row label="SHA-256" on={progress > 0.02}>
        <span className={styles.hash}>
          {hash
            ? shown.split(' ').map((g) => (
                <span key={g} className={styles.group}>
                  {g}
                </span>
              ))
            : 'computed in your browser'}
        </span>
      </Row>
      <Row label="Payment" on={progress >= 0.4}>
        FLUX sent with that hash attached (a card payment is relayed for you)
      </Row>
      <Row label="Next block" on={progress >= 0.46}>
        <span className={styles.block}>
          <span className={styles.num}>{next === null ? '--' : formatInt(next)}</span>
          <FreshnessChip
            kind={freshnessKind(sec.status)}
            ageMs={sec.ageMs}
            hideAge={sec.status === 'fallback'}
          />
        </span>
        <span className={styles.sub}>
          {seconds !== null ? `Lands in about ${seconds} s` : (asOf ?? 'Waiting for the next block')}
        </span>
      </Row>
      <Row label="Match" on={progress >= 0.52}>
        Nodes usually link payment to spec within {BLOCKS_RANGE}
      </Row>
    </dl>
  );
}

/** The place step: how many copies the story has placed, in words, and the real size of each tier. */
export function PlaceFigure({ progress }: { progress: number }) {
  const placed = storyPlan(2, progress).instances;
  const tiers = useNetworkSelect((n) => n.nodes.tiers);
  const sec = useSectionAge('nodes');
  const asOf = asOfLine(sec.status, sec.asOf);
  return (
    <div className={styles.place}>
      <div className={styles.copies} role="img" aria-label={`${placed} of 3 copies placed`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={styles.copy} data-on={i < placed ? 'true' : 'false'} aria-hidden="true" />
        ))}
        <span className={styles.copiesText}>{placed} of 3 copies placed</span>
      </div>
      <p className={styles.line}>{PLACE_LINES[Math.min(3, placed)]}</p>
      <div className={styles.tiers}>
        {(['cumulus', 'nimbus', 'stratus'] as const).map((t) => (
          <Chip key={t} tier={t} size="sm">
            {t} {tiers ? formatInt(tiers[t]) : '--'}
          </Chip>
        ))}
        {asOf ? (
          <span className={styles.asOf}>{asOf}</span>
        ) : (
          <FreshnessChip kind={freshnessKind(sec.status)} ageMs={sec.ageMs} />
        )}
      </div>
    </div>
  );
}

/** The run step: three copies, one goes dark, the balancer routes around it. */
export function RunFigure({ progress }: { progress: number }) {
  const plan = storyPlan(3, progress);
  const healthy = plan.broken ? 2 : 3;
  const chip = deployChip(3, healthy);
  const line = plan.broken ? RUN_LINES.broken : progress >= 0.86 ? RUN_LINES.healed : RUN_LINES.healthy;
  return (
    <div className={styles.run}>
      <Chip kind="status" status={chip.tone}>
        {chip.text}
      </Chip>
      <p className={styles.line}>{line}</p>
    </div>
  );
}
