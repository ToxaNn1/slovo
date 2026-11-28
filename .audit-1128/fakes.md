# Audit 28.11: the Core fakes against the real thing

Scope: `packages/core/src/fakes/fake-backend.ts` against `apps/backend/src`, `packages/server-core/src` and `packages/contracts/src` for every procedure outside Account, plus the Sync limit and tombstone rules of PR #2088. Also `packages/core/src/fakes/memory-content.ts` against `packages/language-pack/src/pack-reader.ts`. Base: `origin/main` at `8665bce`.

Findings a1.8 to a1.12 of the 21.11 audit are fixed on main: Sync goes through `arriveSignedIn` (`fake-backend.ts:323-329`), records are kept per Account and dropped on delete (`:241`, `:406-415`), a spent code answers `CODE_SPENT` (`:368-372`), emails go through `AccountEmailSchema` (`:340-345`), and the memory content store clears the mark (`memory-content-store.ts:69-70`). They are not repeated here.

How it was checked: both sides read. For the ordering finding the fake was changed for a moment, the Core suite was run, and the change was reverted. No change is committed outside this file.

## f.1 Memory content lists Entries in fixture order, the pack in id order

- Status: CONFIRMED (both sides read; experiment: 7 Core tests fail once the fake sorts by id)
- Severity: medium (test fidelity; can hide a product defect, see f.2)
- Fake: `packages/core/src/fakes/memory-content.ts:64-75` (`listIds`, `listWords`), `:77-81` (`listLinkedWordIds`), `:82` (`listCuratedCollections`), `:83-92` (`listLinkingSynonymRowIds`). Every list keeps the order the test gave.
- Real: `packages/language-pack/src/pack-reader.ts:158,161` (`ORDER BY id`), `:166` (`ORDER BY words.id`), `:173` (`ORDER BY synonym_rows.id`), `:177` (Curated Collections `ORDER BY id`), `:257` (`listWords`, `ORDER BY id`). SQLite compares ids byte by byte, so a Cyrillic id such as `w_коса1` comes after every Latin one.
- Port: `packages/core/src/ports.ts:33-46` promises only "a stable order" for `listIds` and `listWords`. `:66` promises Curated Collections "in id order", and the fake breaks that promise outright.
- Inputs: fixture `[c_two, c_three]` (Corrections of one type). Real: `c_three, c_two`. Fake: `c_two, c_three`.
- Tests that pass only on fixture order (found by sorting the fake by id with a binary compare and running `packages/core`):
  - `src/dashboard/correction-types.test.ts` "lists the Corrections of a type in pack order…" expects `c_two` before `c_three`. The real pack gives the opposite.
  - `src/entries/entries.test.ts` "are the live Words, … each kind in the Language Pack order", "hold no Correction when the Edition turns Corrections off", "lead from a Word to exactly the Corrections `eligible` holds…", "lead from a Word to the first Synonym Row that is not Hidden…" (`r_talk` is first only in the fixture; the pack gives `r_chat`).
  - `src/entries/entry-kinds.property.test.ts` "lists the live ids … in the order given" pins the fake's own order.
  - `src/game/pairs-mode.test.ts` "puts the Words the reader marked «Не знаю» in grids…": see f.2.
- Consequence: the tests call fixture order "the Language Pack order", but the pack has no editorial order for Entries, only ids. On the phone, the Corrections of a type, `eligible` and "the first linking Synonym Row" all come in id order. If the owner wants editorial order, the pack loses it today and no test shows that.
- Fix: in the fake, sort every list by id with a binary compare (`a < b`), as SQLite does, and keep `getEntries` in no set order. Rewrite the 7 tests to expect id order, or name the order they test. If editorial order is wanted on the Correction-type screen, that is a product decision for the owner (a `position` column in the pack), not a fake fix.

## f.2 «Пари»: under the pack's order a «Не знаю» Word can be left out of the Game

