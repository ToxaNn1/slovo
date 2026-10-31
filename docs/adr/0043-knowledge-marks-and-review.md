# Knowledge Marks and Review

Until 0.8.6 SLOVO could not tell whether the reader knew an Entry: an unknown Entry came back only in the next Cycle, weeks later, and the Game forgot every mistake. Spec #461 adds Knowledge Marks and Review (extended to 30 and 90 days by spec #1358), which change which Entries the Feed picks next (ADR 0015, 0016) and which the Game asks about (ADR 0024).

**The interval rule.** A Knowledge Mark is Known or Unknown. Unknown starts a Review at 1 day, or again at 1 day from any step. Known moves a Review one step, 1 to 3 to 7 to 30 to 90 days, due or not; Known on the 90-day step makes it Learned (spec #1358, 1.0; before 1.0 the last step was 7 days). An Entry on the old 7-day step moves on to 30 days at the update and does not become Learned. Known on an Entry with no earlier mark is unchanged and gives no XP (ADR 0066). Days are local calendar days, so an Entry marked late at night is due the next morning. A Learned Entry no longer comes back for Review but stays in the Cycle. Game answers never move an interval, except that a wrong answer in any Game Mode marks the Entry Unknown.

**Tapping a mark.** Tapping the other mark changes it by the rule, applied to the record as it stands. Tapping the shown mark again removes it. A card shows no mark while its Entry is due, so on a due Entry either mark is an answer: Unknown on a due Unknown Entry starts it again at 1 day rather than removing it.

**One record per Entry.** The knowledge module, `openKnowledge` in the composition, keeps `knowledge.<entry id>`: `{ mark, step, reviewDay, learned }`, the step 1, 3, 7, 30, 90 or `null` and the Review day a local `YYYY-MM-DD` or `null` once Learned, plus, from 0.8.13, an optional mark time, the instant the mark was set, which the Weekly Recap counts (ADR 0054); a record without one counts in no week. It syncs last-write-wins by the client's change time (ADR 0041); removing a mark deletes the record as a tombstone. The rule is pure functions over a record, an answer and today's local day, from the injected clock. The module's `state`, a snapshot with `subscribe` that follows the day change (ADR 0022), gives what each Entry's card shows (its mark, or a Review while due), the Entries due today, the «Вчу» list and the counts. It leaves Hidden Entries out of the due Entries and the list until restored; the Mix and the Rarity Floor don't apply there, and the Feed and the Game skip what isn't eligible through the Entries module (ADR 0015).

**The Feed puts due Entries on top of the Cycle order.** An Entry is due on or after its Review day until the reader marks it, so swiping past loses nothing. A Review overrides Seen; showing it writes Seen and History as any card does. The Cycle, its order and the Seen rule don't change.

- **Word Review slots.** Every 3rd card of the session, counting every card shown so far (the Word of the Day and a card a hide took out included), is a Review slot, unless it is a Correction slot (every 5th card of the Cycle), which keeps its card: with Corrections the Reviews fall on cards 3, 6, 9, 12, 18 and so on.
- **Correction slots.** A due Correction takes the Correction slot before a new one, also once the Cycle has no unseen Correction. A due Word never takes a Correction slot.
- **Which due Entry.** Of the due Entries of the slot's kind the Cycle covers, the slot takes the one not shown in this session yet, else the one shown longest ago, in Cycle order, never the Entry of the card before it, so a swiped-past Entry comes back at a later slot.
- **«Повторення».** A card is labelled a Review when its Entry is due as it is shown: at a slot, at its own turn in the Cycle, as the Word of the Day, as a linked Correction, or on an Entry screen opened from «Вчу», the Game Review, Favorites, a notification or the widget. It keeps the label once answered.

**The Game takes up to 5 Rounds of a Game from Entries the reader is weak on**, eligible and Unknown or due, in every Game Mode, and the rest from ADR 0024's pool, with its fallback (ADR 0052). The Daily Crossword is not a Game: it marks nothing and moves no Review. The Round answers are kept until the result screen for the Game Review, never stored.

**The «Вчу» list** holds every Entry with a Review day (marked Unknown and not yet Learned, including one since answered Known on a Review), sorted by that day, each row with its local days until the Review, so a due Entry leads. An id the Language Pack no longer has is left out, as in Favorites.

**The counts.** Progress gets one Known count per kind of Entry (`known`, keyed by kind, Learned and not yet Learned alike) and the Entries due today. Badges and the Profile count **confirmed Entries** only: an Entry Known on a Review of 7 days or later, or answered right in a Game or a Quick Question (ADR 0066). The stats sheet joins the counts it shows with the Edition's joiner.

**Switch.** The Feature Switch `knowledge` guards marks, Review, the Game's share, the «Вчу» list and the counts. With it off, `tap` and `answer` write nothing, nothing is due or labelled, the list is empty, the counts are 0, and the records are kept (ADR 0040).

Full spaced repetition beyond 1, 3, 7, 30 and 90 days, and a global reset of marks, are not part of this decision.

## Considered Options

- **Review replaces the Seen rule, or due Entries wait for the next Cycle**: rejected. A Word is forgotten in days, not weeks.
- **A separate Review screen or Game Mode**: rejected. Due Entries read as part of the Feed, not homework.
- **Game answers move intervals**: rejected. A lucky guess among four options says little; only a mistake is a clear signal.
- **A list of hard Words apart from the marks, or all marks in one record**: rejected. One record per Entry says it once and merges per key (ADR 0013).
- **The same mark always removes, due or not**: rejected. «Не знаю» on a due Unknown Entry would delete it, and it would never come back.
- **A changed mark undoes the earlier one**: rejected. The record would have to keep its previous state.
- **Count Word cards only for the slots**: rejected. "Every 3rd card" reads as card numbers.
- **A due Entry comes back once per session**: rejected. It stays due until answered.
- **A due Correction takes any Review slot, or waits for an unseen Correction's turn**: rejected. The reader expects a Correction every 5th card, and a due one would wait weeks once the Cycle's Corrections are Seen.
- **«Вчу» holds only Entries marked Unknown now**: rejected. An Entry Known on its 1-day Review is still being learned.
- **Label only the Review slots' cards**: rejected. A due Entry at its own turn shows no mark either, and the reader couldn't tell why.
