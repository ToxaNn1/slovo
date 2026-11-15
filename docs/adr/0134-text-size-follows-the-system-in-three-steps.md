# Text size follows the system in three steps

Status: accepted (owner, 14.11)

## Context

The Word text size is a four-step scale S, M, L, XL (ADR 0091, 0113). Board 11 replaces it with three values that start from the phone's own text size (spec #1861).

## Decision

- **Three values.** The Text size setting is one of system, larger, largest (UI «Як у системі», «Більший», «Найбільший»). «Як у системі» follows the OS text size within a cap, so a very large system size does not break the card frame; «Більший» and «Найбільший» sit above it.
- **One ladder.** Inside the Core the sizes form one ordered ladder; a setting value names the step a text starts from.
- **The shrink rule on the ladder** (restates ADR 0091): a tab too tall steps down one step at a time to the floor, the ladder's lowest step, then is clamped under «Детальніше». ADR 0113's opened tab scroll is unchanged.
- **One migration.** Stored S / M / L / XL migrate once in the user-state migration the Core owns (ADR 0013): S and M to system, L to larger, XL to largest.
- **The default.** The Edition's default text size is one of the three values; the S…XL default stays beside it for the switch-off case.
- **Synced, like the Theme** (owner, 15.11). The Text size setting is a user-state record that syncs to every device of the Account, the newer choice winning; it is not a setting of one device.
- **A Feature Switch of its own** (owner, 14.11). Off: the S…XL scale and its row work as before. On: the three-step scale and its screen «Шрифт і розмір». The stored text size reads both ways, so turning the switch off again breaks nothing.

## Consequences

- The Core gains the ladder, the migration and the reading of both stored forms; `packages/ui` takes its sizes from the ladder.
- Amends ADR 0091 (the shrink floor is the ladder's lowest step, not S) and ADR 0113's use of the scale.

## Considered Options

- **Keep S…XL**: rejected. The board draws three values and the reader's system setting is the natural start.
- **Follow the system with no cap**: rejected. The largest accessibility sizes would not fit the card frame.
