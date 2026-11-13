# An opened tab scrolls inside the card

ADR 0091 opened a clamped tab under «Детальніше» by growing the card to the tab's whole content, so the page scrolled over the card: in the Feed the `PagerScrollView`, on the Entry screen its scroll. On the owner's phone (13.11.2026) a rich Correction's «Чому» opened that way pushed the card's top off the screen under a page scroll bar.

**Only the card scrolls.** Every Entry card keeps its fixed frame when a tab is opened: «Детальніше» shows the tab's whole content in a scroll inside the tab's room (`<kind>-tab-scroll`), with the scroll bar, and the page around the card never scrolls. «Сховати» under it, another tab or a font size clamps it again at once. Another tab starts afresh, at the user's font size and not opened. Nothing grows, so Reduce Motion has nothing to stop (owner, 13.11.2026).

The scroll sits behind «Детальніше», which answers the 08.11 reason for dropping the first scroll inside the tab: the reader now asks for it, so a swipe on the opened text scrolls it rather than turning the page by surprise.

## Considered Options

- **The card grows and the page scrolls** (ADR 0091, 08.11): replaced. The card's top and its corner leave the screen.
