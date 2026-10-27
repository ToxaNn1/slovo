# Every domain has one folder name in every package

This finishes ADR 0027. A domain that has a folder in one of `packages/core/src`, `packages/ui/src` and `apps/mobile/src` has a folder of the same name in every one of them where it appears, even with a single module. A loose file at the root of `src/` is either the top or the shared base, and the root names each one; the rest of a package lives in its domain folders and in the package's own layers.

The rules, in place of ADR 0027's "a folder appears when a domain has at least two modules":

- **One folder per domain, the same name everywhere.** Each package's domain folders are named after `CONTEXT.md`, and a module of a domain goes into that domain's folder, even when it is the only one. Everything about the Mix is in `mix/` in the Core, the UI and the app; everything about the Game, the Daily Crossword included, is in `game/`.
- **The Mix and Hidden Entries share `mix/`.** The Core's `hidden/` becomes `mix/`, the name the UI and the app already use. Hiding a Category and taking it out of the Mix are one and the same (`CONTEXT.md`, Hidden Category), and the folder also holds the Mix's chips and its Rarity Floor, which no Hidden Entry explains, while a Hidden Entry is one of the things the Mix leaves out. The Core's `entries/mix.ts` stays in `entries/` (ADR 0027): the Entries module decides which Entries are Eligible and imports it, so in `mix/` it would make `entries/` and `mix/` import each other.
- **A crossword is a Game Mode.** The Core's `crossword/` merges into `game/`, beside the app's `game/daily-crossword.ts` and the UI's `game/CrosswordGrid.tsx`.
- **What stays at the root.** In the Core: `composition.ts` (the top, ADR 0018) with its tests `composition.test.ts`, `opened-from-notification.test.ts` and `opened-from-widget.test.ts`; `ports.ts`, `in-turn.ts`, `local-date.ts` and `retry.ts`, the shared base (`retry.ts` is the one rule by which `account/`, `sync/`, `edition/` and `content-update/` try a request again, ADR 0037); `index.ts`, `testing.ts` and `test-support.ts`. In the UI: `index.ts` and `tokens.ts`. In the app: `composition.ts`; `opening.ts` and its gate `opened.tsx` (ADR 0036), which every domain opens through and the account screen draws over; `api.ts`, the backend's address the API adapters of four domains share; `keep.ts`, which four domains wait on; `shown.ts` and `shown-in-effect.ts`, what the reader is shown of the switched-off or hidden features, read by the routes, the Entries and Sync; `test-support.ts`; and the type declarations `env.d.ts` and `slovo-edition.d.ts`.
- **The app's own folders.** Beside `device/` and `foreground/` (ADR 0027), the app has `shell/`, what the root layout sets up before and around every screen (`lifecycle`, `launch-splash`, `intl-polyfill`), which only the routes import, and `diagnostics/`, the log and the crash reports with the scrubbing of personal data they share (ADR 0048), which import no domain. `foreground/` stays its own folder below the domains: the Feed, the Game and Sync import it, so inside `shell/`, which imports Sync, it would close a cycle. For the same reason `opening.ts` and `opened.tsx` stay at the root rather than in `shell/`.
- **The routes import `src` through `@/`.** The Expo Router routes in `apps/mobile/src/app/` import the app's modules as `@/opening` or `@/entries/entry-screen`, not `../../opening`, so a route's imports don't change with its depth. `@/` maps to `apps/mobile/src/` in the app's `tsconfig.json`, which Metro reads, in Jest's `moduleNameMapper` and in dependency-cruiser's resolution. The modules inside `src` keep their relative imports.
- **Domain folders import each other in one direction.** dependency-cruiser's `domain-folders-import-one-way` (in `.dependency-cruiser.folders.mjs`, run by `pnpm deps`) rejects a cycle between two domain folders of a package. It counts the modules a package ships, not their tests: a test may set its scene up with another domain's module, as `user-state.test.ts` does with the Feed's Cycle. The rule warns until the cycles it finds today are cut: in the app `account/` ↔ `sync/` (`sync/device-sync.ts` opens through `account/device-account.ts`, and `account/account-screen.tsx` draws `sync/sync-status-line.tsx`), `content-update/` ↔ `edition/` (`edition/language-pack.tsx` opens the downloaded pack, and `content-update/device-content-updates.ts` reads `edition/edition.ts`) and `entries/` ↔ `notifications/` (`entries/entry-link.ts` and `notifications/notification-taps.tsx` read each other). Once they are cut it becomes an error.

