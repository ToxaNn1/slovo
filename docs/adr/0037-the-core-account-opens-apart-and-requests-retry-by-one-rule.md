# The Core's Account opens apart from the composition, and requests to the backend try again by one rule

From 0.7 the Core has an Account module that owns every rule of the SLOVO ID screen, and the app talks to the backend for the first time. Two things had to be decided for it: where the Account opens, and how a request that fails is tried again.

The Account opens apart from the Core composition, as Settings do (ADR 0018), though for another reason: it needs no Language Pack and shares nothing with the Feed and the user's words. Signing in, out and deleting never touch the user state, so the composition has no link to make with it. It keeps an immutable snapshot and tells its subscribers (ADR 0016): signed out, a Sign-in code sent or signed in, beside whether a request is in flight and the last problem. The problems are the ones the Edition strings have a line for (`offline`, `invalid-email`, `wrong-code`, `code-expired`, `too-many-requests`, `unexpected` since the amendment below, and `refused` since Sign in with Google, ADR 0047); a server that fails through every try shows `offline`, since to the reader it is out of reach. A code that is not six digits is no try: nothing is sent, so a wrong code always comes with the tries left that its text counts.

The device keeps the Session through a `SessionStore` port, its token together with the Account's email, so a Session kept from before shows its email at launch, offline too. The Session is checked with the server at most once an hour; a check that finds no server counts for nothing, and offline the Session holds. Signing out forgets the Session at once; a sign-out the server couldn't hear waits in memory and is told at the next refresh. A restart before then loses it, and the Session ends on the server only when it expires (90 days); the device is signed out either way.

Every request of the Core to the backend tries again by one rule, in `retry.ts` at the Core's root, so the Content update module uses the same: only a failure that may pass by itself, no answer or a 5xx (a 429 too until the amendment below), is tried again, at most 3 times; before the nth try again it waits between half and all of 1 s × 2ⁿ⁻¹, drawn from the injected `Random`, through the injected `Schedule`. Many devices that failed at once spread out instead of trying together. The Game's retry of its planning (ADR 0024) stays as it is: it reads the Language Pack on the device, where there is no server to spare.

## Considered Options

- **The Account inside the composition**: rejected. It would wait for the Language Pack to open, and the composition gains nothing from it.
- **Keep only the token, and ask the server for the email**: rejected. A Session kept from before would show no email until the server answers, and none at all offline.
- **Keep untold sign-outs in the Keychain so a restart tells the server too**: rejected for now. It would need a second record in the store for a Session that ends by itself, and the device is signed out either way.
- **The Game's fixed delays (1, 2 and 4 s) for backend requests**: rejected. Without jitter every device that failed at once tries again at the same moment, which is what a struggling server needs least.
- **Try again on every failure**: rejected. A wrong code, an expired code or an ended Session doesn't pass by itself, and trying a wrong code again would spend the reader's tries.

## Amendment: a 429 is not tried again (0.7, #343)

The backend answers `TOO_MANY_REQUESTS` (429) in two cases, and neither passes while the tries wait. Over a sign-in limit, its `Retry-After` is the rest of a window of 10 minutes or an hour, while the three tries again wait at most 7 s together. A spent Sign-in code passes only with a new code, so its answer has no `Retry-After`. Tried again, both would cost the reader three useless requests, and each of them counts against the limits per IP. So only no answer and a 5xx are tried again; a 429 shows `too-many-requests` at once. The Content update module follows the same rule: a held-back check waits for the next due one.

### Considered Options

- **Try a 429 again only when it carries `Retry-After`**: rejected. The limits' windows are minutes long, so a try again after a few seconds still meets the limit.
- **Wait for `Retry-After` before trying again**: rejected. The reader would wait minutes behind a spinner for an answer the screen can give at once.
- **Give the spent code an error of its own**: rejected. It fixes only one of the two cases, and it needs a new contract code and a new Edition string for what «Забагато спроб» already says.

