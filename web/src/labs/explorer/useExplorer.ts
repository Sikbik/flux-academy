/**
 * The Explorer's two kinds of request and what each one leaves behind: a debounced search that offers
 * names while the learner types, and the lookup of one app. Both go through `@/data` (the only place that
 * calls the network), both are cancellable, and a stale answer can never replace a newer one.
 */
import type { ExploreApp, Meta } from '@shared/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { exploreApp, exploreSearch, SAMPLE_APP } from '@/data';
import { unlock } from '@/learn/achievements';
import { describeFailure, type FailureView, SAMPLE_NAME, sampleOnlyFailure } from './model';

export const SEARCH_DEBOUNCE_MS = 250;
/** What the server accepts as a search: letters, digits and hyphens, up to 32 characters. */
const SEARCH_PATTERN = /^[A-Za-z0-9-]{2,32}$/;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/;

export function isSearchable(text: string): boolean {
  return SEARCH_PATTERN.test(text.trim());
}

export function looksLikeName(text: string): boolean {
  return NAME_PATTERN.test(text.trim());
}

export interface Suggestion {
  name: string;
  instances: number | null;
}

export type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading'; query: string }
  | { kind: 'ready'; query: string; names: Suggestion[]; total: number }
  | { kind: 'failed'; query: string };

export type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading'; name: string }
  | { kind: 'ready'; app: ExploreApp; meta: Meta; at: number; sample: boolean }
  /** `at` changes with every failure, so a repeated one still counts as a new event. */
  | { kind: 'failed'; name: string; failure: FailureView; at: number };

const SAMPLE_META: Meta = {
  generatedAt: '2026-10-12T20:21:28.753Z',
  asOf: '2026-10-12T20:21:28.753Z',
  ageMs: 0,
  stale: true,
  source: 'fallback',
};

const MAX_SHOWN = 8;

export function useExplorer(sampleOnly = false): {
  search: SearchState;
  lookup: LookupState;
  /** Ask for names matching `text` after the debounce. An unusable text clears the list. */
  suggest: (text: string) => void;
  clearSuggestions: () => void;
  /** Look one app up now. */
  find: (name: string) => void;
  /** Show the built-in made-up app (never counts as a lookup of the network). */
  showSample: () => void;
  reset: () => void;
} {
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
  const searchAbort = useRef<AbortController | null>(null);
  const lookupAbort = useRef<AbortController | null>(null);
  const debounce = useRef(0);

  const clearSuggestions = useCallback(() => {
    window.clearTimeout(debounce.current);
    searchAbort.current?.abort();
    searchAbort.current = null;
    setSearch({ kind: 'idle' });
  }, []);

  const suggest = useCallback((text: string) => {
    window.clearTimeout(debounce.current);
    searchAbort.current?.abort();
    searchAbort.current = null;
    const query = text.trim();
    if (!isSearchable(query)) {
      setSearch({ kind: 'idle' });
      return;
    }
    setSearch({ kind: 'loading', query });
    debounce.current = window.setTimeout(() => {
      const ctl = new AbortController();
      searchAbort.current = ctl;
      // No automatic retry: typing starts the next search anyway.
      void exploreSearch(query, { signal: ctl.signal, retries: 0 }).then((r) => {
        if (ctl.signal.aborted || searchAbort.current !== ctl) return;
        searchAbort.current = null;
        if (r.ok) {
          const names = r.envelope.data.names.slice(0, MAX_SHOWN);
          setSearch({ kind: 'ready', query, names, total: r.envelope.data.names.length });
        } else {
          setSearch(r.error.kind === 'aborted' ? { kind: 'idle' } : { kind: 'failed', query });
        }
      });
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const find = useCallback(
    (raw: string) => {
      const name = raw.trim();
      if (!name) return;
      lookupAbort.current?.abort();
      const ctl = new AbortController();
      lookupAbort.current = ctl;
      if (!looksLikeName(name)) {
        setLookup({
          kind: 'failed',
          name,
          at: Date.now(),
          failure: {
            reason: 'bad-name',
            title: 'That is not a valid app name',
            body: 'App names use letters and digits, and hyphens inside the name. Try one of the suggestions, or search for part of a name.',
            retryAfterSec: null,
          },
        });
        return;
      }
      if (sampleOnly && name.toLowerCase() !== SAMPLE_NAME) {
        lookupAbort.current = null;
        setLookup({ kind: 'failed', name, failure: sampleOnlyFailure(name), at: Date.now() });
        return;
      }
      setLookup({ kind: 'loading', name });
      // No automatic retry: a limited visitor would wait out the whole delay behind a spinner.
      void exploreApp(name, { signal: ctl.signal, retries: 0 }).then((r) => {
        if (ctl.signal.aborted || lookupAbort.current !== ctl) return;
        lookupAbort.current = null;
        if (r.ok) {
          const { data, meta } = r.envelope;
          const sample = data.name === SAMPLE_NAME || meta.source === 'fallback';
          setLookup({ kind: 'ready', app: data, meta, at: Date.now(), sample });
          // The medal is for looking up a real app, not for the built-in sample.
          if (!sample) unlock('explorer');
        } else {
          const failure = describeFailure(r.error, name);
          if (failure) setLookup({ kind: 'failed', name, failure, at: Date.now() });
        }
      });
    },
    [sampleOnly],
  );

  const showSample = useCallback(() => {
    lookupAbort.current?.abort();
    lookupAbort.current = null;
    setLookup({ kind: 'ready', app: SAMPLE_APP, meta: SAMPLE_META, at: Date.now(), sample: true });
  }, []);

  const reset = useCallback(() => {
    lookupAbort.current?.abort();
    lookupAbort.current = null;
    setLookup({ kind: 'idle' });
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(debounce.current);
      searchAbort.current?.abort();
      lookupAbort.current?.abort();
    },
    [],
  );

  return { search, lookup, suggest, clearSuggestions, find, showSample, reset };
}
