---
summary: One catalogue in `@slovo/contracts` (`action-log-catalogue.ts`) holds every Action log key with the shape of the sides it writes; the writers' `what` is an `ActionKey` and the admin's texts are keyed by the catalogue, so a key without a text fails typecheck, while a row of a key no longer in it still reads as «Інша дія: …».
---

# One catalogue holds every Action log key

Decision of 2026-11-27, from the architecture walk of 27.11 (ticket #2130).

An Action log row's `what` was a text and its `before` and `after` any JSON. The backend and the server Core wrote the keys as literals in about nine files, and the admin kept its own table of keys and shapes. The two drifted: the Service actions had no text, so the Власник read «Інша дія: service.entry.add».

## Decision

- **One catalogue.** `action-log-catalogue.ts` in `@slovo/contracts` names every key with the Zod shape of each side it writes, as ADR 0199 does for the Feature Switches. The rows about one content record are `content.<kind>.<op>`, typed over the content record kinds and their ops.
- **The writers are typed.** The server Core's `ActionEntry.what` and the backend's `action_log.what` column are an `ActionKey`: a writer cannot write a key the catalogue lacks.
- **The admin is typed.** Its sentence and side texts are a table over the catalogue's keys, and it parses each side by the catalogue's shape: a key without a text fails typecheck.
- **Rows kept from before.** The shapes are loose, so a field added later never hides a row. A read takes `what` as a text: a key the catalogue no longer has reads as «Інша дія: …» and a side that no longer fits as plain text (ADR 0088).

## Considered

- **Typing each writer's sides over the shape of its key**: not now. The writers pass JSON they build from their records; the shapes are the reader's, and a writer's test of its row stays the check of its sides.
