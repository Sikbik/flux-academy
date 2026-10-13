/**
 * The app name field: a combobox that offers real app names while you type and looks one up on Enter.
 * ARIA 1.2 combobox with a listbox popup and `aria-activedescendant`, so the arrow keys move through the
 * suggestions without leaving the field. Offering names asks the network; nothing is looked up until a
 * name is chosen.
 */
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { formatInt } from '@/lib/format';
import { Button, Chip, Glyph, TextField } from '@/ui';
import { SEEDED_SUGGESTIONS, SUGGESTIONS_AS_OF } from './model';
import styles from './SearchBox.module.css';
import type { SearchState } from './useExplorer';

export interface SearchBoxProps {
  value: string;
  onValue: (text: string) => void;
  search: SearchState;
  /** Look this name up. */
  onFind: (name: string) => void;
  busy: boolean;
  /** `?demo=1` or no API: only the made-up sample can be looked up. */
  sampleOnly: boolean;
  onSample: () => void;
}

export function SearchBox({ value, onValue, search, onFind, busy, sampleOnly, onSample }: SearchBoxProps) {
  const listId = useId();
  const hintId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  const names = search.kind === 'ready' ? search.names : [];
  // The popup holds the answer to the search and its status lines; the listbox is only the names.
  const showPopup = open && value.trim().length >= 2 && search.kind !== 'idle';
  const showList = showPopup && names.length > 0;

  // A new list starts with nothing highlighted: Enter then means "look up what I typed".
  // biome-ignore lint/correctness/useExhaustiveDependencies: the list identity is the signal
  useEffect(() => {
    setActive(-1);
  }, [search]);

  // Closing on outside press, so a touch screen can dismiss the list by tapping elsewhere.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const choose = (name: string) => {
    onValue(name);
    setOpen(false);
    onFind(name);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (names.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % names.length);
    } else if (e.key === 'ArrowUp') {
      if (names.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a <= 0 ? names.length - 1 : a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = active >= 0 ? names[active] : undefined;
      choose(picked ? picked.name : value.trim());
    } else if (e.key === 'Escape') {
      if (showPopup) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div className={styles.root} ref={wrap}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          choose(value.trim());
        }}
      >
        <div className={styles.field}>
          <TextField
            label="App name"
            placeholder="Part of a name, or the whole name"
            value={value}
            onValueChange={(v) => {
              onValue(v);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
            aria-describedby={hintId}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={63}
            prefix={<Glyph name="search" size={16} />}
          />

          {showPopup ? (
            <div className={styles.list}>
              {showList ? (
                <div className={styles.options} id={listId} role="listbox" aria-label="Matching app names">
                  {names.map((n, i) => (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: the field keeps focus and handles the keys
                    <div
                      key={n.name}
                      id={optionId(i)}
                      role="option"
                      tabIndex={-1}
                      aria-selected={i === active}
                      className={styles.option}
                      data-active={i === active ? '' : undefined}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => choose(n.name)}
                    >
                      <span className={styles.optName}>{n.name}</span>{' '}
                      {n.instances !== null ? (
                        <span className={styles.optMeta}>{formatInt(n.instances)} running</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {search.kind === 'loading' ? <p className={styles.status}>Searching the network</p> : null}
              {search.kind === 'ready' && names.length === 0 ? (
                <p className={styles.status}>No app name starts with or contains "{search.query}".</p>
              ) : null}
              {search.kind === 'ready' && search.total > names.length ? (
                <p className={styles.status}>
                  Showing {names.length} of {search.total}. Type more to narrow it.
                </p>
              ) : null}
              {search.kind === 'failed' ? (
                <p className={styles.status}>
                  The name search is not available right now. You can still type an exact name.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <span className="sr-only" role="status">
          {showList ? `${names.length} matching ${names.length === 1 ? 'name' : 'names'}` : ''}
        </span>
        <Button type="submit" variant="primary" icon="search" loading={busy} disabled={value.trim() === ''}>
          Look up
        </Button>
      </form>

      <div className={styles.meta}>
        <div className={styles.suggestions}>
          <span className={styles.suggestLabel}>
            {sampleOnly ? 'Try' : `Real apps, confirmed ${SUGGESTIONS_AS_OF}`}
          </span>
          <ul className={styles.chips}>
            {sampleOnly ? (
              <li>
                <Chip kind="filter" size="sm" onClick={onSample}>
                  sample-app
                </Chip>
              </li>
            ) : (
              SEEDED_SUGGESTIONS.map((s) => (
                <li key={s.name}>
                  <Chip
                    kind="filter"
                    size="sm"
                    onClick={() => {
                      onValue(s.name);
                      onFind(s.name);
                    }}
                  >
                    {s.name}
                  </Chip>
                </li>
              ))
            )}
          </ul>
        </div>
        <p id={hintId} className={styles.hint}>
          {sampleOnly
            ? 'Offline sample mode: only the made-up sample app can be looked up.'
            : 'Letters, digits and hyphens. Capital letters do not matter.'}
        </p>
      </div>
    </div>
  );
}
