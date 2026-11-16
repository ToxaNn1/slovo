# A record is checked at its record version

Status: accepted (owner, 15.11; admin fast review). Amended by ADR 0150 («Далі» passes a record by) and ADR 0152 (all unchecked records of a kind at one confirmation). Amends ADR 0088 (a check is an Admin user's change with no reason and no confirmation) and ADR 0090 (a record carries the version it was checked at, beside the batch review of the Content queue).

## Context

The Content queue reviews whole batches (ADR 0090): an import or an agent run of hundreds of records is «перевірено» in one click, so no one has read each record. The owner wants to read the content one record at a time, fast, and know which records a person has read since their last change.

## Decision

- Every content table has a `checked_version` column: the record version an Admin user last marked checked; none while never checked. A record is checked while it equals `record_version`, so any later write (an edit, an agent run, an import) leaves it unchecked again. Imported records start unchecked.
- `content.unchecked` answers, per kind, the count of live (not retired) records not checked and the first of them, the newest change (the highest content version) first, then by id.
- `content.check` marks one record checked at the record version it was read at; an older version is refused as `STALE`. It changes no content, publishes no Patch and raises no version. It needs no reason and no confirmation dialog, like an owner-check tick (ADR 0088); the Action log keeps a row `content.<kind>.check` with `after: {id, recordVersion}`.
- Only an Admin user (Власник or Адмін) checks; an Агент token is refused with `FORBIDDEN`.
- The tab «Перегляд» under Контент shows one unchecked record as a readable card with three keys: «Так» checks it, «Ні» retires it with an optional reason, «Редагувати» opens the record form inline, and its save checks the record at its new version, since the Admin user read it to edit it; each moves to the next record, with the counter «N з M». The keys 1, 2 and 3 do the same as the three buttons.
- The batch review of the Content queue stays as it is: a batch reviewed there checks no record.

## Why

A version number already changes on every write, so storing the checked one makes "changed since it was read" a comparison, with no trigger and no second table. A check is reading, not editing, so it stays out of batches, Patches and the content version.

## Rejected

- A checked flag reset by every write path: each path would have to remember it.
- Reviewing a batch checks its records: a click on a batch of 300 is not reading 300 records.
- A reason on every check: it would slow the fast review the tab exists for.
