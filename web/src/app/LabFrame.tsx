/**
 * The shared lab frame (docs/DESIGN.md section 5.5): a title bar (name, one-line purpose, a "What is
 * this?" popover), the working area, a "Teach me" drawer and a status strip (data freshness, the
 * simulation notice, shortcut hints).
 *
 * Two ways to feed it. The route host (`routes/labs`) wraps every lab in a frame using the curriculum's
 * title and summary, so a lab that only renders its working area already looks complete. A lab refines
 * the frame from inside, with whatever it knows at the time:
 *
 *   export default function NetworkLab() {
 *     const [tier, setTier] = useState<Tier | null>(null);
 *     useLabFrame({
 *       data: ['network', 'geo'],
 *       teach: tier ? TIER_NOTES[tier] : GENERAL_NOTES,   // Markup[]: {{term:id}} and friends work
 *       shortcuts: [{ keys: 'r', label: 'Reset the view' }],
 *     });
 *     return <Bench />;
 *   }
 *
 * `useLabFrame` is a no-op where there is no frame (a lab embedded as a lesson stage), so labs can
 * call it unconditionally. The frame owns the page's single `h1`; a lab must not render another.
 *
 * Honesty: a lab that models something rather than showing it sets `simulation: true`, which shows the
 * SIMULATION chip. A lab that shows live numbers lists the resources in `data`, which shows one honest
 * freshness chip per resource.
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { describeStatus, freshnessKind, type ResourceKey, useDataAge, useDataStore } from '@/data';
import { useHotkey } from '@/system/hotkeys';
import { Drawer, FreshnessChip, Glyph, Kbd, Popover } from '@/ui';
import { InlineMarkup } from './InlineMarkup';
import styles from './LabFrame.module.css';

export interface LabShortcut {
  /** A combo for `Kbd`: `r`, `mod+z`, `g o`. */
  keys: string;
  label: string;
}

/** Content for the Teach me drawer or the What is this popover: markup strings (one per paragraph) or a node. */
export type LabNotes = readonly string[] | ReactNode;

export interface LabFrameConfig {
  /** Shown in the "What is this?" popover. Default: the purpose line. */
  about?: LabNotes;
  /** The Teach me drawer. Omit (or pass an empty array) and the button is hidden. */
  teach?: LabNotes;
  /** Heading of the drawer. Default "Teach me". */
  teachTitle?: string;
  /** True when the lab models the network instead of showing it. Adds the SIMULATION chip and notice. */
  simulation?: boolean;
  /** The live resources the lab shows. One freshness chip each, in the status strip. */
  data?: readonly ResourceKey[];
  /** Hints in the strip. Keep it to the three or four that matter. */
  shortcuts?: readonly LabShortcut[];
  /** One line of lab-specific status ("3 instances placed, 2 healthy"). */
  status?: ReactNode;
  /** Controls for the right side of the title bar (a preset menu, share, undo). */
  actions?: ReactNode;
}

export interface LabFrameProps extends LabFrameConfig {
  /** The lab's name: the page's `h1`. */
  title: string;
  /** One line under the title: what the lab is for. */
  purpose: string;
  /** The lab id (`spec-forge`), for the `data-lab` attribute and tests. */
  labId?: string;
  /** The working area. */
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Dynamic configuration from inside the lab
// ---------------------------------------------------------------------------

interface FrameBus {
  set: (config: LabFrameConfig) => void;
  clear: () => void;
}

const FrameContext = createContext<FrameBus | null>(null);

function sameList(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    // Arrays of strings (notes, data keys) compare by content; arrays of shortcuts by their fields.
    return (
      a.length === b.length &&
      a.every((v, i) => {
        const w = b[i];
        if (Object.is(v, w)) return true;
        if (v && w && typeof v === 'object' && typeof w === 'object') {
          return sameList(Object.values(v), Object.values(w));
        }
        return false;
      })
    );
  }
  return false;
}

/** Whether two configs say the same thing (so a lab that rebuilds its arrays each render does not loop). */
export function sameConfig(a: LabFrameConfig, b: LabFrameConfig): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof LabFrameConfig>;
  for (const k of keys) if (!sameValue(a[k], b[k])) return false;
  return true;
}

/**
 * Refine the surrounding frame from inside a lab. Call it every render with the current values; the frame
 * updates only when something actually changed. Does nothing outside a frame.
 */
