### Testing Decisions

A good test here plays a Game the way a reader does and checks what the reader gets: the state the Core tells, the texts on the screen. It never reaches into a reducer, a component's props or a style. A test that would pass if the code returned nothing is not written.

Exactly two existing seams, approved by the owner:

1. **The Core Game play API.** Start a Game in a Game Mode from seeded content with an injected clock, schedule and random port; give answers; read the status. Covers: 3 Lives and the Game ending on the third wrong answer; 1 Life in «Виживання»; 20 seconds in «На час» and a `time-up` end; each of these switched off giving 5, 3 and 60; the answered state after a right and a wrong answer (the XP, the right answer's text, the last Life); the Game moving on when the schedule fires and not before; the shorter delays in «На час» and its clock running under the banner; no answered state after a pair of «Пари»; «Склади вислів» holding decoys and judging only on the check; the replacement range in «Англіцизми» options; the five groups and which mode stands in which; the plain Game Review rows; how a Game ended. Prior art: the Core's game-play tests.
2. **The whole app's screens with the Edition's strings.** Render the Game screen and the Games hub in the real composition with the UA Edition's strings and switches, tap as a reader, advance the injected time, read the texts. Covers: the banner texts and the next Round coming with no tap; no «Далі →»; «Життів: 2 з 3» after a wrong answer; the mode's name alone in the header; a keyed and a keyless option; «Розминка!» with the count after the Lives run out; «ФІНІШ» straight after the time is up; the three buttons and where each leads; «Огляд раундів» whose rows do nothing on a tap; the hub's five group titles, «Рекорд: N з M» and «Ще жодної гри», the toast on a mode that cannot be played; each switch off bringing the #1674 screen back; every new string passing the «ви» test. Prior art: the app's game-screen and game-modes tests.

The look against the board (sizes, faces, colours, motion, the dark Theme, «Менше руху») is not tested. It is checked by one screenshot per UI ticket beside the board and by the owner on his phone from a check list.

#### Feature Switches

The owner's rule: every new behaviour has its own Feature Switch in `edition.json`, required of every Edition, with its dependencies listed in the Core's Edition module (ADR 0089). Off, the behaviour of #1674 stays. The UA Edition declares all of them `on`.

| Switch | Behaviour | Needs |
|---|---|---|
| `gameAnswerBanner` | the banner and the Game moving on by itself (off: `gameAnswerCard`) | `game` |
| `gameThreeLives` | 3 Lives by default (off: 5) | `game` |
| `survivalOneLife` | 1 Life in «Виживання» (off: 3) | `gameSurvival` |
| `timedTwentySeconds` | 20 s and no time-up poster (off: 60 s, «Час!») | `gameTimed` |
| `gameRoundMascot` | the Mascot beside the question | `game` |
| `gameQuestionOnGround` | the question on the background, labels without numbers, the visible Lives line | `game` |
| `gameOptionStamp` | the board's options: keyless short ones, stamp, ✓ key, crossed-out text | `game` |
| `pairsStay` | found pairs stay, captions, no pause | `gamePairs` |
| `buildIdiomCheck` | decoy fragments and «Перевірити» | `gameBuildIdiom` |
| `livesOverWarmup` | «Розминка!» with the count and the sad Mascot | `finishPoster` |
| `gameEndToFeed` | the third button «До стрічки» | `finishPoster` |
| `plainGameReview` | the plain Game Review | `gameReview` |
| `gameHubGroups` | the five groups | `game` |
| `gameHubRecord` | «Рекорд: N з M» / «Ще жодної гри» and the board's descriptions | `game` |
| `gameModeToast` | the toast for a mode that cannot be played | `game` |

Pure look that changes no behaviour (sizes, faces, colours, key fill, the stress mark, the solid timer bar, the «ФІНІШ» type, the stamp, «+», glyphs, cascades, the «За літерами» name and slots, the «Впиши слово» field, the «Звідки слово» tile, the «Англіцизми» highlight, the streak number, the exit sheet text) rides on the existing switches (`gameAnswerCard`, `letterTiles`, `survivalStreak`, `finishPoster` and each mode's own).

