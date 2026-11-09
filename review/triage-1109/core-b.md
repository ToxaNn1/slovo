# Triage: core-b review (Medium + Low), against main bd94d6b2

Ids: `M*`/`L*` = core slice; `N-M*`/`N-L*` = notifications/onboarding/questionnaire/settings slice (N-M1..3 = summary M9/M8/M10).

| id | class | reason |
|---|---|---|
| M1 | FIX | `userStateRecords` (user-state-schema.ts:120-139) still stops at `mistakeReportRecords`; `domains` has `moodRecords`, `dashboardRecords`. |
| M2 | FIX | sync.ts:107 `if (!signedIn()) await forgetSession();` still has no catch; l.191 does. |
| M3 | SKIP-OWNER | Not a defect: ADR 0089 l.15 (supersedes 0040) — a changed switch value reopens the composition, so reading at open is the contract. |
| M4 | SKIP-OWNER | Not a defect: `Sync.onUserStateChange` -> shell `reopen()` (apps/mobile/src/sync/background-sync.ts:26) reopens the composition after a pull that wrote. |
| M5 | FIXED | xp-log.ts:258-269 caches sorted `word-goal` records, `counter()` memoises `goalOf` per date. Leftover: `meetGoal` calls `change()` with nothing added (l.760-762) — perf only, no test proves it. |
| M6 | FIXED | xp-log.ts:510 `levelReached` now has `.catch(() => undefined)`. |
| M7 | FIX | mood.ts:145,149 `await analytics.track(...)` uncaught after the write; peers (settings, xp-log) catch. |
| L1 | FIX | progress/records.ts date fields are `z.string()`; no local-date schema exists (merged with N-L1). Stricter decode, same encoding: no ADR 0013 conflict. |
| L2 | SKIP-OWNER | Synced record re-encoding needs a new key (ADR 0013); review itself files it for a 1.x schema bump. |
| L3 | FIX | xp-log.ts:374 `dayOf` sorts `(one.at < other.at ? -1 : 1)`; `xpGoalOf` (l.362-366) is order-dependent (daily-goal vs xp at the same instant). `newestFirst` is fine: keys unique. |
| L4 | SKIP-OWNER | Latent (no record reaches 8 KB); splitting batches/tombstoning and a `reason` in `SyncState` is an ADR 0041 design change. |
| L5 | FIX | user-state.ts:49 still `Number(record)`; `''` reads as version 0 and reruns every migration. |
| L6 | SKIP-OWNER | Not a defect: both callers pass parsed names (`CollectionLink.name` trim().min(1); `CuratedCollectionSchema.name` TextSchema). |
| L7 | FIX | widget.ts:139 `on: todayKey(clock)` with `xpLog.state` derived at the last change; before `dayTurned` fires, yesterday's count shows under today's date. `xpLog.days.date` is available. |
| L8 | SKIP-OWNER | Dropping `value.date` re-encodes a synced record (ADR 0013); `value.date` is never read (mood.ts reads by key), so no visible defect. |
| L9 | SKIP-OWNER | Not a defect: both taps write the same key `mood.<date>` (last write wins), `refresh` rereads the store. |
| L10 | SKIP-OWNER | Discriminated `origin` re-encodes a synced Collection record (ADR 0013). |
| L11 | FIX | sync.test.ts:368,419,465,466 and exchange.test.ts:828 still `toBeDefined()`. |
| N-M1 | FIX | onboarding.ts:70-75 two independent optionals; CLAUDE.md "illegal states" rule; typecheck proves. |
| N-M2 | SKIP-OWNER | Narrowing the catch makes a plan failure reject onboarding's time step (reader stuck) vs today's silent loss; needs an owner choice of failure UX. |
| N-M3 | FIX | notifications.ts:280-294 `replan`/`replanEvening`/`seen` promises dropped by `subscribe`; a throwing `replacePlan` is an unhandled rejection. |
| N-L1 | FIX | notifications/records.ts:52-53, onboarding/records.ts:19, questionnaire/records.ts:19 `z.string()` dates (with L1). |
| N-L2 | SKIP-OWNER | Not a defect: contracts fix the template count (`.length(...)`); data parsed at the edge, Core trusts it. |
| N-L3 | FIX | notification-plan.ts:107-108, 134-135, 321 read `clock.now()` twice per "now". |
| N-L4 | SKIP-OWNER | Order is a trade-off (Reserved Words with no notification vs a notified Word shown elsewhere); owner picks or it is documented. |
| N-L5 | FIX | settings.ts:146-149 tracks every key of `changes`, equal or not. |
| N-L6 | SKIP-OWNER | Device-only record redesign needs a migration; minor design, review says so. |
| N-L7 | FIX | notification-plan.ts:394 "goal reminder", test names 1054/1061/1082/1095 "reminds of the goal"; CONTEXT.md:425 _Avoid_: Reminder. |
| N-L8 | FIX | notification-plan.test.ts ~1075-1080, 1095-1105, 1118-1122 assert only absence; `[]` passes. |

Counts: FIX 15 · FIXED 2 · SKIP-OWNER 12 · SKIP-VISUAL 0 · SKIP-PATH 0.

