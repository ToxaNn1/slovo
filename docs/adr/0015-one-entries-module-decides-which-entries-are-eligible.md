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
