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
