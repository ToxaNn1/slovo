# Core review A: packages/core/src/feed/ + feed-notice.ts + fetch-types.d.ts

Commit bf792f89. Read-only review. Skipped the items already planned in spec #1586 / PR #1640.
Counts: high 1, medium 3, low 10.

No React/React Native imports. No `as`, `!` or `@ts-expect-error` in the source files (only two `as` casts in feed.test.ts, at :221 and :1242).

## High

### H1. A new day starts a new Cycle while Synonym Rows or Tips are still unseen
- **Where:** packages/core/src/feed/word-of-the-day.ts:138 (and the doc at :42-47)
- **What is wrong:** `today()` only goes on with the Cycle (taking a Seen Word) when `unseen.corrections.length + unseen.idioms.length > 0`. It ignores `unseen.synonymRows` and `unseen.tips`. When every Word, Correction and Idiom is Seen but a Synonym Row or Tip is not, `next` stays undefined, `cycle.start()` runs and every Seen record is cleared. This breaks ADR 0016 ("the Cycle ends only when every eligible Entry in it is Seen"), ADR 0051 (kinds four and five are Seen like any Entry) and the glossary's **Cycle** entry. The Feed's own end-of-Cycle check (feed.ts `unseenLeft`) counts all five kinds, so the two modules disagree.
- **Failure scenario:** An Edition with 40 Words and 8 Tips. The reader has Seen every Word, Correction and Idiom, but 3 Tips are left (Tips come only every 11th card). The next local day opens with a new Cycle and a new shuffle. Those 3 Tips were never Seen and their progress is gone. The end-of-Cycle card never shows.
- **Fix:** Use the same "any kind unseen" test as the Feed. Best is one helper on `Cycle` (e.g. `cycle.hasUnseen()`), so the two can't drift again: `if (next === undefined && hasUnseenOtherThanWords(unseen))`. Update the doc comment too. Add a test with only Tips/Synonym Rows unseen (word-of-the-day.test.ts:37 and :186 always pass `synonymRows: [], tips: []`).
- **Confidence:** confirmed (code + ADR 0016 text + glossary).

## Medium

### M1. A linked Correction that is Hidden, or whose Category is out of the Mix, can be opened into the Feed and become Seen
- **Where:** packages/core/src/feed/feed.ts:614-616 (`insertLinkedCorrection`). The source is packages/core/src/entries/entries.ts:441-451 (`linkedCorrections` filters only `retired`).
- **What is wrong:** `insertLinkedCorrection` checks that the Word card links the Correction and that it is a Correction. It never checks `cycle.covers(correctionId)`. The Word card's `linkedCorrections` drops Retired Corrections only; `refreshLinkedCorrections` rebuilds only when `linksCorrections()` flips (the whole kind in or out of the Mix). A single Hidden Correction, or one in a Hidden Category, stays linked.
- **Failure scenario:** The reader hides Correction C from its card. Later, on a Word card that links C, they tap «often said». C's card goes into the Feed. They stay on it for at least 500 ms. `seenOnLeaving` → `keepSeen` → `cycle.markSeen(C)` + `history.record`, so a Hidden Entry appears in the Feed and joins History. The glossary says a Hidden Entry "never appears in the Feed". day-change/openFeed docs also promise "a Hidden Entry never re-enters History".
- **Fix:** In `insertLinkedCorrection`, return undefined unless `cycle.covers(correctionId)`. Better, filter Hidden and Hidden-Category Corrections in `entries.linkedCorrections` so the link is not shown at all. Also let `keepSeen` refuse an Entry the Cycle doesn't cover, as `markOpenedSeen` already does.
- **Confidence:** plausible-to-confirmed. The code path is clear; whether the shell's own check hides the link was not verified.

