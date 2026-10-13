# Flux Academy design system

Everything a page needs to look and behave like Flux Academy: dark glass, hairlines, tick
rulers, hex gauges, one accent that re-points at runtime. Import from `@/ui`, never from a
deeper path. The art direction is `docs/DESIGN.md`; this file is the working reference.

- Gallery: `cd web && npx vite`, then open `/kit.html` (standalone) or `/kit` in the app.
  Every component is there in every state. `?only=<section>`, `?accent=cumulus`,
  `?motion=reduced` narrow and theme it.
- Tokens: `web/src/styles/` (`tokens.css` is the single source; the header of that file
  explains the roles).
- Tests: `cd web && npx vitest run src/ui`. Pure logic (geometry, tokenizer, parsers, roving
  focus, age text) is tested; visuals are checked in the gallery.

## 1. Setup

Import the stylesheet once, before any component:

```ts
import '@/styles/index.css';
```

It declares the layer order `reset, tokens, base, ui, route, utility`. Component CSS Modules
sit in `ui`; page CSS Modules should wrap their rules in `@layer route { ... }` so they beat
the primitives without specificity fights.

### What the shell maintains on `<html>`

| Attribute | Values | Effect |
| --- | --- | --- |
| `data-accent` | `flux` (default), `cumulus`, `nimbus`, `stratus` | Re-points every accent role (`--accent`, `--accent-text`, `--accent-solid`, the 100 to 800 scale, glows). The Flux symbol never changes. |
| `data-motion` | `reduced`, `full` | The visitor's effective motion choice. Absent, the OS `prefers-reduced-motion` decides. Durations, travel, stagger and blur collapse under `reduced`. |
| `data-glass` | `lite`, `full` | `lite` drops `backdrop-filter` everywhere and raises fill opacity (low-end GPUs). |
| `data-beat` | `a`, `b` | Alternate on every real block: restarts one of two identical animations that pulse `--flash` from 1 to 0. Tick marks, hairlines and halos read it. Never simulated. |
| `data-scroll-locked` | `true` | Set by the modal stack while a Dialog or Drawer is open. |

`useReducedMotion()` reads the same two inputs, so JS and CSS never disagree.

### Overlay layers

Dialog, Drawer, Popover, Tooltip and Toast portal into `#overlay-root` (created on first use,
outside `#root`) in per-layer containers with the z tokens below. `#root` goes `inert` while a
modal is open; the layers never do.

## 2. Rules for building with it

1. **Roles, not raw colours.** Use `--accent`, `--accent-text`, `--accent-solid`, `--text-1..3`,
   `--ink-0..5`, `--line-1..3`, `--status-*`. Never a hex, never an `--accent-500` in a component.
   Tier colour (`cumulus`, `nimbus`, `stratus`) means tier and track, nothing else. Status
   colour is always paired with a word or a glyph.
2. **Shape is chamfer, never radius.** Panels, buttons and fields are cut corners
   (`--chamfer` 14, `--chamfer-sm` 8, `--chamfer-lg` 22, micro bevel 4). Use `Panel`, or the
   `.chamfer` class with `--c`, `--cm` and `data-cut`. Circles are for the Flux symbol only.
3. **Elevation is lightness and light.** No drop-shadow elevation. Floating things use
   `Surface` (opaque-ish ink, a gradient edge, an accent glow that follows the cuts).
4. **Animate `transform` and `opacity`.** Every motion has a reduced-motion twin that is calm
   but complete (opacity fades, no travel). Use the duration and easing tokens.
5. **Numbers are tabular.** Mono (IBM Plex Mono) for instruments, labels, keys and code;
   Montserrat for display and figures; Open Sans for text; Lora italic at most once a page.
   No text gradient except the hero accent word (`.t-grad`) and `Stat gradient`.
6. **Say how far to trust a number.** Put a `FreshnessChip` next to anything from the network
   (`LIVE 3 s`, `CACHED 2 min`, `OFFLINE last known`, `SIMULATION`). Never a fake zero: `Stat`
   shows `--` for no data.
7. **44 px targets, visible focus, one tab stop.** Composite widgets (Tabs, SegmentedControl,
   StepRail) are one tab stop with arrow keys. Focus is a white-hot rim that sweeps once.
8. **Content is never HTML.** Lesson text goes through `Markup`, which builds React elements
   from a parsed tree. Nothing in `ui/` uses `dangerouslySetInnerHTML`.
9. **`ui/` is self-contained.** It imports nothing from `@/lib`, `@/data` or `@/app`. The app
   passes data in (Markup resolvers, FreshnessChip ages, Toast queue).
10. **Glass is expensive; slabs are cheap.** `Panel` is glass by default (one
    `backdrop-filter`). In lists and dense grids use `variant="slab"` (no blur) or set
    `halo={false}`.

## 3. Tokens

All in `styles/tokens.css`; custom properties on `:root`.

### Colour

