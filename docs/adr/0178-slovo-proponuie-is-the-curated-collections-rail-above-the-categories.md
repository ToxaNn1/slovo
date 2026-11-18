# «SLOVO пропонує» is the Curated Collections rail above the Categories

Owner decision of spec #1992, ticket #1994. This ADR amends ADR 0076, 0081, 0082 and 0105.

**Why.** Curated Collections («Добірка», ADR 0076) were off in the UA Edition (ADR 0105), and their «Добірки» rail looked unlike every other rail of the Dashboard. The owner wants them back as editorial picks that read as part of the Categories.

**The rail.** With `curatedCollections` on, the Dashboard shows the rail «SLOVO пропонує» (Edition string `dashboard.curatedCollectionsTitle`) right after «Попередні слова» and right before «Категорії»; off, it is absent (ADR 0176). It is drawn from the Categories rail's own header and tile components, so it looks and behaves like them: the header counts every Curated Collection published by today in the local calendar; the rail keeps at most ten cards, the unopened ones first, then the newest. A tile shows a pictogram, the collection's name and its count of Entries, the small mark «Нова» until it is opened and the Edition's added mark (UA «У Міксі ✓») once it is copied; a tap opens the collection's screen of ADR 0082. A Curated Collection may hold Entries of any kind.

**The pictogram.** A Curated Collection carries an optional `pictogram`: the id of a Category or Correction Category whose pictogram its tile draws. Unset, the tile draws the Edition's `curatedCollectionPictogram` (UA `language-speech`), itself the id of an existing Category; with neither, no pictogram. The Language Pack build refuses a `pictogram` that names no Category, and the Edition config refuses such a default; the pack format is 14.

**Amends.** ADR 0076 and 0081: the rail is named «SLOVO пропонує» and comes before «Категорії», not after. ADR 0082: the Curated Collection screen stays, its entry point is the new tile. ADR 0105: the UA Edition turns `curatedCollections` on. Under ADR 0176 the new look replaces the old «Добірки» rail code in the same change; no switch keeps the old rail.

**Consequences.** One more rail on the UA Dashboard; editors pick a pictogram per collection or rely on the default.
