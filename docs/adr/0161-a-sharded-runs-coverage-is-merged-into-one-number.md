---
summary: Every CI test run also writes its Istanbul map `coverage-final.json`; `scripts/ci-history.mjs` merges a package and runner's maps from all parts with `istanbul-lib-coverage` and counts lines and branches of the merged map, so Якість shows one real number per sharded package (amends 0096).
---

# A sharded run's coverage is merged into one number

Owner decision of 2026-11-16. The UI's Vitest and Jest tests and the app's Jest tests run in three CI parts each. Every part wrote only a coverage summary, and the CI history added the parts' covered and total counts, so a file two parts load counted twice and Якість showed no package's real coverage.

**Decision.** Every test run in CI also writes its Istanbul coverage map, `coverage-final.json`, beside the summary (`packages/config/test-reports.js`). `scripts/ci-history.mjs` merges the maps of one package and runner with `istanbul-lib-coverage`, as Jest merges its workers', and counts lines and branches of the merged map alone. The history job installs the workspace for that library.

**Consequences.** Якість shows one number per package and runner, whatever the number of parts. Lines match an unsharded run; branches come out slightly higher (89.22% against 88.32% for `packages/ui jest` on 2026-11-16), since Istanbul credits a V8 range one part left out with the hits of the range that holds it in another. Each part's job summary still shows that part's own summary. The amended ADR is 0096, whose history now carries merged coverage.
