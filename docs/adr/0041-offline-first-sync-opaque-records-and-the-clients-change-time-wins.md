# Offline-first sync: opaque records, and the client's change time wins

The app always reads and writes a local database. When it is online and the user has an Account, it syncs changes with the server in the background. Conflicts are resolved per record by last write wins, and deletions are kept as tombstones so they can't be resurrected by another device. The Streak is derived from synced Active Days, never stored, so merging two devices always gives the right number. Notification times stay per device. One Account (SLOVO ID) spans every Edition, with data partitioned per Edition. The Core owns the user-state schema and marks how each record syncs (ADR 0013); this records what the backend keeps, how a device exchanges changes, and which of two changes wins.

**The backend keeps records without knowing what they mean.** It stores each record of an Account's user state in an Edition as sent: key, JSON value or tombstone, change time and a server sequence number. The Core on the device owns every merge rule through its marks (ADR 0013), so a new kind of record needs no backend change.

**The client's change time wins.** "Last write" is the change the device made last, not the one that reached the server last. Each change carries `changedAt`, the instant the Core wrote it by the device's clock. The backend keeps a change only when its `changedAt` is later than the kept record's, or the key has none; a tie keeps the kept record. A `changedAt` later than the server's time is cut to that time, so a fast clock can't win for good; a device offline for days keeps the real time of its changes, so they lose to what the reader did since on another device. A change that loses is ignored without an error. Of two changes of one key in one push, the later is kept (the first on a tie), then cut.

**The server's sequence number is the cursor.** Every kept change takes the next value of one sequence. A device pulls the records kept after its cursor in sequence order and keeps the last number. A push locks the Account's row until it commits, so pushes of one Account run one at a time and a pull can't pass a number still being kept.

**Tombstones are kept for good**, so an earlier change from another device can't bring a record back. Deleting the Account removes its records in every Edition.

## The protocol (ADR 0031: additive in `/v1`)

- **`sync.push`**, `POST /v1/editions/{editionId}/records`: at most 500 changes `{ key, value, changedAt }`, `value` any JSON or `null` for a tombstone, `changedAt` in whole milliseconds since the epoch. Applied in one transaction; answers `{}`.
- **`sync.pull`**, `GET /v1/editions/{editionId}/records?after=<cursor>&limit=<n>`: at most 500 records a page, as `{ records, cursor, more }`.
- **Isolation.** The Account comes only from the Session (ADR 0030); a field naming one is `BAD_REQUEST`. Each Edition's records stay apart. Without a Session, `UNAUTHORIZED`; the Session gate runs before the input is read. With `account` or `sync` off in effect (ADR 0040), `NOT_FOUND`.
- **Limits**, rules of the server Core's `sync` domain unless noted. A key has at most 200 code points and a value at most 8192 bytes of compact UTF-8 JSON; over either is `BAD_REQUEST`, refused whole. A value nests at most 32 levels, checked in the contract's schema with a loop before Zod's recursive check, which a deep value would overflow into a 500 and a crash report (ADR 0048). An Account keeps at most 20 000 records per Edition, tombstones included: a push that would go over is `TOO_MANY_RECORDS` (409), counted in the push's transaction after the row lock, and a change of a kept key never adds a record. A Session makes at most 120 Sync requests in 10 minutes, counted through `RateLimits` in fixed windows (ADR 0030) keyed by the Session's id, never its token; the 121st is 429 with `Retry-After`.
- **Storage.** The server Core's `sync` domain (ADR 0027) reaches the records through a `UserRecords` port. The Drizzle adapter keeps them in `user_records` (`account_id`, `edition_id`, `key`, `value` as `jsonb` with SQL null for a tombstone, `changed_at`, `sequence` as `bigserial`), one row per Account, Edition and key, indexed for the pull, `ON DELETE CASCADE` from `accounts`. `jsonb` keeps no key order; the Core reads values through its schemas and keeps no record whose value is JSON `null`.

## The device

The Core's Sync module, `openSync`, opens apart from the composition, like the Account (ADR 0037), over the tracked user state, the Account, the Backend port (ADR 0064), the Edition in effect, the clock and the `Schedule`. The app never waits for it.