Files move with `git mv` and keep their names, and a test moves with its module (ADR 0027). Three tickets follow the table below, one per package, and only move files and fix their import paths and the config that names a path: the ESLint override for `src/log.ts` and Metro's comment on `src/intl-polyfill.ts`.

## The moves

### Core (`packages/core/src/`)

| Old path                            | New path                                |
| ----------------------------------- | --------------------------------------- |
| `progress.ts`                       | `progress/progress.ts`                  |
| `progress.test.ts`                  | `progress/progress.test.ts`             |
| `settings.ts`                       | `settings/settings.ts`                  |
| `settings.test.ts`                  | `settings/settings.test.ts`             |
| `onboarding.ts`                     | `onboarding/onboarding.ts`              |
| `onboarding.test.ts`                | `onboarding/onboarding.test.ts`         |
| `widget.ts`                         | `widget/widget.ts`                      |
| `widget.test.ts`                    | `widget/widget.test.ts`                 |
| `content-update.ts`                 | `content-update/content-update.ts`      |
| `content-update.test.ts`            | `content-update/content-update.test.ts` |
| `crossword/daily-crossword.ts`      | `game/daily-crossword.ts`               |
| `crossword/daily-crossword.test.ts` | `game/daily-crossword.test.ts`          |
| `hidden/hidden-entries.ts`          | `mix/hidden-entries.ts`                 |
| `hidden/hidden-entries.test.ts`     | `mix/hidden-entries.test.ts`            |
| `hidden/hiding.ts`                  | `mix/hiding.ts`                         |
| `hidden/hiding.test.ts`             | `mix/hiding.test.ts`                    |
| `entries/share-card.ts`             | `share/share-card.ts`                   |
| `entries/share-card.test.ts`        | `share/share-card.test.ts`              |

The Share card moves too: the UI and the app keep sharing in `share/`, so the Core does.

### UI (`packages/ui/src/`)

| Old path                       | New path                               |
| ------------------------------ | -------------------------------------- |
| `DeleteAccountButton.tsx`      | `account/DeleteAccountButton.tsx`      |
| `DeleteAccountButton.test.tsx` | `account/DeleteAccountButton.test.tsx` |
| `ResendButton.tsx`             | `account/ResendButton.tsx`             |
| `ResendButton.test.tsx`        | `account/ResendButton.test.tsx`        |

### App (`apps/mobile/src/`)

| Old path                | New path                            |
| ----------------------- | ----------------------------------- |
| `lifecycle.tsx`         | `shell/lifecycle.tsx`               |
| `launch-splash.tsx`     | `shell/launch-splash.tsx`           |
| `intl-polyfill.ts`      | `shell/intl-polyfill.ts`            |
| `log.ts`                | `diagnostics/log.ts`                |
| `log.test.ts`           | `diagnostics/log.test.ts`           |
| `crash-reports.ts`      | `diagnostics/crash-reports.ts`      |
| `crash-reports.test.ts` | `diagnostics/crash-reports.test.ts` |
| `personal-data.ts`      | `diagnostics/personal-data.ts`      |
| `onboarding.tsx`        | `onboarding/onboarding.tsx`         |
| `progress.tsx`          | `progress/progress.tsx`             |
| `known-line.test.ts`    | `progress/known-line.test.ts`       |
| `haptics.ts`            | `game/haptics.ts`                   |

`haptics.ts` is the device's haptic motor, which only the Game's haptic sequence plays (ADR 0025), so it sits in `game/` as the Core's `haptics` does. The app ticket also adds the `@/` alias and rewrites every `../` import of `src/app/` to it.

## Considered Options

- **Vertical packages** (a package per domain, such as `@slovo/game`): the owner chose folders on 2026-10-27. The Core's domains share its ports, composition and user state, which a package per domain would have to split or export.
- **`hidden/` for the Mix and Hidden Entries**: rejected. The UI's and the app's folders hold the Mix's chips, its Rarity Floor and the Mix screen, which are not about Hidden Entries, and `mix/` needs fewer moves.
- **`opening`, `opened` and `foreground` in `shell/`**: rejected. Most domains import them and `shell/lifecycle.tsx` imports most domains, so `shell/` would sit in one cycle with thirteen of the app's folders.
- **Counting tests in the folder rule**: rejected. Tests set their scene up across domains (`user-state.test.ts` with the Feed's Cycle), which tangles the Core's folders into one cycle that says nothing about where a module belongs.
