/**
 * Site-level metadata shared by `server/` (head tags, sitemap, redirects) and `web/` (document title,
 * navigation, the command deck). Pure data and pure functions.
 *
 * ERASABLE TYPESCRIPT ONLY (see shared/api.ts).
 */

import { LABS, LESSONS } from './curriculum.ts';

export const SITE = {
  name: 'Flux Academy',
  /** Canonical origin the app is served from on Flux. */
  origin: 'https://academy.app.runonflux.io',
  tagline: 'Learn to deploy on the decentralized cloud.',
  description:
    'Interactive lessons, labs and live network data for deploying applications on Flux, the decentralized cloud.',
  /** Social card, relative to the origin. */
  ogImage: '/og/og-image.jpg',
  links: {
    flux: 'https://runonflux.com',
    docs: 'https://docs.runonflux.com',
    cloud: 'https://cloud.runonflux.com',
    discord: 'https://discord.com/invite/runonflux',
    github: 'https://github.com/runonflux',
  },
} as const;

export type RouteKind =
  | 'home'
  | 'learn'
  | 'lesson'
  | 'lab'
  | 'reference'
  | 'glossary'
  | 'troubleshoot'
  | 'profile';

export interface RouteMeta {
  path: string;
  kind: RouteKind;
  /** Page title without the site suffix. */
  title: string;
  description: string;
  /** Sitemap priority, 0 to 1. */
  priority: number;
}

const STATIC_ROUTES: RouteMeta[] = [
  {
    path: '/',
    kind: 'home',
    title: 'Learn to deploy on the decentralized cloud',
    description: SITE.description,
    priority: 1,
  },
  {
    path: '/learn',
    kind: 'learn',
    title: 'The course map',
    description: `Three tracks, ${LESSONS.length} lessons: from what a FluxNode is to a multi-container app and a production checklist.`,
    priority: 0.9,
  },
  {
    path: '/labs',
    kind: 'lab',
    title: 'Labs',
    description:
      'Hands-on tools for Flux: build a spec, explore network data, break nodes in a simulation, use a simulated terminal and supervise a simulated AI agent.',
    priority: 0.8,
  },
  {
    path: '/reference',
    kind: 'reference',
    title: 'Reference',
    description:
      'The Flux application spec, networking, Docker practices, the read-only API, Orbit and Git deploys, and the MCP servers for agents, field by field.',
    priority: 0.7,
  },
  {
    path: '/reference/spec',
    kind: 'reference',
    title: 'Application spec reference',
    description: 'Every field of a Flux application specification, with limits, defaults and gotchas.',
    priority: 0.7,
  },
  {
    path: '/reference/networking',
    kind: 'reference',
    title: 'Networking reference',
    description: 'Ports, domains, internal DNS and how traffic reaches a container on Flux.',
    priority: 0.6,
  },
  {
    path: '/reference/docker',
    kind: 'reference',
    title: 'Docker practices for Flux',
    description:
      'Image size and architecture, tags, ports and volumes: the Docker practices that matter on Flux.',
    priority: 0.6,
  },
  {
    path: '/reference/api',
    kind: 'reference',
    title: 'Flux API cheat sheet',
    description: 'The read-only endpoints worth knowing, with real sample responses.',
    priority: 0.5,
  },
  {
    path: '/reference/orbit',
    kind: 'reference',
    title: 'Orbit and Git deploys reference',
    description:
      'Orbit plans and what they cost, how a Git deploy runs, the build variables, the Deploy to Flux link and what is not published.',
    priority: 0.5,
  },
  {
    path: '/reference/agents',
    kind: 'reference',
    title: 'Agents and MCP reference',
    description:
      'The FluxCloud and Orbit MCP servers: every tool, what it can spend or delete, plan then confirm, and what to approve.',
    priority: 0.5,
  },
  {
    path: '/glossary',
    kind: 'glossary',
    title: 'Glossary',
    description:
      'Plain-language definitions of the Flux terms the lessons use, with why each one matters to a deployer.',
    priority: 0.5,
  },
  {
    path: '/troubleshoot',
    kind: 'troubleshoot',
    title: 'Troubleshoot a deployment',
    description: 'Answer a few questions about what you see and get the likely cause and the fix.',
    priority: 0.6,
  },
  {
    path: '/profile',
    kind: 'profile',
    title: 'Your progress',
    description: 'Your rank, achievements, certificate and preferences. Stored only in your browser.',
    priority: 0.2,
  },
];

/** Every indexable route, static and generated from the curriculum. */
export function allRoutes(): RouteMeta[] {
  const lessons: RouteMeta[] = LESSONS.map((l) => ({
    path: `/learn/${l.id}`,
    kind: 'lesson',
    title: l.title,
    description: l.summary,
    priority: 0.8,
  }));
  const labs: RouteMeta[] = LABS.map((l) => ({
    path: `/labs/${l.id}`,
    kind: 'lab',
    title: l.title,
    description: l.summary,
    priority: 0.7,
  }));
  return [...STATIC_ROUTES, ...lessons, ...labs];
}

/** Metadata for a pathname (trailing slash tolerated), or null for an unknown route. */
export function routeMeta(pathname: string): RouteMeta | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return allRoutes().find((r) => r.path === p) ?? null;
}

/** `<title>` text for a route: the page title, then the site name. The home page leads with the name. */
export function documentTitle(meta: RouteMeta | null): string {
  if (!meta || meta.kind === 'home') return `${SITE.name}: ${SITE.tagline}`;
  return `${meta.title} | ${SITE.name}`;
}

/**
 * Permanent redirects from the previous (Next.js) site's URLs to their new homes. The server answers
 * these with 301 and the client router repeats them so deep links from old bookmarks keep working.
 */
export const REDIRECTS: Readonly<Record<string, string>> = {
  '/getting-started': '/learn/your-toolkit',
  '/tutorials': '/learn',
  '/tutorials/basic-deployment': '/learn/first-deploy',
  '/tutorials/minecraft-server': '/learn/minecraft-server',
  '/tutorials/app-management': '/learn/operate-your-app',
  '/tutorials/multi-component': '/learn/multi-component',
  '/tutorials/custom-domain': '/learn/custom-domains',
  '/tutorials/shared-db': '/learn/shared-database',
  '/playground': '/labs/spec-forge',
  '/reference/flux-spec': '/reference/spec',
  '/reference/docker-tips': '/reference/docker',
  '/troubleshooting': '/troubleshoot',
};
