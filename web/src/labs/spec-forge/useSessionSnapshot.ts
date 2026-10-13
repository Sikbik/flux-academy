import { useSyncExternalStore } from 'react';
import type { ForgeSession, ForgeSnapshot } from '@/forge/model';

const noopSubscribe = (): (() => void) => () => undefined;
const nothing = (): null => null;

/**
 * The live snapshot of a session that may not exist yet (the editor creates it when it mounts and the lab
 * learns about it one layout effect later). `null` until then.
 */
export function useSessionSnapshot(session: ForgeSession | null): ForgeSnapshot | null {
  return useSyncExternalStore(
    session ? session.subscribe : noopSubscribe,
    session ? session.getSnapshot : nothing,
    nothing,
  );
}
