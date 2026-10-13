/**
 * Element ids of the reference pages. The pages put these ids on headings, field rows, table rows and
 * endpoint entries, and the search index uses the same functions for its deep links, so a result always
 * lands on the thing it names. All ids are lower kebab case except where a code is part of the id
 * (`lint-PORT_BANNED`), so `#component-ports` reads like the field it names.
 */

import type { FieldDoc } from './types';

export const anchor = {
  /** `app-instances`, `component-ports`. */
  field: (f: Pick<FieldDoc, 'id'>): string => f.id,
  /** `lint-PORT_BANNED`. */
  lint: (code: string): string => `lint-${code}`,
  /** A row of a facts table: `<section>-<row>`. */
  fact: (section: string, row: string): string => `${section}-${row}`,
  /** A row of a troubleshooting table: `<section>-<row>`. */
  trouble: (section: string, row: string): string => `${section}-${row}`,
  endpoint: (id: string): string => `endpoint-${id}`,
  banned: (from: number): string => `banned-${from}`,
  geoForm: (id: string): string => `geo-form-${id}`,
  geoPitfall: (id: string): string => `geo-pitfall-${id}`,
  mountForm: (id: string): string => `mount-${id}`,
  storage: (id: string): string => `storage-${id}`,
  mechanic: (id: string): string => `mechanic-${id}`,
  expire: (id: string): string => `expire-${id}`,
  priceStep: (id: string): string => `price-step-${id}`,
  version: (n: number): string => `version-${n}`,
  host: (id: string): string => `host-${id}`,
  budget: (id: string): string => `budget-${id}`,
  misleading: (id: string): string => `misleading-${id}`,
  academy: (id: string): string => `academy-${id}`,
  commonImage: (id: string): string => `image-${id}`,
  pathStep: (id: string): string => `path-${id}`,
  domainStep: (id: string): string => `domain-step-${id}`,
  dockerNote: (kind: 'web' | 'static', id: string): string => `dockerfile-${kind}-${id}`,
  cap: (id: string): string => `cap-${id}`,
  mistake: (id: string): string => `mistake-${id}`,

  // Orbit and Git deploys
  /** A row of the plan table: `plan-starter`. */
  plan: (id: string): string => `plan-${id}`,
  /** A build variable of the Orbit image: `var-GIT_REPO_URL`. */
  variable: (name: string): string => `var-${name}`,
  /** A stage of a Git deploy: `deploy-step-clone`. */
  deployStep: (id: string): string => `deploy-step-${id}`,
  /** A note on the generated spec: `spec-note-repotag`. */
  specNote: (id: string): string => `spec-note-${id}`,
  /** A parameter of the Deploy to Flux button: `button-param-repo`. */
  buttonParam: (id: string): string => `button-param-${id}`,
  /** A marker of an Orbit app in the global specs: `marker-image`. */
  marker: (id: string): string => `marker-${id}`,
  /** A dated count: `sample-plainOrbitSpecs`. */
  sample: (id: string): string => `sample-${id}`,

  // Agents and MCP
  /** An MCP tool: `tool-flux_deploy_app` for FluxCloud, `tool-orbit-deploy_app` for Orbit. */
  tool: (server: 'flux-cloud' | 'orbit', name: string): string =>
    server === 'orbit' ? `tool-orbit-${name}` : `tool-${name}`,
  /** A row of the server comparison: `server-endpoint`. */
  serverRow: (id: string): string => `server-${id}`,
  /** One way to connect: `connect-hosted`. */
  connection: (id: string): string => `connect-${id}`,
  /** A step of plan then confirm: `confirm-step-plan`. */
  confirmStep: (id: string): string => `confirm-step-${id}`,
  /** An approval policy: `policy-ask-spends`. */
  policy: (id: string): string => `policy-${id}`,
  /** A tool of the console assistant: `console-tool-ui_prefill_deploy`. */
  consoleTool: (name: string): string => `console-tool-${name}`,
  /** A known gap in a vendor guide: `gap-g-discount`. */
  gap: (id: string): string => `gap-${id}`,
};

/** `#component-ports` -> `component-ports`, decoded. Empty for no fragment. */
export function fragmentId(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
