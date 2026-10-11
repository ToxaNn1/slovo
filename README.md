# SLOVO

SLOVO helps people discover, learn and share rare words of a single language. The first app is the **Ukrainian Edition**: a vertical Feed of Rare Words with stress marks and definitions, Corrections of common non-standard phrases, a Game, a home-screen widget and optional sync across devices.

> Status: version 0.1 (Foundation). The repo is being set up; most of what is described below does not exist yet.

## The factory idea

SLOVO is built as a factory, not as one app.

- The **Core** holds all language-agnostic behaviour and screens. It knows nothing about Ukrainian.
- An **Edition** is a standalone app for exactly one language. It is the Core plus a **Language Pack** (words, categories, UI strings, language traits), Feature Switches, design tokens and Decor.
- A new language means a new Edition folder. The Core does not change. Editions extend the Core only through Feature Switches, Extension Points and Decor ([ADR 0006](docs/adr/0006-editions-extend-core-only-through-extension-points.md)).

The vocabulary used here and in the code is defined in [`CONTEXT.md`](CONTEXT.md).

## Repo map

Planned layout from the [0.1 spec](https://github.com/ToxaNn1/slovo/issues/2). Empty parts are reserved and filled by later versions.

| Path                 | Role                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| `apps/mobile`        | One Expo app that builds whichever Edition the environment variable selects.         |
| `apps/widget`        | The native SwiftUI home-screen widget (placeholder until 0.6).                       |
| `apps/backend`       | The API (placeholder until 0.7).                                                     |
| `packages/core`      | Pure TypeScript domain logic (no React, no React Native).                            |
| `packages/ui`        | Screens, components, design tokens and Decor slots.                                  |
| `packages/contracts` | Zod schemas for Entries, the Language Pack and the API.                              |
| `packages/config`    | Shared TypeScript, ESLint and Prettier configuration.                                |
| `editions/<edition>` | One folder per Edition: configuration, content, design tokens, Decor and assets.     |
| `tools/sourcing`     | Dev-only tool that drafts Words from СУМ-11 and goroh.pp.ua for review.              |
| `docs/`              | Architecture decision records in `docs/adr/` and the design brief in `docs/design/`. |

## Documents

- [`CONTEXT.md`](CONTEXT.md): the domain glossary.
- [`docs/adr/`](docs/adr/): architecture decision records, ADR 0001 to 0008.
- [Master spec, issue #1](https://github.com/ToxaNn1/slovo/issues/1): product vision, every decision so far and the roadmap from 0.1 to 1.0.
- [0.1 Foundation spec, issue #2](https://github.com/ToxaNn1/slovo/issues/2): the current version and its tickets.
- [`CLAUDE.md`](CLAUDE.md): the guide for coding agents (`AGENTS.md` points to it).

## Run the Ukrainian Edition on the simulator

The native app is a development build made in EAS cloud ([ADR 0004](docs/adr/0004-native-builds-in-eas-cloud.md)). The JavaScript runs locally against it, served by Metro with fast refresh, so day-to-day work never waits for a cloud build.

The `SLOVO_EDITION` environment variable selects the Edition. Every Expo and EAS command fails with a clear message when it is missing or names an unknown Edition. The app name, bundle id, icon and locale come from `editions/<edition>/`.

You need Node 22, pnpm, Xcode with an iOS Simulator (iOS 17 or later) and access to the Expo account `anton_de`. The commands below run the Expo CLI and `eas-cli` through `npx`, so neither needs a global install.

1. Install the dependencies and build the Language Pack. Rebuild the pack whenever the content changes; Metro picks up the new file.

   ```sh
   pnpm install
   pnpm build:pack uk
   ```

2. Get the development build. It is needed once, and again only after a native change: a new native module, an Expo SDK upgrade, or a new name, bundle id or icon. Each build counts against the free tier of 15 iOS builds a month.

   ```sh
   cd apps/mobile
   SLOVO_EDITION=uk npx eas-cli build -p ios --profile development-simulator-uk
   ```

   When the build is done, install the latest one on the booted simulator:

   ```sh
   SLOVO_EDITION=uk npx eas-cli build:run -p ios --latest --profile development-simulator-uk
   ```

   To install a build by hand instead, download its `.tar.gz` from the EAS dashboard, unpack it and run `xcrun simctl install booted SLOVO.app`.

3. Start Metro from `apps/mobile`, then open SLOVO on the simulator. The development client connects to the server on `localhost:8081`; pressing `i` in the Metro terminal opens the app for you.

   ```sh
   SLOVO_EDITION=uk pnpm start
   ```

4. Check the result. The tabs read Головна, Налаштування, Гра, Збережене (Home, Settings, Game, Saved). Home shows one Word from the bundled Language Pack: its Lemma with the Stress mark, its part of speech and its primary Definition. The other tabs are placeholders. The app needs no network: the Language Pack ships inside the app and is opened read-only.

5. Run the smoke flow with [Maestro](https://maestro.mobile.dev) while Metro is running. It is a local check and does not run in CI.

   ```sh
   pnpm test:smoke
   ```

## Working in this repo

- Work comes from GitHub issues written as STAR tickets (Situation / Task / Action / Result / Blocked by). The **Result** checklist is the definition of done.
- Issues carry one type label (`feature`, `bug`, `chore`, `docs`), `area:*` labels and a version milestone (`0.1` to `1.0`). `ready-for-agent` marks a ticket that is fully specified, and `spec` marks a spec.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Everything in the repo is written in English.

### `main` is protected by convention

Branch protection on private repositories needs a paid GitHub plan, so `main` is protected by convention instead: every change goes through a pull request, and CI must be green before merging. Nobody pushes to `main` directly.