| Role | Tokens |
| --- | --- |
| Surfaces (Blue Wave cast, 4 to 6 percent) | `--void`, `--ink-0` to `--ink-5`, `--ink-0-rgb`, `--ink-1-rgb` |
| Lines | `--line-1` (6%), `--line-2` (10%), `--line-3` (18%), `--line-blue` |
| Text | `--text-1` (primary), `--text-2` (body), `--text-3` (meta), `--text-4` (disabled only) |
| Accent (re-pointed by `data-accent`) | `--accent-100` to `--accent-800`; roles `--accent`, `--accent-text`, `--accent-strong`, `--accent-solid` (+ `-hover`, `-active`), `--on-accent`, `--accent-rgb`, `--accent-deep-rgb`, `--accent-hot-rgb`, `--accent-soft`, `--accent-line`, `--accent-glow` |
| Light | `--hot` (white-hot), `--hot-2` (white tinted by the accent), `--blueprint`, `--blueprint-strong`, `--rim-1..3` |
| Tier | `--cumulus` `#36D3FF`, `--nimbus` `#C77DFF`, `--stratus` `#FFC857` (+ `-rgb`), `--tier` and `--tier-rgb` inside `[data-tier]` |
| Status | `--status-ok`, `-pending`, `-warn`, `-crit`, `-off` (+ `-rgb`), `--status` inside `[data-tone]` or `[data-status]` |
| Callouts | `--callout-why`, `-gotcha`, `-tip`, `-wild`, `-cost` |
| Code | `--code-bg`, `-fg`, `-comment`, `-keyword`, `-fn`, `-string`, `-number`, `-key`, `-flag`, `-type`, `-punct` |

Re-theme a subtree: `data-tier="cumulus"`, `data-tone="ok|warn|crit"`, or `Panel tone`.

### Type

Fluid, from one scale: `--fs-2xs` 11 px, `--fs-xs` 12, `--fs-sm` 13, `--fs-md` 15,
`--fs-body` 16 to 17, `--fs-lesson` 17, `--fs-lead` 17 to 21, `--fs-h4` 17, `--fs-h3` 20 to 24,
`--fs-h2` 30 to 56, `--fs-display` 44 to 112, `--fs-stat` 32 to 56, `--fs-code` 14. Composite
shorthands: `--type-display`, `-h2`, `-h3`, `-h4`, `-lead`, `-body`, `-lesson`, `-ui`, `-label`,
`-code`, `-stat`. Lesson measure `--measure` is 62ch.

Utility classes (in `utilities.css`): `.t-display`, `.t-h2`, `.t-h3`, `.t-h4`, `.t-lead`,
`.t-body`, `.t-lesson`, `.t-small`, `.t-label`, `.t-mono`, `.t-num`, `.t-stat`, `.t-accent`,
`.t-grad`, `.t-1`, `.t-2`, `.t-3`, `.link`, `.nowrap`, `.sr-only`, `.sr-only-focusable`,
`.stack`, `.cluster`, `.container` (`data-size="wide|narrow"`), `.hexpill`, `.parallax`.

### Space, size, shape, material

| Group | Tokens |
| --- | --- |
| Space (4 px base) | `--space-half`, `--space-1` to `-8`, `-10`, `-12`, `-16`, `-20`, `-24` |
| Layout | `--container` 1240, `--container-wide` 1520, `--container-narrow` 760, `--gutter`, `--header-h`, `--touch-min` 44 |
| Breakpoints (documented, container-first) | `--bp-phone` 720, `--bp-desktop` 1100, `--bp-wide` 1680; component sizes `--cq-compact` 30rem, `--cq-roomy` 45rem |
| Chamfer | `--chamfer-xs` 5, `--chamfer-sm` 8, `--chamfer` 14, `--chamfer-lg` 22, `--bevel` 4 |
| Blur | `--blur-1` 6, `--blur-2` 12, `--blur-3` 18 (the glass), `--blur-scrim` 4 |
| Elevation and glow | `--elev-0` to `--elev-4`, `--glow-1`, `--glow-2`, `--glow-hot`, `--glow-ok`, `--glow-crit` |
| Z layers | `--z-stage` -1, `--z-backdrop` 0, `--z-page` 1, `--z-raised` 10, `--z-header` 60, `--z-sheet` 70, `--z-overlay` 100, `--z-ambient` 110, `--z-modal` 120, `--z-palette` 130, `--z-toast` 140, `--z-tooltip` 150, `--z-grain` 180 |

### Motion

| Token | Value | Use |
| --- | --- | --- |
| `--dur-1` | 120 ms | hover colour, focus rings |
| `--dur-2` | 220 ms | small UI transitions |
| `--dur-3` | 380 ms | panels, drawers, tooltips |
| `--dur-4` | 700 ms | section reveals, count-ups, step changes |
| `--dur-5` | 1200 ms | camera moves, hero beats |
| `--dur-tick` | 520 ms | odometer digit roll |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | default entrance |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | movement across the screen |
| `--ease-snap` | `cubic-bezier(.2,.9,.2,1.15)` | press release |
| `--stagger` | 60 ms | reveal stagger per item |
| `--reveal-y`, `--reveal-blur` | 24 px, 8 px | reveal travel |
| `--press-scale` | 0.98 | press compression |

Under reduced motion `--dur-3..5` fall to 160, 200 and 240 ms, `--stagger`, `--reveal-y` and
`--reveal-blur` go to 0, and `--dur-tick` to 1 ms.

## 4. Components

Prop tables list what is not obvious. All components forward `className`; those that render an
element also accept that element's native attributes where noted.

### Material

#### `Panel`

