# Global review of SLOVO main (bf792f89): apps/mobile

Read-only review of the Expo app. Skipped: everything spec #1586 plans (Entry card actions once, the Mix in effect in the Core, the keep/undo idiom, the device openings, the Entry route factory and Saved list header, the Game Round split, routes reading the composition). Three sweeps: screens and hook modules, the shell (openings, lifecycle, landing, progress), tests and dead code. Full entries follow the summary; each has file:line, what is wrong, a failure scenario, a fix and a confidence level.

## Counts

| Severity | Count |
| --- | --- |
| High | 1 |
| Medium | 7 |
| Low | 12 |

## Ranked index

1. HIGH — the Dashboard re-opens the Feed on every focus while a Word-of-the-Day landing stays pending (dashboard/dashboard.ts:48, feed/feed.ts:123). Confirmed by code, not reproduced.
2. MEDIUM — double tap on «Додати» creates two copies of a Curated Collection; `isAdded` is checked before the `await` (packages/core/src/dashboard/curated-collections.ts:197). Core fix.
3. MEDIUM — the Collection Link screen is blank while loading and stays blank on failure; loading and failed collapse to `undefined` (saved/collection-link.ts:17, app/c/[linkId].tsx).
4. MEDIUM — board screens (Collection, Category, Curated Collection, Correction Type) have no empty and no failure state.
5. MEDIUM — History day headings «Сьогодні»/«Учора» go stale after midnight (saved/history.ts:37-61).
6. MEDIUM — `useEntries()` is dead code (content-update/language-pack.tsx:99).
7. MEDIUM — «fresh» test state test asserts `toBeDefined()` only (user-state/test-states.test.ts:103).
8. MEDIUM — undo-after-reopen tests pass if the hide was lost in the reopen (mix/hiding-undo.test.ts:74, :85).
9. LOW — six `void` promises without a handler (overlaps #1586's keep idiom for Core changes; the reads do not).
10. LOW — Correction Type and Curated Collection re-reads can resolve out of order.
11. LOW — Search keeps the previous results when a search fails.
12. LOW — the «new Level / new Badge» rule lives in `MascotCelebrations`, not in the Core.
13. LOW — the Weekly Recap read is keyed on `LocalDate` object identity.
14. LOW — loading looks like real data on the Correction Type and Curated Collection heroes.
15. LOW — `StatsPillAndSheet`: Mood days read without a failure path, Progress subscribed twice (progress/progress.tsx:17-33).
16. LOW — the remote-switch reopen chain in lifecycle.tsx:66-77 has no `.catch`.
17. LOW — five `it.skip` tests waiting for DESIGN-05.
18. LOW — commented-out code for DESIGN-05 (collection-board.tsx:82-90, :109-111; dashboard-walk.test.tsx:254, :261).
19. LOW — the PostHog options test repeats its constant.
20. LOW — five exports used only in their own file.

## Clean

No `as T` on domain values, no `!`, no `@ts-expect-error`; no `Alert.alert`; every list is virtualized with a stable `keyExtractor`; `ScrollView` + `.map` only over bounded data; Pressables carry role and label; no literal sizes or colours outside tokens; Feature Switches: every feature the app reads has a switch in `editions/uk/edition.json`, the rest goes through the Core's `kindsShown` / `useShown`; `foreground-reports.ts` and `MascotCelebrations` survive a composition reopen correctly.

---

# Part A: screens and hook modules


Read-only sweep. Paths are relative to `apps/mobile/src` unless noted. The skip list of spec #1586 is respected.
Checked and clean: no `Alert.alert` or `ActionSheetIOS`; no `'use no memo'` in scope, so the compiler is on everywhere; no `as` or `!` casts other than `as const` and typed `require`; no literal sizes or hex colours; the only raw `Pressable` (notification-times.tsx) has a role, a label and minTouchTarget; no number before `&&`; every list has a keyExtractor that returns a stable id (SectionList keys are scoped per section, so the same entryId in "words" and "byMeaning" does not collide); the daily and traced crossword moves are serialized by `inTurn` in the Core.

## 1. HIGH: the Dashboard can keep sending the reader back to the Feed
- Where: dashboard/dashboard.ts:48-51, feed/feed.ts:123-139, packages/core/src/feed/feed.ts:451-453
- What is wrong: the Dashboard opens `/feed` every time it gains focus while `wordOfTheDayLanding.asked()` is set. Only the Feed clears the ask (`landing.landed()`), and it does that only when today's Word of the Day card is among its cards (`landingPage !== -1`). The Core leaves that card out when the Cycle doesn't cover the Word, or when today's Word was Hidden after it was chosen (the Core's own comment at feed.ts:443).
- Failure: today's Word of the Day is Hidden, or is outside the Mix after a Mix change. The reader taps «До картки →» or uses the «Слово дня» App Intent. The Feed opens and never lands, so the ask stays pending. The reader goes back, the Dashboard gains focus and pushes the Feed again. The Dashboard can't be used until the app is restarted.
- Fix: clear the ask when the Feed can't land it, meaning its cards are drawn and none is today's Word of the Day. Or let the Dashboard consume the ask once it has opened the Feed (keep "opened for ask X" in a ref and only re-open for a new ask object).
- Confidence: plausible (the code path is confirmed; not reproduced).

