# SLOVO

SLOVO helps people discover, learn and share rare words of a single language. The first app is the **Ukrainian Edition**: a vertical Feed of Rare Words with stress marks and definitions, Corrections of common non-standard phrases, a Game, a home-screen widget and optional sync across devices.

> Status: version 0.2 (Feed) is built; 0.3 (My words) is next. What exists today:
>
> - the monorepo with the Core, the shared contracts, the Language Pack build and a UI package;
> - the mobile shell: one Expo app that builds the Ukrainian Edition, with the final four tabs;
> - Home is the Feed: the Word of the Day, Word cards with Pronunciation, Corrections and Idioms mixed in, Seen and Cycles kept on the device, in the Ukrainian Decor;
> - Settings with the Theme and the font size;
> - the Ukrainian Edition's content (Words, Corrections and Idioms) and a content quality gate that CI runs on every change;
> - CI with lint, typecheck, tests and secret scanning on every change, and a daily dependency audit and Knip report.
>
> My words, the Game, the widget and the backend arrive in later versions; see the [master spec](https://github.com/ToxaNn1/slovo/issues/1) for the roadmap.

## The factory idea

SLOVO is built as a factory, not as one app.

- The **Core** holds all language-agnostic behaviour and screens. It knows nothing about Ukrainian.
- An **Edition** is a standalone app for exactly one language. It is the Core plus a **Language Pack** (words, categories, UI strings, language traits), Feature Switches, design tokens and Decor.
- A new language means a new Edition folder. The Core does not change. Editions extend the Core only through Feature Switches, Extension Points and Decor ([ADR 0006](docs/adr/0006-editions-extend-core-only-through-extension-points.md)).

The vocabulary used here and in the code is defined in [`CONTEXT.md`](CONTEXT.md).

## Repo map

Parts marked as placeholders are reserved and filled by later versions.

| Path                     | Role                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `apps/mobile`            | One Expo app that builds whichever Edition the environment variable selects.                        |
| `apps/widget`            | The native SwiftUI home-screen widget, linked into the iOS project at prebuild.                     |
| `apps/backend`           | The API: the HTTP shell, the adapters and the composition root of the backend.                      |
| `packages/core`          | Pure TypeScript domain logic (no React, no React Native).                                           |
| `packages/ui`            | Screens, components, design tokens and Decor slots.                                                 |
| `packages/contracts`     | Zod schemas for Entries, the Edition config and the Language Pack.                                  |
| `packages/server-core`   | The backend's rules and ports (no HTTP, no SQL, no language).                                       |
| `packages/language-pack` | Builds an Edition's content into a read-only SQLite Language Pack and reads packs back.             |
| `packages/config`        | Shared TypeScript, ESLint and Prettier configuration.                                               |
| `editions/<edition>`     | One folder per Edition: configuration, strings, design tokens, Decor, content, assets, legal pages. |
| `tools/sourcing`         | Dev-only tool that drafts Words from goroh.pp.ua and СУМ-11 for human review.                       |
| `tools/content`          | Dev-only CLI that drafts Entries in `$EDITOR` and checks an Edition with the build's rules.         |
| `docs/`                  | Architecture decision records in `docs/adr/` and the design brief in `docs/design/`.                |

## Documents

- [`CONTEXT.md`](CONTEXT.md): the domain glossary.
- [`docs/adr/`](docs/adr/README.md): architecture decision records, with an index of every number.
- [`docs/deploy.md`](docs/deploy.md): the Deployment on Railway, its container image and every variable it reads.
- [`docs/owner-checks.md`](docs/owner-checks.md): the steps only the owner takes, by version.
- [Master spec, issue #1](https://github.com/ToxaNn1/slovo/issues/1): product vision, every decision so far and the roadmap from 0.1 to 1.0.
- [0.1 Foundation spec, issue #2](https://github.com/ToxaNn1/slovo/issues/2) and [0.2 Feed spec, issue #51](https://github.com/ToxaNn1/slovo/issues/51): the versions built so far and their tickets.
- `editions/<edition>/legal/`: the Edition's privacy policy and terms, which the workflow `Pages` publishes to GitHub Pages at `<LEGAL_SITE>/<edition>/<page>` on every change on `main`; the Core constant `LEGAL_SITE` is the one place that names the site's base (ADR 0049). Pages must be on in the repository settings with "GitHub Actions" as its source.
- [`CLAUDE.md`](CLAUDE.md): the guide for coding agents (`AGENTS.md` points to it).

## Run the Ukrainian Edition on the simulator

The native app is a development build made in EAS cloud ([ADR 0004](docs/adr/0004-native-builds-in-eas-cloud.md)). The JavaScript runs locally against it, served by Metro with fast refresh, so day-to-day work never waits for a cloud build.

The `SLOVO_EDITION` environment variable selects the Edition. Every Expo and EAS command fails with a clear message when it is missing or names an unknown Edition. The app name, bundle id, icon, locale, fonts, notification sound and splash come from `editions/<edition>/`: the fonts are the Core's (`packages/ui/assets/fonts/`) and every file in the Edition's `assets/fonts/` (ADR 0006), and the splash is Decor slot 7, described by `decor/splash.json`. An Edition without a splash gets the Core's plain one. Once the JavaScript runs, the app draws the rest of slot 7 over the native splash (the background, the wordmark, the tagline and the band from `decor/decor.json`) and fades it out.

You need the Node version in [`.nvmrc`](.nvmrc), pnpm, Xcode with an iOS Simulator (iOS 17 or later) and access to the Expo account `anton_de`. The commands below run the Expo CLI and `eas-cli` through `npx`, so neither needs a global install.

1. Install the dependencies and build the Language Pack. Rebuild the pack whenever the content changes; Metro picks up the new file. The build prints the content report and fails when the content misses a target in `editions/<edition>/content/targets.json` (ADR 0009).

   ```sh
   pnpm install
   pnpm build:pack uk
   ```

2. Get the development build. It is needed once, and again only after a native change: a new native module, an Expo SDK upgrade, or a new name, bundle id, icon, font, splash or notification sound. Each build counts against the free tier of 15 iOS builds a month.

   Version 0.2 needs a build made from 0.2 code (ticket #52) or later. It adds every native module 0.2 uses (`expo-speech` for Pronunciation, `react-native-svg` for Decor, `expo-haptics`, `expo-localization`, `expo-system-ui`), the Literata and Manrope fonts and the Edition's splash. A 0.1 build lacks them, and the 0.2 JavaScript needs them. The rest of 0.2 changes JavaScript only, so this one build serves the whole version.

   Version 0.4 adds two native modules, `expo-notifications` and `@react-native-community/datetimepicker`, and the Edition's notification sound (`notificationSound` in `edition.json`, a `.caf`, `.wav` or `.aiff` file of at most 30 seconds in `assets/`; the app config checks it and bundles it). The build is made once for the whole version, after the scheduler adapter ticket (#176) merges, and only when the owner says so. Until then a 0.3 development client keeps working: the shell asks `nativeModules` (`apps/mobile/src/device/device-native-modules.ts`) before it touches either module, so the app starts without them and the features that need them stay off.

   Version 0.6 adds the home-screen widget, so its build is the next native batch. It brings a widget extension target, written in SwiftUI in `apps/widget`, which `@bacons/apple-targets` links into the Xcode project at prebuild; the App Group `group.<bundle id>` on the app and on the extension; and two native modules, `expo-file-system` for the App Group's container and the Apple targets' storage module, which asks WidgetKit to reload ([ADR 0026](docs/adr/0026-the-widget-reads-a-widget-snapshot-the-core-builds.md)). The prebuild writes the widget's Edition files into `apps/widget`: the colour sets, the divider band, the fonts, the widget's strings, the example Widget Snapshot and the extension's `Info.plist`, none of them kept in git. The Swift code can't be built on this laptop (ADR 0004), so the widget is checked on the simulator after that build. The build is made once for the whole version, after the 0.6 native tickets merge, and only when the owner says so. Until then a 0.5 development client keeps working: the shell asks `nativeModules` before it touches the new modules, so the app starts without them and writes no Widget Snapshot.

   Share Cards add the view-capture module `react-native-view-shot` to the same build. Until then the share button stays out of the action row while `nativeModules` reports the capture module missing.

   Version 0.7 brings Content updates, which keep a downloaded Language Pack in the app's documents directory with `expo-file-system`, and adds `expo-secure-store`, which keeps the SLOVO ID Session in the Keychain, on this device only. Both need the next build, after 0.8, made when the owner says so. Until then content updates stay off while `nativeModules` reports `expo-file-system` missing, and the app opens the Language Pack it was built with; while it reports `expo-secure-store` missing, the shell keeps the Session in memory, so signing in works on the simulator now and the Session lasts until the app restarts. Check both after that build ([Check a new native build](#check-a-new-native-build)).

   ```sh
   cd apps/mobile
   SLOVO_EDITION=uk npx eas-cli build -p ios --profile development-simulator-uk
   ```

   When the build is done, install the latest one on the booted simulator:

   ```sh
   SLOVO_EDITION=uk npx eas-cli build:run -p ios --latest --profile development-simulator-uk
   ```

   To install a build by hand instead, download its `.tar.gz` from the EAS dashboard, unpack it and run `xcrun simctl install booted SLOVO.app`.

3. Start Metro from `apps/mobile`, then open SLOVO on the simulator. The development client connects to the server on `localhost:8081`; pressing `i` in the Metro terminal opens the app for you. When port 8081 is taken, pass another one, e.g. `SLOVO_EDITION=uk pnpm start --port 8162`, and give the smoke flow the same port (step 5).

   ```sh
   SLOVO_EDITION=uk pnpm start
   ```

   The app draws itself with the Edition's design tokens (`editions/<edition>/tokens.json`) and Decor (`editions/<edition>/decor/decor.json`, [ADR 0014](docs/adr/0014-editions-supply-decor-as-vector-motifs.md)). To check the Core's neutral look instead, start Metro with `SLOVO_CORE_TOKENS=1 SLOVO_EDITION=uk pnpm start --clear`, and drop the variable (with `--clear` again) to go back.

   In a development build, `xcrun simctl openurl booted slovo-uk://decor` opens a showcase of every Decor slot 0.2 uses. Its switches show the Edition's Decor or the Core's, light or dark; the link takes `?look=core`, `?scheme=dark` and `?splash=1` to start in that state.

4. Check the result. The tabs read Головна, Налаштування, Гра, Збережене (Home, Settings, Game, Saved). Home is the Feed, one card per screen:
   - Each local day opens on its Word of the Day, badged «Слово дня · 12 жовтня». Swipe up for the next card and down to go back; a hint says so on the first launch only.
   - A Word card shows the Lemma with its Stress marks, the part of speech, the Definition, an Example, Synonyms, register and Category chips, and «Детальніше» for the rest. The speaker button reads the Lemma aloud with the device's Ukrainian voice, or explains how to get one.
   - About every fifth card is a Correction («Так часто кажуть → Українською краще»), and about every seventh an Idiom («бити байдики» → «ледарювати») or a place name.
   - A card that stays on screen for 0.5 s is Seen and doesn't come back in the same Cycle. Once everything is Seen, the end-of-Cycle card says so, and the next swipe starts a new Cycle. The Feed reopens on the last card the same day.
   - While the Language Pack opens, the Feed shows a skeleton card with the divider being stitched; if the pack can't be opened, a local error state («Нитка урвалася») offers to try again.

   Settings offers the Theme (System, Light or Dark) and the font size (S, M, L, XL) with a live preview. The choices are kept on the device in a user-state database apart from the Language Pack, and System follows the iOS appearance. The Game tab opens the mode screen of the Game: «Вгадай слово» plays 15 Rounds with 5 Lives to a win or a loss.

   With Reduce Motion on (Settings › Accessibility › Motion), the cards cross-fade in 200 ms instead of sliding, and the loading skeleton holds still. With VoiceOver, every card element, chip and button has a label, the Lemma's Stress is spoken («наголос на а»), and the actions «Наступний запис» and «Попередній запис» on the Lemma and the Definition stand in for the swipes. The app needs no network: the Language Pack ships inside the app and is opened read-only. At launch the app checks that the native app, the JavaScript bundle and the Language Pack are of the same Edition, and shows its load-failed screen when they are not. [Verify the app with networking off](#verify-the-app-with-networking-off) by hand once per release candidate.

5. Run the smoke flow with [Maestro](https://maestro.mobile.dev) from `apps/mobile` while Metro is running. It is a local check and does not run in CI. It walks the 0.2 flow: launch, the Word of the Day badge, a swipe to the next card and back, the Pronunciation button, Settings with the Dark Theme and font size L, the Feed again, and a relaunch that keeps all of it and the day's Word. On a new simulator it also closes the development client's menu when it opens over the app. `apps/mobile/maestro/smoke.yaml` only launches the app and calls one subflow per feature from `apps/mobile/maestro/flows/`, so a feature edits its own file. A fresh install opens the onboarding over the Feed, so the flow's opening step skips it; the onboarding's own subflows run last, each from a cleared app state.

   ```sh
   pnpm test:smoke
   ```

   Every setting of the flow has a default that `-e` overrides: `METRO_URL` (default `http://localhost:8081`, given as a plain URL), `APP_ID` (default `app.slovo.uk`) and `SCHEME` (default `slovo-uk`). For Metro on another port:

   ```sh
   pnpm test:smoke -e METRO_URL=http://localhost:8162
   ```

   The defaults live in JavaScript in the flow rather than in its `env:` block, because Maestro lets a flow's `env:` win over `-e`.

   The sync flow also reaches the backend (the one Metro was started against, step 8) at `API_URL`, default `http://localhost:8787`. With the backend on another port, add it: `pnpm test:smoke -e METRO_URL=http://localhost:8162 -e API_URL=http://localhost:8788`.

   `smoke.yaml` runs two halves in a row: `smoke-1.yaml` (from the launch to the Collections, no backend) and `smoke-2.yaml` (History, the Mix, hiding, notifications, `account.yaml` and `sync.yaml` with the backend, then the flows from a fresh install). Together they call each flow of `flows/` once. To run them at once, on two booted simulators with the development client, each with its own Metro and both against one backend, use `pnpm smoke:halves`:

   ```sh
   pnpm smoke:halves --device <udid> --device <udid> --metro 8175 --metro 8176 --api 8795
   ```

   The first `--device` and `--metro` are half 1, the second half 2; Metro must already run on each port, started with `EXPO_PUBLIC_SLOVO_API_URL` pointing at the backend (`pnpm dev` does that for one Metro). The script passes `-e METRO_URL=…` and `-e API_URL=…` to Maestro, takes the machine-wide lock `/tmp/slovo-maestro.lock` once for both halves, waits while another run holds it, and ends with a list per half of the flows that passed, the one that failed and the ones not run after it. Its raw Maestro output stays in a temporary folder whose path it prints. It boots and shuts down nothing. `JAVA_HOME` defaults to `/usr/local/opt/openjdk@17` when it is unset and that folder exists.

## Verify the app with networking off

The Ukrainian Edition must work offline (ticket #6). No automated check covers this yet, so run it by hand on the simulator. The iOS Simulator shares the Mac's network, and Metro on `localhost` keeps working without it.

1. Do steps 1 to 3 above, so that the development build is installed and Metro is running.
2. Turn off Wi-Fi and unplug Ethernet on the Mac. Check that the network is down, e.g. `ping -c 1 1.1.1.1` fails.
3. Force-quit SLOVO in the simulator, then open it again and connect to Metro on `localhost:8081`.
4. Run `pnpm test:smoke` from `apps/mobile`, or check by hand that the four tabs show and the Feed shows a Word with its Stress mark and Definition and swipes to the next one.
5. Look for network errors in the Metro log. There must be none.

A development build still needs Metro, so this does not prove that a release build starts with no connection. Repeat the check on a preview or release build once such a build exists.

## Check a new native build

What the tests can't reach runs on the simulator after the native build that brings it, by hand. Version 0.7:

1. **A Content update downloads, is kept and opens at the next launch.** Start the backend ([Run the backend](#run-the-backend)). In a second worktree with the same `apps/backend/.env`, correct a Definition, record and build the content with `pnpm build:pack uk --record`, and publish it with `pnpm publish:pack uk`. The checkout Metro runs from keeps the older content, so the app bundles an older pack than the published one. Delete the app from the simulator, install the build again and open it: the first check is due at once. The app's data folder (`xcrun simctl get_app_container booted app.slovo.uk data`) then holds `Documents/content-update/kept.json`, naming the new content version, beside `language-pack-<version>.db`. The open app still shows the old Definition. Add a Word to Favorites, force-quit the app and open it again: the corrected Definition shows, and the Word is still in Favorites. Opening it again the same day asks the backend nothing (no `content.latest` request in its log).
2. **The SLOVO ID Session survives a restart.** Sign in on the SLOVO ID screen with a code from Mailpit, force-quit the app and open it again: the screen still shows the email, signed in.

The checks of the native build of 0.9, on a real iPhone, are in [the owner's checks](docs/owner-checks.md#09-build).

## Check the bundle with Expo Atlas

No test or CI job looks at what goes into the app's JavaScript bundle. [Expo Atlas](https://docs.expo.dev/guides/analyzing-bundles/) shows it in the browser: every module, its size and who imports it. Run it by hand before each EAS build (the next one is the build of 0.9) and when a change adds a runtime dependency to `apps/mobile` or to a package it imports. It needs no simulator and no backend; `expo-atlas` is a devDependency of `apps/mobile`.

1. Build the Language Pack once (`pnpm build:pack uk`), then export the production bundle with Atlas on, from `apps/mobile`:

   ```sh
   SLOVO_EDITION=uk EXPO_ATLAS=true npx expo export --platform ios
   ```

   The export writes the bundle to `apps/mobile/dist/` and Atlas's data to `apps/mobile/.expo/atlas.jsonl`; git ignores both. Each export starts a fresh `atlas.jsonl`.

2. Open it: `pnpm exec expo-atlas .expo/atlas.jsonl` (still in `apps/mobile`) serves Atlas on `http://localhost:3000` and opens the browser.
3. Look for:
   - **The largest modules.** Sort by size and ask whether each big one earns its place, and whether a dependency pulls in more than the part the app uses. Compare the total with the previous check; a jump needs a reason.
   - **Node-only or development code.** Nothing from `node_modules` that only runs in Node (`node:` built-ins, `fs`, polyfills for them), and nothing that belongs to tests or tooling: Vitest, Jest, Testing Library, ESLint, `@slovo/core/testing` and its fakes, `tools/`.
   - **The Core pulling in what it should not.** Nothing that `packages/core` imports, directly or through a dependency, is React, React Native, Expo or Node ([ADR 0002](docs/adr/0002-one-app-per-language.md), [ADR 0006](docs/adr/0006-editions-extend-core-only-through-extension-points.md)). ESLint bans these imports in the Core's own files; Atlas shows what arrives through its dependencies. And nothing from the backend in the app at all: `@slovo/server-core`, Hono, SQL drivers.

   Anything wrong goes into a ticket before the build.

Atlas also runs beside Metro for a development build: start with `SLOVO_EDITION=uk EXPO_ATLAS=true pnpm start` in `apps/mobile`, press `shift+m` and open **expo-atlas**. A development bundle holds development code on purpose, so judge size and leaks on the export above.

## Sign in with Google

The app signs in with Google through Google's own native sheet ([ADR 0047](docs/adr/0047-one-account-per-email-whatever-the-sign-in-method.md)); the backend verifies the identity token it gets. Both need SLOVO's OAuth client ids at Google, which come from the environment and never the repository. Without them «Увійти через Google» stays hidden and the backend refuses Google sign-ins.

1. In the [Google Cloud console](https://console.cloud.google.com/), pick or create the project for SLOVO and set up its **OAuth consent screen** (Google Auth Platform → Branding): the app's name, a support email, and the privacy policy and terms addresses. While it is in testing, only the test users listed there can sign in; publish it before the beta.
2. **The iOS client id.** Google Auth Platform → Clients → Create client, type **iOS**, with the Edition's bundle id (`app.slovo.uk` for the Ukrainian Edition). Google shows its client id, `…apps.googleusercontent.com`. One per Edition, since each Edition is its own app.
3. **The Web client id** (optional). Create a client of type **Web application**. The app doesn't use it today: an identity token from the iOS sheet names the iOS client id as its audience. Keep it for a later backend or Android client; add it to `GOOGLE_CLIENT_IDS` only once a client asks for tokens with it.
4. **The app.** Build with the iOS client id in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`: as an EAS environment variable of the build's profile, or in the shell for a local build. The app config adds Google's sign-in SDK with its URL scheme, the client id reversed (`com.googleusercontent.apps.…`), and refuses an id that is not one for iOS. A build without it still holds the SDK, but registers no URL scheme and hides the button.
5. **The backend.** Put the iOS client id, and every other one a client signs in with, in `GOOGLE_CLIENT_IDS`, comma-separated ([Run the backend](#run-the-backend)). The backend refuses a token whose audience is not on the list.

## Run Maestro in CI

The workflow **Maestro** ([`.github/workflows/maestro.yml`](.github/workflows/maestro.yml), [ADR 0004](docs/adr/0004-native-builds-in-eas-cloud.md)) builds the development client for the iOS Simulator on a GitHub macOS runner, without EAS, and runs `apps/mobile/maestro/launch.yaml` against it with Metro and the backend. It starts by hand only: on GitHub, **Actions → Maestro → Run workflow**, pick the branch, or `gh workflow run maestro.yml --ref <branch>`. The first run after a native change builds the app (pods and `xcodebuild`); later runs take the built app from the cache, keyed by the native inputs, and skip the build. Each run uploads the artifact `maestro-launch`: Maestro's output and JUnit report (`maestro/`, `report.xml`), a screenshot of the simulator at the end (`simulator.png`), and the logs of the build (`xcodebuild.log`, only when it built), Metro (`metro.log`) and the backend (`backend.log`). Download it from the run's page or with `gh run download <run id> --name maestro-launch`. On a failure, read Maestro's screenshots and `maestro.log` in `maestro/` first.

## Run the backend

The backend serves every Edition from one deployment ([ADR 0030](docs/adr/0030-the-backend-is-a-factory-too.md)). It runs on the Mac with Node; Postgres 17 and Mailpit run in Docker. You need Docker Desktop running.

`pnpm dev` does steps 1–4 below and starts Metro pointed at the backend, in one terminal (see [Commands](#commands)). The steps are here for doing them one by one.

1. Start the local services from the repo root. They are started once per machine and shared by every worktree: the Compose project is always `slovo`, so a second worktree finds the running containers. The data stays in the `slovo_postgres` volume.

   ```sh
   docker compose up --detach --wait
   ```

   | Service              | Address                                        | Move it with          |
   | -------------------- | ---------------------------------------------- | --------------------- |
   | Postgres             | `postgres://slovo:slovo@localhost:55432/slovo` | `SLOVO_POSTGRES_PORT` |
   | Mailpit, SMTP        | `smtp://localhost:1025`                        | `SLOVO_SMTP_PORT`     |
   | Mailpit, web page    | <http://localhost:8025>, every email sent      | `SLOVO_MAILPIT_PORT`  |
   | The backend (step 4) | <http://localhost:8787>                        | `PORT` in `.env`      |

   Postgres is published on 55432, not on its default 5432, which other projects on the machine may hold; Mailpit keeps its own ports, and the backend takes 8787, the address the app expects in development. To move one, set its variable when you start the services, e.g. `SLOVO_POSTGRES_PORT=55433 docker compose up --detach --wait`, and change the URL in `.env` to match (`SMTP_PORT` for Mailpit's SMTP). `docker compose stop` stops the services and keeps the data.

2. Copy the example environment and fill it in. The server reads it at start and refuses to start, naming the variable, when one is missing or wrong. It refuses the example's `AUTH_SECRET` too, which anyone can read: put your own, made with `openssl rand -base64 32` (`pnpm dev` puts one itself). `GOOGLE_CLIENT_IDS` holds SLOVO's OAuth client ids at Google, comma-separated, for Sign in with Google ([ADR 0047](docs/adr/0047-one-account-per-email-whatever-the-sign-in-method.md)); left empty, the backend refuses Google sign-ins as switched off. The repository holds no real id. `SENTRY_DSN` is the DSN of the backend's project at Sentry: the backend reports each unexpected failure (500) there, with no personal data (no email, IP address, token, Sign-in code, headers or body), and never a refused request (4xx); left empty, it reports nothing. The repository holds no real DSN. The sign-in emails go to Mailpit while `SMTP_HOST` and `SMTP_PORT` are unset; on a host, set them, `SMTP_USER` and `SMTP_PASSWORD` (the provider's login), `SMTP_TLS=true` for TLS from the first byte (otherwise the client upgrades with STARTTLS when the server offers it) and `MAIL_FROM`, the sender's address. With `NODE_ENV=production` the server refuses to start without them, naming each. `.env` stays out of git.

   ```sh
   cp apps/backend/.env.example apps/backend/.env
   ```

3. Run the migrations. The server never runs them itself. A change of the schema in `apps/backend/src/database/schema.ts` becomes a new migration with `pnpm --filter @slovo/backend db:generate`, which is reviewed as SQL in the pull request. Migrations only go forward: a shipped one is never edited, and a fix is a new one.

   ```sh
   pnpm --filter @slovo/backend db:migrate
   ```

4. Start the backend in watch mode and check it. `/health` answers 200 with the name of the last migration while the database answers and has run every migration, and 503 otherwise. The logs are JSON lines on stdout, each with the request's `x-request-id`; emails, codes and tokens are redacted. On SIGTERM (and Ctrl-C) the server stops taking requests, finishes those in flight and closes its database pool.

   ```sh
   pnpm --filter @slovo/backend dev
   curl -i http://localhost:8787/health
   ```

   The API lives under `/v1`, described once by the contract in `packages/contracts` ([ADR 0031](docs/adr/0031-the-api-only-grows-within-a-version.md)). Read it at <http://localhost:8787/docs> (the OpenAPI document is `/docs/openapi.json`) or call it with curl. The backend serves every Edition it finds in the Edition folders at start (`EDITIONS_DIR`).

   ```sh
   curl -i 'http://localhost:8787/v1/editions/uk/content/latest?packFormat=1'
   ```

   The app reaches the backend at the address in `EXPO_PUBLIC_SLOVO_API_URL`, or at `http://localhost:8787` when it is unset; the iOS Simulator reaches the Mac's localhost. Expo writes the value into the bundle, so set it when you start Metro, e.g. `EXPO_PUBLIC_SLOVO_API_URL=http://localhost:8788 SLOVO_EDITION=uk pnpm start --clear`. A release build, any EAS build profile whose name does not start with `development`, refuses to configure without an `https://` address in `EXPO_PUBLIC_SLOVO_API_URL`. `EXPO_PUBLIC_SENTRY_DSN` is the DSN of the app's project at Sentry, set in the build's environment: the app reports its crashes and unhandled errors there, with no personal data (no user, email, IP address, Account id or breadcrumbs, no tracing or session replay); left unset, it starts no Sentry and reports nothing. The repository holds no real DSN.

   To sign in by hand, ask for a Sign-in code, read it in Mailpit at <http://localhost:8025>, then send it back for a Session's token, which `/v1/account/me` takes as `Authorization: Bearer <token>`:

   ```sh
   curl -i -H 'content-type: application/json' -d '{"email":"anna@example.com","editionId":"uk"}' http://localhost:8787/v1/account/sign-in-codes
   curl -i -H 'content-type: application/json' -d '{"email":"anna@example.com","code":"123456"}' http://localhost:8787/v1/account/sessions
   ```

   With the token, a device's Sync pushes changes of its records and pulls the Account's records in the Edition after its cursor ([ADR 0041](docs/adr/0041-offline-first-sync-opaque-records-and-the-clients-change-time-wins.md)). A change time is in milliseconds since 1970, a `null` value is a tombstone, and a change replaces the record kept only when its change time is later. A key has at most 200 characters, a value at most 8 KB of JSON, an Account at most 20 000 records in an Edition (`TOO_MANY_RECORDS` past it), and a Session at most 120 Sync requests in 10 minutes:

   ```sh
   curl -i -H 'authorization: Bearer <token>' -H 'content-type: application/json' -d '{"changes":[{"key":"favorites.<entry id>","value":"2026-10-18T09:00:00.000Z","changedAt":0}]}' http://localhost:8787/v1/editions/uk/records
   curl -i -H 'authorization: Bearer <token>' 'http://localhost:8787/v1/editions/uk/records?after=0'
   ```

5. Run the backend's tests. Each run makes a database with a random name on the local Postgres, runs the migrations on it and drops it at the end, so runs in parallel worktrees never meet. The tests call the backend through the API's client built from the contract, the one the app uses, with its fetch pointed at the backend in process, so no port is opened. When Postgres is not reachable, the run stops and asks you to start Docker. `pnpm test` from the root runs them with every other package's; CI runs them in the job "Backend" on a Postgres 17 service, after running every migration on an empty database. `DATABASE_URL` names another Postgres server for the tests.

   ```sh
   pnpm --filter @slovo/backend test
   ```

6. Publish a Language Pack, so `content.latest` announces it as a Content update and `content.download` serves its file ([ADR 0032](docs/adr/0032-content-updates-ship-whole-language-packs.md)). Build the pack first; the command publishes `editions/<edition>/dist/language-pack.db` to the database `DATABASE_URL` names, with the file's SHA-256 and size. It refuses a pack whose content checksum isn't the one `content/manifest.json` records (rebuild it), a content version not higher than one already published (record the content with `pnpm build:pack uk --record` and rebuild), and a version already published, and leaves the database as it was. A published version never changes, so the backend reads its file once, keeps it in memory and answers it with its SHA-256 as the ETag and `Cache-Control: immutable`. An Edition with the `contentUpdates` Feature Switch off gets 404 from both procedures.

   ```sh
   pnpm build:pack uk
   pnpm publish:pack uk
   curl -i 'http://localhost:8787/v1/editions/uk/content/latest?packFormat=1'
   curl -o language-pack.db 'http://localhost:8787/v1/editions/uk/content/packs/<content version>'
   ```

7. Turn a feature off in an Edition remotely, in an emergency, without a build ([ADR 0040](docs/adr/0040-remote-feature-switches-only-turn-features-off.md)). The command keeps the switch in the database `DATABASE_URL` names; `edition.switches` serves the features off with an ETag, and the backend refuses a feature off remotely as 404, like one the Edition turns off. Clearing the switch gives the feature back. The app asks for the switches at launch and each time it returns to the foreground, so the feature leaves every screen without a restart, and offline it keeps the last switches it knew. A remote switch never turns on a feature the Edition turns off. The commands refuse an Edition the backend doesn't find and a feature name the Feature Switches schema doesn't know.

   ```sh
   pnpm switch:off uk game
   curl -i 'http://localhost:8787/v1/editions/uk/switches'
   pnpm switch:clear uk game
   ```

8. Run the sync flow, which shows a change from a second device reaching the app ([spec #378](https://github.com/ToxaNn1/slovo/issues/378)). `flows/sync.yaml` signs in through Mailpit, hearts an Entry, waits on the Favorites list while a script (`maestro/second-device.js`) signs in to the same Account through the API as a "second device" and hearts another Entry, sends the app to the background and back, and expects the Entry on the list without a restart. It then expects the status line under the email of the SLOVO ID screen, «Синхронізовано сьогодні о …». It needs steps 1 to 4, a Metro started against that backend (`EXPO_PUBLIC_SLOVO_API_URL`) and the app installed on a simulator. It is a subflow of `smoke.yaml`, after `flows/account.yaml`, so `pnpm test:smoke` runs it. The script reaches the backend at `API_URL` (default `http://localhost:8787`) and Mailpit at `MAILPIT_URL` (default `http://localhost:8025`); pass them like `METRO_URL`, e.g. `pnpm test:smoke -e METRO_URL=http://localhost:8174 -e API_URL=http://localhost:8794`. To run the flow alone, launch the app as `smoke.yaml` does and call `flows/sync.yaml` from a file of your own.

## Commands

All commands run from the repo root. CI runs `lint`, `typecheck`, `deps` and `test` on every pull request, and `main` takes changes only when they are green. `knip` and `pnpm audit` run once a day on `main` (`housekeeping.yml`), so a new advisory or a stale report never turns a pull request red; Knip only reports.

| Command                        | What it does                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                     | Starts the whole project for local work: Docker and the local services, `apps/backend/.env` when missing, the migrations, the Language Pack, then the backend and Metro on the first free ports, with the app pointed at that backend. `SLOVO_EDITION`, `PORT` and `SLOVO_METRO_PORT` change the defaults (`uk`, 8787, 8081).                                    |
| `pnpm lint`                    | ESLint in every package, then Prettier.                                                                                                                                                                                                                                                                                                                          |
| `pnpm typecheck`               | TypeScript in every package.                                                                                                                                                                                                                                                                                                                                     |
| `pnpm deps`                    | dependency-cruiser: the package boundaries the ADRs set, import cycles and orphan modules. Rules and their ADRs are in [`.dependency-cruiser.mjs`](.dependency-cruiser.mjs).                                                                                                                                                                                     |
| `pnpm knip`                    | Knip: unused files, exports and dependencies, and dependencies used without being listed. A daily report in CI, which does not fail anything. Deliberate exceptions, with reasons, are in [`knip.jsonc`](knip.jsonc).                                                                                                                                            |
| `pnpm test`                    | Vitest in every package, and Jest for the component tests of `packages/ui` (ADR 0029). Turborepo caches results and tracks `editions/` as an input.                                                                                                                                                                                                              |
| `pnpm verify`                  | The checks for a change before a pull request: `lint`, `typecheck` and `test` of the packages changed since `origin/main` and the packages that depend on them, then `deps` and Prettier, printing only what fails. CI still runs everything.                                                                                                                    |
| `pnpm build:pack uk`           | Validates the Edition's content, prints the content report and builds the Language Pack. Fails when the content misses a target in `editions/uk/content/targets.json`.                                                                                                                                                                                           |
| `pnpm publish:pack uk`         | Publishes the Edition's built Language Pack to the backend's database as a Content update. Refuses a pack the manifest doesn't record, a content version that doesn't grow and one already published.                                                                                                                                                            |
| `pnpm switch:off`              | `pnpm switch:off uk game` turns a feature off in an Edition remotely (ADR 0040). Refuses an Edition the backend doesn't find and an unknown feature.                                                                                                                                                                                                             |
| `pnpm switch:clear`            | `pnpm switch:clear uk game` clears the remote switch of a feature, so its config decides again.                                                                                                                                                                                                                                                                  |
| `pnpm reports list`            | Prints the Mistake Reports still to check, newest first (ADR 0056). `--edition uk` keeps one Edition's, `--since 2026-10-27` those received from that day on (UTC).                                                                                                                                                                                              |
| `pnpm reports resolve`         | `pnpm reports resolve <id>` deletes a Mistake Report once checked, so the list no longer prints it; an id it doesn't keep exits non-zero and says so.                                                                                                                                                                                                            |
| `pnpm collection-links delete` | `pnpm collection-links delete <id>` deletes a Collection Link, so the owner can take down an abusive name (ADR 0058); an id it doesn't keep exits non-zero and says so.                                                                                                                                                                                          |
| `pnpm smoke:halves`            | The full Maestro smoke as two halves at once on two simulators, with a pass/fail list per half; see [Run the Ukrainian Edition on the simulator](#run-the-ukrainian-edition-on-the-simulator).                                                                                                                                                                   |
| `pnpm source:words`            | Drafts Words for review; see [`tools/sourcing/README.md`](tools/sourcing/README.md).                                                                                                                                                                                                                                                                             |
| `pnpm content`                 | `pnpm content new word --edition uk` drafts an Entry with a fresh id in `$EDITOR` and records it once it passes; `pnpm content edit <id or text> --edition uk` opens an existing one; `pnpm content retire <id> --edition uk` retires one; `pnpm content check --edition uk` checks the whole Edition. See [`tools/content/README.md`](tools/content/README.md). |
| `pnpm format`                  | Rewrites files with Prettier.                                                                                                                                                                                                                                                                                                                                    |

Dependency advisories that have no fix yet are ignored in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) with a review date. Look at that list when you touch dependencies, and drop an entry as soon as a patched release exists.

## Working in this repo

- Work comes from GitHub issues written as STAR tickets (Situation / Task / Action / Result / Blocked by). The **Result** checklist is the definition of done.
- Issues carry one type label (`feature`, `bug`, `chore`, `docs`), `area:*` labels and a version milestone (`0.1` to `1.0`). `ready-for-agent` marks a ticket that is fully specified, and `spec` marks a spec.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/); CI checks the PR title and every commit of a PR with commitlint ([`commitlint.config.js`](commitlint.config.js)). To check locally, put `pnpm commitlint --edit "$1"` in your own `.git/hooks/commit-msg`. Everything in the repo is written in English.

### `main` is protected by convention

Branch protection on private repositories needs a paid GitHub plan, so `main` is protected by convention instead: every change goes through a pull request, and CI must be green before merging. Nobody pushes to `main` directly.
