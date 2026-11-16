# Card titles take a fixed type scale, fitted by width

Status: accepted (owner, 16.11). Supersedes ADR 0091's «long head texts take a size by their length». Amends ADR 0134.

## Context

A card's title took its size from its length in letters (`sizeForLength`), and a word too wide for its line shrank by the fraction that made it fit. Two titles of the same length got different sizes on different phones, sizes fell between any two the boards draw, and the big titles grew again with the iPhone's text size until they broke the card frame.

## Decision

- Card titles take one fixed scale at M, «Як у системі»: `50 · 44 · 40 · 36 · 32 · 28 · 26 · 24 · 22 · 20` (`titleScale`). At L, XL, «Більший» and «Найбільший» every step grows by the Lemma's own factor (58/50, 65/50); in the compact layout (a window under 390) it shrinks by 44/48 too.
- A title is drawn at the largest step, at or under its start size, at which its widest word fits the line and the whole text its lines. It wraps only between words. A title too big even at the smallest step shrinks there down to 0.7; Entry details' panel headline then ends in «…». No letters are counted.
- Start sizes at M and lines: the Lemma 50 (one line for a word, two for a phrase); a Synonym Row's dominant 50, one line; an Idiom's expression and a Tip's title 36, three lines; a Correction's non-standard form, its struck form and its standard form in «Як краще» 26, three lines; a Round's prompt 24, four lines; Entry details' panel headline 24, two lines, never the main card's size. «Українською краще» keeps `standardFormScale`.
- Titles that start at 36 or more (the Lemma, the dominant, an Idiom's expression, a Tip's title) ignore the OS text size. Every other text keeps it within `fontScaleCap.text`.
- These sizes override the boards': a Tip's title 30 → 36, an Idiom's expression by length → 36, the dominant 49 → 50, a Correction's forms 24, 26 and 38 → 26, the panel headline → 24.
- Other large text drawn whole-worded (onboarding, Dashboard, tiles, Game result) is no card title and still shrinks just enough for its widest word.

## Consequences

- `sizeForLength`, `LengthSteps`, `idiomExpressionLength`, `roundPromptLength` and `correctionStandardScale` are gone.
- A title shows only after it is measured at each step it tries, as before it showed only once its widest word was measured.
- The tab fit of ADR 0091 (a tab too tall takes a smaller text size) is unchanged; a title in it steps on the scale of the smaller size.
