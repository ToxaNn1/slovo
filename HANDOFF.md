# HANDOFF: ticket #2022 «Retire a Curated Collection» (spec #1992)

STATUS: IN PROGRESS

Integration branch: `feat/2022-retire-curated-collection`. Grant: commits, pushes, one PR to main; no merge, no auto-merge.

## Decisions
- `retired: z.boolean().default(false)` on the Curated Collection (contracts). No migration: the backend's `content_curated_collections.retired` column exists.
- Language Pack: like a Retired Crossword day, a Retired collection has no rows (build and Patch); pack format stays 14.
- Core: the rail, count, grid, screen, Feed and «Додати собі» skip a Retired collection; the reader's copy in the Mix stays.

## Log
- Step 1 (done): contracts `retired`, OpenAPI regenerated, test fixtures. Commit on the integration branch.

## Next
- Parallel implementers: A Pack+Core, B backend+content-rules+tools/content, C admin. Then ADR 0178 amend, code-review, PR.
