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
