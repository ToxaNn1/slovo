# Categories have screens of their own and a tone

Spec #1604 ports board 05.1 (05.11). Until now a Category was only a filter of the Mix: the reader met it as a chip on a card, on the Mix screen and on the Hidden screen, never as a place to look at its Entries. This amends ADR 0019, ADR 0033 and ADR 0076.

**Decision.** The Categories of Words and the Categories of Corrections each get a grid screen: the Words' (k1, three columns) opens from the header of the Dashboard's «Категорії» rail, the Corrections' (k2, two columns) from the header of the «Виправлення» rail. A tile opens the Category screen with that Category's live Entries in pack order, Retired ones left out; nothing becomes Seen there, as in Search. Its right button takes the Category out of the Mix («У МІКСІ» → «ДОДАТИ») or puts it back, with a toast for each; the rule that one Category of each list stays in the Mix holds there too. The hero reads «ЗНАЮ x З n» from the Known Knowledge Marks.

**A tone and a description (amends ADR 0033).** Every Category of either list carries a one-line `description` and a `tone`, `loud` or `quiet`, both required; `CategorySchema` is a union on the tone and the UI branches on it alone. The pack build writes both beside the id and the name, so the pack format rises (ADR 0032). A quiet Category draws the quiet variant (k3): a grey hero with «Категорія», its name and description, the mourning Mascot, no right button and no progress, plain rows; its tile is muted. The UA Edition marks `repressed-words` quiet.

**A fourth place for the Mix (amends ADR 0019).** The Category screen is the fourth place a reader takes a Category out of the Mix or puts it back, beside the Mix screen, a card's hide action and the Hidden screen. A quiet Category screen offers none.

**The Dashboard rails (amends ADR 0076).** The Dashboard shows the «Категорії» rail of the Categories of Words; the Curated Collections rail is titled «Добірки»; the Correction Types rail keeps its tiles and its header opens k2.

**Feature Switches** (required of every Edition, ADR 0089): `categoryScreens` (needs `dashboard`): the «Категорії» rail, k1 and the Category screen of Words; `correctionCategoryScreens` (needs `dashboard` and `corrections`): k2 and the Category screen of Corrections, off a plain «Виправлення» header; `quietCategories` (needs `categoryScreens`): k3 and the muted tile, off a quiet Category draws loud. The UA Edition has all three on.

## Considered options

- **A quiet flag beside the Category**: rejected. An optional flag lets a Category be both or neither; a required tone makes the variant one branch.
- **The Category screen without the Mix button**: rejected by the board, which draws «ДОДАТИ» and «У МІКСІ» on it.