The glass slab: chamfered corners, a gradient edge that burns hot on one cut, a faint hex
lattice, grain, corner crosshairs, an optional tick ruler, and a cursor spotlight.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `glass` `slab` `ghost` | `glass` | `slab`: near-opaque, no blur (lists, stacks). `ghost`: edge, ticks, pattern only. |
| `size` | `sm` `md` `lg` | `md` | Chamfer 8, 14, 22 px. |
| `cut` | `tr-bl` `tl-br` `all` `tl` `tr` `bl` `br` `none` | `tr-bl` | The family silhouette is `tr-bl`. |
| `padding` | `none` `sm` `md` `lg` | `md` | `none` for full-bleed media (pair with `clip`). Resets for nested panels. |
| `tone` | `neutral` `ok` `warn` `crit` `cumulus` `nimbus` `stratus` | `neutral` | Recolours edge, pattern, glow for the subtree. |
| `hot` | `tl` `tr` `bl` `br` `none` | from `cut` | Which corner the edge burns hottest at. |
| `pattern` | `tl` `tr` `bl` `br` `none` | `br` | Corner the hex lattice fades in from. |
| `marks` | boolean | `true` | Corner crosshairs. |
| `ruler` | `left` `right` `top` `bottom` `none` | `none` | Tick ruler along an inner edge. |
| `interactive` | boolean | `false` | Spotlight with crosshair, edge catch, press compression. |
| `tilt` | boolean or number | `false` | Up to 5 degrees (needs `interactive`). |
| `halo` | boolean | `true` for glass | The soft accent bloom. |
| `clip` | boolean | `false` | Clip content to the chamfer. |
| `container` | boolean | `false` | Makes it a size container for `@container`. |
| `as` | element | `div` | `a`, `button`, `li`, `article`, `section`; native props pass. |
| `contentClassName` | string | | Class for the inner content wrapper. |

```tsx
<Panel padding="lg" ruler="left" tone="cumulus">...</Panel>
<Panel as="a" href="/learn" interactive tilt>...</Panel>
```

#### `Surface`

The light floating glass under tooltips, popovers and toasts. No blur, no drop shadow.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `sm` `md` `lg` | `md` | Chamfer 6, 10, 14 px. |
| `cut` | as Panel | `tr-bl` | |
| `tone` | as Panel | `neutral` | |
| `glow` | boolean | `true` | |
| `as` | element | `div` | Native props pass. |

### Controls

#### `Button`, `LinkButton`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `primary` `secondary` `ghost` `danger` | `secondary` | Primary is a lit accent slab; ghost grows corner brackets. |
| `tone` | `ok` `warn` `crit` | | Recolours one button. Prefer `variant="danger"`. |
| `size` | `sm` `md` `lg` | `md` | 36, 44, 52 px; touch always gets 44. |
| `icon`, `iconEnd` | `GlyphName` | | Glyph before or after the label. |
| `magnetic` | boolean or number | `true` for primary | Drifts toward a fine pointer, max 6 px. |
| `loading` | boolean | `false` | Spinner, keeps width and name, ignores presses (`aria-busy`). |
| `fullWidth` | boolean | `false` | |
| `href`, `newTab` | string, boolean | | `LinkButton` only. External URLs open in a new tab with `noopener noreferrer`. Disable with `aria-disabled`. |

#### `IconButton`

A `Button` with one glyph. `label` (required) is the accessible name and the tooltip.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `icon` | `GlyphName` | required | |
| `label` | string | required | |
| `shape` | `chamfer` `hex` | `chamfer` | |
| `tooltip` | boolean or node | `true` | Pass a node to say more. |
| `shortcut` | string | | A combo shown in the tooltip, for example `mod+k`. |
| `tooltipPlacement` | placement (see Tooltip) | `top` | |
| `variant`, `size`, `tone`, `loading` | as Button | | |

#### `Chip`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `kind` | `label` `filter` `status` | `label` | `filter` toggles `aria-pressed` when it has `onClick`. |
| `status` | `ok` `pending` `warn` `crit` `off` | | With `kind="status"`. |
| `tier` | `cumulus` `nimbus` `stratus` | | Tier colour and layered tier glyph. |
| `tone` | `neutral` `accent` | `neutral` | |
| `selected` | boolean | | Filter chips. |
| `icon`, `count` | glyph, number or string | | |
| `size` | `sm` `md` | `md` | |

#### `Kbd`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `combo` | string | | `"mod+k"` (Command on a Mac), `"shift+/"`, sequence `"g o"`. Speaks the whole combo. |
| `children` | node | | A single key cap when not using `combo`. |
| `size` | `sm` `md` | `md` | |

#### `Switch`

A native `checkbox` styled as a hex pill. Native input props pass.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `checked`, `defaultChecked`, `onCheckedChange` | | | Controlled or uncontrolled. |
| `children` | node | | The label (or pass `aria-label`). |
| `description` | node | | A line under the label. |
| `size` | `sm` `md` | `md` | |
| `labelPosition` | `start` `end` | `end` | |

#### `Slider`

