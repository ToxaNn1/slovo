# «Сервіси» is the eighth Owner admin section, a Власник only

SLOVO runs on about a dozen outside Services, and the owner had no single place that shows them (spec #1949). ADR 0088 gave the Owner admin seven sections, none for the Services themselves.

**An eighth section, «Сервіси», a Власник only.** It comes after Безпека in the sidebar and, like Безпека, an Адмін neither sees it nor opens it, and an Агент token is refused: every `/v1/admin/services.*` procedure answers `FORBIDDEN` to both. On a phone it is the one section beside Огляд and the Kill switch that opens, as a list of cards reached from Ще.

**A Service is a row of its own table.** `services` keeps the id (from the database), a unique name, the kind, the plan, the monthly price in USD cents, the billing day, the plan's limits, the block's place on the canvas and the links to other Services. A link names the other Service and is `constant` or `scheduled`; the API answers it by the other's id. The kind says what the block shows: `railway` its Online / Offline, `cron` its last and next run, `metered` its usage against its limits. The migration seeds the eleven known Services: Railway, Neon, Cloudflare, GitHub, Expo/EAS, Sentry, PostHog, Zoho Mail, Apple Developer / App Store Connect, Google Play and the Telegram bot. Places are fixed data: no dragging.

**The links of the seed.** Railway (the backend) → Neon, Sentry, PostHog and Zoho Mail; Cloudflare → Railway; GitHub → Railway and Cloudflare (Pages); Expo/EAS → Apple Developer / App Store Connect and Google Play (the app); both stores → Railway (the app calls the backend), all constant; Railway → the Telegram bot is scheduled (the alerts Cron).

**A Railway-like canvas.** Each Service is a block absolutely placed at its position over an SVG layer of lines: solid for a constant link, dashed for a scheduled one. The black background with white dots stays dark whatever the admin's theme: the canvas sets `data-theme="dark"` for itself, and the rest of the admin is unchanged. A block opens a side panel, the admin's native modal `<dialog>` (ADR 0160). Under the admin's phone width (`md`) the canvas becomes a list of cards that open the same panel.

**One usage port, an adapter per provider.** `UsagePort` in `server-core` answers a `ServiceReading` by the Service's kind: a metered Service its usage per limit (name, unit, used, limit), a Railway service also Online or Offline, a Cron its last run and its next. Each provider is an adapter of it in the backend, keyed by the Service's name, and reads with a key from the Deployment's environment, never from the Vault. Sentry reuses Якість's `SENTRY_AUTH_TOKEN` and `SENTRY_ORG`: one call to the organization's stats for the errors accepted this calendar month (UTC), against the Developer plan's 5,000. PostHog reuses the Аналітика's `POSTHOG_PERSONAL_API_KEY`: one HogQL count of this month's events, against the free plan's 1,000,000. An unset key or a failed read answers `unavailable`.

**Usage is cached for an hour.** Every read goes through the cached read of `server-core` (`cachedRead`), in memory, one per Service: within an hour the kept reading comes back and the provider is not asked. `admin.services.usage` answers every ported Service's reading with its read time, apart from `admin.services.list`, so the canvas never waits for a provider. «Оновити» (`admin.services.refreshUsage`, a Власник write) reads one Service's provider at once. A failed read keeps the last good reading, marked stale with its old read time; with none kept the block says «не вдалося прочитати». A restart forgets the cache, so the first page after it reads each provider once.

**The Vault and the Service entries** are named in the glossary here and built by their own tickets of spec #1949, with the decisions they bring.

## Considered Options

- **The Services as a section of Безпека**: rejected. Безпека is about people and tokens; the Services need a canvas of their own.
- **Places computed by a layout library**: rejected. Eleven fixed places are simpler and read the same every time.
- **Railway's Crons as Services of their own**: rejected for now. A Service is an outside provider; the Crons are parts of the Deployment on Railway.
- **Usage kept in Postgres**: rejected. An hour of freshness in memory costs one read per provider an hour and a restart; a table would add a migration for numbers that are an hour old anyway.
- **Billing APIs for usage**: rejected. Sentry's and PostHog's billing endpoints need wider scopes than the keys SLOVO already holds; the organization stats and a HogQL count need none.
