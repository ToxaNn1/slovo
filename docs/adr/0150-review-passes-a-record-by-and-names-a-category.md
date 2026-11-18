---
summary: «Перегляд» passes a record by: «Далі» (key 4 or →) shows the next with no answer, the record left unchecked, `content.unchecked` takes an optional `skip`, «Назад» answers a passed-by one («Не переглянуто»); the card names a Category by its Edition `displayName`, as the app does (amends 0143).
---

# «Перегляд» passes a record by and names a Category

Status: accepted (owner, 16.11). Amends ADR 0143.

## Context

«Перегляд» (ADR 0143) moves on only after an answer, so the owner could not leaf on past a record to come back to it later. Its card showed a Category by its id (`household-crafts`), while the app shows the Category's display name.

## Decision

- «Далі» (key 4 or →) shows the next record with no answer; the record passed by stays unchecked. It is off on the last record of the queue.
- `content.unchecked` takes an optional `skip`: the count of records passed by, which lead the queue in its order, so the record after them comes; the count is unchanged.
- «Назад» shows the records passed by among those reviewed, marked «Не переглянуто», with «Так», «Ні» and «Редагувати»; an answer there returns to the queue.
- The counter reads «N з M» with N the records shown here so far plus one.
- The card and the record form name a Category by its `displayName` in the Edition config, the one the app reads (ADR 0033); an unknown id shows as it is.

## Why

The passed-by records are the client's own list, so an offset into the queue's order is the whole server change, an optional input that only widens the API (ADR 0031). The display name comes from the Edition card the form already reads: one source, no second list of names.

## Rejected

- A list of passed-by ids sent to the server: an offset does the same while the queue's order holds, and the order changes only on a write, which checks or retires the record.
- No feature switch: Feature Switches turn reader features on and off (ADR 0089); the admin has none.