The control of this site: a hex thumb on a ticked rail with a mono readout, over a real
`<input type="range">`. Arrows, PageUp, PageDown, Home, End and touch are native.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | string | required | Caption and accessible name. |
| `value`, `defaultValue` | number | | Controlled or uncontrolled. |
| `onValueChange` | `(n) => void` | | Continuous while dragging or stepping. |
| `onValueCommit` | `(n) => void` | | When the gesture ends: use it for expensive work. |
| `min`, `max`, `step` | number | 0, 100, 1 | |
| `marks` | boolean or `{value, label?}[]` | | `true` labels the ends. |
| `ticks` | boolean | `true` | Thinned when there are many steps. |
| `format`, `unit` | `(n) => string`, string | | Readout text. |
| `readout` | `header` `bubble` `both` `none` | `header` | |
| `tier` | `cumulus` `nimbus` `stratus` | | |
| `size` | `md` `lg` | `md` | |
| `hint`, `disabled`, `hideLabel`, `name`, `id` | | | |

#### `TextField`, `TextArea`, `SearchField`

One chamfered frame, a mono label, hint and error. The whole frame is the target. Native
input props pass.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | string | required | Placeholders are not labels. |
| `hideLabel` | boolean | | Keeps the name for assistive tech. |
| `hint`, `error` | node | | `error` sets `aria-invalid` and is announced politely. |
| `size` | `md` `lg` | `md` | |
| `mono` | boolean | | Hashes, paths, JSON. |
| `value`, `defaultValue`, `onValueChange` | | | |
| `prefix`, `suffix` | node | | Glyph, unit, button. |
| `autoGrow`, `maxRows` | | | `TextArea`. With `maxLength` it shows a counter. |
| `prompt`, `shortcut`, `onSubmit`, `clearLabel`, `controls` | | | `SearchField`: leading mark, hotkey hint, Enter, clear, `aria-controls`. |

#### `Select`

A native `<select>` in the field frame.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | string | required | |
| `options` | `{value, label, disabled?, group?}[]` | required | Same `group` becomes an `optgroup`. |
| `value`, `defaultValue`, `onValueChange` | | | |
| `placeholder` | string | | Disabled first option. |
| `hint`, `error`, `size`, `hideLabel` | | | |

#### `SegmentedControl`

One tab stop, arrows move and select. A `radiogroup`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `options` | `{value, label?, icon?, count?, ariaLabel?, disabled?}[]` | required | Icon-only options need `ariaLabel`. |
| `value`, `defaultValue`, `onValueChange` | | | |
| `aria-label` | string | required | |
| `size` | `sm` `md` `lg` | `md` | |
| `fullWidth`, `name` | | | |

It drops icons first, then stacks the options, when the container is narrow.

#### `Tabs`, `TabPanel`

`tablist` with roving tabindex. Arrow keys select as they move (or `activation="manual"`).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `{value, label, icon?, count?, disabled?, href?}[]` | required | `href` makes route-backed tabs (links). |
| `value`, `defaultValue`, `onValueChange` | | | |
| `idBase` | string | required | Ids: `${idBase}-tab-${value}`, `${idBase}-panel-${value}`. |
| `aria-label` | string | required | |
| `activation` | `auto` `manual` | `auto` | |
| `variant` | `line` `plate` | `line` | |
| `size` | `sm` `md` | `md` | |
| `fullWidth` | boolean | | |
| `children` | `TabPanel`s | | Panels pick up the selection. `TabPanel` takes `value`, `keepMounted`. |

Overflowing tabs scroll with edge fades and keep the selected tab centred.

### Status

#### `StatusDot`

A hexagonal marker, decorative. Always put the word beside it.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `status` | `ok` `pending` `warn` `crit` `off` | required | |
| `pulse` | boolean | `false` | Live things only. |
| `size` | number | 9 | px |

#### `FreshnessChip`

How far to trust a number: `LIVE 3 s`, `CACHED 2 min`, `OFFLINE last known`, `SIMULATION`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `kind` | `live` `cached` `offline` `simulation` `syncing` `official` `computed` `baked` | `syncing` | `official`, `computed`, `baked` describe the basis of a price. |
| `source` | `live` `cache` `fallback` | | The API's `meta.source`, mapped to a kind. |
| `ageMs` | number or null | | `meta.ageMs`. Rendered as `3 s`, `2 min`, `1 h`. |
| `polling` | boolean | | A LIVE chip whose stream failed but polling works. |
| `hideAge` | boolean | | |

`formatAge(ms)` is exported for the same text elsewhere.

### Overlays

#### `Tooltip`

Hover and keyboard focus (touch does not open it, so essential information never lives only
here). Escape dismisses. The anchor is described by it while open.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `content` | node | required | Short. |
| `children` | one element | required | Must forward props and ref (every primitive does). |
| `placement` | `top` `bottom` `left` `right`, each optionally `-start` or `-end` | `top` | Flips and clamps to the viewport. |
| `delay` | ms | 260 | Keyboard focus is immediate. |
| `shortcut` | string | | A combo as keycaps. |
| `disabled` | boolean | | |

#### `Popover`

A non-modal floating card with a hairline stem and a dot to the trigger. Focus moves in on a
press or key, Tab stays inside, Escape closes and returns focus. It follows the trigger while
the page scrolls and hides (stays open, `visibility: hidden`) while the trigger is wholly out
of the viewport, so it never sticks to a screen edge pointing at nothing.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | one element | required | The trigger (gets `aria-haspopup`, `aria-expanded`). |
| `content` | node | required | May hold links and controls. |
| `title`, `label` | | | `title` names the dialog; `label` when there is no title. |
| `placement` | as Tooltip | `bottom` | |
| `trigger` | `click` `hover` | `click` | `hover` also opens on keyboard focus, closes when focus leaves, and stays open while the pointer is over the card. |
| `open`, `defaultOpen`, `onOpenChange` | | | |
| `width` | px | 320 | |
| `tone` | as Panel | | |