## Tickets

### T-userstate-1: Every domain's records in `userStateRecords`; strict schema version read
- Findings: M1, L5
- Files: packages/core/src/user-state-schema.ts, packages/core/src/user-state/user-state.ts (+ their tests)
- Fix: spread `moodRecords`, `dashboardRecords` (or build `userStateRecords` from `domains` so the lists cannot diverge); read the version with `/^\d+$/` before `Number`, else throw "unreadable".
- Test: a test-support seed by fact `checkIns` (typecheck + store holds it); `openUserState` over a store with schema version `''` / `' '` / `'0x2'` rejects as unreadable.

### T-sync-1: `openSync` never rejects; real assertions in Sync tests
- Findings: M2, L11
- Files: packages/core/src/sync/sync.ts, sync/sync.test.ts, sync/exchange.test.ts
- Fix: `await forgetSession().catch(() => undefined)` at l.107; replace `toBeDefined()` with the clock's instant / the cursor value / the entry record.
- Test: signed out, a storage port whose read throws -> `openSync` resolves.

### T-mood-1: Analytics failure does not fail a Mood check-in
- Findings: M7
- Files: packages/core/src/mood/mood.ts, mood/mood.test.ts
- Fix: `.catch(() => undefined)` on both `analytics.track` calls, as settings/xp-log do.
- Test: analytics fake whose `track` rejects -> `choose`/`skip` resolve and `today` is `chosen`/`skipped`.

### T-progress-1: A day's XP records sort the same in every order
- Findings: L3
- Files: packages/core/src/progress/xp-log.ts (+ xp-log.test.ts)
- Fix: in `dayOf` sort `[...records]` entries by `at`, then by record key, as l.491 does.
- Test: a `daily-goal` and an `xp` record with the same `at`, seeded in both orders -> the same `days.byDate` goal `met`.

### T-widget-1: Goal ring carries the date its XP was derived for
- Findings: L7
- Files: packages/core/src/widget/widget.ts (+ widget.test.ts)
- Fix: take `on` from `xpLog.days.date` (widen the Pick to `'state' | 'days'`) instead of `todayKey(clock)`.
- Test: clock moved past midnight without `dayTurned` -> snapshot ring `on` is yesterday's date (not today's with yesterday's count).
- Note: T-onboarding-1 also edits widget.ts:209 (one line); land this first or rebase.

### T-dates-1: Local dates in user-state records parsed as `YYYY-MM-DD`
- Findings: L1, N-L1
- Files: packages/core/src/user-state/user-state-record.ts (add `LocalDateKeySchema = z.iso.date()` beside `InstantSchema`), progress/records.ts, notifications/records.ts, onboarding/records.ts, questionnaire/records.ts
- Fix: use the schema for every `date`/`firstWeekFrom` field; encoding unchanged, so no new key (ADR 0013).
- Test: a stored xp record with `date: '2025-1-5'` and a `notifications.ask` with `date: ''` read as absent (decode), valid ones still read.

### T-notifications-1: Fire-and-forget replans never reject unhandled
- Findings: N-M3
- Files: packages/core/src/notifications/notifications.ts (+ notifications.test.ts)
- Fix: wrap the `subscribe` listeners (`replan`, `replanEvening`, `seen`) in one helper that runs `inTurn(...)` with `.catch(() => undefined)`; the next replan retries.
- Test: scheduler `replacePlan` throws, then XP changes -> no unhandled rejection (vitest fails on one) and a later replan succeeds.

### T-notifications-2: One instant per plan; glossary words; tests that need a plan
- Findings: N-L3, N-L7, N-L8
- Files: packages/core/src/notifications/notification-plan.ts, notifications/notification-plan.test.ts
- Fix: `const instant = clock.now()` once, date and time from it (l.107/134/321); "goal reminder" -> "goal-not-met notification", rename the 4 test titles; add `plan.some(kind === 'word')` to the 3 absence-only tests.
- Test: a clock that steps from 23:59:59.999 to 00:00 between calls plans no slot of the past day.

### T-settings-1: `settingChanged` only for values that changed
- Findings: N-L5
- Files: packages/core/src/settings/settings.ts (+ settings.test.ts)
- Fix: diff `changes` against `read()`; write and track only the keys that differ.
- Test: `update({ theme: <current> })` tracks nothing; a changed value tracks once.

### T-onboarding-1: `OnboardingState` as a discriminated union
- Findings: N-M1
- Files: packages/core/src/onboarding/onboarding.ts, widget/widget.ts:209, apps/mobile/src/feed/feed.ts:57, apps/mobile/src/onboarding/onboarding.tsx:44, and the tests reading `.state.step`/`.state.finishedAt` (core onboarding.test.ts, apps/mobile onboarding*.test.tsx, dashboard-walk.test.tsx, test-states.test.ts)
- Fix: `{ status: 'open'; step } | { status: 'finished'; finishedAt }`; callers narrow on `status`.
- Test: typecheck (illegal combos unrepresentable); existing onboarding tests pass with narrowed assertions. Largest ticket (~100-150 lines, mostly tests); read docs/react-native.md before touching apps/mobile.
