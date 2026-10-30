# The Core's Account opens apart from the composition, and requests to the backend try again by one rule

From 0.7 the Core has an Account module that owns every rule of the SLOVO ID screen, and the app talks to the backend. This records where the Account opens, how it keeps the Session, how every answer of the backend reaches the Core, and how a failed request is tried again.

## The Account

- **Opens apart.** The Account opens apart from the Core composition, as Settings do (ADR 0018): it needs no Language Pack, and signing in, out and deleting never touch the words. It opens over the user state only for the installed marker below.
- **Snapshot.** It keeps an immutable snapshot and tells its subscribers (ADR 0016): signed out, a Sign-in code sent or signed in; `inFlight`, the action whose request is in flight (`requestCode`, `resendCode`, `verifyCode`, `signInWithGoogle`, `signOutEverywhere` or `delete`) or `undefined`; and the last problem. The screen only reads `inFlight` to turn the right spinner.
- **Problems.** Each has a line in the Edition strings: `offline`, `invalid-email`, `wrong-code`, `code-expired`, `too-many-requests`, `refused` (Google, ADR 0047) and `unexpected`. A server that fails through every try shows `offline`, since to the reader it is out of reach. A code that is not six digits is no try: nothing is sent.
- **Session.** The device keeps the Session through a `SessionStore` port, its token with the Account's email, so a kept Session shows its email at launch, offline too. Signing out forgets it at once; a sign-out the server couldn't hear waits in memory and is told at the next check, and a restart before then loses it (the Session then ends on the server when it expires, after 90 days).
- **Check of the Session.** `refresh` checks the Session with the server at most once an hour, in the background: it shows nothing in flight, keeps the shown problem and holds back no action. A check that finds no server counts for nothing; one check runs at a time, and its answer changes nothing once the Session ended on the way.
- **A 401 ends the Session.** The Account lends its Session to other modules' requests through `withSession(request)`; on a 401 the device forgets the Session and shows signed out with no problem, unless the Session already ended on the way. No other module ends a Session.
- **A fresh install forgets a left Session.** On iOS, deleting the app leaves the Session in the Keychain. The user state holds an installed marker; when the Account opens without it and finds a Session, it forgets that Session as signing out does (Google sign-in too), tells the server in the background, and writes the marker. It opens before Sync can lend the Session. User-state migration 5 writes the marker for any store that holds records, so an updated install stays signed in.

## Answers and the retry rule

- **Every answer is a value.** The Core reaches the backend through one port, the API contract's client (ADR 0064), and `answerOf` in `packages/core/src/backend.ts` turns every answer of a call into a value: a Core module's request never rejects. An error the contract defines for the procedure becomes the module's failure, typed by the contract; otherwise no answer is `offline`, a 429 `too-many-requests`, with the seconds of the answer's `Retry-After`, a 5xx `server-error`, and anything else `unexpected`.
- **One retry rule.** Every Core request to the backend tries again through `withRetries` in `packages/core/src/retry.ts`: only no answer or a 5xx is tried again, at most 3 times; before the nth try it waits between half and all of 1 s × 2ⁿ⁻¹, drawn from the injected `Random`, through the injected `Schedule`. A 429, an `unexpected` answer or a code the contract defines is never tried again.
- **A 429.** The Account shows `too-many-requests` at once: the sign-in limits' windows are minutes long, and a spent Sign-in code passes only with a new code. Sync, which runs in the background, waits for the answer's `Retry-After` instead (ADR 0041), as Mistake Reports and the Community Counters do. The Content update module waits for its next due check.
- **Values come from the contracts.** `@slovo/contracts` holds `SIGN_IN_CODE_DIGITS`, `SignInCodeSchema`, `AccountEmailSchema` and `PublishedPack` once; the Core, the server Core and the code field derive from them. The `/v1` API still takes the email as typed.
- **The Game's retry of its planning** (ADR 0024) stays apart: it reads the Language Pack on the device, with no server to spare.

## Considered Options

- **The Account inside the composition**: rejected. It would wait for the Language Pack, and the composition gains nothing.
- **Keep only the token and ask the server for the email**: rejected. A kept Session would show no email until the server answers, and none offline.
- **Keep untold sign-outs in the Keychain**: rejected for now. A second record for a Session that ends by itself; the device is signed out either way.
- **The installed marker in the Keychain**: rejected. The Keychain is what outlives the app.
- **Fixed delays (1, 2, 4 s) for backend requests**: rejected. Without jitter every device that failed at once tries again together.
- **Try again on every failure, or on a 429 with `Retry-After`**: rejected. A wrong code or an ended Session doesn't pass by itself, and a limit's window outlasts the tries; each try counts against the per-IP limits.
- **Show `unexpected` with an existing line**: rejected. `offline` would send the reader to check a network that works.
- **Keep the check of the Session in flight**: rejected. It greyed out «Вийти на всіх пристроях» and «Видалити» for seconds, and a confirmed deletion could silently do nothing.
- **`inFlight: boolean` beside a second field naming the request**: rejected. Two fields can disagree.
