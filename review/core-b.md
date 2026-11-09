# Global review 2026-11-06 — packages/core, half B (mood … widget, plus ports.ts / user-state-schema.ts / test-support.ts)

Base: main bf792f89. Read-only. Scope: `mood notifications onboarding progress questionnaire saved search settings share sounds spotlight sync user-state widget`, `user-state-schema.ts`, `user-state.ts` layer. Heuristic greps over the whole half are clean: no `as` casts (one `as unknown as` in test-support only), no `!`, no `@ts-expect-error`/`eslint-disable`, no React/RN imports, ambient time/randomness only in `ports.ts` (`systemClock`, `systemRandom`). Skipped: everything spec #1586 plans (#1598 XP-log hook module, #1603 Saved list screen, #1588–#1590 Mix).

Sub-reports (read by the saved/search/widget/share/spotlight/mood/sounds and notifications/onboarding/questionnaire/settings reviewers) are merged below; originals in `parts/core-b-saved.md` and `parts/core-b-notifications.md`.

Counts: high 2 · medium 10 · low 19 (sync/user-state/progress + saved slice: 1/7/11; notifications slice: 1/3/8).

## High

### H1. A bad Word-of-the-Day-archive key crashes the archive and Spotlight — `saved/word-of-the-day-archive.ts:107-121` (plausible, code confirmed; a bad key in a store not observed)
The record key `wordOfTheDayArchive.<date>` syncs (last-write-wins) and the date part is never parsed. `parseLocalDate` (`local-date.ts:59`) returns `NaN` fields for a malformed key and `Intl.DateTimeFormat#format(NaN)` throws `RangeError`. One such key (another device, an older build, a corrupt store) and the archive list never opens again, and the Spotlight snapshot (`spotlight.ts:64`) throws on every attempt. Fix: parse the key with a LocalDate schema where the record enters (`records.ts` / `list`), skip keys that don't read, as the Core rule «parse outside data once» asks.

## Medium

### M1. `userStateRecords` omits `moodRecords` and `dashboardRecords` — `user-state-schema.ts:120-139` (confirmed)
`domains` (l. 94-115) lists both so their keys are checked for clashes and get a sync mark, but the exported `userStateRecords` map stops at `mistakeReportRecords`. `UserStateFactName`/`UserStateFacts` (`user-state/user-state-facts.ts:5-22`) and `changesOfFacts` (used by test-support seeding) therefore cannot name `checkIns`, `correctionsWorkedThrough`, `curatedCollectionsOpened`: a fact under those names fails the type check or, through a loosened object, is silently skipped (`isFactName`, l. 32) and the test runs against an empty store. Fix: spread `...moodRecords, ...dashboardRecords` into `userStateRecords`, or derive `userStateRecords` from `domains` so the two lists cannot diverge.

### M2. `openSync` can reject although Sync promises «Nothing it does rejects» — `sync/sync.ts:107` (confirmed)
Signed out, `openSync` awaits `forgetSession()` with no catch; `forgetSession` reads the cursor and `syncSyncedAt` and writes through the tracked state (l. 96-105). The very next line guards the same read with `.catch(() => undefined)` (l. 108), and the same call inside `drain` is guarded (l. 191). Scenario: the storage adapter throws on launch while signed out → `openSync` rejects → the composition that awaits it fails to open, so a storage hiccup takes the app down instead of one quiet sync. Fix: `await forgetSession().catch(() => undefined)` at l. 107 (the next launch retries anyway, as the comment at l. 190 says).

### M3. Mood reads its Feature Switch once, at open — `mood/mood.ts:57` (plausible)
Other modules read `isFeatureEnabled` per call (sync.ts:134, active-days.ts:90, streak-break.ts:54); Mood caches it. ADR 0040 lets a switch be turned off remotely while the app runs; Mood would keep asking, recording and shifting the Feed parameters until a restart. Fix: read the switch in each entry point like the rest of the Core.

### M4. Mood's «today» is not refreshed by a synced check-in — `mood/mood.ts:63-104` (plausible)
A check-in pulled from another device during the Session (the record syncs) does not update the in-memory today state until the module is reopened. Same class of issue as M3 — see the saved sub-report for the detail.

