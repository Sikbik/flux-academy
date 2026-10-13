/**
 * The Flux Academy curriculum: tracks, modules, lessons and labs, as metadata.
 *
 * This is the single source of truth for WHAT exists and in WHAT order. The lesson bodies (steps, stages,
 * challenges) live in `web/src/content/lessons/<id>.ts`; the server uses this file for the sitemap, page
 * titles, social cards and JSON-LD. A test asserts that every lesson here has a content file and the
 * reverse. Ids are permanent: they are URLs (`/learn/<id>`) and keys in a learner's saved progress.
 *
 * ERASABLE TYPESCRIPT ONLY (see shared/api.ts). No enums, no runtime imports.
 */

import type { Tier } from './api.ts';

// ---------------------------------------------------------------------------
// Tracks: the three node tiers double as skill levels. Cumulus is the smallest node and the first
// track, Stratus the largest and the last. Tier colours (tokens `--cumulus`, `--nimbus`, `--stratus`)
// are used for tracks everywhere, and only for tiers and tracks.
// ---------------------------------------------------------------------------

export type TrackId = Tier;

export interface Track {
  id: TrackId;
  /** Display name, for example "Cumulus". */
  name: string;
  /** What the track is, in two or three words. */
  title: string;
  /** One sentence for cards. */
  summary: string;
  /** The rank a learner earns by finishing the track. */
  rank: string;
}

export const TRACKS: readonly Track[] = [
  {
    id: 'cumulus',
    name: 'Cumulus',
    title: 'Foundations',
    summary: 'How Flux works, what a container is, and what to have ready before your first deploy.',
    rank: 'Cumulus Operator',
  },
  {
    id: 'nimbus',
    name: 'Nimbus',
    title: 'Build and ship',
    summary:
      'Write a spec, size it, price it, expose it, ship it from an image, a Git repository or a sentence, and look after it.',
    rank: 'Nimbus Engineer',
  },
  {
    id: 'stratus',
    name: 'Stratus',
    title: 'Scale and harden',
    summary:
      'Plan for failure, keep state, compose several services, hand tools to an agent safely and work through a production checklist.',
    rank: 'Stratus Architect',
  },
] as const;

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export type LessonKind = 'concept' | 'hands-on' | 'project';

export interface LessonMeta {
  /** URL slug and progress key. Permanent. */
  id: string;
  track: TrackId;
  /** Grouping label inside a track, for the map. */
  module: string;
  title: string;
  /** One sentence, plain, concrete. Used on cards and in social previews. */
  summary: string;
  /** Honest estimate of time for a first-time learner. */
  minutes: number;
  kind: LessonKind;
  /** Lessons worth finishing first. They are advice, not locks. */
  prerequisites: string[];
  /** Lab ids this lesson links to or embeds. */
  labs: string[];
  /** Position in the recommended path, 1-based and unique. */
  order: number;
}

