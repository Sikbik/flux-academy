/**
 * Row editors for the spec's lists of strings: contacts, commands, pinned nodes and environment variables.
 * They are presentational. The sections own the operations and pass the callbacks, so the same row looks
 * the same whether it edits `commands` or `contacts`.
 */

import { Glyph } from '@/ui';
import { useForgeUi } from '../context';
import { splitEnv } from '../model';
import styles from './controls.module.css';
import { type FieldState, TextInput } from './inputs';

function stateAt(path: string, ui: ReturnType<typeof useForgeUi>): FieldState {
  const worst = ui.issues.worst(path);
  return worst === 'error' ? 'error' : worst === 'warning' ? 'warning' : null;
}

export interface StringListProps {
  /** JSON path of the array (`compose[0].commands`). Row paths are `${path}[i]`. */
  path: string;
  items: readonly string[];
  /** Singular noun for button names: "command". */
  noun: string;
  max: number;
  placeholder?: string;
  mono?: boolean;
  locked?: boolean;
  /** Show the move up and down buttons (order matters, as in commands). */
  ordered?: boolean;
  emptyText: string;
  onSet: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove?: (from: number, to: number) => void;
}

export function StringList({
  path,
  items,
  noun,
  max,
  placeholder,
  mono = true,
  locked,
  ordered,
  emptyText,
  onSet,
  onAdd,
  onRemove,
  onMove,
}: StringListProps) {
  const ui = useForgeUi();
  const canAdd = !locked && items.length < max;
  return (
    <div className={styles.rows}>
      {items.length === 0 ? <p className={styles.empty}>{emptyText}</p> : null}
      {items.map((item, i) => {
        const rowPath = `${path}[${i}]`;
        // Rows are positional: an index is the only identity a plain list of strings has.
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the rows are an ordered list of anonymous strings
          <div className={styles.row} key={i}>
            <TextInput
              label={`${noun} ${i + 1}`}
              value={item}
              mono={mono}
              path={rowPath}
              placeholder={placeholder}
              locked={locked}
              state={stateAt(rowPath, ui)}
              onChange={(v) => onSet(i, v)}
            />
            {locked ? null : (
              <span className={styles.rowActions}>
                {ordered && onMove ? (
                  <>
                    <button
                      type="button"
                      className={styles.mini}
                      aria-label={`Move ${noun} ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => onMove(i, i - 1)}
                    >
                      <Glyph name="chevron-up" size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.mini}
                      aria-label={`Move ${noun} ${i + 1} down`}
                      disabled={i === items.length - 1}
                      onClick={() => onMove(i, i + 1)}
                    >
                      <Glyph name="chevron-down" size={14} />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className={styles.mini}
                  data-tone="crit"
                  aria-label={`Remove ${noun} ${i + 1}`}
                  onClick={() => onRemove(i)}
                >
                  <Glyph name="trash" size={14} />
                </button>
              </span>
            )}
          </div>
        );
      })}
      <div className={styles.rowMeta}>
        <button type="button" className={styles.addBtn} disabled={!canAdd} onClick={onAdd}>
          <Glyph name="plus" size={14} />
          Add {noun}
        </button>
        <span className={styles.count}>
          {items.length} of {max}
        </span>
      </div>
    </div>
  );
}

export interface KeyValueListProps {
  path: string;
  /** `KEY=value` strings, as they are in the spec. */
  items: readonly string[];
  max: number;
  locked?: boolean;
  onSet: (index: number, entry: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export function KeyValueList({ path, items, max, locked, onSet, onAdd, onRemove }: KeyValueListProps) {
  const ui = useForgeUi();
  const canAdd = !locked && items.length < max;
  return (
    <div className={styles.rows}>
      {items.length === 0 ? (
        <p className={styles.empty}>No environment variables. The image runs with its own defaults.</p>
      ) : null}
      {items.map((entry, i) => {
        const { key, value } = splitEnv(entry);
        const rowPath = `${path}[${i}]`;
        const state = stateAt(rowPath, ui);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the rows are an ordered list of anonymous strings
          <div className={styles.kv} key={i}>
            <TextInput
              label={`Variable ${i + 1} name`}
              value={key}
              mono
              path={rowPath}
              placeholder="NAME"
              locked={locked}
              state={state}
              onChange={(k) => onSet(i, `${k}=${value}`)}
            />
            <TextInput
              label={`Variable ${i + 1} value`}
              value={value}
              mono
              placeholder="value"
              locked={locked}
              state={state}
              onChange={(v) => onSet(i, `${key}=${v}`)}
            />
            {locked ? (
              <span />
            ) : (
              <button
                type="button"
                className={styles.mini}
                data-tone="crit"
                aria-label={`Remove variable ${i + 1}`}
                onClick={() => onRemove(i)}
              >
                <Glyph name="trash" size={14} />
              </button>
            )}
          </div>
        );
      })}
      <div className={styles.rowMeta}>
        <button type="button" className={styles.addBtn} disabled={!canAdd} onClick={onAdd}>
          <Glyph name="plus" size={14} />
          Add variable
        </button>
        <span className={styles.count}>
          {items.length} of {max}
        </span>
      </div>
    </div>
  );
}
