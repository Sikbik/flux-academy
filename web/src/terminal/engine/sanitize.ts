/**
 * Hostile and sloppy input. The learner types into a text box and pastes things; the engine must
 * never choke on a megabyte line, control characters, bidi overrides or an escape sequence.
 */

/** Longest line the shell accepts. Real shells accept far more; nothing in a lesson needs it. */
export const MAX_LINE_LENGTH = 1000;
/** Longest single output line kept. */
export const MAX_OUTPUT_LINE = 2000;
/** Most output lines one command may produce. */
export const MAX_OUTPUT_LINES = 400;
/** Matching a regular expression never sees more than this many characters. */
export const MAX_MATCH_LENGTH = 600;

// C0 controls except tab, DEL and C1 controls.
// biome-ignore lint/suspicious/noControlCharactersInRegex: this is the point of the function
const CONTROL = /[\u0000-\u0008\u000a-\u001f\u007f-\u009f]/g;
// Bidirectional overrides and isolates, zero width characters and the BOM.
const INVISIBLE = /[​-‏‪-‮⁠-⁩﻿]/g;
// ANSI CSI and OSC escape sequences pasted from another terminal.
// biome-ignore lint/suspicious/noControlCharactersInRegex: escape sequences start with ESC
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/g;

export interface SanitizeResult {
  line: string;
  /** The line was longer than `MAX_LINE_LENGTH` and nothing was kept. */
  tooLong: boolean;
  /** Something was removed or replaced. */
  changed: boolean;
}

/** Clean one submitted line. Tabs become spaces, newlines end the line (a paste of several lines is cut). */
export function sanitizeInput(raw: string): SanitizeResult {
  if (typeof raw !== 'string') return { line: '', tooLong: false, changed: true };
  if (raw.length > MAX_LINE_LENGTH * 4) return { line: '', tooLong: true, changed: true };
  // A multi-line paste runs the first non-empty line only, like a shell would run line by line.
  const firstLine = raw.split(/\r\n|\n|\r/).find((l) => l.trim().length > 0) ?? '';
  let line = firstLine.replace(ANSI, '').replace(/\t/g, ' ').replace(CONTROL, '').replace(INVISIBLE, '');
  line = line.normalize('NFC').trim();
  if (line.length > MAX_LINE_LENGTH) return { line: '', tooLong: true, changed: true };
  return { line, tooLong: false, changed: line !== raw.trim() };
}

/** Strip anything that should never reach the screen from scripted or generated output. */
export function sanitizeOutput(text: string): string {
  const clean = text.replace(ANSI, '').replace(CONTROL, '').replace(INVISIBLE, '');
  return clean.length > MAX_OUTPUT_LINE ? `${clean.slice(0, MAX_OUTPUT_LINE - 1)}…` : clean;
}
