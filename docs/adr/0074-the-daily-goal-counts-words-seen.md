# The Daily Goal counts Words Seen, and onboarding asks the Notification time after it

ADR 0066 counted the Daily Goal in XP, which viewing Words never earns, so a reader who only reads the Feed never met it. Owner decision 04.11 (spec #1553): the Daily Goal becomes a number of Words Seen per local day. This amends ADR 0066 (Daily Goal, Active Day) and reverses part of ADR 0067 (onboarding order, the notification explainer).

**The goal.** The Edition config holds the options and the highlighted one (`dailyGoals`, UA Edition 10 / 25 / 50, 10 highlighted). ЦІЛЬ asks «Скільки слів на день?»; skipping it records no goal. A reader without a goal has none until they choose one: there is no Edition default goal.

**The XP log.** A `word-goal` record sets the goal from its local day on; the last one set on or before a day is that day's goal. When the day's Seen Words reach the goal in force, the log appends a `goal-met` record with the fixed id `goal-met-<date>`, so two devices merge into one and the day stays met whatever goal is set later. A goal changed mid-day applies from today; lowering it to or below today's Seen Words meets the day at once. Settings offers the options and «Без цілі», which records a `word-goal` with no goal (`null`): from that day on the reader has no goal and the 5 XP rule, until they choose one again; a day met before stays met. The `daily-goal` records of ADR 0066 (a goal in XP) still parse and count for nothing.

**The Active Day.** A day with a goal is an Active Day once it is met, not before. A day without a goal is an Active Day with at least 5 XP, as before. Days before this change had no Words goal, so they keep how they were counted.

**Today's progress** reads «N з 10 слів» where the goal is shown; the widget goal ring shows the same count (its `xp` field carries the Words Seen, so the snapshot format stays).

**Seen-Word XP.** A Word Seen for the first time earns `xp.seenWord` (UA Edition 1 XP) through a `seen-word-<Entry id>` record, so it is earned once across devices: only in the first Cycle, for a Word never in History before, and only while today's Seen-Word records are fewer than today's goal in Words. Without a goal viewing earns nothing. A record whose write fails is earned with the next Word Seen.

**Onboarding order.** СЛОВО → ПЕРШЕ → ГРАЙ! → РІВЕНЬ? → НАВІЩО? → ЦІЛЬ → НАГАДУВАННЯ → Feed: the notification question moves into onboarding, after the Daily Goal. This reverses ADR 0067's rule that notifications are first asked through the explainer Feed Notice after the first met Daily Goal.

**The notification step.** НАГАДУВАННЯ asks «Коли нагадати?» and offers three Notification times, «Інший час» and «Без нагадувань». The Edition config holds the three times as `onboardingNotificationTimes` `{ morning, midday, evening }`, in time order (UA Edition 09:00 / 13:00 / 20:30), so the Core stays language-agnostic; analytics counts the answer in the bucket of the time, `other` or `none`. A chosen time replaces the Notification times and asks the device for permission right there; when asking fails, the time stays and onboarding goes on. «Без нагадувань» keeps no time and asks nothing. Either answer marks the reader as asked from the onboarding, so the explainer Feed Notice and its re-ask never come; a reader who skipped the step still gets them as ADR 0067 says.

**Feature Switches.** The Edition switches each part on its own (ADR 0006, 0040): `dailyGoal` (ЦІЛЬ, the Settings row, the progress on the XP bar), `seenWordXp` (the Seen-Word XP), `notificationTimeStep` (НАГАДУВАННЯ) and `notificationExplainer` (the explainer Feed Notice and its re-ask). A step switched off is left out and the step numbers close up.
