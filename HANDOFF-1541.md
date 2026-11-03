# Handoff #1541 (run 2: Core code written, tests half-done)

Branch `feat/1541-rarity-ceiling-core`, worktree `.claude/worktrees/agent-a05b11f39593c30d7`, base `feat/1540-rarity-crossword-bugs` (6cbbba5d). Design = run 1's handoff (coordinator answers: keep switch `rarityCeiling`; self-rating only decides the Rarity Test offer; `RarityFloorChoice` + `strings.rarity.floor` stay until #1545). Delete this file before the last commit.

## Done (one WIP commit)
- contracts: `rarityFloor` switch gone, `MixConfigSchema` without rarities, `UserSettingDefaultsConfigSchema.rarityCeiling`, selfRating without `rarityFloor`, who/floor superRefine gone. 4 edition.json files moved.
- core: `settings/records.ts` `rarityCeiling` ('settings.rarityCeiling'); `mix/records.ts` lost both; migration v7 in `user-state-schema.ts`; new `settings/rarity-ceiling.ts` (`withinRarityCeiling`, `readRarityCeiling`, `openRarityCeiling`, `RarityCeilingEdition`), exported from index, `composition.rarityCeiling`; `entries.ts` filters with it + `wordsUnderRarityCeiling()`; `mix.ts` without floor/ceiling; `rarity-test.ts`, `questionnaire.ts` (`applies('selfRating')` → `on('rarityTest')`), `onboarding.ts` take `rarityCeiling: Pick<RarityCeiling,'set'>`; `edition.ts` `UserSettingDefaults.rarityCeiling`, `DEPENDS_ON.rarityTest=['rarityCeiling']`; `test-support.ts` defaults. Core sources typecheck (tests not yet).
- New `settings/rarity-ceiling.test.ts` (old `mix/rarity-ceiling.test.ts` deleted): 10/12 pass.

## Open
- 2 failing tests there: at ceiling 5 (default, and switch off) the Feed walk never shows a rarity-1 Word: `expected Set{3,5,2,4} to equal Set{1,2,3,4,5}`, even over 200 cards; at ceiling 2 rarity 1 shows. Difference from the old test: `corrections: true` + `correction('c_1')` in the pack. Suspect: the Feed/Cycle treats r1 Words differently with a Correction in the Mix (linked Corrections? `standardEquivalents` of `correction()` = `['1','also 1']`?), or `idsInFeed` logic. Try `corrections:false` in `edition()` and a separate Correction test, or debug which ids come.
- Rewrite the other tests (list in run-1 design): `mix.test.ts`, `game.test.ts` (`on` lists `rarityFloor`→`rarityCeiling`; the Floor test → `rarityCeiling.set(2)` with common Words), `review.test.ts` 64/174/221, `exchange.test.ts` 166 → `settings.rarityCeiling`, `onboarding.test.ts`, `questionnaire.test.ts`, `entries.test.ts`, `mood-draw.test.ts`, `search.test.ts`, `edition.test.ts`, `rarity-test.test.ts`, `user-state-schema.test.ts` (key lists l.155, 282; add `['rarityCeiling', undefined, 'settings.rarityCeiling', '3']`).
- language-pack `ukrainian-edition.test.ts` l.40/95; backend `edition.test.ts` l.84.
- apps/mobile minimal compile: `src/mix/{mix.ts,mix-screen.ts,mix-choices.tsx}` drop floor/ceiling; `shown.ts` selfRating → `on('rarityTest')`; tests.
- Docs: ADR 0072 + index line + notes on 0015/0052; CONTEXT.md lines from run-1 handoff; `apps/mobile` strings untouched.
- Then: merge integration tip, `pnpm turbo run lint typecheck test --filter=@slovo/contracts --filter=@slovo/core --filter=@slovo/language-pack --filter=backend --filter=mobile`, `pnpm format`, delete this file.
