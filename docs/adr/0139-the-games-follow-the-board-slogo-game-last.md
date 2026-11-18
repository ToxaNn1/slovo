# The Games follow the board «slogo game last»

Status: accepted (owner, 14.11)

## Context

Spec #1880 brings the Games to the board «slogo game last». The owner decided D0–D11 on 14.11; ADR 0137 records the numbers (D4, D7) and ADR 0138 the answer banner (D1). This ADR records the rest in one place, so that the 07.11 decisions of spec #1674 have one superseding record.

## Decision

- **Groups (D2).** The Core's mode groups become five: sound, meaning, letters, speed, new. Sound: «Наголос»; meaning: «Обери правильне», «Пари», «Фразеологізми»; letters: «Анаграми»; speed: «На час»; new: «Вгадай слово», «За літерами», «Впиши слово», «Звідки слово», «Англіцизми», «Склади вислів», «Виживання». Their titles are «Звук», «Значення», «Букви», «Швидкість», «Нове». Behind `gameHubGroups`. Supersedes G3; G2 (the 13 modes and their content) stays, and «Зайве слово» (G4) is not built.
- **Hub row (D8, D9).** A Games hub row shows the board's glyph, the name, the board's line and the Best result as «Рекорд: {n} з {total}», `{total}` the mode's Round limit, or «Ще жодної гри»; behind `gameHubRecord`. A Game Mode that cannot be played keeps its normal look and answers a tap with a toast, starting nothing; behind `gameModeToast`. Supersedes G12.
- **Game Review (D11).** The Game Review is a plain list titled «Огляд раундів»: one row per played Round (each pair of «Пари» one row), ✓ or ✗ and the word. It does not expand and does not open the Entry. Behind `plainGameReview` (needs `gameReview`). Supersedes the Game Review part of G13.
- **End of a Game (D3, D7).** The Core keeps telling how a Game ended (`finished`, `time-up`, `lives-over`). Every end shows «ФІНІШ»: a `lives-over` Game shows the board's one poster, «ФІНІШ» and «ЩЕ РАУНД!» with the XP and record tiles (the «Розминка!» poster is retired, ADR 0176). Each end offers three actions: again, to the Games hub, to the Feed («До стрічки», behind `gameEndToFeed`). `gameEndToFeed` needs `finishPoster`. Supersedes G10. Owner, 15.11, to match the board: the Ukrainian Edition switches `gameEndToFeed` off; the actions are «Ще раз!» across the screen and «До ігор» across under it, and the poster draws no «До стрічки» whatever `gameEndToFeed` says (the switch is left to remove). On the ground the Round's bar takes a segment per Round, and the answer banner is a slab over the whole foot of the screen, its top rising to the right. The Ukrainian Edition switches `gameRoundMascot` off (no Mascot in any Round, the question across the full width) and hides «Пари», «Анаграми», «Впиши слово», «За літерами», «Виживання», «Склади вислів», «Звідки слово» and the Daily Crossword by their switches.
- **«Склади вислів».** A Round holds the expression's own words alone and the last chip gives the answer, as in spec #1674. The board's decoys and «Перевірити» were retired with their switch `buildIdiomCheck` (ADR 0176).
- **«За літерами».** The Core gives the letters as before; the screen draws them in capitals with the Edition's locale. The mode's Ukrainian name becomes «За літерами».
- **«Пари».** Each pair is a Round of its own: a pair answered waits for «Далі», and a pair answered leaves its places empty in the next Round. The board's grid whose found pairs stay was retired with its switch `pairsStay` (ADR 0176).
- **Round look (D5, D6, D10)** follows the board: the Mascot beside the prompt in its waiting, glad, wincing and sad states, existing Core Mascot states (ADR 0070), behind `gameRoundMascot`; the prompt on the background with no card, labels with no Round number, behind `gameQuestionOnGround` (owner, 15.11, to match the board «slogo game last»: no visible Lives line «Життів: {n} з {N}», which VoiceOver alone reads; the header row is the ✕, the bar and the Lives as hexagons, with no title; the mode and the Round, «НАГОЛОС · 1/10», stand in muted small caps over the question; in «Наголос» every letter takes a 38-pt cell in capitals on one line, narrowing for a long Word, and the Word with its hint stands in the middle of the room, the Mascot level with the foot of «Де наголос?»); the board's options (a short one with no key, the ✓ stamp, the ✓ and ✕ keys, the crossed-out wrong text), behind `gameOptionStamp`. These three need `game`. Supersedes G6 and the Mascot part of G1.
- **Pure look** that changes no behaviour (sizes, faces, colours, glyphs, cascades, the «За літерами» name, the exit sheet text and the like) rides on the existing switches (`finishPoster` and each mode's own); the answer card, typed «За літерами» and «Виживання» counting the Rounds passed have no switch of their own (ADR 0176).
- Every Feature Switch here is required of every Edition with its dependency listed in the Core's Edition module (ADR 0089); off, the behaviour of spec #1674 stays. Amends ADR 0052.

## Consequences

- The glossary's **Game Mode** names the five groups, «За літерами» and «Склади вислів» with decoys and a check; **Game Review** loses the sentence about expanding a row and opening the Entry.
- The texts of the board are Edition strings in «ти» (ADR 0075). The descriptions of «Виживання» and «На час», whose board texts contradict ADR 0137, wait for the owner's text and keep their one-liners until then.

## Considered Options

- **One ADR per decision D2–D11**: rejected; one record keeps the superseded 07.11 decisions in one place.
- **Keeping the 07.11 decisions where the board differs**: rejected by the owner; the board wins.