#### `Dialog`, `Drawer`

Modal: focus trapped, `#root` inert, scroll locked, Escape closes, focus returns. Put
`data-autofocus` on the control that should take focus first.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `open`, `onClose` | | required | Controlled. `onClose` for Escape, scrim, close button. |
| `title` | node | required | The accessible name and heading. |
| `description` | node | | |
| `footer` | node | | Sticky footer; primary action last. |
| `dismissOnScrim` | boolean | `true` | Set false for destructive confirms. |
| `hideClose`, `onExited`, `className` | | | |
| `size` (Dialog) | `sm` `md` `lg` | `md` | 420, 560, 760 px. |
| `role` (Dialog) | `dialog` `alertdialog` | `dialog` | |
| `tone` (Dialog) | as Panel | | `crit` for destructive. |
| `side` (Drawer) | `auto` `right` `left` `bottom` | `auto` | `auto`: a right drawer from 720 px, a bottom sheet below (with a drag handle). |
| `width` (Drawer) | `md` `lg` | `md` | 480, 640 px. |
| `actions` (Drawer) | node | | Beside the close button. |

Escape goes to the layer opened last: a popover or tooltip inside a dialog closes first.

#### `Toast`, `ToastViewport`

The toast view. The queue and timers belong to the app (`system/toasts`).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `kind` | `info` `success` `warn` `error` | `info` | The kind word is spoken. |
| `children` | node | required | |
| `icon`, `action` | glyph, `{label, onClick}` | | |
| `duration` | ms | | Draws a time-left hairline; the owner dismisses. |
| `onDismiss` | | | Shows a dismiss button. |
| `onHoldChange` | `(held) => void` | | Pointer over or focus inside: pause your timer (WCAG 2.2.1). |
| `role` | `status` `alert` `none` | by kind | `none` when your host is the live region. |

`ToastViewport` takes `toasts: ToastItem[]` (a `Toast` plus `id`), `onDismiss(id)` and
`position`. It is one polite live region with enter and exit transitions.

### Navigation and flow

#### `Breadcrumbs`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `{label, href?, onNavigate?}[]` | required | The last item is the current page (`aria-current`). |
| `variant` | `label` `text` | `label` | |
| `maxItems` | number | | Fold the middle behind "..." past this many. Otherwise it folds only when it does not fit. |
| `renderLink` | `(props) => node` | | Use your router's `Link`; forward `className` and `children`. |
| `aria-label` | string | `Breadcrumb` | |

#### `Accordion`, `AccordionItem`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `type` | `single` `multiple` | `single` | |
| `value`, `defaultValue`, `onValueChange` | string or string[] | | |
| `collapsible` | boolean | `true` | `single` only. |
| `panelRole` | `region` `none` | `region` | Use `none` past six items. |
| Item `value`, `title` | | required | |
| Item `icon`, `meta`, `disabled`, `level` | | | `meta` is right-aligned mono text; `level` 2 to 6, default 3. |

Up, Down, Home and End move between headers. Panels open by animating `grid-template-rows`.

#### `StepRail`

The lesson player's progress rail; checkpoints wear a hex bead.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `steps` | `{id, label, kind?, state?}[]` | required | `kind: 'check'` for checkpoints. |
| `current` | string | | Steps before are done, after are to do (or give `state`). |
| `onSelect` | `(id, index) => void` | | Makes it interactive: one tab stop, arrows move, Enter selects. Locked steps stay inert. |
| `tier` | tier | | |
| `compact`, `showLabel` | boolean | | Phone density. |
| `aria-label` | string | required | |

### Instruments

Every number is tabular; every status is a word and a glyph as well as a colour.

#### `Progress`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `bar` `ring` `hex` `segments` | `bar` | |
| `value`, `min`, `max` | number | 0, 0, 1 | Omit `value` for indeterminate. |
| `done`, `total` | number | | `segments`: steps done of total. |
| `label` | string | required | |
| `valueText` | string | percent | Spoken and shown: `3 of 8 lessons`. |
| `showLabel`, `showValue` | boolean | bar: true | |
| `size` | `sm` `md` `lg` | `md` | |
| `tier`, `tone` | tier, `ok` `warn` `crit` | | |
| `cells` | number | | `segments` 10, `hex` 12 (0 continuous). |
| `children` | node | | Centre of a ring or hex. |

It fills from empty the first time it is scrolled into view.

#### `Gauge`

