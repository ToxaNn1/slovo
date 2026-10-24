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

better-auth does the heavy parts of the Account (Sign-in codes and Sessions) behind an `Authenticator` port of the server Core, and the app never calls better-auth's own endpoints. Deleting the Account is the adapter's own: better-auth's deletion runs its deletes one by one outside a transaction (its Drizzle adapter has transactions off), so the adapter deletes the Account and the Sign-in codes waiting for its email in one transaction, and the database's `ON DELETE CASCADE` takes the Sessions and sign-in methods with the Account. The server Core finds the Account from the Session's token for every action on it, never from what a request names, so a Session acts only on its own Account. Its tables are renamed to the glossary through its model-name option: `accounts` (its `user`), `sign_in_methods` (its `account`), `sessions` and `sign_in_codes` (its `verification`), so "account" never means two things in the code. Its email OTP plugin keeps each Sign-in code as its SHA-256. better-auth reads the system clock for the expiry of codes and Sessions, not the server Core's `Clock`, so its adapter does too and the tests move that time with Vitest's system time.

better-auth can't keep Session tokens hashed: it looks a Session up by its token as it is, and a hook that hashed the token on the way in would also hash the token it hands back. The `sessions` table holds the tokens in plain, an accepted risk with two mitigations. The token a device gets is the bearer plugin's signed form, the token and its HMAC with `AUTH_SECRET`, and the backend accepts only that form (`requireSignature`), so the tokens in a leaked database sign nobody in without the secret too. If better-auth learns to hash Session tokens, the backend turns it on with a migration that ends every Session.

A few of better-auth's columns stay empty because SLOVO never fills them: `accounts.name` and `image` (no name or image), `sessions.ip_address` and `user_agent` (the backend keeps only the email; IP tracking is off and its server API gets no request headers), and the token and password columns of `sign_in_methods`, which have no row until Sign in with Apple and Google (0.9). Its schema check needs them in place.

dependency-cruiser holds the boundaries in CI (`pnpm deps`): the server Core imports only the contracts and Zod; the backend imports neither the app's Core, the UI nor React; the mobile app imports neither the server Core nor the backend. What both sides share, such as the API contract, lives in `contracts`.

## Considered Options

- **Everything in the backend app, layered by folders**: rejected. Nothing would stop a rule from reaching into Hono or SQL, and the rules would be tested only through HTTP.
- **The server rules in the app's Core**: rejected. The app's Core is the reader's device (its user state, its Feed); the server's rules (Sessions, limits, publishing packs) never run there, and the app would ship code it never calls.
- **A registry of Editions in the database**: rejected. Editions live in git and change with a build; a second copy in the database would drift from the folders the app is built from.

## Amendment: the sign-in limits count in fixed windows, by the connection's IP (0.7, #343)

The limits of signing in (5 Sign-in codes an hour per email; 20 code requests and 30 code checks per 10 minutes per IP) are rules of the server Core's `account` domain. They count through a `RateLimits` port with the server Core's `Clock`, and the backend keeps the counts in Postgres, since there is one instance. Each key, a limit with the email or IP address it counts, has a fixed window that opens with its first request and lasts the limit's time; one statement counts a request, so requests that come together each count. A request over a limit answers `TOO_MANY_REQUESTS` (429) with `Retry-After`, the rest of its window in whole seconds, and sends nothing. A window that has ended is deleted, so the `rate_limits` table keeps an email or an IP address no longer than its limit needs. That IP address is the only one the backend keeps.

The IP address is the one of the request's connection. A forwarding header such as `X-Forwarded-For` is not trusted, since any client can send one. Behind the deployed proxy (0.9) every request comes from the proxy's address, so the limits per IP would hold back every reader together; trusting the header the proxy sets comes with it.

### Considered Options

- **better-auth's own limiter**: rejected. It counts requests to better-auth's HTTP endpoints, keyed by IP and path, and nothing reaches them: the backend calls its server API. It has no key for the email.
- **Sliding windows**: rejected for now. A fixed window lets up to twice a limit through around its end, which these limits can bear, and it needs one row per key instead of one per request.

## Amendment: the test harness gives each file its database and each test one clock; a request's IP is settled where it arrives (architecture review 2)

