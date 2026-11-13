fix: 13.11 code review fixes

## Summary

Fixes the findings (R-ids) of the 13.11 code review, built in lanes L1, L2, L3a, L3b, L4, L5, L6, LXa and LXb on the integration branch. Lint, typecheck and test were green per lane for the packages it touched. Items a lane could not do alone (contracts, infra, Edition strings) were done by LX; what is left needs an ADR or an owner decision (see Skipped).

## Fixed

- L1: R1, R8, R9, R51, R52, R53, R54, R55, R87, R88, R152, R154, R155
- L2: R36, R40, R41, R122, R123, R126, R129, R144, R145, R146, R147, R148, R163, R64; R166 partly (STRESS_MARK from contracts, one "No Word or Correction" refusal helper; the rest by LXb)
- L3a: R6, R10, R68, R69, R12, R14, R56, R67, R71, R90, R91, R92, R93, R94, R95, R89, R96 (font cap only), R97, R138
- L3b: R15, R16, R17, R19, R20, R57, R58, R73, R74, R75, R76, R99, R100, R101, R102, R103, R104, R105, R106, R139, R140
- L4: R21, R26, R27, R28, R109, R111, R141, R160, R175, R25, R143, R77, R50, R78, R108, R112, R159, R22, R171, R161
- L5: R3, R34, R4, R30, R117, R119, R33, R29, R31, R32, R35, R38, R39, R60, R61, R62, R63, R113, R114, R115, R116, R120, R121, R124, R164, R79 (contracts exports), R173, R162 (media sweep and slot retire)
- L6: R44, R45, R132, R130, R65, R81, R82, R46, R47, R131, R2, R80, R42, R7, R43, R167, R168, R83, R84 (shared Rings), R133, R134, R135
- LXa: R5, R13, R18, R158, R24, R23, R66, R85, R149, R151, R169 (casts left only at documented boundaries), R176
- RV (review of core and backend): RV1 migration 0026 drops later duplicate sign-in methods before the unique index; RV2 the media sweep stamps fileDeletedAt only after the file delete
- LXb: R37, R166, R127, R79, R72, R98, R107, R70, R156, R59

## Skipped

- R153 — does not hold: no copy of the builder remains, a helper would only move the cast
- R170 — not done: the retry already ends; a bound has no test through the public seam
- R128 — does not hold: every caller passes a schema-checked id, the fallback is unreachable
- R11 — does not hold: PressedTile passes disabled to Pressable, which sets accessibilityState.disabled
- R48 — does not hold: RN 0.88 is new architecture only, measureLayout calls back synchronously
- R96 (MissFade part) — does not hold: already the one short fade ADR 0055 asks for
- R49 — needs ADR: ADR 0091/0113 make the tabbed card a fixed frame; a scrolling or capped head is a new decision and needs a device check
- R137 — does not hold: WholeLines is compiled by the React Compiler; no measurement shows a cost
- R174 — deliberate owner marker (hidden: not on board 04, owner 05.11), pending owner decision as DESIGN-05
- R86 — DESIGN-06 comments keep the module for the owner on purpose
- R142 — does not hold: React Compiler (ADR 0059) memoizes useShown
- R118 — does not hold: a retired Word can be restored and keeps its media
- R125 — needs ADR: strict admin inputs break /v1 by the guard (ADR 0031)
- R165 — needs ADR: ReasonSchema max(500) breaks /v1 by the guard (ADR 0031)
- R172 — does not hold as a duplicate: the two caches have different contracts
- R162 (quote-check part) — a generic select over five tables loses per-kind field types in drizzle without a cast
- R157 — needs a design decision: no Button variant draws the Theme's ink tile with the background label
- R84 (part) — Shouter and Rupor aim maths differ per composition; only identical Rings are shared
- R110 — needs infra: expo-crypto is not a dependency of apps/mobile
- R150 — needs infra: a shared tools/ jest resolver changes both jest configs
- RV3 — does not hold: server-core trims and lower-cases the provider email (AccountEmailSchema) before the authenticator

## Handbook pages to update

