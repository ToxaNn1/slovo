# A Word card shows its sections in tabs in a fixed frame

A Word's Entry card grew into a long column: the Definition, the Example, the Synonym Row line, «Часто кажуть», Synonyms and antonyms, and behind «Детальніше» the other meanings, the etymology and further Examples. In the Feed a page held a card of any height, so the next card's place moved from Word to Word and the reader scrolled inside a page before swiping to the next one.

**Behind the `wordTabs` Feature Switch**, a Word card is a fixed frame that takes the page's height, with the Lemma and its line on top and tabs under it, and nothing behind «Детальніше». The tab bar stands at the card's foot under the selected tab's panel, a red slanted mark over the selected tab, and the Category chip ends the line under the Lemma, whichever tab is selected (board p1):

- **«Суть»**: the primary Definition, the Synonym Row line and «Часто кажуть», and «Ще {count} значення — у вкладці «Історія».» when the Word has other meanings.
- **«Приклад»**: every Example, each with its author.
- **«Зв’язки»**: the Synonyms and antonyms.
- **«Історія»**: the other meanings numbered from 1, the etymology and the Word History.

**A Correction card** takes the same frame: the kicker row and the struck non-standard form on top, then the tabs **«Як краще»** (the standard equivalents and the Category chip), **«Чому»** (the explanation and its sources) and **«Приклади»** (the example pair and the literary uses). «Чому» is left out when the Correction gives no reason. Under Self-check the card keeps the non-standard form and the question above its tabs, which stay disabled until the reveal.

An **Idiom card** takes the same fixed frame and tabs under its expression, which is underlined in the accent red:

- **«Суть»**: the primary Definition, the other ones numbered from 2, and the line naming the sources.
- **«Звідки»**: where the expression comes from, in place of the «Походження» section.
- **«Приклад»**: every Example, each with its author.

The tabs come in that order. A tab with nothing to show is left out, and a card with «Суть» alone draws no tab bar. «Суть» is always there and is selected when the card opens. The tab bar is a `tablist` of `tab`s that VoiceOver reads by name with their selected state. Switching tabs moves nothing, so Reduce Motion has nothing to stop. The Lemma, the corner or the action row (ADR 0077) and Self-check (ADR 0017) stay as they are on every tab. Under Self-check every tabbed card draws its tab bar with the tabs disabled and the frame empty until «Показати значення» (or the kind's reveal) is tapped; the reveal enables the tabs with «Суть» (or the first tab) selected. The disabled state is `CardTabs`'s own, so every kind gets it; a card with no tab bar (a Synonym Row, a card with one tab) has nothing to disable.

**A Tip and a Synonym Row** take the same fixed frame behind the same switch. A Tip keeps its title, chip and non-standard form above two tabs made only from what a Tip has: «Суть» (the standard form, the explanation and the sources) and «Приклад» (the Example), so a Tip without an Example draws no tab bar; a Tip has no exceptions, so there is no «Винятки». A Synonym Row keeps its dominant above and puts the meaning, every member, the Example and the sources in the frame, with no tab bar and no pages. The tab bar and the shrink-then-clamp panel are one component for every kind (`CardTabs`, `FitPanel`), and which tabs a Tip has is one pure function (`tipTabsOf`, `@slovo/ui/tip-tabs`).

**Shrink, then «Детальніше».** The selected tab's content fills the rest of the frame. One too tall for it takes the Word text size a step smaller at a time (XL to L, L to M, M to S) down to the floor, **S**, the smallest Word text size. One too tall even at S stays at S, clamped to the frame, with a «Детальніше» button under it, on every kind of card; a tap grows the tab to its whole content with a smooth motion (Reanimated, none under Reduce Motion), and the card grows with it, so the page scrolls over the card: in the Feed the page is a `PagerScrollView` the card fills at least, on the Entry screen its scroll. «Сховати» under the opened tab, another tab or a font size clamps it again at once (owner, 08.11.2026; «Сховати» from the owner's test pass of the same day, replacing the scroll inside the tab, whose swipe the reader did not see coming). Head texts take a size by their length too, so the cards keep one text scale: an Idiom's expression steps from the Lemma size to 40 and 30 (where the Lemma is 50), a standard form under «Українською краще», a Tip's or a Correction's, is 30 of 50, and a Round's prompt, the Feed's Quick Question's too, steps from 24 to 20 and 18 (`sizeForLength`, owner 08.11.2026). The Lemma keeps its own shrink. The card measures the content once it is laid out (`onLayout`), so the test is the drawn height, whatever the font and the device; it measures again on another tab or font size.

Which tabs a card has is one pure function of the Core's card model (`wordTabsOf`, `correctionTabsOf` and `idiomTabsOf`, `@slovo/ui/word-tabs`), tested in Vitest; one component (`CardTabs`, `FitPanel`) draws the tab bar and the fit for every kind; the screen tests check what the Feed draws. The Feed and the Entry screen read the switch from the Shell and pass it to the card. The Word of the Day's card is the red card only while Self-check keeps it closed; once revealed, or from the start without Self-check, it is the tabbed card of every Word, with the kicker «▶ СЛОВО ДНЯ · 7.11» in red over its Lemma (owner, 08.11.2026, board p1 #5–#12). With the switch on, every Entry card in the Feed hangs from the top row closer to the screen's edges, and the Feed's header draws no XP bar over the cards (board p1); so the Daily Goal's progress (ADR 0074) shows in Profile only while the switch is on, and a plain new Word keeps its kicker, the board having no sample of one (owner, 08.11.2026).

## Considered Options

- **Every section in one scrolling column**, as before: the card height changed from Word to Word, the problem this decision solves.
- **A fixed frame that clips what does not fit**: rejected. A long etymology or a large text size would lose words; «Детальніше» opens what the clamp hides.
- **A tab that scrolls inside the frame**, the first version: replaced on 08.11.2026. A swipe scrolled the tab before it turned the page, and the reader saw no sign of more text.
- **Swiping sideways between tabs**: rejected. The side swipe sets a Knowledge Mark (ADR 0077).
- **«Детальніше» kept inside «Суть»**: rejected. It would hide again what the tabs show.
