# Remote Feature Switches only turn features off

A Feature Switch lives in an Edition's `edition.json` (ADR 0030), so turning a broken feature off once took a new build and an App Store review. For that emergency the backend keeps remote switches (spec #378): the owner turns a feature off in one Edition with one local command, and the apps and the backend stop offering it without a build.

**A remote switch only turns a feature off.** The effective value of a Feature Switch is the Edition's value and not off remotely, so the backend can never switch on what an Edition hasn't shipped. Every reader of a Feature Switch, in the app and on the backend, reads the effective value.

## The backend

- **Storage.** The `remote_switches` table holds one row per Edition and feature: `edition_id`, the Feature Switch's name, `off`, and `set_at`. Clearing keeps the row with `off` false. The server Core reaches it through a `RemoteSwitchStore` port.
- **Setting them.** `pnpm switch:off <edition-id> <feature>` and `pnpm switch:clear <edition-id> <feature>` act on the database `DATABASE_URL` names, through the Edition registry (`switchOff`, `clearSwitch`), which refuses an Edition not in `EDITIONS_DIR` and a feature the contracts' Feature Switches schema doesn't know. Setting a switch to the value it has changes nothing. An admin panel waits for 2.x.
- **Serving them.** `edition.switches`, `GET /v1/editions/{editionId}/switches`, needs no Session and answers `{ off: [...] }` in name order, with the SHA-256 of the answer as its ETag (304 on a matching `If-None-Match`); an unknown Edition is `NOT_FOUND`. A feature is a plain string, not an enum, since an output enum may only narrow within `/v1` (ADR 0031). A row whose name the schema no longer knows is served as nothing, and the app skips a name it doesn't know.
- **The backend obeys them.** `EditionRegistry.serving(editionId, feature)` (asynchronous) reads the remote switches after the Edition's own, so a feature off remotely answers `switched-off` and its procedures `NOT_FOUND`. It reads them at every request, one primary-key query, so a switch set from another process holds from the next request with no restart.
- **Names.** `sync` is a Feature Switch apart from `account`, so sync can be turned off while signing in and deleting keep working. The Mix's Rarity Floor switch is `rarityFloor` (owner decision 21.10); an old `rarityFilter` row is a name the schema doesn't know.

## The app

- **`openRemoteSwitches`** (`packages/core/src/edition/remote-switches.ts`) owns the app side, behind a `SwitchesApi` port the shell implements on the contract's client (`apps/mobile/src/edition/switches-api.ts`, tested against `serveApi`, ADR 0064). The shell opens it once per app run over the user state, before the Language Pack and the composition, from the last answer kept in the `device-only` record `edition.switches` (the names off and their ETag). Without the record, or when it can't be read, the Edition's values hold.
- **One Edition in effect.** It gives the Edition's object with `isFeatureEnabled` at the effective value, read from the last answer each time it is called, so modules that keep the Edition, such as Sync and the Account, act on the current value. Everything that read the Edition's switches reads this one.
- **When it asks.** The lifecycle asks at launch and on each return to the foreground, naming the kept ETag. A request tries again by ADR 0037's rule; a failure keeps the answer the app has. A new answer is kept for the next launch.
- **A changed effective value reopens.** The module makes a new Edition object and tells its subscribers; the lifecycle reopens the composition (ADR 0036), which plans the notifications as it opens, and writes the Widget Snapshot again. The Game tab goes and comes back while the app runs, and a reader on the Game screen when it goes is taken Home. An answer that changes no effective value reopens nothing; the settings are never reopened for a switch.
- **What the reader is shown.** `shownOf` (`apps/mobile/src/shown.ts`) answers, from the Edition in effect, the settings and the Mix, what is shown: the tabs, the Game Review, the switchable buttons of an Entry card, Self-check and its setting, «Вчу», the statistics with their Streak and knowledge rows, and the Sync status line. Screens read it through `useShown`; UI components get the shape they draw, not a switch. Modules that act rather than draw keep reading the Edition in effect. With Corrections off, or a Mix without them, the Known Entries row counts Known Words alone, «Знаю 12 слів» (owner decision 19.10, #478).
- **With `account` off** the SLOVO ID row, its screen and the onboarding's step are absent, and the Session stays in the Keychain unrefreshed until the switch is cleared. **With `contentUpdates` off** no update is checked for and the next launch opens the bundled pack; checks come back at the launch after the switch is cleared.

## Considered Options

- **Switches in the Edition config only**: rejected. An emergency would still take a build and a review.
- **Remote switches that turn features on too**: rejected. The backend could switch on what an Edition hasn't shipped.
- **`edition.switches` answering every effective value**: rejected. Its shape would change with every new Feature Switch.
- **The backend keeping the switches in memory**: rejected. A running server would need a restart to obey a switch set from another process.
- **Deleting the row on clear**: rejected. The row tells when the switch was last cleared.
- **The app asks only at launch**: rejected. iOS may keep the app running for days.
- **Reopen at every answer**: rejected. Every return would rebuild the composition for nothing.
- **An immutable Edition per answer, read once by each module**: rejected. The Account and Sync are not reopened and would act on launch values.
- **The shell's `edition` itself follows the switches**: rejected. It is read at module load, before the user state opens, and a hidden mutable value makes every reader order-dependent.
