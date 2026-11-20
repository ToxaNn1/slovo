---
summary: A Feature Switch has two answers of two types: `Edition.isFeatureEnabled` is the answer in effect (the remote Rules the device read last, else the shipped state) and `ShippedEdition.isShippedOn` the answer as the build shipped it, and the compiler refuses one for the other; the app loads the `ShippedEdition`, one place (`editionAtLaunch`) hands the shipped states as the answer in effect until the kept Rules are read; the Account and Sync open only while on in effect by the Rules the device has when they open, so a remote off stops them opening, they never wait for the backend, and a switch back on opens them (amends 0089).
---

# «As shipped» and «in effect» are different types

Decision of 2026-11-20, ticket #2058 (spec #2049). The rule for the Account and Sync is the coordinator's default until the owner confirms it.

**Why.** One type gave two answers. `isFeatureEnabled` on the Edition from `loadEdition` meant «as the build shipped it», and the same method on the Edition of the remote Feature Switches meant «after the Rules» (ADR 0089). Which one a caller held, and whether the Rules were read yet, was kept by convention at each call site. The Shell opened the Account and Sync by the shipped answer, so a kill switch on `account` hid the screens while the Session was still read and Sync still ran in that launch.

## Decision

- **Two types.** `Edition` is the Edition in effect; `isFeatureEnabled` is the only answer it gives, and it no longer carries the shipped states. `ShippedEdition` is the Edition as the build shipped it: the same data, `featureSwitches` and `isShippedOn`, and no `isFeatureEnabled`. Neither is assignable to the other, so handing the shipped answer where the one in effect is expected does not compile.
- **Loading.** The app loads `loadShippedEdition` (`apps/mobile/src/edition/edition.ts`). `loadEdition` moves to `@slovo/core/testing`, for a test, which no remote Rule reaches: it gives the Edition in effect with each switch as the config states it, and no module of the app can import it. `inEffectWithoutRules` is the one conversion.
- **One launch-time choice.** `apps/mobile/src/edition/edition-at-launch.ts` is the one place that hands the shipped states as the answer in effect. The Shell runs on it until the Rules the device kept are read, and when they can't be; from then on every reader takes the Edition of the remote Feature Switches.
- **The Account and Sync.** Each opens only while its switch is on in effect, by the Rules the device has when it opens: the last Rules this device read, and without any the shipped state. A remote off for `account` opens neither the Account nor Sync (`sync` stands on `account`); a remote off for `sync` leaves Sync closed. The opening waits for the read of the kept Rules, at most `KEPT_RULES_WAIT_MS` (2 s), and never for the backend, so first launch and offline hold nothing up. Turned off, the opening stays closed without a logged failure; a switch back on while the app runs opens it.
- **What a remote off does not do.** It does not close an Account or a Sync already open when the answer comes: their screens hide, the Session is not refreshed (ADR 0089) and the next launch opens neither.
- **Readers that take the shipped answer on purpose.**
  - `createShell` (`app-shell.ts`): whether the Shell has an Account and a Sync at all is `isShippedOn('account')` and `isShippedOn('sync')`, since the Shell is built before anything is read. A Rule that turns on an Account the build shipped off therefore opens none, as before.
  - `createShell`: the shipped `featureSwitches` are the states the Rules are evaluated over, and the verdicts of the Analytics events until the remote switches open.
  - `editionAtLaunch`: the Shell's Edition in effect and the media's (`store-media.ts`) until the remote switches open.
  - `mascot.tsx` reads the shipped Edition's Badge families and stamp kickers, which no Rule changes; it reads no switch from it.
- **The reader's facts never open the Account.** The `signedIn` fact of the Rules reads the Account once it is open; working out the verdicts used to start its opening.

## Consequences

- The one change in behaviour is the rule for the Account and Sync. Mistake Reports of a reader whose Account is off in effect go out without the Session.
- A test draws its screens over `editionAtLaunch` or an Edition from `loadEdition`; the shipped `edition` no longer passes for one.
- A new boot-time reader has to choose by name: `isShippedOn`, or wait for the Edition in effect.

## Considered Options

- **A brand on one type.** Rejected: the two answers would still share a method name, and a spread would drop the brand.
- **Waiting for the backend's answer at launch.** Rejected: first launch and offline would hold the Account up (ADR 0089: a failure keeps the answer the app has).
- **Closing an open Account or Sync on a remote off.** Left out: the ticket's change is the opening alone.
