---
summary: A due Entry whose card the reader read in this app session today and passed without a Knowledge Mark takes no Review slot or turn again that day; it stays due in «Вчу» and the Game and comes back the next day (amends 0043).
---

# A Review passed without a mark waits until the next day

Owner report of 2026-11-18, decision «варіант А»: with the Rarity Range widened to 5 the Word «аблаут» came three times in about ten swipes of the Feed. This ADR amends ADR 0043 (which due Entry a slot takes).

**Why.** «аблаут» was due for Review. ADR 0043 gives every 3rd card of the session to a due Word until the reader answers it, and a swipe up is no answer, so the one due Word came back slot after slot. A Rarity Range of «лише 5» leaves few due Words in the Cycle, often one, so the same Word took every Review slot. The live pool was not the cause: 193 live Words have rarity 5, and the Cycle shows none twice before all are shown.

**Decision.** Once the reader has read a due Entry's card in the Feed, on screen long enough to be Seen (ADR 0016's dwell), and left it without a Knowledge Mark, that Entry takes no Review slot and no Review turn of its kind for the rest of the local day. It stays due: «Вчу», the Game and an Entry screen still show it as a Review, and from the next local day it takes the slots again by ADR 0043. A card swiped past too quickly to be Seen counts as not read and comes back at a later slot as before. The Feed keeps the days the cards were read in memory for the app session; no record is added and nothing syncs. No Feature Switch: this corrects how the Review slots of `knowledge` behave.

**Consequences.** A reader who passes every Review by swiping up meets each due Entry once a day in the Feed instead of every 3rd card. An app run started again the same day may show a passed Review once more, because the day it was read is not stored. The rule lives in the Feed (`readToday` in `packages/core/src/feed/feed.ts`); the card order and the Knowledge module are unchanged.

## Considered and rejected

- **Space the same Review at least 10 cards apart, twice a day at most**: rejected by the owner (variant Б). Two new numbers to explain, and the Word still repeats.
- **Keep the order and add a hint to the Review card**: rejected by the owner (variant В). The repeats stay for a reader who doesn't answer.
- **Store the day a Review was passed in the user state**: rejected for now. A new synced record for a rare case; the in-memory day covers one reading session, where the repeats were seen.
- **Read History for the day the Entry was Seen**: rejected. History is written only when an Entry becomes Seen in the Cycle, so a Review of an Entry Seen earlier in the Cycle never reaches it again.
