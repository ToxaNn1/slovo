# Knowledge Marks and Review

Until 0.8.6 SLOVO could not tell whether the reader already knew an Entry or met it for the first time. An Entry the reader didn't know came back only in the next Cycle, weeks later, and the Game forgot every mistake. Spec #461 adds Knowledge Marks and Review, and three earlier decisions change with it: which Entries the Feed picks next (ADR 0015, 0016) and which Entries the Game asks about (ADR 0024).

**The interval rule.** A Knowledge Mark is Known or Unknown. Unknown starts a Review at 1 day, or starts it again at 1 day from any step. Known on a Review moves it from 1 to 3 days, then to 7 days; Known on the 7-day Review makes the Entry Learned. Known on an Entry with no earlier mark makes it Learned at once. Days are local calendar days: the next Review day is the mark's local day plus the step, so an Entry marked late at night is due the morning after. A Learned Entry no longer comes back for Review but stays in the Cycle. Tapping the other mark changes it, tapping the same one again removes it. Answers in the Game never move an interval, except that a wrong answer marks the Entry Unknown (below), so a lucky guess never counts as knowing.

**One record per Entry.** The Core's knowledge module holds the rule as pure functions: a Knowledge Mark record and an answer with today's local day give the next record, plus "is due on a day", "is Learned" and the counts. A record holds the mark, the Review step (none, 1, 3 or 7 days), the next Review day and whether the Entry is Learned. It lives in the user state under a new key per Entry and syncs last-write-wins by the client's change time (ADR 0041). The key is new, so no migration and no backend change are needed. Removing a mark deletes the record, which syncs as a tombstone.

**The Feed puts due Entries on top of the Cycle order.** An Entry is due on or after its Review day and stays due until the reader marks it, so swiping past it loses nothing. While Words are due, every 3rd Word slot of the Feed shows a due Word, labelled «Повторення». A Correction due for Review takes the next Correction slot before a new Correction. A due Entry that is Hidden or not eligible (Mix, Rarity Floor) is skipped until it is eligible again, and eligibility stays the Entries module's call (ADR 0015). A Review overrides Seen: a due Entry comes back even if it is Seen in the current Cycle, and showing it again writes Seen and History as any card does. The Seen rule, the Cycle and its order don't change, and Known and Learned Entries stay in the Cycle as before. The Feed's rule for the next card (ADR 0016) gains the Review slots and nothing else; the shell still only tells the Feed which card is on screen.

**The Game takes up to 5 of its 15 Rounds from Entries the reader is weak on.** The Round plan draws up to 5 Rounds from eligible Entries that are Unknown or due, and the rest as before, from the pool of ADR 0024. When fewer than 5 qualify, the others are drawn as before. ADR 0024's fallback stays: with fewer than 15 eligible Entries in History the pool is every eligible Entry of the kind, also under a Rarity Floor. A wrong answer in any Game Mode, Words and Corrections alike, marks the Entry Unknown. The Game keeps its Round answers until the result screen so the Game Review can show them; they are never stored.

**Switch.** The Feature Switch `knowledge` guards marks, Review, the Game's share, the «Вчу» list and the counts. With it off nothing is marked or brought back, and existing records are kept (ADR 0040).

## Considered Options

- **A Review replaces the Seen rule, or Review Entries wait for the next Cycle**: rejected. The reader forgets a Word in days, not in the weeks a Cycle lasts, and Seen decides what is new, not what is due.
- **A separate Review screen or Game Mode**: rejected. Due Entries read as part of the Feed, not as homework, and one Round plan serves every Game Mode.
- **Game answers move intervals as marks do**: rejected. A lucky guess among four options says little about knowing; only a mistake is a clear signal, and it marks the Entry Unknown.
- **A separate list of hard Words kept apart from the marks**: rejected. A mistake is an Unknown mark, so one record per Entry says it once and syncs once.
- **All Marks in one synced record**: rejected for the one-blob reason of ADR 0013; per-Entry records merge per key.

## Consequences

- The Feed's choice of the next Entry depends on the marks and on today's local day, which comes from the existing day-change logic with injected time, so tests turn the clock by hand.
- The Game's plan reads the marks, so a Game depends on the knowledge module as it does on the Entries module.
- Full spaced repetition beyond 1, 3 and 7 days, and a global reset of marks, are not part of this decision.

## Amendment: a tap on a due Entry is its answer (0.8.6, #465)

The Core's knowledge module, `openKnowledge` in the composition, keeps one record per Entry under `knowledge.<entry id>`: `{ mark, step, reviewDay, learned }`, the step 1, 3, 7 or `null` and the Review day a local date `YYYY-MM-DD` or `null` once the Entry is Learned. Today is the clock's local day at each call. Two rules complete "tapping the same one again removes it":

- **A card shows no mark while its Entry is due.** A Review asks for a new answer, so on a due Entry either mark is an answer by the interval rule: Unknown on a due Unknown Entry starts it again at 1 day, it doesn't remove the mark. Once answered, the Entry is no longer due and the card shows the new mark, which a second tap removes.
- **Known moves any Review one step, due or not.** Changing a mark the same day applies the rule to the record as it stands: Unknown then Known moves the 1-day Review to 3 days, and Known corrected to Unknown starts it again at 1 day.

The Game's mistake answers Unknown by the rule alone (`answer`), never removing a mark. With the `knowledge` Feature Switch off, `tap` and `answer` write nothing and the records stay.

### Considered Options

