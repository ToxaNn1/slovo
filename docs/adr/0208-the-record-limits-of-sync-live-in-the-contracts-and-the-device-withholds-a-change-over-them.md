---
summary: The limits of one record of Sync (key 200 code points, value 8 KB, depth 32) are defined once in the contracts; the device never sends a change over them, and it answers the sync as an `unexpected` refusal while the other changes sync (amends 0041).
---

# The record limits of Sync live in the contracts, and the device withholds a change over them

Decision of 2026-11-27, from the architecture walk of 27.11 (ticket #2127).

A push with one record over the limits is refused whole (ADR 0041). The device did not know the limits, so one such record marked its whole batch, up to 500 changes, refused until the next launch, where the same batch was built and refused again.

## Decision

- **One definition.** `SYNC_RECORD_LIMITS` in `@slovo/contracts` holds the limits of one record: the key's length, the value's bytes as compact JSON in UTF-8, and the value's depth; `fitsSyncRecord` is the one check against them. The server Core's push, the contract's schema and description, the device's exchange, the XP-day fold (ADR 0205) and the fake backend read them from there.
- **The device withholds.** Before a push the Core checks each pending change. One over the limits is not sent: it stays pending and on the device, at every launch, every other change is pushed, and the sync answers `unexpected`, the refusal a 400 gave before, while it waits. A record changed again is checked again.
- **The backend still checks.** The server Core refuses a push with a change over the limits whole, as before: the device's check is no trust.
- The limits of an Account and of a Session (records and tombstones per Edition, requests per Session) stay rules of the server Core's `sync` domain.

## Amends

ADR 0041, "Limits": the limits of one record are no longer a rule of the server Core alone. The numbers and the answers stand; the contract only grew by exports (ADR 0031).

## Considered

- **A per-record answer of the push** (the backend keeps what fits and names what does not): rejected. A new answer old apps do not read, for a record no device should send.
- **A new failure reason for the reader** (`too-large` beside `unexpected`): rejected for now. No record of the app but an XP day grows towards 8 KB, and the fold already keeps that one under it.
