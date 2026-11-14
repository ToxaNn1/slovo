# 0128 The goal-reached card is a Feed Notice

Status: accepted (owner, 14.11)

## Context

Meeting the Daily Goal (ADR 0074) fired only the Mascot celebration. The board XFeed f4 adds a red Feed card «Ціль дня виконано!».

## Decision

- «Ціль дня виконано!» is a Feed Notice `goalReached`, behind the Feature Switch `goalReachedCard` (needs `xpLog` and `dailyGoal`).
- It comes once today's Daily Goal is met, or as the card after the Word whose Seen meets it. Like every Feed Notice, swiping past it closes it for the local day; the goal is met once a day, so it comes once a day.
- It shows the goal, the Lemmas of the first three Words Seen today (the card names two and «+ ще N» over a goal of three), the Streak unless hidden, and a button that turns to the next card.
- In `FEED_NOTICES` it comes after the offer to save progress and before «Може, на сьогодні досить?».
- The Mascot celebration on the goal met stays.