The backend's tests reach it through one harness, `apps/backend/src/test-support.ts`, which Vitest runs before every test file. It replaces "one fresh database per run": each test file gets a fresh, migrated database of its own and drops it after, so the files run side by side and no file's clock or clean-up reaches another's data. Each test runs on one clock, the system time, frozen when the test starts. The harness gives the composition root the system `Clock`, so better-auth and the server Core read the same time, and a test moves both with one call (`passTime`). The harness also builds the test Editions, copies of the Ukrainian Edition under ids of their own whose content is copied and recorded when a test first builds a pack, and sends every request, through the API's client or one of the test's own, to the app in process on a connection from an IP address. The server Core has no tests of its own: its rules lean on the adapters behind its ports, and with no in-memory repositories the tests through the backend are their natural seam.

Every request has the IP address of its connection. The app takes it once, where a request arrives and before any route runs, and a request without one is a broken invariant answered `500 { code: "INTERNAL" }`; the procedures read the address and never check for it.

### Considered Options

- **better-auth reading the server Core's `Clock`**: not possible. It reads the system time itself, so the one clock both can read is that time.
- **One database for the run, files one after another**: rejected. It made every file wait for the others, and a test moving the clock made better-auth delete the codes of another file's tests.

## Amendment: the rules of Sign-in codes and Sessions are the Authenticator's (architecture review 2)

The rules of a Sign-in code (six digits, signs in for 10 minutes, 5 tries, a spent code stays spent until a new one is sent) and how long a Session lasts (90 days after its last use) live behind the `Authenticator` port, in its better-auth adapter, and the server Core no longer exports them. better-auth enforces them from its configuration, the tries left come from the row it keeps, and the server Core only passes on what checking a code gives, so a rule on the Core's side would only be handed back to the adapter. The adapter alone knows how better-auth keeps a code in `sign_in_codes`: the email as `sign-in-otp-<email>`, the hash and the tries spent as `<hash>:<tries>`. It reads the tries spent through better-auth, which finds the row and clears the expired ones, and splits that value in one function. The tests check the rules through the API's contract. Where one must see what the database keeps of a code, as the leak test and "kept only as its hash" do, the harness gives the row's id and the code's hash through a function of the adapter, so no test knows the format.

### Considered Options

- **The rules in the server Core, given to the adapter**: rejected. The Core never reads them, so the port would carry configuration through it, and the tries left and the spent-code rule would still need better-auth's row.

## Amendment: one gate opens a Session, and the Edition registry says whether an Edition serves a feature (architecture review 2)

Every procedure of a Session reaches its Account through one gate, `Accounts.session`: it takes the token the request carries, or none, and answers the Session that is on with its Account, or unauthorized. The backend's procedures pass it through one middleware, the one place that answers `UNAUTHORIZED`, and the actions on an Account (`signOut`, `signOutEverywhere`, `delete`, and the ones sync brings in 0.8) take the Session it opened. Only the gate makes a `Session`: its type carries a symbol nothing outside the server Core can name, so an action can't be handed an Account a request names. A Session that ends between the gate and its action has ended either way, so the action answers done.

Whether an Edition serves a feature is the Edition registry's answer, `serving(editionId, feature)`: the Edition when the backend found it and its Feature Switch for the feature is on, or why not (`unknown-edition`, `switched-off`). The Account and the content procedures ask it with their feature and answer both refusals as `NOT_FOUND`, so a new feature behind a switch gets the rule by naming its switch. Publishing a pack asks only that the backend found the Edition, since a pack may wait for the switch to come on.

### Considered Options

- **Each action of a Session taking the token and finding the Account itself**: rejected. It was so for three of the four procedures, and `me` went the other way; each new procedure of sync would add one more place to answer `UNAUTHORIZED`.

## Amendment: the Edition registry reads the remote Feature Switches (0.8, ADR 0040)

Feature Switches still come from the Edition config, and the owner can now turn a feature off remotely in an emergency. `serving(editionId, feature)` reads those remote switches after the Edition's own, so it is asynchronous, and a feature off remotely is `switched-off`, answered `NOT_FOUND` like a feature the Edition turns off. The backend builds the registry in one place, over the Editions read from their folders and the `remote_switches` table, for the app and for the publish and switch commands. ADR 0040 says how remote switches are stored, set and served.

## Amendment: the `sync` domain keeps the records of Sync (0.8, ADR 0041)

