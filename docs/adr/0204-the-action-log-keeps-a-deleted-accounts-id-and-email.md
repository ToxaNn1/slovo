---
summary: The Action log row of an owner admin's Account deletion keeps the deleted Account's id, email and creation time for good, written in the same transaction as the deletion, so the log shows who was erased, by whom and why; the reader's own «Видалити SLOVO ID» logs nothing (amends 0088).
---

# The Action log keeps a deleted Account's id and email

Decision of 2026-11-20, the owner's call on audit finding 4.M4.

**Why.** ADR 0088 keeps the Action log forever and never edited, with the value before and after every change, and says nothing about a change whose «before» is a person's data. An Account deleted through the admin (`deleteAccount`) left its email in the log; whether that is kept, hashed or dropped was undecided.

## Decision

- **Kept, both.** The `account.delete` row's «before» holds the deleted Account's id, email and creation time. It is kept for good like every other row: the log is the owner's record of who was erased, by whom and why, and the email is what a reader names when they ask about it. The id ties the row to the Account's earlier rows and reports.
- **One write.** The Account, its Sessions, sign-in methods, Sync records and waiting Sign-in codes go, and the row is appended, in one transaction: no deletion without its row, no row without its deletion.
- **Only the admin's deletion.** A reader deleting their own Account in the app («Видалити SLOVO ID») writes no Action log row, as before: it is no admin write.

## Consequences

- An email erased through the admin stays in `action_log`; the privacy text names this retention.
- A request to erase the row itself would need a superseding ADR, since the log is never edited.

## Considered Options

- **A hash of the email**: rejected. It answers «was this email deleted» only to someone who already has the email, and the owner reads the log to see who was erased.
- **The id alone**: rejected. After the deletion no row maps the id back to a person, so the log could not answer a reader's question.
