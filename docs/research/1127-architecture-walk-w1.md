# Architecture-friction walk, wave 1 (27.11)

Read-only walk of `apps/backend/src`, `packages/server-core`, and the Sync and Account code of `packages/core` and `apps/mobile`, at `d533058`. No code changed. Two actions were followed end to end: one sync (tracked write → `openSync` → `createSyncExchange` → contract → `syncProcedures` → `createSync` → `createUserRecords`) and a sign-in by code up to the deletion of the Account (`account.ts` → `account-requests.ts` → `accountProcedures` → `createAccounts` → `createAuthenticator`).

**Coverage.** Candidates 1–4 were read and traced by the walker. Candidates 5–6 come from a subagent's walk of `apps/backend/src/content`, `media` and `recordings`; the walker re-read only the key lines of 5, and none of 6. The walk of `apps/backend/src/{admin,services,alerts,counters,edition}`, `app.ts`, `config.ts` and their server-core rules was not finished when the context limit came: that area is **not covered** here.

Checked and not held: the modules that open apart from the composition (Account, remote switches, Mistake Reports, counter sending) keep only `device-only` records, so `reopenAfterSync` reopening the settings and the composition alone misses nothing; a sync's own writes (`merge`, `deleteSent`, `syncSyncedAt`) do not wake Sync again (`tracked-user-state.ts:96-121`).

**Leads of the admin walk, not candidates.** A second subagent's report on the admin and services area arrived after the six were chosen. None of it was re-read by the walker, and it read test names only, not test bodies:

- The Action log has no single seam: `admin-access.ts:112` calls itself the one write path while 11 places insert into `actionLog` directly, and in 17 places of the server Core a change and its log row go as separate queries; ADR 0204 settles this for the deletion of an Account only. Size L.
- Services: `ServiceStore` offers only `list()`, so three callers do `list().find(id)` over three store instances and check `unknown` twice. Size S–M.
- "A fresh TOTP opens the Vault" is assembled in the HTTP shell while the server Core's `unlock()` opens the window unconditionally; no defect found. Size S.
- "Once an hour" and "the Kyiv day" are each encoded several times (cache TTL against the Cron window, three Kyiv formatters plus SQL), with the clock read more than once in one decision. Size S–M.

`packages/server-core` holds no test file: every rule of it is tested through HTTP in `apps/backend`.

## 1. The Sync cursor belongs to a Session only while Sync happens to be open

- **Files.** `packages/core/src/sync/sync.ts:128, 269-285`; `packages/core/src/sync/exchange.ts:260-275, 380`; `packages/core/src/sync/records.ts:18-27`; `apps/mobile/src/shell/app-shell.ts:157-180, 252-258`.
- **Friction.** "The cursor is of this Session's Account" is kept by Sync watching the Account's state in memory: a change from signed-in to signed-out sets `sessionOutdated` (`sync.ts:283`), and at opening the cursor is forgotten only when the reader is signed out (`sync.ts:128`). The cursor record itself names no Account. The shell opens Sync through `whileOn('sync', …)`, which leaves it closed while the switch is off in effect (`app-shell.ts:177`) while the Account stays open. A Session that ends and another that starts in that time are never seen: when Sync opens, `signedIn()` is true, the old cursor stands, `joinAccount` is skipped (`exchange.ts:380` runs it only without a cursor), and the pull asks the new Account for records after the old Account's sequence number. The sequence is one for every Account (`schema.ts:226-229`), so records of the new Account kept below it never arrive, and the device's own records get no first-sign-in change.
- **Deletion test.** Deleting the watcher in `sync.ts` would not remove the rule, it would have to reappear wherever the cursor is read: the rule is real, but it lives in a caller's wiring (who is open when) instead of beside the cursor.
- **What tests cannot reach.** `sync.test.ts` opens Sync before every Session change (`:568-645` cover a sign-out, a deletion, a forget that failed); none changes the Session while Sync is closed, and `app-shell.test.tsx` would need the remote switch, the Account and Sync together.
- **Related ADRs.** 0041, 0013, 0203.
- **Confidence.** Medium-high on the mechanism (read, not run); reach is narrow: `sync` off in effect, `account` on, and a different Account signed in meanwhile.
- **Size.** S–M.

## 2. The record limits of Sync are known on one side, and one record over them holds its whole batch for good

