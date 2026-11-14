# 0131 The Due Quiz checks the Words due today in «Вчу»

Status: accepted (owner, 14.11)

## Context

Review lives only in the Feed: a due Entry comes back there and the reader marks it. The board 09 (XSaved, screen 73) draws a red card «Перевір себе» on top of the «Вчу» list, with the count of Words due today and «Почати», which opens a quiz of three meanings for each of them. The owner chose to build it as the Yesterday quiz of ADR 0130 (board 09 decisions, 1).

## Decision

- **The Due Quiz** («Перевір себе») is a quiz on the «Вчу» list over the Words Due for Review today: Words, not Hidden and eligible, whose Review day is today or an earlier day, in the list's order (the nearest Review first). Entries of the other kinds stay out: a Word alone has the meanings the quiz asks.
- **The card.** While at least one such Word has a question, the «Вчу» list shows the card over its rows: «Перевір себе», how many Words it asks («2 слова на сьогодні») and «Почати». Without one, no card; the empty list stays as it is.
- **A question** is built as Yesterday's (ADR 0130): the Lemma, «Що це означає?» and three meanings, its primary Definition and the primary Definitions of two other Words within the Rarity Ceiling, not Hidden, picked as «Вгадай слово» picks Distractors (ADR 0101), Words of its part of speech first. The three are distinct by their Comparison Key for a Definition, and a homonym's meaning is never one. Their order comes from a random port seeded by the local day and the Word, so it stays the same all that day. A Word without two such meanings has no question and the quiz skips it.
- **An answer** is given once per Word and applies at the tap: the right meaning sets Known, as «Знаю» on its card does, which moves its Review to the next step; any other sets Unknown, as «Не знаю» does, which starts its Review again at 1 day. Either way the Word is no longer due today, so the quiz needs no record of its own and leaving it halfway keeps the answers given.
- **The sheet** shows «1 з N» with one segment per Word, the Lemma, the three meanings marked «А», «Б», «В», then «Далі», and «Готово» after the last; «Скасувати» closes it. On «Готово» a toast says «Влучно! …» when every answer was right, else «Перевірено: X з N. Решта повториться завтра.».
- **Not the Self-check.** The Due Quiz does not follow the Self-check setting; the owner keeps the same name «Перевір себе» for both.
- It is behind the Feature Switch `dueQuiz` (needs `knowledge`); off, «Вчу» has no card.
- The texts address the reader with «ти».

## Consequences

- The Core gains one Due Quiz function over the Knowledge, the Entries, the Clock and the random port: it returns the questions in order and applies an answer as a Knowledge Mark. Its tests use in-memory Knowledge and Entries and a fixed Clock.
- The Distractor choice of Yesterday and of the Due Quiz is one function in the Core, not a third copy of the order of «Вгадай слово».
- The shell draws the card, the sheet and the toast (`packages/ui`, the «Вчу» list).
