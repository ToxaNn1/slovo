# SLOVO

SLOVO helps people discover, learn and share rare words of a single language. The first app is the **Ukrainian Edition**: a vertical Feed of Rare Words with stress marks and definitions, Corrections of common non-standard phrases, a Game, a home-screen widget and optional sync across devices.

> Status: version 0.2 (Feed) is built; 0.3 (My words) is next. What exists today:
>
> - the monorepo with the Core, the shared contracts, the Language Pack build and a UI package;
> - the mobile shell: one Expo app that builds the Ukrainian Edition, with the final four tabs;
> - Home is the Feed: the Word of the Day, Word cards with Pronunciation, Corrections mixed in, Seen and Cycles kept on the device, in the Ukrainian Decor;
> - Settings with the Theme and the font size;
> - the Ukrainian Edition's content (Words and Corrections) and a content quality gate that CI runs on every change;
> - CI with lint, typecheck, tests, a dependency audit and secret scanning.
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

| Path                     | Role                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `apps/mobile`            | One Expo app that builds whichever Edition the environment variable selects.            |
| `apps/widget`            | The native SwiftUI home-screen widget (placeholder until 0.6).                          |
| `apps/backend`           | The API (placeholder until 0.7).                                                        |
| `packages/core`          | Pure TypeScript domain logic (no React, no React Native).                               |
| `packages/ui`            | Screens, components, design tokens and Decor slots.                                     |
| `packages/contracts`     | Zod schemas for Entries, the Edition config and the Language Pack.                      |
| `packages/language-pack` | Builds an Edition's content into a read-only SQLite Language Pack and reads packs back. |
| `packages/config`        | Shared TypeScript, ESLint and Prettier configuration.                                   |
| `editions/<edition>`     | One folder per Edition: configuration, strings, design tokens, Decor, content, assets.  |
| `tools/sourcing`         | Dev-only tool that drafts Words from goroh.pp.ua and СУМ-11 for human review.           |
| `docs/`                  | Architecture decision records in `docs/adr/` and the design brief in `docs/design/`.    |

## Documents

