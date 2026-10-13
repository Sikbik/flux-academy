import { useAnnouncer } from '@/system/announce';

/**
 * One visually hidden polite live region for the whole app: route changes and anything that calls
 * `announce()`. The message is re-keyed on every announcement so an identical sentence is spoken again.
 */
export function LiveRegion() {
  const message = useAnnouncer((s) => s.message);
  const seq = useAnnouncer((s) => s.seq);
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      <span key={seq}>{message}</span>
    </div>
  );
}
