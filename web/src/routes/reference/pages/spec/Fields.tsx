import { useMemo } from 'react';
import { Link } from 'react-router';
import type { FieldDoc } from '@/content/reference';
import { plain } from '@/content/reference/derive';
import { buildAppFields, buildComponentFields } from '@/content/reference/spec';
import { Callout } from '@/ui';
import { useOpenSet } from '../../hooks';
import { readRequired } from '../../model';
import { DisclosureRow, ExpandAll } from '../../parts/Disclosure';
import { Slab } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { LintChips } from '../../parts/LintChip';
import { Md, P } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Ul } from '../../parts/Semantics';
import styles from './spec.module.css';

/** The type, whether it is required and its default, as small tags. Safe inside a button. */
export function FieldTags({ doc }: { doc: FieldDoc }) {
  const req = readRequired(doc.required);
  return (
    <>
      <span className={styles.tag}>{doc.type}</span>
      <span className={styles.tag} data-kind={req.required ? 'required' : 'optional'}>
        {req.required ? 'Required' : 'Optional'}
        {req.detail ? `, ${req.detail}` : ''}
      </span>
      <span className={styles.tagPlain}>
        default <code>{plain(doc.defaultValue)}</code>
      </span>
    </>
  );
}

/** The part of a field that opens: limits, the note, the common mistake, the codes and the lessons. */
export function FieldDetails({ doc }: { doc: FieldDoc }) {
  return (
    <>
      <div>
        <p className={styles.detailLabel}>Limits and rules</p>
        <Ul className={styles.limits}>
          {doc.limits.map((l) => (
            <li key={l}>
              <Md text={l} />
            </li>
          ))}
        </Ul>
      </div>
      {doc.note ? <P text={doc.note} /> : null}
      <Callout kind="gotcha" compact>
        <Md text={doc.mistake} />
      </Callout>
      <LintChips codes={doc.lint} label="Caught by" />
      {doc.lessons.length > 0 ? (
        <p className={styles.lessons}>
          <span className={styles.detailLabel}>Taught in</span>{' '}
          <Md text={doc.lessons.map((id) => `{{lesson:${id}}}`).join(', ')} />
        </p>
      ) : null}
      <ProvChips prov={doc.prov} />
    </>
  );
}

function FieldRow({
  doc,
  open,
  onOpenChange,
}: {
  doc: FieldDoc;
  open: boolean;
  onOpenChange: (id: string, open: boolean) => void;
}) {
  return (
    <DisclosureRow
      id={doc.id}
      label={doc.key}
      open={open}
      onOpenChange={onOpenChange}
      title={doc.key}
      meta={<FieldTags doc={doc} />}
      aside={
        <>
          {doc.limits.length} {doc.limits.length === 1 ? 'rule' : 'rules'}
          {doc.lint.length > 0 ? ` · ${doc.lint.length} ${doc.lint.length === 1 ? 'code' : 'codes'}` : ''}
        </>
      }
      summary={<P text={doc.summary} className={styles.fieldSummary} />}
    >
      <FieldDetails doc={doc} />
    </DisclosureRow>
  );
}

/** The field reference of one scope: every key, collapsed to its summary until opened. */
export function FieldsSection({
  id,
  scope,
  whole,
}: {
  id: 'app-fields' | 'component-fields';
  scope: 'app' | 'component';
  /** Codes about the whole spec, shown above the rows. */
  whole?: readonly string[];
}) {
  const docs = useMemo(() => (scope === 'app' ? buildAppFields() : buildComponentFields()), [scope]);
  const ids = useMemo(() => docs.map((d) => d.id), [docs]);
  const { open, set, setAll } = useOpenSet(ids);
  const allOpen = open.size === ids.length;

  return (
    <Section id={id} actions={<ExpandAll allOpen={allOpen} onChange={setAll} count={ids.length} />}>
      <nav aria-label={scope === 'app' ? 'Jump to a top level field' : 'Jump to a component field'}>
        <Ul className={styles.jumpList}>
          {docs.map((d) => (
            <li key={d.id}>
              <Link to={{ hash: `#${d.id}` }} className={styles.jumpChip}>
                {d.key}
              </Link>
            </li>
          ))}
        </Ul>
      </nav>
      {whole && whole.length > 0 ? (
        <div className={styles.wholeNote}>
          <p className={styles.noteLead}>
            Three codes are about the spec as a whole, so no single field owns them.
          </p>
          <LintChips codes={whole} label="Whole spec" />
        </div>
      ) : null}
      <Slab>
        <div className={styles.rows}>
          {docs.map((d) => (
            <FieldRow key={d.id} doc={d} open={open.has(d.id)} onOpenChange={set} />
          ))}
        </div>
      </Slab>
    </Section>
  );
}
