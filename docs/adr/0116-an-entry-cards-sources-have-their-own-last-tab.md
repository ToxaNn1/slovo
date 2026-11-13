# An Entry card's sources have their own last tab «Джерело»

ADR 0091 put a tabbed Entry card's sources inside its other tabs: a Word's in «Історія», a Correction's in «Чому», an Idiom's in «Суть», a Tip's in «Правило» (ADR 0119), a Synonym Row's on its last page (ADR 0114), each as a line «Джерело: …». On the phone check of 13.11.2026 the owner asked for the sources in a tab of their own, the last one, on every kind.

**The tab.** Behind `sourceTab` (needs `wordTabs`) every tabbed Entry card, Word, Correction, Idiom, Tip and Synonym Row, ends with a tab «Джерело» (`wordCard.tabSource`). It shows only the names of the Entry's sources, each on its own line in the meta role, muted, with no «Джерело:» before them, as the tab already says so (owner, 13.11.2026). The source line leaves the other tabs while the switch is on. Every Entry has at least one source (the contracts ask for one), so a tabbed card always has a tab bar now: a Tip shows «Правило · Джерело», a row of four members «Ряд · 1/1 · Джерело».

**Where it lives.** The Core's card models name the sources (`sourceNames`, the Word's from `sourceNamesOf` as for the other kinds). `CardTabs` takes the names (`sources`) and adds the tab after the kind's own tabs, so Self-check, «Детальніше» and the scroll inside the card (ADR 0113) work on it as on every tab. The mobile app reads the switch once (`useShown().sourceTab`) and passes it to the Entry card in the Feed, on the Entry screen and in a Category's Feed. With the switch off, or `wordTabs` off, the cards keep the source line where they had it.

## Considered Options

- **The source line in the kind's own tabs** (ADR 0091, 0114, 0119): kept behind the switch off. It buries the sources in a tab about something else.
- **«Джерело: …» inside the new tab**: rejected by the owner (decision 16); the prefix repeats the tab's name.

Amends ADR 0091, 0114 and 0119.