- Status: PLAUSIBLE (experiment, not traced to a cause)
- Severity: medium if confirmed (a promise of the Game broken on the phone)
- Test: `packages/core/src/game/pairs-mode.test.ts:301-317` checks that each of `w_n03`, `w_n07`, `w_n09` marked «Не знаю» is in some grid (`place >= 0`), with seeds 1-4.
- Experiment: seeds 1-12. With fixture order (`memory-content.ts` as on main), all 12 seeds pass. With the fake's Words sorted by id, as the pack reads them (`pack-reader.ts:257`), seeds 3, 6 and 7 leave one weak Word out of every grid (place `-1`). Seed 3 is in the test's own set, so the test fails.
- The only difference between the two orders is where `w_коса1`, `w_коса2` and `w_вирій` sit (after the Latin ids in the pack). Code: `packages/core/src/game/pairs-mode.ts:10-18` (`gridOrder`) and the Game's order of the Words it asks next.
- Consequence: the test is green because of the order of its fixture. On the phone a Word the reader marked «Не знаю» may be missing from a «Пари» Game.
- Fix: first trace it. Run the test against an id-sorted fake and follow, for seed 3, why the weak Word gets no grid (likely the synonym rule `w_n02`/`w_n03` or the homonym rule pushing it past Round 15). Then fix the Core, not the seed list, and keep the test on the id order.

## f.3 Fake Sync ignores the Edition

- Status: CONFIRMED (read)
- Severity: low (test fidelity)
- Fake: `fake-backend.ts:418-442` (`push`) and `:443-455` (`pull`) never read `input.editionId`. Records are keyed by email only (`:241`).
- Real: `apps/backend/src/sync/user-records.ts:29-32,134` keys every read and write by `(accountId, editionId)`. `packages/server-core/src/sync/sync.ts:131-140` refuses an Edition that does not serve Sync (`NOT_FOUND`, `apps/backend/src/sync/sync-procedures.ts:22-24`).
- Inputs: push `{editionId: 'uk'}`, then pull `{editionId: 'en'}`. Real: no records. Fake: the `uk` records.
- Tests relying on it: none found; every Core Sync test uses one Edition. A Core regression that pushes or pulls under a wrong or fixed Edition id would stay green.
- Fix: key `records` by `${email} ${editionId}`, and make `recordsOf(email, editionId = 'uk')` read that key.

## f.4 Fake Sync has no record limit and keeps every tombstone

- Status: CONFIRMED (read)
- Severity: low (test fidelity); it also means a1.2 of 21.11 cannot be shown in a Core test
- Fake: `fake-backend.ts:418-442` keeps any number of records and tombstones. A 409 comes only from `failNext('too-many-records')` (`:305-306`), whatever the push holds.
- Real: `packages/server-core/src/sync/sync.ts:15,21,148-154` and `apps/backend/src/sync/user-records.ts:64-77` refuse a push only when it would take the live records over 20 000. A tombstone counts as none and frees the room of its record. A replacement of a kept record adds nothing, so at the limit deletions and replacements are still taken. `:95-118` then deletes every tombstone older than the latest 20 000.
- Inputs: an Account at 20 000 records pushes one deletion and one new record. Real: taken (net 0). Fake: taken too, but only because it never counts. A test of "at the limit, the deletions still go through", or of "a deletion older than 20 000 later tombstones never reaches a device", cannot be written.
- Tests relying on it: `packages/core/src/sync/sync.test.ts:447-491` and `exchange.test.ts:923-982` force the 409 by hand on pushes the real backend would take. They test the Core's handling of a refusal, which is fine, but on inputs the real backend never refuses. `xp-day-sync.test.ts:234-264` ("sends the deletions first, so they free room") checks push order only, never the room.
- Fix: give the fake the backend's two rules, with the limits as options (`{ recordLimit = 20_000, tombstoneLimit = 20_000 }`) so a test can set them to 3. Count live records after the cut as `user-records.ts:69-75` does, and drop the oldest tombstones past the limit.

