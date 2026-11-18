---
summary: The backend keeps each Edition's records (id, fields, record version) in memory at the content version it last saw: a write, the content report and the editor's list read them whole only when the version changed, a committed write keeps them with its record in place, a save still reads its own record (stale check, «needs new recording»); every change of fields raises the content version; the open-batch list and the alert count records in SQL with no logged fields, a rollback alone reads its batch's before; the quote check reads fields of unverified records only and a page once a run (amends 0084, 0090).
---

# The backend keeps an Edition's records by content version

Status: accepted (the owner's task of 15.11 on the Neon network transfer). Amends ADR 0090 (how a save is checked and what the Content queue reads) and ADR 0084 (what the quote check job reads).

## Context

On 15.11 the Deployment's database (Neon, ADR 0099) ran out of its monthly network transfer and production went down. Every content write read the fields of every record of the Edition, since a save is checked against the whole content set: a Lemma and its primary Definition name one Word, an Idiom's expression one Idiom, and a Curated Collection, a Synonym Row or a Crossword day may name only Entries that exist. That was about the whole content per write, so one agent rewrite of every Entry read gigabytes. The content report did the same, and the list of open batches, which the alert cron reads every 15 minutes, read every logged before and after of every open batch.

## Decision

- The backend process keeps, per Edition, its records (id, fields, record version) at the content version it last saw. A write, the content report and the content editor's list use them while the Edition's content version is that one, and read them whole once when it is not. A write that commits keeps the records with its own record in place, at its new content version; a write that fails or is rolled back keeps nothing.
- A save still reads the record it changes from the database: its record version for the stale check and a Word's «needs new recording», which changes without a content version.
- This rests on the content version: every change of a record's fields raises it, and two contents never share one (ADR 0090). A new write path that changes fields keeps that rule.
- The list of open batches and the alert count each batch's records in the database (the first write of each record, `added` and `changed`) and read no logged fields. A rollback alone reads the logged before of its one batch.
- The quote check job reads the fields of only the records unverified at their version, and reads a cached source page once a run.

## Why

The rules stay one set of pure functions over the whole content set, shared by the build, the CLI and the backend, with no second, partial version of them in SQL. The content version already names one exact content, so a kept set is either exact or not used. A few megabytes of memory per Edition cost less than reading them on every write.

## Rejected

- Check each cross-record rule with its own SQL query: a second copy of the content rules, which the build and the CLI would not share.
- Read only the fields the rules use: the rules take whole records, and a partial record would be a type that lies.
- A cache with a time to live: it could check a save against content that changed.
