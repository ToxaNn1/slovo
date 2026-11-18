---
summary: Once the Feed opened its local day on the Word of the Day's card, that Word takes no other card of the Feed that day, swiped past unseen or in a new Cycle started that day; one chosen anew during the day is not held back (amends 0016).
---

# The Word of the Day takes no ordinary card that day

Owner app pass of 2026-11-18, decision Р8: today's Word of the Day came again later in the same day's Feed as an ordinary card. This ADR amends ADR 0016 (the next card).

**Why.** The Word of the Day opens the Feed's day. A reader who swipes past it before it is Seen left it unseen in the Cycle, so the card order offered it again among the ordinary cards, and a new Cycle started the same day shuffled it in with every other Word. The reader met the day's Word twice, the second time without its red kicker, and the Word of the Day read as an ordinary card.

**Decision.** Once the Feed opened its local day on the card of a Word of the Day, that Word takes no other card of the Feed that day: no new card, no card swiped past too quickly coming again, no Review slot, in the current Cycle or in a new one started that day. The Cycle counts it out when it asks whether unseen Entries are left, so the end-of-Cycle card comes once every other Entry is Seen. The opening card itself stays: the reader can go back to it, and an app run reopened the same day puts it back first (ADR 0016's place). A Word of the Day chosen anew during the day, because the first one left the Cycle (Hidden, Retired, above the Rarity Range), has not opened the Feed and so is not held back. From the next local day the Word is an ordinary Word again, Seen or not.

**Consequences.** A Word of the Day swiped past unseen stays unseen in its Cycle until a later day offers it. A new Cycle started on the day of a Word of the Day is one Word shorter that day. The Feed alone keeps the rule (`ordinary` in `packages/core/src/feed/feed.ts`); the card order and the Word of the Day module are unchanged.

## Considered and rejected

- **Make the Word of the Day Seen as soon as it opens the day**: rejected. Seen is the dwell rule's (ADR 0016), and a quick swipe would put the day's Word in History and the archive unread.
- **Hold back whatever Word of the Day is chosen today**: rejected. A Word chosen anew during the day, on the Dashboard or after the first left the Cycle, never opened the Feed, and holding it back would hide it from the reader all day.
