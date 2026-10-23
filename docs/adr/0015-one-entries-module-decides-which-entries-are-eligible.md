# One Entries module decides which Entries are eligible

The Core's Entries module is the only place that decides which Entries may appear anywhere new: in the Feed, the Word of the Day, and later notifications, widgets and the Game. An eligible Entry is live (not Retired) and of a kind the Edition turns on; from 0.3 it is also in the user's Mix and not Hidden. The Feed, the Cycle, the Word of the Day and the card builders ask the Entries and never check Retired or a Feature Switch themselves. Any Entry stays reachable by id, Retired or switched off, so Favorites, Collections and History keep showing what the user kept.

The content read port lists live Entries only, so a pack answers with one indexed query instead of reading every Entry, and it lists the Words of one Category, so the Mix costs one query per Category. One contract suite holds both adapters, the in-memory one the Core ships for tests and the pack reader, to the same answers.

A change of eligibility applies at once, not from the next Cycle: a Cycle covers the Entries eligible when it opens or starts, and when the Mix or the Hidden Entries change, the Cycle reads the eligible Entries again, keeping its seed and what is Seen. No caller filters card by card.

## Considered Options

- **Each feature checks the rules it needs**: rejected. Retired was checked in four places and the Corrections Feature Switch in three, and Mix and Hidden would add two more rules to the Feed, notifications, widgets and the Game each.
- **The Core filters Retired Entries out of everything the port lists**: rejected. Listing ids would mean reading every Entry in full, about eight queries per Word.
- **Eligibility changes apply from the next Cycle**: rejected. A Hidden Entry must never appear again, and a Cycle can last weeks.

## Amendment: the Cycle order is a function of the seed and each Entry (0.3)

Reading the eligible Entries again must leave the order of the Entries that stay as it was, and give an Entry that is eligible again back its place, also across a restart, when the Cycle shuffles the eligible Entries of that moment with its seed. A shuffle that draws from a generator one Entry at a time gives a different order as soon as one Entry leaves. So each Entry's place is a hash of its id that starts from the seed, and the Cycle order is the Entries sorted by it. The seed and Seen stay as they were; a Cycle open when this shipped shows its unseen Entries in a new order once.

### Considered Options

- **Keep the shuffled order in memory and only remove or insert the Entries that change**: rejected. A restart shuffles the Entries eligible then, so the order would change anyway, and an Entry eligible again would have no place to go back to.
- **Keep the whole order in the user state**: rejected. One record for the Cycle order is the one-blob shape ADR 0013 rejects, and the order follows from the seed.

## Amendment: the Entries say why a kind is not eligible, and read the pack's Entries once (after 0.5)

A feature that weighs every eligible Entry of a kind at once, such as the Game planning its Rounds, asks the Entries for them and gets either the Entries or why the kind as a whole is not eligible: Corrections out of the user's Mix, whether or not the Edition turns them on. The Game passes that reason on and never reads the Mix itself (ADR 0024).

The live Entries themselves are read from the Language Pack once per Entries module, so once per app session: a pack never changes while it is open, and reading every Word in full costs about 0.4 s. Each call still reads the eligible ids afresh and filters the live Entries by them, so a change of eligibility applies at once. A read that fails is tried again on the next call.

## Amendment: due Entries come back on top of the Cycle order (0.8.6)

ADR 0043 puts Review slots in the Feed: a due Word in every 3rd Word slot and a due Correction in the next Correction slot. A due Entry that is Hidden or not eligible is skipped until it is eligible again, so the Entries module still decides eligibility alone, now also under a Rarity Floor. The Cycle order itself doesn't change.

## Amendment: the Entries the user keeps are read together (whole-project review fix, B4)

Favorites, the Hidden Entries, Collections, History and the Knowledge Marks read the row of every Entry they keep when the composition opens, and the notification plan reads every Word it plans. Each of them read one Entry by id at a time: about eight queries per Word, and eleven per Correction, which is asked for as a Word first. A reader with a few hundred kept Entries waited for thousands of queries at every launch and every reopen, and a plan of 64 Words made about 500 queries one after another.

The content read port now also gives the Words and the Corrections of many ids at once (`getWords`, `getCorrections`), one query per table for every 500 ids, and the Entries module gives any Entries by id together (`getMany`): the Words first, and only the ids that are no Word as Corrections, as `get` does for one. Each list asks for the rows of its Entries together, and the plan for its Words, so each costs at most eleven queries however many Entries it holds. A row read once is still kept for the app session, and a read that fails is still tried again on the next call.

### Considered Options

- **Read the kept Entries from the live Words the Entries module already keeps**: rejected. That read takes every Word in full, about 0.4 s, and the composition plans the Game Modes last so the launch never waits for it; a reader with one Favorite would wait for it at every launch, and Retired Words and Corrections would still need reads of their own.

## Amendment: Idioms are eligible like Corrections (0.8.8)

ADR 0046 makes the Idiom the third kind of Entry, turned on through the Feature Switch `idioms`, with the Edition's default Mix saying whether Idioms are in. The Entries module alone decides their eligibility, by the same rules as Corrections: a live Idiom is eligible when the Edition turns Idioms on and they are not off remotely (ADR 0040), when Idioms, as a whole, are in the reader's Mix and when it is not Hidden. The Rarity Floor doesn't touch Idioms, which have no rarity. The ids of the eligible Entries carry the Idioms as a third list, in the Language Pack's stable order, and the eligible Entries of the kind `idiom` come with a refusal of their own, Idioms out of the Mix, whether or not the Edition turns them on, so the Game can pass it on as it does for Corrections (ADR 0024).

The reader's choice is one new record in the user state, `mix.idioms`, kept and synced last write wins by the client's change time like `mix.corrections` (ADR 0041); a new key needs no migration, since without it the Edition's default holds. The Cycle covers the eligible Idioms in its order from this change on, so a Seen mark on an Idiom counts and an Idiom keeps its place when eligibility is read again; the Feed deals them from its own ticket (ADR 0046, the Idiom turn).

### Considered Options

- **A kind-agnostic list of eligible ids**: rejected. The Feed, the Cycle, the notification plan and the Game each take one kind at a time, and the Correction's turn and the Idiom's turn count their own kind.
- **One Mix record for Corrections and Idioms together**: rejected. Each is a switch of its own on the Mix screen, and one record would merge two devices' choices into one write.

## Amendment: the content read port gives any Entry by id, from the pack's kind of Entry (architecture review 4)

The port grew three getters with every kind of Entry (one by id, many by id, and the kind's live ids), and `get` and `getMany` asked them kind by kind, a Word first, although the Language Pack records every Entry's kind in its `entries` table since format 1. The per-kind getters by id are gone: the port gives the Entries of any ids, whatever their kind, in one call (`getEntries`), a Retired Entry included, so kept Entries stay reachable (ADR 0046). The pack reader asks the `entries` table which kind each id is, one query per 500 ids, and then reads each kind present at once, as before; the in-memory adapter answers from the Entries it holds. The Entries module reads one Entry or many in that one call, and the live Corrections and Idioms by their listed ids the same way. The port still lists the live ids of each kind, which the eligibility and the Feed need, gives every live Word at once for the Game's Distractors, and lists the Words a Correction links. Both adapters hold to the one contract suite.

### Considered Options

- **A kind-agnostic getter beside the per-kind ones**: rejected. Two paths to one Entry, and the port would still grow with every kind.
- **The Entries module keeps asking kind by kind, in parallel**: rejected. Three reads of the pack for one id the pack can name in one, and the next kind adds a fourth.
