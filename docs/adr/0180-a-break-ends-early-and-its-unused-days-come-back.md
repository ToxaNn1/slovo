# A Break ends early and its unused days come back

Owner decision of 2026-11-18, after the app pass (finding 72: a Break once started could not be ended; the only way out was «Скинути прогрес»). This ADR amends ADR 0066.

**Ending a Break.** While a Break runs, the Break screen shows «Завершити перерву» under the line of its last day. It ends the Break today: the XP log appends a Break-ended record (the local date it ends on, the Break's start date and the instant that Break was started). The Break then covers only the days before today; today and the days after it count as ordinary days again (a missed one takes a freeze or resets the Streak), and the reminders come back. A Break ended on its first day covers no day. The record has one id per Break (`break-end-<start>`); of two devices that end the same Break on different days the earlier day holds. A Break started again on the day one ended, later than that end, is not ended by it.

**The allowance.** A Break is no longer one per 30 days: the reader has 7 Break days in the 30 days from the first Break of them. A Break takes 1 to the days left; days a Break did not use, because it was shorter or ended early, stay for a later Break in the same 30 days. Once the 7 days are spent, the screen says the day the next 30 days start; from then the reader has 7 days again. Choosing a short Break and ending a long one early give the same result, so no length is better to pick.

**Unchanged.** A Break is free, starts today, lasts 1 to 7 days, keeps the Streak and adds nothing to it; it is derived from the XP log by local date on every device; a Progress reset (ADR 0133) folds only the Breaks and their ends after its marker. An older app that does not know the Break-ended record drops it and still sees the whole Break.

## Considered Options

- **End early, the rest of the 30-day wait stays**: rejected by the owner: a reader who came back early would lose the days.
- **End early cancels the 30-day wait**: rejected: ending on day 1 would then allow Breaks back to back without a limit.
- **Return only the days of an ended Break, not of a short one**: rejected: it would teach the reader to always start 7 days and end early.