### M5. `derive()` in the XP log is O(records × days) and runs on every Seen card — `progress/xp-log.ts:258-272, 282-283, 318-329, 397-401` (plausible)
`goalOf(day)` scans every record; `derive` calls it once per day in `byDate` (l. 398-401), `dayOf` scans twice more (`wordGoalSetBy`, `goalOf`), and `change()` → `derive()` runs on each award commit, each day turn, and on **every History change even when nothing is added** (`meetGoal`, l. 629-632). A reader with a year of records (several thousand) pays ~10⁶ comparisons per card scrolled past, on the JS thread. Fix: compute the sorted `word-goal` list once per `derive` (or keep it incrementally) and look goals up by binary search; call `change()` from `meetGoal` only when the seen count actually changed.

### M6. `levelReached` is the one analytics call without a catch — `progress/xp-log.ts:434` (plausible)
`void analytics.track('levelReached', …)` has no `.catch`, while `dailyGoalMet` (l. 439), `dailyGoalChanged` (l. 568), `breakStarted` (streak-break.ts:86), `badgeEarned` (badges.ts:151) and `emit` (active-days.ts:14) all swallow. `Analytics.track` is `async` and calls `port.track` synchronously inside (analytics.ts:138-141), so a throwing port rejects the promise → an unhandled rejection on a level-up. Fix: `.catch(() => undefined)` like the others, or make `track` itself never reject and drop every caller-side catch (one way, not two).

### M7. Analytics failures reject `choose`/`skip` after the write succeeded — `mood/mood.ts` (plausible, from the saved sub-report)
The record is written, then `analytics.track` is awaited without a catch; a failing port surfaces as a failed check-in to the UI although it is stored. Fix: as M6.

## Low

### L1. XP-record dates are unparsed strings — `progress/records.ts:31,40,44,55,61,66,67` (confirmed)
`date: z.string()` for a synced record; `streak.ts:73-74`, `streak-break.ts:65`, `calendar.ts:82` each re-defend with `Number.isFinite`, but `badges.ts:50` (`runsOf`) does not filter `NaN`, and `xp-log.ts` compares dates as strings (l. 264-267, 300-303, 321, 324). A record with `2025-1-5` from a buggy build sorts and compares wrongly. Fix: a `LocalDateKeySchema` in contracts/local-date used by every `date` field, so the Core trusts the type (the schema is union-merged, so this is a parse-time rejection, not a migration).

### L2. Illegal states in the `xp` record — `progress/records.ts:28-39` (confirmed)
`mode?` and `rarity?` are optional on every source; `seen-word` with a `mode`, or `game-round` without one, are representable. A per-source discriminated union (`source: 'game-round', mode, rarity?` …) would make `award` (xp-log.ts:478-483) and `derive` (l. 384-390) simpler. A new encoding needs a new key under ADR 0013, so file it for a 1.x schema bump rather than fixing in place.

### L3. Sort comparator never returns 0 — `progress/xp-log.ts:322`, `in-turn.ts:47` (`newestFirst`) (confirmed)
`(one, other) => (one.at < other.at ? -1 : 1)` is inconsistent for equal `at` (two devices, same second, union-merged); Array.prototype.sort may then order the two records arbitrarily across runs, which flips which record `xpGoalOf` sees first (l. 310-314). Fix: `localeCompare` / `a.at < b.at ? -1 : a.at > b.at ? 1 : 0`, then a key tie-break as `newestFirst` does.

### L4. A poison pending change blocks the push forever — `sync/exchange.ts:288-297`, `sync/sync.ts:168-171` (plausible)
ADR 0041 refuses a value over 8192 bytes whole (`BAD_REQUEST`); the push returns a failure, `deleteSent` never runs, the pending change stays, and every later sync fails at the same batch. Sync shows nothing (`offline: false`, l. 169) and `not-found` / `too-many-records` are likewise swallowed without a state. Today no synced record should reach 8 KB, so this is latent. Fix: on a non-retryable push failure split the batch / drop the one refused record as a tombstone, and surface `reason` in `SyncState` for the SLOVO ID status line.

### L5. Schema version read with `Number()` — `user-state/user-state.ts:49` (confirmed)
`Number('')`, `Number(' ')` are `0`, `Number('0x2')` is `2`, `Number('1e0')` is `1`: an empty-string record re-runs every migration from scratch rather than failing as «unreadable». Fix: `/^\d+$/` + `Number.parseInt`, or decode through `schemaRecords.schemaVersion` (`user-state-schema.ts:88`), which already exists and is unused for reading.

