# The backend is a factory too

ADR 0008 makes one backend deployment serve every Edition, built like the app. A second Edition must get sign-in in its own language and its own content updates from the same deployment without a line of server code changing.

The backend has two parts, like the app's Core and mobile shell (ADR 0006, 0018):

- **The server Core**, `packages/server-core`, holds the backend's rules and declares the ports they need, such as the `Clock`. It imports only `@slovo/contracts` and Zod: no Hono, no SQL, no better-auth, no Node and no language. Its modules follow the app's Core: factory functions over an object of dependencies, expected outcomes as discriminated unions (`{ ok: true, … } | { ok: false, reason }`), exceptions only for broken invariants, time from the `Clock`.
- **The backend**, `apps/backend`, is the shell: the HTTP routes and oRPC procedures, the adapters of the server Core's ports (Drizzle over Postgres, better-auth, SMTP) and one composition root, `createApp`, which builds the whole backend from its dependencies.
- **The same domain folders on both sides** (ADR 0027): `account`, `content`, `edition` and `sync`. The backend's own layer is `database/`: the pool, the schema and the migrate command.

dependency-cruiser holds the boundaries in CI (`pnpm deps`): the server Core imports only the contracts and Zod; the backend imports neither the app's Core, the UI nor React; the mobile app imports neither the server Core nor the backend. What both sides share lives in `contracts`.

**Tests.** The backend's tests reach it through one harness, `apps/backend/src/test-support.ts`. Each test file gets a fresh, migrated Postgres database of its own and drops it after, so files run side by side; there are no in-memory repositories, and the server Core has no tests of its own, since its rules lean on the adapters behind its ports. Each test runs on the system time, frozen when it starts; the composition root gets the system `Clock`, so better-auth and the server Core read the same time, and `passTime` moves both. The harness builds the test Editions (copies of the Ukrainian Edition under their own ids) and sends every request to the app in process on a connection from an IP address.

**How the factory reaches the server:**

- **Editions come from the Edition folders.** At start the backend reads every Edition through `@slovo/language-pack/edition` (ADR 0035), so a new Edition folder is enough for the backend to serve it. Editions are not a table. An Edition id the backend didn't find is refused.
- **Edition text comes from the Edition's strings.** What the server writes to a reader, such as the sign-in email, is a string group of the Edition. The server Core carries the same Cyrillic tripwire as the app's Core.
- **Feature Switches come from the Edition config, then the remote switches** (ADR 0040). The Edition registry answers `serving(editionId, feature)`: the Edition when the backend found it and its switch is on, or why not (`unknown-edition`, `switched-off`). The Account, content, sync, Mistake Report and Community Counters procedures ask it with their feature and answer both refusals as `NOT_FOUND`, so a new feature behind a switch gets the rule by naming its switch. Publishing a pack asks only that the Edition was found. The backend builds the registry in one place, over the Edition folders and the `remote_switches` table.
- **Data is partitioned by `edition_id`.** A table of data that belongs to one Edition, such as `user_records` (ADR 0041), carries an `edition_id` column. Data of the Account is shared: one Account works in every Edition.
- **No server-side Extension Point yet.** One is added only when an Edition needs its own server behaviour (ADR 0006).

**The Account.** better-auth does Sign-in codes and Sessions behind an `Authenticator` port, and the app never calls better-auth's own endpoints. The rules of a Sign-in code (six digits, signs in for 10 minutes, 5 tries, a spent code stays spent until a new one is sent) and a Session's life (90 days after its last use) live in the adapter's better-auth configuration, not in the server Core. Only the adapter knows how better-auth keeps a code in `sign_in_codes` (its SHA-256, with the tries spent); the tests check the rules through the API's contract, and where one must see the stored row, the adapter gives its id and hash. better-auth reads the system clock for expiry, so its adapter does too. Its tables are renamed to the glossary: `accounts` (its `user`), `sign_in_methods` (its `account`), `sessions` and `sign_in_codes` (its `verification`). Columns SLOVO never fills stay empty because its schema check needs them: `accounts.name` and `image`, `sessions.ip_address` and `user_agent`, and the token and password columns of `sign_in_methods`, whose rows (one per Google identity, ADR 0047) hold only the method and its subject.

**One gate opens a Session.** Every procedure of a Session reaches its Account through `Accounts.session`, which takes the request's token and answers the Session with its Account, or unauthorized, through one middleware in the backend's `account` folder, the one place that answers `UNAUTHORIZED`. Only the gate makes a `Session` (its type carries a symbol nothing outside the server Core can name), so an action can't be handed an Account a request names. A Session that ends between the gate and its action has ended either way, so the action answers done.

**Session tokens are kept in plain**, an accepted risk: better-auth looks a Session up by its token as it is. A device gets the bearer plugin's signed form, the token and its HMAC with `AUTH_SECRET`, and the backend accepts only that form (`requireSignature`), so tokens from a leaked database sign nobody in without the secret too. The server refuses to start with the `AUTH_SECRET` of `.env.example`, naming the variable; `pnpm dev` writes a fresh one. If better-auth learns to hash Session tokens, the backend turns it on with a migration that ends every Session.

