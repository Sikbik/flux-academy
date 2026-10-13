import { useState } from 'react';

/** The step id and the rest of a step key (`first-deploy-port:3`, or with an override nonce appended). */
export function splitStepKey(stepKey: string): { id: string; rest: string } {
  const i = stepKey.indexOf(':');
  return i < 0 ? { id: stepKey, rest: '' } : { id: stepKey.slice(0, i), rest: stepKey.slice(i + 1) };
}

/**
 * How many times a lesson stage has asked to start over. Use it as a reset key.
 *
 * A step that brings a NEW stage object resets unless that stage says `reset: false`. A step that inherits
 * the previous stage (the same object) keeps the learner's work, so a story can continue. The same step
 * entered again (a new nonce: "try again", or the engine's own Show me override) starts over.
 *
 * Derived while rendering with state (the supported "adjust state on a prop change" pattern), so the new
 * input and the new key reach the child in the same render.
 */
export function useStageResets(stage: object, stepKey: string, reset: boolean | undefined): number {
  const [seen, setSeen] = useState({ stage, stepKey, resets: 0 });
  let resets = seen.resets;
  if (seen.stage !== stage || seen.stepKey !== stepKey) {
    const stageChanged = seen.stage !== stage;
    const before = splitStepKey(seen.stepKey);
    const now = splitStepKey(stepKey);
    const restart = before.id === now.id && before.rest !== now.rest;
    if ((stageChanged && reset !== false) || restart) resets += 1;
    setSeen({ stage, stepKey, resets });
  }
  return resets;
}
