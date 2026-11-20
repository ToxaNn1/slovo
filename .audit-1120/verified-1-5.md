# Audit 1120: verified findings, zones 1-5

Checked on `main` at 0439b5deb by reading the cited code, the ADR index (`pnpm -s adr:index`) and `CONTEXT.md` by grep. Nothing was run; no code changed.

Ids are `zone.n` as in the zone files (`2.M1`, `2.L3` keep the zone's own letters). Paths are from the repo root.

Verdicts: CONFIRMED = the code does it as said. PLAUSIBLE = the mechanism is there, the harm depends on something not checkable by reading (deployment values, data size, a rare race, an owner's decision). REJECTED = the code does not do it, another layer handles it, or it is intended.

Counts (63 raw findings, 60 after merging 3 duplicates): CONFIRMED 30, PLAUSIBLE 29, REJECTED 1.
By final severity: high 0, medium 10, low 50 (the rejected one included).

Merged: `2.L5` into `2.M1` (same root cause); `2.L9` into `1.4` (the Daily Crossword over midnight); `3.L11` into `1.12` (`as` casts).
Severity changed: `2.M3`, `2.M4`, `3.M1`, `3.M2` medium -> low (reasons below).

---

## Medium

### 1.2 CONFIRMED, medium
- Where: `packages/core/src/feed/word-of-the-day.ts:151`
- Defect: the "Cycle goes on" check counts only unseen Corrections and Idioms; `cycle.unseen()` also holds `synonymRows` and `tips`, which `feed/feed.ts:412-415` counts and the glossary's Cycle ("when every Entry is Seen") covers.
- Consequence: with every Word, Correction and Idiom Seen but a Synonym Row or Tip left (a narrow Mix), the next morning starts a new Cycle with no End-of-Cycle card, wipes Seen, and ends the first Cycle, which stops Seen-Word XP.
- Fix: sum all four non-Word lists (or reuse the Feed's `unseenLeft`) in that check; add a test with only a Tip unseen.

### 1.1 CONFIRMED, medium
- Where: `packages/core/src/saved/history.ts:130-141`; read by `packages/core/src/progress/xp-log.ts:489-498` (`seenToday`), `:884-888` (`metToday`); the app calls it at `apps/mobile/src/saved/history.ts:23`.
- Defect: today's Words Seen are counted from the History list alone, and `clear()` empties it. No ADR or glossary line says clearing History costs the day (History: "survives Cycles"; Daily Goal: "a day already met stays met", which only protects a day already met).
- Consequence: a reader with 8 of 10 Words Seen who clears History is back at 0 of 10; the goal needs 10 more new Words and the Streak can break that day.
- Fix: count today's Seen Words from a record that clearing History does not delete (the Seen-Word XP records, or a per-day counter in the XP log).

### 2.M1 (+2.L5) CONFIRMED, medium
- Where: `packages/core/src/notifications/notifications.ts:313-328`, `packages/core/src/subject.ts:34-36`, `packages/core/src/feed/day-change.ts:105-111`, `packages/core/src/composition.ts:687`; adapter `apps/mobile/src/notifications/notification-scheduler.ts:116-133` has no catch.
- Defect: `plan()` rejects when the device scheduler rejects; `Subject.publish` stops at the first failing listener; Notifications subscribes to `dayTurned` at `composition.ts:518-530`, before the Feed, Game and Dashboard. `void replanEvening()` (`:322-323`) is the same rejection, unhandled.
- Consequence: one failed `scheduleNotificationAsync` on a new local day makes `day.resume()` reject, so the composition does not open (the app does not start), and `turnedTo` stays unset.
- Fix: catch and report inside the Notifications listeners (`replan`, `replanEvening`, the `seen` listener) so a plan failure never leaves the module.
- Note: the trigger (the OS refusing to schedule) is rare; the effect when it happens is total.

### 2.M2 CONFIRMED, medium
- Where: `packages/core/src/sync/exchange.ts:291-301`, `packages/core/src/sync/sync.ts:165-172`; the cap `packages/server-core/src/sync/sync.ts:18` (`recordsPerEdition: 20_000`).
- Defect: a push refused for good (`too-many-records`, `unexpected`, `not-found`) returns at that batch; the batch is never dropped, and `SyncState` only knows `offline`.
- Consequence: once an Account hits the record cap, nothing from the device reaches the Account again, the status line shows the old "synced" time, and every sync repeats a pull and a failing 500-record push.
- Fix: give `SyncState` a "refused" state the Account screen shows, and stop re-sending a batch refused for a terminal reason until the next app launch; decide separately what frees records at the cap.

### 4.M1 CONFIRMED, medium
- Where: `apps/backend/src/admin/admin-store.ts:307-324`, `apps/backend/src/app.ts:254`, `packages/server-core/src/admin/admin-sign-in.ts:136,207`; docs `docs/deploy.md:229`.
- Defect: the TOTP vault key is `HMAC(AUTH_SECRET,'admin-totp')`; after a rotation `vault.open` throws in `decipher.final()` (uncaught, a 500), and `verifyCode` sends a user whose TOTP is `on` to `next: 'totp'`, never back to enrolment. Only `reactivateAdminUser` (`admin-store.ts:186-200`, remove then re-add) clears the secret.
- Consequence: after rotating `AUTH_SECRET` every Admin user gets a 500 at the TOTP step; `docs/deploy.md` promises "set up the TOTP again", which the code cannot do.
- Fix: treat a vault open failure as "TOTP not set" (back to enrolment after the emailed code), or add an owner command that clears a user's TOTP; correct `docs/deploy.md`.

### 4.M3 CONFIRMED, medium (latent)
- Where: `apps/backend/src/database/migrate.ts:46-60`; drizzle-orm 0.45 `pg-core/dialect.js:57-62` (runs only migrations with `folderMillis` greater than the last `created_at`).
- Defect: a migration whose journal `when` is older than one already run is skipped, and `migrationState` (`findLast(when <= ran)`) then answers `migrated` because the skipped entry is last in the journal.
- Consequence: two branches that generate migrations out of order leave production without a table or column while `/health` is green; the first query needing it answers 500.
- Fix: a test that the journal's `when` values strictly increase (none exists today: `src/test-support.ts` reads only `tag`).

### 5.M1 CONFIRMED, medium
- Where: `apps/backend/src/media/media-store.ts:62,101` (no `AbortSignal`), `apps/backend/src/recordings/recordings.ts:337-363` (`store.delete(path)` inside the transaction holding `pg_advisory_xact_lock(hashtext(editionId))`).
- Defect: R2 calls never time out, and the sweep's delete runs under the Edition's content write lock.
- Consequence: a stalled R2 DELETE blocks every admin and Agent content write of that Edition until the Cron process is killed.
- Fix: `AbortSignal.timeout` on every Media Store request; a hung request then rolls the transaction back. Same class as `4.L3`.

### 4.M2 PLAUSIBLE, medium
- Where: `apps/backend/src/app.ts:155-167`, `apps/backend/src/config.ts:141-145`, `.railway/railway.ts:62` (`preserve()`), `docs/deploy.md:55`.
- Defect: (a) `TRUSTED_PROXY_HOPS` defaults to 0 and production does not require it; (b) with 2 hops, a request sent straight to the Railway domain with a forged `X-Forwarded-For` has its forged address taken by `at(-2)`.
- Consequence: (a) all readers share one per-IP sign-in limit, so one script blocks sign-in for everyone; (b) per-IP limits are bypassed, only the per-email ones remain.
- Fix: require hops >= 1 when `NODE_ENV=production`; behind Cloudflare take the address from `CF-Connecting-IP` or refuse requests that skipped Cloudflare.
- Not checked: the value set in Railway and whether the Railway domain is still public (ADR 0063 names the hop counts, not the direct-origin case).

### 4.M4 PLAUSIBLE, medium (owner's decision)
- Where: `apps/backend/src/admin/admin-procedures.ts:412-426`.
- Defect: `deleteAccount` writes the deleted reader's email into `action_log`; ADR 0088 line 21 keeps the log "forever and never edited" with "the value before and after", and says nothing about personal data of a deleted Account.
- Consequence: a reader erased through the admin keeps their email in the database for good.
- Fix: log the Account id or a hash of the email; or state the retention in an ADR and the privacy text.

### 5.M2 PLAUSIBLE, medium
- Where: `apps/backend/src/content/quote-check-command.ts:28` (`response.text()` unbounded), `apps/backend/src/content/quote-check.ts:210-216` (whole body into `sourcing_cache`).
- Defect: every 200 or 404 source page is stored whole, per distinct URL, with no size cap.
- Consequence: a few thousand dictionary pages of 100-300 KB each would pass Neon's 0.5 GB free storage; the Cron also holds each body in memory.
- Fix: cap the body read and cached (a few hundred KB) or keep only the text the check needs.
- Not checked: the present size of `sourcing_cache` (one `select pg_total_relation_size` settles it).

---

## Low

### 2.M3 CONFIRMED, low (was medium: the trigger is a failing Keychain delete, and a restart recovers)
- Where: `packages/core/src/account/account.ts:256-263`, `:312-316`, `:473-478`.
- Defect: `endSession` bumps `endedSessions` and clears `token` before `await sessions.forget()`; when that rejects, `complete`'s catch skips clearing `inFlight` and `signOut` never reaches `change`.
- Consequence: the Account screen is dead until the app restarts (stuck "deleting", or signed in with a sign-out button that does nothing).
- Fix: catch a failing `forget()` inside `endSession` (retry at the next launch) so the state always settles to signed out.

### 2.M4 CONFIRMED, low (was medium-low: other candidates still give a Quick Question)
- Where: `packages/core/src/game/quick-question.ts:103`.
- Defect: `if (round?.form !== 'pick') return undefined;` also ends the loop when `round` is `undefined` (this Entry builds no Round), instead of trying the next Entry.
- Consequence: Game Modes with unaskable Entries give Quick Questions less often than their equal share.
- Fix: `if (round === undefined) continue;` before the form check.

### 3.M1 PLAUSIBLE, low (was medium: ADR 0089 line 20 and its rejected alternative make "on for anyone is on" the rule, and an open backend procedure no device calls harms little)
- Where: `packages/server-core/src/edition/edition-registry.ts:139-159`.
- Defect: `onForAnyone` ignores a Rule's `schedule`, although the backend has a clock; a scheduled `off` Rule never counts as "everyone", an expired `on` Rule counts forever.
- Consequence: after a scheduled switch-off the backend keeps serving the feature's procedures; `setRules`' `dependency-off` check and the `/v1` `off` list are also off.
- Fix: drop Rules whose schedule is over or not begun before `onForAnyone`; add a `serving` test with a `schedule` Rule.

### 3.M2 CONFIRMED, low (was medium: one or two Admin users, and running the enrolment again heals it)
- Where: `packages/server-core/src/admin/admin-sign-in.ts:201-225`.
- Defect: each right `verifyCode` for a user whose TOTP is not `on` stores a new secret and new recovery codes; the code is not spent.
- Consequence: a repeated request during enrolment kills the QR just scanned and the recovery codes shown; 3 failed sign-ins block the email for 15 minutes.
- Fix: answer the existing pending secret instead of replacing it.

### 1.4 (+2.L9) CONFIRMED, low
- Where: `packages/core/src/progress/xp-log.ts:285-286,761-771,601-602`; `packages/core/src/game/crossing-crossword-progress.ts:84`.
- Defect: the Daily Crossword's record id uses the crossword's date, but the record's `date` is today's; the opened puzzle keeps the date it was opened on. (2.L9's claim that the XP record carries yesterday's date is wrong: `award` overwrites it with today.)
- Consequence: a crossword opened before midnight and finished after counts for the next day, so the crossword run can break with no day missed.
- Fix: keep `action.date` as the record's date for `daily-crossword`.

### 1.5 CONFIRMED, low
- Where: `packages/core/src/progress/xp-log.ts:277-289,761`.
- Defect: `review-answer-<day>-<entry>` and `daily-crossword-<date>` ids are not scoped by the reset marker.
- Consequence: after a Progress reset the same day, that day's Review answers and crossword earn nothing.
- Fix: scope both ids as `goal-met` is, or decide in a comment that the crossword stays one per day across a reset.

### 1.6 CONFIRMED, low
- Where: `packages/core/src/feed/weekly-recap.ts:103`.
- Defect: `seen` is counted from History (one row per Entry, cap 500, clearable). Same root as 1.1.
- Consequence: the Weekly Recap can say 0 Seen beside non-zero XP.
- Fix: count from the same source the fix of 1.1 picks.

### 2.L7 CONFIRMED, low
- Where: `packages/core/src/edition/switch-evaluator.ts:108`.
- Defect: the Variant is `bucket % variants.length` with the same bucket the share was matched on (`bucket < share`).
- Consequence: a share smaller than the number of Variants never gives the last Variants; `share: 1` gives everyone the first.
- Fix: pick the Variant from a second hash (another salt).

### 2.L8 CONFIRMED, low
- Where: `packages/core/src/edition/switch-evaluator.ts:72,75`, `packages/core/src/edition/app-version.ts:7-14`.
- Defect: a non-numeric version part makes `compareVersions` return `NaN`, so both range checks pass.
- Consequence: a dev or oddly versioned build matches every version-targeted Rule.
- Fix: guard with `isAppVersion` and treat an unparsable version as no match.

### 2.L1 CONFIRMED, low
- Where: `packages/core/src/account/account.ts:237,473-478`.
- Defect: sign-outs not yet told to the server live in memory only.
- Consequence: sign out offline, then kill the app: the Session stays valid on the server until it expires.
- Fix: keep the untold tokens in the Session store until told.

### 2.L6 CONFIRMED, low
- Where: `packages/core/src/notifications/notifications.ts:271-274`.
- Defect: `setOn(true)` writes the Edition's defaults; with empty default times that is "off" again.
- Consequence: the switch never turns on in such an Edition (the UA Edition has defaults, ADR 0200).
- Fix: require at least one default time in the Edition schema.

### 2.L3 CONFIRMED, low
- Where: `packages/core/src/sync/exchange.ts:287-292`.
- Defect: the pull loop has no bound and no check that the cursor moved.
- Consequence: a backend bug (`more: true`, same cursor) loops until the 429.
- Fix: stop when the cursor did not change.

### 2.L4 PLAUSIBLE, low
- Where: `packages/core/src/user-state-schema.ts:276-283`.
- Defect: migration 7 deletes `mix.rarityFloor` / `mix.rarityCeiling` locally with no tombstone.
- Consequence: an Account that synced them pulls them back as unknown keys; garbage, no loss.
- Fix: write tombstones in the migration, or ignore the keys on pull.

### 2.L2 PLAUSIBLE, low
- Where: `packages/core/src/sync/sync.ts:192`.
- Defect: a cursor that fails to be forgotten is kept for the next Account signed in during the same run.
- Consequence: Account B is pulled from A's cursor and misses its earlier records (needs a storage write failure).
- Fix: refuse to sync until the forget succeeded.

### 2.L12 PLAUSIBLE, low
- Where: `packages/core/src/account/account.ts:266-275`.
- Defect: when `sessions.keep` throws after a right code, the server Session just made is never signed out.
- Consequence: an orphan Session lives on the server until it expires.
- Fix: on a failed keep, tell the server to sign that token out.

### 2.L10 PLAUSIBLE, low (latent: the shell always passes a `schedule`)
- Where: `packages/core/src/game/game.ts:505`.
- Defect: `finish` does not re-check `state.current` inside the turn.
- Consequence: none in the app as wired; in tools and tests two fast answers write the last Round's XP twice.
- Fix: re-check inside the turn.

### 2.L11 PLAUSIBLE, low
- Where: `packages/core/src/game/quick-question.ts:137-145`.
- Defect: the Core keeps no "answered" state for a Quick Question.
- Consequence: a double tap the card lets through writes the XP twice (the card's guard was not read).
- Fix: an answered flag per content in the Core, or confirm the card disables after the first tap.

### 1.3 PLAUSIBLE, low
- Where: `packages/core/src/community-counters/counter-deltas.ts:105-127`, `packages/core/src/community-counters/counter-sending.ts:115-149`.
- Defect: `count()` and a finishing send both read and later write `counters.unsent.<id>` with no shared turn.
- Consequence: a Community Counter can end one off for one Entry.
- Fix: run both through one turn.

### 1.7 PLAUSIBLE, low
- Where: `packages/core/src/feed/feed.ts:586-588`.
- Defect: closing the «Вчорашнє слово» notice and keeping the mark are two writes ("closed first" is deliberate, the split is not).
- Consequence: on a storage error the notice is closed and the answer is lost.
- Fix: one staged write.

### 1.8 PLAUSIBLE, low
- Where: `packages/core/src/dashboard/dashboard.ts:272-274`, `packages/core/src/dashboard/curated-collections.ts:201`.
- Defect: `void refresh()` with no catch.
- Consequence: an unhandled promise rejection on a storage read error.
- Fix: catch and report.

### 1.9 PLAUSIBLE, low
- Where: `packages/core/src/feed/community-word.ts:43-57`.
- Defect: a failed Community Word answer is not remembered, so each next card on a Monday asks the backend again.
- Consequence: with a slow backend every next card waits for the request's timeout.
- Fix: remember the failure for the app session.

### 1.10 PLAUSIBLE, low
- Where: `packages/core/src/feed/day-change.ts:99-112`.
- Defect: `dayStarted` is published before `recordActiveDay`; when that rejects, the next resume publishes it again.
- Consequence: none seen (listeners look idempotent).
- Fix: none needed beyond the fix of 2.M1.

### 1.11 CONFIRMED, low (negligible)
- Where: `packages/core/src/knowledge/knowledge.ts:313-316,358-359,423-425`.
- Defect: the stored and the in-memory confirmation instants come from two `clock.now()` calls.
- Consequence: none a reader sees.
- Fix: read the clock once.

### 1.12 CONFIRMED, low (style)
- Where: `packages/core/src/entries/entry-list.ts:75`, `packages/core/src/entries/entries.ts:433`, `packages/core/src/progress/progress.ts:87`; also `packages/server-core/src/account/accounts.ts:258` (3.L11).
- Defect: `as` casts in non-test code, against the repo rule.
- Consequence: none today.
- Fix: type them away, or keep each in one small helper.

### 3.L1 CONFIRMED, low
- Where: `packages/server-core/src/edition/edition-registry.ts:260-268`.
- Defect: the `dependency-off` check runs for any non-empty Rule list, also Rules that only turn the feature off.
- Consequence: with `account` killed, an `off` Rule for `sync` is refused in the admin.
- Fix: skip the check when every Rule's verdict is `off`.

### 3.L2 CONFIRMED, low
- Where: `packages/contracts/src/feature-switch-rules.ts:43-55`.
- Defect: no `from <= until` refine on `appVersion` or `schedule`.
- Consequence: an inverted range saves and never matches, silently.
- Fix: add the refine.

### 3.L4 CONFIRMED, low
- Where: `packages/server-core/src/sync/sync.ts:137-145`.
- Defect: the Sync request limit is per Session, not per Account.
- Consequence: many Sessions multiply the limit; load only.
- Fix: key the limit by Account.

### 3.L5 PLAUSIBLE, low
- Where: `packages/server-core/src/admin/admin-sign-in.ts:291-294`.
- Defect: `signOutEverywhere` reads the session row without the expiry check.
- Consequence: an idle-expired cookie can still end every session of its user (harmless; may be unreachable behind admission).
- Fix: use `sessionRow`.

### 3.L6 PLAUSIBLE, low
- Where: `packages/server-core/src/account/accounts.ts:215-219`.
- Defect: `verifyCode` does not ask `editions.serving(…, 'account')`, unlike the Google and Apple sign-ins beside it.
- Consequence: after a Kill of `account`, a code already sent still creates an Account and a Session.
- Fix: check `serving` (the procedure takes no Edition id today, so this needs the owner's call).

### 3.L7 CONFIRMED, low
- Where: `packages/server-core/src/admin/monitor.ts:154-161`.
- Defect: the average is over the days PostHog returned; a day with no row is left out, not counted as 0.
- Consequence: a false "activity drop" alert after quiet days.
- Fix: fill the 7 days with 0 for an Edition older than a week.

### 3.L8 PLAUSIBLE, low
- Where: `packages/server-core/src/quality/quality.ts:60-81`.
- Defect: the Якість cache is keyed by an unchecked `editionId` and never pruned.
- Consequence: an Admin user can grow memory and spend Sentry queries; admin-only.
- Fix: refuse an Edition the registry does not serve.

### 3.L9 PLAUSIBLE, low (docs)
- Where: `packages/contracts/src/api/admin.ts:1557-1563` against `packages/server-core/src/quality/quality.ts:126-131`.
- Defect: the contract text says "another run of the period", the code needs the same commit.
- Fix: correct the text.

### 3.L10 PLAUSIBLE, low (docs)
- Where: `packages/contracts/src/api/account.ts:168-178`.
- Defect: the `account.delete` description omits the Sync records it also deletes.
- Fix: add them to the text.

### 4.L1 PLAUSIBLE, low
- Where: `apps/backend/src/account/authenticator.ts:249-279`.
- Defect: of two concurrent checks of a right code, the loser finds no row and answers `code-expired`.
- Consequence: a double tap can show «код протермінований» while the first request signs in.
- Fix: answer the loser as a wrong code, or dedupe in the app.

### 4.L2 CONFIRMED, low
- Where: `apps/backend/src/admin/admin-procedures.ts:414-426`.
- Defect: the Account is deleted first, the Action log row written second, outside one transaction.
- Consequence: if the log write fails, the Account is gone with no log row, against ADR 0088.
- Fix: one transaction, or log first.

### 4.L3 PLAUSIBLE, low
- Where: `apps/backend/src/alerts/telegram-bot.ts:32`, `apps/backend/src/account/mailer.ts:81`.
- Defect: no `AbortSignal.timeout` on the Telegram and ZeptoMail calls.
- Consequence: a hung peer holds `requestCode` or a Cron run for minutes.
- Fix: a timeout, with 5.M1.

### 4.L4 CONFIRMED, low (staging only)
- Where: `apps/backend/src/config.ts:311-326`.
- Defect: the staging branch returns before `refineVaultKey`.
- Fix: run the check before the return.

### 4.L5 PLAUSIBLE, low
- Where: `apps/backend/src/account/authenticator.ts:224-235`.
- Defect: a provider identity already linked to another Account is dropped by `onConflictDoNothing`.
- Consequence: after a Google email change the new Account shows no Google Sign-in method and the old one keeps it.
- Fix: move the identity, or report the conflict.

### 4.L6 PLAUSIBLE, low
- Where: `apps/backend/src/account/identity-token-keys.ts:51-60`.
- Defect: no cooldown after a failed JWKS reload.
- Consequence: one fetch to Google or Apple per sign-in attempt during their outage.
- Fix: a short back-off.

### 4.L7 PLAUSIBLE, low (hardening; ADR 0047 asks for no nonce)
- Where: `apps/backend/src/account/apple-verifier.ts:30-43`.
- Defect: Apple identity tokens are not bound to a nonce.
- Fix: add a nonce when the native sign-in is next touched.

### 4.L8 CONFIRMED, low (ADR wording)
- Where: `apps/backend/src/admin/admin-procedures.ts:49` (`/v1/admin`) against `docs/adr/0088-*.md:16` ("scoped to `/admin`").
- Fix: amend the ADR line; the code is right.

### 5.L1 PLAUSIBLE, low
- Where: `apps/backend/src/content/quote-check.ts:204-217`.
- Defect: only 200 and 404 are cached; a 403, 429 or 5xx is fetched again every hour with no back-off and no flag.
- Consequence: a source that blocks the bot stays «не перевірено» for good and is asked 24 times a day.
- Fix: cache the failure for a day and show it in the admin.

### 5.L2 CONFIRMED, low
- Where: `apps/backend/src/content/content-store.ts:136-143`.
- Defect: an `--override` import sets every `recordVersion` to 1.
- Consequence: a stale admin form can overwrite later edits without the stale warning; every record reads as unchecked.
- Fix: continue from the old version (`old + 1`).

### 5.L3 PLAUSIBLE, low (latent)
- Where: `apps/backend/src/content/content-store.ts:123-127`.
- Defect: the override import takes the `content_versions` row lock but not the Edition's advisory lock every other writer takes.
- Consequence: none today.
- Fix: take the advisory lock too.

### 5.L4 CONFIRMED, low
- Where: `apps/backend/src/media/media-import.ts:197-201`.
- Defect: the `illustrated` map is file name -> Word id, so of two Words naming one file the last wins.
- Consequence: one Word silently gets no Illustration.
- Fix: refuse the import when two Words name one file.

### 5.L5 PLAUSIBLE, low
- Where: `apps/backend/src/recordings/generator.ts:73-95`.
- Defect: after SIGKILL the promise waits for `close`, which a grandchild holding the pipes can delay.
- Consequence: a run can outlive its time limit and lease.
- Fix: resolve on `exit` after the kill.

### 5.L6 PLAUSIBLE, low
- Where: `apps/backend/src/quality/sentry-api.ts:186-192`.
- Defect: `newIssues` follows `Link` pages with no cap.
- Consequence: a crash storm spends Sentry's API limit on one Якість read.
- Fix: cap the pages and say "N+".

### 5.L7 PLAUSIBLE, low
- Where: `apps/backend/src/services/usage-sources.ts:272-276`.
- Defect: GitHub Actions minutes are summed raw, without the macOS x10 and Windows x2 multipliers.
- Consequence: «Сервіси» under-reports the limit when the manual macOS runner (ADR 0004) runs on a private repo.
- Fix: multiply by the runner's factor.

### 5.L8 CONFIRMED, low
- Where: `apps/backend/src/services/vault.ts:29-30`; the same in `apps/backend/src/admin/admin-store.ts:318-319`.
- Defect: `createDecipheriv('aes-256-gcm', …)` with no `authTagLength: 16`, so a short tag is accepted.
- Consequence: weaker integrity for someone who can already write to the database.
- Fix: pass `{ authTagLength: 16 }`.

---

## Rejected

### 3.L3 REJECTED
- Where: `packages/server-core/src/account/sign-in-limits.ts:8-20`.
- Why: the per-email day caps are the deliberate guess limit of #649, written in the file's own comment; locking an email for a day is the price it names. Not a bug; raise it with the owner only as a product trade-off.
