---
summary: A Game of «На час» (`timed`) lasts 60 seconds of play, then goes straight to «ФІНІШ» with no «Час!» poster; no Feature Switch picks the length (supersedes the 20 seconds of 0137).
---

# A timed Game lasts sixty seconds

Owner decision of 2026-11-19 (ticket #2067).

**Why.** 20 seconds is too short: a player answers only a handful of Words before the time is up.

## Decision

- `timedMode.timeLimit` is 60 000 ms of play. The clock stops while the app is in the background, as before.
- When the time is up the result screen opens on «ФІНІШ», with no «Час!» poster.
- The mode card says «60 с» and «Шістдесят секунд. Скільки слів встигнеш?».
- No Feature Switch chooses the length. The old `timedTwentySeconds` switch was already gone from the contracts and the code; only a stray doc comment was left, and it is removed.
- This replaces the 20 seconds of ADR 0137 (removed, see `retired.md`).
