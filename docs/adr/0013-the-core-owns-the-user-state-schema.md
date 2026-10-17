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

## Amendment: the 0.4 records, and which of them sync (0.4)

0.4 declares its records once, up front, in `packages/core/src/user-state-schema.ts`, so the features that fill them in don't collide:

- an Active Day: `activeDays.` + the local date (`YYYY-MM-DD`), holding `true`;
- the notification times: `notifications.times`, a list of local times (`HH:MM`);
- the notification sound: `notifications.sound`, on or off;
- a planned notification: `notifications.plan.` + the local date + `T` + the local time, holding the id of its Word. A Word with such a record is Reserved, so Reserved is never stored on its own;
- the onboarding finished: `onboarding.finished`, the instant it finished.

Every one reads as absent or as the Edition's default (no times record means the Edition's times, no sound record means sound on, no finished record means the onboarding opens), so 0.4 adds no migration and the `records` table and the adapters stay as they are. The dates and times hold no `.`, so no prefix overlaps another.

The schema marks how each record syncs when sync arrives (ADR 0005), so 0.8 doesn't have to guess. `device-only` records stay on the device: the notification times, the sound and the plan, because a phone and a tablet may remind the same reader differently and the plan is built from the device's own permission and local time. `union` records of every device are all kept: the Active Days, so the Streak derived from them is the same everywhere. A record with no mark syncs by last write wins, one record at a time, as before.

An empty list of times is stored as an empty list, not as an absent record or a deleted one. Absent means "the Edition's default times", so deleting the record on the last removal would bring the defaults back instead of stopping the notifications.

## Amendment: a Word opened from a notification is Seen in one write with History and today's Active Day (0.4)

The glossary's Seen also covers a Word the reader opened from a notification, so the Feed is no longer the only way into History. The composition's "opened from a notification" call writes the Seen mark, the History entry and today's Active Day in one write. The Feed module keeps it: it writes it in turn with its cards through the same step as a card leaving the screen, so a new Cycle never starts between the Seen mark and its commit. The History entry is the Word of the Day's card only when the Word is today's Word of the Day. A Word the Cycle no longer covers (Hidden, Retired, out of the Mix) or one Seen already gets only the Active Day, so a Hidden Entry never re-enters History, and opening the same Word again writes nothing.

Progress returns the Active Day as a change with a commit step, like the Cycle, so its record goes into that one write; recording today on its own (the composition opening, the app returning to the foreground) writes the same change alone.

## Amendment: the onboarding finished stays on the device (0.4)

The 0.4 records listed above left `onboarding.finished` unmarked, so it would sync by last write wins. It is now `device-only`. The onboarding ends with the ask for permission to notify, and that permission belongs to each device: a reader who finished it on a phone is still asked on a tablet. The record changes only its mark, so there is still no migration.

### Considered Options

- **Last write wins, as unmarked**: rejected. A second device would skip the onboarding and never ask for its own permission there.

## Amendment: the Word of the Day reads the Reserved Words while a day has no Word yet (0.4)

The Word of the Day still reads its own record once, when it opens. From 0.4 it also reads the Reserved Words (ADR 0021) while today has no Word of the Day kept, or the kept one is no longer eligible: the day change asks it to take the Word of the day's morning notification (ADR 0022), and `today` does the same before it chooses. Once the day's Word is kept, nothing is read until the next local day, so the Feed still never waits on a read for a card after the day's first one.

The read stays because the plan writes its records during the session: last evening's plan Reserves this morning's Word, and only the plan records say which Word that is.

### Considered Options

- **Keep the Reserved Words in memory in the Word of the Day**: rejected. Every plan would have to hand its records over, and the copy would repeat the plan records, which ADR 0016's amendment for 0.4 already rejects.
- **Read the plan records once, when the Word of the Day opens**: rejected. An app left open over midnight would miss the morning Word the evening's plan Reserved.

## Amendment: the best Game result keeps the higher value (0.5)

0.5 adds one record: `game.best`, the best result, a whole number of Rounds passed from 0 to 15 (ADR 0024). It reads as absent until the first finished Game, so there is still no migration and the `records` table stays as it is.

It takes a new sync mark, `highest`: sync keeps the higher of two devices' values. Last write wins would let a phone's lower result replace a tablet's higher one, and a best result never goes down. The Game reads the record once, when it opens, and writes it before it shows the finished Game, as a Cycle change is written before it is made in memory, so a failed write leaves the Game answered and «Далі» tries again.

## Amendment: the last content update check stays on the device (0.7)

0.7 adds one record: `contentUpdate.checkedAt`, the instant the last check for a content update started (spec #333). It reads as absent until the first check, so a check is due and there is still no migration. It is `device-only`: the pack the check downloads is kept on this device only, so another device's check says nothing about it. A check writes the record before it asks the backend, so a check that fails, or an app closed in the middle of one, still waits a day for the next, and the app asks at most once a day.