A hex dial with a centre number and a status word.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value`, `min`, `max` | number | 0 to 100 | |
| `label` | string | required | Name and caption. |
| `unit`, `decimals`, `format`, `valueText` | | | |
| `size` | `sm` `md` `lg` | `md` | 48, 72, 112 px. |
| `tone` | `accent` `ok` `warn` `crit` `auto` | `accent` | `auto` reads `thresholds`. |
| `thresholds` | `{warn?, crit?}` | 70 and 90 percent | |
| `lowIsBad` | boolean | | Free space, uptime. |
| `limit` | number | | A hard limit tick outside the ring. |
| `startAngle`, `sweep` | degrees | 210, 300 | 360 closes the ring. |
| `tier`, `showLabel`, `children` | | | |

#### `Meter`

A rail of cells with zones, a limit and a target.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value`, `min`, `max`, `label` | | | `label` required. |
| `unit`, `showMax`, `decimals`, `valueText` | | | `3.1 / 4.0 vCPU`. |
| `cells` | number | 20 | |
| `tone`, `thresholds`, `lowIsBad`, `tier` | | | As Gauge. |
| `limit`, `limitLabel` | number, string | | White tick. |
| `target`, `targetLabel` | number, string | | Dashed tick. |
| `size` | `sm` `md` | `md` | |

#### `Stat`

A figure with a caption.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | string | required | Mono caps caption. |
| `value` | node | | A number is formatted and animated; `null` shows `--`. |
| `unit`, `prefix`, `suffix`, `decimals`, `grouping` | | | |
| `animate` | `count` `roll` `false` | `count` | `roll` is the odometer, for live values. |
| `gradient` | boolean | | Hero numbers only. |
| `sub` | node | | Line under the figure. |
| `delta` | `{value, unit?, decimals?, label?, good?}` | | Sign, glyph and word; `good` picks green or red. |
| `freshness` | `FreshnessChipProps` | | |
| `loading` | boolean | | Skeleton, `aria-busy`. |
| `size` | `sm` `md` `lg` | `md` | |
| `tier`, `as`, `children` | | | `as`: `div` `dl` `dl-item`. |

#### `Odometer`, `CountUp`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | number | required | |
| `decimals`, `grouping`, `minDigits`, `prefix`, `suffix` | | 0, true, 1 | |
| `flash` (Odometer) | boolean | `true` | Soft wash when the value changes. |
| `duration` | ms | 520 / 700 | |
| `from` | number | | Where the first roll or count starts. |
| `gradient` (Odometer) | boolean | | |
| `label` (Odometer) | string | | Overrides what assistive tech reads. |
| `immediate` (CountUp) | boolean | | Count on mount, not on scroll into view. |

`Odometer` rolls digits (least significant first); `CountUp` writes the DOM directly and
re-renders nothing.

#### `Sparkline`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `values` | `(number or null)[]` | required | Oldest first. `null` breaks the line. |
| `height` | px | 56 | |
| `min`, `max` | number | data, padded | |
| `target`, `targetLabel` | | | Dashed reference line. |
| `area`, `live`, `showLast`, `interactive` | boolean | true | |
| `formatValue`, `pointLabel`, `label` | | | |
| `tier` | | | |

Interactive: pointer, touch and arrow keys (Home, End, Escape) with a readout.

#### `Skeleton`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `shape` | `line` `block` `circle` `hex` `stat` | `line` | |
| `width`, `height` | number or CSS | by shape | |
| `lines` | number | 1 | |
| `label` | string | | Announces itself (`role="status"`). Without it, mark the container `aria-busy`. |

### Motion

#### `Reveal`, `SplitReveal`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `as` | element | `div` / `span` | |
| `delay`, `index` | ms, number | | `index * 60 ms` added. |
| `direction` (Reveal) | `up` `down` `left` `right` `none` | `up` | |
| `blur` (Reveal) | boolean | `true` | |
| `by` (SplitReveal) | `word` `line` | `word` | |
| `stagger` (SplitReveal) | ms | 40 / 110 | |
| `immediate`, `repeat`, `hold` | boolean | | `hold` waits for an intro. |

Content is visible without JS; the hidden state is set after hydration.

### Lesson prose

#### `Markup`, `MarkupProvider`

Renders the inline markup of `learn/types.ts`: `**bold**`, `*italic*`, `` `code` ``,
`[link](href)`, `{{term:id}}`, `{{lesson:id}}`, `{{lab:id}}`, `{{kbd:Ctrl+K}}`. A parser makes a
small tree and the renderer builds elements; anything unterminated or unsafe stays plain text,
and only `http`, `https`, `mailto` and site-relative links become links.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `text` or `children` | string | | The markup. |
| `block` | boolean | | A paragraph in the lesson voice (17 px, 1.65, 62ch). |
| `inline` | boolean | | Phrasing content for titles and labels; term cards off. |
| `context` | `MarkupContext` | | Overrides the provider. |

`MarkupProvider value={{ term, lesson, lab, navigate }}`: `term(id)` returns
`{term, short, why?, href?}` (a card opens on hover, focus or press), `lesson(id)` and `lab(id)`
return `{title, href}`, `navigate(href)` handles plain clicks on site-relative links. Without
a resolver the renderer falls back to something readable. `parseMarkup` and `stripMarkup` are
exported (both wrap the single parser in `learn/markup.ts`).

A term's display case follows `MarkupContext.term(id)`: it returns `{id, term, short, why?, href?, proper?}`.
The renderer lower-cases a name that is a capital followed by lower case unless it starts a sentence, is
inside a heading, or the entry is `proper`; `{{term:id|lower}}` and `{{term:id|Cap}}` force a case.

#### `TermCard`

