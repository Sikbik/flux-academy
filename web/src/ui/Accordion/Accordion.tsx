import {
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useContext,
  useId,
  useRef,
  useState,
} from 'react';
import { Glyph } from '../Glyph/Glyph';
import type { GlyphName } from '../Glyph/glyphs';
import { cn } from '../internal/cn';
import { rovingTarget } from '../Tabs/roving';
import styles from './Accordion.module.css';
import { normaliseOpen, toggleOpen } from './state';

interface AccordionBase {
  children: ReactNode;
  /** Whether panels are `role="region"` landmarks. Default `region`; use `none` past six items. */
  panelRole?: 'region' | 'none';
  className?: string;
}

interface AccordionSingle {
  /** One panel open at a time (default). */
  type?: 'single';
  /** Allow the open panel to be closed. Default true. */
  collapsible?: boolean;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
}

interface AccordionMultiple {
  /** Any number of panels open. */
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

export type AccordionProps = AccordionBase & (AccordionSingle | AccordionMultiple);

interface AccordionContextValue {
  open: readonly string[];
  toggle: (value: string) => void;
  panelRole: 'region' | 'none';
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

/**
 * A stack of disclosure rows. Headers are buttons (`aria-expanded`, `aria-controls`), panels
 * are regions named by their header, and Up, Down, Home and End move between headers. The
 * panel opens by animating `grid-template-rows` from 0fr to 1fr: no height is measured.
 *
 *   <Accordion type="multiple" defaultValue={['web']}>
 *     <AccordionItem value="web" title="web" icon="container" meta="0.5 vCPU, 512 MB">...</AccordionItem>
 *   </Accordion>
 */
export function Accordion(props: AccordionProps) {
  const { children, panelRole = 'region', className } = props;
  const type = props.type ?? 'single';
  const collapsible = props.type === 'multiple' ? true : (props.collapsible ?? true);
  const controlled = props.value !== undefined;
  const [inner, setInner] = useState<string[]>(() => normaliseOpen(props.defaultValue, type));
  const open = controlled ? normaliseOpen(props.value, type) : inner;
  const rootRef = useRef<HTMLDivElement>(null);

  const toggle = (value: string) => {
    const next = toggleOpen(open, value, type, collapsible);
    if (!controlled) setInner(next);
    if (props.type === 'multiple') props.onValueChange?.(next);
    else props.onValueChange?.(next[0] ?? null);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    const target = e.target as HTMLElement;
    const header = target.closest<HTMLElement>('[data-accordion-header]');
    if (!root || !header || header.closest('[data-accordion-root]') !== root) return;
    const headers = Array.from(root.querySelectorAll<HTMLElement>('[data-accordion-header]')).filter(
      (h) => h.closest('[data-accordion-root]') === root && !(h as HTMLButtonElement).disabled,
    );
    const current = headers.indexOf(header);
    const to = rovingTarget(
      headers.map(() => ({})),
      current,
      e.key,
      { orientation: 'vertical', wrap: true },
    );
    if (to === null) return;
    e.preventDefault();
    headers[to]?.focus();
  };

  return (
    <AccordionContext value={{ open, toggle, panelRole }}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys between the header buttons inside */}
      <div ref={rootRef} className={cn(styles.root, className)} data-accordion-root="" onKeyDown={onKeyDown}>
        {children}
      </div>
    </AccordionContext>
  );
}

export interface AccordionItemProps {
  /** The value this item opens as. Unique inside its Accordion. */
  value: string;
  /** The header text. */
  title: ReactNode;
  /** A glyph before the title. */
  icon?: GlyphName;
  /** Right-aligned mono text before the chevron: a summary of what is inside. */
  meta?: ReactNode;
  disabled?: boolean;
  /** The heading level wrapping the header button. Default 3. */
  level?: 2 | 3 | 4 | 5 | 6;
  /** A pseudo-state hook for the kit gallery and visual tests. */
  force?: 'hover' | 'press' | 'focus';
  className?: string;
  children?: ReactNode;
}

export function AccordionItem({
  value,
  title,
  icon,
  meta,
  disabled = false,
  level = 3,
  force,
  className,
  children,
}: AccordionItemProps) {
  const ctx = useContext(AccordionContext);
  const uid = useId();
  const headerId = `${uid}-h`;
  const panelId = `${uid}-p`;
  const isOpen = ctx ? ctx.open.includes(value) : false;
  const Heading = `h${level}` as 'h3';
  // A region is named by its header; past a handful of items `panelRole="none"` drops the landmark.
  const regionProps = ctx?.panelRole === 'none' ? {} : { role: 'region', 'aria-labelledby': headerId };

  return (
    <div
      className={cn(styles.item, className)}
      data-open={isOpen ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
      data-icon={icon ? 'true' : undefined}
    >
      <Heading className={styles.heading}>
        <button
          type="button"
          id={headerId}
          className={cn('chamfer', styles.trigger)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          disabled={disabled}
          data-accordion-header=""
          data-force={force}
          onClick={() => ctx?.toggle(value)}
        >
          <span className={styles.edge} aria-hidden="true" />
          <span className={styles.face} aria-hidden="true" />
          <span className={styles.marker} aria-hidden="true" />
          <span className={styles.content}>
            {icon ? (
              <span className={styles.icon}>
                <Glyph name={icon} size={18} />
              </span>
            ) : null}
            <span className={styles.title}>{title}</span>
            {meta != null ? <span className={styles.meta}>{meta}</span> : null}
            <span className={styles.chev} aria-hidden="true">
              <Glyph name="chevron-down" size={18} />
            </span>
          </span>
        </button>
      </Heading>
      <div
        id={panelId}
        {...regionProps}
        className={styles.panel}
        data-open={isOpen ? 'true' : undefined}
        inert={!isOpen}
      >
        <div className={styles.panelInner}>
          <div className={styles.panelBody}>{children}</div>
        </div>
      </div>
    </div>
  );
}
