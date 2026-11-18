# An answer banner replaces the answer card, and the Game moves on by itself

Status: accepted (owner, 14.11)

## Context

Spec #1674 (G5 of 07.11) shows an inline answer card with «Далі →» after each answer. The board «slogo game last» (spec #1880, owner decision D1) slides in a slanted banner and moves on to the next Round with no tap.

## Decision

- **The answered state.** After an answer the Core Game play API holds the Round in an answered state and tells what the banner shows: right or wrong, the XP this answer brought (if any), the right answer's text for a wrong answer, and whether this answer took the last Life. The state is a discriminated union, not flags.
- **The Game moves on by itself.** After a right answer the Game leaves the answered state on a timer, not on a tap: 950 ms, 550 ms in a Game Mode with a time limit («На час»). After a wrong answer the banner stays until «Далі →» on it, and in «На час» the Game moves on by itself after 3 s (ADR 0178). The time comes from the injected clock and schedule. The time limit of «На час» keeps running under the banner.
- **«Пари»** shows no banner after a pair; the grid ends when its four pairs are found.
- **Accessibility.** With VoiceOver on, the banner is announced and the Game waits for the announcement or the delay, whichever is longer. With «Менше руху» the banner shows without motion.
- **No switch.** The banner always follows an answer; the answer card and its explanation line are gone, which the owner accepts. Its switch `gameAnswerBanner` is retired by ADR 0176.
- Supersedes G5 of 07.11. Amends ADR 0052 where it describes what follows an answer.

## Consequences

- The banner texts are Edition strings: «Влучив!», «В яблучко!», «Точно!» in turn, «+{count} XP», «Мимо», «Життя все» and «Майже. Ось як правильно: {answer}».
- The Core Game play API tests the answered state, the delays and the Game moving on when the schedule fires and not before, and a wrong answer waiting for «Далі».

## Considered Options

- **The inline card of G5**: rejected by the owner; the board wins.
- **A tap to continue after a wrong answer**: first rejected for the board, then taken by the owner with ADR 0178.