The one term card (name, short, why, lessons, related terms, docs link), router-free: the host passes a
`renderLink` slot so it can use its own link component. Used by the glossary page, the command deck and the
Markup popover, so a term looks and reads the same everywhere.

#### `Callout`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `kind` | `why` `gotcha` `tip` `wild` `cost` | required | Tint, glyph and words. A `note` landmark. |
| `title` | node | kind's name | A custom label is read after the kind. |
| `compact` | boolean | | Margins of a step, dense panels. |

#### `CodeBlock`, `CodeBlockSkeleton`

In-house tokenizer for `dockerfile`, `json`, `js`, `ts`, `sh`, `yaml`, `text`. Nothing is
evaluated. The code is real text with real newlines (the gutter is generated), so selecting
and copying by hand gives the source. Shell prompts and output are dimmed and not copied.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `code` | string | required | |
| `lang` | `CodeLang` | `text` | |
| `filename`, `title`, `caption` | | | Header label and caption. |
| `lineNumbers` | boolean | on when multi-line | |
| `startLine` | number | 1 | |
| `highlight` | number[] | | Gutter numbers to emphasise (also read out). |
| `copy`, `onCopy` | boolean, fn | `true` | The result is announced. |
| `wrap` | boolean | `false` | |
| `maxHeight` | px or CSS | | |
| `label` | string | | Name of the scrollable region. |
| `loading`, `skeletonLines` | | | Code-shaped skeleton. |

### Figures

The blueprint layer: callout rings on leader lines, dimension lines, tick rulers, crosshairs
and FIG captions. Strokes draw themselves in (dash offset) once, when scrolled into view.

#### `Figure`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | node | | A diagram, canvas or image; fills the content box. |
| `num`, `caption`, `note` | | | "FIG 3.2", the title, a sentence. |
| `ratio` | string or number | natural | `16 / 9`. |
| `frame` | `panel` `ghost` `none` | `panel` | |
| `ruler` | `left` `right` `top` `bottom` `none` | `none` | |
| `annotations` | `{id, at:[x,y], n?, label?, note?, side?, length?, route?}[]` | | `at` is 0..1 of the content box. |
| `dimensions` | `{from, to, label?, name?, side?, offset?, caps?}[]` | | |
| `legend` | `hidden` `visible` | `hidden` | Hidden is still read, wired with `aria-describedby`. |
| `probe` | boolean or `{format}` | | Reticle with X/Y readout (fine pointers). |
| `compactBelow` | px | 520 | Smaller rings, no labels beside them, legend shown. |
| `draw`, `bleed`, `plateClassName` | | | |

#### Parts for authors drawing inside an SVG

Each takes `draw?`, `delay?`, `duration?` (default: the nearest `DrawContext`).

| Part | Key props |
| --- | --- |
| `LeaderLine` | `from`, `to`, `dot`, `route` (`straight` `elbow`) |
| `CalloutMarker` | `x`, `y`, `n`, `r`, `anchor`, `label`, `labelSide` |
| `Annotation` | `anchor`, `side` (8 sides), `length`, `n`, `label`, `box` (flips to where there is room) |
| `DimensionLine` | `from`, `to`, `label`, `offset`, `side`, `caps`, `extensions`, `box` |
| `Crosshair` | `x`, `y`, `size`, `gap`, `ring` |
| `TickRuler` | `x`, `y`, `length`, `orientation`, `step`, `major`, `side`, `baseline`, `labels` |
| `Annotated` | an `aria-hidden` SVG layer over any content; children may be `(box) => node` |
| `FigCaption` | `num`, `title`, `note` (also usable on its own) |
| `ProbeReticle`, `DrawContext`, `useDraw` | |

### Identity

#### `Logo`

The official Flux marks, inlined verbatim; never recoloured or distorted.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `mark` `round` `lockup` `academy` | `round` | `academy` sets "Flux" 700 and "Academy" 300 live. |
| `tone` | `blue` `white` `black` `gray` | `blue` | The Brand Book colourways and nothing else. Round and lockup use the negative files for the dark UI (`blue`: blue disc, white symbol; `white` and `black`: white disc, blue or black symbol, white wordmark; `gray`: gray disc). Only `mark` and the all-gray lockup read on a light surface. |
| `size` | px | 32 | Symbol height. |
| `title` | string | | Without it the mark is decorative. |
| `clearSpace` | boolean | `false` | Pads by x = symbol diameter / 3.6. |
| `href`, `target`, `rel` | | | Renders as a link. |

#### `Medal`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | string | required | |
| `state` | `locked` `unlocked` `new` | `locked` | `new` plays a one-shot burst. |
| `image`, `imageAvif`, `imageBox` | | | Emissive art on pure black, composited with `screen`. |
| `glyph` | `GlyphName` | | When there is no art. |
| `tier` | tier | | Tier medals only. |
| `size` | px | 96 | |
| `rule` | node | | How to earn it; shown while locked. |
| `showLabel`, `showState` | boolean | true | |

#### `HexBullet`, `HexRing`

`HexBullet`: `size` (9), `filled`, `pulse`, `tone` (`accent` `hot` `muted` `ok` `warn` `crit`).
`HexRing`: `value` 0..1, `segments` (12), `size` (96), `stroke` (5), `tier`, `dim`, `label`
(makes it a `meter`), `animate`, `ticks`, `children` (centre).

#### `Marquee`

