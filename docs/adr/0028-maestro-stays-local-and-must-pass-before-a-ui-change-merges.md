# Maestro stays local and must pass before a UI change merges

The Maestro flows in `apps/mobile/maestro/` (the smoke flow and its feature subflows in `flows/`) never run in CI, and they keep running only on the owner's machine. They drive the development client on a simulator, and that client is a native build. Native builds go through EAS only (ADR 0004) and are rare by the owner's policy, so CI has no app to drive. CI runs `lint`, `typecheck`, `test`, `deps` and `knip`; it cannot tell that a change broke a screen.

The rule that replaces a CI gate:

- **Before a change to a screen, a component or a hook merges, the Maestro flows that pass through it must pass locally.** A change that touches many screens or a shared piece (a primitive, a provider, the pager, the theme, navigation) also runs the smoke flow (`pnpm test:smoke`), which calls every feature subflow.
- **The PR lists those flows in its Checks**, by file name, with the result. A PR that touches no screen, component or hook (Core, contracts, tooling, docs) lists none and says so.
- The flows run on a simulator against the installed development client and Metro, as the README describes. A flow that needs a native module the installed client lacks (it predates the module) is named in the Checks as skipped for that reason, and is run after the EAS build that brings the module.
- A merge is not held for a flow that cannot run for want of a native build; the PR names it, and the owner runs it after that build.

## Considered Options

- **EAS Workflows with Maestro in CI**: rejected. A flow needs a simulator build of the app, and each one is an EAS iOS build. The free tier allows 15 iOS builds a month (ADR 0004), and the builds are batched on purpose, so a build per PR would use the month's quota in a few days and tie every merge to the cloud queue. It would pay cloud time for a check the laptop does at no cost.
- **An EAS simulator build, then the flows on a GitHub macOS runner**: rejected. It still needs a build per run (or a build kept up to date by hand against changing native code), and GitHub bills a macOS runner minute at a multiple of a Linux minute. It adds a second place where a native change has to be kept in step with CI, with no gain over running the same flows locally.
- **No rule, flows run when someone remembers**: rejected. Nothing in CI covers a screen, so the flows are the only check of the UI, and a check left to memory is skipped.

## Consequences

The gate is the author's discipline and the PR's Checks list, not a machine. The coordinator reads the list before merging. If the laptop is ever upgraded so that local native builds work (ADR 0004), or EAS builds stop being rationed, a CI run of the flows becomes worth reopening, and this ADR can be superseded. Component tests in `packages/ui` and `apps/mobile` that run in Vitest are a separate decision and would not replace this rule for screens.

## Amendment (2026-10-16)

Maestro still runs only on the owner's machine, and a flow that fails still blocks the change that broke it. What changes is when the flows run:

- **A PR that does not change screen behaviour runs no Maestro flow.** That covers refactors, moves, design tokens, Core, docs, tests and tooling. Lint, typecheck, the unit tests and the Jest component tests (ADR 0029) guard them, and the PR's Checks say that no flow was run.
- **A PR that adds a screen, or changes navigation or what a screen does, runs one Maestro flow of its own before it is pushed**: the flow for that screen, new or updated in the same PR. It no longer runs the smoke flow for a wide change.
- **The full smoke flow (`apps/mobile/maestro/smoke.yaml`, `pnpm test:smoke`) runs once on `main` at the end of each spec**, and optionally after a large wave of merges, by one thread dedicated to it, before the spec is closed. If a flow fails, `git bisect` with that flow alone finds the PR, and a small bug ticket follows.

Why: Maestro runs share one simulator host and one machine-wide lock, so with a Maestro run in every PR the runs queued for hours. In a spec of refactor tickets, almost every one of those runs checked a change that cannot alter screen behaviour in a way the unit and component tests miss. One full run per spec still catches what slips through, at the cost of one bisect when it does.

## Amendment (2026-10-19)

The full smoke flow now runs as two halves at once on two simulators. `smoke.yaml` still runs the whole smoke by calling `smoke-1.yaml` and `smoke-2.yaml` in a row, so `pnpm test:smoke` and every rule above hold unchanged. `pnpm smoke:halves` runs the halves in parallel, each on its own simulator and Metro and both against one backend, and prints the flows that passed and failed in each half. The halves share no app state, and the two flows that need the backend, `account.yaml` and `sync.yaml`, are in the same half. The machine-wide lock is taken once for both halves.

Why: the full run took 30 to 50 minutes on the shared machine, and a failure late in the chain cost a full rerun. Two halves cost about half the time of one run of the whole smoke, and a failure stays in its half. The end-of-spec smoke run uses `pnpm smoke:halves` by default.
