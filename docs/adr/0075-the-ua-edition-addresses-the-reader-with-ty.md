# The UA Edition addresses the reader with «ти»

Ticket #1561 first moved the UA Edition to «ви». Owner decision 04.11 (spec #1553) reverses it: the UA Edition addresses the reader with «ти», in every text it shows or sends.

**Where.** Every UI string (`editions/uk/strings.json`), the Mascot's lines (`editions/uk/edition.json`), the notifications, the widget, the App Intents and the sign-in email use the «ти» pronouns («ти», «тебе», «тобі», «твій»), the singular imperative («Обери», «Спробуй», «Торкнися») and the singular present and future («знаєш», «обереш»). «ГРАЙ!» and the Game Mode names («Обери правильне», «Склади вислів») were already «ти» and stay.

**Gender.** Ukrainian «ти» marks gender in the past tense («ти переглянув», «ти ввела»), and the Edition does not know the reader's. A text that would need a past-tense verb about the reader is rephrased without it: «Усі слова переглянуто», «Ось скільки вдалося за хвилину», «Твоя відповідь: {text}».

**Guard.** A test in `apps/mobile/src/edition/edition-files.test.ts` refuses any «ви» form in the UA Edition's UI strings and Mascot lines, with no exceptions but the two texts of the swipe hint sheet.

**Amended by ADR 0077.** The swipe hint sheet keeps the board's «ви» forms, «ГОРТАЙТЕ ПАЛЬЦЕМ» and «Нове слово тільки коли ви готові.»; the test allows exactly these two texts.

**Out of scope.** The legal documents (`editions/uk/legal/`) are not UI strings and are not changed by this decision.

**Consequences.** A new UA text is written with «ти», and a gender-free phrasing is chosen wherever the reader would be the subject of a past-tense verb. Another Edition chooses its own form of address.
