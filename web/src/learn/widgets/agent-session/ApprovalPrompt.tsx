/**
 * The approval prompt: what a client shows when its policy stops a call.
 *
 * It sits inside the card of the call that waits, is not modal, and does not hide the arguments above it:
 * the whole point is to read them. Refuse comes first in the document, so the control a keyboard lands on and
 * the one Enter presses is the safe one. The two buttons carry the tool's name for a screen reader, and the
 * prompt is a labelled group (a fieldset named by its heading) so focus moving into it announces what it is
 * about.
 *
 * Wording of the risk comes from `describeApproval` and `toolRiskLabel` in `@shared/flux`, so this prompt
 * and the reference page say the same thing. The sentence about why the policy asked is `whyAsked`.
 */

import { describeApproval, toolRiskLabel } from '@shared/flux';
import { type Ref, useId } from 'react';
import { Button, FreshnessChip, Glyph } from '@/ui';
import styles from './AgentSession.module.css';
import { whyAsked } from './engine/policy.ts';
import type { PromptView } from './engine/session.ts';
import type { Decision, PolicyId } from './engine/types.ts';
import { Heading } from './Heading.tsx';
import { toolGlyph } from './words.ts';

export interface ApprovalPromptProps {
  prompt: PromptView;
  policy: PolicyId;
  /** Show me is making the choices: the buttons are shown and disabled. */
  scripted: boolean;
  onDecide: (decision: Decision) => void;
  /** Heading level of the prompt's title. */
  level: number;
  rootRef?: Ref<HTMLFieldSetElement>;
}

export function ApprovalPrompt({ prompt, policy, scripted, onDecide, level, rootRef }: ApprovalPromptProps) {
  const id = useId();
  const tool = prompt.tool;

  if (prompt.kind === 'human') {
    return (
      <fieldset ref={rootRef} className={styles.prompt} data-kind="human" aria-labelledby={`${id}-h`}>
        <Heading level={level} id={`${id}-h`} className={styles.promptTitle}>
          Your move on the checkout page
        </Heading>
        <p className={styles.promptLine} data-wrap="">
          <FreshnessChip kind="simulation" />{' '}
          <span className={styles.promptText}>No money moves here. Choose what you would do.</span>
        </p>
        <div className={styles.promptActions}>
          {prompt.choices.map((c) => (
            <Button
              key={c.id}
              variant="secondary"
              icon={c.id === 'pay' ? 'price' : 'cross'}
              disabled={scripted}
              onClick={() => onDecide({ choice: 'human', id: c.id })}
              className={styles.choice}
            >
              {c.label}
            </Button>
          ))}
        </div>
        {scripted ? <p className={styles.promptNote}>Show me is making this choice for you.</p> : null}
      </fieldset>
    );
  }

  if (!tool) return null;

  if (prompt.kind === 'reason') {
    return (
      <fieldset ref={rootRef} className={styles.prompt} data-kind="reason" aria-labelledby={`${id}-h`}>
        <Heading level={level} id={`${id}-h`} className={styles.promptTitle}>
          You refused {tool.name}. What should the agent do next?
        </Heading>
        <p className={styles.promptLine}>Your answer is sent to the agent as your next message.</p>
        <div className={styles.promptActions} data-stack="">
          {prompt.reasons.map((r) => (
            <Button
              key={r.id}
              variant="secondary"
              disabled={scripted}
              onClick={() => onDecide({ choice: 'reason', id: r.id })}
              className={styles.choice}
            >
              {r.label}
            </Button>
          ))}
        </div>
        {scripted ? <p className={styles.promptNote}>Show me is making this choice for you.</p> : null}
      </fieldset>
    );
  }

  const spends = tool.spends !== 'never';
  return (
    <fieldset
      ref={rootRef}
      className={styles.prompt}
      data-kind="approve"
      aria-labelledby={`${id}-h`}
      aria-describedby={`${id}-d`}
    >
      <Heading level={level} id={`${id}-h`} className={styles.promptTitle}>
        <Glyph name="shield" size={16} />
        <span className={styles.promptText}>Your policy stops this call: {tool.name}</span>
      </Heading>
      <div id={`${id}-d`} className={styles.promptBody}>
        <p className={styles.promptLine}>
          <Glyph name={toolGlyph(tool)} size={16} />
          <span className={styles.promptText}>
            <strong>{toolRiskLabel(tool)}.</strong> {describeApproval(tool)}
          </span>
        </p>
        <p className={styles.promptLine}>
          <span className={styles.promptText}>
            {whyAsked(policy, tool)} Read the arguments above before you decide.
          </span>
        </p>
        {tool.watch ? (
          <p className={styles.promptLine}>
            <span className={styles.promptText}>
              <span className={styles.whyLabel}>Look for</span> {tool.watch}
            </span>
          </p>
        ) : null}
        {spends ? (
          <p className={styles.promptLine} data-wrap="">
            <FreshnessChip kind="simulation" />{' '}
            <span className={styles.promptText}>Nothing is paid on this page.</span>
          </p>
        ) : null}
      </div>
      <div className={styles.promptActions}>
        <Button
          variant="secondary"
          icon="cross"
          aria-label={`Refuse ${tool.name}`}
          disabled={scripted}
          onClick={() => onDecide({ choice: 'refuse' })}
        >
          Refuse
        </Button>
        <Button
          variant="secondary"
          icon="check"
          aria-label={`Approve ${tool.name}`}
          disabled={scripted}
          onClick={() => onDecide({ choice: 'approve' })}
        >
          Approve
        </Button>
      </div>
      {scripted ? <p className={styles.promptNote}>Show me is making this choice for you.</p> : null}
    </fieldset>
  );
}
