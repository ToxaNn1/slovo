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

The same wrong claim sits in `README.md:31` («One Expo app that builds whichever Edition the environment variable selects»), and `README.md:103` and `README.md:242` still tell you to start Metro with `SLOVO_EDITION=uk`; `apps/mobile/app.config.test.ts:241-244` pins that `SLOVO_EDITION` is ignored.

БУЛО: «The Expo app; the environment variable selects the Edition.» / СТАЛО: «The Expo app; it bundles the AppConfig's `defaultEdition` (`app/app.json`).» (README:31 the same; README:103 and :242 drop `SLOVO_EDITION=uk`.)

### F3. CONTEXT.md:83 — glossary calls the wave "a retired repo process" while three docs run it — CONFIRMED

The Batch entry lists _Avoid_: «Wave (that is a retired repo process, replaced by ADR 0090)». ADR 0090 retired only the PR route for content (`docs/adr/0090-…md:37`: "`docs/agents/content-wave.md` is rewritten around `pnpm content add`"), not waves. Spec waves and content waves are live process in the docs and in a later ADR.

Evidence: `CLAUDE.md:48` ("A spec is built on one integration branch … `docs/agents/waves.md`"), `docs/agents/waves.md`, `docs/agents/content-wave.md:3` ("A wave is a CLI run per implementer: its batch lands «не перевірено»"), ADR 0196 summary ("Word candidates for a content wave come from `pnpm source:lemmas`").

БУЛО: «_Avoid_: Wave (that is a retired repo process, replaced by ADR 0090), PR, commit» / СТАЛО: «_Avoid_: Wave (a content wave is many Batches, one per implementer: `docs/agents/content-wave.md`), PR, commit»

### F4. apps/backend/src/collection-links/collection-page.ts:9 — _Avoid_ word "headword" for an Entry's Lemma — CONFIRMED

`CONTEXT.md:163-165` (Lemma) lists _Avoid_: «Title, headword». The collection page comment says "What the page shows of an Entry: its headword". (`packages/content-rules/src/quote-check.ts:16` uses `headword` for goroh's own page heading, an outside dictionary's word; that one is fine.)

