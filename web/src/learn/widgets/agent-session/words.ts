/**
 * The words and marks the session screens use for engine ideas: verdicts, risks, who the agent is working
 * as. Kept apart from the components so a test (and a lesson author) can read them in one place.
 *
 * Colour never carries meaning alone: every status here has a word and a glyph. Risk uses the status colours
 * (warn, crit) and never a tier colour: cyan, violet and amber mean tiers on this site.
 */

import { MCP_SERVERS, type McpServerId, type McpTool, type ToolRisk } from '@shared/flux';
import type { GlyphName } from '@/ui';
import type { Connection, PolicyId, Verdict } from './engine/types.ts';

export type Tone = 'ok' | 'warn' | 'crit' | 'pending' | 'off';

export interface VerdictWords {
  label: string;
  tone: Tone;
  glyph: GlyphName;
  /** One short sentence for the heading of the debrief. */
  lead: string;
}

export const VERDICT: Readonly<Record<Verdict, VerdictWords>> = {
  good: { label: 'Nothing lost', tone: 'ok', glyph: 'status-ok', lead: 'The session ended well.' },
  stopped: {
    label: 'Stopped by you',
    tone: 'pending',
    glyph: 'status-pending',
    lead: 'You stopped it before it cost anything.',
  },
  flawed: {
    label: 'A flaw got through',
    tone: 'warn',
    glyph: 'status-warn',
    lead: 'It ran, and something that should have been caught was not.',
  },
  costly: {
    label: 'Money wasted',
    tone: 'warn',
    glyph: 'status-warn',
    lead: 'It ran, and part of the money was not needed.',
  },
  harmful: {
    label: 'Data or an app lost',
    tone: 'crit',
    glyph: 'status-crit',
    lead: 'Something was deleted or ended.',
  },
};

export const RISK_GLYPH: Readonly<Record<ToolRisk, GlyphName>> = {
  reads: 'eye',
  keys: 'key',
  changes: 'edit',
  spends: 'wallet',
  destroys: 'trash',
};

/** The status colour a risk wears. Reads are plain. */
export const RISK_TONE: Readonly<Record<ToolRisk, Tone | null>> = {
  reads: null,
  keys: 'warn',
  changes: 'warn',
  spends: 'warn',
  destroys: 'crit',
};

/** The glyph for a tool: a payment that you complete in a checkout reads as a price tag, not a wallet. */
export function toolGlyph(tool: McpTool): GlyphName {
  if (tool.risk === 'spends' && tool.spends === 'via-checkout') return 'price';
  return RISK_GLYPH[tool.risk];
}

/** Short names of the policies for tight places (a table header, a chip). */
export const POLICY_SHORT: Readonly<Record<PolicyId, string>> = {
  'ask-all': 'Ask before all but reads',
  'ask-spends': 'Ask only for spending',
  'allow-all': 'Ask for nothing',
};

/** How the agent reaches the server, in words. The names are the catalogue's (`MCP_SERVERS`). */
export function connectionLabel(server: McpServerId, connection: Connection): string {
  const name = MCP_SERVERS[server].name;
  switch (connection) {
    case 'hosted':
      return `${name}, hosted by Flux`;
    case 'local':
      return `${name}, on your machine`;
    case 'account':
      return `${name}, your Orbit account`;
  }
}

/** What the agent is working as, one sentence. */
export function identityLine(server: McpServerId, connection: Connection): string {
  if (server === 'orbit') {
    return 'As the Orbit guide describes it, it works as your signed-in Orbit account. It holds no private key, and payment is a checkout page that you complete.';
  }
  return connection === 'hosted'
    ? 'It works with two keys that you hand it, a Flux ID key and a payment key. On the hosted server they travel as arguments of each call.'
    : 'It works with two keys that stay in the server process on your machine. They do not travel through your AI vendor.';
}

/** The gate of one call in the transcript, as the word the card carries. */
export function gateWords(
  gate: 'read' | 'prompted' | 'auto' | 'earlier',
  status: 'pending' | 'ran' | 'refused',
  decision: 'approved' | 'refused' | null,
): { text: string; tone: Tone; glyph: GlyphName } {
  if (gate === 'earlier') return { text: 'Ran earlier, with your approval', tone: 'off', glyph: 'check' };
  if (gate === 'read') return { text: 'A read, so it ran without a prompt', tone: 'off', glyph: 'eye' };
  if (gate === 'auto') {
    return { text: 'Ran without asking you', tone: 'warn', glyph: 'warning' };
  }
  if (status === 'pending') return { text: 'Waiting for your decision', tone: 'pending', glyph: 'hourglass' };
  if (decision === 'refused' || status === 'refused') {
    return { text: 'You refused. It did not run', tone: 'off', glyph: 'cross' };
  }
  return { text: 'You approved. It ran', tone: 'off', glyph: 'check' };
}
