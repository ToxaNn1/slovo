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
