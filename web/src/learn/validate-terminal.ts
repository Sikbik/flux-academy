/**
 * Terminal script rules of the lesson validator. Pure.
 *
 * The terminal engine matches input against each command's `match` in order, first match wins, against
 * the whole trimmed line. These rules prove a script can be finished: every regex compiles, every goal is
 * carried by some command, and the command's own `example` reaches that command (not an earlier one).
 */

import { compileRegex } from './checks';
import type { TerminalScript } from './types';
import type { Collector } from './validate-core';

/** Number of capture groups in a regular expression source, or -1 when it does not compile. */
export function captureGroups(source: string): number {
  if (!compileRegex(source)) return -1;
  try {
    const m = new RegExp(`${source}|`).exec('');
    return m ? m.length - 1 : 0;
  } catch {
    return -1;
  }
}

function anchored(source: string): RegExp | null {
  try {
    return new RegExp(`^(?:${source})$`);
  } catch {
    return null;
  }
}

/** Which command (index) the engine would run for `input`, using whole-line matching, or -1. */
export function firstMatch(script: TerminalScript, input: string): number {
  const line = input.trim();
  for (let i = 0; i < script.commands.length; i += 1) {
    const re = anchored(script.commands[i]?.match ?? '');
    if (re?.test(line)) return i;
  }
  return -1;
}

/** Same, with a partial (unanchored) test: what an engine that does not anchor would do. */
function firstMatchLoose(script: TerminalScript, input: string): number {
  const line = input.trim();
  for (let i = 0; i < script.commands.length; i += 1) {
    const re = compileRegex(script.commands[i]?.match ?? '');
    if (re?.test(line)) return i;
  }
  return -1;
}

export function validateScript(script: TerminalScript, path: string, out: Collector): void {
  if (!script.id || script.id.trim() === '') out.error('script-id', `${path}.id`, 'The script needs an id.');
  if (!Array.isArray(script.commands) || script.commands.length === 0) {
    out.error('script-commands', `${path}.commands`, 'A terminal script needs at least one command.');
    return;
  }
  if (!Array.isArray(script.goals) || script.goals.length === 0) {
    out.error('script-goals', `${path}.goals`, 'A terminal script needs at least one goal.');
  }

  const goalIds = new Set<string>();
  for (const [i, g] of (script.goals ?? []).entries()) {
    if (!g.id || g.id.trim() === '') {
      out.error('goal-id', `${path}.goals[${i}].id`, 'A goal needs an id.');
      continue;
    }
    if (goalIds.has(g.id))
      out.error('goal-duplicate', `${path}.goals[${i}]`, `Goal id "${g.id}" is used twice.`);
    goalIds.add(g.id);
  }

  const carried = new Set<string>();
  script.commands.forEach((cmd, i) => {
    const p = `${path}.commands[${i}]`;
    const re = compileRegex(cmd.match);
    if (!re) {
      out.error(
        'command-regex',
        `${p}.match`,
        `The pattern /${cmd.match}/ does not compile as a regular expression.`,
      );
      return;
    }
    if (!cmd.match.startsWith('^') || !cmd.match.endsWith('$')) {
      out.warn(
        'command-unanchored',
        `${p}.match`,
        `/${cmd.match}/ is not anchored. Input is matched against the whole line: write ^...$ so it cannot also match longer commands.`,
      );
    }
    if (cmd.goal !== undefined) {
      if (!goalIds.has(cmd.goal)) {
        out.error('command-goal', `${p}.goal`, `Goal "${cmd.goal}" is not declared in the script's goals.`);
      } else {
        carried.add(cmd.goal);
      }
    }
    const groups = captureGroups(cmd.match);
    const used = new Set<number>();
    for (const line of cmd.output ?? []) {
      for (const m of line.matchAll(/\{(\d+)\}/g)) used.add(Number(m[1]));
    }
    for (const n of used) {
      if (n > groups) {
        out.warn(
          'command-placeholder',
          `${p}.output`,
          `Output uses {${n}} but the pattern has ${groups} capture group${groups === 1 ? '' : 's'}.`,
        );
      }
    }
    if (cmd.example !== undefined) {
      const whole = anchored(cmd.match);
      if (!whole?.test(cmd.example.trim())) {
        out.error(
          'command-example',
          `${p}.example`,
          `The example "${cmd.example}" does not match the command's own pattern as a whole line.`,
        );
      } else {
        const hit = firstMatch(script, cmd.example);
        if (hit !== i) {
          out.error(
            'command-shadowed',
            `${p}.example`,
            `The example "${cmd.example}" is handled by command ${hit} first (first match wins). Reorder the commands or tighten the earlier pattern.`,
          );
        } else {
          const loose = firstMatchLoose(script, cmd.example);
          if (loose !== i) {
            out.warn(
              'command-shadowed-loose',
              `${p}.example`,
              `If the pattern of command ${loose} is matched as a substring, it also catches "${cmd.example}". Anchor patterns with ^ and $.`,
            );
          }
        }
      }
    } else if (cmd.goal !== undefined) {
      out.warn(
        'command-no-example',
        p,
        `The command completes goal "${cmd.goal}" but has no \`example\`: hints, completion and "Show me" have nothing to type.`,
      );
    }
  });

  for (const g of goalIds) {
    if (!carried.has(g)) {
      out.error(
        'goal-unreachable',
        `${path}.goals`,
        `Goal "${g}" is not completed by any command. Add \`goal: '${g}'\` to the command that completes it.`,
      );
    }
  }
}
