/**
 * What the Agent Desk's "Teach me" drawer and "What is this?" popover say. Markup strings, one per paragraph:
 * `{{term:id}}` links the glossary. Kept apart from the component so a test can read every sentence.
 *
 * Facts: FACTS 15.1.3 (hosted: keys are call arguments), 15.1.4 (the tools), 15.1.5 (confirm is a flag the
 * agent sets), 15.1.15 (prompt injection is a route; no incident was observed), 15.4.2 and 15.4.7 (Orbit: an
 * account, and a checkout the person completes), 15.4.9 (Orbit arguments are not published).
 */

import { BAKED_PRICING } from '@shared/flux';

export const TEACH: readonly string[] = [
  "**What this is.** A scripted {{term:ai-agent}} proposes calls to a Flux {{term:mcp-server}} over {{term:mcp}}, and your client's approval policy decides which of them reach you. The agent is a script, not a model: the same choices always give the same session, and nothing leaves the page.",
  '**Reads never prompt.** A call that only reads runs without a question under every policy here. What a read returns is still data from outside, and it can carry text that tries to steer the agent ({{term:prompt-injection}}).',
  "**Three policies.** *Ask before anything that is not a read* is the academy's recommendation. *Ask only before calls that spend* guards only money, and it lets through a tool that spends nothing but can delete an app. *Ask for nothing* runs everything. The table under the session shows each tool of the chosen server against the three.",
  "**The confirm flag is not a gate.** On the FluxCloud server the agent sets `confirm` itself ({{term:confirm-gate}}), so the server cannot tell whether a person agreed. Your client's policy is the gate that counts, and a tool with no plan step, such as `flux_control_app`, has no confirm to lean on.",
  '**Two servers, two identities.** The FluxCloud server works with two keys and can pay in FLUX. Hosted by Flux, the keys are arguments of each call and pass through your AI vendor and the chat history. The Orbit server acts as your signed-in {{term:flux-orbit}} account and sends you to a checkout page that you complete, as its guide describes it. A rule that holds for one is not a rule for the other.',
  `**What this lab leaves out.** Real models differ, and the lab does not claim how often one would obey a planted line: the route exists, and the academy knows of no incident. The Orbit guide publishes no argument names, so that session shows tool names and the documented summaries only. Prices are \`quote()\` at the FLUX price baked on ${BAKED_PRICING.capturedAt}; a real quote moves with the market.`,
];

export const ABOUT: readonly string[] = [
  'Run four scripted sessions of an AI agent working a Flux MCP server. You choose how your client asks before it runs a call, and the debrief shows what each choice cost, changed and let through.',
];
