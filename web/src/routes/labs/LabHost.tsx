import { LABS, LESSONS, labById } from '@shared/curriculum';
import { Component, type ErrorInfo, type ReactNode, Suspense } from 'react';
import { Link } from 'react-router';
import { LabFrame } from '@/app/LabFrame';
import { useHoldFooter } from '@/app/pending';
import { Glyph, Panel } from '@/ui';
import { labDefaults } from './defaults';
import styles from './labs.module.css';
import { labComponent } from './registry';

function Loading() {
  // The footer and the status strip wait for the lab: under a short placeholder they would sit in view
  // and then jump below the fold when the lab arrives.
  useHoldFooter();
  return (
    <div className={styles.loading} role="status" aria-busy="true">
      <span className={styles.scan} aria-hidden="true" />
      <p>Loading the lab</p>
    </div>
  );
}

function BeingBuilt({ labId }: { labId: string }) {
  const meta = labById(labId);
  const lessons = LESSONS.filter((l) => l.labs.includes(labId));
  return (
    <Panel
      as="section"
      variant="slab"
      padding="lg"
      pattern="br"
      className={styles.building}
      contentClassName={styles.buildingContent}
      aria-labelledby="lab-building-title"
    >
      <p className={styles.buildingEyebrow}>
        <Glyph name="clock" size={14} /> Being built
      </p>
      <h2 className={styles.buildingTitle} id="lab-building-title">
        {meta?.title} is on the bench
      </h2>
      <p className={styles.buildingBody}>
        {meta?.summary} This lab has not shipped yet. The rest of the Academy works, and this page opens as
        soon as it does.
      </p>
      {lessons.length > 0 ? (
        <div>
          <p className={styles.buildingLabel}>Lessons that use it</p>
          <ul className={styles.related}>
            {lessons.slice(0, 4).map((l) => (
              <li key={l.id}>
                <Link to={`/learn/${l.id}`}>{l.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p>
        <Link className={styles.back} to="/labs">
          <Glyph name="arrow-left" size={14} />
          All labs
        </Link>
      </p>
    </Panel>
  );
}

class LabBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[lab]', error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Panel
        variant="slab"
        padding="lg"
        tone="crit"
        className={styles.building}
        contentClassName={styles.buildingContent}
        role="alert"
      >
        <p className={styles.buildingEyebrow}>
          <Glyph name="status-warn" size={14} /> Lab error
        </p>
        <h2 className={styles.buildingTitle}>This lab hit a problem</h2>
        <p className={styles.buildingBody}>
          The rest of the Academy still works and nothing you did was lost. Reload to try again.
        </p>
        <button type="button" className={styles.back} onClick={() => window.location.reload()}>
          <Glyph name="refresh" size={14} />
          Reload
        </button>
      </Panel>
    );
  }
}

/** One lab, in the shared frame. The frame is there even while the lab's chunk loads or is missing. */
export function LabHost({ labId }: { labId: string }) {
  const meta = labById(labId) ?? LABS[0];
  const Lab = labComponent(labId);
  const defaults = labDefaults(labId);
  if (!meta) return null;
  return (
    <LabFrame
      labId={labId}
      title={meta.title}
      purpose={meta.summary}
      simulation={defaults.simulation}
      data={defaults.data}
    >
      {Lab ? (
        <LabBoundary>
          <Suspense fallback={<Loading />}>
            <Lab />
          </Suspense>
        </LabBoundary>
      ) : (
        <BeingBuilt labId={labId} />
      )}
    </LabFrame>
  );
}
