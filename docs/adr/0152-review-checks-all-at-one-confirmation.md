---
summary: «Перегляд» shows «Позначити перевіреними всі (N)» per kind: one admin confirmation with N and a reason, `content.checkAll` {editionId, kind, total, reason} checks every unchecked live record at its current record version in one transaction in Postgres (no fields read), each with the single check's Action log row plus the reason; a count other than `total` is refused (`CHANGED`), an Агент `FORBIDDEN` (amends 0143).
---

# «Перегляд» checks every unchecked record of a kind at one confirmation

Status: accepted (owner, 16.11). Amends ADR 0143.

## Context

The owner approved every Entry rewritten under ADR 0146, some 2,555 records. «Перегляд» (ADR 0143) checks one record at a time, so marking them all checked would take thousands of «Так».

## Decision

- «Перегляд» shows «Позначити перевіреними всі (N)» above the card of a kind while N of its live records are unchecked. It opens the admin confirmation (ADR 0088), which names N and the kind and takes a reason.
- `content.checkAll` {editionId, kind, total, reason} marks every live record of the kind not checked at its record version checked at its current record version (`checked_version = record_version`) and returns how many. It runs in one transaction under the Edition's write lock: a count, one `insert … select` into the Action log and one `update` of the kind's table, all in Postgres; no record's fields are read (ADR 0148, cost first).
- `total` is the N the confirmation named. A different count under the lock is refused as `CHANGED` with the count now, so no record the confirmation did not count is checked unseen.
- Each record keeps the same Action log row as a single check, `content.<kind>.check` with `{ id, recordVersion }`, and carries the confirmation's reason. A record's history reads the same whichever way it was checked.
- Only an Admin user checks, with the admin write header; an Агент token is refused (`FORBIDDEN`), as for a single check. A later write leaves the record unchecked again, as before.

## Why

One button per kind keeps N on the screen the owner reads and the confirmation exact; seven kinds are seven clicks. A row per record keeps ADR 0143's log shape whole; the rows are written by the database itself, so the cost is the same few statements for 50 records or 5,000.

## Rejected

- One summary Action log row: a record's history would lose its check, and every reader of `content.<kind>.check` would need a second shape.
- All kinds at once: the confirmation could not name what it checks without a count per kind, and the gain is six clicks.
- No reason, as for a single check: a single «Так» is the reader's eye on one record; a check of thousands at once is an admin write like any other and says why.
