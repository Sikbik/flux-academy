/**
 * One step's narrative: eyebrow, title (the focus target on arrival), body, callouts, task.
 */

import type { Ref } from 'react';
import { MarkupText } from '@/learn/MarkupText';
import type { Step } from '@/learn/types';
import { Callouts } from './Callouts';
import styles from './StepView.module.css';
import { TaskPanel } from './TaskPanel';

export interface StepViewProps {
  step: Step;
  index: number;
  total: number;
  module: string;
  headingRef: Ref<HTMLHeadingElement>;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function StepView({ step, index, total, module, headingRef }: StepViewProps) {
  return (
    <article className={styles.step} aria-labelledby={`step-${step.id}`}>
      <p className={styles.eyebrow}>
        <span className={styles.hex} aria-hidden="true" />
        <span>
          {pad(index + 1)} / {pad(total)}
        </span>
        <span className={styles.sep}>{module}</span>
      </p>
      <h2 id={`step-${step.id}`} ref={headingRef} tabIndex={-1} className={styles.title}>
        <MarkupText text={step.title} plain />
      </h2>
      <div className={styles.body}>
        {step.body.map((p, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs are a static ordered list
          <p key={i} className={styles.p}>
            <MarkupText text={p} reveal baseDelay={140 + i * 180} />
          </p>
        ))}
      </div>
      {step.callouts && step.callouts.length > 0 ? <Callouts callouts={step.callouts} /> : null}
      <TaskPanel step={step} />
    </article>
  );
}
