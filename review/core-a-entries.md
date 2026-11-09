# Review: packages/core/src/entries/ (commit bf792f89)

Scope: 33 files under `packages/core/src/entries/`. I read every source file in full and checked the tests for weak assertions with grep.
Skipped, because spec #1586 already plans them: Eligible Entries derived twice (the live Mix / Rarity Ceiling / Hidden vs. Entries reading storage), and the Entry card's actions once. That covers the stale in-memory `state` of `openMix` and `openRarityCeiling` after a sync pull, so neither appears below.

Nothing found for: React or React Native imports (none), `!` non-null assertions (none), `@ts-expect-error` (none), outside data read without parsing (user-state records go through `declareRecords(..., InstantSchema)` / `RaritySchema`, and Language Pack data comes through `ContentReadPort`).

Counts: high 0, medium 3, low 12.

---

## High

None found.

---

## Medium

### M1. A Correction with no standard equivalent can still be expressed in the types, and two modules handle it in two different ways
- `packages/contracts/src/correction.ts:72-75` (`z.array(TextSchema).min(1)` infers `string[]`, not a non-empty tuple)
- `packages/core/src/entries/correction-card.ts:50-54` throws on an empty list.
- `packages/core/src/entries/entry-row.ts:124-125` silently falls back to `nonStandardForm`.
- **What is wrong:** the schema rejects an empty list at runtime, but the inferred type allows one. Each consumer then guards against a state the contracts exclude, and the two guards disagree: one throws, one shows the wrong form as the title.
- **Failure scenario:** a test fixture, a migration or a future non-zod path builds a `Correction` with `standardEquivalents: []`. Its row in Favorites/History then shows the non-standard form as the title, which is the opposite of what the row promises. Opening the same Entry throws inside `buildCorrectionCard`. So the same bad data looks fine in a list and crashes on the card.
- **Fix:** make the schema `z.tuple([TextSchema]).rest(TextSchema)`, or use `.nonempty()`, which infers `[string, ...string[]]`. Then delete both guards and destructure `[mainEquivalent, ...otherEquivalents]` / `[title]` directly.
- **Confidence:** confirmed (on types; at runtime the parser stops it today).

### M2. The Rarity Ceiling tells its subscribers before eligibility is read again, the opposite order from the Mix
- `packages/core/src/entries/rarity-ceiling.ts:79-82` (`state = …; subscribers.tell(); await eligibility.publish();`)
- Compare `packages/core/src/entries/mix.ts:413-419`, which publishes eligibility first and tells subscribers in `finally`, "so a subscriber told of the new state finds it read again".
- **What is wrong:** a subscriber of the ceiling runs while the Cycle and Feed still hold the old eligible Entries. Today that is `useRarityCeiling` (`apps/mobile/src/mix/rarity-ceiling.ts:13`). Any Core subscriber added later would read stale eligibility. `feed.ts:568` reads `rarityCeiling.state` while `eligibility` is still being republished.
- **Failure scenario:** the user moves «Рідкість» from «до 5» to «до 2». Settings re-renders «до 2» at once, while the Feed card in view (rarity 4) stays until `eligibility.publish()` finishes. If `publish` rejects, the UI already says «до 2» and the Cycle never re-read. Two settings screens that behave alike also order their updates differently.
- **Fix:** match the Mix: write, then `try { await eligibility.publish() } finally { state = …; subscribers.tell() }`. Add a test like the Mix's that checks the Feed has no Word above the new ceiling from inside the subscriber callback.
- **Confidence:** confirmed (the order); plausible (that the user can see it).

