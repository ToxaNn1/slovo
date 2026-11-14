# Review of spec #1850 (board 09 Saved/Search)

Scope: `git diff origin/main...origin/feat/1114-saved-search-design`, tickets #1851–#1856, #1858, #1859. `editions/**` and `*.snap` skipped. Read-only review: no tests run, no simulator.

Checked and clean: Core free of React; no `as`, `!` or `@ts-expect-error` in shipped code (only `as` on style props in UI tests, as in 28 existing test files); time and randomness injected (toast `schedule`, Due Quiz `seeded`, `deviceClock` shift with fake `Date` in tests); Due Quiz matches ADR 0131 (due Words only, three distinct meanings, seed `dueQuiz:<day>:<word>`, Known/Unknown, one answer per Word, `dueQuiz` needs `knowledge`); Collections grid, Collection screen, menu and name sheet match ADR 0132; the `?day=` shift is `__DEV__` only, reset without the parameter, warned and documented; handbook pages named in the DONE commits.

## Findings (most severe first)

1. **Spec gap: no cascade on the recent queries.** `packages/ui/src/search/RecentQueries.tsx:23`. #1858 Task asks for «Recent queries with a clock icon, cascade»; the board animates each row (`slCasc`, rise 16, +.04–.05 s per row) and `docs/design/board-09-report.md:108` lists it. The rows are plain `Pressable`s: they appear all at once. The Saved list rows (T2 of the report, `:147`) have no cascade either. Fix: rise each row with `useCascade(index, { variant: 'rise', … })` from `primitives/useCascade.ts`, as `PreviousWords` does.

2. **«Нічого не знайдено» threshold counts other letters than the Core.** `apps/mobile/src/search/search.ts:38,91`. The screen counts `Array.from(query.trim())`; the Core's «За значенням» counts letters of the Comparison Key (`packages/core/src/search/search.ts:23,214`), which drops Stress marks. Failure: `до́` (д, о, U+0301) counts 3 on the screen, 2 in the Core: meaning search does not run, yet the screen says «Нічого не знайдено» with the hint that meanings are searched from 3 letters. The rule also lives in two places. Fix: let the Core say it (e.g. `search.answersByMeaning(query)` next to `answers`) and use that in `searchScreenModel`.

3. **Due Quiz options keep no answer for VoiceOver.** `packages/ui/src/saved/DueQuiz.tsx:196`. After a pick, each option's label stays «А, <meaning>», with no right/wrong, and the option stays an active button (the tap is ignored silently). Failure: a VoiceOver reader who misses the one `announceForAccessibility` cannot find which meaning was right. `YesterdayCard` (same `QuizOption`) adds `game.round.correct` / `chosen` to the label. Fix: add the look to `optionLabel` as `YesterdayCard.optionLabel` does, and mark options disabled once picked.

4. **Stale comments on `create` after its type changed.** `apps/mobile/src/saved/collections.ts:48,80`. Both say a refused name «rejects»; `create` now resolves to `{ ok: false, refusal }` and never rejects for a refusal. Failure: a caller wrapping it in `try/catch` for refusals, as the comment says, never sees one. Fix: say it resolves to the refusal.

## Spec Result items not on this branch

- #1857 (delete with undo, share sheet, «Скопіювати посилання» with `expo-clipboard`) is still open and not merged: the spec's Result lines «delete and share sheets; toasts; undo restores the same Collection» and «The share sheet copies the id Collection Link» stay unticked. Today a delete from the grid or the Collection screen shows no toast and has no undo; the Collection screen's share button opens the system Share directly (commented in `apps/mobile/src/saved/collection-board.tsx`). The `collections.shareSheet`, `toasts.deleted`/`undo`/`copied` strings and the `collectionLinkCopy` switch are unused until then.
