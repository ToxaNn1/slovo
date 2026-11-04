# Onboarding is short: welcome, the first Word, two questions, the Daily Goal, the Feed

Spec #1358 wants a new reader in the Feed within a minute, already knowing what SLOVO is and with a Feed in their taste.

**The order.** Welcome, the first Word with its Pronunciation, two questions (with the Rarity Test, when the reader does not know their level), the Daily Goal (ADR 0066, 20 highlighted, the reader picks), then the Feed. Every step can be skipped; skipping the questions keeps the defaults.

**The two questions.** «Рівень» («Як добре ви знаєте мову?») sets the Rarity Ceiling (ADR 0072): «Тільки починаю» «до 2», «Непогано» «до 3», «Добре» «до 4», «Я мовний гурман» «до 5». Its fifth option, «Не знаю», sets no Ceiling: it opens the Rarity Test right there, in the frame and step number of «Рівень», and the test's result sets the Ceiling; going on from the test, or a draw with no Word, leads to the next step. While the Rarity Test is switched off, «Не знаю» is not shown. «Навіщо» sets the Mix kind weights (more Corrections, more rare Words or more Game). The Edition config holds the options and their mapping, so the Core stays language-agnostic. The question was «Хто ви» («Навчаюсь», «Працюю», «Мовний гурман») before: a reader's occupation said little about how many rare Words they know, so the owner replaced it with the level asked outright. The backend no longer counts answers to `who`; the counts it holds stay.

**Later, through Feed Notices.** The interests question (unselected Categories become Hidden Categories), the vocabulary self-rating (sets the Rarity Floor and whether to offer the Rarity Test; from 1.0 only the latter, ADR 0072), the Mix review, the Rarity Test and the Account offer. The notification explainer comes right after the first met Daily Goal, no later than day 3, and the iOS prompt only after «Так»; a refusal gets one more ask through a Feed Notice 7 days later, never again. The reader can retake the questionnaire, with «Рівень» but without «Не знаю», and the Rarity Test from Settings: each has its own row.

**Existing readers.** A reader who finished the old onboarding sees no new onboarding. They get the Daily Goal choice once through a Feed Notice and default to 20 until they choose.

**The answers leave the device only anonymously** (ADR 0068): as counters with no reader id and as properties of the anonymous Analytics id.

## Considered Options

- **A long questionnaire in onboarding**: rejected. Each question costs readers; the rest comes later as Feed Notices.
- **Ask for notifications at first launch**: rejected. The reader has seen no value yet.
- **Make the questions required**: rejected. Onboarding never blocks.
- **Keep «Хто ви» and offer the Rarity Test only later, through a Feed Notice**: rejected by the owner. The occupation guessed the Ceiling badly, and a reader who does not know their level should find it out before the first Feed.
