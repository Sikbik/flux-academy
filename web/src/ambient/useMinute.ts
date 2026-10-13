import { useEffect, useState } from 'react';

/** The minute number since the epoch, re-rendering once a minute. Used for the HUD's anti burn-in drift. */
export function useMinute(): number {
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const id = window.setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return minute;
}
