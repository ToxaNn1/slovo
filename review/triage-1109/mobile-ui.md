# Triage: mobile.md + ui.md (Medium/Low) against main bd94d6b2

Totals: FIXED 2 · SKIP-VISUAL 7 · SKIP-OWNER 4 · SKIP-PATH 0 · FIX 19 → 11 tickets.
Paths are under apps/mobile/src (M) or packages/ui/src (U) unless written in full.

## Table

| id | class | reason |
|---|---|---|
| mobile-2 double-tap Curated copy | FIX | core curated-collections.ts:197 still checks `isAdded` before `await liveEntries`; Core test with two un-awaited `add()` |
| mobile-3 Collection Link blank | SKIP-VISUAL | new loading indicator + Failure view on screen |
| mobile-4 board empty/failure states | SKIP-VISUAL | RailBoard empty slot, failure states on screen |
| mobile-5 History headings stale after midnight | FIX | M/saved/history.ts:46-55 memo deps `[list, text]`, text on `[count]`; labels wrong, no new look; hook test over a clock crossing midnight |
| mobile-6 discarded promises | FIX | six `void` calls still there (dashboard.ts:55,59,68; correction-type.ts:65; weekly-recap-notice.tsx:59; progress.tsx:27); M/keep.ts exists |
| mobile-7 re-reads out of order | FIX | correction-type.ts:36-49, curated-collection.ts:33-46 share one `active` flag; hook test with two deferred reads resolving in reverse |
| mobile-8 Search keeps old results on failure | FIX | search.ts:91-98 error branch leaves model; reset to existing `nothingYet`, no new state drawn |
| mobile-9 Level/Badge "newly reached" in app | FIX | mascot.tsx diffs Level/Badges; Core has only `subscribeGoalMet`; Core events testable through the Core seam |
| mobile-10 Weekly Recap keyed on LocalDate identity | FIX | weekly-recap.ts:22,26 compare by reference; key on `dateKeyOf(day)` |
| mobile-11 heroes show 0/0 while loading | SKIP-VISUAL | loading look on screen |
| mobile-S1 StatsPillAndSheet | FIX | progress.tsx:17-33 no `.catch`, two subscriptions to `progress` |
| mobile-S2 remote-switch chain | FIX | lifecycle.tsx:70 `void switches.ask().then(...)` has no `.catch`, `writeWidgetSnapshot` inside |
| mobile-T1 `useEntries` dead | FIX | content-update/language-pack.tsx:99, no importer |
| mobile-T2 «fresh» test weak | FIX | test-states.test.ts:103 still `toBeDefined()` |
| mobile-T3 undo-after-reopen weak | FIX | file moved to M/undo.test.tsx:7-21 (commit 47546fd3); still no assert that the hide survived reopen |
| mobile-T4 five `it.skip` DESIGN-05 | SKIP-OWNER | owner decides DESIGN-05 (collection-board.test.tsx:220,228; dashboard-on-screen.test.tsx:504,585; 4 left) |
| mobile-T5 commented-out code | SKIP-OWNER | same DESIGN-05 decision (dashboard-walk.test.tsx:253,260; collection-board.tsx) |
| mobile-T6 PostHog options test repeats constant | FIX | posthog-analytics.test.ts:31 asserts the literal; `createPostHog` (ts:34) untested |
| mobile-T7 exports used only in own file | FIX | all five still exported, only own-file use (knip.jsonc rule) |
| ui-M1 accent small text contrast | FIXED | `accentText` token in main (#1749, 24 uses) |
| ui-M2 useReduceMotion per call site | SKIP-VISUAL | fixes first-frame full-motion animation: changes animation |
| ui-M3 thrown Collection action swallowed | SKIP-VISUAL | fix shows a refusal on screen (or error boundary); error state on screen |
| ui-M4 size constants bypass token lint | FIX | 39 size consts in 10 files + caps in 34 files; move values unchanged to tokens, extend lint; lint proves it |
| ui-L1 DailyCrosswordCard no `voice` | FIX | DailyCrosswordCard.tsx:67 label without `{...voice}`; render test on props |
| ui-L2 stale `onDone` in splash | FIX | SplashOverlay.tsx:128-133 eslint-disable still there; `useEffectEvent` + timer test |
| ui-L3 `fieldProblem` two tokens | FIXED | TextField.tsx:125 and CollectionNameField.tsx:68,106 both `accentText` |
| ui-L4 inline SVG shapes | FIX | SettingsRows.tsx:117 chevron, SwipeMarks.tsx:435 check; move same points to `wedges` (tokens/base.ts:735) |
| ui-L5 tile edge contrast | SKIP-OWNER | board colour decision |
| ui-L6 CategoryGrid re-renders | SKIP-OWNER | docs/react-native.md: hand memo only where measured; needs a profile, no test proves it |
| ui-L7 15 unused exported types | FIX | 9 used only in own file + index.ts (CategoryShape, GesturesHintTexts, GridColumns, HeroAction, MessageToastContent, MistakeReportSheetDraft, RowIcon, ToastContent, TracedLetter); 5 are used by tests via @slovo/ui (keep); CrosswordWord no longer exported by ui |
| ui-L8 four capital-label components | SKIP-VISUAL | merge needs a check against the boards |
| ui-L9 UNMEASURED_WIDTH guess | SKIP-VISUAL | changes swipe-mark animation positions before layout |

## Tickets

T-mobile-1: The Core makes one copy of a Curated Collection on a double tap
- findings: mobile-2
- files: packages/core/src/dashboard/curated-collections.ts (+ its test)
- fix: keep the in-flight `add` promise per collectionId (second call returns it), or re-check `isAdded` inside the collections turn before `createCopy`.
- test: two `add(id)` calls without awaiting the first → exactly one Collection with `source === id`.

T-mobile-2: Discarded Core changes and the reopen chain log their failures
- findings: mobile-6 (dashboard.ts, weekly-recap-notice.tsx, progress.tsx), mobile-S1, mobile-S2
- files: M/dashboard/dashboard.ts, M/feed/weekly-recap-notice.tsx, M/progress/progress.tsx, M/shell/lifecycle.tsx
- fix: wrap in `keep(subject, …)` / end with `.catch(logError)`; StatsPillAndSheet keeps one subscription (version bump, read `source.state`).
- test: a fake Core whose change rejects → logError called, no unhandled rejection; lifecycle test with a throwing `writeWidgetSnapshot` → logged.

T-mobile-3: The latest read wins on the Correction Type, Curated Collection, Search and Weekly Recap
- findings: mobile-7, mobile-8, mobile-10, mobile-6 (correction-type.ts:65 reveal through `keep`)
- files: M/dashboard/correction-type.ts, M/dashboard/curated-collection.ts, M/search/search.ts, M/feed/weekly-recap.ts
- fix: a read counter ref, apply only the latest result; Search failure sets `nothingYet`; Weekly Recap keyed on `dateKeyOf(day)`.
- test: two deferred reads resolved in reverse order → newer rows shown; search rejecting → old groups gone; new equal LocalDate object → no re-read.

T-mobile-4: History day headings follow the device's day
- findings: mobile-5
- files: M/saved/history.ts (+ test)
- fix: add the local day key (read on focus) to the sections memo deps.
- test: Seen today, clock moves past midnight, focus again → heading «Учора», not «Сьогодні».

T-mobile-5: Dead code and tests that prove nothing
- findings: mobile-T1, T2, T3, T6, T7
- files: M/content-update/language-pack.tsx, M/user-state/test-states.test.ts, M/user-state/test-states.ts, M/undo.test.tsx, M/analytics/posthog-analytics.ts(+test), M/game/traced-crossword.ts, M/settings/legal-page.ts, apps/mobile/plugins/app-intents.ts
- fix: delete `useEntries`; assert first step's kind; assert hidden after reopen before undo; test `createPostHog` with a fake SDK constructor; drop the five `export`s.
- test: the tightened tests themselves; lint + typecheck (knip rule).

T-mobile-6: The Core tells a Level reached and a Badge earned
- findings: mobile-9
- files: packages/core/src/progress/xp-log.ts, the Core badges module, M/mascot/mascot.tsx
- fix: `onLevelReached` / `onEarned` events in the Core (like `subscribeGoalMet`); MascotCelebrations subscribes, drops its diffing.
- test: Core test: XP over a Level boundary fires once; a bulk reopen/sync sets the baseline without firing. Core logic → Fable; may near 150 lines.

T-ui-1: Edition voice on the crossword tile, a fresh splash `onDone`, shapes as wedges
- findings: ui-L1, ui-L2, ui-L4
- files: U/game/DailyCrosswordCard.tsx, U/onboarding/SplashOverlay.tsx, U/tokens/base.ts, U/settings/SettingsRows.tsx, U/entries/SwipeMarks.tsx
- fix: spread `voice` on the tile (BadgeMark symbol if a letter); `useEffectEvent(onDone)`, drop the eslint-disable; `wedges.chevron`, `wedges.check` with the same points.
- test: render test asserts the tile carries the Edition voice props; splash test re-renders with a new `onDone` before the cut → the new one fires; lint.

T-ui-2: Drop nine exported types nobody imports
- findings: ui-L7
- files: U/index.ts and the 9 defining modules
- fix: remove the type re-exports from index.ts (and `export` where only used in-file per knip.jsonc).
- test: typecheck + lint (knip) across apps, site, ui.

T-ui-3: Game sizes into tokens/game.ts
- findings: ui-M4 (part 1)
- files: U/game/OrderedChips.tsx, PairsGrid.tsx, VowelButtons.tsx, GameTimer.tsx, TypedAnswer.tsx, U/tokens/game.ts
- fix: move the constants with unchanged values into game tokens.
- test: typecheck + existing render tests; values identical (no visual change). Watch for overlap with the 1108 game layout fixes.

T-ui-4: Remaining module size constants and the token lint selector
- findings: ui-M4 (part 2)
- files: U/progress/XpBar.tsx, search/SearchButton.tsx, entries/WordCard.tsx, PronunciationButton.tsx, EntryCard.tsx, SwipeMarks.tsx, feed/FeedStates.tsx, GesturesHintSheet.tsx, primitives/BottomSheet.tsx, UndoToast.tsx, SwipeableRow.tsx, FallingMarks.tsx, tokens/*, token-lint.js
- fix: values unchanged into tokens/entry.ts, chrome.ts, `motion.sheet`; add the VariableDeclarator selector outside tokens/. After T-ui-1 and T-ui-3.
- test: lint fails on a fixture `const CHIP_GAP = 8` outside tokens/, passes on the tree.

T-ui-5: One font-scale cap token
- findings: ui-M4 (part 3)
- files: U/tokens/base.ts and the 34 files redeclaring `*_MAX_FONT_SCALE`
- fix: `fontScaleCap = { number: 1.3, text: 1.5 }` in base.ts, mechanical replace (Sonnet). After T-ui-4.
- test: typecheck + lint; grep for `MAX_FONT_SCALE =` outside tokens is empty.
