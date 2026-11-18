# HANDOFF: ticket #2022 «Retire a Curated Collection» (spec #1992)

STATUS: IN PROGRESS

Integration branch: `feat/2022-retire-curated-collection`. Grant: commits, pushes, one PR to main; no merge, no auto-merge.

## Decisions
- `retired: z.boolean().default(false)` on the Curated Collection (contracts). No migration: the backend's `content_curated_collections.retired` column exists.
- Language Pack: like a Retired Crossword day, a Retired collection has no rows (build and Patch); pack format stays 14.
- Core: the rail, count, grid, screen, Feed and «Додати собі» skip a Retired collection; the reader's copy in the Mix stays.

## Log
- Step 1 (done): contracts `retired`, OpenAPI regenerated, test fixtures. Commit on the integration branch.

- Step 2 (done): ADR 0178 amended («Retiring»), index line, glossary «Retired Curated Collection».
- Step 3 (done): A, B, C merged; full lint/typecheck/test green (backend needs DATABASE_URL=postgres://slovo:slovo@localhost:5432/slovo).
- Step 4 (running): code-review done; a fixer works on the admin stale-fields bug, record-rows doc, Core refresh after Patch, directly on the integration branch (uncommitted work there is the fixer's).

## Next
- Merge-check fixer commits, push, open the PR (one, no auto-merge), wait for CI, STATUS: FINISHED.
