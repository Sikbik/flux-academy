/**
 * What happens when a deck row is activated. Pure given an environment: the browser one lives in
 * `runEnv.ts`, and tests pass a recording one.
 */

import type { AccentId } from '@/system/prefs';
import type { DeckItem } from './items';

export interface RunEnv {
  navigate(to: string): void;
  setSound(on: boolean): void;
  setReducedMotion(on: boolean): void;
  setAutoAmbient(on: boolean): void;
  /** Returns false (and says why itself) when the accent is locked. */
  setAccent(id: AccentId): boolean;
  enterAmbient(): void;
  showShortcuts(): void;
  copyLink(): void;
}

export interface RunResult {
  /** One sentence for the deck's polite live region. */
  announce?: string;
  /** Switch the deck into its `>` mode. */
  terminal?: boolean;
  /** Open this glossary term's card in place. */
  term?: string;
}

export type RunMode = 'primary' | 'secondary';

export interface ItemActions {
  primary: string;
  /** What Shift+Enter does, when it does something different. */
  secondary?: string;
}

/** The hint text for the footer: what Enter and Shift+Enter will do for this row. */
export function describeActions(item: DeckItem): ItemActions {
  switch (item.kind) {
    case 'lesson':
      return { primary: 'Open lesson' };
    case 'lab':
      return { primary: 'Open lab' };
    case 'term':
      return { primary: 'Show definition', secondary: 'Open in glossary' };
    case 'reference':
    case 'page':
      return { primary: 'Open' };
    case 'fix':
      return { primary: 'Show the fix' };
    case 'action': {
      if (item.ref === 'resume') return { primary: item.title.startsWith('Resume') ? 'Resume' : 'Open' };
      if (item.ref === 'ask') return { primary: 'Ask the network' };
      if (item.ref === 'ambient') return { primary: 'Enter ambient mode' };
      if (item.ref === 'copy-link') return { primary: 'Copy link' };
      if (item.ref === 'shortcuts') return { primary: 'Show shortcuts' };
      if (item.ref.startsWith('accent:')) {
        return { primary: item.badge === 'Locked' ? 'How to unlock' : 'Use this accent' };
      }
      if (item.state === 'on') return { primary: 'Turn off' };
      if (item.state === 'off') return { primary: 'Turn on' };
      return { primary: 'Run' };
    }
  }
}

function flipState(item: DeckItem): boolean {
  // The item shows the state it is in; running it asks for the opposite.
  return item.state !== 'on';
}

/** Runs a row. Returns what the deck should do next (stay open, switch mode, announce). */
export function runItem(item: DeckItem, mode: RunMode, env: RunEnv): RunResult {
  switch (item.kind) {
    case 'lesson':
    case 'lab':
    case 'reference':
    case 'fix':
    case 'page':
      // Through the app's navigate, so the hex iris plays and the page scrolls to the `#anchor` and
      // flashes what it points at.
      if (item.to) env.navigate(item.to);
      return {};
    case 'term':
      if (mode === 'secondary') {
        env.navigate(`/glossary#${item.ref}`);
        return {};
      }
      return { term: item.ref, announce: `${item.title}. ${item.description}` };
    case 'action': {
      switch (item.ref) {
        case 'resume':
          if (item.to) env.navigate(item.to);
          return {};
        case 'ask':
          return { terminal: true };
        case 'ambient':
          env.enterAmbient();
          return {};
        case 'shortcuts':
          env.showShortcuts();
          return {};
        case 'copy-link':
          env.copyLink();
          return {};
        case 'sound': {
          const next = flipState(item);
          env.setSound(next);
          return { announce: next ? 'Sound on' : 'Sound off' };
        }
        case 'motion': {
          const next = flipState(item);
          env.setReducedMotion(next);
          return { announce: next ? 'Motion reduced' : 'Motion restored' };
        }
        case 'ambient-auto': {
          const next = flipState(item);
          env.setAutoAmbient(next);
          return {
            announce: next ? 'Ambient mode starts when idle' : 'Ambient mode will not start by itself',
          };
        }
        default: {
          if (item.ref.startsWith('accent:')) {
            const id = item.ref.slice('accent:'.length) as AccentId;
            const ok = env.setAccent(id);
            return { announce: ok ? `Accent changed` : 'That accent is locked' };
          }
          return {};
        }
      }
    }
  }
}
