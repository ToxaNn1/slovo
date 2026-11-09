# Frontend review: feat/1709-admin (apps/admin, apps/mobile)

Scope: `git diff origin/main...HEAD -- apps/admin apps/mobile`. Context budget hit before
content-editor/, content-queue/, overview/, development/, analytics/quality routes were read;
those are NOT reviewed. apps/mobile non-test diff fully read: no verified correctness bug.

## 1. Admin shows a blank page forever when `me` fails with anything but UNAUTHORIZED (medium)
`apps/admin/src/session.ts:16-29`, `apps/admin/src/routes/__root.tsx:38`
`useSignedInAdmin` rethrows every non-`UNAUTHORIZED` error with `retry: false` and returns
`me.data`, which stays `undefined`; `Layout` renders `null` for `undefined`. Scenario: the backend
answers 500/502 during a deploy, or the network drops on first load: the owner gets an empty white
page with no message and no retry (only a window refocus refetches).
Fix: return the query state (`isError`) and render an error line with a retry button in `Layout`
instead of `null`; keep `null` only for `isPending`.

## 2. Rule editor saves a stale snapshot and silently reverts other writes (medium)
`apps/admin/src/switches/rule-editor.tsx:119-121, 300-308`; `switches-screen.tsx:110-121`
`drafts` is seeded once from `rules` at mount, and `setRules` replaces the whole Rule list. The
editor stays open while the matrix toggle and the Kill switch on the same screen stay usable, and
`refetch` does not reseed it (the `key` is `${picked.id}-${editing}` only). Scenario: open
"Правила" for `game`, toggle `game` off in the matrix (writes an everyone-off Rule), then press
"Зберегти правила": the old Rule list is written back and the toggle (or a Kill switch) is undone.
Same with a second admin tab.
Fix: key the editor on the rules' content (e.g. JSON of `rules`) or close it on any other switch
write; better, send the version/ETag the drafts came from and let the backend refuse a stale write.

## 3. "Усі Editions" summary says "on in some" when it is on everywhere it exists (low)
`apps/admin/src/switches/switch-state.ts:65-71`
`summaryText` filters `available`, but compares `on === cells.length` and prints
`з ${cells.length}`. Scenario: 3 Editions, the feature is unavailable in one and on in the other
two: the column reads "увімкнено (2 з 3)" instead of "увімкнено", contradicting its own doc
("on in some of those that have it").
Fix: compare with and print `available.length`.

## 4. Безпека writes bypass the dialog's pending/refusal contract; double writes possible (low)
`apps/admin/src/routes/security.tsx:100-110` (`onConfirm` runs `pending.run(reason)` and returns
`Promise.resolve()`), forms at `:256`, `:340`.
The dialog closes before the mutation settles, so a refusal is not shown in the dialog (its
documented contract) and nothing is disabled while `invite`/`issue`/`setRole` is pending.
Scenario: owner confirms "Видати токен", clicks submit again before it returns: a second
confirmation issues a second write (the second token refused as `name-taken`, or two invites).
Fix: make `PendingWrite.run` return the `mutateAsync` promise and pass it through `onConfirm`, so
the dialog stays busy and shows the refusal; disable the submit buttons while the write is pending.
