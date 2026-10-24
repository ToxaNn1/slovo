# Sync exchanges opaque records and the client's change time wins

ADR 0005 makes the app offline-first and has it sync with the Account by last write wins per record, with tombstones, one Account per reader and data kept apart per Edition. ADR 0013 makes the Core the owner of the user-state schema and marks how each record syncs. Until 0.8 nothing synced. Spec #378 adds Sync, and something had to say what the backend keeps, how a device exchanges changes with it, and which of two changes wins.

**The backend keeps records without knowing what they mean.** It stores each record of an Account's user state in an Edition as the device sent it: its key, its JSON value or a tombstone, its change time and a server sequence number. It never reads a key or a value and knows nothing about Favorites, Active Days or the sync marks: the Core on the device owns every merge rule through the marks it declares (ADR 0013). A new kind of record needs no backend change.

**The client's change time wins.** Each change carries `changedAt`, the instant the Core wrote it, by the device's clock. The backend keeps a change only when its `changedAt` is later than the one of the record kept under its key, or when the key has no record yet; a tie keeps the record kept. A `changedAt` later than the server's own time is cut down to that time, so a device whose clock runs fast can't win every conflict for good. A change that is not later is ignored without an error, since the next pull answers the record that won. Of two changes of one key in one push, the later by the device's times is kept, the first on a tie, and only then cut.

**The server's sequence number is the cursor.** Every kept change takes the next value of one server sequence, the record's sequence number, replacing the one it had. A device pulls an Account's records in one Edition kept after its cursor, in sequence order, and keeps the last record's number as its next cursor. So a pull answers each record once per change, a replaced record comes again after the cursor, and an ignored change never moves it. The pushes of one Account wait for each other, one at a time: a push locks the Account's row until it commits, so its sequence numbers become visible in their order and a pull can't pass a number still being kept below it.

**Tombstones are kept for good.** A deletion travels as a change whose value is `null`, and the backend keeps it like any other, so an earlier change from another device can't bring the record back. There is little data in 0.8, so tombstones are never compacted. Deleting the Account removes its records in every Edition with it.

The protocol, in the API contract (ADR 0031: additive in `/v1`):

- **`sync.push`**, `POST /v1/editions/{editionId}/records`, with a Session: at most 500 changes, each `{ key, value, changedAt }`, `value` any JSON or `null` for a tombstone, `changedAt` in whole milliseconds since 1970-01-01 UTC, 0 included. The backend applies them by the rule above in one transaction and answers `{}`.
- **`sync.pull`**, `GET /v1/editions/{editionId}/records?after=<cursor>&limit=<n>`, with a Session: the records kept after the cursor (from the first without one), at most `limit` and at most 500 a page, as `{ records, cursor, more }`: `cursor` is the last record's sequence number, or the one asked after when none came, and `more` says whether more records follow.
- **Isolation.** The Account comes only from the Session the session gate opened (ADR 0030); no input names an Account, and a field that tries is `BAD_REQUEST`. Each Edition's records stay apart: one Account has separate records in every Edition.
- **Feature Switches.** An Edition with the `account` or the `sync` Feature Switch off, in the Edition or remotely (ADR 0040), is `NOT_FOUND`, so Sync can stop while signing in keeps working. Without a Session, `UNAUTHORIZED`.

On the backend, the server Core's `sync` domain (ADR 0027) holds the rules (the cut, the latest change of each key, the page) and reaches the records through a `UserRecords` port. Its Drizzle adapter keeps them in the `user_records` table: `account_id`, `edition_id`, `key`, `value` (`jsonb`, SQL null for a tombstone), `changed_at` and `sequence` (a `bigserial`), one row per Account, Edition and key, an index on the Account, the Edition and the sequence for the pull, and `ON DELETE CASCADE` from `accounts`. The adapter applies a push as one statement in its transaction, which replaces a row only when the new change time is later. A value is kept as `jsonb`, so an object's key order and spacing are not kept; the Core reads a value through its schema, which doesn't care. A record whose value is JSON `null` would travel as a tombstone, so the Core keeps no such record.

The device's side (the queue of pending changes and the cursor in the user state, tracked writes, a pull then a push, the merge by marks, the first-sign-in rule) comes with the Core's Sync tickets of spec #378, which amend this ADR. Limits on the size of keys and values, on the number of records and on requests come with their own ticket, in the amendment below.

This amends ADR 0005: last write wins by the time of the change, cut down to the server's time, not by the order changes arrive.

## Considered Options

