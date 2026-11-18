---
summary: The Core's `CounterReads` and the Shell's `counterReads` are gone with the Community Counters line (0176); the device still counts and sends, the backend still answers (amends 0060).
---

# The device no longer reads the Community Counters

Owner app pass of 2026-11-18, decision Р26. This ADR amends ADR 0060 for the part «The device reads counters» and «The line».

**Why.** The Community Counters line under an Entry's mark buttons was the only consumer of the Core's `CounterReads`. ADR 0176 retired `swipeMarks` in its new version: the action row, its «Знаю»/«Не знаю» buttons and its Community Counters line are gone, so nothing on the device shows the numbers any more, and `CounterReads` stayed as dead code wired into the Shell.

**Decision.** The Core drops `openCounterReads`, `CounterReads` and `CounterLine`, and the Shell of `apps/mobile` drops `counterReads`. The device no longer asks `GET /v1/counters` and shows no line. Everything else in ADR 0060 holds: the device still counts and sends its deltas, the backend still keeps and answers the counts (the endpoint stays for a later consumer), and the Community Word is unchanged. The `counters.read.<entry id>` record stays, since the sending of the Community Counters still writes and reads what this device counted there (ADR 0013).

**Consequences.** Less code to keep in step with the contract. A later screen that shows the counts brings its own read, designed for that screen.
