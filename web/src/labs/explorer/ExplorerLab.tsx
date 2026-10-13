/**
 * App Explorer: look up a real app on the network and see which machines run it and in which countries.
 *
 * Everything shown comes from two public read-only calls, and the page shows those calls. The bench is
 * the live network (the same pillars as the Network Lab) with the countries of the app lit. Nothing is
 * simulated; offline, only a labelled made-up sample app can be looked up.
 */
import { LOCATION_TTL_MIN } from '@shared/flux/timing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLabFrame } from '@/app/LabFrame';
import { art } from '@/content/art';
import { useGeo } from '@/data';
import Diorama from '@/diorama';
import { useStableGeo } from '@/labs/network/useStableGeo';
import { getFlags } from '@/lib/flags';
import { announce } from '@/system/announce';
import { Button, Panel, Skeleton, useIsPhone } from '@/ui';
import styles from './ExplorerLab.module.css';
import type { FailureView } from './model';
import { ResultDetails, ResultSummary } from './ResultView';
import { SearchBox } from './SearchBox';
import { useExplorer } from './useExplorer';

function EmptyState() {
  const a = art('lab-explorer');
  return (
    <div className={styles.empty}>
      <picture className={styles.art}>
        {a.avif ? <source srcSet={a.avif} type="image/avif" /> : null}
        <img src={a.src} alt="" width={a.width} height={a.height} loading="lazy" decoding="async" />
      </picture>
      <div className={styles.emptyText}>
        <h2 className={styles.emptyTitle}>Look at where an app really runs</h2>
        <p>
          Every app on Flux is a spec on the chain, and every node that runs it announces that it does. Search
          for a name and this page shows both: what the app asks for, and the machines, countries and tiers it
          landed on.
        </p>
        <p>The countries it runs in light up on the map.</p>
      </div>
    </div>
  );
}

function LoadingState({ name }: { name: string }) {
  return (
    <div className={styles.loading} role="status">
      <p className={styles.loadingText}>Asking the network about {name}</p>
      <Skeleton shape="line" lines={4} />
    </div>
  );
}

