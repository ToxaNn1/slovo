# The shell opens each resource once through one module and draws every screen over it open

Until 0.7 the shell had four ways to open something once per app run and retry or fall back: the Language Pack in React state keyed by an attempt count around expo-sqlite's provider, with its reader kept apart in a map by database, the user state and the settings each as a promise kept in a module variable with its own in-memory fallback, and the composition (ADR 0018) as a store per database with listeners and a retry. The settings' fallback opened a second in-memory user state, apart from the one the composition fell back to. A screen read a Core module through a hook that returned a stand-in value until the composition was open, so each route asked the composition again to tell loading from empty, drew the error state with its retry itself (twelve times), and every hook that changes something guarded each call against a module not open yet. The Account of 0.7 opens apart from the composition (#337), and that hook could not read it.

The shell now has one opening module, `apps/mobile/src/opening.ts`:

- **`openOnce(open, { onError, fallback })`** opens a resource on its first read and shares it for the app run. It is loading, then ready with the value, or failed with a retry that opens it again for every screen. A failure is reported; with a fallback, the opening is ready with the fallback instead, and since ready never changes, the fallback is used once. `opened()` gives the value once it is ready, so one opening can wait for another. The Language Pack, the user state, the settings and the composition all open through it, and the user state keeps the only in-memory fallback: the settings fall back to the Edition's defaults over that same user state.
- **`useSubscribed(source, snapshot)`** binds a screen to any source with `subscribe` and a snapshot: a module of the composition, a module that opens apart from it such as the Account, or an opening. The snapshot must stay one value until the source changes, as every Core module's does (ADR 0016). Its plain part, `bind`, gives `useSyncExternalStore` one `subscribe` per source, so a screen that binds again on each render never subscribes again; the Vitest tests drive `openOnce` and `bind`, the module's two seams without React.
- **`Opened`**, the gate in `apps/mobile/src/opened.tsx`, draws the Feed's loading state while its opening opens, the error state with its retry when it fails, and its children once open. The root layout puts the composition's gate inside the Language Pack's, around the tabs, the onboarding and the lifecycle adapter, so every screen draws over an open composition. `useComposition()` gives it without `undefined`, and a hook reads a module with `useSubscribed(useComposition().favorites, ({ list }) => list)`.

The settings still open before the Language Pack and apart from the composition (ADR 0016, 0018): their provider draws nothing until they are open, because the gate's screens need the Theme.

What the reader sees stays the same, with two differences in states the launch splash mostly covers. While the composition opens, the Feed's loading screen fills the screen without the tab bar, as while the Language Pack opens. When the composition fails, its error state with the retry fills the screen without the tab bar, so Settings can't be reached until a retry succeeds; it was the same error state inside each tab before. A failure there means the app can't show any Entry, so a screen of its own is the honest state.

The Language Pack is copied into place and opened with expo-sqlite's `importDatabaseFromAssetAsync` and `openDatabaseAsync`, the two calls its provider made, so the opening module can hold it. Its opening is ready with the reader `openPack` gives, which the composition and the Decor showcase read; a refusal fails the opening, and the pack is closed, so a retry copies it again.

## Considered Options

- **A gate in every route**: rejected. Each route would still name its opening and its error state, and the onboarding and the lifecycle adapter would need gates of their own. It would keep the tab bar during a composition failure, a state that only a broken build reaches.
- **Keep the stand-in value until open, and type the hook for any source**: rejected. It fits the Account, but every route still tells loading from empty and every change still guards against a module not open.
- **Keep expo-sqlite's provider for the Language Pack**: rejected. Its opening lives in React state, so the composition could not wait for the pack outside React, and a retry needs a remount by key.

## Amendment: the Language Pack's opening chooses the pack and carries the Content update module (0.7, #347)

The Language Pack's opening is now ready with the reader of the pack the app run opened, the bundled one or a newer one a Content update kept, and with the Content update module when content updates are on. The composition and the Decor showcase read its reader, and the lifecycle adapter asks its module to check. A kept pack that fails to open is forgotten and the bundled one opens; only a failure of the bundled pack fails the opening. ADR 0032's amendment records how the pack is chosen.

## Amendment: the SLOVO ID screen draws under the Account's own gate (0.7, #346)

The Account opens apart from the Language Pack and the composition (ADR 0037), and the app must never wait for it: it is optional, and everything else works without it. So its gate is not in the root layout. The SLOVO ID screen's route puts its content under `Opened` with the Account's opening, the one route that names an opening, and everything under it reads the open Account with `useOpened`. The «SLOVO ID» row of Settings needs no gate: it reads the opening and the Account's state with `useSubscribed` and shows no value until the Account is open. An Edition without the Account has neither the row nor the screen; its route leads back to Settings.

### Considered Options

- **The Account's gate in the root layout, around the tabs**: rejected. A slow or failed Keychain read would hold up the Feed for an Account the reader may never use.
- **Show the row only once the Account is open**: rejected. A failed opening would hide the row, and with it the retry the gate's error state offers.

## Amendment: one foreground report tells every listener, each over its own opening (architecture review 2)

Until now four things followed the app's moments in three ways. The composition heard each return to the foreground and each next local day through `reportForeground`, the one with tests. The lifecycle adapter checked for a Content update at its mount and on each return through its own subscription, and wrote the Widget Snapshot at its mount and on each move to the background straight from `AppState`. `AccountLifecycle`, a pass-through outside the gates, refreshed the Account whenever `useInForeground` turned true. The lifecycle adapter sat under the composition's gate, so the Content update check waited for a composition it doesn't need.

Now `reportForeground` (`apps/mobile/src/foreground/foreground-reports.ts`) is the one report of the app's moments: `launch`, `return`, `new-day` and `background`. A listener names its opening and hears each moment with what the opening opened: `launch` once it is open, after any retries, and every moment after, never one before. Each listener picks the moments it acts on in the lifecycle adapter: the composition `return` and `new-day`, the Widget Snapshot's write `launch` and `background`, the Content update check and the Account's refresh `launch` and `return`. The Core keeps its limits: one Content update check a day, one Session check an hour. The lifecycle adapter draws outside the gates, beside where `AccountLifecycle` was, which is gone, so no listener waits for another's opening. The Feed still reads whether the app is in the foreground through `useInForeground`, a state rather than a moment. The «SLOVO ID» row of Settings still asks the Account to refresh each time Settings opens, as #333 asks.

### Considered Options

- **Every listener acts on every moment**: rejected. The composition just turned to the day as it opened, and a `resume` at launch would plan the notifications and the Game again; a write of the Widget Snapshot on every return writes what the last background already wrote.
- **Queue the moments of an opening still opening and tell them once open**: rejected. The launch already covers them: the composition opens on today, and the first Content update check and Session check are due at launch anyway.
- **Report the background as any move out of the foreground**: rejected. The control centre or the app switcher would write the Widget Snapshot each time it is pulled down, with nothing changed.
