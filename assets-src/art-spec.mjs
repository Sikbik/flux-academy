// Single source of truth for the generated artwork: prompts, post-processing and manifest data.
//
// Adapted from fluxcommunity/assets-src/art-spec.mjs (same owner, MIT): same prompt anatomy (style prefix,
// subject, lighting rig, frame, forbidden list) and the same house rules, with the Academy's pieces.
//
// Read by:
//   web/scripts/generate-art.mjs   builds the prompt and calls scripts/imagegen.mjs
//   web/scripts/optimize-art.mjs   turns assets-src/raw/<id>.png into web/public/art/<id>.webp|avif
//                                  and rewrites assets-src/art-manifest.json and web/src/content/art.ts
//
// Human readable record of what worked and what did not: assets-src/PROMPTS.md (generated from this file).
//
// House rules (docs/DESIGN.md section 9): no logos, no text, no UI, no people, no scenery, no Flux symbol.
// One accent colour per piece. Pure black background so `mix-blend-mode: screen` is seamless.

/** The style prefix from docs/DESIGN.md section 9, verbatim. `{accent}` is the only substitution. */
export const STYLE_PREFIX =
  'Dark glass and frosted crystal hexagonal forms with {accent} edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery';

export const ACCENTS = {
  flux: 'electric royal blue (#2B61D1)',
  cumulus: 'vivid cyan (#36D3FF)',
  nimbus: 'luminous violet (#C77DFF)',
  stratus: 'saturated amber gold (#FFC857)',
};

/** Shared lighting rig and lens, so every piece reads as one render. */
const RIG = (accentName) =>
  `Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin ${accentName} emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are ${accentName}, white and black.`;

const FRAMES = {
  square:
    'Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.',
  landscape:
    'Frame: landscape 3:2. The composition is centred and symmetrical, with a generous empty black margin where the glow falls off smoothly to pure black #000000 before any edge.',
  wide: 'Frame: wide 16:9. The composition is centred and symmetrical. The image falls off to pure black #000000 toward all four edges through a strong vignette, so every edge and every corner is pure black.',
};

/** The bench is the one piece that depicts the tiers, so it may carry their three colours as sparse tints. */
const RIG_BENCH =
  'Lighting rig: the key light is a soft glow from beneath, a white-hot rim light traces the upper edges of the tallest pillars, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The colours are electric royal blue (#2B61D1) for almost everything, white and black, and only the few tier pillars described above in vivid cyan (#36D3FF), luminous violet (#C77DFF) and saturated amber gold (#FFC857).';

/** For subjects that must float in a perfectly empty void (no plate, no floor). */
const FORBID_VOID =
  'Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.';

/** For subjects that carry their own floating plate or base (a map plate, a build table, a pillar field). */
const FORBID_OBJECT =
  'Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.';

/** For pieces that are themselves a surface or a scene (the bench plate, the backdrops). */
const FORBID_BASIC =
  'Strictly forbidden: any text, letters, numbers, symbols or logos; any people or hands; any frame, border or watermark; any bright or coloured background. Everything outside the subject is pure black #000000.';

const FORBID = { void: FORBID_VOID, object: FORBID_OBJECT, basic: FORBID_BASIC };

/**
 * One shared medal body, so the twelve medals are one family. Only the emblem changes. `{accent}` is the
 * piece accent. Rank medals (the three track medals) add a ring of studs.
 */
const MEDAL_BODY =
  'A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright {accent} emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters.';
/** Appended when a medal is generated with the first-light medal attached as the body reference. */
const MEDAL_REF_NOTE =
  'Reference image: the attached image shows the exact medal body to reproduce, the same regular six-sided hexagonal shape with one vertex pointing up, the same bevelled rim width, thickness, frosted glass material, edge light, camera angle and size in the frame. Replace only the emblem in the centre with the emblem described above. Do not copy the reference emblem.';
const MEDAL_REFS = ['assets-src/raw/medal-first-light.png'];
const MEDAL_RANK =
  ' This is a rank medal: a second outer ring of twelve small hexagonal studs surrounds the rim.';

/**
 * @typedef {object} Piece
 * @property {string} id           file stem and manifest key
 * @property {'tracks'|'modules'|'labs'|'atmosphere'|'medals'|'social'} group
 * @property {'flux'|'cumulus'|'nimbus'|'stratus'} accent
 * @property {'square'|'landscape'|'wide'|'raw'} frame   which composition paragraph to append
 * @property {string} subject      what is in the picture ({accent} is substituted)
 * @property {'void'|'object'|'basic'} [forbid]   which forbidden list (default void)
 * @property {boolean|string} [rig]  false to leave out the shared lighting rig paragraph (sprites); a string replaces it
 * @property {string} [refNote]    appended to the prompt when `refs` are attached
 * @property {string[]} [refs]     repo-relative reference images passed to Codex with -i
 * @property {string} alt          description for screen readers; '' when decorative
 * @property {string} [desc]       what a decorative piece shows (for README and PROMPTS, not shipped to the page)
 * @property {boolean} [decorative]
 * @property {'screen'|'normal'} blend
 * @property {number} w            output width in px
 * @property {number} h            output height in px
 * @property {{fill?: number, height?: number, baseline?: number}} [fit]
 *                                 auto-fit (square pieces): fill = longest side of the lit subject as a
 *                                 fraction of the frame, centred; height + baseline = bottom-anchored
 *                                 (height of the subject and the y of its base as fractions of the frame)
 * @property {object} [post]       post-processing: feather, featherX, featherY (edge mask, fraction of the
 *                                 size, 0 = none), black (percent crushed), alpha, gray, centerBrightRow
 * @property {number} [maxKB]      per file budget (default 120, sprites 60)
 * @property {boolean} [ship]      false = build input only: kept as assets-src/<id>.webp, not in the manifest
 * @property {string[]} [notes]    what happened, in order; rendered into PROMPTS.md
 */

