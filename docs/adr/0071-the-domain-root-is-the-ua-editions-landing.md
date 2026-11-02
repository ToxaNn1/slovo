# The domain root is the UA Edition's landing

1.0 needs a public page that says what SLOVO is and sends readers to the App Store: the store listing's marketing URL, the address in shares and posts. The owner designed it in «Клин 2.0: Рупор» (ADR 0070): hero with the Mascot and the App Store button, the site's one Слово дня, what is inside, screens, the mission («Навіщо») with the goal of a million confirmed Entries, FAQ, a final call and a footer with support and the legal pages.

**The root of the app's domain is the landing of the UA Edition** (Ukrainian, Edition id `uk` today). It is not a factory page that lists Editions or redirects to one: there is one Edition, and its readers should land on its page at the shortest address. The Edition's legal pages keep their paths under `/<id>/` (ADR 0049), and the landing links them relatively (`uk/privacy`), so it works both at the domain root and at the `github.io/<repo>/` address before the domain is set.

**The site is an Astro app, `apps/site`, built to static files**, which the `pages.yml` workflow deploys to GitHub Pages: the landing at the root and every Edition's legal pages under `/<id>/` (ADR 0049). The first version was one hand-written `index.html` with inline styles and a `landing.js` in `.github/pages/`, and the palette, fonts and Mascot were copied into it by hand, so they drifted from the app the day the design changed. The site now takes them from the Edition: the colour and font tokens and the Mascot vector of `editions/uk`, read through `edition-folder.ts` (ADR 0035) at the content sync, and the Mascot's motion from `@slovo/ui/tokens`, the same numbers the app draws with. Each section is an Astro component that renders to HTML with no JavaScript; only what moves is a small React island: the light/dark switch and the goal counter. Tailwind styles the components, and the fonts are self-hosted. The site names no Core screen, and nothing in the backend serves it.

**Placeholders stay visible until their owner decides:** the 2D video in the hero (the owner makes it), the QR code and the App Store link (until the app is in the store), the support email, the answer to «Це безкоштовно?» (until the money decision), the phone mock-ups instead of real screenshots, and the counter's demo number. The counter will show the live count of confirmed Entries from Analytics (ADR 0068); until then the site's `goal.ts` holds a demo constant.

## Considered Options

- **A factory page at the root that redirects to `/uk/`**: rejected by the owner. A second Edition reopens this: it needs its own path or domain then.
- **A static page with no build** (the decision until the Astro site): dropped. It copied the Edition's tokens and the Mascot by hand, so they drifted, and a page of inline styles was hard to change section by section.
- **Next.js**: rejected. It is built for a server; a static landing would use its export mode and ship a React runtime to every page.
- **An Expo web export of the app**: rejected. The landing is not an app screen, and the export ships the whole app bundle for one page.
- **A daily Слово дня rebuilt on the site**: rejected by the owner for one static word, «кракелюр».