### M3. Word card links ignore Hidden Entries and Hidden Categories of Corrections, while they do follow the Mix for the kind as a whole
- `packages/core/src/entries/entries.ts:441-452` (`linkedCorrections`)
- `packages/core/src/entries/entries.ts:453-460` (`linkingSynonymRow`)
- **What is wrong:** `linkedCorrections` drops every Correction when Corrections as a whole are out of the Mix (ADR 0051: "as a link to a Correction follows Corrections in the Mix"). It still links a Correction the user Hid, and one whose Category of Corrections is out of the Mix, which is a Hidden Category per CONTEXT.md. `linkingSynonymRow` likewise drops the back-link when Synonym Rows are out of the Mix, but it still shows a Synonym Row the user Hid. It also takes only `[first]`: if that first row is Hidden, it does not fall through to the next one.
- **Failure scenario:** the user hides the Correction «c_chatty» from its card. The Word card for «балакучий» still shows «c_chatty» in its linked-Corrections block and opens it on tap. So an Entry the user disliked keeps coming back on every visit to that Word.
- **Fix:** ask the owner which rule is intended, then apply it once. If the links should follow the same rules as the Mix, filter both by `hiddenIds()`, filter `linkedCorrections` by `mix.correctionCategories.categoryIds`, and in `linkingSynonymRow` take the first row id that is not Hidden. If links should ignore Hidden, say so in the `Entries` doc comments and in ADR 0051.
- **Confidence:** plausible (no ADR or glossary line decides Hidden + links; the inconsistency with the Mix rule is confirmed).

---

## Low

### L1. `as` casts
- `entry-kinds.ts:91` `Object.keys(ENTRY_KINDS) as EntryKind[]`. Fix: a literal `const ALL_KINDS = ['word','correction','idiom','synonymRow','tip'] as const satisfies readonly EntryKind[]`, plus an exhaustiveness check, e.g. `Record<EntryKind, true>`. Or derive it from `tableOfKinds`.
- `mix.ts:175` and `mix.ts:180` `Object.fromEntries(...) as Record<…>` in `eachKind` / `eachList`. Fix: write the records out by hand as `tableOfKinds` does (4 and 2 keys), so no cast is needed.
- `entries.ts:420` `eligibleOfKind as Entries['eligibleOfKind']`. A comment justifies it. You can drop it by moving to an overload or a generic implementation over `Extract<…>`.
- `entry-list.ts:74` `({ … [timeKey]: at }) as ListedEntry<TimeKey>`. A comment justifies it, and a computed key limits the options; acceptable.
- **Confidence:** confirmed.

### L2. Dead or never-imported exports
These are exported, but nothing outside their own file imports them, either in the workspace or via `index.ts`:
- `DEFAULT_QUICK_QUESTION_EVERY` (`mix.ts:58`): a value export.
- `CategoryLists`, `KindsInMix` (`mix.ts`).
- `EntryKindTraits` (`entry-kinds.ts:45`).
- `EntryLabelKey` (`entry-row.ts:17`).
- `LinkedCorrection`, `WordCardSynonymRow`, `WordCardDetails` (`word-card.ts`).
- `ListedEntry` (`entry-list.ts:14`).
- `ConcealedSynonymRowCardModel`, `ConcealedTipCardModel`, `SelfCheckCardModel` (`self-check.ts`). `selfCheck*Card` returns these, but `index.ts` does not export them, so the UI cannot name them.

`readRarityCeiling`, `ParsedEntryLink` and `CategoriesInMix` are referenced only by `packages/core/src/index.ts` and by nothing beyond it.
- **Fix:** drop `export` from the internal ones. Either export the self-check types from `index.ts` or keep them local. Drop `readRarityCeiling` from `index.ts` if no app uses it.
- **Confidence:** confirmed (by `git grep -lw`).

### L3. Orphaned doc comment in mix.ts
- `mix.ts:56-58`: "One list of Categories in the Mix…" sits above `DEFAULT_QUICK_QUESTION_EVERY`, which has its own comment, and `CategoriesInMix` (line 60) is left with none. Tooling attaches the wrong JSDoc.
- **Fix:** move the comment down to line 60.
- **Confidence:** confirmed.

### L4. The highest rarity is written as a literal `5` in three places
- `entries.ts:308` (`Promise.resolve<Rarity>(5)`), `entries.ts:322` (`ceiling >= 5`), and `rarity-ceiling.ts:12` (`HIGHEST`).
- **Failure scenario:** if the rarity scale ever changes, `underRarityCeiling` would skip filtering at the wrong ceiling.
- **Fix:** export `HIGHEST` (or derive it from `RaritySchema`) and use it in `entries.ts`.
- **Confidence:** confirmed.

