# A Hidden Category is a Category outside the Mix

The Mix and Hidden Categories are one state: a Category is hidden exactly when it is out of the user's Mix. The reader can take it out in three places: the Mix screen, the hide action on a Word card ("don't show this Category"), and the Hidden screen, where turning it back on puts it back in the Mix.

Each Category's place in the Mix is its own user-state record, in or out, over the Edition's default Mix. A Category the user never touched follows the Edition's default, so a Category added by a content update arrives in the Mix when the default is "all". Sync resolves each Category on its own (ADR 0013, 0041).

At least one Category always stays in the Mix, so there is always a Word for the Word of the Day and the Feed never runs empty because of the Mix.

**Other kinds of Entry are in or out as a whole.** Corrections and Idioms (ADR 0046) are each in or out of the Mix by kind, and the card's hide action can take its kind out. The Core names each such kind once, with the Feature Switch that turns it on (which also names the kind in the Edition strings, `corrections`, `idioms`) and its user-state record, `mix.corrections` or `mix.idioms`. The Mix answers by kind whether the kind is in and takes it in or out; the Entries refuse a kind out of the Mix with one refusal naming the kind; the hide action, the Hidden screen, the Mix screen and the hide choice ask the Mix about a kind, not a field of their own. A further kind as a whole is one more line there.

## Considered Options

- **Two states, the Mix for "what I want now" and Hidden Categories for "never"**: rejected. A Category could be on in the Mix and still never appear, and ADR 0015 already makes both apply to everything new, the Game included.
- **No Hidden Categories, only the Mix**: rejected. The master spec asks to hide a Category from where the reader meets it, and the Hidden screen lists Categories next to Entries.
- **One record holding the whole Mix**: rejected. Two devices changing different Categories would overwrite each other under last-write-wins sync.
- **An empty Mix with its own empty Feed**: rejected. It would need an empty state, a day without a Word of the Day and tests for both, for a choice nobody needs.
