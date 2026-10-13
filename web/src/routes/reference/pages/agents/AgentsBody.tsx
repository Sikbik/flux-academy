/**
 * The sections of /reference/agents. This is the lazy half of the page: the frame (heading, contents rail,
 * search) is static, and this module, with the tool catalogue it reads, loads when the page is opened.
 */

import { useHashTarget } from '../../hooks';
import styles from '../../parts/catalogue.module.css';
import { ConsoleAssistant, KnownGaps, Related } from './Console';
import { HostedOrLocal, KeyModel, PlanConfirm, Policies, WhatSpends } from './Safety';
import { Glance, Servers } from './Servers';
import { ToolCatalogue } from './Tools';

export default function AgentsBody() {
  // The frame tries the fragment for about two seconds. A chunk that arrives later has to ask again.
  useHashTarget();
  return (
    <div className={styles.clearCopy}>
      <Glance />
      <Servers />
      <ToolCatalogue />
      <PlanConfirm />
      <KeyModel />
      <HostedOrLocal />
      <WhatSpends />
      <Policies />
      <ConsoleAssistant />
      <KnownGaps />
      <Related />
    </div>
  );
}
