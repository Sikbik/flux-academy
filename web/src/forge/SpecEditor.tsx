/**
 * The Spec Forge editor: a form, the JSON, the price and the issues of one Flux app spec, bound together.
 *
 *   <SpecEditor initial={{ name: 'my-app', instances: 3 }} onChange={({ spec, lint, quote }) => ... } />
 *
 * Props
 *   initial      A full or partial spec. It is merged over `defaultSpec()` and normalised, exactly as a lesson
 *                stage's `spec` is, so a lesson, "Show me" and the tests all start from the same spec.
 *   resetKey     Changing it puts the editor back to `initial` and clears undo history.
 *   editable     JSON paths the learner may change (`compose[0].ports`, `compose[*].cpu`). Omit for all of
 *                them; `[]` makes it read only. Locked fields are shown, with a lock, not hidden. The JSON
 *                panel enforces the same list: a text edit to a locked path is put back. The form sections
 *                that hold an editable field open on their own, so list only what the step needs.
 *   focus        Fields to annotate: `{ path, note }`, note in lesson markup. Drawn as numbered callouts on
 *                the field (the ports table answers for `containerPorts` and `domains` too) and in the
 *                JSON gutter. The sections that hold them open, and the form scrolls to the first one.
 *   show         Panels to draw, any subset of 'form' | 'json' | 'price' | 'issues'. Default all four.
 *   onChange     Called after every change (and once on mount) with `{ spec, lint, quote, origin, changed }`.
 *                `origin` says what caused it (`init` and `reset` are set-up, `form`, `json`, `apply` and the
 *                rest are edits). Lint is the teaching lint (`{ teaching: true }`), the one the lesson
 *                validator uses, over the raw JSON so dropped and unknown keys are reported.
 *   compact      Denser spacing for a short stage area.
 *   readOnly     Nothing can be changed (the same as `editable: []`).
 *   lintContext  Extra context for the linter (live node count, taken names).
 *   pricing      `live` (default) prices at the network's current rates and offers "Verify with Flux".
 *                `baked` uses the built-in rates, the ones lesson text and lesson checks use, and leaves
 *                verification out. Lessons use `baked`.
 *   onAchievement Called once per achievement id the learner earns here (`three-is-company`,
 *                `spec-whisperer`, `penny-pincher`). Presets, imports and "Show me" never earn one.
 *
 * Imperative handle (`ref`)
 *   apply(partial, from?)  Apply a partial spec the way "Show me" does (not limited by `editable`): over the
 *                    current spec, or over `from` when the learner's edits would stand in its way.
 *   reset(spec?)     Back to `initial` (or to `spec`).
 *   getState()       `{ spec, lint, quote, origin, changed }` right now.
 *   getSession()     The framework-free session, for hosts that need more (import, presets, share links).
 *   undo() redo() jumpTo(path) showInJson(path) verify() focusSearch()
 *   addComponent({ private?, focus? })  The form's "Add component" and "Add private component". A private
 *                    component has no public port, no domain and no port row at all, for a database or a
 *                    cache. Returns its index, or null when the step locks `compose` or the app is full.
 *
 * Keyboard (focus anywhere in the editor, outside a text field)
 *   Ctrl+Z / Ctrl+Shift+Z undo and redo, Ctrl+Enter verify the price, `/` find a field, `n` then `c` add a
 *   component, `n` then `p` add a private component. The field search also adds one: type "private".
 */

import { LIMITS } from '@shared/flux/spec';
import type { FluxAppSpec, LintReport, Quote } from '@shared/flux/types';
import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { DeepPartial } from '@/learn/types';
import { Glyph, Panel, TabPanel, Tabs, useElementSize, useReducedMotion } from '@/ui';
import { CostReactor } from './CostReactor';
import { type ComponentVariant, type EditOptions, ForgeContext, type ForgeUi } from './context';
import { type RatesMode, useForgeSession, useSnapshot, useVerify } from './hooks';
import { indexIssues, summarize } from './issues';
import {
  AchievementTracker,
  addComponent as addComponentOp,
  addPrivateComponent,
  ancestors,
  type ChangeOrigin,
  componentIndexOf,
  type ForgeSession,
  fieldPathOf,
  isEnterprisePlaceholder,
  type LintContext,
  sectionsOf,
  setExpireMonths,
  specFromPartial,
  totals,
} from './model';
import { BLOCKS_PER_MONTH } from './model/ops';
import { PlacementPreview } from './PlacementPreview';
import { FormPanel } from './panels/FormPanel';
import { IssuesPanel } from './panels/IssuesPanel';
import { JsonPanel } from './panels/JsonPanel';
import type { JsonEditorHandle } from './panels/json/JsonEditor';
import styles from './SpecEditor.module.css';