## Amendment: every answer of the backend reaches the Core as a failure (architecture review 2)

Until now the app's adapters turned only some answers of the backend into failures of the Core: no answer, a 5xx, a 429, and the codes each adapter compared by hand, such as `CODE_EXPIRED`. Any other answer was thrown again, through the Core, to the screen. A `BAD_REQUEST` or a `NOT_FOUND` on a Sign-in code request stopped the spinner of the SLOVO ID screen with no line under the field, and the error went only to the log.

Now one module of the shell, `answerOf` in `apps/mobile/src/api.ts`, turns every answer of a call into what the Core's ports answer, and the ports never reject. An error the contract defines for the procedure comes to the failure its adapter makes of it, with its code and data typed by the contract, so renaming a code fails typecheck. Otherwise no answer is `offline`, a 429 `too-many-requests`, a 5xx `server-error`, and any other answer is a sixth reason, `unexpected`, such as a request the backend refuses or an Edition it doesn't serve. It is not tried again, since no try changes it. The Account shows it as a sixth problem, `unexpected`, with its own line in the Edition strings; a sign-out the server answers unexpectedly is told no more. The Content update module treats it as any failed check.

### Considered Options

- **Show an `unexpected` answer with an existing line**: rejected. `offline` would send the reader to check a network that works, `too-many-requests` would ask them to wait out a limit there isn't, and `invalid-email` fits only one of the cases.
- **Map each code to a failure by status in each adapter, as before**: rejected. A code compared as a bare string survives its renaming in the contract, and a status no adapter names still reached the screen as a rejection.

## Amendment: the snapshot names the request in flight, and the value rules come from the contracts (architecture review 2)

The snapshot said only whether a request was in flight. The SLOVO ID screen kept two states of its own to know which button's spinner to turn, which request it had started and when it ended, and only Maestro checked them. Now `inFlight` names the action of the Account whose request is in flight (`requestCode`, `resendCode`, `verifyCode`, `signOutEverywhere`, `delete` or `refresh`; `refresh` left it with the amendment for batch B3 below), or is `undefined`, and the screen only reads it. The Core's tests check which request each action shows.

The rules of the values both sides check were written in several places: six digits in the contract, in the better-auth adapter and as a pattern in the Core; trimming, lower-casing and checking an email in the Core and in the server Core; and the Core kept its own copy of the published pack's shape. Had one copy drifted, the app would have sent what the backend refuses as `BAD_REQUEST`. Now `@slovo/contracts` holds them once: `SIGN_IN_CODE_DIGITS` and `SignInCodeSchema` for the Sign-in code, `AccountEmailSchema` for the email of an Account, and `PublishedPack` for the pack the backend announces. The Core, the server Core, the adapter and the screen's code field derive from them. The `/v1` description stays the same: the API still takes the email as typed, and the backend makes the Account's email of it.

### Considered Options

- **A second field beside `inFlight: boolean`, naming the request**: rejected. Two fields can disagree, and every reader of the snapshot would have to check both.
- **Check the email in the API input with `AccountEmailSchema`**: rejected. It changes the committed `/v1` description (ADR 0031 amendment), and the server Core, which its tests reach without HTTP, would lose the rule.

## Amendment: the Sync module follows the one retry rule and the Account's 401 rule (0.8, #387)

