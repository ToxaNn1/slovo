# The Dashboard is the home and Mood sets Feed parameters

**Amended by ADR 0081.** The Dashboard rail headers open the Category screens.

Spec #1564 (owner decisions of 2026-11-04). The app opened straight into the Feed, which left no place to see the day at a glance, and Mood (ADR 0054) was a roulette over hand-tagged Words with no memory and no effect on the Feed. The «Рупор» boards draw the home as a Dashboard.

**The Dashboard is the home.** The route behind the «Стрічка» tab renders the Dashboard: the Word of the Day hero, the Mood check-in, «Попередні слова», the Curated Collections rail and the Correction Types rail. The Feed is opened from it. With `dashboard` off the Feed is the home as before and the «Стрічка» tab opens it. Onboarding still ends on the home route (amends ADR 0067: «the Feed» at its end becomes the home), and every «open the home» path (notification, widget, App Intent, Collection Link) lands on the home route; the «Слово дня» App Intent still lands on the Word of the Day card in the Feed, opened over the Dashboard.

**The reveal goes through the Feed's Seen (amends ADR 0016).** «Розкрити» on the hero shows the Lemma with its Stress and the short Definition and makes the Word of the Day Seen through the Feed's own Seen, so it joins the archive, History and the Seen XP as a dwell would; the Feed stays the owner of Seen. Revealed is derived, not stored: today's Word of the Day is Seen in the current Cycle. «До картки →» opens the Feed on the Word of the Day card. An Entry opened from a previous Word, a Curated Collection or a Correction Type makes nothing Seen, as in Search.

**«Попередні слова».** The block after the Mood check-in shows the three newest days of the Word of the Day archive before today, newest first; a Retired Word stays, fewer days show what there is, and none hides the block. There is no «показати всі». A tap opens the Entry card as Search does: nothing becomes Seen. It sits behind `previousWords`, in effect only while `dashboard` and `wordOfTheDayArchive` are.

**Mood is a set of Feed parameters (supersedes the Mood part of ADR 0054).** The Edition lists its moods (id, name, emoji) and gives each a `rarityBand` (`upper`: the Rarity Ceiling's rarity and the one below it, `lower`: rarities 1 and 2, `whole`; both clip to the Ceiling) and a shift per Entry kind (`less`, `same`, `more`) of the reader's Mix kind weight, clamped to «Менше»…«Більше»; «Вимкнено» is never touched. `dashboardMoods` names exactly four listed ids in display order; the Edition check refuses any other count or an unknown id. The reader chooses a Mood once a local day on the Dashboard («Як настрій?»), can skip it («Не сьогодні», hidden until tomorrow) and change it. The record `{ date, choice }` is per local day, synced last write wins (ADR 0041), feeds the Profile statistics row «Настрої» and the Analytics events `moodChosen` and `moodSkipped` (ADR 0068). The Feed reads the day's parameters for each card it adds: the Cycle's first unseen Words of the band come first, the rest follow when the band is empty (so the Cycle still ends), and a kind's turns use the shifted weight. The Rarity Ceiling is never crossed and never lowered. Reviews, the Review slot, the Quick Question, the Word of the Day, Feed Notices, notifications, widgets, the Game and the Daily Crossword ignore Mood. No Mood means the Feed exactly as before.

**What goes.** The mood roulette, the 🎲 header button, `openedFromMood`, the Core mood draw and the Words' `moods` field (content, content CLI, contracts, the pack table). The pack format rises because the table goes (amends ADR 0032). The `moods` Feature Switch leaves the ADR 0054 list; there is no stored mood state to migrate.

**Curated Collections.** A «Добірка» is an editorial list of Entries shipped in the Language Pack with an id (ADR 0010), a name, a description, a publish date and ordered Entry ids; the build refuses an unknown or Retired Entry, a duplicate id and an unreadable date. It unlocks on its publish date. The rail shows unopened ones first («Нова»), then newest first, ten at most; the opened ids are a synced set in the user state. «+ Додати» copies it through the same Collection copy as «Додати собі» and the copy records its source, after which the rail shows «Додано ✓». «Знаю X з N» reads the Known Knowledge Mark. The UA Edition ships the schema and logic with `curatedCollections` off until a content spec.

**Correction Types rail.** One tile per Correction Type the pack has Corrections for, «Розібрано X з N»; the type's screen lists its Corrections with «Як правильно?» revealing the standard form in place. «Розібрано» is a synced, never-shrunk set of Correction ids that grows when a Correction is Seen in the Feed or revealed on that screen. No «Додати».

**Tab bar.** Стрічка · Ігри (absent with `game` off) · Збережене · Профіль. It is shell only, with no Core change and no switch.

**Feature Switches** (required of every Edition, ADR 0040): `dashboard` (needs `wordOfTheDay`), `mood`, `previousWords` (also `wordOfTheDayArchive`), `curatedCollections` and `correctionTypes` (also `corrections`); the last four need `dashboard`. The UA Edition has all on but `curatedCollections`.

## Considered Options

- **Keep the roulette and add the Dashboard beside it**: rejected. Mood would mean two things, and a random Word only duplicates the Feed.
- **Mood as a tag on Words**: rejected. It needs hand-tagging (14–15 Words per mood) and cannot shape the Feed.
- **Let a Mood lower or raise the Rarity Ceiling**: rejected. «Рідкість» stays the one setting (ADR 0072).
- **Store "revealed" for the hero**: rejected. Seen in the current Cycle already says it; a Cycle that restarts mid-day shows the hero unrevealed again, which is accepted.
- **Categories on the Dashboard**: rejected. They stay under the hood in the Mix and the interests.
- **Mix Curated Collection Entries into the Feed**: deferred.
