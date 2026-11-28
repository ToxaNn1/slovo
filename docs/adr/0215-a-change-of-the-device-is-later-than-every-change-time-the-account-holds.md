---
summary: A change of a synced record gets the device's clock time, or 1 ms after the latest change time the device knows the Account to hold when its clock is not past it, so a clock behind another device's cannot make the reader's last change lose (amends 0041).
---

# A change of the device is later than every change time the Account holds

Decision of 2026-11-28, from the Core audit of 28.11 (finding 7.1), the owner's option (a).

ADR 0041 lets the later change time win, by each device's clock. A device whose clock is behind another's lost its reader's last change for good: tablet A sets the Theme to dark at 12:00 and syncs; phone B, 2 minutes slow, pulls dark; the reader picks light on B a minute later, with change time 11:59. The Account ignores it as not later, B deletes the pending change it pushed, and no later pull brings dark back to B: B shows light, the Account and A dark, until the key changes again.

## Decision

- The device keeps one `device-only` record, `sync.accountChangedAt`: the latest change time it knows the Account to hold. A pull raises it to the latest change time of each page, in the page's write; an accepted push raises it to the latest change time it sent.
- Every change the tracked user state writes gets the clock's time, or 1 ms after that record when the clock is not past it. What Sync writes again in the write of a page (a higher Best result, a trimmed History entry) counts the page's time.
- A change the reader makes after a pull is so later than every record that pull brought, the one it changes included, and later than what the device pushed itself. The record is never forgotten: it only moves change times forward, and the Account cuts every change time to its own, so it never passes the server's time.
- The backend and the contract stay as they are: the later change time still wins, a tie still keeps the kept record, and a change that loses is still ignored without an error.

## Consequences

- A device whose clock is behind keeps its reader's last change once it has synced: the change times it writes follow the Account's, not its own clock, until the clock passes them.
- A change made offline before the pull keeps its own clock time, so it still loses to a later change of another device (ADR 0041).
- One time for every key, not one per key: it is one record and one read per write, and the times it gives are never earlier than a time per key would give.

## Considered Options

- **A change time per key, after the record of that key pulled**: rejected. A record per synced key on the device, for no better order.
- **The push answering which changes the Account kept, and the device pulling those again**: rejected. A contract change and a second round trip, for what the device can know itself.
- **The server's arrival time wins**: rejected by ADR 0041. A device offline for days would win with its old changes.
