# The backend is a factory too

ADR 0008 makes one backend deployment serve every Edition, built like the app: a server Core, server-side Extension Points and per-Edition Feature Switches. Until 0.7 `apps/backend` was an empty folder, so nothing said what the server Core is, where its edge lies, how the backend learns the Editions or how its data keeps them apart. A second Edition must get sign-in in its own language and its own content updates from the same deployment without a line of server code changing.

The backend has two parts, like the app's Core and mobile shell (ADR 0006, 0018):

- **The server Core**, `packages/server-core`, holds the backend's rules and declares the ports they need, such as the `Clock`. It imports only `@slovo/contracts` and Zod: no Hono, no SQL, no better-auth, no Node and no language. Its modules follow the app's Core: factory functions that take an object of dependencies, expected outcomes returned as discriminated unions (`{ ok: true, … } | { ok: false, reason }`), exceptions only for broken invariants, and time from the `Clock`, never from the system clock.
- **The backend**, `apps/backend`, is the shell: the HTTP routes and the oRPC procedures, the adapters of the server Core's ports (Drizzle over Postgres, better-auth, SMTP) and one composition root, `createApp`, which builds the whole backend from its dependencies (the database, the clock, the logger, later the mailer and the Editions). A test builds it with its own and sends requests to it in process. There are no in-memory repositories: the tests run against a real Postgres, one fresh database per run.
- **The same domain folders on both sides** (ADR 0027): `account`, `content` and `edition`, each appearing in the server Core and in the backend when it gets its first modules. The backend's own layer is `database/`: the pool, the schema and the migrate command, which the adapters of every domain share, as the app's adapters share `device/`.

How the factory reaches the server:

- **Editions come from the Edition folders.** At start the backend reads every Edition through `@slovo/language-pack/edition` (ADR 0035), the same folders and contracts schemas the app is built from, so a new Edition folder is enough for the backend to serve it. Editions are not a table. An Edition id the backend didn't find is refused.
- **Edition text comes from the Edition's strings.** What the server writes to a reader, such as the sign-in email, is a string group of the Edition, never text in server code. The server Core carries the same Cyrillic tripwire as the app's Core.
- **Feature Switches come from the Edition config.** The backend reads the switches from `edition.json`, as the app does, and refuses a request for a feature the Edition switches off, so a switch means the same on both sides. This amends ADR 0008's "stored in the database": remote Feature Switches arrive with sync (0.8).
- **Data is partitioned by `edition_id`.** A table of data that belongs to one Edition carries an `edition_id` column, checked against the Editions the backend found. Data of the Account is shared: one Account works in every Edition.
- **No server-side Extension Point yet.** One is added only when an Edition needs its own server behaviour (ADR 0006's rule).

better-auth does the heavy parts of the Account (Sign-in codes, Sessions, deleting the Account) behind an `Authenticator` port of the server Core, and the app never calls better-auth's own endpoints. Its tables are renamed to the glossary through its model-name option: `accounts` (its `user`), `sign_in_methods` (its `account`), `sessions` and `sign_in_codes` (its `verification`), so "account" never means two things in the code. Its email OTP plugin keeps each Sign-in code as its SHA-256. better-auth reads the system clock for the expiry of codes and Sessions, not the server Core's `Clock`, so its adapter does too and the tests move that time with Vitest's system time.

better-auth can't keep Session tokens hashed: it looks a Session up by its token as it is, and a hook that hashed the token on the way in would also hash the token it hands back. The `sessions` table holds the tokens in plain, an accepted risk with two mitigations. The token a device gets is the bearer plugin's signed form, the token and its HMAC with `AUTH_SECRET`, and the backend accepts only that form (`requireSignature`), so the tokens in a leaked database sign nobody in without the secret too. If better-auth learns to hash Session tokens, the backend turns it on with a migration that ends every Session.

A few of better-auth's columns stay empty because SLOVO never fills them: `accounts.name` and `image` (no name or image), `sessions.ip_address` and `user_agent` (the backend keeps only the email; IP tracking is off and its server API gets no request headers), and the token and password columns of `sign_in_methods`, which have no row until Sign in with Apple and Google (0.9). Its schema check needs them in place.

dependency-cruiser holds the boundaries in CI (`pnpm deps`): the server Core imports only the contracts and Zod; the backend imports neither the app's Core, the UI nor React; the mobile app imports neither the server Core nor the backend. What both sides share, such as the API contract, lives in `contracts`.

## Considered Options

- **Everything in the backend app, layered by folders**: rejected. Nothing would stop a rule from reaching into Hono or SQL, and the rules would be tested only through HTTP.
- **The server rules in the app's Core**: rejected. The app's Core is the reader's device (its user state, its Feed); the server's rules (Sessions, limits, publishing packs) never run there, and the app would ship code it never calls.
- **A registry of Editions in the database**: rejected. Editions live in git and change with a build; a second copy in the database would drift from the folders the app is built from.
