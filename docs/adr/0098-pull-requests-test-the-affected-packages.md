# Pull requests test the affected packages; main tests everything

ADR 0086 let a pull request skip the app's tests when it changed only the site, and the site's when it changed only the app. Every other pull request still ran every test part: a change to `packages/core` ran the site's tests and the admin build, and a change to the admin ran the Core, the UI shards and the app's Jest shards. The parts cost CI minutes and, more to the point, places in the runner queue: a pull request waited behind another's parts that could not fail.

**On a pull request, a test part runs only when it can be affected.** The `changes` job of `ci.yml` runs `scripts/ci-affected-parts.mjs`, which asks Turborepo for the affected packages (`turbo ls --affected` from the pull request's base): those with a changed file, and every package that depends on one. Each test part runs when its package is affected: the Core, the UI shards, the site, the admin build, the app's Vitest and Jest shards and the job "Backend". The part "other packages" tests only the affected packages among the rest. A part that is not affected passes without running, as in ADR 0086, because the required check counts a skipped job as a failure.

- **Documentation counts for nothing.** A pull request that changes only `docs/` and `.md` files runs no test part.
- **ADR 0086's refinements stay.** An Edition's legal pages and `pages.yml` count for the site; `maestro.yml` and `ota-update.yml` for the app.
- **Anything else outside the packages runs everything.** A changed file outside `apps/`, `packages/` and `tools/` that is not documentation (an Edition's content, a root config such as `turbo.json`, `pnpm-lock.yaml`, a workflow, a script) runs every part: Turborepo maps such files to the workspace root and would count no package as affected.
- **Every push to `main`, and every failed detection, runs everything**, so `main` stays tested whole and a red `main` points at the commit that broke it.

Lint, typecheck, the package boundaries, the Contract and Language Pack check and the container image keep covering the whole workspace on every pull request.

## Considered Options

- **Selecting tests by the changed files** (Jest's `--findRelatedTests`, Vitest's `--changed`): rejected. They follow imports alone and miss what a test reads another way: an Edition's content, the configs, snapshots, fixtures read from disk and generated files.
- **Running every part on every pull request**: rejected. It is what ADR 0086 mostly left in place, and the queue it builds is the reason for this decision.
- **Turborepo's remote cache** to skip parts whose inputs have not changed: not taken now. It needs a cache service and its secret, and it would still start every job.
