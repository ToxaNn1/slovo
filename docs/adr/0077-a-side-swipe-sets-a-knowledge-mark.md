# A side swipe sets a Knowledge Mark

Spec #1578 (owner decisions of 2026-11-05). The Entry card set a Knowledge Mark with two buttons under it, and tapping the shown mark again removed it (ADR 0043). Board 04 v2 of the «Рупор» design sets the mark with a side swipe on the card and moves the other actions to the card's corner. This amends ADR 0043 («Tapping a mark») and ADR 0075 (the «ти» guard).

**Setting a mark.** A swipe right on the Entry card marks it Known, a swipe left Unknown; the «⋯» sheet sets the same marks. A set answers the Entry by the interval rule (ADR 0043), counts for the Community Counters, and is a Review answer on a due Entry, as a tap was. A repeated swipe to the side of the shown mark is a no-op: it writes nothing and counts nothing. On a due Entry the card shows no mark, so either swipe is an answer.

**Removing a mark.** A swipe never removes a mark. Only «Зняти позначку» in the «⋯» sheet does: it deletes the record as a tombstone (ADR 0041) and counts the change.

**Undo.** For 4 s after a swipe the toast offers «СКАСУВАТИ», and a new toast replaces the old. Undo restores the Entry's previous record exactly: mark, step, Review day and mark time, or no record, and the confirmed record the set gave, if it gave one (amends ADR 0043: a confirmed record is otherwise never removed). It counts the change back for the Community Counters. Undo does not take back XP, since the XP log is append-only (ADR 0066); a Review answer earns its XP once per Entry per local day, so swipe, undo and swipe again earn nothing more.

**The card's corner.** The action row moves to the card's top-right corner as the heart, Collections and «⋯». The «⋯» sheet is headed by the Entry and lists the mark items by state («Знаю», «Не знаю», «Я й так кажу правильно» on a Correction; «Змінити на …» and «Зняти позначку» once marked), then «Поділитися», «Сховати», «Повідомити про помилку» and «Скасувати» (ADR 0092). Its toasts last 2.2 s and carry no undo.

**The hint sheet.** A sheet titled «ГОРТАЙ ПАЛЬЦЕМ» explains the right, left and up swipes once. It has its own device-only record, so a reader who saw the old one-line swipe hint sees it once; the old hint and its string go. Its texts are the board's, verbatim, including «Слово піде в підтверджені.»: that line is the board's wording and does not change which Entries are confirmed (ADR 0043, 0066).

**Form of address (amended by ADR 0092).** The hint sheet speaks «ти» like the rest of the Edition: «ГОРТАЙ ПАЛЬЦЕМ» and «Нове слово — коли захочеш.». The «ти» test allows no «ви» form.

**Switch.** The Feature Switch `swipeMarks`, which depends on `knowledge`, guards the swipes, the stamp, the corner actions, the «⋯» mark items and the hint sheet. With it off the card keeps the buttons and the action row of ADR 0043.

**Consequences.** Every screen that opens a kept Entry shows the same card with the swipes. Feed Notices take no side swipe. A concealed card (Self-check) takes no side swipe and offers no mark items. Under Reduce Motion the card does not follow the finger and every animation is one short fade (ADR 0055).
