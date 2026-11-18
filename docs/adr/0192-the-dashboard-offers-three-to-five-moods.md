---
summary: `dashboardMoods` names three to five Moods (UA: Бадьоро, Радісно, Спокійно; «Сумно» and «Закохано» hidden), a hidden Mood stays in `moods` so a saved one still reads, and three Moods sit in one row (amends 0076, 0105).
---

# The Dashboard offers three to five Moods

Owner app pass of 2026-11-18, decision Р31. This ADR amends ADR 0076 and ADR 0105 for the number of Moods the Dashboard's Mood check-in offers.

**Why.** On the UA Edition «Сумно» (`sad`) and «Закохано» (`in-love`) change nothing in the Feed: they have no `rarityBand` and no shifts, so choosing them only says a reply. The owner hides them for now, which «exactly five» did not allow.

**Decision.** `dashboardMoods` names three to five ids among `moods`, in display order; the Edition check refuses any other count or an unknown id. The UA Edition offers Бадьоро, Радісно, Спокійно (`energetic`, `joyful`, `calm`). A Mood the Dashboard hides stays in `moods`: a saved Mood of the day, synced or chosen before, still reads among all the Edition's moods and still sets the Feed's parameters and counts in `daysByMood`; only a new choice must be one the Dashboard offers. Three Moods sit in one row of three; four or five keep two to a row, the fifth half a row beside an empty cell.

**Consequences.** An Edition turns a Mood off the Dashboard by editing one list, without losing the readers' saved days. Bringing «Сумно» and «Закохано» back, with their own Feed parameters, is a later change to the same list.
