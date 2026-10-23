# A Hidden Category is a Category outside the Mix

The Mix and Hidden Categories are one state. A Category is hidden exactly when it is out of the user's Mix. The reader can take it out in three places: the Mix screen, the hide action on a Word card ("don't show this Category"), and the Hidden screen, where turning it back on puts it back in the Mix. Corrections as a whole are in or out of the Mix the same way, and a Correction card's hide action can take them out.

Each Category's place in the Mix is its own user-state record, in or out, over the Edition's default Mix, and Corrections have one more such record. A Category the user never touched follows the Edition's default, so a Category added by a content update arrives in the Mix when the default is "all". Sync can resolve each Category on its own (ADR 0005, 0013).

At least one Category always stays in the Mix. The last one can't be taken out, so there is always a Word for the Word of the Day, and the Feed never runs empty because of the Mix.

## Considered Options

- **Two states, the Mix for "what I want now" and Hidden Categories for "never"**: rejected. A Category could be on in the Mix and still never appear, and ADR 0015 already makes both apply to everything new, the Game included.
- **No Hidden Categories, only the Mix**: rejected. The master spec asks to hide a Category from where the reader meets it, and the Hidden screen lists Categories next to Entries.
- **One record holding the whole Mix**: rejected. Two devices changing different Categories would overwrite each other under last-write-wins sync.
- **An empty Mix with its own empty Feed**: rejected. It would need an empty state, a day without a Word of the Day and tests for both, for a choice nobody needs.

## Amendment (2026-10-23): the Mix answers a kind of Entry as a whole by kind

Corrections as a whole and Idioms as a whole (ADR 0046) are one concept in the Core, not a pair of copies: the Mix answers by kind of Entry whether the kind is in the Mix and takes a kind into or out of it, the Entries refuse a kind out of the Mix with one refusal that names the kind, and the hide action, the Hidden screen, the Mix screen and the hide choice ask the Mix about a kind instead of a field of their own. The Core names each such kind once, with the Feature Switch that turns it on, which also names the kind as a whole in the Edition strings (`corrections`, `idioms`), and its user-state record. A further kind as a whole is one more line there.

Storage does not change: `mix.corrections` and `mix.idioms` stay their own records, kept and synced as before (ADR 0013, 0041), so no migration and no Sync change follow. The Feature Switches, the Edition strings and what the reader sees stay the same.
