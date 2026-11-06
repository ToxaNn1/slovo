# Category, Curated Collection and Collection share one screen style

Spec #1604 ports board 05.1 (05.11). The Curated Collection screen, the Correction Type screen and a Collection's screen each drew a hero and cards of their own; board 05.1 draws one screen for a set of Entries.

**Decision.** The 05.1 hero and cards are one component family, grown from the existing hero and card components, with nothing built twice. Each kind of set brings a kicker and a right button: a Category «КАТЕГОРІЯ · N слів» (or «N виправлень») with the Mix button (ADR 0081); a Curated Collection «ДОБІРКА · N слів» with the copy into the reader's Collections, «ДОДАТИ» and, once copied, «ДОДАНО» (ADR 0076); a Collection «КОЛЕКЦІЯ · N слів» with its name, no description and the Collection menu. The hero reads «ЗНАЮ x З n» from the Known Knowledge Marks of the set's Entries. A card is the Word card with its rarity bars and the «ЗНАЮ» stamp; a Correction card puts the non-standard form, the Correction Type and the standard form in the same three slots; an Idiom, a Synonym Row or a Tip shows its title and meaning without bars. The quiet variant (k3) belongs to a quiet Category alone.

**The Collections list.** In the board style the reader's Collections list is the k1 grid, tones by position and no quiet tile; the «+» for a new Collection stays where it is.

**Feature Switch** `collectionBoardStyle` (required of every Edition, ADR 0040, no dependency): the grid of Collections and the 05.1 screen of a Collection; off, today's list and screen. The UA Edition has it on.

## Considered options

- **A screen per kind**: rejected. Three heroes and three card sets drift apart, as the 04 boards did.
