# «Сервіси» is the eighth Owner admin section, a Власник only

SLOVO runs on about a dozen outside Services, and the owner had no single place that shows them (spec #1949). ADR 0088 gave the Owner admin seven sections, none for the Services themselves.

**An eighth section, «Сервіси», a Власник only.** It comes after Безпека in the sidebar and, like Безпека, an Адмін neither sees it nor opens it, and an Агент token is refused: every `/v1/admin/services.*` procedure answers `FORBIDDEN` to both. On a phone it is the one section beside Огляд and the Kill switch that opens, as a list of cards reached from Ще.

**A Service is a row of its own table.** `services` keeps the id (from the database), a unique name, the kind, the plan, the monthly price in USD cents, the billing day, the plan's limits, the block's place on the canvas and the links to other Services. A link names the other Service and is `constant` or `scheduled`; the API answers it by the other's id. The kind says what the block shows: `railway` its Online / Offline, `cron` its last and next run, `metered` its usage against its limits. The migration seeds the eleven known Services: Railway, Neon, Cloudflare, GitHub, Expo/EAS, Sentry, PostHog, Zoho Mail, Apple Developer / App Store Connect, Google Play and the Telegram bot. Places are fixed data: no dragging.

**The links of the seed.** Railway (the backend) → Neon, Sentry, PostHog and Zoho Mail; Cloudflare → Railway; GitHub → Railway and Cloudflare (Pages); Expo/EAS → Apple Developer / App Store Connect and Google Play (the app); both stores → Railway (the app calls the backend), all constant; Railway → the Telegram bot is scheduled (the alerts Cron).

**A Railway-like canvas.** Each Service is a block absolutely placed at its position over an SVG layer of lines: solid for a constant link, dashed for a scheduled one. The black background with white dots stays dark whatever the admin's theme: the canvas sets `data-theme="dark"` for itself, and the rest of the admin is unchanged. A block opens a side panel, the admin's native modal `<dialog>` (ADR 0160). Under the admin's phone width (`md`) the canvas becomes a list of cards that open the same panel.

**Money by hand.** The Власник enters a Service's plan, monthly price (USD cents) and billing day, and adds a Service by name and kind; each write takes a confirmation and a `ReasonSchema` reason and appends an Action log row: `service.add` with the fields entered, or `service.money.edit` with the Service's name and only the fields that changed, before and after (none when nothing changed). A new Service takes the first place, row by row on a 300 × 140 px grid, whose block keeps 20 px clear of every other block. The list answers the monthly total, the priced Services summed, and the next charge: the nearest Kyiv day, today included, on which a Service with a price above zero and a billing day charges, a billing day past the month's end charging on its last day; the backend counts both by its clock.

**The Vault and the Service entries** are named in the glossary here and built by their own tickets of spec #1949, with the decisions they bring.

## Considered Options

- **The Services as a section of Безпека**: rejected. Безпека is about people and tokens; the Services need a canvas of their own.
- **Places computed by a layout library**: rejected. Eleven fixed places are simpler and read the same every time.
- **Railway's Crons as Services of their own**: rejected for now. A Service is an outside provider; the Crons are parts of the Deployment on Railway.
