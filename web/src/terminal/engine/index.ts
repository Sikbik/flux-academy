/**
 * The sandbox terminal engine: framework free, deterministic and unit tested.
 *
 *   const session = createSession({ script });
 *   session.submit('docker build -t you/app:1.0.0 .');
 *   session.getState().goals; // ticks as goals complete
 *
 * See session.ts for the lifecycle and run.ts for how a line is matched.
 */
export { completeLine, orderedExamples } from './complete';
export { jsonToMarkup, minifiedJson, parseJsonStream, prettyJson } from './json';
export { escapeMarkup, hasMarkup, parseMarkup, stripMarkup } from './markup';
export { anchorSource, CommandPattern, PatternCache } from './regex';
export { DEFAULT_NOT_FOUND, DEFAULT_STREAM_MS, type RunResult, runLine } from './run';
export { MAX_LINE_LENGTH, sanitizeInput } from './sanitize';
export {
  type CommandEvent,
  createSession,
  type PlanStep,
  type SessionOptions,
  type SubmitHandle,
  type SubmitOptions,
  TerminalSession,
} from './session';
export { lineDelays, ManualScheduler, realScheduler, seeded, typingDelay } from './stream';
export { levenshtein, nearest } from './text';
export type {
  CompletionResult,
  GoalState,
  LineTone,
  OutLine,
  PromptInfo,
  Scheduler,
  ScriptedCommand,
  ScriptWithRequires,
  SessionState,
  Span,
  SpanKind,
  TerminalCommand,
  TerminalScript,
  TranscriptEntry,
} from './types';