- [`CONTEXT.md`](CONTEXT.md): the domain glossary.
- [`docs/adr/`](docs/adr/): architecture decision records.
- [Master spec, issue #1](https://github.com/ToxaNn1/slovo/issues/1): product vision, every decision so far and the roadmap from 0.1 to 1.0.
- [0.1 Foundation spec, issue #2](https://github.com/ToxaNn1/slovo/issues/2) and [0.2 Feed spec, issue #51](https://github.com/ToxaNn1/slovo/issues/51): the versions built so far and their tickets.
- [`CLAUDE.md`](CLAUDE.md): the guide for coding agents (`AGENTS.md` points to it).

## Run the Ukrainian Edition on the simulator

The native app is a development build made in EAS cloud ([ADR 0004](docs/adr/0004-native-builds-in-eas-cloud.md)). The JavaScript runs locally against it, served by Metro with fast refresh, so day-to-day work never waits for a cloud build.

The `SLOVO_EDITION` environment variable selects the Edition. Every Expo and EAS command fails with a clear message when it is missing or names an unknown Edition. The app name, bundle id, icon, locale, fonts and splash come from `editions/<edition>/`: the fonts are every file in `assets/fonts/`, and the splash is Decor slot 7, described by `decor/splash.json`. An Edition without a splash gets the Core's plain one. Once the JavaScript runs, the app draws the rest of slot 7 over the native splash (the background, the wordmark, the tagline and the band from `decor/decor.json`) and fades it out.

You need the Node version in [`.nvmrc`](.nvmrc), pnpm, Xcode with an iOS Simulator (iOS 17 or later) and access to the Expo account `anton_de`. The commands below run the Expo CLI and `eas-cli` through `npx`, so neither needs a global install.

1. Install the dependencies and build the Language Pack. Rebuild the pack whenever the content changes; Metro picks up the new file. The build prints the content report and fails when the content misses a target in `editions/<edition>/content/targets.json` (ADR 0009).

   ```sh
   pnpm install
   pnpm build:pack uk
   ```

2. Get the development build. It is needed once, and again only after a native change: a new native module, an Expo SDK upgrade, or a new name, bundle id, icon, font or splash. Each build counts against the free tier of 15 iOS builds a month.

   Version 0.2 needs a build made from 0.2 code (ticket #52) or later. It adds every native module 0.2 uses (`expo-speech` for Pronunciation, `react-native-svg` for Decor, `expo-haptics`, `expo-localization`, `expo-system-ui`), the Literata and Manrope fonts and the Edition's splash. A 0.1 build lacks them, and the 0.2 JavaScript needs them. The rest of 0.2 changes JavaScript only, so this one build serves the whole version.

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
   - About every fifth card is a Correction («Так часто кажуть → Українською краще»).
   - A card that stays on screen for 1.5 s is Seen and doesn't come back in the same Cycle. Once everything is Seen, the end-of-Cycle card says so, and the next swipe starts a new Cycle. The Feed reopens on the last card the same day.
   - While the Language Pack opens, the Feed shows a skeleton card with the divider being stitched; if the pack can't be opened, a local error state («Нитка урвалася») offers to try again.

   Settings offers the Theme (System, Light or Dark) and the font size (S, M, L, XL) with a live preview. The choices are kept on the device in a user-state database apart from the Language Pack, and System follows the iOS appearance. Game and Saved are placeholders.

   With Reduce Motion on (Settings › Accessibility › Motion), the cards cross-fade in 200 ms instead of sliding, and the loading skeleton holds still. With VoiceOver, every card element, chip and button has a label, the Lemma's Stress is spoken («наголос на а»), and the actions «Наступний запис» and «Попередній запис» on the Lemma and the Definition stand in for the swipes. The app needs no network: the Language Pack ships inside the app and is opened read-only. At launch the app checks that the native app, the JavaScript bundle and the Language Pack are of the same Edition, and shows its load-failed screen when they are not. [Verify the app with networking off](#verify-the-app-with-networking-off) by hand once per release candidate.

5. Run the smoke flow with [Maestro](https://maestro.mobile.dev) from `apps/mobile` while Metro is running. It is a local check and does not run in CI. It walks the 0.2 flow: launch, the Word of the Day badge, a swipe to the next card and back, the Pronunciation button, Settings with the Dark Theme and font size L, the Feed again, and a relaunch that keeps all of it and the day's Word. On a new simulator it also closes the development client's menu when it opens over the app. `apps/mobile/maestro/smoke.yaml` only launches the app and calls one subflow per feature from `apps/mobile/maestro/flows/`, so a feature edits its own file.

   ```sh
   pnpm test:smoke
   ```

   Every setting of the flow has a default that `-e` overrides: `METRO_URL` (default `http://localhost:8081`, given as a plain URL), `APP_ID` (default `app.slovo.uk`) and `SCHEME` (default `slovo-uk`). For Metro on another port:

   ```sh
   pnpm test:smoke -e METRO_URL=http://localhost:8162
   ```

   The defaults live in JavaScript in the flow rather than in its `env:` block, because Maestro lets a flow's `env:` win over `-e`.

## Verify the app with networking off

The Ukrainian Edition must work offline (ticket #6). No automated check covers this yet, so run it by hand on the simulator. The iOS Simulator shares the Mac's network, and Metro on `localhost` keeps working without it.

1. Do steps 1 to 3 above, so that the development build is installed and Metro is running.
2. Turn off Wi-Fi and unplug Ethernet on the Mac. Check that the network is down, e.g. `ping -c 1 1.1.1.1` fails.
3. Force-quit SLOVO in the simulator, then open it again and connect to Metro on `localhost:8081`.
4. Run `pnpm test:smoke` from `apps/mobile`, or check by hand that the four tabs show and the Feed shows a Word with its Stress mark and Definition and swipes to the next one.
5. Look for network errors in the Metro log. There must be none.

A development build still needs Metro, so this does not prove that a release build starts with no connection. Repeat the check on a preview or release build once such a build exists.

## Commands

All commands run from the repo root. CI runs the first four on every pull request, and `main` takes changes only when they are green.

| Command              | What it does                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`          | ESLint in every package, then Prettier.                                                                                                                                |
| `pnpm typecheck`     | TypeScript in every package.                                                                                                                                           |
| `pnpm test`          | Vitest in every package. Turborepo caches results and tracks `editions/` as an input.                                                                                  |
| `pnpm build:pack uk` | Validates the Edition's content, prints the content report and builds the Language Pack. Fails when the content misses a target in `editions/uk/content/targets.json`. |
| `pnpm source:words`  | Drafts Words for review; see [`tools/sourcing/README.md`](tools/sourcing/README.md).                                                                                   |
| `pnpm format`        | Rewrites files with Prettier.                                                                                                                                          |

Dependency advisories that have no fix yet are ignored in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) with a review date. Look at that list when you touch dependencies, and drop an entry as soon as a patched release exists.

## Working in this repo

- Work comes from GitHub issues written as STAR tickets (Situation / Task / Action / Result / Blocked by). The **Result** checklist is the definition of done.
- Issues carry one type label (`feature`, `bug`, `chore`, `docs`), `area:*` labels and a version milestone (`0.1` to `1.0`). `ready-for-agent` marks a ticket that is fully specified, and `spec` marks a spec.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Everything in the repo is written in English.

### `main` is protected by convention

Branch protection on private repositories needs a paid GitHub plan, so `main` is protected by convention instead: every change goes through a pull request, and CI must be green before merging. Nobody pushes to `main` directly.
