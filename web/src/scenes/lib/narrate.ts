// The words the scene says about itself, for assistive tech and the page's captions. One plain sentence
// each, no dashes, no emoji, and never the word "live" for a sample bench (that word belongs to real
// data only, and the page owns it). Shared by the WebGL scene and the 2D fallback so both say the same.

import type { SimEvent } from '@/diorama/sim';
import type { SceneEventKind } from '../bus';

const plural = (n: number): string => `${n} instance${n === 1 ? '' : 's'}`;

/** `Up. 3 instances placed, 2 healthy.` for the polite live region. */
export function statusLine(status: string, placed: number, healthy: number): string {
  switch (status) {
    case 'idle':
      return 'Idle. No instances placed.';
    case 'starting':
      return `Starting. ${plural(placed)} placed.`;
    case 'up':
      return `Up. ${plural(placed)} placed, ${healthy} healthy.`;
    case 'degraded':
      return `Degraded. ${plural(placed)} placed, ${healthy} healthy.`;
    case 'down':
      return `Down. ${plural(placed)} placed, none healthy.`;
    default:
      return '';
  }
}

export interface Narration {
  kind: SceneEventKind;
  text: string;
}

export interface NarrateContext {
  /** "Frankfurt, Germany" or "Germany" for a node index. */
  place(node: number): string;
  tier(node: number): string;
  placed: number;
  healthy: number;
}

/** A sentence for a simulation event, or null for the ones that are not worth announcing. */
export function narrate(e: SimEvent, c: NarrateContext): Narration | null {
  switch (e.type) {
    case 'placed':
      return {
        kind: 'placed',
        text: e.respawn
          ? `A replacement instance was placed on a ${e.tier} node in ${c.place(e.node)}.`
          : `Instance ${e.slot + 1} placed on a ${e.tier} node in ${c.place(e.node)}.`,
      };
    case 'removed':
      return { kind: 'retired', text: `Instance ${e.slot + 1} was withdrawn.` };
    case 'node-down': {
      const where = `A ${c.tier(e.node)} node in ${c.place(e.node)} went dark.`;
      if (c.placed > 0 && c.healthy === 0) {
        return { kind: 'all-down', text: `${where} Every instance is down and requests are failing.` };
      }
      if (c.placed > 0) {
        return {
          kind: 'node-down',
          text: `${where} ${c.healthy} of ${c.placed} instances still serve requests.`,
        };
      }
      return { kind: 'node-down', text: where };
    }
    case 'node-up':
      return { kind: 'node-up', text: 'The node came back and the instance on it restarted.' };
    case 'ejected':
      return {
        kind: 'ejected',
        text: 'The load balancer dropped the failed instance after its health checks failed.',
      };
    case 'rerouted':
      return { kind: 'rerouted', text: 'A request was redirected to a healthy instance.' };
    case 'reset':
      return { kind: 'reset', text: 'The bench was cleared.' };
    default:
      return null;
  }
}
