# A Hidden Category is a Category outside the Mix

The Mix and Hidden Categories are one state. A Category is hidden exactly when it is out of the user's Mix. The reader can take it out in three places: the Mix screen, the hide action on a Word card ("don't show this Category"), and the Hidden screen, where turning it back on puts it back in the Mix. Corrections as a whole are in or out of the Mix the same way, and a Correction card's hide action can take them out.

Each Category's place in the Mix is its own user-state record, in or out, over the Edition's default Mix, and Corrections have one more such record. A Category the user never touched follows the Edition's default, so a Category added by a content update arrives in the Mix when the default is "all". Sync can resolve each Category on its own (ADR 0005, 0013).

At least one Category always stays in the Mix. The last one can't be taken out, so there is always a Word for the Word of the Day, and the Feed never runs empty because of the Mix.

## Considered Options

- **Two states, the Mix for "what I want now" and Hidden Categories for "never"**: rejected. A Category could be on in the Mix and still never appear, and ADR 0015 already makes both apply to everything new, the Game included.
- **No Hidden Categories, only the Mix**: rejected. The master spec asks to hide a Category from where the reader meets it, and the Hidden screen lists Categories next to Entries.
- **One record holding the whole Mix**: rejected. Two devices changing different Categories would overwrite each other under last-write-wins sync.
- **An empty Mix with its own empty Feed**: rejected. It would need an empty state, a day without a Word of the Day and tests for both, for a choice nobody needs.
