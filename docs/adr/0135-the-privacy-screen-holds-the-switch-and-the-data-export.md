# The privacy screen holds the one switch and the Data export

Status: accepted (owner, 14.11)

## Context

ADR 0068 puts the one privacy switch «Ділитися анонімною статистикою» in the Settings list. Board 11 moves it to a screen «Конфіденційність» and adds «Експортувати мої дані» there (spec #1861).

## Decision

- **One switch, one screen.** One control still gates Analytics and Community Counters (ADR 0060, 0068). It moves from the Settings list to the screen «Конфіденційність», which also holds the Data export. ADR 0068's line «privacy is one tap» becomes «one switch, one screen».
- **Built on the device.** The Data export is built from the reader's user state of this Edition, so it works without an Account and without the network.
- **One file.** One versioned, documented, human-readable JSON file. It leaves the device only through the system share window.
- **What it holds:** the reader's words, progress, settings and name (ADR 0136).
- **What it never holds:** the Session, a token, the Install id, or content the reader did not make; Entries appear by id and Lemma only.
- **The privacy policy page** (ADR 0049) names the Data export; its text is prominent copy and waits for the owner's approval.
- Behind its own Feature Switch. Off: the row is absent; the privacy screen still shows the switch.

## Consequences

- The Core gains the export builder and its versioned format; the app writes the file with the file module it already has and hands it to the system share window, so no new native module.
- Amends ADR 0068 (the switch's place).

## Considered Options

- **An export from the backend**: rejected. It would need an Account and the network, and a reader without one owns data too.
- **Include the Entries' content**: rejected. It is the Edition's content, not the reader's, and would make the file large.
