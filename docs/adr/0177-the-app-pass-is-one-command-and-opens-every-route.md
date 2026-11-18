---
summary: `pnpm app-pass` runs `apps/mobile/maestro/app-pass.yaml`, one step per screen route of `apps/mobile/src/app` plus the Feed's sheets, on the booted simulator against the one Metro, keeping the user state and a screenshot per step; `app-pass.test.ts` fails CI naming each route file no step names, so a PR that adds a route adds its step (amends 0126).
---

# The app pass is one command and opens every screen route

Owner decision of 2026-11-17, after the full app walk of that night: «сценарій завжди має бути актуальний». This ADR amends ADR 0126.

**Why.** The walk of 2026-11-17 went screen by screen with throwaway flows and helper scripts outside the repo. The smoke (`pnpm test:smoke`) checks features, not that every screen opens, and nothing told a change that added a route to add it to any flow, so a full pass had to be rebuilt by hand each time.

**The pass.** `apps/mobile/maestro/app-pass.yaml` is the full app pass: one step per screen route of `apps/mobile/src/app` (each route file but `_layout` and `+` files), plus the sheets the Feed opens by a tap (a card's «Більше дій» and its error report, «Додати до колекції», the stats sheet), each closed unused. A step opens the route's link (`app-pass/open.yaml`, with real ids: `ENTRY_ID`, `w_0wr2ne` by default) or taps to it from its parent, then waits for the screen's root `testID` and keeps a screenshot (`app-pass/screen.yaml`). A route behind a Feature Switch that is off leads to its fallback, and the step accepts that screen too. The pass saves, files and sends nothing, so it keeps the simulator's user state; the Collection steps need a Collection with an Entry, which `--state full-saved` loads (replacing the user state).

**The command.** `pnpm app-pass` (`scripts/app-pass.mjs`) runs it on the booted simulator with the app open from the one Metro on 8082; it starts no simulator and no Metro, holds the machine-wide Maestro lock of `pnpm smoke:halves`, and keeps the screenshots and the log in one folder it prints (`--out` names it). `--expo-go` runs it in Expo Go through `exp://127.0.0.1:<metro>/--/` links; `--device`, `--metro`, `--entry` and `--state` set the rest. It still runs only on the owner's command (ADR 0126).

**The guard.** `apps/mobile/maestro/app-pass.test.ts`, a unit test with no simulator that CI runs with the app's tests, lists every route file and fails naming each one no step of the pass names as its `ROUTE`, and each `ROUTE` no route file has. So a change that adds, renames or removes a screen route updates `app-pass.yaml` in the same PR: this is the one flow a ticket's PR writes, amending ADR 0126's «a ticket's PR writes no flow». It still runs none.

**Consequences.** A new screen costs one step of about six lines. The guard proves a step names the route, not that the step reaches it on a device; the owner's run of `pnpm app-pass` proves that. Sheets and dialogs are in the pass but not under the guard, since they have no route files.