Sync (spec #378, ADR 0041) is the first module besides the Account that makes requests with the Session, and the first whose requests no reader waits for. It follows the same rules, with one difference for a 429.

- **The one retry rule.** A sync that fails with no answer or a 5xx is tried again whole through `withRetries`, at most 3 times, with the same backoff and jitter through the `Schedule`. A sync resumes where it stopped (the cursor and the pending changes left), so a try again doubles nothing. Every other failure (`unexpected`, `NOT_FOUND`, `TOO_MANY_RECORDS`) is not tried again; the next moment of Sync syncs again. Only a sync that failed with no answer through every try shows that it waits for the network; a server that fails shows the last sync's time, since the status line has nothing the reader can do about it.
- **A 429 waits for its `Retry-After`.** Unlike the Account's, a sync is in the background with no spinner in front of it, so waiting minutes costs the reader nothing, and trying sooner would only meet the limit again. The `SyncApi` port's `too-many-requests` failure carries the answer's `Retry-After` in seconds, which the app's adapter reads from the header; Sync syncs again when it ends, while in the foreground, and no moment syncs sooner. Without one, the next moment syncs.
- **A 401 goes to the Account.** The Account lends its Session to another module's request through `withSession(request)`: none without a Session, and when the answer is a 401 the device forgets the Session and shows signed out with no problem, as for the Account's own requests, unless the Session ended on the way. Sync never sees the Session's ending as an error of its own, and makes no try again of a sync once its Session has ended.
- **The end of a Session forgets the cursor.** When the Account goes from signed in to signed out, by a sign-out, a deletion or a 401, Sync forgets its cursor and the time of its last sync once no sync of that Session runs (a pull answered on the way would write the cursor again), and keeps the pending changes and the words. The next Session, of the same Account or another, starts by the first-sign-in rule. Sync opens signed out by forgetting a cursor a closed app left.

### Considered Options

- **The Account's rule for a 429, shown at once and not waited for**: rejected. There is nothing to show, and the next write or return would ask again within the limit's window.
- **Giving Sync the Session's token and its own 401 rule**: rejected. Two modules would end the Session, and the rule that an answer outdated by a sign-out changes nothing would live twice.
- **Forgetting the cursor at once at the sign-out**: rejected. A sync running at that moment could write a cursor of the ended Session after it, and the next sign-in would skip the first-sign-in rule.

## Amendment: the check of the Session runs in the background (whole-project review, batch B3)

The check of the Session (`refresh`) went through the same path as the reader's requests, so it showed `refresh` in flight through up to three tries again, several seconds against a failing server. The SLOVO ID screen disables «Вийти на всіх пристроях» and «Видалити» while any request is in flight, so both went grey with no spinner right after Settings opened, and a deletion confirmed in a dialog opened before the check started did nothing. The check also cleared the problem the screen showed.

Now the check runs in the background, as Sync's requests do: it shows nothing in flight, keeps the problem shown and holds back no action, so `inFlight` names only the reader's requests (`requestCode`, `resendCode`, `verifyCode`, `signOutEverywhere` or `delete`). It still tries again by the one rule and applies the 401 rule, and its answer changes nothing once the Session ended on the way, such as by a deletion made meanwhile. One check runs at a time: a `refresh` asked while one is in flight waits for it.

### Considered Options

- **Keep the check in flight, and let signing out everywhere or deleting wait for it**: rejected. Nothing is lost, but the buttons still go grey for seconds with no reason the reader can see.
- **Keep it as it was**: rejected. A confirmed deletion that silently does nothing is the one thing the screen must never do.

## Amendment: a fresh install forgets a Session left from an earlier install (0.8.9, #660)

On iOS, deleting the app deletes the user state but leaves the Session in the Keychain, so a new install on the same device opened signed in to the old Account (security review #617, F3). The Account now opens over the user state too. The user state holds an installed marker; when the Account opens without it and finds a Session, it forgets that Session by the same path as signing out (the Google sign-in with it), tells the server in the background (offline, the next `refresh` tells it), and writes the marker; without a Session it only writes the marker. The Account opens before Sync can lend its Session, so a left Session never syncs. User-state migration 5 writes the marker for a store that holds any record besides its schema version, so an install updated from an earlier version stays signed in.

### Considered Options

- **The marker in the Keychain beside the Session**: rejected. The Keychain is what outlives the app; only a store the app's deletion removes can tell a new install.
- **Await telling the server at launch**: rejected. Offline, the tries and their backoff would hold the Account's opening for seconds; the sign-out is best effort, as signing out is.
