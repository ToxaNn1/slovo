---
summary: The XP log's days more than 30 days past fold into XP days, one record per day that keeps every record by its id; a push sends deletions first; a tombstone does not count toward the 20 000 records of Sync, and the backend keeps the latest 20 000 tombstones (amends 0041, 0066).
---

# The XP log folds into XP days, and a tombstone is no record of the Sync limit

Decision of 2026-11-21, the owner's call: the 20 000 records an Account keeps in an Edition must last for decades.

**Why.** The XP log is append-only (ADR 0066) and every record of it is one record of Sync (ADR 0041). A reader who uses the app daily writes tens of records a day, so the log alone reached the limit of 20 000 in a couple of years, and from then on every push of that Account was refused (`TOO_MANY_RECORDS`). Deleting records did not help: a tombstone counted like a record.

## Decision

**The fold.** At launch the Core folds each local date of the XP log that is more than 30 days before today into an **XP day**: one record `xpDay.<date>-<n>-<hash>`, where `n` is how many records it holds and `hash` is a hash of their ids. The folded `xp.` records are deleted in the same write. The last 30 days stay as single records, so what a late device adds to a recent day is still one small record. One launch folds at most 2000 records, whole days at a time; a fold that fails is the next launch's.

**An XP day keeps every record by its id, not a sum.** Each row is the record without its date, with its instant as milliseconds from the day's start. That is what keeps the rules of ADR 0066 true after the fold:

- XP days sync as a `union`, like the XP log, and are never changed. A record counts once by its id however many XP days and single records hold it, so two devices that fold different sets of records of one day, or a device that still holds the single records, never double the XP.
- Two devices that fold the same records make the same key, so the same XP day.
- Everything derived from the log (total XP, the Streak, freezes, the Break, the Badges, the reset marker) reads the same records as before; nothing is derived from a stored sum. A sum per day would lose the sources and instants the Badges read and could not be merged without doubling.
- A day too large for one record of Sync (8 KB) takes several XP days.

The Data export reads the log through the XP days, so it lists every record as before.

**The push sends deletions first**, so a batch that adds records comes after the one that frees their room. The deletion of a record a pending XP day holds is the exception: it goes in the push of that XP day, or right after it, never before, so a push that fails midway leaves the Account every record, as a record or in its XP day.

**A tombstone does not count toward the limit.** The 20 000 are records with a value. A deletion that is kept frees the room of its record, also for the other changes of the same push; a deletion that loses to a later change, or of a key that holds no record, frees nothing; a value in place of a tombstone adds a record. The count stays in the push's transaction, after the row lock.

**The backend keeps the latest 20 000 tombstones** of an Account in an Edition, by sequence, and deletes the older ones for good in the push that brings a tombstone. Without a bound, uncounted tombstones would let one Account fill the database, which is what the limit is for. A deletion so reaches every device that syncs before 20 000 more deletions follow it.

_Note (audit of 2026-11-21):_ that is about a year of daily use, not years. Every folded record of the XP log leaves a tombstone, and an active reader writes 30 to 100 such records a day, so 20 000 tombstones pass in 7 to 22 months.

A device that stays away longer misses the oldest deletions: it keeps those records itself, and an earlier pending change of such a key could bring the record back. For the XP log this costs nothing: its tombstones are ignored by the `union` mark anyway, and a device deletes its own single records once it holds the XP day.

**What it gives.** A day of the past costs the Account one XP day and one Active Day, about 730 records a year, beside History (at most 500) and what the reader saves and marks: the limit lasts over two decades of daily use.

## Amends

- **ADR 0041**: "tombstones are kept for good" becomes the latest 20 000 per Account and Edition; the limit of 20 000 counts no tombstone; the push sends deletions first. The backend still reads no key and no value: both rules look only at whether the value is null.
- **ADR 0066**: the XP log stays append-only in what it means, but its records older than 30 days are kept inside XP days.

## Considered

- **The backend deletes the row on a tombstone of an `xp.` key**: rejected. The backend would read a key's meaning (ADR 0041), and each later kind of record that wants the same would be a backend change.
- **Tombstones uncounted and unbounded**: rejected. A broken or hostile device could write and delete records without end.
- **Refusing a push at a limit of tombstones**: rejected. It only moves the refusal a few years on.
- **A sum of XP per day**: rejected, as above: no union-safe merge, and the Badges, the Streak and the reset marker need the records.
- **Raising the limit**: rejected. It buys a few years and the database grows with it.
