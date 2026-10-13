import styles from './StageSkeleton.module.css';

/** A skeleton shaped like a stage while its code arrives. */
export function StageSkeleton({ label = 'Loading the stage' }: { label?: string }) {
  return (
    <div className={styles.skeleton} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className={styles.bar} />
      <div className={styles.block} />
      <div className={styles.row}>
        <div className={styles.chip} />
        <div className={styles.chip} />
        <div className={styles.chip} />
      </div>
    </div>
  );
}
