---
summary: The «Сервіси» canvas follows the admin Theme, white with black dots in the light one, zooms 30–200 % with «−», «+», «Вмістити» and Ctrl/⌘ with the wheel, opening fitted to the window, moves anywhere by dragging its empty room or the wheel, and its blocks are 230 × 115 px (amends 0164).
---

# The «Сервіси» canvas follows the admin Theme, zooms and pans

Owner decision of 2026-11-17, after the first look at «Сервіси» in production. This ADR amends ADR 0164 (the Railway-like canvas).

**It follows the Theme.** The canvas no longer sets `data-theme="dark"` for itself. In the light Theme it is white with black dots, its blocks on the surface colour; in the dark Theme it stays black with white dots, as ADR 0164 drew it.

**It zooms.** The eleven blocks did not fit a laptop window, and the owner zoomed the whole page out to see them. A bar in the canvas's bottom left corner, as on Railway, holds «−», the scale, «+» and «Вмістити», from 30 % to 200 % in steps of 10 %; Ctrl or ⌘ with the wheel, or a trackpad pinch, zooms the canvas under the pointer and not the page; the bar's buttons zoom around the frame's middle. The frame reaches down to the window's bottom (420 px at least), and the canvas opens fitted in it and centred, never above 100 %.

**It moves anywhere.** As on Railway, the canvas has no edges: a press with the main button on its empty room drags it with the pointer until it is let go, and the wheel or two fingers on a trackpad move it, never the page. It is a shift and a scale of the canvas, not a scroll, so it moves even when it fits the frame, and the dots move with it. A press on a block leaves the block its click; the blocks keep their fixed places (ADR 0164: no dragging of blocks).

**The blocks are 230 × 115 px at 100 %**, Railway's size, up from 200 × 88 (`SERVICE_BLOCK` in the contracts). The seeded places on the 300 × 140 px grid still keep every block clear of its neighbours, so no migration.
