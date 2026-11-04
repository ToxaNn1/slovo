# The Daily Goal counts Words Seen, and onboarding asks it before the reminder

ADR 0066 counted the Daily Goal in XP, which viewing Words never earns, so a reader who only reads the Feed never met it. Owner decision 04.11 (spec #1553): the Daily Goal becomes a number of Words Seen per local day. This amends ADR 0066 (Daily Goal, Active Day) and ADR 0067 (onboarding order).

**The goal.** The Edition config holds the options and the highlighted one (`dailyGoals`, UA Edition 10 / 25 / 50, 10 highlighted). ЦІЛЬ asks «Скільки слів на день?»; skipping it records no goal. A reader without a goal has none until they choose one: there is no Edition default goal.

**The XP log.** A `word-goal` record sets the goal from its local day on; the last one set on or before a day is that day's goal. When the day's Seen Words reach the goal in force, the log appends a `goal-met` record with the fixed id `goal-met-<date>`, so two devices merge into one and the day stays met whatever goal is set later. A goal changed mid-day applies from today; lowering it to or below today's Seen Words meets the day at once. The `daily-goal` records of ADR 0066 (a goal in XP) still parse and count for nothing.

**The Active Day.** A day with a goal is an Active Day once it is met, not before. A day without a goal is an Active Day with at least 5 XP, as before. Days before this change had no Words goal, so they keep how they were counted.

**Today's progress** reads «N з 10 слів» where the goal is shown; the widget goal ring shows the same count (its `xp` field carries the Words Seen, so the snapshot format stays).

**Onboarding order.** СЛОВО → ПЕРШЕ → ГРАЙ! → РІВЕНЬ? → НАВІЩО? → ЦІЛЬ → НАГАДУВАННЯ → Feed: the notification question moves into onboarding, after the Daily Goal.