- **One sync is a pull, then a push.** The pull applies each page in one write with its cursor. The push sends the pending changes in batches of 500 and deletes each sent change once accepted, only while it still holds what was sent. A failure stops the sync where it is; the next resumes from what was left and doubles nothing. A pending change that doesn't read as JSON goes as a tombstone.
- **Applying a page by the record's mark.** Last write wins (no mark): the Account's value replaces the device's unless a pending change is later; a tie goes to the Account. `union` (Active Days): days are added, a tombstone of a day ignored. `highest` (the Best result of each Game Mode): the higher is kept, and a higher device value is written again so it wins with the push. `device-only`: ignored. A key the schema doesn't declare (from a newer app) is written as it is and never pushed back. When the Account's value wins, the key's pending change is deleted; equal values, compared as JSON, write nothing.
- **History is trimmed after the pull**, in the write of its last page: beyond 500 entries the oldest by Seen time are deleted through the tracked write, so every device keeps the same 500.
- **The first-sign-in rule.** A sync without a cursor first writes a pending change with change time 0 for every synced record that has none, so the Account's value wins wherever it has one and the push adds what it lacks. The rule lives in the queue, so an interrupted first sync still pushes next time.
- **Writes run in turn** with the modules' writes (`merge` of the tracked user state), so no write of the reader lands between what Sync read and what it writes.
- **Moments.** It syncs when the app comes to the foreground (launch and each return), when a Session starts in the foreground, and 5 s after the last tracked write that left a pending change while in the foreground; going to the background drops the wait. Only with a Session and `account` and `sync` on in effect. A moment during a sync asks for one more after it.
- **Failures.** A sync with no answer or a 5xx is tried again whole by the one retry rule (ADR 0064). Every other failure waits for the next moment. A 429 waits for its `Retry-After` and then syncs while in the foreground. A 401 goes to the Account through `withSession` (ADR 0037), which ends the Session; Sync never tries again once its Session ended.
- **The end of a Session** (sign-out, deletion or 401) forgets the cursor and the last sync's time once no sync of that Session runs, and keeps the pending changes and the words; the next Session starts by the first-sign-in rule. Sync opens signed out by forgetting a cursor a closed app left.
- **The snapshot** (ADR 0016) is what the status line reads: when the last sync of this Session went through, kept across launches in the `device-only` record `sync.syncedAt`; whether a sync runs; and whether the last failed for want of network through every try. A server that fails shows the last sync's time.
- **The changed signal.** `onUserStateChange` tells its listeners once after each sync whose pull wrote a record, a failed one too, and after one that failed to write the user state, so the shell reopens what keeps the user state in memory (ADR 0036).

## Considered Options

- **The backend knowing the record kinds and merging them itself**: rejected. Every new kind or mark would need a backend deploy in step with the app.
- **The server's arrival time wins**: rejected. A device offline for days would win with its old changes.
- **The client's time without a cut**: rejected. A clock a year ahead would win for a year.
- **A cursor of change times**: rejected. Device times repeat, and a change kept late would sit behind the cursor.
- **One transaction per change, or no lock**: rejected. A push could be kept in part, and pushes committing out of sequence order could hide a record from a pull.
- **Deleting a record on a tombstone**: rejected. Another device's earlier change would bring it back.
- **Counting records before the push, outside its transaction**: rejected. Two pushes could both pass.
- **`TOO_MANY_RECORDS` as 413 or 422**: rejected. The request may hold one change and is well formed; it conflicts with what is kept.
- **The Session's token as the rate window's key**: rejected. Anyone reading `rate_limits` could sign in with it.
- **The first sign-in remembered in the sync's memory**: rejected. A sync interrupted between pull and push would never push what the Account lacks.
- **Trimming History on every page**: rejected. A later page may bring a newer entry the trim's tombstone would beat.
- **Applying a pull through the tracked write**: rejected. Every pulled record would go back as a newer change.
- **Comparing records as text**: rejected. `jsonb` reorders keys, so every pull would report a change.
- **Showing a 429 at once, as the Account does**: rejected. There is nothing to show, and the next moment would meet the limit again.
- **Forgetting the cursor at once at sign-out**: rejected. A running sync could write the ended Session's cursor after it.
- **The last sync's time in memory only**: rejected. A launch whose first sync fails would show no time.
