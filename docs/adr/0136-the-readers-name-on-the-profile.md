# The reader's name on the Profile

Status: accepted (owner, 14.11)

## Context

Board 11 draws a header on the Profile with an avatar, a name and the Level (spec #1861). SLOVO has kept no name of the reader so far.

## Decision

- **Optional.** The reader may set a name, trimmed, at most 24 characters; an empty name is no name.
- **User state the Core owns**, synced through the Account like the rest (ADR 0041), kept on the device without one. A Progress reset keeps it (ADR 0133).
- **Never sent** with Analytics, Community Counters or the Questionnaire counters (ADR 0068).
- **The Profile's header.** The Profile keeps its meaning, the screen of the reader's whole progress, and gains a header: the avatar (the first letter of the name, a neutral mark without one), the name and «Рівень N — назва». The «Ім'я» row opens a name sheet in the board 09 sheet look (a counter, a shake on a bad name). The Questionnaire rows the board draws there are not built (ADR 0067).
- Behind its own Feature Switch, which needs the Profile. Off: the header shows the Level alone, no «Ім'я» row.

## Consequences

- The Core gains the name field with its validation; the contracts and the server Core gain its shape in the user state.
- The Data export holds the name (ADR 0135).

## Considered Options

- **A name required at onboarding**: rejected. It adds a step and the app works without one.
- **The Account's name from Google or Apple**: rejected. A reader without an Account would have none, and the reader chooses how the app calls them.
