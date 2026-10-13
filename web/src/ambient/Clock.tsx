import { useEffect, useState } from 'react';
import styles from './Ambient.module.css';

const hourMinute = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dateLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/** Re-renders once a second, on the second boundary. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(Date.now());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    return () => window.clearTimeout(timer);
  }, []);
  return now;
}

/** The big clock and the date, in the visitor's own locale and time zone. */
export function Clock() {
  const now = useNow();
  const date = new Date(now);
  const parts = hourMinute.formatToParts(date);
  const hm = parts
    .filter((p) => p.type === 'hour' || p.type === 'minute' || p.type === 'literal')
    .map((p) => (p.type === 'literal' ? p.value.trim() || '' : p.value))
    .join('');
  const period = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const day = dateLong.format(date);

  return (
    <>
      <p className={styles.time}>
        <span className="sr-only">{`${hourMinute.format(date)}, ${day}`}</span>
        <span className={styles.digits} aria-hidden="true">
          {hm}
        </span>
        <span className={styles.small} aria-hidden="true">
          <span className={styles.period}>{period}</span>
          <span className={styles.secs}>{seconds}</span>
        </span>
      </p>
      <p className={styles.date} aria-hidden="true">
        {day}
      </p>
    </>
  );
}