## 2. MEDIUM: double tap on «Додати» makes two copies of a Curated Collection
- Where: app/curated-collection/[collectionId].tsx:80 (`if (!screen.added) add();`), packages/core/src/dashboard/curated-collections.ts:197-205
- What is wrong: `add` checks `isAdded()` and then awaits `liveEntries()` before `collections.createCopy`. `screen.added` only flips after the copy is written and the screen reads again, so two taps inside that window both pass the check. `createCopy` goes through `inTurn`, but nothing deduplicates by `source`.
- Failure: a fast double tap (or a tap on a slow device) leaves two copies with the same name in «Колекції».
- Fix: in the Core, keep the in-flight add per collectionId, or re-check `isAdded` inside the turn (move the check into the `inTurn` of collections, or `createCopy` refuses when `source` already exists). The app can also add a busy state, but the rule belongs in the Core.
- Confidence: confirmed by reading (timing dependent).

## 3. MEDIUM: Collection Link screen is blank while it loads and stays blank if the read fails
- Where: saved/collection-link.ts:17, app/c/[linkId].tsx:59-67
- What is wrong: the hook collapses `useCompositionRead`'s `loading` and `failed` (with retry) into `undefined`, and the route then draws only the back link. The read goes over the network through the retry rule (ADR 0037), which can take seconds.
- Failure: the reader opens a shared link on a slow network and sees an empty screen with no spinner. If `preview()` rejects (an unexpected error), the screen stays empty for good, with no retry.
- Fix: return the opening state as a discriminated union (loading / failed+retry / ready) and draw a loading indicator and the Failure view with a retry.
- Confidence: confirmed (loading); plausible (rejection path).

