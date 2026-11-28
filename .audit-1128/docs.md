# Audit 28.11: docs against code

Base: `origin/main` at 8665bce. Scope: `CONTEXT.md`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/*.md`, `docs/agents/*.md`. Read-only: no code or doc changed.

## Findings

### F1. README.md:61 — Core fonts folder that does not exist — CONFIRMED

The README says the app's fonts are "the Core's (`packages/ui/assets/fonts/`) and every file in the Edition's `assets/fonts/`". There is no `packages/ui/assets/` folder; the Core brings no fonts.

Evidence: `apps/mobile/app.config.ts:446` ("The Edition's fonts, embedded in the native app; the Core brings none (ADR 0006)"), `apps/mobile/app.config.ts:110`; the only `fonts` folders are `editions/uk/assets/fonts` and the language-pack fixtures.

БУЛО: «the fonts are the Core's (`packages/ui/assets/fonts/`) and every file in the Edition's `assets/fonts/` (ADR 0006)» / СТАЛО: «the fonts are every file in the Edition's `assets/fonts/`; the Core brings none (ADR 0006)»

### F2. docs/agents/map.md:7 — "the environment variable selects the Edition" — CONFIRMED

The map says an environment variable selects the Edition for `apps/mobile`. The app reads `defaultEdition` from the AppConfig; no environment variable names an Edition. `README.md:61` says the same as the code ("no command names an Edition"), so the two docs contradict each other.

Evidence: `apps/mobile/app.config.ts:356` (`const id = app.config.defaultEdition`), `app/app.json` (`"defaultEdition": "uk"`); `app.config.ts` reads only `EAS_BUILD_PROFILE`, the Google client id and the API URL from the environment (`:210`, `:233`, `:246`).

БУЛО: «The Expo app; the environment variable selects the Edition.» / СТАЛО: «The Expo app; it bundles the AppConfig's `defaultEdition` (`app/app.json`).»

### F3. CONTEXT.md:83 — glossary calls the wave "a retired repo process" while three docs run it — CONFIRMED

The Batch entry lists _Avoid_: «Wave (that is a retired repo process, replaced by ADR 0090)». ADR 0090 retired only the PR route for content (`docs/adr/0090-…md:37`: "`docs/agents/content-wave.md` is rewritten around `pnpm content add`"), not waves. Spec waves and content waves are live process in the docs and in a later ADR.

Evidence: `CLAUDE.md:48` ("A spec is built on one integration branch … `docs/agents/waves.md`"), `docs/agents/waves.md`, `docs/agents/content-wave.md:3` ("A wave is a CLI run per implementer: its batch lands «не перевірено»"), ADR 0196 summary ("Word candidates for a content wave come from `pnpm source:lemmas`").

БУЛО: «_Avoid_: Wave (that is a retired repo process, replaced by ADR 0090), PR, commit» / СТАЛО: «_Avoid_: Wave (a content wave is many Batches, one per implementer: `docs/agents/content-wave.md`), PR, commit»

### F4. apps/backend/src/collection-links/collection-page.ts:9 — _Avoid_ word "headword" for an Entry's Lemma — CONFIRMED

`CONTEXT.md:163-165` (Lemma) lists _Avoid_: «Title, headword». The collection page comment says "What the page shows of an Entry: its headword". (`packages/content-rules/src/quote-check.ts:16` uses `headword` for goroh's own page heading, an outside dictionary's word; that one is fine.)

БУЛО: «What the page shows of an Entry: its headword, with Stress where it has one» / СТАЛО: «What the page shows of an Entry: its text (a Word's Lemma), with Stress where it has one»

### F5. CLAUDE.md:15 — "the owner checks on the phone through Metro (8082)" — PLAUSIBLE

`pnpm dev` starts Metro on the first free port from `SLOVO_METRO_PORT`, default 8081, and `README.md:95` says the development client connects on `localhost:8081`. No script, config or env default in the repo names 8082. It is right only if the owner's own setup sets `SLOVO_METRO_PORT=8082` or 8081 is busy.

Evidence: `scripts/dev.mjs:18` and `:47` (`SLOVO_METRO_PORT ?? 8081`), `apps/mobile/package.json` (`start`: `expo start --dev-client`, no port).

БУЛО: «through Metro (8082)» / СТАЛО: «through Metro (`pnpm dev`, port 8081 or the next free one)»

