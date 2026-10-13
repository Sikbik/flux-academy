/**
 * `/apps/register`: "Deploy Your App on FluxCloud" with the two cards of FACTS 9.4.1. The login screen is
 * skipped in the simulation, and says so.
 */
import { Button, Glyph } from '@/ui';
import styles from './FluxcloudSim.module.css';
import { PageTitle } from './Parts';

const GIT_BULLETS = [
  'No Docker knowledge needed',
  'Auto-detect 100+ frameworks',
  'Built-in CI/CD pipeline',
  'Automatic rollbacks',
  'GitHub/GitLab/Bitbucket support',
];

const DOCKER_BULLETS = [
  'Any Docker image',
  'Private registries',
  'Multi-container compose',
  'Full resource control',
  'Enterprise features',
];

export function EntryScreen({ onDocker }: { onDocker: () => void }) {
  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <PageTitle screenKey="entry">Deploy Your App on FluxCloud</PageTitle>
          <p className={styles.pageSub}>How would you like to deploy?</p>
        </div>
      </div>

      <p className={styles.notice} role="note">
        <Glyph name="info" size={16} /> Login is skipped in this simulation. In FluxCloud you sign in first
        with Google, Apple ID, an email and password, a wallet (ZelCore, SSP, WalletConnect or MetaMask) or a
        manual signature. Use the switch in the title bar to see what changes for an SSO account and a wallet.
      </p>

      <div className={styles.choice}>
        <article className={styles.choiceCard}>
          <h4 className={styles.cardTitle}>Git</h4>
          <p className={styles.choiceSub}>Git-based Deployment</p>
          <ul className={styles.bullets}>
            {GIT_BULLETS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <Button
            variant="secondary"
            icon="external"
            aria-disabled="true"
            title="Opens Flux Orbit on runonflux.com in a new tab. Not part of this simulation."
            onClick={() => undefined}
          >
            Deploy with Git
          </Button>
        </article>
        <article className={styles.choiceCard} data-live="true">
          <h4 className={styles.cardTitle}>Docker</h4>
          <p className={styles.choiceSub}>Container-based Deployment</p>
          <ul className={styles.bullets}>
            {DOCKER_BULLETS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <Button variant="primary" icon="arrow-right" onClick={onDocker}>
            Deploy with Docker
          </Button>
        </article>
      </div>
    </div>
  );
}
