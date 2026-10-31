# Onboarding is short: welcome, the first Word, two questions, the Daily Goal, the Feed

Spec #1358 wants a new reader in the Feed within a minute, already knowing what SLOVO is and with a Feed in their taste.

**The order.** Welcome, the first Word with its Pronunciation, two questions, the Daily Goal (ADR 0066, 20 highlighted, the reader picks), then the Feed. Every step can be skipped; skipping the questions keeps the defaults.

**The two questions.** «Хто ви» («Навчаюсь», «Працюю», «Мовний гурман») sets the Rarity Ceiling: «Навчаюсь» «до 4», the others «до 5». «Навіщо» sets the Mix kind weights (more Corrections, more rare Words or more Game). The Edition config holds the options and their mapping, so the Core stays language-agnostic.

**Later, through Feed Notices.** The interests question (unselected Categories become Hidden Categories), the vocabulary self-rating (sets the Rarity Floor and whether to offer the Rarity Test), the Mix review, the Rarity Test and the Account offer. The notification explainer comes right after the first met Daily Goal, no later than day 3, and the iOS prompt only after «Так»; a refusal gets one more ask through a Feed Notice 7 days later, never again. The reader can retake the questionnaire and the Rarity Test from Settings.

**Existing readers.** A reader who finished the old onboarding sees no new onboarding. They get the Daily Goal choice once through a Feed Notice and default to 20 until they choose.

**The answers leave the device only anonymously** (ADR 0068): as counters with no reader id and as properties of the anonymous Analytics id.

## Considered Options

- **A long questionnaire in onboarding**: rejected. Each question costs readers; the rest comes later as Feed Notices.
- **Ask for notifications at first launch**: rejected. The reader has seen no value yet.
- **Make the questions required**: rejected. Onboarding never blocks.
