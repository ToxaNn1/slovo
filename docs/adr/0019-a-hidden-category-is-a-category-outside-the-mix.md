# A Hidden Category is a Category outside the Mix

The Mix and Hidden Categories are one state: a Category is hidden exactly when it is out of the user's Mix. The reader can take it out in three places: the Mix screen, the hide action on a card ("don't show this Category"), and the Hidden screen, where turning it back on puts it back in the Mix.

**Two lists of Categories, the same rules.** Words and Corrections each have the Edition's own list of Categories (ADR 0050), and the Mix holds each list in or out one by one. The Core names each list once, by the kind of Entry it belongs to (`word`, `correction`), with its user-state records and the Edition's default for it; the Mix answers for a list by kind, the Words' being its own fields and the Corrections' sitting under them. The two lists may share an id, so each has records of its own: `mix.categories.<id>` for a Category of Words, `mix.correctionCategories.<id>` for a Category of Corrections. The Categories of Corrections sit under Corrections as a whole: a Correction is an Eligible Entry only while Corrections are in and its Category is in; the Hidden screen lists a Hidden Category of either list. The Edition's default Mix names each list's Categories apart (`categories`, `correctionCategories`), each every Category of the Language Pack or the listed ids.

Each Category's place in the Mix is its own user-state record, in or out, over the Edition's default Mix. A Category the user never touched follows the Edition's default, so a Category added by a content update arrives in the Mix when the default is "all". Sync resolves each Category on its own (ADR 0013, 0041).

At least one Category of each list always stays in the Mix, so there is always a Word for the Word of the Day and the Feed never runs empty because of the Mix. A list the records leave empty, as a merge of two devices can, reads as the Edition's default, and nothing is written for it (ADR 0013). «Turn all on» puts every Category of both lists back and leaves the kinds as a whole as they are.

**Other kinds of Entry are in or out as a whole.** Corrections and Idioms (ADR 0046) are each in or out of the Mix by kind, and the card's hide action can take its kind out. The Core names each such kind once, with the Feature Switch that turns it on (which also names the kind in the Edition strings, `corrections`, `idioms`) and its user-state record, `mix.corrections` or `mix.idioms`. The Mix answers by kind whether the kind is in and takes it in or out; the Entries refuse a kind out of the Mix with one refusal naming the kind; the hide action, the Hidden screen, the Mix screen and the hide choice ask the Mix about a kind, not a field of their own. A further kind as a whole is one more line there.

## Considered Options

- **Two states, the Mix for "what I want now" and Hidden Categories for "never"**: rejected. A Category could be on in the Mix and still never appear, and ADR 0015 already makes both apply to everything new, the Game included.
- **No Hidden Categories, only the Mix**: rejected. The master spec asks to hide a Category from where the reader meets it, and the Hidden screen lists Categories next to Entries.
- **One record holding the whole Mix**: rejected. Two devices changing different Categories would overwrite each other under last-write-wins sync.
- **The Categories of Corrections in the Words' records, `mix.categories.<id>`**: rejected. The two lists may share an id, and one record could not hold two places.
- **No last-Category rule for the Categories of Corrections, since Corrections as a whole can be out**: rejected by the ticket (#698). The reader meets one rule for every Category, and a list with none in would read as the default anyway.
- **An empty Mix with its own empty Feed**: rejected. It would need an empty state, a day without a Word of the Day and tests for both, for a choice nobody needs.
