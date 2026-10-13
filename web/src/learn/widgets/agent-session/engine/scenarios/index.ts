/**
 * The four scenarios, by id. A scenario is data: a tree of beats the engine walks (`../session.ts`).
 */

import type { Scenario, ScenarioId } from '../types.ts';
import { SCENARIO_IDS } from '../types.ts';
import { deployNginx } from './deploy-nginx.ts';
import { orbitRepo } from './orbit-repo.ts';
import { poisonedLog } from './poisoned-log.ts';
import { retryAfterTimeout } from './retry-after-timeout.ts';

export const SCENARIOS: Readonly<Record<ScenarioId, Scenario>> = {
  'deploy-nginx': deployNginx,
  'poisoned-log': poisonedLog,
  'retry-after-timeout': retryAfterTimeout,
  'orbit-repo': orbitRepo,
};

export function scenarioById(id: string): Scenario | undefined {
  return (SCENARIO_IDS as readonly string[]).includes(id) ? SCENARIOS[id as ScenarioId] : undefined;
}

/** Scenarios in the order the lab lists them. */
export const SCENARIO_LIST: readonly Scenario[] = SCENARIO_IDS.map((id) => SCENARIOS[id]);
