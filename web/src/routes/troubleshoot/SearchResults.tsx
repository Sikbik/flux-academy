import { useState } from 'react';
import { Link } from 'react-router';
import { stageById } from '@/content/troubleshoot';
import { MarkupText } from '@/learn/MarkupText';
import { Button, Chip, Glyph, type GlyphName, Panel } from '@/ui';
import { CodeBody, MessageBody, SeverityChip } from './Cards';
import {
  type CodeHit,
  hrefOf,
  type MessageHit,
  plural,
  type SearchResults as Results,
  type SymptomHit,
  totalHits,
} from './model';
import styles from './parts.module.css';

const LIMITS = { symptoms: 8, messages: 5, codes: 6 } as const;

function SymptomRow({ hit }: { hit: SymptomHit }) {
  const stage = stageById(hit.symptom.stage);
  return (
    <Panel
      as={Link}
      to={hrefOf.symptom(hit.symptom.id)}
      variant="slab"
      interactive
      size="sm"
      padding="md"
      marks={false}
      className={styles.symptomCard}
      contentClassName={styles.symptomBody}
    >
      <span className={styles.resultKind}>
        <Glyph name={stage.glyph as GlyphName} size={14} />
        {stage.title}
      </span>
      <span className={styles.symptomTitle}>{hit.symptom.title}</span>
      <span className={styles.symptomSummary}>{hit.symptom.summary}</span>
    </Panel>
  );
}

function MessageRow({ hit }: { hit: MessageHit }) {
  return (
    <Panel
      as={Link}
      to={hrefOf.message(hit.message.id)}
      variant="slab"
      interactive
      size="sm"
      padding="md"
      marks={false}
      className={styles.symptomCard}
      contentClassName={styles.symptomBody}
    >
      <span className={styles.resultKind}>
        <Glyph name="terminal" size={14} />
        Error message
      </span>
      <span className={styles.messageText}>{hit.message.text}</span>
      <span className={styles.symptomSummary}>
        <MarkupText text={hit.message.means} plain />
      </span>
    </Panel>
  );
}

function CodeRow({ hit }: { hit: CodeHit }) {
  return (
    <Panel
      as={Link}
      to={hrefOf.code(hit.meta.code)}
      variant="slab"
      interactive
      size="sm"
      padding="md"
      marks={false}
      className={styles.symptomCard}
      contentClassName={styles.symptomBody}
    >
      <span className={styles.resultKind}>
        <Glyph name="code" size={14} />
        Lint code
        <SeverityChip severity={hit.meta.severity} />
      </span>
      <span className={styles.codeTitle}>
        <code className={styles.codeName}>{hit.meta.code}</code> {hit.meta.title}
      </span>
      <span className={styles.symptomSummary}>{hit.meta.why}</span>
    </Panel>
  );
}

function More({
  shown,
  total,
  onMore,
  noun,
}: {
  shown: number;
  total: number;
  onMore: () => void;
  noun: string;
}) {
  if (total <= shown) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onMore} className={styles.more}>
      Show {total - shown} more {noun}
    </Button>
  );
}

/**
 * The search view. A pasted error message or a code written out is shown first, in full, because that is
 * a match we are sure of; everything else is ranked and kept short until asked for.
 */
