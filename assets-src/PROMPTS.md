# Prompts

The exact prompts behind every generated piece, the file each produced, and what each take taught us.
This file is generated: edit `assets-src/art-spec.mjs`, then run
`node web/scripts/generate-art.mjs --prompts-md`.

## How a prompt is built

Every prompt is `style prefix` + `Subject` + `lighting rig` + `frame` + `forbidden list`, so the whole set
shares one lens, one lighting rig and one black. Pieces that use a reference image add one more
paragraph that says what to take from it. The wrapper (`scripts/imagegen.mjs`) adds one line asking the
tool to return a single image; the result is picked from that run's own Codex thread directory.

**Style prefix** (docs/DESIGN.md section 9, verbatim; `{accent}` is the only substitution):

> Dark glass and frosted crystal hexagonal forms with {accent} edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery

**Accents**

- `flux`: electric royal blue (#2B61D1)
- `cumulus`: vivid cyan (#36D3FF)
- `nimbus`: luminous violet (#C77DFF)
- `stratus`: saturated amber gold (#FFC857)

Raw generations are 1254 px squares or 1536 to 1774 px wide frames. `web/scripts/optimize-art.mjs`
auto-fits the lit subject (consistent scale and centring across a group), crushes the black floor,
applies an edge mask and encodes WebP and AVIF.

## What the takes taught us, in general

- A generation takes about 35 s at `--effort low`; four in parallel is comfortable. The look targets were
  not attached as references: the style prefix, the rig and the subject alone reached the Academy look.
- Name the shape and forbid the wrong one. "Two stacked true six-sided prisms, not square boxes" and "a
  regular six-sided hexagon with one vertex up" worked; a bare "double-hex" or "hexagonal medal" did not
  (square boxes, a heptagon).
- Say how saturated a colour is and what it is not: "deep saturated golden amber, not cream, not beige,
  not white" kept the stratus pieces amber.
- Composition words the model obeys: "wider than tall", "about a fifth of the frame wide", "one-point
  perspective along the centre line, symmetrical", "large out-of-focus pillars along the bottom". One it
  only half obeys: the proportions of an inner frame (the certificate frame stays near 1.7:1).
- Look-alike glyphs: left-aligned bars of similar length read as the letter E, and a chevron followed by
  a vertical bar is the media "next" icon. Vary the lengths, and use a flat underscore cursor.
- A reference image pins a set. The first medal, attached with "replace only the emblem", fixed the body
  (shape, rim, camera) of the medals generated after it; without it one came back as a heptagon.
- Anything lit that touches the raw frame is faded in the raw before auto-fit, otherwise re-framing would
  expose a hard cut. Ribbons that run off the frame (mod-traffic) skip auto-fit and use a wide feather.
- Subjects with their own plate (a build table, a map, a pillar field) use the "floats alone in a void"
  forbidden list, not the "no floor, no tabletop" one.

## Pieces

### tracks

#### track-cumulus

- Produces: `web/public/art/track-cumulus.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/track-cumulus.png` (not in git), accent `cumulus`, blend `screen`
- Takes:
  - Take 1 shipped. Five quartz-like prisms on a hexagonal base slab: the base slab was not asked for, but it echoes the bench pillars.
  - Framed with `fit: { height, baseline }` so the three tracks share one baseline and rise in height (cumulus short, nimbus mid, stratus tall).

```text
Dark glass and frosted crystal hexagonal forms with vivid cyan (#36D3FF) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A small compact cluster of five hexagonal crystal prisms of different heights, fused together at their bases and rising from one shared thick hexagonal base slab: one central prism a little taller than the four around it, each prism capped with a faceted pointed tip like quartz. A small, proud, low group, the smallest of a three-part series. The frosted glass is tinted vivid cyan and glows from inside with white-hot edges. Seen from a slightly elevated three-quarter angle.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin vivid cyan (#36D3FF) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are vivid cyan (#36D3FF), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### track-nimbus

- Produces: `web/public/art/track-nimbus.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/track-nimbus.png` (not in git), accent `nimbus`, blend `screen`
- Takes:
  - Take 1 shipped. Spelling out 'two stacked true six-sided prisms' and forbidding 'square boxes, rectangular cuboids' (the lesson from the Community portal's tier-nimbus, whose first take came back as square boxes) gave a clean two-tier hexagonal tower first time.

```text
Dark glass and frosted crystal hexagonal forms with luminous violet (#C77DFF) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A double-hex tower: a tower of exactly two stacked true six-sided hexagonal prisms of faceted frosted glass, a wide lower tier and a narrower upper tier set on top of it with a thin glowing hexagonal ring plate between them. Each tier has six rectangular side faces, and the upper tier ends in a flat hexagonal top face with a clearly visible hexagon outline. Mid-height, the middle of a three-part series, about twice as tall as it is wide. Not square boxes, not rectangular cuboids. The glass glows from inside in luminous violet with white-hot edges. Seen from a slightly elevated three-quarter angle.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin luminous violet (#C77DFF) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are luminous violet (#C77DFF), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### track-stratus

- Produces: `web/public/art/track-stratus.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/track-stratus.png` (not in git), accent `stratus`, blend `screen`
- Takes:
  - Take 1 shipped. 'Deep saturated golden amber, not cream, not beige, not white' and the accent name 'saturated amber gold' (both from the Community portal's stratus take 2) kept the colour amber on the first try.

```text
Dark glass and frosted crystal hexagonal forms with saturated amber gold (#FFC857) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A tall faceted spire: a slender tower made of five stacked, stepped hexagonal tiers, each tier a six-sided prism narrower than the one below, tapering to a sharp faceted pointed tip, with one thin bright ring floating around its upper part. The tallest of a three-part series, about five times as tall as it is wide. The glass body is tinted deep saturated golden amber and glows from inside with rich warm amber light, with white-hot edges. Strongly saturated amber, not cream, not beige, not white, not yellow-green. Seen from a slightly elevated three-quarter angle.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin saturated amber gold (#FFC857) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are saturated amber gold (#FFC857), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

### modules

#### mod-network

- Produces: `web/public/art/mod-network.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/mod-network.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. The hairline gaps between cells leaking light is what sells the globe as built from hexagons.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A glass globe built entirely from hexagonal cells: a sphere assembled from many small hexagonal tiles of dark frosted glass like a faceted honeycomb ball, each tile separated by a hairline gap that leaks blue light, a handful of tiles glowing brighter, and two thin arcs of blue light flying across its surface between bright nodes. One thin tilted ring orbits it. Hovering alone.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.
```

#### mod-containers

- Produces: `web/public/art/mod-containers.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/mod-containers.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 was a thin vertical column of four cubes: tidy, but only about a quarter of the frame wide and light next to the other plates.
  - Take 2 (shipped) asks for wide flat blocks (about 2.5 times as wide as tall), alternately offset, wider than tall: it fills the frame and reads as image layers.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A staggered stack of four wide flat glass blocks, each about two and a half times as wide as it is tall, like the layers of a container image, alternately offset a little to the left and to the right. Each block is dark frosted glass with a bright blue emissive seam around its edges, two or three thin hexagonal layer plates visible inside it and a faintly lit hexagonal core. The top block is lifted a little above the rest with a thin beam of light between them. The stack is wider than it is tall. Seen in isometric three-quarter view from slightly above.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.
```

#### mod-setup

- Produces: `web/public/art/mod-setup.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/mod-setup.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 had a rounded elbow: the key read as a bent pipe hovering over the plate.
  - Take 2 (shipped) asks for one sharp mitred right angle, 'like the L-shaped tool that ships with flat-pack furniture', and a short arm pointing into the socket: it reads as an Allen key seated in its socket.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A hex key and a plate: a thick hexagonal plate of dark frosted glass floating at a slight tilt, with a glowing hexagonal socket in its centre, and above it a hex key, an Allen wrench: a straight bar of faceted clear glass with a six-sided cross-section, bent at one sharp right angle with a crisp mitred corner into a long arm and a short arm of equal thickness, like the L-shaped tool that ships with flat-pack furniture. The short arm points straight down into the socket and the long arm extends sideways. A white-hot rim traces its edges. Bright blue light spills from the socket.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### mod-deploy

- Produces: `web/public/art/mod-deploy.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/mod-deploy.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 was a thin pillar under three thin arcs with small cubes: spindly, with far less visual weight than its neighbours.
  - Take 2 (shipped) asks for a chunky prism about a fifth of the frame wide, bold thick arcs and large cubes.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single large chunky hexagonal glass prism, about one fifth of the frame wide and one third of the frame tall, standing on a wide hexagonal plinth at the lower centre and launching three bold thick arcs of bright blue light: the arcs rise from its top face in smooth parabolic curves that fly up and outward to the left, to the right and to the upper centre, each ending in a large bright glass cube in mid-flight and trailing fine light particles. A soft glow pools at the plinth.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### mod-traffic

- Produces: `web/public/art/mod-traffic.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/mod-traffic.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 put the gates on a diagonal, small and pushed into a corner, with the ribbons trailing off to the lower left.
  - Take 2 (shipped) asks for one-point perspective on the centre line, nested rings shrinking to a vanishing point, symmetrical: the best of the set. The ribbons run off the bottom of the frame, so this piece skips auto-fit and relies on a wide edge feather (13 percent) instead.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: Three hexagonal gate frames, thick open rings of dark frosted glass shaped like regular hexagons, like portals, standing one behind the other in one-point perspective along the centre line of the frame, seen head-on from slightly above, so they read as three nested hexagonal rings shrinking toward a vanishing point at the centre, the nearest the largest and brightest. Many ribbons of blue light flow from the bottom of the frame through all three openings toward the vanishing point, fanning out near the viewer and converging through the gates, with small bright packets of light travelling along them. Symmetrical and centred.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.
```

#### mod-projects

- Produces: `web/public/art/mod-projects.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/mod-projects.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. The floating build table with a prism, a cube and a dome, and two loose tiles, reads as 'things you assemble'.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A floating hexagonal build table: a thick hexagonal slab of dark frosted glass with a faint grid of hex cells etched into its top, on which stand three finished glass forms side by side, a hexagonal prism, a cube and a faceted dome, each joined to its neighbour by a thin seam of blue light, with two small loose tiles hovering above them as if being fitted into place. Isometric three-quarter view from above.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### mod-operate

- Produces: `web/public/art/mod-operate.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/mod-operate.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. 'No numbers, no labels, no text on anything' held: the dials carry only tick marks and arcs.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A compact cluster of console dials on one small hexagonal panel of dark frosted glass: one large round dial in the centre with a ring of tick marks and an arc of blue light with a pointer, two medium dials beside it, two small hexagonal knobs below and a short row of three slider bars. All the controls are glass with blue emissive arcs. No numbers, no labels, no text on anything.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### mod-resilience

- Produces: `web/public/art/mod-resilience.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/mod-resilience.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. Three impact bursts with ripples and shards on a seven-plate honeycomb shield.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A shield built from seven large hexagonal plates of dark frosted glass joined edge to edge in a honeycomb, one in the centre and six around it, curved slightly toward the viewer, with three bright impact bursts of white-hot light where bolts of blue light strike its face, ripples of blue light radiating outward through the plates from each impact and a few small shards flying off. The shield is intact and unbroken.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.
```

#### mod-state

- Produces: `web/public/art/mod-state.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/mod-state.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. Rings around a faceted bipyramid; the glow pool underneath anchors it.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A large faceted vault crystal: a hexagonal bipyramid of clear frosted glass with a bright core, floating upright at the centre, ringed by three thin tilted concentric rings of blue light at different heights, the sync rings, each ring carrying one small bright node. A soft pool of blue glow beneath it.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.
```

#### mod-architecture

- Produces: `web/public/art/mod-architecture.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/mod-architecture.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. A hexagon frame holding four linked prisms reads as an architecture diagram in glass.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A thin hexagonal frame of glass, an open hexagon ring standing upright like a picture frame, holding inside it four glass prisms of different shapes and sizes, a tall hexagonal prism, a cube, a small hexagonal bipyramid and a short hexagonal puck, linked to each other by thin straight beams of blue light that form a small network diagram in three dimensions.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.
```

### labs

#### lab-spec-forge

- Produces: `web/public/art/lab-spec-forge.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/lab-spec-forge.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. The anvil built from visible hexagonal slabs with a white-hot ingot and rising flakes.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A glowing forge anvil built entirely from stacked hexagonal plates of dark frosted glass: a wide hexagonal base plate, a narrower hexagonal waist block, and a long flat top face with a pointed horn on one side, assembled from visible hex slabs with thin glowing gaps. A white-hot glowing hexagonal ingot sits on the flat top, and a fountain of blue sparks and tiny glowing hexagonal flakes flies up from it.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.
```

#### lab-network

- Produces: `web/public/art/lab-network.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/lab-network.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. Asked for 'abstract continent shapes', the model drew a recognisable world map out of tiny hex cells, which suits the Network Lab.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A floating flat hexagonal map plate: a wide hexagonal slab of dark glass whose top is covered by hundreds of tiny hexagonal cells forming abstract continent shapes, lit blue at the edges. About eight hexagonal pillars of different heights rise from it, the tallest white-hot at the top, with two thin arcs of blue light connecting the tallest pillars. Isometric view from above at about 35 degrees.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### lab-failover

- Produces: `web/public/art/lab-failover.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/lab-failover.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. The dead pillar reads as black and cracked among the lit ones, with the two rerouting arcs over it.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A tight field of about twenty hexagonal pillars of different heights standing in a honeycomb grid on a small floating hexagonal base, all with blue edge light, except one pillar near the centre which is completely dark, unlit and cracked, a dead node. Two arcs of blue light curve over the dark pillar from one lit pillar to another, rerouting around it.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### lab-terminal

- Produces: `web/public/art/lab-terminal.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/lab-terminal.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 was a portrait slab with a chevron followed by a vertical bar: it read as a media 'skip' icon on a page.
  - Take 2 (shipped) asks for a wide 4:3 slab and a flat underscore cursor: it reads as a command prompt.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A thick chamfered rectangular slab of dark frosted glass, wider than it is tall (about 4:3 proportions), standing upright and tilted slightly back like a terminal window, with two diagonally cut corners at the top right and the bottom left. In its upper-left area a bold luminous prompt chevron, a right-pointing angle bracket shape, followed by a short flat horizontal underscore cursor bar sitting at the baseline, in white-hot and blue light, like a command prompt, and below them two faint dim horizontal bars of light. No letters, no characters, no numbers anywhere.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.
```

#### lab-explorer

- Produces: `web/public/art/lab-explorer.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/lab-explorer.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. Lens lighting only the pillars inside it.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A large round glass lens, a magnifying glass with a thick ring of faceted clear glass and a short handle, floating at an angle above a field of small hexagonal pillars standing on a floating hexagonal base. Inside the lens circle the pillars appear larger and brightly lit blue with two of them white-hot; outside the lens they are dim and dark.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### lab-agent-desk

- Produces: `web/public/art/lab-agent-desk.webp` (and `.avif` where it is smaller), 640x640
- Raw: `assets-src/raw/lab-agent-desk.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 put a hexagonal desk under an upright hexagonal frame with a bar through it. It is the calmest take and the only early one with a true six-sided desk, but the gate was a third of the desk's width and the bar pale glass, so at 120 px it read as a plinth with a speck on it.
  - Take 2 swapped the frame for a round ring: the model cut it like a gemstone and it read as jewellery, on an octagonal desk. Rejected.
  - Take 3 laid the ring flat around an upright bar: it read as a collar on a post (a fountain), on an octagonal desk. Rejected.
  - Take 4 asked for a gate three fifths as wide as the desk and a chunky bar as long as the gate is wide, 'white-hot from its core, the brightest thing in the picture': the focal point was right, but the desk came back octagonal again and the gate tumbled on its side.
  - Take 5 (shipped) keeps those size and brightness cues and pins the desk pose the way the medals pin theirs: 'one flat side facing the viewer and a corner pointing to the left and to the right, so that exactly three side faces are visible' gave a true hexagon, where 'regular six-sided hexagon with exactly six sides' alone had not. The gate still leans a little, which reads as floating rather than fixed.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A hexagonal glass desk with one large gate floating above it. The desk is a wide, thick slab of dark frosted glass shaped like a regular six-sided hexagon, seen with one flat side facing the viewer and a corner pointing to the left and to the right, so that exactly three side faces of the slab are visible, with chamfered bevels, a faint grid of hex cells etched into its top face and a bright blue emissive seam around its edge, standing on a short, much narrower hexagonal foot block. Floating just above the centre of the desk is a single gate: a thick open frame of faceted clear glass shaped like a regular six-sided hexagonal ring, about three fifths as wide as the desk, standing perfectly upright like a doorway, with no tilt and no lean, its bottom side lying level above the desk top and its plane turned away from the viewer by about 40 degrees so that we look through its opening at an angle, with a bright blue emissive edge and a white-hot highlight along its top edge. One single hexagonal prism, a chunky crystal bar with a six-sided cross-section, about as long as the gate is wide and about three times as long as it is thick, passes straight through the opening of the gate at right angles to the plane of the gate, with its front end sticking out toward the viewer and its back end sticking out behind the gate. The prism glows white-hot from its core, the brightest thing in the picture, blooming softly and casting a pool of blue-white light on the desk below. The gate and the prism are the only objects above the desk. Isometric three-quarter view from above at about 35 degrees.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

### atmosphere

#### bg-bench

- Produces: `web/public/art/bg-bench.webp` (and `.avif` where it is smaller), 1600x900
- Raw: `assets-src/raw/bg-bench.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 was single-accent blue: moody, hazy, white-hot tops, but dark and with no sense of the tiers. Kept in assets-src/raw/_prev.
  - Take 2 added a few cyan, violet and amber pillars (short, mid, tall, like the bench legend): colourful but the model mirrored the layout and flattened the depth.
  - Take 3 (shipped) asks for strong depth (large out-of-focus foreground pillars), an asymmetrical layout with the tallest cluster left of centre, and a custom rig paragraph that allows the three tier tints. The one piece that breaks 'one accent': it depicts the tiers, as ref-bench does.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: The bench, a horizon plate: a wide field of small hexagonal pillars of dark frosted glass of varied heights, seen from a low three-quarter angle with strong depth. The nearest pillars are large and softly out of focus along the bottom, and the field recedes in perspective toward a hazy horizon line in the middle of the frame. The pillars are edge-lit in electric blue, with white-hot tops on the tallest ones and heavy volumetric haze along the horizon. A few pillars are lit in the three tier colours, like a legend: some of the shorter ones glow vivid cyan, some of the middle-height ones glow luminous violet and a few of the tallest ones glow saturated amber gold, scattered unevenly and not mirrored. The upper 40 percent of the frame is an empty black void. The field fades to pure black toward the left, right and bottom edges, so it floats as a soft glowing band across the middle of the frame. The composition is asymmetrical, with the tallest cluster slightly left of centre. Wide frame, 16:9. No sky, no mountains, no sun.

Lighting rig: the key light is a soft glow from beneath, a white-hot rim light traces the upper edges of the tallest pillars, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The colours are electric royal blue (#2B61D1) for almost everything, white and black, and only the few tier pillars described above in vivid cyan (#36D3FF), luminous violet (#C77DFF) and saturated amber gold (#FFC857).

Strictly forbidden: any text, letters, numbers, symbols or logos; any people or hands; any frame, border or watermark; any bright or coloured background. Everything outside the subject is pure black #000000.
```

#### sprite-bokeh

- Produces: `web/public/art/sprite-bokeh.webp` (and `.avif` where it is smaller), 256x256
- Raw: `assets-src/raw/sprite-bokeh.png` (not in git), accent `flux`, blend `screen`, real alpha
- Takes:
  - Take 1 shipped, using the Community portal's take-2 wording (flat even interior at about 70 percent, brighter thin rim): a bokeh highlight, not a glow. Alpha is derived from luminance in post.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single soft hexagonal bokeh highlight, like a camera lens aperture highlight: a perfectly regular hexagon with softly rounded corners, a flat even interior of pale blue-white light at about 70 percent brightness, a slightly brighter thin rim, and a softly blurred outer edge. Centred, about 60 percent of the frame width. No bright core, no hot spot, no gradient toward the centre, a flat even fill. Nothing else, no noise, no grain, on a flat pure black background.

Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.
```

#### sprite-streak

- Produces: `web/public/art/sprite-streak.webp` (and `.avif` where it is smaller), 512x64
- Raw: `assets-src/raw/sprite-streak.png` (not in git), accent `flux`, blend `screen`, real alpha
- Takes:
  - Take 1 shipped, using the Community portal's wording that says 'it is not a hexagon' (the style prefix otherwise pulls the model toward hexagons).
  - Post: crop an 8 to 1 band centred on the brightest row, fade both ends, derive alpha from luminance.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single anamorphic lens-flare streak and nothing else. One perfectly straight, razor-thin horizontal line of light runs across the entire width of the frame from the left edge to the right edge, exactly at the vertical centre. It is about 1 percent of the frame height thick, white-hot at the very centre, shifting to electric blue toward both ends and fading smoothly to black before it reaches the left and right edges, with a very faint soft glow around it. It is not a hexagon, there are no shapes, no dots, no other light, on a flat pure black background.

Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.
```

#### sprite-dirt

- Produces: `web/public/art/sprite-dirt.webp` (and `.avif` where it is smaller), 960x640
- Raw: `assets-src/raw/sprite-dirt.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. Grayscale with no edge mask (the dust runs to the edges on purpose; it is a post-processing texture). Resized to 960x640 to stay under the 60 KB sprite budget.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A lens dirt texture: fine dust specks, smudges, tiny hairlines and a few soft fingerprint-like arcs, rendered as soft pale blue-white blooms of scattered light on a flat pure black background. Uneven distribution, denser toward the corners and sparse in the centre, high contrast. No objects, no pattern, no text.

Strictly forbidden: any text, letters, numbers, symbols or logos; any floor, ground plane, tabletop, horizon, walls, mountains, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The background is a perfectly flat, empty, pure black void.
```

### medals

#### medal-first-light

- Produces: `web/public/art/medal-first-light.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-first-light.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped, and is the body reference for the medals generated after it (`refs`). A true hexagon with a thick bevelled rim, a recessed field and a luminous emblem.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright electric royal blue (#2B61D1) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. Emblem: a single white-hot point of light at the exact centre, like the first spark of dawn, with one thin vertical beam of light rising from it to the upper edge of the field and three faint concentric hexagonal rings around it.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### medal-three-is-company

- Produces: `web/public/art/medal-three-is-company.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-three-is-company.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. Three linked hexagonal gems in a triangle.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright electric royal blue (#2B61D1) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. Emblem: three small solid hexagonal glass gems of equal size arranged in a triangle, one at the top and two at the bottom, joined to each other by thin glowing lines, the triangle centred in the field.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### medal-first-blood

- Produces: `web/public/art/medal-first-blood.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-first-blood.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. A hexagonal tile split by a bright crack, shards drifting away.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright electric royal blue (#2B61D1) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. Emblem: one hexagonal glass tile in the centre split in two by a bright jagged diagonal crack, the two halves slightly apart with white-hot light leaking through the crack and a few tiny shards drifting away.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### medal-spec-whisperer

- Produces: `web/public/art/medal-spec-whisperer.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-spec-whisperer.png` (not in git), accent `flux`, blend `screen`
- References: `assets-src/raw/medal-first-light.png`
- Takes:
  - Take 1 came back as a heptagon (seven sides) and its five left-aligned bars of equal height read as the letter 'E'.
  - Take 2 (shipped) attaches the first-light medal as the body reference ('same regular six-sided shape') and asks for six bars of clearly different lengths in an irregular rhythm, so they read as lines of a spec and not a glyph.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright electric royal blue (#2B61D1) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. Emblem: six short horizontal bars of light stacked in a column like the lines of a configuration file, of clearly different lengths in an irregular rhythm with two of them indented to the right, so the group looks like lines of code and not like a letter, all glowing a clean steady blue, with a small bright hexagonal node at the end of one of the bars. Abstract bars of light only, no letters, no characters.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Reference image: the attached image shows the exact medal body to reproduce, the same regular six-sided hexagonal shape with one vertex pointing up, the same bevelled rim width, thickness, frosted glass material, edge light, camera angle and size in the frame. Replace only the emblem in the centre with the emblem described above. Do not copy the reference emblem.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### medal-penny-pincher

- Produces: `web/public/art/medal-penny-pincher.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-penny-pincher.png` (not in git), accent `flux`, blend `screen`
- References: `assets-src/raw/medal-first-light.png`
- Takes:
  - Take 1 (a hexagonal coin held by two clamp jaws) read as a hex nut in a belt buckle.
  - Take 2 (shipped) uses glass tweezers pinching a small hexagonal coin, with the body reference attached.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright electric royal blue (#2B61D1) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. Emblem: a pair of tweezers made of faceted clear glass, two thin angled arms joined at the top, pinching a small hexagonal coin (a thin hexagonal disc with one inner concentric hexagon ring, no numerals, no symbols) between their tips at the bottom, with a bright spark of light squeezed out at the contact points.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Reference image: the attached image shows the exact medal body to reproduce, the same regular six-sided hexagonal shape with one vertex pointing up, the same bevelled rim width, thickness, frosted glass material, edge light, camera angle and size in the frame. Replace only the emblem in the centre with the emblem described above. Do not copy the reference emblem.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### medal-block-watcher

- Produces: `web/public/art/medal-block-watcher.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-block-watcher.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. An eye made of light over a chain of three cubes ('three blocks in a row').

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright electric royal blue (#2B61D1) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. Emblem: an eye made of light, an almond-shaped outline with a hexagonal iris and a bright pupil at its centre, and beneath it a row of three small glass cubes joined by a thin line, like three blocks in a chain.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### medal-globetrotter

- Produces: `web/public/art/medal-globetrotter.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-globetrotter.png` (not in git), accent `flux`, blend `screen`
- References: `assets-src/raw/medal-first-light.png`
- Takes:
  - Take 1 had a small, dim globe lost in the field.
  - Take 2 (shipped) asks for a large bold globe filling most of the field and joins the three pins with an arc, with the body reference attached.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright electric royal blue (#2B61D1) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. Emblem: a globe made of hexagonal cells at the centre, large and bold, filling most of the medal field, with one thin tilted orbit ring around it carrying a tiny bright node, and three bright pins of light on its surface joined by a thin glowing arc.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Reference image: the attached image shows the exact medal body to reproduce, the same regular six-sided hexagonal shape with one vertex pointing up, the same bevelled rim width, thickness, frosted glass material, edge light, camera angle and size in the frame. Replace only the emblem in the centre with the emblem described above. Do not copy the reference emblem.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### medal-shell-shocked

- Produces: `web/public/art/medal-shell-shocked.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-shell-shocked.png` (not in git), accent `flux`, blend `screen`
- References: `assets-src/raw/medal-first-light.png`
- Takes:
  - Take 1 drew a chevron followed by a vertical bar, the universal 'next track' icon.
  - Take 2 (shipped) asks for a flat underscore cursor lying low next to the chevron, with a spark between them, and attaches the body reference.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright electric royal blue (#2B61D1) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. Emblem: a bold right-pointing prompt chevron (an angle bracket shape) at the left and, to its right at the baseline, a short flat horizontal underscore cursor bar lying low, like a command prompt, in white-hot light, with two small forks of electric light jumping between the chevron and the cursor like a static shock. The cursor is a flat horizontal bar, not a vertical bar. No letters, no characters.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Reference image: the attached image shows the exact medal body to reproduce, the same regular six-sided hexagonal shape with one vertex pointing up, the same bevelled rim width, thickness, frosted glass material, edge light, camera angle and size in the frame. Replace only the emblem in the centre with the emblem described above. Do not copy the reference emblem.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### medal-explorer

- Produces: `web/public/art/medal-explorer.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-explorer.png` (not in git), accent `flux`, blend `screen`
- Takes:
  - Take 1 shipped. Deliberately the same lens-over-pillars motif as lab-explorer, so the medal and its lab read as one thing.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright electric royal blue (#2B61D1) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. Emblem: a round glass lens (a magnifying glass, a thick ring with a short handle toward the lower right) with three tiny hexagonal pillars standing visible inside the lens and lit bright white-hot and blue.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### medal-cumulus-operator

- Produces: `web/public/art/medal-cumulus-operator.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-cumulus-operator.png` (not in git), accent `cumulus`, blend `screen`
- Takes:
  - Take 1 shipped. Rank medals add a ring of twelve hexagonal studs and use the tier colour; the emblem repeats the track emblem.

```text
Dark glass and frosted crystal hexagonal forms with vivid cyan (#36D3FF) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright vivid cyan (#36D3FF) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. This is a rank medal: a second outer ring of twelve small hexagonal studs surrounds the rim. Emblem: a small compact cluster of five hexagonal crystal prisms of different heights fused together on a small hexagonal base, one central prism a little taller than the four around it, each with a faceted pointed tip, glowing vivid cyan from inside.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin vivid cyan (#36D3FF) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are vivid cyan (#36D3FF), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### medal-nimbus-engineer

- Produces: `web/public/art/medal-nimbus-engineer.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-nimbus-engineer.png` (not in git), accent `nimbus`, blend `screen`
- Takes:
  - Take 1 shipped.

```text
Dark glass and frosted crystal hexagonal forms with luminous violet (#C77DFF) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright luminous violet (#C77DFF) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. This is a rank medal: a second outer ring of twelve small hexagonal studs surrounds the rim. Emblem: a double-hex tower of exactly two stacked true six-sided hexagonal prisms, a wide lower tier and a narrower upper tier with a thin glowing ring plate between them, glowing luminous violet from inside.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin luminous violet (#C77DFF) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are luminous violet (#C77DFF), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

#### medal-stratus-architect

- Produces: `web/public/art/medal-stratus-architect.webp` (and `.avif` where it is smaller), 384x384
- Raw: `assets-src/raw/medal-stratus-architect.png` (not in git), accent `stratus`, blend `screen`
- Takes:
  - Take 1 shipped. The same 'not cream, not beige' wording kept the amber saturated.

```text
Dark glass and frosted crystal hexagonal forms with saturated amber gold (#FFC857) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A single hexagonal medal: a thick hexagonal disc of dark frosted glass with a clearly visible thickness, seen face-on from the front and tilted back only slightly so its thickness and bevelled rim show. The hexagon has a chamfered bevelled rim with a bright saturated amber gold (#FFC857) emissive edge line and a white-hot highlight along the upper rim. Inside the rim is a recessed hexagonal field of frosted glass, and in that field floats the emblem described below, made of light and glass, large and bold, filling about 60 percent of the medal face. The medal is the only object: no ribbon, no chain, no stand, no base, no text, no numbers, no letters. This is a rank medal: a second outer ring of twelve small hexagonal studs surrounds the rim. Emblem: a tall faceted spire of five stacked stepped hexagonal tiers tapering to a sharp pointed tip with one thin bright ring around its upper part, glowing deep saturated golden amber from inside. Strongly saturated amber, not cream, not beige, not white.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin saturated amber gold (#FFC857) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are saturated amber gold (#FFC857), white and black.

Frame: square 1:1. One subject, centred, filling about 55 percent of the frame height, with a generous empty black margin on all four sides. The glow falls off smoothly and reaches pure black #000000 well before any edge, so every edge and every corner is pure black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any ground plane, floor or horizon beneath or behind the subject; any walls, sky, stars or planets; any reflection of a surface; any people or hands; any frame, border or watermark. The subject floats alone in a perfectly flat, empty, pure black void.
```

### social

#### og-backdrop

- Produces: `assets-src/og-backdrop.webp` (build input only, not shipped), 1800x900
- Raw: `assets-src/raw/og-backdrop.png` (not in git), accent `flux`, blend `normal`
- Takes:
  - Take 1 shipped. Not shipped to the site: web/scripts/build-og.mjs composites the real lockup and real text over it. The left 40 percent is empty on purpose.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A wide cinematic scene with the weight on the right half. A field of small hexagonal pillars of dark frosted glass of varied heights rises toward the right, lit from beneath in electric blue with white-hot tops on the tallest, and above it a single larger glass hexagonal prism, the specimen, hovers right of centre with three thin arcs of blue light curving down from it onto three of the tall pillars, with volumetric haze. The left 40 percent of the frame is almost empty, deep black, calm, reserved for text. Everything fades to pure black toward the top, the bottom and the left. All important content sits within the central 60 percent band of the frame height. Wide frame, about 2:1.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any people or hands; any frame, border or watermark; any bright or coloured background. Everything outside the subject is pure black #000000.
```

#### og-backdrop-square

- Produces: `assets-src/og-backdrop-square.webp` (build input only, not shipped), 1200x1200
- Raw: `assets-src/raw/og-backdrop-square.png` (not in git), accent `flux`, blend `normal`
- Takes:
  - Take 1 shipped. Cropping the wide backdrop for the 1200x1200 card upscaled it 1.33x and put the busy part under the text, so the square card gets its own composition: art upper right, empty lower left for the title.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A square cinematic scene with the weight in the upper right two thirds. A field of small hexagonal pillars of dark frosted glass of varied heights rises from the lower right, lit from beneath in electric blue with white-hot tops on the tallest, and above it a single larger glass cube, the specimen, hovers right of centre in the upper half with three thin arcs of blue light curving down from it onto three of the tall pillars, with volumetric haze. The whole left third and the whole lower-left quadrant of the frame are almost empty, deep black and calm, reserved for text. Everything fades to pure black toward the top, the left and the bottom-left. Square frame, 1:1.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Strictly forbidden: any text, letters, numbers, symbols or logos; any people or hands; any frame, border or watermark; any bright or coloured background. Everything outside the subject is pure black #000000.
```

#### certificate-backdrop

- Produces: `web/public/art/certificate-backdrop.webp` (and `.avif` where it is smaller), 1500x1000
- Raw: `assets-src/raw/certificate-backdrop.png` (not in git), accent `flux`, blend `normal`
- Takes:
  - Take 1 drew a frame at about 1.9:1 sitting high in the 3:2 canvas.
  - Take 2 (shipped) asks for a frame with the canvas's own 3:2 proportions and equal margins; the model still drew about 1.7:1, so auto-fit centres it (`fit: { fill: 0.94 }`) and the plate is used as an opaque 'normal' backdrop.

```text
Dark glass and frosted crystal hexagonal forms with electric royal blue (#2B61D1) edge light and white-hot highlights, volumetric haze, soft bloom, photoreal 3D render, premium minimal, pure black (#000000) background, no text, no logos, no UI, no people, no scenery.

Subject: A calm, formal, ornamental plate for a certificate: a symmetrical frame of thin luminous hairlines and a double border with diagonally cut chamfered corners, a narrow pattern band of tiny hexagons running along all four edges, four corner ornaments built from small hexagonal tiles, and a small ornament of three joined hexagons centred on the top edge. The rectangular frame has the same 3:2 proportions as the canvas, its width exactly one and a half times its height, and sits centred with an equal margin of about 4 percent of the canvas on every side. The whole centre 65 percent of the plate is empty deep near-black with only a very faint honeycomb texture and a soft vignette. Thin electric blue lines on black, no filled colour areas, no seal, no ribbon, no medal.

Lighting rig: the key light is a soft glow from beneath the subject, a white-hot rim light traces the upper edges, and a thin electric royal blue (#2B61D1) emissive edge light runs along every bevel. Material: frosted ice-like glass with crisp chamfered bevels, faint internal scattering and fine surface grain. Lens: 85 mm, shallow depth of field, gentle bloom. The only colours are electric royal blue (#2B61D1), white and black.

Frame: landscape 3:2. The composition is centred and symmetrical, with a generous empty black margin where the glow falls off smoothly to pure black #000000 before any edge.

Strictly forbidden: any text, letters, numbers, symbols or logos; any people or hands; any frame, border or watermark; any bright or coloured background. Everything outside the subject is pure black #000000.
```
