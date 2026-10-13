/**
 * What every forge panel shares: the session and its snapshot, the lint issues indexed by path, the
 * lesson's focus notes, and the two navigation verbs ("take me to the field", "show me the line").
 * Panels read this instead of taking a dozen props; it changes once per edit.
 */

import type { FluxAppSpec, PricingParams } from '@shared/flux/types';
import { createContext, useContext } from 'react';
import type { IssueIndex } from './issues';
import type { ChangeOrigin, ForgeSession, ForgeSnapshot } from './model';

export interface FocusNote {
  /** The path the lesson named (`compose[0].containerPorts`): where the JSON gutter puts the number. */
  path: string;
  /** The path of the form field that draws the note: the ports table answers for its sibling arrays. */
  formPath: string;
  /** Lesson markup (`**bold**`, `code`, `{{term:id}}`). */
  note: string;
  /** 1-based, in the order the lesson listed them. */
  n: number;
}

export type ComponentVariant = 'public' | 'private';

export interface EditOptions {
  /** Edits with the same key within the coalescing window become one undo step. Default: the first path. */
  key?: string | null;
  /** What undo will call the step. */
  label?: string;
  origin?: ChangeOrigin;
}

export interface ForgeUi {
  session: ForgeSession;
  snap: ForgeSnapshot;
  issues: IssueIndex;
  focusNotes: readonly FocusNote[];
  /** The rates in force, for the numbers quoted in help text. */
  params: PricingParams;
  /** Dense layout for a short lesson area. */
  compact: boolean;
  /** True while the JSON text does not parse: the form is paused until it does. */
  paused: boolean;
  /** Whether the learner may change `path` (false when locked by the lesson or read only). */
  canEdit(path: string): boolean;
  /** Run a pure spec operation. Returns false when a path is locked or the form is paused. */
  edit(
    paths: string | readonly string[],
    fn: (spec: FluxAppSpec) => FluxAppSpec,
    opts?: EditOptions,
  ): boolean;
  /**
   * Add a component: `public` has a public port and a domain row, `private` has neither (a database or a
   * cache). The new section opens. `focus` moves the focus to its name. Returns the new index, or null when
   * the components are locked in this step, the app is at its limit or the JSON is being repaired.
   */
  addComponent(variant: ComponentVariant, opts?: { focus?: boolean }): number | null;
  /** Open the section holding `path`, scroll its field into view and focus the control. */
  jumpTo(path: string): void;
  /** Reveal the line of `path` in the JSON editor and put the caret there. */
  showInJson(path: string): void;
  /** One short sentence for the polite status line ("Renamed 2 host names"). */
  say(message: string): void;
}

export const ForgeContext = createContext<ForgeUi | null>(null);

export function useForgeUi(): ForgeUi {
  const ui = useContext(ForgeContext);
  if (!ui) throw new Error('useForgeUi must be used inside a SpecEditor');
  return ui;
}
