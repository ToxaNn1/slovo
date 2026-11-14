# The Weekly Recap and Yesterday share one Feed page; Yesterday is a quiz; «Готово» folds the week

ADR 0054 gives every Feed Notice its own Feed page, makes Yesterday a Self-check card with «Знаю» and «Не знаю», and puts «Поділитися» under the Weekly Recap's numbers. The owner chose the board XFeed f5 (spec #1842) over those three points. This ADR amends ADR 0054 and keeps the rest of it.

The rule:

- **One page.** When the Weekly Recap and Yesterday are both due on a local day, the Feed shows them on one Feed page, the Weekly Recap («Твій тиждень») first and Yesterday («Пам’ятаєш учорашнє слово?») under it; either one alone takes the page by itself. The page takes the Weekly Recap's place in the Feed Notice order, and swiping past it closes both for the local day.
- **The Yesterday quiz.** Yesterday shows the Word's Lemma with three meanings: its primary Definition and the primary Definitions of two other Words within the Rarity Ceiling, not Hidden, picked as «Вгадай слово» picks Distractors (ADR 0101): Words of its part of speech first, then the others. The three are distinct, and a homonym's meaning is never one, since the card shows the one Lemma. Their order comes from a random port seeded by the day and the Word, so it stays the same all that day, on every open. Without two such meanings no Yesterday comes. The reader answers once: the right meaning sets Known, as «Знаю» on its card does, any other sets Unknown, as «Не знаю» does, which starts a Review. The quiz no longer follows the Self-check setting.
- **«Готово».** The Weekly Recap has «Готово», which folds it away for its week: it is closed for its Monday, the only day it comes, in the same `device-only` record as every Feed Notice closed for the day, and Yesterday stays on the page. A toast offers «Повернути» once, which brings it back. Next Monday's Weekly Recap comes as usual.
- **Share stays an icon** on the Weekly Recap; its Share Card and share path are those of ADR 0054. The Weekly Recap still comes on Monday, about the Monday–Sunday week before it.
- The cards address the reader with «ти».

Consequences:

- The Core's Weekly Recap content carries `folded` and the Yesterday under it; Yesterday's content carries its quiz. The Feed gains `answerYesterday`, `foldWeeklyRecap` and `restoreWeeklyRecap`; the shell draws the page, the fold and the toast.
- The Distractor order of «Вгадай слово» is repeated in the Feed for now; a later change may share one.
