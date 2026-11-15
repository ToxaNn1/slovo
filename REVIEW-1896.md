# Review of PR #1896 (feat/1880-games-board vs origin/main), medium effort

Method: `code-review` skill (medium, no posting); the top findings were checked by hand against the branch.

## 1. A failed move-on leaves the Game stuck with no «Далі» (high)
- packages/core/src/game/game.ts:884-904 (moveOnLater); packages/ui/src/game/GameRound.tsx:177-196
- Defect: with `gameAnswerBanner` on, the comment says "A write that fails leaves the Round answered, for «Далі» to try again". But GameRound renders only the AnswerBanner (no button) and no AnswerSheet for non-pairs Rounds, so no «Далі» exists. The same dead end happens when `schedule` is undefined: moveOnLater returns early while the UI still shows the banner.
- Scenario: banner on, the reader answers the last Round or loses the last Life. next() then finish(), the userState.write rejects, `.catch(() => undefined)` swallows it, and the status stays 'answered'. Nothing retries. The only exit is ✕, and the Game result and Best result are lost.
- Fix: on failure, either reschedule or retry the move-on, or set a state that the UI renders with a «Далі» or «Спробувати ще» action (for example, show the AnswerSheet when the move-on failed). Also make `schedule` required when the banner is on.
- Test: openGame with banner on, a fake schedule and a userState whose write rejects once. Answer the last Round and run the schedule. Expect the Game to reach the finished state on a retry, or expose a next action. Today it stays 'answered' forever.

## 2. The banner switch is read once in the Core but live in the UI (high)
- packages/core/src/game/game.ts:710 vs apps/mobile/src/app/game/index.tsx:77,191 (useShown().gameAnswerBanner)
- Defect: the Core snapshots `edition.isFeatureEnabled('gameAnswerBanner')` at openGame. The screen reads the same switch live through useShown().
- Scenario: the composition opens with the switch off and a remote switch turns it on without a reopen. The UI hides the AnswerSheet and its «Далі» and shows the banner, but the Core never schedules a move-on, so every answered Round is stuck. In the reverse case, the Core advances by itself under a visible sheet.
- Fix: read the switch per Game or per answer in the Core (as lives and time limit are read at Game start) and expose it on PlayingGame, so the UI renders from the Core's value rather than useShown.
- Test: an Edition double whose switch flips between openGame and answer. Assert that the UI mode (banner or sheet) and the Core move-on behaviour agree.

## 3. On Android the banner does not wait for TalkBack, and on iOS any announcement finishing releases it (medium)
- packages/ui/src/game/AnswerBanner.tsx:141-157 (announced)
- Defect: off iOS, announced() resolves at once. On iOS, it resolves on any 'announcementFinished' event, not one matched to its own text.
- Scenario: TalkBack users have «Майже. Ось як правильно: …» cut off by the 950 ms move-on. On iOS, a late finish event from the previous banner (after the 5 s limit) resolves the next wait at once. Both break the ADR 0138 rule that the Game waits for the announcement.
- Fix: on iOS, match `event.announcement === text`. On Android, wait a length-based minimum (or ANNOUNCEMENT_LIMIT) when a screen reader is on (AccessibilityInfo.isScreenReaderEnabled).
- Test: mock AccessibilityInfo. Emit announcementFinished with another text and expect the promise still pending. On Android with the screen reader on, expect it not to resolve immediately.

## 4. Old numbers stay in the strings with survivalOneLife and timedTwentySeconds on (medium)
- editions/uk/strings.json:1863 («×3»), 1874-1877 («60с», «Хвилина…»), 2005 («Ось скільки вдалося за хвилину.»); edition.json:119-120
- Defect: with the switches on, «Виживання» has 1 Life but shows «×3», and «На час» lasts 20 s but shows «60с» and «Хвилина». The time-up line says «за хвилину».
- Scenario: the reader sees the hub card «60с / Хвилина, щоб угадати…», plays 20 s and gets «Ось скільки вдалося за хвилину.».
- Fix: add switch-keyed glyphs and lines (or numbers filled from the mode's lives and time limit), and pick them by the same switches.
- Test: a content-rules or GameResult test with timedTwentySeconds on asserts that no rendered text contains «60с» or «хвилин».

## 5. The hub toast names «Наголос» when no mode can start (low)
- apps/mobile/src/game/game-modes.ts:107-121 (gameModeToast)
- Defect: when no offer has canStart (all still `planning` right after open, or the Mix is too small), or `stress` is switched off for the Edition, the fallback still says «Влучай поки в «Наголос»!».
- Scenario: the reader taps «Пари» while every offer is planning and is told to play «Наголос», which cannot start either or is not on offer.
- Fix: when `startable` is empty, use a toast without the «other» clause (a new string), and never name a mode that is not in `offers`.
- Test: gameModeToast with every offer at canStart false, and with no stress offer. Expect no «Наголос» in the text.

## 6. pairsStay and buildIdiomCheck are on but nothing reads them (low, check scope)
- editions/uk/edition.json:124-125; apps/mobile/src/shown.ts:238-239 is the only reader
- Defect: the switches are on in the uk Edition, but no screen or Core code reads them. The «Пари» Round with the banner still falls back to the AnswerSheet after every pair, and «Склади вислів» still judges on the last fragment.
- Scenario: ADR 0139 and ADR 0138 behaviour is promised by an "on" switch but missing. If this behaviour belongs to tickets 1889-1891 (not merged), the switches should stay "off" until then.
- Fix: switch them off in edition.json until their tickets land, or implement them.
- Test: a screen test with pairsStay on asserts that there is no «Далі» between pairs.
