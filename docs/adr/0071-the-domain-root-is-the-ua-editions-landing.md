# The domain root is the UA Edition's landing

1.0 needs a public page that says what SLOVO is and sends readers to the App Store: the store listing's marketing URL, the address in shares and posts. The owner designed it in «Клин 2.0: Рупор» (ADR 0070): hero with the Mascot and the App Store button, the site's one Слово дня, what is inside, screens, the mission («Навіщо») with the goal of a million confirmed Entries, FAQ, a final call and a footer with support and the legal pages.

**The root of the app's domain is the landing of the UA Edition** (Ukrainian, Edition id `uk` today). It is not a factory page that lists Editions or redirects to one: there is one Edition, and its readers should land on its page at the shortest address. The Edition's legal pages keep their paths under `/<id>/` (ADR 0049), and the landing links them relatively (`uk/privacy`), so it works both at the domain root and at the `github.io/<repo>/` address before the domain is set.

**The landing is a static page in `.github/pages/`**, published by the same `pages.yml` workflow and GitHub Pages as the legal pages: `index.html`, `landing.js` and `favicon.svg`. It has no build step and no dependency: the HTML carries the design's inline styles, and `landing.js` does the two things that move, the light/dark switch and the goal counter. It ships with no Jekyll front matter, so Jekyll copies it as is and the legal pages' layout doesn't wrap it. The page names no Core or app code, and nothing in the backend serves it.

**Placeholders stay visible until their owner decides:** the 2D video in the hero (the owner makes it), the QR code and the App Store link (until the app is in the store), the support email, the answer to «Це безкоштовно?» (until the money decision), the phone mock-ups instead of real screenshots, and the counter's demo number. The counter will show the live count of confirmed Entries from Analytics (ADR 0068); until then `landing.js` holds a demo constant.

## Considered Options

- **A factory page at the root that redirects to `/uk/`**: rejected by the owner. A second Edition reopens this: it needs its own path or domain then.
- **A framework site (Astro, Next, an Expo web export)**: rejected for now. One page has no use for a build, and Pages already deploys the folder on merge.
- **A daily Слово дня rebuilt on the site**: rejected by the owner for one static word, «кракелюр».
