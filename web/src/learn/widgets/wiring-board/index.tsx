/**
 * Widget `wiring-board` (docs/CONTENT.md section 5): connect the components of an app and decide which of
 * them is public. Every connection shows what it produces: the container name the callee answers to on the
 * app's private network (`flux<component>_<app>`, FACTS 8.2) and the environment variable lines the caller
 * gets. A database or cache with a public port is flagged.
 *
 * Props (`stage.props`), both shapes work:
 *   components  ['web', 'api', 'cache'] or [{ id, label?, kind?: 'web' | 'api' | 'db' | 'cache' }]
 *   goal        { links: [['web', 'api'], ['api', 'cache']], public: ['web'] } or [{ from, to }]
 *   expose      the components that must have a public port (when not in `goal`)
 *   app         the app name used in the host names (default `store`)
 *
 * Done when the connection set equals the goal and, where the goal names it, the published set equals it.
 * It reports `widget-done` only after the learner has changed something. "Show me" wires the goal.
 *
 * Ways in: drag from one component's Connect button to another card; or press Connect on a component and
 * then Connect on the one it calls (arrow keys move between the buttons, Escape cancels); or the list under
 * the board, which also has a form that connects by name.
 */

import { type PointerEvent, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { StageHost, WidgetComponent } from '@/learn/stage-api';
import { Button, Chip, Glyph, type GlyphName, Panel, Select, Switch } from '@/ui';
import {
  addLink,
  type BoardConfig,
  type ComponentKind,
  chainSolution,
  containerPortOf,
  diffGoal,
  envLines,
  hasLink,
  hostName,
  isSolved,
  KIND_LABEL,
  type Link,
  laneReserve,
  linkKey,
  networkName,
  publicPortFor,
  type Rect,
  readConfig,
  removeLink,
  routeLinks,
  solution,
  toggleExposed,
  warnings,
} from './logic';
import styles from './WiringBoard.module.css';

const KIND_GLYPH: Record<ComponentKind, GlyphName> = {
  web: 'globe',
  api: 'route',
  db: 'volume',
  cache: 'layers',
};

/** Width one card needs in a row, and the gap between cards. Below this the cards stack. */
const CARD_MIN = 168;
const CARD_GAP = 28;

interface Drag {
  from: string;
  pid: number;
  x0: number;
  y0: number;
  moving: boolean;
}

function sameRects(a: Record<string, Rect>, b: Record<string, Rect>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => {
    const x = a[k];
    const y = b[k];
    return Boolean(x && y && x.x === y.x && x.y === y.y && x.w === y.w && x.h === y.h);
  });
}

function sentenceList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

interface BoardProps {
  config: BoardConfig;
  host: StageHost;
}

