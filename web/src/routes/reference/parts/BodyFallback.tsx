import { Skeleton } from '@/ui';
import styles from './catalogue.module.css';

/**
 * Stands in for the body of a topic while its chunk loads. The heading and the contents rail are already
 * on the page, so only the sections wait.
 */
export function BodyFallback() {
  return (
    <div className={styles.fallback} aria-busy="true">
      <Skeleton shape="block" height={170} label="Loading the page" />
      <Skeleton shape="line" lines={4} />
      <Skeleton shape="block" height={260} />
      <Skeleton shape="line" lines={3} />
    </div>
  );
}
