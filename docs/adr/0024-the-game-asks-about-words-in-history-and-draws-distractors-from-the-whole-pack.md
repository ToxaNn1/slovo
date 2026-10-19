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

## Amendment: a mode can start when it can make 15 fair Rounds (after 0.5)

0.5 had two rules for whether a Game Mode can start. Its offer counted the eligible Entries of its kind, while a start asked the mode for 15 fair Rounds, and a mode may make no fair Round of some Entries, such as a Word without three other Lemmas to stand beside it. A mode with 15 eligible Entries and fewer fair Rounds read "can start" on its card, refused the tap, and read "can start" again after the next hide, restore or Mix change. The Game also decided itself that a mode asking about Corrections can't start while they are out of the Mix.

One Round planning now decides it: the pool, History, the fair Rounds and, when they fall short, the refusal. The offer and the start come from it, so a mode that can't make 15 fair Rounds says why on its card before any tap, and a start reads the eligible Entries once. The planning runs for each mode on offer once the composition is open and again after every hide, restore and Mix change. Why an Entry kind, as a whole, is not eligible, such as Corrections out of the Mix, is the Entries module's to say (ADR 0015): it answers the eligible Entries of a kind or that reason, and the Game passes the reason on as the refusal.

Planning needs the eligible Entries themselves, not their ids. The Entries module reads the live Entries of the Language Pack once per app session, since a pack never changes while it is open, and filters them by the eligible ids on each call; each start of «Вгадай слово» used to read every Word anew. That one read takes about 0.4 s on a simulator, so the launch does not wait for it: the composition opens, and then the Game plans its offers in the background, in turn with its other changes. Until then each offer says it is still planned, and its card can't start yet and gives no reason. A start or a change of eligibility meanwhile waits its turn behind the planning; should the planning fail, the Game tries it again (see the next amendment). A hide, a restore or a Mix change then pays only the eligible ids and building 15 Rounds per mode.

### Considered Options

- **Keep counting eligible Entries, and keep the refusal a start finds**: rejected. The next eligibility change overwrites it, and a refusal kept apart from the offer is a second rule again.
- **Plan only on a tap**: rejected. That is the defect: the card promises a Game the start refuses.
- **Read the eligible Entries in full on every eligibility change**: rejected. Reading every Word of a 561-Word pack is most of the cost, and the pack does not change within a session.
- **Plan the offers before the composition opens**: rejected. The launch would wait about 0.4 s longer for a screen it doesn't show.
- **A lighter read of the Words for the Game**: rejected for now. The content port would need a second shape of a Word for one feature.

## Amendment: a failed planning of the offers is tried again (after 0.5)

The amendment above left the offers saying they are still planned when the background planning failed, until a hide, a restore or a Mix change planned them again. A failed read of the Language Pack left every Game card faded for the rest of the session, with no reason and no second try.

The Game decides the retry, not the shell. A planning that fails is tried again after 1 s, then 2 s, then 4 s, each try in turn with the Game's other changes, so a start or a change of eligibility during a try still waits its turn. When all four fail, the offers keep saying they are still planned, and the card stays faded with no reason, until the composition's next `resume`, which tries again in the same way, or a hide, a restore or a Mix change plans them. A try that finds the offers planned already does nothing, and a planning that succeeds the first time is never tried again. A `resume` comes on each return to the foreground and when a new local day starts while the app is open (ADR 0022). The delays come through an injected `Schedule` port, as the Game's haptics have theirs, so tests turn the clock by hand.

### Considered Options

- **Try again only on a return to the foreground**: rejected alone. The reader who opens the Game tab just after launch would see faded cards until leaving the app; a transient failure clears within a second or two.
- **Try again forever, or on a timer for the whole session**: rejected. A pack that keeps failing to read is a broken install; the Feed fails with it, and a timer that never stops costs battery for nothing.
- **Show a reason on the card once every try failed**: rejected for now. It needs a new refusal, its text in every Edition and a design for an error the reader can't fix; the next return to the foreground tries again anyway.

## Amendment: up to 5 Rounds come from Unknown or due Entries (0.8.6)

ADR 0043 draws up to 5 of a Game's 15 Rounds from eligible Entries that are Unknown or due for Review, the rest from the pool above. The fallback stays: with fewer than 15 eligible Entries in History the pool is every eligible Entry of the kind. A wrong answer marks the Entry Unknown; answers never move an interval, and the Game keeps its Round answers until the result screen without storing them.
