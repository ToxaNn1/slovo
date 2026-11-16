# The Content queue acts on the batches ticked at once

Status: accepted (owner, 16.11). Amends ADR 0090.

## Context

The Content queue (ADR 0090) reviews or rolls back one Агент batch per click and confirmation. After the rewrite of every Entry (ADR 0146) dozens of old batches of `content-wave-1113` waited there, each needing its own two clicks and reason.

## Decision

- Every row of «Пачки Агентів» has a checkbox; a row above them holds «Вибрати всі» (ticked when every batch is, half-ticked when some are; a second click clears), «Вибрано N з M», «Позначити перевіреними (N)» and «Відкотити (N)», disabled at N = 0.
- Each bulk button opens the one admin confirmation (ADR 0088) naming N and taking one reason. The admin then calls the existing `contentQueue.review` or `contentQueue.rollback` once per ticked batch, in turn, with that reason: no new procedure, one Action log row per batch as before.
- A bulk rollback runs newest first, so each batch is rolled back before the older ones under it; the notice sums the records skipped.
- A failure stops the run in the confirmation; the batches already written leave the queue, which reloads either way.
- The per-row buttons stay.

## Why

The queue rarely holds more than a few dozen batches, so N calls cost nothing and keep the backend, the contract and the log shape untouched.

## Rejected

- A `reviewAll` procedure: a new contract and a transaction for a list that is short.
- Bulk actions for flags and Mistake Reports: each needs its own decision or reading; not asked.