### L5. `illustrations` is optional on the Entries' Edition only so tests can leave it out
- `entries.ts:212` `Partial<Pick<Edition, 'illustrations'>>`.
- **Failure scenario:** a production caller that builds its Edition by hand, or a later refactor of `language-pack.tsx:102`, forgets `illustrations`. Every Word then silently shows no Illustration, and the compiler says nothing.
- **Fix:** require it, and give test helpers `illustrations: new Set()`.
- **Confidence:** plausible.

### L6. One concept typed two ways: `gender?: Gender` in EntryRowModel vs `gender: Gender | undefined` in WordCardModel
- `entry-row.ts:60` vs `word-card.ts:50`. Because of it, `entry-row.ts:99` needs a conditional spread.
- **Fix:** use `Gender | undefined` in both.
- **Confidence:** confirmed.

### L7. Wrong doc on WordCardDetails
- `word-card.ts:24` says "Each list holds at least one item when present", but `detailsOf` (`:137-142`) returns `details` with `extraDefinitions: []` and `examples: []` when only `etymology` is set.
- **Fix:** correct the comment.
- **Confidence:** confirmed.

### L8. Changing a Mix kind weight republishes eligibility, though no eligible Entry changes
- `mix.ts:385-394`: the weight writes are added before `eligibilityChanged = writes.size > 0` is computed. Only the Quick Question is kept out.
- **Failure scenario:** each «Менше/Більше» tap makes the Cycle read eligibility again. If that is only how the Feed picks up the new turns, it costs a needless re-read. If not, the comment on line 392 ("changes nothing eligible") should cover weights too.
- **Fix:** confirm the intent. If the Feed needs only `mix.subscribe`, exclude weight writes as the Quick Question's are.
- **Confidence:** plausible.

### L9. `parseLink` keeps a `#fragment` in the Entry id
- `entry-links.ts:27` and `:45`: the `/^\/entry\/([^/]+)$/` match runs on the part before `?` only, so `/entry/w_1#top` gives `entryId: 'w_1#top'`, and `/entry/w_1?from=widget#x` gives `key` with `#x` appended.
- **Failure scenario:** a universal link shared with a fragment opens «not found», and a widget link with a fragment loses its widget source.
- **Fix:** strip `#…` before splitting.
- **Confidence:** plausible (depends on whether `routeOf` in `apps/mobile/src/entries/entry-link.ts` already strips it).

### L10. Weak test: passes when the back-link is missing entirely
- `word-card.test.ts:262-273`: `expect(card.synonymRow?.dominant.wordId).toBeUndefined()` also passes when `card.synonymRow` is `undefined`, i.e. when the code drops the whole back-link.
- **Fix:** assert `card.synonymRow` toEqual `{ synonymRowId: 'r_bezlad', dominant: { text: 'безла́д', stressedVowels: ['а'], wordId: undefined } }`.
- **Confidence:** confirmed.

### L11. Weak test: passes with no members
- `synonym-row-card.test.ts:137-143`: `expect(card.members[0]?.wordId).toBeUndefined()` also passes if `members` is empty.
- **Fix:** assert `card.members[0]` toMatchObject `{ text: 'простува́ти', wordId: undefined }`.
- **Confidence:** confirmed.

### L12. Weak test: `toBeDefined` on a Feed card
- `mix.test.ts:615` and `:657`: `expect(app.feed.cards[app.feed.position + 1]).toBeDefined()` would accept an end-of-cycle card or any card at all. Both tests have stronger assertions around this one, so it is minor.
- **Fix:** assert the kind or that it is not of the Hidden Category.
- **Confidence:** confirmed.

The other negative-only tests (`entries.test.ts:390/396/464/510`, `correction-card.test.ts:65`, `word-card.test.ts:137/275-304/322`, `rarity-ceiling.test.ts:206`, `mix.test.ts:515/796`, `entry-links.test.ts:33`) each have a positive counterpart in the same file, so they are fine.