export function SearchResults({ results, onClear }: { results: Results; onClear: () => void }) {
  const [more, setMore] = useState({ symptoms: false, messages: false, codes: false });
  const total = totalHits(results);
  const symptoms = more.symptoms ? results.symptoms : results.symptoms.slice(0, LIMITS.symptoms);
  const messages = more.messages ? results.messages : results.messages.slice(0, LIMITS.messages);
  const codes = more.codes ? results.codes : results.codes.slice(0, LIMITS.codes);

  if (total === 0) {
    return (
      <section className={styles.results} aria-labelledby="ts-heading">
        <h2 id="ts-heading" className={styles.viewTitle} tabIndex={-1}>
          Nothing matches <q>{results.query}</q>
        </h2>
        <p className={styles.viewLead}>
          Try fewer words, or the words on the screen. If you have an error message, paste the whole line: it
          is matched against the text of the real ones. You can also start from the stage you are at.
        </p>
        <div className={styles.resultActions}>
          <Button variant="secondary" size="sm" icon="reset" onClick={onClear}>
            Clear the search
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.results} aria-labelledby="ts-heading">
      <h2 id="ts-heading" className={styles.viewTitle} tabIndex={-1}>
        {plural(total, 'match', 'matches')} for{' '}
        <q className={styles.queryEcho}>{results.query.slice(0, 80)}</q>
      </h2>

      {results.best.length > 0 ? (
        <section className={styles.resultGroup} aria-labelledby="ts-best">
          <h3 id="ts-best" className={styles.groupTitle}>
            This looks like
          </h3>
          <ul className={styles.bestList}>
            {results.best.map((h) => (
              <li key={h.type === 'code' ? `c-${h.meta.code}` : `m-${h.message.id}`}>
                <Panel variant="glass" tone="neutral" padding="md" size="md" halo={false} marks={false}>
                  {h.type === 'message' ? (
                    <>
                      <p className={styles.resultKind}>
                        <Glyph name="terminal" size={14} />
                        Error message
                      </p>
                      <p className={styles.messageText}>{h.message.text}</p>
                      <MessageBody message={h.message} />
                    </>
                  ) : (
                    <>
                      <p className={styles.resultKind}>
                        <Glyph name="code" size={14} />
                        Lint code
                        <SeverityChip severity={h.meta.severity} />
                      </p>
                      <p className={styles.codeTitle}>
                        <code className={styles.codeName}>{h.meta.code}</code> {h.meta.title}
                      </p>
                      <CodeBody meta={h.meta} />
                    </>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {results.symptoms.length > 0 ? (
        <section className={styles.resultGroup} aria-labelledby="ts-problems">
          <h3 id="ts-problems" className={styles.groupTitle}>
            Problems <Chip size="sm">{results.symptoms.length}</Chip>
          </h3>
          <ul className={styles.resultList}>
            {symptoms.map((h) => (
              <li key={h.symptom.id}>
                <SymptomRow hit={h} />
              </li>
            ))}
          </ul>
          <More
            shown={symptoms.length}
            total={results.symptoms.length}
            noun="problems"
            onMore={() => setMore((m) => ({ ...m, symptoms: true }))}
          />
        </section>
      ) : null}

      {results.messages.length > 0 ? (
        <section className={styles.resultGroup} aria-labelledby="ts-messages-r">
          <h3 id="ts-messages-r" className={styles.groupTitle}>
            Error messages <Chip size="sm">{results.messages.length}</Chip>
          </h3>
          <ul className={styles.resultList}>
            {messages.map((h) => (
              <li key={h.message.id}>
                <MessageRow hit={h} />
              </li>
            ))}
          </ul>
          <More
            shown={messages.length}
            total={results.messages.length}
            noun="messages"
            onMore={() => setMore((m) => ({ ...m, messages: true }))}
          />
        </section>
      ) : null}

      {results.codes.length > 0 ? (
        <section className={styles.resultGroup} aria-labelledby="ts-codes-r">
          <h3 id="ts-codes-r" className={styles.groupTitle}>
            Lint codes <Chip size="sm">{results.codes.length}</Chip>
          </h3>
          <ul className={styles.resultList}>
            {codes.map((h) => (
              <li key={h.meta.code}>
                <CodeRow hit={h} />
              </li>
            ))}
          </ul>
          <More
            shown={codes.length}
            total={results.codes.length}
            noun="codes"
            onMore={() => setMore((m) => ({ ...m, codes: true }))}
          />
        </section>
      ) : null}
    </section>
  );
}
