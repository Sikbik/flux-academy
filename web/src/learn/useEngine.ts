import { useEffect, useState } from 'react';
import { engineNow, type LessonEngine, loadEngine } from './engine';

/** The domain engine, or null until its chunk has loaded. Starts the load on first use. */
export function useEngine(): LessonEngine | null {
  const [engine, setEngine] = useState<LessonEngine | null>(engineNow());
  useEffect(() => {
    if (engine) return;
    let alive = true;
    void loadEngine().then((e) => {
      if (alive) setEngine(e);
    });
    return () => {
      alive = false;
    };
  }, [engine]);
  return engine;
}