export type ForgePanel = 'form' | 'json' | 'price' | 'issues';

const ORDER: readonly ForgePanel[] = ['form', 'json', 'issues', 'price'];

export interface ForgeState {
  spec: FluxAppSpec;
  lint: LintReport;
  quote: Quote;
  /** What caused this state: `init` and `reset` are the editor being set up, the rest are edits. */
  origin: ChangeOrigin;
  /** JSON paths this change touched. */
  changed: readonly string[];
}

export interface SpecEditorProps {
  initial?: DeepPartial<FluxAppSpec> | FluxAppSpec | null;
  resetKey?: string | number;
  editable?: readonly string[];
  focus?: readonly { path: string; note: string }[];
  show?: readonly ForgePanel[];
  onChange?: (state: ForgeState) => void;
  compact?: boolean;
  className?: string;
  readOnly?: boolean;
  lintContext?: LintContext;
  onAchievement?: (id: string) => void;
  /**
   * `live` prices at the network's current rates. `baked` uses the built-in rates, the ones lesson text and
   * lesson checks use, and leaves out "Verify with Flux". Default `live`.
   */
  pricing?: RatesMode;
  ref?: Ref<SpecEditorHandle>;
}

export interface SpecEditorHandle {
  apply(partial: DeepPartial<FluxAppSpec>, from?: DeepPartial<FluxAppSpec> | FluxAppSpec): void;
  reset(spec?: DeepPartial<FluxAppSpec> | FluxAppSpec): void;
  getState(): ForgeState;
  getSession(): ForgeSession;
  undo(): boolean;
  redo(): boolean;
  jumpTo(path: string): void;
  showInJson(path: string): void;
  verify(): void;
  focusSearch(): void;
  /**
   * Add a component the way the form's buttons do: `{ private: true }` has no public port and no domain.
   * Returns the new component's index, or null when the step locks the components or the app is full.
   */
  addComponent(options?: { private?: boolean; focus?: boolean }): number | null;
}

const TITLES: Record<ForgePanel, string> = {
  form: 'Form',
  json: 'JSON',
  issues: 'Issues',
  price: 'Price',
};

const ICONS: Record<ForgePanel, 'sliders' | 'code' | 'status-warn' | 'price'> = {
  form: 'sliders',
  json: 'code',
  issues: 'status-warn',
  price: 'price',
};

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (t as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color', 'image'].includes(
      type,
    );
  }
  return false;
}

function Region({
  id,
  title,
  meta,
  children,
  bare,
}: {
  id: ForgePanel;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  bare?: boolean;
}) {
  return (
    <Panel
      as="section"
      variant="slab"
      size="sm"
      padding="none"
      marks={false}
      pattern="none"
      className={styles.region}
      contentClassName={styles.regionContent}
      data-region={id}
      aria-label={title}
    >
      <header className={styles.regionHead}>
        <Glyph name={ICONS[id]} size={15} />
        <h2 className={styles.regionTitle}>{title}</h2>
        {meta ? <span className={styles.regionMeta}>{meta}</span> : null}
      </header>
      <div className={bare ? styles.regionBodyBare : styles.regionBody} data-region-body={id}>
        {children}
      </div>
    </Panel>
  );
}