### M2. One Cycle Entry missing from the Language Pack stops the Feed for good
- **Where:** packages/core/src/feed/feed.ts:532-535
- **What is wrong:** When `nextEntryId` picks an id and `buildFeedCard` returns undefined, `addNextCard` returns undefined. `Feed.next()` documents undefined as "the Language Pack has no live Entry", and `keepNextCardReady` stops its loop. The next request picks the same id again (it is still unseen and first in the Cycle order), so the Feed never moves on.
- **Failure scenario:** A content update or a partial pack where `entries.eligible()` (ids) and `entries.get()` / `getSynonymRowOrTip()` disagree for one id, e.g. a Synonym Row listed but not readable. The Feed shows its current card and nothing after it, for the whole Cycle.
- **Fix:** Skip the id and pick again (or treat it as not covered and call `cycle.readEligibleAgain()`). At the least, don't use the same undefined that means "no live Entry".
- **Confidence:** plausible (needs an id/entry mismatch in the pack).

### M3. The Community Word comes from the network unparsed and goes into storage
- **Where:** packages/core/src/feed/community-word.ts:48-51. The cause is packages/contracts/src/api.ts:103-116 (the client has no response validation).
- **What is wrong:** `answer.output.communityWord` is written to `feed.communityWord` as is. The oRPC client is built without a response-validation plugin, so the contract's output schema is never applied on the client. This breaks the "parse outside data once, where it enters" rule.
- **Failure scenario:** A backend bug or proxy answers `{ communityWord: { entryId: 42 } }`. The write keeps it. On read the record fails its zod schema, so `ofDay` treats the day as not read and calls the backend on every card. Before that, the bad `adds` reaches the card as is.
- **Fix:** Parse the answer with the contract's output schema in `answerOf` (or add oRPC's response validation to `createApiClient`). Treat a parse failure as `unexpected`.
- **Confidence:** plausible (cross-cutting; confirm with the contracts reviewer).

## Low

### L1. An earlier-day report is taken as a new day (time zone moved west)
- **Where:** packages/core/src/feed/day-change.ts:101 (`newDay = today !== turnedTo`). This reaches feed.ts `openDay` and word-of-the-day.ts `today()`.
- **What is wrong:** Any different key counts as a new day, an earlier one too.
- **Failure scenario:** The reader flies from Kyiv to New York with the app open just after midnight. The day turns "back" to yesterday. The Feed opens that day again, and `today()` sees no record for it and picks a fresh Word of the Day, overwriting today's record. Flying back picks yet another Word. The archive and Yesterday can show two Words for one day.
- **Fix:** Turn only forward (`today > turnedTo`). Or keep the chosen Word per date so going back reuses it.
- **Confidence:** plausible.

### L2. Dwell time uses the wall clock
- **Where:** packages/core/src/feed/feed.ts (show: `now - onScreenSince`; followCovered: `stayed: now - since`)
- **What is wrong:** A manual clock change or an NTP jump while a card is on screen makes `stayed` negative or huge.
- **Failure scenario:** A wrong Seen, or a missed one.
- **Fix:** Add a monotonic clock to the `Clock` port for dwell timing.
- **Confidence:** plausible.

### L3. `dayBefore` is today's no-longer-eligible Word, not the day before's
- **Where:** packages/core/src/feed/word-of-the-day.ts:134
- **What is wrong:** When today's record exists but `kept()` rejects it (Retired or Hidden since), `record.entryId` is today's rejected Word.
- **Failure scenario:** Yesterday's Word can be chosen again as today's.
- **Fix:** Keep the previous day's id apart from today's record.
- **Confidence:** plausible.

### L4. `shownIds(except)` filters before slicing at `cycleStart`
- **Where:** packages/core/src/feed/feed-session.ts:131-132
- **What is wrong:** Removing `except` shifts the indices, so if `except` sits before `cycleStart`, the slice drops the current Cycle's first card from the set.
- **Failure scenario:** Today's callers always pass a card of the current Cycle, so this is latent. A future caller would let the Word of the Day repeat the Cycle's first Entry.
- **Fix:** `session.slice(cycleStart).filter((card) => card !== except)`.
- **Confidence:** confirmed (latent).