- **Files.** `packages/server-core/src/sync/sync.ts:12-27, 108-120, 162`; `apps/backend/src/sync/sync-procedures.ts:29-30`; `packages/contracts/src/api/sync.ts:89`; `packages/core/src/backend.ts:38`; `packages/core/src/sync/exchange.ts:40-43, 370-404`; `packages/core/src/progress/xp-days.ts:15-25, 147-148`.
- **Friction.** The limits (key 200 code points, value 8 KB) are a private constant of the server Core (ADR 0041 puts them there), restated as prose in the contract (`api/sync.ts:89`) and as a third number with its own copy of `utf8Bytes` in the device's XP-day fold (`XP_DAY_BYTES = 7 * 1024`, `xp-days.ts:17, 23`). No other synced record is sized on the device (a Collection's `name` is `z.string()`). A push with one record over is refused whole as `too-large` → `BAD_REQUEST` → `unexpected` on the device, which `refusalOf` counts a refusal for good: every change of that batch, up to 500, is marked refused (`exchange.ts:398`) and sent no more until the next launch, where `pushesOf` builds the same batch again. The device cannot tell which record is over.
- **Deletion test.** Deleting `fits` moves nothing; deleting `XP_DAY_BYTES` would break the fold against a number it cannot see. The rule is one concept with three homes and no shared reading.
- **What tests cannot reach.** The fake backend refuses a push only by script (`fake-backend.ts:298, 416-437`), so no Core test sends a record the real backend would refuse for size; `sync-limits.test.ts:40-110` proves the server half alone.
- **Related ADRs.** 0041 (limits are the server Core's), 0205 (XP days sized for 8 KB), 0064.
- **Confidence.** High on the split and on the batch being held; low-medium that a record over 8 KB arises today outside XP days.
- **Size.** S–M.

## 3. "The later change wins, a tie keeps" is written four times

- **Files.** `packages/server-core/src/sync/sync.ts:123-131, 164-168`; `apps/backend/src/sync/user-records.ts:69-77, 96-97`; `packages/server-core/src/ports.ts` (`UserRecords.push`, 17 lines of doc for one method); `packages/core/src/fakes/fake-backend.ts:416-437`; device side `packages/core/src/sync/exchange.ts:324-329`.
- **Friction.** Within a push, `latestOfEachKey` picks the change of a key (server Core). In the store, a JavaScript loop decides which changes would be kept in order to count the Account's records (`user-records.ts:73`), then the SQL `setWhere` decides again which are kept in fact (`:97`); the limit is judged on the first reading and the write follows the second. The fake backend carries its own copy of pick, cut and compare, and none of the limits or of the tombstone trimming. The server Core's `push` is left as admit, `fits`, pick, cut and a call whose port takes a `refuse` callback and `tombstonesKept`: what counts as a record (a tombstone not one, a replacement adds none) is decided in the adapter, the server Core only supplies 20 000.
- **Deletion test.** Deleting `createSync.push` would move four short steps into the procedure: it is shallow. Deleting the count loop of `user-records.ts` would concentrate nothing: the rule would still need both readings unless one of them answers the other.
- **What tests cannot reach.** The server Core has no test of Sync of its own (one implementer of `UserRecords`, Postgres); the two readings in the store can only be told apart with 20 000 rows (`sync-limits.test.ts:170-312`); nothing runs one set of cases over the fake and the real backend.
- **Related ADRs.** 0041, 0205, 0064 (one fake backend), 0030.
- **Confidence.** High on the copies; no divergence found between them today.
- **Size.** M.

## 4. A spent Sign-in code reaches the reader as "try a little later"

- **Files.** `apps/backend/src/account/authenticator.ts:81, 269-292`; `apps/backend/src/account/account-procedures.ts:53-57`; `packages/contracts/src/api/account.ts:75-81`; `packages/core/src/backend.ts:33-36`; `packages/core/src/account/account-requests.ts` (`verifyCode`); `packages/core/src/account/account.ts` (`problemOf`); `editions/uk/strings.json:2160`.
- **Friction.** The adapter answers `too-many-tries` apart from the rate limit, and the procedure folds both into `TOO_MANY_REQUESTS`, the spent code without `Retry-After` (the contract says so in a comment). On the device `answerOf` makes both `too-many-requests`, the Account drops `retryAfter`, and the reader sees «Забагато спроб. Спробуй трохи пізніше.» for a code that no wait revives: only a new code signs in. The reason travels through five tables (adapter → server Core → procedure → contract → `answerOf`/`problemOf` → Edition strings) and is lost at the second.
- **Deletion test.** Not a module to delete; the tables each earn their place (ADR 0064), but the distinction made on one side of the seam is unmade before it crosses.
- **What tests cannot reach.** The backend tests assert the 429 without `Retry-After`; the Core's tests assert `too-many-requests`; both pass while the reader is told the wrong thing.
- **Related ADRs.** 0030 (code rules live in the adapter; not questioned), 0064.
- **Confidence.** High on the trace; whether the wording matters is a product call.
- **Size.** S.

## 5. The "one writer" of a content record has a second: the import (subagent's finding)

- **Files.** `apps/backend/src/content/content-records.ts:28-33`; `apps/backend/src/content/content-store.ts:116-279`, the retire at `:211-221`.
- **Friction.** `content-records.ts` names itself the one writer of a content record, the import included (ADR 0090). The import with an override retires Entries by a raw `UPDATE` (`content-store.ts:213-221`, re-read by the walker) that sets `retired`, `contentVersion`, `changedBy` and `batchId` but, by the subagent's reading, raises no record version: a form opened before the import would pass the staleness check and bring the retired record back.
- **Deletion test.** Deleting the raw update in favour of the writer concentrates the rules of a save; today they are in two places.
- **What tests cannot reach.** Needs a save racing an import; not run here.
- **Related ADRs.** 0090, 0099, 0195, 0010.
- **Confidence.** Medium: the second writer is certain, the stale-form consequence is not verified by the walker.
- **Size.** M.

## 6. Which Recordings a Word has and needs is decided four times, in SQL and in JavaScript (subagent's finding, not re-read)

- **Files.** `apps/backend/src/recordings/recordings.ts:96-166`; `apps/backend/src/content/media-rows.ts:322-400`; `apps/backend/src/content/content-writes.ts:702-707`.
- **Friction.** Three definitions of the same question differ in form; they agree while there is one Recording Kind. The same report notes the seven content kinds listed by hand in about nine places and `saveRecording` (`media-rows.ts:95-102`) called only by tests.
- **Deletion test.** One definition would concentrate; today a second Recording Kind must be added in each.
- **What tests cannot reach.** The disagreement has no input today.
- **Related ADRs.** 0090, 0195.
- **Confidence.** Medium-low for the walker (unverified); the subagent rates the three definitions high, the harm medium.
- **Size.** M.
