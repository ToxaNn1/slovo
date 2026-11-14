# A Власник deletes a reader's Account by email in the admin

ADR 0088 kept the Owner admin apart from Accounts: it lists none and acts on none, and the Account rules let only a Session act on its own Account. A reader who lost their phone, or a spam or test Account, could then be removed only by hand in the database, past the Action log. This ADR amends ADR 0088 and keeps the rest of it.

The rule:

- **Безпека finds one Account by its email**, for a Власник only: it answers that the Account exists, the date it was made and the Google and Apple sign-in methods recorded for it, nothing more. There is still no list of Accounts, and nothing of the reader's words or progress is shown.
- **A Власник deletes that Account with a required reason.** The deletion is the app's own «Видалити SLOVO ID»: the same Authenticator delete takes the Account with its Sessions, sign-in methods, the records Sync keeps of it in every Edition and the Sign-in codes waiting for its email. The email may then sign in to a new, empty Account.
- **The Action log keeps every deletion**: who, when, `account.delete`, the email and the Account's date before, nothing after, and the reason.
- **An Адмін and an Агент are refused**, as on every Безпека procedure. An email with no Account is answered «не знайдено» and a deletion of it is refused as `unknown`; nothing changes.

Consequences:

- The server Core's Accounts gain `find` and `deleteByEmail`, which name an Account by email for the admin alone; the Account procedures of the app still act only on the Session's own Account.
- The admin API gains `findAccount` and `deleteAccount`.
