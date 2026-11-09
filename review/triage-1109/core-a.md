# Triage: core-a review (Medium + Low) against main bd94d6b2

Sources: core-a.md (C-), core-a-entries.md (E-), core-a-feed.md (F-). Paths under packages/core/src unless named.
Out of scope but still open in main: F-H1 (`feed/word-of-the-day.ts:141` counts only Corrections + Idioms) — T-feed-3 shares that file; land H1 first or together.

| id | class | reason |
|---|---|---|
| C-M1 | SKIP-OWNER | untold sign-out tokens still in memory (`account.ts:226`); fix is persist a device-only record vs a short server TTL in ADR 0037 — owner picks |
| C-M2 | SKIP-OWNER | `backend.ts:32` any non-ORPCError -> offline; reviewer: design choice, change or document in ADR 0064 |
| C-M3 | SKIP-OWNER | main scenario moot: server-core `community-counters.ts:135` answers zeros for every asked id; only "hold back after a failed batch" left, a retry-policy choice (ADR 0060/0037) |
| C-L1 | FIX | `account.ts:300` `as Exclude<A, Unauthorized>` still there; `unauthorized` (`:160`) is no type predicate |
| C-L2 | FIX | `AccountState` (`account.ts:76-77`) `inFlight`/`problem` cross-product over status still representable |
| C-L3 | FIX | `in-turn.ts:49` comparator returns 1 for equal keys |
| C-L4 | SKIP-OWNER | `schedule: Schedule \| undefined` comes from optional `schedule` on the composition ports (`composition.ts:292,396`); fixing ripples into every test app, scope decision |
| C-L5 | FIX | `counter-deltas.ts:188` still `continue`s on an out-of-range rest, record kept and re-sent |
| C-L6 | SKIP-OWNER | reads bypass `withRetries`; "possibly intentional", owner states intent (doc or ADR 0064) |
| C-L7 | FIX | `dashboard/correction-types.ts:88` listener runs two reads per Seen and its rejection is unhandled |
| C-L8 | FIX | `dashboard/curated-collections.ts:149-152` `refresh` has no started/mine guard |
| C-L9 | SKIP-OWNER | not a defect: the Word of the Day is kept only while `cycle.covers` it (`feed/word-of-the-day.ts:98`), so the hero's Word is covered |
| C-L10 | FIX | `content-update.ts:136-146` forgets a broken kept pack but keeps `lastCheck`, next check up to 24 h away |
| C-L11 | SKIP-OWNER | reviewer: not a defect (consent default per ADR 0060/0068); helper optional |
| C-L12 | FIX | `edition/edition.test.ts:775,844,851,894` assert only `not.toThrow()` |
| E-M1 | FIX | `contracts/src/correction.ts:72-75` `.min(1)` infers `string[]`; `correction-card.ts:52` throws, `entry-row.ts:125` falls back |
| E-M2 | FIX | `rarity-ceiling.ts:66-68` tells subscribers before `eligibility.publish()`; Mix does the reverse (`mix.ts:577-580`) |
| E-M3 | FIXED | 6de3dee8 (#1749): links skip Hidden and out-of-Mix Corrections, first non-Hidden Synonym Row (owner decision 6) |
| E-L1 | FIX | `entry-kinds.ts:91` and `mix.ts:268,273` casts remain; `entries.ts:423`, `entry-list.ts:75` are comment-justified, leave |
| E-L2 | FIX | unused exports confirmed by git grep (all listed except `readRarityCeiling`, already gone) |
| E-L3 | FIX | `mix.ts:56` doc comment still above `DEFAULT_QUICK_QUESTION_EVERY`, `CategoriesInMix` (`:60`) has none |
| E-L4 | FIXED | `HIGHEST_RARITY` exported and used in `entries.ts:205,323` |
| E-L5 | FIX | `entries.ts:231` `Partial<Pick<Edition,'illustrations'>>` still optional |
| E-L6 | FIX | `entry-row.ts:60` `gender?:` vs `word-card.ts:50` `gender: Gender \| undefined`; conditional spread at `entry-row.ts:99` |
| E-L7 | FIX | `word-card.ts:24` doc still says each list holds an item when present |
| E-L8 | SKIP-OWNER | not a defect: the Feed takes new kind weights only through eligibility (`feed.ts:416,820`), so the republish is needed |
| E-L9 | FIX | `entry-links.ts:44` `parseLink` splits on `?` only; `#fragment` stays in id/key |
| E-L10 | FIX | `word-card.test.ts:273` passes with no back-link |
| E-L11 | FIX | `synonym-row-card.test.ts:143` passes with no members |
| E-L12 | FIX | `mix.test.ts:615,657` `toBeDefined` on next card |
| F-M1 | FIXED | 6de3dee8: `openLinkedCorrection` refuses an Entry the Cycle doesn't cover (`feed.ts:507`), links obey Hidden |
| F-M2 | FIX | `feed.ts:428-429` `buildFeedCard` undefined -> `addNextCard` undefined, same id picked again |
| F-M3 | FIX | `community-word.ts:49-51` writes `answer.output` unparsed; `contracts/src/api.ts:105` client has no response validation |
| F-L1 | SKIP-OWNER | `day-change.ts:101` any other key is a new day; turn-forward-only vs per-date Word is a behaviour choice |
| F-L2 | SKIP-OWNER | dwell on wall clock (`feed.ts:692,779`); fix adds a monotonic clock to the `Clock` port + shell adapter, a port decision |
| F-L3 | FIX | `word-of-the-day.ts:137` `dayBefore = record?.entryId` is today's rejected Word when `kept()` fails |
| F-L4 | FIX | `feed-session.ts:131-132` filters before slicing at `cycleStart` (latent) |
| F-L5 | SKIP-OWNER | perf only; `raritiesOf` gets Word ids, a miss needs a pack mismatch (F-M2's case); not provable through a public seam |
| F-L6 | SKIP-OWNER | perf; lazy rule order + Community Word back-off period is a design choice, no defect to prove |
| F-L7 | FIX | stale `*_EVERY` names already gone; orphaned "Adds a Quick Question" doc still at `feed.ts:436-439` above `rarities` |
| F-L8 | FIX | `DaySubjects`, `ReservedWords`, `QuickQuestionCard`, `CycleChange` unused outside; `FeedNoticeQueue` is used by `feed.ts` (keep), `CorrectionFeedCard` re-export in `feed-card.ts` only |
| F-L9 | FIX | `feed/records.ts:7,28,59` dates are `z.string()` |
| F-L10 | FIX | `community-word.test.ts:171`, `weekly-recap.test.ts:163`, `feed.test.ts:1178` (`opened ?? -1`), `feed.test.ts` near 341 assert absence only |

Counts: FIX 28, FIXED 3, SKIP-OWNER 12, SKIP-VISUAL 0, SKIP-PATH 0.

## Tickets

### T-account-1: Account answers narrow by type and Account states carry only their own problem
- findings: C-L1, C-L2
- files: `account/account.ts`, `account/account.test.ts`, consumers of `AccountState` in `apps/mobile/src` (grep `inFlight`/`problem`)
- fix: `unauthorized(answer): answer is Unauthorized` and drop the `as`; make `AccountState` a union whose members carry their own `inFlight`/`problem` (e.g. `code-sent` carries `wrong-code | code-expired`).
- proving test: typecheck (no `as`, impossible states fail to compile); existing account tests stay green; add one asserting a signed-in state shows no problem after a refused code flow if not covered.

### T-core-1: Comparator, unsent counters, content-update check and Edition schema tests
- findings: C-L3, C-L5, C-L10, C-L12
- files: `in-turn.ts` (+ its test or `in-turn.test.ts`), `community-counters/counter-deltas.ts` (+ test), `content-update/content-update.ts` (+ test), `edition/edition.test.ts`
- fix: comparator returns 0 on equal keys; on out-of-range rest delete the `counters.unsent.` record; on a kept pack that fails to open also clear `lastCheck`; schema tests assert the loaded field.
- proving tests: `newestFirst` gives 0 for equal items; an out-of-range unsent record is gone after sending and the next batch sends nothing; after a failed `openKept` `checkForUpdate` downloads at once; `loadEdition(...).originLanguages` toEqual `[]` etc.

### T-dashboard-1: Correction Types listener and Curated Collections refresh
- findings: C-L7, C-L8
- files: `dashboard/correction-types.ts`, `dashboard/curated-collections.ts` (+ their tests)
- fix: listener skips non-Corrections before the two reads and catches its rejection (`void …catch`); `refresh` gets the `started`/`mine` counter of `dashboard.ts:224-233`.
- proving tests: a userState read that rejects in the Seen listener raises no unhandled rejection; an older slow rail resolving after a newer one leaves the newer rail.

### T-entries-1: A Correction always has a standard equivalent; Word card model tidy
- findings: E-M1, E-L6, E-L7, E-L10, E-L2 (word-card.ts / entry-row.ts part: `LinkedCorrection`, `WordCardSynonymRow`, `WordCardDetails`, `EntryLabelKey`)
- files: `packages/contracts/src/correction.ts`, `entries/correction-card.ts`, `entries/entry-row.ts`, `entries/word-card.ts`, `entries/word-card.test.ts`
- fix: `standardEquivalents` `.nonempty()` (infers `[string, ...string[]]`), delete both guards and destructure; `gender: Gender | undefined` in the row, drop the spread; correct the WordCardDetails doc; un-export the internal types.
- proving test: typecheck across the workspace (stop and report if the tuple type ripples into `packages/content-rules` or `apps/admin`); `word-card.test.ts:273` asserts the whole `synonymRow` object.

### T-entries-2: No casts in the kind tables; unused exports and orphaned doc in the Mix
- findings: E-L1 (entry-kinds.ts, mix.ts), E-L2 (rest), E-L3, E-L11, E-L12
- files: `entries/entry-kinds.ts`, `entries/mix.ts`, `entries/self-check.ts`, `entries/entry-list.ts`, `index.ts`, `entries/synonym-row-card.test.ts`, `entries/mix.test.ts`
- fix: `ALL_KINDS` as a literal `satisfies` list with an exhaustiveness check; write `eachKind`/`eachList` records out by hand; drop `export` from unused types (or export self-check models from `index.ts`); move the doc to `CategoriesInMix`; strengthen the two weak tests.
- proving test: typecheck + lint; `card.members[0]` toMatchObject `{ text: 'простува́ти', wordId: undefined }`; mix tests assert the next card's kind / not of the Hidden Category.

### T-entries-3: Ceiling tells after eligibility; Illustrations required; links drop a fragment
- findings: E-M2, E-L5, E-L9
- files: `entries/rarity-ceiling.ts`, `entries/rarity-ceiling.test.ts`, `entries/entries.ts` (+ test helpers that build the Entries' Edition), `entries/entry-links.ts`, `entries/entry-links.test.ts`
- fix: `try { await eligibility.publish() } finally { state = …; tell() }` as the Mix; `illustrations` required, tests pass `new Set()`; strip `#…` before splitting in `parseLink`.
- proving tests: from inside a ceiling subscriber the Feed has no Word above the new ceiling (mirror the Mix test); `parseLink('/entry/w_1#top')?.entryId === 'w_1'`, widget key keeps no `#x`; typecheck for illustrations.

### T-feed-1: The Feed moves past an Entry missing from the Language Pack
- findings: F-M2, F-L4, F-L7, F-L10 (feed.test.ts and weekly-recap.test.ts parts)
- files: `feed/feed.ts`, `feed/feed-session.ts`, `feed/feed.test.ts`, `feed/weekly-recap.test.ts`
- fix: when `buildFeedCard` gives nothing, skip the id (treat it as not covered and pick again) instead of returning the "no live Entry" undefined; `shownIds` slices then filters; move the orphaned doc to `addQuickQuestion`.
- proving tests: an eligible id `entries.get` cannot read -> `feed.next()` returns the next Entry's card; `expect(opened).toBe(position + 1)` before the Seen check; recap/`not.toContain` tests assert presence first.

### T-feed-2: The Community Word is parsed where it enters
- findings: F-M3, F-L10 (community-word.test.ts part)
- files: `feed/community-word.ts`, `feed/community-word.test.ts` (or, root-cause variant, `packages/contracts/src/api.ts` response validation + `backend.ts` mapping a validation failure to `unexpected`)
- fix: parse `answer.output` with the contract's output schema; a failed parse is `unexpected` and writes nothing.
- proving tests: a backend answering `{ communityWord: { entryId: 42 } }` writes no `feed.communityWord` and shows no notice; the swiped-past test asserts the notice is there before the swipe.

### T-feed-3: The day before's Word is the day before's; stored dates have a shape
- findings: F-L3, F-L9
- files: `feed/word-of-the-day.ts`, `feed/records.ts`, `feed/word-of-the-day.test.ts`
- fix: keep the previous day's Word apart from today's record (or read it from the Word of the Day archive) so a rejected today does not become `dayBefore`; one `YYYY-MM-DD` schema for the stored dates. Coordinate with F-H1 (same file).
- proving tests: today's record Hidden after choosing -> the new choice is not yesterday's Word; a stored record with date `garbage` reads as no record.

### T-feed-4: Feed types used nowhere else are not exported
- findings: F-L8
- files: `feed/day-change.ts`, `feed/reserved-words.ts`, `feed/feed-card.ts`, `feed/cycle.ts` (+ `cycle.test.ts` if it imports `CycleChange`: keep then)
- fix: drop `export` from `DaySubjects`, `ReservedWords`, `QuickQuestionCard`, the `CorrectionFeedCard` re-export; keep `FeedNoticeQueue` (used by feed.ts).
- proving test: typecheck + lint.
