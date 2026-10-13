# The Core owns the user-state schema; adapters store text records by key

The user state (settings, and from 0.2 on the Feed's Seen, Cycle and Word of the Day) lives behind a narrow Core port: get one text record by key, and write a batch of changes all at once or not at all. The Core owns everything about what is stored: the keys, the encoding of each value and the schema version. The schema version is itself a record. On open, the Core brings an older schema forward one migration at a time, writing each step together with its version so an interrupted upgrade resumes where it stopped. Migrations are forward-only: a step that has shipped is never edited or removed, and a schema newer than the app knows is refused and left untouched.

The adapters only keep records: in memory for tests, and one `records (key, value)` table in a writable SQLite database apart from the Language Pack in the app. Its layout never changes, so the adapters need no migrations of their own, and one contract suite holds both to the same behaviour, migrations included.

Per-record keys (one record per setting, and later one per Favorite or Collection) keep the door open for last-write-wins sync per record (ADR 0005).

## Considered Options

- **SQL tables per feature, with SQL migrations in the SQLite adapter**: rejected for now. Every feature would be written twice (SQL and in memory) and the schema would live outside the Core, so the in-memory adapter could not prove a migration. Revisit if a feature needs queries over many records that JavaScript can't handle at its size.
- **One JSON document for the whole user state**: rejected. Every change would rewrite everything, and sync could not resolve conflicts per record.

## Amendment: listing records by key prefix (after 0.2)

One record per Favorite or per Collection only works if the Core can find them all, so the port gains a third operation: list every record whose key starts with a prefix. The prefix is matched as it is, with case counting and no wildcards (the SQLite adapter uses `instr`, since `LIKE` ignores case and reads `%` and `_` as wildcards), and the records come in no set order. The contract suite holds both adapters to it. The `records` table is unchanged.

The Core declares each record once, in `packages/core/src/user-state-schema.ts`: a key, or a key prefix for records of one kind, and the schema of the value. Every value is kept as JSON and read through its schema, so a record that holds no value of its schema reads as absent. 0.2 kept the settings as bare text, so migration 2 re-encodes them as JSON; the other 0.2 records were JSON already and keep their keys.

## Amendment: Seen per Entry, and state kept in memory for the app session (after 0.2)

0.2 kept Seen as one array record, `feed.seen`, and every Seen mark rewrote the whole array. That is the one-JSON-blob shape this ADR rejected: two devices' Seen sets could not merge under last-write-wins sync (ADR 0005). Seen is now one record per Entry, `feed.seen.` + Entry id, holding `true`. Migration 3 splits the stored array into those records and deletes `feed.seen` in one write; an array that does not parse is dropped, since 0.2 read nothing Seen from it either. Starting a new Cycle deletes every `feed.seen.` record it can list in the same write as the new Cycle, also records it never read.

The Cycle and the Word of the Day read the user state once, when they open, and keep it in memory for the app session, so the Feed never waits on a read to pick its next card. The trade-offs:

- **One of each per app session, shared.** A second instance over the same user state would not see the first one's changes. So the shell opens one Cycle and one Word of the Day per app session and hands them to the Feed, and later to History, notifications, the widget and the Game; the Feed no longer opens its own.
- **A change is made in memory only after its write.** A Cycle change (a Seen mark, a new Cycle) returns the user-state changes that keep it and a commit step. The caller writes the changes, alone or in one write with its own (the Word of the Day writes a new Cycle with its choice), and commits once the write succeeds. A failed write is never committed, so memory and the user state agree and the next try starts one new Cycle, not two. The Word of the Day keeps its choice in memory the same way. The caller must commit one change before it asks for the next; the Feed does this by writing and committing in its one-request-at-a-time queue.

### Considered Options

- **Keep Seen as one record and say so here**: rejected. History (0.3) and sync (0.8) build on Seen, and a later split would need the same migration with more data to carry.
- **The Cycle writes its own changes**: rejected. Callers need a Cycle change in the same write as their own records (the Word of the Day now, History in 0.3), so the Cycle would need to take extra changes, and the Word of the Day must choose from the new Cycle's order before anything is written.
- **Read the user state on every question**: rejected for now. The Feed asks for the unseen Entries on every card, and a shared instance per session gives the same consistency without the reads. Revisit when sync can change records under a running app.

## Amendment: History joins the Feed's Seen write (0.3)

History is one record per Entry, `history.` + Entry id, holding the instant it was Seen and whether it was the Word of the Day's card. An Entry joins History only when it becomes Seen in the Feed, in the same write as its Seen mark (ADR 0018): going back to a card already Seen in the Cycle records nothing, and an Entry Seen again in a later Cycle moves to the top with the new time. The write that adds the 501st entry also deletes the oldest. History starts empty in 0.3: 0.2 kept no times for what was Seen, so there is nothing to bring forward.

Here the Feed hands its changes (the Seen mark and its position) to History, which writes them with its own record in one write and then updates its list; the Feed commits the Cycle change after that write, as before. History does not return a change for the Feed to write, unlike the Cycle, because clearing History runs outside the Feed. History takes its record and a clear one at a time, so a clear never lands between a record's choice of the entry to evict and its write.
