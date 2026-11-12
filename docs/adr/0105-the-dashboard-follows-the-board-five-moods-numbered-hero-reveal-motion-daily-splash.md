# The Dashboard follows the board: five Moods, a numbered hero, the reveal motion and the daily splash

**Amends ADR 0076.**

Owner test pass of 2026-11-12 against the «Рупор» Dashboard board («робимо все», Dashboard only). The app drew the Dashboard in its own way where the board is precise: four Moods, a hero without a number, a giant letter over the revealed Word, no motion on the reveal and a logo that did nothing.

**Five Moods.** `dashboardMoods` names exactly five listed ids in display order (was four); the Edition check refuses any other count or an unknown id. The UA Edition shows the board's five: Бадьоро, Радісно, Сумно, Закохано, Спокійно (`energetic`, `joyful`, `sad`, `in-love`, `calm`), with the board's replies. A Mood with no `rarityBand` or shifts leaves the Feed as it is (`whole`, no shift). The tiles stay two to a row; the fifth keeps half a row beside an empty cell, and each tile has its own red mark (a fifth shape from the board).

**No «Добірки» on the UA Dashboard.** The board has no Curated Collections rail, so the UA Edition turns `curatedCollections` off; the schema and the logic stay.

**The Correction Types in the board's order.** The Correction Type list, and so the Dashboard's Correction Types rail, runs as the board does: суржик, наголос, кальки, канцелярит, пароніми, then росіянізми and англіцизми, which the board does not draw. The board's «Відмінки» and «Правопис» have no Corrections yet and get no type. The Categories keep the Edition's real names, not the board's sample ones.

**The hero has a number.** The kicker of the unrevealed hero reads «Слово дня · №N»; once revealed it reads the date. N is the reader's own count: the kept days of the Word of the Day archive before the hero's date, plus one. There is no global Word of the Day number, and a count shared by every reader would need a start date the Edition does not have. The reveal button reads «Розкрий слово» (its own string, not the Feed card's «Розкрити») and sits higher than «До картки →».

**The revealed hero.** No giant letter: the Lemma over a cream card cut at its top-left corner, holding the Stress and the short part of speech with five Rarity bars, the short Definition and «Рідкість N з 5» in the accent text colour.

**The reveal motion.** Only on the reveal itself, never when the Dashboard opens on a hero already revealed: the Lemma's letters fly in one after another, the card and then the button rise in, the Mascot shouts for 1.2 s and then is happy, and the interface sound «shout» plays. With Reduce Motion everything fades. The rows of «Минулі Слова дня» rise in one after another.

**The daily splash.** A tap on the Dashboard's logo plays the launch splash cut at the daily pace (0.56 s, the shout at 0.1 s) and returns to the Dashboard. It sits behind the new Feature Switch `dailySplash`, which needs `dashboard`; the UA Edition has it on.

## Considered Options

- **A global Word of the Day number (days since a launch date)**: rejected. The Edition has no launch date, and a number the reader never saw would count days they missed.
- **Keep four Moods and drop one of the board's**: rejected. The board is the design (ADR 0076's tiles were a guess).
- **Add «Відмінки» and «Правопис» as Correction Types now**: rejected. They have no Corrections; a type comes with its content.
- **Hide the logo tap behind `dashboard` alone**: rejected. Every feature gets its own Feature Switch.
