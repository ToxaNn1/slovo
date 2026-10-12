# One Entries module decides which Entries are eligible

The Core's Entries module is the only place that decides which Entries may appear anywhere new: in the Feed, the Word of the Day, and later notifications, widgets and the Game. An eligible Entry is live (not Retired) and of a kind the Edition turns on; from 0.3 it is also in the user's Mix and not Hidden. The Feed, the Cycle, the Word of the Day and the card builders ask the Entries and never check Retired or a Feature Switch themselves. Any Entry stays reachable by id, Retired or switched off, so Favorites, Collections and History keep showing what the user kept.

The content read port lists live Entries only, so a pack answers with one indexed query instead of reading every Entry, and it lists the Words of one Category, so the Mix costs one query per Category. One contract suite holds both adapters, the in-memory one the Core ships for tests and the pack reader, to the same answers.

A change of eligibility applies at once, not from the next Cycle: a Cycle covers the Entries eligible when it opens or starts, and when the Mix or the Hidden Entries change, the Cycle reads the eligible Entries again, keeping its seed and what is Seen. No caller filters card by card.

## Considered Options

- **Each feature checks the rules it needs**: rejected. Retired was checked in four places and the Corrections Feature Switch in three, and Mix and Hidden would add two more rules to the Feed, notifications, widgets and the Game each.
- **The Core filters Retired Entries out of everything the port lists**: rejected. Listing ids would mean reading every Entry in full, about eight queries per Word.
- **Eligibility changes apply from the next Cycle**: rejected. A Hidden Entry must never appear again, and a Cycle can last weeks.
