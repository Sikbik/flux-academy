import type { Quote } from '@shared/flux/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  freshnessKind,
  quoteLocally,
  useChainClock,
  useConnection,
  useDataAge,
  useNetwork,
  usePricing,
} from '@/data';
import { FreshnessChip } from '@/ui';
import { type Answer, type AskData, buildAnswer, parseAsk, parseQuoteArgs, quoteSpecFor } from './ask';
import styles from './Deck.module.css';
import { useScrollRegion } from './useScrollRegion';

interface QuoteState {
  key: string;
  quote: Quote | null;
  pending: boolean;
}

/** The `>` mode of the deck: one line in, a small table of live facts out. Reports the answer upward. */
export function AskView({ text, onAnswer }: { text: string; onAnswer: (answer: Answer) => void }) {
  const network = useNetwork();
  const pricing = usePricing();
  const clock = useChainClock();
  const connection = useConnection();
  const networkAge = useDataAge('network');
  const pricingAge = useDataAge('pricing');

  const parsed = useMemo(() => parseAsk(text), [text]);
  const quoteArgs = useMemo(
    () => (parsed.type === 'command' && parsed.id === 'quote' ? parseQuoteArgs(parsed.arg) : null),
    [parsed],
  );
  const quoteKey = quoteArgs?.ok ? JSON.stringify(quoteArgs.args) : '';
  const quoteArgsRef = useRef(quoteArgs);
  quoteArgsRef.current = quoteArgs;
  const pricingData = pricing.data;

  const [quoteState, setQuoteState] = useState<QuoteState>({ key: '', quote: null, pending: false });

  useEffect(() => {
    // The key says when the arguments changed; the ref carries them (it always holds the latest).
    const parsedArgs = quoteArgsRef.current;
    if (!parsedArgs?.ok || !pricingData) {
      setQuoteState({ key: '', quote: null, pending: false });
      return;
    }
    let cancelled = false;
    setQuoteState((s) => (s.key === quoteKey ? s : { key: quoteKey, quote: null, pending: true }));
    void (async () => {
      try {
        const base = await import('@shared/flux/spec');
        const spec = quoteSpecFor(parsedArgs.args, base);
        const quote = await quoteLocally(spec, pricingData);
        if (!cancelled) setQuoteState({ key: quoteKey, quote, pending: false });
      } catch {
        if (!cancelled) setQuoteState({ key: quoteKey, quote: null, pending: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteKey, pricingData]);

  const data = useMemo<AskData>(
    () => ({
      network: network.data,
      networkStatus: network.status,
      networkMeta: network.meta,
      networkAgeMs: networkAge,
      pricing: pricingData,
      pricingStatus: pricing.status,
      pricingMeta: pricing.meta,
      pricingAgeMs: pricingAge,
      clock,
      connection,
    }),
    [network, pricing, pricingData, networkAge, pricingAge, clock, connection],
  );

  const answer = useMemo(
    () =>
      buildAnswer(parsed, {
        data,
        quote: quoteState.key === quoteKey ? quoteState.quote : null,
        quotePending: quoteState.key === quoteKey && quoteState.pending,
      }),
    [parsed, data, quoteState, quoteKey],
  );

  useEffect(() => {
    onAnswer(answer);
  }, [answer, onAnswer]);

  const age = answer.source === 'pricing' ? pricingAge : networkAge;
  const region = useScrollRegion<HTMLDivElement>('Answer');

  return (
    <div ref={region.ref} {...region.props} className={styles.ask}>
      <div className={styles.askTop}>
        <h2 className={styles.askTitle}>{answer.title}</h2>
        {answer.status ? (
          <FreshnessChip kind={freshnessKind(answer.status)} ageMs={age} polling={connection === 'polling'} />
        ) : null}
      </div>
      {answer.rows.length > 0 ? (
        <dl className={styles.askRows}>
          {answer.rows.map((row) => (
            <div key={`${row.label}:${row.value}`} className={styles.askRow}>
              <dt className={styles.askLabel}>{row.label}</dt>
              <dd
                className={styles.askValue}
                data-tone={row.tone}
                data-missing={row.missing ? 'true' : undefined}
              >
                <span>{row.value}</span>
                {row.note ? <span className={styles.askNote}>{row.note}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {answer.note ? <p className={styles.askFoot}>{answer.note}</p> : null}
    </div>
  );
}
