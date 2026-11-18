---
summary: Onboarding: welcome, the first Word, «Рівень» (whose «Не знаю» opens the Rarity Test) and «Навіщо», the Daily Goal, the Notification time, the Feed; the rest comes later as Feed Notices. The order and the explainer are 0074's. Amended by 0074, 0076, 0156, 0183.
---

# Onboarding is short: welcome, the first Word, two questions, the Daily Goal, the Notification time, the home

Spec #1358 wants a new reader in the Feed within a minute, already knowing what SLOVO is and with a Feed in their taste.

**The order.** СЛОВО (welcome), ПЕРШЕ (the first Word with its Pronunciation), ГРАЙ!, the two questions РІВЕНЬ? and НАВІЩО? (with the Rarity Test, when the reader does not know their level), ЦІЛЬ (the Daily Goal in Words, ADR 0074, 10 highlighted, the reader picks), НАГАДУВАННЯ (the Notification time, ADR 0074), then the home: the Dashboard, or the Feed with `dashboard` off (ADR 0076). Every step can be skipped; skipping the questions keeps the defaults.

**The two questions.** «Рівень» («Як добре ти знаєш мову?») sets no rarity (ADR 0183): «Тільки починаю», «Непогано», «Добре», «Мовний гурман». Its fifth option, «Не знаю», opens the Rarity Test right there, in the frame and step number of «Рівень», and the test's result sets the top of the Rarity Range (ADR 0156, 0182); going on from the test, or a draw with no Word, leads to the next step. While the Rarity Test is switched off, «Не знаю» is not shown. «Навіщо» sets the Mix kind weights (more Corrections, more rare Words or more Game). The Edition config holds the options and their mapping, so the Core stays language-agnostic. The question was «Хто ти» («Навчаюсь», «Працюю», «Мовний гурман») before: a reader's occupation said little about how many rare Words they know, so the owner replaced it with the level asked outright. The backend no longer counts answers to `who`; the counts it holds stay.

**Amended by ADR 0183.** No answer to «Рівень» sets the Rarity Range any more, in the onboarding or on the retake; «Не знаю» still opens the Rarity Test, which alone sets it beside the reader in Settings. The options' `rarityCeiling` stays in the Edition config unread.

**Later, through Feed Notices.** The interests question (unselected Categories become Hidden Categories), the vocabulary self-rating (sets the Rarity Floor and whether to offer the Rarity Test; from 1.0 only the latter, ADR 0156), the Mix review, the Rarity Test and the Account offer. For a reader who did not answer «Коли нагадати?» in onboarding (ADR 0074), the notification explainer comes right after the first met Daily Goal, no later than day 3, and the iOS prompt only after «Так»; a refusal gets one more ask through a Feed Notice 7 days later, never again. The reader can retake the questionnaire, with «Рівень» but without «Не знаю», and the Rarity Test from Settings: each has its own row. The retake starts from the last answer to each question, kept on the device from the onboarding and the retake, and applies only the answers changed.

**Existing readers.** A reader who finished the old onboarding sees no new onboarding. They get the Daily Goal choice once through a Feed Notice and have no goal until they choose (ADR 0074).

**The answers leave the device only anonymously** (ADR 0068): as counters with no reader id and as properties of the anonymous Analytics id.

## Considered Options

- **A long questionnaire in onboarding**: rejected. Each question costs readers; the rest comes later as Feed Notices.
- **Ask for notifications at first launch**: rejected. The reader has seen no value yet.
- **Make the questions required**: rejected. Onboarding never blocks.
- **Keep «Хто ти» and offer the Rarity Test only later, through a Feed Notice**: rejected by the owner. The occupation guessed the Ceiling badly, and a reader who does not know their level should find it out before the first Feed.
