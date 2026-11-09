# Global review of SLOVO main (bf792f89): backend area

Scope: `apps/backend`, `packages/server-core`, `packages/contracts` (API part), `Dockerfile`, `compose.yaml`, `railway.json`. Read-only, no builds, no network.

Read in full: app.ts, api.ts, main.ts, server.ts, config.ts, authenticator.ts, session-gate.ts, accounts.ts, sign-in-limits.ts, rate-limit.ts, rate-limits.ts, google/apple verifiers, identity-token-keys.ts, smtp-mailer.ts, logger.ts, error-text.ts, error-reporter.ts, sentry-reporter.ts, sync.ts, user-records.ts, sync-procedures.ts, admin-routes.ts, database.ts, migrate.ts, schema.ts, edition-registry.ts and the edition adapters, content-packs.ts and the content adapters, community-counters.ts and the counter adapters, contracts `api/sync.ts`, `api/account.ts` (schemas), `api/counters.ts` (input), Dockerfile, compose.yaml, railway.json, .dockerignore.
Spot-checked only: collection-page.ts (escaping), collection-links.ts (limits), mistake-reports.ts (limits).
Not reviewed (context budget): collection-links store/command/delete, reports store/list/resolve/command, contracts `breaking-changes.ts`, test quality file by file, the 94 glossary "Avoid" terms sweep, ADR-by-ADR cross-check.

Counts: high 0 · medium 3 · low 9.

## Medium

### M1. `/admin/*` POSTs have no body limit and buffer the whole body before any check
- `apps/backend/src/app.ts:203-209` applies `bodyLimit` to `/v1/*` only; `apps/backend/src/admin/admin-routes.ts:102-106,108-119` call `c.req.parseBody()` on `/admin/code` and `/admin/sign-in`, both reachable without a Session.
- Failure: with `OWNER_EMAIL` set, an unauthenticated client POSTs a multi-GB form body to `/admin/code`; Hono's `parseBody` (`formData()`) reads it all into memory before `isOwner` runs. Node's HTTP server has no default body cap, so the process can be pushed to OOM and Railway restarts it (`restartPolicyMaxRetries: 5`).
- Fix: register the same `bodyLimit` (a few KB is enough for the admin forms) on `/admin/*`, or move the limit to `app.use('*')` and let `/v1/*` keep its 8 MB.
- Confidence: confirmed (by code; not executed).

### M2. Apple sign-in ignores `email_verified`, unlike Google
- `apps/backend/src/account/apple-verifier.ts:38-45` returns the `email` claim with no look at `email_verified`; `packages/server-core/src/account/accounts.ts:191-205` then calls `signInWithApple`, which `authenticator.ts:189-199` resolves by email (`findUserByEmail`) to an existing Account. The Google path (`accounts.ts:177-183`) refuses `unverified-email`.
- Failure: Apple documents `email_verified` as "false" for some Sign in with Apple at Work & School (Managed Apple ID) users. A token for such an Apple ID whose email equals an existing Account's email signs in to that Account, including the owner's Account that gates `/admin` (`admin-routes.ts:81-83` checks the email only).
- Fix: read `email_verified` in the Apple verifier (accept `true` and the string `"true"`), add `'unverified-email'` to `AppleRefused`, map it to `EMAIL_NOT_VERIFIED` in `account-procedures.ts` and extend the contract errors of `signInWithApple`.
- Confidence: plausible (depends on Apple issuing such tokens; the code path is confirmed).

### M3. Time is read from the system clock inside the Authenticator
- `apps/backend/src/account/authenticator.ts:170`: `code.expiresAt.getTime() <= Date.now()`. The server Core's `Clock` is injected everywhere else (`sync.ts`, `rate-limits.ts`, the verifiers). The comment says better-auth uses the system clock too, but `checkCode` decides `code-expired` on this line before better-auth sees the code.
- Failure: a test that moves the injected clock past `validSeconds` still gets `wrong-code`/`ok` instead of `code-expired`, because this check reads real time; expiry behaviour is therefore untestable deterministically, against the repo rule "Inject time and randomness".
- Fix: pass the `Clock` into `createAuthenticator` and use `clock.now()` here; the drift from better-auth's own `expiresAt` check only widens the window by the test's offset, which is acceptable, or document the exception as an ADR note.
- Confidence: confirmed.

## Low

### L1. Branded `Session` built with an `as` cast
- `packages/server-core/src/account/accounts.ts:223`: `{ ...found, token } as Session`. The brand (`unique symbol`) exists so only `Accounts.session` can mint a Session, which needs a cast once; still the only `as` in the area apart from `breaking-changes.ts:18`. Fix: a private `mint(found, token): Session` helper with the cast isolated and commented, or a class. Confidence: confirmed.

