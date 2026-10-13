import { LINT_CODES, type LintCategory } from '@shared/flux/lint-catalogue';
import { useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionItem, Chip, Select, TextField } from '@/ui';
import { CodeBody, SeverityChip } from './Cards';
import { CATEGORY_WORD, normalise, plural, SEVERITY_WORD } from './model';
import styles from './parts.module.css';

type Severity = 'error' | 'warning' | 'info';
const SEVERITIES: readonly Severity[] = ['error', 'warning', 'info'];

const ALL = Object.values(LINT_CODES);

/** The whole lint catalogue, filterable, one code open at a time. */
export function CodesView({ selected }: { selected: string | null }) {
  const [filter, setFilter] = useState('');
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [category, setCategory] = useState<LintCategory | 'all'>('all');
  const [open, setOpen] = useState<string | null>(selected);

  useEffect(() => {
    if (!selected) return;
    setOpen(selected);
    setFilter('');
    setSeverity('all');
    setCategory('all');
  }, [selected]);

  const q = normalise(filter);
  const rows = useMemo(
    () =>
      ALL.filter((c) => {
        if (severity !== 'all' && c.severity !== severity) return false;
        if (category !== 'all' && c.category !== category) return false;
        if (q === '') return true;
        return normalise(`${c.code} ${c.title} ${c.why}`).includes(q);
      }),
    [q, severity, category],
  );

  const categories = useMemo(() => {
    const seen = new Set<LintCategory>();
    for (const c of ALL) seen.add(c.category);
    return [...seen];
  }, []);

  return (
    <section className={styles.toolView} aria-labelledby="ts-heading">
      <header className={styles.viewHead}>
        <h2 id="ts-heading" className={styles.viewTitle} tabIndex={-1}>
          Lint codes
        </h2>
        <p className={styles.viewLead}>
          The Spec Forge and the lesson checks report these codes. The code is stable; the message beside it
          changes with your spec. To look one up, type it into the search at the top of the page.
        </p>
      </header>

      <div className={styles.toolBar}>
        <div className={styles.toolRow}>
          <TextField
            className={styles.filterField}
            label="Filter these codes"
            value={filter}
            onValueChange={setFilter}
            placeholder="for example port, image, expire"
            autoCapitalize="off"
            spellCheck={false}
          />
          <Select
            className={styles.areaSelect}
            label="Area of the spec"
            value={category}
            onValueChange={(v) => setCategory(v as LintCategory | 'all')}
            options={[
              { value: 'all', label: 'Every area' },
              ...categories.map((c) => ({ value: c, label: CATEGORY_WORD[c] })),
            ]}
          />
        </div>
        <fieldset className={styles.chipGroup}>
          <legend className="sr-only">Severity</legend>
          <Chip kind="filter" size="sm" selected={severity === 'all'} onClick={() => setSeverity('all')}>
            All
          </Chip>
          {SEVERITIES.map((s) => (
            <Chip
              key={s}
              kind="filter"
              size="sm"
              selected={severity === s}
              count={ALL.filter((c) => c.severity === s).length}
              onClick={() => setSeverity(severity === s ? 'all' : s)}
            >
              {SEVERITY_WORD[s]}
            </Chip>
          ))}
        </fieldset>
        <p className={styles.toolCount}>
          {rows.length === ALL.length
            ? plural(rows.length, 'code', 'codes')
            : `${rows.length} of ${ALL.length} codes`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className={styles.toolEmpty}>No code matches that. Clear the filters to see all of them.</p>
      ) : (
        <Accordion type="single" value={open} onValueChange={setOpen} panelRole="none">
          {rows.map((c) => (
            <AccordionItem
              key={c.code}
              value={c.code}
              level={3}
              title={
                <span id={`code-row-${c.code}`} className={styles.codeRowTitle}>
                  <code className={styles.codeName}>{c.code}</code>
                  <span className={styles.codeRowText}>{c.title}</span>
                </span>
              }
              meta={<SeverityChip severity={c.severity} />}
            >
              {open === c.code ? <CodeBody meta={c} /> : null}
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </section>
  );
}
