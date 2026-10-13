/**
 * The deck's catalog of things you can run: lessons, labs, reference pages, glossary terms, pages and
 * actions. Pure. Everything about a lesson, lab or page comes from `shared/` and the glossary registry;
 * nothing is typed in twice. Each item carries its prepared search fields so ranking a keystroke never
 * repeats string work.
 *
 * The Reference's own entries (a field, a lint code, an endpoint) and the troubleshooting answers (a
 * symptom, an error message, a lint code) are not in this catalog: they are large, so they load on demand
 * and arrive as `deep` items (`deep.ts`), scored by the same search the pages use.
 */

import { LABS, LESSONS, TRACKS, trackById } from '@shared/curriculum';
import { allRoutes } from '@shared/site';
import { plainText, type TermResolver } from '@/learn/markup';
import type { GlossaryTerm } from '@/learn/types';
import { categoryLabel } from '@/routes/glossary/model';
import { ACCENTS, type AccentId, unlockRule } from '@/system/prefs';
import type { GlyphName } from '@/ui';
import { prepare, type ScoredField } from './fuzzy';

export type DeckKind = 'lesson' | 'lab' | 'reference' | 'fix' | 'term' | 'page' | 'action';
export type DeckGroupId = 'recent' | DeckKind;

export const GROUP_ORDER: readonly DeckGroupId[] = [
  'recent',
  'action',
  'lesson',
  'lab',
  'reference',
  'fix',
  'page',
  'term',
];

export const GROUP_LABEL: Record<DeckGroupId, string> = {
  recent: 'Recent',
  action: 'Actions',
  lesson: 'Lessons',
  lab: 'Labs',
  reference: 'Reference',
  fix: 'Fix it',
  page: 'Pages',
  term: 'Glossary',
};

export type DeckTile = { glyph: GlyphName } | { text: string } | { swatch: string };

export type ActionId =
  | 'resume'
  | 'ambient'
  | 'ambient-auto'
  | 'sound'
  | 'motion'
  | 'copy-link'
  | 'shortcuts'
  | 'ask'
  | `accent:${AccentId}`;

export interface DeckItem {
  /** Unique and stable: `lesson:first-deploy`, `term:replica`, `action:sound`. Used for recents. */
  id: string;
  kind: DeckKind;
  /** The lesson id, lab id, term id, path or action id this item stands for. */
  ref: string;
  title: string;
  /** One line under the title. */
  subtitle: string;
  /** Right-hand muted text: the track, the category. */
  meta?: string;
  /** The longer text for assistive tech and the term card. */
  description: string;
  tile: DeckTile;
  /** A short mono tag: "Done", "Locked", "Simulation". */
  badge?: string;
  badgeTone?: 'ok' | 'warn' | 'accent';
  /** For settings: the current state, shown as a chip. */
  state?: 'on' | 'off' | 'current';
  /** Keys that do the same thing from the page: ['g', 'c']. */
  chord?: readonly string[];
  /** Enter opens something in a new tab. */
  external: boolean;
  /** The deck stays open after this runs (settings that are nice to flip and watch). */
  keepOpen?: boolean;
  /** Not worth remembering in Recent (toggles and mode switches). */
  transient?: boolean;
  /**
   * Found by the lazily loaded Reference or troubleshooting search rather than by the catalog's fuzzy
   * match: it arrives with its score, and the ranking caps how many a group shows.
   */
  deep?: boolean;
  /** Where Enter goes, for navigation items. */
  to?: string;
  fields: ScoredField[];
  /** Prepared title and subtitle for highlighting. */
  titleP: ReturnType<typeof prepare>;
  subtitleP: ReturnType<typeof prepare>;
}

const W = { title: 1, alias: 0.85, secondary: 0.7, sub: 0.45, long: 0.22 } as const;

function field(text: string | null | undefined, weight: number, loose = true): ScoredField[] {
  return text ? [{ field: prepare(text), weight, loose }] : [];
}

type ItemInput = Omit<DeckItem, 'fields' | 'titleP' | 'subtitleP'> & {
  aliases?: readonly string[];
  secondary?: ReadonlyArray<string | null | undefined>;
  long?: string;
};

