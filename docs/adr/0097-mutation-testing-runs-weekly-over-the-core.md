# Mutation testing runs weekly over the Core, not on every PR

Owner decision of 2026-11-09 (ticket #1109). The Core holds the rules every Edition plays by, so its tests must catch a wrong result, not only run the code. Coverage says a line ran; it does not say a test would fail if the line were wrong. Mutation testing does: it changes the code one mutant at a time and checks that some test fails.

**Decision.** Stryker with its Vitest runner mutates `packages/core/src` (its tests, test-support modules and fakes excepted; static mutants ignored), from `packages/core/stryker.config.js` and `pnpm --filter @slovo/core mutation`. It runs in its own workflow, `.github/workflows/mutation.yml`, weekly and on demand, never on a pull request. Runs are incremental: the incremental file is kept in the Actions cache, so a run tests again only the mutants of code and tests changed since the last one, and a run stopped at its time limit keeps what it tested for the next. A run keeps the HTML report as an artifact and writes the mutation score to the job summary. It fails nothing: no score breaks the run until the owner sets a floor, in a later ADR amending this one. The apps and `packages/ui` are out of scope.

**Why.** A full run takes hours over the Core's thousands of mutants, far past the minutes the PR check takes, and CI minutes are the limit, so it cannot gate a pull request; a weekly incremental run costs a full run once and then only what changed.

**Rejected.** On every PR: hours per pull request and a red check on a score nobody has set. Over the whole repo: the apps' and `packages/ui`'s tests render screens, many times slower per mutant, for code that holds no rules. None: the Core's tests would stay unmeasured beyond coverage.
