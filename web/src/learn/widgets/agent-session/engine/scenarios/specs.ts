/**
 * The specifications the scenarios are about, built from the engine's own defaults so the lint engine and
 * `quote()` treat them as any other spec. Names and images are examples: nothing here is a real app, and the
 * owner is the academy's placeholder Flux ID.
 */

import {
  DEFAULT_EXPIRE_BLOCKS,
  defaultComponent,
  EXAMPLE_OWNER,
  type FluxAppSpec,
  type OrbitPlanId,
  orbitPlanById,
  orbitPlanSpec,
  SPEC_VERSION,
} from '@shared/flux';

/** The repository the Orbit scenario deploys. An example, plainly not a real one. */
export const EXAMPLE_REPO = 'https://github.com/example/app';

interface WebOptions {
  name: string;
  description: string;
  image: string;
  componentName: string;
  componentDescription: string;
  port: number;
}

/** A small nginx web server: 0.5 core, 500 MB, 1 GB, three instances, one month. */
export function webSpec(o: WebOptions): FluxAppSpec {
  return {
    version: SPEC_VERSION,
    name: o.name,
    description: o.description,
    owner: EXAMPLE_OWNER,
    instances: 3,
    staticip: false,
    enterprise: '',
    contacts: [],
    geolocation: [],
    expire: DEFAULT_EXPIRE_BLOCKS,
    nodes: [],
    compose: [
      defaultComponent({
        name: o.componentName,
        description: o.componentDescription,
        repotag: o.image,
        ports: [o.port],
        containerPorts: [80],
        domains: [''],
        containerData: '/usr/share/nginx/html',
        cpu: 0.5,
        ram: 500,
        hdd: 1,
      }),
    ],
  };
}

/** The app being debugged in the log scenario: a small API on two instances with a data folder. */
export function apiSpec(): FluxAppSpec {
  return {
    version: SPEC_VERSION,
    name: 'my-api',
    description: 'A small JSON API',
    owner: EXAMPLE_OWNER,
    instances: 2,
    staticip: false,
    enterprise: '',
    contacts: [],
    geolocation: [],
    expire: DEFAULT_EXPIRE_BLOCKS,
    nodes: [],
    compose: [
      defaultComponent({
        name: 'api',
        description: 'JSON API',
        repotag: 'example/my-api:1.4.2',
        ports: [31200],
        containerPorts: [3000],
        domains: [''],
        containerData: '/data',
        cpu: 0.5,
        ram: 500,
        hdd: 5,
      }),
    ],
  };
}

/** The plain spec an Orbit plan registers (FACTS 15.3.1, 15.3.2): one component, the Orbit image. */
export function orbitSpec(plan: OrbitPlanId): FluxAppSpec {
  const p = orbitPlanById(plan) ?? orbitPlanById('standard');
  if (!p) throw new Error('the Orbit plan catalogue is empty');
  return orbitPlanSpec(p, { name: 'my-repo-app', repo: EXAMPLE_REPO });
}