function item(base: ItemInput): DeckItem {
  const { aliases = [], secondary = [], long, ...rest } = base;
  const fields: ScoredField[] = [
    ...field(rest.title, W.title),
    ...aliases.flatMap((a) => field(a, W.alias)),
    ...secondary.flatMap((s) => field(s, W.secondary)),
    ...field(rest.subtitle, W.sub, false),
    ...field(long ?? rest.description, W.long, false),
  ];
  return { ...rest, fields, titleP: prepare(rest.title), subtitleP: prepare(rest.subtitle) };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ActionState {
  accent: AccentId;
  sound: boolean;
  /** Start ambient mode after 120 s idle. */
  autoAmbient: boolean;
  /** The effective reduced motion setting. */
  reducedMotion: boolean;
  /** Which accents the learner has unlocked. */
  unlocked: Readonly<Record<AccentId, boolean>>;
}

export interface DeckContext {
  completed: ReadonlySet<string>;
  started: ReadonlySet<string>;
  /** The lesson Resume goes to (in progress, else the first not done), or null when everything is done. */
  resumeLesson: string | null;
  /** Whether the learner has started anything yet. */
  hasStarted: boolean;
  actions: ActionState;
  terms: readonly GlossaryTerm[];
}

/** The chords from the global hotkeys, by destination (kept here so a hint never disagrees with a key). */
export const GO_CHORDS: Readonly<Record<string, readonly string[]>> = {
  '/': ['g', 'h'],
  '/learn': ['g', 'c'],
  '/labs': ['g', 'l'],
  '/reference': ['g', 'r'],
  '/glossary': ['g', 'g'],
  '/troubleshoot': ['g', 't'],
  '/profile': ['g', 'p'],
};

// ---------------------------------------------------------------------------
// Lessons, labs, pages
// ---------------------------------------------------------------------------

const LAB_TILE: Record<string, GlyphName> = {
  'spec-forge': 'lab-forge',
  network: 'lab-network',
  failover: 'lab-failover',
  terminal: 'lab-terminal',
  explorer: 'lab-explorer',
  'agent-desk': 'lab-agent-desk',
};

/** Labs whose numbers and outcomes are simulated, so the deck says so beside the name. */
const LAB_SIMULATION = new Set(['failover', 'terminal', 'agent-desk']);

function lessonItems(ctx: DeckContext): DeckItem[] {
  return [...LESSONS]
    .sort((a, b) => a.order - b.order)
    .map((l) => {
      const done = ctx.completed.has(l.id);
      const active = !done && ctx.started.has(l.id);
      const track = trackById(l.track);
      return item({
        id: `lesson:${l.id}`,
        kind: 'lesson',
        ref: l.id,
        to: `/learn/${l.id}`,
        title: l.title,
        subtitle: l.summary,
        meta: `${track.name} · ${l.minutes} min`,
        description: `${l.summary} ${l.minutes} minutes, ${track.name} track.`,
        tile: { text: String(l.order).padStart(2, '0') },
        badge: done ? 'Done' : active ? 'In progress' : undefined,
        badgeTone: done ? 'ok' : 'accent',
        external: false,
        aliases: [l.id.replace(/-/g, ' '), `${track.name} ${l.module}`, track.name],
        secondary: [l.module],
      });
    });
}

function labItems(): DeckItem[] {
  return LABS.map((l) =>
    item({
      id: `lab:${l.id}`,
      kind: 'lab',
      ref: l.id,
      to: `/labs/${l.id}`,
      title: l.title,
      subtitle: l.summary,
      meta: 'Lab',
      description: l.summary,
      tile: { glyph: LAB_TILE[l.id] ?? 'layers' },
      badge: LAB_SIMULATION.has(l.id) ? 'Simulation' : undefined,
      external: false,
      aliases: [l.id.replace(/-/g, ' '), l.cta, 'lab'],
    }),
  );
}

function referenceItems(): DeckItem[] {
  const routes = allRoutes().filter(
    (r) => r.kind === 'reference' || r.kind === 'glossary' || r.kind === 'troubleshoot',
  );
  return routes.map((r) =>
    item({
      id: `reference:${r.path}`,
      kind: 'reference',
      ref: r.path,
      to: r.path,
      title: r.title,
      subtitle: r.description,
      meta: r.kind === 'reference' ? 'Reference' : r.kind === 'glossary' ? 'Glossary' : 'Fix it',
      description: r.description,
      tile: { glyph: r.kind === 'troubleshoot' ? 'help' : r.kind === 'glossary' ? 'search' : 'layers' },
      chord: GO_CHORDS[r.path],
      external: false,
      aliases: [r.path.replace(/^\//, '').replace(/[/-]+/g, ' ')],
    }),
  );
}

function pageItems(): DeckItem[] {
  const pages: ReadonlyArray<{ path: string; title: string; subtitle: string; aliases: string[] }> = [
    { path: '/', title: 'Home', subtitle: 'The live network and where to start', aliases: ['start', 'top'] },
    {
      path: '/learn',
      title: 'Course map',
      subtitle: `${TRACKS.length} tracks, ${LESSONS.length} lessons`,
      aliases: ['learn', 'lessons', 'curriculum', 'tracks', 'path'],
    },
    {
      path: '/labs',
      title: 'Labs',
      subtitle: 'Hands-on tools for Flux',
      aliases: ['tools', 'playground', 'lab'],
    },
    {
      path: '/profile',
      title: 'Your progress',
      subtitle: 'Rank, achievements, certificate and preferences',
      aliases: ['profile', 'rank', 'xp', 'achievements', 'settings', 'preferences', 'certificate'],
    },
  ];
  return pages.map((p) =>
    item({
      id: `page:${p.path}`,
      kind: 'page',
      ref: p.path,
      to: p.path,
      title: p.title,
      subtitle: p.subtitle,
      description: p.subtitle,
      tile: { glyph: p.path === '/' ? 'ambient' : p.path === '/profile' ? 'spark' : 'layers' },
      chord: GO_CHORDS[p.path],
      external: false,
      aliases: p.aliases,
    }),
  );
}

// ---------------------------------------------------------------------------
// Glossary
// ---------------------------------------------------------------------------

function termItems(terms: readonly GlossaryTerm[]): DeckItem[] {
  // A term inside another's definition reads as its name, with the same case rules the renderers apply.
  const byId = new Map(terms.map((t) => [t.id, t] as const));
  const resolve: TermResolver = (id) => byId.get(id);
  return terms.map((t) => {
    const short = plainText(t.short, resolve);
    const why = plainText(t.why, resolve);
    return item({
      id: `term:${t.id}`,
      kind: 'term',
      ref: t.id,
      title: t.term,
      subtitle: short,
      meta: categoryLabel(t.category),
      description: `${short} ${why}`,
      tile: { text: t.term.charAt(0).toUpperCase() },
      external: false,
      // A term opens its card in place, so it is not worth remembering as a destination.
      transient: false,
      keepOpen: true,
      aliases: [t.id.replace(/-/g, ' '), ...(t.aka ?? [])],
      long: `${short} ${why}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const ACCENT_SWATCH: Record<AccentId, string> = {
  flux: '#2b61d1',
  cumulus: '#36d3ff',
  nimbus: '#c77dff',
  stratus: '#ffc857',
};

const ACCENT_NAME: Record<AccentId, string> = {
  flux: 'Flux blue',
  cumulus: 'Cumulus cyan',
  nimbus: 'Nimbus violet',
  stratus: 'Stratus gold',
};

function actionItems(ctx: DeckContext): DeckItem[] {
  const a = ctx.actions;
  const out: DeckItem[] = [];

  const resumeTitle = ctx.resumeLesson
    ? ctx.hasStarted
      ? `Resume: ${LESSONS.find((l) => l.id === ctx.resumeLesson)?.title ?? 'your lesson'}`
      : 'Start the first lesson'
    : 'Review the course map';
  out.push(
    item({
      id: 'action:resume',
      kind: 'action',
      ref: 'resume',
      to: ctx.resumeLesson ? `/learn/${ctx.resumeLesson}` : '/learn',
      title: resumeTitle,
      subtitle: ctx.resumeLesson
        ? ctx.hasStarted
          ? 'Pick up where you stopped'
          : 'Seven minutes: what Flux is and why it has three tiers'
        : 'Everything is done. Go back over any lesson.',
      description: 'Continue learning.',
      tile: { glyph: 'play' },
      external: false,
      aliases: ['continue', 'learn', 'start', 'next lesson'],
    }),
    item({
      id: 'action:ask',
      kind: 'action',
      ref: 'ask',
      title: 'Ask the network',
      subtitle: 'block, nodes, price, tiers, or quote 2 4000 20 3',
      description: 'Answers from live data: the block height, node counts, the FLUX price and a quick quote.',
      tile: { glyph: 'terminal' },
      external: false,
      keepOpen: true,
      transient: true,
      aliases: ['query', 'terminal', 'block', 'nodes', 'price', 'tiers', 'quote', 'height'],
    }),
    item({
      id: 'action:ambient',
      kind: 'action',
      ref: 'ambient',
      title: 'Enter ambient mode',
      subtitle: 'The bench, full screen, with facts. Any key wakes it.',
      description: 'A calm full screen view of the network. Press any key to leave.',
      tile: { glyph: 'ambient' },
      chord: ['a'],
      external: false,
      transient: true,
      aliases: ['screensaver', 'idle', 'calm', 'full screen', 'wallpaper'],
    }),
    item({
      id: 'action:sound',
      kind: 'action',
      ref: 'sound',
      title: 'Sound effects',
      subtitle: a.sound
        ? 'On. Soft clicks and a chime on every block.'
        : 'Off. Turn on soft clicks and a block chime.',
      description: 'Turn interface sounds on or off.',
      tile: { glyph: a.sound ? 'sound-on' : 'sound-off' },
      state: a.sound ? 'on' : 'off',
      external: false,
      keepOpen: true,
      transient: true,
      aliases: ['audio', 'mute', 'unmute', 'volume', 'noise'],
    }),
    item({
      id: 'action:motion',
      kind: 'action',
      ref: 'motion',
      title: 'Reduce motion',
      subtitle: a.reducedMotion
        ? 'On. Transitions and animation are calm.'
        : 'Off. Turn on to calm animation.',
      description: 'Reduce animation and transitions across the Academy.',
      tile: { glyph: 'motion-off' },
      state: a.reducedMotion ? 'on' : 'off',
      external: false,
      keepOpen: true,
      transient: true,
      aliases: ['animation', 'accessibility', 'calm', 'less motion', 'a11y'],
    }),
    item({
      id: 'action:ambient-auto',
      kind: 'action',
      ref: 'ambient-auto',
      title: 'Start ambient mode when idle',
      subtitle: a.autoAmbient ? 'On. After two minutes without input.' : 'Off. The page stays as it is.',
      description: 'Enter ambient mode automatically after two minutes without input.',
      tile: { glyph: 'clock' },
      state: a.autoAmbient ? 'on' : 'off',
      external: false,
      keepOpen: true,
      transient: true,
      aliases: ['idle', 'screensaver', 'auto'],
    }),
  );

  for (const id of ACCENTS) {
    const unlocked = a.unlocked[id] === true;
    out.push(
      item({
        id: `action:accent:${id}`,
        kind: 'action',
        ref: `accent:${id}`,
        title: `Accent: ${ACCENT_NAME[id]}`,
        subtitle: unlocked ? 'Recolour the Academy' : unlockRule(id),
        description: unlocked ? `Use the ${ACCENT_NAME[id]} accent.` : unlockRule(id),
        tile: { swatch: ACCENT_SWATCH[id] },
        state: a.accent === id ? 'current' : undefined,
        badge: unlocked ? undefined : 'Locked',
        badgeTone: 'warn',
        external: false,
        keepOpen: true,
        transient: true,
        aliases: ['accent', 'colour', 'color', 'theme', id],
      }),
    );
  }

  out.push(
    item({
      id: 'action:copy-link',
      kind: 'action',
      ref: 'copy-link',
      title: 'Copy link to this page',
      subtitle: 'Puts the address on the clipboard',
      description: 'Copy the address of the current page.',
      tile: { glyph: 'copy' },
      external: false,
      transient: true,
      aliases: ['share', 'url', 'address', 'clipboard'],
    }),
    item({
      id: 'action:shortcuts',
      kind: 'action',
      ref: 'shortcuts',
      title: 'Show keyboard shortcuts',
      subtitle: 'Every key that does something',
      description: 'Open the list of keyboard shortcuts.',
      tile: { glyph: 'keyboard' },
      chord: ['?'],
      external: false,
      transient: true,
      aliases: ['keys', 'hotkeys', 'help', 'keyboard'],
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------------

export function buildItems(ctx: DeckContext): DeckItem[] {
  return [
    ...actionItems(ctx),
    ...lessonItems(ctx),
    ...labItems(),
    ...referenceItems(),
    ...pageItems(),
    ...termItems(ctx.terms),
  ];
}

/** Track display names, for tests and the term card. */
export const TRACK_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  TRACKS.map((t) => [t.id, t.name]),
);
