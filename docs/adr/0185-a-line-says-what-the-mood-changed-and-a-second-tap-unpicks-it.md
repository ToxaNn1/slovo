---
summary: With `moodEffect` on, a line under the Mood check-in says what the picked Mood changed in the Feed (the Mood's `effect`, owned by the Edition and required for every Mood of `dashboardMoods`), and a second tap on the picked Mood unpicks it: the day's record keeps `unpicked`, which reads as asking, and the Feed is back on its plain parameters (amends 0076, 0105).
---

# A line says what the Mood changed, and a second tap unpicks it

Owner app pass of 2026-11-18, decision Р9. This ADR amends ADR 0076 and ADR 0105 for the Dashboard's Mood check-in.

**Why.** A reader who picked a Mood saw a toast with its reply and a red tile, and nothing that said what the Mood did to the Feed. A Mood picked by mistake could only be changed for another one: there was no way back to a day without a Mood.

**Decision.**

- **The effect line.** After a reader picks a Mood, a short line under the tiles of the Mood check-in says what changed in the Feed, and stays while that Mood is the day's. The Edition owns the line: each Mood has an optional `effect` in the Edition's language, and the Edition check refuses an Edition where a Mood of `dashboardMoods` has none. UA: `energetic` «Слова рідкісніші, Виправлень більше.», `joyful` «Більше синонімічних рядів і висловів.», `calm` «Слова простіші, порад більше, Виправлень менше.». The Core hands the line over in the Mood block of the Dashboard and reads nothing in it. The toast with the Mood's reply stays.
- **The unpick.** A second tap on the picked Mood unpicks it: no Mood today, the check-in asks again, the Feed is back on its plain parameters and the line is gone. The Core's `MoodCheckIns.unpick()` writes the day's record with the choice `unpicked`, which reads as asking; the record stays, so the unpick syncs by last write wins as a choice does, and an older app, which does not know the choice, reads it as asking too. An unpicked day counts for no Mood in «Настрої». A skipped day stays skipped. Analytics gets `moodUnpicked` with the Mood's id.
- **The switch.** Both sit behind the Feature Switch `moodEffect`, which depends on `mood`. With it off the Dashboard is as before: no line, and a tap on the picked Mood picks it again.

**Consequences.** The line is the Edition's own wording of its Moods' Feed parameters, so a change to a Mood's `rarityBand` or `shifts` goes with a change to its `effect`; nothing checks that the two agree. A hidden Mood (ADR 0192) needs no `effect`, and a saved one without it shows no line.