The backend gains a fourth domain folder on both sides, `sync`: the server Core's Sync, with its `UserRecords` port, and the backend's `sync.push` and `sync.pull` procedures with the port's adapter over the `user_records` table, whose rows carry `edition_id` and go with their Account through the cascade. Its procedures reach the Account through the session gate, whose middleware now lives in the backend's `account` folder for every procedure of a Session to use, and they ask the Edition registry for both the `account` and the `sync` Feature Switches.

## Amendment: what a request may bring, what a log line may show, and which secret signs (whole-project review)

- **A request body is at most 8 MB** (8 × 1024 × 1024 bytes). The backend refuses a larger one under `/v1` before it parses it and before any Session is checked, with `413 { code: "PAYLOAD_TOO_LARGE" }`, so no client, signed in or not, makes it read gigabytes. The largest request of the contract is a push of 500 changes with keys of 200 characters and values of 8 KB (ADR 0041): 4.7 MB at most, when every character of its keys takes six bytes of JSON (`\u0001`), so 8 MB leaves room. Like the bare `404 NOT_FOUND` of an unknown address and the bare `500 INTERNAL`, the answer is the app's, not a procedure's, and the contract doesn't list it.
- **A failed query's log line holds none of its values.** Drizzle wraps a failed query in an error whose message, stack and `params` carry the values it bound: an email, a Session token, a rate-limit key. The logger's error serializer writes such an error as its SQL, whose values are `$1`, `$2`..., its stack frames, and its cause; Postgres's own error as its SQLSTATE (`errorCode`), constraint, table and column, without its message and detail, which may quote a value. Each cause of any error comes on its own under `cause`, so a value never reaches a line through an error that wraps it.
- **The `AUTH_SECRET` of `.env.example` is refused.** Anyone can read it, so Sessions signed with it would be signed with no secret, and the signature is what keeps the plain tokens of a leaked database from signing anyone in. The server refuses to start with it, naming the variable; `pnpm dev` gives a `.env` that keeps it a fresh secret.

### Considered Options

- **A limit per procedure**: rejected. Every request but a push is a few hundred bytes, and one limit at the size of the largest request is enough against a flood; the deployed proxy (0.9) may cap bodies too, but nothing did.
- **Redacting `params` by path**: rejected. pino's redaction reaches named fields, not the message and the stack, which repeat the values.

## Amendment: the sign-in limits count an IPv6 client by its /64, cap each email per day, and keep no email or IP (0.8.9, #649)

The security review of 0.8.9 (#618, findings F3, F5, F12) found three weak spots in the sign-in limits, and this amendment closes them.

- **A per-IP limit counts an IPv6 client by its /64.** A host normally owns a whole /64 and would skip every per-IP limit by rotating addresses in it, so the server Core counts an IPv6 address as its /64 prefix, and an IPv4-mapped IPv6 address (`::ffff:a.b.c.d`, how Node's dual-stack socket gives an IPv4 connection) as its IPv4. An address that parses as neither counts as written.
- **Each email has a day's limits.** A Sign-in code has 5 tries and a new code brings 5 fresh ones, so the hour's 5 codes gave a guesser with spread IPs 25 tries an hour with no end. Two limits per email join the hour's: 10 codes a day and 25 code checks a day, so one email takes at most 25 guesses a day against a million codes. A code request counts against the IP, then the hour, then the day, so a refused request leaves the later limits uncounted; a code check counts against the IP, then the day.
- **The `rate_limits` table names no email and no IP address.** The backend's `RateLimits` adapter keys each window by the HMAC-SHA256 of the server Core's key, with a key derived from `AUTH_SECRET` for this use alone, so the one secret of the host signs the Sessions' tokens and hides the limits' subjects without one standing in for the other. Counting is unchanged, and the server Core doesn't know. A dump of the table tells nobody who tried to sign in.

### Considered Options

- **Lengthening the code's window after repeated spent codes**: deferred. The day's limits bound the guesses by themselves; a growing window would be a second mechanism for the same budget.
- **Hashing with `AUTH_SECRET` itself**: rejected. One key for two uses lets a leak of the limits' keys, which are hashes of guessable strings, say something about the key that signs tokens; a derived key costs one line.
- **A separate `RATE_LIMITS_SECRET`**: rejected. One more secret to provision for a key that protects short-lived counters; the derived key gives the separation.