### L2. Dead `??` on form fields in admin
- `apps/backend/src/admin/admin-routes.ts:140,146,148`: `editionId ?? ''`, `feature ?? ''`; `field()` (line 102) always returns a string. Fix: drop the fallbacks. Confidence: confirmed.

### L3. Race on the first sign-in of an email via Google/Apple
- `apps/backend/src/account/authenticator.ts:189-199`: `findUserByEmail` then `createUser` without a transaction or `ON CONFLICT`. Two concurrent first sign-ins of one email hit the unique `accounts.email` and one answers `500 INTERNAL`. Fix: catch the unique violation and re-read, or insert with `onConflictDoNothing` then select. Confidence: confirmed (race), rare.

### L4. Sign-in code tries counted with a read-then-act gap
- `authenticator.ts:224-227`: `triesSpent` is read, then `signInEmailOTP` runs; parallel checks can exceed 5 tries by a few. The per-IP and per-email-per-day limits bound the damage (25 checks a day). Fix: rely on better-auth's own `TOO_MANY_ATTEMPTS` only, or lock the row. Confidence: confirmed, low impact.

### L5. Published-pack downloads of old versions are unlimited and uncached
- `packages/server-core/src/content/content-packs.ts:76-100` keeps 2 files per Edition; `apps/backend/src/content/content-pack-store.ts:26-36` reads the whole `bytea` for any other version on every request; no rate limit on `content.download` (by design "not limited"). An anonymous loop over old versions pulls megabytes from Postgres per request. Fix: a modest per-IP limit on downloads, or serve only the newest N versions. Confidence: plausible.

### L6. Graceful stop has no deadline
- `apps/backend/src/server.ts:44-52`, `main.ts:41-55`: `server.close()` waits for every in-flight request; a stuck request keeps the old process alive until the host kills it, and the pool is never closed. Fix: a timer (e.g. 10 s) that calls `server.closeAllConnections()` then proceeds. Confidence: confirmed.

### L7. Default sender domain is not SLOVO's
- `apps/backend/src/config.ts:118` defaults `MAIL_FROM` to `no-reply@slovo.app`; the owner noted that `slovo.app` belongs to someone else. Production requires `MAIL_FROM`, so only dev/Mailpit mail shows it. Fix: default to an example domain (`no-reply@example.invalid`) or the Edition's domain from the AppConfig. Confidence: confirmed (default), context from owner.

### L8. Admin and Collection pages send no security headers
- `admin-routes.ts` and `collection-page.ts` return HTML with no `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`. Escaping is correct (`hono/html`), so this is defence in depth. Fix: `hono/secure-headers` on `/admin/*` and `/:edition/c/:id`. Confidence: confirmed.

### L9. Rate-limit `take` recursion is unbounded in theory
- `apps/backend/src/rate-limits.ts:55-57`: when the upsert is refused and the row has since been swept, `take` calls itself with no retry cap. Practically ends at once; a cap of one retry makes it obvious. Confidence: confirmed, negligible.

## Checked and found sound
- Session gating: one `sessionGate` (`session-gate.ts`), `initialInputValidationIndex` so the gate runs before input parsing; procedures act only on `context.session`.
- Client IP: `clientIp` (`app.ts:93-107`) takes the address `hops` from the end of `X-Forwarded-For`, so a client cannot spoof it behind a trusted proxy; `TRUSTED_PROXY_HOPS` defaults to 0.
- Sync: later-wins by `changedAt` with the clamp to server time, tie keeps the kept record (`user-records.ts:63`), one `FOR NO KEY UPDATE` on the Account row serialises pushes so `sequence` order equals visibility order; pull is a strict `sequence >` cursor with `limit + 1`. Pushes are idempotent. Contract caps depth (32), batch (`SYNC_BATCH_SIZE`), nonnegative ints.
- Rate limits: single-statement upsert with `setWhere`, keys HMAC'd with a derived key, windows swept hourly.
- Counters: rows locked in `collate "C"` order, `greatest(0, …)` floors, batch refined to one Entry each.
- Identity tokens: jose `RS256` only, issuer/audience/`maxTokenAge`, injected `currentDate`, JWKS cached by the provider's `max-age`.
- Logging/reporting: redaction of `email/code/token/authorization`, message scrubbing, Postgres errors reduced to SQLSTATE and constraint, Sentry with all integrations off.
- Config: refuses the example `AUTH_SECRET`, requires SMTP vars in production, `requireTLS` when credentials without TLS.
- Docker: `.dockerignore` excludes `**/.env*`, `.git`; unprivileged `node` user; `/health` returns 503 while migrations are pending and Railway runs `pnpm db:migrate` pre-deploy.
- CORS: none configured, which is the restrictive default for a native-app API; the admin relies on `SameSite=Strict; Secure; HttpOnly` cookies.
- No skipped tests; no `@ts-expect-error`, `!` or `as unknown` in the area.
