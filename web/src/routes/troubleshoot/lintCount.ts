import { LINT_CODES } from '@shared/flux/lint-catalogue';

/** How many lint codes exist, read from the catalogue so the page never states a stale number. */
export const LINT_COUNT = Object.keys(LINT_CODES).length;
