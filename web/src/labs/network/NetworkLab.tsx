/**
 * Network Lab: the real network on the bench, with the numbers beside it and an explainer layer on top.
 *
 * Everything shown is read from the live snapshots (`useNetwork`, `useGeo`, `useBlocks`) and labelled with
 * how fresh it is. Offline, the data layer serves its baked sample and says so on every chip. Nothing on
 * this page is simulated.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InlineMarkup } from '@/app/InlineMarkup';
import { useLabFrame } from '@/app/LabFrame';
import { useBlocks, useGeo, useNetwork } from '@/data';
import Diorama, { type HoverNodeInfo, REGION_NAMES, REGIONS } from '@/diorama';
import { useLearner } from '@/learn/store';
import { formatInt, formatShare } from '@/lib/format';
import { announce } from '@/system/announce';
import { useHotkey } from '@/system/hotkeys';
import { Panel, SegmentedControl, Select, Stat, Switch, useIsPhone } from '@/ui';
import { BlockPanel } from './BlockPanel';
import { CountryList } from './CountryList';
import { DataChip, DataNote } from './DataChip';
import { ExplainLayer } from './ExplainLayer';
import { buildExplainers } from './explainers';
import { countryRows, meanInterval, type TierFilter, tierSummaries } from './model';
import styles from './NetworkLab.module.css';
import { TierTable } from './TierTable';
import { useExplored } from './useExplored';
import { useStableGeo } from './useStableGeo';

const TIER_WORD: Record<TierFilter, string> = {
  all: 'all tiers',
  cumulus: 'Cumulus',
  nimbus: 'Nimbus',
  stratus: 'Stratus',
};

const TIER_KEYS: readonly TierFilter[] = ['all', 'cumulus', 'nimbus', 'stratus'];

export default function NetworkLab() {
  const geoState = useGeo();
  const netState = useNetwork();
  const blocksState = useBlocks();
  const geo = useStableGeo(geoState.data);
  const net = netState.data;
  const blocks = blocksState.data?.blocks ?? null;

  const [tier, setTier] = useState<TierFilter>('all');
  const [query, setQuery] = useState('');
  const [explain, setExplain] = useState(false);
  const [zoom, setZoom] = useState('');
  const [pinned, setPinned] = useState<string | null>(null);
  // The country being pointed at, and which side pointed: the last interaction wins.
  const [preview, setPreview] = useState<{ code: string; from: 'list' | 'bench' } | null>(null);
  const [benchInfo, setBenchInfo] = useState<HoverNodeInfo | null>(null);
  const { seen, count: exploredCount, goal } = useExplored();
  const medalEarned = useLearner((s) => Boolean(s.achievements.globetrotter));

  const rootRef = useRef<HTMLDivElement>(null);
  const isPhone = useIsPhone();

  // ---- numbers ------------------------------------------------------------------------------------------
  const countries = geo?.countries ?? null;
  const all = useMemo(() => countryRows(countries ?? [], tier), [countries, tier]);
  const rows = useMemo(
    () => (query.trim() ? countryRows(countries ?? [], tier, query).rows : all.rows),
    [countries, tier, query, all.rows],
  );

  const totalNodes = net?.nodes.total ?? geo?.total ?? null;
  const countryCount = net?.nodes.countries ?? countries?.length ?? null;
  const located = geo?.located ?? null;
  const tierCounts = net?.nodes.tiers ?? null;
  const summaries = useMemo(
    () =>
      net
        ? tierSummaries(net.nodes.tiers, net.nodes.collateral, net.rewards.perTier, net.chain.targetBlockSec)
        : null,
    [net],
  );
  const targetSec = net?.chain.targetBlockSec ?? 30;
  const measured = useMemo(() => (blocks ? meanInterval(blocks.slice(-60)) : null), [blocks]);

  // ---- the notes ----------------------------------------------------------------------------------------
  const notes = useMemo(
    () =>
      buildExplainers({
        totalNodes,
        locatedNodes: located,
        countries: countryCount,
        tiers: tierCounts,
        collateral: net?.nodes.collateral ?? null,
        perBlock: net?.rewards.perTier ?? null,
        devFund: net?.rewards.devFund ?? null,
        perBlockTotal: net?.rewards.perBlock ?? null,
        nextReductionHeight: net?.rewards.nextReduction?.height ?? null,
        perBlockAfter: net?.rewards.nextReduction?.perBlockAfter ?? null,
        targetBlockSec: targetSec,
        measuredBlockSec: measured ?? net?.chain.measuredBlockSec ?? null,
        focusTier: tier === 'all' ? null : tier,
      }),
    [totalNodes, located, countryCount, tierCounts, net, targetSec, measured, tier],
  );

  useLabFrame({
    data: ['network', 'geo', 'blocks'],
    teach: [
      'Every number on this page is read from the Flux network when it can be, and each panel says whether it is LIVE, CACHED or a built-in sample and how old it is. The bench is a map you can read: where nodes are, how many, and which tier most of them are.',
      ...notes.map((n) => `**${n.title}.** ${n.body}`),
      'Press **E** or use the "Explain the numbers" switch to draw these notes onto the page itself.',
    ],
    shortcuts: [
      { keys: 'e', label: 'Explain the numbers' },
      { keys: '1', label: 'Cumulus only (2 Nimbus, 3 Stratus, 0 all)' },
    ],
  });

  // ---- hover, focus and the medal -----------------------------------------------------------------------
  const onPreview = useCallback(
    (code: string | null) => {
      setPreview((p) => (code ? { code, from: 'list' } : p?.from === 'list' ? null : p));
      seen(code);
    },
    [seen],
  );
  const onHoverNode = useCallback(
    (info: HoverNodeInfo | null) => {
      setBenchInfo(info);
      const code = info?.cc || null;
      setPreview((p) => (code ? { code, from: 'bench' } : p?.from === 'bench' ? null : p));
      seen(code);
    },
    [seen],
  );
  const onPin = useCallback((code: string) => {
    setPinned((p) => (p === code ? null : code));
  }, []);

  const benchCc = preview?.from === 'bench' ? preview.code : null;
  const hot = preview?.code ?? pinned;
  const highlight = useMemo(() => (hot ? [hot] : []), [hot]);

  const hotRow = useMemo(
    () => (hot ? (all.rows.find((r) => r.code === hot) ?? null) : null),
    [hot, all.rows],
  );

  // ---- the tier filter ----------------------------------------------------------------------------------
  const chooseTier = useCallback(
    (next: TierFilter) => {
      setTier(next);
      const n = next === 'all' ? (totalNodes ?? null) : (tierCounts?.[next] ?? null);
      if (n !== null) {
        announce(`Showing ${next === 'all' ? 'all' : TIER_WORD[next]} nodes: ${formatInt(n)}.`);
      }
    },
    [totalNodes, tierCounts],
  );

  useHotkey({
    id: 'network.explain',
    keys: 'e',
    label: 'Explain the numbers on the Network Lab',
    group: 'Network Lab',
    run: () => setExplain((v) => !v),
  });
  useHotkey({
    id: 'network.tier',
    keys: ['0', '1', '2', '3'],
    label: 'Show one tier on the Network Lab: 1 Cumulus, 2 Nimbus, 3 Stratus, 0 all',
    group: 'Network Lab',
    run: (e) => {
      const next = TIER_KEYS[Number(e.key)];
      if (next) chooseTier(next);
    },
  });

  // The pinned country goes away when a filter or a search removes it from the list.
  useEffect(() => {
    if (pinned && !all.rows.some((r) => r.code === pinned)) setPinned(null);
  }, [pinned, all.rows]);

  const layoutKey = `${tier}|${rows.length}|${totalNodes}|${netState.status}|${blocksState.status}|${blocks?.length ?? 0}`;
  const loading = geoState.status === 'loading';

  // On a phone the labels are short and the counts live in the tier table, so the control fits the width.
  const tierOptions = TIER_KEYS.map((t) => ({
    value: t,
    label: t === 'all' ? (isPhone ? 'All' : 'All tiers') : TIER_WORD[t],
    icon: t === 'all' || isPhone ? undefined : (`tier-${t}` as const),
    count: isPhone ? undefined : formatInt(t === 'all' ? totalNodes : (tierCounts?.[t] ?? null), ''),
  }));
  const zoomOptions = [
    { value: '', label: 'Whole world' },
    ...REGIONS.map((r) => ({ value: r, label: REGION_NAMES[r] })),
  ];

  return (
    <div ref={rootRef} className={styles.lab} data-explaining={explain ? '' : undefined}>
      <div className={styles.toolbar}>
        <div className={styles.stats}>
          <div data-explain="nodes-total" className={styles.stat}>
            <Stat
              label="Confirmed nodes"
              value={totalNodes}
              animate="roll"
              size="md"
              loading={totalNodes === null && netState.status === 'loading'}
              // A non-breaking space keeps the line (and its height) while the count is unknown, so the
              // toolbar does not grow when it arrives.
              sub={
                totalNodes !== null && located !== null ? `${formatInt(located)} with a location` : '\u00A0'
              }
            />
          </div>
          <div data-explain="countries" className={styles.stat}>
            <Stat label="Countries" value={countryCount} animate="roll" size="md" />
          </div>
        </div>

        <Switch
          checked={explain}
          onCheckedChange={setExplain}
          description={explain ? 'Press a numbered marker to read its note.' : undefined}
        >
          Explain the numbers
        </Switch>
      </div>

      <div className={styles.upper}>
        <div className={styles.benchCol}>
          <div className={styles.benchStage}>
            <div className={styles.mapControls}>
              <SegmentedControl
                aria-label="Show nodes of one tier on the bench"
                size="sm"
                fullWidth={isPhone}
                options={tierOptions}
                value={tier}
                onValueChange={(v) => chooseTier(v as TierFilter)}
              />
              <Select
                className={styles.zoom}
                label="View"
                hideLabel
                size="md"
                options={zoomOptions}
                value={zoom}
                onValueChange={setZoom}
              />
            </div>
            <Diorama
              scene="network"
              live
              bare
              geo={geo}
              geoMeta={geoState.meta}
              network={net}
              tier={tier}
              region={zoom || null}
              highlight={highlight}
              onHoverNode={onHoverNode}
              aspect={isPhone ? '4 / 3' : '21 / 9'}
              label="Map of the Flux network. One pillar per cluster of nodes; taller means more nodes, colour is the most common tier."
            />
          </div>
          <div className={styles.legend}>
            <p className={styles.key} data-explain="bench-height">
              <span className={styles.dots} aria-hidden="true">
                <i data-tier="cumulus" />
                <i data-tier="nimbus" />
                <i data-tier="stratus" />
              </span>
              One pillar is a cluster of nodes. Taller means more nodes. Colour is the most common tier.
            </p>
            <p className={styles.readout} aria-live="off">
              {hotRow ? (
                <>
                  <strong>{hotRow.name}</strong>: {formatInt(hotRow.nodes)} nodes,{' '}
                  {formatShare(hotRow.share, 1)} of {tier === 'all' ? 'the network' : TIER_WORD[tier]}
                  {pinned === hotRow.code ? ' (pinned)' : ''}
                </>
              ) : benchInfo ? (
                <strong>{benchInfo.label}</strong>
              ) : (
                'Hover a pillar or a country. Press a country to keep it lit.'
              )}
            </p>
          </div>
        </div>

        <div className={styles.sideWrap}>
          <Panel
            className={styles.side}
            contentClassName={styles.sideBody}
            variant="slab"
            padding="md"
            cut="tl-br"
            halo={false}
            pattern="none"
          >
            <CountryList
              rows={rows}
              tier={tier}
              query={query}
              onQuery={setQuery}
              hot={hot}
              pinned={pinned}
              fromBench={benchCc}
              onPreview={onPreview}
              onPin={onPin}
              explored={exploredCount}
              goal={goal}
              medalEarned={medalEarned}
              loading={loading}
            />
          </Panel>
        </div>
      </div>

      <div className={styles.lower}>
        <Panel className={styles.tiers} variant="slab" padding="md" halo={false} pattern="none">
          <TierTable
            summaries={summaries}
            filter={tier}
            nextReduction={net?.rewards.nextReduction ?? null}
            perBlockTotal={net?.rewards.perBlock ?? null}
            devFund={net?.rewards.devFund ?? null}
            chip={<DataChip resource="network" />}
            note={<DataNote resource="network" label="Network numbers" />}
          />
        </Panel>
        <Panel className={styles.blocks} variant="slab" padding="md" cut="tl-br" halo={false} pattern="none">
          <BlockPanel
            blocks={blocks}
            targetSec={targetSec}
            tipHeight={net?.chain.height ?? null}
            chip={<DataChip resource="blocks" />}
            note={<DataNote resource="blocks" label="Blocks" as="p" />}
            loading={blocksState.status === 'loading'}
          />
        </Panel>
      </div>

      <p className={styles.footnote}>
        <InlineMarkup text="Where this comes from: the Academy asks the public Flux API for the node count, the node locations and the latest blocks, and shows them as they arrive. {{term:geolocation}} rules in an app spec use the same country codes as the list." />
      </p>

      {explain ? (
        <ExplainLayer
          containerRef={rootRef}
          notes={notes}
          layoutKey={layoutKey}
          onClose={() => setExplain(false)}
        />
      ) : null}
    </div>
  );
}