### L5. Rarities of non-Words are read again for every card
- **Where:** packages/core/src/feed/feed.ts:547-555
- **What is wrong:** Ids that `getMany` doesn't return as a Word are never cached, so every card with a Mood band asks for them again.
- **Failure scenario:** Wasted reads only.
- **Fix:** Cache a miss too.
- **Confidence:** confirmed (performance only).

### L6. Every rule and source runs on every next card
- **Where:** packages/core/src/feed/feed-notices.ts:260-277
- **What is wrong:** `nextFor` runs every rule each time: `enoughForToday` walks all of History with Intl formatting per entry, `yesterday` builds a Word card, and the Community Word calls the backend on every card while offline.
- **Failure scenario:** Slow next-card preparation once History grows; repeated network calls offline.
- **Fix:** Run the rules lazily in `FEED_NOTICES` order and stop at the first hit. Back off the Community Word retry.
- **Confidence:** confirmed (performance).

### L7. Orphaned and stale doc comments
- **Where:** packages/core/src/feed/feed.ts:543-546 and :229-231, :327-330
- **What is wrong:** The JSDoc "Adds a Quick Question when it is its turn" sits above `rarities`, with its own doc comment stacked under it; `addQuickQuestion` at :576 has none. The docs at :229-231 and :327-330 name `CORRECTION_EVERY`, `IDIOM_EVERY`, `SYNONYM_ROW_EVERY` and `TIP_EVERY`, which no longer exist in feed.ts (the code uses `TURNS` / `ENTRY_KINDS[kind].feedTurn`).
- **Failure scenario:** Misleading docs only.
- **Fix:** Move the comment down to `addQuickQuestion` and name `TURNS`/`SPACING` in the docs.
- **Confidence:** confirmed.

### L8. Exports used nowhere else
- **Where:** day-change.ts `DaySubjects`, reserved-words.ts `ReservedWords`, feed-card.ts `QuickQuestionCard` and the re-export of `CorrectionFeedCard`, feed-notices.ts `FeedNoticeQueue`; cycle.ts `CycleChange` is used only by cycle.test.ts.
- **What is wrong:** `git grep` outside the feed folder finds no use.
- **Failure scenario:** None at runtime; extra public surface.
- **Fix:** Un-export them, or keep them only if index.ts means to publish them.
- **Confidence:** confirmed (they are types, so the cost is small).

### L9. Stored dates are `z.string()`, not a `YYYY-MM-DD` shape
- **Where:** packages/core/src/feed/records.ts:7, :26-29, :48, :57
- **What is wrong:** Stored data is parsed loosely; `parseLocalDate` would turn garbage into `{0,0,0}`. Today they are only compared for equality, so the harm is low.
- **Failure scenario:** A malformed stored date silently becomes an invalid day if a future caller parses it.
- **Fix:** Use a shared `LocalDateKeySchema` regex at the entry point.
- **Confidence:** confirmed (low impact).

### L10. Tests that would pass if the feature returned nothing
- **Where:**
  - community-word.test.ts:171 "is gone for the day once swiped past"
  - weekly-recap.test.ts:163 "comes on the first open of Monday and, swiped past, never again"
  - feed.test.ts:1177 "marks the opened Correction Seen" (uses `opened ?? -1`, then `not.toContain`)
  - feed.test.ts:341 (`not.toContain` only)
- **What is wrong:** These assert only that something is absent, with no check first that the notice or card was there.
- **Failure scenario:** If the notice is never produced, or `openLinkedCorrection` returns undefined, the tests stay green. yesterday.test.ts:135 does this right: it asserts `toBeDefined()` first.
- **Fix:** Assert that the notice is present before the swipe, and `expect(opened).toBe(position + 1)`.
- **Confidence:** confirmed.

The rest look fine: feed-notice.ts, fetch-types.d.ts, gestures-hint.ts, cycle.ts (the concurrent reads are ordered correctly) and reserved-words.ts.
