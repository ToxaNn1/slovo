chore: code health after the Core audit (spec #1800)

Closes #1800, closes #1801, closes #1802, closes #1803, closes #1804, closes #1805, closes #1806, closes #1807

## What changed
- #1801 the crossword property test runs its properties in about 0.8 s (was ~18 s): fewer days per draw and a `searchBudget` option on `newCrosswordDays` (default unchanged); 10 grid properties with fast-check.
- #1802 the Mix kinds come from `EntryKind`: `MixKindSchema` derived from `EntrySchema`, `MixConfigSchema.kinds` a record of it, Mix records keyed `mix.` + the kind name (stored keys unchanged); `WeightedKindSchema` removed; `OriginLanguageSchema` moved to `origin-language.ts`.
- #1803 `countsAsWon` in the Core decides whether a Game over counts as won; game.ts and `GameResult` use it.
- #1805 `slovo/one-switch-per-condition` (packages/config/switch-lint.js) follows `const` variables to their Feature Switch question; replaces the selector in the Core's ESLint config.
- #1806 `useOpenCrossword` holds the open-state code both crossword hooks shared.
- #1807 the author check keeps only the noreply address.
- #1804 no code change, see Questions.

## Checks
lint, typecheck, test of config, contracts, core, language-pack, ui, mobile green locally; `pnpm deps` clean; code review done (one fix, rest low).

## Questions for the owner
1. #1804: a closed union of Game Mode ids would contradict ADR 0006 (Game Mode is an Extension Point; an Edition adds modes). Default: keep `mode: string`. Other ways: a branded `GameModeId` parsed in `packages/core/src/progress/records.ts`, or an ADR change.
2. `packages/core/src/feed/feed-notices.ts:180` asks two Feature Switches through a helper, which the lint rule does not follow. Move that dependency into `DEPENDS_ON` as its own ticket? Default: left as is.
3. `packages/config/package.json` gained one `exports` line (`./switch-lint`) inside the wave, not via the infra queue. Default: kept.
4. Two tickets of the brief were already done on `main`: the four React Compiler suppressions (#1292) and a widget link replacing an open Word (`replaceOpenEntry` Feature Switch). Default: no ticket; check the switch is on for the Edition.

## Owner checks
None: no reader-visible change. Handbook pages: none.
