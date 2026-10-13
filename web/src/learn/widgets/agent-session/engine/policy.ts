/**
 * Approval policies: what a client does before it runs a tool call the agent proposes.
 *
 * A policy looks at the TOOL, not at its arguments, which is all a client can do with a tool list that carries no annotations (FACTS 15.1.4). So under
 * `ask-spends` the plan call of `flux_deploy_app` asks (the tool can spend) and `flux_control_app` does not
 * (it spends nothing, although it can delete data). Reads never prompt under any policy.
 *
 * Rules (shared/flux/agents.ts is the data):
 *   ask-all     asks before every call that is not a pure read: `approvalRecommended(tool)`, the academy's
 *               recommendation (FACTS 15.1.4).
 *   ask-spends  asks only for tools whose `spends` is not `never`.
 *   allow-all   asks for nothing.
 */

import { approvalRecommended, type McpTool } from '@shared/flux';
import type { PolicyId } from './types.ts';

export interface PolicyInfo {
  id: PolicyId;
  /** The name of the setting, as a client might word it. */
  label: string;
  /** One line for chips. */
  short: string;
  /** One sentence for a card. */
  blurb: string;
  /** What it does, in plain words. */
  detail: string;
  /** What it lets through. */
  gap: string;
}

export const POLICIES: Readonly<Record<PolicyId, PolicyInfo>> = {
  'ask-all': {
    id: 'ask-all',
    label: 'Ask before anything that is not a read',
    short: 'Asks for every change',
    blurb: 'You are asked before every call that is not a read.',
    detail:
      "The academy's recommendation. You are asked before any call that changes an app, handles keys, spends or can delete. Calls that only read still run without a prompt.",
    gap: 'Only reads run without asking.',
  },
  'ask-spends': {
    id: 'ask-spends',
    label: 'Ask only before calls that spend',
    short: 'Asks only for spending',
    blurb: 'You are asked only before calls that can spend.',
    detail:
      'A setting that guards only money. You are asked before a tool that can move money. A tool that spends nothing runs without a prompt, even when it can delete an app or its data.',
    gap: 'A call that deletes or changes things runs without asking when the tool spends nothing.',
  },
  'allow-all': {
    id: 'allow-all',
    label: 'Ask for nothing',
    short: 'Asks for nothing',
    blurb: 'Nothing asks. You see what happened afterwards.',
    detail: 'Every call runs as soon as the agent proposes it. You see what happened afterwards.',
    gap: 'Everything runs without asking.',
  },
};

/** Whether `policy` stops to ask the person before running `tool`. Reads never prompt. */
export function asks(policy: PolicyId, tool: McpTool): boolean {
  if (tool.risk === 'reads') return false;
  switch (policy) {
    case 'allow-all':
      return false;
    case 'ask-all':
      return approvalRecommended(tool);
    case 'ask-spends':
      return tool.spends !== 'never';
  }
}

/** The sentence that says why this policy asked about this tool. */
export function whyAsked(policy: PolicyId, tool: McpTool): string {
  if (policy === 'ask-all') return 'Your policy asks before any call that is not a read.';
  if (policy === 'ask-spends') {
    return tool.spends === 'via-checkout'
      ? 'Your policy asks before any call that can start a payment.'
      : 'Your policy asks before any call that can spend.';
  }
  return 'Your policy asks for nothing, so this would not have stopped.';
}

/** The sentence that says why a call that is not a read ran without a prompt under this policy. */
export function whyRan(policy: PolicyId, tool: McpTool): string {
  if (tool.risk === 'reads') return 'A read: it runs without a prompt under every policy.';
  if (policy === 'allow-all') return 'Your policy asks for nothing, so nothing stopped this call.';
  if (policy === 'ask-spends') {
    return tool.spends === 'never'
      ? 'Your policy asks only before calls that can spend, and this tool spends nothing, so nothing stopped it.'
      : 'Your policy asks before calls that can spend.';
  }
  return 'Your policy asks before any call that is not a read.';
}

/**
 * The tools of a server that `ask-spends` lets through although `ask-all` would stop them: they change or
 * delete things and spend nothing. This is the policy gap, by name.
 */
export function silentUnderAskSpends(tools: readonly McpTool[]): McpTool[] {
  return tools.filter((t) => asks('ask-all', t) && !asks('ask-spends', t));
}