БУЛО: «What the page shows of an Entry: its headword, with Stress where it has one» / СТАЛО: «What the page shows of an Entry: its text (a Word's Lemma), with Stress where it has one»

### F5. CLAUDE.md:15 and README.md:138 — Metro port 8082 against `pnpm dev`'s 8081 — CONFIRMED (the mismatch), PLAUSIBLE (which port the owner uses)

`CLAUDE.md:15` says the owner checks through Metro on 8082, and `README.md:138` says `pnpm smoke:halves` needs "the one Metro … on port 8082", which matches `scripts/smoke-halves.mjs:45` (`default: '8082'`). But `pnpm dev`, which the same README line names as the way to start that Metro, starts Metro on the first free port from 8081 (`scripts/dev.mjs:18`, `:47`), and `README.md:95`, `:120`, `:149` and the Maestro flows (`apps/mobile/maestro/launch.yaml:10`, `METRO_URL || 'http://localhost:8081'`) default to 8081. Following the README (`pnpm dev`, then `pnpm smoke:halves` without `--metro`) points Maestro at a port with no Metro, unless 8081 was busy.

БУЛО: «the one Metro must already run on port 8082 (`--metro <port>` names another)» / СТАЛО: «the one Metro must already run (`pnpm dev` prints its port; pass it with `--metro <port>`, 8082 when left out)»; and either the script default or `dev.mjs` default moves so both say the same port.

### F6. README.md:21 and README.md:188 — "an Edition is a standalone app" — CONFIRMED

`README.md:21`: «An **Edition** is a standalone app for exactly one language»; `README.md:188`: the iOS client id is «One per Edition, since each Edition is its own app». The glossary and ADR 0065 say the opposite, and the same README says so at `:61` («Every build is the one app (ADR 0065)»).

Evidence: `CONTEXT.md:10` («One language inside the one SLOVO app (ADR 0065)»), `CONTEXT.md:11` _Avoid_ «separate app»; ADR 0065 summary («One app per platform with the Editions inside»); `app/app.json` holds one `bundleId` (`app.slovo.uk`) for the app.

БУЛО: «An **Edition** is a standalone app for exactly one language.» / СТАЛО: «An **Edition** is one language inside the one SLOVO app (ADR 0065).»; README:188 БУЛО: «One per Edition, since each Edition is its own app.» / СТАЛО: «One for the app's bundle id.»

### F7. README.md:31-43 — repo map out of date — CONFIRMED

- `:41` `editions/<edition>` holds "content": content lives in Postgres since ADR 0090; the folder holds `edition.json`, strings, tokens, Decor, `seed-snapshot.json`, assets and legal pages (`ls editions/uk`; `docs/agents/map.md:18` lists them right).
- `:43` `tools/content` "drafts Entries in `$EDITOR` and checks an Edition with the build's rules": nothing in `tools/content/src` reads `$EDITOR`; the CLI writes through the content write API (`tools/content/src/cli.ts:5-13`).
- `:42` `tools/sourcing` "drafts Words from goroh.pp.ua and СУМ-11": it drafts Words, Idioms, Corrections and Synonym Rows from goroh and picks Lemmas (`source:lemmas`, `source:hrinchenko`; `package.json` scripts); no source names СУМ-11.
- The map leaves out `apps/site`, `apps/admin`, `apps/video` and `packages/content-rules`, which exist and `docs/agents/map.md` partly lists.

БУЛО: «| `tools/content` | Dev-only CLI that drafts Entries in `$EDITOR` and checks an Edition with the build's rules. |» / СТАЛО: «| `tools/content` | Dev-only CLI that writes Entries through the content write API and checks drafts (`pnpm content`). |» (and the other rows as `docs/agents/map.md` words them)

### F8. README.md:300 — `pnpm content` row describes a CLI that no longer exists — CONFIRMED

The Commands table says `pnpm content new word --edition uk` drafts an Entry "in `$EDITOR`", `pnpm content edit <id or text>`, `pnpm content retire <id>` and `pnpm content check --edition uk` "checks the whole Edition". The CLI has no `new`; `edit` takes `<kind> <id> <file.json>`, `retire` takes `<kind> <id>`, `check` takes `<kind> <array.json | drafts folder>`; it also has `add`, `flag`, `have`, `counts`, `verify`, `import`.

Evidence: `tools/content/src/cli.ts:5-13` (usage), `:173-193` (dispatch).

БУЛО: «`pnpm content new word --edition uk` drafts an Entry with a fresh id in `$EDITOR` … `pnpm content check --edition uk` checks the whole Edition.» / СТАЛО: «`pnpm content add|edit|retire|flag <kind> …` write through the content write API with the Агент token; `have`, `counts`, `check <kind> <drafts>`, `verify` and `import` as in `tools/content/README.md`.»

### F9. README.md:293 and README.md:291 — `pnpm build:pack uk` "validates the Edition's content", `pnpm test` "Jest for `packages/ui`" — CONFIRMED

- `build:pack` builds the Language Pack from the backend's content snapshot (or `--snapshot <file>`), not from files in the Edition (`packages/language-pack/src/cli.ts:41`, usage `[<edition-id>] [--snapshot <file>] [--out <file>]`; `packages/language-pack/src/build.ts:8` `fetchSnapshot`). README step 1 (`:66-69`) says to run it right after `pnpm install` with no backend, which fails (`CONTEXT.md:30`: «A build with the backend down fails»).
- `pnpm test` runs Jest in `apps/mobile` too (`apps/mobile/package.json` `test`: `vitest run && jest`).

БУЛО: «Validates the Edition's content, prints the content report and builds the Language Pack.» / СТАЛО: «Builds the Language Pack from the backend's content snapshot (`EXPO_PUBLIC_SLOVO_API_URL`, or `--snapshot <file>`) and prints the content report.»

### F10. README.md:271 — "the HTML admin (`pnpm admin`) sets the other Rules" — CONFIRMED

`pnpm admin` is a CLI with only `owner add`, `agent add|revoke`, `check add|import` (`apps/backend/src/admin/admin-command.ts:26-30`). Rules and force-update minimums are set in the Owner admin web app (`apps/admin/src/routes/switches.rule.tsx`, `switches.kill.tsx`), served at `/admin`.

БУЛО: «the HTML admin (`pnpm admin`) sets the other Rules» / СТАЛО: «the Owner admin (`/admin`, «Свічі») sets the other Rules»

### F11. README.md:53 — Core constant `LEGAL_SITE` — CONFIRMED

The README says "the Core constant `LEGAL_SITE` is the one place that names the site's base" and pages publish at `<LEGAL_SITE>/<edition>/<page>`. No `LEGAL_SITE` exists in code; the address is built from the AppConfig's `domain`.

Evidence: `apps/mobile/src/settings/legal-page.ts:10-12` (`editionSite(appDomain, edition.id)` → `https://<domain>/<edition>/<page>`, ADR 0065); `.github/workflows/pages.yml:3-10` (the site behind the domain `apps/site/public/CNAME` names, kept equal to the AppConfig's domain).

БУЛО: «at `<LEGAL_SITE>/<edition>/<page>` … the Core constant `LEGAL_SITE` is the one place that names the site's base (ADR 0049)» / СТАЛО: «at `https://<domain>/<edition>/<page>`, the AppConfig's `domain` (ADR 0065)»

### F12. README.md:105-112 and :147 — step 4 "Check the result" describes the 0.2 app — CONFIRMED

The tabs "read Головна, Налаштування, Гра, Збережене", "the four tabs show", and Settings offers "the font size (S, M, L, XL)". The tab strings are now Стрічка, Профіль, Ігри, Збережене, Теми (`editions/uk/strings.json` `tabs.*`), and Text size is «Як у системі» / «Більший» / «Найбільший», with stored S and M read as the first (`CONTEXT.md:232-233`).

БУЛО: «The tabs read Головна, Налаштування, Гра, Збережене (Home, Settings, Game, Saved).» / СТАЛО: «The tabs read as `tabs.*` in `editions/uk/strings.json` (Стрічка, Теми, Ігри, Збережене, Профіль, each behind its Feature Switch).»; «font size (S, M, L, XL)» → «Text size («Як у системі», «Більший», «Найбільший»)».

### F13. README.md:122 — Maestro `SCHEME` default `slovo-uk` — CONFIRMED

The flows default `SCHEME` to `slovo`, the AppConfig's scheme.

Evidence: `apps/mobile/maestro/launch.yaml:10` and `smoke-2.yaml:7` (`SCHEME || 'slovo'`), `app/app.json` (`"scheme": "slovo"`).

БУЛО: «`SCHEME` (default `slovo-uk`)» / СТАЛО: «`SCHEME` (default `slovo`)»

### F14. docs/agents/map.md:28 and README.md:292 — "CI runs everything" — CONFIRMED

CI on a pull request runs only the test parts the change can affect; every part runs on a push to `main` or a change outside the packages.

Evidence: `.github/workflows/ci.yml:46-53` and `:77` (`scripts/ci-affected-parts.mjs`).

БУЛО: «CI runs everything.» / СТАЛО: «CI runs lint, typecheck, deps, the Contract and the Language Pack whole, and the test parts the change can affect (all of them on `main`).»

### F15. README.md:298 — broken anchor `#run-the-ukrainian-edition-on-the-simulator` — CONFIRMED

The heading is `## Run the UA Edition on the simulator` (`README.md:57`), whose anchor is `#run-the-ua-edition-on-the-simulator`.

БУЛО: «(#run-the-ukrainian-edition-on-the-simulator)» / СТАЛО: «(#run-the-ua-edition-on-the-simulator)»

### F16. README.md:287 — `pnpm lint` "ESLint in every package, then Prettier" — CONFIRMED

`pnpm lint` runs oxlint first and the ADR index check (`node scripts/adr-index.mjs --check`), then `turbo run lint` and Prettier (root `package.json` `lint`). A failing ADR `summary:` fails `pnpm lint`, which the row does not tell.

БУЛО: «ESLint in every package, then Prettier.» / СТАЛО: «oxlint, the ADR index check, ESLint in every package, then Prettier.»

### F17. docs/react-native.md:12 — "a folder has no `index.ts` barrel" against its own line 19 — CONFIRMED

`:12` says no folder has an `index.ts` barrel; `:19` says `tokens/index.ts` re-exports every token file, and it does (`packages/ui/src/tokens/index.ts`); `packages/contracts/src/edition-strings/index.ts` is a second one.

БУЛО: «a folder has no `index.ts` barrel» / СТАЛО: «a folder has no `index.ts` barrel, except `packages/ui/src/tokens/` (one import path for the tokens) and `packages/contracts/src/edition-strings/`»

## Checked, no defect

- Every root `pnpm <script>` a doc names exists in `package.json`; per-package ones (`start`, `test:smoke`, `db:generate`, `db:migrate`, `import-media`, `quote-check`, `recordings`, `describe-api`) exist in their packages and the docs run them in that package or through `--filter`.
- `pnpm -s adr:index`, `--next`, `--check` (`scripts/adr-index.mjs:8-9`); `docs/adr/retired.md` exists; `docs/adr/README.md` is generated.
- `.claude/hooks/*`: the token budget (200k / 230k, fork 60k, file 40 KB, brief 1.5 KB, handoff 2 KB) and `commit-messages.mjs` (commit and push checks) are wired in `.claude/settings.json` and do what `CLAUDE.md` and `map.md` say; the `mattpocock-skills` plugin is enabled.
- `commitlint.config.js`: types and scopes (workspace folder names, `deps`, `deps-dev`, `test`) as `CLAUDE.md` says; CI "Commit messages" checks authors and AI attribution (`.github/workflows/commitlint.yml:81-101`).
- `docs/deploy.md`: the variables table matches `apps/backend/src/config.ts` and `.env.example` one to one; `.railway/railway.ts` services, Dockerfiles, commands, schedules, restarts, `preDeploy: 'pnpm db:migrate'` (the image's WORKDIR is `apps/backend`), staging port 8080 and domain; `scripts/staging.ts wizard|reset`; CI deploy job and `SLOVO_BACKEND_URL`; the Owner admin's eight sections (`apps/admin/src/sections.ts`); `pnpm admin owner|agent|check`; «Сервіси» eleven Services.
- `compose.yaml` ports 55432 / 8025 and their variables; `/health`, `content/latest|packs|patch|snapshot` routes (`packages/contracts/src/api/content.ts`); `pnpm reports list|resolve`, `pnpm collection-links delete`, `pnpm switches off`; `housekeeping.yml` runs `pnpm audit` and Knip daily.
- `docs/property-tests.md`: fast-check only in `packages/core` and `packages/language-pack`; `local-date.property.test.ts` follows the naming.
- `docs/react-native.md`: every path, the dependency-cruiser rule, `edition-tabs.tsx`, `test-render.ts` helpers, `ConfirmationDialog`, `BottomSheet`, `editionStrings`, Expo Router 58, Gesture Handler 3; no `Alert.alert` or `ActionSheetIOS` in app code.
- `CONTEXT.md`: Feature Switch ids, Game Mode ids, XP log kinds and the commands it names exist in code. _Avoid_ words found in code are justified: `rarityCeiling` (ADR 0156 keeps the switch id), `settings.dailyLimit` (retired record kept for sync), `deletedCollection` (a reader's deleted Collection, not a Retired Curated Collection), `surzhyk` (a Correction Type value), `content_checksum` (a file hash, not the Content version).
- `docs/agents/domain.md`, `docs/agents/issue-tracker.md`: consistent with `CLAUDE.md`.

## Not finished

Stopped at the 200k soft context limit (`CLAUDE.md`, token budget). Not checked:

- `docs/agents/ticket-brief.md`, `docs/agents/waves.md` (beyond lines 17-19, whose paths and generators exist), `docs/agents/content-wave.md` (beyond lines 1-15), `docs/agents/test-states.md`.
- `CONTEXT.md` entries one by one against the code beyond the identifiers and commands above (only the _Avoid_ words were swept across code and the in-scope docs).
- `README.md:146-180` (Atlas, native build checks) and `docs/deploy.md` claims about outside services (Neon, Cloudflare, Railway settings) that the repo cannot show.
- The push: GitHub declined `git push` of this branch ("push declined due to email privacy restrictions") for the owner identity the environment sets; the commits are local only.
