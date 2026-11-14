# A Progress reset is a marker in the XP log

Status: accepted (owner, 14.11)

## Context

Board 11 adds «Скинути прогрес» to Settings (spec #1861). ADR 0066 makes the XP log append-only and derives every progress value from it, and ADR 0041 merges records across devices as a set union by id. Deleting records would break both: another device would bring them back on the next Sync.

## Decision

- **A marker, not a delete.** A Progress reset is one more record in the XP log: a reset marker with a unique id, a local date and a time. The XP log stays append-only.
- **The fold starts after the latest marker.** Every derived value (total XP, Level, today's XP, Active Days, Streak, Best Streak, freezes held, Break eligibility, Badges earned and opened) folds only the records after the latest reset marker. Records at or before it stay stored and count for nothing.
- **The Daily Goal in force is carried over.** The reset writes the current `word-goal` again after the marker, so the reader keeps the goal they had.
- **Best results reset** with the progress: the Best result of each Game Mode counts only the Games finished after the marker.
- **Badges can be earned again.** A Badge's condition counts only what happens after the marker, also one that counts kept data (for example Known Entries).
- **Sync is unchanged.** Logs still merge as a set union by id; the marker merges like any record, and the fold gives the same result on every device whatever the arrival order.
- **Kept by a reset:** Favorites, Collections, History, Seen, Knowledge Marks and Reviews, Hidden Entries, the Mix, the Rarity Ceiling, settings, the reader's name (ADR 0136) and the Account.
- Behind its own Feature Switch, which needs the XP log. Off: no button.

## Consequences

- The Core's XP log module gains the marker kind and one fold boundary; the contracts and the server Core gain the record shape, and the backend stores it like any other record.
- Amends ADR 0066 (what the fold counts) and touches ADR 0041 (a marker is an ordinary record).

## Considered Options

- **Delete the records**: rejected. Sync would bring them back from another device, and the log would stop being append-only.
- **A reset per value** (XP only, Streak only): rejected. One marker for all progress is simpler and is what the board draws.