`speed` (px/s, 48), `direction`, `gap`, `control` (a visible pause button, WCAG 2.2.2),
`pauseOnHover`, `fade`, `label`. Repeats are `inert` and `aria-hidden`; it is static under
reduced motion.

#### `Backdrop`

The calm lattice behind non-home pages: one seamless tile painted once to a canvas, moved by
compositor animations only (under 1 percent CPU idle), paused when the tab is hidden, static
under reduced motion, hidden under forced colours.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `intensity` | 0..1 | 1 | |
| `dim` | 0..1 | 0.35 | Recede behind content; adds a vignette. |
| `drift` | multiple | 1 | 1.5 px/s base; 0 holds still. |
| `fps` | number | 4 | Ticks per second of the drift; 0 is continuous. |
| `paused` | boolean | | |
| `contained` | boolean | | Fill the nearest positioned ancestor, not the viewport. |

Content above it must be `position: relative` to paint over it.

#### `Glyph`

131 custom glyphs on a 24 unit grid (1.5 unit stroke, square caps, mitred joins, hex-derived
angles), colour from `currentColor`. `<Glyph name="status-ok" size={20} title="Healthy" />`.
`GLYPH_NAMES`, `GLYPH_GROUPS` and `isGlyphName` are exported. Groups: tracks and tiers, lesson
kinds, labs, status, actions, arrows, network, containers, money, time, interface,
achievement marks. Lucide is for generic chrome only.

## 5. Hooks

| Hook | Returns | Notes |
| --- | --- | --- |
| `useReducedMotion()` | boolean | `html[data-motion]` or the OS setting. Prefer CSS; use it where JS drives motion. |
| `useMagnetic(ref, {strength, field, enabled})` | | Writes `--mx`, `--my` (px). Fine pointers, not under reduced motion. |
| `useTilt(ref, {max, enabled})` | | Writes `--rx`, `--ry` (deg), `--tilt-on`. |
| `useSpotlight(ref, {enabled})` | | Writes `--px`, `--py` (px), `--pxp`, `--pyp` (0..1); sets `data-hover`. |
| `useInView(ref, {once, rootMargin, threshold})` | boolean | |
| `useReveal(ref, {immediate, repeat, hold, rootMargin})` | boolean | Style on `data-shown`. |
| `useCountUp(target, {duration, from, immediate, enabled})` | `{value, ref}` | Re-renders per frame; prefer `CountUp` for big text. |
| `useElementSize(ref)` | `{width, height}` | |
| `useMedia(query)`, `usePointerFine()`, `useIsDesktop()`, `useIsPhone()` | boolean | |
| `usePresence(open, exitMs)` | `{mounted, state}` | `closed` `enter` `open` `exit`. |
| `useFocusTrap(ref, {active, onEscape, restoreFocus, initialFocus})` | | What Dialog and Drawer use. |
| `useControllableState(value, default, onChange)` | `[value, set]` | |

## 6. Accessibility contract

- Keyboard: every control is reachable and operable; composite widgets are one tab stop
  with arrows, Home and End; Escape closes the top-most floating layer; modals trap focus,
  mark `#root` `inert`, lock scroll and restore focus.
- Names: icon-only controls require a label; progress, gauges, meters and sparklines require
  one; status is a word as well as a colour; decorative glyphs are `aria-hidden`.
- Contrast: AA for text on every accent and ink; `--text-4` is for disabled and decoration only.
- Targets: 44 px minimum (the `sm` size grows on touch); text frames are fully clickable.
- Motion: no animation runs longer than 5 s without a control (Marquee has a visible pause);
  the focus beam is one-shot; every transform animation has a reduced-motion twin.
- Forced colours and `prefers-contrast: more`: every primitive has a rule; decoration (pattern,
  grain, marks, backdrop) is hidden, edges become `ButtonText`, focus becomes `Highlight`.
- Live regions: `ToastViewport` and `CodeBlock` copy results are polite live regions; errors
  use `role="alert"`.

## 7. Performance notes

- One `backdrop-filter` per glass panel; use `slab` and `halo={false}` in lists. `data-glass="lite"`
  removes them all.
- Pointer effects share one pointer loop that sleeps when nothing is near. No React renders on
  pointer move: hooks write custom properties.
- `Backdrop` paints once; the drift is a compositor animation ticking at 4 fps by default, so
  the main thread is idle.
- Fonts are latin subsets with `font-display: swap`; a typical page loads about 116 KB of
  woff2.

## 8. Adding to the system

1. A folder per primitive: `Name/Name.tsx`, `Name.module.css`, tests for pure logic.
2. CSS: start the file with `@layer reset, tokens, base, ui, route, utility;` and wrap rules in
   `@layer ui`. Tokens only. Keep specificity ascending (state selectors after base) or use
   `:where()` for hover so focus and selected out-rank it.
3. Add a reduced-motion twin (`html[data-motion="reduced"]` and the media query) and a
   forced-colours rule for anything that animates or carries meaning in colour.
4. Export from `index.ts` (add, never rename).
5. Add a gallery section in `kit/sections/NN-name.tsx` exporting `meta` and a default
   component, with every state (the `data-force="hover|press|focus"` hooks force pseudo-states).
6. `npm run typecheck`, `npx biome check --write src/ui src/styles`, `npx vitest run src/ui`.