export function useLabFrame(config: LabFrameConfig): void {
  const bus = useContext(FrameContext);
  const last = useRef<LabFrameConfig | null>(null);
  useEffect(() => {
    if (!bus) return;
    if (last.current && sameConfig(last.current, config)) return;
    last.current = config;
    bus.set(config);
  });
  useEffect(() => {
    if (!bus) return;
    return () => {
      last.current = null;
      bus.clear();
    };
  }, [bus]);
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const RESOURCE_LABEL: Record<ResourceKey, string> = {
  network: 'Network',
  geo: 'Locations',
  blocks: 'Blocks',
  pricing: 'Pricing',
};

function ResourceChip({ resource }: { resource: ResourceKey }) {
  const status = useDataStore((s) => s[resource].status);
  const meta = useDataStore((s) => s[resource].meta);
  const connection = useDataStore((s) => s.connection);
  const age = useDataAge(resource);
  const chip = describeStatus(status, { meta, ageMs: age, connection });
  return (
    <li className={styles.resource} title={chip.sentence}>
      <span className={styles.resourceName}>{RESOURCE_LABEL[resource]}</span>
      <FreshnessChip kind={freshnessKind(status)} ageMs={age} polling={connection === 'polling'} />
      <span className="sr-only">{chip.sentence}</span>
    </li>
  );
}

function renderNotes(notes: LabNotes | undefined): ReactNode {
  if (notes === undefined || notes === null || notes === false) return null;
  if (Array.isArray(notes)) {
    return (notes as readonly string[]).map((text, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: notes are a static ordered list of paragraphs
      <p key={i}>
        <InlineMarkup text={text} />
      </p>
    ));
  }
  return notes as ReactNode;
}

function hasNotes(notes: LabNotes | undefined): boolean {
  if (notes === undefined || notes === null || notes === false) return false;
  if (Array.isArray(notes)) return notes.length > 0;
  return true;
}

// ---------------------------------------------------------------------------
// The frame
// ---------------------------------------------------------------------------

export function LabFrame({ title, purpose, labId, children, ...base }: LabFrameProps) {
  const [dynamic, setDynamic] = useState<LabFrameConfig>({});
  const bus = useMemo<FrameBus>(
    () => ({
      set: (config) => setDynamic(config),
      clear: () => setDynamic({}),
    }),
    [],
  );
  const config: LabFrameConfig = { ...base, ...dynamic };
  const [teachOpen, setTeachOpen] = useState(false);
  const titleId = useId();
  const stripId = useId();

  const canTeach = hasNotes(config.teach);
  useHotkey({
    id: 'lab.teach',
    keys: 't',
    label: 'Open or close the Teach me notes',
    group: 'Lab',
    // Without notes there is nothing to open, so the key is not advertised either.
    hidden: !canTeach,
    enabled: () => canTeach,
    run: () => {
      setTeachOpen((v) => !v);
    },
  });

  const about = hasNotes(config.about) ? config.about : [purpose];
  const data = config.data ?? [];
  const shortcuts = config.shortcuts ?? [];

  return (
    <FrameContext.Provider value={bus}>
      <section
        className={styles.frame}
        aria-labelledby={titleId}
        data-lab={labId}
        data-simulation={config.simulation ? 'true' : undefined}
      >
        <header className={styles.bar}>
          <div className={styles.titles}>
            <p className={styles.eyebrow}>Lab</p>
            <h1 id={titleId} className={styles.title} tabIndex={-1}>
              {title}
            </h1>
            <p className={styles.purpose}>{purpose}</p>
          </div>
          <div className={styles.tools}>
            <Popover
              title="What is this?"
              placement="bottom"
              width={340}
              content={<div className={styles.notes}>{renderNotes(about)}</div>}
            >
              <button type="button" className={styles.tool}>
                <Glyph name="help" size={16} />
                What is this?
              </button>
            </Popover>
            {config.actions}
            {canTeach ? (
              <button
                type="button"
                className={styles.tool}
                data-primary=""
                aria-haspopup="dialog"
                aria-expanded={teachOpen}
                onClick={() => setTeachOpen((v) => !v)}
              >
                <Glyph name="spark" size={16} />
                Teach me
                <Kbd size="sm" className={styles.toolKey}>
                  T
                </Kbd>
              </button>
            ) : null}
          </div>
        </header>

        <div className={styles.work}>{children}</div>

        <section className={styles.strip} aria-labelledby={stripId}>
          <h2 id={stripId} className="sr-only">
            Lab status
          </h2>
          {config.simulation ? (
            <p className={styles.sim}>
              <FreshnessChip kind="simulation" />
              <span>Nothing here touches the real network.</span>
            </p>
          ) : null}
          {data.length > 0 ? (
            <ul className={styles.resources} aria-label="Data freshness">
              {data.map((key) => (
                <ResourceChip key={key} resource={key} />
              ))}
            </ul>
          ) : null}
          {config.status ? <p className={styles.status}>{config.status}</p> : null}
          {shortcuts.length > 0 ? (
            <ul className={styles.hints} aria-label="Shortcuts">
              {shortcuts.map((s) => (
                <li key={s.keys + s.label}>
                  <Kbd size="sm" combo={s.keys} /> <span>{s.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <Drawer
          open={teachOpen && canTeach}
          onClose={() => setTeachOpen(false)}
          title={config.teachTitle ?? 'Teach me'}
          description={title}
        >
          <div className={styles.notes}>{renderNotes(config.teach)}</div>
        </Drawer>
      </section>
    </FrameContext.Provider>
  );
}
