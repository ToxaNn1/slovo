# A Synonym Row's members come in tab pages of four

ADR 0091 put a Synonym Row card's meaning, every member, the Example and the sources in the fixed frame, with no tab bar and no pages. Board e8 (2026-11-12 Feed board) draws the dominant large on one line with its stressed vowel in red, the members as rows with their shade notes on the right, and a row of 5 to 12 members split over tabs.

**Pages of four.** Behind `wordTabs` a Synonym Row card shows its members four to a tab, in the row's order: the tabs are named «Ряд · {page}/{pages}» (`synonymRowCard.page`), «Ряд · 1/2», «Ряд · 2/2». The meaning line sits on the first page, the Example and the sources on the last. A row of four members or fewer has one page, and the card draws no tab bar, as every card with one tab does (ADR 0091). Which pages a row has is one pure function of the Core's card model (`synonymRowPagesOf`, `@slovo/ui/word-tabs`), tested in Vitest; `CardTabs` and `FitPanel` draw the bar and the fit as for every kind, so Self-check, «Детальніше» and the scroll inside the card (ADR 0113) work the same. A member keeps its index in the whole row, so its links and test ids do not change from page to page.

**The look of e8.** The kicker names the kind, as on every Entry card, with no chip, and a red slanted bar sits under the head. The dominant is one line that shrinks to fit, its stressed vowel in the accent colour. Each member is a row: the word on the left, its shade note upright on the right, a hairline between rows (owner, 13.11.2026).

## Considered Options

- **Every member in one frame, no pages** (ADR 0091): replaced. Twelve members with notes overflow the frame even at S and hide behind «Детальніше».
- **Pages by height**: rejected. The page count would change with the font size and the device; four to a page is the board's.

Amends ADR 0091.
