# Review: origin/feat/1709-admin vs origin/main (medium)

Scope read: apps/backend/src/admin/admin-procedures.ts, packages/server-core/src/admin/{admin-access,admin-sign-in,owner-checks}.ts,
apps/backend/src/admin/owner-check-store.ts, apps/backend/src/content/content-writes.ts (diff),
packages/content-rules/src/{crossword-days,check,parse-record}.ts, packages/contracts/src/api/admin.ts (inputs), crossword.ts.
Not covered (context budget): apps/admin UI, alerts/monitor/cron, analytics, development sources, sentry-api, mobile force-update.

Authz checked and found sound: 404 while no Власник; Агент token refused outside content procedures; Безпека
procedures (people, invite, setRole, removePerson, agent tokens, actions, alert thresholds, latestAlerts) need role
`owner`; writes need the admin header; self role change / self removal refused; CI token compared in constant time and
admits pushCiRun only (ADR 0096); session idle 8 h / life 30 d, 3 attempts then 15 min (ADR 0088); Crossword day
create/edit/retire on or before today refused, edit keeps the date (ADR 0090).

## 1. Medium: invite is not atomic with its email
apps/backend/src/admin/admin-procedures.ts:377-381 (invite handler)
- Defect: `admin.invite` adds/reactivates the Admin user and appends the Action log row, then `mailer.send` runs. If the
  mail fails (provider down, bad address), the procedure answers 500 although the person already has access.
- Failure: Власник invites x@y; Resend times out -> UI shows an error; retry answers CONFLICT `taken`, so the invite
  mail is never sent and the Власник cannot resend it without remove + invite again (two more log rows).
- Fix: send the mail first and invite only on success, or treat a send failure as a reported partial result
  (`{ invited: true, mailed: false }`) and offer a resend; at least do not answer an error for a done write.

## 2. Medium: EmailSchema accepts any 3-320 char string
packages/contracts/src/api/admin.ts:173 (`EmailSchema = z.string().trim().min(3).max(320)`), used by invite.
- Defect: input validation at the edge: no email format check, so invite stores an Admin user under "abc" or a
  typo'd address and logs it; combined with #1 the mailer then fails after the write.
- Fix: `z.email()` (zod 4) with trim/lowercase in the schema; keep the loose schema only where it must not reveal
  anything (requestCode answers the same either way, so a format check there is still safe).

## 3. Medium: addOwnerCheck takes no reason (ADR 0088)
packages/contracts/src/api/admin.ts:1175; apps/backend/src/admin/admin-procedures.ts:690-694;
packages/server-core/src/admin/owner-checks.ts (logAdded writes `reason: null`).
- Defect: ADR 0088 "Every change asks for a confirmation and a reason ... Two exceptions: an Entry save ... and ticking
  an owner check". Adding an Owner check is neither exception, yet the input has no `reason` and the log row has null.
  ADR 0088 also says agents add checks "through a command"; the admin procedure lets any Адмін add one without reason.
- Fix: add `reason: ReasonSchema` to addOwnerCheck input and pass it through `OwnerChecks.add` to the log, or record
  the exception in an ADR amendment.

## 4. Low: content.retire reason optional
packages/contracts/src/api/admin.ts:403 (`reason: z.string().min(1).optional()` on retire).
- Defect: ADR 0088 makes the reason optional only on an Entry save; a retire takes a record (or a future Crossword
  day) out of the pack and is not a save. Also the reason here is not trimmed, unlike ReasonSchema (whitespace-only
  passes `min(1)`).
- Fix: `reason: ReasonSchema` on retire; use `ReasonSchema.optional()` on create/edit for the trim.

## 5. Low: Needs is a bag of optional flags
apps/backend/src/admin/admin-procedures.ts:82-90 (`Needs`) and writerOf:233-245.
- Defect: three independent optional booleans allow meaningless combinations (`security` + `writesContent` would let an
  Агент token reach a Безпека procedure, since the Bearer branch returns before the role check). writerOf then
  re-checks the admin header by hand because `writes` cannot be expressed for "admin-user only".
- Failure today: none (no call passes that combination), but one future `{ security: true, writesContent: true }`
  opens Безпека to every Агент.
- Fix: a discriminated union, e.g. `{ caller: 'session', role: 'any' | 'owner', writes: boolean } | { caller:
  'session-or-agent', writes: boolean }`, with the header rule applied in one place.

## 6. Low: tickOwnerCheck reads every check to return one
apps/backend/src/admin/admin-procedures.ts:680-688.
- Defect: after the tick it loads `ownerChecks.list()` (all versions) and finds by id; also a second NOT_FOUND branch
  that cannot happen after `tick` answered not `unknown`.
- Fix: have `OwnerCheckStore.tick` return the row (`returning()`), or add `byId`.

## Review part 2

Scope: apps/admin UI, backend alerts / monitor / cron, analytics (Огляд, Аналітика), development sources, sentry-api, mobile force-update.

