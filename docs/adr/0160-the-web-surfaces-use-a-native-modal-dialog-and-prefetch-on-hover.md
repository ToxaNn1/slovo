# The web surfaces use a native modal dialog and prefetch on hover

The admin's confirmation, which every admin write goes through (ADR 0088), was a `div` with `role="dialog"`: Esc did nothing, focus could leave it for the page behind, and the page scrolled under it. The site opened every page only on the click, though its pages are static files (ADR 0071).

**The admin's confirmation is a native modal `<dialog>`.** `ConfirmDialog` opens with `showModal()` and puts focus in «Причина». The browser keeps focus inside, makes the page inert and returns focus to the button that opened it. Esc or the back gesture works as «Скасувати»: React unmounts the dialog, so its `cancel` is prevented and the browser never closes it on its own. `overscroll-behavior: contain` on the dialog and its `::backdrop` stops the page scrolling behind it, where the browser supports it; nowhere is `html` or `body` locked.

**The site prefetches a link's page on hover.** Astro's `prefetch` with `prefetchAll` and the `hover` strategy loads a page when the pointer rests on its link or the link takes focus, so it opens at once. Only static HTML is fetched: no API call, no Neon read. A Word page is about 7 KB gzipped; 10 000 visits with 20 hovers each make about 1.4 GB a month, against the 100 GB soft limit of GitHub Pages and behind the Cloudflare cache (ADR 0125).

## Considered Options

- **Keep the hand-made overlay and add an Esc handler and a focus trap**: rejected. The native modal gives both, plus the inert page and focus return, with no code of ours.
- **Prefetch every link in view (`viewport`)**: rejected. A list of Words would load dozens of pages nobody opens.
- **Speculation Rules prerendering (Astro's `clientPrerender`)**: rejected for now. It is experimental in Astro and Chromium only; `hover` prefetch works everywhere.
