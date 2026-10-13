// @vitest-environment jsdom
/**
 * The `agent-session` widget in the DOM: a keyboard-only run of the first scenario, where focus goes when a
 * prompt appears and when it is answered, that the buttons name the tool, that one polite live region carries
 * the announcements, what the widget reports to the lesson engine, and "Show me".
 *
 * The rules of the sessions are in `engine/engine.test.ts`; this file is the wiring. Reduced motion is on
 * for the runs, so every stretch of the session settles at once and the test does not wait on pacing.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageHost, TaskEvent } from '@/learn/stage-api';
import type { WidgetStage } from '@/learn/types';
import type { AgentSessionOutcome } from './engine/types';
import AgentSessionWidget from './index';

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }
  if (!('ResizeObserver' in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom has no layout, so it has no scrolling to do.
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  document.documentElement.dataset.motion = 'reduced';
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  delete document.documentElement.dataset.motion;
  vi.useRealTimers();
});

function mount(props: Record<string, unknown>) {
  const events: TaskEvent[] = [];
  const solver: { run: (() => void | Promise<void>) | null } = { run: null };
  const host: StageHost = {
    emit: (e) => {
      events.push(e);
    },
    registerSolver: (fn) => {
      solver.run = fn;
    },
    unlock: () => {},
  };
  const stage: WidgetStage = { kind: 'widget', id: 'agent-session', props };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <AgentSessionWidget
        stage={stage}
        host={host}
        active
        task={{ kind: 'widget', prompt: 'Run the session.' }}
        stepKey="step"
        compact={false}
      />,
    );
  });
  const el = container;
  const button = (name: RegExp | string) => {
    const found = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => {
      const label = b.getAttribute('aria-label') ?? b.textContent ?? '';
      return typeof name === 'string' ? label.includes(name) : name.test(label);
    });
    if (!found) throw new Error(`no button ${String(name)}`);
    return found;
  };
  return {
    events,
    el,
    text: () => el.textContent ?? '',
    button,
    press: (name: RegExp | string) => {
      const b = button(name);
      act(() => b.click());
    },
    solver: () => solver.run,
    outcomes: () =>
      events
        .filter((e): e is Extract<TaskEvent, { type: 'custom' }> => e.type === 'custom')
        .filter((e) => e.name === 'agent-session-outcome')
        .map((e) => e.data as AgentSessionOutcome),
    count: (type: TaskEvent['type']) => events.filter((e) => e.type === type).length,
    attempts: () => events.filter((e) => e.type === 'custom' && e.name === 'attempt').length,
    prompt: () => el.querySelector<HTMLElement>('fieldset[aria-labelledby]'),
    active: () => document.activeElement,
    live: () => Array.from(el.querySelectorAll('[role="status"]')),
  };
}

describe('the agent-session widget', () => {
  it('shows the intro with the honest labels and starts only when asked', () => {
    const w = mount({ scenario: 'deploy-nginx', policy: 'ask-all' });
    expect(w.text()).toMatch(/Simulation/i);
    expect(w.text()).toMatch(/Scripted agent/i);
    expect(w.text()).toMatch(/script, not an AI model/i);
    expect(w.text()).toContain('Ask before anything that is not a read');
    expect(w.prompt()).toBeNull();
    expect(w.attempts()).toBe(0);
    // A fixed policy offers no choice, so there is no policy radio.
    expect(w.el.querySelectorAll('input[type="radio"]')).toHaveLength(0);
  });

  it('offers the policy as a choice, starting at the recommendation, when the lesson leaves it open', () => {
    const w = mount({ scenario: 'deploy-nginx' });
    const radios = Array.from(w.el.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios.map((r) => r.value)).toEqual(['ask-all', 'ask-spends', 'allow-all']);
    expect(radios.find((r) => r.checked)?.value).toBe('ask-all');
    act(() => radios[2]?.click());
    expect(radios.find((r) => r.checked)?.value).toBe('allow-all');
  });

  it('runs the first scenario from the keyboard: focus goes to the first action, comes back, and ends on the debrief', () => {
    const w = mount({ scenario: 'deploy-nginx', policy: 'ask-all' });
    w.press('Start the session');
    expect(w.attempts()).toBe(1);

    // The plan call: a prompt that names the tool, Refuse first in the document, and focus on it.
    const first = w.prompt();
    expect(first).not.toBeNull();
    expect(first?.textContent).toContain('flux_deploy_app');
    expect(first?.textContent).toContain('Spends FLUX');
    const buttons = Array.from(first?.querySelectorAll('button') ?? []);
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Refuse flux_deploy_app',
      'Approve flux_deploy_app',
    ]);
    expect(w.active()).toBe(buttons[0]);
    // Reads ran without a prompt and the transcript says so.
    expect(w.text()).toContain('A read, so it ran without a prompt');

    // Approve the plan. The confirm call asks next, and focus moves to it.
    w.press('Approve flux_deploy_app');
    const second = w.prompt();
    // The call it is about, in the card above the prompt, carries the flag that signs and pays.
    expect(second?.closest('li')?.textContent).toContain('Signs and pays');
    expect(w.active()?.getAttribute('aria-label')).toBe('Refuse flux_deploy_app');

    // Refuse it, then say what to do: the agent plans again with a pinned tag.
    w.press('Refuse flux_deploy_app');
    const reasons = w.prompt();
    expect(reasons?.textContent).toContain('What should the agent do next');
    expect(w.active()?.textContent).toContain('image tag is not pinned');
    w.press(/image tag is not pinned/);
    expect(w.text()).toContain('nginx:1.27');

    // The new plan and the new confirm: approve both.
    w.press('Approve flux_deploy_app');
    w.press('Approve flux_deploy_app');

    // The debrief is up, its title has focus, and the lesson was told once.
    expect(w.prompt()).toBeNull();
    expect(w.text()).toContain('Deployed with a pinned image');
    expect(w.active()?.tagName).toBe('H4');
    expect(w.active()?.textContent).toBe('Deployed with a pinned image');
    expect(w.count('widget-done')).toBe(1);
    const [outcome] = w.outcomes();
    expect(outcome).toMatchObject({
      scenario: 'deploy-nginx',
      policy: 'ask-all',
      ending: 'deployed-pinned',
      goalMet: true,
      refused: ['flux_deploy_app'],
      ranUnasked: [],
      wastedUsd: 0,
      prompts: 4,
    });
    expect(w.outcomes()).toHaveLength(1);
  });

  it('keeps one polite live region and never chats through it', () => {
    const w = mount({ scenario: 'deploy-nginx', policy: 'ask-all' });
    expect(w.live()).toHaveLength(1);
    expect(w.live()[0]?.getAttribute('aria-live')).toBe('polite');
    w.press('Start the session');
    w.press('Approve flux_deploy_app');
    w.press('Refuse flux_deploy_app');
    const said = Array.from(w.live()[0]?.querySelectorAll('p') ?? []).map((p) => p.textContent);
    // Each message is its own element, so one that follows another a moment later does not replace it.
    expect(said).toContain('You approved flux_deploy_app.');
    expect(said).toContain('You refused flux_deploy_app.');
    expect(said.length).toBeLessThanOrEqual(4);
    expect(w.live()).toHaveLength(1);
  });

  it('says out loud, once, that a call ran without asking', () => {
    const w = mount({ scenario: 'poisoned-log', policy: 'ask-spends' });
    w.press('Start the session');
    expect(w.prompt()).toBeNull();
    const said = Array.from(w.live()[0]?.querySelectorAll('p') ?? []).map((p) => p.textContent);
    expect(said.filter((t) => t === 'flux_control_app ran without asking you.')).toHaveLength(1);
    expect(w.text()).toContain('Ran without asking you');
    expect(w.text()).toContain('No prompt appeared');
    // The planted line is explained on the debrief, and only there.
    expect(w.text()).toContain('Where the instruction came from');
    const outcome = w.outcomes()[0];
    expect(outcome).toMatchObject({
      ending: 'app-removed',
      ranUnasked: ['flux_control_app'],
      dataDeleted: true,
    });
    // The goal was not met, so the default goal still completes the step (the debrief is the point).
    expect(w.count('widget-done')).toBe(1);
  });

  it('with goal "safe" a session that ends badly is an attempt, not the end', () => {
    const w = mount({ scenario: 'poisoned-log', policy: 'allow-all', goal: 'safe' });
    w.press('Start the session');
    expect(w.count('widget-done')).toBe(0);
    // One attempt for starting, one for ending without the goal.
    expect(w.attempts()).toBe(2);
    expect(w.outcomes()[0]?.goalMet).toBe(false);
  });

  it('puts the checkout in the learner hands: the Orbit session cannot pay for them under any policy', () => {
    const w = mount({ scenario: 'orbit-repo', policy: 'allow-all', plan: 'pro' });
    w.press('Start the session');
    const prompt = w.prompt();
    expect(prompt?.textContent).toContain('checkout page');
    expect(w.text()).toContain('Documented as');
    expect(w.text()).not.toMatch(/fluxIdPrivateKey|paymentPrivateKey/);
    expect(w.outcomes()).toHaveLength(0);
    w.press('Pay on the checkout page');
    expect(w.text()).toContain('Deployed, paid on the checkout page');
    // Registering and creating the checkout ran without a prompt; the payment was never a tool call.
    expect(w.outcomes()[0]).toMatchObject({
      ending: 'deployed',
      goalMet: true,
      prompts: 0,
      ranUnasked: ['deploy_app', 'create_stripe_checkout'],
    });
  });

  it('shows no key, address or token anywhere on the screen', () => {
    const w = mount({ scenario: 'deploy-nginx', policy: 'allow-all' });
    w.press('Start the session');
    const text = w.text();
    expect(text).toContain('YOUR_FLUX_ID_KEY');
    expect(text).toContain('Placeholder, not a key');
    expect(text).not.toMatch(/\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/);
    expect(text).not.toMatch(/\b[0-9a-fA-F]{40,}\b/);
    expect(text).not.toMatch(/-----BEGIN/);
    expect(text).not.toContain(String.fromCharCode(0x2014));
  });

  it('falls back to the first scenario, and says so, when a lesson names one the widget does not have', () => {
    const w = mount({ scenario: 'nonsense' });
    expect(w.text()).toContain('does not have');
    expect(w.text()).toContain('Deploy a web server');
  });

  it('plays Show me to the end: the shortest path to the goal, and a promise that settles on the debrief', async () => {
    vi.useFakeTimers();
    const w = mount({ scenario: 'deploy-nginx', policy: 'ask-all' });
    const solve = w.solver();
    expect(solve).not.toBeNull();
    let settled = false;
    act(() => {
      void Promise.resolve(solve?.()).then(() => {
        settled = true;
      });
    });
    // It starts a fresh session by itself and makes the choices with a beat between them.
    for (let i = 0; i < 12 && w.count('widget-done') === 0; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
    }
    expect(w.text()).toContain('Deployed with a pinned image');
    expect(w.count('widget-done')).toBe(1);
    await act(async () => {
      await Promise.resolve();
    });
    expect(settled).toBe(true);
    // The validator's lines come from the linter, which is fetched when the session ends, so they follow the
    // debrief by a moment. The path pinned the image, so the finding reads as fixed.
    await vi.waitFor(() => expect(w.text()).toContain('What the validator said that this session is about'));
    expect(w.text()).toContain('Fixed at your request');
    // Refuse the plan, ask for a pinned tag, approve the new plan and the new confirm: three prompted calls.
    expect(w.outcomes()[0]).toMatchObject({
      ending: 'deployed-pinned',
      goalMet: true,
      refused: ['flux_deploy_app'],
      prompts: 3,
    });
  });
});
