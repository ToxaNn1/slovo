# Backend/packages review: feat/1709-admin (correctness + security)

Scope: `git diff origin/main...HEAD -- apps/backend packages`. Read in depth: admin sign-in, admin access/store, admin procedures, Edition registry and Rules, switch evaluator, remote switches, edition procedures, rate-limit helpers, content queue (review/rollback). Not read: alerts/cron, quality/sentry, development sources, analytics, content-writes, contracts/admin.ts.

## 1. The failure counter is check-then-act, so parallel requests get unlimited guesses at the emailed code. For an Admin user without a confirmed TOTP, this is an account takeover (high)

`packages/server-core/src/admin/admin-sign-in.ts:120-137` (`withCode`) calls `blockAfterFailures(..., failed: false)`, which only peeks. It then compares the code, and only after a mismatch does it record the failure (`failed()` -> `rateLimits.take`). Nothing reserves an attempt before the comparison. An attacker can send N concurrent `verifyCode` requests. All N pass the peek before any failure is written, and all N codes get compared. Once the counter is full, the extra `take` calls are just refused ("counts nothing"). Each burst therefore tests N codes instead of 3. After the 15-minute block the attacker can repeat the burst, and `requestCode` keeps issuing new codes.

Why it matters: for a user whose `totp.state` is `none` or `pending` (a freshly invited Admin user, a re-activated one, or a Власник added by the command who has not signed in yet), `verifyCode` with a right code alone returns `next: 'enrol'` with a new TOTP secret (lines 165-185). `signIn` then accepts a TOTP for that secret (`state !== 'none'`). So guessing the 6-digit code is enough to enrol an attacker-controlled TOTP and get a session, possibly as a Власник. ADR 0088 requires that three failed attempts block the email.

Fix: count the attempt atomically before comparing. For example, `take` the failure key first (refuse when it is not `taken`) and `clear` it on success. Alternatively use a single `UPDATE ... RETURNING count` that increments and checks in one statement. Apply the same change to the TOTP and recovery check in `signIn`.

## 2. `requestCode` has no rate limit: unlimited sign-in emails to any Admin user's address (medium)

`apps/backend/src/admin/admin-procedures.ts:293-297` and `admin-sign-in.ts:152-163`. The only gates are "the admin is on" and the presence of the `x-…` write header, which any script can send. There is no per-IP or per-email `countRequest`. An unauthenticated caller can loop over an owner's email and have the backend send one email per request. That floods the inbox, uses up the mail provider's quota or reputation, and can get the sending domain throttled, which also blocks reader sign-in mail (the mailer is shared, ADR 0088). Each request also replaces the live code, so it doubles as a way to keep a legitimate admin from signing in.

Fix: apply `countRequest` per email and per `ipSubject(ip)` (the reader sign-in already has this pattern) before sending. Answer the same `{ sent: true }` either way so the response still reveals nothing.

## 3. The session cookie path differs from ADR 0088 (low, ADR conflict to confirm)

`apps/backend/src/admin/admin-procedures.ts:43` sets `Path=/v1/admin`, but ADR 0088 says the cookie is "scoped to `/admin`". The code is the working choice, because the admin API is served at `/v1/admin` and a `/admin` cookie would never be sent to it. That leaves the ADR inaccurate. Per CLAUDE.md this needs the owner: amend ADR 0088, or record the decision, rather than leave the two in conflict.

## Checked, no finding

- TOTP (RFC 6238, ±1 step), the AES-GCM vault, and crypto `randomInt` for tokens and codes.
- Recovery codes are spent atomically (`UPDATE ... WHERE used_at IS NULL RETURNING`).
- Removing an Admin user ends their sessions. Sessions join on `state = 'active'`.
- Self role change and self removal are refused, so the last Власник cannot be removed through the API.
- CSRF: `SameSite=Strict`, plus a write header required on every session write.
- An Агент bearer token is refused on non-content procedures. CI tokens are compared in constant time.
- Rule evaluation: first match per feature, store order is feature then order, the share bucket is salted per Rule, dependencies are gated, and a Kill writes one off Rule per Edition. A Rule id is not a primary key, so `kill` ids cannot collide.
- Content queue rollback is locked per batch, row and Edition. A record changed after the batch is skipped.