### L6. `createCopy` may create a Collection with an empty name — `saved/collections.ts` (plausible, saved sub-report)
Fix: validate the name like `create` does, in one place.

### L7. Widget goal ring near midnight — `widget/widget.ts` (plausible, saved sub-report)
Yesterday's XP can be shown under today's date when the snapshot is taken across the day turn. Fix: take `todayKey` and the XP from one `derive` result.

### L8. Mood record duplicates the date — `mood/records.ts` / `mood.ts:82` (confirmed, saved sub-report)
The date is both the key suffix and `value.date`; the two can disagree after a hand-edited or buggy write. Fix: keep it in the key only (`declareRecords` already gives the id), or validate equality on `list`.

### L9. Mood has no `createInTurn` — `mood/mood.ts` (plausible, saved sub-report)
Two quick taps can write two check-ins for today; the other write-modules serialise with `inTurn`.

### L10. `source?` on Collection stays an optional flag — `saved/records.ts` (confirmed, saved sub-report)
A discriminated `origin` union (`own` | `curated: id`) would remove the `source === undefined` branches.

### L11. Weak assertions — `sync/sync.test.ts:368,419,465-466`, `sync/exchange.test.ts:810` (confirmed)
`toBeDefined()` on `syncedAt` / a Collection entry proves presence, not value; the tests around them do assert values, so these lines are padding rather than proof. Fix: assert the clock's instant / the entry record.

## Checked and found consistent (so nobody re-reviews them)
- `exchange.ts` merge rules match ADR 0041 §26-28: tie → Account; `union` ignores tombstones; `highest` re-pushes mine as a tracked write; History trimmed only in the last page; first-sign-in rule idempotent (`pending.has(key)` skip) and re-applied after `forgetSession`, as the Sync doc says.
- `tracked-user-state.ts`: Sync's own writes (`sync.*`, device-only) leave no pending change and do not `tell`, so a successful sync does not schedule another one (no 5 s loop).
- `xp-log.ts:399` Active Day = goal met when a goal is set: ADR 0074 supersedes the «≥5 XP» line of ADR 0066; the index line of 0066 still reads «Active Day (≥5 XP)» and should say «… or the Daily Goal met (ADR 0074)» — docs-only.
- `streak.ts`, `streak-break.ts`, `active-days.ts`, `badges.ts`, `levels.ts`, `calendar.ts`, `progress.ts`: no defect found beyond L1/L3; `Math.min(...active)` on an empty set yields `Infinity` and the loop is skipped, fine.

## Notifications / onboarding / questionnaire / settings
Top of this slice: **H2** `notifications/notification-plan.ts:109,144,367-375` — the 64-notification cap is applied before the 1.0 plan keeps only 2 slots a day, so with ≥5 Notification times the plan covers fewer than 14 days (10 times → days 0–6 only; with `politePause` on, a week of silence then the day-14 farewell; both switches on in `editions/uk/edition.json`; no test combines the evening slot with >3 times). **M8** `notifications/notifications.ts:255` — `askPermission().catch(() => undefined)` also swallows failures of the plan write and `replacePlan`, so a broken plan after onboarding leaves the reader without notifications and nothing shows it. **M9** `onboarding/onboarding.ts` — `OnboardingState` as two independent optionals instead of a discriminated union. **M10** evening re-plans fired with `void` → unhandled rejections (plausible).

Full sub-report, verbatim:

