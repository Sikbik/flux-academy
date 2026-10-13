/**
 * The sections of /reference/orbit. This is the lazy half of the page: the frame (heading, contents rail,
 * search) is static, and this module, with the Orbit catalogue it reads, loads when the page is opened.
 */

import { useHashTarget } from '../../hooks';
import styles from '../../parts/catalogue.module.css';
import { Limits, NotPublished, OnTheNetwork, OrbitMcp, Related } from './Network';
import { Glance, Plans } from './Overview';
import { GeneratedSpec, HowItRuns } from './Pipeline';
import { ButtonAnatomy, ButtonBuilder, DeployButton, Variables, Webhooks } from './Settings';

export default function OrbitBody() {
  // The frame tries the fragment for about two seconds. A chunk that arrives later has to ask again.
  useHashTarget();
  return (
    <div className={styles.clearCopy}>
      <Glance />
      <Plans />
      <HowItRuns />
      <GeneratedSpec />
      <Variables />
      <DeployButton />
      <ButtonAnatomy />
      <ButtonBuilder />
      <Webhooks />
      <OnTheNetwork />
      <Limits />
      <NotPublished />
      <OrbitMcp />
      <Related />
    </div>
  );
}