export const LESSONS: readonly LessonMeta[] = [
  // ---- Cumulus: foundations --------------------------------------------------------------------
  {
    id: 'what-is-flux',
    track: 'cumulus',
    module: 'The network',
    title: 'Thousands of machines, one cloud',
    summary:
      'Meet the machines: what a FluxNode is, why there are three tiers, and what that means for your app.',
    minutes: 7,
    kind: 'concept',
    prerequisites: [],
    labs: ['network'],
    order: 1,
  },
  {
    id: 'how-apps-run',
    track: 'cumulus',
    module: 'The network',
    title: 'From spec to running app',
    summary:
      'Follow one deployment from a JSON file to a live URL: registration, placement, start and traffic.',
    minutes: 8,
    kind: 'concept',
    prerequisites: ['what-is-flux'],
    labs: ['network', 'failover'],
    order: 2,
  },
  {
    id: 'containers-101',
    track: 'cumulus',
    module: 'Containers',
    title: 'Containers in ten minutes',
    summary: 'Images, registries, tags and ports: the Docker you need before you deploy on Flux.',
    minutes: 10,
    kind: 'hands-on',
    prerequisites: [],
    labs: ['terminal'],
    order: 3,
  },
  {
    id: 'your-toolkit',
    track: 'cumulus',
    module: 'Setup',
    title: 'Your toolkit',
    summary:
      'A login, a public image, a way to pay and a clear half hour: a short checklist before you register an app.',
    minutes: 6,
    kind: 'hands-on',
    prerequisites: [],
    labs: [],
    order: 4,
  },

  // ---- Nimbus: build and ship ------------------------------------------------------------------
  {
    id: 'first-deploy',
    track: 'nimbus',
    module: 'Deploy',
    title: 'Deploy your first app',
    summary:
      'Containerise a tiny web app, describe it in a spec, price it, walk the registration steps in a simulator and tell the clocks around payment apart.',
    minutes: 15,
    kind: 'project',
    prerequisites: ['containers-101', 'how-apps-run'],
    labs: ['spec-forge', 'terminal'],
    order: 5,
  },
  {
    id: 'resources-pricing',
    track: 'nimbus',
    module: 'Deploy',
    title: 'Resources and price',
    summary: 'CPU, RAM, disk and instances: how each one moves the monthly price, and how to size an app.',
    minutes: 10,
    kind: 'hands-on',
    prerequisites: ['first-deploy'],
    labs: ['spec-forge'],
    order: 6,
  },
  {
    id: 'ports-and-domains',
    track: 'nimbus',
    module: 'Traffic',
    title: 'Ports and traffic',
    summary: 'Container ports, public ports and generated domains: how a request finds your container.',
    minutes: 10,
    kind: 'hands-on',
    prerequisites: ['first-deploy'],
    labs: ['spec-forge'],
    order: 7,
  },
  {
    id: 'env-and-secrets',
    track: 'nimbus',
    module: 'Traffic',
    title: 'Environment, commands and private images',
    summary: 'Configure a container at run time, start it your way and pull from a private registry.',
    minutes: 8,
    kind: 'hands-on',
    prerequisites: ['first-deploy'],
    labs: ['spec-forge'],
    order: 8,
  },
  {
    id: 'deploy-from-git',
    track: 'nimbus',
    module: 'Deploy',
    title: 'Deploy from a Git repository',
    summary:
      'Point Orbit at a repository, pick a plan, set the build and read the specification it creates for you.',
    minutes: 17,
    kind: 'hands-on',
    prerequisites: ['first-deploy'],
    labs: ['spec-forge'],
    order: 9,
  },
  {
    id: 'ai-assisted-deploy',
    track: 'nimbus',
    module: 'Deploy',
    title: 'Describe it, review it, sign it',
    summary:
      'Ask the FluxCloud assistant for an app in plain words, then check the spec it drafts and the price before you sign.',
    minutes: 15,
    kind: 'hands-on',
    prerequisites: ['resources-pricing', 'ports-and-domains'],
    labs: ['spec-forge', 'agent-desk'],
    order: 10,
  },
  {
    id: 'minecraft-server',
    track: 'nimbus',
    module: 'Projects',
    title: 'Project: a Minecraft server',
    summary: 'Size, expose and persist a game server, then find the node that serves it.',
    minutes: 12,
    kind: 'project',
    prerequisites: ['resources-pricing', 'ports-and-domains'],
    labs: ['spec-forge'],
    order: 11,
  },
  {
    id: 'operate-your-app',
    track: 'nimbus',
    module: 'Operate',
    title: 'Operate your app',
    summary:
      'Logs, restarts, updates, renewals and where your instances are: running an app after launch day.',
    minutes: 10,
    kind: 'concept',
    prerequisites: ['first-deploy'],
    labs: ['explorer'],
    order: 12,
  },

  // ---- Stratus: scale and harden ---------------------------------------------------------------
  {
    id: 'redundancy-failover',
    track: 'stratus',
    module: 'Resilience',
    title: 'Instances and failure',
    summary: 'Break nodes on purpose and learn how many instances an app actually needs.',
    minutes: 10,
    kind: 'hands-on',
    prerequisites: ['resources-pricing'],
    labs: ['failover'],
    order: 13,
  },
  {
    id: 'geo-placement',
    track: 'stratus',
    module: 'Resilience',
    title: 'Where your app runs',
    summary:
      'Steer instances with geolocation rules, see why pinning to nodes is not for most apps and decide whether you need a static IP.',
    minutes: 8,
    kind: 'concept',
    prerequisites: ['redundancy-failover'],
    labs: ['network', 'explorer'],
    order: 14,
  },
  {
    id: 'persistent-storage',
    track: 'stratus',
    module: 'State',
    title: 'Persistent storage',
    summary:
      'What survives a restart, what survives a move, what the r: and g: prefixes do, and why s: is left out.',
    minutes: 12,
    kind: 'hands-on',
    prerequisites: ['redundancy-failover'],
    labs: ['failover'],
    order: 15,
  },
  {
    id: 'shared-database',
    track: 'stratus',
    module: 'State',
    title: 'A database that follows your app',
    summary:
      'Run a database on a primary and standby volume, and know what the design gives you and what it cannot.',
    minutes: 12,
    kind: 'project',
    prerequisites: ['persistent-storage'],
    labs: ['spec-forge'],
    order: 16,
  },
  {
    id: 'multi-component',
    track: 'stratus',
    module: 'Architecture',
    title: 'Several containers, one app',
    summary: 'Wire a frontend, an API and a cache together with component names and internal DNS.',
    minutes: 14,
    kind: 'project',
    prerequisites: ['ports-and-domains', 'env-and-secrets'],
    labs: ['spec-forge'],
    order: 17,
  },
  {
    id: 'custom-domains',
    track: 'stratus',
    module: 'Architecture',
    title: 'Your own domain',
    summary: 'Point a domain you own at your app, with TLS, and avoid the classic DNS traps.',
    minutes: 10,
    kind: 'hands-on',
    prerequisites: ['ports-and-domains'],
    labs: ['terminal'],
    order: 18,
  },
  {
    id: 'agents-and-mcp',
    track: 'stratus',
    module: 'Operate',
    title: 'Agents with guard rails',
    summary:
      'Give an agent the Flux tools and stay in control: which calls only read, which spend and which destroy, and what to approve.',
    minutes: 20,
    kind: 'hands-on',
    prerequisites: ['operate-your-app'],
    labs: ['agent-desk'],
    order: 19,
  },
  {
    id: 'production-checklist',
    track: 'stratus',
    module: 'Architecture',
    title: 'Production checklist and capstone',
    summary: 'Harden the image, set the guard rails and build a complete spec to a written brief.',
    minutes: 15,
    kind: 'project',
    prerequisites: ['multi-component', 'persistent-storage'],
    labs: ['spec-forge'],
    order: 20,
  },
] as const;