/** Counts whole seconds down from `seconds` to zero, once per second. */
function useCountdown(seconds: number | null): number {
  const [left, setLeft] = useState(seconds ?? 0);
  useEffect(() => {
    if (!seconds) return;
    const t = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          window.clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [seconds]);
  return left;
}

interface FailedStateProps {
  failure: FailureView;
  onRetry: () => void;
  onSample: () => void;
  onClear: () => void;
}

function FailedState({ failure, onRetry, onSample, onClear }: FailedStateProps) {
  const wait = useCountdown(failure.retryAfterSec);
  const canRetry =
    failure.reason === 'rate-limited' || failure.reason === 'offline' || failure.reason === 'unavailable';
  const canSample =
    failure.reason === 'offline' || failure.reason === 'unavailable' || failure.reason === 'sample-only';
  return (
    <div className={styles.failed} role="alert">
      <h2 className={styles.failTitle}>{failure.title}</h2>
      <p>{failure.body}</p>
      <div className={styles.failActions}>
        {canRetry ? (
          <Button variant="secondary" icon="refresh" disabled={wait > 0} onClick={onRetry}>
            {wait > 0 ? `Try again in ${wait} s` : 'Try again'}
          </Button>
        ) : null}
        {canSample ? (
          <Button variant="secondary" icon="eye" onClick={onSample}>
            Show the sample app
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}

export default function ExplorerLab() {
  const sampleOnly = getFlags().demo;
  const { search, lookup, suggest, clearSuggestions, find, showSample, reset } = useExplorer(sampleOnly);
  const geoState = useGeo();
  const geo = useStableGeo(geoState.data);
  const isPhone = useIsPhone();
  const [text, setText] = useState('');

  const onValue = useCallback(
    (v: string) => {
      setText(v);
      suggest(v);
    },
    [suggest],
  );

  const onFind = useCallback(
    (name: string) => {
      clearSuggestions();
      find(name);
    },
    [clearSuggestions, find],
  );

  const highlight = useMemo(() => {
    if (lookup.kind !== 'ready') return [];
    return [...new Set(lookup.app.instances.map((i) => i.cc?.toUpperCase()).filter((c): c is string => !!c))];
  }, [lookup]);

  // Say the outcome once, in words, to anyone not looking at the map.
  useEffect(() => {
    if (lookup.kind === 'ready') {
      const { app, sample } = lookup;
      const where = [...new Set(app.instances.map((i) => i.country).filter(Boolean))].join(', ');
      announce(
        `${sample ? 'Sample app ' : ''}${app.name}: ${app.instancesRunning} of ${app.instancesWanted} instances running${where ? ` in ${where}` : ''}.`,
      );
    } else if (lookup.kind === 'failed') {
      announce(lookup.failure.title);
    }
  }, [lookup]);

  useLabFrame({
    data: ['geo'],
    teach: [
      'Every app on Flux is a spec registered on the chain, and anyone can read specs and the list of nodes running each app through public, read-only calls. This lab makes those calls for the app you choose and shows you the answer.',
      `**Where the list of instances comes from.** A node that runs an app broadcasts that it does, about once an hour, and the record lasts ${LOCATION_TTL_MIN} minutes. The list you see is those records. If a node disappears its record lapses and another node installs the app, which is why an app can run below its target for a while.`,
      '**Why the map lights countries, not machines.** The map groups nodes into clusters, and the network reports each instance with a country and a tier. The countries of the app light up, and everything else dims.',
      '**Enterprise apps.** Their components and contacts are encrypted on the chain, and only nodes running ArcaneOS can decrypt them. You still get the counts and where the instances run, but not what they run.',
      '**Names.** App names are not case sensitive. The suggestions come from a list of registered names that the Academy refreshes about every 30 minutes, with the running counts beside them about every 15 minutes. A lookup of one app is kept for at most a minute, and the chip on the result says how old it is.',
    ],
    shortcuts: [{ keys: 'arrowdown', label: 'Move through suggestions' }],
  });

  const ready = lookup.kind === 'ready' ? lookup : null;
  const caption = ready
    ? highlight.length > 0
      ? `Lit: ${[...new Set(ready.app.instances.map((i) => i.country).filter(Boolean))].join(', ')}. Everything else is dimmed.`
      : 'This app has no instance with a known country, so there is nothing to light. The map shows the whole network.'
    : 'The live network. Look up an app to light the countries it runs in.';

  return (
    <div className={styles.lab}>
      <div className={styles.search}>
        <Panel variant="slab" padding="md" halo={false} pattern="none">
          <SearchBox
            value={text}
            onValue={onValue}
            search={search}
            onFind={onFind}
            busy={lookup.kind === 'loading'}
            sampleOnly={sampleOnly}
            onSample={() => {
              setText('sample-app');
              showSample();
            }}
          />
        </Panel>
      </div>

      <div className={styles.stage}>
        <div className={styles.bench}>
          <Diorama
            scene="network"
            live
            bare
            geo={geo}
            geoMeta={geoState.meta}
            highlight={highlight}
            aspect={isPhone ? '2 / 1' : '21 / 9'}
            label="Map of the Flux network. The countries where the looked-up app runs are lit."
          />
          <p className={styles.caption}>{caption}</p>
        </div>

        <div className={styles.summary}>
          <Panel
            variant="slab"
            padding="md"
            cut="tl-br"
            halo={false}
            pattern="none"
            contentClassName={lookup.kind === 'idle' ? styles.screened : undefined}
          >
            {lookup.kind === 'idle' ? <EmptyState /> : null}
            {lookup.kind === 'loading' ? <LoadingState name={lookup.name} /> : null}
            {lookup.kind === 'failed' ? (
              <FailedState
                key={lookup.at}
                failure={lookup.failure}
                onRetry={() => find(lookup.name)}
                onSample={() => {
                  setText('sample-app');
                  showSample();
                }}
                onClear={reset}
              />
            ) : null}
            {ready ? <ResultSummary app={ready.app} meta={ready.meta} sample={ready.sample} /> : null}
          </Panel>
        </div>
      </div>

      {ready ? (
        <div className={styles.details}>
          <ResultDetails app={ready.app} at={ready.at} sample={ready.sample} />
        </div>
      ) : null}
    </div>
  );
}
