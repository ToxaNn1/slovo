# The Core's Account opens apart from the composition

From 0.7 the Core has an Account module that owns every rule of the SLOVO ID screen, and the app talks to the backend. This records where the Account opens and how it keeps the Session.

## The Account

- **Opens apart.** The Account opens apart from the Core composition, as Settings do (ADR 0018): it needs no Language Pack, and signing in, out and deleting never touch the words. It opens over the user state only for the installed marker below.
- **Snapshot.** It keeps an immutable snapshot and tells its subscribers (ADR 0016): signed out, a Sign-in code sent or signed in; `inFlight`, the action whose request is in flight (`requestCode`, `resendCode`, `verifyCode`, `signInWithGoogle`, `signOutEverywhere` or `delete`) or `undefined`; and the last problem. The screen only reads `inFlight` to turn the right spinner.
- **Problems.** Each has a line in the Edition strings: `offline`, `invalid-email`, `wrong-code`, `code-expired`, `too-many-requests`, `refused` (Google, ADR 0047) and `unexpected`. A server that fails through every try shows `offline`, since to the reader it is out of reach. A code that is not six digits is no try: nothing is sent.
- **Session.** The device keeps the Session through a `SessionStore` port, its token with the Account's email, so a kept Session shows its email at launch, offline too. Signing out forgets it at once; a sign-out the server couldn't hear waits in memory and is told at the next check, and a restart before then loses it (the Session then ends on the server when it expires, after 90 days).
- **Check of the Session.** `refresh` checks the Session with the server at most once an hour, in the background: it shows nothing in flight, keeps the shown problem and holds back no action. A check that finds no server counts for nothing; one check runs at a time, and its answer changes nothing once the Session ended on the way.
- **A 401 ends the Session.** The Account lends its Session to other modules' requests through `withSession(request)`; on a 401 the device forgets the Session and shows signed out with no problem, unless the Session already ended on the way. No other module ends a Session.
- **A fresh install forgets a left Session.** On iOS, deleting the app leaves the Session in the Keychain. The user state holds an installed marker; when the Account opens without it and finds a Session, it forgets that Session as signing out does (Google sign-in too), tells the server in the background, and writes the marker. It opens before Sync can lend the Session. User-state migration 5 writes the marker for any store that holds records, so an updated install stays signed in.

## Answers and retries

Every answer of the backend reaches the Core as a value through `answerOf`, and a failed request is tried again by the one retry rule; both live with the Backend port (ADR 0064). The Account shows a 429 as `too-many-requests` at once: the sign-in limits' windows are minutes long, and a spent Sign-in code passes only with a new code.

## Considered Options

- **The Account inside the composition**: rejected. It would wait for the Language Pack, and the composition gains nothing.
- **Keep only the token and ask the server for the email**: rejected. A kept Session would show no email until the server answers, and none offline.
- **Keep untold sign-outs in the Keychain**: rejected for now. A second record for a Session that ends by itself; the device is signed out either way.
- **The installed marker in the Keychain**: rejected. The Keychain is what outlives the app.
- **Show `unexpected` with an existing line**: rejected. `offline` would send the reader to check a network that works.
- **Keep the check of the Session in flight**: rejected. It greyed out «Вийти на всіх пристроях» and «Видалити» for seconds, and a confirmed deletion could silently do nothing.
- **`inFlight: boolean` beside a second field naming the request**: rejected. Two fields can disagree.
