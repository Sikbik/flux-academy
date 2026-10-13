// @vitest-environment jsdom
/**
 * The troubleshooting page in a router: the front door, a stage, a problem with its causes and evidence,
 * the search (words, a code, a pasted error), the two reference lists and the way out.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ERROR_STRINGS,
  FACTS_DATE,
  FLUXOS_VERSION,
  SECTION_15_DATE,
  STAGES,
  SYMPTOMS,
} from '@/content/troubleshoot';
import { Glyph } from '@/ui';
import Troubleshoot from './index';

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
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  try {
    window.sessionStorage.clear();
  } catch {
    // no storage in this environment
  }
});

function render(url: string): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<MemoryRouter initialEntries={[url]}>{<Troubleshoot />}</MemoryRouter>));
  return container;
}

/** Shows where the router is, so a test can see the address follow the search box. */
function Where() {
  const l = useLocation();
  return <output data-where="">{`${l.pathname}${l.search}${l.hash}`}</output>;
}

function renderWithAddress(url: string): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root?.render(
      <MemoryRouter initialEntries={[url]}>
        <Troubleshoot />
        <Where />
      </MemoryRouter>,
    ),
  );
  return container;
}

function type(el: HTMLElement, value: string) {
  const input = el.querySelector('input[type="search"]') as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('the front door', () => {
  it('has one h1, a stage card for every stage and the two tools', () => {
    const el = render('/troubleshoot');
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    for (const s of STAGES) {
      expect(el.querySelector(`a[href="/troubleshoot#stage-${s.id}"]`), s.id).not.toBeNull();
    }
    expect(el.querySelector('a[href="/troubleshoot#messages"]')).not.toBeNull();
    expect(el.querySelector('a[href="/troubleshoot#codes"]')).not.toBeNull();
  });

  it('ends with the way out, naming only the Flux Discord and the docs', () => {
    const el = render('/troubleshoot');
    const section = el.querySelector('#still-stuck') as HTMLElement;
    expect(section.textContent).toContain('Still stuck?');
    const hrefs = Array.from(section.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['https://discord.com/invite/runonflux', 'https://docs.runonflux.com']);
  });

  it('says how many problems each stage holds', () => {
    const el = render('/troubleshoot');
    const total = SYMPTOMS.length;
    const counted = Array.from(el.querySelectorAll('a[href^="/troubleshoot#stage-"]'))
      .map((a) => /(\d+) problems?/.exec(a.textContent ?? '')?.[1])
      .map(Number)
      .reduce((a, b) => a + b, 0);
    expect(counted).toBe(total);
  });
});

describe('a stage', () => {
  it('lists its problems as links', () => {
    const el = render('/troubleshoot#stage-installing');
    const expected = SYMPTOMS.filter((s) => s.stage === 'installing');
    const links = expected.map((s) => el.querySelector(`a[href="/troubleshoot#${s.id}"]`));
    expect(links.every((l) => l !== null)).toBe(true);
    expect(el.querySelector('h2')?.textContent).toBe('Installing');
  });
});

describe('the Git and agent routes', () => {
  it('sits under its own heading after the journey, lettered and not numbered', () => {
    const el = render('/troubleshoot');
    const journey = el.querySelector('h2#ts-stages')?.closest('section') as HTMLElement;
    const routes = el.querySelector('h2#ts-routes')?.closest('section') as HTMLElement;
    expect(routes.querySelector('h2')?.textContent).toBe('Deploying from Git or with an agent?');
    const hrefs = (section: HTMLElement) =>
      Array.from(section.querySelectorAll('a[href^="/troubleshoot#stage-"]')).map((a) =>
        a.getAttribute('href'),
      );
    expect(hrefs(journey)).toHaveLength(7);
    expect(hrefs(routes)).toEqual(['/troubleshoot#stage-git', '/troubleshoot#stage-agents']);
    const cards = Array.from(routes.querySelectorAll('a'));
    expect(cards[0]?.textContent).toMatch(/^ADeploying from Git/);
    expect(cards[1]?.textContent).toMatch(/^BAgents and assistants/);
    // The journey is still numbered from 01, and the routes come after it in the page.
    expect(journey.querySelector('a')?.textContent).toMatch(/^01/);
    expect(journey.compareDocumentPosition(routes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ['git', 'Deploying from Git'],
    ['agents', 'Agents and assistants'],
  ] as const)('lists every problem of the %s stage as a link', (stage, title) => {
    const el = render(`/troubleshoot#stage-${stage}`);
    const expected = SYMPTOMS.filter((s) => s.stage === stage);
    expect(expected.length).toBeGreaterThanOrEqual(14);
    for (const s of expected) {
      expect(el.querySelector(`a[href="/troubleshoot#${s.id}"]`), s.id).not.toBeNull();
    }
    expect(el.querySelector('h2')?.textContent).toBe(title);
  });

  it('says what an agent problem was checked against, and which code its proof was read in', () => {
    const el = render('/troubleshoot#agent-plan-not-deployed');
    const text = el.textContent ?? '';
    expect(text).toContain(`Checked ${SECTION_15_DATE} against the source of the FluxCloud server package`);
    expect(text).not.toContain('against FluxOS');
    // The first cause is open, and its proof says whose source was read.
    expect(text).toContain('Verified in the source of the FluxCloud server package');
    expect(text).toContain('read in the code of the FluxCloud server package or console');
  });

  it('says what a Git problem was checked against, and that Orbit is read from its pages', () => {
    const el = render('/troubleshoot#git-build-failed');
    const text = el.textContent ?? '';
    expect(text).toContain(
      `Checked ${SECTION_15_DATE} against the Orbit page, the Deploy with Git docs and the live app specifications`,
    );
    expect(text).not.toContain('against FluxOS');
    expect(text).toContain('From the official docs, not checked against the source');
  });

  it('keeps the FluxOS wording and the older date on the older problems', () => {
    const el = render('/troubleshoot#app-stuck-installing');
    expect(el.textContent).toContain(`Checked ${FACTS_DATE} against FluxOS ${FLUXOS_VERSION}`);
    expect(el.textContent).not.toContain(SECTION_15_DATE);
  });

  it('dates the evidence line of a cause with the date of its stage, in a problem and in a message', () => {
    // Every cause carries a line, open or not, and every line says the same date.
    const proofDates = (el: HTMLElement) => {
      const found = Array.from(el.querySelectorAll('abbr'))
        .map((a) => a.textContent ?? '')
        .filter((t) => t.startsWith('Checked'));
      expect(found.length).toBeGreaterThan(0);
      return [...new Set(found)];
    };
    const leave = () => {
      act(() => root?.unmount());
      container?.remove();
    };
    expect(proofDates(render('/troubleshoot#agent-plan-not-deployed'))).toEqual([
      `Checked ${SECTION_15_DATE}`,
    ]);
    leave();
    expect(proofDates(render('/troubleshoot#app-stuck-installing'))).toEqual([`Checked ${FACTS_DATE}`]);
    leave();
    // A message that points at a problem of the Git or agent stages carries that stage's date, the others do not.
    expect(proofDates(render('/troubleshoot#message-orbit-deployment-queued'))).toEqual([
      `Checked ${SECTION_15_DATE}`,
    ]);
    leave();
    expect(proofDates(render('/troubleshoot#message-instances-maximum'))).toEqual([`Checked ${FACTS_DATE}`]);
  });

  it('offers the Agent Desk as a way to try the approve-or-refuse step', () => {
    const el = render('/troubleshoot#agent-plan-not-deployed');
    expect(el.textContent).toContain('Try it in the Agent Desk');
    expect(el.querySelector('a[href="/labs/agent-desk"]')).not.toBeNull();
    // The lab is also offered at the foot of the page, among the things to learn.
    const learn = el.querySelector('section[aria-labelledby="ts-learn"]');
    expect(learn?.querySelector('a[href="/labs/agent-desk"]')).not.toBeNull();
  });

  it('draws the Agent Desk with its own glyph, in the step and among the things to learn', () => {
    const el = render('/troubleshoot#agent-plan-not-deployed');
    const own = document.createElement('div');
    own.innerHTML = renderToStaticMarkup(<Glyph name="lab-agent-desk" size={14} />);
    const wanted = own.querySelector('svg')?.innerHTML;
    expect(wanted).toBeTruthy();
    const step = Array.from(el.querySelectorAll('p')).find((p) =>
      p.textContent?.startsWith('Try it in the Agent Desk'),
    );
    expect(step?.querySelector('svg')?.innerHTML).toBe(wanted);
    const chip = el.querySelector('section[aria-labelledby="ts-learn"] a[href="/labs/agent-desk"] svg');
    expect(chip?.innerHTML).toBe(wanted);
  });

  it('puts the likelihood and the evidence beside the cause title and under it, for a narrow row', () => {
    const el = render('/troubleshoot#agent-cannot-connect');
    const headers = Array.from(el.querySelectorAll('[data-accordion-header]'));
    expect(headers.length).toBeGreaterThanOrEqual(5);
    for (const h of headers) {
      // One copy beside the title, one under it for a narrow row (CSS shows one of the two).
      expect(h.querySelectorAll('.sr-only').length, h.textContent ?? '').toBe(2);
      expect(h.textContent).toMatch(/Usual|Common|Possible|Rare/);
    }
  });
});

describe('a problem', () => {
  const symptom = SYMPTOMS.find((s) => s.id === 'app-stuck-installing');

  it('shows the short answer, the causes in order and the evidence on each', () => {
    const el = render('/troubleshoot#app-stuck-installing');
    expect(symptom).toBeDefined();
    expect(el.querySelector('h2#ts-heading')?.textContent).toBe(symptom?.title);
    expect(el.textContent).toContain('The short answer');
    const headers = Array.from(el.querySelectorAll('[data-accordion-header]'));
    expect(headers).toHaveLength(symptom?.causes.length ?? -1);
    // The first cause is open, the rest are closed.
    expect(headers.map((h) => h.getAttribute('aria-expanded'))).toEqual(
      headers.map((_, i) => (i === 0 ? 'true' : 'false')),
    );
    // Every cause header carries its evidence word.
    for (const h of headers) {
      expect(h.textContent).toMatch(/Source|Live|Docs only|Unverified/);
    }
  });

  it('opens the next cause on request', () => {
    const el = render('/troubleshoot#app-stuck-installing');
    const next = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('That is not it, next cause'),
    );
    expect(next).toBeDefined();
    act(() => next?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const headers = Array.from(el.querySelectorAll('[data-accordion-header]'));
    expect(headers[0]?.getAttribute('aria-expanded')).toBe('false');
    expect(headers[1]?.getAttribute('aria-expanded')).toBe('true');
  });

  it('gives a public address with a way to copy it, and fills in the app name from the address bar', () => {
    const el = render('/troubleshoot?app=hello-flux#app-stuck-installing');
    expect(el.textContent).toContain('https://api.runonflux.io/apps/location/hello-flux');
    expect(el.textContent).toContain('Copy');
  });

  it('keeps a placeholder visible when no name is given', () => {
    const el = render('/troubleshoot#app-stuck-installing');
    expect(el.textContent).toContain('https://api.runonflux.io/apps/location/{app}');
    expect(el.textContent).toContain('Add your app name above');
  });

  it('is honest about a cause that is not verified', () => {
    const el = render('/troubleshoot#cloudflare-proxy');
    expect(el.textContent).toContain('Unverified');
    expect(el.textContent).toContain('What we do not know');
  });

  it('shows weaker evidence on the fix itself when the advice is judgement', () => {
    const el = render('/troubleshoot#data-differs-or-missing');
    // The first cause is open: the mechanism is read in source, the advice on which prefix to use is not.
    expect(el.textContent).toContain('Which prefix suits which app is our design judgement');
    expect(el.textContent).toContain('Unverified');
  });

  it('puts a warning about paying twice ahead of the causes', () => {
    const el = render('/troubleshoot#payment-not-recognised');
    const text = el.textContent ?? '';
    const warning = text.indexOf('Before you pay again');
    const causes = text.indexOf('Causes, in the order to check them');
    expect(warning).toBeGreaterThan(-1);
    expect(causes).toBeGreaterThan(warning);
    expect(text).toContain('refunds are not automatic');
  });

  it('says what the page knows and does not know about itself: the order is a judgement', () => {
    const el = render('/troubleshoot#connection-refused');
    expect(el.textContent).toContain('our judgement');
  });
});

describe('the search', () => {
  it('finds a problem by what you would say', () => {
    const el = render('/troubleshoot');
    type(el, 'stuck installing');
    expect(el.querySelector('a[href="/troubleshoot#app-stuck-installing"]')).not.toBeNull();
  });

  it('recognises a lint code', () => {
    const el = render('/troubleshoot');
    type(el, 'PORT_FEE');
    expect(el.textContent).toContain('This looks like');
    expect(el.textContent).toContain('PORT_FEE');
    expect(el.querySelector('a[href^="/labs/spec-forge#s=r."]')).not.toBeNull();
  });

  it('recognises a pasted error message', () => {
    const el = render('/troubleshoot');
    const m = ERROR_STRINGS.find((e) => e.id === 'instances-maximum');
    type(el, `Validation Error: ${m?.text ?? ''} please help`);
    expect(el.textContent).toContain('This looks like');
    expect(el.textContent).toContain('Instances are above 100');
  });

  it('finds the Git and agent problems by what you would say', () => {
    const cases: Array<[string, string]> = [
      ['webhook red cross', 'git-webhook-failing'],
      ['failed to clone repository', 'git-cannot-clone'],
      ['pushed and nothing deployed', 'git-push-no-deploy'],
      ['orbit app is down', 'git-app-went-down'],
      ['confirm true', 'agent-plan-not-deployed'],
      ['agent did not deploy', 'agent-plan-not-deployed'],
      ['assistant did not deploy', 'assistant-did-not-deploy'],
      ['mcp server will not connect', 'agent-cannot-connect'],
      ['paid twice', 'agent-paid-twice'],
      ['keys exposed in chat', 'agent-keys-exposed'],
    ];
    for (const [query, id] of cases) {
      const el = render('/troubleshoot');
      type(el, query);
      const first = el.querySelector(
        'a[href^="/troubleshoot#"][href*="-"]:not([href^="/troubleshoot#stage-"])',
      );
      expect(first?.getAttribute('href'), query).toBe(`/troubleshoot#${id}`);
      act(() => root?.unmount());
      container?.remove();
      root = null;
      container = null;
    }
  });

  it('recognises a pasted message from an agent server', () => {
    const el = render('/troubleshoot');
    type(el, 'GET /mcp answered: this server is stateless, use POST');
    expect(el.textContent).toContain('This looks like');
    expect(el.textContent).toContain('this server is stateless, use POST');
    expect(el.textContent).toContain('Agent server');
  });

  it('says plainly when nothing matches', () => {
    const el = render('/troubleshoot');
    type(el, 'qzxwvv');
    expect(el.textContent).toContain('Nothing matches');
  });

  it('keeps focus in the search while the address catches up with what was typed', () => {
    vi.useFakeTimers();
    try {
      const el = renderWithAddress('/troubleshoot#app-stuck-installing');
      // Arriving on a problem puts focus on its heading, after a short pause.
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(document.activeElement?.id).toBe('ts-heading');

      const input = el.querySelector('input[type="search"]') as HTMLInputElement;
      act(() => input.focus());
      type(el, 'dns');
      // The address catches up after a pause. React runs the effects it causes when the act scope
      // ends, so the pause for a focus move (if there were one) is a second step.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const where = el.querySelector('output[data-where]')?.textContent;
      expect(where).toBe('/troubleshoot?q=dns#app-stuck-installing');
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(document.activeElement).toBe(input);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the lists', () => {
  it('lists every message with the text as written', () => {
    const el = render('/troubleshoot#messages');
    const rows = el.querySelectorAll('[data-accordion-header]');
    expect(rows).toHaveLength(ERROR_STRINGS.length);
    expect(el.textContent).toContain('Maximum number of instances is 100');
  });

  it('lists the Orbit and agent server messages under their own sources', () => {
    const el = render('/troubleshoot#messages');
    const text = el.textContent ?? '';
    expect(text).toContain('Orbit app');
    expect(text).toContain('Agent server');
    expect(text).toContain('Call again with confirm=true to deploy.');
  });

  it('opens one message from a link', () => {
    const el = render('/troubleshoot#message-instances-maximum');
    const open = el.querySelector('[data-accordion-header][aria-expanded="true"]');
    expect(open?.textContent).toContain('Maximum number of instances is 100');
    expect(el.textContent).toContain('What it means');
  });

  it('opens one lint code from a link, with the example in the forge', () => {
    const el = render('/troubleshoot#code-PORT_FEE');
    const open = el.querySelector('[data-accordion-header][aria-expanded="true"]');
    expect(open?.textContent).toContain('PORT_FEE');
    expect(el.querySelector('a[href^="/labs/spec-forge#s=r."]')).not.toBeNull();
  });

  it('says so for a link that matches nothing', () => {
    const el = render('/troubleshoot#no-such-thing');
    expect(el.textContent).toContain('does not match anything here');
  });
});
