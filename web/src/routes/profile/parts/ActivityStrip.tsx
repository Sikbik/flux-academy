import { useMemo } from 'react';
import { type Activity, describeActivity, formatDay, parseKey } from '../activity';
import styles from './ActivityStrip.module.css';

export interface ActivityStripProps {
  activity: Activity;
  /** The current time, for "this year" in dates. Passed in so the strip is pure. */
  now: Date;
}

/** Flat-top hexagons, one per day, a column per week (Monday at the top). Odd columns sit half a cell lower. */
const R = 14;
const H = Math.sqrt(3) * R;
const DRAW = R * 0.88;
const PAD_LEFT = 44;
const PAD_TOP = 18;

function hex(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * 60 * i;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_LABELS: [number, string][] = [
  [0, 'Mon'],
  [2, 'Wed'],
  [4, 'Fri'],
];

/**
 * The last twelve weeks as a field of hexagons: a lit hexagon is a day on which something was done. The
 * picture is one image to assistive technology and the sentence beside it says the same in words, with the
 * dates listed for anyone who wants them.
 */
export function ActivityStrip({ activity, now }: ActivityStripProps) {
  const width = PAD_LEFT + R + (activity.weeks - 1) * 1.5 * R + R;
  const height = PAD_TOP + H * 7.5;

  const months = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    let last = -1;
    for (let w = 0; w < activity.weeks; w++) {
      const monday = parseKey(activity.cells[w * 7]?.date ?? '');
      if (!monday) continue;
      const m = monday.getMonth();
      if (m !== last) {
        out.push({ x: PAD_LEFT + R + w * 1.5 * R, label: MONTHS[m] ?? '' });
        last = m;
      }
    }
    // A label too close to the next one would overlap it: keep the later one.
    return out.filter((m, i) => i === out.length - 1 || (out[i + 1]?.x ?? 0) - m.x >= 36);
  }, [activity]);

  const description = describeActivity(activity, now);
  const last = activity.lastActive ? formatDay(activity.lastActive, now) : 'None yet';

  return (
    <div className={styles.wrap}>
      <figure className={styles.figure}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Days active in the last ${activity.weeks} weeks. ${description}`}
          focusable="false"
        >
          {months.map((m) => (
            <text key={`${m.label}-${m.x}`} x={m.x - R} y={9} className={styles.month}>
              {m.label}
            </text>
          ))}
          {WEEKDAY_LABELS.map(([row, label]) => (
            <text
              key={label}
              x={PAD_LEFT - R - 4}
              y={PAD_TOP + H * (row + 0.5) + 3}
              textAnchor="end"
              className={styles.weekday}
            >
              {label}
            </text>
          ))}
          {activity.cells.map((c) => {
            const cx = PAD_LEFT + R + c.week * 1.5 * R;
            const cy = PAD_TOP + H * (c.weekday + 0.5) + (c.week % 2 === 1 ? H / 2 : 0);
            const state = c.future ? 'future' : c.active ? 'active' : 'idle';
            return (
              <path
                key={c.date}
                d={hex(cx, cy, DRAW)}
                className={styles.cell}
                data-state={state}
                data-today={c.today ? 'true' : undefined}
              >
                <title>
                  {c.future
                    ? `${formatDay(c.date, now)}: not yet`
                    : `${formatDay(c.date, now)}: ${c.active ? 'active' : 'no activity'}`}
                </title>
              </path>
            );
          })}
        </svg>
        <figcaption className={styles.legend} aria-hidden="true">
          <span className={styles.key} data-state="active">
            Active day
          </span>
          <span className={styles.key} data-state="idle">
            No activity
          </span>
          <span className={styles.key} data-state="today">
            Today
          </span>
        </figcaption>
      </figure>

      <div className={styles.facts}>
        <p className={styles.sentence}>{description}</p>
        <dl className={styles.stats}>
          <div>
            <dt>Active days</dt>
            <dd>
              {activity.activeCount}
              <small> of {activity.windowDays}</small>
            </dd>
          </div>
          <div>
            <dt>Current streak</dt>
            <dd>
              {activity.currentStreak}
              <small> {activity.currentStreak === 1 ? 'day' : 'days'}</small>
            </dd>
          </div>
          <div>
            <dt>Longest streak</dt>
            <dd>
              {activity.longestStreak}
              <small> {activity.longestStreak === 1 ? 'day' : 'days'}</small>
            </dd>
          </div>
          <div>
            <dt>Last active</dt>
            <dd className={styles.date}>{last}</dd>
          </div>
        </dl>
        {activity.activeDates.length > 0 ? (
          <p className="sr-only">
            Active days: {activity.activeDates.map((d) => formatDay(d, now)).join(', ')}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
