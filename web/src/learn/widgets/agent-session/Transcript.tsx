/**
 * The transcript: what was said and what the agent called, in order. One list, so a screen reader walks it
 * the way a person reads it. A call is a card: the tool, what it can do, who allowed it, the example
 * arguments, and what came back. The prompt for the call that waits is drawn inside its own card (`prompt`).
 *
 * Nothing here is a key. An argument that carries one is a placeholder and says so in words.
 */

import { type McpTool, toolByName, toolRiskLabel } from '@shared/flux';
import { type ReactNode, type Ref, useMemo } from 'react';
import { InlineMarkup } from '@/app/InlineMarkup';
import { Callout, Chip, FreshnessChip, Glyph } from '@/ui';
import styles from './AgentSession.module.css';
import type {
  CallEntry,
  Entry,
  HumanEntry,
  NoteEntry,
  PolicyId,
  ResolvedArg,
  ResolvedLine,
  SayEntry,
} from './engine/types.ts';
import { gateWords, RISK_TONE, toolGlyph } from './words.ts';

export interface TranscriptProps {
  entries: readonly Entry[];
  policy: PolicyId;
  /** The index of the entry that has a prompt, and the prompt to draw inside it. */
  promptAt: number | null;
  prompt: ReactNode;
  /** Mark the line a visitor planted (after the session, when the debrief explains it). */
  revealPlanted: boolean;
  listRef?: Ref<HTMLOListElement>;
}

