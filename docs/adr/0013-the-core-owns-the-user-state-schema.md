# The Core owns the user-state schema; adapters store text records by key

The user state (settings, and from 0.2 on the Feed's Seen, Cycle and Word of the Day) lives behind a narrow Core port: get one text record by key, and write a batch of changes all at once or not at all. The Core owns everything about what is stored: the keys, the encoding of each value and the schema version. The schema version is itself a record. On open, the Core brings an older schema forward one migration at a time, writing each step together with its version so an interrupted upgrade resumes where it stopped. Migrations are forward-only: a step that has shipped is never edited or removed, and a schema newer than the app knows is refused and left untouched.

The adapters only keep records: in memory for tests, and one `records (key, value)` table in a writable SQLite database apart from the Language Pack in the app. Its layout never changes, so the adapters need no migrations of their own, and one contract suite holds both to the same behaviour, migrations included.

Per-record keys (one record per setting, and later one per Favorite or Collection) keep the door open for last-write-wins sync per record (ADR 0005).

## Considered Options

- **SQL tables per feature, with SQL migrations in the SQLite adapter**: rejected for now. Every feature would be written twice (SQL and in memory) and the schema would live outside the Core, so the in-memory adapter could not prove a migration. Revisit if a feature needs queries over many records that JavaScript can't handle at its size.
- **One JSON document for the whole user state**: rejected. Every change would rewrite everything, and sync could not resolve conflicts per record.
