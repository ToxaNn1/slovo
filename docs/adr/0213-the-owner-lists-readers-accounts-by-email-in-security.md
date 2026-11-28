---
summary: Безпека lists readers' Accounts for the Власник alone (email, search, one Account's page with its Sync records) and deletes one with a reason into the Action log (ADR 0204); analytics still show aggregates only; the privacy policy names what the owner sees (amends 0088).
---

# The owner lists readers' Accounts by email in Безпека

Decision of 2026-11-20 (#2085), recorded on 2026-11-28 after the audit of that day.

**Why.** ADR 0088 kept the admin to aggregates and no list of Accounts. Helping a reader and removing spam and test Accounts needs the owner to find an Account by its email and see what it holds.

## Decision

- **Власник only.** The block «Акаунти читачів» in Безпека lists Accounts by email, newest first, with a search, and opens one Account: its email, creation time, sign-in method and Sync records. Адмін and Агент have no access.
- **Read, never edited.** The owner changes nothing in an Account; the only write is its deletion, with a reason, into the Action log (ADR 0204).
- **Analytics unchanged.** Аналітика and Якість show aggregates only, never a list of people.
- **The privacy policy** says what the owner sees and why.

## Considered Options

- **Deletion by a typed email alone, no list**: rejected. The owner could not answer a reader's question or find test Accounts.
