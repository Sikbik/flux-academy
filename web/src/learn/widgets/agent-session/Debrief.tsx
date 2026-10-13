/**
 * The debrief: the screen the session exists for. What it cost, what changed, what left the learner's hands,
 * what each policy would have done at each call, and the one sentence to take away.
 *
 * Everything on it is derived from the finished session by `buildDebrief`; this file only lays it out. Money
 * is the simulation's and says so (SIMULATION chip, and the FLUX price is marked as baked). A statement that
 * FACTS leaves unverified is labelled as guidance.
 */

import { type Ref, useId } from 'react';
import { InlineMarkup } from '@/app/InlineMarkup';
import { Button, Callout, Chip, FreshnessChip, Glyph } from '@/ui';
import styles from './AgentSession.module.css';
import type { Debrief } from './engine/debrief.ts';
import { formatFlux, formatUsd } from './engine/tokens.ts';
import { POLICY_IDS, type PolicyId } from './engine/types.ts';
import { Heading } from './Heading.tsx';
import { PolicyTable } from './PolicyTable.tsx';
import { POLICY_SHORT, VERDICT } from './words.ts';

export interface DebriefViewProps {
  debrief: Debrief;
  /** The policy this session ran under. */
  policy: PolicyId;
  headingRef?: Ref<HTMLHeadingElement>;
  /** Heading level of the debrief's own title; its sections sit one level below. */
  level: number;
  /** Run the same scenario again under this policy. */
  onRunAgain?: (policy: PolicyId) => void;
  /** Go back to choosing a scenario (the lab). */
  onChooseAnother?: () => void;
}

const BASIS = {
  verified: {
    label: 'Verified',
    meaning: 'Read in the source code of FluxOS or the MCP server, or seen on the live network.',
  },
  docs: { label: 'Docs', meaning: "Stated in Flux's documentation and not checked against the source." },
  guidance: {
    label: 'Guidance',
    meaning: 'Not confirmed. Treat it as guidance and test it before you rely on it.',
  },
} as const;

