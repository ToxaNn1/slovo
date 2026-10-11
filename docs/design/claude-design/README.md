# Claude Design export

The owner's design for SLOVO (Ukrainian Edition), made with Claude Design and exported on **2026-10-11**. It is kept byte for byte as exported, so do not edit or reformat these files; Prettier skips this folder.

What is here:

- `SLOVO.dc.html`: the design canvas. Every screen, token table and Decor sample is one artboard on it, and several artboards are live (you can swipe the Feed, answer a Game Round, toggle settings).
- `support.js`: the Claude Design runtime the canvas loads. It renders the canvas with React.
- `uploads/`: what was given to Claude Design. `slovo_brief_en.md` and `slovo_brief_uk.md` are the brief, the same text as [`../claude-design-prompt.md`](../claude-design-prompt.md) plus a section 9, "Design principles: decisions instead of defaults". The images are the owner's mood references (vyshyvanka ornaments, pysanky, a bandura, costumes). They are references only, not app assets, and must not ship in the app.

## How to open it

Open `SLOVO.dc.html` in a desktop browser (Chrome or Safari) straight from disk. It needs an internet connection: the runtime loads React from unpkg, and the fonts come from Google Fonts. The canvas reads top to bottom from the newest pass (5) to the first (1).

Only open it in a browser. Don't run `support.js` or anything else from this folder with Node or another tool.

## Where to look instead

- [`../design-system.md`](../design-system.md): tokens, typography, components, Decor slots, the screen index, gaps and the Ukrainian UI copy, all extracted from this canvas.
- [`../screens/`](../screens/): every artboard and its main interactive states rendered to PNG at 2×.
