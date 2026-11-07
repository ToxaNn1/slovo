# Badge families, two new Badge kinds, the `badge-opened` record and a rolling calendar

Board 10 «Профіль і відзнаки» groups Badges in six families with their own shape and tone, marks a new Badge «НОВА» until the reader opens it, draws Break and frozen days in the Active Days calendar and shows that calendar as a run of days across months (spec #1641). ADR 0066 has none of this: its Badges carry no family, its catalogue has no Badge for a clean Game or a run of right answers, and its calendar is a month. This amends ADR 0066; the Level curve and every other number of 0066 stay.

- **Badge families are Edition config.** An Edition declares an ordered list of Badge families, each with an id, a name, a description, a shape (`hexagon`, `shield`, `circle`, `tile`, `wedge`, `diamond`) and a tone (`red`, `ink`, `cream`), and every Badge names one of them. Loading refuses a Badge whose family is not declared. The UA Edition declares the board's six: Серія, Підтверджені, Перші перемоги, Кросворд, Рівні, Майстерність.
- **Two parameterised kinds join the catalogue:** `flawlessGame { modes }`, a finished Game in one of the modes with every Round right, and `rightRun { modes, count }`, `count` right answers in a row in the modes, broken by a wrong answer in them. The Game's records carry what they read: a finished Game's record its right answers and Rounds played, and a Round answered wrong a `wrong-answer` record with its Game Mode, which gives no XP and syncs by id like every other record. A record from before them reads as no flawless Game and no wrong answer; a Badge already earned keeps its date whatever its condition becomes.
- **The XP log gains a `badge-opened` record** with the Badge id, a date and a time. An earned Badge with no such record is new and carries «НОВА». The record gives no XP and syncs by id like every other record, so opening a Badge on one device clears «НОВА» on all of them.
- **The calendar's day states gain `break` and `frozen`,** derived from the Break and freeze records already in the XP log.
- **The Active Days calendar is a rolling window of 35 days** ending with the current week, not a calendar month, so a run is never cut at a month's edge.
- Each new part of board 10 is behind its own Feature Switch, off until its ticket ships: `levelLadder`, `newLevelScreen`, `badgeSheet`, `badgeToast`, `streakFreezeCard`, `breakCard`, `calendarDayLines`. Each needs `xpLog`; `badgeSheet` and `badgeToast` also need `badges`.

## Considered options

- **Families as a fixed Core list**: rejected. The Core stays language-agnostic and an Edition names and groups its own Badges (ADR 0065).
- **Keep «НОВА» on the device only**: rejected. The reader would see it again on every other device; the XP log already syncs by id.
- **Keep the month calendar and add Break and frozen days to it**: rejected. The board draws a run across months, and a month view hides a Streak that crosses the 1st.
