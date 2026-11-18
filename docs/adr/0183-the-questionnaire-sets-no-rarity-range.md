# The questionnaire sets no Rarity Range

Owner decision from the app pass (item 87). This ADR amends ADR 0067 and ADR 0156.

**Why.** «Рівень» («Як добре ти знаєш мову?») set the Rarity Range from a self-estimate: «Тільки починаю» «до 2» up to «Мовний гурман» «до 5». Answered again from Settings, it silently overwrote a range the reader had picked on the bars or earned in the Rarity Test, and a modest answer in the onboarding hid the rarest Words from the first Feed with no word about it.

**The decision.** No answer to «Рівень» sets the Rarity Range, in the onboarding or on the retake from Settings. The range is set by the reader in Settings (both ends) and by the Rarity Test (the top, the bottom back to 1; ADR 0156, 0182), and by nothing else. A reader who answers «Рівень» and never takes the test keeps the default «від 1 до 5».

**What stays.** The question is still asked, its answer is still counted by the backend with no reader id, and its option «Не знаю» still opens the Rarity Test in the frame of «Рівень» while the test is on. «Навіщо» still sets the Mix kind weights. The level option's `rarityCeiling` stays in the Edition contract and in the Edition's config, unread, so configs written before stay valid; the Core tells the options apart by `rarityTest` alone.

**Consequences.** «Рівень» now changes nothing the reader can see but the path to the Rarity Test. Whether to keep the question, or to turn its answer into an offer of the test, is the owner's next decision; `rarityCeiling` leaves the contract with it.

## Alternatives rejected

- **Set the range only in the onboarding, not on the retake**: the same answer would then do two things, and the onboarding estimate is the weaker of the two.
- **Remove `rarityCeiling` from the contract now**: every Edition config would change for a field nothing reads; it goes when the question's fate is decided.
