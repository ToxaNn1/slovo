---
summary: Behind `correctionTypeGrid` (needs `correctionCategoryScreens`) the «Виправлення» rail's header counts its Correction Types and opens a grid of the same tiles alone, no k2 on it; amends 0081.
---

# The «Виправлення» rail opens a grid of its Correction Types

Status: accepted (owner, 15.11)

## Context

ADR 0081 made the header of the Dashboard's Correction Types rail count the Categories of Corrections and open their grid, k2. On the phone the owner found that the header and the screen it opens do not match the rail: the rail shows Correction Types («Суржик», «Наголос»…), the header's number and the grid show Categories («У розмові», «Вдома»…).

## Decision

- Behind `correctionTypeGrid` (needs `correctionCategoryScreens`) the rail's header counts its Correction Types and opens a grid of the same tiles, in the rail's order and look, two columns; a tile opens its type's screen, as on the rail.
- That screen shows the types alone (owner 15.11): k2 is not on it, so while the switch is on no screen leads to a Category of Corrections; the Mix screen still chooses them.
- Off, ADR 0081's header and k2 stay as they were. Amends 0081.

## Consequences

- The glossary's **Dashboard** names what the header opens.
- No new string: the grid of types takes the rail's title.

## Considered Options

- **Only k2 in the rail's look**: rejected; the content would still differ from the rail.
- **k2 «Категорії» under the types**: tried on the phone and rejected by the owner (15.11): the Categories are not needed there.
- **The rail shows the Categories of Corrections**: rejected; the Correction Types would leave the Dashboard.
