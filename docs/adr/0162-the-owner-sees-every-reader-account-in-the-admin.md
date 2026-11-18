---
summary: Безпека lists every Account for a Власник alone (email, date, Google/Apple methods and every Edition's Sync records in plain words, read only, paged, searched by email) and deletes one with a required reason through «Видалити SLOVO ID», logged in the Action log; the registered count is the number of Accounts (supersedes 0127, amends 0088's «never a list of people»).
---

# A Власник sees every reader's Account in the admin

Owner decision of 2026-11-17. ADR 0127 let a Власник find one Account by email in Безпека, showing only its date and sign-in methods, and said «There is still no list of Accounts». The owner wants to see who has signed in, help a reader with their words and progress, and clear spam and test Accounts without knowing their email first. This ADR supersedes ADR 0127 and amends ADR 0088, whose admin «never shows a list of people».

The rule:

- **Безпека lists every Account**, for a Власник only: the email, the date it was made, the Google and Apple sign-in methods recorded for it, and, for every Edition the Account syncs, the records Sync keeps of it: Favorites, Collections, hidden Entries, «Знаю» and «Не знаю» marks, the Streak, XP, the Level, the Daily Goal, freezes and Breaks, Badges and settings. The list is newest first, paged, and searched by email; one Account opens on its own page with all of it.
- **Read only.** The admin shows the reader's records and never edits them.
- **In plain words** (amended 2026-11-17): every record reads as the app words it, never as its id or key. An Entry in Favorites, a Collection, the Hidden Entries or a «Знаю» / «Не знаю» mark shows by its title as the content database keeps it now, and an id the Edition no longer has as «<id> (немає в базі)»; a Badge and a Narrator Voice by the name the Edition card gives it; a setting by its name and value in Settings; History, the Active Days kept from before 1.0, confirmed Entries, Corrections worked through and Curated Collections opened as counts; the Best result of each Game Mode after the latest reset marker. Only a record of a kind the admin does not know stays counted under «Інші записи». `getAccount` sends the Entries the records name with each Edition, and the Edition card gains the Badges and Narrator Voices. Nothing of an Account goes to PostHog, Sentry or a log line.
- **A Власник deletes an Account with a required reason**, from the list or its page, as ADR 0127 did: the app's own «Видалити SLOVO ID», the same Authenticator delete that takes the Account with its Sessions, sign-in methods, every Edition's Sync records and the waiting Sign-in codes.
- **The Action log keeps every deletion**: who, when, `account.delete`, the email and the Account's date before, nothing after, and the reason. Opening the list or an Account is not logged (reads are never logged, ADR 0088).
- **An Адмін and an Агент are refused**, as on every Безпека procedure.
- **The count of registered readers** is the number of Accounts, shown in Огляд and Аналітика. Accounts are not per Edition, so the number ignores the Edition filter; the number of Accounts with Sync records in an Edition follows it.
- **The privacy policy** names it: the owner of SLOVO may view an Account's email, words and progress to help the reader or remove spam and test Accounts. The text waits for the owner's approval (ADR 0068).

Consequences:

- The server Core's Accounts gain `list(page, search)` and `get(accountId)`, which name Accounts for the admin alone; `find` by email is folded into the search. `deleteByEmail` stays. The Account procedures of the app still act only on the Session's own Account.
- The admin API gains `listAccounts` and `getAccount`; `findAccount` goes. An admin procedure may go within `/v1`, as an admin input may narrow (ADR 0122): the admin ships with the backend, so the breaking-change check skips a gone admin path. Admin outputs stay held.

## Considered Options

- **Keep ADR 0127, one Account by email**: rejected by the owner. A spam Account's email is not known in advance, and help with words needs the words.
- **Show counts only, no list**: rejected. Deleting spam needs the list.
- **Let the admin edit a reader's records**: not asked for; the reader's devices own their records and Sync would fight the edit.
