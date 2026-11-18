# A Game has 3 Lives, «Виживання» too, «На час» 20 seconds

Status: accepted (owner, 14.11)

## Context

The board «slogo game last» (spec #1880, owner decisions D4 and D7) draws a Game with 3 Lives, «Виживання» with 1 Life and «На час» with 20 seconds. The 07.11 decisions G8 and G9 of spec #1674 kept 5 Lives, 3 in «Виживання» and 60 seconds in «На час».

## Decision

- **The numbers.** The default Lives of a Game go from 5 to 3, «Виживання» included, which keeps its 3 (owner decision of 2026-11-18, ADR 0176: the board's 1 Life is not taken); the time limit of «На час» from 60 to 20 seconds. The Round limits do not change. Once the time of «На час» is up, the Game goes straight to «ФІНІШ», with no time-up poster.
- **Where they live.** The values stay where they live now: the Core default and each Game Mode's own setting. The Game's 3 Lives and the 20 seconds of «На час» have no Feature Switch: the 5 Lives and the 60 seconds with «Час!» before them are retired with `gameThreeLives` and `timedTwentySeconds` (ADR 0176).
- **A Game in play keeps its Lives.** A switch that changes while a Game is in play changes the next Game only.
- Supersedes G8 and G9 of 07.11. Amends ADR 0052.

## Consequences

- The glossary's **Game** and **Game Mode** read 3 Lives, «Виживання» included, and 20 seconds in «На час».
- The Core Game play API tests each number on and off.

## Considered Options

- **Keeping 5, 3 and 60**: rejected by the owner; the board wins.
- **The numbers as Edition config with no switch**: rejected; the owner's rule asks for a Feature Switch per behaviour.
