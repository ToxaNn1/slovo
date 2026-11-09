# «Клин 2.0: Рупор» is the app's design

The owner chose «Клин 2.0: Рупор» for the whole app after the design grill of 2026-11-02 (spec #1445): a red, cream and near-black poster language with chunky pressed 3D tiles, wedge cuts, Unbounded and Onest, loud motion on the peaks and quiet lists. It replaces the warm-paper design of the 2026-10-11 Claude Design export (Literata, Manrope, dark red on beige, thin outlined buttons), and with it the old design brief, its 60 screenshots, its animation audit, its export and its design prompt, which leave the repository.

**The source.** The new export lives in `docs/design/export/`, kept byte for byte, static HTML read as data and never run. `docs/design/README.md` maps the design's CSS variables to the token roles and lists the names that are the design's own and not ported. The boards win over every older document on how a screen looks; `CONTEXT.md` and the ADRs win over the boards on what the app does. Only features that exist in the Core and the Edition are drawn.

**Where the design lives (ADR 0006).**

- **Edition tokens** (`editions/<edition>/tokens.json`): the palette of both Themes and the font families. The Ukrainian Edition carries the design's light and dark palettes, Unbounded for the word and Onest for the interface.
- **Core tokens** (`packages/ui/src/tokens/`): shapes and radii, type roles (family slot, size, weight, line height, letter spacing), hard offset shadows, wedge shapes, the halftone raster and motion durations and curves. The Core keeps neutral defaults for every Edition token.

**The colour roles of one scheme.** `background`, `ink`, `surface`, `surfaceSunken` (the design's second surface), `tile` (the face of a tile or button), `tileEdge` (its 3D edge), `accent` (the red), `accentEdge` (the red's edge and pressed shadow), `accentText` (the red of text under the large-text threshold, at least 4.5:1 on `background`, `surface`, `surfaceSunken` and `tile`; `accent` stays for fills, borders and large text; added 2026-11-08), `onAccent` (cream on red), `highlight` (the crossword word, the selected letter), `muted`, `line`, `silhouette` (the off track, the locked Badge, the empty tile), `tabBar`, `decor`, and the existing `correct`, `wrong`, `heart` and `destructive`, which the design maps: `correct`, `heart` and `destructive` are the red, and `wrong` is the ink with a slash. `inkSecondary`, `track` and `inactiveTab` are removed, not kept as aliases. The radii are `tile`, `button`, `card`, `chip` and `sheet`. The Edition schema refuses a removed role.

**Type.** The Core names the type roles: shout, hero word, screen title, heading, eyebrow, button label, list word, reading (meaning, example, sub) and meta. A role carries its weight, so components stop writing weights. The font size setting maps to the design's three steps for the Word and the reading text. Unbounded and Onest are Edition fonts; the Edition check (ADR 0035) refuses an alphabet either does not cover, and no Core or Edition asset names Literata, Manrope or Kurale after the migration.

**The Mascot.** Rupor is the Ukrainian Edition's Mascot. The Edition supplies its vector; the Core draws its states (sleeps, waits, shouts, happy, surprised, cringes, sad, celebrates) plus the quiet hat-off state, each with its motion, and an on-red variant. The Decor accessory of the Season or Holiday is a layer on the figure and never changes the palette; the design draws no other Decor (ADR 0014). The Mascot stays silent (`CONTEXT.md`).

**Sounds.** Four short interface sounds (a shout, a right answer, a wrong answer, a tap) play behind a Feature Switch `sounds`, declared by the Edition, and the «Звуки» setting. They are interface sounds, not the Mascot's voice. A remote switch only turns the feature off (ADR 0040).

**Motion and haptics.** ADR 0055 allows the design's peaks to run longer than 300 ms and sets one short fade under Reduce Motion. Nothing shakes; the Game keeps its haptics (ADR 0025).

## Considered Options

- **Port the design as a theme beside the old one**: rejected. Two designs double every screen and the lint rules; the old one goes.
- **The whole palette in the Core**: rejected. Colours differ per Edition (ADR 0006); only shapes, type roles and motion are shared.
- **Keep the old roles as aliases of the new**: rejected. An alias nobody reads hides which roles a screen really uses.
- **Port the design's invented features with its looks** (see the readme's list): rejected. The design draws looks; features come from the Core, the Edition and their ADRs.