function Board({ config, host }: BoardProps) {
  const { app, components, goal } = config;
  const ids = useMemo(() => components.map((c) => c.id), [components]);
  const byId = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);
  const name = (id: string): string => byId.get(id)?.label ?? id;

  const [links, setLinks] = useState<Link[]>([]);
  const [exposed, setExposed] = useState<string[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState('');
  const [fromSel, setFromSel] = useState(ids[0] ?? '');
  const [toSel, setToSel] = useState(ids[1] ?? '');

  const boardRef = useRef<HTMLDivElement>(null);
  const tempRef = useRef<SVGPathElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const uid = useId();

  // ---- geometry: where the cards are, so the arrows can be drawn between them ---------------------
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [boardW, setBoardW] = useState(0);
  const count = components.length;
  const layout: 'row' | 'column' = boardW >= count * CARD_MIN + (count - 1) * CARD_GAP ? 'row' : 'column';

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the layout or the cards change
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => {
      const b = board.getBoundingClientRect();
      const next: Record<string, Rect> = {};
      for (const el of board.querySelectorAll<HTMLElement>('[data-node]')) {
        const id = el.dataset.node;
        if (!id) continue;
        const r = el.getBoundingClientRect();
        next[id] = {
          x: Math.round(r.left - b.left),
          y: Math.round(r.top - b.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      }
      setBoardW(Math.round(b.width));
      setRects((prev) => (sameRects(prev, next) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    for (const el of board.querySelectorAll('[data-node]')) ro.observe(el);
    return () => ro.disconnect();
  }, [components, layout]);

  const routes = useMemo(() => routeLinks(rects, ids, links), [rects, ids, links]);
  const lane = laneReserve(count);

  // ---- state changes ---------------------------------------------------------------------------
  const announce = (text: string) => setMessage(text);

  const connect = (from: string, to: string) => {
    if (from === to) return;
    setTouched(true);
    if (hasLink(links, from, to)) {
      announce(`${name(from)} already calls ${name(to)}.`);
      return;
    }
    setLinks(addLink(links, from, to));
    announce(`Connected: ${name(from)} calls ${name(to)}. It reaches it at ${hostName(to, app)}.`);
  };

  const disconnect = (from: string, to: string) => {
    setTouched(true);
    setLinks(removeLink(links, from, to));
    announce(`Removed the connection from ${name(from)} to ${name(to)}.`);
  };

  const togglePublic = (id: string) => {
    setTouched(true);
    const was = exposed.includes(id);
    setExposed(toggleExposed(exposed, id));
    announce(was ? `${name(id)} has no public port now.` : `${name(id)} has a public port now.`);
  };

  const press = (id: string) => {
    if (armed === null) {
      setArmed(id);
      announce(`Connecting from ${name(id)}. Press Connect on the component it calls. Escape cancels.`);
      return;
    }
    if (armed === id) {
      setArmed(null);
      announce('Cancelled.');
      return;
    }
    connect(armed, id);
    setArmed(null);
  };

  // ---- dragging from a Connect button ------------------------------------------------------------
  const clearDrag = () => {
    drag.current = null;
    tempRef.current?.setAttribute('d', '');
    setOver(null);
  };

  const nodeAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-node]');
    return el?.dataset.node ?? null;
  };

  const onPointerDown = (id: string) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    drag.current = { from: id, pid: e.pointerId, x0: e.clientX, y0: e.clientY, moving: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId) return;
    if (!d.moving) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
      d.moving = true;
      setArmed(d.from);
    }
    const board = boardRef.current;
    const from = rects[d.from];
    if (board && from) {
      const b = board.getBoundingClientRect();
      const sx = from.x + from.w / 2;
      const sy = from.y + from.h / 2;
      tempRef.current?.setAttribute(
        'd',
        `M${sx} ${sy}L${Math.round(e.clientX - b.left)} ${Math.round(e.clientY - b.top)}`,
      );
    }
    const under = nodeAt(e.clientX, e.clientY);
    setOver((cur) => (cur === under ? cur : under));
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId) return;
    const under = nodeAt(e.clientX, e.clientY);
    clearDrag();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (!d.moving) return; // a plain press: the click that follows does the work
    // A drag ends with a click on the button as well; swallow it.
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    setArmed(null);
    if (under && under !== d.from) connect(d.from, under);
    else announce('Cancelled. Drop on another component to connect.');
  };

  const onPointerCancel = () => {
    if (drag.current?.moving) setArmed(null);
    clearDrag();
  };

  const onClick = (id: string) => () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    press(id);
  };

  const onKeyDown = (id: string) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const i = ids.indexOf(id);
    const move = (to: number) => {
      const target = ids[(to + ids.length) % ids.length];
      if (target) buttons.current.get(target)?.focus();
      e.preventDefault();
    };
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(i - 1);
  };

  const onBoardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && armed !== null) {
      setArmed(null);
      announce('Cancelled.');
    }
  };

  // ---- results ----------------------------------------------------------------------------------
  const state = { links, exposed };
  const diff = goal ? diffGoal(goal, state) : null;
  const flagged = warnings(exposed, components, app);
  const solved = goal ? isSolved(goal, state) : links.length > 0 && flagged.length === 0;

  const reported = useRef(false);
  useEffect(() => {
    if (!touched || !solved) {
      if (!solved) reported.current = false;
      return;
    }
    if (reported.current) return;
    reported.current = true;
    host.emit({ type: 'widget-done' });
  }, [touched, solved, host]);

  useEffect(() => {
    host.registerSolver(() => {
      const s = goal ? solution(goal) : chainSolution(components);
      setLinks(s.links);
      setExposed(s.exposed);
      setArmed(null);
      setTouched(true);
      setMessage('Wired as planned.');
    });
    return () => host.registerSolver(null);
  }, [host, goal, components]);

  const goalItems: { key: string; ok: boolean; text: string }[] = [];
  if (goal) {
    for (const g of goal.links) {
      goalItems.push({
        key: linkKey(g),
        ok: hasLink(links, g.from, g.to),
        text: `${name(g.from)} calls ${name(g.to)}`,
      });
    }
    if (goal.expose !== null) {
      const want = goal.expose;
      const ok = want.length === exposed.length && want.every((w) => exposed.includes(w));
      let text = 'No component has a public port';
      if (want.length === 1) text = `Only ${name(want[0] ?? '')} has a public port`;
      else if (want.length > 1) text = `Only ${sentenceList(want.map(name))} have public ports`;
      goalItems.push({ key: 'public', ok, text });
    }
  }

  const problems: string[] = [];
  if (diff && touched) {
    for (const l of diff.reversed) {
      problems.push(
        `${name(l.from)} to ${name(l.to)} points the wrong way. Draw the connection from the component that makes the request.`,
      );
    }
    for (const l of diff.extra) {
      problems.push(`${name(l.from)} to ${name(l.to)} is not part of this design.`);
    }
    for (const id of diff.overpublished) {
      problems.push(`${name(id)} should not have a public port in this design.`);
    }
  }

  const armedName = armed ? name(armed) : '';

  return (
    <Panel variant="glass" padding="md" container className={styles.root} contentClassName={styles.content}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Wiring board</p>
        <p className={styles.appLine}>
          App <code>{app}</code>
          <span aria-hidden="true"> · </span>
          <span className={styles.network}>
            network <code>{networkName(app)}</code>
          </span>
        </p>
      </div>

      <p className={styles.help}>
        Press <strong>Connect</strong> on a component, then <strong>Connect</strong> on the one it calls, or
        drag from one button to another card. Each card has a switch for its public port.
      </p>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: Escape cancels a connection in progress */}
      <div
        ref={boardRef}
        className={styles.board}
        data-layout={layout}
        data-dragging={armed !== null ? 'true' : undefined}
        style={{ '--lane': `${lane}px`, '--n': count } as React.CSSProperties}
        onKeyDown={onBoardKeyDown}
      >
        <svg className={styles.links} aria-hidden="true" focusable="false">
          {routes.map((r) => (
            <g key={r.key} className={styles.link} data-ok={solved ? 'true' : undefined}>
              <path className={styles.line} d={r.d} pathLength={1} />
              <path className={styles.arrow} d={r.head} pathLength={1} />
            </g>
          ))}
          <path ref={tempRef} className={styles.temp} d="" />
        </svg>

        <ul className={styles.nodes} aria-label="Components">
          {components.map((c, i) => {
            const isPublic = exposed.includes(c.id);
            const isArmed = armed === c.id;
            const target = armed !== null && !isArmed;
            const warn = flagged.some((w) => w.id === c.id);
            const port = publicPortFor(c.id, exposed, components);
            const cport = containerPortOf(c.kind);
            let label = `Connect from ${c.label}`;
            let accessible = `Connect from ${c.label}, then choose the component it calls`;
            if (isArmed) {
              label = 'Cancel';
              accessible = `Cancel connecting from ${c.label}`;
            } else if (target) {
              label = `Connect to ${c.label}`;
              accessible = `Connect to ${c.label} from ${armedName}`;
            }
            return (
              <li
                key={c.id}
                className={styles.node}
                data-node={c.id}
                data-kind={c.kind}
                data-state={isArmed ? 'source' : target ? 'target' : 'idle'}
                data-over={over === c.id && over !== armed ? 'true' : undefined}
                data-public={isPublic ? 'true' : undefined}
                data-warn={warn ? 'true' : undefined}
                style={{ '--i': i } as React.CSSProperties}
              >
                <div className={styles.card}>
                  <div className={styles.body}>
                    <div className={styles.top}>
                      <span className={styles.glyph} aria-hidden="true">
                        <Glyph name={KIND_GLYPH[c.kind]} size={18} />
                      </span>
                      <span className={styles.label}>{c.label}</span>
                      <Chip size="sm">{KIND_LABEL[c.kind]}</Chip>
                    </div>
                    <code className={styles.hostName} title="Its name on the app's private network">
                      {hostName(c.id, app)}
                    </code>
                    <p className={styles.ports}>
                      {isPublic ? (
                        <>
                          <span className={styles.portsKey}>ports</span> [{port}]{' '}
                          <span className={styles.portsKey}>containerPorts</span> [{cport}]
                        </>
                      ) : (
                        <>
                          <span className={styles.portsKey}>ports</span> {'[], reached by name only'}
                        </>
                      )}
                    </p>
                    <Switch size="sm" checked={isPublic} onCheckedChange={() => togglePublic(c.id)}>
                      Public port
                    </Switch>
                    {warn ? (
                      <p className={styles.flag}>
                        <Glyph name="status-warn" size={14} /> Open to the internet
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) buttons.current.set(c.id, el);
                      else buttons.current.delete(c.id);
                    }}
                    className={styles.connect}
                    aria-label={accessible}
                    aria-pressed={isArmed}
                    data-role={isArmed ? 'cancel' : target ? 'target' : 'start'}
                    onPointerDown={onPointerDown(c.id)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onClick={onClick(c.id)}
                    onKeyDown={onKeyDown(c.id)}
                  >
                    <Glyph name={isArmed ? 'close' : 'link'} size={14} />
                    <span className={styles.connectText}>{label}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className={styles.status} role="status" aria-live="polite" data-empty={message ? undefined : 'true'}>
        {message || 'Nothing connected yet.'}
      </p>

      {flagged.length > 0 ? (
        <ul className={styles.warnings} aria-label="Warnings">
          {flagged.map((w) => (
            <li key={w.id}>
              <Glyph name="status-warn" size={16} />
              <span>{w.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {goal ? (
        <section
          className={styles.goal}
          aria-labelledby={`${uid}-goal`}
          data-met={solved ? 'true' : undefined}
        >
          <div className={styles.goalHead}>
            <h3 id={`${uid}-goal`} className={styles.h}>
              The design
            </h3>
            {solved ? (
              <Chip kind="status" status="ok" size="sm">
                Wired
              </Chip>
            ) : (
              <Chip kind="status" status="pending" size="sm">
                {goalItems.filter((g) => g.ok).length} of {goalItems.length}
              </Chip>
            )}
          </div>
          <ul className={styles.goalList}>
            {goalItems.map((g) => (
              <li key={g.key} data-ok={g.ok ? 'true' : undefined}>
                <Glyph name={g.ok ? 'status-ok' : 'status-off'} size={16} />
                <span>{g.text}</span>
                <span className="sr-only">{g.ok ? ', done' : ', not yet'}</span>
              </li>
            ))}
          </ul>
          {problems.length > 0 ? (
            <ul className={styles.problems}>
              {problems.map((p) => (
                <li key={p}>
                  <Glyph name="status-warn" size={14} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {solved ? (
            <p className={styles.done}>
              Every call goes by container name, on the container port, over the private network. Only the
              components with a public port can be reached from outside.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className={styles.conns} aria-labelledby={`${uid}-conns`}>
        <h3 id={`${uid}-conns`} className={styles.h}>
          Connections
        </h3>
        {links.length === 0 ? (
          <p className={styles.none}>
            No connections yet. Each one you make shows the name and the variable it gives.
          </p>
        ) : (
          <ul className={styles.connList}>
            {links.map((l) => {
              const lines = envLines(l, components, app);
              return (
                <li key={linkKey(l)} className={styles.conn}>
                  <div className={styles.connHead}>
                    <span className={styles.connPair}>
                      <strong>{name(l.from)}</strong>
                      <Glyph name="arrow-right" size={14} />
                      <strong>{name(l.to)}</strong>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="trash"
                      aria-label={`Remove the connection from ${name(l.from)} to ${name(l.to)}`}
                      onClick={() => disconnect(l.from, l.to)}
                    >
                      Remove
                    </Button>
                  </div>
                  <p className={styles.connWhy}>
                    <code>{name(l.from)}</code> reaches <code>{name(l.to)}</code> at{' '}
                    <code>{hostName(l.to, app)}</code>, on its container port.
                  </p>
                  <div className={styles.env}>
                    <span className={styles.envHead}>
                      environmentParameters of <code>{name(l.from)}</code>
                    </span>
                    {lines.map((line) => (
                      <code key={line} className={styles.envLine}>
                        {line}
                      </code>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {links.length > 0 ? (
          <p className={styles.note}>
            The variable names are your choice. Flux provides the container name, and the container port is
            the one in the callee's spec.
          </p>
        ) : null}

        <details className={styles.byName}>
          <summary>Connect by name</summary>
          <form
            className={styles.byNameForm}
            onSubmit={(e) => {
              e.preventDefault();
              connect(fromSel, toSel);
            }}
          >
            <Select
              label="From"
              size="md"
              value={fromSel}
              onValueChange={setFromSel}
              options={components.map((c) => ({ value: c.id, label: c.label }))}
            />
            <Select
              label="Calls"
              size="md"
              value={toSel}
              onValueChange={setToSel}
              options={components.map((c) => ({ value: c.id, label: c.label }))}
            />
            <Button type="submit" size="md" icon="plus" disabled={fromSel === toSel}>
              Connect
            </Button>
          </form>
        </details>
      </section>
    </Panel>
  );
}

const WiringBoard: WidgetComponent = ({ stage, host, stepKey }) => {
  const config = useMemo(() => readConfig(stage.props), [stage.props]);
  // A new step, or a lesson that changes the goal, starts the board over.
  const signature = useMemo(() => JSON.stringify(config), [config]);
  return <Board key={`${stepKey}:${signature}`} config={config} host={host} />;
};

export default WiringBoard;
