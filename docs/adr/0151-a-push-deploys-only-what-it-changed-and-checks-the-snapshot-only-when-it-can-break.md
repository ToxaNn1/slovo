# A push deploys only what it changed and checks the snapshot only when it can break

Status: accepted (owner, 16.11). Amends ADR 0104.

## Context

Every push to `main` deployed all four Railway services and then asked for every Edition's content snapshot (#1825), which reads all the content from Neon: about 5–7 MB a push, about 300 pushes a month, so the check alone took 1.5–2 GB of Neon's monthly transfer (the free plan holds 5 GB). A third of the pushes change only documentation, the phone app or the site, and the check guards one failure: stored content that a tightened content schema no longer accepts (#1819).

## Decision

- A job "Deploy scope" (`scripts/ci-deploy-scope.mjs`) diffs the push from the last commit whose "Deploy to Railway" succeeded, found through the Actions API, and gives two flags.
- `deploy` is true when a changed file is outside documentation, `apps/mobile`, `apps/site`, `apps/widget`, `apps/video`, `packages/ui`, an Edition's `legal/`, `.github/`, `.maestro/`, `.claude/` and `copy-review/`. Otherwise "Deploy to Railway" is skipped.
- `snapshot` is true when a changed non-test file is one the content Contract `packages/contracts/src/api/content.ts` reaches by relative imports, or lies in `packages/content-rules/src/`, `apps/backend/src/content/`, `apps/backend/src/database/` or `apps/backend/migrations/`. Only then does the deploy check every Edition's snapshot.
- When the last deployed commit can't be found or the diff fails, both flags are true.

## Why

Counting from the last successful deploy rather than the push before means a red, cancelled or replaced deploy is caught up by the next push that deploys. A separate job keeps a skipped push out of the `railway-deploy` concurrency group, so it never replaces a deploy still waiting. Walking the Contract's imports follows new content kinds without a list to keep. On the pushes of 09–16.11 the deploy would have run 53 times of 72 and the snapshot check 25 times, about a third of the Neon transfer it took.

## Rejected

- Dropping the snapshot check: the #1819 failure would again reach readers first.
- Diffing from the push before: a docs push after a red deploy would leave a backend change undeployed.
