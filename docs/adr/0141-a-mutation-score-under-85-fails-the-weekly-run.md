# A mutation score under 85 fails the weekly run

Status: accepted (owner, 15.11; ticket #1817). Amends ADR 0097 where it says no score fails a run.

## Context

ADR 0097 runs Stryker weekly over the Core and left the run without a floor until the owner set one. The first full run (43421781195, 13.11) scored 87.60%; survivors outnumbered uncovered mutants about eight to one, so the gap is tests that run the code without checking what it returns. Without a floor the score can slide unnoticed.

## Decision

- `thresholds.break` in `packages/core/stryker.config.js` is 85: a weekly or on-demand run whose mutation score is under 85% fails.
- A run stopped at its time limit still fails nothing: it has not scored every mutant, and the next run goes on from its incremental file.
- `high` and `low` stay at 80 and 60; they only colour the report.
- Raising the floor is a later owner decision amending this one.

## Why

85 sits under the first score with room for the run-to-run noise of timeouts, and over the 80% the report already calls high, so a real slide shows as a red run within a week.

## Rejected

- No floor: the score is measured but nothing reacts when it drops.
- A floor at the current score (87.6): a few new uncovered lines would fail a run that tests nothing worse.
- A per-file floor: Stryker breaks on the whole score only, and per-file numbers swing with small files.