- **The backend knowing the record kinds and merging them itself**: rejected. Every new kind of record, or a new mark, would need a backend change and a deploy in step with the app, and the merge rules would live in two places.
- **The server's arrival time wins**: rejected. A device offline for days would bring its old changes in last and win with them, over what the reader did since on another device.
- **The client's time without a cut**: rejected. A device whose clock runs a year ahead would win every conflict for a year.
- **A cursor of change times instead of a sequence**: rejected. Change times come from the devices and repeat, and a change with an old time kept late would sit behind a cursor that has passed it.
- **One transaction per change, or locking nothing**: rejected. A push would be kept in part when it fails halfway, and two pushes of one Account committing out of their sequence order could hide a record from a pull that had passed its number.
- **Deleting a record on a tombstone**: rejected. Another device's earlier change would then find no record and bring it back.

## Amendment: Sync's requests stay within limits (0.8, #385)

So that one Account can't fill the database and a broken or hostile device can't flood the backend, Sync has four limits, rules of the server Core's `sync` domain:

- **A key** has at most 200 characters, counted as code points, and **a value** at most 8 KB (8192 bytes) as compact JSON in UTF-8, so a Cyrillic letter counts twice. A push with either over is `BAD_REQUEST`, refused whole, like a push of more than 500 changes.
- **An Account keeps at most 20 000 records in an Edition**, tombstones included, since tombstones are kept for good. A push that would go over is refused whole with a new contract error, `TOO_MANY_RECORDS`, status 409: the request is well formed, and it is the records kept that refuse it. A change of a key kept never adds a record, so at the limit a device can still change and delete what it keeps. The `UserRecords` port counts the records the push would leave in the same transaction as it keeps them, after the Account's row is locked, so two pushes can't both pass the count; the server Core decides from the count, as the publishing of a pack decides from the versions published.
- **A Session makes at most 120 Sync requests, pushes and pulls together, in 10 minutes**, counted through the `RateLimits` port in fixed windows like the sign-in limits (ADR 0030). The 121st is `TOO_MANY_REQUESTS` (429) with `Retry-After`, the rest of the window in whole seconds. A request with a Session and an input the contract takes counts before its Edition and its records are checked, so one refused for them counts too. The window's key names the Session by its id, which the `Authenticator` now gives with the Account: the token signs in, so the `rate_limits` table never keeps it.

### Considered Options

- **The key and value limits in the contract's schemas**: rejected. The rules of Sync live in the server Core, beside the record limit they belong with; the contract describes them in the push's description.
- **Counting the records in the server Core before the push**: rejected. Two pushes of one Account could both pass the count and together go over.
- **`TOO_MANY_RECORDS` as 413 or 422**: rejected. 413 says the request is too large, and this one may hold a single change; 422 says it is malformed. 409 says it conflicts with what is kept.
- **The Session's token as the window's key**: rejected. Anyone who read the `rate_limits` table could sign in with it while its window lasted.

## Amendment: the Core merges two devices' words (0.8)

The Core's Sync module (spec #378) is the device's side of the protocol. It opens apart from the composition, like the Account (ADR 0037), over the tracked user state (ADR 0013) and a `SyncApi` port shaped by the contract: `push(token, changes)` and `pull(token, after)`, each answering success or a typed failure and never rejecting. A record's text in the user state travels as the JSON it holds; a pending change that doesn't read as JSON goes as a tombstone, as it reads as absent.

**One sync is a pull, then a push.** The pull asks for every page after the cursor and applies each page in one write together with its cursor, so a page is applied once or not at all. The push then sends the pending changes in batches of at most 500 and, after the backend accepts a batch, deletes the pending changes it sent, each only while it still holds what was sent. A failed call stops the sync where it is: what was written stays, and the next sync resumes from the cursor and the pending changes left, so an interrupted sync loses nothing and doubles nothing (a change sent again ties with itself and is ignored).

**Applying a page by the record's mark:**

- **last write wins** (no mark): the Account's value replaces the device's, unless the key has a pending change with a later change time, which stays and goes in the push. A tie goes to the Account's value, as on the backend;
- **`union`** (Active Days): the Account's days are written, and a tombstone of a day is ignored, so no day is ever deleted;
- **`highest`** (the Best result): the higher value is kept; when the device's is higher, the Core writes it again through the tracked write, so it gets a new change time and wins with the push;
- **`device-only`**: a record of the Account under such a key, the schema version and the Sync records included, is ignored;
- **a key the schema doesn't declare** (from a newer app) is written as it is, without a pending change, so the app keeps it and never pushes it back.

When the Account's value wins, a pending change of the key is deleted in the same write: it has nothing left to send. A value equal to the device's writes nothing; values are compared as JSON, whatever the order of an object's keys, since the backend's `jsonb` keeps no order.

