# A screen change runs its own Maestro flow, and the smoke runs once per spec

The Maestro flows in `apps/mobile/maestro/` drive the development client on a simulator, and that client is a native build. Native builds go through EAS (ADR 0004) and are rare by the owner's policy, so the flows run on the owner's machine; a manual CI workflow may also run `launch.yaml` on a macOS runner (ADR 0042). The PR checks in CI (`lint`, `typecheck`, `test`, `deps`, `knip`) cannot tell that a change broke a screen beyond what the Jest component tests (ADR 0029) cover.

The rule that stands in for a CI gate:

- **A PR that does not change screen behaviour runs no Maestro flow**: refactors, moves, design tokens, Core, docs, tests and tooling. Lint, typecheck, the unit tests and the Jest component tests guard them, and the PR's Checks say no flow was run.
- **A PR that adds a screen, or changes navigation or what a screen does, runs one Maestro flow of its own before it is pushed**: the flow for that screen, new or updated in the same PR, named with its result in the PR's Checks.
- **A flow that needs a native module the installed client lacks** is named in the Checks as skipped for that reason and runs after the EAS build that brings the module; the merge is not held for it.
- **The full smoke runs once on `main` at the end of each spec**, and optionally after a large wave of merges, by one thread dedicated to it. `smoke.yaml` (`pnpm test:smoke`) calls `smoke-1.yaml` and `smoke-2.yaml` in a row; `pnpm smoke:halves`, the default for the end-of-spec run, runs the two halves at once, each on its own simulator and Metro against one backend, under one machine-wide lock, and prints what passed and failed in each. The halves share no app state, and `account.yaml` and `sync.yaml`, which need the backend, are in the same half. If a flow fails, `git bisect` with that flow alone finds the PR, and a small bug ticket follows.

Maestro runs share one simulator host and one machine-wide lock, so a run in every PR queued for hours, mostly to check changes the unit and component tests already guard. One full run per spec, split in halves (about half the time, and a failure stays in its half), still catches what slips through, at the cost of one bisect.

## Considered Options

- **EAS Workflows with Maestro in CI on every PR**: rejected. Each flow needs a simulator build, each one an EAS iOS build from a quota of 15 a month (ADR 0004), so a build per PR would use the month's quota in a few days.
- **An EAS simulator build, then the flows on a GitHub macOS runner for every PR**: rejected. It still needs a build per run, macOS minutes cost a multiple of Linux ones, and a native change has to be kept in step with CI in a second place.
- **Every UI change runs its flows, and a wide change the whole smoke**: rejected. The runs queued for hours behind the shared lock.
- **No rule, flows run when someone remembers**: rejected. The flows are the only check of whole screens on the real app, and a check left to memory is skipped.

## Consequences

The gate is the author's discipline and the PR's Checks list, not a machine; the coordinator reads the list before merging. If local native builds become possible (ADR 0004) or EAS builds stop being rationed, running the flows on every PR in CI is worth reopening.