**Deleting the Account** (`DELETE /v1/account/me`) needs only a valid Session: no fresh Sign-in code, no recent Session, no grace period. A token from a lost, unlocked phone could erase an Account; the owner accepts that before 1.0, since deletion is a promise that takes effect now. If a stolen token ever deletes an Account, deletion will ask for a fresh Sign-in code or a Session a few minutes old. The adapter deletes the Account and the Sign-in codes waiting for its email in one transaction (better-auth's own deletion runs outside one), and `ON DELETE CASCADE` takes the Sessions, sign-in methods and synced records.

**Sign-in limits** are rules of the server Core's `account` domain, counted through a `RateLimits` port with its `Clock` and kept in Postgres, since there is one instance:

| Limit                                         | Count               |
| --------------------------------------------- | ------------------- |
| Sign-in codes per email                       | 5 an hour, 10 a day |
| Code checks per email                         | 25 a day            |
| Code requests per IP                          | 20 in 10 minutes    |
| Code checks per IP                            | 30 in 10 minutes    |
| Google sign-ins per IP (`googleSignInsPerIp`) | 30 in 10 minutes    |

Each key has a fixed window that opens with its first request and lasts the limit's time; one statement counts a request. A code request counts against the IP, then the hour, then the day, and a code check against the IP, then the day, so a refused request leaves the later limits uncounted. A request over a limit answers `TOO_MANY_REQUESTS` (429) with `Retry-After` in whole seconds and sends nothing. A request touches only its own window, and an ended window of its key opens anew; the ended windows of every key are deleted by a request at most once an hour, not on every request. Google sign-ins count apart from the codes' limits (owner, 0.8.9 review): they guard the backend's token checks against Google, not guesses at a code. The `rate_limits` table names no email or IP: the adapter keys each window by the HMAC-SHA256 of the server Core's key, with a key derived from `AUTH_SECRET` for this use alone.

**The IP address** is the client's, taken once where the request arrives, before any route runs; a request without one is a broken invariant answered `500 { code: "INTERNAL" }`. With no trusted proxy hop (`TRUSTED_PROXY_HOPS=0`, the default, as in local Docker) it is the connection's, and `X-Forwarded-For` is ignored, since any client can send one. Behind the deployed proxy (`TRUSTED_PROXY_HOPS=1` on Railway), where every connection comes from the proxy and the limits per IP would hold back every reader together, each trusted hop appends the address it was reached from, so the client is the address that many places from the end of `X-Forwarded-For`; whatever stands before it the client wrote and is ignored. A header with fewer addresses than hops did not come through the proxy, so the connection counts. An IPv6 address counts as its /64 prefix, since a host owns a whole /64, and an IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) as its IPv4; an address that parses as neither counts as written.

**What a request may bring and a log line may show.** A request body under `/v1` is at most 8 MB, refused before parsing and before any Session check with `413 { code: "PAYLOAD_TOO_LARGE" }`; the largest request of the contract, a push of 500 changes (ADR 0041), is 4.7 MB at most. Like the bare `404 NOT_FOUND` and `500 INTERNAL`, the answer is the app's, and the contract doesn't list it. The logger's error serializer writes a failed Drizzle query as its SQL with `$1`, `$2`… for values, its stack frames and its cause; Postgres's own error as its SQLSTATE (`errorCode`), constraint, table and column, without its message and detail; and every other error with its message and the top of its stack scrubbed by the crash reports' scrub (`error-text.ts`, ADR 0048). Each cause comes on its own under `cause`.

## Considered Options

- **Everything in the backend app, layered by folders**: rejected. Nothing would stop a rule from reaching into Hono or SQL, and the rules would be tested only through HTTP.
- **The server rules in the app's Core**: rejected. Those rules never run on the reader's device, and the app would ship code it never calls.
- **A registry of Editions in the database**: rejected. Editions live in git and change with a build; a second copy would drift.
- **One database for the test run, files one after another**: rejected. Every file waited for the others, and a test moving the clock made better-auth delete another file's codes.
- **The code and Session rules in the server Core, given to the adapter**: rejected. The Core never reads them, and the tries left still need better-auth's row.
- **Each action of a Session finding the Account from the token itself**: rejected. Every new procedure would add one more place to answer `UNAUTHORIZED`.
- **better-auth's own limiter**: rejected. It counts requests to better-auth's HTTP endpoints, which nothing reaches, and has no key for the email.
- **Sliding windows**: rejected for now. A fixed window lets up to twice a limit through around its end, which these limits can bear, for one row per key.
- **Google sign-ins in the codes' bucket per IP**: rejected. A reader who mistyped a code a few times would find Google sign-in refused too.
- **A longer window after repeated spent codes**: deferred. The day's limits bound the guesses by themselves.
- **Hashing the limits' keys with `AUTH_SECRET` itself, or a separate `RATE_LIMITS_SECRET`**: rejected. One key for two uses mixes them; a second secret is more to provision than a derived key.
- **A body limit per procedure**: rejected. One limit at the size of the largest request is enough against a flood.
- **Redacting `params` by path**: rejected. pino's redaction reaches named fields, not the message and stack, which repeat the values.
