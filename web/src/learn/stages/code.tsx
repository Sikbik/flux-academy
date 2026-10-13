/**
 * The `code` stage: source files with syntax colour, line highlights and a copy button.
 * Owner: the lesson engine. See types.ts `CodeStage`.
 */

import { CodeView } from '../parts/CodeView';
import type { StageComponentProps } from '../stage-api';
import type { CodeStage } from '../types';

export default function CodeStageView({ stage, stepKey }: StageComponentProps<CodeStage>) {
  // Re-key on the file set, so a new step with different files starts on its first tab.
  const key = `${stepKey}:${stage.files.map((f) => f.name).join('|')}`;
  return <CodeView key={key} files={stage.files} label="Source files" />;
}
