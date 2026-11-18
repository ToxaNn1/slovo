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
- Step 3 (running): local worktree implementers A (Pack+Core, branch feat/2022-a-pack-core), B (backend+content-rules+tools/content, feat/2022-b-backend), C (admin, feat/2022-c-admin). If lost, relaunch each from the integration branch with the ticket.

## Next
- Merge A, B, C into the integration branch; checks; code-review; PR with «Питання власнику», «Handbook», «Перевірки власника»; CI green.