- Game, «За буквами» (letter tiles) — a tile tapped twice or tiles short of the slots are no answer; a Word the alphabet has too few decoys for is left out
- Notifications, evening notification — with 5 or more times set the plan still covers 14 days
- Analytics, freezeUsed — each event carries the freezes held after its own freeze
- Tip exceptions — the content check refuses a repeated exception word or one equal to the Tip's standard form (R129)
- Колекції — a failed name save shows and announces «Не вдалося зберегти назву. Спробуй ще раз.»
- Повідомлення про помилку — VoiceOver reads the counter as «12 з 500 символів»

## Questions for the owner

- R1: chips count is checked for the tiles layout only; a part of the chips in a line stays a wrong answer (as game-play.test.ts specifies). Ok?
- R51: the traced Daily Crossword awaited the same track in its turn; fixed with the crossing one. Ok?
- R87: the tick is clamped in the crossing-play reducer; a non-finite tick counts 0. Ok?
- R88: such a Word is left out, so too few Words refuse the mode as too-few-entries. Ok?
- R8: with one time set only that time is planned, as before. Ok?
- R52: new seam Entries.wordsLinking(ids); a hide and a restore of one Entry overlapping inside one read of the Cycle can leave a card without the link until the next change. Accept the gap?
- R54: log folds each record into totals; `days` and `milestones` Sets and Maps are changed in place (no reader compares them by identity). Ok?
- R54/R55: tests for the cost cannot see it through the seam (xp-log-fold.test.ts was green before the change too). Ok?
- R41: kept as documented fail-fast (pack is outside data parsed once). Ok?
- R129: new rule unique-tip-exceptions, case-insensitive in the Edition's locale; no Edition content has exceptions yet. Ok?
- R147: buildFromBackend still reads edition.json once for the id before fetching, then once in the build. Ok?
- R96: answer tiles are capped at fontScaleCap.number, as the grid's letters are. Ok?
- R17: answers are kept in a ref (onApply cannot run in a state updater). Ok?
- R103: tests read accessibilityState, as RNTL toBeChecked rejects togglebutton. Ok?
- R140: initialNumToRender dropped (the default renders more than one screen). Ok?
- R20: the Feed title is a header View over the logo button (pointerEvents none), so VoiceOver reads the heading, then the button. Ok?
- R57: railScreen.cascadeCap = 8; cards past the eighth rise in together. Ok?
- R75: HeroBack and useHeroRoom live in dashboard/, not primitives/. Ok?
- R105: a strip is chunked into weeks of 7; the core always sends 14 days. Ok?
- R111: canDismiss() paired with dismiss(), not canGoBack() with back(); useCompositionRead keeps the last value on a param change of the same composition. Ok?
- R171: selfCheck and wordTabs also moved into SwipedEntryCard, as all three branches passed them alike. Ok?
- R136: PATCH_FORMAT kept at 2; do ** marks and Tip exceptions warrant format 3 (every installed app refuses Patches until it updates)?
- L6: failed admin reads no longer retry, so the «Не вдалося» notice shows at once. Ok?
- R-OneWord: solved frame = last flip end, never before 165 and at most settled - 8. Ok?
- R134: words are compared lowercase without Stress and punctuation (LCS); a pair whose sentences change no word is left out and the draft lands in incomplete. Ok?
- R135: `add` with an empty file or folder prints «<path>: no records to add»; `edit` refuses a non-whole recordVersion. Ok?
- R127: contentChecksum is now optional in PackMetadata. Ok?
- R72: helper lives in packages/ui/src/primitives/timing.ts (bezier, bezierFn, REDUCED_FADE); Switch keeps its own fade. Ok?
- R79: WrongCodeSchema and SignInBlockedSchema added to the contracts. Ok?
- R59: Metro now loads node:sqlite and prints its ExperimentalWarning on start. Ok?
- R70, R156: new modules game/useAnswerMotion.ts and game/useTraceDrag.ts opt out in packages/ui/eslint.config.js and ADR 0059's list. Ok?
- R13: reads the visible label first, then the title. Ok?
- R24: last opened ask is kept at module level, so a Dashboard remount does not reopen the Feed. Ok?
- RV1: a later duplicate sign-in method is dropped even when it names another Account; that Account stays, reachable by its own email. Ok?
- Commit messages: 032a3347c (R53), 45abddebc (R63), d9034973b (R138) use `perf(...)`, which commitlint refuses, so the «Commit messages» check is red. Rewording them needs a force-push of this branch, which this session may not do. Please reword them (to `refactor(...)`) or allow it.
