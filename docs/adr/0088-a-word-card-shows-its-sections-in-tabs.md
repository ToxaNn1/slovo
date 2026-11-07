# A Word card shows its sections in tabs in a fixed frame

A Word's Entry card grew into a long column: the Definition, the Example, the Synonym Row line, «Часто кажуть», Synonyms and antonyms, and behind «Детальніше» the other meanings, the etymology and further Examples. In the Feed a page held a card of any height, so the next card's place moved from Word to Word and the reader scrolled inside a page before swiping to the next one.

**Behind the `wordTabs` Feature Switch**, a Word card is a fixed frame that takes the page's height, with the Lemma and its line on top and tabs under it, and nothing behind «Детальніше»:

- **«Суть»**: the primary Definition, the Synonym Row line, «Часто кажуть» and the Category chip, and «Ще {count} значення — у вкладці «Історія».» when the Word has other meanings.
- **«Приклад»**: every Example, each with its author.
- **«Зв’язки»**: the Synonyms and antonyms.
- **«Історія»**: the other meanings numbered from 1, the etymology and the Word History.

The tabs come in that order. A tab with nothing to show is left out, and a card with «Суть» alone draws no tab bar. «Суть» is always there and is selected when the card opens. The tab bar is a `tablist` of `tab`s that VoiceOver reads by name with their selected state. Switching tabs moves nothing, so Reduce Motion has nothing to stop. The Lemma, the corner or the action row (ADR 0077) and Self-check (ADR 0017) stay as they are on every tab.

**Shrink, then scroll.** The selected tab's content fills the rest of the frame. One too tall for it takes the Word text size a step smaller at a time (XL to L, L to M, M to S) down to the floor, **S**, the smallest Word text size. One too tall even at S stays at S and scrolls inside the tab, the last resort for a very long tab: the card keeps its height, and the Lemma, its line and the corner stay in place. In the Feed the tab's scroll is the page's scroll (`PagerScrollView` nested in the page's), so a swipe scrolls the tab and turns the page only from its end. The Lemma keeps its own shrink. The card measures the content once it is laid out (`onLayout`), so the test is the drawn height, whatever the font and the device; it measures again on another tab or font size.

Which tabs a card has is one pure function of the Core's Word card model (`wordTabsOf`, `@slovo/ui/word-tabs`), tested in Vitest; the screen tests check what the Feed draws. The Feed and the Entry screen read the switch from the Shell and pass it to the card. The Word of the Day's red card keeps its column (owner question, 07.11.2026).

## Considered Options

- **Every section in one scrolling column**, as before: the card height changed from Word to Word, the problem this decision solves.
- **A fixed frame that clips what does not fit**: rejected. A long etymology or a large text size would lose words.
- **Swiping sideways between tabs**: rejected. The side swipe sets a Knowledge Mark (ADR 0077).
- **«Детальніше» kept inside «Суть»**: rejected. It would hide again what the tabs show.
