# Assets of the UA Edition

- `icon.png`: the app icon, the design's app mark (a red square with the ink wedge), written by `generate-icon.mjs` (run it with `node`). Changing it needs a new development build.
- `fonts/`: the Edition's own fonts, described in [`fonts/README.md`](fonts/README.md). Unbounded and Onest, its word and UI families, and the Word of the Day font (ADR 0006, 0070).
- `sounds/`: the four Interface sounds, `shout`, `right`, `wrong` and `tap` as `.wav` files, written by `generate-interface-sounds.mjs` from the design's oscillator settings (run it with `node`). The app bundles each file the Edition brings and plays it with `expo-audio`, behind the `sounds` Feature Switch and «Звуки» (ADR 0070).
- `notification.wav`: the sound of notifications, named by `notificationSound` in `edition.json`. The app config checks that it is a `.caf`, `.wav` or `.aiff` file of at most 30 seconds, which are the limits of iOS, and the `expo-notifications` plugin bundles it. Changing it needs a new development build.

The sound is the design's tap, quieter (owner 02.11): `generate-interface-sounds.mjs` writes it beside the Interface sounds, so no third-party licence is involved.

## Illustrations

`illustrations/` holds the Illustrations a Word names in its `illustration` field (ADR 0055): square PNGs of at most 150 000 bytes, which the Language Pack build checks. Keep only those PNGs there, since the content CLI lists the folder as the files a Word may name.

The 15 Illustrations are **placeholders**: simple vector drawings in `illustration-sources/`, one SVG per PNG of the same name, exported at 512×512 by a headless browser. Each sits on its own light tile, so the one Illustration reads on light and dark cards alike. `illustration-sources/contact-sheet.png` shows all 15 on the light and the dark background. Final art replaces them before 1.0.
