# 0129 The goal-reached card is a Feed Notice

Status: accepted (owner, 14.11)

## Context

Meeting the Daily Goal (ADR 0074) fired only the Mascot celebration. The board XFeed f4 adds a red Feed card «Ціль дня виконано!».

## Decision

- «Ціль дня виконано!» is a Feed Notice `goalReached`, behind the Feature Switch `goalReachedCard` (needs `xpLog` and `dailyGoal`).
- It comes once today's Daily Goal is met, or as the card after the Word whose Seen meets it. Like every Feed Notice, swiping past it closes it for the local day; the goal is met once a day, so it comes once a day.
- It shows the goal, the Lemmas of the first three Words Seen today (the card names two and «+ ще N» over a goal of three), the Streak unless hidden, and a button that turns to the next card.
- In `FEED_NOTICES` it comes after the offer to save progress and before «Може, на сьогодні досить?».
- The Mascot celebration on the goal met stays.
- The card enters as the board draws it (`fgIn`, `fgBand`, `fgTitle`, `fgWord`, `slCasc`, `fgMascot`, `fgShard`) on one clock that starts once its page is on screen; `slCasc` is `motion.cascade`, the rest are the card's own tokens. React Native has no `clip-path`: the card is uncovered from its foot up by a frame that drops while its inside lifts, with a straight edge where the board's is slanted, and each Word plate draws its cut corners as an SVG polygon, which also leaves out the plate's shadow the board's `clip-path` hides. Under Reduce Motion nothing moves and no shards fly; the card fades in once (ADR 0055).