/** @type {Piece[]} */
export const PIECES = [
  // ------------------------------------------------------------------ tracks
  {
    id: 'track-cumulus',
    group: 'tracks',
    accent: 'cumulus',
    frame: 'square',
    forbid: 'object',
    subject:
      'A small compact cluster of five hexagonal crystal prisms of different heights, fused together at their bases and rising from one shared thick hexagonal base slab: one central prism a little taller than the four around it, each prism capped with a faceted pointed tip like quartz. A small, proud, low group, the smallest of a three-part series. The frosted glass is tinted vivid cyan and glows from inside with white-hot edges. Seen from a slightly elevated three-quarter angle.',
    alt: 'A compact cluster of five cyan glass crystals rising from a hexagonal base',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { height: 0.55, baseline: 0.92 },
    post: { feather: 0.04 },
    notes: [
      'Take 1 shipped. Five quartz-like prisms on a hexagonal base slab: the base slab was not asked for, but it echoes the bench pillars.',
      'Framed with `fit: { height, baseline }` so the three tracks share one baseline and rise in height (cumulus short, nimbus mid, stratus tall).',
    ],
  },
  {
    id: 'track-nimbus',
    group: 'tracks',
    accent: 'nimbus',
    frame: 'square',
    forbid: 'object',
    subject:
      'A double-hex tower: a tower of exactly two stacked true six-sided hexagonal prisms of faceted frosted glass, a wide lower tier and a narrower upper tier set on top of it with a thin glowing hexagonal ring plate between them. Each tier has six rectangular side faces, and the upper tier ends in a flat hexagonal top face with a clearly visible hexagon outline. Mid-height, the middle of a three-part series, about twice as tall as it is wide. Not square boxes, not rectangular cuboids. The glass glows from inside in luminous violet with white-hot edges. Seen from a slightly elevated three-quarter angle.',
    alt: 'A two-tier hexagonal glass tower glowing violet from within',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { height: 0.7, baseline: 0.92 },
    post: { feather: 0.04 },
    notes: [
      "Take 1 shipped. Spelling out 'two stacked true six-sided prisms' and forbidding 'square boxes, rectangular cuboids' (the lesson from the Community portal's tier-nimbus, whose first take came back as square boxes) gave a clean two-tier hexagonal tower first time.",
    ],
  },
  {
    id: 'track-stratus',
    group: 'tracks',
    accent: 'stratus',
    frame: 'square',
    forbid: 'object',
    subject:
      'A tall faceted spire: a slender tower made of five stacked, stepped hexagonal tiers, each tier a six-sided prism narrower than the one below, tapering to a sharp faceted pointed tip, with one thin bright ring floating around its upper part. The tallest of a three-part series, about five times as tall as it is wide. The glass body is tinted deep saturated golden amber and glows from inside with rich warm amber light, with white-hot edges. Strongly saturated amber, not cream, not beige, not white, not yellow-green. Seen from a slightly elevated three-quarter angle.',
    alt: 'A tall faceted hexagonal glass spire glowing amber from within',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { height: 0.84, baseline: 0.92 },
    post: { feather: 0.04 },
    notes: [
      "Take 1 shipped. 'Deep saturated golden amber, not cream, not beige, not white' and the accent name 'saturated amber gold' (both from the Community portal's stratus take 2) kept the colour amber on the first try.",
    ],
  },

  // ----------------------------------------------------------------- modules
  {
    id: 'mod-network',
    group: 'modules',
    accent: 'flux',
    frame: 'square',
    subject:
      'A glass globe built entirely from hexagonal cells: a sphere assembled from many small hexagonal tiles of dark frosted glass like a faceted honeycomb ball, each tile separated by a hairline gap that leaks blue light, a handful of tiles glowing brighter, and two thin arcs of blue light flying across its surface between bright nodes. One thin tilted ring orbits it. Hovering alone.',
    alt: 'A globe assembled from hexagonal glass cells with arcs of blue light across its surface',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.74 },
    notes: [
      'Take 1 shipped. The hairline gaps between cells leaking light is what sells the globe as built from hexagons.',
    ],
  },
  {
    id: 'mod-containers',
    group: 'modules',
    accent: 'flux',
    frame: 'square',
    subject:
      'A staggered stack of four wide flat glass blocks, each about two and a half times as wide as it is tall, like the layers of a container image, alternately offset a little to the left and to the right. Each block is dark frosted glass with a bright blue emissive seam around its edges, two or three thin hexagonal layer plates visible inside it and a faintly lit hexagonal core. The top block is lifted a little above the rest with a thin beam of light between them. The stack is wider than it is tall. Seen in isometric three-quarter view from slightly above.',
    alt: 'A staggered stack of four wide layered glass blocks with glowing seams, the top one lifted slightly',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.74 },
    notes: [
      'Take 1 was a thin vertical column of four cubes: tidy, but only about a quarter of the frame wide and light next to the other plates.',
      'Take 2 (shipped) asks for wide flat blocks (about 2.5 times as wide as tall), alternately offset, wider than tall: it fills the frame and reads as image layers.',
    ],
  },
  {
    id: 'mod-setup',
    group: 'modules',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject:
      'A hex key and a plate: a thick hexagonal plate of dark frosted glass floating at a slight tilt, with a glowing hexagonal socket in its centre, and above it a hex key, an Allen wrench: a straight bar of faceted clear glass with a six-sided cross-section, bent at one sharp right angle with a crisp mitred corner into a long arm and a short arm of equal thickness, like the L-shaped tool that ships with flat-pack furniture. The short arm points straight down into the socket and the long arm extends sideways. A white-hot rim traces its edges. Bright blue light spills from the socket.',
    alt: 'A glass hex key hovering above a hexagonal plate with a glowing hexagonal socket',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.74 },
    notes: [
      'Take 1 had a rounded elbow: the key read as a bent pipe hovering over the plate.',
      "Take 2 (shipped) asks for one sharp mitred right angle, 'like the L-shaped tool that ships with flat-pack furniture', and a short arm pointing into the socket: it reads as an Allen key seated in its socket.",
    ],
  },
  {
    id: 'mod-deploy',
    group: 'modules',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject:
      'A single large chunky hexagonal glass prism, about one fifth of the frame wide and one third of the frame tall, standing on a wide hexagonal plinth at the lower centre and launching three bold thick arcs of bright blue light: the arcs rise from its top face in smooth parabolic curves that fly up and outward to the left, to the right and to the upper centre, each ending in a large bright glass cube in mid-flight and trailing fine light particles. A soft glow pools at the plinth.',
    alt: 'A chunky hexagonal glass prism launching three arcs of blue light that end in glass cubes',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.74 },
    notes: [
      'Take 1 was a thin pillar under three thin arcs with small cubes: spindly, with far less visual weight than its neighbours.',
      'Take 2 (shipped) asks for a chunky prism about a fifth of the frame wide, bold thick arcs and large cubes.',
    ],
  },
  {
    id: 'mod-traffic',
    group: 'modules',
    accent: 'flux',
    frame: 'square',
    subject:
      'Three hexagonal gate frames, thick open rings of dark frosted glass shaped like regular hexagons, like portals, standing one behind the other in one-point perspective along the centre line of the frame, seen head-on from slightly above, so they read as three nested hexagonal rings shrinking toward a vanishing point at the centre, the nearest the largest and brightest. Many ribbons of blue light flow from the bottom of the frame through all three openings toward the vanishing point, fanning out near the viewer and converging through the gates, with small bright packets of light travelling along them. Symmetrical and centred.',
    alt: 'Ribbons of blue light flowing through three receding hexagonal glass gates',
    blend: 'screen',
    w: 640,
    h: 640,
    post: { feather: 0.13 },
    notes: [
      'Take 1 put the gates on a diagonal, small and pushed into a corner, with the ribbons trailing off to the lower left.',
      'Take 2 (shipped) asks for one-point perspective on the centre line, nested rings shrinking to a vanishing point, symmetrical: the best of the set. The ribbons run off the bottom of the frame, so this piece skips auto-fit and relies on a wide edge feather (13 percent) instead.',
    ],
  },
  {
    id: 'mod-projects',
    group: 'modules',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject:
      'A floating hexagonal build table: a thick hexagonal slab of dark frosted glass with a faint grid of hex cells etched into its top, on which stand three finished glass forms side by side, a hexagonal prism, a cube and a faceted dome, each joined to its neighbour by a thin seam of blue light, with two small loose tiles hovering above them as if being fitted into place. Isometric three-quarter view from above.',
    alt: 'A floating hexagonal build table holding three assembled glass forms and two tiles about to be fitted',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.74 },
    notes: [
      "Take 1 shipped. The floating build table with a prism, a cube and a dome, and two loose tiles, reads as 'things you assemble'.",
    ],
  },
  {
    id: 'mod-operate',
    group: 'modules',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject:
      'A compact cluster of console dials on one small hexagonal panel of dark frosted glass: one large round dial in the centre with a ring of tick marks and an arc of blue light with a pointer, two medium dials beside it, two small hexagonal knobs below and a short row of three slider bars. All the controls are glass with blue emissive arcs. No numbers, no labels, no text on anything.',
    alt: 'A hexagonal glass control panel with a cluster of glowing dials, knobs and sliders',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.74 },
    notes: [
      "Take 1 shipped. 'No numbers, no labels, no text on anything' held: the dials carry only tick marks and arcs.",
    ],
  },
  {
    id: 'mod-resilience',
    group: 'modules',
    accent: 'flux',
    frame: 'square',
    subject:
      'A shield built from seven large hexagonal plates of dark frosted glass joined edge to edge in a honeycomb, one in the centre and six around it, curved slightly toward the viewer, with three bright impact bursts of white-hot light where bolts of blue light strike its face, ripples of blue light radiating outward through the plates from each impact and a few small shards flying off. The shield is intact and unbroken.',
    alt: 'A shield of seven hexagonal glass plates absorbing three bursts of light',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.74 },
    notes: ['Take 1 shipped. Three impact bursts with ripples and shards on a seven-plate honeycomb shield.'],
  },
  {
    id: 'mod-state',
    group: 'modules',
    accent: 'flux',
    frame: 'square',
    subject:
      'A large faceted vault crystal: a hexagonal bipyramid of clear frosted glass with a bright core, floating upright at the centre, ringed by three thin tilted concentric rings of blue light at different heights, the sync rings, each ring carrying one small bright node. A soft pool of blue glow beneath it.',
    alt: 'A faceted glass vault crystal ringed by tilted rings of blue light that each carry a bright node',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.74 },
    notes: ['Take 1 shipped. Rings around a faceted bipyramid; the glow pool underneath anchors it.'],
  },
  {
    id: 'mod-architecture',
    group: 'modules',
    accent: 'flux',
    frame: 'square',
    subject:
      'A thin hexagonal frame of glass, an open hexagon ring standing upright like a picture frame, holding inside it four glass prisms of different shapes and sizes, a tall hexagonal prism, a cube, a small hexagonal bipyramid and a short hexagonal puck, linked to each other by thin straight beams of blue light that form a small network diagram in three dimensions.',
    alt: 'Four glass prisms linked by beams of blue light inside a hexagonal glass frame',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.74 },
    notes: [
      'Take 1 shipped. A hexagon frame holding four linked prisms reads as an architecture diagram in glass.',
    ],
  },

  // -------------------------------------------------------------------- labs
  {
    id: 'lab-spec-forge',
    group: 'labs',
    accent: 'flux',
    frame: 'square',
    subject:
      'A glowing forge anvil built entirely from stacked hexagonal plates of dark frosted glass: a wide hexagonal base plate, a narrower hexagonal waist block, and a long flat top face with a pointed horn on one side, assembled from visible hex slabs with thin glowing gaps. A white-hot glowing hexagonal ingot sits on the flat top, and a fountain of blue sparks and tiny glowing hexagonal flakes flies up from it.',
    alt: 'An anvil assembled from hexagonal glass plates with a white-hot ingot and rising blue sparks',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.74 },
    notes: [
      'Take 1 shipped. The anvil built from visible hexagonal slabs with a white-hot ingot and rising flakes.',
    ],
  },
  {
    id: 'lab-network',
    group: 'labs',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject:
      'A floating flat hexagonal map plate: a wide hexagonal slab of dark glass whose top is covered by hundreds of tiny hexagonal cells forming abstract continent shapes, lit blue at the edges. About eight hexagonal pillars of different heights rise from it, the tallest white-hot at the top, with two thin arcs of blue light connecting the tallest pillars. Isometric view from above at about 35 degrees.',
    alt: 'A floating hexagonal plate bearing a world map of tiny hexagonal cells, with glowing pillars rising from it, linked by an arc of light',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.82 },
    notes: [
      "Take 1 shipped. Asked for 'abstract continent shapes', the model drew a recognisable world map out of tiny hex cells, which suits the Network Lab.",
    ],
  },
  {
    id: 'lab-failover',
    group: 'labs',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject:
      'A tight field of about twenty hexagonal pillars of different heights standing in a honeycomb grid on a small floating hexagonal base, all with blue edge light, except one pillar near the centre which is completely dark, unlit and cracked, a dead node. Two arcs of blue light curve over the dark pillar from one lit pillar to another, rerouting around it.',
    alt: 'A field of glowing hexagonal pillars with one dark pillar and arcs of light curving around it',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.8 },
    notes: [
      'Take 1 shipped. The dead pillar reads as black and cracked among the lit ones, with the two rerouting arcs over it.',
    ],
  },
  {
    id: 'lab-terminal',
    group: 'labs',
    accent: 'flux',
    frame: 'square',
    subject:
      'A thick chamfered rectangular slab of dark frosted glass, wider than it is tall (about 4:3 proportions), standing upright and tilted slightly back like a terminal window, with two diagonally cut corners at the top right and the bottom left. In its upper-left area a bold luminous prompt chevron, a right-pointing angle bracket shape, followed by a short flat horizontal underscore cursor bar sitting at the baseline, in white-hot and blue light, like a command prompt, and below them two faint dim horizontal bars of light. No letters, no characters, no numbers anywhere.',
    alt: 'A slab of dark glass with a glowing prompt chevron and a cursor bar',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.74 },
    notes: [
      "Take 1 was a portrait slab with a chevron followed by a vertical bar: it read as a media 'skip' icon on a page.",
      'Take 2 (shipped) asks for a wide 4:3 slab and a flat underscore cursor: it reads as a command prompt.',
    ],
  },
  {
    id: 'lab-explorer',
    group: 'labs',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject:
      'A large round glass lens, a magnifying glass with a thick ring of faceted clear glass and a short handle, floating at an angle above a field of small hexagonal pillars standing on a floating hexagonal base. Inside the lens circle the pillars appear larger and brightly lit blue with two of them white-hot; outside the lens they are dim and dark.',
    alt: 'A glass magnifying lens over a field of small hexagonal pillars, lighting the ones inside it',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.8 },
    notes: ['Take 1 shipped. Lens lighting only the pillars inside it.'],
  },
  {
    id: 'lab-agent-desk',
    group: 'labs',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject:
      'A hexagonal glass desk with one large gate floating above it. The desk is a wide, thick slab of dark frosted glass shaped like a regular six-sided hexagon, seen with one flat side facing the viewer and a corner pointing to the left and to the right, so that exactly three side faces of the slab are visible, with chamfered bevels, a faint grid of hex cells etched into its top face and a bright blue emissive seam around its edge, standing on a short, much narrower hexagonal foot block. Floating just above the centre of the desk is a single gate: a thick open frame of faceted clear glass shaped like a regular six-sided hexagonal ring, about three fifths as wide as the desk, standing perfectly upright like a doorway, with no tilt and no lean, its bottom side lying level above the desk top and its plane turned away from the viewer by about 40 degrees so that we look through its opening at an angle, with a bright blue emissive edge and a white-hot highlight along its top edge. One single hexagonal prism, a chunky crystal bar with a six-sided cross-section, about as long as the gate is wide and about three times as long as it is thick, passes straight through the opening of the gate at right angles to the plane of the gate, with its front end sticking out toward the viewer and its back end sticking out behind the gate. The prism glows white-hot from its core, the brightest thing in the picture, blooming softly and casting a pool of blue-white light on the desk below. The gate and the prism are the only objects above the desk. Isometric three-quarter view from above at about 35 degrees.',
    alt: 'A hexagonal glass desk with a ring-shaped gate floating above it and one bright prism passing through the gate',
    blend: 'screen',
    w: 640,
    h: 640,
    fit: { fill: 0.78 },
    notes: [
      "Take 1 put a hexagonal desk under an upright hexagonal frame with a bar through it. It is the calmest take and the only early one with a true six-sided desk, but the gate was a third of the desk's width and the bar pale glass, so at 120 px it read as a plinth with a speck on it.",
      'Take 2 swapped the frame for a round ring: the model cut it like a gemstone and it read as jewellery, on an octagonal desk. Rejected.',
      'Take 3 laid the ring flat around an upright bar: it read as a collar on a post (a fountain), on an octagonal desk. Rejected.',
      "Take 4 asked for a gate three fifths as wide as the desk and a chunky bar as long as the gate is wide, 'white-hot from its core, the brightest thing in the picture': the focal point was right, but the desk came back octagonal again and the gate tumbled on its side.",
      "Take 5 (shipped) keeps those size and brightness cues and pins the desk pose the way the medals pin theirs: 'one flat side facing the viewer and a corner pointing to the left and to the right, so that exactly three side faces are visible' gave a true hexagon, where 'regular six-sided hexagon with exactly six sides' alone had not. The gate still leans a little, which reads as floating rather than fixed.",
    ],
  },

  // -------------------------------------------------------------- atmosphere
  {
    id: 'bg-bench',
    group: 'atmosphere',
    accent: 'flux',
    frame: 'raw',
    forbid: 'basic',
    rig: RIG_BENCH,
    subject:
      'The bench, a horizon plate: a wide field of small hexagonal pillars of dark frosted glass of varied heights, seen from a low three-quarter angle with strong depth. The nearest pillars are large and softly out of focus along the bottom, and the field recedes in perspective toward a hazy horizon line in the middle of the frame. The pillars are edge-lit in electric blue, with white-hot tops on the tallest ones and heavy volumetric haze along the horizon. A few pillars are lit in the three tier colours, like a legend: some of the shorter ones glow vivid cyan, some of the middle-height ones glow luminous violet and a few of the tallest ones glow saturated amber gold, scattered unevenly and not mirrored. The upper 40 percent of the frame is an empty black void. The field fades to pure black toward the left, right and bottom edges, so it floats as a soft glowing band across the middle of the frame. The composition is asymmetrical, with the tallest cluster slightly left of centre. Wide frame, 16:9. No sky, no mountains, no sun.',
    desc: 'A hazy horizon plate of glass hexagonal pillars receding into the dark, a few lit in the three tier colours',
    alt: '',
    decorative: true,
    blend: 'screen',
    w: 1600,
    h: 900,
    maxKB: 120,
    post: { feather: 0.1 },
    notes: [
      'Take 1 was single-accent blue: moody, hazy, white-hot tops, but dark and with no sense of the tiers. Kept in assets-src/raw/_prev.',
      'Take 2 added a few cyan, violet and amber pillars (short, mid, tall, like the bench legend): colourful but the model mirrored the layout and flattened the depth.',
      "Take 3 (shipped) asks for strong depth (large out-of-focus foreground pillars), an asymmetrical layout with the tallest cluster left of centre, and a custom rig paragraph that allows the three tier tints. The one piece that breaks 'one accent': it depicts the tiers, as ref-bench does.",
    ],
  },
  {
    id: 'sprite-bokeh',
    group: 'atmosphere',
    accent: 'flux',
    frame: 'raw',
    rig: false,
    subject:
      'A single soft hexagonal bokeh highlight, like a camera lens aperture highlight: a perfectly regular hexagon with softly rounded corners, a flat even interior of pale blue-white light at about 70 percent brightness, a slightly brighter thin rim, and a softly blurred outer edge. Centred, about 60 percent of the frame width. No bright core, no hot spot, no gradient toward the centre, a flat even fill. Nothing else, no noise, no grain, on a flat pure black background.',
    desc: 'A soft hexagonal bokeh highlight (real alpha from luminance)',
    alt: '',
    decorative: true,
    blend: 'screen',
    w: 256,
    h: 256,
    maxKB: 60,
    post: { alpha: true },
    notes: [
      "Take 1 shipped, using the Community portal's take-2 wording (flat even interior at about 70 percent, brighter thin rim): a bokeh highlight, not a glow. Alpha is derived from luminance in post.",
    ],
  },
  {
    id: 'sprite-streak',
    group: 'atmosphere',
    accent: 'flux',
    frame: 'raw',
    rig: false,
    subject:
      'A single anamorphic lens-flare streak and nothing else. One perfectly straight, razor-thin horizontal line of light runs across the entire width of the frame from the left edge to the right edge, exactly at the vertical centre. It is about 1 percent of the frame height thick, white-hot at the very centre, shifting to electric blue toward both ends and fading smoothly to black before it reaches the left and right edges, with a very faint soft glow around it. It is not a hexagon, there are no shapes, no dots, no other light, on a flat pure black background.',
    desc: 'A thin horizontal anamorphic light streak, white-hot at the centre (real alpha from luminance)',
    alt: '',
    decorative: true,
    blend: 'screen',
    w: 512,
    h: 64,
    maxKB: 60,
    post: { alpha: true, centerBrightRow: true, featherX: 0.3, featherY: 0.35 },
    notes: [
      "Take 1 shipped, using the Community portal's wording that says 'it is not a hexagon' (the style prefix otherwise pulls the model toward hexagons).",
      'Post: crop an 8 to 1 band centred on the brightest row, fade both ends, derive alpha from luminance.',
    ],
  },
  {
    id: 'sprite-dirt',
    group: 'atmosphere',
    accent: 'flux',
    frame: 'raw',
    rig: false,
    subject:
      'A lens dirt texture: fine dust specks, smudges, tiny hairlines and a few soft fingerprint-like arcs, rendered as soft pale blue-white blooms of scattered light on a flat pure black background. Uneven distribution, denser toward the corners and sparse in the centre, high contrast. No objects, no pattern, no text.',
    desc: 'A grayscale lens-dirt texture of dust, smudges and fingerprints on black, for the stage post pass',
    alt: '',
    decorative: true,
    blend: 'screen',
    w: 960,
    h: 640,
    maxKB: 60,
    post: { gray: true, feather: 0 },
    notes: [
      'Take 1 shipped. Grayscale with no edge mask (the dust runs to the edges on purpose; it is a post-processing texture). Resized to 960x640 to stay under the 60 KB sprite budget.',
    ],
  },

  // ------------------------------------------------------------------ medals
  {
    id: 'medal-first-light',
    group: 'medals',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY} Emblem: a single white-hot point of light at the exact centre, like the first spark of dawn, with one thin vertical beam of light rising from it to the upper edge of the field and three faint concentric hexagonal rings around it.`,
    alt: 'A hexagonal glass medal with a single point of white light and one rising beam at its centre',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: [
      'Take 1 shipped, and is the body reference for the medals generated after it (`refs`). A true hexagon with a thick bevelled rim, a recessed field and a luminous emblem.',
    ],
  },
  {
    id: 'medal-three-is-company',
    group: 'medals',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY} Emblem: three small solid hexagonal glass gems of equal size arranged in a triangle, one at the top and two at the bottom, joined to each other by thin glowing lines, the triangle centred in the field.`,
    alt: 'A hexagonal glass medal showing three linked hexagonal gems in a triangle',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: ['Take 1 shipped. Three linked hexagonal gems in a triangle.'],
  },
  {
    id: 'medal-first-blood',
    group: 'medals',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY} Emblem: one hexagonal glass tile in the centre split in two by a bright jagged diagonal crack, the two halves slightly apart with white-hot light leaking through the crack and a few tiny shards drifting away.`,
    alt: 'A hexagonal glass medal showing a hexagonal tile split by a bright jagged crack',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: ['Take 1 shipped. A hexagonal tile split by a bright crack, shards drifting away.'],
  },
  {
    id: 'medal-spec-whisperer',
    group: 'medals',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY} Emblem: six short horizontal bars of light stacked in a column like the lines of a configuration file, of clearly different lengths in an irregular rhythm with two of them indented to the right, so the group looks like lines of code and not like a letter, all glowing a clean steady blue, with a small bright hexagonal node at the end of one of the bars. Abstract bars of light only, no letters, no characters.`,
    refs: MEDAL_REFS,
    refNote: MEDAL_REF_NOTE,
    alt: 'A hexagonal glass medal showing a stack of horizontal bars of light like lines of a spec',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: [
      "Take 1 came back as a heptagon (seven sides) and its five left-aligned bars of equal height read as the letter 'E'.",
      "Take 2 (shipped) attaches the first-light medal as the body reference ('same regular six-sided shape') and asks for six bars of clearly different lengths in an irregular rhythm, so they read as lines of a spec and not a glyph.",
    ],
  },
  {
    id: 'medal-penny-pincher',
    group: 'medals',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY} Emblem: a pair of tweezers made of faceted clear glass, two thin angled arms joined at the top, pinching a small hexagonal coin (a thin hexagonal disc with one inner concentric hexagon ring, no numerals, no symbols) between their tips at the bottom, with a bright spark of light squeezed out at the contact points.`,
    refs: MEDAL_REFS,
    refNote: MEDAL_REF_NOTE,
    alt: 'A hexagonal glass medal showing glass tweezers pinching a small hexagonal coin',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: [
      'Take 1 (a hexagonal coin held by two clamp jaws) read as a hex nut in a belt buckle.',
      'Take 2 (shipped) uses glass tweezers pinching a small hexagonal coin, with the body reference attached.',
    ],
  },
  {
    id: 'medal-block-watcher',
    group: 'medals',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY} Emblem: an eye made of light, an almond-shaped outline with a hexagonal iris and a bright pupil at its centre, and beneath it a row of three small glass cubes joined by a thin line, like three blocks in a chain.`,
    alt: 'A hexagonal glass medal showing an eye of light above a chain of three small cubes',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: ["Take 1 shipped. An eye made of light over a chain of three cubes ('three blocks in a row')."],
  },
  {
    id: 'medal-globetrotter',
    group: 'medals',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY} Emblem: a globe made of hexagonal cells at the centre, large and bold, filling most of the medal field, with one thin tilted orbit ring around it carrying a tiny bright node, and three bright pins of light on its surface joined by a thin glowing arc.`,
    refs: MEDAL_REFS,
    refNote: MEDAL_REF_NOTE,
    alt: 'A hexagonal glass medal showing a globe of hexagonal cells with an orbit ring and three linked pins of light',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: [
      'Take 1 had a small, dim globe lost in the field.',
      'Take 2 (shipped) asks for a large bold globe filling most of the field and joins the three pins with an arc, with the body reference attached.',
    ],
  },
  {
    id: 'medal-shell-shocked',
    group: 'medals',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY} Emblem: a bold right-pointing prompt chevron (an angle bracket shape) at the left and, to its right at the baseline, a short flat horizontal underscore cursor bar lying low, like a command prompt, in white-hot light, with two small forks of electric light jumping between the chevron and the cursor like a static shock. The cursor is a flat horizontal bar, not a vertical bar. No letters, no characters.`,
    refs: MEDAL_REFS,
    refNote: MEDAL_REF_NOTE,
    alt: 'A hexagonal glass medal showing a glowing prompt chevron and cursor with sparks of electricity',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: [
      "Take 1 drew a chevron followed by a vertical bar, the universal 'next track' icon.",
      'Take 2 (shipped) asks for a flat underscore cursor lying low next to the chevron, with a spark between them, and attaches the body reference.',
    ],
  },
  {
    id: 'medal-explorer',
    group: 'medals',
    accent: 'flux',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY} Emblem: a round glass lens (a magnifying glass, a thick ring with a short handle toward the lower right) with three tiny hexagonal pillars standing visible inside the lens and lit bright white-hot and blue.`,
    alt: 'A hexagonal glass medal showing a magnifying lens over three small hexagonal pillars',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: [
      'Take 1 shipped. Deliberately the same lens-over-pillars motif as lab-explorer, so the medal and its lab read as one thing.',
    ],
  },
  {
    id: 'medal-cumulus-operator',
    group: 'medals',
    accent: 'cumulus',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY}${MEDAL_RANK} Emblem: a small compact cluster of five hexagonal crystal prisms of different heights fused together on a small hexagonal base, one central prism a little taller than the four around it, each with a faceted pointed tip, glowing vivid cyan from inside.`,
    alt: 'A hexagonal cyan glass rank medal showing a small cluster of five crystals',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: [
      'Take 1 shipped. Rank medals add a ring of twelve hexagonal studs and use the tier colour; the emblem repeats the track emblem.',
    ],
  },
  {
    id: 'medal-nimbus-engineer',
    group: 'medals',
    accent: 'nimbus',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY}${MEDAL_RANK} Emblem: a double-hex tower of exactly two stacked true six-sided hexagonal prisms, a wide lower tier and a narrower upper tier with a thin glowing ring plate between them, glowing luminous violet from inside.`,
    alt: 'A hexagonal violet glass rank medal showing a two-tier hexagonal tower',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: ['Take 1 shipped.'],
  },
  {
    id: 'medal-stratus-architect',
    group: 'medals',
    accent: 'stratus',
    frame: 'square',
    forbid: 'object',
    subject: `${MEDAL_BODY}${MEDAL_RANK} Emblem: a tall faceted spire of five stacked stepped hexagonal tiers tapering to a sharp pointed tip with one thin bright ring around its upper part, glowing deep saturated golden amber from inside. Strongly saturated amber, not cream, not beige, not white.`,
    alt: 'A hexagonal amber glass rank medal showing a tall faceted spire',
    blend: 'screen',
    w: 384,
    h: 384,
    fit: { fill: 0.82 },
    notes: ["Take 1 shipped. The same 'not cream, not beige' wording kept the amber saturated."],
  },

  // ------------------------------------------------------------------ social
  {
    id: 'og-backdrop',
    group: 'social',
    accent: 'flux',
    frame: 'raw',
    forbid: 'basic',
    subject:
      'A wide cinematic scene with the weight on the right half. A field of small hexagonal pillars of dark frosted glass of varied heights rises toward the right, lit from beneath in electric blue with white-hot tops on the tallest, and above it a single larger glass hexagonal prism, the specimen, hovers right of centre with three thin arcs of blue light curving down from it onto three of the tall pillars, with volumetric haze. The left 40 percent of the frame is almost empty, deep black, calm, reserved for text. Everything fades to pure black toward the top, the bottom and the left. All important content sits within the central 60 percent band of the frame height. Wide frame, about 2:1.',
    alt: '',
    decorative: true,
    blend: 'normal',
    w: 1800,
    h: 900,
    maxKB: 150,
    ship: false,
    post: { feather: 0 },
    notes: [
      'Take 1 shipped. Not shipped to the site: web/scripts/build-og.mjs composites the real lockup and real text over it. The left 40 percent is empty on purpose.',
    ],
  },
  {
    id: 'og-backdrop-square',
    group: 'social',
    accent: 'flux',
    frame: 'raw',
    forbid: 'basic',
    subject:
      'A square cinematic scene with the weight in the upper right two thirds. A field of small hexagonal pillars of dark frosted glass of varied heights rises from the lower right, lit from beneath in electric blue with white-hot tops on the tallest, and above it a single larger glass cube, the specimen, hovers right of centre in the upper half with three thin arcs of blue light curving down from it onto three of the tall pillars, with volumetric haze. The whole left third and the whole lower-left quadrant of the frame are almost empty, deep black and calm, reserved for text. Everything fades to pure black toward the top, the left and the bottom-left. Square frame, 1:1.',
    alt: '',
    decorative: true,
    blend: 'normal',
    w: 1200,
    h: 1200,
    maxKB: 150,
    ship: false,
    post: { feather: 0 },
    notes: [
      'Take 1 shipped. Cropping the wide backdrop for the 1200x1200 card upscaled it 1.33x and put the busy part under the text, so the square card gets its own composition: art upper right, empty lower left for the title.',
    ],
  },
  {
    id: 'certificate-backdrop',
    group: 'social',
    accent: 'flux',
    frame: 'landscape',
    forbid: 'basic',
    subject:
      'A calm, formal, ornamental plate for a certificate: a symmetrical frame of thin luminous hairlines and a double border with diagonally cut chamfered corners, a narrow pattern band of tiny hexagons running along all four edges, four corner ornaments built from small hexagonal tiles, and a small ornament of three joined hexagons centred on the top edge. The rectangular frame has the same 3:2 proportions as the canvas, its width exactly one and a half times its height, and sits centred with an equal margin of about 4 percent of the canvas on every side. The whole centre 65 percent of the plate is empty deep near-black with only a very faint honeycomb texture and a soft vignette. Thin electric blue lines on black, no filled colour areas, no seal, no ribbon, no medal.',
    desc: 'A calm ornamental frame of hexagonal tiles and a honeycomb band around an empty dark centre',
    alt: '',
    decorative: true,
    blend: 'normal',
    w: 1500,
    h: 1000,
    maxKB: 120,
    fit: { fill: 0.94 },
    post: { feather: 0 },
    notes: [
      'Take 1 drew a frame at about 1.9:1 sitting high in the 3:2 canvas.',
      "Take 2 (shipped) asks for a frame with the canvas's own 3:2 proportions and equal margins; the model still drew about 1.7:1, so auto-fit centres it (`fit: { fill: 0.94 }`) and the plate is used as an opaque 'normal' backdrop.",
    ],
  },
];

/** The full text sent to the image model for a piece. */
export function buildPrompt(piece) {
  const accentName = ACCENTS[piece.accent] ?? ACCENTS.flux;
  const frame = FRAMES[piece.frame];
  const forbid = FORBID[piece.forbid ?? 'void'];
  const parts = [
    `${STYLE_PREFIX.replace('{accent}', accentName)}.`,
    `Subject: ${piece.subject.replaceAll('{accent}', accentName)}`,
  ];
  if (typeof piece.rig === 'string') parts.push(piece.rig);
  else if (piece.rig !== false) parts.push(RIG(accentName));
  if (frame) parts.push(frame);
  if (piece.refs?.length && piece.refNote) parts.push(piece.refNote);
  parts.push(forbid);
  return parts.join('\n\n');
}

/** Pieces that belong to the manifest (everything except build inputs). */
export const SHIPPED = PIECES.filter((p) => p.ship !== false);
