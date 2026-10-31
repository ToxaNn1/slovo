# The XP log derives the Streak, the Active Day, the Level, freezes and the Break; the Daily Goal replaces the Daily Limit

Until 1.0 an Active Day was a day on which the app was opened, so scrolling alone kept the Streak, and the Daily Limit (ADR 0054) asked the reader to stop. Spec #1358 adds a learning game that rewards effort: XP, Levels, a Daily Goal, Streak freezes, a Break and Badges, all computed from one log.

**The XP log.** A module of the Core composition keeps an append-only log per Edition. Every record has a unique id, a local date, a time, a kind and an amount. The kinds: XP for a learning action with its source (Game Round, finished Game, Best result, Daily Crossword, Review answer, Quick Question); the Daily Goal set for a day; a freeze consumed; a Break started (start date, length); a Badge earned (Badge id, date). The local date comes from the injected clock and time zone.

**XP.** XP comes only from learning actions. The UA Edition's defaults: a Round answered right 1, a finished Game with at least half the answers right +5, a new Best result +5, the Daily Crossword 15, a Quick Question answered right 2, a Review answer 1 with at most 10 XP a day. Known on a new Entry, Learned, a Streak day, the first visit of the day, sharing and the Word of the Day give 0. A mistake takes nothing away; a Game has no daily cap. The amounts, the ≥50% rule, the Review cap and the Level curve come from the Edition config, so they change with an update and not with a Core release.

**Derived, never stored:** total XP; Level and progress (50 XP for level 1, each level up to 10 costing 10% more than the one before, then 120 XP each, no top; a Level locks nothing); today's XP and goal state; Active Days (a local date with at least 5 XP, plus the Active Days recorded before 1.0, which stay); Streak and Best Streak; freezes held; Break eligibility.

**Streak, freezes, Break.** A day counts once it has 5 XP, separately from the Daily Goal. A new reader holds 2 Streak freezes, gains one for every 7 Streak days and holds at most 2; a held freeze covers a missed day automatically. A missed day with no freeze and no Break resets the Streak; there is no repair. A Break lasts up to 7 days, once every 30 days, is free, and its days keep the Streak without adding to it. The Streak and Best Streak are derived from the log by local date, so every device agrees.

**The Daily Goal.** 10, 20, 30 or 50 XP, chosen in onboarding (ADR 0067) with 20 highlighted, recorded per day in the log. A change applies from the same local day and a day already met stays met; an existing reader defaults to 20 until they choose. The Daily Goal replaces the Daily Limit (ADR 0054), which is retired; «Може, на сьогодні досить?» after 50 distinct Seen Entries, once a local day, never locking the Feed, takes its place as a Feed Notice. The Feed order is Feed Notice, due Review, Quick Question, the rest (ADR 0016).

**Confirmed Entries and Badges.** Badges and the Profile count confirmed Entries: Known on a Review of 7 days or later, or answered right in a Game or a Quick Question (ADR 0043). The Core holds a catalogue of Badge conditions evaluated against the XP log, Knowledge Marks, Best results and the Daily Crossword record. The Edition chooses its Badges, names them and adds its own from the catalogue's parameterised kinds. Earning one appends a record; a Badge is never removed and gives no XP.

**Sync.** XP log records merge as a set union by id, like Knowledge Marks (ADR 0041), across devices and on first sign-in, so totals never double. The backend stores them per Account per Edition (ADR 0030). The contract and the server Core gain the record shape; there is no new sync mechanism. Offline, everything is computed on the device.

**Switches.** Each part has its own Feature Switch, required of every Edition and off or on remotely only downward (ADR 0006, 0040). «Без лічильників» (it replaced «Приховати Серію») hides XP, Level, Streak, celebrations and in-Game XP feedback while counting goes on.

## Considered Options

- **Keep opening the app as an Active Day**: rejected. Scrolling would still keep the Streak.
- **Store the Streak and total XP as fields**: rejected. Two devices would disagree; a log merged by id derives the same numbers everywhere.
- **Repair a lost Streak (paid or free)**: rejected. The Streak stays honest.
- **Daily XP cap in the Game**: rejected. The reader plays as long as they like.
- **Levels that unlock content**: rejected. Nothing waits behind a Level.
- **Keep the Daily Limit beside the Daily Goal**: rejected. Two daily numbers confuse; the 50-Seen Notice keeps the care for the reader's time.