Scope: packages/core/src/{notifications,onboarding,questionnaire,settings}/*.ts at main bf792f89. Read-only review: nothing was built or run.
Counts: high 1, medium 3, low 8.

#### High

##### H1. The 64-notification cap is applied before the 1.0 plan filters slots, so with many Notification times the plan covers only about 7 days, and the polite pause goes silent for a week before the farewell
- Where: packages/core/src/notifications/notification-plan.ts:109 (`slotsAhead` count = min(times*14, 64)), :144 (`slotsUntilPause` slice to 63), :367-375 (`slotsOf` then keeps only the earliest and latest time of each day).
- What is wrong: the cap counts every Notification time of every day. With `eveningNotification` on (it is on in editions/uk/edition.json:91, as is `politePause` at :58), only 2 slots a day survive the later filter. So the cap trims days that would never have gone over 64.
- Failure scenario: the reader keeps 10 times (MAX_NOTIFICATION_TIMES = 10, contracts/src/edition.ts:578).
  - Polite pause on: 150 slots, minus the farewell, sliced to 63, end on day 6. The plan holds mornings for days 0-6 and evenings for days 0-5, then nothing on days 6-13, then the farewell on day 14.
  - Polite pause off: 64 slots cover about 6.4 days, so the plan holds about 7 mornings instead of 14.
  - The same happens at 5 or more times (5*15 = 75 > 63).
- Fix: filter slots to the 1.0 shape first, then apply the cap: in `slotsOf`, compute the morning and evening slots over the full day range and cap the total (words + evenings + farewell) at 64. Or make `slotsAhead`/`slotsUntilPause` take the per-day time list (`[earliest, latest]` on the 1.0 plan).
- Test gap: the cap tests (:194, :641) and the evening tests (:1013-1200) never combine evening on with more than 3 times.
- Confidence: confirmed by reading (traced the arithmetic, not run).

#### Medium

##### M1. OnboardingState can hold illegal states
- Where: packages/core/src/onboarding/onboarding.ts:70-75.
- What is wrong: `finishedAt: Date | undefined` and `step: OnboardingStep | undefined` are two independent optionals. That allows 4 combinations, and only 2 are legal (open with a step, finished with no step). "Finished and still on a step" and "neither" can both be written. `show()` (:282-285) spreads `...state`, so it would carry a `finishedAt` along if one were ever set.
- Fix: `type OnboardingState = { status: 'open'; step: OnboardingStep } | { status: 'finished'; finishedAt: Date }`.
- Confidence: confirmed (design).

##### M2. A blanket catch in chooseOnboardingTime hides planning bugs, not just a device that fails to ask
- Where: packages/core/src/notifications/notifications.ts:255, `await askPermission().catch(() => undefined)`.
- What is wrong: the internal `askPermission` (:271-276) runs `planner.permission()`, `planner.askPermission()` and then a full `plan()`: `takeMorningWord`, user-state writes, `scheduler.replacePlan`. The comment says only the device's failure to ask is meant to be swallowed.
- Failure scenario: a bug or a write failure in the plan made right after the onboarding answer is lost without a trace. The reader then has no notifications, and nothing reports why.
- Fix: catch only around `planner.permission()`/`planner.askPermission()`, and let `plan()` throw. Or catch, report, and rethrow anything that does not come from the port.
- Confidence: confirmed (the catch scope is visible in the code).

##### M3. Evening replans are fire-and-forget, so a failure becomes an unhandled rejection
- Where: packages/core/src/notifications/notifications.ts:288-289, `xpLog.subscribe(() => void replanEvening())` (same for activeDays).
- What is wrong: `plan()` can reject, for example when the scheduler or a user-state write fails. `void` drops the promise, so the rejection is unhandled, and the in-turn queue keeps going with an evening plan that may be stale.
- Failure scenario: `replacePlan` throws after XP is earned. The evening message on the device stays the old one, for example a streak warning after the goal is met, and the only trace is an unhandled-rejection warning.
- Fix: return the promise if `subscribe` awaits listeners, as `Subject.publish` does elsewhere. Otherwise attach an explicit error path.
- Confidence: plausible (the xpLog subscriber contract was not checked).

#### Low

##### L1. Local dates in user-state records are not parsed as dates
- Where: packages/core/src/notifications/records.ts:52-53 (`date: z.string()`), onboarding/records.ts:19 (`firstWeekFrom: z.string()`), questionnaire/records.ts:19 (`date: z.string().optional()`).
- What is wrong: these values go to `parseLocalDate` (notification-explainer.ts:74), which is lenient: `''` becomes {0,0,0} and `'abc'` becomes NaN.
- Failure scenario: a malformed `notifications.ask` date makes `today < NaN + 7` false, so the re-ask comes at once. A malformed `firstWeekFrom` never equals a date, so a later question comes on the onboarding day.
- Fix: add a `LocalDateSchema` (a `YYYY-MM-DD` regex plus a calendar check) to contracts and use it in these records. None exists today (grep found none).
- Confidence: confirmed (no schema). The values are device-only and written by the Core, so the real-world risk is low.

##### L2. drawTemplate returns -1 when there are no title templates
- Where: notification-plan.ts:151-155; the type at :56 is `readonly string[]`.
- What is wrong: with `count = 0`, `others = 0`, and `Math.min(0, -1)` is -1. `chooseTemplates` then writes -1 into `notifications.titles`. `declareRecord.change` does not validate (user-state-record.ts:73), but `decode` runs `nonnegative()`, so the whole titles record silently reads as absent from then on.
- Mitigation: contracts fix the count (`.length(NOTIFICATION_TITLE_TEMPLATE_COUNT)`), so this cannot happen in the app.
- Fix: type `titles` as a non-empty tuple. The fallback `titles[...] ?? '{word}'` at :471 would then be dead code and could go.
- Confidence: confirmed.

##### L3. The clock is read twice per "now", so a plan made at midnight can include a slot that has already passed
- Where: notification-plan.ts:107-108, :134-135 and :321. `todayDate(clock)` and `localTimeOf(clock.now(), clock)` each call `clock.now()`.
- Failure scenario: at 23:59:59.999, today is day N and now is 00:00 of day N+1. Every time on day N then counts as ahead, so slots in the past are planned and Reserved.
- Fix: take `const instant = clock.now()` once and derive both the date and the time from it.
- Confidence: plausible (a narrow window).

##### L4. Reserved Words are stored before the scheduler accepts the plan
- Where: notification-plan.ts:504-505.
- What is wrong: `stored.replace(...)` runs before `scheduler.replacePlan(...)`. If the port throws, Words stay Reserved for notifications that were never scheduled, until the next plan.
- Fix: hand the plan to the scheduler first, then store the Reserved Words. Or document the order as intended.
- Confidence: plausible.

##### L5. settingChanged is emitted for values that did not change
- Where: settings/settings.ts:138-141.
- What is wrong: every key in `changes` is tracked, even when it equals the stored value.
- Failure scenario: the UI sends the whole form, and analytics counts changes that never happened.
- Fix: diff against `read()` before writing and tracking.
- Confidence: confirmed (the caller's behaviour was not checked).

##### L6. Optional flags in the laterQuestions record
- Where: questionnaire/records.ts:17-21.
- What is wrong: `date?` and `offerRarityTest?` are a tri-state (undefined/false/true). `offerRarityTest` only means something once the self-rating was answered.
- Fix: a union, or record the self-rating answer itself.
- Confidence: confirmed (design, minor).

##### L7. A glossary _Avoid_ word is used
- Where: notification-plan.ts:394 ("the goal reminder"), and test names at notification-plan.test.ts:1054, 1061, 1082 and 1095 ("reminds of the goal").
- What is wrong: CONTEXT.md:357 lists "Reminder" under _Avoid_ (for Notification time). The message kind is already named `goalNotMet`.
- Fix: say "the goal-not-met notification".
- Confidence: confirmed (but "Avoid" is scoped to the Notification time entry).

##### L8. Tests that would still pass on an empty plan
- Where: notification-plan.test.ts:1075-1080, 1095-1105 and 1118-1122.
- What is wrong: they only assert that there is no evening notification. `planOf` throws only when nothing was planned, so `[]` passes all three.
- Fix: also assert that the day's morning `word` notification is there, as :1152-1163 already does with `plan.some(kind === 'word')`.
- Confidence: confirmed.

#### Checked and found fine
- `drawTemplate` gives a uniform draw that excludes the previous template.
- Polite-pause day range: days 0..14 inclusive, so the farewell falls on today+14.
- `localDateAfter` and `dayNumber` work in UTC, so DST is safe.
- Explainer: the day-3 bound, onboardingDay + 2, is correct.
- Synonym Row ellipsis: members have min(5), so there are always more than 3.
- `notificationBody` uses code-point cuts.
- The onboarding answers a second tap with `ending`.
- The farewell switch off on purpose leaves the last slot silent (test :1190).
- Outside scope, noted: `declareRecord.decode` (user-state/user-state-record.ts:67-70) turns a failed parse into "absent" without a word. A corrupt `notifications.times` record that held `[]` would therefore bring back the Edition's default times and switch notifications on again.
