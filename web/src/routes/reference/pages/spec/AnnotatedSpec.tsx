import { FIXTURES } from '@shared/flux';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { buildAppFields, buildComponentFields } from '@/content/reference/spec';
import { annotateSpec, forgeShareLink } from '@/content/reference/tools';
import { SegmentedControl, tokenizeCode } from '@/ui';
import { Slab } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { Md } from '../../parts/Prose';
import { Group } from '../../parts/Semantics';
import { FieldDetails, FieldTags } from './Fields';
import styles from './spec.module.css';

const PICKS = [
  { id: 'web-app', label: 'Web app' },
  { id: 'static-site', label: 'Static site' },
  { id: 'wordpress-mysql', label: 'Two components' },
] as const;

/**
 * A real spec from the Academy fixtures, as JSON. Every field name is a control: hover it, focus it or
 * press it and the row for that field appears beside the code. Arrow keys move between names.
 */
export function AnnotatedSpec() {
  const docs = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildAppFields>[number]>();
    for (const d of [...buildAppFields(), ...buildComponentFields()]) map.set(d.id, d);
    return map;
  }, []);

  const [pick, setPick] = useState<(typeof PICKS)[number]['id']>('web-app');
  const [selected, setSelected] = useState('app-name');
  const fixture = FIXTURES.find((f) => f.id === pick) ?? FIXTURES[0];
  const spec = fixture?.spec;

  const lines = useMemo(() => (spec ? annotateSpec(spec) : []), [spec]);
  const tokens = useMemo(() => tokenizeCode(lines.map((l) => l.text).join('\n'), 'json'), [lines]);
  const code = useRef<HTMLDivElement>(null);

  const doc = docs.get(selected) ?? docs.get('app-name');

  // The row of the same field in the reference below carries a quiet mark while its name is active here.
  useEffect(() => {
    const row = document.getElementById(selected);
    if (!row) return undefined;
    row.dataset.linked = 'true';
    return () => {
      delete row.dataset.linked;
    };
  }, [selected]);
  const share = useMemo(() => (spec ? forgeShareLink(spec) : '/labs/spec-forge'), [spec]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const keys = [...(code.current?.querySelectorAll<HTMLButtonElement>('button[data-field]') ?? [])];
    const at = keys.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? keys.length - 1
          : Math.max(0, Math.min(keys.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)));
    keys[next]?.focus();
  };

  // The roving tab stop: the selected key if it is on this spec, else the first key.
  const stop = lines.some((l) => l.field === selected && l.key) ? selected : lines.find((l) => l.key)?.field;

  return (
    <Section id="annotated-example">
      <div className={styles.exampleBar}>
        <SegmentedControl
          size="sm"
          aria-label="Which example spec"
          value={pick}
          onValueChange={(v) => {
            const next = PICKS.find((p) => p.id === v)?.id ?? 'web-app';
            setPick(next);
            setSelected('app-name');
          }}
          options={PICKS.map((p) => ({ value: p.id, label: p.label }))}
        />
        <p className={styles.exampleNote}>{fixture?.description}</p>
      </div>

      <div className={styles.example}>
        <Slab>
          <Group
            ref={code}
            className={styles.json}
            label="Spec JSON. Each field name is a button. Use the up and down arrow keys to move between them."
            onKeyDown={onKeyDown}
          >
            {lines.map((line, i) => {
              const toks = tokens[i] ?? [{ type: 'plain' as const, text: line.text }];
              const active = line.field !== null && line.field === selected;
              let keyDone = false;
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: lines of one rendered document
                  key={i}
                  className={styles.jsonLine}
                  data-active={active ? 'true' : undefined}
                  data-linked={line.field ? 'true' : undefined}
                >
                  <span className={styles.jsonNum} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={styles.jsonText}>
                    {toks.map((t, j) => {
                      const isKey = !keyDone && t.type === 'key' && line.key !== null;
                      if (isKey && line.field) {
                        keyDone = true;
                        const field = line.field;
                        return (
                          <button
                            // biome-ignore lint/suspicious/noArrayIndexKey: tokens of one line
                            key={j}
                            type="button"
                            data-field={field}
                            className={styles.jsonKey}
                            aria-pressed={field === selected}
                            tabIndex={field === stop ? 0 : -1}
                            onMouseEnter={() => setSelected(field)}
                            onFocus={() => setSelected(field)}
                            onClick={() => setSelected(field)}
                          >
                            {t.text}
                          </button>
                        );
                      }
                      return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: tokens of one line
                        <span key={j} className={t.type === 'plain' ? undefined : styles[`tok_${t.type}`]}>
                          {t.text}
                        </span>
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </Group>
        </Slab>

        <div className={styles.inspector}>
          <p className="sr-only" role="status">
            {doc ? `Showing the row for ${doc.key}.` : ''}
          </p>
          {doc ? (
            <Slab padded>
              <div className={styles.inspectorBody}>
                <p className={styles.inspectorKind}>
                  {doc.scope === 'app' ? 'Top level field' : 'Component field'}
                </p>
                <p className={styles.inspectorKey}>{doc.key}</p>
                <div className={styles.inspectorTags}>
                  <FieldTags doc={doc} />
                </div>
                <p className={styles.inspectorSummary}>
                  <Md text={doc.summary} />
                </p>
                <FieldDetails doc={doc} />
                <Link to={{ hash: `#${doc.id}` }} className="link">
                  Go to this field in the reference
                </Link>
              </div>
            </Slab>
          ) : null}
        </div>
      </div>

      <p className={styles.exampleFoot}>
        This is one of the fixtures behind the Academy's lessons. It lints clean and is priced at the baked
        official rates in the test suite.{' '}
        <Link to={share} className="link">
          Open it in Spec Forge
        </Link>
        .
      </p>
    </Section>
  );
}
