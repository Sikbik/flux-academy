/**
 * What the validator said that this session is about: the lint findings of the starting spec that a scenario wants
 * explained in the debrief, in the linter's own words.
 *
 * This is a file of its own so the linter (about 25 KB of JavaScript once compressed) is fetched when a
 * session that shows these findings ends, and not with the widget or the lab. `useAgentSession` imports it
 * on demand; the debrief takes the result as an argument and stays free of the linter.
 */

import { LINT_CODES, lintSpec } from '@shared/flux';
import type { DebriefLint } from './debrief.ts';
import { prepare, specOf } from './session.ts';
import type { SessionState } from './types.ts';

export function debriefLint(state: SessionState): DebriefLint[] {
  const p = prepare(state.scenario, state.options);
  const wanted = p.scenario.showLint;
  if (!wanted || wanted.length === 0) return [];
  const report = lintSpec(specOf(p, 'main'));
  const lines: DebriefLint[] = [];
  for (const issue of report.issues) {
    if (!wanted.includes(issue.code)) continue;
    lines.push({
      code: issue.code,
      title: LINT_CODES[issue.code]?.title ?? issue.code,
      message: issue.message,
      why: issue.why,
      fix: issue.fix,
      fixed: state.specKey !== 'main',
    });
  }
  return lines;
}
