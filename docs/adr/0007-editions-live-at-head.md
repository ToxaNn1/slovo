# Every Edition builds from the latest Core; per-Edition control comes from switches

The Core is not versioned or published. Every Edition always builds from the Core on `main`. Each Edition is controlled separately in two ways:

- every behaviour change ships behind a Feature Switch that is turned on per Edition;
- remote switches on our backend act as an emergency off button.

The Editions live inside one app (ADR 0065), so a native change ships as one store build of the app, from one build profile per platform, and an OTA update reaches every Edition at once on the app's one Update channel, with staged rollout (ADR 0062). No build or update names an Edition: every build bundles the AppConfig's default Edition.

## Considered Options

- **Versioned Core pinned per Edition**: more explicit, but with one developer and many Editions it means supporting several Core versions at once and backporting fixes. Rejected.
- **Per-Edition branches cut from `main`**: kept as a cheap fallback if Editions ever need to drift.
