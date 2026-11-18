---
summary: On a tabbed Word card «Суть» shows every Definition, the other ones numbered from 2 under the primary one, then the Synonym Row line, «Часто кажуть» and the Word History; «Історія» shows the etymology alone and is left out without one; the «Ще {count} значення» line is gone (amends 0091).
---

# «Суть» shows every Definition and «Історія» the etymology alone

Owner app pass of 2026-11-18, decision Р10: on a Word's tabbed Entry card the other meanings sat in «Історія», behind a line in «Суть» that sent the reader there. This ADR amends ADR 0091 (the tabs of a Word card).

**Why.** «Історія» reads as the story of the Word, yet it opened on its other meanings. A reader who wanted what the Word means had to read «Ще {count} значення — у вкладці «Історія».» and switch tabs, and the etymology came only after the meanings.

**Decision.** On a Word card:

- **«Суть»**: every Definition one under another, the primary one first and the other ones numbered from 2 under it, then the Synonym Row line and «Часто кажуть», then the Word History when the Word has one. The line «Ще {count} значення — у вкладці «Історія».» is gone, with its string.
- **«Історія»**: the etymology alone, in its paragraphs. A Word without an etymology has no «Історія» tab.

The other tabs, their order and the shrink-then-clamp panel stay as ADR 0091, 0113 and 0134 hold them. The board p1 of ADR 0091 still draws the old split; on this point this ADR wins over the board. `wordTabsOf` in `packages/ui/src/entries/word-tabs.ts` keeps the rule.

**Consequences.** «Суть» grows for a Word with many meanings or a Word History, so it steps the text size down or clamps under «Детальніше» more often. The Word History is read with the meanings, so `wordHistoryOpened` fires when a card whose Word has a Word History opens, not when «Історія» is selected.

## Considered and rejected

- **Keep the Word History in «Історія» with the etymology**: rejected. The owner asked for the etymology alone there; the Word History is a story of use, not of origin, and is not lost in «Суть».
- **Keep a short count of the other meanings in «Суть»**: rejected. Every meaning is now in «Суть», so the count points nowhere.