## 4. MEDIUM: board-style screens have no empty state and no failure state
- Where: saved/collection-board.tsx:76-80 and 102 (RailBoard has no empty handling: packages/ui/src/dashboard/RailBoard.tsx); categories/category-screen.ts:64-82 (cards stay `undefined` on error); dashboard/curated-collection.ts:34-41; dashboard/correction-type.ts:38-46; app/correction-type/[type].tsx:40 (no ListEmptyComponent)
- What is wrong: the list-style Collection screen has «порожня колекція» with a hint, but the board style (`collectionBoardStyle` on) draws only the hero over nothing. A Curated Collection whose Entries are all Retired, or a Correction Type with no Corrections, draws a bare hero. A failed read is only logged, and the screen keeps its loading look forever: an empty kicker and progress on the Category board, «0 … 0/0» on the Correction Type.
- Failure: a reader empties a Collection or makes a new one, then opens it: a red hero and blank space, with no hint of what to do. An IndexedDB or storage read error leaves a Category screen half-drawn with no message.
- Fix: give RailBoard an `empty` slot (the board's empty copy). Have the hooks return `{status:'failed', retry}` instead of logging only.
- Confidence: confirmed.

## 5. MEDIUM: History day headings and labels go stale after midnight
- Where: saved/history.ts:37-61
- What is wrong: `useHistoryText` calls `useIsFocused()` so that a focus re-render refreshes the relative times, as its comment says. But `useHistorySections` memoizes on `[list, text]`, and `text` is memoized on `[count]`. A focus re-render therefore returns the cached sections, and `groupByLocalDay(..., deviceClock)` is not run again. The React Compiler would cache the same way.
- Failure: the reader looks at History in the evening and comes back the next morning (the tab is still mounted, the app was only backgrounded). Yesterday's group still reads «Сьогодні», and the day before reads «Учора», until something new is Seen.
- Fix: put the local day key, for example `todayKey(deviceClock)` read on focus or from a day-change subscription, into the deps of the sections memo. Or recompute the sections without memo on focus.
- Confidence: confirmed by reading.

## 6. LOW-MEDIUM: discarded promises that can reject without a handler
- Where: progress/progress.tsx:27 (`void mood.daysByMood().then(...)`, no rejection handler); dashboard/dashboard.ts:55, 59, 68 (`void dashboard.reveal()`, `void mood.choose()`, `void curatedCollections.open()`); dashboard/correction-type.ts:65 (`void correctionTypes.reveal()`); feed/weekly-recap-notice.tsx:59 (`void ...analytics.shareCardShared`)
- What is wrong: each is a Core call that writes storage or analytics and can reject, and the rejection is unhandled. The rest of the app uses `keep(...)` or `.catch(logError)`.
- Failure: a storage write fails. An unhandled promise rejection appears (a red box in dev, nothing in diagnostics in prod), and «Розкрити» or the Mood tile silently does nothing.
- Fix: route them through `keep()` or `.catch(logError)`. This may overlap with #1586's idiom work, so check that plan for these call sites.
- Confidence: confirmed.

## 7. LOW: correction-type and curated-collection re-reads can resolve out of order
- Where: dashboard/correction-type.ts:38-49, dashboard/curated-collection.ts:33-46
- What is wrong: every `subscribe` tell starts a new read, and all of them share one `active` flag. A slower earlier read that resolves after a newer one overwrites the newer rows.
- Failure: «Як правильно?» reveal, then a Seen on the Feed, gives two quick tells. If the first read resolves last, the Correction shows unrevealed again until the next tell.
- Fix: keep a read counter (ref) and apply only the latest result, or have the Core expose a synchronous snapshot.
- Confidence: plausible.

## 8. LOW: Search keeps the previous query's results when a search fails
- Where: search/search.ts:88-101
- What is wrong: on rejection the model is not reset, so the groups of the last successful query stay under a new query.
- Failure: the reader types «кав», then «кава» and that search throws. The screen shows the results for «кав» as if they were the results for «кава».
- Fix: in the error branch, `setModel(nothingYet)` (or an error model) when `active`.
- Confidence: confirmed by reading.

## 9. LOW: Level and Badge "newly reached" rules live in an app component
- Where: mascot/mascot.tsx:109-127
- What is wrong: the app compares the previous and next Level and the earned Badge ids to decide that something was newly reached. The Core already exposes events for the Daily Goal (`subscribeGoalMet`) and Streak milestones (`onStreakMilestone`). The Level and Badge rules are domain rules, so they belong in the Core too (CLAUDE.md: rules in the Core).
- Failure: a reopen or sync that raises XP or Badges in bulk celebrates, or celebrates the wrong thing, by app-side diffing, and a test can't cover it through the Core seam.
- Fix: add `xpLog.onLevelReached` and `badges.onEarned` events in the Core and subscribe to those.
- Confidence: plausible (design finding).

## 10. LOW: the Weekly Recap card keys its read on LocalDate object identity
- Where: feed/weekly-recap.ts:13-28
- What is wrong: `recap?.of === day` and the effect dependency `[weeklyRecap, day]` compare a LocalDate object by reference. If the Feed ever rebuilds the notice card with a new `day` object, the card blanks and reads again (and would loop if the parent built a new object on every render).
- Fix: key the read on `dateKeyOf(day)`.
- Confidence: plausible (`card.day` is stable today).

## 11. LOW: loading looks like real data on the Correction Type and Curated Collection heroes
- Where: app/correction-type/[type].tsx:34-35 and 56-60, app/curated-collection/[collectionId].tsx:56-64
- What is wrong: while `rows` or `screen` is undefined, the hero prints «0 прикладів · 0/0» or an empty title, where the Category board shows blank text until it has read. The loading state is drawn as real data.
- Fix: the same rule as the Category board (blank until read), or a skeleton.
- Confidence: confirmed.

---

# Part B: shell


## S1. LOW: `StatsPillAndSheet` reads Mood days with no failure path and subscribes to Progress twice
- Where: apps/mobile/src/progress/progress.tsx:17-33
- What is wrong: `void mood.daysByMood().then(...)` has no `.catch`; a rejected read (SQLite error) becomes an unhandled rejection and the sheet shows an empty calendar with no log line. The same component subscribes to `progress` through `useSubscribed` and again through a `useReducer` version bump "so any change draws the calendar again"; the reducer alone redraws everything, the selector adds a second subscription per mount.
- Failure: the user-state read fails once while the sheet opens: nothing is logged, the Mood calendar shows zeros, and the sheet never retries while open.
- Fix: `.catch((error: unknown) => logError('Could not read the Mood days', error))`; drop the `useSubscribed` selector and read `source.state` after the version bump (or keep one subscription).
- Confidence: confirmed.

## S2. LOW: the remote-switch and reopen chain trusts a comment instead of a handler
- Where: apps/mobile/src/shell/lifecycle.tsx:66-77
- What is wrong: `void switches.ask().then(async (changed) => { … await composition.reopen(); … writeWidgetSnapshot(...) })` has no `.catch`. The comment says neither the ask nor a reopen rejects, but `writeWidgetSnapshot` runs in the same chain and is a native App Group write.
- Failure: the App Group write throws (widget extension missing in a dev build, disk full): an unhandled rejection with no `logError`, invisible in Sentry's breadcrumbs.
- Fix: end the chain with the same `.catch(logError(...))` the content-update and account listeners below it use.
- Confidence: plausible.

## Checked and clean (shell)
- `foreground-reports.ts`: listeners read `opening.state` on every moment, so a reopen swaps the value; the `'launch'` moment fires once per listener, which is right because `sync` is never reopened (only `composition` and `settings` are).
- `mascot.tsx` `MascotCelebrations`: re-subscribes on each composition reopen, clears its timer and stops every subscription on cleanup; baselines reset from the reopened state.
- `word-of-the-day-landing.ts`: a correct tiny external store; the defect is in who clears it (see finding 1 of screens-hooks.md).
- Casts: no `as T` on domain values, no `!`, no `@ts-expect-error` in app source; the `as` that exist wrap `require()` of native modules behind `nativeModules.load` and one `JSON.parse` in test support.
- `Alert.alert` / `ActionSheetIOS`: none.
- Every list screen uses `FlatList` / `SectionList` with `keyExtractor`; `ScrollView` + `.map` only over bounded data (settings, Game Mode offers, Dashboard blocks, Badges).

---

# Part C: tests and dead code


## T1. MEDIUM: `useEntries()` is exported and never used
- Where: apps/mobile/src/content-update/language-pack.tsx:99
- What is wrong: no import anywhere in the repo (code, tests, maestro).
- Failure: dead code that reads the Language Pack through a hook nobody renders; it rots silently when the Language Pack API changes.
- Fix: delete it.
- Confidence: confirmed.

## T2. MEDIUM: the «fresh» test state test proves nothing
- Where: apps/mobile/src/user-state/test-states.test.ts:103
- What is wrong: «fresh: the onboarding from its first step» checks the step with `toBeDefined()` only; it passes on any step of the onboarding.
- Failure: the fresh state starts at the Daily Goal step by mistake; the test stays green.
- Fix: assert the step's `kind` equals the first step of the onboarding.
- Confidence: confirmed.

## T3. MEDIUM: the undo-after-reopen tests pass if the hide was lost
- Where: apps/mobile/src/mix/hiding-undo.test.ts:74, :85
- What is wrong: the tests undo a hide after a reopen and assert the hidden lists are empty, but never assert the hide survived the reopen first. If the reopen loses the hide, the lists are `[]` anyway.
- Failure: a regression in reopen drops hidden Entries or Categories; both tests stay green.
- Fix: assert the Entry / Category is hidden after the reopen, then undo, then assert empty.
- Confidence: confirmed.

## T4. LOW: five skipped tests waiting for the owner (DESIGN-05)
- Where: apps/mobile/src/saved/collection-board.test.tsx:218, :226, :242; apps/mobile/src/dashboard/dashboard-on-screen.test.tsx:503, :584
- What is wrong: `it.skip` marked «DESIGN-05, owner decides»; a decision is pending, not recorded as a ticket or ADR.
- Fix: the owner decides; then delete or restore the tests and the commented code below.
- Confidence: confirmed.

## T5. LOW: commented-out code
- Where: apps/mobile/src/saved/collection-board.tsx:82-90, :109-111; apps/mobile/src/dashboard/dashboard-walk.test.tsx:254, :261
- What is wrong: code kept in comments for the same DESIGN-05 decision; git keeps history, comments do not compile or lint.
- Fix: remove with T4's decision.
- Confidence: confirmed.

## T6. LOW: the PostHog options test repeats its constant
- Where: apps/mobile/src/analytics/posthog-analytics.test.ts:31
- What is wrong: it asserts `postHogOptions` equals the literal it is; it does not check that `createPostHog` hands the options to the SDK.
- Fix: drive `createPostHog` with a fake SDK constructor and assert what it receives.
- Confidence: confirmed.

## T7. LOW: exports used only in their own file (knip.jsonc asks to drop the `export`)
- apps/mobile/plugins/app-intents.ts:83 `appShortcutsSwift`; apps/mobile/src/analytics/posthog-analytics.ts:11 `POSTHOG_EU_HOST`; apps/mobile/src/game/traced-crossword.ts:58 `tracedTexts`; apps/mobile/src/settings/legal-page.ts:11 `legalPageAddress`; apps/mobile/src/user-state/test-states.ts:40 `isTestStateName`.
- Confidence: confirmed (by grep; a `knip` run did not happen).

## Checked and clean
- No test without an `expect`; no test mocks its own module; same-named tests in different files check different things; 76 negation-only tests nearly all have a positive twin; no unused props found.
