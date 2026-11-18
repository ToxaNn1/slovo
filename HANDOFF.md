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
- Step 4 (done): review fixes merged. Some integration-branch commits carried a non-owner address (CI refuses them, no force-push allowed), so the PR comes from `feat/2022-retire-curated-collection-pr`: the same work rebased on main with the owner's address.
- Step 5: PR #2028 open (no auto-merge). Local lint/typecheck/deps/test green.

WAITING until 2026-11-18T19:36:00Z: CI on PR #2028

## Next
- CI green → HANDOFF starts with `STATUS: FINISHED`. Red → fix on `feat/2022-retire-curated-collection-pr`. Main moves → merge origin/main into it.
