import { useEffect, useMemo, useState } from 'react';
import { ERROR_SOURCE_LABEL, ERROR_STRINGS, type ErrorSource } from '@/content/troubleshoot';
import { Accordion, AccordionItem, Chip, TextField } from '@/ui';
import { MessageBody } from './Cards';
import { normalise, plural } from './model';
import styles from './parts.module.css';

const SOURCE_ORDER: readonly ErrorSource[] = [
  'validator',
  'fluxcloud',
  'payment',
  'api',
  'node-log',
  'orbit',
  'mcp',
];

/** Every message the decoder knows, grouped by where it appears. */
export function MessagesView({ selected }: { selected: string | null }) {
  const [filter, setFilter] = useState('');
  const [source, setSource] = useState<ErrorSource | 'all'>('all');
  const [open, setOpen] = useState<string | null>(selected);

  // A link to one message opens it and clears the filters that might hide it.
  useEffect(() => {
    if (!selected) return;
    setOpen(selected);
    setFilter('');
    setSource('all');
  }, [selected]);

  const q = normalise(filter);
  const rows = useMemo(
    () =>
      ERROR_STRINGS.filter((m) => {
        if (source !== 'all' && m.source !== source) return false;
        if (q === '') return true;
        return normalise(`${m.text} ${m.where} ${m.means}`).includes(q);
      }),
    [q, source],
  );

  const sources = SOURCE_ORDER.filter((s) => ERROR_STRINGS.some((m) => m.source === s));

  return (
    <section className={styles.toolView} aria-labelledby="ts-heading">
      <header className={styles.viewHead}>
        <h2 id="ts-heading" className={styles.viewTitle} tabIndex={-1}>
          Error messages
        </h2>
        <p className={styles.viewLead}>
          The text of real messages, as they are written. A word in braces is the part that changes. To decode
          one you have, paste it into the search at the top of the page.
        </p>
      </header>

      <div className={styles.toolBar}>
        <TextField
          className={styles.filterField}
          label="Filter these messages"
          value={filter}
          onValueChange={setFilter}
          placeholder="for example ports, name, image"
          autoCapitalize="off"
          spellCheck={false}
        />
        <fieldset className={styles.chipGroup}>
          <legend className="sr-only">Where the message appears</legend>
          <Chip kind="filter" size="sm" selected={source === 'all'} onClick={() => setSource('all')}>
            All
          </Chip>
          {sources.map((s) => (
            <Chip
              key={s}
              kind="filter"
              size="sm"
              selected={source === s}
              count={ERROR_STRINGS.filter((m) => m.source === s).length}
              onClick={() => setSource(source === s ? 'all' : s)}
            >
              {ERROR_SOURCE_LABEL[s]}
            </Chip>
          ))}
        </fieldset>
        <p className={styles.toolCount}>
          {rows.length === ERROR_STRINGS.length
            ? plural(rows.length, 'message', 'messages')
            : `${rows.length} of ${ERROR_STRINGS.length} messages`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className={styles.toolEmpty}>No message matches that. Clear the filter to see all of them.</p>
      ) : (
        <div className={styles.messageRows}>
          <Accordion type="single" value={open} onValueChange={setOpen} panelRole="none">
            {rows.map((m) => (
              <AccordionItem
                key={m.id}
                value={m.id}
                level={3}
                title={
                  <span id={`message-row-${m.id}`} className={styles.messageTitle}>
                    {m.text}
                    <span className={styles.rowMetaBelow}>{ERROR_SOURCE_LABEL[m.source]}</span>
                  </span>
                }
                meta={<span className={styles.rowMeta}>{ERROR_SOURCE_LABEL[m.source]}</span>}
              >
                {open === m.id ? <MessageBody message={m} /> : null}
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </section>
  );
}
