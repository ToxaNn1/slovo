# A UI ticket carries one screenshot of its screen against the board

ADR 0028 kept every screenshot for one visual pass at the end of a version: a ticket's PR touched no flow and took none. With the app drawn from design boards (ADR 0070) that was too late. A screen that missed its board was found only when the whole version was built, and the owner's rule since 2026-11-03 is that a UI change is done only when a screenshot of it matches the board. ADR 0028 also had the two halves of the smoke run each against its own Metro, while the laptop keeps one Metro, on port 8082, that nothing restarts or doubles (the owner's rule of 2026-11-13). This ADR supersedes ADR 0028 and keeps the rest of it.

The rule:

- **A ticket that changes a screen carries one screenshot of that screen, set against its board.** One screen, one screenshot: a text snapshot of the screen comes first, and the screenshot is taken once the snapshot shows the screen is the right one. The ticket's report names the board and says what matches and what does not; a difference the ticket leaves is said, not hidden. The screenshot is taken by hand from the running app, not by a Maestro flow. A ticket built where there is no simulator leaves the screenshot to the wave's coordinator on the laptop, and the ticket is not done without it.
- **Maestro runs only on the owner's command**: any flow, the full smoke, and the manual CI workflow `maestro.yml`, which runs `launch.yaml` on a macOS runner (ADR 0004). Normally that is once per spec, at its end.
- **A ticket's PR writes, updates and runs no flow.** Lint, typecheck, the unit tests, the Jest component tests (ADR 0029) and the ticket's screenshot guard it.
- **One visual pass per version, at its end**, writes or updates the flows of the screens the version added or changed and runs the smoke on the owner's command. It looks at the version as a whole; the screens were already set against their boards ticket by ticket.
- **The smoke runs against the one Metro.** `smoke.yaml` (`pnpm test:smoke`) calls `smoke-1.yaml` and `smoke-2.yaml` in a row. `pnpm smoke:halves` runs the two halves at once, each on its own simulator, both against the one Metro (port 8082 unless `--metro` names another) and one backend, under one machine-wide lock, and prints what passed and failed in each. The script starts and stops no Metro. The halves share no app state, and `account.yaml` and `sync.yaml`, which need the backend, are in the same half. A flow that needs a native module the installed client lacks waits for the EAS build that brings it. If a flow fails, the owner decides how to find the PR, and a small bug ticket follows.

## Considered Options

- **Keep ADR 0028: no screenshots until the version's visual pass**: replaced by the owner (2026-11-14). The mismatches with the boards piled up to the end of the version.
- **A Maestro flow per UI ticket that takes the screenshot**: rejected. The runs queue behind the one simulator host and lock, the reason ADR 0028 took the flows out of tickets; one screenshot by hand needs no flow.
- **Several screenshots per ticket (every state, both Themes)**: rejected. One screenshot per check keeps a session's context small; a state the Result names is a check of its own.
- **A Metro per half of the smoke**: dropped. Two simulators load the same bundle from one Metro, and a second Metro on the laptop is what the owner's rule forbids.
- **Maestro in CI on every PR**: still rejected, for ADR 0028's reasons: each run needs a simulator build, from an EAS quota of 15 a month or on macOS minutes.

## Consequences

A UI ticket costs one screenshot and its comparison, and a version's visual pass finds less. The gate is the ticket's screenshot, the version's visual pass, the end-of-spec smoke the owner calls, and the PR's Checks list. `docs/agents/ticket-brief.md` and `docs/react-native.md` carry the rule for the agents. If local native builds become possible (ADR 0004) or EAS builds stop being rationed, running the flows on every PR in CI is worth reopening.