export function Transcript({ entries, promptAt, prompt, revealPlanted, listRef }: TranscriptProps) {
  return (
    <ol className={styles.transcript} aria-label="Session transcript" tabIndex={-1} ref={listRef}>
      {entries.map((e, i) => (
        <li
          key={e.n}
          className={styles.entry}
          data-kind={e.kind}
          data-latest={i === entries.length - 1 ? '' : undefined}
        >
          {e.kind === 'say' ? <SayLine entry={e} /> : null}
          {e.kind === 'note' ? <NoteLine entry={e} /> : null}
          {e.kind === 'human' ? <HumanLine entry={e} /> : null}
          {e.kind === 'call' ? <CallCard entry={e} revealPlanted={revealPlanted} /> : null}
          {i === promptAt ? prompt : null}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

function SayLine({ entry }: { entry: SayEntry }) {
  const user = entry.who === 'user';
  return (
    <div className={styles.say} data-who={entry.who}>
      <span className={styles.speaker}>{user ? 'You' : 'Agent, scripted'}</span>
      <p className={styles.sayText}>
        <InlineMarkup text={entry.text} />
      </p>
    </div>
  );
}

function NoteLine({ entry }: { entry: NoteEntry }) {
  return (
    <Callout kind={entry.tone} title={entry.title} compact className={styles.note}>
      <InlineMarkup text={entry.text} />
    </Callout>
  );
}

function HumanLine({ entry }: { entry: HumanEntry }) {
  return (
    <div className={styles.human} data-done={entry.chosen !== null ? '' : undefined}>
      <span className={styles.speaker}>A step only you can do</span>
      <p className={styles.humanTitle}>{entry.title}</p>
      <p className={styles.sayText}>{entry.text}</p>
      {entry.chosen !== null ? (
        <p className={styles.humanChoice}>
          <Glyph name="check" size={14} /> You chose: {entry.chosen}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A call
// ---------------------------------------------------------------------------

function RiskChip({ tool }: { tool: McpTool }) {
  const tone = RISK_TONE[tool.risk];
  return (
    <Chip size="sm" kind={tone ? 'status' : 'label'} status={tone ?? undefined} icon={toolGlyph(tool)}>
      {toolRiskLabel(tool)}
    </Chip>
  );
}

function Args({ args }: { args: readonly ResolvedArg[] }) {
  if (args.length === 0) return null;
  return (
    <div className={styles.args}>
      <p className={styles.argsLabel}>Example arguments</p>
      <dl className={styles.argList}>
        {args.map((a) => (
          <div key={a.name} className={styles.arg} data-emphasis={a.emphasis}>
            <dt className={styles.argName}>{a.name}</dt>
            <dd className={styles.argValue}>
              <span className={styles.argText}>{a.value}</span>
              {a.key ? (
                <Chip size="sm" icon="key" className={styles.argChip}>
                  Placeholder, not a key
                </Chip>
              ) : null}
              {a.emphasis === 'confirm' ? (
                <Chip size="sm" kind="status" status="warn" icon="warning" className={styles.argChip}>
                  Signs and pays
                </Chip>
              ) : null}
              {a.emphasis === 'danger' ? (
                <Chip size="sm" kind="status" status="crit" icon="trash" className={styles.argChip}>
                  Deletes data
                </Chip>
              ) : null}
              {a.lines.length > 0 ? (
                <ul className={styles.argLines}>
                  {a.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : null}
              {a.note ? <span className={styles.argNote}>{a.note}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const MARK: Record<'ok' | 'warn' | 'crit', { glyph: 'check' | 'warning' | 'status-crit'; word: string }> = {
  ok: { glyph: 'check', word: 'OK' },
  warn: { glyph: 'warning', word: 'Note' },
  crit: { glyph: 'status-crit', word: 'Danger' },
};

/** Result lines with keys that do not depend on position: a log repeats a line, so a count is added. */
function keyed(lines: readonly ResolvedLine[]): { key: string; line: ResolvedLine }[] {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    const base = `${line.k ?? ''}|${line.v}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { key: `${base}|${n}`, line };
  });
}

function ResultLines({ lines, revealPlanted }: { lines: readonly ResolvedLine[]; revealPlanted: boolean }) {
  return (
    <ul className={styles.resultList}>
      {keyed(lines).map(({ key, line: l }) => {
        const mark = l.kind === 'ok' || l.kind === 'warn' || l.kind === 'crit' ? MARK[l.kind] : null;
        return (
          <li
            key={key}
            className={styles.resultLine}
            data-kind={l.kind}
            data-planted={l.planted && revealPlanted ? '' : undefined}
          >
            {mark ? (
              <span className={styles.resultMark}>
                <Glyph name={mark.glyph} size={12} />
                <span className="sr-only">{mark.word}: </span>
              </span>
            ) : null}
            {l.k ? <span className={styles.resultKey}>{l.k}</span> : null}
            <span className={styles.resultValue} data-log={l.kind === 'log' ? '' : undefined}>
              {l.v}
            </span>
            {l.planted && revealPlanted ? (
              <Chip size="sm" kind="status" status="crit" icon="flag" className={styles.plantedChip}>
                Planted by a visitor
              </Chip>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** What a call carries under its head: why the agent made it, its arguments, and what came back. */
function CallBody({
  entry,
  tool,
  revealPlanted,
}: {
  entry: CallEntry;
  tool: McpTool | undefined;
  revealPlanted: boolean;
}) {
  return (
    <>
      <p className={styles.why}>
        <span className={styles.whyLabel}>The agent says</span> {entry.why}
      </p>
      <Args args={entry.args} />
      {entry.argsUnknown && tool ? (
        <p className={styles.unknownArgs}>
          <span className={styles.whyLabel}>Documented as</span> {tool.summary} The Orbit guide does not
          publish this tool&rsquo;s arguments, so none are shown.
        </p>
      ) : null}
      {entry.result ? (
        <div className={styles.result}>
          <p className={styles.resultLabel}>Result</p>
          <ResultLines lines={entry.result} revealPlanted={revealPlanted} />
        </div>
      ) : null}
    </>
  );
}

function CallHead({ entry, tool }: { entry: CallEntry; tool: McpTool | undefined }) {
  return (
    <>
      <span className={styles.toolGlyph} aria-hidden="true">
        <Glyph name={tool ? toolGlyph(tool) : 'terminal'} size={18} />
      </span>
      <code className={styles.toolName}>{entry.tool}</code>
      {tool ? <RiskChip tool={tool} /> : null}
      {tool && tool.spends !== 'never' ? <FreshnessChip kind="simulation" /> : null}
    </>
  );
}

/**
 * A read, or a call from before the session began: one quiet line that opens to the details. A read that
 * returned something a person should see (a warning, a log line a visitor planted) starts open.
 */
function QuietCall({
  entry,
  tool,
  revealPlanted,
}: {
  entry: CallEntry;
  tool: McpTool | undefined;
  revealPlanted: boolean;
}) {
  const gate = gateWords(entry.gate, entry.status, entry.decision);
  const noteworthy = (entry.result ?? []).some((l) => l.planted || l.kind === 'warn' || l.kind === 'crit');
  return (
    <details
      className={styles.quiet}
      open={noteworthy || undefined}
      data-gate={entry.gate}
      data-risk={tool?.risk ?? 'reads'}
    >
      <summary className={styles.quietSummary}>
        <CallHead entry={entry} tool={tool} />
        <span className={styles.quietGate}>{gate.text}</span>
        <span className={styles.quietCaret} aria-hidden="true" />
      </summary>
      <div className={styles.quietBody}>
        <CallBody entry={entry} tool={tool} revealPlanted={revealPlanted} />
      </div>
    </details>
  );
}

function CallCard({ entry, revealPlanted }: { entry: CallEntry; revealPlanted: boolean }) {
  const tool = useMemo(() => toolByName(entry.server, entry.tool), [entry.server, entry.tool]);
  if (entry.gate === 'read' || entry.gate === 'earlier') {
    return <QuietCall entry={entry} tool={tool} revealPlanted={revealPlanted} />;
  }
  const gate = gateWords(entry.gate, entry.status, entry.decision);
  return (
    <article
      className={styles.call}
      aria-label={`Tool call: ${entry.tool}`}
      data-status={entry.status}
      data-gate={entry.gate}
      data-risk={tool?.risk ?? 'reads'}
      data-tone={gate.tone}
    >
      <div className={styles.callHead}>
        <CallHead entry={entry} tool={tool} />
      </div>
      <p className={styles.gate} data-tone={gate.tone}>
        <Glyph name={gate.glyph} size={14} />
        <span>{gate.text}</span>
      </p>
      <CallBody entry={entry} tool={tool} revealPlanted={revealPlanted} />
    </article>
  );
}
