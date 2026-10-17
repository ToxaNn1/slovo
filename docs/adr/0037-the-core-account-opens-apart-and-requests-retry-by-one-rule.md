# The Core's Account opens apart from the composition, and requests to the backend try again by one rule

From 0.7 the Core has an Account module that owns every rule of the SLOVO ID screen, and the app talks to the backend for the first time. Two things had to be decided for it: where the Account opens, and how a request that fails is tried again.

The Account opens apart from the Core composition, as Settings do (ADR 0018), though for another reason: it needs no Language Pack and shares nothing with the Feed and the user's words. Signing in, out and deleting never touch the user state, so the composition has no link to make with it. It keeps an immutable snapshot and tells its subscribers (ADR 0016): signed out, a Sign-in code sent or signed in, beside whether a request is in flight and the last problem. The problems are the five the Edition strings have a line for (`offline`, `invalid-email`, `wrong-code`, `code-expired`, `too-many-requests`); a server that fails through every try shows `offline`, since to the reader it is out of reach. A code that is not six digits is no try: nothing is sent, so a wrong code always comes with the tries left that its text counts.

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
