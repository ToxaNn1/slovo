---
summary: The Rounds about Entries the reader is weak on take places drawn at random among the first 15 Rounds of a Game, each Round built at its own place, a weak Round that cannot be built there moving to the next place (amends 0052).
---

# Weak Rounds take random places among the first 15 Rounds

Owner app pass of 2026-11-18, decision Р24: after a wrong answer every Game Mode that asks about Words started with the same Word. This ADR amends ADR 0052 (and the Round order ADR 0043 left to it).

**Why.** A wrong answer marks its Entry Unknown (ADR 0043), and the Round plan put the Rounds about Entries the reader is weak on, Unknown or due for Review, first in every Game Mode. With one or two such Entries, each Game of each mode opened with them, so the reader met the same Word at the start of «Вгадай слово», «Анаграми», «Наголос» and the rest, and the Games read as broken.

**Decision.** A Game still asks about up to 5 Entries the reader is weak on (ADR 0043), in every Game Mode, and still early: their Rounds take places drawn at random, from the injected random source, among the first 15 Rounds a Round plan makes, one place per weak Round. Every Round, weak or not, is built at its own place, so a mode whose Rounds depend on the place, such as the stages of «Вгадай слово» (ADR 0052), keeps them. A weak Round the mode cannot build at its place moves to the next place and is never dropped while a place is left; the weak Entries the mode cannot ask about at all give way to the other weak ones. In a pairs grid a pair counts as a Round, so the grid that covers a weak place draws the weak Word from the Words the Game would ask next. In a mode whose Rounds take turns («Виживання»), the kinds take turns within the weak Entries and within the rest, as before. A plan made for a Game under way (a replan, more Rounds of a mode with no Round limit) draws the places among the Rounds it makes, at most 15.

**Consequences.** Two Games rarely start alike, and a Game with no weak Entry draws nothing more from the random source, so its plan is the one it was. The first Round of a Game is no longer a sure Review; the 5 weak Rounds still fall within one 15-Round Game. A mode with a Round limit under 5 asks about as many weak Entries as it has Rounds, as before.

## Considered and rejected

- **Shuffle the Rounds once built**: rejected. A Round is built for its place («Вгадай слово» picks in Rounds 1–5, gaps in 6–10, typed answers from 11), so moving a built Round breaks the stages; an earlier try did.
- **Weak Rounds anywhere in a Game with no Round limit**: rejected. «Виживання» and «На час» may end after a few Rounds, and the weak Entries would often go unasked.
- **Keep them first, in a random order among themselves**: rejected. With one weak Word every Game still starts with it, which is the finding.