- **The same mark always removes, due or not**: rejected. Tapping «Не знаю» on a Review of an Unknown Entry would delete its record, and the Entry the reader still doesn't know would never come back.
- **A changed mark undoes the earlier one**: rejected. The record would have to keep the one before it, and the spec's record holds the mark, the step, the day and Learned only.

## Amendment: which card is a Review slot (0.8.6, #468)

A Review slot is every 3rd card of the Feed's session, counting every card shown so far, the Word of the Day included and a card a hide took out since, so a hide never moves the slots, unless that card is a Correction's turn: the Correction slot (every 5th card of the Cycle) keeps its card, so with Corrections the Reviews fall on cards 3, 6, 9, 12, 18 and so on. Of the due Words the Cycle covers, the slot takes the one not shown in this session yet, else the one shown longest ago, in the Cycle order, never the Entry of the card before it. A due Word the reader swipes past without answering so comes back at a later slot, and two or more due Words take the slots in turn. The knowledge module gives the Feed the Entries due today, none with the `knowledge` Feature Switch off; the Cycle's order decides which of them are eligible.

### Considered Options

- **Count Word cards only, so a Correction moves the Reviews by one**: rejected. "Every 3rd card" reads as card numbers, and counting cards keeps the slots where the reader expects them.
- **A due Word comes back only once per session**: rejected. A due Word stays due until answered, so the reader who swipes past it meets it again.

## Amendment: a due Correction takes the Correction slot (0.8.6, #470)

A Correction due for Review takes the Correction slot, every 5th card of the Cycle, before a new Correction, Seen in this Cycle or not, and also once the Cycle has no unseen Correction left. Of the due Corrections the Cycle covers, the slot takes the one not shown in this session yet, else the one shown longest ago, in the Cycle order, never the Entry of the card before it: a due Correction the reader swipes past comes back at a later slot, and two or more due Corrections take the slots in turn. A due Word never takes a Correction slot, and the Word Review slots stay where #468 put them. With Corrections out of the Mix no Correction is due for the Feed.

### Considered Options

- **A due Correction takes the next Review slot of any kind**: rejected. A Correction every 5th card is what the reader expects, and the Word slots stay the Words'.
- **A due Correction waits for an unseen Correction's turn**: rejected. Once every Correction of the Cycle is Seen, a due one would wait weeks for the next Cycle.

## Amendment: which Entries the «Вчу» list holds (0.8.6, #475)

The knowledge module's `learning` lists every Entry with a Review day, that is every Entry marked Unknown and not yet Learned, with its next Review day and its row, sorted by that day. Since architecture review 3 it is part of the module's `state`, a snapshot with `subscribe` like Favorites, each row with its local days until the Review, and it follows the day change (ADR 0022), so after midnight «через 1 день» becomes «сьогодні». An Entry answered Known on a Review since stays in it until it is Learned, so the list shows «через 3 дні» too. An Entry already due keeps its past Review day and leads the list. A removed mark is gone with its record, an id the Language Pack no longer has is left out as in Favorites, and with the `knowledge` Feature Switch off the list is empty.

### Considered Options

- **Only Entries whose current mark is Unknown**: rejected. An Entry Known on its 1-day Review is still being learned until its 7-day Review, and the spec's list shows a 3-day Review day.

## Amendment: which card is labelled «Повторення» (0.8.6, #469)

The Feed tells a card it is a Review (`review` on the card) when the card's Entry is due for Review as the Feed adds it: at a Review slot or a Correction slot, and also when a due Entry comes at its own turn in the Cycle, as the Word of the Day, as a linked Correction or as the card the Feed opens on. Such a card shows no mark (amendment of #465), so the label says why. The card keeps its label once answered; the next card of the Entry, no longer due, has none. With the `knowledge` Feature Switch off nothing is due, so no card is labelled. Since architecture review 3 the rule holds wherever an Entry's card is shown: an Entry screen opened from «Вчу», the Game Review, Favorites, a notification or the widget labels a due Entry's card «Повторення» as the Feed does, since its card shows no mark there either. The knowledge module's `state` gives the one answer both use, what each Entry's card shows: its mark, or a Review while it is due.

### Considered Options

- **Only the cards of the Review slots**: rejected. A due Entry at its own turn shows no mark and takes a Review answer all the same, and without the label the reader can't tell why.

## Amendment: what the knowledge counts count (0.8.6, #477)

The knowledge module gives Progress three numbers (since architecture review 3 in its `state`: the two Known counts and the Entries due today): the Words and the Corrections whose mark is Known, a Learned Entry among them and an Entry Known on a Review that is not Learned yet, and the Entries due today, the same ones `due` gives the Feed. A removed mark is gone with its record and counts no more; an id the Language Pack no longer has is no Word and no Correction. The module reads each marked Entry's kind once, when it opens or when the Entry is first marked, so Progress follows the counts at once, as it follows Favorites, and a new local day changes the due count with the Streak. With the `knowledge` Feature Switch off all three are 0.

## Amendment: the statistics leave Hidden Entries out of today's Review (0.8.6, #478)

The count of Entries due today leaves out a Hidden Entry, which the reader removed and the Feed never brings back, and counts it again once restored. The Mix and the Rarity Floor don't apply to it, since the Game and the «Вчу» list still reach those Entries. The Known counts stay as #477 put them.

Since architecture review 3 the knowledge module leaves a Hidden Entry out of its due Entries and the «Вчу» list itself, asking the Hidden Entries, so the count, the list, the Feed and the Game's weak Entries see one due, and the Entry comes back to each once restored. The Mix and the Rarity Floor still don't apply to the list or the count; the Feed and the Game skip what is not eligible through the Entries module (ADR 0015).
