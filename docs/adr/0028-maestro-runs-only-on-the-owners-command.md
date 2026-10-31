# Maestro runs only on the owner's command

The Maestro flows in `apps/mobile/maestro/` drive the development client on a simulator, and that client is a native build. Native builds go through EAS (ADR 0004) and are rare by the owner's policy. The PR checks in CI (`lint`, `typecheck`, `test`, `deps`, `knip`) cannot tell that a change broke a screen beyond what the Jest component tests (ADR 0029) cover.

The rule:

- **Maestro runs only on the owner's command**: any flow, the full smoke, and the manual CI workflow `maestro.yml`, which runs `launch.yaml` on a macOS runner (ADR 0042). Normally that is once per spec, at its end, on `main`.
- **A ticket's PR touches no flow and takes no screenshots**, whatever screens it changes. Lint, typecheck, the unit tests and the Jest component tests guard it until the version's visual pass.
- **One visual pass per version, at its end**, writes or updates the flows of the screens the version added or changed, takes the screenshots, and runs the smoke on the owner's command.
- **The full smoke.** `smoke.yaml` (`pnpm test:smoke`) calls `smoke-1.yaml` and `smoke-2.yaml` in a row; `pnpm smoke:halves`, the default for the end-of-spec run, runs the two halves at once, each on its own simulator and Metro against one backend, under one machine-wide lock, and prints what passed and failed in each. The halves share no app state, and `account.yaml` and `sync.yaml`, which need the backend, are in the same half. A flow that needs a native module the installed client lacks waits for the EAS build that brings it. If a flow fails, the owner decides how to find the PR, and a small bug ticket follows.

Maestro runs share one simulator host and one machine-wide lock, so runs started by PRs queued for hours and ran into each other, mostly to check changes the unit and component tests already guard. One full run per spec, when the owner calls it, still catches what slips through.

## Considered Options

- **EAS Workflows with Maestro in CI on every PR**: rejected. Each flow needs a simulator build, each one an EAS iOS build from a quota of 15 a month (ADR 0004), so a build per PR would use the month's quota in a few days.
- **An EAS simulator build, then the flows on a GitHub macOS runner for every PR**: rejected. It still needs a build per run, macOS minutes cost a multiple of Linux ones, and a native change has to be kept in step with CI in a second place.
- **Every UI change runs its flows, and a wide change the whole smoke**: rejected. The runs queued for hours behind the shared lock.
- **A PR that changes a screen runs its own flow before it is pushed**: replaced by the owner (2026-10-25). The runs still competed for the one simulator host, and the end-of-spec smoke catches the same breakage.
- **A PR that changes a screen writes or updates its flow without running it**: replaced by the owner (2026-10-31). The version's visual pass writes them once, against the screens as they ship, so a ticket spends no steps on flows.
- **No rule, flows run when someone remembers**: rejected. The flows are the only check of whole screens on the real app, so the owner calls the run.

## Consequences

The gate is the version's visual pass, the end-of-spec smoke the owner calls, and the PR's Checks list; the coordinator reads the list before merging. If local native builds become possible (ADR 0004) or EAS builds stop being rationed, running the flows on every PR in CI is worth reopening.
