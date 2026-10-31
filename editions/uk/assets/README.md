# Assets of the Ukrainian Edition

- `icon.png`: the app icon.
- `fonts/`: the Edition's own fonts, described in [`fonts/README.md`](fonts/README.md). The Core's Literata and Manrope live in `packages/ui/assets/fonts/` (ADR 0006).
- `notification.wav`: the sound of notifications, named by `notificationSound` in `edition.json`. The app config checks that it is a `.caf`, `.wav` or `.aiff` file of at most 30 seconds, which are the limits of iOS, and the `expo-notifications` plugin bundles it. Changing it needs a new development build.

The sound is a **placeholder**: a 0.6 s plucked string synthesized by `generate-notification-sound.mjs` (run it with `node`), so no third-party licence is involved. The final bandura pluck from the design replaces it before 1.0, and it must be royalty-free and allowed for commercial use.

## Illustrations

`illustrations/` holds the Illustrations a Word names in its `illustration` field (ADR 0055): square PNGs of at most 150 000 bytes, which the Language Pack build checks. Keep only those PNGs there, since the content CLI lists the folder as the files a Word may name.

The 15 Illustrations are **placeholders**: simple vector drawings in `illustration-sources/`, one SVG per PNG of the same name, exported at 512×512 by a headless browser. Each sits on its own light tile, so the one Illustration reads on light and dark cards alike. `illustration-sources/contact-sheet.png` shows all 15 on the light and the dark background. Final art replaces them before 1.0.
