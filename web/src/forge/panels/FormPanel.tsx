/**
 * The form: one accordion item for the app and one per component, plus a field search that jumps to any
 * field by what it is called ("port", "disk", "image"). Bodies mount the first time an item opens and stay
 * mounted, so a ten component spec costs only what the learner has looked at.
 */

import { LIMITS } from '@shared/flux/spec';
import { type MouseEvent, type ReactNode, type Ref, useId, useMemo, useRef, useState } from 'react';
import { Accordion, AccordionItem, Glyph, SearchField } from '@/ui';
import { useForgeUi } from '../context';
import controls from '../controls/controls.module.css';
import { NoteCallouts } from '../controls/Field';
import { duplicateComponent, hasEditableWithin, monthsOf, moveComponent, removeComponent } from '../model';
import { cores, disk, memory, monthsLabel } from '../model/format';
import { AppSection } from './form/AppSection';
import { ComponentSection, ComponentTools } from './form/ComponentSection';
import styles from './form/form.module.css';
import { type SearchAction, type SearchEntry, searchEntries, searchResults } from './form/search';

// ---------------------------------------------------------------------------
// Field search
// ---------------------------------------------------------------------------

function FieldSearch({
  inputRef,
  onAction,
}: {
  inputRef?: Ref<HTMLInputElement>;
  onAction: (action: SearchAction) => void;
}) {
  const ui = useForgeUi();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const names = ui.snap.spec.compose.map((c) => c.name).join('\u0000');

  const entries = useMemo<SearchEntry[]>(() => searchEntries(names.split('\u0000')), [names]);
  const q = query.trim();
  const results = useMemo(() => searchResults(entries, q), [entries, q]);

  const choose = (entry: SearchEntry | undefined) => {
    if (!entry) return;
    setQuery('');
    setActive(0);
    if (entry.action) onAction(entry.action);
    else ui.jumpTo(entry.path);
  };

  return (
    <div className={styles.search}>
      <SearchField
        ref={inputRef}
        label="Find a field"
        placeholder="Find a field: port, disk, image"
        shortcut="/"
        value={query}
        controls={listId}
        aria-activedescendant={q && results.length > 0 ? `${listId}-${active}` : undefined}
        onValueChange={(v) => {
          setQuery(v);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter' && results.length > 0) {
            e.preventDefault();
            choose(results[active]);
          }
        }}
      />
      {q ? (
        <div id={listId} className={styles.results} role="listbox" aria-label="Matching fields">
          {results.length === 0 ? (
            <p className={styles.resultNone}>Nothing matches "{query}".</p>
          ) : (
            results.map((r, i) => (
              <div
                key={r.action ?? r.path}
                id={`${listId}-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={i === active}
                className={styles.result}
                onPointerDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
              >
                {r.label}
                <small>{r.where}</small>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

function Lazy({ open, children }: { open: boolean; children: ReactNode }) {
  const seen = useRef(false);
  if (open) seen.current = true;
  return seen.current ? children : null;
}

/** Shift or drop the open ids of components after a structural change. */
function remapOpen(open: readonly string[], map: (index: number) => number | null): string[] {
  const out: string[] = [];
  for (const id of open) {
    const m = /^c(\d+)$/.exec(id);
    if (!m) {
      out.push(id);
      continue;
    }
    const next = map(Number(m[1]));
    if (next !== null) out.push(`c${next}`);
  }
  return out;
}

export interface FormPanelProps {
  open: string[];
  onOpenChange: (ids: string[]) => void;
  searchRef?: Ref<HTMLInputElement>;
  /** Hide the field search (a lesson with a handful of fields). */
  search?: boolean;
}

export function FormPanel({ open, onOpenChange, searchRef, search = true }: FormPanelProps) {
  const ui = useForgeUi();
  const { spec } = ui.snap;
  const count = spec.compose.length;
  const structureLocked = !ui.canEdit('compose');

  const atMax = count >= LIMITS.component.max;
  // A lesson that points at the buttons names the list itself: `{ path: 'compose', note }`.
  const structureNotes = ui.focusNotes.filter((n) => n.formPath === 'compose');
  // A click that came from the keyboard (Enter or Space on the button) has no pointer position; it moves the
  // focus to the new component so the next thing typed lands in its name.
  const addFrom = (variant: 'public' | 'private') => (e: MouseEvent) => {
    ui.addComponent(variant, { focus: e.detail === 0 });
  };
  const onAction = (action: SearchAction) => {
    ui.addComponent(action === 'add-private' ? 'private' : 'public', { focus: true });
  };
  const duplicate = (i: number) => {
    const ok = ui.edit('compose', (s) => duplicateComponent(s, i), {
      key: null,
      label: 'Duplicate a component',
    });
    if (ok) onOpenChange([...remapOpen(open, (n) => (n > i ? n + 1 : n)), `c${i + 1}`]);
  };
  const remove = (i: number) => {
    const ok = ui.edit('compose', (s) => removeComponent(s, i), { key: null, label: 'Remove a component' });
    if (ok) onOpenChange(remapOpen(open, (n) => (n === i ? null : n > i ? n - 1 : n)));
  };
  const move = (from: number, to: number) => {
    const ok = ui.edit('compose', (s) => moveComponent(s, from, to), {
      key: null,
      label: 'Reorder components',
    });
    if (ok) onOpenChange(remapOpen(open, (n) => (n === from ? to : n === to ? from : n)));
  };

  const appWorst = ui.issues.issues.filter((i) => !/^compose\[/.test(i.at) && i.severity !== 'info');
  const appBadge = appWorst.length;

  return (
    <div className={styles.root}>
      {ui.paused ? (
        <div className={styles.paused} role="status">
          <Glyph name="status-warn" size={18} />
          <span>
            The JSON has an error, so the form is paused. It shows the last version that was valid. Fix the
            JSON, or throw your edit away to carry on here.
          </span>
          <button type="button" className={controls.addBtn} onClick={() => ui.session.revertText()}>
            <Glyph name="undo" size={14} />
            Discard my edit
          </button>
        </div>
      ) : null}

      {search ? <FieldSearch inputRef={searchRef} onAction={onAction} /> : null}

      <div className={styles.body} data-paused={ui.paused ? 'true' : undefined} inert={ui.paused}>
        <Accordion
          type="multiple"
          value={open}
          onValueChange={onOpenChange}
          panelRole={count > 5 ? 'none' : 'region'}
        >
          <AccordionItem
            value="app"
            title={
              <span className={styles.title}>
                <span>App</span>
                {appBadge > 0 ? (
                  <span className={styles.badge} data-severity={appWorst[0]?.severity}>
                    <Glyph
                      name={appWorst[0]?.severity === 'error' ? 'status-crit' : 'status-warn'}
                      size={13}
                    />
                    {appBadge}
                  </span>
                ) : null}
              </span>
            }
            icon="sliders"
            meta={
              <span className={styles.meta}>
                {spec.instances}× · {monthsLabel(monthsOf(spec))}
              </span>
            }
          >
            <Lazy open={open.includes('app')}>
              <AppSection />
            </Lazy>
          </AccordionItem>

          {spec.compose.map((c, i) => {
            const id = `c${i}`;
            const within = ui.issues.within(`compose[${i}]`).filter((x) => x.severity !== 'info');
            const worst = within[0]?.severity;
            const editable = hasEditableWithin(`compose[${i}]`, ui.snap.editable);
            return (
              <AccordionItem
                // biome-ignore lint/suspicious/noArrayIndexKey: components have no identity but their position
                key={i}
                value={id}
                icon="container"
                title={
                  <span className={styles.title}>
                    <span className={styles.name}>{c.name || `component ${i + 1}`}</span>
                    {within.length > 0 && worst ? (
                      <span className={styles.badge} data-severity={worst}>
                        <Glyph name={worst === 'error' ? 'status-crit' : 'status-warn'} size={13} />
                        {within.length}
                        <span className="sr-only"> {worst === 'error' ? 'errors' : 'warnings'}</span>
                      </span>
                    ) : null}
                    {editable ? null : <Glyph name="lock" size={13} />}
                  </span>
                }
                meta={
                  <span className={styles.meta}>
                    <span className={styles.metaDetail}>
                      {cores(c.cpu)} cpu · {memory(c.ram)} · {disk(c.hdd)}
                    </span>
                  </span>
                }
              >
                <Lazy open={open.includes(id)}>
                  <ComponentTools
                    index={i}
                    count={count}
                    locked={structureLocked}
                    onMove={move}
                    onDuplicate={duplicate}
                    onRemove={remove}
                  />
                  <ComponentSection index={i} />
                </Lazy>
              </AccordionItem>
            );
          })}
        </Accordion>

        <div
          className={styles.addBar}
          data-field="compose"
          data-locked={structureLocked ? 'true' : undefined}
        >
          <NoteCallouts notes={structureNotes} />
          <div className={styles.addButtons}>
            <button
              type="button"
              className={controls.addBtn}
              disabled={structureLocked || atMax}
              title="Add a component with a public port."
              onClick={addFrom('public')}
            >
              <Glyph name="plus" size={14} />
              Add component
            </button>
            <button
              type="button"
              className={controls.addBtn}
              disabled={structureLocked || atMax}
              title="Add a component with no public port. Only the app's other components reach it, which is right for a database or a cache."
              onClick={addFrom('private')}
            >
              <Glyph name="eye-off" size={14} />
              Add private component
            </button>
          </div>
          <p>
            {count} of {LIMITS.component.max} components. They share one network, one price and one lifetime.
          </p>
        </div>
      </div>
    </div>
  );
}
