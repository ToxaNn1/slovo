# The Rarity Test takes the highest rarity the reader knows

Owner decision from the app pass (items 83–86). This ADR amends ADR 0054.

**Why.** The Rarity Test set the top of the Rarity Range to the lowest rarity with one «Не знаю». One unknown Word of rarity 1 or 2 among ten cut the range to «до 1» or «до 2», however many rarer Words the reader knew, so the result said little about the reader. Its text, «Твоя рідкість — до {n}. Стрічка бере незнайоме, рідші почекають.», was one long sentence in a heading that wrapped mid-phrase beside the number, and it did not say whether anything had changed.

**The rule.** The top is the highest rarity of which the reader knew at least half of the Words asked: with 2 Words of a rarity, one «Знаю» is enough. A rarity with no Word asked counts as not known. With no such rarity the top is 1. The bottom still goes back to 1 (ADR 0156), and a retake still overwrites the range.

**The result.** `apply` resolves to the top, to how many Words the reader knew, and to `changed`: whether the Rarity Range in force is another than before the test. The result card has a short heading beside the bars, «Рідкість тепер {range}» when it changed and «Рідкість лишається {range}» when it did not, where `{range}` is the range in the words of the «Рідкість» setting («від 1 до 3», «лише 1»). The note under it says how many Words were known and where to change the range: «{known} з {total} слів знайомі. Змінити рідкість можна в Налаштуваннях.» The Edition's strings `rarityTest.resultChanged` and `rarityTest.resultKept` replace `result` and `resultLine`.

**Consequences.** One slip no longer narrows the Feed. A reader who taps «Знаю» once at rarity 5 and nowhere else gets «від 1 до 5»: the test trusts the rarest Word known, and the range is one tap away in Settings, as the note says.

## Alternatives rejected

- **A strict majority** (more than half): with 2 Words of a rarity it asks for both, which is the old strictness for each rarity.
- **The highest rarity up to which every rarity below is known too**: closer to a ladder, yet one slip low down cuts the range again.
- **Ask more Words of each rarity**: a longer test for a setting the reader changes in one tap.
