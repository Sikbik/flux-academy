import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { VALIDATE_SAMPLES } from '@/content/reference/examples';
import { forgeShareLink, VALIDATE_MAX_CHARS, validateText } from '@/content/reference/tools';
import { Chip, StatusDot, TextArea } from '@/ui';
import { Slab } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { LintChip, SEVERITY_WORD } from '../../parts/LintChip';
import { Group, Ul } from '../../parts/Semantics';
import styles from './spec.module.css';

const SHOWN = 12;
const STATUS = { error: 'crit', warning: 'warn', info: 'pending' } as const;

/** Paste a spec, read what the linter says. A read-only front door to Spec Forge. */
export function Validate() {
  const [text, setText] = useState(VALIDATE_SAMPLES[0]?.json ?? '');
  const [all, setAll] = useState(false);
  const result = useMemo(() => validateText(text), [text]);

  return (
    <Section id="validate">
      <div className={styles.tool}>
        <Group className={styles.toolRow} label="Sample specs">
          {VALIDATE_SAMPLES.map((s) => (
            <Chip
              key={s.id}
              kind="filter"
              size="sm"
              selected={text === s.json}
              onClick={() => {
                setText(s.json);
                setAll(false);
              }}
            >
              {s.label}
            </Chip>
          ))}
        </Group>

        <div className={styles.toolGrid}>
          <TextArea
            label="Spec JSON"
            hint="Paste a whole spec. The linter runs in this page and nothing is sent anywhere."
            mono
            rows={14}
            autoGrow
            maxRows={24}
            value={text}
            onValueChange={(v) => {
              setText(v);
              setAll(false);
            }}
            spellCheck={false}
            maxLength={VALIDATE_MAX_CHARS}
          />

          <div className={styles.report} role="status" aria-live="polite">
            {result.kind === 'empty' ? (
              <Slab padded>
                <p className={styles.parseEmpty}>Paste a spec to see what the linter says about it.</p>
              </Slab>
            ) : result.kind === 'syntax' ? (
              <Slab padded>
                <p className={styles.verdictHead}>
                  <StatusDot status="crit" />
                  <span>
                    That is not valid JSON
                    {result.line !== null ? `, near line ${result.line}, column ${result.column}` : ''}.
                  </span>
                </p>
                <p className={styles.noteLead}>{result.message}</p>
              </Slab>
            ) : (
              <Slab padded>
                <p className={styles.verdictHead} data-ok={result.report.valid ? 'true' : 'false'}>
                  <StatusDot status={result.report.valid ? 'ok' : 'crit'} />
                  <span>
                    {result.report.valid
                      ? 'The linter finds no errors. The network also checks the image, name, placement and payment when you register.'
                      : 'The linter finds errors the network would refuse.'}{' '}
                    <span className={styles.dim}>
                      {result.report.errors} {result.report.errors === 1 ? 'error' : 'errors'},{' '}
                      {result.report.warnings} {result.report.warnings === 1 ? 'warning' : 'warnings'},{' '}
                      {result.report.infos} {result.report.infos === 1 ? 'note' : 'notes'}
                    </span>
                  </span>
                </p>
                <Ul className={styles.issues}>
                  {(all ? result.report.issues : result.report.issues.slice(0, SHOWN)).map((issue, i) => (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: one code can repeat at different paths
                      key={`${issue.code}-${issue.path}-${i}`}
                      className={styles.issue}
                      data-severity={issue.severity}
                    >
                      <p className={styles.issueHead}>
                        <StatusDot status={STATUS[issue.severity]} />
                        <span className={styles.issueSeverity}>{SEVERITY_WORD[issue.severity]}</span>
                        <LintChip code={issue.code} />
                        {issue.path ? <code className={styles.issuePath}>{issue.path}</code> : null}
                      </p>
                      <p className={styles.issueMessage}>{issue.message}</p>
                      <p className={styles.issueFix}>
                        <strong>Fix. </strong>
                        {issue.fix}
                      </p>
                    </li>
                  ))}
                </Ul>
                {result.report.issues.length > SHOWN ? (
                  <button type="button" className={styles.linkButton} onClick={() => setAll((v) => !v)}>
                    {all ? 'Show fewer' : `Show all ${result.report.issues.length}`}
                  </button>
                ) : null}
                <p className={styles.noteLead}>
                  This box only reads. To change the spec and watch the price move, open it in{' '}
                  <Link to={forgeShareLink(result.spec)} className="link">
                    Spec Forge
                  </Link>
                  .
                </p>
              </Slab>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
