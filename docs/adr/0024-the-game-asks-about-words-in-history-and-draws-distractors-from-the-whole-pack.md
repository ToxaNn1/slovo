# The Game asks about Words in History and draws Distractors from the whole pack

From 0.5 the Core has a Game: 15 Rounds in one Game Mode, 5 Lives. The master spec says the Game asks about "Seen Entries", but Seen is reset by every new Cycle (glossary), so a reader who finished a Cycle would drop back to the whole Language Pack the next day.

A Game Mode's answer pool is the eligible Entries of its kind that are in History, when there are at least 15 of them; otherwise it is every eligible Entry of that kind. History survives Cycles and holds the 500 most recent Seen Entries, which is what "the Words I've met" means to the reader, and a new reader can play at once on the whole pack. The 15 answers of a Game are 15 different Entries of the pool. Distractors come from every eligible Entry of the kind, not only from History, so four options always exist. A mode can't start with fewer than 15 eligible Entries of its kind, and says so on its card. Eligibility is the Entries module's (ADR 0015): Hidden Entries, Hidden Categories and Retired Entries never appear as answers or Distractors. Playing writes no Seen, no History and no Active Day.

«Вгадай слово» picks Distractors by the Edition's Distractor rule; for `same-part-of-speech`, Words of the answer's part of speech first, then other eligible Words when there are fewer than three. No two options share a Lemma, so homonyms never meet in one Round. The Correction mode's Distractors are the main standard equivalents of other eligible Corrections, of the same Correction Type first, and never one of the asked Correction's own equivalents; Corrections carry no authored distractors.

The Game is a module of the Core composition (ADR 0018) with an immutable snapshot: the modes on offer, and the Game in play with its Round, Rounds passed, Lives and state. It lives in memory for the app session, not in the user state, so closing the app drops an unfinished Game. A Game builds all 15 Rounds when it starts, reading the eligible Words in one query per table (the content port's `listWords`) instead of nine queries for each of 500 Words. A hide, a restore or a Mix change during a Game builds the Rounds still to come again, so an Entry hidden meanwhile never comes up; the Rounds already shown stay. Game Modes are values registered through a code-level Extension Point (ADR 0006): the Core's own modes and an Edition's go through the same one. An Edition's own mode would also bring its card's strings; that waits until an Edition adds one.

The best result is the most Rounds passed in one finished Game, in any mode. Finished Games aren't kept, so it can't be derived the way the Best Streak is: it is its own user-state record, written only when a finished Game beats it, with a `highest` sync mark so that sync keeps the higher of two devices' results.

## Considered Options

- **Seen Entries, as the master spec says**: rejected. The pool would collapse to the whole pack after every Cycle.
- **Distractors from History too**: rejected. A reader with 15 Words in History would get the same few Distractors in every Round, and a narrow History of one part of speech couldn't fill four options.
- **Authored Distractors for each Correction**: rejected for now. Other Corrections' equivalents need no new content field; if they read badly in practice, an authored field is the next step.
- **Keep the Game in the user state**: rejected. A Game takes a few minutes, and an abandoned Game must never count, so a restart that drops it is simpler than migrating a half-played Game.
- **Build each Round when it comes, reading Words one by one**: rejected. The Distractor rule needs every eligible Word's part of speech, so each Round would read the whole pack word by word.

## Amendment: each Game Mode reaches its card in one shape (after 0.5)

0.5 spelled a Game Mode out in the shell: a table keyed by the two Core mode ids stated each mode's Entry kind a second time, picked its strings and turned a refusal into a text, and a mode missing from it got no card, without a word. A mode registered through the Extension Point was on offer in the Core but never showed.

A mode's Entry kind is stated once, on the mode. Its offer carries what a card needs from the Core: the mode id, the Entry kind and, when it can't start, the refusal. The Game strings hold `game.modes`, one entry per mode id, alike for every mode: the card's words, the label over its Rounds' prompt and a text per refusal. Every mode has a text for too few eligible Entries; only a mode that asks about Corrections needs one for Corrections out of the Mix. The shell draws any offer as a card and names no mode. The modes on offer stay the same for the app session, so the app checks their strings once the composition opens: a mode without them fails the launch, and one without a text for the reason it can't start throws when its card is drawn. A mode never loses its card unseen.

This settles where an Edition's own mode would bring its strings: under its id in `game.modes` of the Edition's `strings.json`, in the same shape as the Core's modes, checked by the same schema. The mode itself still waits until an Edition adds one.

### Considered Options

- **Keep the shell's table of modes**: rejected. The shell decided which modes exist, so every new mode, the Core's or an Edition's, paid in the shell again, and a mode it didn't know vanished.
- **Each mode value carries its own strings**: rejected. The Core holds no texts in any language; an Edition's texts live in its strings file, where the schema checks them with the rest.
- **A text for every refusal in every mode**: rejected. «Вгадай слово» would need a text for Corrections out of the Mix, which it can never show.