**History is trimmed after the pull, in the write of its last page.** When the pull leaves more than 500 History entries, the oldest by Seen time are deleted through the tracked write, so those deletions sync and every device keeps the same 500. Not page by page: a later page may bring a newer entry of one an earlier trim would delete, and the trim's tombstone, written with the device's time, would win over it.

**The first-sign-in rule.** A sync without a cursor first writes, in one write in turn with every other, a pending change with change time 0 for every synced record that has none. The pull then lets the Account's value win wherever it has one, and the push adds what the Account lacks; a change made while signed out keeps its own time. The rule lives in the queue, not in the sync's memory, so a first sync interrupted after its pull still pushes the device's records next time.

**The changed signal.** A sync answers whether its pull wrote a record, so the shell reopens what keeps the user state in memory only when something came from the Account; a pull that brings back what the device pushed writes nothing. A sync that fails answers it too, since the pages it applied stay written and the next pull won't bring them again.

Writing a page, the first-sign-in changes and the rewrites runs in turn with the modules' writes (`merge` of the tracked user state), so no write of the reader lands between what Sync read and what it writes. When Sync runs, how it fails and retries, and what the reader sees are the Sync triggers' ticket.

### Considered Options

- **Remembering the first sign-in in the sync's memory, pushing the device's records after the pull**: rejected. A sync interrupted between the pull and the push would leave a cursor, and the next sync would never push the records the Account lacks.
- **Trimming History on every page**: rejected (above).
- **Applying a pull through the tracked write**: rejected. Every record the Account sent would become a pending change with the device's time and go back to the Account as a newer change.
- **Comparing the text of the records**: rejected. The backend answers an object with its keys in another order, and every pull would report a change.

## Amendment: when Sync runs and what it says (0.8, #387)

The Core's Sync module, `openSync`, decides when one sync (`createSyncExchange`, above) runs, and says how it went. It opens apart from the composition over the tracked user state, the Account, the `SyncApi` port, the Edition as the app runs it, the clock and the `Schedule`; the app never waits for it.

- **Moments.** It syncs when the shell says the app is in the foreground (at launch and on each return), when a Session starts while in the foreground, so the first merge runs right after the code is accepted, and 5 s after the last tracked write while in the foreground: the tracked user state tells its subscribers after each write that left a pending change, and each one starts the 5 s again, so a burst of writes makes one sync. Going to the background drops the wait.
- **Conditions.** Only with a Session, and with the `account` and `sync` Feature Switches on in effect (ADR 0040), read at each moment.
- **One at a time.** A moment during a sync asks for one more after it, however many moments came.
- **The snapshot** (ADR 0016's pattern) is what the status line reads: when the last sync of this Session went through, whether a sync runs (its waits between tries included), and whether the last one failed for want of network through every try. The time is kept across launches in a `device-only` record, `sync.syncedAt`, since the status line names a date, or a year, as well as today's time. The end of a Session clears the snapshot and forgets the record with the cursor.
- **The changed signal.** `onUserStateChange` tells its listeners once after each sync whose pull wrote a record, a failed one too, and after one that failed to write the user state, since a page may have been written first; so the shell reopens what keeps the user state in memory.

How it fails, tries again and treats the Session's end is ADR 0037's amendment for 0.8.

### Considered Options

- **Keeping the last sync's time in memory only**: rejected. A launch whose first sync can't go through, held back by a limit or refused, would show no time at all, and the line's date and year would never show.
- **The changed signal in the snapshot, as a count**: rejected. Every subscriber of the status line would be told of it, and the shell would have to keep the last count to tell a new change from an old one.

## Amendment: a record value nests at most 32 levels (0.8.9, #648)

A record's value nests at most 32 levels of arrays and objects. A push with a deeper value is `BAD_REQUEST` (400), refused whole like any other wrong field, and is no unexpected failure, so it makes no crash report (ADR 0048). Zod checks JSON by recursion, and a value nested a few thousand levels deep overflowed the stack: an ordinary bad request became a 500 and a report (review #618, F1, F10). The contract's schema of the value counts the depth first, with a loop rather than recursion, so a value of any depth is counted on a fixed stack and a too-deep one never reaches the recursive check. The user state's deepest value is a few levels, so 32 leaves room for any record the app will write.

Unlike the key and value limits, this one lives in the contract's schema: it must run before the schema's own check, which is the one that overflows, so it can't wait for the server Core. The Session gate runs before the input is read (`signedInRouter`), so a push without a Session is `UNAUTHORIZED` whatever its body, and no anonymous request reaches the check at all.
