/**
 * The event log: what the simulation did, in sentences, newest first. Times are simulated time. The bench
 * already speaks the important events through its own live region, so this list is not a live region
 * itself (it would read everything twice); it is a `log` a reader can move through.
 */
import { Glyph, type GlyphName } from '@/ui';
import styles from './EventLog.module.css';
import { clock, type LogLine, type LogTone } from './log';
import { EJECT_SEC, SIM_REPLACEMENT_SEC } from './words';

export interface EventLogProps {
  lines: readonly LogLine[];
  onClear: () => void;
}

const ICON: Record<LogTone, GlyphName> = {
  info: 'info',
  ok: 'status-ok',
  warn: 'status-warn',
  crit: 'status-crit',
};

const TONE_WORD: Record<LogTone, string> = {
  info: 'Info',
  ok: 'Good',
  warn: 'Warning',
  crit: 'Problem',
};

/** Counters help on streams (requests), not on one-off facts. */
function countable(key: string): boolean {
  return key.startsWith('failed:') || key.startsWith('rerouted:');
}

export function EventLog({ lines, onClear }: EventLogProps) {
  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <h2 className={styles.title}>What happened</h2>
        <button type="button" className={styles.clear} onClick={onClear} disabled={lines.length === 0}>
          Clear
        </button>
      </div>
      <p className={styles.note}>
        Times are simulated. Spotting a dead node takes about {EJECT_SEC} seconds on the network too.
        Replacing an instance can take about two hours there, and longer for a big image or a synced volume.
        It takes {SIM_REPLACEMENT_SEC} seconds here, compressed for the screen.
      </p>
      {/* role="log" replaces a list's own role, so the log is a wrapper and the list sits inside it. The
          wrapper scrolls, so it takes focus: a keyboard user can then scroll the history. */}
      <div
        className={styles.log}
        role="log"
        aria-live="off"
        aria-label="Event log, newest first"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard focusable
        tabIndex={0}
      >
        <ol className={styles.list}>
          {lines.length === 0 ? (
            <li className={styles.empty}>Nothing yet. Break a node and watch this list.</li>
          ) : (
            lines.map((l) => (
              <li key={l.id} className={styles.line} data-tone={l.tone}>
                <time className={styles.time}>{clock(l.at)}</time>
                <Glyph name={ICON[l.tone]} size={14} />
                <span className="sr-only">{TONE_WORD[l.tone]}: </span>
                <span className={styles.text}>{l.text}</span>
                {l.count > 1 && countable(l.key) ? <span className={styles.count}>x{l.count}</span> : null}
              </li>
            ))
          )}
        </ol>
      </div>
    </div>
  );
}