## f.5 A push held across `account.delete` brings the deleted Account's records back

- Status: CONFIRMED (traced)
- Severity: low
- Fake: `arriveSignedIn` takes the email before the hold (`fake-backend.ts:323-329`). `push` then runs `records.set(email, kept)` (`:422-423`) after `delete` has dropped that email's records (`:413`).
- Real: the push transaction locks the Account's row and keeps nothing when the Account is gone (`apps/backend/src/sync/user-records.ts:37-43`).
- Inputs: `hold()`, `sync.push`, `account.delete`, release, then sign in again with the same email and pull. Real: nothing. Fake: the pushed records.
- Tests relying on it: none found. It hides the same delete-account bug a1.9 named, in a race.
- Fix: in `push`, after `arriveSignedIn`, return `{}` without keeping anything when `!accounts.has(email)`.

## f.6 `content.patch`: the fake answers 304 where the backend sends an empty Patch

- Status: CONFIRMED (read); the effect on the phone is PLAUSIBLE
- Severity: low
- Fake: `fake-backend.ts:493-499` answers 304 whenever no published Patch has the device's `since`, with or without `if-none-match`, and for any Edition.
- Real: `apps/backend/src/content/content-store.ts:369-386` builds a Patch for any `since`, reaching `Math.max(since, contentVersion)`. With no records changed it is still a 200 `patch`, with no records. `content-procedures.ts:52-53` answers 304 only when the device names the ETag. An unknown Edition, or one with content updates off, answers `NOT_FOUND`.
- Inputs: a fresh install whose pack has no Patch ETag and is at the backend's version. Real: 200 with an empty Patch. `content-update.ts:84-86` applies it and tells the subscribers, and `apps/mobile/src/shell/lifecycle.tsx:114-116` reopens the composition. The next check names the ETag and gets 304. Fake: 304, so nothing reopens.
- Tests relying on it: `packages/core/src/content-update/content-update.test.ts:74` and every test that leaves the fake with no Patch. No test sees the empty-Patch path or the reopen it causes.
- Fix: in the fake, answer a 200 Patch with no records (`contentVersion: since`) when nothing is published at `since` and no ETag is named. Separately, decide whether the Core should skip `apply` and the subscribers for a Patch with no records (`contentVersion === since` and every list empty).

## f.7 `content.patch`: the backend refuses a higher `patchFormat`, the fake and the contract do not

- Status: CONFIRMED (read)
- Severity: low (no app reads a format above `PATCH_FORMAT` today)
- Contract: `packages/contracts/src/api/content.ts:194` says `patchFormat` is "the highest Patch format the app reads".
- Fake: `fake-backend.ts:500-506` answers `unsupported-format` only when the Patch's format is higher than the device's, as the contract says.
- Real: `apps/backend/src/content/content-procedures.ts:35-44` answers `unsupported-format` for any `patchFormat !== PATCH_FORMAT`, including an app that reads a higher format (e.g. 4) from a backend that writes 3. The app then keeps its content.
- Consequence: an app released with Patch format 4 before the backend writes it gets no content updates until the backend deploys, and a Core test against the fake would say it does.
- Fix: in the backend, refuse only `patchFormat < PATCH_FORMAT`, as the contract says. The fake already does that; then add a fake test that names the case.

## f.8 Questionnaire: the fake counts any answer, the backend refuses one that is not an option