export function SpecEditor({
  initial,
  resetKey,
  editable,
  focus,
  show,
  onChange,
  compact = false,
  className,
  readOnly = false,
  lintContext,
  onAchievement,
  pricing = 'live',
  ref,
}: SpecEditorProps) {
  const session = useForgeSession({ initial, resetKey, editable, readOnly, lintContext, pricing });
  const snap = useSnapshot(session);
  const reduced = useReducedMotion();

  const root = useRef<HTMLDivElement>(null);
  const jsonRef = useRef<JsonEditorHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { width } = useElementSize(root);

  const panels = useMemo<ForgePanel[]>(() => {
    const wanted = show && show.length > 0 ? show : ORDER;
    return ORDER.filter((p) => wanted.includes(p));
  }, [show]);

  // ---- derived views --------------------------------------------------------------------------
  const issues = useMemo(
    () => indexIssues(snap.lint, { enterprisePlaceholder: isEnterprisePlaceholder(snap.spec.enterprise) }),
    [snap.lint, snap.spec.enterprise],
  );
  const focusNotes = useMemo(
    () =>
      (focus ?? []).map((f, i) => ({ path: f.path, formPath: fieldPathOf(f.path), note: f.note, n: i + 1 })),
    [focus],
  );
  const appTotals = useMemo(() => totals(snap.spec), [snap.spec]);

  // ---- which section of the form is open ------------------------------------------------------------
  // What a lesson points at or lets the learner change is open: the sections holding its notes and the
  // sections holding editable fields. With neither, the app and the first component are.
  const componentCount = useRef(snap.spec.compose.length);
  componentCount.current = snap.spec.compose.length;
  const wantedSections = useCallback((): string[] => {
    // A note on `compose` itself sits by the add buttons, not inside any component.
    const ids = new Set<string>(
      sectionsOf(
        focusNotes.filter((n) => n.formPath !== 'compose').map((n) => n.path),
        componentCount.current,
      ),
    );
    if (editable) for (const id of sectionsOf(editable, componentCount.current)) ids.add(id);
    if (ids.size === 0) {
      ids.add('app');
      if (!compact) ids.add('c0');
    }
    return [...ids];
  }, [focusNotes, editable, compact]);
  const [open, setOpen] = useState<string[]>(wantedSections);
  const [tab, setTab] = useState<ForgePanel>(panels[0] ?? 'form');
  const [status, setStatus] = useState('');

  // A lesson that moves its notes or its editable fields opens the sections they are in. Sections the
  // learner opened stay open.
  const sectionKey = `${focusNotes.map((n) => n.path).join('|')}::${editable ? editable.join('|') : '*'}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the set of paths matters
  useEffect(() => {
    const wanted = wantedSections();
    setOpen((cur) => {
      const next = new Set(cur);
      for (const id of wanted) next.add(id);
      return next.size === cur.length ? cur : [...next];
    });
  }, [sectionKey]);

  // Entering a step that points at fields, or locks most of the form, should show those fields and not a
  // screenful of locked ones above them. Scrolls the form's own body (never the page) and only when the
  // field is not already in view. Runs when the lesson's notes or editable set changes, not on edits.
  const hasLessonFocus = focusNotes.length > 0 || editable !== undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the set of paths matters
  useEffect(() => {
    if (!hasLessonFocus) return;
    const bring = () => {
      const body = root.current?.querySelector<HTMLElement>('[data-region-body="form"]');
      if (!body || body.clientHeight === 0) return;
      const noted = body.querySelector<HTMLElement>('[role="note"]')?.closest<HTMLElement>('[data-field]');
      const field =
        noted ?? body.querySelector<HTMLElement>('[data-field]:not([data-locked="true"])') ?? null;
      if (!field) return;
      const box = body.getBoundingClientRect();
      const at = field.getBoundingClientRect();
      if (at.top >= box.top && at.bottom <= box.bottom) return;
      body.scrollTo({ top: Math.max(0, body.scrollTop + (at.top - box.top) - 12), behavior: 'auto' });
    };
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(bring);
    });
    // Sections open with a short animation and mount their fields lazily: look again once they have.
    const later = window.setTimeout(bring, 380);
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.clearTimeout(later);
    };
  }, [sectionKey]);

  useEffect(() => {
    if (!panels.includes(tab)) setTab(panels[0] ?? 'form');
  }, [panels, tab]);

  // ---- the price, confirmed by Flux on request ---------------------------------------------------------
  const verify = useVerify(snap.spec);
  const [auto, setAuto] = useState(false);
  const verifyRun = verify.run;
  const specKey = snap.revision;
  // biome-ignore lint/correctness/useExhaustiveDependencies: debounce on every spec change while auto is on
  useEffect(() => {
    if (!auto) return;
    if (verify.state.backoff) {
      setAuto(false);
      return;
    }
    const t = window.setTimeout(verifyRun, 1100);
    return () => window.clearTimeout(t);
  }, [auto, specKey]);

  // ---- change and achievement notifications ---------------------------------------------------------------
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onAchievementRef = useRef(onAchievement);
  onAchievementRef.current = onAchievement;
  const tracker = useRef<AchievementTracker | null>(null);
  tracker.current ??= new AchievementTracker((id) => onAchievementRef.current?.(id));

  // The revision is the identity of "something changed"; the rest of the snapshot is read through it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    tracker.current?.observe({
      origin: snap.origin,
      spec: snap.spec,
      lint: { valid: issues.valid, errors: issues.errors },
      quote: { usdPerMonth: snap.quote.usdPerMonth },
      changed: snap.changed,
    });
    onChangeRef.current?.({
      spec: snap.spec,
      lint: snap.lint,
      quote: snap.quote,
      origin: snap.origin,
      changed: snap.changed,
    });
  }, [snap.revision]);

  // ---- navigation ----------------------------------------------------------------------------------------
  const sayTimer = useRef(0);
  const say = useCallback((message: string) => {
    setStatus(message);
    window.clearTimeout(sayTimer.current);
    sayTimer.current = window.setTimeout(() => setStatus(''), 4000);
  }, []);
  useEffect(() => () => window.clearTimeout(sayTimer.current), []);

  const afterFrames = useCallback((fn: () => void) => {
    requestAnimationFrame(() => requestAnimationFrame(fn));
  }, []);

  const jumpTo = useCallback(
    (path: string) => {
      const c = componentIndexOf(path);
      const section = c === null ? 'app' : `c${c}`;
      setOpen((cur) => (cur.includes(section) ? cur : [...cur, section]));
      if (panels.includes('form')) setTab('form');
      afterFrames(() => {
        const el = root.current;
        if (!el) return;
        const exact = el.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
        let field: HTMLElement | null = exact?.closest<HTMLElement>('[data-field]') ?? null;
        let target: HTMLElement | null = exact;
        if (!target) {
          // The closest field that covers it: `compose[0].ports[1]` falls back to the ports table, and so
          // do the container ports and domains it shows beside it.
          for (const candidate of [fieldPathOf(path), ...ancestors(path)]) {
            field = el.querySelector<HTMLElement>(`[data-field="${CSS.escape(candidate)}"]`);
            if (field) break;
          }
          target = field?.querySelector<HTMLElement>('input, textarea, button, [role="slider"]') ?? field;
        }
        if (!target) return;
        target.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
        target.focus({ preventScroll: true });
        field?.setAttribute('data-flash', 'true');
        window.setTimeout(() => field?.removeAttribute('data-flash'), 1400);
      });
    },
    [panels, reduced, afterFrames],
  );

  const showInJson = useCallback(
    (path: string) => {
      if (panels.includes('json')) setTab('json');
      afterFrames(() => jsonRef.current?.reveal(path));
    },
    [panels, afterFrames],
  );

  const edit = useCallback(
    (
      paths: string | readonly string[],
      fn: (spec: FluxAppSpec) => FluxAppSpec,
      opts: EditOptions = {},
    ): boolean => {
      const list = typeof paths === 'string' ? [paths] : [...paths];
      return session.edit(list, fn, {
        key: opts.key === undefined ? (list[0] ?? null) : opts.key,
        label: opts.label,
        origin: opts.origin ?? 'form',
      });
    },
    [session],
  );

  const addComponent = useCallback(
    (variant: ComponentVariant, opts: { focus?: boolean } = {}): number | null => {
      const index = session.getSnapshot().spec.compose.length;
      const what = variant === 'private' ? 'private component' : 'component';
      if (!session.canEdit('compose')) {
        say('The components are locked in this step.');
        return null;
      }
      if (index >= LIMITS.component.max) {
        say(`An app has at most ${LIMITS.component.max} components.`);
        return null;
      }
      const ok = edit(
        'compose',
        (s) => (variant === 'private' ? addPrivateComponent(s) : addComponentOp(s)),
        { key: null, label: `Add a ${what}` },
      );
      if (!ok) {
        say('Fix the JSON first, then add a component.');
        return null;
      }
      setOpen((cur) => (cur.includes(`c${index}`) ? cur : [...cur, `c${index}`]));
      say(`Added a ${what}.`);
      if (opts.focus) jumpTo(`compose[${index}].name`);
      else {
        // Out of sight at the end of a long list is no use: bring the new section into view, without
        // taking the focus. Its body mounts and opens with a short animation, so look once it has.
        window.setTimeout(() => {
          const field = root.current?.querySelector<HTMLElement>(
            `[data-field="${CSS.escape(`compose[${index}].name`)}"]`,
          );
          field?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
        }, 160);
      }
      return index;
    },
    [session, edit, say, jumpTo, reduced],
  );

  // ---- the imperative handle -----------------------------------------------------------------------------
  useImperativeHandle(
    ref,
    () => ({
      apply: (partial, from) => session.apply(partial, from),
      reset: (spec) => session.reset(specFromPartial(spec ?? initial)),
      getState: () => {
        const s = session.getSnapshot();
        return { spec: s.spec, lint: s.lint, quote: s.quote, origin: s.origin, changed: s.changed };
      },
      getSession: () => session,
      undo: () => session.undo(),
      redo: () => session.redo(),
      jumpTo,
      showInJson,
      verify: () => {
        if (pricing === 'live') verifyRun();
      },
      focusSearch: () => {
        if (panels.includes('form')) setTab('form');
        afterFrames(() => searchRef.current?.focus());
      },
      addComponent: (options) =>
        addComponent(options?.private ? 'private' : 'public', { focus: options?.focus }),
    }),
    [session, initial, jumpTo, showInJson, verifyRun, panels, afterFrames, pricing, addComponent],
  );

  // ---- keyboard ----------------------------------------------------------------------------------------------
  // `n` then `c` adds a component and `n` then `p` a private one, within a second and outside a text field.
  const chord = useRef(0);
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const plain = !mod && !e.altKey && !e.shiftKey && !e.nativeEvent.isComposing;
    if (plain && panels.includes('form') && !isTypingTarget(e.target)) {
      const armed = chord.current > 0 && Date.now() - chord.current < 1200;
      chord.current = 0;
      if (armed && (key === 'c' || key === 'p')) {
        e.preventDefault();
        e.stopPropagation();
        addComponent(key === 'p' ? 'private' : 'public', { focus: true });
        return;
      }
      if (key === 'n') {
        // Armed here, so a page that listens for the same chord (the lab) does not arm a second one.
        e.stopPropagation();
        chord.current = Date.now();
        return;
      }
    }
    if (mod && key === 'z' && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) session.redo();
      else session.undo();
    } else if (mod && key === 'y' && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      session.redo();
    } else if (mod && key === 'enter') {
      e.preventDefault();
      e.stopPropagation();
      if (pricing === 'live') verifyRun();
    } else if (e.key === '/' && !mod && !e.altKey && !isTypingTarget(e.target) && panels.includes('form')) {
      e.preventDefault();
      if (panels.includes('form')) setTab('form');
      afterFrames(() => searchRef.current?.focus());
    }
  };

  // ---- the context ------------------------------------------------------------------------------------------------
  const ui = useMemo<ForgeUi>(
    () => ({
      session,
      snap,
      issues,
      focusNotes,
      params: snap.pricing.params,
      compact,
      paused: snap.text.error !== null,
      canEdit: (path) => session.canEdit(path),
      edit,
      addComponent,
      jumpTo,
      showInJson,
      say,
    }),
    [session, snap, issues, focusNotes, compact, edit, addComponent, jumpTo, showInJson, say],
  );

  // ---- the regions --------------------------------------------------------------------------------------------------
  const n = snap.spec.compose.length;
  const regions: Record<ForgePanel, ReactNode> = {
    form: (
      <Region id="form" title="Form" meta={`${n} ${n === 1 ? 'component' : 'components'}`}>
        <FormPanel open={open} onOpenChange={setOpen} searchRef={searchRef} />
      </Region>
    ),
    json: (
      <Region id="json" title="JSON" bare>
        <JsonPanel editorRef={jsonRef} />
      </Region>
    ),
    issues: (
      <Region id="issues" title="Issues" meta={summarize(issues)}>
        <IssuesPanel />
      </Region>
    ),
    price: (
      <Region id="price" title="Price" meta={`$${snap.quote.usdPerMonth.toFixed(2)} a month`}>
        <div className={styles.priceStack}>
          <CostReactor
            spec={snap.spec}
            quote={snap.quote}
            pricing={snap.pricing}
            ratesMode={pricing}
            verify={
              pricing === 'live'
                ? { state: verify.state, current: verify.current, run: verify.run, auto, onAuto: setAuto }
                : undefined
            }
            instancesLocked={!session.canEdit('instances')}
            expireLocked={!session.canEdit('expire')}
            onInstances={(count) =>
              edit('instances', (s) => ({ ...s, instances: count }), { key: null, label: 'Set instances' })
            }
            onExpire={(blocks) =>
              edit('expire', (s) => setExpireMonths(s, blocks / BLOCKS_PER_MONTH), {
                key: null,
                label: 'Set the subscription length',
              })
            }
          />
          <PlacementPreview
            geolocation={snap.spec.geolocation}
            instances={snap.spec.instances}
            totals={appTotals}
            seed={snap.spec.name}
          />
        </div>
      </Region>
    ),
  };

  // ---- layout --------------------------------------------------------------------------------------------------------
  const wide = width >= 900;
  const medium = width >= 600 && width < 900;
  const mode: 'single' | 'columns' | 'split' | 'tabs' =
    panels.length === 1
      ? 'single'
      : width === 0
        ? 'columns'
        : wide || (panels.length === 2 && width >= 560)
          ? 'columns'
          : medium && panels.length >= 3 && panels.includes('form')
            ? 'split'
            : 'tabs';

  const tabItems = panels.map((p) => ({
    value: p,
    label: TITLES[p],
    icon: ICONS[p],
    count:
      p === 'issues' && issues.errors + issues.warnings > 0 ? issues.errors + issues.warnings : undefined,
  }));

  let body: ReactNode;
  if (mode === 'single') {
    body = <div className={styles.single}>{regions[panels[0] as ForgePanel]}</div>;
  } else if (mode === 'tabs') {
    body = (
      <div className={styles.tabs}>
        <Tabs
          idBase="forge"
          aria-label="Spec forge panels"
          items={tabItems}
          value={tab}
          onValueChange={(v) => setTab(v as ForgePanel)}
          size="sm"
          fullWidth
        >
          {panels.map((p) => (
            <TabPanel key={p} value={p} keepMounted className={styles.tabPanel}>
              {regions[p]}
            </TabPanel>
          ))}
        </Tabs>
      </div>
    );
  } else if (mode === 'split') {
    const rest: ForgePanel[] = panels.filter((p) => p !== 'form');
    const current = rest.includes(tab) ? tab : (rest[0] as ForgePanel);
    body = (
      <div className={styles.split}>
        <div className={styles.slot}>{regions.form}</div>
        <div className={styles.slot}>
          <Tabs
            idBase="forge-rest"
            aria-label="Spec forge panels"
            items={tabItems.filter((i) => i.value !== 'form')}
            value={current}
            onValueChange={(v) => setTab(v as ForgePanel)}
            size="sm"
            fullWidth
          >
            {rest.map((p) => (
              <TabPanel key={p} value={p} keepMounted className={styles.tabPanel}>
                {regions[p]}
              </TabPanel>
            ))}
          </Tabs>
        </div>
      </div>
    );
  } else {
    const slots: ForgePanel[][] = [
      panels.filter((p) => p === 'form'),
      panels.filter((p) => p === 'json' || p === 'issues'),
      panels.filter((p) => p === 'price'),
    ].filter((s) => s.length > 0);
    body = (
      <div className={styles.columns} data-count={slots.length}>
        {slots.map((slot) => (
          <div
            key={slot.join('+')}
            className={styles.slot}
            data-stacked={slot.length > 1 ? 'true' : undefined}
          >
            {slot.map((p) => (
              <div className={styles.cell} key={p} data-panel={p}>
                {regions[p]}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ForgeContext.Provider value={ui}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: shortcuts for everything inside the editor */}
      <div
        ref={root}
        className={`${styles.editor}${className ? ` ${className}` : ''}`}
        data-compact={compact ? 'true' : undefined}
        data-mode={mode}
        data-issues={issues.errors + issues.warnings === 0 ? 'clean' : 'open'}
        onKeyDown={onKeyDown}
      >
        {body}
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>
        {status ? (
          <p className={styles.status} aria-hidden="true">
            <Glyph name="info" size={14} />
            {status}
          </p>
        ) : null}
      </div>
    </ForgeContext.Provider>
  );
}
