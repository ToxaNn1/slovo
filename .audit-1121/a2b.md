# Audit 1121 — group a2b (apps/mobile: mascot, spotlight, badge opening, mix)

Read-only audit of `main`. Scoped tests run: vitest `src/mix src/spotlight` 44/44 green, jest `src/mix src/mascot src/spotlight` 49/49 green. One finding was reproduced with a throwaway jest probe (not committed).

Totals: high 0, medium 1, low 7.

## a2b.1 — CONFIRMED — medium

- **Where:** `apps/mobile/src/mascot/mascot.tsx:115`, `:140-142`, `:153`; emitter `packages/core/src/progress/badges.ts:192-193`
- **Defect:** `MascotCelebrations` keeps one `earnedBadge` slot. `badges.onEarned` tells each Badge a learning action earns, synchronously in a loop, so when one action earns two Badges the second `setEarnedBadge` replaces the first in the same batch.
- **Consequence:** reproduced: a flawless Correction Game (`game-finished`, mode `correction`, 10/10) tells `win-corrections` and `clean-language`; one stamp shows (the last), after «ГОТОВО» nothing else follows, and `win-corrections` stays `isNew` with no celebration. Same loss for the toast in a Game, and for a level Badge plus a streak Badge on one XP award.
- **Fix:** keep a queue (`readonly Earned[]`) and show its head; «ГОТОВО» / `onGone` shifts it. Add a test that earns two Badges at once and expects two stamps in turn.

## a2b.2 — CONFIRMED (traced) — low

- **Where:** `apps/mobile/src/mascot/mascot.tsx:140-142`, `:160`
- **Defect:** a New Level is dropped while the reader hides the counters (`screensNewLevel()` guard, line 145), but `showBadge` stores the Badge regardless; the render only returns `null` while `celebrations` is false.
- **Consequence:** a Badge earned under «Без лічильників» (ADR 0066) is stamped or toasted later, out of context, the moment the reader turns the counters back on (possibly days later in the same app run). The toast's `key`/timer starts then too.
- **Fix:** guard `showBadge` the same way (`if (screensNewLevel()) setEarnedBadge(...)`), or clear `earnedBadge` when `celebrations` turns false.

## a2b.3 — PLAUSIBLE — low

- **Where:** `apps/mobile/src/mascot/mascot.tsx:242-253`, `:213-223`
- **Defect:** `GameBadgeToast` starts its timer only once `game.status === 'answered' && game.banner` is false. If the reader leaves the Game while the answer banner shows and the game state keeps that answered state, the toast never times out and `earnedBadge` stays `'toast'`.
- **Consequence:** the toast never shows, and because the toast branch returns before `shown`, every later Daily Goal / Streak milestone celebration in that run is hidden behind the pending toast (a later Badge replaces it).
- **Fix:** also start the timer when the route leaves the Game (`inGame(route)` false), or drop the toast on leaving.

## a2b.4 — CONFIRMED (traced) — low

- **Where:** `apps/mobile/src/mascot/mascot.tsx:161-223`
- **Defect:** the New Level screen, a stamp or a pending toast each return before the `shown` overlay, but `celebrate()` still runs its 4 s timer.
- **Consequence:** the Daily Goal or Streak milestone met while a stamp or the New Level screen is open (common: the XP that reaches a Level often also makes the Active Day / meets the goal) is never seen; its timer runs out under the stamp.
- **Fix:** queue the moment until the blocking screen closes, or render the overlay beneath it.

## a2b.5 — CONFIRMED (traced) — low

- **Where:** `apps/mobile/src/mix/mix-choices.tsx:347-358`
- **Defect:** `KindRow.onSelect` chooses between `setKindWeight` and `setKind(kind, true, weight)` by `on`, the Mix's value, not the choice shown at once (`selected`). Changes run in turn (`createInTurn`, `packages/core/src/entries/mix.ts:636`).
- **Consequence:** kind in the Mix, the reader taps «Вимк» then quickly «Більше»: the second tap still sees `on === true` and sends `setKindWeight`, which keeps the kind out. The row shows «Більше» until both land, then flips back to «Вимк»: the last choice is lost.
- **Fix:** decide from the shown value: `selected === 'off' ? setKind(kind, true, chosen) : setKindWeight(kind, chosen)`, or always `setKind(kind, true, chosen)` for a weight.

## a2b.6 — CONFIRMED (code) — low (a11y)

- **Where:** `apps/mobile/src/mix/mix-choices.tsx:558-574`
- **Defect:** the group's «усі» / «зняти» `Pressable` has no `minHeight: minTouchTarget` and no `hitSlop`; its only content is one `headerAction` line of text. `docs/react-native.md` (Accessibility) asks for at least `minTouchTarget`.
- **Consequence:** a tap area well under 44 pt, easy to miss beside the group name.
- **Fix:** `hitSlop` or `minHeight: minTouchTarget` with centred text.

## a2b.7 — PLAUSIBLE — low (test gap)

- **Where:** `apps/mobile/src/spotlight/spotlight-results.test.tsx:121`, `:135`; `spotlight-index.ts:139,145`
- **Defect:** the index writes every item's route as `…?edition=uk` (ADR 0065), but the tap tests send the snapshot's bare route (`slovo-uk://entry/w_sumyrnyi`), never the route the native module actually indexes.
- **Consequence:** a break in how `createOutsideLinks` handles the `edition` query on a Spotlight route would pass CI.
- **Fix:** build the tapped route through `createSpotlightIndex` (fake native module) and tap the item's `route`.

## a2b.8 — PLAUSIBLE — low (a11y)

- **Where:** `apps/mobile/src/mix/my-mix-screen.tsx:42-48`
- **Defect:** `mix-selected` («12 з 16») is a bare `Text` with no `accessibilityLabel`.
- **Consequence:** VoiceOver reads «12 з 16» with no subject after the title.
- **Fix:** an `accessibilityLabel` from the Edition's strings naming the Categories in the Mix, or merge it into the header's label.

## Checked, no finding

- `spotlight-hand-over.ts`: hand-overs serialised, reopen follows the new composition, stop guards both paths.
- `badge-opening.tsx`: `badges.open` is a no-op for a non-new Badge (`badges.ts:219`), so stamping with the sheet switch off writes nothing twice.
- `hiding.ts` / `hide-choice.ts`: second tap guard, `last-category` unchoosable, toast only on a change.
- `hidden.ts` / `hidden-screen.ts`, `mix.ts`, `mix-screen.ts`, `rarity-range.ts`, `rarity-test.ts`, routes `app/mix/*`, `app/settings/mix.tsx`.
- Group «зняти» covering every Category in the Mix: the Core keeps the last one (`mix.ts:607`), and the optimistic view returns once the change lands.

## Files not finished

Read in full: every source file in scope, and `mascot.test.tsx`, `spotlight-*.test.*`, `hidden.test.tsx`, `mix.test.tsx`, `rarity.test.tsx`. Checked only by their test names and assertions skimmed, not line by line: `mix-choices.test.tsx`, `hide-choice.test.ts`, `hidden-screen.test.ts`, `mix-screen.test.ts`, `hidden-correction-categories.test.tsx`, `rows-and-tips.test.tsx`.