function ListOrNone({ items, none }: { items: readonly string[]; none: string }) {
  if (items.length === 0) return <p className={styles.tileNone}>{none}</p>;
  return (
    <ul className={styles.tileList}>
      {items.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a static ordered list of sentences
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

export function DebriefView({
  debrief: d,
  policy,
  headingRef,
  level,
  onRunAgain,
  onChooseAnother,
}: DebriefViewProps) {
  const id = useId();
  const verdict = VERDICT[d.verdict];
  const guidance = d.facts.filter((f) => f.basis === 'guidance').length;
  const anyChange = d.registered.length + d.changed.length + d.deleted.length + d.ended.length > 0;

  return (
    <section className={styles.debrief} aria-labelledby={`${id}-h`} data-verdict={d.verdict}>
      <header className={styles.debriefHead}>
        <div className={styles.debriefChips}>
          <Chip size="md" kind="status" status={verdict.tone} icon={verdict.glyph}>
            {verdict.label}
          </Chip>
          <FreshnessChip kind="simulation" />
        </div>
        <p className={styles.eyebrow}>Debrief</p>
        <Heading level={level} id={`${id}-h`} className={styles.debriefTitle} tabIndex={-1} ref={headingRef}>
          {d.title}
        </Heading>
        <p className={styles.debriefSummary}>
          <InlineMarkup text={d.summary} />
        </p>
      </header>

      <Callout kind="why" title="The one thing to take away" className={styles.takeaway}>
        <InlineMarkup text={d.takeaway} />
      </Callout>

      <div className={styles.tiles}>
        {/* ---- cost -------------------------------------------------------------------------------- */}
        <section className={styles.tile} aria-labelledby={`${id}-cost`}>
          <Heading level={level + 1} id={`${id}-cost`} className={styles.tileTitle}>
            <Glyph name="price" size={16} /> Cost
            <FreshnessChip kind="simulation" />
          </Heading>
          <p className={styles.bigNumber}>{formatUsd(d.cost.totalUsd)}</p>
          {d.cost.payments.length === 0 ? (
            <p className={styles.tileNone}>Nothing was paid.</p>
          ) : (
            <ul className={styles.payList}>
              {d.cost.payments.map((p, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: payments are ordered and may repeat a label
                <li key={i} className={styles.pay} data-needed={p.needed ? 'true' : 'false'}>
                  <span className={styles.payLabel}>{p.label}</span>
                  <span className={styles.payAmount}>
                    {formatUsd(p.usd)}
                    <span className={styles.payFlux}>{formatFlux(p.flux)}</span>
                  </span>
                  {!p.needed ? (
                    <Chip size="sm" kind="status" status="warn" icon="warning">
                      Not needed
                    </Chip>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {d.cost.wastedUsd > 0 ? (
            <p className={styles.tileNote}>
              <strong>{formatUsd(d.cost.wastedUsd)}</strong> of that bought nothing.
            </p>
          ) : null}
          {d.cost.smallFees.length > 0 ? (
            <ul className={styles.tileList}>
              {d.cost.smallFees.map((f) => (
                <li key={f}>{f}. A small network fee; the amount is not shown here.</li>
              ))}
            </ul>
          ) : null}
          {d.cost.payments.length > 0 ? (
            <p className={styles.fine}>
              <FreshnessChip kind="baked" /> FLUX amounts use the baked FLUX price of {d.cost.readOn}, not a
              live one.
              {d.cost.minimum ? ' The network minimum price applies to this app.' : ''}
            </p>
          ) : null}
          {d.cost.lines.length > 0 ? (
            <details className={styles.more}>
              <summary>How the price is made</summary>
              <ul className={styles.lineItems}>
                {d.cost.lines.map((l) => (
                  <li key={l.id}>
                    <span>{l.label}</span>
                    <span>{formatUsd(l.usd)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        {/* ---- changed ----------------------------------------------------------------------------- */}
        <section className={styles.tile} aria-labelledby={`${id}-changed`}>
          <Heading level={level + 1} id={`${id}-changed`} className={styles.tileTitle}>
            <Glyph name="layers" size={16} /> What changed
          </Heading>
          {!anyChange ? (
            <p className={styles.tileNone}>Nothing was registered, changed or deleted.</p>
          ) : (
            <>
              {d.registered.length > 0 ? (
                <div className={styles.tileGroup}>
                  <p className={styles.groupLabel}>Registered</p>
                  <ListOrNone items={d.registered} none="" />
                </div>
              ) : null}
              {d.changed.length > 0 ? (
                <div className={styles.tileGroup}>
                  <p className={styles.groupLabel}>Changed</p>
                  <ListOrNone items={d.changed} none="" />
                </div>
              ) : null}
              {d.deleted.length > 0 ? (
                <div className={styles.tileGroup} data-tone="crit">
                  <p className={styles.groupLabel}>
                    <Glyph name="trash" size={14} /> Deleted
                  </p>
                  <ListOrNone items={d.deleted} none="" />
                </div>
              ) : null}
              {d.ended.length > 0 ? (
                <div className={styles.tileGroup} data-tone="crit">
                  <p className={styles.groupLabel}>
                    <Glyph name="stop" size={14} /> Ended
                  </p>
                  <ListOrNone items={d.ended} none="" />
                </div>
              ) : null}
            </>
          )}
        </section>

        {/* ---- exposed ----------------------------------------------------------------------------- */}
        <section className={styles.tile} aria-labelledby={`${id}-exposed`}>
          <Heading level={level + 1} id={`${id}-exposed`} className={styles.tileTitle}>
            <Glyph name="key" size={16} /> What left your hands
          </Heading>
          <ListOrNone items={d.exposed} none="Nothing secret left your hands in this session." />
        </section>
      </div>

      {/* ---- where an instruction came from ----------------------------------------------------------- */}
      {d.planted.length > 0 ? (
        <section className={styles.debriefSection} aria-labelledby={`${id}-planted`}>
          <Heading level={level + 1} id={`${id}-planted`} className={styles.sectionTitle}>
            <Glyph name="flag" size={16} /> Where the instruction came from
          </Heading>
          {d.planted.map((line) => (
            <p key={line} className={styles.plantedLine}>
              <code>{line}</code>
            </p>
          ))}
          <p className={styles.sectionLead}>
            A visitor to the app caused it to print this line, and the log returned it as it was. The agent
            read it as an instruction. It was data, and nothing you wrote.
          </p>
        </section>
      ) : null}

      {/* ---- the policy table ------------------------------------------------------------------------ */}
      <section className={styles.debriefSection} aria-labelledby={`${id}-policy`}>
        <Heading level={level + 1} id={`${id}-policy`} className={styles.sectionTitle}>
          <Glyph name="shield" size={16} /> Your policy, call by call
        </Heading>
        <p className={styles.sectionLead}>
          Every call that is not a read, and what each policy would have done at it. You ran{' '}
          <strong>{POLICY_SHORT[policy]}</strong>.
          {d.readCount > 0
            ? ` ${d.readCount} ${d.readCount === 1 ? 'call' : 'calls'} only read, and a read runs without a prompt under every policy.`
            : ''}
        </p>
        <PolicyTable
          rows={d.rows}
          active={policy}
          caption="What each policy does at each call that is not a read"
          showRun
        />
        {d.letThrough.length > 0 ? (
          <p className={styles.gap} data-tone="warn">
            <Glyph name="warning" size={16} />
            <span>
              These ran without asking you, although a policy that asks before every call that is not a read
              would have stopped them:{' '}
              {d.letThrough.map((t, i) => (
                <span key={t.tool}>
                  {i > 0 ? ', ' : ''}
                  <code>{t.tool}</code> ({t.riskLabel.toLowerCase()})
                </span>
              ))}
              .
            </span>
          </p>
        ) : null}
        {d.silentTools.length > 0 ? (
          <p className={styles.gap}>
            <Glyph name="info" size={16} />
            <span>
              On this server a policy that asks only about spending also lets{' '}
              {d.silentTools.map((t, i) => (
                <span key={t.tool}>
                  {i > 0 ? (i === d.silentTools.length - 1 ? ' and ' : ', ') : ''}
                  <code>{t.tool}</code>
                </span>
              ))}{' '}
              through. They spend nothing, so that policy never asks about them.
            </span>
          </p>
        ) : null}
      </section>

      {/* ---- the validator ---------------------------------------------------------------------------- */}
      {d.lint.length > 0 ? (
        <section className={styles.debriefSection} aria-labelledby={`${id}-lint`}>
          <Heading level={level + 1} id={`${id}-lint`} className={styles.sectionTitle}>
            <Glyph name="flag" size={16} /> What the validator said that this session is about
          </Heading>
          <ul className={styles.lintList}>
            {d.lint.map((l) => (
              <li key={l.code} className={styles.lint}>
                <p className={styles.lintHead}>
                  <Chip size="sm" kind="status" status="warn" icon="warning">
                    {l.code}
                  </Chip>
                  <strong>{l.title}</strong>
                  <Chip
                    size="sm"
                    kind="status"
                    status={l.fixed ? 'ok' : 'warn'}
                    icon={l.fixed ? 'check' : 'warning'}
                  >
                    {l.fixed ? 'Fixed at your request' : 'It went through'}
                  </Chip>
                </p>
                <p>{l.message}</p>
                <p className={styles.lintWhy}>
                  <span className={styles.whyLabel}>Why it matters</span> {l.why}
                </p>
                <p className={styles.lintWhy}>
                  <span className={styles.whyLabel}>The fix</span> {l.fix}
                </p>
              </li>
            ))}
          </ul>
          <p className={styles.fine}>
            A validator raises warnings and still accepts the plan, and it may raise others than these. Only a
            person reading the plan, behind a gate that stops, weighs them.
          </p>
        </section>
      ) : null}

      {/* ---- what this rests on ------------------------------------------------------------------------ */}
      <details className={styles.facts}>
        <summary>
          What this rests on
          <span className={styles.factsCount}>
            {d.facts.length} {d.facts.length === 1 ? 'statement' : 'statements'}
            {guidance > 0 ? `, ${guidance} ${guidance === 1 ? 'is' : 'are'} guidance` : ''}
          </span>
        </summary>
        <ul className={styles.factList}>
          {d.facts.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a static ordered list
            <li key={i} className={styles.fact} data-fact={f.ref} data-basis={f.basis}>
              <Chip
                size="sm"
                kind={f.basis === 'guidance' ? 'status' : 'label'}
                status={f.basis === 'guidance' ? 'warn' : undefined}
                icon={f.basis === 'verified' ? 'code' : f.basis === 'docs' ? 'book' : 'warning'}
                title={BASIS[f.basis].meaning}
              >
                {BASIS[f.basis].label}
              </Chip>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </details>

      {/* ---- again -------------------------------------------------------------------------------------- */}
      {onRunAgain ? (
        <section className={styles.again} aria-labelledby={`${id}-again`}>
          <Heading level={level + 1} id={`${id}-again`} className={styles.sectionTitle}>
            <Glyph name="restart" size={16} /> Run it again
          </Heading>
          <p className={styles.sectionLead}>
            Same scenario, another policy. The agent does exactly the same things; what changes is which of
            them reach you.
          </p>
          <div className={styles.againActions}>
            {POLICY_IDS.filter((p) => p !== policy).map((p) => (
              <Button
                key={p}
                variant="secondary"
                icon="play"
                className={styles.againButton}
                onClick={() => onRunAgain(p)}
              >
                {POLICY_SHORT[p]}
              </Button>
            ))}
            <Button
              variant="ghost"
              icon="restart"
              className={styles.againButton}
              onClick={() => onRunAgain(policy)}
            >
              Same policy again
            </Button>
            {onChooseAnother ? (
              <Button
                variant="ghost"
                icon="arrow-up"
                className={styles.againButton}
                onClick={onChooseAnother}
              >
                Choose another scenario
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}