- Status: CONFIRMED (read)
- Severity: low (the Core sends ids from the Edition config, and the call is fire-and-forget)
- Fake: `fake-backend.ts:528-531` keeps any `{question, answer}`.
- Real: `packages/server-core/src/counters/community-counters.ts:162-175` answers `unknown-answer` (`NOT_FOUND`, `apps/backend/src/counters/counters-procedures.ts:58-61`) when the answer is not an option of the question (`:33-46`). `who` has no options any more, so every `who` answer is refused.
- Tests relying on it: `packages/core/src/onboarding/*.test.ts` read `api.counters.answers` (e.g. the `notificationTime` checks around `:363` and `:542`). If the Core sent a label in place of an option id, they would pass while the backend counts nothing.
- Fix: give `createFakeBackend` the options per question (the test Edition's `questionnaire` and `dailyGoals`, plus the contract's `NotificationTimeBucketSchema`), and refuse anything else with `NOT_FOUND`, as `optionsOf` does.

# Checked, no defect

- `reports.send` (`fake-backend.ts:457-463` vs `apps/backend/src/reports/reports-procedures.ts`, `server-core/src/reports/mistake-reports.ts`): both take the report with or without a Session. The fake keeps the raw token it got, and its tests (`mistake-reports.test.ts:145-160`) check what was sent, not which Account was kept. The switch and the limit are reached through `failNext`.
- `collectionLinks.create` and `read` (`:464-478` vs `server-core/src/collection-links/collection-links.ts`): same URL shape (`editionSite`), a 10-character id that passes `CollectionLinkIdSchema`, the link read back as stored (the contract parses and trims both sides), and `NOT_FOUND` for an unknown id.
- `content.latest` and `content.download`: same answers (`{pack: null}`, `NOT_FOUND`). The Patch ETag format differs (`"12"` vs `"uk.12.p3"`), and so does `cache-control`, but the Core treats the ETag as opaque and reads no `cache-control`.
- Memory content store against `applyPatch` (`memory-content-store.ts:62-76` vs `language-pack/src/apply-patch.ts:55-115`): same `since` check, same clearing of «needs new recording». A retired Curated Collection is dropped by the real Patch (`record-rows.ts:349-363`) and kept by the fake, but the Core filters it (`dashboard/curated-collections.ts:136`).
- `counters.read` and `count()`: the real one adds the deltas, the fake answers fixed counts. No Core or mobile code calls `counters.read` any more (only `counter-sending.ts` updates `countersRead` records that already exist), so nothing relies on it.
- `counters.send`, `statisticsOff`, `communityWord`: same shape. Switch-off and limits go through `failNext`.
- `edition.switches` (`:544-554` vs `apps/backend/src/edition/edition-procedures.ts`): same body shape, the same SHA-256 ETag and backend `date`. `off` is always `[]` in the fake, and the Core reads only `rules`.
- Sync push order and cut (`:424-440` vs `sync.ts:142-147`, `user-records.ts:78-93`): the later change of a key wins, the first on a tie, the cut is to the clock, a tie keeps the record kept, and the sequence is one for every Account. The pull page and cursor match, except that the fake ignores `limit`, which the Core never sends.
- `getEntries` semantics: both leave out unknown ids and include retired Entries. Experiment: with the fake's `getEntries` reversed, all 2 996 Core tests pass, so nothing relies on its order.
- Synonym Row links to a retired Word: the pack drops the `wordId` (`pack-reader.ts:218-237`), the fake keeps it. The Core guards it itself (`entries/synonym-row-card.ts:57-61`, `listLinkingSynonymRowIds` filters live Words), so the fake is stricter and no lie follows.

# Not finished

- f.2 is not traced to its cause in `game.ts` / `pairs-mode.ts`. Only the experiment was run.
- `apps/mobile` tests that use `createFakeBackend` (39 files import it) were not checked for reliance on f.3-f.8. The Core tests were grepped.
- Duplicate ids passed to `getEntries` across the pack reader's 500-id parts (`pack-reader.ts:190-199`) can return an Entry twice in the real pack and once in the fake. Not checked whether any caller passes duplicates.
- `listCategories` without `categories` in the fake (built from the Words, retired ones included, `memory-content.ts:51-59`) was not compared with the pack's build of the Category list.
