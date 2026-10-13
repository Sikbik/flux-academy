/**
 * Every terminal script the lessons ship, run through the real engine: the lesson validator's rules hold,
 * every regex is one the engine can run safely, and each script can be finished by typing its own
 * examples. The authors of those scripts own them; this test is how the terminal owner finds out when a
 * pattern uses something the engine cannot run.
 */

import { describe, expect, it } from 'vitest';
import { Collector } from '@/learn/validate-core';
import { firstMatch, validateScript } from '@/learn/validate-terminal';
import { CommandPattern } from './engine/regex';
import { createSession } from './engine/session';
import { FIXED_NOW } from './engine/testkit';
import type { TerminalScript } from './engine/types';

const modules = import.meta.glob<Record<string, unknown>>('/src/content/terminals/*.ts', { eager: true });

function isScript(v: unknown): v is TerminalScript {
  const s = v as Partial<TerminalScript> | null;
  return (
    !!s &&
    typeof s === 'object' &&
    typeof s.id === 'string' &&
    Array.isArray(s.commands) &&
    Array.isArray(s.goals)
  );
}

const scripts: { file: string; name: string; script: TerminalScript }[] = [];
for (const [path, mod] of Object.entries(modules)) {
  for (const [name, value] of Object.entries(mod)) {
    if (isScript(value)) scripts.push({ file: path.split('/').pop() ?? path, name, script: value });
  }
}

describe('lesson terminal scripts', () => {
  it('found some', () => {
    expect(scripts.length).toBeGreaterThan(0);
  });

  describe.each(scripts.map((s) => [`${s.file}:${s.name}`, s.script] as const))('%s', (_label, script) => {
    it('passes the lesson validator without errors', () => {
      const c = new Collector();
      validateScript(script, script.id, c);
      const errors = c.problems.filter((p) => p.severity === 'error');
      expect(errors, errors.map((e) => `${e.code} ${e.path}: ${e.message}`).join('\n')).toEqual([]);
    });

    it('has every pattern running on the built-in engine, or a safe native one', () => {
      for (const [i, cmd] of script.commands.entries()) {
        const p = new CommandPattern(cmd.match);
        expect(p.usable, `command ${i}: ${cmd.match} (${p.problem ?? ''})`).toBe(true);
      }
    });

    it('reaches each example through its own command', () => {
      for (const [i, cmd] of script.commands.entries()) {
        if (cmd.example === undefined) continue;
        expect(firstMatch(script, cmd.example), `command ${i}: ${cmd.example}`).toBe(i);
      }
    });

    it('can be finished by typing its own examples', () => {
      const s = createSession({ script, instant: true, now: () => FIXED_NOW });
      const typed: string[] = [];
      for (let guard = 0; guard < 60 && !s.getState().allDone; guard += 1) {
        const step = s.plan()[0];
        if (!step) break;
        typed.push(step.line);
        s.submit(step.line);
      }
      expect(s.getState().allDone, `typed: ${typed.join(' | ')}`).toBe(true);
    });
  });
});