// ---------------------------------------------------------------------------
// Labs: standalone tools, also embedded as lesson stages.
// ---------------------------------------------------------------------------

export interface LabMeta {
  id: string;
  title: string;
  summary: string;
  /** Short verb phrase for the call to action, for example "Open the forge". */
  cta: string;
}

export const LABS: readonly LabMeta[] = [
  {
    id: 'spec-forge',
    title: 'Spec Forge',
    summary: 'Build an app spec with live validation, a teaching sidebar and an itemised monthly price.',
    cta: 'Open the forge',
  },
  {
    id: 'network',
    title: 'Network Lab',
    summary:
      'Tiers, countries and blocks read from the Flux network, each with its age, explained as you explore.',
    cta: 'Explore the network',
  },
  {
    id: 'failover',
    title: 'Failover Lab',
    summary: 'In a simulation, place instances, then break nodes and watch traffic find a way through.',
    cta: 'Break something',
  },
  {
    id: 'terminal',
    title: 'Terminal',
    summary:
      'A simulated shell for Docker, DNS lookups and the Flux API, with guided scenarios. Nothing runs on your machine.',
    cta: 'Open the terminal',
  },
  {
    id: 'explorer',
    title: 'App Explorer',
    summary: 'Look up a real app on the network and see which machines run it and in which countries.',
    cta: 'Find a real app',
  },
  {
    id: 'agent-desk',
    title: 'Agent Desk',
    summary:
      'In a simulation, an agent works through a Flux job with real tool names and you approve or refuse each call, then see what it would have cost.',
    cta: 'Take the desk',
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

export function lessonById(id: string): LessonMeta | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function labById(id: string): LabMeta | undefined {
  return LABS.find((l) => l.id === id);
}

export function trackById(id: TrackId): Track {
  const t = TRACKS.find((x) => x.id === id);
  if (!t) throw new Error(`unknown track ${id}`);
  return t;
}

/** Lessons of a track in recommended order. */
export function lessonsOfTrack(id: TrackId): LessonMeta[] {
  return LESSONS.filter((l) => l.track === id).sort((a, b) => a.order - b.order);
}

/** The lesson after `id` in the recommended path, or null at the end. */
export function nextLesson(id: string): LessonMeta | null {
  const sorted = [...LESSONS].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((l) => l.id === id);
  return i >= 0 && i < sorted.length - 1 ? (sorted[i + 1] ?? null) : null;
}

/** Total minutes of a track, for cards. */
export function trackMinutes(id: TrackId): number {
  return lessonsOfTrack(id).reduce((sum, l) => sum + l.minutes, 0);
}