1. **apps/backend/src/quality/sentry-api.ts:91 (+ fetch at :76)**: a body that fails to parse throws, and so the whole Cron run fails.
   - Defect: `await response.json()` runs outside the try and is cast with `as Json | Json[]`. The response is never parsed with a schema. The fetch also has no timeout, unlike readJson and posthog-client, which use `AbortSignal.timeout`.
   - Failure scenario: Sentry or a proxy answers 200 with HTML or a truncated body. `sentry.read` rejects. In `createMonitor.check` (packages/server-core/src/admin/monitor.ts:96) `sentryNumber` has no catch, so `run()` throws before any `store.keep`. The ci-red, backend-down, batch-size alerts and the digest of that run are all lost. cron-command exits 1, and the same happens every 15 min while Sentry misbehaves. The Якість procedure 500s instead of showing «Sentry недоступний». A hanging Sentry also hangs the Cron run.
   - Fix: put the json read inside the try. Parse each endpoint with a zod schema, which also removes the `as` casts at :99, :125, :128, :129. Add `AbortSignal.timeout`. Map every failure to `{ ok: false, reason: 'unavailable' }`.

2. **apps/backend/src/quality/sentry-api.ts:82,85 with packages/server-core/src/quality/quality.ts:84**: the rate-limit time is not injected.
   - Defect: `retryAt` comes from `Date.now()`, but `createQuality` compares it with the injected `clock.now()` (`now < limitedUntil`).
   - Failure scenario: with a fake clock in tests, or any clock that differs from the real one, the 429 back-off window is wrong. It can be ignored (Sentry is hammered while it limits) or last far too long (Якість shows «unavailable» for hours of fake time). It also breaks the "inject time" rule.
   - Fix: give `createSentryApi` a `clock: Clock` and compute `retryAt` from it.

3. **packages/server-core/src/quality/quality.ts:126-130**: almost every real failure is marked flaky.
   - Defect: `flakyTests` marks a failed test flaky as soon as any other run in the period does not list it as failed, whatever the sha.
   - Failure scenario: a test breaks in run N (sha A) and the fix lands in run N+1 (sha B). Run N reports the test as flaky. With 2 or more runs in a period, nearly every genuine red test is shown as flaky on Якість.
   - Fix: count a test as flaky only when another run of the same `sha` passed it (a re-run), i.e. `other.sha === run.sha && !other.failedTests.includes(test)`.

4. **packages/server-core/src/quality/quality.ts:117**: a cast hides a missing KPI.
   - Defect: `Object.fromEntries(entries) as Record<SentryRead, QualityKpi>` is an `as` cast that hides an incomplete record. If `SENTRY_READS` misses a key, the compiler cannot catch it.
   - Fix: build the record with a typed `Record<SentryRead, ...>` mapping, for example by awaiting each kpi into an object literal keyed by `SentryRead`.

5. **apps/backend/src/alerts/owner-chat.ts:44,56**: the Telegram strings break the glossary.
   - Defect: they say «Великий пакет у черзі» and «Відкритих пакетів». CONTEXT.md:57 names a Batch «пачка», and the admin itself says «Відкриті пачки» (overview.tsx).
   - Failure scenario: the owner sees two words for one concept.
   - Fix: use «пачка» / «пачок».

6. **apps/admin/src/filters.ts:17 with :50-54**: the '1d' period does not match its label.
   - Defect: '1d' is labelled «24 години», but `periodDays('1d', now)` gives `from = to =` today's Kyiv date. It covers the time since Kyiv midnight, not the last 24 hours.
   - Failure scenario: at 00:30 Kyiv, Аналітика and Огляд «24 години» show about 30 minutes of activity and visits. Якість's '1d' is a true rolling 24 h (quality.ts uses `days * DAY_MS`), so the same filter means two different windows on one page (Огляд).
   - Fix: either rename the label to «Сьогодні», or send a rolling window (yesterday to today, cut by hour) for '1d'.

7. **packages/server-core/src/admin/monitor.ts:96-152**: one throwing check aborts every other check.
   - Defect: the checks run in sequence with no isolation. A throw from any port, such as `ciRuns.between`, `batches.open` (a DB hiccup) or Sentry (see 1), loses all the other alerts of the run, including backend-down.
   - Failure scenario: a transient DB error in `batches.open()` means the backend-down alert computed just before it is never kept.
   - Fix: run each check behind its own catch (log it and go on), then keep what fired.

Checked with no finding: alert-store / 0021 unique key (null keys repeat correctly), the digest once per Kyiv day and its retry, Kyiv day math in monitor (`kyiv`, `shiftDay`), PostHog HogQL Kyiv days, query-queue and source-cache, github and eas sources (zod at the edge), development milestone sort, force-update gate/`forceUpdateOf`/`compareVersions`, sessionStarted/sessionEnded with the injected clock.
