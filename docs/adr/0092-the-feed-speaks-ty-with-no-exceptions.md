# The Feed speaks «ти» with no exceptions

ADR 0075 moved the UA Edition to «ти», and ADR 0077 kept two «ви» texts of the board in the swipe hint sheet. Owner decision 07.11 (spec #1696): «ти» everywhere, and the board's Feed texts are in «ти» too.

**Texts.** In the UA Edition, word for word:

- The «⋯» sheet of an Entry card closes with «Скасувати», as on the board, not «Закрити».
- The gestures hint sheet is titled «ГОРТАЙ ПАЛЬЦЕМ», and its up-swipe row says «Нове слово — коли захочеш.».
- «Може, на сьогодні досить?» carries the board text under it: «Уже {n} карток позаду. Рідкісні слова краще засвоюються невеликими порціями.». `{n}` is the 50 distinct Seen Entries that bring the card (ADR 0066), so it always reads «50 карток», a form that needs no plural; the threshold stays 50.

**Owner approval.** The owner gave «текст ок» for these four texts on 07.11, before the merge.

**Guard.** The «ти» test in `apps/mobile/src/edition/edition-files.test.ts` allows no «ви» form in the UA Edition's UI strings: the two exceptions of ADR 0077 are gone.

**Amends** ADR 0075 (no exceptions to the guard) and ADR 0077 (the hint sheet's texts and the «⋯» sheet's last item).

**Consequences.** A board text in «ви» is written in «ти» when it enters the Edition. The `enoughForToday` strings gain `body`, a template with `{n}`, which every Edition gives.
