// @vitest-environment jsdom
/**
 * The `orbit-planner` widget in the DOM: every price it shows is the engine's (`orbitPlanQuoteUsd`), the
 * table and the rates say which day they were read, a Custom size is priced by the same formula, the button
 * builder shows the engine's own refusals and builds the engine's link, and the goal is reported once and
 * only after the learner has acted (or "Show me" has).
 *
 * The pure rules are in `logic.test.ts`; this file is the wiring.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BAKED_PRICING,
  deployToFluxUrl,
  ORBIT_PLANS,
  ORBIT_READ_ON,
  orbitPlanQuoteUsd,
  tryDeployToFluxUrl,
} from '@shared/flux';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { StageHost, TaskEvent } from '@/learn/stage-api';
import type { WidgetStage } from '@/learn/types';
import OrbitPlanner from './index';
import { atSize, type Goal, planOf, priceOf, type Size, STANDARD_PLAN, sizeOf, solveCustom } from './logic';

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
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
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
  const stage: WidgetStage = { kind: 'widget', id: 'orbit-planner', props };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <OrbitPlanner
        stage={stage}
        host={host}
        active
        task={{ kind: 'widget', prompt: 'Do the thing.' }}
        stepKey="step"
        compact={false}
      />,
    );
  });
  const el = container;
  return {
    events,
    text: () => el.textContent ?? '',
    price: () => el.querySelector('[data-testid="formula-price"]')?.textContent ?? '',
    radio: (value: string) => {
      const r = el.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);
      if (!r) throw new Error(`no radio ${value}`);
      return r;
    },
    choose: (value: string) => {
      const r = el.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);
      if (!r) throw new Error(`no radio ${value}`);
      act(() => r.click());
    },
    show: () => {
      const run = solver.run;
      if (!run) throw new Error('the widget registered no solver');
      act(() => {
        void run();
      });
    },
    hasSolver: () => solver.run !== null,
    fields: () => Array.from(el.querySelectorAll<HTMLInputElement>('input:not([type="radio"])')),
    type: (index: number, value: string) => {
      const input = Array.from(el.querySelectorAll<HTMLInputElement>('input:not([type="radio"])'))[index];
      if (!input) throw new Error(`no text field ${index}`);
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      act(() => {
        set?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    },
    select: (value: string) => {
      const sel = el.querySelector<HTMLSelectElement>('select');
      if (!sel) throw new Error('no select');
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      act(() => {
        set?.call(sel, value);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    },
    link: () => el.querySelector<HTMLAnchorElement>('section[aria-label="The link"] a'),
    codeBlocks: () => Array.from(el.querySelectorAll('pre')).map((p) => p.textContent ?? ''),
  };
}

const usd = (n: number): string => `$${n.toFixed(2)}`;

describe('the plans view', () => {
  it('shows each plan card and its detail at the engine price', () => {
    const w = mount({ view: 'plans' });
    for (const plan of ORBIT_PLANS) {
      w.choose(plan.id);
      expect(w.price()).toBe(usd(orbitPlanQuoteUsd(plan, BAKED_PRICING.params)));
      // The card the learner clicked says the same figure, and the page's own figure sits beside it.
      const label = w.radio(plan.id).closest('label')?.textContent ?? '';
      expect(label).toContain(usd(orbitPlanQuoteUsd(plan, BAKED_PRICING.params)));
      expect(w.text()).toContain(`The plan page says ${usd(plan.usd)}`);
      expect(w.text()).toContain('Same number');
    }
  });

  it('starts on the plan the lesson names', () => {
    expect(mount({ view: 'plans', plan: 'pro' }).radio('pro').checked).toBe(true);
  });

  it('says that the table is BAKED, and dates both the table and the rates', () => {
    const w = mount({ view: 'plans' });
    expect(w.text()).toMatch(/baked/i);
    expect(w.text()).toContain(`as read on ${ORBIT_READ_ON}`);
    expect(w.text()).toContain(`rates read on ${BAKED_PRICING.capturedAt}`);
  });

  it('says what a size means when its node restarts, from the plan and not from a number of its own', () => {
    const w = mount({ view: 'plans' });
    w.choose('starter');
    expect(w.text()).toContain('One instance');
    expect(w.text()).toContain('brief downtime may occur if its node restarts');
    w.choose('standard');
    expect(w.text()).toContain('2 instances');
    expect(w.text()).toContain('failover');
    // Never a share of single-instance apps that are down: the retired statistic.
    expect(w.text()).not.toMatch(/(percent|%) of (the )?(one|single)[- ]instance/i);
  });

  it('lists the spec Orbit registers for the plan, with the Orbit image and the plan size', () => {
    const w = mount({ view: 'plans', plan: 'standard' });
    const spec = w.codeBlocks().find((c) => c.includes('runonflux/orbit:latest')) ?? '';
    expect(spec).toContain('"cpu": 1.5');
    expect(spec).toContain('"ram": 4000');
    expect(spec).toContain('"hdd": 15');
    expect(spec).toContain('"instances": 2');
    expect(spec).toContain('GIT_REPO_URL=');
  });

  it('prices a Custom size by the formula, and states that the page gives no price for one', () => {
    const w = mount({ view: 'plans', plan: 'standard' });
    w.choose('custom');
    expect(w.text()).toContain('states no price for a size');
    expect(w.text()).toContain('not a quote from Orbit');
    // Custom starts from the plan the learner was looking at: the same size, so the same price.
    expect(w.price()).toBe(usd(orbitPlanQuoteUsd(STANDARD_PLAN, BAKED_PRICING.params)));
  });

  describe('with a Custom goal', () => {
    const goal: Goal = { kind: 'custom', minInstances: 2, cheaperThan: 'standard' };

    it('is not done on arrival, and says what the goal is in the engine numbers', () => {
      const w = mount({ view: 'plans', plan: 'standard', goal });
      expect(w.events).toEqual([]);
      expect(w.text()).toContain('Goal not met');
      expect(w.text()).toContain(`prices below Standard (${usd(priceOf(STANDARD_PLAN))})`);
      expect(w.hasSolver()).toBe(true);
    });

    it('does not report done for a plan card alone', () => {
      const w = mount({ view: 'plans', plan: 'standard', goal });
      w.choose('starter');
      w.choose('pro');
      expect(w.events.filter((e) => e.type === 'widget-done')).toEqual([]);
    });

    it('"Show me" picks a Custom size the formula prices below Standard, and the widget reports it once', () => {
      const w = mount({ view: 'plans', plan: 'standard', goal });
      w.show();
      expect(w.radio('custom').checked).toBe(true);
      const solved = solveCustom(goal, sizeOf(STANDARD_PLAN)) as Size;
      expect(solved).not.toBeNull();
      expect(solved.instances).toBeGreaterThanOrEqual(2);
      const shown = usd(priceOf(atSize(STANDARD_PLAN, solved)));
      expect(w.price()).toBe(shown);
      // The same number from the engine entry point the lesson quotes.
      expect(Number(shown.slice(1))).toBe(
        orbitPlanQuoteUsd(
          { ...STANDARD_PLAN, vcores: solved.vcores, ramMb: solved.ramMb, storageGb: solved.storageGb },
          BAKED_PRICING.params,
          { instances: solved.instances },
        ),
      );
      expect(Number(shown.slice(1))).toBeLessThan(priceOf(STANDARD_PLAN));
      expect(w.text()).toContain('Goal met');
      expect(w.events.filter((e) => e.type === 'widget-done')).toHaveLength(1);
    });
  });

  it('without a goal is an exploration: it reports done on the first choice', () => {
    const w = mount({ view: 'plans' });
    expect(w.events).toEqual([]);
    w.choose('pro');
    expect(w.events.filter((e) => e.type === 'widget-done')).toHaveLength(1);
    w.choose('starter');
    expect(w.events.filter((e) => e.type === 'widget-done')).toHaveLength(1);
  });

  it('gives every plan a name the engine knows, so the cards cannot drift from the catalogue', () => {
    const w = mount({ view: 'plans' });
    for (const plan of ORBIT_PLANS) {
      expect(planOf(plan.id)?.name).toBe(plan.name);
      expect(w.radio(plan.id).closest('label')?.textContent).toContain(plan.name);
    }
    expect(w.radio('custom').closest('label')?.textContent).toContain('from $0.99');
  });
});

describe('the button view', () => {
  const expected = {
    repo: 'https://github.com/acme/shop',
    branch: 'release',
    projectPath: 'services/api',
    plan: 'standard',
  };
  const planted = {
    repo: 'git@github.com:acme/shop.git',
    branch: 'release',
    projectPath: '/services/api',
    plan: 'free',
  };

  it('shows the engine message for each refused value, and no link', () => {
    const w = mount({ view: 'button', goal: { kind: 'url', expected }, draft: planted });
    expect(w.text()).toContain('3 values are refused');
    const repoMessage = tryDeployToFluxUrl({ repo: planted.repo });
    const pathMessage = tryDeployToFluxUrl({ repo: expected.repo, projectPath: planted.projectPath });
    expect(repoMessage.ok).toBe(false);
    expect(pathMessage.ok).toBe(false);
    if (!repoMessage.ok) expect(w.text()).toContain(repoMessage.message);
    if (!pathMessage.ok) expect(w.text()).toContain(pathMessage.message);
    expect(w.link()).toBeNull();
    expect(w.events).toEqual([]);
  });

  it('builds the engine link once every value is accepted, and opens it in a new tab', () => {
    const w = mount({ view: 'button', goal: { kind: 'url', expected }, draft: planted });
    w.show();
    const url = deployToFluxUrl(expected);
    expect(w.codeBlocks().some((c) => c.includes(url))).toBe(true);
    expect(w.link()?.getAttribute('href')).toBe(url);
    expect(w.link()?.getAttribute('target')).toBe('_blank');
    expect(w.link()?.getAttribute('rel')).toContain('noopener');
    expect(w.text()).toContain('Goal met');
    expect(w.events.filter((e) => e.type === 'widget-done')).toHaveLength(1);
  });

  it('says that the format is BAKED, and dates it', () => {
    const w = mount({ view: 'button' });
    expect(w.text()).toMatch(/baked/i);
    expect(w.text()).toContain(`Format read ${ORBIT_READ_ON}`);
  });

  it('says plainly that the link opens a form and deploys nothing', () => {
    const w = mount({ view: 'button', goal: { kind: 'url', expected }, draft: planted });
    expect(w.text()).toContain('does not deploy anything by itself');
  });

  it('accepts typing: a valid repository alone gives a link, an empty one is refused', () => {
    const w = mount({ view: 'button' });
    expect(w.link()).toBeNull();
    w.type(0, 'https://github.com/acme/shop');
    expect(w.link()?.getAttribute('href')).toBe(deployToFluxUrl({ repo: 'https://github.com/acme/shop' }));
    w.type(0, '');
    expect(w.link()).toBeNull();
  });

  it('accepts the three plan values and the older one only with a warning to write the new one', () => {
    const w = mount({ view: 'button', draft: { repo: 'https://github.com/acme/shop' } });
    for (const plan of ['starter', 'standard', 'pro']) {
      w.select(plan);
      expect(w.link()?.getAttribute('href')).toContain(`plan=${plan}`);
    }
    w.select('free');
    expect(w.link()).toBeNull();
    expect(w.text()).toContain('write starter in a new one');
  });

  it('treats an accepted link that is not the asked one as an attempt, once, after a pause', () => {
    vi.useFakeTimers();
    const w = mount({ view: 'button', goal: { kind: 'url', expected }, draft: planted });
    w.type(0, expected.repo);
    w.type(2, expected.projectPath);
    w.select('pro');
    expect(w.text()).toContain('differs in the plan');
    expect(w.events.filter((e) => e.type === 'widget-done')).toEqual([]);
    expect(w.events.filter((e) => e.type === 'custom')).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    const attempts = w.events.filter((e) => e.type === 'custom' && e.name === 'attempt');
    expect(attempts).toHaveLength(1);
    // The same draft again does not repeat it.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(w.events.filter((e) => e.type === 'custom' && e.name === 'attempt')).toHaveLength(1);
    // And the asked-for plan finishes the step.
    w.select('standard');
    expect(w.events.filter((e) => e.type === 'widget-done')).toHaveLength(1);
  });

  it('folds a trailing .git and a trailing slash when it grades, and does not rewrite what was typed', () => {
    const w = mount({ view: 'button', goal: { kind: 'url', expected } });
    w.type(0, 'https://github.com/acme/shop.git');
    w.type(1, 'release');
    w.type(2, 'services/api/');
    w.select('standard');
    expect(w.fields()[0]?.value).toBe('https://github.com/acme/shop.git');
    expect(w.events.filter((e) => e.type === 'widget-done')).toHaveLength(1);
  });
});

describe('the style sheet', () => {
  // The tests run from web/ (`npm --prefix web test`), so the path is relative to it.
  const css = readFileSync(
    join(process.cwd(), 'src/learn/widgets/orbit-planner/OrbitPlanner.module.css'),
    'utf8',
  );

  it('uses tokens only: no hex colour, and no tier colour for a state', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/--(cumulus|nimbus|stratus)/);
  });

  it('has a reduced-motion twin for the only transition it has', () => {
    expect(css).toContain('transition:');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('data-motion="reduced"');
  });
});
