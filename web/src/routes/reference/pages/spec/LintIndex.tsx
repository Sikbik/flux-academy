import { LINT_CODES, type LintCodeMeta, lintBasis } from '@shared/flux';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { anchor, fragmentId } from '@/content/reference';
import { buildFieldDocs, WHOLE_SPEC_CODES } from '@/content/reference/spec';
import { Chip, Select, StatusDot } from '@/ui';
import { useOpenSet } from '../../hooks';
import { DisclosureRow, ExpandAll } from '../../parts/Disclosure';
import { Slab } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { SEVERITY_MEANING, SEVERITY_WORD } from '../../parts/LintChip';
import { Md } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Group } from '../../parts/Semantics';
import styles from './spec.module.css';

type Severity = LintCodeMeta['severity'];

const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  identity: 'Identity',
  shape: 'Shape',
  instances: 'Instances',
  resources: 'Resources',
  image: 'Images',
  network: 'Network',
  config: 'Configuration',
  storage: 'Storage',
  placement: 'Placement',
  subscription: 'Subscription',
  enterprise: 'Enterprise',
  practice: 'Practice',
};

const SEVERITIES: readonly Severity[] = ['error', 'warning', 'info'];
const STATUS = { error: 'crit', warning: 'warn', info: 'pending' } as const;

/** Where each code is guarded: the field rows that list it. */
function guards(): Map<string, { id: string; key: string; scope: 'app' | 'component' }[]> {
  const map = new Map<string, { id: string; key: string; scope: 'app' | 'component' }[]>();
  for (const f of buildFieldDocs()) {
    for (const code of f.lint) {
      const list = map.get(code) ?? [];
      list.push({ id: f.id, key: f.key, scope: f.scope });
      map.set(code, list);
    }
  }
  return map;
}

export function LintIndex() {
  const metas = useMemo(() => Object.values(LINT_CODES), []);
  const guardsOf = useMemo(guards, []);
  const ids = useMemo(() => metas.map((m) => anchor.lint(m.code)), [metas]);
  const { open, set } = useOpenSet(ids);
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [category, setCategory] = useState('all');

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
    for (const m of metas) c[m.severity] += 1;
    return c;
  }, [metas]);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const m of metas) if (!seen.includes(m.category)) seen.push(m.category);
    return seen;
  }, [metas]);

  const shown = useMemo(
    () =>
      metas.filter(
        (m) =>
          (severity === 'all' || m.severity === severity) && (category === 'all' || m.category === category),
      ),
    [metas, severity, category],
  );

  // A code named in the URL has to be visible, whatever the filter says.
  const { hash } = useLocation();
  useEffect(() => {
    const id = fragmentId(hash);
    if (!id.startsWith('lint-')) return;
    const meta = metas.find((m) => anchor.lint(m.code) === id);
    if (!meta) return;
    setSeverity((s) => (s === 'all' || s === meta.severity ? s : 'all'));
    setCategory((c) => (c === 'all' || c === meta.category ? c : 'all'));
  }, [hash, metas]);

  const allOpen = shown.length > 0 && shown.every((m) => open.has(anchor.lint(m.code)));

  return (
    <Section
      id="lint-codes"
      actions={
        <ExpandAll
          allOpen={allOpen}
          onChange={(value) => {
            for (const m of shown) set(anchor.lint(m.code), value);
          }}
          count={shown.length}
        />
      }
    >
      <div className={styles.filters}>
        <Group className={styles.toolRow} label="Severity">
          <Chip
            kind="filter"
            size="sm"
            selected={severity === 'all'}
            onClick={() => setSeverity('all')}
            count={metas.length}
          >
            All
          </Chip>
          {SEVERITIES.map((s) => (
            <Chip
              key={s}
              kind="filter"
              size="sm"
              selected={severity === s}
              onClick={() => setSeverity(severity === s ? 'all' : s)}
              count={counts[s]}
            >
              {SEVERITY_WORD[s]}
            </Chip>
          ))}
        </Group>
        <Select
          label="Category"
          size="md"
          value={category}
          onValueChange={setCategory}
          options={[
            { value: 'all', label: 'Every category' },
            ...categories.map((c) => ({ value: c, label: CATEGORY_LABEL[c] ?? c })),
          ]}
          className={styles.categorySelect}
        />
      </div>

      <dl className={styles.severityKey}>
        {SEVERITIES.map((s) => (
          <div key={s}>
            <dt>
              <StatusDot status={STATUS[s]} /> {SEVERITY_WORD[s]}
            </dt>
            <dd>{SEVERITY_MEANING[s]}</dd>
          </div>
        ))}
      </dl>

      <p className={styles.resultCount} role="status">
        {shown.length} of {metas.length} codes
      </p>

      <Slab>
        <div className={styles.rows}>
          {shown.map((m) => (
            <LintRow
              key={m.code}
              meta={m}
              guards={guardsOf.get(m.code) ?? []}
              open={open.has(anchor.lint(m.code))}
              onOpenChange={set}
            />
          ))}
        </div>
      </Slab>
    </Section>
  );
}

const LintRow = ({
  meta,
  guards,
  open,
  onOpenChange,
}: {
  meta: LintCodeMeta;
  guards: readonly { id: string; key: string; scope: 'app' | 'component' }[];
  open: boolean;
  onOpenChange: (id: string, open: boolean) => void;
}) => {
  const id = anchor.lint(meta.code);
  const basis = lintBasis(meta);
  return (
    <DisclosureRow
      id={id}
      label={meta.code}
      open={open}
      onOpenChange={onOpenChange}
      title={meta.code}
      meta={
        <>
          <span className={styles.sev} data-severity={meta.severity}>
            <StatusDot status={STATUS[meta.severity]} />
            {SEVERITY_WORD[meta.severity]}
          </span>
          <span className={styles.tagPlain}>{CATEGORY_LABEL[meta.category] ?? meta.category}</span>
        </>
      }
      summary={<p className={styles.lintTitle}>{meta.title}</p>}
    >
      <p className={styles.lintText}>
        <strong>Why it matters. </strong>
        <Md text={meta.why} />
      </p>
      <p className={styles.lintText}>
        <strong>What to do. </strong>
        <Md text={meta.fix} />
      </p>
      <p className={styles.lintMeta}>
        <span className={styles.detailLabel}>Guards</span>{' '}
        {guards.length > 0 ? (
          guards.map((g, i) => (
            <span key={g.id}>
              {i > 0 ? ', ' : ''}
              <Link to={{ hash: `#${g.id}` }} className="link">
                <code>{g.scope === 'component' ? `compose[].${g.key}` : g.key}</code>
              </Link>
            </span>
          ))
        ) : WHOLE_SPEC_CODES.includes(meta.code) ? (
          <span>the spec as a whole</span>
        ) : (
          <span>
            a rule that is not tied to one field. The code appears in the message of the linter when it fires.
          </span>
        )}
      </p>
      <p className={styles.lintMeta}>
        <span className={styles.detailLabel}>Source</span>{' '}
        <code className={styles.sourceText}>{meta.source}</code> <ProvChips prov={[basis]} />
      </p>
      {meta.docs ? (
        <p className={styles.lintMeta}>
          <a href={meta.docs} target="_blank" rel="noopener noreferrer" className="link">
            Flux documentation
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      ) : null}
    </DisclosureRow>
  );
};
